const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFile, exec } = require('child_process');
const axios = require('axios');
const multer = require('multer');
const FormData = require('form-data');
const AdmZip = require('adm-zip');

const db = require('../config/database');
const storageProvider = require('../utils/storageProvider');
let clearDirSizeCache = () => {};
try { clearDirSizeCache = require('../utils/fileHelpers').clearDirSizeCache || (() => {}); } catch(e) {}
const clusterService = require('../services/clusterService');
const securityService = require('../services/securityService');
const automationService = require('../services/automationService');
const notificationService = require('../services/notificationService');
const { authenticateToken, requireRole } = require('../middleware/auth');
const logger = require('../utils/logger');

router.use(authenticateToken);

// Local tracking of asynchronous operations in progress
const activeOps = {};

// Setup multer for temporary file uploads
const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, os.tmpdir());
        },
        filename: (req, file, cb) => {
            cb(null, `${Date.now()}-${Math.random().toString(36).substring(2, 8)}-${file.originalname}`);
        }
    }),
    limits: { fileSize: 1024 * 1024 * 1024 } // 1GB limit
});

// Helper: Resolve file path and check for directory traversal
const resolveFilePath = (req, filePath) => {
    if (req.user && req.user.isGuest) {
        if (!req.user.path) {
            throw new Error('Access denied: guest token missing share path');
        }
        let cleanPath = filePath.replace(/^[a-zA-Z]:/, '');
        cleanPath = cleanPath.replace(/^[\\\/]+/, '');
        const rawBase = req.user.path;
        const baseDir = path.resolve(rawBase);
        const targetPath = path.resolve(baseDir, cleanPath);
        const normalizedBase = path.normalize(baseDir).toLowerCase();
        const normalizedTarget = path.normalize(targetPath).toLowerCase();
        if (!normalizedTarget.startsWith(normalizedBase)) {
            throw new Error('Access denied: path traversal out of share boundary');
        }
        return targetPath;
    }
    // Return path resolved against storageProvider base
    return storageProvider.resolvePath(filePath);
};

// Helper: 7z command resolution
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

