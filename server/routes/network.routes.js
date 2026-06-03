const express = require('express');
const router = express.Router();
const os = require('os');
const path = require('path');
const fs = require('fs');
const { exec, execSync } = require('child_process');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const sanitizeShellArg = (p) => (p || '').replace(/[;&|`$<>\\"']/g, '');

const getMountBase = () => {
    if (os.platform() === 'win32') return null;
    const candidates = [
        process.env.MNT_BASE,
        '/opt/nexadisk/mnt',
        path.join(os.homedir(), '.nexadisk', 'mnt'),
        path.join(__dirname, '..', 'mnt')
    ];
    for (const c of candidates) {
        if (c) {
            try {
                fs.mkdirSync(c, { recursive: true });
                return path.resolve(c);
            } catch (e) { }
        }
    }
    return path.resolve(__dirname, '..', 'mnt');
};

const MNT_BASE = getMountBase();

router.get('/list', authenticateToken, (req, res) => {
    db.all("SELECT id, path, label, username, type FROM network_shares", (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

router.post('/discover', authenticateToken, (req, res) => {
    const { ip } = req.body;
    const sanitizedHost = ip ? ip.replace(/[^\w.-]/g, '') : '';

    if (os.platform() === 'linux') {
        const { username, password } = req.body;
        if (!sanitizedHost) {
            return res.json({ items: [], raw: 'No IP provided. Range scan requires additional tools.', method: 'smbclient' });
        }

        const authPart = (username && password) ? `-U "${username}%${password}"` : '-N';
        const cmd = `smbclient -L ${sanitizedHost} ${authPart}`;

        exec(cmd, { timeout: 15000 }, (e, so, se) => {
            const rawOutput = (so || '').trim();
            const rawError = (se || '').trim();
            const items = [];
            const lines = (rawOutput + '\n' + rawError).split(/\r?\n/).map(l => l.trim()).filter(l => l);

            let capturing = false;
            lines.forEach(line => {
                if (line.includes('----')) {
                    capturing = true;
                    return;
                }

                if (capturing) {
                    const parts = line.split(/\s+/);
                    const name = parts[0];
                    const type = parts[1];
                    if (name && type === 'Disk' && !name.endsWith('$')) {
                        items.push(name);
                    }
                }
            });

            if (items.length === 0 && rawError && (rawError.includes('ACCESS_DENIED') || rawError.includes('LOGON_FAILURE'))) {
                console.warn(`[Network Discovery] Linux Failure: ${rawError}`);
                return res.json({ items: [], raw: rawError, error: 'Authentication required or invalid credentials', method: 'smbclient' });
            }

            console.log(`[Network Discovery] Linux found ${items.length} items`);
            res.json({ items, raw: rawOutput || rawError, method: 'smbclient' });
        });
        return;
    }

    if (os.platform() === 'win32') {
        const tryModern = sanitizedHost ? `Get-SmbShare -CimSession ${sanitizedHost} | Select-Object -ExpandProperty Name` : '';
        const tryLegacy = sanitizedHost ? `net view \\\\${sanitizedHost}` : `net view`;

        const runner = (cmd, isModern = false) => {
            exec(`powershell -Command "${cmd}"`, { timeout: 15000 }, (e, so, se) => {
                const raw = (so || se || '').trim();
                if (isModern && (e || !so)) {
                    console.log(`[Network Discovery] Modern failed, falling back to legacy...`);
                    return runner(tryLegacy, false);
                }

                const items = [];
                const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(l => l);

                if (isModern) {
                    lines.forEach(name => {
                        if (name && !name.includes(' ') && !name.includes(':') && !name.includes('-')) items.push(name);
                    });
                    if (items.length > 0) {
                        console.log(`[Network Discovery] Modern found ${items.length} items`);
                        return res.json({ items, raw, method: 'modern' });
                    }
                    return runner(tryLegacy, false);
                }

                lines.forEach(line => {
                    const low = line.toLowerCase();
                    if (line.includes('---') || low.includes('command completed') ||
                        low.startsWith('shared resources') || low.startsWith('server name') ||
                        low.startsWith('share name') || low.startsWith('resource name') ||
                        low.includes('error') || low.includes('cannot connect')) return;

                    const parts = line.split(/\s{2,}/);
                    const name = parts[0] ? parts[0].trim() : '';
                    if (name) {
                        const forbidden = ['type', 'remark', 'comment', 'share', 'server', 'resource', 'name', 'the', 'command', 'access', 'denied'];
                        if (forbidden.includes(name.toLowerCase())) return;
                        if (name.includes(':') || name.includes(' ')) return;
                        items.push(name);
                    }
                });

                console.log(`[Network Discovery] Legacy found ${items.length} items`);
                res.json({ items, raw, method: 'legacy' });
            });
        };

        if (sanitizedHost) runner(tryModern, true);
        else runner(tryLegacy, false);
        return;
    }

    res.status(400).json({ error: 'Network discovery not supported on this platform' });
});

router.post('/mount', authenticateToken, (req, res) => {
    const { path: sharePath, label, username, password, type } = req.body;

    if (!sharePath || !label) {
        return res.status(400).json({ error: 'Share path and label are required' });
    }

    const platform = os.platform();

    if (platform === 'linux') {
        let normalizedPath = sharePath.trim().replace(/\\/g, '/');
        if (!normalizedPath.startsWith('//')) {
            normalizedPath = '//' + normalizedPath.replace(/^\/+/, '');
        }

        const safeShare = sanitizeShellArg(normalizedPath);
        const safeUser  = sanitizeShellArg(username);
        const safePass  = sanitizeShellArg(password);
        const safeLabel = label.replace(/[^a-zA-Z0-9_\-]/g, '_');
        const mountPoint = path.join(MNT_BASE, safeLabel);

        const credFile = path.join(os.tmpdir(), `nexadisk_cred_${Date.now()}`);
        const hasAuth = safeUser && safePass;

        const doMount = (credFilePath) => {
            let mountOpts;
            if (hasAuth) {
                mountOpts = `credentials=${credFilePath},rw,uid=${process.getuid ? process.getuid() : 0},gid=${process.getgid ? process.getgid() : 0},file_mode=0664,dir_mode=0775,nounix,iocharset=utf8`;
            } else {
                mountOpts = `guest,ro,uid=${process.getuid ? process.getuid() : 0},gid=${process.getgid ? process.getgid() : 0},iocharset=utf8`;
            }

            const tryCommands = [
                `mount -t cifs "${safeShare}" "${mountPoint}" -o ${mountOpts}`,
                `sudo mount -t cifs "${safeShare}" "${mountPoint}" -o ${mountOpts}`
            ];

            const tryMount = (cmds) => {
                if (cmds.length === 0) {
                    if (credFilePath) try { fs.unlinkSync(credFilePath); } catch (e) { }
                    return res.status(500).json({ error: 'All mount attempts failed. Ensure cifs-utils is installed: apt-get install cifs-utils' });
                }
                const cmd = cmds[0];
                exec(cmd, { timeout: 30000 }, (e, so, se) => {
                    if (e) {
                        console.warn(`[Linux Mount] Attempt failed (${cmd}): ${se || e.message}`);
                        return tryMount(cmds.slice(1));
                    }
                    if (credFilePath) try { fs.unlinkSync(credFilePath); } catch (e) { }
                    db.run(
                        "INSERT INTO network_shares (path, label, username, password, type) VALUES (?, ?, ?, ?, ?)",
                        [mountPoint, label, username || null, null, type || 'SMB'],
                        function (err) {
                            if (err) return res.status(500).json({ error: err.message });
                            res.json({ id: this.lastID, mountpoint: mountPoint });
                        }
                    );
                });
            };

            fs.mkdir(mountPoint, { recursive: true }, () => tryMount(tryCommands));
        };

        if (hasAuth) {
            const credContent = `username=${safeUser}\npassword=${safePass}\n`;
            fs.writeFile(credFile, credContent, { mode: 0o600 }, (err) => {
                if (err) return res.status(500).json({ error: 'Failed to write credentials file' });
                doMount(credFile);
            });
        } else {
            doMount(null);
        }
        return;
    }

    if (platform === 'win32') {
        const safePath = sanitizeShellArg(sharePath);
        const safeUser = sanitizeShellArg(username);
        const safePass = (password || '').replace(/"/g, '');

        const saveToDb = (mountPath) => {
            db.run(
                "INSERT INTO network_shares (path, label, username, password, type) VALUES (?, ?, ?, ?, ?)",
                [mountPath, label, username || null, null, type || 'SMB'],
                function (err) {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ id: this.lastID });
                }
            );
        };

        const handleResult = (e, so, se, mountPath) => {
            if (e) {
                const errMsg = (se || so || e.message || 'Mount failed').trim();
                console.error(`[Windows Mount] Error: ${errMsg}`);
                if (errMsg.toLowerCase().includes('successfully') || errMsg.toLowerCase().includes('already')) {
                    return saveToDb(mountPath);
                }
                return res.status(500).json({ error: errMsg });
            }
            saveToDb(mountPath);
        };

        if (safeUser && safePass) {
            exec(`net use "${safePath}" /user:"${safeUser}" "${safePass}" /persistent:yes`,
                { timeout: 30000 },
                (e, so, se) => handleResult(e, so, se, sharePath)
            );
        } else {
            exec(`net use "${safePath}" /persistent:yes`,
                { timeout: 30000 },
                (e, so, se) => handleResult(e, so, se, sharePath)
            );
        }
        return;
    }

    res.status(400).json({ error: `Mounting not yet supported on platform: ${platform}` });
});

router.delete('/:id', authenticateToken, (req, res) => {
    db.get("SELECT path, label FROM network_shares WHERE id = ?", [req.params.id], (e, r) => {
        if (e) return res.status(500).json({ error: e.message });

        const doDelete = () => {
            db.run("DELETE FROM network_shares WHERE id = ?", [req.params.id], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: 'Disconnected successfully' });
            });
        };

        if (!r) {
            return res.json({ message: 'Already disconnected' });
        }

        const platform = os.platform();

        if (platform === 'win32') {
            exec(`net use "${r.path}" /delete /y`, { timeout: 15000 }, (err, so, se) => {
                if (err) {
                    const msg = (se || so || err.message || '').toLowerCase();
                    if (!msg.includes('not found') && !msg.includes('no entries')) {
                        console.warn(`[Unmount Windows] Warning: ${se || err.message}`);
                    }
                }
                doDelete();
            });
            return;
        }

        if (platform === 'linux') {
            const isNexaDiskMount = r.path && r.path.startsWith(MNT_BASE);
            const safeMount = sanitizeShellArg(r.path);

            const cleanup = () => {
                if (isNexaDiskMount && r.path) {
                    fs.rm(r.path, { recursive: true, force: true }, (rmErr) => {
                        if (rmErr) console.warn(`[Unmount Linux] Failed to remove mount dir: ${rmErr.message}`);
                        doDelete();
                    });
                } else {
                    doDelete();
                }
            };

            exec(`umount -l "${safeMount}" 2>/dev/null || sudo umount -l "${safeMount}"`, { timeout: 15000 }, (err) => {
                if (err) {
                    console.warn(`[Unmount Linux] umount warning (continuing cleanup): ${err.message}`);
                }
                cleanup();
            });
            return;
        }

        doDelete();
    });
});

module.exports = router;
