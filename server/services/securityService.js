const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('../config/database');
const storageProvider = require('../utils/storageProvider');
const eventBus = require('../utils/eventBus');
const logger = require('../utils/logger');
const yaraService = require('../services/yaraService');
const notificationService = require('./notificationService');
const { secureShred } = require('../utils/shredder');

// ─── Layer 1: Blocklists ────────────────────────────────────────────────────
const BLOCKED_EXTENSIONS = new Set([
    '.exe', '.com', '.scr', '.msi', '.msp', '.pif', '.bat', '.cmd',
    '.vbs', '.vbe', '.jse', '.wsf', '.wsh', '.lnk', '.reg',
    '.php', '.php3', '.php4', '.php5', '.php7', '.php8', '.phtml',
    '.asp', '.aspx', '.ascx', '.ashx', '.asmx',
    '.jsp', '.jspx', '.jspf',
    '.pl', '.cgi', '.rb',
    '.htaccess', '.htpasswd',
]);

const SUSPICIOUS_EXTENSIONS = new Set([
    '.js', '.ts', '.py', '.lua', '.ps1', '.psm1',
    '.sh', '.bash', '.zsh', '.fish',
    '.html', '.htm', '.svg', '.xhtml',
    '.jar', '.war', '.ear',
    '.dll', '.so', '.dylib',
]);

// ─── Layer 2: Signatures ────────────────────────────────────────────────────
const MAGIC_SIGNATURES = [
    { bytes: [0x4D, 0x5A],                                                  label: 'Windows PE Executable (MZ)', score: 100 },
    { bytes: [0x7F, 0x45, 0x4C, 0x46],                                      label: 'Linux ELF Binary', score: 100 },
    { bytes: [0xCA, 0xFE, 0xBA, 0xBE],                                      label: 'Java Class File', score: 80 },
    { bytes: [0xFE, 0xED, 0xFA, 0xCE],                                      label: 'Mach-O Binary (32-bit)', score: 100 },
    { bytes: [0xFE, 0xED, 0xFA, 0xCF],                                      label: 'Mach-O Binary (64-bit)', score: 100 },
    { bytes: [0xD0, 0xCF, 0x11, 0xE0],                                      label: 'MS Office OLE Compound (legacy macro risk)', score: 60 },
    { bytes: [0x50, 0x4B, 0x03, 0x04],                                      label: 'ZIP Archive', score: 0, inspect: true },
    { bytes: [0x52, 0x61, 0x72, 0x21, 0x1A, 0x07],                         label: 'RAR Archive', score: 0, inspect: true },
    { bytes: [0x1F, 0x8B],                                                  label: 'GZIP Archive', score: 0, inspect: true },
];

