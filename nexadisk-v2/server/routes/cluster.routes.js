const express = require('express');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { exec, execSync } = require('child_process');
const axios = require('axios');
const checkDiskSpace = require('check-disk-space').default;
const db = require('../config/database');
const clusterService = require('../services/clusterService');
const { authenticateToken, requireRole } = require('../middleware/auth');
const logger = require('../utils/logger');

// Define routers
const agentsRouter = express.Router();
const storageRouter = express.Router();
const networkRouter = express.Router();

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

// ─── AGENTS ROUTER ───────────────────────────────────────────────────────────

// Agent autonomous registration endpoint (unauthenticated, keyed)
agentsRouter.post('/register', async (req, res) => {
    const { id, hostname, url, key, disks } = req.body;
    const serverAgentKey = process.env.AGENT_KEY || 'nexadisk-agent-secret-key';

    if (key && serverAgentKey !== key) {
        logger.warn(`[Cluster/Agents] Unauthorized registration attempt from ${hostname} (${url})`);
        return res.status(401).json({ error: 'Unauthorized: Invalid Agent Key' });
    }

    if (!id || !hostname || !url) {
        return res.status(400).json({ error: 'Agent ID, hostname, and URL are required' });
    }

    try {
        const result = await clusterService.registerAgent({ id, hostname, url, disks });
        res.json(result);
    } catch (err) {
        logger.error(`[Cluster/Agents] Registration error: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// Admin approves an agent
agentsRouter.post('/approve', authenticateToken, requireRole(['Admin', 'Operator']), async (req, res) => {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'Agent ID required' });

    try {
        await clusterService.approveAgent(id, true);
        res.json({ message: 'Agent approved successfully' });
    } catch (err) {
        logger.error(`[Cluster/Agents] Approval error: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// Admin disconnects/rejects an agent
agentsRouter.post('/disconnect', authenticateToken, requireRole(['Admin', 'Operator']), async (req, res) => {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'Agent ID required' });

    try {
        await db.query('DELETE FROM persistent_agents WHERE id = $1', [id]);
        if (clusterService.agents[id]) {
            delete clusterService.agents[id];
        }
        logger.info(`[Cluster/Agents] Disconnected agent node: ${id}`);
        res.json({ message: 'Agent disconnected' });
    } catch (err) {
        logger.error(`[Cluster/Agents] Disconnect error: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// Get list of all agents
agentsRouter.get('/', authenticateToken, async (req, res) => {
    try {
        const list = await clusterService.getAgentsList();
        res.json(list);
    } catch (err) {
        logger.error(`[Cluster/Agents] List error: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// Get metrics history and agent states
agentsRouter.get('/metrics', authenticateToken, async (req, res) => {
    try {
        const history = clusterService.getTelemetryHistory();
        const list = await clusterService.getAgentsList();
        res.json({
            metricsHistory: history,
            agents: list
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get agent console logs
agentsRouter.get('/logs/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    if (id === 'local') {
        // Return local server log buffer if available, otherwise read recent logs
        const localLogs = logger.query ? await new Promise((resolve) => {
            logger.query({ limit: 100, order: 'desc' }, (err, results) => {
                if (err || !results || !results.file) return resolve([]);
                resolve(results.file.map(r => `[${r.timestamp}] [${r.level.toUpperCase()}]: ${r.message}`));
            });
        }) : [];
        return res.json({ logs: localLogs });
    }

    const agent = clusterService.agents[id];
    if (!agent) return res.status(404).json({ error: 'Agent not found or offline' });

    try {
        const response = await axios.get(`${agent.url}/api/logs`, { timeout: 5000 });
        res.json({ logs: response.data.logs || [] });
    } catch (err) {
        logger.error(`[Cluster/Agents] Failed to fetch remote logs: ${err.message}`);
        res.status(502).json({ error: `Failed to fetch logs from agent: ${err.message}` });
    }
});


// ─── STORAGE ROUTER ──────────────────────────────────────────────────────────

// Helper: get first non-loopback IPv4 address
const getLocalIP = () => {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                return net.address;
            }
        }
    }
    return '127.0.0.1';
};

// Local master disk stats
storageRouter.get('/local', authenticateToken, async (req, res) => {
    try {
        const rootPath = os.platform() === 'win32' ? 'C:' : '/';
        
        // Wrap checkDiskSpace in a 3-second timeout to prevent hanging on disconnected network drives on Windows
        const diskPromise = checkDiskSpace(rootPath);
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Disk space query timed out')), 3000)
        );
        
        let disk;
        try {
            disk = await Promise.race([diskPromise, timeoutPromise]);
        } catch (err) {
            logger.warn(`[Cluster/Storage] checkDiskSpace failed or timed out: ${err.message}`);
            disk = { size: 0, free: 0 };
        }
        
        // Retrieve latest Master CPU & RAM metrics from clusterService telemetry history
        const latestLocal = clusterService.telemetryHistory.local[clusterService.telemetryHistory.local.length - 1] || { cpu: 0, memory: 0 };

        const diskSize = disk.size || 0;
        const diskFree = disk.free || 0;
        const diskUsed = diskSize - diskFree;
        const percentage = diskSize > 0 ? Math.round((diskUsed / diskSize) * 100) : 0;

        res.json({
            hostname: os.hostname(),
            platform: os.platform(),
            ip: getLocalIP(),
            cpu: latestLocal.cpu || 0,
            memory: latestLocal.memory || 0,
            disks: [{
                mount: os.platform() === 'win32' ? 'C:\\' : '/',
                size: diskSize,
                free: diskFree,
                used: diskUsed,
                percentage: percentage
            }]
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get registered approved agents list
storageRouter.get('/agents', authenticateToken, async (req, res) => {
    try {
        const list = await clusterService.getAgentsList();
        res.json(list.filter(a => a.status === 'approved'));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get device tree breakdown for dashboard UI
storageRouter.get('/devices', authenticateToken, async (req, res) => {
    try {
        const platform = os.platform();
        let drives = [];

        if (platform === 'linux') {
            try {
                const output = execSync('lsblk -J -b -o NAME,SIZE,MOUNTPOINT,TYPE,FSTYPE').toString();
                const data = JSON.parse(output);
                drives = data.blockdevices.map(d => ({
                    name: d.name,
                    label: d.mountpoint || d.name,
                    size: parseInt(d.size, 10) || 0,
                    mountpoint: d.mountpoint,
                    type: 'disk'
                }));
            } catch (e) {
                // fallback if lsblk fails
                drives = [{ name: 'sda1', label: '/', size: 100 * 1024 * 1024 * 1024, type: 'disk' }];
            }
        } else if (platform === 'win32') {
            try {
                const cmd = 'powershell "Get-CimInstance -ClassName Win32_LogicalDisk | Select-Object DeviceID, VolumeName, Size, FreeSpace, DriveType | ConvertTo-Json"';
                const output = execSync(cmd, { timeout: 4000 }).toString();
                const rawDrives = JSON.parse(output);
                const drivesList = Array.isArray(rawDrives) ? rawDrives : [rawDrives];

                drives = drivesList.filter(d => d.DriveType === 3 || d.DriveType === 4).map(d => ({
                    name: d.DeviceID,
                    label: d.VolumeName || (d.DriveType === 4 ? 'Network Share' : 'Local Disk'),
                    size: d.Size || 0,
                    free: d.FreeSpace || 0,
                    used: (d.Size || 0) - (d.FreeSpace || 0),
                    mountpoint: d.DeviceID + '\\',
                    type: d.DriveType === 4 ? 'network' : 'disk',
                    drivetype: d.DriveType
                })).filter(d => d.size > 0 || d.type === 'network');
            } catch (winErr) {
                logger.warn(`[Cluster/Storage] Win32 logical disk query failed or timed out: ${winErr.message}`);
                drives = [{ name: 'C:', label: 'System Disk (Fallback)', size: 500 * 1024 * 1024 * 1024, type: 'disk' }];
            }
        }

        // Query database network shares
        const dbShares = await db.query('SELECT path, label FROM network_shares');
        for (const row of dbShares.rows) {
            const existing = drives.find(d => (d.mountpoint || '').toLowerCase().startsWith(row.path.toLowerCase()));
            if (existing) {
                existing.label = row.label;
            } else {
                let size = 0, free = 0;
                try {
                    const stats = await fs.promises.statfs(row.path);
                    size = stats.bsize * stats.blocks;
                    free = stats.bsize * stats.bfree;
                } catch (e) {
                    // path may not be mounted right now
                }
                drives.push({
                    name: row.label,
                    label: row.label,
                    size,
                    free,
                    used: size - free,
                    mountpoint: row.path,
                    type: 'network'
                });
            }
        }

        const totalSize = drives.reduce((acc, d) => acc + (d.size || 0), 0);
        res.json([{
            name: os.hostname(),
            type: 'host',
            size: totalSize,
            children: drives,
            status: 'online'
        }]);
    } catch (err) {
        logger.error(`[Cluster/Storage] Devices fetch error: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});


// ─── NETWORK SHARES ROUTER ───────────────────────────────────────────────────

networkRouter.use(authenticateToken);

// List active network shares from PG database
networkRouter.get('/list', async (req, res) => {
    try {
        const result = await db.query('SELECT id, path, label, username, type FROM network_shares');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Discover network shares on a specific IP
networkRouter.post('/discover', async (req, res) => {
    const { ip, username, password } = req.body;
    const sanitizedHost = ip ? ip.replace(/[^\w.-]/g, '') : '';
    const platform = os.platform();

    if (platform === 'linux') {
        if (!sanitizedHost) {
            return res.json({ items: [], raw: 'No IP provided.', method: 'smbclient' });
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
                return res.json({ items: [], raw: rawError, error: 'Authentication required or invalid credentials', method: 'smbclient' });
            }
            res.json({ items, raw: rawOutput || rawError, method: 'smbclient' });
        });
        return;
    }

    if (platform === 'win32') {
        const tryModern = sanitizedHost ? `Get-SmbShare -CimSession ${sanitizedHost} | Select-Object -ExpandProperty Name` : '';
        const tryLegacy = sanitizedHost ? `net view \\\\${sanitizedHost}` : `net view`;

        const runner = (cmd, isModern = false) => {
            exec(`powershell -Command "${cmd}"`, { timeout: 15000 }, (e, so, se) => {
                const raw = (so || se || '').trim();
                if (isModern && (e || !so)) {
                    return runner(tryLegacy, false);
                }

                const items = [];
                const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(l => l);

                if (isModern) {
                    lines.forEach(name => {
                        if (name && !name.includes(' ') && !name.includes(':') && !name.includes('-')) items.push(name);
                    });
                    if (items.length > 0) {
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

                res.json({ items, raw, method: 'legacy' });
            });
        };

        if (sanitizedHost) runner(tryModern, true);
        else runner(tryLegacy, false);
        return;
    }

    res.status(400).json({ error: 'Network discovery not supported on this platform' });
});

// Mount a network share and save to database
networkRouter.post('/mount', async (req, res) => {
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
                    return res.status(500).json({ error: 'Mount failed. Check cifs-utils installation.' });
                }
                const cmd = cmds[0];
                exec(cmd, { timeout: 30000 }, async (e, so, se) => {
                    if (e) {
                        return tryMount(cmds.slice(1));
                    }
                    if (credFilePath) try { fs.unlinkSync(credFilePath); } catch (e) { }

                    try {
                        const dbRes = await db.query(
                            'INSERT INTO network_shares (path, label, username, password, type) VALUES ($1, $2, $3, $4, $5) RETURNING id',
                            [mountPoint, label, username || null, null, type || 'SMB']
                        );
                        res.json({ id: dbRes.rows[0].id, mountpoint: mountPoint });
                    } catch (dbErr) {
                        res.status(500).json({ error: dbErr.message });
                    }
                });
            };

            fs.mkdir(mountPoint, { recursive: true }, () => tryMount(tryCommands));
        };

        if (hasAuth) {
            const credContent = `username=${safeUser}\npassword=${safePass}\n`;
            fs.writeFile(credFile, credContent, { mode: 0o600 }, (err) => {
                if (err) return res.status(500).json({ error: 'Failed to write credentials' });
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

        const saveToDb = async (mountPath) => {
            try {
                const dbRes = await db.query(
                    'INSERT INTO network_shares (path, label, username, password, type) VALUES ($1, $2, $3, $4, $5) RETURNING id',
                    [mountPath, label, username || null, null, type || 'SMB']
                );
                res.json({ id: dbRes.rows[0].id });
            } catch (dbErr) {
                res.status(500).json({ error: dbErr.message });
            }
        };

        const handleResult = (e, so, se, mountPath) => {
            if (e) {
                const errMsg = (se || so || e.message || 'Mount failed').trim();
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

    res.status(400).json({ error: `Mounting not supported on platform: ${platform}` });
});

// Delete/unmount a network share
networkRouter.delete('/:id', async (req, res) => {
    try {
        const dbRes = await db.query('SELECT path, label FROM network_shares WHERE id = $1', [req.params.id]);
        const r = dbRes.rows[0];

        const doDelete = async () => {
            await db.query('DELETE FROM network_shares WHERE id = $1', [req.params.id]);
            res.json({ message: 'Disconnected successfully' });
        };

        if (!r) {
            return res.json({ message: 'Already disconnected' });
        }

        const platform = os.platform();

        if (platform === 'win32') {
            exec(`net use "${r.path}" /delete /y`, { timeout: 15000 }, (err, so, se) => {
                doDelete();
            });
            return;
        }

        if (platform === 'linux') {
            const isNexaDiskMount = r.path && r.path.startsWith(MNT_BASE);
            const safeMount = sanitizeShellArg(r.path);

            const cleanup = () => {
                if (isNexaDiskMount && r.path) {
                    fs.rm(r.path, { recursive: true, force: true }, () => {
                        doDelete();
                    });
                } else {
                    doDelete();
                }
            };

            exec(`umount -l "${safeMount}" 2>/dev/null || sudo umount -l "${safeMount}"`, { timeout: 15000 }, () => {
                cleanup();
            });
            return;
        }

        doDelete();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Export all routers
module.exports = {
    agents: agentsRouter,
    storage: storageRouter,
    network: networkRouter
};
