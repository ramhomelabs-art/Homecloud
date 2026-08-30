let clearDirSizeCache = () => {};
try { clearDirSizeCache = require('./fileHelpers').clearDirSizeCache || (() => {}); } catch(e) {}
const fs = require('fs');
const path = require('path');
const AWS = require('aws-sdk');
const logger = require('./logger');
const { getDirectorySize } = require('./fileHelpers');

class StorageProvider {
    constructor() {
        this.type = process.env.STORAGE_TYPE || 'local'; // 'local' or 's3'
        this.localBase = process.env.LOCAL_STORAGE_BASE || process.env.STORAGE_ROOT || path.resolve(__dirname, '..', 'uploads');
        
        if (this.type === 's3') {
            AWS.config.update({
                accessKeyId: process.env.S3_ACCESS_KEY_ID,
                secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
                endpoint: process.env.S3_ENDPOINT,
                s3ForcePathStyle: true, // Needed for MinIO/Wasabi
                signatureVersion: 'v4'
            });
            this.s3 = new AWS.S3();
            this.bucket = process.env.S3_BUCKET || 'nexadisk';
            logger.info(`StorageProvider initialized: S3 (Endpoint: ${process.env.S3_ENDPOINT}, Bucket: ${this.bucket})`);
        } else {
            if (!fs.existsSync(this.localBase)) {
                fs.mkdirSync(this.localBase, { recursive: true });
            }
            this.cleanupOrphanTempFiles();
            logger.info(`StorageProvider initialized: Local File System (Base: ${this.localBase})`);
        }
    }

    // Purge temporary uncompressed/staged artifacts older than 2 hours to reclaim disk space
    cleanupOrphanTempFiles() {
        try {
            const tempDir = path.join(this.localBase, 'temp');
            if (fs.existsSync(tempDir)) {
                const now = Date.now();
                const files = fs.readdirSync(tempDir);
                let cleaned = 0;
                for (const file of files) {
                    try {
                        const fp = path.join(tempDir, file);
                        const stat = fs.statSync(fp);
                        if (now - stat.mtimeMs > 2 * 60 * 60 * 1000) { // > 2 hours old
                            if (stat.isDirectory()) fs.rmSync(fp, { recursive: true, force: true });
                            else fs.unlinkSync(fp);
                            cleaned++;
                        }
                    } catch (_) {}
                }
                if (cleaned > 0) logger.info(`[Storage GC] Purged ${cleaned} stale temporary files from /temp staging.`);
            }
        } catch (e) {
            logger.warn(`[Storage GC] Temp cleanup encountered a non-fatal error: ${e.message}`);
        }
    }

    // Resolve storage-specific target path
    resolvePath(targetPath) {
        if (!targetPath) return this.localBase;
        if (this.type === 's3') {
            // S3 paths should be relative key strings without leading slashes
            let key = targetPath.replace(/^[\\\/]+/, '');
            return key.replace(/\\/g, '/');
        }
        const resolvedBase = path.resolve(this.localBase);
        let resolved;
        if (path.isAbsolute(targetPath) || /^[a-zA-Z]:/i.test(targetPath)) {
            let normalized = targetPath;
            if (/^[a-zA-Z]:$/i.test(normalized)) {
                normalized += path.sep;
            }
            resolved = path.resolve(normalized);
        } else {
            // Local path should resolve absolute path relative to localBase
            resolved = path.resolve(this.localBase, targetPath.replace(/^[\\\/]+/, ''));
        }
        return resolved;
    }

    resolvePhysicalPath(targetPath) {
        return this.resolvePath(targetPath);
    }

    async exists(targetPath) {
        const p = this.resolvePath(targetPath);
        if (this.type === 's3') {
            try {
                await this.s3.headObject({ Bucket: this.bucket, Key: p }).promise();
                return true;
            } catch (err) {
                if (err.code === 'NotFound') return false;
                throw err;
            }
        }
        return fs.existsSync(p);
    }

    async mkdir(targetPath) {
        if (this.type === 's3') {
            // S3 directories are created implicitly when keys are added, but we can write a dummy placeholder key
            const p = this.resolvePath(targetPath) + '/';
            await this.s3.putObject({ Bucket: this.bucket, Key: p, Body: '' }).promise();
            return;
        }
        const p = this.resolvePath(targetPath);
        await fs.promises.mkdir(p, { recursive: true });
        clearDirSizeCache();
    }

    readStream(targetPath) {
        const p = this.resolvePath(targetPath);
        if (this.type === 's3') {
            return this.s3.getObject({ Bucket: this.bucket, Key: p }).createReadStream();
        }
        return fs.createReadStream(p);
    }

