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

const calculateCategorySizes = (dirPath, totalDiskUsed) => {
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

    const scanDir = (currentPath, depth = 0) => {
        if (depth > 5) return;
        try {
            const files = fs.readdirSync(currentPath, { withFileTypes: true });
            for (const file of files) {
                const filePath = path.join(currentPath, file.name);
                if (file.isDirectory()) {
                    scanDir(filePath, depth + 1);
                } else {
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

    return categories;
};

const clearDirSizeCache = () => {
    if (typeof dirSizeCache !== 'undefined') dirSizeCache.clear();
};

module.exports = {
    getDirectorySize,
    calculateCategorySizes,
    clearDirSizeCache
};
