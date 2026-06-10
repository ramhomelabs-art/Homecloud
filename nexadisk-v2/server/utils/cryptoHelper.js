const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

// Derive a secure 32-byte key from JWT_SECRET or a default string
const getEncryptionKey = () => {
    const secret = process.env.JWT_SECRET || 'nexadisk-default-encryption-secret-key-fallback';
    return crypto.scryptSync(secret, 'nexadisk-salt', 32);
};

function encrypt(text) {
    if (!text) return null;
    try {
        const iv = crypto.randomBytes(IV_LENGTH);
        const key = getEncryptionKey();
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return iv.toString('hex') + ':' + encrypted;
    } catch (err) {
        console.error('[CryptoHelper] Encryption failed:', err.message);
        return null;
    }
}

function decrypt(text) {
    if (!text) return null;
    try {
        const textParts = text.split(':');
        const iv = Buffer.from(textParts.shift(), 'hex');
        const encryptedText = textParts.join(':');
        const key = getEncryptionKey();
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (err) {
        console.error('[CryptoHelper] Decryption failed:', err.message);
        return null;
    }
}

module.exports = {
    encrypt,
    decrypt
};
