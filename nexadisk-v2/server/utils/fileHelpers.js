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

module.exports = {
    getDirectorySize
};
