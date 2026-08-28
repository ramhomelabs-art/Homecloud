const crypto = require('crypto');

function base32Decode(str) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let clean = str.replace(/=+$/, '').toUpperCase().replace(/\s/g, '');
    let len = clean.length;
    const bytes = [];
    let buffer = 0;
    let bitsLeft = 0;
    for (let i = 0; i < len; i++) {
        const val = alphabet.indexOf(clean[i]);
        if (val === -1) throw new Error('Invalid base32 character');
        buffer = (buffer << 5) | val;
        bitsLeft += 5;
        if (bitsLeft >= 8) {
            bytes.push((buffer >> (bitsLeft - 8)) & 0xff);
            bitsLeft -= 8;
            buffer &= (1 << bitsLeft) - 1;
        }
    }
    return Buffer.from(bytes);
}

function generateSecret() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let secret = '';
    for (let i = 0; i < 16; i++) {
        secret += chars[Math.floor(crypto.randomBytes(1)[0] % chars.length)];
    }
    return secret;
}

function verifyTOTP(token, secret, window = 2) {
    if (!token || !secret) return false;
    const cleanToken = token.trim().replace(/\D/g, '');
    if (cleanToken.length !== 6) return false;

    try {
        const key = base32Decode(secret);
        const epoch = Math.floor(Date.now() / 1000 / 30);
        for (let i = -window; i <= window; i++) {
            const step = epoch + i;
            const buf = Buffer.alloc(8);
            buf.writeUInt32BE(Math.floor(step / 0x100000000), 0);
            buf.writeUInt32BE(step % 0x100000000, 4);
            
            const hmac = crypto.createHmac('sha1', key).update(buf).digest();
            const offset = hmac[hmac.length - 1] & 0xf;
            const code = ((hmac[offset] & 0x7f) << 24) |
                         ((hmac[offset + 1] & 0xff) << 16) |
                         ((hmac[offset + 2] & 0xff) << 8) |
                         (hmac[offset + 3] & 0xff);
            const otp = String(code % 1000000).padStart(6, '0');
            if (otp === cleanToken) return true;
        }
    } catch (e) {
        return false;
    }
    return false;
}

module.exports = {
    generateSecret,
    verifyTOTP
};
