const fs = require('fs');
const crypto = require('crypto');
const logger = require('./logger');

/**
 * DoD 5220.22-M Compliant 3-Pass Secure File Shredder
 * Pass 1: Overwrite entire file with 0x00 (All Zeros)
 * Pass 2: Overwrite entire file with 0xFF (All Ones)
 * Pass 3: Overwrite entire file with CSPRNG Cryptographically Random Bytes
 * Final: Truncate and Unlink (Delete)
 */
async function secureShred(filePath) {
    if (!fs.existsSync(filePath)) return false;

    try {
        const stats = fs.statSync(filePath);
        const fileSize = stats.size;

        if (fileSize > 0) {
            const fd = fs.openSync(filePath, 'r+');
            const chunkSize = Math.min(fileSize, 64 * 1024); // 64 KB buffer

            // Pass 1: Zeros (0x00)
            const zeros = Buffer.alloc(chunkSize, 0x00);
            let written = 0;
            while (written < fileSize) {
                const toWrite = Math.min(chunkSize, fileSize - written);
                fs.writeSync(fd, zeros, 0, toWrite, written);
                written += toWrite;
            }
            fs.fsyncSync(fd);

            // Pass 2: Ones (0xFF)
            const ones = Buffer.alloc(chunkSize, 0xFF);
            written = 0;
            while (written < fileSize) {
                const toWrite = Math.min(chunkSize, fileSize - written);
                fs.writeSync(fd, ones, 0, toWrite, written);
                written += toWrite;
            }
            fs.fsyncSync(fd);

            // Pass 3: Cryptographic Random Bytes
            written = 0;
            while (written < fileSize) {
                const toWrite = Math.min(chunkSize, fileSize - written);
                const randomBytes = crypto.randomBytes(toWrite);
                fs.writeSync(fd, randomBytes, 0, toWrite, written);
                written += toWrite;
            }
            fs.fsyncSync(fd);
            fs.closeSync(fd);
        }

        // Truncate to zero and unlink
        fs.truncateSync(filePath, 0);
        fs.unlinkSync(filePath);

        logger.info(`[Shredder] Forensic-grade 3-pass wipe completed for ${filePath} (${fileSize} bytes)`);
        return true;
    } catch (err) {
        logger.error(`[Shredder] Secure wipe failed for ${filePath}: ${err.message}`);
        // Fallback to normal unlink if shred fails due to file permissions
        try {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch (e) {}
        return false;
    }
}

module.exports = {
    secureShred
};
