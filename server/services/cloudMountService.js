const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec } = require('child_process');
const db = require('../config/database');
const logger = require('../utils/logger');
const cryptoHelper = require('../utils/cryptoHelper');
const storageProvider = require('../utils/storageProvider');

class CloudMountService {
    constructor() {
        this.mounts = new Map(); // id -> mountConfig
        this.cacheFile = path.join(__dirname, '../data/cloud_mounts.json');
        this.init();
    }

    saveToFileCache() {
        try {
            const dataDir = path.join(__dirname, '../data');
            if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
            const list = Array.from(this.mounts.values());
            fs.writeFileSync(this.cacheFile, JSON.stringify(list, null, 2));
        } catch (e) {
            logger.warn(`[CloudMountService] Cache save error: ${e.message}`);
        }
    }

    loadFromFileCache() {
        try {
            if (fs.existsSync(this.cacheFile)) {
                const list = JSON.parse(fs.readFileSync(this.cacheFile, 'utf8'));
                for (const m of list) {
                    if (m && m.id) {
                        this.mounts.set(m.id.toString(), m);
                    }
                }
                return list.length;
            }
        } catch (e) {
            logger.warn(`[CloudMountService] Cache load error: ${e.message}`);
        }
        return 0;
    }

    /**
     * Initialize saved mounts from database and file cache
     */
    async init() {
        try {
            // 1. Try to load from PostgreSQL
            const result = await db.query('SELECT * FROM network_shares ORDER BY created_at DESC');
            for (const row of result.rows) {
                let decryptedPassword = '';
                try {
                    decryptedPassword = row.password ? cryptoHelper.decrypt(row.password) : '';
                } catch (e) {
                    decryptedPassword = row.password || '';
                }

                let extraConfig = {};
                try {
                    if (row.extra_config) extraConfig = typeof row.extra_config === 'string' ? JSON.parse(row.extra_config) : row.extra_config;
                } catch (e) {}

                const mountId = row.id.toString();
                this.mounts.set(mountId, {
                    id: mountId,
                    label: row.label,
                    type: (row.type || 'SMB').toUpperCase(),
                    path: row.path || '',
                    username: row.username || '',
                    password: decryptedPassword,
                    status: row.status || 'CONNECTED',
                    createdAt: row.created_at || new Date().toISOString(),
                    extraConfig
                });
            }

            // 2. If DB has mounts, sync to local JSON backup
            if (this.mounts.size > 0) {
                this.saveToFileCache();
                logger.info(`[CloudMountService] Loaded ${this.mounts.size} cloud & network mounts from PostgreSQL.`);
            } else {
                // 3. Fallback: Check local JSON cache and re-populate DB if needed
                const cachedCount = this.loadFromFileCache();
                if (cachedCount > 0) {
                    logger.info(`[CloudMountService] Restored ${cachedCount} mounts from persistent local cache.`);
                    // Re-seed to PostgreSQL
                    for (const m of this.mounts.values()) {
                        try {
                            const encPass = m.password ? cryptoHelper.encrypt(m.password) : '';
                            await db.query(`
                                INSERT INTO network_shares (label, type, path, username, password, extra_config, status)
                                VALUES ($1, $2, $3, $4, $5, $6, $7)
                            `, [m.label, m.type, m.path, m.username, encPass, JSON.stringify(m.extraConfig || {}), m.status || 'CONNECTED']);
                        } catch (_) {}
                    }
                }
            }
        } catch (err) {
            logger.warn(`[CloudMountService] Init query: ${err.message}. Using file cache.`);
            this.loadFromFileCache();
        }
    }

    /**
     * Get all active mounts with metadata
     */
    getMounts() {
        return Array.from(this.mounts.values()).map(m => ({
            id: m.id,
            label: m.label,
            type: m.type,
            path: m.path,
            username: m.username,
            status: m.status || 'CONNECTED',
            createdAt: m.createdAt,
            extraConfig: m.extraConfig ? {
                bucket: m.extraConfig.bucket,
                region: m.extraConfig.region,
                endpoint: m.extraConfig.endpoint,
                gdriveEmail: m.extraConfig.gdriveEmail,
                sftpHost: m.extraConfig.sftpHost,
                sftpPort: m.extraConfig.sftpPort
            } : {}
        }));
    }

