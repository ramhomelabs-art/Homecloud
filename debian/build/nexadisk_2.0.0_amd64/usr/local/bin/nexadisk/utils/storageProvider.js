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
        this.localBase = process.env.LOCAL_STORAGE_BASE || path.resolve(__dirname, '..', 'uploads');
        
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
            logger.info(`StorageProvider initialized: Local File System (Base: ${this.localBase})`);
        }
    }

    // Resolve storage-specific target path
    resolvePath(targetPath) {
        if (this.type === 's3') {
            // S3 paths should be relative key strings without leading slashes
            let key = targetPath.replace(/^[\\\/]+/, '');
            return key.replace(/\\/g, '/');
        }
        const resolvedBase = path.resolve(this.localBase);
        let resolved;
        if (path.isAbsolute(targetPath)) {
            resolved = path.resolve(targetPath);
        } else {
            // Local path should resolve absolute path relative to localBase
            resolved = path.resolve(this.localBase, targetPath.replace(/^[\\\/]+/, ''));
        }
        // Enforce that resolved path is within the configured localBase OR mount directories
        const isWithinBase = resolved.startsWith(resolvedBase + path.sep) || resolved === resolvedBase;
        
        const os = require('os');
        const mountBases = [
            process.env.MNT_BASE,
            '/opt/nexadisk/mnt',
            path.join(os.homedir(), '.nexadisk', 'mnt'),
            path.resolve(__dirname, '..', 'mnt'),
            '/usr/local/bin/nexadisk/mnt',
            '/usr/local/bin/mnt'
        ].filter(Boolean).map(p => path.resolve(p));

        const isWithinMount = mountBases.some(base => resolved.startsWith(base + path.sep) || resolved === base);

        if (!isWithinBase && !isWithinMount) {
            throw new Error(`Access denied: path '${targetPath}' resolves outside the storage base and mount directories`);
        }
        return resolved;
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

        const files = fs.readdirSync(p, { withFileTypes: true });
        return files.map(file => {
            const fPath = path.join(p, file.name);
            let s = { size: 0, mtime: new Date() };
            try { s = fs.statSync(fPath); } catch (e) {}
            return {
                name: file.name,
                isDirectory: file.isDirectory(),
                size: file.isDirectory() ? getDirectorySize(fPath, 5) : s.size,
                modified: s.mtime
            };
        });
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
