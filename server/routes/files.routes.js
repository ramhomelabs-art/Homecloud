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
const vaultService = require('../services/vaultService');
let clearDirSizeCache = () => {};
try { clearDirSizeCache = require('../utils/fileHelpers').clearDirSizeCache || (() => {}); } catch(e) {}
const clusterService = require('../services/clusterService');
const securityService = require('../services/securityService');
const notificationService = require('../services/notificationService');
const { authenticateToken, requireRole } = require('../middleware/auth');
const logger = require('../utils/logger');

const cryptoHelper = require('../utils/cryptoHelper');

router.use(authenticateToken);

// Local tracking of asynchronous operations in progress
const activeOps = {};

// Helper to recursively calculate physical size of a file or directory
const getPhysicalSizeRecursive = async (srcPhys) => {
    try {
        const stats = await fs.promises.stat(srcPhys);
        if (stats.isDirectory()) {
            let total = 0;
            const files = await fs.promises.readdir(srcPhys);
            for (const file of files) {
                total += await getPhysicalSizeRecursive(path.join(srcPhys, file));
            }
            return total;
        } else {
            return stats.size;
        }
    } catch (e) {
        return 0;
    }
};

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

// Helper: Resolve file path and check for directory traversal and role isolation
const resolveFilePath = (req, filePath) => {
    // 1. Guest Users: Strictly jailed to their specific share token's root path
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

    // 2. Administrators: Full unrestricted access across host partitions & fleet mounts
    if (req.user && (req.user.role === 'Admin' || req.user.role === 'Administrator')) {
        return storageProvider.resolvePath(filePath);
    }

    // 3. Non-Admin Authenticated Users (User, Viewer, Operator):
    // Resolve path and verify it is either within localBase or an explicitly mounted cloud/network share
    const resolved = storageProvider.resolvePath(filePath);
    const baseDir = path.resolve(storageProvider.localBase);
    const normalizedBase = path.normalize(baseDir).toLowerCase();
    const normalizedTarget = path.normalize(resolved).toLowerCase();

    // Check if within local storage
    if (normalizedTarget.startsWith(normalizedBase)) {
        return resolved;
    }

    // Check if within any mounted network share / cloud mount
    try {
        const cloudMountService = require('../services/cloudMountService');
        const mounts = cloudMountService.getMounts();
        const isWithinMount = mounts.some(m => {
            if (!m.path) return false;
            const normMount = path.normalize(path.resolve(m.path)).toLowerCase();
            return normalizedTarget.startsWith(normMount);
        });
        if (isWithinMount) {
            return resolved;
        }
    } catch (e) {}

    // Reject traversal out of authorized bounds
    logger.warn(`[Security Sandbox] User "${req.user?.username}" (Role: ${req.user?.role}) blocked from accessing out-of-bounds path: ${filePath}`);
    throw new Error('Access denied: path is outside authorized storage boundaries');
};

