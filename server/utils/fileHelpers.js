const fs = require('fs');
const path = require('path');

const dirSizeCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache
const SYSTEM_FOLDERS = ['$RECYCLE.BIN', 'System Volume Information', 'Recovery', 'PerfLogs', 'Config.Msi'];

const getDirectorySize = (dirPath, maxDepth = 6) => {
    const now = Date.now();
    const cached = dirSizeCache.get(dirPath);
    if (cached && (now - cached.timestamp < CACHE_TTL)) {
        return cached.size;
    }

    const basename = path.basename(dirPath);
    if (SYSTEM_FOLDERS.includes(basename)) return 0;

    let size = 0;
    try {
        const stats = fs.statSync(dirPath);
        if (!stats.isDirectory()) return stats.size;
        if (maxDepth <= 0) return 0;

        const files = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const file of files) {
            const filePath = path.join(dirPath, file.name);
            if (file.isDirectory()) {
                size += getDirectorySize(filePath, maxDepth - 1);
            } else {
                try {
                    const fStats = fs.statSync(filePath);
                    size += fStats.size;
                } catch (e) { }
            }
        }
    } catch (e) { }

    dirSizeCache.set(dirPath, { size, timestamp: now });
    return size;
};

let cachedCategories = null;
let lastCategoryScan = 0;
const CATEGORY_CACHE_TTL = 60 * 1000; // 60s cache

const calculateCategorySizes = (dirPath, totalDiskUsed) => {
    const now = Date.now();
    if (cachedCategories && (now - lastCategoryScan < CATEGORY_CACHE_TTL)) {
        return cachedCategories;
    }

    const categories = {
        media: 0,
        images: 0,
        documents: 0,
        archives: 0,
        other: 0
    };

    // Extension mappings
    const extensionMap = {
        media: ['.mp4', '.mkv', '.avi', '.mov', '.mp3', '.wav', '.flac', '.ogg'],
        images: ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.svg', '.webp'],
        documents: ['.pdf', '.txt', '.md', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'],
        archives: ['.zip', '.tar', '.gz', '.rar', '.7z', '.bz2']
    };

    let totalScanned = 0;
    let fileCount = 0;

    const scanDir = (currentPath, depth = 0) => {
        if (depth > 3 || fileCount > 500) return;
        try {
            const files = fs.readdirSync(currentPath, { withFileTypes: true });
            for (const file of files) {
                if (fileCount > 500) break;
                const filePath = path.join(currentPath, file.name);
                if (file.isDirectory()) {
                    scanDir(filePath, depth + 1);
                } else {
                    fileCount++;
                    const ext = path.extname(file.name).toLowerCase();
                    try {
                        const stats = fs.statSync(filePath);
                        totalScanned += stats.size;
                        
                        let categorized = false;
                        for (const [cat, exts] of Object.entries(extensionMap)) {
                            if (exts.includes(ext)) {
                                categories[cat] += stats.size;
                                categorized = true;
                                break;
                            }
                        }
                        if (!categorized) {
                            categories.other += stats.size;
                        }
                    } catch (e) {}
                }
            }
        } catch (e) {}
    };

    if (fs.existsSync(dirPath)) {
        scanDir(dirPath);
    }

    // Fallback if scanned size is 0 (new installation or empty folder)
    if (totalScanned === 0) {
        categories.media = Math.round(totalDiskUsed * 0.40);
        categories.images = Math.round(totalDiskUsed * 0.15);
        categories.documents = Math.round(totalDiskUsed * 0.20);
        categories.archives = Math.round(totalDiskUsed * 0.15);
        categories.other = totalDiskUsed - (categories.media + categories.images + categories.documents + categories.archives);
        categories._estimated = true;
    }

    cachedCategories = categories;
    lastCategoryScan = now;
    return categories;
};

const uploadFileToSmb = async (localFilePath, sharePath, fileName) => {
    const db = require('../config/database');
    const cryptoHelper = require('./crypto');
    const sharesRes = await db.query('SELECT * FROM network_shares');
    let clean = (sharePath || '').trim().replace(/\\/g, '/').replace(/^(smb:)?\/+/, '');
    const parts = clean.split('/');
    const host = parts[0];
    const shareName = parts[1] || '';
    const uncShare = `//${host}/${shareName}`;
    const internalDir = parts.slice(2).join('/');

    const matchedShare = sharesRes.rows.find(row => {
        let cleanRow = (row.path || '').replace(/\\/g, '/').replace(/^(smb:)?\/+/, '');
        const rowParts = cleanRow.split('/');
        return (rowParts[0]?.toLowerCase() === host.toLowerCase() && 
               (rowParts[1] || '').toLowerCase() === shareName.toLowerCase()) ||
               (row.label && row.label.toLowerCase() === shareName.toLowerCase());
    });

    const user = matchedShare?.username || '';
    let pass = '';
    if (matchedShare?.password) {
        try { pass = cryptoHelper.decrypt(matchedShare.password); } catch (e) { pass = matchedShare.password; }
    }

    const env = { ...process.env, PASSWD: pass || '' };
    const safeUser = (user || '').replace(/[;&|`$<>\\"']/g, '');
    const safeShare = uncShare.replace(/[;&|`$<>\\"']/g, '');

    const cdCmd = internalDir ? `cd "${internalDir.replace(/"/g, '')}"; ` : '';
    const putCmd = `${cdCmd}put "${localFilePath.replace(/"/g, '')}" "${fileName.replace(/"/g, '')}"`;

    const { exec } = require('child_process');
    const cmd = safeUser
        ? `smbclient "${safeShare}" -U "${safeUser}" -t 30 -c '${putCmd}'`
        : `smbclient "${safeShare}" -N -t 30 -c '${putCmd}'`;

    return new Promise((resolve, reject) => {
        exec(cmd, { env, timeout: 30000 }, (err, stdout, stderr) => {
            if (err) {
                return reject(new Error(`Failed to upload file to SMB: ${stderr || stdout || err.message}`));
            }
            resolve(true);
        });
    });
};

const clearDirSizeCache = () => {
    if (typeof dirSizeCache !== 'undefined' && dirSizeCache) dirSizeCache.clear();
    cachedCategories = null;
};

module.exports = {
    getDirectorySize,
    calculateCategorySizes,
    clearDirSizeCache,
    uploadFileToSmb
};
