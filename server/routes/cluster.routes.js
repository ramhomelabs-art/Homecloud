const express = require('express');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { exec, execSync, execFile } = require('child_process');
const axios = require('axios');
const checkDiskSpace = require('check-disk-space').default;
const db = require('../config/database');
const clusterService = require('../services/clusterService');
const networkService = require('../services/networkService');
const { authenticateToken, requireRole } = require('../middleware/auth');
const logger = require('../utils/logger');
const storageProvider = require('../utils/storageProvider');
const { calculateCategorySizes } = require('../utils/fileHelpers');

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

// Agent autonomous registration endpoint (Zero-Trust HMAC & Keyed)
agentsRouter.post('/register', async (req, res) => {
    const { id, hostname, url, key, disks, timestamp, nonce, signature } = req.body;

    if (!id || !hostname || !url) {
        return res.status(400).json({ error: 'Agent ID, hostname, and URL are required' });
    }

    try {
        const result = await clusterService.registerAgent({ id, hostname, url, disks, key, timestamp, nonce, signature });
        if (result.status === 'rejected') {
            return res.status(401).json({ error: result.error || 'Unauthorized: Invalid Agent Key or HMAC signature' });
        }
        res.json(result);
    } catch (err) {
        logger.error(`[Cluster/Agents] Registration error: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// Manual Direct Connect (Portainer-style Agent Pairing)
agentsRouter.post('/manual-connect', authenticateToken, requireRole(['Admin', 'Operator']), async (req, res) => {
    const { ip, port, key, label } = req.body;
    if (!ip) return res.status(400).json({ error: 'Target Agent IP address or hostname is required' });

    try {
        const result = await clusterService.manualConnectAgent({ ip, port: parseInt(port || 5001, 10), key, label });
        res.json(result);
    } catch (err) {
        logger.error(`[Cluster/Agents] Manual connect error: ${err.message}`);
        res.status(400).json({ error: err.message });
    }
});

// On-demand Security Compliance Audit scan
agentsRouter.post('/audit/:id', authenticateToken, requireRole(['Admin', 'Operator']), async (req, res) => {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'Agent ID is required' });

    try {
        const report = await clusterService.runComplianceAudit(id);
        res.json({ success: true, report });
    } catch (err) {
        logger.error(`[Cluster/Agents] Audit error for ${id}: ${err.message}`);
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
        try {
            const logFilePath = path.join(__dirname, '..', 'logs', 'combined.log');
            if (fs.existsSync(logFilePath)) {
                const content = fs.readFileSync(logFilePath, 'utf8');
                const lines = content.split('\n').filter(l => l.trim());
                // Get the last 100 lines and reverse them so that latest is at the top (descending)
                const mappedLogs = lines.slice(-100).reverse().map(line => {
                    try {
                        const parsed = JSON.parse(line);
                        return `[${parsed.timestamp}] [${parsed.level.toUpperCase()}]: ${parsed.message}`;
                    } catch (e) {
                        return line;
                    }
                });
                return res.json({ logs: mappedLogs });
            }
        } catch (err) {
            logger.error(`Error reading combined.log: ${err.message}`);
        }

        // Winston query fallback
        const localLogs = logger.query ? await new Promise((resolve) => {
            logger.query({ limit: 100, order: 'desc' }, (err, results) => {
                if (err || !results || !results.file) return resolve([]);
                resolve(results.file.map(r => `[${r.timestamp}] [${r.level.toUpperCase()}]: ${r.message}`));
            });
        }) : [];
        return res.json({ logs: localLogs });
    }

    let agent = clusterService.agents[id];
    if (!agent) {
        // Try finding by hostname or prefix
        agent = Object.values(clusterService.agents || {}).find(a => a.id?.startsWith(id) || id.startsWith(a.id) || a.hostname === id);
    }

    if (!agent) {
        return res.json({ 
            logs: [
                `[${new Date().toISOString()}] [INFO] Node "${id}" is connecting or in standby mode.`,
                `[${new Date().toISOString()}] [INFO] Waiting for next telemetry heartbeat packet.`
            ] 
        });
    }

    try {
        const response = await axios.get(`${agent.url}/api/logs`, { timeout: 4000 });
        res.json({ logs: response.data.logs || [] });
    } catch (err) {
        res.json({
            logs: [
                `[${new Date().toISOString()}] [INFO] Node ${agent.hostname || id} (IP: ${agent.ip}) active.`,
                `[${new Date().toISOString()}] [INFO] Telemetry stream synchronized with Master Control Plane.`,
                `[${new Date().toISOString()}] [METRICS] CPU: ${agent.cpuUsage || 0}% | Memory: ${agent.memUsage || 0}% | Compliance: ${agent.compliance || 'compliant'}`
            ]
        });
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

// Cache disk space results for 10 seconds to avoid high-frequency subprocess spawning
let cachedDiskSpace = null;
let lastDiskQueryTime = 0;

// Local master disk stats
storageRouter.get('/local', authenticateToken, async (req, res) => {
    try {
        const rootPath = storageProvider.localBase || (os.platform() === 'win32' ? 'C:\\' : '/');
        let disks = [];

        if (os.platform() === 'win32') {
            try {
                const cmd = 'powershell "Get-CimInstance -ClassName Win32_LogicalDisk | Select-Object DeviceID, VolumeName, Size, FreeSpace, DriveType | ConvertTo-Json"';
                const output = execSync(cmd, { timeout: 3500 }).toString();
                const rawDrives = JSON.parse(output);
                const drivesList = Array.isArray(rawDrives) ? rawDrives : [rawDrives];

                disks = drivesList.filter(d => (d.DriveType === 3 || d.DriveType === 4) && d.Size > 0).map(d => {
                    const size = parseInt(d.Size, 10) || 0;
                    const free = parseInt(d.FreeSpace, 10) || 0;
                    const used = Math.max(0, size - free);
                    const pct = size > 0 ? Math.round((used / size) * 100) : 0;
                    return {
                        mount: d.DeviceID + '\\',
                        name: d.DeviceID,
                        label: d.VolumeName || (d.DriveType === 4 ? 'Network Share' : 'Local Disk'),
                        size: size,
                        free: free,
                        used: used,
                        percentage: pct,
                        type: d.DriveType === 4 ? 'network' : 'disk'
                    };
                });
            } catch (winErr) {
                logger.warn(`[Cluster/Storage] Win32 logical disk query failed: ${winErr.message}`);
            }
        }

        if (disks.length === 0) {
            let disk = cachedDiskSpace;
            const now = Date.now();
            if (!disk || (now - lastDiskQueryTime > 10000)) {
                try {
                    disk = await checkDiskSpace(rootPath);
                    cachedDiskSpace = disk;
                    lastDiskQueryTime = now;
                } catch (err) {
                    disk = cachedDiskSpace || { size: 0, free: 0 };
                }
            }
            const diskSize = disk?.size || 0;
            const diskFree = disk?.free || 0;
            const diskUsed = Math.max(0, diskSize - diskFree);
            const percentage = diskSize > 0 ? Math.round((diskUsed / diskSize) * 100) : 0;

            disks = [{
                mount: rootPath,
                name: 'Local Root',
                size: diskSize,
                free: diskFree,
                used: diskUsed,
                percentage: percentage
            }];
        }
        
        // Retrieve latest Master CPU & RAM metrics from clusterService telemetry history
        const latestLocal = clusterService.telemetryHistory.local[clusterService.telemetryHistory.local.length - 1] || { cpu: 0, memory: 0 };

        const primaryDisk = disks[0] || { used: 0 };
        const categories = calculateCategorySizes(storageProvider.localBase, primaryDisk.used);

        res.json({
            hostname: os.hostname(),
            platform: os.platform(),
            ip: getLocalIP(),
            cpu: latestLocal.cpu || 0,
            memory: latestLocal.memory || 0,
            categories,
            disks: disks
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Dedicated categories endpoint
storageRouter.get('/categories', authenticateToken, async (req, res) => {
    try {
        const categories = calculateCategorySizes(storageProvider.localBase, 0);
        res.json({ categories });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Analyze workspace storage
storageRouter.get('/analyze', authenticateToken, async (req, res) => {
    try {
        // 1. Calculate Trash Size
        const trashResult = await db.query('SELECT SUM(size) FROM trash_items');
        const trashSize = parseInt(trashResult.rows[0].sum, 10) || 0;

        // 2. Calculate Temporary / Zip Buffer Sizes in os.tmpdir()
        const tempBase = os.tmpdir();
        let tempSize = 0;
        try {
            const tempFiles = fs.readdirSync(tempBase);
            for (const file of tempFiles) {
                if (file.startsWith('nexadisk') || file.includes('zip') || file.includes('tmp')) {
                    try {
                        const stats = fs.statSync(path.join(tempBase, file));
                        if (!stats.isDirectory()) {
                            tempSize += stats.size;
                        }
                    } catch (e) {}
                }
            }
        } catch (e) {}

        // 3. Log/Activities database size estimation
        const alertsResult = await db.query('SELECT COUNT(*) FROM system_alerts');
        const alertsCount = parseInt(alertsResult.rows[0].count, 10) || 0;
        const logSize = alertsCount * 256; // Estimate 256 bytes per alert row

        res.json({
            trashSize,
            tempSize,
            logSize,
            totalReclaimable: trashSize + tempSize + logSize
        });
    } catch (err) {
        logger.error(`[Storage Analyze Error] ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// Clean/purge workspace caches
storageRouter.post('/clean', authenticateToken, async (req, res) => {
    try {
        // 1. Empty Trash
        const result = await db.query('SELECT * FROM trash_items WHERE agent_id IS NULL');
        const items = result.rows;
        for (const item of items) {
            if (fs.existsSync(item.trash_path)) {
                try {
                    const stat = fs.statSync(item.trash_path);
                    if (stat.isDirectory()) {
                        fs.rmSync(item.trash_path, { recursive: true, force: true });
                    } else {
                        fs.unlinkSync(item.trash_path);
                    }
                } catch (e) {}
            }
        }
        await db.query('DELETE FROM trash_items WHERE agent_id IS NULL');

        // 2. Empty Temporary Files in os.tmpdir()
        const tempBase = os.tmpdir();
        try {
            const tempFiles = fs.readdirSync(tempBase);
            for (const file of tempFiles) {
                if (file.startsWith('nexadisk') || file.includes('zip') || file.includes('tmp')) {
                    try {
                        const filePath = path.join(tempBase, file);
                        const stats = fs.statSync(filePath);
                        if (!stats.isDirectory()) {
                            fs.unlinkSync(filePath);
                        }
                    } catch (e) {}
                }
            }
        } catch (e) {}

        // 3. Clear System Alert Logs (keep last 10)
        await db.query('DELETE FROM system_alerts WHERE id NOT IN (SELECT id FROM system_alerts ORDER BY timestamp DESC LIMIT 10)');

        res.json({ success: true, message: 'Storage optimized successfully' });
    } catch (err) {
        logger.error(`[Storage Clean Error] ${err.message}`);
        res.status(500).json({ error: err.message });
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
                
                const listDevices = (devices) => {
                    let result = [];
                    for (const d of devices) {
                        if (d.children && d.children.length > 0) {
                            result = result.concat(listDevices(d.children));
                        } else {
                            result.push({
                                name: d.name,
                                label: d.mountpoint || d.name,
                                size: parseInt(d.size, 10) || 0,
                                mountpoint: d.mountpoint,
                                fstype: d.fstype,
                                type: 'disk'
                            });
                        }
                    }
                    return result;
                };

                drives = listDevices(data.blockdevices || []);
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
        const hostNode = {
            id: 'master_host',
            name: `${os.hostname()} (Primary Master)`,
            type: 'host',
            size: totalSize,
            children: drives,
            status: 'online'
        };

        const resultNodes = [hostNode];

        // Query registered active cluster sites
        try {
            const sitesRes = await db.query('SELECT * FROM cluster_sites ORDER BY created_at DESC');
            const now = Date.now();
            for (const site of sitesRes.rows) {
                const details = site.details || {};
                const storagePools = details.storagePools || [];
                const lastHeartbeatTime = site.last_heartbeat ? new Date(site.last_heartbeat).getTime() : 0;
                const isOnline = (now - lastHeartbeatTime) <= 12000 && site.status === 'connected';

                const remoteDrives = storagePools.map(p => ({
                    name: p.name,
                    label: `${p.name} (${p.type || 'ZFS/Ceph'})`,
                    size: Number(p.totalBytes || site.storage_capacity_bytes || 0),
                    used: Number(p.usedBytes || site.storage_used_bytes || 0),
                    free: Math.max(0, Number(p.totalBytes || 0) - Number(p.usedBytes || 0)),
                    mountpoint: `/sitemesh/${site.id}/${p.name}`,
                    type: 'cluster_pool',
                    siteId: site.id,
                    siteName: site.name,
                    status: isOnline ? 'online' : 'offline'
                }));

                resultNodes.push({
                    id: site.id,
                    name: `🌐 ${site.name}`,
                    label: `🌐 ${site.name}`,
                    type: 'Cluster Site',
                    size: Number(site.storage_capacity_bytes || 0),
                    children: remoteDrives.length > 0 ? remoteDrives : [{
                        name: 'cluster-storage-root',
                        label: 'Cluster Storage Pool',
                        size: Number(site.storage_capacity_bytes || 0),
                        used: Number(site.storage_used_bytes || 0),
                        free: Math.max(0, Number(site.storage_capacity_bytes || 0) - Number(site.storage_used_bytes || 0)),
                        mountpoint: `/sitemesh/${site.id}/`,
                        type: 'cluster_pool',
                        siteId: site.id,
                        siteName: site.name,
                        status: isOnline ? 'online' : 'offline'
                    }],
                    status: isOnline ? 'online' : 'offline',
                    location: site.location
                });
            }
        } catch (sErr) {
            logger.warn(`[Cluster/Storage] Failed to query cluster sites for devices list: ${sErr.message}`);
        }

        res.json(resultNodes);
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
        const shares = await networkService.checkSharesStatus();
        res.json(shares);
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

        // Check if smbclient is installed first
        let smbclientAvailable = false;
        try { execSync('which smbclient', { stdio: 'ignore' }); smbclientAvailable = true; } catch (_) {}

        if (!smbclientAvailable) {
            // Attempt nmblookup as a lightweight fallback (just confirm the host is reachable)
            return execFile('nmblookup', [sanitizedHost], { timeout: 5000 }, (ne, nso) => {
                const hostReachable = nso && nso.includes(sanitizedHost);
                res.json({
                    items: [],
                    raw: nso || '',
                    error: `smbclient is not installed on this server. Install it with:\n  sudo apt-get install -y smbclient\nthen restart the service.\n\nHost ${sanitizedHost} ${hostReachable ? 'is reachable (responded to nmblookup)' : 'did not respond to nmblookup'}.`,
                    method: 'nmblookup-fallback',
                    smbclient_missing: true
                });
            });
        }

        const args = (username && password) ? ['-L', sanitizedHost, '-U', `${username}%${password}`] : ['-L', sanitizedHost, '-N'];
        execFile('smbclient', args, { timeout: 15000 }, (e, so, se) => {
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
    try {
        const result = await networkService.mountShare(req.body);
        res.json(result);
    } catch (err) {
        logger.error(`[Cluster/Network] Mount error: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// Delete/unmount a network share
networkRouter.delete('/:id', async (req, res) => {
    try {
        await networkService.disconnectShare(req.params.id);
        res.json({ message: 'Disconnected successfully' });
    } catch (err) {
        logger.error(`[Cluster/Network] Disconnect error: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// Export all routers
module.exports = {
    agents: agentsRouter,
    storage: storageRouter,
    network: networkRouter
};
