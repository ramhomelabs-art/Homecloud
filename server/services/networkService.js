const os = require('os');
const path = require('path');
const fs = require('fs');
const { exec, execSync } = require('child_process');
const db = require('../config/database');
const logger = require('../utils/logger');
const cryptoHelper = require('../utils/cryptoHelper');

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

class NetworkService {
    /**
     * Initializes network shares from the database on startup.
     * Attempting to automatically remount any previously saved SMB/CIFS drives.
     */
    async init() {
        logger.info('[NetworkService] Auto-remounting saved network shares...');
        try {
            const result = await db.query('SELECT id, path, label, username, password, type FROM network_shares');
            for (const share of result.rows) {
                try {
                    const decryptedPassword = cryptoHelper.decrypt(share.password);
                    await this._mountAtOSLevel({
                        sharePath: share.path,
                        label: share.label,
                        username: share.username,
                        password: decryptedPassword,
                        type: share.type || 'SMB',
                        isStartup: true
                    });
                    logger.info(`[NetworkService] Successfully remounted share: "${share.label}" (${share.path})`);
                } catch (err) {
                    logger.warn(`[NetworkService] Failed to remount share "${share.label}" on startup: ${err.message}`);
                }
            }
        } catch (dbErr) {
            logger.error(`[NetworkService] Database initialization query failed: ${dbErr.message}`);
        }
    }

    /**
     * Mounts a new network share, encrypts password, and saves to database.
     */
    async mountShare({ path: sharePath, label, username, password, type }) {
        if (!sharePath || !label) {
            throw new Error('Share path and label are required');
        }

        // 1. Mount at the OS level first to confirm credentials and connection
        const actualMountPath = await this._mountAtOSLevel({ sharePath, label, username, password, type });

        // 2. Encrypt the password for secure storage in database
        const encryptedPassword = cryptoHelper.encrypt(password);

        // 3. Save to database
        const dbRes = await db.query(
            'INSERT INTO network_shares (path, label, username, password, type) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [actualMountPath, label, username || null, encryptedPassword, type || 'SMB']
        );

        return { id: dbRes.rows[0].id, mountpoint: actualMountPath };
    }

    /**
     * Unmounts a network share and deletes it from database.
     */
    async disconnectShare(id) {
        const dbRes = await db.query('SELECT path, label FROM network_shares WHERE id = $1', [id]);
        const share = dbRes.rows[0];

        if (!share) {
            throw new Error('Share not found in database');
        }

        await this._unmountAtOSLevel(share.path);

        await db.query('DELETE FROM network_shares WHERE id = $1', [id]);
        logger.info(`[NetworkService] Unmounted and deleted share: "${share.label}" (${share.path})`);
    }

    /**
     * Health-checks all mounted drives and returns their live connection status.
     */
    async checkSharesStatus() {
        const checkDiskSpace = require('check-disk-space').default;
        const result = await db.query('SELECT id, path, label, username, type FROM network_shares');
        const list = [];

        for (const row of result.rows) {
            let online = false;
            let size = 0;
            let free = 0;
            let used = 0;

            try {
                // Perform a simple and quick directory read or access test with timeout to determine connection
                const checkPromise = fs.promises.readdir(row.path);
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000));
                await Promise.race([checkPromise, timeoutPromise]);
                online = true;

                // Query storage size parameters if connected successfully
                const diskPromise = checkDiskSpace(row.path);
                const diskTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Disk Timeout')), 3000));
                const diskInfo = await Promise.race([diskPromise, diskTimeout]);
                
                size = diskInfo.size || 0;
                free = diskInfo.free || 0;
                used = size - free;
            } catch (err) {
                online = false;
            }

