const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { Transform } = require('stream');
const db = require('../config/database');
const logger = require('../utils/logger');
const storageProvider = require('../utils/storageProvider');

// In-memory cache for active keys: lockerId -> { fileKey, filenameKey, unlockTime, timeoutTimer }
const activeKeys = new Map();

// Transform stream to encrypt file streams on the fly (AES-256-CTR / AES-256-CBC)
class EncryptTransform extends Transform {
    constructor(key, algorithm = 'aes-256-ctr') {
        super();
        this.key = key;
        this.algorithm = algorithm;
        this.iv = crypto.randomBytes(16);
        this.cipher = crypto.createCipheriv(this.algorithm, this.key, this.iv);
        this.ivSent = false;
    }

    _transform(chunk, encoding, callback) {
        if (!this.ivSent) {
            this.push(this.iv);
            this.ivSent = true;
        }
        const encrypted = this.cipher.update(chunk);
        if (encrypted && encrypted.length > 0) {
            this.push(encrypted);
        }
        callback();
    }

    _flush(callback) {
        try {
            const final = this.cipher.final();
            if (final && final.length > 0) {
                this.push(final);
            }
        } catch (e) {
            this.emit('error', e);
        }
        callback();
    }
}

// Transform stream to decrypt file streams on the fly
class DecryptTransform extends Transform {
    constructor(key, algorithm = 'aes-256-ctr') {
        super();
        this.key = key;
        this.algorithm = algorithm;
        this.ivBuffer = Buffer.alloc(0);
        this.decipher = null;
    }

    _transform(chunk, encoding, callback) {
        if (!this.decipher) {
            this.ivBuffer = Buffer.concat([this.ivBuffer, chunk]);
            if (this.ivBuffer.length >= 16) {
                const iv = this.ivBuffer.subarray(0, 16);
                const remaining = this.ivBuffer.subarray(16);
                try {
                    this.decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
                    if (remaining.length > 0) {
                        const decrypted = this.decipher.update(remaining);
                        if (decrypted && decrypted.length > 0) {
                            this.push(decrypted);
                        }
                    }
                    this.ivBuffer = null; // Free memory
                } catch (e) {
                    return callback(e);
                }
            }
            callback();
        } else {
            try {
                const decrypted = this.decipher.update(chunk);
                if (decrypted && decrypted.length > 0) {
                    this.push(decrypted);
                }
                callback();
            } catch (e) {
                callback(e);
            }
        }
    }

    _flush(callback) {
        if (this.decipher) {
            try {
                const final = this.decipher.final();
                if (final && final.length > 0) {
                    this.push(final);
                }
            } catch (err) {
                this.emit('error', new Error('Decryption failed: Invalid password or corrupted file structure.'));
            }
        } else {
            this.emit('error', new Error('Decryption failed: File too small or missing metadata header.'));
        }
        callback();
    }
}