    async writeStream(targetPath, stream, mimetype = 'application/octet-stream') {
        const p = this.resolvePath(targetPath);
        if (this.type === 's3') {
            // AWS S3 upload utility supports streams directly using PassThrough or Upload
            const upload = this.s3.upload({
                Bucket: this.bucket,
                Key: p,
                Body: stream,
                ContentType: mimetype
            });
            return upload.promise();
        }
        
        return new Promise((resolve, reject) => {
            const outStream = fs.createWriteStream(p);
            stream.pipe(outStream);
            outStream.on('finish', () => { clearDirSizeCache(); resolve(true); });
            outStream.on('error', (err) => reject(err));
        });
    }

    async delete(targetPath) {
        const p = this.resolvePath(targetPath);
        if (this.type === 's3') {
            await this.s3.deleteObject({ Bucket: this.bucket, Key: p }).promise();
            return;
        }
        if (fs.existsSync(p)) {
            const stat = await fs.promises.stat(p);
            if (stat.isDirectory()) {
                await fs.promises.rm(p, { recursive: true, force: true });
            } else {
                await fs.promises.unlink(p);
            }
            clearDirSizeCache();
        }
    }

    async move(srcPath, destPath) {
        const src = this.resolvePath(srcPath);
        const dest = this.resolvePath(destPath);
        if (this.type === 's3') {
            await this.s3.copyObject({
                Bucket: this.bucket,
                CopySource: encodeURIComponent(`${this.bucket}/${src}`),
                Key: dest
            }).promise();
            await this.s3.deleteObject({ Bucket: this.bucket, Key: src }).promise();
            return;
        }
        const destDir = path.dirname(dest);
        if (!fs.existsSync(destDir)) {
            await fs.promises.mkdir(destDir, { recursive: true });
        }
        try {
            await fs.promises.rename(src, dest);
            clearDirSizeCache();
        } catch (err) {
            if (err.code === 'EXDEV') {
                await fs.promises.cp(src, dest, { recursive: true });
                const stats = await fs.promises.stat(src);
                if (stats.isDirectory()) {
                    await fs.promises.rm(src, { recursive: true, force: true });
                } else {
                    await fs.promises.unlink(src);
                }
                clearDirSizeCache();
            } else {
                throw err;
            }
        }
    }

    async readdir(targetPath) {
        const p = this.resolvePath(targetPath);
        if (this.type === 's3') {
            // List S3 objects with matching prefix
            const prefix = p ? (p.endsWith('/') ? p : p + '/') : '';
            const data = await this.s3.listObjectsV2({ Bucket: this.bucket, Prefix: prefix, Delimiter: '/' }).promise();
            
            const dirs = (data.CommonPrefixes || []).map(d => {
                const name = d.Prefix.slice(prefix.length).replace(/\/$/, '');
                return { name, isDirectory: true, size: 0, modified: new Date() };
            });

            const files = (data.Contents || [])
                .filter(f => f.Key !== prefix) // Filter out the directory placeholder key
                .map(f => {
                    const name = f.Key.slice(prefix.length);
                    return { name, isDirectory: false, size: f.Size, modified: f.LastModified };
                });

            return [...dirs, ...files];
        }

        let fileEntries = [];
        try {
            fileEntries = fs.readdirSync(p, { withFileTypes: true });
        } catch (readErr) {
            logger.warn(`[StorageProvider] readdir error on ${p}: ${readErr.message}`);
            throw readErr;
        }

        const items = [];
        for (const file of fileEntries) {
            try {
                const fPath = path.join(p, file.name);
                let s = { size: 0, mtime: new Date() };
                try { 
                    s = fs.statSync(fPath); 
                } catch (e) {
                    try { s = fs.lstatSync(fPath); } catch (_) {}
                }
                const isDir = file.isDirectory() || (file.isSymbolicLink() && typeof s.isDirectory === 'function' && s.isDirectory());
                let dirSize = 0;
                let itemCount = 0;
                if (isDir) {
                    try {
                        const children = fs.readdirSync(fPath);
                        itemCount = children.length;
                        dirSize = getDirectorySize(fPath, 2);
                    } catch (e) {}
                }
                items.push({
                    name: file.name,
                    isDirectory: isDir,
                    size: isDir ? dirSize : (s.size || 0),
                    itemCount: isDir ? itemCount : undefined,
                    modified: s.mtime || new Date()
                });
            } catch (itemErr) {
                // Skip problematic inaccessible files safely
            }
        }
        return items;
    }

    async stat(targetPath) {
        const p = this.resolvePath(targetPath);
        if (this.type === 's3') {
            const data = await this.s3.headObject({ Bucket: this.bucket, Key: p }).promise();
            return {
                size: data.ContentLength,
                modified: data.LastModified,
                isDirectory: p.endsWith('/')
            };
        }
        const stats = fs.statSync(p);
        const isDirectory = stats.isDirectory();
        return {
            size: isDirectory ? getDirectorySize(p, 4) : stats.size,
            modified: stats.mtime,
            isDirectory
        };
    }
}

const storageProvider = new StorageProvider();
module.exports = storageProvider;