            list.push({
                ...row,
                online,
                size,
                free,
                used
            });
        }
        return list;
    }

    /**
     * Inner helper: executes OS-specific mount operations
     */
    async _mountAtOSLevel({ sharePath, label, username, password, type, isStartup = false }) {
        const platform = os.platform();

        if (platform === 'win32') {
            const safePath = sanitizeShellArg(sharePath);
            const safeUser = sanitizeShellArg(username);
            const safePass = (password || '').replace(/"/g, '');

            return new Promise((resolve, reject) => {
                const cmd = safeUser && safePass
                    ? `net use "${safePath}" /user:"${safeUser}" "${safePass}" /persistent:yes`
                    : `net use "${safePath}" /persistent:yes`;

                exec(cmd, { timeout: 15000 }, (err, stdout, stderr) => {
                    if (err) {
                        const errMsg = (stderr || stdout || err.message || '').trim();
                        // Ignore already-connected state, treating it as successful
                        if (errMsg.toLowerCase().includes('successfully') || errMsg.toLowerCase().includes('already')) {
                            return resolve(sharePath);
                        }
                        if (isStartup) {
                            // On startup, we shouldn't fail fatally
                            return resolve(sharePath);
                        }
                        return reject(new Error(errMsg));
                    }
                    resolve(sharePath);
                });
            });
        }

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

            // Ensure mountpoint directory exists
            await fs.promises.mkdir(mountPoint, { recursive: true });

            const hasAuth = safeUser && safePass;
            let mountOpts;

            if (hasAuth) {
                const uid = process.getuid ? process.getuid() : 0;
                const gid = process.getgid ? process.getgid() : 0;
                // Note: Temporary credentials files are more secure than inline command password parameters
                const credFile = path.join(os.tmpdir(), `nexadisk_cred_${Date.now()}`);
                const credContent = `username=${safeUser}\npassword=${safePass}\n`;
                await fs.promises.writeFile(credFile, credContent, { mode: 0o600 });
                
                mountOpts = `credentials=${credFile},rw,uid=${uid},gid=${gid},file_mode=0664,dir_mode=0775,nounix,iocharset=utf8`;
            } else {
                const uid = process.getuid ? process.getuid() : 0;
                const gid = process.getgid ? process.getgid() : 0;
                mountOpts = `guest,ro,uid=${uid},gid=${gid},iocharset=utf8`;
            }

            const tryCommands = [
                `mount -t cifs "${safeShare}" "${mountPoint}" -o ${mountOpts}`,
                `sudo mount -t cifs "${safeShare}" "${mountPoint}" -o ${mountOpts}`
            ];

            const runMount = (cmds) => {
                return new Promise((resolve, reject) => {
                    let lastErrorMsg = '';
                    const executeNext = (index) => {
                        if (index >= cmds.length) {
                            return reject(new Error(`Mount command failed: ${lastErrorMsg || 'Please check cifs-utils dependency.'}`));
                        }
                        exec(cmds[index], { timeout: 20000 }, (err, stdout, stderr) => {
                            if (err) {
                                lastErrorMsg = (stderr || err.message || '').trim();
                                return executeNext(index + 1);
                            }
                            resolve(mountPoint);
                        });
                    };
                    executeNext(0);
                });
            };

            try {
                const resultPath = await runMount(tryCommands);
                return resultPath;
            } catch (err) {
                if (isStartup) {
                    return mountPoint; // do not crash startup
                }
                throw err;
            } finally {
                // Securely clean up credentials in all cases
                if (hasAuth) {
                    const tempFiles = fs.readdirSync(os.tmpdir()).filter(f => f.startsWith('nexadisk_cred_'));
                    for (const tf of tempFiles) {
                        try { fs.unlinkSync(path.join(os.tmpdir(), tf)); } catch (e) {}
                    }
                }
            }
        }

        throw new Error(`Mounting is not supported on this platform: ${platform}`);
    }

    /**
     * Inner helper: executes OS-specific unmount operations
     */
    async _unmountAtOSLevel(mountPath) {
        const platform = os.platform();

        if (platform === 'win32') {
            return new Promise((resolve) => {
                exec(`net use "${mountPath}" /delete /y`, { timeout: 15000 }, () => {
                    resolve();
                });
            });
        }

        if (platform === 'linux') {
            const isNexaDiskMount = mountPath && mountPath.startsWith(MNT_BASE);
            const safeMount = sanitizeShellArg(mountPath);

            return new Promise((resolve) => {
                exec(`umount -l "${safeMount}" 2>/dev/null || sudo umount -l "${safeMount}"`, { timeout: 15000 }, () => {
                    if (isNexaDiskMount && mountPath) {
                        fs.rm(mountPath, { recursive: true, force: true }, () => {
                            resolve();
                        });
                    } else {
                        resolve();
                    }
                });
            });
        }
    }
}

const networkService = new NetworkService();
module.exports = networkService;