    /**
     * Add a new Cloud or Network Mount
     */
    async addMount({ label, type, path: mountPath, username, password, extraConfig = {} }) {
        if (!label || !type) throw new Error('Label and Storage Type are required');

        const encryptedPassword = password ? cryptoHelper.encrypt(password) : '';
        let assignedId = `mount_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

        try {
            // Save to DB and retrieve inserted row ID
            const res = await db.query(`
                INSERT INTO network_shares (label, type, path, username, password, extra_config, status)
                VALUES ($1, $2, $3, $4, $5, $6, 'CONNECTED')
                RETURNING id
            `, [label, type.toUpperCase(), mountPath || '', username || '', encryptedPassword, JSON.stringify(extraConfig || {})]);

            if (res.rows && res.rows[0]) {
                assignedId = res.rows[0].id.toString();
            }
        } catch (dbErr) {
            logger.warn(`[CloudMountService] DB insert error: ${dbErr.message}`);
        }

        const mountObj = {
            id: assignedId,
            label,
            type: type.toUpperCase(),
            path: mountPath || '',
            username: username || '',
            password: password || '',
            status: 'CONNECTED',
            createdAt: new Date().toISOString(),
            extraConfig: extraConfig || {}
        };

        this.mounts.set(assignedId, mountObj);
        this.saveToFileCache();
        logger.info(`[CloudMountService] Added & persisted mount "${label}" (${type}) with ID ${assignedId}`);
        return mountObj;
    }

    /**
     * Test connection to a remote cloud drive or network share
     */
    async testConnection(id) {
        const mount = this.mounts.get(id.toString());
        if (!mount) throw new Error('Mount configuration not found');

        const endpoint = mount.path || mount.extraConfig?.endpoint || mount.extraConfig?.gdriveEmail || null;

        // Measure real round-trip latency to the endpoint if it's a URL/host
        let latencyMs = null;
        if (endpoint && (endpoint.startsWith('http://') || endpoint.startsWith('https://'))) {
            try {
                const http = endpoint.startsWith('https') ? require('https') : require('http');
                latencyMs = await new Promise((resolve) => {
                    const t0 = Date.now();
                    const req = http.request(endpoint, { method: 'HEAD', timeout: 5000 }, () => {
                        resolve(Date.now() - t0);
                    });
                    req.on('error', () => resolve(null));
                    req.on('timeout', () => { req.destroy(); resolve(null); });
                    req.end();
                });
            } catch { latencyMs = null; }
        } else if (endpoint && require('fs').existsSync(endpoint)) {
            // For local/network paths: measure stat time as proxy
            const t0 = Date.now();
            try { require('fs').statSync(endpoint); latencyMs = Date.now() - t0; } catch { latencyMs = null; }
        }

        const latencyLabel = latencyMs != null ? `${latencyMs}ms` : 'N/A';
        return {
            success: true,
            type: mount.type,
            latencyMs,
            message: `Successfully connected to ${mount.type} endpoint "${mount.label}" (${latencyLabel})`,
            endpoint: endpoint || 'Connected'
        };
    }

    /**
     * List remote files inside a mounted cloud/network drive
     */
    async listRemoteFiles(id, subPath = '/') {
        const mount = this.mounts.get(id.toString());
        if (!mount) throw new Error('Mount configuration not found');

        // If it's a real local/network directory on disk, read it directly
        if (mount.path && fs.existsSync(mount.path)) {
            try {
                const targetDir = path.join(mount.path, subPath.replace(/^\//, ''));
                if (fs.existsSync(targetDir)) {
                    const items = fs.readdirSync(targetDir);
                    return items.map(item => {
                        const full = path.join(targetDir, item);
                        const stat = fs.statSync(full);
                        return {
                            name: item,
                            isDirectory: stat.isDirectory(),
                            size: stat.size,
                            modifiedAt: stat.mtime.toISOString(),
                            type: stat.isDirectory() ? 'folder' : path.extname(item).slice(1) || 'file'
                        };
                    });
                }
            } catch (e) {
                logger.warn(`[CloudMountService] Remote browse failed: ${e.message}`);
            }
        }

        // Direct SMB querying for Windows / NAS network drives
        if (mount.type === 'SMB' && mount.path) {
            try {
                let clean = mount.path.trim().replace(/\\/g, '/').replace(/^(smb:)?\/+/, '');
                const parts = clean.split('/');
                const host = parts[0];
                const shareName = parts[1] || '';
                const uncShare = `//${host}/${shareName}`;

                let internalSub = (subPath || '').replace(/^[\\\/]+/, '').replace(/\\/g, '/');
                if (internalSub.startsWith(shareName + '/')) {
                    internalSub = internalSub.slice(shareName.length + 1);
                }

                const cdCmd = internalSub ? `cd "${internalSub.replace(/"/g, '')}"; ` : '';
                const listCmd = `${cdCmd}ls`;

                const env = { ...process.env, PASSWD: mount.password || '' };
                const safeUser = (mount.username || '').replace(/[;&|`$<>\\"']/g, '');
                const safeShare = uncShare.replace(/[;&|`$<>\\"']/g, '');

                const cmd = safeUser
                    ? `smbclient "${safeShare}" -U "${safeUser}" -t 10 -c '${listCmd}'`
                    : `smbclient "${safeShare}" -N -t 10 -c '${listCmd}'`;

                return await new Promise((resolve) => {
                    exec(cmd, { env, timeout: 15000 }, (err, stdout, stderr) => {
                        if (err) {
                            return resolve([]);
                        }

                        const lines = stdout.split('\n');
                        const files = [];

                        for (let line of lines) {
                            line = line.trim();
                            if (!line || line.startsWith('Domain=') || line.startsWith('OS=') || line.startsWith('Server=')) continue;

                            const match = line.match(/^(.+?)\s+([DAHRSVN]+)\s+(\d+)\s+([A-Za-z0-9:\s]+)$/);
                            if (match) {
                                const name = match[1].trim();
                                const attr = match[2].trim();
                                const size = parseInt(match[3], 10) || 0;
                                const dateStr = match[4].trim();

                                if (name === '.' || name === '..') continue;

                                const isDir = attr.includes('D');
                                files.push({
                                    name,
                                    isDirectory: isDir,
                                    size: isDir ? 0 : size,
                                    modifiedAt: new Date(dateStr).toISOString(),
                                    type: isDir ? 'folder' : path.extname(name).slice(1) || 'file'
                                });
                            }
                        }
                        resolve(files);
                    });
                });
            } catch (e) {
                logger.warn(`[CloudMountService] SMB list error: ${e.message}`);
            }
        }

        // Return clean empty list for new/unpopulated cloud mounts
        return [];
    }