// Deterministic AES-256-CBC cipher for filenames
function encryptFilename(name, key) {
    if (!name) return name;
    try {
        const iv = Buffer.alloc(16, 0); // Constant Zero IV for deterministic lookup
        const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
        let encrypted = cipher.update(name, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return 'enc_' + encrypted;
    } catch (e) {
        logger.error(`Filename encryption failed: ${e.message}`);
        return name;
    }
}

function decryptFilename(encName, key) {
    if (!encName || !encName.startsWith('enc_')) return encName;
    try {
        const hex = encName.slice(4);
        const iv = Buffer.alloc(16, 0);
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(hex, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (e) {
        // Fall back to returning the cipher text if it's not decryptable (e.g. wrong key)
        return encName;
    }
}

// Derives file encryption key & filename encryption key from master password and salt
function deriveKeys(passphrase, saltHex) {
    const salt = Buffer.from(saltHex, 'hex');
    const masterKey = crypto.pbkdf2Sync(passphrase, salt, 100000, 32, 'sha256');
    const fileKey = Buffer.from(crypto.hkdfSync('sha256', masterKey, '', 'file_encryption', 32));
    const filenameKey = Buffer.from(crypto.hkdfSync('sha256', masterKey, '', 'filename_encryption', 32));
    return { fileKey, filenameKey };
}

// Check space limits before file writes/uploads
function getDirectorySize(dirPath) {
    let size = 0;
    try {
        const files = fs.readdirSync(dirPath);
        for (const file of files) {
            const filePath = path.join(dirPath, file);
            const stat = fs.statSync(filePath);
            if (stat.isDirectory()) {
                size += getDirectorySize(filePath);
            } else {
                size += stat.size;
            }
        }
    } catch (e) {}
    return size;
}

function checkSpaceLimit(locker, bytesToWrite) {
    if (!locker.size_mb || locker.size_mb <= 0) return true; // Unlimited size
    const currentSize = getDirectorySize(locker.vault_path);
    const limitBytes = locker.size_mb * 1024 * 1024;
    return (currentSize + bytesToWrite) <= limitBytes;
}

// Convert a user-facing virtual path to the corresponding physical path on disk (encrypting segments)
function toPhysicalPath(virtualPath, locker, filenameKey) {
    const vaultRoot = path.normalize(locker.vault_path);
    const normalizedPath = path.normalize(virtualPath);
    
    if (normalizedPath === vaultRoot) {
        return vaultRoot;
    }
    
    if (!normalizedPath.startsWith(vaultRoot + path.sep)) {
        return normalizedPath;
    }
    
    const relativePart = normalizedPath.slice(vaultRoot.length + 1);
    if (!relativePart) {
        return vaultRoot;
    }
    
    // Encrypt individual directory & file name segments inside the vault
    const segments = relativePart.split(/[\\\/]/).filter(Boolean);
    const encryptedSegments = segments.map(seg => encryptFilename(seg, filenameKey));
    return path.join(vaultRoot, ...encryptedSegments);
}

// Convert a physical path back to the user-facing virtual path (decrypting segments)
function toVirtualPath(physicalPath, locker, filenameKey) {
    const vaultRoot = path.normalize(locker.vault_path);
    const normalizedPath = path.normalize(physicalPath);
    
    if (normalizedPath === vaultRoot) {
        return vaultRoot;
    }
    
    if (!normalizedPath.startsWith(vaultRoot + path.sep)) {
        return normalizedPath;
    }
    
    const relativePart = normalizedPath.slice(vaultRoot.length + 1);
    if (!relativePart) {
        return vaultRoot;
    }
    
    const segments = relativePart.split(/[\\\/]/).filter(Boolean);
    const decryptedSegments = segments.map(seg => decryptFilename(seg, filenameKey));
    return path.join(vaultRoot, ...decryptedSegments);
}

// Find if target path resides inside any vault registered in the system
async function getLockerForPath(targetPath) {
    if (!targetPath) return null;
    try {
        const normTarget = path.normalize(targetPath).toLowerCase();
        
        // Fetch all lockers from the DB
        const res = await db.query('SELECT * FROM lockers');
        for (const locker of res.rows) {
            const normVault = path.normalize(locker.vault_path).toLowerCase();
            if (normTarget === normVault || normTarget.startsWith(normVault + path.sep)) {
                return locker;
            }
        }
    } catch (e) {
        logger.error(`Error matching path to lockers: ${e.message}`);
    }
    return null;
}

// Transparent path resolver wrapper
async function resolveVaultPath(req, targetPath) {
    // 1. Resolve standard filepath base bounds
    let resolvedRaw;
    if (req.user && req.user.isGuest) {
        if (!req.user.path) throw new Error('Access denied: guest token missing share path');
        let cleanPath = targetPath.replace(/^[a-zA-Z]:/, '').replace(/^[\\\/]+/, '');
        resolvedRaw = path.resolve(req.user.path, cleanPath);
    } else {
        resolvedRaw = storageProvider.resolvePath(targetPath);
    }

    // 2. Identify if the resolved path is inside an encrypted vault
    const locker = await getLockerForPath(resolvedRaw);
    if (!locker) {
        return resolvedRaw;
    }

    // 3. Check if the vault is unlocked
    const keys = activeKeys.get(locker.id);
    if (!keys) {
        const err = new Error('Vault is locked');
        err.statusCode = 403;
        err.lockerId = locker.id;
        throw err;
    }

    // Reset autolock timeout timer on activity
    resetLockerTimer(locker.id, locker.auto_lock_timeout);

    // 4. Map the virtual segments to encrypted physical segments
    const physical = toPhysicalPath(resolvedRaw, locker, keys.filenameKey);
    return physical;
}

// Autolock timer helpers
function resetLockerTimer(lockerId, timeoutMinutes) {
    if (!timeoutMinutes || timeoutMinutes <= 0) return;
    
    const entry = activeKeys.get(lockerId);
    if (!entry) return;
    
    if (entry.timeoutTimer) {
        clearTimeout(entry.timeoutTimer);
    }
    
    entry.timeoutTimer = setTimeout(() => {
        logger.info(`Locker '${lockerId}' auto-locked due to inactivity timeout.`);
        lockLocker(lockerId);
    }, timeoutMinutes * 60 * 1000);
}

// Vault activation controls
function unlockLocker(lockerId, fileKey, filenameKey, timeoutMinutes) {
    const existing = activeKeys.get(lockerId);
    if (existing && existing.timeoutTimer) {
        clearTimeout(existing.timeoutTimer);
    }

    activeKeys.set(lockerId, {
        fileKey,
        filenameKey,
        unlockTime: Date.now(),
        timeoutTimer: null
    });

    resetLockerTimer(lockerId, timeoutMinutes);
}

function lockLocker(lockerId) {
    const entry = activeKeys.get(lockerId);
    if (entry) {
        if (entry.timeoutTimer) clearTimeout(entry.timeoutTimer);
        activeKeys.delete(lockerId);
        return true;
    }
    return false;
}

function hasKeys(lockerId) {
    return activeKeys.has(lockerId);
}

function getKeys(lockerId) {
    return activeKeys.get(lockerId);
}

// Synchronous encryption helper for text/buffers (e.g. saving files)
function encryptBuffer(buffer, key, algorithm = 'aes-256-ctr') {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
    return Buffer.concat([iv, encrypted]);
}

// Synchronous decryption helper for text/buffers
function decryptBuffer(buffer, key, algorithm = 'aes-256-ctr') {
    if (buffer.length < 16) return Buffer.alloc(0);
    const iv = buffer.subarray(0, 16);
    const ciphertext = buffer.subarray(16);
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

module.exports = {
    EncryptTransform,
    DecryptTransform,
    encryptFilename,
    decryptFilename,
    deriveKeys,
    checkSpaceLimit,
    toPhysicalPath,
    toVirtualPath,
    getLockerForPath,
    resolveVaultPath,
    unlockLocker,
    lockLocker,
    hasKeys,
    getKeys,
    encryptBuffer,
    decryptBuffer
};
