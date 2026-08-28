const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 12;   // GCM standard nonce length
const SALT_LENGTH = 16; // Random salt per operation
const AUTH_TAG_LENGTH = 16;

/**
 * Derive a 256-bit key from a secret using scrypt with a unique random salt.
 * Prefers ENCRYPTION_KEY env var; falls back to JWT_SECRET.
 * Never uses a hardcoded default in production.
 */
const deriveKey = (salt) => {
    const secret = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('FATAL: ENCRYPTION_KEY (or JWT_SECRET as fallback) is not set. Cannot derive encryption key.');
    }
    return crypto.scryptSync(secret, salt, KEY_LENGTH);
};

/**
 * Encrypt plaintext using AES-256-GCM (authenticated encryption).
 * Output format: <salt_hex>:<iv_hex>:<authTag_hex>:<ciphertext_hex>
 */
function encrypt(text) {
    if (!text) return null;
    try {
        const salt = crypto.randomBytes(SALT_LENGTH);
        const iv   = crypto.randomBytes(IV_LENGTH);
        const key  = deriveKey(salt);

        const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag();

        // Encode salt:iv:authTag:ciphertext — all parts needed for decryption
        return [
            salt.toString('hex'),
            iv.toString('hex'),
            authTag.toString('hex'),
            encrypted
        ].join(':');
    } catch (err) {
        console.error('[CryptoHelper] GCM Encryption failed:', err.message);
        return null;
    }
}

/**
 * Decrypt ciphertext produced by encrypt().
 * Automatically detects legacy CBC format (only 2 parts) for backwards compatibility.
 * Output: plaintext string, or null on failure/tampering.
 */
function decrypt(text) {
    if (!text) return null;
    try {
        const parts = text.split(':');

        if (parts.length === 4) {
            // Modern GCM format: salt:iv:authTag:ciphertext
            const [saltHex, ivHex, authTagHex, ciphertext] = parts;
            const salt    = Buffer.from(saltHex, 'hex');
            const iv      = Buffer.from(ivHex, 'hex');
            const authTag = Buffer.from(authTagHex, 'hex');
            const key     = deriveKey(salt);

            const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
            decipher.setAuthTag(authTag);
            let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
            decrypted += decipher.final('utf8'); // Throws if auth tag is invalid (tampered)
            return decrypted;
        } else if (parts.length >= 2) {
            // Legacy CBC format: iv:ciphertext — decrypt with old key derivation for migration
            const { createDecipheriv: createD, scryptSync } = crypto;
            const legacySecret = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || '';
            const legacyKey = scryptSync(legacySecret, 'nexadisk-salt', 32);
            const ivBuf = Buffer.from(parts.shift(), 'hex');
            const encText = parts.join(':');
            const decipher = createD('aes-256-cbc', legacyKey, ivBuf);
            let decrypted = decipher.update(encText, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
        }

        console.error('[CryptoHelper] Unknown ciphertext format.');
        return null;
    } catch (err) {
        console.error('[CryptoHelper] Decryption failed (possible tampering or wrong key):', err.message);
        return null;
    }
}

module.exports = {
    encrypt,
    decrypt
};

