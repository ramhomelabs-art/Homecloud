const express = require('express');
const router = express.Router();
const os = require('os');
const axios = require('axios');
const { execSync } = require('child_process');
const fs = require('fs');
const db = require('../config/database');
const { agents, metricsHistory, localLogBuffer } = require('../config/sharedState');
const { authenticateToken } = require('../middleware/auth');
const { sendAlert } = require('../utils/notifier');
const checkDiskSpace = require('check-disk-space').default;

// --- CPU usage calculation for Master Server ---
const getCpuUsage = () => {
    const cpus = os.cpus();
    let user = 0, nice = 0, sys = 0, idle = 0, irq = 0;
    for (let cpu of cpus) {
        user += cpu.times.user;
        nice += cpu.times.nice;
        sys += cpu.times.sys;
        idle += cpu.times.idle;
        irq += cpu.times.irq;
    }
    const total = user + nice + sys + idle + irq;
    return { idle, total };
};

let lastCpuMetrics = getCpuUsage();
const getCpuLoadPercent = () => {
    const current = getCpuUsage();
    const idleDifference = current.idle - lastCpuMetrics.idle;
    const totalDifference = current.total - lastCpuMetrics.total;
    lastCpuMetrics = current;
    if (totalDifference === 0) return 0;
    return Math.min(100, Math.max(0, Math.round(100 - (100 * idleDifference / totalDifference))));
};

// --- Background Polling for Nodes ---
setInterval(async () => {
    // 1. Record Local Master Metrics
    const localMetrics = metricsHistory['local'] || [];
    const localCpu = getCpuLoadPercent();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const localMemPercent = Math.round(((totalMem - freeMem) / totalMem) * 100);
    
    localMetrics.push({
        timestamp: new Date().toISOString(),
        cpu: localCpu,
        memory: localMemPercent,
        latency: 0
    });
    if (localMetrics.length > 30) localMetrics.shift();
    metricsHistory['local'] = localMetrics;

    // 2. Poll Active Approved Agents
    for (const id in agents) {
        const agent = agents[id];
        if (agent.status !== 'approved') continue;

        try {
            const start = Date.now();
            const response = await axios.get(`${agent.url}/stats`, { timeout: 3000 });
            const latency = Date.now() - start;

            const data = response.data;
            agent.cpu = data.cpu || 0;
            agent.memory = data.memory || { percentage: 0 };
            agent.uptime = data.uptime || 0;
            agent.lastSeen = new Date();
            agent.online = true;

            const agentMetrics = metricsHistory[id] || [];
            agentMetrics.push({
                timestamp: new Date().toISOString(),
                cpu: data.cpu || 0,
                memory: data.memory ? data.memory.percentage : 0,
                latency
            });
            if (agentMetrics.length > 30) agentMetrics.shift();
            metricsHistory[id] = agentMetrics;
        } catch (err) {
            const wasOnline = agent.online !== false;
            // Agent is offline or error occurred
            agent.online = false;

            if (wasOnline) {
                sendAlert('agent_offline', {
                    title: `Agent Offline: ${agent.hostname}`,
                    text: `Agent Node "${agent.hostname}" (${agent.url}) disconnected or went offline.`,
                    htmlText: `⚠️ <b>[Agent Offline]</b>\nNode: <code>${agent.hostname}</code>\nURL: <code>${agent.url}</code>\nStatus: <b>Offline / Unreachable</b>`,
                    type: 'warning'
                }).catch(alertErr => console.error('[Agent Offline Alert Error]:', alertErr.message));
            }

            const agentMetrics = metricsHistory[id] || [];
            agentMetrics.push({
                timestamp: new Date().toISOString(),
                cpu: 0,
                memory: 0,
                latency: -1 // Offline flag
            });
            if (agentMetrics.length > 30) agentMetrics.shift();
            metricsHistory[id] = agentMetrics;
        }
    }
}, 10000);

router.post('/agents/register', (req, res) => {
    const { id, hostname, disks, platform, url, key } = req.body;

    const serverAgentKey = process.env.AGENT_KEY;
    if (serverAgentKey && serverAgentKey !== key) {
        console.warn(`[Security] Unauthorized agent registration attempt from ${hostname} (${url})`);
        return res.status(401).json({ error: 'Unauthorized: Invalid Agent Key' });
    }

    if (!id) return res.status(400).json({ error: 'Agent ID required' });
    const now = new Date();
    db.get("SELECT status FROM persistent_agents WHERE id = ?", [id], (err, row) => {
        if (!row) {
            db.run("INSERT INTO persistent_agents (id, hostname, url, status, lastSeen) VALUES (?, ?, ?, 'pending', ?)",
                [id, hostname, url, now]);
            agents[id] = { id, hostname, disks, platform, url, lastSeen: now, status: 'pending', online: false };
        } else {
            db.run("UPDATE persistent_agents SET hostname = ?, url = ?, lastSeen = ? WHERE id = ?",
                [hostname, url, now, id]);
            const existing = agents[id] || {};
            agents[id] = {
                ...existing,
                id,
                hostname,
                disks,
                platform,
                url,
                lastSeen: now,
                status: row.status
            };
        }
    });
    res.json({ status: 'ok' });
});

router.post('/agents/approve', authenticateToken, (req, res) => {
    const { id } = req.body;
    db.run("UPDATE persistent_agents SET status = 'approved' WHERE id = ?", [id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        if (agents[id]) agents[id].status = 'approved';
        res.json({ message: 'Agent approved' });
    });
});

