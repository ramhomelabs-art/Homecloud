const express = require('express');
require('dotenv').config();
const cors = require('cors');
const multer = require('multer');
const checkDiskSpace = require('check-disk-space').default;
const axios = require('axios');
const os = require('os');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const { execFile, fork } = require('child_process');

const app = express();
const PORT = process.env.PORT || 5001;
// Replace with your Main Server IP if running on different machines
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:5000';
// OPTIONAL: Manually specify THIS agent's IP if auto-detection fails
const MANUAL_IP = process.env.AGENT_IP || '';
const AGENT_ID = os.hostname();
const PLATFORM = os.platform();

let cached7zCmd = undefined;
const get7zCommand = () => {
    if (cached7zCmd !== undefined) return cached7zCmd;
    
    if (process.platform === 'win32') {
        const winPaths = [
            'C:\\Program Files\\7-Zip\\7z.exe',
            'C:\\Program Files (x86)\\7-Zip\\7z.exe'
        ];
        for (const p of winPaths) {
            if (fs.existsSync(p)) {
                cached7zCmd = p;
                return p;
            }
        }
    }
    
    const { execSync } = require('child_process');
    try {
        execSync(process.platform === 'win32' ? 'where 7z' : 'which 7z', { stdio: 'ignore' });
        cached7zCmd = '7z';
        return '7z';
    } catch (e) {}
    
    try {
        execSync(process.platform === 'win32' ? 'where 7za' : 'which 7za', { stdio: 'ignore' });
        cached7zCmd = '7za';
        return '7za';
    } catch (e) {}
    
    cached7zCmd = null;
    return null;
};
const AGENT_KEY = process.env.AGENT_KEY || '';

app.use(cors());
app.use(express.json());

// --- Console Logging Interception for Log Buffer ---
let logBuffer = [];
const maxLogLines = 150;
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

const addToBuffer = (level, args) => {
    const msg = args.map(arg => {
        if (arg instanceof Error) return arg.stack || arg.message;
        if (typeof arg === 'object') {
            try { return JSON.stringify(arg); } catch (e) { return String(arg); }
        }
        return String(arg);
    }).join(' ');
    const line = `[${new Date().toISOString()}] [${level}] ${msg}`;
    logBuffer.push(line);
    if (logBuffer.length > maxLogLines) {
        logBuffer.shift();
    }
};

console.log = (...args) => {
    addToBuffer('INFO', args);
    originalLog.apply(console, args);
};
console.error = (...args) => {
    addToBuffer('ERROR', args);
    originalError.apply(console, args);
};
console.warn = (...args) => {
    addToBuffer('WARN', args);
    originalWarn.apply(console, args);
};

// --- CPU load calculation ---
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

let activeOps = {}; // { id: { name, type, source, dest, progress, totalBytes, bytesTransferred, status, error } }

// Request logging
app.use((req, res, next) => {
    console.log(`[Agent RECV] ${new Date().toLocaleTimeString()} | ${req.method} ${req.url}`);
    next();
});

const getDirectorySize = (dirPath) => {
    let size = 0;
    try {
        const stats = fs.statSync(dirPath);
        if (!stats.isDirectory()) return stats.size;

        const files = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const file of files) {
            const filePath = path.join(dirPath, file.name);
            if (file.isDirectory()) {
                size += getDirectorySize(filePath);
            } else {
                const stats = fs.statSync(filePath);
                size += stats.size;
            }
        }
    } catch (e) {
        console.error(`Error calculating size for ${dirPath}: ${e.message}`);
    }
    return size;
};

/**
 * Custom Streaming Copy Utility
 * @param {string} src - Source path
 * @param {string} dest - Destination path (parent folder)
 * @param {function} onProgress - Callback(bytes)
 */
const streamingCopy = async (src, destDir, onProgress) => {
    const stats = fs.statSync(src);
    const name = path.basename(src);
    const dest = path.join(destDir, name);

    if (stats.isDirectory()) {
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        const items = fs.readdirSync(src);
        for (const item of items) {
            await streamingCopy(path.join(src, item), dest, onProgress);
        }
    } else {
        return new Promise((resolve, reject) => {
            const rd = fs.createReadStream(src);
            const wr = fs.createWriteStream(dest);

            rd.on('error', reject);
            wr.on('error', reject);
            wr.on('finish', resolve);

            rd.on('data', (chunk) => {
                onProgress(chunk.length);
            });

            rd.pipe(wr);
        });
    }
};

