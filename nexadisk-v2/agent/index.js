require('dotenv').config();
const express = require('express');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const axios = require('axios');
const multer = require('multer');
const checkDiskSpace = require('check-disk-space').default;
const AdmZip = require('adm-zip');

const app = express();
app.use(express.json());

// Configuration
const PORT = process.env.AGENT_PORT || 5001;
const MASTER_URL = process.env.MASTER_URL || 'http://127.0.0.1:5000';
const AGENT_KEY = process.env.AGENT_KEY || 'nexadisk-agent-secret-key';
const AGENT_ID = process.env.AGENT_ID || `agent_${os.hostname()}_${Date.now()}`;

// Parse exposed drives/paths (comma separated list, e.g. C:\,D:\ or /)
const EXPOSED_DRIVES = (process.env.EXPOSED_DRIVES || (os.platform() === 'win32' ? 'C:\\' : '/'))
    .split(',')
    .map(d => d.trim())
    .filter(d => d);

// In-memory log buffer for /api/logs
const logBuffer = [];
const logToBuffer = (level, message) => {
    const ts = new Date().toISOString();
    const logLine = `[${ts}] [${level.toUpperCase()}]: ${message}`;
    console.log(logLine);
    logBuffer.push(logLine);
    if (logBuffer.length > 100) logBuffer.shift();
};

// Security Check: Ensure requests are within exposed drives
const isPathAllowed = (targetPath) => {
    if (!targetPath) return false;
    try {
        const resolvedTarget = path.resolve(targetPath).toLowerCase();
        return EXPOSED_DRIVES.some(drive => {
            const resolvedDrive = path.resolve(drive).toLowerCase();
            return resolvedTarget.startsWith(resolvedDrive);
        });
    } catch (e) {
        return false;
    }
};

// --- MULTER CONFIGURATION FOR FILE UPLOADS ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dest = req.query.path || '/';
        if (!isPathAllowed(dest)) {
            return cb(new Error('Path not allowed'));
        }
        cb(null, dest);
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});
const upload = multer({ storage });

// Active ZIP/Archive Operations Tracking
const activeOps = {};

// Helper: Get first non-loopback IPv4 address
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

// Helper: Calculate CPU usage from OS ticks
let lastCPU = { idle: 0, total: 0 };
const getCPUUsage = () => {
    const cpus = os.cpus();
    let user = 0, nice = 0, sys = 0, idle = 0, irq = 0;
    for (const cpu of cpus) {
        user += cpu.times.user;
        nice += cpu.times.nice;
        sys += cpu.times.sys;
        idle += cpu.times.idle;
        irq += cpu.times.irq;
    }
    const total = user + nice + sys + idle + irq;
    const idleDiff = idle - lastCPU.idle;
    const totalDiff = total - lastCPU.total;
    const cpuPercentage = totalDiff > 0 ? Math.round(100 * (1 - idleDiff / totalDiff)) : 0;
    lastCPU = { idle, total };
    return cpuPercentage;
};
getCPUUsage(); // Initialize

// ─── TELEMETRY & LOGS ENDPOINTS ──────────────────────────────────────────────

