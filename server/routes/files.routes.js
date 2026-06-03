const express = require('express');
const router = express.Router();
const path = require('path');
const os = require('os');
const fs = require('fs');
const { execFile, fork } = require('child_process');
const axios = require('axios');
const FormData = require('form-data');
const AdmZip = require('adm-zip');
const multer = require('multer');

const db = require('../config/database');
const { agents, activities, activeOps } = require('../config/sharedState');
const { getDirectorySize, streamingCopy } = require('../utils/fileHelpers');
const { authenticateToken } = require('../middleware/auth');
const { processUploadRules } = require('../utils/aiAutomator');

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

// Multer storage configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const { path: targetPath, agentId } = req.query;
        if (agentId) return cb(null, os.tmpdir());
        const dest = targetPath || os.tmpdir();
        cb(null, dest);
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});
const upload = multer({ storage });

// --- MOBILE SUMMARY API ---
router.get('/mobile/summary', authenticateToken, async (req, res) => {
    try {
        const rootPath = os.platform() === 'win32' ? 'C:' : '/';
        const stats = { images: 0, videos: 0, docs: 0, links: 0 };

        const categorize = (dir, depth = 0) => {
            if (depth > 2) return;
            try {
                const items = fs.readdirSync(dir, { withFileTypes: true });
                for (const item of items) {
                    const fullPath = path.join(dir, item.name);
                    if (item.isDirectory()) categorize(fullPath, depth + 1);
                    else {
                        const ext = path.extname(item.name).toLowerCase();
                        if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.bmp'].includes(ext)) stats.images++;
                        else if (['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv'].includes(ext)) stats.videos++;
                        else if (['.pdf', '.doc', '.docx', '.txt', '.zip', '.rar', '.7z', '.xlsx', '.pptx'].includes(ext)) stats.docs++;
                    }
                }
            } catch (e) { }
        };

        categorize(rootPath);

        db.get("SELECT COUNT(*) as count FROM shares", (err, row) => {
            stats.links = row ? row.count : 0;
            res.json(stats);
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- FILE SEARCH ---
router.get('/search', authenticateToken, async (req, res) => {
    const { query, agentId } = req.query;
    if (!query) return res.json([]);

    try {
        if (agentId && agents[agentId]) {
            const agent = agents[agentId];
            const resp = await axios.get(`${agent.url}/search?query=${encodeURIComponent(query)}`);
            return res.json(resp.data);
        }

        const rootPath = os.platform() === 'win32' ? 'C:' : '/';
        const results = [];

        const searchDir = (dir, depth = 0) => {
            if (depth > 3 || results.length > 50) return;
            try {
                const items = fs.readdirSync(dir, { withFileTypes: true });
                for (const item of items) {
                    const fullPath = path.join(dir, item.name);
                    if (item.name.toLowerCase().includes(query.toLowerCase())) {
                        results.push({
                            name: item.name,
                            path: fullPath,
                            isDirectory: item.isDirectory(),
                            size: item.isDirectory() ? 0 : fs.statSync(fullPath).size,
                            modified: fs.statSync(fullPath).mtime
                        });
                    }
                    if (item.isDirectory()) searchDir(fullPath, depth + 1);
                }
            } catch (e) { }
        };

        searchDir(rootPath);
        res.json(results);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- FILE OPERATIONS ---
router.get('/files/list', authenticateToken, async (req, res) => {
    const { path: dirPath, agentId } = req.query;
    if (agentId && agents[agentId]) {
        if (agents[agentId].status !== 'approved') return res.status(403).json({ error: 'Agent not approved' });
        try {
            const resp = await axios.get(`${agents[agentId].url}/files/list?path=${encodeURIComponent(dirPath)}`);
            return res.json(resp.data);
        } catch (e) {
            return res.status(e.response?.status || 502).json({ error: `Agent Error: ${e.message}` });
        }
    }
    let targetPath = dirPath || '/';
    if (os.platform() === 'win32' && targetPath.length === 2 && targetPath.endsWith(':')) {
        targetPath += '\\';
    }

    if (os.platform() === 'win32') {
        let normalized = targetPath.replace(/\//g, '\\');
        if (normalized.startsWith('\\') && !normalized.startsWith('\\\\')) normalized = '\\\\' + normalized;
        targetPath = normalized;
    }
    fs.readdir(targetPath, { withFileTypes: true }, (err, files) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(files.map(file => {
            const filePath = path.join(targetPath, file.name);
            let stats = { size: 0, mtime: new Date() };
            try { stats = fs.statSync(filePath); } catch (e) { }

            const isDirectory = file.isDirectory();
            const actualSize = isDirectory ? getDirectorySize(filePath, 4) : stats.size;

            return { name: file.name, isDirectory, size: actualSize, modified: stats.mtime, path: filePath };
        }));
    });
});

router.post('/files/move', authenticateToken, async (req, res) => {
    const { source, destination, agentId } = req.body;
    if (agentId && agents[agentId]) {
        if (agents[agentId].status !== 'approved') return res.status(403).json({ error: 'Agent not approved' });
        try {
            const resp = await axios.post(`${agents[agentId].url}/files/move`, { source, destination });
            return res.json({ message: 'Moved on agent successfully', opId: resp.data.opId });
        } catch (e) {
            return res.status(e.response?.status || 502).json({ error: `Agent Error: ${e.message}` });
        }
    }
    const opId = `op_${Date.now()}`;
    const name = path.basename(source);
    const dest = path.join(destination, name);

    fs.rename(source, dest, err => {
        if (err) {
            if (err.code === 'EXDEV') {
                streamingCopy(source, destination, () => {})
                    .then(() => {
                        fs.rm(source, { recursive: true, force: true }, rmErr => {
                            if (rmErr) console.error(`[Move Error] Failed to delete source: ${rmErr.message}`);
                        });
                        res.json({ message: 'Moved successfully (cross-device)', opId });
                    })
                    .catch(copyErr => {
                        res.status(500).json({ error: `Cross-device move failed: ${copyErr.message}` });
                    });
                return;
            }
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: 'Moved successfully', opId });
    });
});

router.post('/files/copy', authenticateToken, async (req, res) => {
    const { source, destination, agentId, overwrite } = req.body;
    if (agentId && agents[agentId]) {
        if (agents[agentId].status !== 'approved') return res.status(403).json({ error: 'Agent not approved' });
        try {
            const resp = await axios.post(`${agents[agentId].url}/files/copy`, { source, destination, overwrite });
            return res.json({ message: 'Copied on agent successfully', opId: resp.data.opId });
        } catch (e) {
            return res.status(e.response?.status || 502).json({ error: e.response?.data?.error || `Agent Error: ${e.message}`, exists: e.response?.data?.exists });
        }
    }
    const normalizedSource = path.resolve(source);
    const dest = path.join(destination, path.basename(source));
    const normalizedDest = path.resolve(dest);

    const isSamePath = os.platform() === 'win32'
        ? normalizedSource.toLowerCase() === normalizedDest.toLowerCase()
        : normalizedSource === normalizedDest;

    if (isSamePath) {
        return res.json({ message: 'Item already at destination' });
    }

    if (!overwrite && fs.existsSync(normalizedDest)) {
        return res.status(409).json({ error: 'Item already exists at destination', exists: true });
    }

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

    res.json({ message: 'Copy started', opId });

    streamingCopy(normalizedSource, destination, (bytes) => {
        const op = activeOps[opId];
        if (op) {
            op.bytesTransferred += bytes;
            op.progress = op.totalBytes > 0
                ? Math.round((op.bytesTransferred / op.totalBytes) * 100)
                : 100;
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

router.post('/files/rename', authenticateToken, (req, res) => {
    const { oldPath, newName } = req.body;
    const newPath = path.join(path.dirname(oldPath), newName);
    fs.rename(oldPath, newPath, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Renamed successfully' });
    });
});

router.post('/files/save', authenticateToken, async (req, res) => {
    const { path: filePath, content, agentId } = req.body;
    if (!filePath) return res.status(400).json({ error: 'Path required' });
    
    if (agentId && agents[agentId]) {
        if (agents[agentId].status !== 'approved') return res.status(403).json({ error: 'Agent not approved' });
        try {
            await axios.post(`${agents[agentId].url}/files/save`, { path: filePath, content });
            return res.json({ message: 'Saved on agent successfully' });
        } catch (e) {
            return res.status(e.response?.status || 502).json({ error: `Agent Error: ${e.message}` });
        }
    }

    try {
        fs.writeFileSync(filePath, content, 'utf8');
        res.json({ message: 'Saved successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/files/create/folder', authenticateToken, async (req, res) => {
    const { parentPath, folderName, agentId } = req.body;
    if (agentId && agents[agentId]) {
        if (agents[agentId].status !== 'approved') return res.status(403).json({ error: 'Agent not approved' });
        try {
            await axios.post(`${agents[agentId].url}/files/create/folder`, { parentPath, folderName });
            return res.json({ message: 'Folder created on agent' });
        } catch (e) {
            return res.status(e.response?.status || 502).json({ error: `Agent Error: ${e.message}` });
        }
    }
    const folderPath = path.join(parentPath, folderName);
    fs.mkdir(folderPath, { recursive: true }, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Folder created successfully' });
    });
});

router.delete('/files/delete', authenticateToken, async (req, res) => {
    const { path: targetPath, agentId } = req.body;
    if (agentId && agents[agentId]) {
        if (agents[agentId].status !== 'approved') return res.status(403).json({ error: 'Agent not approved' });
        try {
            await axios.post(`${agents[agentId].url}/files/delete`, { path: targetPath });
            return res.json({ message: 'Deleted on agent' });
        } catch (e) {
            return res.status(e.response?.status || 502).json({ error: `Agent Error: ${e.message}` });
        }
    }
    if (fs.existsSync(targetPath)) {
        const stats = fs.statSync(targetPath);
        if (stats.isDirectory()) {
            fs.rm(targetPath, { recursive: true, force: true }, (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: 'Deleted successfully' });
            });
        } else {
            fs.unlink(targetPath, (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: 'Deleted successfully' });
            });
        }
    } else {
        res.status(404).json({ error: 'Not found' });
    }
});

router.get('/operations/status', authenticateToken, async (req, res) => {
    const localOps = Object.values(activeOps);

    const agentOpsPromises = Object.values(agents)
        .filter(a => a.status === 'approved')
        .map(async (agent) => {
            try {
                const resp = await axios.get(`${agent.url}/operations/status`, { timeout: 1000 });
                return resp.data.map(op => ({ ...op, agentId: agent.id, hostname: agent.hostname }));
            } catch (e) {
                return [];
            }
        });

    const results = await Promise.all(agentOpsPromises);
    const allOps = [...localOps, ...results.flat()];
    res.json(allOps);
});

router.get('/files/metadata', authenticateToken, async (req, res) => {
    const { path: filePath, agentId } = req.query;

    if (agentId && agents[agentId]) {
        if (agents[agentId].status !== 'approved') return res.status(403).json({ error: 'Agent not approved' });
        try {
            const resp = await axios.get(`${agents[agentId].url}/files/metadata?path=${encodeURIComponent(filePath)}`);
            return res.json(resp.data);
        } catch (e) {
            return res.status(e.response?.status || 502).json({ error: `Agent Error: ${e.message}` });
        }
    }

    const exists = fs.existsSync(filePath);
    if (!exists) return res.status(404).json({ error: 'Not found' });

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

router.post('/files/download/prepare', authenticateToken, async (req, res) => {
    const { paths, agentId } = req.body;
    if (!paths || !Array.isArray(paths) || paths.length === 0) {
        return res.status(400).json({ error: 'Paths array is required' });
    }

    if (agentId && agents[agentId]) {
        if (agents[agentId].status !== 'approved') return res.status(403).json({ error: 'Agent not approved' });
        try {
            const response = await axios.post(`${agents[agentId].url}/files/download/prepare`, { paths });
            return res.json({ opId: response.data.opId, agentId });
        } catch (err) {
            console.error(`[Prepare proxy error]: ${err.message}`);
            return res.status(err.response?.status || 502).json({ error: `Agent unreachable: ${err.message}` });
        }
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

    const worker = fork(path.join(__dirname, '../utils/zipWorker.js'), [
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

router.get('/files/download/prepared/:opId', authenticateToken, async (req, res) => {
    const { opId } = req.params;
    const { agentId } = req.query;

    if (agentId && agents[agentId]) {
        if (agents[agentId].status !== 'approved') return res.status(403).json({ error: 'Agent not approved' });
        try {
            const response = await axios({
                method: 'get',
                url: `${agents[agentId].url}/files/download/prepared/${opId}`,
                responseType: 'stream'
            });
            if (response.headers['content-type']) res.setHeader('Content-Type', response.headers['content-type']);
            if (response.headers['content-disposition']) res.setHeader('Content-Disposition', response.headers['content-disposition']);
            response.data.pipe(res);
            return;
        } catch (err) {
            console.error(`[Download prepared proxy error]: ${err.message}`);
            return res.status(err.response?.status || 502).json({ error: `Agent unreachable: ${err.message}` });
        }
    }

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

router.get('/files/download', authenticateToken, async (req, res) => {
    const { path: filePath, agentId } = req.query;

    if (agentId && agents[agentId]) {
        if (agents[agentId].status !== 'approved') return res.status(403).json({ error: 'Agent not approved' });
        try {
            const response = await axios({ method: 'get', url: `${agents[agentId].url}/files/download?path=${encodeURIComponent(filePath)}`, responseType: 'stream' });
            if (response.headers['content-type']) res.setHeader('Content-Type', response.headers['content-type']);
            if (response.headers['content-disposition']) res.setHeader('Content-Disposition', response.headers['content-disposition']);
            response.data.pipe(res);
            return;
        } catch (err) {
            console.error(`[Download Error] Agent Unreachable: ${err.message}`);
            return res.status(502).json({ error: "Agent Unreachable" });
        }
    }

    if (!filePath) return res.status(400).json({ error: 'Path required' });

    if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        if (stats.isDirectory()) {
            try {
                const zip = new AdmZip();
                zip.addLocalFolder(filePath);
                const zipBuffer = zip.toBuffer();
                res.set({
                    'Content-Type': 'application/zip',
                    'Content-Disposition': `attachment; filename="${path.basename(filePath)}.zip"`,
                    'Content-Length': zipBuffer.length
                });
                return res.send(zipBuffer);
            } catch (zipErr) {
                console.error(`[Download ZIP Error] Failed to archive: ${zipErr.message}`);
                return res.status(500).json({ error: `Failed to create ZIP: ${zipErr.message}` });
            }
        }
        res.download(filePath);
    } else {
        console.error(`[Download Error] File not found: ${filePath}`);
        res.status(404).json({ error: 'File not found locally' });
    }
});

router.post('/files/download/zip', authenticateToken, async (req, res) => {
    const { paths, agentId } = req.body;
    if (!paths || !Array.isArray(paths) || paths.length === 0) {
        return res.status(400).json({ error: 'Paths array is required' });
    }

    if (agentId && agents[agentId]) {
        if (agents[agentId].status !== 'approved') return res.status(403).json({ error: 'Agent not approved' });
        try {
            const response = await axios({
                method: 'post',
                url: `${agents[agentId].url}/files/download/zip`,
                data: { paths },
                responseType: 'stream'
            });
            if (response.headers['content-type']) res.setHeader('Content-Type', response.headers['content-type']);
            if (response.headers['content-disposition']) res.setHeader('Content-Disposition', response.headers['content-disposition']);
            response.data.pipe(res);
            return;
        } catch (err) {
            console.error(`[Download ZIP Selection Error] Agent Unreachable: ${err.message}`);
            return res.status(502).json({ error: "Agent Unreachable" });
        }
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
            'Content-Disposition': `attachment; filename="NexaDisk-Selection-${Date.now()}.zip"`,
            'Content-Length': zipBuffer.length
        });
        res.send(zipBuffer);
    } catch (err) {
        console.error(`[ZIP Selection Error]: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

router.post('/files/extract', authenticateToken, async (req, res) => {
    const { path: archivePath, targetDir, agentId } = req.body;
    if (!archivePath) return res.status(400).json({ error: 'Archive path required' });

    if (agentId && agents[agentId]) {
        if (agents[agentId].status !== 'approved') return res.status(403).json({ error: 'Agent not approved' });
        try {
            await axios.post(`${agents[agentId].url}/files/extract`, { path: archivePath, targetDir });
            return res.json({ message: 'Extracted on agent successfully' });
        } catch (e) {
            return res.status(e.response?.status || 502).json({ error: `Agent Error: ${e.response?.data?.error || e.message}` });
        }
    }

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
                console.error(`[Tar Extraction local error]: ${stderr || err.message}`);
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
                    console.error(`[7z Extraction local error]: ${stderr || err.message}`);
                    fallbackExtractLocal(resolvedArchive, resolvedTarget, ext, res);
                } else {
                    res.json({ message: 'Extracted successfully' });
                }
            });
        } else {
            fallbackExtractLocal(resolvedArchive, resolvedTarget, ext, res);
        }
    }
});

const fallbackExtractLocal = (archivePath, targetDir, ext, res) => {
    if (ext === '.zip') {
        try {
            const zip = new AdmZip(archivePath);
            zip.extractAllTo(targetDir, true);
            return res.json({ message: 'Extracted successfully' });
        } catch (zipErr) {
            console.error(`[ZIP Extraction local fallback error]: ${zipErr.message}`);
            return res.status(500).json({ error: `ZIP extraction failed: ${zipErr.message}` });
        }
    } else {
        return res.status(400).json({ error: `Unsupported archive format: ${ext}. Install 7-Zip for extended support.` });
    }
};

router.post('/files/compress', authenticateToken, async (req, res) => {
    const { paths, archiveName, type, agentId } = req.body;
    if (!paths || !Array.isArray(paths) || paths.length === 0) {
        return res.status(400).json({ error: 'Paths array is required' });
    }
    if (!archiveName) return res.status(400).json({ error: 'Archive name is required' });

    const safeArchiveName = path.basename(archiveName);

    if (agentId && agents[agentId]) {
        if (agents[agentId].status !== 'approved') return res.status(403).json({ error: 'Agent not approved' });
        try {
            await axios.post(`${agents[agentId].url}/files/compress`, { paths, archiveName: safeArchiveName, type });
            return res.json({ message: 'Compressed on agent successfully' });
        } catch (e) {
            return res.status(e.response?.status || 502).json({ error: `Agent Error: ${e.response?.data?.error || e.message}` });
        }
    }

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
                    console.error(`[7z Compression local error]: ${stderr || err.message}`);
                    fallbackCompressLocal(resolvedPaths, resolvedArchive, extType, baseDir, res);
                } else {
                    res.json({ message: 'Compressed successfully' });
                }
            });
        } else {
            fallbackCompressLocal(resolvedPaths, resolvedArchive, extType, baseDir, res);
        }
    } catch (err) {
        console.error(`[Compression error]: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

const fallbackCompressLocal = (paths, archivePath, extType, baseDir, res) => {
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
            console.error(`[ZIP Compression local fallback error]: ${err.message}`);
            return res.status(500).json({ error: err.message });
        }
    } else if (extType === 'tar.gz' || extType === 'tar') {
        const relativePaths = paths.map(p => path.relative(baseDir, p));
        const tarFlag = extType === 'tar.gz' ? '-czf' : '-cf';
        execFile('tar', [tarFlag, archivePath, '-C', baseDir, ...relativePaths], (err, stdout, stderr) => {
            if (err) {
                console.error(`[Tar Compression local fallback error]: ${stderr || err.message}`);
                return res.status(500).json({ error: stderr || err.message || 'Compression failed' });
            }
            res.json({ message: 'Compressed successfully' });
        });
    } else {
        return res.status(400).json({ error: `Unsupported archive type: ${extType}. Install 7-Zip for extended format support.` });
    }
};

router.post('/files/upload', authenticateToken, (req, res) => {
    req.setTimeout(0);
    upload.array('files')(req, res, async (err) => {
        if (err) return res.status(500).json({ error: err.message });
        const { path: targetPath, agentId } = req.query;
        if (agentId && agents[agentId]) {
            if (agents[agentId].status !== 'approved') {
                if (req.files) req.files.forEach(f => fs.unlink(f.path, () => { }));
                return res.status(403).json({ error: 'Agent not approved' });
            }
            try {
                const form = new FormData();
                if (req.files) req.files.forEach(f => form.append('files', fs.createReadStream(f.path), f.originalname));
                await axios.post(`${agents[agentId].url}/files/upload?path=${encodeURIComponent(targetPath)}`, form, { headers: form.getHeaders(), maxContentLength: Infinity, maxBodyLength: Infinity });
                if (req.files) req.files.forEach(f => fs.unlink(f.path, () => { }));
                return res.json({ message: 'Uploaded to agent successfully' });
            } catch (proxyErr) {
                if (req.files) req.files.forEach(f => fs.unlink(f.path, () => { }));
                return res.status(proxyErr.response?.status || 502).json({ error: `Agent Upload Error: ${proxyErr.message}` });
            }
        }
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                try {
                    await processUploadRules(file.path);
                } catch (ruleErr) {
                    console.error(`[AI Upload Trigger Error] Failed to process rules for ${file.path}:`, ruleErr.message);
                }
            }
        }
        res.json({ message: 'Uploaded successfully' });
    });
});

// --- ACTIVITIES ---
router.get('/activities', authenticateToken, (req, res) => res.json(activities));

module.exports = router;
