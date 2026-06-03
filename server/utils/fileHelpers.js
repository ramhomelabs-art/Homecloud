const fs = require('fs');
const path = require('path');

const dirSizeCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;
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

module.exports = {
    getDirectorySize,
    streamingCopy
};
