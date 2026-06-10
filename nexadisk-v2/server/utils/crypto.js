const crypto = require('crypto');
require('dotenv').config();

const ENCRYPTION_KEY = (process.env.JWT_SECRET || 'fallback_secret_key_needs_32bytes_fallback').substring(0, 32).padEnd(32, '0');

function encryptPassword(text) {
    if (!text) return null;
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(String(text));
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return 'AES:' + iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decryptPassword(text) {
    if (!text) return null;
    if (!text.startsWith('AES:')) return null; // Cannot decrypt bcrypt or invalid format
    try {
        const textParts = text.split(':');
        const iv = Buffer.from(textParts[1], 'hex');
        const encryptedText = Buffer.from(textParts[2], 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (e) {
        return null;
    }
}

module.exports = { encryptPassword, decryptPassword };