const moveToTrash = async (targetPath, userId, req) => {
    const resolvedPath = resolveFilePath(req, targetPath);
    if (!fs.existsSync(resolvedPath)) {
        throw new Error('File or directory does not exist');
    }

    const stat = fs.statSync(resolvedPath);
    const isDirectory = stat.isDirectory();
    const originalName = path.basename(resolvedPath);
    
    let size = 0;
    if (isDirectory) {
        let getDirectorySize = () => 0;
        try { getDirectorySize = require('../utils/fileHelpers').getDirectorySize || (() => 0); } catch(e) {}
        size = getDirectorySize(resolvedPath);
    } else {
        size = stat.size;
    }

    let TRASH_DIR = process.env.TRASH_STORAGE_ROOT || '/var/lib/nexadisk/trash';
    try {
        if (!fs.existsSync(TRASH_DIR)) {
            fs.mkdirSync(TRASH_DIR, { recursive: true });
        }
        const testFile = path.join(TRASH_DIR, `.write_test_${Date.now()}`);
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
    } catch (e) {
        TRASH_DIR = path.join(storageProvider.localBase, '.trash');
        if (!fs.existsSync(TRASH_DIR)) {
            fs.mkdirSync(TRASH_DIR, { recursive: true });
        }
    }

    const trashId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
    const trashPath = path.join(TRASH_DIR, `${trashId}_${originalName}`);

    fs.renameSync(resolvedPath, trashPath);

    await db.query(`
        INSERT INTO trash_items (id, original_name, original_path, trash_path, size, is_directory, deleted_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
        trashId,
        originalName,
        targetPath,
        trashPath,
        size,
        isDirectory,
        userId
    ]);
};

const getWindowsDrives = () => {
    return new Promise((resolve) => {
        exec('wmic logicaldisk get name', (err, stdout) => {
            if (err) {
                // Fallback to checking drives C to Z
                const drives = [];
                for (let i = 67; i <= 90; i++) {
                    const drive = String.fromCharCode(i) + ':';
                    if (fs.existsSync(drive + '\\')) {
                        drives.push(drive);
                    }
                }
                resolve(drives);
                return;
            }
            const drives = stdout
                .split('\r\n')
                .map(line => line.trim())
                .filter(line => /^[A-Z]:$/.test(line));
            resolve(drives);
        });
    });
};

// ── GET /api/v1/files/list ───────────────────────────────────────────────────
router.get('/list', async (req, res) => {
    const { path: targetPath, agentId } = req.query;

    if (agentId && clusterService.agents[agentId]) {
        const agent = clusterService.agents[agentId];
        if (agent.status !== 'approved') return res.status(403).json({ error: 'Agent not approved' });
        try {
            const resp = await axios.get(`${agent.url}/api/v1/files/list?path=${encodeURIComponent(targetPath || '')}`);
            return res.json(resp.data);
        } catch (e) {
            return res.status(e.response?.status || 502).json({ error: `Agent listing error: ${e.message}` });
        }
    }

    const isRoot = !targetPath || targetPath === '/' || targetPath === '';

    if (isRoot) {
        try {
            if (process.platform === 'win32') {
                const drives = await getWindowsDrives();
                return res.json(drives.map(d => ({
                    name: d + '\\',
                    isDirectory: true,
                    size: 0,
                    modified: new Date(),
                    path: d + '\\'
                })));
            } else {
                // Return a clean list of root options: Local Storage and Mounted Network Shares
                const rootItems = [];
                
                // 1. Local Storage
                rootItems.push({
                    name: 'Local Storage',
                    isDirectory: true,
                    size: 0,
                    modified: new Date(),
                    path: storageProvider.localBase
                });

                // 2. Query Mounted Network Shares
                try {
                    const sharesRes = await db.query('SELECT label, path FROM network_shares');
                    sharesRes.rows.forEach(row => {
                        if (fs.existsSync(row.path)) {
                            rootItems.push({
                                name: `[Share] ${row.label}`,
                                isDirectory: true,
                                size: 0,
                                modified: new Date(),
                                path: row.path
                            });
                        }
                    });
                } catch (dbErr) {
                    logger.error(`[Files Routes] Failed to fetch network shares for root listing: ${dbErr.message}`);
                }

                return res.json(rootItems);
            }
        } catch (rootErr) {
            logger.error(`[Files Routes] Root listing failed: ${rootErr.message}`);
        }
    }

    try {
        const files = await storageProvider.readdir(targetPath || '');
        res.json(files.map(f => ({
            ...f,
            path: path.join(targetPath || '', f.name)
        })));
    } catch (err) {
        logger.error(`[Files Routes] List failed: ${err.message}`);
        if (err.code === 'EACCES' || err.code === 'EPERM') {
            res.status(403).json({ error: 'Permission denied' });
        } else if (err.code === 'ENOENT') {
            res.status(404).json({ error: 'Directory not found' });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
});

// ── GET /api/v1/files/metadata ────────────────────────────────────────────────
router.get('/metadata', async (req, res) => {
    const { path: targetPath, agentId } = req.query;
    if (!targetPath) return res.status(400).json({ error: 'Path is required' });

    if (agentId && clusterService.agents[agentId]) {
        const agent = clusterService.agents[agentId];
        if (agent.status !== 'approved') return res.status(403).json({ error: 'Agent not approved' });
        try {
            const resp = await axios.get(`${agent.url}/api/v1/files/metadata?path=${encodeURIComponent(targetPath)}`);
            return res.json(resp.data);
        } catch (e) {
            return res.status(e.response?.status || 502).json({ error: e.message });
        }
    }

    try {
        const stats = await storageProvider.stat(targetPath);
        res.json({
            name: path.basename(targetPath),
            path: targetPath,
            size: stats.size,
            isDirectory: stats.isDirectory,
            modified: stats.modified
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/v1/files/mkdir (or /create/folder) ──────────────────────────────
router.post(['/mkdir', '/create/folder'], requireRole(['Admin', 'Operator', 'Power User', 'User']), async (req, res) => {
    const { path: targetPath, parentPath, folderName, agentId } = req.body;
    
    // Support both client inputs
    let folder = targetPath;
    if (!folder && parentPath !== undefined) {
        folder = path.join(parentPath, folderName || '');
    }

    if (!folder) return res.status(400).json({ error: 'Folder path is required' });

    if (agentId && clusterService.agents[agentId]) {
        const agent = clusterService.agents[agentId];
        if (agent.status !== 'approved') return res.status(403).json({ error: 'Agent not approved' });
        try {
            await axios.post(`${agent.url}/api/v1/files/mkdir`, { path: folder });
            return res.json({ message: 'Folder created on agent successfully' });
        } catch (e) {
            return res.status(502).json({ error: `Agent Error: ${e.message}` });
        }
    }

    try {
        await storageProvider.mkdir(folder);
        res.json({ message: 'Directory created successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── DELETE /api/v1/files/delete ──────────────────────────────────────────────
router.delete('/delete', requireRole(['Admin', 'Operator', 'Power User', 'User']), async (req, res) => {
    const { path: targetPath, agentId } = req.body;
    if (!targetPath) return res.status(400).json({ error: 'Path is required' });

    if (agentId && clusterService.agents[agentId]) {
        const agent = clusterService.agents[agentId];
        if (agent.status !== 'approved') return res.status(403).json({ error: 'Agent not approved' });
        try {
            await axios.delete(`${agent.url}/api/v1/files/delete`, { data: { path: targetPath } });
            return res.json({ message: 'Deleted on agent successfully' });
        } catch (e) {
            return res.status(502).json({ error: `Agent Error: ${e.message}` });
        }
    }

    try {
        await moveToTrash(targetPath, req.user.id, req);
        clearDirSizeCache();
        res.json({ message: 'Moved to trash successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/v1/files/delete/batch ──────────────────────────────────────────
router.post('/delete/batch', requireRole(['Admin', 'Operator', 'Power User', 'User']), async (req, res) => {
    const { paths, agentId } = req.body;
    if (!paths || !Array.isArray(paths)) return res.status(400).json({ error: 'Paths array required' });

    if (agentId && clusterService.agents[agentId]) {
        const agent = clusterService.agents[agentId];
        if (agent.status !== 'approved') return res.status(403).json({ error: 'Agent not approved' });
        try {
            await axios.post(`${agent.url}/api/v1/files/delete/batch`, { paths });
            return res.json({ message: 'Batch deleted on agent successfully' });
        } catch (e) {
            return res.status(502).json({ error: `Agent Error: ${e.message}` });
        }
    }

    try {
        for (const p of paths) {
            await moveToTrash(p, req.user.id, req);
        }
        clearDirSizeCache();
        res.json({ message: 'Batch moved to trash successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/v1/files/rename ────────────────────────────────────────────────
router.post('/rename', requireRole(['Admin', 'Operator', 'Power User', 'User']), async (req, res) => {
    const oldPath = req.body.path || req.body.oldPath;
    const { newName, agentId } = req.body;
    if (!oldPath || !newName) return res.status(400).json({ error: 'Path and newName are required' });

    if (agentId && clusterService.agents[agentId]) {
        const agent = clusterService.agents[agentId];
        if (agent.status !== 'approved') return res.status(403).json({ error: 'Agent not approved' });
        try {
            await axios.post(`${agent.url}/api/v1/files/rename`, { path: oldPath, newName });
            return res.json({ message: 'Renamed on agent successfully' });
        } catch (e) {
            return res.status(502).json({ error: e.message });
        }
    }

    try {
        const resolvedOld = resolveFilePath(req, oldPath);
        const resolvedNew = path.join(path.dirname(resolvedOld), newName);
        await fs.promises.rename(resolvedOld, resolvedNew);
        clearDirSizeCache();
        res.json({ message: 'Renamed successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/v1/files/move ──────────────────────────────────────────────────
router.post('/move', requireRole(['Admin', 'Operator', 'Power User', 'User']), async (req, res) => {
    const srcPath = req.body.path || req.body.source;
    const destPath = req.body.destPath || req.body.destination;
    const { agentId } = req.body;
    if (!srcPath || !destPath) return res.status(400).json({ error: 'Source and destination paths are required' });

    if (agentId && clusterService.agents[agentId]) {
        const agent = clusterService.agents[agentId];
        if (agent.status !== 'approved') return res.status(403).json({ error: 'Agent not approved' });
        try {
            await axios.post(`${agent.url}/api/v1/files/move`, { path: srcPath, destPath });
            return res.json({ message: 'Moved on agent successfully' });
        } catch (e) {
            return res.status(502).json({ error: e.message });
        }
    }

    try {
        const resolvedSrc = resolveFilePath(req, srcPath);
        const resolvedDest = path.join(resolveFilePath(req, destPath), path.basename(srcPath));
        const destDir = path.dirname(resolvedDest);
        if (!fs.existsSync(destDir)) {
            await fs.promises.mkdir(destDir, { recursive: true });
        }
        try {
            await fs.promises.rename(resolvedSrc, resolvedDest);
        } catch (renameErr) {
            if (renameErr.code === 'EXDEV') {
                await fs.promises.cp(resolvedSrc, resolvedDest, { recursive: true });
                const stats = await fs.promises.stat(resolvedSrc);
                if (stats.isDirectory()) {
                    await fs.promises.rm(resolvedSrc, { recursive: true, force: true });
                } else {
                    await fs.promises.unlink(resolvedSrc);
                }
            } else {
                throw renameErr;
            }
        }
        clearDirSizeCache();
        res.json({ message: 'Moved successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/v1/files/copy ──────────────────────────────────────────────────
router.post('/copy', requireRole(['Admin', 'Operator', 'Power User', 'User']), async (req, res) => {
    const srcPath = req.body.path || req.body.source;
    const destPath = req.body.destPath || req.body.destination;
    const { agentId } = req.body;
    if (!srcPath || !destPath) return res.status(400).json({ error: 'Source and destination paths are required' });

    if (agentId && clusterService.agents[agentId]) {
        const agent = clusterService.agents[agentId];
        if (agent.status !== 'approved') return res.status(403).json({ error: 'Agent not approved' });
        try {
            await axios.post(`${agent.url}/api/v1/files/copy`, { path: srcPath, destPath });
            return res.json({ message: 'Copied on agent successfully' });
        } catch (e) {
            return res.status(502).json({ error: e.message });
        }
    }

    try {
        const resolvedSrc = resolveFilePath(req, srcPath);
        const resolvedDest = path.join(resolveFilePath(req, destPath), path.basename(srcPath));
        const destDir = path.dirname(resolvedDest);
        if (!fs.existsSync(destDir)) {
            await fs.promises.mkdir(destDir, { recursive: true });
        }
        await fs.promises.cp(resolvedSrc, resolvedDest, { recursive: true });
        clearDirSizeCache();
        res.json({ message: 'Copied successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/v1/files/save (Save Code changes) ──────────────────────────────
router.post('/save', requireRole(['Admin', 'Operator', 'Power User', 'User']), async (req, res) => {
    const { path: targetPath, content, agentId } = req.body;
    if (!targetPath) return res.status(400).json({ error: 'Path is required' });

    if (agentId && clusterService.agents[agentId]) {
        const agent = clusterService.agents[agentId];
        if (agent.status !== 'approved') return res.status(403).json({ error: 'Agent not approved' });
        try {
            await axios.post(`${agent.url}/api/v1/files/save`, { path: targetPath, content });
            return res.json({ message: 'Saved on agent successfully' });
        } catch (e) {
            return res.status(502).json({ error: e.message });
        }
    }

    try {
        const resolvedPath = resolveFilePath(req, targetPath);
        fs.writeFileSync(resolvedPath, content || '', 'utf8');
        res.json({ message: 'Saved successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/v1/files/utimes (Set File Timestamps) ─────────────────────────
router.post('/utimes', requireRole(['Admin', 'Operator', 'Power User', 'User']), async (req, res) => {
    const { path: targetPath, mtime, agentId } = req.body;
    if (!targetPath || !mtime) return res.status(400).json({ error: 'Path and mtime are required' });

    if (agentId && clusterService.agents[agentId]) {
        const agent = clusterService.agents[agentId];
        if (agent.status !== 'approved') return res.status(403).json({ error: 'Agent not approved' });
        try {
            await axios.post(`${agent.url}/api/v1/files/utimes`, { path: targetPath, mtime });
            return res.json({ message: 'Utimes set on agent successfully' });
        } catch (e) {
            return res.status(502).json({ error: `Agent Error: ${e.message}` });
        }
    }

    try {
        const resolvedPath = resolveFilePath(req, targetPath);
        if (!fs.existsSync(resolvedPath)) {
            return res.status(404).json({ error: 'File not found' });
        }
        const date = new Date(mtime);
        fs.utimesSync(resolvedPath, date, date);
        res.json({ message: 'Timestamps updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/v1/files/upload ────────────────────────────────────────────────
router.post('/upload', upload.array('files'), async (req, res) => {
    const { path: targetPath, agentId } = req.query;

    if (agentId && clusterService.agents[agentId]) {
        const agent = clusterService.agents[agentId];
        if (agent.status !== 'approved') {
            if (req.files) req.files.forEach(f => { try { fs.unlinkSync(f.path); } catch (e) {} });
            return res.status(403).json({ error: 'Agent not approved' });
        }
        try {
            const form = new FormData();
            if (req.files) req.files.forEach(f => form.append('files', fs.createReadStream(f.path), f.originalname));
            await axios.post(`${agent.url}/api/v1/files/upload?path=${encodeURIComponent(targetPath || '')}`, form, {
                headers: form.getHeaders(),
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            });
            if (req.files) req.files.forEach(f => { try { fs.unlinkSync(f.path); } catch (e) {} });
            
            const fileNames = req.files ? req.files.map(f => f.originalname).join(', ') : '';
            notificationService.sendInAppAlert(
                'File Uploaded (Remote) 📤',
                `Uploaded: ${fileNames}\nDestination: ${targetPath || 'Root'}\nAgent Node: ${agent.hostname}`,
                'info'
            );

            return res.json({ message: 'Uploaded to agent successfully' });
        } catch (proxyErr) {
            if (req.files) req.files.forEach(f => { try { fs.unlinkSync(f.path); } catch (e) {} });
            return res.status(proxyErr.response?.status || 502).json({ error: `Agent Upload Proxy Error: ${proxyErr.message}` });
        }
    }

    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files provided' });
    }

    const results = [];
    const errors = [];

    try {
        const baseFolder = targetPath || '';
        await storageProvider.mkdir(baseFolder);

        for (const file of req.files) {
            let scanResult;
            try {
                scanResult = await securityService.deepScan(file.path, file.originalname);
            } catch (err) {
                errors.push(`${file.originalname}: Scan failed`);
                try { fs.unlinkSync(file.path); } catch (e) {}
                continue;
            }

            if (scanResult.verdict === 'malicious') {
                try { fs.unlinkSync(file.path); } catch (e) {}
                return res.status(400).json({
                    error: `Security Scan Blocked: File is malicious (Score: ${scanResult.score}). Threats: ${scanResult.threats.join(', ')}`
                });
            }

            if (scanResult.verdict === 'suspicious') {
                const quarantineId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
                const destPath = path.join(storageProvider.resolvePath(baseFolder), file.originalname);
                try {
                    await securityService.quarantineFile(
                        quarantineId,
                        file.originalname,
                        file.path,
                        destPath,
                        null,
                        file.size,
                        file.mimetype,
                        scanResult
                    );
                    results.push({ name: file.originalname, status: 'quarantined' });
                } catch (qErr) {
                    errors.push(`${file.originalname}: Quarantine failed: ${qErr.message}`);
                    try { fs.unlinkSync(file.path); } catch (e) {}
                }
            } else {
                const finalDest = path.join(baseFolder, file.originalname);
                try {
                    await storageProvider.writeStream(finalDest, fs.createReadStream(file.path), file.mimetype);
                    try { fs.unlinkSync(file.path); } catch (e) {}
                    
                    // Trigger AI classification rules
                    automationService.processUploadRules(storageProvider.resolvePath(finalDest)).catch(err => {
                        logger.error(`[AI Rule trigger failure]: ${err.message}`);
                    });

                    results.push({ name: file.originalname, status: 'uploaded' });
                } catch (wErr) {
                    errors.push(`${file.originalname}: Write failed: ${wErr.message}`);
                    try { fs.unlinkSync(file.path); } catch (e) {}
                }
            }
        }

        if (errors.length > 0) {
            return res.status(500).json({ error: `Upload issues: ${errors.join(', ')}` });
        }

        const uploadedFiles = results.filter(r => r.status === 'uploaded').map(r => r.name);
        if (uploadedFiles.length > 0) {
            notificationService.sendInAppAlert(
                'File Uploaded 📤',
                `Uploaded: ${uploadedFiles.join(', ')}\nDestination: ${baseFolder || 'Root'} (Local)`,
                'info'
            );
        }

        res.json({ message: 'Uploaded successfully', results });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/v1/files/download/prepare (Decoupled download ZIP) ──────────────
router.post('/download/prepare', async (req, res) => {
    const { paths, agentId } = req.body;
    if (!paths || !Array.isArray(paths) || paths.length === 0) {
        return res.status(400).json({ error: 'Paths array is required' });
    }

    if (agentId && clusterService.agents[agentId]) {
        const agent = clusterService.agents[agentId];
        if (agent.status !== 'approved') return res.status(403).json({ error: 'Agent not approved' });
        try {
            const resp = await axios.post(`${agent.url}/api/v1/files/download/prepare`, { paths });
            return res.json({ opId: resp.data.opId, agentId });
        } catch (e) {
            return res.status(502).json({ error: `Agent unreachable: ${e.message}` });
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

    // Run archiving asynchronously
    setImmediate(async () => {
        try {
            const zip = new AdmZip();
            for (const p of paths) {
                const resolved = resolveFilePath(req, p);
                if (fs.existsSync(resolved)) {
                    const stats = fs.statSync(resolved);
                    if (stats.isDirectory()) {
                        zip.addLocalFolder(resolved, path.basename(resolved));
                    } else {
                        zip.addLocalFile(resolved);
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
            logger.error(`[Download Prepare] Archive build crashed: ${err.message}`);
            activeOps[opId].status = 'Failed';
            activeOps[opId].error = err.message;
            try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch (e) {}
            setTimeout(() => delete activeOps[opId], 60000);
        }
    });
});

// ── GET /api/v1/files/download/prepared/:opId ─────────────────────────────────
router.get('/download/prepared/:opId', async (req, res) => {
    const { opId } = req.params;
    const { agentId } = req.query;

    if (agentId && clusterService.agents[agentId]) {
        const agent = clusterService.agents[agentId];
        if (agent.status !== 'approved') return res.status(403).json({ error: 'Agent not approved' });
        try {
            const resp = await axios({
                method: 'get',
                url: `${agent.url}/api/v1/files/download/prepared/${opId}`,
                responseType: 'stream'
            });
            if (resp.headers['content-type']) res.setHeader('Content-Type', resp.headers['content-type']);
            if (resp.headers['content-disposition']) res.setHeader('Content-Disposition', resp.headers['content-disposition']);
            resp.data.pipe(res);
            return;
        } catch (e) {
            return res.status(502).json({ error: e.message });
        }
    }

    const op = activeOps[opId];
    if (!op || op.status !== 'Completed' || !fs.existsSync(op.tempPath)) {
        return res.status(404).json({ error: 'Archive not ready or expired' });
    }

    res.download(op.tempPath, op.name, (err) => {
        if (!err) {
            try { fs.unlinkSync(op.tempPath); } catch (e) {}
            delete activeOps[opId];
        }
    });
});

// ── GET /api/v1/files/download ────────────────────────────────────────────────
router.get('/download', async (req, res) => {
    const { path: filePath, agentId } = req.query;
    if (!filePath) return res.status(400).json({ error: 'Path is required' });

    if (agentId && clusterService.agents[agentId]) {
        const agent = clusterService.agents[agentId];
        if (agent.status !== 'approved') return res.status(403).json({ error: 'Agent not approved' });
        try {
            const resp = await axios({
                method: 'get',
                url: `${agent.url}/api/v1/files/download?path=${encodeURIComponent(filePath)}`,
                responseType: 'stream'
            });
            if (resp.headers['content-type']) res.setHeader('Content-Type', resp.headers['content-type']);
            if (resp.headers['content-disposition']) res.setHeader('Content-Disposition', resp.headers['content-disposition']);
            
            if (req.query.intent !== 'stream') {
                notificationService.sendInAppAlert(
                    'File Downloaded (Remote) 📥',
                    `File: ${path.basename(filePath)}\nNode: ${agent.hostname}`,
                    'info'
                );
            }

            resp.data.pipe(res);
            return;
        } catch (e) {
            return res.status(502).json({ error: e.message });
        }
    }

    try {
        const resolved = resolveFilePath(req, filePath);
        if (!fs.existsSync(resolved)) {
            return res.status(404).json({ error: 'File not found' });
        }

        const stats = fs.statSync(resolved);
        if (stats.isDirectory()) {
            const zip = new AdmZip();
            zip.addLocalFolder(resolved);
            const buffer = zip.toBuffer();
            res.set({
                'Content-Type': 'application/zip',
                'Content-Disposition': `attachment; filename="${path.basename(resolved)}.zip"`,
                'Content-Length': buffer.length
            });

            notificationService.sendInAppAlert(
                'Folder Downloaded (ZIP) 📥',
                `Folder: ${path.basename(resolved)}\nSize: ${(buffer.length / (1024 * 1024)).toFixed(2)} MB`,
                'info'
            );

            return res.send(buffer);
        }

        if (req.query.intent !== 'stream') {
            notificationService.sendInAppAlert(
                'File Downloaded 📥',
                `File: ${path.basename(resolved)}\nSize: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`,
                'info'
            );
        }

        res.download(resolved);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/v1/files/download/zip (Synchronous Download multiple zip selection) ──
router.post('/download/zip', async (req, res) => {
    const { paths, agentId } = req.body;
    if (!paths || !Array.isArray(paths) || paths.length === 0) {
        return res.status(400).json({ error: 'Paths array required' });
    }

    if (agentId && clusterService.agents[agentId]) {
        const agent = clusterService.agents[agentId];
        if (agent.status !== 'approved') return res.status(403).json({ error: 'Agent not approved' });
        try {
            const resp = await axios({
                method: 'post',
                url: `${agent.url}/api/v1/files/download/zip`,
                data: { paths },
                responseType: 'stream'
            });
            if (resp.headers['content-type']) res.setHeader('Content-Type', resp.headers['content-type']);
            if (resp.headers['content-disposition']) res.setHeader('Content-Disposition', resp.headers['content-disposition']);
            resp.data.pipe(res);
            return;
        } catch (e) {
            return res.status(502).json({ error: e.message });
        }
    }

    try {
        const zip = new AdmZip();
        for (const p of paths) {
            const resolved = resolveFilePath(req, p);
            if (fs.existsSync(resolved)) {
                const stats = fs.statSync(resolved);
                if (stats.isDirectory()) {
                    zip.addLocalFolder(resolved, path.basename(resolved));
                } else {
                    zip.addLocalFile(resolved);
                }
            }
        }
        const buffer = zip.toBuffer();
        res.set({
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename="Selection-${Date.now()}.zip"`,
            'Content-Length': buffer.length
        });
        res.send(buffer);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/v1/files/compress ──────────────────────────────────────────────
