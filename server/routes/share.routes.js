/**
 * share.routes.js — PUBLIC SHARE GATEWAY
 * All routes here are public (no NexaDisk login required).
 * Mounted at /api/share
 *
 * GET  /api/share/info/:token       — Get share metadata
 * POST /api/share/auth/:token       — Authenticate (password or OTP)
 * GET  /api/share/files/:token      — Browse files inside share
 * POST /api/share/stream            — Download a file from share
 * POST /api/share/upload/:token     — Upload files to a share (upload-type shares)
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const os = require('os');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const archiver = require('archiver');
const db = require('../config/database');
const logger = require('../utils/logger');
const { decryptPassword } = require('../utils/crypto');

const jwt = require('jsonwebtoken');
const emailService = require('../services/emailService');

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const getCookie = (req, name) => {
    const raw = req.headers.cookie;
    if (!raw) return null;
    const parts = raw.split(';');
    for (const part of parts) {
        const [k, v] = part.split('=');
        if (k && k.trim() === name) return v ? decodeURIComponent(v.trim()) : '';
    }
    return null;
};

const isShareAuthorized = (req, share) => {
    if (!share) return false;
    if (!share.password_hash && !share.email_verification) return true;
    const cookieToken = getCookie(req, `share_auth_${share.id}`);
    if (!cookieToken) return false;
    try {
        const decoded = jwt.verify(cookieToken, process.env.JWT_SECRET);
        return decoded && decoded.shareId === share.id && decoded.authorized === true;
    } catch (e) {
        return false;
    }
};

// Resolve a Windows-style path on any OS
const resolvePath = (p) => {
    if (!p) return null;
    if (os.platform() !== 'win32' && /^[a-zA-Z]:[\\\/]/.test(p)) {
        p = p.replace(/^[a-zA-Z]:[\\\/]/, '/').replace(/\\/g, '/');
    }
    return path.resolve(p);
};

// Strict path boundary validation (immune to substring prefix traversal)
const isWithinRoot = (rootDir, targetDir) => {
    if (!rootDir || !targetDir) return false;
    const rel = path.relative(rootDir, targetDir);
    return !rel.startsWith('..') && !path.isAbsolute(rel);
};

// Get share + security in one shot
const getShare = async (token) => {
    const r = await db.query(`
        SELECT sl.*, 
               ss.password_hash, ss.email_verification, 
               ss.max_views, ss.max_downloads, ss.allowed_extensions, ss.max_file_size
        FROM share_links sl
        LEFT JOIN share_security ss ON ss.share_id = sl.id
        WHERE sl.token = $1
    `, [token]);
    return r.rows[0] || null;
};

// Count views for a share
const getViewCount = async (shareId) => {
    const r = await db.query(
        `SELECT COUNT(*) FROM share_access_logs WHERE share_link_id = $1 AND status = 'access'`,
        [shareId]
    );
    return parseInt(r.rows[0].count, 10);
};

const accessDebounce = new Map();

// Periodically purge expired OTP codes to prevent memory leak (runs every 5 minutes)
setInterval(() => {
    const now = Date.now();
    for (const [key, record] of otpStore.entries()) {
        if (record.expires && now > record.expires) {
            otpStore.delete(key);
        }
    }
    // Also prune expired auth attempt records older than 1 hour
    for (const [key, record] of authAttempts.entries()) {
        if (record.lockedUntil && now > record.lockedUntil + 3600000) {
            authAttempts.delete(key);
        }
    }
}, 5 * 60 * 1000).unref();

// Log an access event
const logAccess = async (shareId, req, status) => {
    try {
        const ip = req.ip || '';
        
        // Prevent double-counting from React StrictMode (debounce 2 seconds)
        if (status === 'access') {
            const debounceKey = `${shareId}:${ip}`;
            const lastAccess = accessDebounce.get(debounceKey);
            if (lastAccess && Date.now() - lastAccess < 2000) {
                return; // Silently skip strict-mode double fires
            }
            accessDebounce.set(debounceKey, Date.now());
        }

        await db.query(
            `INSERT INTO share_access_logs (share_link_id, ip_address, user_agent, country_code, status)
             VALUES ($1, $2, $3, $4, $5)`,
            [shareId, ip, (req.headers['user-agent'] || '').slice(0, 150), req.headers['cf-ipcountry'] || 'XX', status]
        );
    } catch (e) {
        logger.error('[logAccess Error]', e);
    }
};

// Validate share is still active
const checkShareActive = (share) => {
    if (!share) return 'Share link not found';
    if (share.expires_at && new Date() > new Date(share.expires_at)) return 'Share link has expired';
    return null;
};

// In-memory OTP store { token: { code, email, expires } }
const otpStore = new Map();

// In-memory brute force lockout store { ip_token: { attempts, lockedUntil } }
const authAttempts = new Map();
const MAX_AUTH_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// ─── GET /api/share/info/:token ────────────────────────────────────────────────
// Public — returns metadata about a share link (no auth required)
router.get('/info/:token', async (req, res) => {
    try {
        const share = await getShare(req.params.token);
        const err = checkShareActive(share);
        if (err) return res.status(404).json({ error: err });

        const ip = req.ip || '';
        const debounceKey = `${share.id}:${ip}`;
        const lastAccess = accessDebounce.get(debounceKey);
        const isDebounced = lastAccess && (Date.now() - lastAccess < 2000);

        // Check view limit (bypass if it's a debounced StrictMode double-fire)
        if (!isDebounced && share.max_views !== null && share.max_views > 0) {
            const views = await getViewCount(share.id);
            if (views >= share.max_views) {
                return res.status(410).json({ error: 'View limit reached — link is exhausted' });
            }
        }

        // Get file stats (Fast non-blocking check)
        let fileCount = 0;
        let totalSize = 0;
        if (share.type !== 'upload') {
            try {
                const resolved = resolvePath(share.path);
                const stat = fs.statSync(resolved);
                if (stat.isDirectory()) {
                    const entries = fs.readdirSync(resolved);
                    fileCount = entries.length;
                    totalSize = stat.size;
                } else {
                    fileCount = 1;
                    totalSize = stat.size;
                }
            } catch {}
        }

        // Owner name
        let ownerName = 'NexaDisk';
        if (share.owner_id) {
            const u = await db.query('SELECT username FROM users WHERE id = $1', [share.owner_id]);
            if (u.rows[0]) ownerName = u.rows[0].username;
        }

        await logAccess(share.id, req, 'access');

        res.json({
            token: share.token,
            type: share.type,
            title: share.title || path.basename(share.path || '') || 'Shared',
            description: share.description || '',
            ownerName,
            expires_at: share.expires_at,
            passwordRequired: !!share.password_hash,
            emailRequired: !!share.email_verification,
            fileCount,
            totalSize,
        });
    } catch (e) {
        logger.error('[Share Info Error]', e);
        res.status(500).json({ error: 'Server error' });
    }
});

// ─── POST /api/share/auth/:token ──────────────────────────────────────────────
// Public — authenticate with password or verify OTP
router.post('/auth/:token', async (req, res) => {
    const { password, otpCode, email } = req.body;
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const lockKey = `${ip}:${req.params.token}`;

    // 1. Check if IP/Token is currently locked out
    const attemptRecord = authAttempts.get(lockKey);
    if (attemptRecord && attemptRecord.lockedUntil && Date.now() < attemptRecord.lockedUntil) {
        const remainingMinutes = Math.ceil((attemptRecord.lockedUntil - Date.now()) / 60000);
        return res.status(429).json({ 
            error: `Too many failed passkey attempts. Access locked for ${remainingMinutes} minute(s).` 
        });
    }

    try {
        const share = await getShare(req.params.token);
        const err = checkShareActive(share);
        if (err) return res.status(404).json({ error: err });

        // Password auth
        if (password !== undefined) {
            if (!share.password_hash) return res.status(400).json({ error: 'No password required' });
            
            let ok = false;
            if (share.password_hash.startsWith('AES:')) {
                ok = decryptPassword(share.password_hash) === String(password);
            } else {
                // Fallback for existing bcrypt hashes
                ok = await bcrypt.compare(String(password), share.password_hash);
            }

            if (!ok) {
                // Record failed attempt
                const currentAttempts = (attemptRecord?.attempts || 0) + 1;
                if (currentAttempts >= MAX_AUTH_ATTEMPTS) {
                    authAttempts.set(lockKey, { 
                        attempts: currentAttempts, 
                        lockedUntil: Date.now() + LOCKOUT_DURATION_MS 
                    });
                    logger.warn(`[Security Alert] IP ${ip} locked out after ${currentAttempts} failed passkey attempts on share token "${req.params.token}".`);
                } else {
                    authAttempts.set(lockKey, { attempts: currentAttempts, lockedUntil: null });
                }

                await logAccess(share.id, req, 'invalid_password');
                const remaining = MAX_AUTH_ATTEMPTS - currentAttempts;
                return res.status(401).json({ 
                    error: currentAttempts >= MAX_AUTH_ATTEMPTS 
                        ? 'Too many failed attempts. Passkey access has been locked for 5 minutes.' 
                        : `Incorrect passkey. ${remaining} attempt(s) remaining before lockout.` 
                });
            }

            // Success - clear lockout record
            authAttempts.delete(lockKey);
            await logAccess(share.id, req, 'auth_password');
            const signedToken = jwt.sign({ shareId: share.id, authorized: true }, process.env.JWT_SECRET, { expiresIn: '24h' });
            res.setHeader('Set-Cookie', `share_auth_${share.id}=${signedToken}; Path=/; HttpOnly; Max-Age=86400; SameSite=Lax`);
            return res.json({ success: true, token: share.token });
        }

        // Email OTP — request OTP
        if (email !== undefined && !otpCode) {
            if (!share.email_verification) return res.status(400).json({ error: 'Email verification not required' });
            const code = crypto.randomInt(100000, 999999).toString();
            otpStore.set(`${share.token}:${email}`, { code, expires: Date.now() + 10 * 60 * 1000 });
            logger.info(`[Share OTP] Code generated for share "${share.token}" -> ${email}`);
            
            // Dispatch real email via SMTP
            const shareTitle = share.title || path.basename(share.path || '') || 'Shared Resource';
            const emailResult = await emailService.sendOTP({
                to: email,
                otpCode: code,
                shareTitle,
                expiresMinutes: 10
            });

            if (!emailResult.success) {
                logger.warn(`[Share OTP] Email dispatch failed: ${emailResult.error}`);
            }

            return res.json({ 
                success: true, 
                message: 'OTP sent to email',
                simulated: !!emailResult.simulated
            });
        }

        // OTP verify — with brute-force lockout (same lockout as password auth)
        if (otpCode && email) {
            // Check lockout before verifying OTP
            const otpLockRecord = authAttempts.get(lockKey);
            if (otpLockRecord && otpLockRecord.lockedUntil && Date.now() < otpLockRecord.lockedUntil) {
                const remainingMinutes = Math.ceil((otpLockRecord.lockedUntil - Date.now()) / 60000);
                return res.status(429).json({ 
                    error: `Too many failed OTP attempts. Access locked for ${remainingMinutes} minute(s).` 
                });
            }

            const record = otpStore.get(`${share.token}:${email}`);
            if (!record || record.code !== String(otpCode) || Date.now() > record.expires) {
                // Track failed OTP attempts with same lockout mechanism
                const currentAttempts = (otpLockRecord?.attempts || 0) + 1;
                if (currentAttempts >= MAX_AUTH_ATTEMPTS) {
                    authAttempts.set(lockKey, { attempts: currentAttempts, lockedUntil: Date.now() + LOCKOUT_DURATION_MS });
                    logger.warn(`[Security Alert] IP ${ip} locked out after ${currentAttempts} failed OTP attempts on share "${req.params.token}".`);
                } else {
                    authAttempts.set(lockKey, { attempts: currentAttempts, lockedUntil: null });
                }
                await logAccess(share.id, req, 'invalid_otp');
                const remaining = MAX_AUTH_ATTEMPTS - currentAttempts;
                return res.status(401).json({ 
                    error: currentAttempts >= MAX_AUTH_ATTEMPTS
                        ? 'Too many failed OTP attempts. Access locked for 5 minutes.'
                        : `Invalid or expired OTP. ${remaining} attempt(s) remaining before lockout.`
                });
            }
            // Success - clear lockout
            authAttempts.delete(lockKey);
            otpStore.delete(`${share.token}:${email}`);
            await logAccess(share.id, req, 'auth_otp');
            const signedToken = jwt.sign({ shareId: share.id, authorized: true }, process.env.JWT_SECRET, { expiresIn: '24h' });
            res.setHeader('Set-Cookie', `share_auth_${share.id}=${signedToken}; Path=/; HttpOnly; Max-Age=86400; SameSite=Lax`);
            return res.json({ success: true, token: share.token });
        }

        res.status(400).json({ error: 'Invalid auth request' });
    } catch (e) {
        logger.error('[Share Auth Error]', e);
        res.status(500).json({ error: 'Server error' });
    }
});

// ─── GET /api/share/files/:token ──────────────────────────────────────────────
// Public (after auth) — list files inside a share
router.get('/files/:token', async (req, res) => {
    try {
        const share = await getShare(req.params.token);
        const err = checkShareActive(share);
        if (err) return res.status(404).json({ error: err });

        if (!isShareAuthorized(req, share)) {
            return res.status(401).json({ error: 'Authentication required', authRequired: true });
        }

        const subPath = req.query.path ? path.join(share.path, req.query.path) : share.path;
        const resolved = resolvePath(subPath);

        // Security: must be within share root
        const shareRoot = resolvePath(share.path);
        if (!isWithinRoot(shareRoot, resolved)) {
            return res.status(403).json({ error: 'Path traversal not allowed' });
        }

        const stat = fs.statSync(resolved);
        if (stat.isFile()) {
            return res.json([{
                name: path.basename(resolved),
                path: '',
                isDirectory: false,
                size: stat.size,
                modified: stat.mtime,
                extension: path.extname(resolved).slice(1).toLowerCase()
            }]);
        }

        const entries = fs.readdirSync(resolved).map(name => {
            try {
                const fp = path.join(resolved, name);
                const s = fs.statSync(fp);
                return {
                    name,
                    path: req.query.path ? path.join(req.query.path, name).replace(/\\/g, '/') : name,
                    isDirectory: s.isDirectory(),
                    size: s.isDirectory() ? 0 : s.size,
                    modified: s.mtime,
                    extension: s.isDirectory() ? '' : path.extname(name).slice(1).toLowerCase()
                };
            } catch { return null; }
        }).filter(Boolean);

        res.json(entries);
    } catch (e) {
        logger.error('[Share Files Error]', e);
        res.status(500).json({ error: 'Cannot read directory' });
    }
});

// ─── GET /api/share/stream ───────────────────────────────────────────────────
// Public (after auth) — stream file download or inline display for media viewers
router.get('/stream', async (req, res) => {
    const { token, filePath, intent } = req.query;
    try {
        const share = await getShare(token);
        const err = checkShareActive(share);
        if (err) return res.status(404).json({ error: err });

        if (!isShareAuthorized(req, share)) {
            return res.status(401).json({ error: 'Authentication required', authRequired: true });
        }

        const targetRel = filePath || '';
        const fullPath = resolvePath(path.join(share.path, targetRel));
        const shareRoot = resolvePath(share.path);

        if (!isWithinRoot(shareRoot, fullPath)) {
            return res.status(403).json({ error: 'Path traversal not allowed' });
        }

        if (!fs.existsSync(fullPath)) {
            return res.status(404).json({ error: 'File not found' });
        }

        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            return res.status(400).json({ error: 'Cannot stream directory via GET' });
        }

        await logAccess(share.id, req, 'stream_get');

        res.setHeader('X-Content-Type-Options', 'nosniff');
        if (intent === 'stream') {
            res.type(path.extname(fullPath) || 'application/octet-stream');
            return res.sendFile(fullPath);
        }

        return res.download(fullPath, path.basename(fullPath));
    } catch (e) {
        logger.error('[Share GET Stream Error]', e);
        if (!res.headersSent) res.status(500).json({ error: 'Stream failed' });
    }
});

// ─── POST /api/share/stream ───────────────────────────────────────────────────
// Public (after auth) — stream file download or folder as zip
router.post('/stream', async (req, res) => {
    const { token, filePath } = req.body;
    try {
        const share = await getShare(token);
        const err = checkShareActive(share);
        if (err) return res.status(404).json({ error: err });

        if (!isShareAuthorized(req, share)) {
            return res.status(401).json({ error: 'Authentication required', authRequired: true });
        }

        const targetRel = filePath || '';
        const fullPath = resolvePath(path.join(share.path, targetRel));
        const shareRoot = resolvePath(share.path);

        if (!isWithinRoot(shareRoot, fullPath)) {
            return res.status(403).json({ error: 'Path traversal not allowed' });
        }

        if (!fs.existsSync(fullPath)) {
            return res.status(404).json({ error: 'File not found' });
        }

        await logAccess(share.id, req, 'download');

        const stat = fs.statSync(fullPath);
        res.setHeader('X-Content-Type-Options', 'nosniff');

        if (stat.isDirectory()) {
            const safeZipName = (path.basename(fullPath) || 'archive').replace(/[^\w\s\.-]/gi, '_');
            res.setHeader('Content-Disposition', `attachment; filename="${safeZipName}.zip"`);
            res.setHeader('Content-Type', 'application/zip');
            const archive = archiver('zip', { zlib: { level: 6 } });
            archive.on('error', (err) => {
                logger.error('[Share ZIP Error]', err);
                if (!res.headersSent) res.status(500).end();
            });
            archive.pipe(res);
            archive.directory(fullPath, safeZipName);
            await archive.finalize();
        } else {
            return res.download(fullPath, path.basename(fullPath));
        }
    } catch (e) {
        logger.error('[Share Stream Error]', e);
        if (!res.headersSent) res.status(500).json({ error: 'Download failed' });
    }
});

// ─── POST /api/share/upload/:token ────────────────────────────────────────────
// Public — upload files to an upload-type share
const multer = require('multer');
const securityQueue = require('../services/securityQueue');

const upload = multer({
    storage: multer.diskStorage({
        destination: async (req, file, cb) => {
            try {
                const share = await getShare(req.params.token);
                if (!share || share.type !== 'upload') return cb(new Error('Invalid upload share'));
                if (!isShareAuthorized(req, share)) {
                    return cb(new Error('Authentication required'));
                }
                req.shareObj = share;
                cb(null, securityQueue.getStagingDir());
            } catch (e) { cb(e); }
        },
        filename: (req, file, cb) => {
            cb(null, `${Date.now()}-${Math.random().toString(36).substring(2, 8)}-${file.originalname}`);
        }
    }),
    limits: { fileSize: 5 * 1024 * 1024 * 1024 } // 5GB max
});

router.post('/upload/:token', upload.array('files'), async (req, res) => {
    try {
        const share = req.shareObj || await getShare(req.params.token);
        const err = checkShareActive(share);
        if (err) return res.status(404).json({ error: err });
        if (!isShareAuthorized(req, share)) {
            return res.status(401).json({ error: 'Authentication required', authRequired: true });
        }
        if (share.type !== 'upload') return res.status(403).json({ error: 'This share does not accept uploads' });

        const targetDir = resolvePath(share.path);
        
        const uploaded = [];
        for (const file of (req.files || [])) {
            const safeName = path.basename(file.originalname);
            securityQueue.addFileToQueue(file.path, safeName, targetDir, share.id, null);
            uploaded.push({ name: safeName, size: file.size, status: 'queued' });
        }

        await logAccess(share.id, req, 'upload');
        res.json({ success: true, message: 'Uploads queued for security scanning', uploaded });
    } catch (e) {
        logger.error('[Share Upload Error]', e);
        res.status(500).json({ error: 'Upload failed' });
    }
});

module.exports = router;