// Local storage & CPU/RAM metrics
app.get('/api/storage/local', async (req, res) => {
    try {
        const disks = [];
        for (const d of EXPOSED_DRIVES) {
            try {
                const space = await checkDiskSpace(d);
                disks.push({
                    mount: d,
                    size: space.size,
                    free: space.free,
                    used: space.size - space.free,
                    percentage: Math.round(((space.size - space.free) / space.size) * 100)
                });
            } catch (err) {
                logToBuffer('warn', `Failed to check disk space for ${d}: ${err.message}`);
            }
        }

        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const memoryPercentage = Math.round(100 * (1 - freeMem / totalMem));

        res.json({
            hostname: os.hostname(),
            platform: os.platform(),
            ip: getLocalIP(),
            cpu: getCPUUsage(),
            memory: memoryPercentage,
            disks
        });
    } catch (err) {
        logToBuffer('error', `Telemetry fetch error: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// Logs endpoint
app.get('/api/logs', (req, res) => {
    res.json({ logs: logBuffer });
});

// ─── FILE OPERATIONS ENDPOINTS ───────────────────────────────────────────────

// List files in directory
app.get('/api/v1/files/list', async (req, res) => {
    const targetPath = req.query.path;

    // Root drive view if targetPath is empty/root
    if (!targetPath || targetPath === '/' || targetPath === '') {
        return res.json(EXPOSED_DRIVES.map(d => ({
            name: d,
            isDirectory: true,
            size: 0,
            modified: new Date(),
            path: d
        })));
    }

    if (!isPathAllowed(targetPath)) {
        return res.status(403).json({ error: 'Access denied: Path out of bounds' });
    }

    try {
        if (!fs.existsSync(targetPath)) {
            return res.status(404).json({ error: 'Directory not found' });
        }

        const entries = await fs.promises.readdir(targetPath, { withFileTypes: true });
        const list = [];

        for (const entry of entries) {
            const entryPath = path.join(targetPath, entry.name);
            try {
                const stats = fs.statSync(entryPath);
                list.push({
                    name: entry.name,
                    isDirectory: entry.isDirectory(),
                    size: stats.size,
                    modified: stats.mtime,
                    path: entryPath
                });
            } catch (e) {
                // Ignore single unreadable files/symlinks
            }
        }
        res.json(list);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get file metadata
app.get('/api/v1/files/metadata', (req, res) => {
    const targetPath = req.query.path;
    if (!isPathAllowed(targetPath)) {
        return res.status(403).json({ error: 'Access denied' });
    }

    try {
        if (!fs.existsSync(targetPath)) return res.status(404).json({ error: 'File not found' });
        const stats = fs.statSync(targetPath);
        res.json({
            name: path.basename(targetPath),
            path: targetPath,
            size: stats.size,
            mtime: stats.mtime,
            birthtime: stats.birthtime,
            isDirectory: stats.isDirectory(),
            isFile: stats.isFile()
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create directory
app.post('/api/v1/files/mkdir', async (req, res) => {
    const { path: targetPath } = req.body;
    if (!isPathAllowed(targetPath)) return res.status(403).json({ error: 'Access denied' });

    try {
        await fs.promises.mkdir(targetPath, { recursive: true });
        res.json({ message: 'Directory created' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete file/folder
app.delete('/api/v1/files/delete', async (req, res) => {
    const { path: targetPath } = req.body;
    if (!isPathAllowed(targetPath)) return res.status(403).json({ error: 'Access denied' });

    try {
        if (!fs.existsSync(targetPath)) return res.status(404).json({ error: 'File not found' });
        const stats = fs.statSync(targetPath);
        if (stats.isDirectory()) {
            await fs.promises.rm(targetPath, { recursive: true, force: true });
        } else {
            await fs.promises.unlink(targetPath);
        }
        res.json({ message: 'Deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete batch
app.post('/api/v1/files/delete/batch', async (req, res) => {
    const { paths } = req.body;
    if (!paths || !Array.isArray(paths)) return res.status(400).json({ error: 'Paths must be an array' });

    try {
        for (const p of paths) {
            if (isPathAllowed(p) && fs.existsSync(p)) {
                const stats = fs.statSync(p);
                if (stats.isDirectory()) {
                    await fs.promises.rm(p, { recursive: true, force: true });
                } else {
                    await fs.promises.unlink(p);
                }
            }
        }
        res.json({ message: 'Batch deletion complete' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Rename file
app.post('/api/v1/files/rename', async (req, res) => {
    const { path: oldPath, newName } = req.body;
    if (!isPathAllowed(oldPath)) return res.status(403).json({ error: 'Access denied' });

    try {
        const newPath = path.join(path.dirname(oldPath), newName);
        if (!isPathAllowed(newPath)) return res.status(403).json({ error: 'Access denied to destination' });
        await fs.promises.rename(oldPath, newPath);
        res.json({ message: 'Renamed successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Move file
app.post('/api/v1/files/move', async (req, res) => {
    const { path: srcPath, destPath } = req.body;
    if (!isPathAllowed(srcPath) || !isPathAllowed(destPath)) return res.status(403).json({ error: 'Access denied' });

    try {
        await fs.promises.rename(srcPath, destPath);
        res.json({ message: 'Moved successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Copy file
app.post('/api/v1/files/copy', async (req, res) => {
    const { path: srcPath, destPath } = req.body;
    if (!isPathAllowed(srcPath) || !isPathAllowed(destPath)) return res.status(403).json({ error: 'Access denied' });

    try {
        const stats = fs.statSync(srcPath);
        if (stats.isDirectory()) {
            const copyDir = async (src, dest) => {
                await fs.promises.mkdir(dest, { recursive: true });
                const entries = await fs.promises.readdir(src, { withFileTypes: true });
                for (const entry of entries) {
                    const s = path.join(src, entry.name);
                    const d = path.join(dest, entry.name);
                    if (entry.isDirectory()) await copyDir(s, d);
                    else await fs.promises.copyFile(s, d);
                }
            };
            await copyDir(srcPath, destPath);
        } else {
            await fs.promises.copyFile(srcPath, destPath);
        }
        res.json({ message: 'Copied successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Save content
app.post('/api/v1/files/save', async (req, res) => {
    const { path: targetPath, content } = req.body;
    if (!isPathAllowed(targetPath)) return res.status(403).json({ error: 'Access denied' });

    try {
        await fs.promises.writeFile(targetPath, content || '', 'utf8');
        res.json({ message: 'File saved successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update utimes
app.post('/api/v1/files/utimes', async (req, res) => {
    const { path: targetPath, mtime } = req.body;
    if (!isPathAllowed(targetPath)) return res.status(403).json({ error: 'Access denied' });

    try {
        const timeVal = new Date(mtime);
        await fs.promises.utimes(targetPath, timeVal, timeVal);
        res.json({ message: 'Modification time updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// File upload
app.post('/api/v1/files/upload', upload.array('files'), (req, res) => {
    res.json({ message: 'Upload completed successfully' });
});

// Prepare decoupled ZIP download
app.post('/api/v1/files/download/prepare', (req, res) => {
    const { paths } = req.body;
    if (!paths || !Array.isArray(paths) || paths.length === 0) {
        return res.status(400).json({ error: 'Paths array required' });
    }

    const opId = `zip_${Date.now()}`;
    const archiveName = paths.length === 1 ? `${path.basename(paths[0])}.zip` : `Selection-${Date.now()}.zip`;
    const tempPath = path.join(os.tmpdir(), `${opId}.zip`);

    activeOps[opId] = {
        id: opId,
        name: archiveName,
        status: 'In Progress',
        progress: 0,
        tempPath
    };

    res.json({ opId });

    // Pack Zip asynchronously
    setImmediate(async () => {
        try {
            const zip = new AdmZip();
            for (const p of paths) {
                if (isPathAllowed(p) && fs.existsSync(p)) {
                    const stats = fs.statSync(p);
                    if (stats.isDirectory()) {
                        zip.addLocalFolder(p, path.basename(p));
                    } else {
                        zip.addLocalFile(p);
                    }
                }
            }
            await zip.writeZipPromise(tempPath);
            activeOps[opId].status = 'Completed';
            activeOps[opId].progress = 100;

            // Delete temporary zip file after 5 mins
            setTimeout(() => {
                try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch (e) {}
                delete activeOps[opId];
            }, 300000);
        } catch (err) {
            logToBuffer('error', `Download prepare zip creation failed: ${err.message}`);
            activeOps[opId].status = 'Failed';
            activeOps[opId].error = err.message;
            try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch (e) {}
            setTimeout(() => delete activeOps[opId], 60000);
        }
    });
});

// Serve prepared zip stream
app.get('/api/v1/files/download/prepared/:opId', (req, res) => {
    const { opId } = req.params;
    const op = activeOps[opId];
    if (!op || op.status !== 'Completed' || !fs.existsSync(op.tempPath)) {
        return res.status(404).json({ error: 'Archive not found or expired' });
    }
    res.download(op.tempPath, op.name);
});

// Search files
app.get('/api/v1/files/search', async (req, res) => {
    const { query } = req.query;
    if (!query) return res.json([]);

    const results = [];
    const searchInDir = async (dir, depth = 0) => {
        if (depth > 5) return; // limit depth to prevent endless loops
        try {
            const entries = await fs.promises.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.name.toLowerCase().includes(query.toLowerCase())) {
                    try {
                        const stats = fs.statSync(fullPath);
                        results.push({
                            name: entry.name,
                            isDirectory: entry.isDirectory(),
                            size: stats.size,
                            modified: stats.mtime,
                            path: fullPath
                        });
                    } catch (e) {}
                }
                if (entry.isDirectory() && isPathAllowed(fullPath)) {
                    await searchInDir(fullPath, depth + 1);
                }
            }
        } catch (e) {}
    };

    for (const drive of EXPOSED_DRIVES) {
        await searchInDir(drive);
    }
    res.json(results);
});

// Operations status
app.get('/api/v1/files/operations/status', (req, res) => {
    res.json({ operations: Object.values(activeOps).map(({ id, name, status, progress, error }) => ({ id, name, status, progress, error })) });
});

// Duplicate scanning
app.post('/api/v1/duplicates/scan', async (req, res) => {
    const { path: dirPath } = req.body;
    if (!isPathAllowed(dirPath)) return res.status(403).json({ error: 'Access denied' });

    try {
        const fileMap = {};
        const duplicates = [];

        const scan = async (dir) => {
            const entries = await fs.promises.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    await scan(fullPath);
                } else {
                    try {
                        const stats = fs.statSync(fullPath);
                        const key = `${stats.size}_${entry.name}`; // Simple fast check key: size + filename
                        if (fileMap[key]) {
                            duplicates.push({
                                file: fullPath,
                                size: stats.size,
                                original: fileMap[key]
                            });
                        } else {
                            fileMap[key] = fullPath;
                        }
                    } catch (e) {}
                }
            }
        };

        if (fs.existsSync(dirPath)) {
            await scan(dirPath);
        }
        res.json({ duplicates });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Compress files
app.post('/api/v1/files/compress', async (req, res) => {
    const { paths, archiveName, type } = req.body;
    if (!paths || !Array.isArray(paths) || paths.length === 0) return res.status(400).json({ error: 'Paths required' });

    const archivePath = path.join(path.dirname(paths[0]), archiveName || `Archive-${Date.now()}.zip`);
    if (!isPathAllowed(archivePath)) return res.status(403).json({ error: 'Access denied to target archive path' });

    try {
        const zip = new AdmZip();
        for (const p of paths) {
            if (isPathAllowed(p) && fs.existsSync(p)) {
                const stats = fs.statSync(p);
                if (stats.isDirectory()) {
                    zip.addLocalFolder(p, path.basename(p));
                } else {
                    zip.addLocalFile(p);
                }
            }
        }
        await zip.writeZipPromise(archivePath);
        res.json({ message: 'Compression completed successfully', path: archivePath });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Extract files
app.post('/api/v1/files/extract', async (req, res) => {
    const { path: archivePath, targetDir } = req.body;
    if (!isPathAllowed(archivePath) || !isPathAllowed(targetDir)) return res.status(403).json({ error: 'Access denied' });

    try {
        if (!fs.existsSync(archivePath)) return res.status(404).json({ error: 'Archive not found' });
        const zip = new AdmZip(archivePath);
        await fs.promises.mkdir(targetDir, { recursive: true });
        zip.extractAllTo(targetDir, true);
        res.json({ message: 'Extraction completed successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── AGENT AUTONOMOUS REGISTRATION LOOP ──────────────────────────────────────

const registerWithMaster = async () => {
    const agentUrl = `http://${getLocalIP()}:${PORT}`;
    const payload = {
        id: AGENT_ID,
        hostname: os.hostname(),
        url: agentUrl,
        key: AGENT_KEY,
        disks: EXPOSED_DRIVES.map(d => ({ mount: d, size: 0, free: 0 })) // Basic metadata placeholders
    };

    try {
        const response = await axios.post(`${MASTER_URL}/api/v1/agents/register`, payload, { timeout: 5000 });
        logToBuffer('info', `Autonomous registration succeeded with Master! Status: "${response.data.status}"`);
    } catch (err) {
        logToBuffer('warn', `Registration attempt failed: ${err.message}. Retrying in 30 seconds...`);
    }
};

app.listen(PORT, '0.0.0.0', () => {
    logToBuffer('info', `NexaDisk Agent running on port ${PORT}`);
    logToBuffer('info', `Agent ID: ${AGENT_ID}`);
    logToBuffer('info', `Exposed drives: ${EXPOSED_DRIVES.join(', ')}`);

    // Initial register
    registerWithMaster();
    // Re-register loop every 30s
    setInterval(registerWithMaster, 30000);
});