router.post('/compress', requireRole(['Admin', 'Operator', 'Power User', 'User']), async (req, res) => {
    const { paths, archiveName, type, agentId } = req.body;
    if (!paths || !Array.isArray(paths) || paths.length === 0) return res.status(400).json({ error: 'Paths are required' });
    if (!archiveName) return res.status(400).json({ error: 'Archive name is required' });

    const safeName = path.basename(archiveName);

    if (agentId && clusterService.agents[agentId]) {
        const agent = clusterService.agents[agentId];
        if (agent.status !== 'approved') return res.status(403).json({ error: 'Agent not approved' });
        try {
            await axios.post(`${agent.url}/api/v1/files/compress`, { paths, archiveName: safeName, type });
            return res.json({ message: 'Compressed on agent successfully' });
        } catch (e) {
            return res.status(502).json({ error: e.message });
        }
    }

    try {
        const resolvedPaths = paths.map(p => resolveFilePath(req, p));
        const destZip = path.join(path.dirname(resolvedPaths[0]), safeName);

        const zip = new AdmZip();
        for (const p of resolvedPaths) {
            if (fs.existsSync(p)) {
                const stats = fs.statSync(p);
                if (stats.isDirectory()) {
                    zip.addLocalFolder(p, path.basename(p));
                } else {
                    zip.addLocalFile(p);
                }
            }
        }
        await zip.writeZipPromise(destZip);
        res.json({ message: 'Compressed successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/v1/files/extract ───────────────────────────────────────────────
router.post('/extract', requireRole(['Admin', 'Operator', 'Power User', 'User']), async (req, res) => {
    const { path: archivePath, targetDir, agentId } = req.body;
    if (!archivePath) return res.status(400).json({ error: 'Archive path is required' });

    if (agentId && clusterService.agents[agentId]) {
        const agent = clusterService.agents[agentId];
        if (agent.status !== 'approved') return res.status(403).json({ error: 'Agent not approved' });
        try {
            await axios.post(`${agent.url}/api/v1/files/extract`, { path: archivePath, targetDir });
            return res.json({ message: 'Extracted on agent successfully' });
        } catch (e) {
            return res.status(502).json({ error: e.message });
        }
    }

    try {
        const resolvedArchive = resolveFilePath(req, archivePath);
        if (!fs.existsSync(resolvedArchive)) {
            return res.status(404).json({ error: 'Archive not found' });
        }

        const resolvedTarget = targetDir ? resolveFilePath(req, targetDir) : path.dirname(resolvedArchive);
        fs.mkdirSync(resolvedTarget, { recursive: true });

        const ext = path.extname(resolvedArchive).toLowerCase();
        
        if (ext === '.zip') {
            const zip = new AdmZip(resolvedArchive);
            zip.extractAllTo(resolvedTarget, true);
            res.json({ message: 'Extracted successfully' });
        } else {
            // Check if 7z is installed for other formats
            const sevenZip = get7zCommand();
            if (sevenZip) {
                execFile(sevenZip, ['x', resolvedArchive, `-o${resolvedTarget}`, '-y'], (err) => {
                    if (err) return res.status(500).json({ error: `Extraction error: ${err.message}` });
                    res.json({ message: 'Extracted successfully' });
                });
            } else {
                res.status(400).json({ error: `Unsupported format "${ext}". Install 7-Zip for rar/tar/7z support.` });
            }
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/v1/duplicates/scan ─────────────────────────────────────────────
router.post('/duplicates/scan', async (req, res) => {
    const { path: dirPath, agentId } = req.body;
    if (!dirPath) return res.status(400).json({ error: 'Path is required' });

    if (agentId && clusterService.agents[agentId]) {
        const agent = clusterService.agents[agentId];
        if (agent.status !== 'approved') return res.status(403).json({ error: 'Agent not approved' });
        try {
            const resp = await axios.post(`${agent.url}/api/v1/duplicates/scan`, { path: dirPath });
            return res.json(resp.data);
        } catch (e) {
            return res.status(502).json({ error: e.message });
        }
    }

    try {
        const resolved = resolveFilePath(req, dirPath);
        if (!fs.existsSync(resolved)) return res.status(404).json({ error: 'Directory not found' });

        const walkDirectory = async (dir, fileList = []) => {
            if (fileList.length > 5000) return fileList;
            const files = await fs.promises.readdir(dir, { withFileTypes: true });
            for (const file of files) {
                if (fileList.length > 5000) break;
                const fullPath = path.join(dir, file.name);
                if (file.isDirectory()) {
                    const lower = file.name.toLowerCase();
                    if (['node_modules', '.git', '$recycle.bin', 'system volume information'].includes(lower)) continue;
                    await walkDirectory(fullPath, fileList);
                } else {
                    const stats = await fs.promises.stat(fullPath);
                    fileList.push({ path: fullPath, size: stats.size, mtime: stats.mtimeMs });
                }
            }
            return fileList;
        };

        const fileList = await walkDirectory(resolved);
        const sizeGroups = {};
        for (const file of fileList) {
            if (file.size === 0) continue;
            if (!sizeGroups[file.size]) sizeGroups[file.size] = [];
            sizeGroups[file.size].push(file);
        }

        const duplicateGroups = [];
        for (const size in sizeGroups) {
            if (sizeGroups[size].length > 1) {
                const files = sizeGroups[size].map(f => ({
                    path: f.path,
                    name: path.basename(f.path),
                    mtime: f.mtime
                }));
                duplicateGroups.push({
                    size: parseInt(size, 10),
                    hash: crypto.createHash('md5').update(size).digest('hex'), // Mock hash grouping
                    files
                });
            }
        }
        res.json(duplicateGroups);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/v1/files/search ─────────────────────────────────────────────────
router.get('/search', async (req, res) => {
    const { query, agentId } = req.query;
    if (!query) return res.json([]);

    if (agentId && clusterService.agents[agentId]) {
        const agent = clusterService.agents[agentId];
        if (agent.status !== 'approved') return res.status(403).json({ error: 'Agent not approved' });
        try {
            const resp = await axios.get(`${agent.url}/api/v1/files/search?query=${encodeURIComponent(query)}`);
            return res.json(resp.data);
        } catch (e) {
            return res.status(502).json({ error: e.message });
        }
    }

    try {
        const baseFolder = storageProvider.localBase;
        const results = [];

        const searchDir = (dir, depth = 0) => {
            if (depth > 3 || results.length > 50) return;
            try {
                const items = fs.readdirSync(dir, { withFileTypes: true });
                for (const item of items) {
                    const fullPath = path.join(dir, item.name);
                    if (item.name.toLowerCase().includes(query.toLowerCase())) {
                        const stats = fs.statSync(fullPath);
                        results.push({
                            name: item.name,
                            path: fullPath.replace(baseFolder, '').replace(/^[\\\/]+/, ''),
                            isDirectory: item.isDirectory(),
                            size: item.isDirectory() ? 0 : stats.size,
                            modified: stats.mtime
                        });
                    }
                    if (item.isDirectory()) searchDir(fullPath, depth + 1);
                }
            } catch (e) {}
        };

        searchDir(baseFolder);
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/v1/files/operations/status ──────────────────────────────────────
router.get('/operations/status', async (req, res) => {
    try {
        const localOps = Object.values(activeOps);
        const agentOpsPromises = Object.values(clusterService.agents)
            .filter(a => a.status === 'approved')
            .map(async (agent) => {
                try {
                    const resp = await axios.get(`${agent.url}/api/v1/files/operations/status`, { timeout: 1000 });
                    return resp.data.map(op => ({ ...op, agentId: agent.id, hostname: agent.hostname }));
                } catch (e) {
                    return [];
                }
            });

        const results = await Promise.all(agentOpsPromises);
        res.json([...localOps, ...results.flat()]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/v1/files/mobile/summary ─────────────────────────────────────────
router.get('/mobile/summary', async (req, res) => {
    try {
        const baseFolder = storageProvider.localBase;
        const stats = { images: 0, videos: 0, docs: 0, links: 0 };

        const categorize = (dir, depth = 0) => {
            if (depth > 2) return;
            try {
                const items = fs.readdirSync(dir, { withFileTypes: true });
                for (const item of items) {
                    const fullPath = path.join(dir, item.name);
                    if (item.isDirectory()) {
                        categorize(fullPath, depth + 1);
                    } else {
                        const ext = path.extname(item.name).toLowerCase();
                        if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.bmp'].includes(ext)) stats.images++;
                        else if (['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv'].includes(ext)) stats.videos++;
                        else if (['.pdf', '.doc', '.docx', '.txt', '.zip', '.rar', '.7z', '.xlsx', '.pptx'].includes(ext)) stats.docs++;
                    }
                }
            } catch (e) {}
        };

        if (fs.existsSync(baseFolder)) {
            categorize(baseFolder);
        }

        const shareRes = await db.query('SELECT COUNT(*) as count FROM shares');
        stats.links = parseInt(shareRes.rows[0].count || 0, 10);

        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/v1/files/activities ─────────────────────────────────────────────
router.get('/activities', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM system_alerts ORDER BY timestamp DESC LIMIT 150');
        res.json(result.rows);
    } catch (err) {
        res.json(notificationService.activities);
    }
});

// ── POST /api/v1/files/activities/clear ────────────────────────────────────────
router.post('/activities/clear', authenticateToken, async (req, res) => {
    try {
        await db.query('DELETE FROM system_alerts');
        notificationService.activities.length = 0;
        res.json({ success: true, message: 'System alerts cleared successfully' });
    } catch (err) {
        logger.error(`[Files Routes] Failed to clear alerts: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