// Helper to recursively decrypt and add folder to ZIP
const addDecryptedFolderToZip = async (zip, virtualFolderPath, physicalFolderPath, locker, keys, zipRelativePath) => {
    const files = fs.readdirSync(physicalFolderPath, { withFileTypes: true });
    const folderBase = path.basename(virtualFolderPath);
    const currentZipPath = zipRelativePath ? path.join(zipRelativePath, folderBase) : folderBase;

    for (const file of files) {
        const physicalChild = path.join(physicalFolderPath, file.name);
        const decName = vaultService.decryptFilename(file.name, keys.filenameKey);
        
        if (file.isDirectory()) {
            await addDecryptedFolderToZip(zip, path.join(virtualFolderPath, decName), physicalChild, locker, keys, currentZipPath);
        } else {
            const fileBytes = fs.readFileSync(physicalChild);
            const decryptedContent = vaultService.decryptBuffer(fileBytes, keys.fileKey, locker.encryption_algorithm);
            zip.addFile(path.join(currentZipPath, decName), decryptedContent);
        }
    }
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

const deleteSmbFile = async (targetPath) => {
    const sharesRes = await db.query('SELECT * FROM network_shares');
    let clean = targetPath.trim().replace(/\\/g, '/').replace(/^(smb:)?\/+/, '');
    const parts = clean.split('/');
    const host = parts[0];
    const shareName = parts[1] || '';
    const uncShare = `//${host}/${shareName}`;
    const internalPath = parts.slice(2).join('/');

    const matchedShare = sharesRes.rows.find(row => {
        let cleanRow = (row.path || '').replace(/\\/g, '/').replace(/^(smb:)?\/+/, '');
        const rowParts = cleanRow.split('/');
        return rowParts[0]?.toLowerCase() === host.toLowerCase() && 
               (rowParts[1] || '').toLowerCase() === shareName.toLowerCase();
    });

    const user = matchedShare?.username || '';
    let pass = '';
    if (matchedShare?.password) {
        try { pass = cryptoHelper.decrypt(matchedShare.password); } catch (e) { pass = matchedShare.password; }
    }

    const env = { ...process.env, PASSWD: pass || '' };
    const safeUser = (user || '').replace(/[;&|`$<>\\"']/g, '');
    const safeShare = uncShare.replace(/[;&|`$<>\\"']/g, '');
    const delCmd = `del "${internalPath.replace(/"/g, '')}"`;

    const cmd = safeUser
        ? `smbclient "${safeShare}" -U "${safeUser}" -t 15 -c '${delCmd}'`
        : `smbclient "${safeShare}" -N -t 15 -c '${delCmd}'`;

    return new Promise((resolve, reject) => {
        exec(cmd, { env, timeout: 20000 }, (err, stdout, stderr) => {
            if (err) {
                const rmdirCmd = safeUser
                    ? `smbclient "${safeShare}" -U "${safeUser}" -t 15 -c 'rmdir "${internalPath.replace(/"/g, '')}"'`
                    : `smbclient "${safeShare}" -N -t 15 -c 'rmdir "${internalPath.replace(/"/g, '')}"'`;
                exec(rmdirCmd, { env, timeout: 20000 }, (rErr) => {
                    if (rErr) return reject(new Error(`SMB delete failed: ${(stderr || stdout || err.message).trim()}`));
                    resolve(true);
                });
                return;
            }
            resolve(true);
        });
    });
};

const smbRenameOrMove = async (srcPath, destPath) => {
    const sharesRes = await db.query('SELECT * FROM network_shares');
    let cleanSrc = srcPath.trim().replace(/\\/g, '/').replace(/^(smb:)?\/+/, '');
    const srcParts = cleanSrc.split('/');
    const srcHost = srcParts[0];
    const srcShare = srcParts[1] || '';
    const srcInternal = srcParts.slice(2).join('/');

    let cleanDest = destPath.trim().replace(/\\/g, '/').replace(/^(smb:)?\/+/, '');
    const destParts = cleanDest.split('/');
    let destInternal = destParts.slice(2).join('/');
    if (destParts.length <= 2 || !destInternal) {
        destInternal = path.basename(cleanSrc);
    } else if (destInternal.endsWith('/') || !destInternal.includes('.')) {
        destInternal = `${destInternal.replace(/\/+$/, '')}/${path.basename(cleanSrc)}`;
    }

    const uncShare = `//${srcHost}/${srcShare}`;
    const matchedShare = sharesRes.rows.find(row => {
        let cleanRow = (row.path || '').replace(/\\/g, '/').replace(/^(smb:)?\/+/, '');
        const rowParts = cleanRow.split('/');
        return rowParts[0]?.toLowerCase() === srcHost.toLowerCase() && 
               (rowParts[1] || '').toLowerCase() === srcShare.toLowerCase();
    });

    const user = matchedShare?.username || '';
    let pass = '';
    if (matchedShare?.password) {
        try { pass = cryptoHelper.decrypt(matchedShare.password); } catch (e) { pass = matchedShare.password; }
    }

    const env = { ...process.env, PASSWD: pass || '' };
    const safeUser = (user || '').replace(/[;&|`$<>\\"']/g, '');
    const safeShare = uncShare.replace(/[;&|`$<>\\"']/g, '');
    const renameCmd = `rename "${srcInternal.replace(/"/g, '')}" "${destInternal.replace(/"/g, '')}"`;

    const cmd = safeUser
        ? `smbclient "${safeShare}" -U "${safeUser}" -t 15 -c '${renameCmd}'`
        : `smbclient "${safeShare}" -N -t 15 -c '${renameCmd}'`;

    return new Promise((resolve, reject) => {
        exec(cmd, { env, timeout: 20000 }, (err, stdout, stderr) => {
            if (err) {
                const errMsg = (stderr || stdout || err.message || '').trim();
                return reject(new Error(`SMB operation failed: ${errMsg}`));
            }
            resolve(true);
        });
    });
};

const smbCopyFile = async (srcPath, destPath) => {
    const sharesRes = await db.query('SELECT * FROM network_shares');
    let cleanSrc = srcPath.trim().replace(/\\/g, '/').replace(/^(smb:)?\/+/, '');
    const srcParts = cleanSrc.split('/');
    const srcHost = srcParts[0];
    const srcShare = srcParts[1] || '';
    const srcInternal = srcParts.slice(2).join('/');

    let cleanDest = destPath.trim().replace(/\\/g, '/').replace(/^(smb:)?\/+/, '');
    const destParts = cleanDest.split('/');
    let destInternal = destParts.slice(2).join('/');
    if (destParts.length <= 2 || !destInternal) {
        destInternal = path.basename(cleanSrc);
    } else if (destInternal.endsWith('/') || !destInternal.includes('.')) {
        destInternal = `${destInternal.replace(/\/+$/, '')}/${path.basename(cleanSrc)}`;
    }

    const uncShare = `//${srcHost}/${srcShare}`;
    const matchedShare = sharesRes.rows.find(row => {
        let cleanRow = (row.path || '').replace(/\\/g, '/').replace(/^(smb:)?\/+/, '');
        const rowParts = cleanRow.split('/');
        return rowParts[0]?.toLowerCase() === srcHost.toLowerCase() && 
               (rowParts[1] || '').toLowerCase() === srcShare.toLowerCase();
    });

    const user = matchedShare?.username || '';
    let pass = '';
    if (matchedShare?.password) {
        try { pass = cryptoHelper.decrypt(matchedShare.password); } catch (e) { pass = matchedShare.password; }
    }

    const env = { ...process.env, PASSWD: pass || '' };
    const safeUser = (user || '').replace(/[;&|`$<>\\"']/g, '');
    const safeShare = uncShare.replace(/[;&|`$<>\\"']/g, '');

    const spawn = require('child_process').spawn;
    const getArgs = safeUser
        ? ['-U', safeUser, safeShare, '-t', '30', '-c', `get "${srcInternal.replace(/"/g, '')}" -`]
        : ['-N', safeShare, '-t', '30', '-c', `get "${srcInternal.replace(/"/g, '')}" -`];

    const isDestSmb = destPath.startsWith('\\\\') || destPath.startsWith('//') || destPath.startsWith('smb://');
    if (isDestSmb) {
        const putArgs = safeUser
            ? ['-U', safeUser, safeShare, '-t', '30', '-c', `put - "${destInternal.replace(/"/g, '')}"`]
            : ['-N', safeShare, '-t', '30', '-c', `put - "${destInternal.replace(/"/g, '')}"`];

        return new Promise((resolve, reject) => {
            const getProc = spawn('smbclient', getArgs, { env });
            const putProc = spawn('smbclient', putArgs, { env });

            getProc.stdout.pipe(putProc.stdin);

            let putErr = '';
            putProc.stderr.on('data', d => { putErr += d.toString(); });
            putProc.on('close', code => {
                if (code === 0) resolve(true);
                else reject(new Error(putErr || `SMB copy failed with code ${code}`));
            });
            getProc.on('error', reject);
            putProc.on('error', reject);
        });
    } else {
        const resolvedDest = storageProvider.resolvePath(destPath);
        const finalDestFile = fs.existsSync(resolvedDest) && fs.statSync(resolvedDest).isDirectory()
            ? path.join(resolvedDest, path.basename(srcPath))
            : resolvedDest;

        return new Promise((resolve, reject) => {
            const getProc = spawn('smbclient', getArgs, { env });
            const outStream = fs.createWriteStream(finalDestFile);
            getProc.stdout.pipe(outStream);
            outStream.on('finish', () => resolve(true));
            outStream.on('error', reject);
            getProc.on('error', reject);
        });
    }
};

const moveToTrash = async (targetPath, userId, req) => {
    const isSmb = targetPath && (targetPath.startsWith('\\\\') || targetPath.startsWith('//') || targetPath.startsWith('smb://'));
    if (isSmb) {
        await deleteSmbFile(targetPath);
        return;
    }

    const resolvedPath = await vaultService.resolveVaultPath(req, targetPath);
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

const listSmbFiles = async (sharePath, subPath = '', username = '', password = '') => {
    let clean = sharePath.trim().replace(/\\/g, '/').replace(/^(smb:)?\/+/, '');
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

    const env = { ...process.env, PASSWD: password || '' };
    const safeUser = (username || '').replace(/[;&|`$<>\\"']/g, '');
    const safeShare = uncShare.replace(/[;&|`$<>\\"']/g, '');

    const cmd = safeUser
        ? `smbclient "${safeShare}" -U "${safeUser}" -t 10 -c '${listCmd}'`
        : `smbclient "${safeShare}" -N -t 10 -c '${listCmd}'`;

    return new Promise((resolve, reject) => {
        exec(cmd, { env, timeout: 15000 }, (err, stdout, stderr) => {
            if (err) {
                const errMsg = (stderr || stdout || err.message || '').trim();
                return reject(new Error(`Failed to browse SMB files: ${errMsg}`));
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
                    const itemRelPath = internalSub ? `${internalSub}/${name}` : name;
                    const fullItemPath = `\\\\${host}\\${shareName}\\${itemRelPath.replace(/\//g, '\\')}`;

                    files.push({
                        name,
                        isDirectory: isDir,
                        size: isDir ? 0 : size,
                        modified: new Date(dateStr) || new Date(),
                        path: fullItemPath
                    });
                }
            }
            resolve(files);
        });
    });
};

const getRootListing = async (req) => {
    if (process.platform === 'win32') {
        const drives = await getWindowsDrives();
        const driveItems = drives.map(d => ({
            name: d + '\\',
            isDirectory: true,
            size: 0,
            modified: new Date(),
            path: d + '\\'
        }));
        
        try {
            const sharesRes = await db.query('SELECT label, path, type FROM network_shares');
            sharesRes.rows.forEach(row => {
                driveItems.push({
                    name: `[${row.type || 'Share'}] ${row.label}`,
                    isDirectory: true,
                    size: 0,
                    modified: new Date(),
                    path: row.path
                });
            });
        } catch (e) {}
        return driveItems;
    } else {
        const rootItems = [];
        
        // 1. Local Storage base path
        rootItems.push({
            name: 'Local Storage',
            isDirectory: true,
            size: 0,
            modified: new Date(),
            path: storageProvider.localBase
        });

        // 2. Query all Mounted & Cloud Network Shares
        try {
            const sharesRes = await db.query('SELECT label, path, type FROM network_shares');
            sharesRes.rows.forEach(row => {
                rootItems.push({
                    name: `[${row.type || 'Share'}] ${row.label}`,
                    isDirectory: true,
                    size: 0,
                    modified: new Date(),
                    path: row.path
                });
            });
        } catch (dbErr) {
            logger.error(`[Files Routes] Failed to fetch network shares for root listing: ${dbErr.message}`);
        }

        return rootItems;
    }
};

// ── GET /api/v1/files/list ───────────────────────────────────────────────────
router.get('/list', async (req, res) => {
    const { path: targetPath, agentId } = req.query;

    // Direct SMB / CIFS Network Share Bridge
    const isSmb = targetPath && (targetPath.startsWith('\\\\') || targetPath.startsWith('//') || targetPath.startsWith('smb://'));
    if (isSmb) {
        try {
            const sharesRes = await db.query('SELECT * FROM network_shares');
            let cleanTarget = targetPath.replace(/\\/g, '/').replace(/^(smb:)?\/+/, '');
            const targetParts = cleanTarget.split('/');
            const targetHost = targetParts[0];
            const targetShareName = targetParts[1] || '';

            if (!targetShareName) {
                const hostShares = sharesRes.rows.filter(row => {
                    let cleanRow = (row.path || '').replace(/\\/g, '/').replace(/^(smb:)?\/+/, '');
                    const rowParts = cleanRow.split('/');
                    return rowParts[0]?.toLowerCase() === targetHost.toLowerCase();
                });

                if (hostShares.length > 0) {
                    const shareItems = hostShares.map(s => ({
                        name: s.label || s.path.split(/[\\/]/).pop(),
                        isDirectory: true,
                        size: 0,
                        modified: new Date(),
                        path: s.path
                    }));
                    return res.json(shareItems);
                }
            }

            const matchedShare = sharesRes.rows.find(row => {
                let cleanRow = (row.path || '').replace(/\\/g, '/').replace(/^(smb:)?\/+/, '');
                const rowParts = cleanRow.split('/');
                return rowParts[0]?.toLowerCase() === targetHost.toLowerCase() && 
                       (rowParts[1] || '').toLowerCase() === targetShareName.toLowerCase();
            });

            const user = matchedShare?.username || '';
            let pass = '';
            if (matchedShare?.password) {
                try { pass = cryptoHelper.decrypt(matchedShare.password); } catch (e) { pass = matchedShare.password; }
            }

            const subPath = targetParts.slice(2).join('/');
            const files = await listSmbFiles(targetPath, subPath, user, pass);
            return res.json(files);
        } catch (smbErr) {
            logger.warn(`[Files Routes] SMB listing error for ${targetPath}: ${smbErr.message}`);
            return res.status(500).json({ error: `Failed to list SMB share: ${smbErr.message}` });
        }

    }

    // Remote Cluster Site Mesh Filesystem Bridge
    if (targetPath && (targetPath.startsWith('/sitemesh/') || targetPath.startsWith('sitemesh/'))) {
        const clean = targetPath.replace(/^[\\\/]*sitemesh[\\\/]*/, '');
        const parts = clean.split(/[\\\/]/).filter(Boolean);
        const siteId = parts[0];
        const subPath = '/' + parts.slice(1).join('/');
        const siteMeshService = require('../services/siteMeshService');
        try {
            const remoteData = await siteMeshService.getRemoteSiteFiles(siteId, subPath);
            const formatted = remoteData.items.map(item => {
                const isDir = item.type === 'directory' || item.isDirectory || item.isPool;
                const fullItemPath = `/sitemesh/${siteId}${remoteData.currentPath === '/' ? '' : remoteData.currentPath}/${item.name}`;
                return {
                    name: item.name,
                    isDirectory: isDir,
                    size: item.size || 0,
                    modified: item.modified || new Date(),
                    path: fullItemPath,
                    fsType: item.fsType,
                    isPool: item.isPool,
                    extension: isDir ? '' : (path.extname(item.name).replace('.', '') || 'dat')
                };
            });
            return res.json(formatted);
        } catch (sErr) {
            return res.status(502).json({ error: `Remote site storage error: ${sErr.message}` });
        }
    }

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
            const rootItems = await getRootListing(req);
            return res.json(rootItems);
        } catch (rootErr) {
            logger.error(`[Files Routes] Root listing failed: ${rootErr.message}`);
            return res.status(500).json({ error: rootErr.message });
        }
    }

    try {
        let resolvedRaw = '';
        try {
            resolvedRaw = resolveFilePath(req, targetPath || '');
        } catch (e) {}

        const locker = await vaultService.getLockerForPath(resolvedRaw);
        if (locker) {
            if (!vaultService.hasKeys(locker.id)) {
                return res.status(403).json({ error: 'Vault is locked', lockerId: locker.id });
            }
            
            const keys = vaultService.getKeys(locker.id);
            const physicalPath = await vaultService.resolveVaultPath(req, targetPath || '');
            let files;
            try {
                files = await storageProvider.readdir(physicalPath);
            } catch (readErr) {
                if (readErr.code === 'ENOENT') {
                    return res.json([]);
                }
                throw readErr;
            }
            
            const decryptedFiles = files.map(f => {
                const decName = vaultService.decryptFilename(f.name, keys.filenameKey);
                const isDir = f.isDirectory;
                return {
                    name: decName,
                    isDirectory: isDir,
                    size: isDir ? 0 : (f.size > 16 ? f.size - 16 : 0),
                    modified: f.modified,
                    path: path.join(targetPath || '', decName),
                    isVault: false,
                    isLocked: false
                };
            });
            return res.json(decryptedFiles);
        }

        // Standard directory listing with vault detection
        const userLockersRes = await db.query('SELECT id, vault_path FROM lockers WHERE user_id = $1', [req.user.id]);
        const userLockers = userLockersRes.rows;

        let files;
        try {
            files = await storageProvider.readdir(targetPath || '');
        } catch (readErr) {
            if (readErr.code === 'ENOENT') {
                return res.json([]);
            }
            throw readErr;
        }


        const mappedFiles = files.map(f => {
            const fVirtualPath = path.join(targetPath || '', f.name);
            let resolvedF = '';
            try { resolvedF = resolveFilePath(req, fVirtualPath); } catch (e) {}
            
            const matchingLocker = userLockers.find(l => path.normalize(l.vault_path).toLowerCase() === path.normalize(resolvedF).toLowerCase());
            const isVault = !!matchingLocker || f.name.endsWith('.ndv');
            const isLocked = matchingLocker ? !vaultService.hasKeys(matchingLocker.id) : false;
            
            return {
                ...f,
                path: fVirtualPath,
                isVault,
                isLocked,
                lockerId: matchingLocker ? matchingLocker.id : null
            };
        });
        res.json(mappedFiles);
    } catch (err) {
        logger.error(`[Files Routes] List failed: ${err.message}`);
        if (err.statusCode === 403) {
            res.status(403).json({ error: err.message, lockerId: err.lockerId });
        } else if (err.code === 'EACCES' || err.code === 'EPERM') {
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

    const isSmb = targetPath.startsWith('\\\\') || targetPath.startsWith('//') || targetPath.startsWith('smb://');
    if (isSmb) {
        const fileName = path.basename(targetPath.replace(/\\/g, '/'));
        return res.json({
            name: fileName,
            path: targetPath,
            size: 0,
            isDirectory: false,
            modified: new Date(),
            isVault: false,
            isLocked: false,
            lockerId: null,
            isSmb: true
        });
    }

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
        const resolved = await vaultService.resolveVaultPath(req, targetPath);
        const stats = await storageProvider.stat(resolved);
        const isDir = stats.isDirectory;
        
        const locker = await vaultService.getLockerForPath(resolved);
        res.json({
            name: path.basename(targetPath),
            path: targetPath,
            size: isDir ? 0 : (stats.size > 16 ? stats.size - 16 : 0),
            isDirectory: isDir,
            modified: stats.modified,
            isVault: targetPath.endsWith('.ndv') || !!locker,
            isLocked: locker ? !vaultService.hasKeys(locker.id) : false,
            lockerId: locker ? locker.id : null
        });
    } catch (err) {
        if (err.statusCode === 403) {
            res.status(403).json({ error: err.message, lockerId: err.lockerId });
        } else {
            res.status(500).json({ error: err.message });
        }
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
        const resolved = await vaultService.resolveVaultPath(req, folder);
        await storageProvider.mkdir(resolved);
        res.json({ message: 'Directory created successfully' });
    } catch (err) {
        if (err.statusCode === 403) {
            res.status(403).json({ error: err.message, lockerId: err.lockerId });
        } else {
            res.status(500).json({ error: err.message });
        }
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
        const resolvedOld = await vaultService.resolveVaultPath(req, oldPath);
        const locker = await vaultService.getLockerForPath(resolvedOld);
        let resolvedNew = '';
        if (locker) {
            const keys = vaultService.getKeys(locker.id);
            const parentVirtual = path.dirname(oldPath);
            const newVirtual = path.join(parentVirtual, newName);
            resolvedNew = await vaultService.resolveVaultPath(req, newVirtual);
        } else {
            const resolvedOldRaw = resolveFilePath(req, oldPath);
            resolvedNew = path.join(path.dirname(resolvedOldRaw), newName);
        }
        await fs.promises.rename(resolvedOld, resolvedNew);
        clearDirSizeCache();
        res.json({ message: 'Renamed successfully' });
    } catch (err) {
        if (err.statusCode === 403) {
            res.status(403).json({ error: err.message, lockerId: err.lockerId });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
});

// Helper to stream file with transparent encryption/decryption based on source and destination lockers
const transferLockerStream = (srcPhys, destPhys, srcLocker, destLocker, opId = null) => {
    return new Promise((resolve, reject) => {
        try {
            const srcKeys = srcLocker ? vaultService.getKeys(srcLocker.id) : null;
            const destKeys = destLocker ? vaultService.getKeys(destLocker.id) : null;

            const readStream = fs.createReadStream(srcPhys);
            const writeStream = fs.createWriteStream(destPhys);

            if (opId && activeOps[opId]) {
                readStream.on('data', (chunk) => {
                    if (activeOps[opId]) {
                        activeOps[opId].bytesTransferred = (activeOps[opId].bytesTransferred || 0) + chunk.length;
                        if (activeOps[opId].totalBytes > 0) {
                            activeOps[opId].progress = Math.min(99, Math.round((activeOps[opId].bytesTransferred / activeOps[opId].totalBytes) * 100));
                        }
                    }
                });
            }

            let stream = readStream;

            // 1. Decrypt if coming from a vault
            if (srcLocker && srcKeys) {
                const decryptor = new vaultService.DecryptTransform(srcKeys.fileKey, srcLocker.encryption_algorithm);
                stream = stream.pipe(decryptor);
            }

            // 2. Encrypt if going into a vault
            if (destLocker && destKeys) {
                const encryptor = new vaultService.EncryptTransform(destKeys.fileKey, destLocker.encryption_algorithm);
                stream = stream.pipe(encryptor);
            }

            stream.pipe(writeStream);

            writeStream.on('finish', () => resolve());
            readStream.on('error', (err) => reject(err));
            writeStream.on('error', (err) => reject(err));
            stream.on('error', (err) => reject(err));
        } catch (err) {
            reject(err);
        }
    });
};

// Helper to copy a file or folder recursively with locker-aware transformation
const transferLockerRecursive = async (srcPhys, destPhys, srcLocker, destLocker, opId = null) => {
    const stats = await fs.promises.stat(srcPhys);
    
    if (stats.isDirectory()) {
        await fs.promises.mkdir(destPhys, { recursive: true });
        const files = await fs.promises.readdir(srcPhys);
        
        const srcKeys = srcLocker ? vaultService.getKeys(srcLocker.id) : null;
        const destKeys = destLocker ? vaultService.getKeys(destLocker.id) : null;

        for (const file of files) {
            const childSrc = path.join(srcPhys, file);
            
            // Decrypt filename if source is a vault
            const virtualName = srcLocker && srcKeys ? vaultService.decryptFilename(file, srcKeys.filenameKey) : file;
            // Encrypt filename if destination is a vault
            const destName = destLocker && destKeys ? vaultService.encryptFilename(virtualName, destKeys.filenameKey) : virtualName;
            
            const childDest = path.join(destPhys, destName);
            await transferLockerRecursive(childSrc, childDest, srcLocker, destLocker, opId);
        }
    } else {
        // Enforce locker space limits if transferring into a vault
        if (destLocker) {
            if (!vaultService.checkSpaceLimit(destLocker, stats.size)) {
                throw new Error(`Upload blocked: Locker space limit exceeded for '${destLocker.name}'.`);
            }
        }
        await transferLockerStream(srcPhys, destPhys, srcLocker, destLocker, opId);
    }
};

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

    const isSrcSmb = srcPath && (srcPath.startsWith('\\\\') || srcPath.startsWith('//') || srcPath.startsWith('smb://'));
    const isDestSmb = destPath && (destPath.startsWith('\\\\') || destPath.startsWith('//') || destPath.startsWith('smb://'));
    if (isSrcSmb || isDestSmb) {
        try {
            if (isSrcSmb && isDestSmb) {
                await smbRenameOrMove(srcPath, destPath);
            } else {
                await smbCopyFile(srcPath, destPath);
                if (isSrcSmb) await deleteSmbFile(srcPath);
                else {
                    const resolvedSrc = storageProvider.resolvePath(srcPath);
                    if (fs.existsSync(resolvedSrc)) fs.unlinkSync(resolvedSrc);
                }
            }
            clearDirSizeCache();
            return res.json({ message: 'Moved successfully', status: 'Completed' });
        } catch (smbMoveErr) {
            return res.status(500).json({ error: smbMoveErr.message });
        }
    }

    try {
        const absoluteSrc = storageProvider.resolvePath(srcPath);
        const targetVirtual = path.join(destPath, path.basename(srcPath));
        const absoluteDest = storageProvider.resolvePath(targetVirtual);

        
        const srcLocker = await vaultService.getLockerForPath(absoluteSrc);
        const destLocker = await vaultService.getLockerForPath(absoluteDest);

        const srcKeys = srcLocker ? vaultService.getKeys(srcLocker.id) : null;
        const destKeys = destLocker ? vaultService.getKeys(destLocker.id) : null;

        if (srcLocker && !srcKeys) {
            return res.status(403).json({ error: 'Vault is locked', lockerId: srcLocker.id });
        }
        if (destLocker && !destKeys) {
            return res.status(403).json({ error: 'Vault is locked', lockerId: destLocker.id });
        }

        const resolvedSrc = await vaultService.resolveVaultPath(req, srcPath);
        const resolvedDest = await vaultService.resolveVaultPath(req, targetVirtual);
        
        const destDir = path.dirname(resolvedDest);
        if (!fs.existsSync(destDir)) {
            await fs.promises.mkdir(destDir, { recursive: true });
        }

        const totalBytes = await getPhysicalSizeRecursive(resolvedSrc);
        const opId = `move_${Date.now()}`;
        
        activeOps[opId] = {
            id: opId,
            name: path.basename(srcPath),
            type: 'move',
            progress: 0,
            status: 'In Progress',
            bytesTransferred: 0,
            totalBytes,
            startTime: Date.now()
        };

        res.json({ opId, status: 'In Progress', totalBytes });

        setImmediate(async () => {
            try {
                // Optimize: if moving within the same locker (or both outside), use fast rename
                if ((!srcLocker && !destLocker) || (srcLocker && destLocker && srcLocker.id === destLocker.id)) {
                    try {
                        await fs.promises.rename(resolvedSrc, resolvedDest);
                        activeOps[opId].bytesTransferred = totalBytes;
                        activeOps[opId].progress = 100;
                    } catch (renameErr) {
                        if (renameErr.code === 'EXDEV') {
                            await transferLockerRecursive(resolvedSrc, resolvedDest, srcLocker, destLocker, opId);
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
                } else {
                    // Streaming copy with encryption/decryption, then unlink
                    await transferLockerRecursive(resolvedSrc, resolvedDest, srcLocker, destLocker, opId);
                    const stats = await fs.promises.stat(resolvedSrc);
                    if (stats.isDirectory()) {
                        await fs.promises.rm(resolvedSrc, { recursive: true, force: true });
                    } else {
                        await fs.promises.unlink(resolvedSrc);
                    }
                }

                clearDirSizeCache();
                activeOps[opId].status = 'Completed';
                activeOps[opId].progress = 100;
                activeOps[opId].bytesTransferred = totalBytes;
                setTimeout(() => delete activeOps[opId], 60000);
            } catch (err) {
                logger.error(`[Move Operation] Async move failed: ${err.message}`);
                activeOps[opId].status = 'Failed';
                activeOps[opId].error = err.message;
                setTimeout(() => delete activeOps[opId], 60000);
            }
        });

    } catch (err) {
        if (err.statusCode === 403) {
            res.status(403).json({ error: err.message, lockerId: err.lockerId });
        } else {
            res.status(500).json({ error: err.message });
        }
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

    const isSrcSmb = srcPath && (srcPath.startsWith('\\\\') || srcPath.startsWith('//') || srcPath.startsWith('smb://'));
    const isDestSmb = destPath && (destPath.startsWith('\\\\') || destPath.startsWith('//') || destPath.startsWith('smb://'));
    if (isSrcSmb || isDestSmb) {
        try {
            await smbCopyFile(srcPath, destPath);
            clearDirSizeCache();
            return res.json({ message: 'Copied successfully', status: 'Completed' });
        } catch (smbCopyErr) {
            return res.status(500).json({ error: smbCopyErr.message });
        }
    }

    try {
        const absoluteSrc = storageProvider.resolvePath(srcPath);
        const targetVirtual = path.join(destPath, path.basename(srcPath));
        const absoluteDest = storageProvider.resolvePath(targetVirtual);

        
        const srcLocker = await vaultService.getLockerForPath(absoluteSrc);
        const destLocker = await vaultService.getLockerForPath(absoluteDest);

        const srcKeys = srcLocker ? vaultService.getKeys(srcLocker.id) : null;
        const destKeys = destLocker ? vaultService.getKeys(destLocker.id) : null;

        if (srcLocker && !srcKeys) {
            return res.status(403).json({ error: 'Vault is locked', lockerId: srcLocker.id });
        }
        if (destLocker && !destKeys) {
            return res.status(403).json({ error: 'Vault is locked', lockerId: destLocker.id });
        }

        const resolvedSrc = await vaultService.resolveVaultPath(req, srcPath);
        const resolvedDest = await vaultService.resolveVaultPath(req, targetVirtual);
        
        const destDir = path.dirname(resolvedDest);
        if (!fs.existsSync(destDir)) {
            await fs.promises.mkdir(destDir, { recursive: true });
        }

        const totalBytes = await getPhysicalSizeRecursive(resolvedSrc);
        const opId = `copy_${Date.now()}`;
        
        activeOps[opId] = {
            id: opId,
            name: path.basename(srcPath),
            type: 'copy',
            progress: 0,
            status: 'In Progress',
            bytesTransferred: 0,
            totalBytes,
            startTime: Date.now()
        };

        res.json({ opId, status: 'In Progress', totalBytes });

        setImmediate(async () => {
            try {
                await transferLockerRecursive(resolvedSrc, resolvedDest, srcLocker, destLocker, opId);
                clearDirSizeCache();
                activeOps[opId].status = 'Completed';
                activeOps[opId].progress = 100;
                activeOps[opId].bytesTransferred = totalBytes;
                setTimeout(() => delete activeOps[opId], 60000);
            } catch (err) {
                logger.error(`[Copy Operation] Async copy failed: ${err.message}`);
                activeOps[opId].status = 'Failed';
                activeOps[opId].error = err.message;
                setTimeout(() => delete activeOps[opId], 60000);
            }
        });

    } catch (err) {
        if (err.statusCode === 403) {
            res.status(403).json({ error: err.message, lockerId: err.lockerId });
        } else {
            res.status(500).json({ error: err.message });
        }
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
        const resolvedPath = await vaultService.resolveVaultPath(req, targetPath);
        const locker = await vaultService.getLockerForPath(resolvedPath);
        if (locker) {
            const keys = vaultService.getKeys(locker.id);
            const fileBuffer = Buffer.from(content || '', 'utf8');
            if (!vaultService.checkSpaceLimit(locker, fileBuffer.length)) {
                return res.status(400).json({ error: 'Vault space limit exceeded.' });
            }
            const encryptedData = vaultService.encryptBuffer(fileBuffer, keys.fileKey, locker.encryption_algorithm);
            fs.writeFileSync(resolvedPath, encryptedData);
        } else {
            fs.writeFileSync(resolvedPath, content || '', 'utf8');
        }
        res.json({ message: 'Saved successfully' });
    } catch (err) {
        if (err.statusCode === 403) {
            res.status(403).json({ error: err.message, lockerId: err.lockerId });
        } else {
            res.status(500).json({ error: err.message });
        }
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
        const resolvedPath = await vaultService.resolveVaultPath(req, targetPath);
        if (!fs.existsSync(resolvedPath)) {
            return res.status(404).json({ error: 'File not found' });
        }
        const date = new Date(mtime);
        fs.utimesSync(resolvedPath, date, date);
        res.json({ message: 'Timestamps updated successfully' });
    } catch (err) {
        if (err.statusCode === 403) {
            res.status(403).json({ error: err.message, lockerId: err.lockerId });
        } else {
            res.status(500).json({ error: err.message });
        }
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
            await notificationService.dispatchAlert(
                'file_upload',
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
        const resolvedBase = await vaultService.resolveVaultPath(req, baseFolder);
        await storageProvider.mkdir(resolvedBase);

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
                const finalDest = path.join(baseFolder, file.originalname);
                const destPath = await vaultService.resolveVaultPath(req, finalDest);
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
                    const locker = await vaultService.getLockerForPath(resolvedBase);
                    if (locker) {
                        const keys = vaultService.getKeys(locker.id);
                        if (!vaultService.checkSpaceLimit(locker, file.size)) {
                            throw new Error(`Upload blocked: Locker space limit exceeded for '${locker.name}'.`);
                        }
                        const encryptStream = new vaultService.EncryptTransform(keys.fileKey, locker.encryption_algorithm);
                        const physicalDest = await vaultService.resolveVaultPath(req, finalDest);
                        
                        // Ensure physical destination directory exists
                        fs.mkdirSync(path.dirname(physicalDest), { recursive: true });
                        
                        const fileStream = fs.createReadStream(file.path).pipe(encryptStream);
                        await storageProvider.writeStream(physicalDest, fileStream, file.mimetype);
                    } else {
                        await storageProvider.writeStream(finalDest, fs.createReadStream(file.path), file.mimetype);
                    }
                    try { fs.unlinkSync(file.path); } catch (e) {}
                    


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
            await notificationService.dispatchAlert(
                'file_upload',
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
                const locker = await vaultService.getLockerForPath(resolveFilePath(req, p));
                if (locker) {
                    const keys = vaultService.getKeys(locker.id);
                    const resolved = await vaultService.resolveVaultPath(req, p);
                    if (fs.existsSync(resolved)) {
                        const stats = fs.statSync(resolved);
                        if (stats.isDirectory()) {
                            await addDecryptedFolderToZip(zip, p, resolved, locker, keys, '');
                        } else {
                            const decryptedContent = vaultService.decryptBuffer(fs.readFileSync(resolved), keys.fileKey, locker.encryption_algorithm);
                            zip.addFile(path.basename(p), decryptedContent);
                        }
                    }
                } else {
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

    if (filePath.startsWith('/sitemesh/')) {
        const filename = path.basename(filePath);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/octet-stream');
        const dummyContent = Buffer.from(`-- NexaDisk Global Storage Mesh Remote File Export --\nSite Resource: ${filePath}\nExport Date: ${new Date().toISOString()}\nData Integrity Signature: ${crypto.createHash('sha256').update(filePath).digest('hex')}\n`);
        return res.send(dummyContent);
    }

    const isSmb = filePath.startsWith('\\\\') || filePath.startsWith('//') || filePath.startsWith('smb://');
    if (isSmb) {
        try {
            const sharesRes = await db.query('SELECT * FROM network_shares');
            let clean = filePath.trim().replace(/\\/g, '/').replace(/^(smb:)?\/+/, '');
            const parts = clean.split('/');
            const host = parts[0];
            const shareName = parts[1] || '';
            const uncShare = `//${host}/${shareName}`;
            const internalFile = parts.slice(2).join('/');

            const matchedShare = sharesRes.rows.find(row => {
                let cleanRow = (row.path || '').replace(/\\/g, '/').replace(/^(smb:)?\/+/, '');
                const rowParts = cleanRow.split('/');
                return rowParts[0]?.toLowerCase() === host.toLowerCase() && 
                       (rowParts[1] || '').toLowerCase() === shareName.toLowerCase();
            });

            const user = matchedShare?.username || '';
            let pass = '';
            if (matchedShare?.password) {
                try { pass = cryptoHelper.decrypt(matchedShare.password); } catch (e) { pass = matchedShare.password; }
            }

            const fileName = path.basename(filePath.replace(/\\/g, '/'));
            res.setHeader('Content-Disposition', req.query.intent === 'stream' ? 'inline' : `attachment; filename="${fileName}"`);
            res.setHeader('Content-Type', 'application/octet-stream');

            const env = { ...process.env, PASSWD: pass || '' };
            const safeUser = (user || '').replace(/[;&|`$<>\\"']/g, '');
            const safeShare = uncShare.replace(/[;&|`$<>\\"']/g, '');
            const smbCmd = `get "${internalFile.replace(/"/g, '')}" -`;

            const spawn = require('child_process').spawn;
            const args = safeUser
                ? ['-U', safeUser, safeShare, '-t', '20', '-c', smbCmd]
                : ['-N', safeShare, '-t', '20', '-c', smbCmd];

            const proc = spawn('smbclient', args, { env });
            proc.stdout.pipe(res);
            proc.stderr.on('data', (d) => logger.warn(`[SMB Download] ${d.toString()}`));
            return;
        } catch (smbErr) {
            return res.status(500).json({ error: `SMB download error: ${smbErr.message}` });
        }
    }


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
        const resolved = await vaultService.resolveVaultPath(req, filePath);
        const locker = await vaultService.getLockerForPath(resolved);
        
        if (locker) {
            const keys = vaultService.getKeys(locker.id);
            const stats = fs.statSync(resolved);
            if (stats.isDirectory()) {
                const zip = new AdmZip();
                await addDecryptedFolderToZip(zip, filePath, resolved, locker, keys, '');
                const buffer = zip.toBuffer();
                res.set({
                    'Content-Type': 'application/zip',
                    'Content-Disposition': `attachment; filename="${path.basename(filePath)}.zip"`,
                    'Content-Length': buffer.length
                });
                
                notificationService.sendInAppAlert(
                    'Folder Downloaded (ZIP) 📥',
                    `Folder: ${path.basename(filePath)}\nSize: ${(buffer.length / (1024 * 1024)).toFixed(2)} MB`,
                    'info'
                );
                return res.send(buffer);
            }
            
            // Decrypt stream file download
            const virtualSize = stats.size > 16 ? stats.size - 16 : 0;
            res.set({
                'Content-Type': 'application/octet-stream',
                'Content-Disposition': `attachment; filename="${path.basename(filePath)}"`,
                'Content-Length': virtualSize
            });
            
            if (req.query.intent !== 'stream') {
                notificationService.sendInAppAlert(
                    'File Downloaded 📥',
                    `File: ${path.basename(filePath)}\nSize: ${(virtualSize / (1024 * 1024)).toFixed(2)} MB`,
                    'info'
                );
            }
            
            const decryptStream = new vaultService.DecryptTransform(keys.fileKey, locker.encryption_algorithm);
            fs.createReadStream(resolved).pipe(decryptStream).pipe(res);
            return;
        }

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

        if (req.query.intent === 'stream') {
            res.setHeader('Content-Disposition', 'inline');
            return res.sendFile(path.resolve(resolved));
        }

        res.download(resolved);
    } catch (err) {
        if (err.statusCode === 403) {
            res.status(403).json({ error: err.message, lockerId: err.lockerId });
        } else {
            res.status(500).json({ error: err.message });
        }
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
            const locker = await vaultService.getLockerForPath(resolveFilePath(req, p));
            if (locker) {
                const keys = vaultService.getKeys(locker.id);
                const resolved = await vaultService.resolveVaultPath(req, p);
                if (fs.existsSync(resolved)) {
                    const stats = fs.statSync(resolved);
                    if (stats.isDirectory()) {
                        await addDecryptedFolderToZip(zip, p, resolved, locker, keys, '');
                    } else {
                        const decryptedContent = vaultService.decryptBuffer(fs.readFileSync(resolved), keys.fileKey, locker.encryption_algorithm);
                        zip.addFile(path.basename(p), decryptedContent);
                    }
                }
            } else {
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
        }
        const buffer = zip.toBuffer();
        res.set({
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename="Selection-${Date.now()}.zip"`,
            'Content-Length': buffer.length
        });
        res.send(buffer);
    } catch (err) {
        if (err.statusCode === 403) {
            res.status(403).json({ error: err.message, lockerId: err.lockerId });
        } else {
            res.status(500).json({ error: err.message });
        }
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
        const resolvedPaths = await Promise.all(paths.map(p => vaultService.resolveVaultPath(req, p)));
        const firstVirtualParent = path.dirname(paths[0]);
        const targetVirtual = path.join(firstVirtualParent, safeName);
        const destZip = await vaultService.resolveVaultPath(req, targetVirtual);

        const zip = new AdmZip();
        for (let i = 0; i < resolvedPaths.length; i++) {
            const p = resolvedPaths[i];
            const virtualP = paths[i];
            if (fs.existsSync(p)) {
                const stats = fs.statSync(p);
                const locker = await vaultService.getLockerForPath(p);
                
                if (stats.isDirectory()) {
                    if (locker) {
                        const keys = vaultService.getKeys(locker.id);
                        await addDecryptedFolderToZip(zip, virtualP, p, locker, keys, '');
                    } else {
                        zip.addLocalFolder(p, path.basename(p));
                    }
                } else {
                    if (locker) {
                        const keys = vaultService.getKeys(locker.id);
                        const decryptedContent = vaultService.decryptBuffer(fs.readFileSync(p), keys.fileKey, locker.encryption_algorithm);
                        zip.addFile(path.basename(virtualP), decryptedContent);
                    } else {
                        zip.addLocalFile(p);
                    }
                }
            }
        }

        const buffer = zip.toBuffer();
        const destLocker = await vaultService.getLockerForPath(destZip);
        if (destLocker) {
            const keys = vaultService.getKeys(destLocker.id);
            if (!vaultService.checkSpaceLimit(destLocker, buffer.length)) {
                return res.status(400).json({ error: 'Vault space limit exceeded.' });
            }
            const encryptedData = vaultService.encryptBuffer(buffer, keys.fileKey, destLocker.encryption_algorithm);
            fs.writeFileSync(destZip, encryptedData);
        } else {
            fs.writeFileSync(destZip, buffer);
        }

        res.json({ message: 'Compressed successfully' });
    } catch (err) {
        if (err.statusCode === 403) {
            res.status(403).json({ error: err.message, lockerId: err.lockerId });
        } else {
            res.status(500).json({ error: err.message });
        }
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
        const resolvedArchive = await vaultService.resolveVaultPath(req, archivePath);
        if (!fs.existsSync(resolvedArchive)) {
            return res.status(404).json({ error: 'Archive not found' });
        }

        const resolvedTarget = targetDir ? await vaultService.resolveVaultPath(req, targetDir) : path.dirname(resolvedArchive);
        fs.mkdirSync(resolvedTarget, { recursive: true });

        const ext = path.extname(resolvedArchive).toLowerCase();
        
        if (ext === '.zip') {
            let archiveData = fs.readFileSync(resolvedArchive);
            const lockerArchive = await vaultService.getLockerForPath(resolvedArchive);
            if (lockerArchive) {
                const keys = vaultService.getKeys(lockerArchive.id);
                archiveData = vaultService.decryptBuffer(archiveData, keys.fileKey, lockerArchive.encryption_algorithm);
            }
            
            const zip = new AdmZip(archiveData);
            const zipEntries = zip.getEntries();
            
            const lockerTarget = await vaultService.getLockerForPath(resolvedTarget);
            if (lockerTarget) {
                const keys = vaultService.getKeys(lockerTarget.id);
                for (const entry of zipEntries) {
                    if (entry.isDirectory) continue;
                    const virtualChildPath = path.join(targetDir || path.dirname(archivePath), entry.entryName);
                    const physicalChildPath = await vaultService.resolveVaultPath(req, virtualChildPath);
                    
                    fs.mkdirSync(path.dirname(physicalChildPath), { recursive: true });
                    const fileBytes = entry.getData();
                    const encryptedBytes = vaultService.encryptBuffer(fileBytes, keys.fileKey, lockerTarget.encryption_algorithm);
                    fs.writeFileSync(physicalChildPath, encryptedBytes);
                }
                res.json({ message: 'Extracted successfully' });
            } else {
                zip.extractAllTo(resolvedTarget, true);
                res.json({ message: 'Extracted successfully' });
            }
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
        if (err.statusCode === 403) {
            res.status(403).json({ error: err.message, lockerId: err.lockerId });
        } else {
            res.status(500).json({ error: err.message });
        }
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
        const resolved = await vaultService.resolveVaultPath(req, dirPath);
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

// ── POST /api/v1/files/storage/tree (Interactive Disk Treemap & Heatmap Scanner) ──
router.post('/storage/tree', async (req, res) => {
    try {
        const reqPath = req.body.path || '';
        let physPath;
        if (reqPath && (path.isAbsolute(reqPath) || /^[a-zA-Z]:/i.test(reqPath))) {
            physPath = reqPath;
            if (/^[a-zA-Z]:$/i.test(physPath)) physPath += path.sep;
        } else {
            physPath = storageProvider.resolvePath(reqPath);
        }

        if (!fs.existsSync(physPath)) return res.status(404).json({ error: `Path not found: ${reqPath || 'storage root'}` });

        const topFiles = [];
        const typeCategories = {
            video: 0,
            image: 0,
            audio: 0,
            archive: 0,
            code: 0,
            document: 0,
            other: 0
        };

        const categorize = (ext) => {
            if (['mp4', 'mkv', 'avi', 'mov', 'webm', 'wmv'].includes(ext)) return 'video';
            if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)) return 'image';
            if (['mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg'].includes(ext)) return 'audio';
            if (['zip', 'rar', 'tar', 'gz', '7z', 'iso', 'bz2'].includes(ext)) return 'archive';
            if (['js', 'ts', 'jsx', 'tsx', 'py', 'json', 'html', 'css', 'sql', 'sh', 'php', 'c', 'cpp', 'rs', 'go'].includes(ext)) return 'code';
            if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'md'].includes(ext)) return 'document';
            return 'other';
        };

        const scanTree = (dir, depth = 0) => {
            let totalDirSize = 0;
            let fileCount = 0;
            const children = [];

            try {
                const entries = fs.readdirSync(dir, { withFileTypes: true });
                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name);
                    const lower = entry.name.toLowerCase();
                    if (['$recycle.bin', 'system volume information', 'node_modules', '.git'].includes(lower)) continue;

                    if (entry.isDirectory()) {
                        if (depth < 3) {
                            const sub = scanTree(fullPath, depth + 1);
                            totalDirSize += sub.size;
                            fileCount += sub.fileCount;
                            children.push({
                                name: entry.name,
                                path: fullPath,
                                isDirectory: true,
                                size: sub.size,
                                fileCount: sub.fileCount,
                                children: depth < 2 ? sub.children : []
                            });
                        } else {
                            try {
                                const st = fs.statSync(fullPath);
                                totalDirSize += st.size || 4096;
                            } catch (_) {}
                        }
                    } else {
                        try {
                            const st = fs.statSync(fullPath);
                            const size = st.size;
                            totalDirSize += size;
                            fileCount += 1;
                            const ext = entry.name.split('.').pop().toLowerCase();
                            const category = categorize(ext);
                            typeCategories[category] += size;

                            topFiles.push({
                                name: entry.name,
                                path: fullPath,
                                size,
                                category,
                                mtime: st.mtime
                            });

                            if (depth <= 2) {
                                children.push({
                                    name: entry.name,
                                    path: fullPath,
                                    isDirectory: false,
                                    size,
                                    category,
                                    mtime: st.mtime
                                });
                            }
                        } catch (_) {}
                    }
                }
            } catch (_) {}

            return {
                size: totalDirSize,
                fileCount,
                children: children.sort((a, b) => b.size - a.size)
            };
        };

        const tree = scanTree(physPath, 0);
        topFiles.sort((a, b) => b.size - a.size);

        res.json({
            path: reqPath,
            name: path.basename(physPath) || physPath || 'Root Storage',
            totalSize: tree.size,
            fileCount: tree.fileCount,
            children: tree.children,
            topLargestFiles: topFiles.slice(0, 25),
            typeCategories
        });
    } catch (err) {
        logger.error(`[Storage Tree Error]: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/v1/files/duplicates/clean ──────────────────────────────────────
router.post('/duplicates/clean', async (req, res) => {
    try {
        const { files } = req.body;
        if (!files || !Array.isArray(files) || files.length === 0) {
            return res.status(400).json({ error: 'Files array required' });
        }

        let reclaimedBytes = 0;
        let deletedCount = 0;

        for (const filePath of files) {
            try {
                const physPath = storageProvider.resolvePhysicalPath(filePath);
                if (fs.existsSync(physPath)) {
                    const st = fs.statSync(physPath);
                    reclaimedBytes += st.size;
                    fs.unlinkSync(physPath);
                    deletedCount++;
                }
            } catch (_) {}
        }

        clearDirSizeCache();

        notificationService.notify('file_delete', 'Deduplication Completed 🧹', {
            status: `Cleaned ${deletedCount} duplicate files. Reclaimed ${(reclaimedBytes / (1024 * 1024)).toFixed(2)} MB.`,
            error: 'info'
        });

        res.json({
            success: true,
            deletedCount,
            reclaimedBytes,
            message: `Successfully cleaned ${deletedCount} duplicates, freeing ${(reclaimedBytes / (1024 * 1024)).toFixed(2)} MB.`
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/v1/files/history ────────────────────────────────────────────────
router.get('/history', async (req, res) => {
    try {
        const filePath = req.query.path;
        if (!filePath) return res.status(400).json({ error: 'Path required' });

        const physPath = storageProvider.resolvePhysicalPath(filePath);
        const fileName = path.basename(filePath);
        const versions = [];

        if (fs.existsSync(physPath)) {
            const st = fs.statSync(physPath);
            versions.push({
                version: 'Current (v1.0)',
                timestamp: st.mtime,
                size: st.size,
                author: req.user?.username || 'admin',
                isCurrent: true,
                note: 'Live cluster revision'
            });
        }

        // Query tiering snapshots for previous versions
        const snapshotsPath = path.join(__dirname, '..', 'data', 'snapshots.json');
        if (fs.existsSync(snapshotsPath)) {
            try {
                const snaps = JSON.parse(fs.readFileSync(snapshotsPath, 'utf8'));
                for (const snap of snaps) {
                    if (snap.manifest && Array.isArray(snap.manifest)) {
                        const match = snap.manifest.find(m => m.name === fileName || m.path?.endsWith(fileName));
                        if (match) {
                            versions.push({
                                version: 'Snapshot ' + snap.id.slice(0, 8),
                                snapshotId: snap.id,
                                timestamp: snap.createdAt,
                                size: match.size || 0,
                                author: 'System Snapshot Tier',
                                isCurrent: false,
                                note: `Point-in-time state from volume snapshot "${snap.label || snap.id}"`
                            });
                        }
                    }
                }
            } catch (_) {}
        }

        res.json({
            path: filePath,
            fileName,
            versions
        });
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

// ── GET /api/v1/files/raw-content ──────────────────────────────────────────
router.get('/raw-content', authenticateToken, async (req, res) => {
    try {
        const reqPath = req.query.path;
        if (!reqPath) return res.status(400).json({ error: 'File path required' });

        const physPath = storageProvider.resolvePhysicalPath(reqPath);
        if (!fs.existsSync(physPath)) return res.status(404).json({ error: 'File not found on storage node' });

        const stat = fs.statSync(physPath);
        if (stat.size > 10 * 1024 * 1024) {
            return res.status(400).json({ error: 'File exceeds 10MB limit for in-browser code editor' });
        }

        const content = fs.readFileSync(physPath, 'utf8');
        res.json({
            success: true,
            path: reqPath,
            name: path.basename(reqPath),
            size: stat.size,
            mtime: stat.mtime,
            content
        });
    } catch (err) {
        logger.error(`[Files Routes] raw-content error: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/v1/files/save-content ─────────────────────────────────────────
router.post('/save-content', authenticateToken, async (req, res) => {
    try {
        const { path: reqPath, content } = req.body;
        if (!reqPath || content === undefined) return res.status(400).json({ error: 'Path and content required' });

        const physPath = storageProvider.resolvePhysicalPath(reqPath);
        if (!fs.existsSync(physPath)) return res.status(404).json({ error: 'Target file not found' });

        fs.writeFileSync(physPath, content, 'utf8');
        const stat = fs.statSync(physPath);

        notificationService.notify('file_upload', 'File Edited in Studio 📝', {
            status: `File "${path.basename(reqPath)}" updated directly via NexaStudio (${(stat.size / 1024).toFixed(1)} KB).`,
            error: 'info'
        });

        res.json({
            success: true,
            message: `Saved "${path.basename(reqPath)}" successfully`,
            size: stat.size,
            mtime: stat.mtime
        });
    } catch (err) {
        logger.error(`[Files Routes] save-content error: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/v1/files/smart-search/stream (Real-Time SSE AI Search with Live Progress) ──
router.get('/smart-search/stream', async (req, res) => {
    // Set SSE response headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    if (res.flushHeaders) res.flushHeaders();

    let aborted = false;
    req.on('close', () => {
        aborted = true;
    });

    const sendEvent = (eventData) => {
        if (aborted || res.writableEnded) return;
        res.write(`data: ${JSON.stringify(eventData)}\n\n`);
    };

    try {
        const query = req.query.query || '';
        const currentPath = req.query.currentPath || '';
        const searchScope = req.query.searchScope || 'all';
        const searchContent = req.query.searchContent !== 'false';
        const searchTags = req.query.searchTags !== 'false';

        if (!query || typeof query !== 'string' || !query.trim()) {
            sendEvent({ type: 'done', totalFound: 0, filesScanned: 0, results: [] });
            return res.end();
        }

        const q = query.trim().toLowerCase();
        const results = [];
        const seenPaths = new Set();
        let filesScanned = 0;

        // 1. Resolve search candidate root directories
        const searchRoots = [];
        if (currentPath && typeof currentPath === 'string' && currentPath.trim()) {
            let p = currentPath.trim();
            if (/^[a-zA-Z]:$/i.test(p)) p += path.sep;
            if (fs.existsSync(p)) searchRoots.push(p);
        }

        if (searchScope === 'all' || searchRoots.length === 0) {
            const defaultPaths = [
                storageProvider.localBase,
                path.resolve(__dirname, '..', '..', 'uploads'),
                'D:\\'
            ];
            for (const dp of defaultPaths) {
                if (dp && fs.existsSync(dp) && !searchRoots.includes(dp)) {
                    searchRoots.push(dp);
                }
            }
        }

        // 2. Check tag matches in database
        const matchedPathsFromTags = new Set();
        if (searchTags) {
            try {
                const tagRes = await db.query(
                    'SELECT file_path, name as tag_name, color FROM social_tags WHERE LOWER(name) LIKE $1',
                    [`%${q}%`]
                );
                for (const row of tagRes.rows) {
                    matchedPathsFromTags.add(row.file_path.toLowerCase());
                }
            } catch (_) {}
        }

        const textExtensions = new Set([
            'txt', 'md', 'json', 'csv', 'py', 'js', 'jsx', 'ts', 'tsx', 'sql', 
            'env', 'log', 'xml', 'html', 'htm', 'css', 'yml', 'yaml', 'ini', 
            'conf', 'sh', 'bat', 'cmd', 'ps1', 'c', 'cpp', 'h', 'hpp', 'rs', 
            'go', 'java', 'kt', 'php', 'rb', 'lua', 'toml', 'properties', 'pdf'
        ]);

        sendEvent({
            type: 'start',
            query,
            searchRoots,
            searchScope
        });

        // Non-blocking asynchronous recursive scanner
        const scanDirectory = async (dir, depth = 0) => {
            if (aborted || depth > 5 || results.length >= 100) return;

            // Notify client of current scanning folder
            sendEvent({
                type: 'progress',
                currentFolder: dir,
                filesScanned,
                matchesFound: results.length
            });

            try {
                const entries = await fs.promises.readdir(dir, { withFileTypes: true });
                for (const entry of entries) {
                    if (aborted || results.length >= 100) break;
                    filesScanned++;

                    // Yield event loop every 15 items to prevent thread starvation
                    if (filesScanned % 15 === 0) {
                        await new Promise(r => setImmediate(r));
                        sendEvent({
                            type: 'progress',
                            currentFolder: dir,
                            filesScanned,
                            matchesFound: results.length
                        });
                    }

                    const fullPath = path.join(dir, entry.name);
                    const lowerName = entry.name.toLowerCase();
                    const lowerFullPath = fullPath.toLowerCase();

                    if (['$recycle.bin', 'system volume information', 'node_modules', '.git', '.cache', 'appdata', 'windows'].includes(lowerName)) continue;

                    if (entry.isDirectory()) {
                        await scanDirectory(fullPath, depth + 1);
                    } else {
                        if (seenPaths.has(lowerFullPath)) continue;
                        seenPaths.add(lowerFullPath);

                        const ext = entry.name.includes('.') ? entry.name.split('.').pop().toLowerCase() : '';
                        let score = 0;
                        let matchType = 'name';
                        let snippet = '';

                        // Exact or partial filename match
                        if (lowerName === q) {
                            score = 100;
                            matchType = 'exact_name';
                        } else if (lowerName.includes(q)) {
                            score = 85;
                            matchType = 'name';
                        } else if (lowerFullPath.includes(q)) {
                            score = 70;
                            matchType = 'path';
                        }

                        // Social tag match
                        if (matchedPathsFromTags.has(lowerFullPath) || matchedPathsFromTags.has(lowerName)) {
                            score = Math.max(score, 80);
                            matchType = 'tag';
                            snippet = `Tagged metadata match for "${query}"`;
                        }

                        // In-Document Content Text Search
                        if (searchContent && textExtensions.has(ext) && score < 100) {
                            try {
                                const st = await fs.promises.stat(fullPath);
                                if (st.size < 6 * 1024 * 1024) { // Inspect files under 6MB
                                    const rawBuffer = await fs.promises.readFile(fullPath);
                                    const rawText = rawBuffer.toString('utf8');
                                    const lowerContent = rawText.toLowerCase();
                                    const matchIdx = lowerContent.indexOf(q);
                                    if (matchIdx !== -1) {
                                        score = Math.max(score, 75);
                                        matchType = 'content';
                                        const start = Math.max(0, matchIdx - 45);
                                        const end = Math.min(rawText.length, matchIdx + q.length + 45);
                                        snippet = (start > 0 ? '...' : '') + rawText.substring(start, end).replace(/[\r\n\t]+/g, ' ') + (end < rawText.length ? '...' : '');
                                    }
                                }
                            } catch (_) {}
                        }

                        if (score > 0) {
                            try {
                                const st = await fs.promises.stat(fullPath);
                                const matchItem = {
                                    name: entry.name,
                                    path: fullPath,
                                    displayPath: fullPath,
                                    size: st.size,
                                    mtime: st.mtime,
                                    ext,
                                    score,
                                    matchType,
                                    snippet: snippet || `File matching "${query}"`
                                };
                                results.push(matchItem);

                                // Stream match live to frontend!
                                sendEvent({
                                    type: 'match',
                                    match: matchItem,
                                    matchesFound: results.length
                                });
                            } catch (_) {}
                        }
                    }
                }
            } catch (_) {}
        };

        for (const root of searchRoots) {
            if (aborted) break;
            await scanDirectory(root, 0);
            if (results.length >= 100) break;
        }

        results.sort((a, b) => b.score - a.score);

        sendEvent({
            type: 'done',
            totalFound: results.length,
            filesScanned,
            results
        });
        res.end();
    } catch (err) {
        logger.error(`[Smart Search Stream Error]: ${err.message}`);
        sendEvent({ type: 'error', error: err.message });
        res.end();
    }
});

// ── POST /api/v1/files/smart-search (Fallback Batch AI Search) ───────────────
router.post('/smart-search', async (req, res) => {
    try {
        const { query, currentPath = '', searchScope = 'all', searchContent = true, searchTags = true } = req.body;
        if (!query || typeof query !== 'string' || !query.trim()) {
            return res.json({ query: '', results: [] });
        }

        const q = query.trim().toLowerCase();
        const results = [];
        const seenPaths = new Set();
        let filesScanned = 0;

        const searchRoots = [];
        if (currentPath && typeof currentPath === 'string' && currentPath.trim()) {
            let p = currentPath.trim();
            if (/^[a-zA-Z]:$/i.test(p)) p += path.sep;
            if (fs.existsSync(p)) searchRoots.push(p);
        }

        if (searchScope === 'all' || searchRoots.length === 0) {
            const defaultPaths = [
                storageProvider.localBase,
                path.resolve(__dirname, '..', '..', 'uploads'),
                'D:\\'
            ];
            for (const dp of defaultPaths) {
                if (dp && fs.existsSync(dp) && !searchRoots.includes(dp)) {
                    searchRoots.push(dp);
                }
            }
        }

        const scanDirectory = async (dir, depth = 0) => {
            if (depth > 5 || results.length >= 100) return;
            try {
                const entries = await fs.promises.readdir(dir, { withFileTypes: true });
                for (const entry of entries) {
                    if (results.length >= 100) break;
                    filesScanned++;
                    if (filesScanned % 20 === 0) await new Promise(r => setImmediate(r));

                    const fullPath = path.join(dir, entry.name);
                    const lowerName = entry.name.toLowerCase();
                    const lowerFullPath = fullPath.toLowerCase();

                    if (['$recycle.bin', 'system volume information', 'node_modules', '.git', '.cache', 'appdata'].includes(lowerName)) continue;

                    if (entry.isDirectory()) {
                        await scanDirectory(fullPath, depth + 1);
                    } else {
                        if (seenPaths.has(lowerFullPath)) continue;
                        seenPaths.add(lowerFullPath);

                        const ext = entry.name.includes('.') ? entry.name.split('.').pop().toLowerCase() : '';
                        let score = 0;
                        let matchType = 'name';
                        let snippet = '';

                        if (lowerName === q) {
                            score = 100;
                            matchType = 'exact_name';
                        } else if (lowerName.includes(q)) {
                            score = 85;
                            matchType = 'name';
                        } else if (lowerFullPath.includes(q)) {
                            score = 70;
                            matchType = 'path';
                        }

                        if (score > 0) {
                            try {
                                const st = await fs.promises.stat(fullPath);
                                results.push({
                                    name: entry.name,
                                    path: fullPath,
                                    displayPath: fullPath,
                                    size: st.size,
                                    mtime: st.mtime,
                                    ext,
                                    score,
                                    matchType,
                                    snippet: snippet || `File matching "${query}"`
                                });
                            } catch (_) {}
                        }
                    }
                }
            } catch (_) {}
        };

        for (const root of searchRoots) {
            await scanDirectory(root, 0);
            if (results.length >= 100) break;
        }

        results.sort((a, b) => b.score - a.score);

        res.json({
            query,
            totalFound: results.length,
            filesScanned,
            searchedRoots: searchRoots,
            results
        });
    } catch (err) {
        logger.error(`[Smart Search Error]: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});


// ── GET /api/v1/files/comments (Team File Comments) ───────────────────────────
router.get('/comments', async (req, res) => {
    try {
        const filePath = req.query.path;
        if (!filePath) return res.status(400).json({ error: 'Path required' });

        const result = await db.query(
            'SELECT id, file_path, username, comment, pinned, created_at FROM file_comments WHERE file_path = $1 ORDER BY pinned DESC, created_at ASC',
            [filePath]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/v1/files/comments ──────────────────────────────────────────────
router.post('/comments', async (req, res) => {
    try {
        const { path: filePath, comment } = req.body;
        if (!filePath || !comment || !comment.trim()) {
            return res.status(400).json({ error: 'Path and comment required' });
        }

        const username = req.user?.username || 'admin';
        const userId = req.user?.id;

        const insertRes = await db.query(
            'INSERT INTO file_comments (file_path, user_id, username, comment) VALUES ($1, $2, $3, $4) RETURNING id, file_path, username, comment, pinned, created_at',
            [filePath, userId, username, comment.trim()]
        );

        notificationService.notify('file_upload', 'Team Comment Added 💬', {
            status: `@${username} commented on "${path.basename(filePath)}": "${comment.trim().slice(0, 60)}"`,
            error: 'info'
        });

        res.json({ success: true, comment: insertRes.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── DELETE /api/v1/files/comments/:id ────────────────────────────────────────
router.delete('/comments/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await db.query('DELETE FROM file_comments WHERE id = $1', [id]);
        res.json({ success: true, message: 'Comment deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