// --- File System Operations ---

app.get('/stats', async (req, res) => {
    try {
        const rootPath = PLATFORM === 'win32' ? 'C:' : '/';
        const disk = await checkDiskSpace(rootPath);
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        res.json({
            hostname: AGENT_ID,
            platform: PLATFORM,
            disk: {
                total: disk.size,
                free: disk.free,
                used: disk.size - disk.free
            },
            uptime: os.uptime(),
            load: os.loadavg(),
            cpu: getCpuLoadPercent(),
            memory: {
                total: totalMem,
                free: freeMem,
                used: totalMem - freeMem,
                percentage: Math.round(((totalMem - freeMem) / totalMem) * 100)
            }
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/logs', (req, res) => {
    res.json({ logs: logBuffer });
});

app.get('/files/list', (req, res) => {
    const dirPath = req.query.path || (PLATFORM === 'win32' ? 'C:\\' : '/');

    fs.readdir(dirPath, { withFileTypes: true }, (err, files) => {
        if (err) return res.status(500).json({ error: err.message });

        const fileList = files.map(f => {
            let stats = {};
            try { stats = fs.statSync(path.join(dirPath, f.name)); } catch (e) { }
            return {
                name: f.name,
                isDirectory: f.isDirectory(),
                size: stats.size || 0,
                updated: stats.mtime || new Date(),
                path: path.join(dirPath, f.name)
            };
        });
        res.json(fileList);
    });
});

app.get('/files/metadata', (req, res) => {
    const filePath = req.query.path;
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });

    try {
        const stats = fs.statSync(filePath);
        const isDirectory = stats.isDirectory();
        const size = isDirectory ? getDirectorySize(filePath) : stats.size;

        res.json({
            name: path.basename(filePath),
            path: filePath,
            size: size,
            isDirectory: isDirectory,
            modified: stats.mtime,
            birthtime: stats.birthtime,
            permissions: (stats.mode & 0o777).toString(8)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/files/create/folder', (req, res) => {
    const { parentPath, folderName } = req.body;
    const target = path.join(parentPath, folderName);
    fs.mkdir(target, { recursive: true }, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.post('/files/delete', (req, res) => {
    const { path: targetPath } = req.body;
    fs.rm(targetPath, { recursive: true, force: true }, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.post('/files/save', (req, res) => {
    const { path: targetPath, content } = req.body;
    if (!targetPath) return res.status(400).json({ error: 'Path required' });
    try {
        fs.writeFileSync(targetPath, content, 'utf8');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/files/move', (req, res) => {
    const { source, destination } = req.body;
    const sourcePath = path.resolve(source);
    const destPath = path.join(path.resolve(destination), path.basename(source));

    console.log(`[Agent] Move: ${sourcePath} -> ${destPath}`);

    const opId = `op_${Date.now()}`;
    fs.rename(sourcePath, destPath, (err) => {
        if (err) {
            console.error(`[Agent] Move Error: ${err.message}`);
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true, opId });
    });
});

app.post('/files/copy', (req, res) => {
    const { source, destination, overwrite } = req.body;
    const normalizedSource = path.resolve(source);
    const dest = path.join(destination, path.basename(source));
    const normalizedDest = path.resolve(dest);

    const isSamePath = os.platform() === 'win32'
        ? normalizedSource.toLowerCase() === normalizedDest.toLowerCase()
        : normalizedSource === normalizedDest;

    if (isSamePath) {
        console.log(`[Agent] Skipping redundant copy: ${normalizedSource} already at destination.`);
        return res.json({ success: true, message: 'Already at destination' });
    }

    if (!overwrite && fs.existsSync(normalizedDest)) {
        console.log(`[Agent] Collision detected: ${normalizedDest} already exists.`);
        return res.status(409).json({ error: 'Item already exists at destination', exists: true });
    }

    console.log(`[Agent] Copy: ${normalizedSource} -> ${normalizedDest}${(overwrite ? ' (OVERWRITE)' : '')}`);

    const opId = `op_${Date.now()}`;
    const totalBytes = getDirectorySize(normalizedSource);

    activeOps[opId] = {
        id: opId,
        name: path.basename(normalizedSource),
        type: 'copy',
        source: normalizedSource,
        dest: normalizedDest,
        progress: 0,
        totalBytes,
        bytesTransferred: 0,
        status: 'In Progress',
        startTime: Date.now()
    };

    res.json({ success: true, opId });

    streamingCopy(normalizedSource, destination, (bytes) => {
        const op = activeOps[opId];
        if (op) {
            op.bytesTransferred += bytes;
            op.progress = Math.round((op.bytesTransferred / op.totalBytes) * 100);
        }
    }).then(() => {
        if (activeOps[opId]) {
            activeOps[opId].status = 'Completed';
            activeOps[opId].progress = 100;
            setTimeout(() => delete activeOps[opId], 30000);
        }
    }).catch(err => {
        if (activeOps[opId]) {
            activeOps[opId].status = 'Failed';
            activeOps[opId].error = err.message;
            setTimeout(() => delete activeOps[opId], 60000);
        }
    });
});

app.get('/operations/status', (req, res) => {
    res.json(Object.values(activeOps));
});

// Configure Multer for uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dest = req.query.path || os.tmpdir();
        cb(null, dest);
    },
    filename: (req, file, cb) => cb(null, file.originalname)
});
const upload = multer({ storage, limits: { fileSize: Infinity } });

app.post('/files/upload', upload.array('files'), (req, res) => {
    res.json({ success: true });
});

app.post('/files/download/prepare', (req, res) => {
    const { paths } = req.body;
    if (!paths || !Array.isArray(paths) || paths.length === 0) {
        return res.status(400).json({ error: 'Paths array is required' });
    }

    const opId = `zip_${Date.now()}`;
    const archiveName = paths.length === 1 ? `${path.basename(paths[0])}.zip` : `Selection-${Date.now()}.zip`;
    const tempPath = path.join(os.tmpdir(), `${opId}.zip`);

    activeOps[opId] = {
        id: opId,
        name: archiveName,
        type: 'zip_prepare',
        progress: 0,
        status: 'In Progress',
        tempPath,
        startTime: Date.now()
    };

    res.json({ opId });

    const worker = fork(path.join(__dirname, 'zipWorker.js'), [
        JSON.stringify(paths),
        tempPath
    ]);

    worker.on('message', (msg) => {
        const op = activeOps[opId];
        if (!op) return;

        if (msg.status === 'progress') {
            op.progress = msg.progress;
        } else if (msg.status === 'completed') {
            op.progress = 100;
            op.status = 'Completed';
            setTimeout(() => {
                if (fs.existsSync(tempPath)) {
                    fs.unlink(tempPath, () => {});
                }
                delete activeOps[opId];
            }, 300000);
        } else if (msg.status === 'failed') {
            op.status = 'Failed';
            op.error = msg.error;
            setTimeout(() => delete activeOps[opId], 60000);
            if (fs.existsSync(tempPath)) {
                fs.unlink(tempPath, () => {});
            }
        }
    });

    worker.on('error', (err) => {
        const op = activeOps[opId];
        if (op) {
            op.status = 'Failed';
            op.error = err.message;
            setTimeout(() => delete activeOps[opId], 60000);
        }
        if (fs.existsSync(tempPath)) {
            fs.unlink(tempPath, () => {});
        }
    });
});

app.get('/files/download/prepared/:opId', (req, res) => {
    const { opId } = req.params;
    const op = activeOps[opId];
    if (!op || op.status !== 'Completed' || !fs.existsSync(op.tempPath)) {
        return res.status(404).json({ error: 'Archive not found or not ready yet' });
    }

    res.download(op.tempPath, op.name, (err) => {
        if (!err) {
            fs.unlink(op.tempPath, () => {});
            delete activeOps[opId];
        }
    });
});

app.get('/files/download', (req, res) => {
    const target = req.query.path;
    console.log(`[Agent Download] Request for: ${target}`);

    if (fs.existsSync(target)) {
        const stats = fs.statSync(target);
        if (stats.isDirectory()) {
            try {
                const zip = new AdmZip();
                zip.addLocalFolder(target);
                const zipBuffer = zip.toBuffer();
                res.set({
                    'Content-Type': 'application/zip',
                    'Content-Disposition': `attachment; filename="${path.basename(target)}.zip"`,
                    'Content-Length': zipBuffer.length
                });
                return res.send(zipBuffer);
            } catch (zipErr) {
                console.error(`[Agent Download ZIP Error]: ${zipErr.message}`);
                return res.status(500).send(`Failed to zip directory: ${zipErr.message}`);
            }
        }
        res.download(target);
    } else {
        console.error(`[Agent Download] Failed: Not found: ${target}`);
        res.status(404).send('Not found');
    }
});

app.post('/files/download/zip', (req, res) => {
    const { paths } = req.body;
    if (!paths || !Array.isArray(paths) || paths.length === 0) {
        return res.status(400).json({ error: 'Paths array is required' });
    }
    try {
        const zip = new AdmZip();
        for (const p of paths) {
            if (fs.existsSync(p)) {
                const stats = fs.statSync(p);
                if (stats.isDirectory()) {
                    zip.addLocalFolder(p, path.basename(p));
                } else {
                    zip.addLocalFile(p);
                }
            }
        }
        const zipBuffer = zip.toBuffer();
        res.set({
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename="Agent-Selection-${Date.now()}.zip"`,
            'Content-Length': zipBuffer.length
        });
        res.send(zipBuffer);
    } catch (err) {
        console.error(`[Agent ZIP Selection Error]: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

app.post('/files/extract', (req, res) => {
    const { path: archivePath, targetDir } = req.body;
    if (!archivePath) return res.status(400).json({ error: 'Archive path required' });

    const resolvedArchive = path.resolve(archivePath);
    if (!fs.existsSync(resolvedArchive)) {
        return res.status(404).json({ error: 'Archive file not found' });
    }

    const resolvedTarget = targetDir ? path.resolve(targetDir) : path.dirname(resolvedArchive);
    try {
        fs.mkdirSync(resolvedTarget, { recursive: true });
    } catch (mkdirErr) {
        return res.status(500).json({ error: `Failed to create target directory: ${mkdirErr.message}` });
    }

    const ext = path.extname(resolvedArchive).toLowerCase();
    const isTarGz = resolvedArchive.toLowerCase().endsWith('.tar.gz') || resolvedArchive.toLowerCase().endsWith('.tgz');

    if (ext === '.tar' || isTarGz || ext === '.gz') {
        execFile('tar', ['-xf', resolvedArchive, '-C', resolvedTarget], (err, stdout, stderr) => {
            if (err) {
                console.error(`[Tar Extraction agent error]: ${stderr || err.message}`);
                const sevenZip = get7zCommand();
                if (sevenZip) {
                    execFile(sevenZip, ['x', resolvedArchive, `-o${resolvedTarget}`, '-y'], (err2, stdout2, stderr2) => {
                        if (err2) {
                            return res.status(500).json({ error: stderr2 || err2.message || 'Extraction failed' });
                        }
                        res.json({ message: 'Extracted successfully' });
                    });
                } else {
                    return res.status(500).json({ error: stderr || err.message || 'Extraction failed' });
                }
            } else {
                res.json({ message: 'Extracted successfully' });
            }
        });
    } else {
        const sevenZip = get7zCommand();
        if (sevenZip) {
            execFile(sevenZip, ['x', resolvedArchive, `-o${resolvedTarget}`, '-y'], (err, stdout, stderr) => {
                if (err) {
                    console.error(`[7z Extraction agent error]: ${stderr || err.message}`);
                    fallbackExtractAgent(resolvedArchive, resolvedTarget, ext, res);
                } else {
                    res.json({ message: 'Extracted successfully' });
                }
            });
        } else {
            fallbackExtractAgent(resolvedArchive, resolvedTarget, ext, res);
        }
    }
});

const fallbackExtractAgent = (archivePath, targetDir, ext, res) => {
    if (ext === '.zip') {
        try {
            const zip = new AdmZip(archivePath);
            zip.extractAllTo(targetDir, true);
            return res.json({ message: 'Extracted successfully' });
        } catch (zipErr) {
            console.error(`[ZIP Extraction agent fallback error]: ${zipErr.message}`);
            return res.status(500).json({ error: `ZIP extraction failed: ${zipErr.message}` });
        }
    } else {
        return res.status(400).json({ error: `Unsupported archive format: ${ext}. Install 7-Zip for extended support.` });
    }
};

app.post('/files/compress', (req, res) => {
    const { paths, archiveName, type } = req.body;
    if (!paths || !Array.isArray(paths) || paths.length === 0) {
        return res.status(400).json({ error: 'Paths array is required' });
    }
    if (!archiveName) return res.status(400).json({ error: 'Archive name is required' });

    const safeArchiveName = path.basename(archiveName);

    try {
        const resolvedPaths = paths.map(p => path.resolve(p));
        for (const p of resolvedPaths) {
            if (!fs.existsSync(p)) {
                return res.status(404).json({ error: `File or folder not found: ${p}` });
            }
        }

        const baseDir = path.dirname(resolvedPaths[0]);
        const resolvedArchive = path.join(baseDir, safeArchiveName);
        const extType = type || 'zip';
        const sevenZip = get7zCommand();

        if (sevenZip && (extType === 'zip' || extType === '7z' || extType === 'tar')) {
            const formatFlag = `-t${extType}`;
            const relativePaths = resolvedPaths.map(p => path.relative(baseDir, p));
            execFile(sevenZip, ['a', formatFlag, resolvedArchive, ...relativePaths, '-y'], { cwd: baseDir }, (err, stdout, stderr) => {
                if (err) {
                    console.error(`[7z Compression agent error]: ${stderr || err.message}`);
                    fallbackCompressAgent(resolvedPaths, resolvedArchive, extType, baseDir, res);
                } else {
                    res.json({ message: 'Compressed successfully' });
                }
            });
        } else {
            fallbackCompressAgent(resolvedPaths, resolvedArchive, extType, baseDir, res);
        }
    } catch (err) {
        console.error(`[Agent Compression error]: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

const fallbackCompressAgent = (paths, archivePath, extType, baseDir, res) => {
    if (extType === 'zip') {
        try {
            const zip = new AdmZip();
            for (const itemPath of paths) {
                const stats = fs.statSync(itemPath);
                if (stats.isDirectory()) {
                    zip.addLocalFolder(itemPath, path.basename(itemPath));
                } else {
                    zip.addLocalFile(itemPath);
                }
            }
            zip.writeZip(archivePath);
            return res.json({ message: 'Compressed successfully' });
        } catch (err) {
            console.error(`[ZIP Compression agent fallback error]: ${err.message}`);
            return res.status(500).json({ error: err.message });
        }
    } else if (extType === 'tar.gz' || extType === 'tar') {
        const relativePaths = paths.map(p => path.relative(baseDir, p));
        const tarFlag = extType === 'tar.gz' ? '-czf' : '-cf';
        execFile('tar', [tarFlag, archivePath, '-C', baseDir, ...relativePaths], (err, stdout, stderr) => {
            if (err) {
                console.error(`[Tar Compression agent fallback error]: ${stderr || err.message}`);
                return res.status(500).json({ error: stderr || err.message || 'Compression failed' });
            }
            res.json({ message: 'Compressed successfully' });
        });
    } else {
        return res.status(400).json({ error: `Unsupported archive type: ${extType}. Install 7-Zip for extended format support.` });
    }
};

// --- Heartbeat ---

const report = async () => {
    try {
        const rootPath = PLATFORM === 'win32' ? 'C:' : '/';
        const disk = await checkDiskSpace(rootPath);

        const payload = {
            id: AGENT_ID,
            hostname: AGENT_ID,
            platform: PLATFORM,
            url: `http://${getIpAddress()}:${PORT}`, // Tell server how to reach me
            key: AGENT_KEY,
            disks: [{
                mount: PLATFORM === 'win32' ? 'C:' : '/',
                size: disk.size,
                free: disk.free,
                used: disk.size - disk.free,
                percentage: disk.size > 0 ? Math.round(((disk.size - disk.free) / disk.size) * 100) : 0
            }]
        };

        console.log(`[Heartbeat] ID: ${AGENT_ID} | URL: ${payload.url}`); // Debug Log
        await axios.post(`${SERVER_URL}/api/agents/register`, payload);
        console.log(`[Heartbeat] Sent to ${SERVER_URL}`);
    } catch (e) {
        console.error(`[Heartbeat] Failed: ${e.message} (Is Server Running?)`);
    }
};

function getIpAddress() {
    if (MANUAL_IP) return MANUAL_IP;
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                if (net.address.startsWith('169.254.')) continue;
                return net.address;
            }
        }
    }
    return '127.0.0.1';
}

// Start Server & Heartbeat
app.listen(PORT, () => {
    console.log(`Agent listening on port ${PORT}`);
    console.log(`IMPORTANT: Ensure port ${PORT} is open on your FIREWALL!`);
    if (os.platform() === 'win32') {
        console.log(`Run: netsh advfirewall firewall add rule name="NexaDisk Agent" dir=in action=allow protocol=TCP localport=${PORT}`);
    } else {
        console.log(`Run: sudo ufw allow ${PORT}/tcp`);
    }
    setInterval(report, 10000);
    report();
});