router.post('/agents/disconnect', authenticateToken, (req, res) => {
    const { id } = req.body;
    db.run("DELETE FROM persistent_agents WHERE id = ?", [id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        delete agents[id];
        res.json({ message: 'Agent disconnected' });
    });
});

// Diagnostics
router.get('/diag/ping-agent/:id', async (req, res) => {
    const agent = agents[req.params.id];
    if (!agent) return res.status(404).json({ error: 'Agent not found in registry' });
    try {
        const start = Date.now();
        const testPath = agent.platform === 'win32' ? 'C:\\' : '/';
        await axios.get(`${agent.url}/files/list?path=${encodeURIComponent(testPath)}`, { timeout: 5000 });
        res.json({ status: 'Connected', latency: `${Date.now() - start}ms`, url: agent.url });
    } catch (e) {
        res.status(502).json({ status: 'Failed', error: e.message, url: agent.url });
    }
});

router.get('/storage/local', authenticateToken, async (req, res) => {
    try {
        const rootPath = os.platform() === 'win32' ? 'C:' : '/';
        const disk = await checkDiskSpace(rootPath);
        res.json({
            hostname: os.hostname(),
            platform: os.platform(),
            disks: [{
                mount: '/',
                size: disk.size,
                free: disk.free,
                used: disk.size - disk.free,
                percentage: Math.round(((disk.size - disk.free) / disk.size) * 100)
            }]
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/agents/metrics', authenticateToken, (req, res) => {
    res.json({
        metricsHistory,
        agents: Object.values(agents)
    });
});

router.get('/agents/logs/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    if (id === 'local') {
        return res.json({ logs: localLogBuffer });
    }
    const agent = agents[id];
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    try {
        const response = await axios.get(`${agent.url}/logs`, { timeout: 5000 });
        res.json({ logs: response.data.logs });
    } catch (err) {
        res.status(502).json({ error: `Failed to fetch logs from agent: ${err.message}` });
    }
});

router.get('/storage/agents', authenticateToken, (req, res) => {
    res.json(Object.values(agents));
});

router.get('/storage/devices', authenticateToken, (req, res) => {
    try {
        if (os.platform() === 'linux') {
            const output = execSync('lsblk -J -b -o NAME,SIZE,MOUNTPOINT,TYPE,FSTYPE').toString();
            const data = JSON.parse(output);
            const drives = data.blockdevices.map(d => ({ ...d, type: 'disk' }));

            db.all("SELECT path, label FROM network_shares", [], (err, rows) => {
                if (!err && rows) {
                    rows.forEach(row => {
                        drives.push({
                            name: row.label,
                            label: row.label,
                            mountpoint: row.path,
                            type: 'network',
                            size: 0,
                            free: 0
                        });
                    });
                }
                res.json([{ name: os.hostname(), type: 'host', children: drives, status: 'online' }]);
            });
        } else if (os.platform() === 'win32') {
            try {
                const cmd = 'powershell "Get-CimInstance -ClassName Win32_LogicalDisk | Select-Object DeviceID, VolumeName, Size, FreeSpace, DriveType | ConvertTo-Json"';
                const output = execSync(cmd).toString();
                const rawDrives = JSON.parse(output);
                const drivesList = Array.isArray(rawDrives) ? rawDrives : [rawDrives];

                const drives = drivesList.filter(d => d.DriveType === 3 || d.DriveType === 4).map(d => ({
                    name: d.DeviceID,
                    label: d.VolumeName || (d.DriveType === 4 ? 'Network Share' : 'Local Disk'),
                    size: d.Size || 0,
                    free: d.FreeSpace || 0,
                    used: (d.Size || 0) - (d.FreeSpace || 0),
                    mountpoint: d.DeviceID + '\\',
                    type: d.DriveType === 4 ? 'network' : 'disk',
                    drivetype: d.DriveType
                })).filter(d => d.size > 0 || d.type === 'network');

                db.all("SELECT path, label FROM network_shares", [], async (err, rows) => {
                    const finalDrives = [...drives];
                    if (!err && rows) {
                        for (const row of rows) {
                            const existing = finalDrives.find(d => (d.mountpoint || '').toLowerCase().startsWith(row.path.toLowerCase()));

                            if (existing) {
                                existing.label = row.label;
                                existing.name = row.label;
                            } else {
                                let size = 0, free = 0;
                                try {
                                    const stats = await fs.promises.statfs(row.path);
                                    size = stats.bsize * stats.blocks;
                                    free = stats.bsize * stats.bfree;
                                } catch (e) {
                                    console.error(`[Storage Error] Failed to get stats for ${row.path}: ${e.message}`);
                                }

                                finalDrives.push({
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
                    }
                    const totalSize = finalDrives.reduce((acc, d) => acc + (d.size || 0), 0);
                    res.json([{ name: os.hostname(), type: 'host', size: totalSize, children: finalDrives, status: 'online' }]);
                });
            } catch (winErr) {
                res.json([{
                    name: os.hostname(),
                    type: 'host',
                    size: 1,
                    children: [{
                        name: os.platform() === 'win32' ? 'C:' : '/',
                        label: 'System',
                        size: 1,
                        used: 0,
                        mountpoint: os.platform() === 'win32' ? 'C:\\' : '/'
                    }],
                    status: 'online'
                }]);
            }
        } else {
            res.json([{ name: 'Generic Node', type: 'host', children: [] }]);
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