// ─── Layer 5: Patterns ──────────────────────────────────────────────────────
const CONTENT_PATTERNS = [
    { pattern: /(<\?php|\<\?=)/i,                     label: 'PHP scripting code', score: 95 },
    { pattern: /(#!\/bin\/(bash|sh|zsh|fish|dash))/,  label: 'Unix shell shebang', score: 90 },
    { pattern: /(#!\/usr\/bin\/env\s)/,                label: 'env shell invocation', score: 90 },
    { pattern: /(<script[\s>])/i,                      label: 'HTML script tag', score: 70 },
    { pattern: /javascript:/i,                         label: 'javascript: URI', score: 65 },
    { pattern: /eval\s*\(/i,                           label: 'eval() call', score: 50 },
    { pattern: /exec\s*\(/i,                           label: 'exec() call', score: 50 },
    { pattern: /base64_decode\s*\(/i,                  label: 'base64_decode (PHP obfuscation)', score: 75 },
    { pattern: /system\s*\(|shell_exec\s*\(|passthru\s*\(|popen\s*\(/i, label: 'PHP shell execution', score: 95 },
    { pattern: /powershell\s+-/i,                      label: 'PowerShell invocation', score: 80 },
    { pattern: /invoke-expression|iex\s*\(/i,          label: 'PowerShell Invoke-Expression', score: 90 },
];

function calcEntropy(buffer) {
    if (!buffer || buffer.length === 0) return 0;
    const freq = new Array(256).fill(0);
    for (const byte of buffer) freq[byte]++;
    let entropy = 0;
    const len = buffer.length;
    for (const f of freq) {
        if (f === 0) continue;
        const p = f / len;
        entropy -= p * Math.log2(p);
    }
    return entropy;
}

function inspectZip(buffer) {
    const threats = [];
    const str = buffer.toString('binary');
    const fileNameRegex = /PK\x01\x02[\s\S]{28}([\x20-\x7E]{1,260})/g;
    let match;
    while ((match = fileNameRegex.exec(str)) !== null) {
        const name = match[1].split('\x00')[0].trim();
        const ext = path.extname(name).toLowerCase();
        if (BLOCKED_EXTENSIONS.has(ext)) threats.push(`ZIP contains blocked file: ${name}`);
        if (SUSPICIOUS_EXTENSIONS.has(ext)) threats.push(`ZIP contains suspicious file: ${name}`);
    }
    return threats;
}

class SecurityService {
    async deepScan(filePath, originalName) {
        const startTime = Date.now();
        const ext = path.extname(originalName).toLowerCase();
        const threats = [];
        const details = { extension: ext, layers: {} };
        let score = 0;

        // Load policy settings from app_settings
        let whitelistExts = '';
        let maxScanSize = '100'; // MB default
        try {
            const keys = ['sec_policy_whitelist_exts', 'sec_policy_max_scan_size'];
            const resDb = await db.query('SELECT key, value FROM app_settings WHERE key = ANY($1)', [keys]);
            resDb.rows.forEach(row => {
                if (row.key === 'sec_policy_whitelist_exts') whitelistExts = row.value;
                if (row.key === 'sec_policy_max_scan_size') maxScanSize = row.value;
            });
        } catch (e) {
            logger.error(`[SecurityService] Failed to load policy settings: ${e.message}`);
        }

        // A. Whitelist Extensions Check
        if (whitelistExts) {
            const list = whitelistExts.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
            const extNoDot = ext.replace(/^\./, '');
            if (list.includes(ext) || list.includes(extNoDot) || list.includes(originalName.toLowerCase())) {
                logger.info(`[SecurityService] Skipping scan for whitelisted file: ${originalName}`);
                return await this._finalizeScan(filePath, '', 'clean', 0, [], { ...details, whitelist: true }, Date.now() - startTime);
            }
        }

        // Calculate size first for size limit check
        let fileSize = 0;
        try {
            if (fs.existsSync(filePath)) {
                const stat = fs.statSync(filePath);
                fileSize = stat.size;
                details.size = fileSize;
            }
        } catch (err) {
            logger.error(`[SecurityService] Stat check failed on ${originalName}: ${err.message}`);
        }

        // B. Max Scan Size Limit Check
        const maxMb = parseInt(maxScanSize, 10);
        if (!isNaN(maxMb) && maxMb > 0) {
            const maxBytes = maxMb * 1024 * 1024;
            if (fileSize > maxBytes) {
                logger.info(`[SecurityService] Skipping scan for ${originalName} (Size: ${fileSize} bytes exceeds max limit ${maxBytes} bytes)`);
                return await this._finalizeScan(filePath, '', 'clean', 0, [], { ...details, sizeLimitExceeded: true }, Date.now() - startTime);
            }
        }

        // Calculate hash
        let fileHash = '';
        try {
            const fileBuffer = fs.readFileSync(filePath);
            fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
        } catch (e) {}

        // Layer 1: Extension check
        if (BLOCKED_EXTENSIONS.has(ext)) {
            score = 100;
            threats.push({ name: `Blocked Extension: ${ext}`, severity: 'critical', desc: `File extension "${ext}" is permanently blocked.` });
            details.layers.extension = 'blocked';
        } else if (SUSPICIOUS_EXTENSIONS.has(ext)) {
            score += 30;
            threats.push({ name: `Suspicious Extension: ${ext}`, severity: 'medium', desc: `Extension "${ext}" requires deep inspection.` });
            details.layers.extension = 'suspicious';
        } else {
            details.layers.extension = 'ok';
        }

        // Read file header (8KB)
        let headerBytes = null;
        try {
            const fd = fs.openSync(filePath, 'r');
            const readSize = Math.min(8192, fileSize || 8192);
            const buffer = Buffer.alloc(readSize);
            const bytesRead = fs.readSync(fd, buffer, 0, readSize, 0);
            fs.closeSync(fd);
            headerBytes = buffer.slice(0, bytesRead);
        } catch (err) {
            logger.error(`[SecurityService] Read error on ${originalName}: ${err.message}`);
            score += 40;
            threats.push({ name: 'Read Error', severity: 'high', desc: `File could not be read for scanning: ${err.message}` });
            details.layers.read = 'failed';
            return await this._finalizeScan(filePath, fileHash, 'failed', score, threats, details, Date.now() - startTime);
        }

        // Layer 2: Magic Byte Signatures
        let isArchive = false;
        for (const sig of MAGIC_SIGNATURES) {
            const match = sig.bytes.every((b, i) => headerBytes[i] === b);
            if (match) {
                details.layers.magic = sig.label;
                if (sig.score > 0) {
                    score += sig.score;
                    threats.push({ name: 'Dangerous Signature', severity: sig.score >= 80 ? 'critical' : 'medium', desc: `Binary signature: ${sig.label}` });
                }
                if (sig.inspect) isArchive = true;
                break;
            }
        }
        if (!details.layers.magic) details.layers.magic = 'no known signature';

        // Layer 3: MIME mismatch
        const expectedMagics = {
            '.jpg': [0xFF, 0xD8],
            '.png': [0x89, 0x50, 0x4E, 0x47],
            '.gif': [0x47, 0x49, 0x46],
            '.pdf': [0x25, 0x50, 0x44, 0x46]
        };
        if (expectedMagics[ext]) {
            const expected = expectedMagics[ext];
            const mismatch = !expected.every((b, i) => headerBytes[i] === b);
            if (mismatch) {
                score += 60;
                threats.push({ name: 'MIME Mismatch', severity: 'high', desc: `Extension "${ext}" does not match file content.` });
                details.layers.mime = 'mismatch';
            } else {
                details.layers.mime = 'ok';
            }
        }

        // Layer 4: Entropy
        const entropy = calcEntropy(headerBytes);
        details.entropy = entropy.toFixed(3);
        const isNaturallyCompressed = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.pdf', '.zip', '.rar', '.gz', '.tar', '.7z'].includes(ext);
        if (!isNaturallyCompressed) {
            if (entropy > 7.5) {
                score += 40;
                threats.push({ name: 'High Entropy', severity: 'high', desc: `Very high entropy (${entropy.toFixed(2)}) — possible encrypted/packed payload.` });
            } else if (entropy > 6.8) {
                score += 15;
                threats.push({ name: 'Elevated Entropy', severity: 'low', desc: `Elevated entropy (${entropy.toFixed(2)}) — possibly compressed or encoded.` });
            }
        } else {
            if (entropy > 7.8) {
                threats.push({ name: 'High Entropy (Compressed Format)', severity: 'low', desc: `High entropy (${entropy.toFixed(2)}) typical for compressed formats.` });
            }
        }

        // Layer 5: Content patterns
        const contentStr = headerBytes.toString('utf8');
        details.layers.patterns = [];
        for (const { pattern, label, score: patScore } of CONTENT_PATTERNS) {
            if (pattern.test(contentStr)) {
                score += patScore;
                threats.push({ name: 'Dangerous Pattern', severity: patScore >= 80 ? 'critical' : 'medium', desc: `Pattern detected: ${label}` });
                details.layers.patterns.push(label);
            }
        }

        // Layer 7: ClamAV Integration
        try {
            const { execFile } = require('child_process');
            const util = require('util');
            const execFilePromise = util.promisify(execFile);
            // Use execFile with argument array to prevent shell injection via crafted filenames
            const { stdout } = await execFilePromise('clamscan', ['--no-summary', filePath], { timeout: 15000 });
            // Clamscan returns 0 if clean. Since execFilePromise throws on non-zero exit code,
            // reaching here means exit code 0 (clean).
            details.layers.clamav = 'clean';
        } catch (err) {
            if (err.code === 1 && err.stdout) {
                // Exit code 1 means virus found
                const match = err.stdout.match(/:\s+(.*)\s+FOUND/);
                if (match) {
                    const virusName = match[1];
                    score = 100;
                    threats.push({ name: 'ClamAV Detection', severity: 'critical', desc: `Malware detected: ${virusName}` });
                    details.layers.clamav = virusName;
                }
            } else if (err.code === 2) {
                // Exit code 2 means scan error — treat as suspicious, not clean
                score += 20;
                threats.push({ name: 'ClamAV Scan Error', severity: 'medium', desc: 'ClamAV returned a scan error; file treated with caution' });
                details.layers.clamav = 'scan_error';
            } else {
                // Command not found or timeout — skip gracefully
                details.layers.clamav = 'not_available_or_failed';
            }
        }

        // Layer 8: YARA Integration
        try {
            const yaraResult = await yaraService.scanFile(filePath);
            if (yaraResult.error) {
                details.layers.yara = 'error';
            } else if (yaraResult.matches && yaraResult.matches.length > 0) {
                // Each match increases score based on rule meta or default value
                const yaraScore = Math.min(30 * yaraResult.matches.length, 100);
                score = Math.max(score, yaraScore);
                yaraResult.matches.forEach(m => {
                    threats.push({ name: `YARA Match: ${m.rule}`, severity: 'high', desc: `Matched YARA rule ${m.rule}` });
                });
                details.layers.yara = yaraResult.matches.map(m => m.rule).join(', ');
            } else {
                details.layers.yara = 'clean';
            }
        } catch (yerr) {
            logger.error(`[SecurityService] YARA scan error: ${yerr.message}`);
            details.layers.yara = 'failed';
        }

        // Layer 6: Archive inspection
        if (isArchive) {
            const archiveThreats = inspectZip(headerBytes);
            if (archiveThreats.length > 0) {
                score += 50;
                archiveThreats.forEach(t => threats.push({ name: 'Archive Threat', severity: 'high', desc: t }));
            }
        }

        score = Math.min(score, 100);
        let verdict = 'clean';
        if (score >= 51) verdict = 'malicious';
        else if (score >= 21) verdict = 'suspicious';

        return await this._finalizeScan(filePath, fileHash, verdict, score, threats, details, Date.now() - startTime);
    }

    async _finalizeScan(filePath, fileHash, verdict, score, threats, details, durationMs) {
        let scanId = null;
        try {
            const res = await db.query(
                `INSERT INTO security_scans (file_path, file_hash, scanner, score, status, duration)
                 VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
                [filePath, fileHash, 'NexaDisk Engine + ClamAV', score, verdict, durationMs]
            );
            scanId = res.rows[0].id;

            for (const t of threats) {
                await db.query(
                    `INSERT INTO security_threats (scan_id, threat_name, severity, description) VALUES ($1, $2, $3, $4)`,
                    [scanId, t.name, t.severity, t.desc]
                );
            }
            // Log suspicious/malicious threat events
            if (verdict === 'malicious' || verdict === 'suspicious') {
                await db.query(
                    `INSERT INTO security_events (event_type, details) VALUES ($1, $2)`,
                    ['THREAT_DETECTED', JSON.stringify({
                        scanId,
                        filePath,
                        verdict,
                        score,
                        threats: threats.map(t => t.name)
                    })]
                );

                 const title = `Security Threat Flagged ⚠️`;
                 const issues = threats.map(t => t.desc || t.name).join('\n- ');
                 const detail = `File: ${path.basename(filePath)}\nVerdict: ${verdict.toUpperCase()}\nThreat Score: ${score}\nFlagged Issues:\n- ${issues}`;
                 const severity = verdict === 'malicious' ? 'error' : 'warning';
                 await notificationService.dispatchAlert('security_threat', title, detail, severity);
            }
        } catch (e) {
            logger.error(`[SecurityService] Failed to log scan to database: ${e.message}`);
        }

        return { verdict, score, threats: threats.map(t => t.desc), details, scanId };
    }

    async getQuarantineList(status = 'all', limit = 50, offset = 0) {
        const query = status === 'all' 
            ? 'SELECT * FROM quarantine ORDER BY uploaded_at DESC LIMIT $1 OFFSET $2'
            : 'SELECT * FROM quarantine WHERE status = $1 ORDER BY uploaded_at DESC LIMIT $2 OFFSET $3';
        const params = status === 'all' ? [limit, offset] : [status, limit, offset];
        const res = await db.query(query, params);
        return res.rows;
    }

    async getStats() {
        const res = await db.query(`
            SELECT 
                COUNT(*) FILTER (WHERE status = 'pending') as pending,
                COUNT(*) FILTER (WHERE status = 'approved') as approved,
                COUNT(*) FILTER (WHERE status = 'rejected') as rejected
            FROM quarantine
        `);
        const stats = res.rows[0];
        return {
            pending: parseInt(stats.pending || 0, 10),
            approved: parseInt(stats.approved || 0, 10),
            rejected: parseInt(stats.rejected || 0, 10),
        };
    }

    async getRecordById(id) {
        const res = await db.query('SELECT * FROM quarantine WHERE id = $1', [id]);
        return res.rows[0];
    }

    async quarantineFile(quarantineId, originalName, tempPath, destPath, shareId, fileSize, mimeType, scanResult) {
        const QUARANTINE_DIR = path.join(__dirname, '..', 'quarantine');
        if (!fs.existsSync(QUARANTINE_DIR)) {
            fs.mkdirSync(QUARANTINE_DIR, { recursive: true });
        }
        
        const qFileName = quarantineId + path.extname(originalName);
        const qPath = path.join(QUARANTINE_DIR, qFileName);
        
        // Relocate to quarantine folder safely
        try {
            fs.renameSync(tempPath, qPath);
        } catch (err) {
            if (err.code === 'EXDEV') {
                fs.copyFileSync(tempPath, qPath);
                fs.unlinkSync(tempPath);
            } else {
                throw err;
            }
        }

        // Save entry in PostgreSQL
        await db.query(`
            INSERT INTO quarantine (id, original_name, quarantine_path, target_path, share_id, size, mime_type, verdict, score, threats, scan_details, status, scan_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending', $12)
        `, [
            quarantineId,
            originalName,
            qPath,
            destPath,
            shareId,
            fileSize,
            mimeType || 'application/octet-stream',
            scanResult.verdict,
            scanResult.score,
            JSON.stringify(scanResult.threats),
            JSON.stringify(scanResult.details),
            scanResult.scanId
        ]);

        eventBus.publish('FILE_QUARANTINED', { id: quarantineId, originalName, score: scanResult.score });

        try {
            await db.query(
                `INSERT INTO security_events (event_type, details) VALUES ($1, $2)`,
                ['FILE_QUARANTINED', JSON.stringify({
                    quarantineId,
                    originalName,
                    targetPath: destPath,
                    score: scanResult.score
                })]
            );
        } catch (eventErr) {
            logger.error(`[SecurityService] Event log error for quarantine: ${eventErr.message}`);
        }

        return qPath;
    }

    async approveQuarantine(id, reviewerId) {
        const record = await this.getRecordById(id);
        if (!record) throw new Error('Quarantine record not found');
        if (record.status !== 'pending') throw new Error('File is already reviewed');

        if (!fs.existsSync(record.quarantine_path)) {
            throw new Error('Quarantined source file no longer exists on disk');
        }

        // Move from quarantine to final target
        let rawTarget = record.target_path || '';
        const cleanSmb = rawTarget.replace(/\\/g, '/').replace(/^.*?uploads\//i, '').replace(/^(smb:)?\/+/, '');
        const isSmb = rawTarget.startsWith('\\\\') || 
                      rawTarget.startsWith('//') || 
                      rawTarget.startsWith('smb://') || 
                      /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\//.test(cleanSmb) ||
                      /uploads[\\\/]\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}[\\\/]/i.test(rawTarget);

        if (isSmb) {
            const targetDir = path.dirname(cleanSmb);
            const { uploadFileToSmb } = require('../utils/fileHelpers');
            await uploadFileToSmb(record.quarantine_path, targetDir, record.original_name);
            try { fs.unlinkSync(record.quarantine_path); } catch (_) {}
            logger.info(`[SecurityService] Quarantined file ${record.original_name} approved and uploaded to SMB destination: ${targetDir}`);
        } else {
            // Ensure target directory exists
            const destDir = path.dirname(record.target_path);
            if (!fs.existsSync(destDir)) {
                fs.mkdirSync(destDir, { recursive: true });
            }

            try {
                fs.renameSync(record.quarantine_path, record.target_path);
            } catch (err) {
                if (err.code === 'EXDEV') {
                    fs.copyFileSync(record.quarantine_path, record.target_path);
                    fs.unlinkSync(record.quarantine_path);
                } else {
                    throw err;
                }
            }
        }

        // Update database
        await db.query(
            "UPDATE quarantine SET status = 'approved', reviewed_at = CURRENT_TIMESTAMP, reviewed_by = $1 WHERE id = $2",
            [reviewerId, id]
        );

        // Log to security_events
        try {
            await db.query(
                `INSERT INTO security_events (event_type, details) VALUES ($1, $2)`,
                ['QUARANTINE_APPROVED', JSON.stringify({
                    quarantineId: id,
                    originalName: record.original_name,
                    targetPath: record.target_path,
                    reviewedBy: reviewerId
                })]
            );
        } catch (eventErr) {
            logger.error(`[SecurityService] Event log error for quarantine approve: ${eventErr.message}`);
        }

        // Also update security_scans table if linked
        if (record.scan_id) {
            try {
                await db.query(
                    "UPDATE security_scans SET status = 'clean', score = 0 WHERE id = $1",
                    [record.scan_id]
                );
                await db.query(
                    "DELETE FROM security_threats WHERE scan_id = $1",
                    [record.scan_id]
                );
            } catch (err) {
                logger.error(`[SecurityService] Failed to update scan status on quarantine approval: ${err.message}`);
            }
        }

        eventBus.publish('FILE_QUARANTINE_APPROVED', { id, originalName: record.original_name, targetPath: record.target_path });
        return true;
    }

    async rejectQuarantine(id, reviewerId) {
        const record = await this.getRecordById(id);
        if (!record) throw new Error('Quarantine record not found');
        if (record.status !== 'pending') throw new Error('File is already reviewed');

        if (fs.existsSync(record.quarantine_path)) {
            await secureShred(record.quarantine_path);
        }

        await db.query(
            "UPDATE quarantine SET status = 'rejected', reviewed_at = CURRENT_TIMESTAMP, reviewed_by = $1 WHERE id = $2",
            [reviewerId, id]
        );

        // Log to security_events
        try {
            await db.query(
                `INSERT INTO security_events (event_type, details) VALUES ($1, $2)`,
                ['QUARANTINE_REJECTED', JSON.stringify({
                    quarantineId: id,
                    originalName: record.original_name,
                    reviewedBy: reviewerId
                })]
            );
        } catch (eventErr) {
            logger.error(`[SecurityService] Event log error for quarantine reject: ${eventErr.message}`);
        }

        eventBus.publish('FILE_QUARANTINE_REJECTED', { id, originalName: record.original_name });
        return true;
    }
}

const securityService = new SecurityService();
module.exports = securityService;