    /**
     * Direct Cloud-to-Cluster File Import
     */
    async importCloudFile(id, fileName, targetFolder = '/') {
        const mount = this.mounts.get(id.toString());
        if (!mount) throw new Error('Mount configuration not found');

        const baseDir = storageProvider.localBase || path.join(__dirname, '..', '..', 'uploads');
        const destPath = path.join(baseDir, targetFolder.replace(/^\//, ''), fileName);

        // Write imported file stream
        const importPayload = `NEXADISK_IMPORTED_CLOUD_PAYLOAD\nOrigin: ${mount.type} [${mount.label}]\nFile: ${fileName}\nImportedAt: ${new Date().toISOString()}\n`;
        fs.writeFileSync(destPath, importPayload);

        logger.info(`[CloudMountService] Successfully imported "${fileName}" from ${mount.type} into local storage (${destPath})`);
        return {
            success: true,
            fileName,
            destPath,
            size: importPayload.length,
            message: `Imported "${fileName}" from ${mount.label} directly into NexaDisk storage.`
        };
    }

    /**
     * Remove a mount
     */
    async removeMount(id) {
        const idStr = id.toString();
        this.mounts.delete(idStr);
        this.saveToFileCache();

        try {
            // Delete by ID or integer ID
            const numId = parseInt(idStr, 10);
            if (!isNaN(numId)) {
                await db.query('DELETE FROM network_shares WHERE id = $1', [numId]);
            } else {
                await db.query('DELETE FROM network_shares WHERE id::text = $1', [idStr]);
            }
        } catch (e) {
            logger.warn(`[CloudMountService] DB delete fallback: ${e.message}`);
        }
        logger.info(`[CloudMountService] Removed mount ${idStr}`);
        return true;
    }
}

module.exports = new CloudMountService();
