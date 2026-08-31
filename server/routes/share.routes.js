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
const storageProvider = require('../utils/storageProvider');

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

    // 1. Check Authorization header (Bearer token)
    const authHeader = req.headers['authorization'];
    const bearerToken = (authHeader && authHeader.startsWith('Bearer ')) ? authHeader.split(' ')[1] : null;
    if (bearerToken) {
        if (bearerToken === share.token || bearerToken === share.id) return true;
        try {
            const decoded = jwt.verify(bearerToken, process.env.JWT_SECRET);
            if (decoded && (decoded.shareId === share.id || decoded.shareId === share.token || decoded.token === share.token)) return true;
        } catch (_) {}
    }

    // 2. Check query token
    if (req.query.token && (req.query.token === share.token || req.query.token === share.id)) return true;

    // 3. Check cookie token
    const cookieToken = getCookie(req, `share_auth_${share.id}`) || 
                        getCookie(req, `share_auth_${share.token}`) || 
                        getCookie(req, `share_auth_${(share.id || '').replace(/-/g, '')}`);
    if (cookieToken) {
        if (cookieToken === 'true' || cookieToken === share.token || cookieToken === share.id) return true;
        try {
            const decoded = jwt.verify(cookieToken, process.env.JWT_SECRET);
            if (decoded && (decoded.shareId === share.id || decoded.shareId === share.token) && decoded.authorized === true) return true;
        } catch (_) {}
    }

    return false;
};

// Resolve paths across Windows UNC, drive letters, Linux mounts, and StorageProvider uploads
const resolveSharedPath = (p) => {
    if (!p) return null;

    // 0. SMB / Network Share Path Preservation (UNC, IP host, smb://)
    const cleanSmb = (p || '').replace(/\\/g, '/').replace(/^(smb:)?\/+/, '');
    const isSmbShare = (p.startsWith('\\\\') || p.startsWith('//') || p.startsWith('smb://') || /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\//.test(cleanSmb));
    if (isSmbShare) {
        return `//${cleanSmb}`;
    }
    
    // 1. Direct path check (Windows or native path)
    try {
        const direct = path.resolve(p);
        if (fs.existsSync(direct)) return direct;
    } catch {}

    // 2. StorageProvider resolution
    try {
        const spPath = storageProvider.resolvePath(p);
        if (fs.existsSync(spPath)) return spPath;
    } catch {}

    // 3. Normalized cross-platform (e.g. D:\path on Linux)
    try {
        let clean = p;
        if (os.platform() !== 'win32' && /^[a-zA-Z]:[\\\/]/.test(clean)) {
            clean = clean.replace(/^[a-zA-Z]:[\\\/]/, '/').replace(/\\/g, '/');
            const norm = path.resolve(clean);
            if (fs.existsSync(norm)) return norm;
        }
    } catch {}

    // 4. Linux Mount Base check (/opt/nexadisk/mnt, ~/.nexadisk/mnt, ../mnt)
    try {
        const mntCandidates = [
            process.env.MNT_BASE,
            '/opt/nexadisk/mnt',
            path.join(os.homedir(), '.nexadisk', 'mnt'),
            path.join(__dirname, '..', 'mnt')
        ];
        const cleanP = p.replace(/\\/g, '/').replace(/^(smb:)?\/+/, '');
        const pParts = cleanP.split('/');
        for (const base of mntCandidates) {
            if (!base) continue;
            if (pParts.length >= 2) {
                const subCandidate = path.resolve(base, pParts.slice(1).join('/'));
                if (fs.existsSync(subCandidate)) return subCandidate;
            }
            const lastCandidate = path.resolve(base, pParts[pParts.length - 1]);
            if (fs.existsSync(lastCandidate)) return lastCandidate;
            const fullCandidate = path.resolve(base, cleanP);
            if (fs.existsSync(fullCandidate)) return fullCandidate;
        }
    } catch {}

    // 5. LocalBase with stripped drive letter / leading slashes
    try {
        const stripped = p.replace(/^[a-zA-Z]:[\\\/]/, '').replace(/^[\\\/]+/, '');
        const localCandidate = path.resolve(storageProvider.localBase, stripped);
        if (fs.existsSync(localCandidate)) return localCandidate;
    } catch {}

    // 6. LocalBase basename match
    try {
        const baseCandidate = path.resolve(storageProvider.localBase, path.basename(p));
        if (fs.existsSync(baseCandidate)) return baseCandidate;
    } catch {}

    // If file isn't on disk, return best-effort resolved path
    try {
        return storageProvider.resolvePath(p);
    } catch {
        return path.resolve(p);
    }
};

const listShareSmbFiles = async (sharePath, subPath = '') => {
    const sharesRes = await db.query('SELECT * FROM network_shares');
    let clean = (sharePath || '').trim().replace(/\\/g, '/').replace(/^(smb:)?\/+/, '');
    const parts = clean.split('/');
    const host = parts[0];
    const shareName = parts[1] || '';
    const uncShare = `//${host}/${shareName}`;

    let internalSub = (subPath || '').replace(/^[\\\/]+/, '').replace(/\\/g, '/');
    if (parts.length > 2) {
        const extraPath = parts.slice(2).join('/');
        internalSub = internalSub ? `${extraPath}/${internalSub}` : extraPath;
    }

    const matchedShare = sharesRes.rows.find(row => {
        let cleanRow = (row.path || '').replace(/\\/g, '/').replace(/^(smb:)?\/+/, '');
        const rowParts = cleanRow.split('/');
        return rowParts[0]?.toLowerCase() === host.toLowerCase() && 
               (rowParts[1] || '').toLowerCase() === shareName.toLowerCase();
    });

    const user = matchedShare?.username || '';
    let pass = '';
    if (matchedShare?.password) {
        try { pass = cryptoHelper.decrypt(matchedShare.password); } catch (e) { pass = matchedShare.password; }
    }

    const env = { ...process.env, PASSWD: pass || '' };
    const safeUser = (user || '').replace(/[;&|`$<>\\"']/g, '');
    const safeShare = uncShare.replace(/[;&|`$<>\\"']/g, '');
    const { exec } = require('child_process');

    // Case 1: Check if the target internal path is a single file directly
    if (internalSub) {
        const allinfoCmd = safeUser
            ? `smbclient "${safeShare}" -U "${safeUser}" -t 10 -c 'allinfo "${internalSub.replace(/"/g, '')}"'`
            : `smbclient "${safeShare}" -N -t 10 -c 'allinfo "${internalSub.replace(/"/g, '')}"'`;

        const infoOut = await new Promise((resolve) => {
            exec(allinfoCmd, { env, timeout: 10000 }, (err, stdout) => {
                resolve(stdout || '');
            });
        });

        const isDirMatch = infoOut.match(/attributes:\s*([A-Za-z0-9_]+)/i);
        const isFile = (infoOut.includes('size:') || infoOut.includes('stream:') || path.extname(internalSub).length > 0) && (!isDirMatch || !isDirMatch[1].includes('D'));

        if (isFile) {
            let size = 0;
            const sizeMatch = infoOut.match(/size:\s+(\d+)/i) || 
                              infoOut.match(/allocation_size:\s+(\d+)/i) ||
                              infoOut.match(/stream:\s+\[[^\]]*\],\s+(\d+)\s+bytes/i);
            if (sizeMatch) size = parseInt(sizeMatch[1], 10);

            // If size is still 0, query via ls
            if (!size) {
                const lsCmd = safeUser
                    ? `smbclient "${safeShare}" -U "${safeUser}" -t 10 -c 'ls "${internalSub.replace(/"/g, '')}"'`
                    : `smbclient "${safeShare}" -N -t 10 -c 'ls "${internalSub.replace(/"/g, '')}"'`;
                const lsOut = await new Promise((res) => {
                    exec(lsCmd, { env, timeout: 10000 }, (e, out) => res(out || ''));
                });
                const lsMatch = lsOut.match(/^(.+?)\s+([DAHRSVN]+)\s+(\d+)\s+/m);
                if (lsMatch) size = parseInt(lsMatch[3], 10) || 0;
            }

            const fileName = path.basename(internalSub);
            return [{
                name: fileName,
                path: '',
                isDirectory: false,
                size,
                modified: new Date(),
                extension: path.extname(fileName).slice(1).toLowerCase()
            }];
        }
    }

    // Case 2: Target is a directory — list directory contents
    const cdCmd = internalSub ? `cd "${internalSub.replace(/"/g, '')}"; ` : '';
    const listCmd = `${cdCmd}ls`;

    const cmd = safeUser
        ? `smbclient "${safeShare}" -U "${safeUser}" -t 10 -c '${listCmd}'`
        : `smbclient "${safeShare}" -N -t 10 -c '${listCmd}'`;

    return new Promise((resolve, reject) => {
        exec(cmd, { env, timeout: 15000 }, (err, stdout, stderr) => {
            if (err) {
                const errMsg = (stderr || stdout || err.message || '').trim();
                return reject(new Error(`Failed to browse SMB files: ${errMsg}`));
            }

            const lines = stdout.split('\n');
            const files = [];

            for (let line of lines) {
                line = line.trim();
                if (!line || line.startsWith('Domain=') || line.startsWith('OS=') || line.startsWith('Server=')) continue;

                const match = line.match(/^(.+?)\s+([DAHRSVN]+)\s+(\d+)\s+([A-Za-z0-9:\s]+)$/);
                if (match) {
                    const name = match[1].trim();
                    const attr = match[2].trim();
                    const size = parseInt(match[3], 10) || 0;
                    const dateStr = match[4].trim();

                    if (name === '.' || name === '..') continue;

                    const isDir = attr.includes('D');
                    const itemRelPath = subPath ? path.join(subPath, name).replace(/\\/g, '/') : name;

                    files.push({
                        name,
                        path: itemRelPath,
                        isDirectory: isDir,
                        size: isDir ? 0 : size,
                        modified: new Date(dateStr) || new Date(),
                        extension: isDir ? '' : path.extname(name).slice(1).toLowerCase()
                    });
                }
            }
            resolve(files);
        });
    });
};

const streamShareSmbFile = async (sharePath, relFilePath = '', req, res, isInline = false) => {
    const sharesRes = await db.query('SELECT * FROM network_shares');
    let combined = sharePath;
    if (relFilePath) {
        combined = path.join(sharePath, relFilePath);
    }
    let clean = combined.trim().replace(/\\/g, '/').replace(/^(smb:)?\/+/, '');
    const parts = clean.split('/');
    const host = parts[0];
    const shareName = parts[1] || '';
    const uncShare = `//${host}/${shareName}`;
    const internalFile = parts.slice(2).join('/');

    const matchedShare = sharesRes.rows.find(row => {
        let cleanRow = (row.path || '').replace(/\\/g, '/').replace(/^(smb:)?\/+/, '');
        const rowParts = cleanRow.split('/');
        return rowParts[0]?.toLowerCase() === host.toLowerCase() && 
               (rowParts[1] || '').toLowerCase() === shareName.toLowerCase();
    });

    const user = matchedShare?.username || '';
    let pass = '';
    if (matchedShare?.password) {
        try { pass = cryptoHelper.decrypt(matchedShare.password); } catch (e) { pass = matchedShare.password; }
    }

    const env = { ...process.env, PASSWD: pass || '' };
    const safeUser = (user || '').replace(/[;&|`$<>\\"']/g, '');
    const safeShare = uncShare.replace(/[;&|`$<>\\"']/g, '');
    const smbCmd = `get "${internalFile.replace(/"/g, '')}" -`;

    const { spawn } = require('child_process');
    const args = safeUser
        ? ['-U', safeUser, safeShare, '-t', '30', '-c', smbCmd]
        : ['-N', safeShare, '-t', '30', '-c', smbCmd];

    const fileName = path.basename(internalFile);
    const mime = require('mime-types');
    const mimeType = (mime && mime.lookup && mime.lookup(fileName)) || 'application/octet-stream';

    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (isInline) {
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    } else {
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    }

    const proc = spawn('smbclient', args, { env });
    proc.on('error', (err) => {
        logger.error(`[SMB Download Spawn Error] ${err.message}`);
        if (!res.headersSent) res.status(500).json({ error: `SMB stream unavailable: ${err.message}` });
    });
    proc.stdout.pipe(res);
};

// Strict path boundary validation (immune to substring prefix traversal)
const isWithinRoot = (rootDir, targetDir) => {
    if (!rootDir || !targetDir) return false;
    const normRoot = rootDir.replace(/\\/g, '/').toLowerCase();
    const normTarget = targetDir.replace(/\\/g, '/').toLowerCase();
    if (normRoot === normTarget) return true;
    if (normTarget.startsWith(normRoot.endsWith('/') ? normRoot : normRoot + '/')) return true;
    const rel = path.relative(normRoot, normTarget);
    return !rel.startsWith('..') && !path.isAbsolute(rel);
};

// Get share + security in one shot
const getShare = async (token) => {
    if (!token) return null;
    try {
        const r = await db.query(`
            SELECT sl.*, 
                   ss.password_hash, ss.email_verification, 
                   ss.max_views, ss.max_downloads, ss.allowed_extensions, ss.max_file_size
            FROM share_links sl
            LEFT JOIN share_security ss ON ss.share_id = sl.id
            WHERE UPPER(sl.token) = UPPER($1) OR sl.id::text = $1
        `, [token]);
        if (r.rows[0]) return r.rows[0];

        // Fallback to legacy shares table safely
        try {
            const legacy = await db.query(`
                SELECT id::text as token, id, path, '' as title, '' as description, 
                       password_hash, email as email_verification, expiry as expires_at,
                       max_views, -1 as max_downloads
                FROM shares
                WHERE UPPER(id::text) = UPPER($1)
            `, [token]);
            if (legacy.rows[0]) return legacy.rows[0];
        } catch (legErr) {
            // Ignore legacy table error if schema differs
        }
        return null;
    } catch (e) {
        logger.error('[getShare DB error]', e);
        return null;
    }
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
        let fileCount = 1;
        let totalSize = 0;
        if (share.type !== 'upload') {
            try {
                const resolved = resolveSharedPath(share.path);
                if (fs.existsSync(resolved)) {
                    const stat = fs.statSync(resolved);
                    if (stat.isDirectory()) {
                        const entries = fs.readdirSync(resolved);
                        fileCount = entries.length;
                        totalSize = stat.size;
                    } else {
                        fileCount = 1;
                        totalSize = stat.size;
                    }
                } else {
                    const isSmb = (share.path || '').startsWith('\\\\') || (share.path || '').startsWith('//') || (share.path || '').startsWith('smb://');
                    if (isSmb) {
                        try {
                            const smbFiles = await listShareSmbFiles(share.path, '');
                            if (smbFiles && smbFiles.length > 0) {
                                fileCount = smbFiles.length;
                                totalSize = smbFiles.reduce((acc, f) => acc + (f.size || 0), 0);
                            }
                        } catch (_) {}
                    }
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

        const extractCleanName = (p) => {
            if (!p) return 'Shared Item';
            const normalized = String(p).replace(/\\/g, '/').replace(/\/+$/, '');
            const parts = normalized.split('/').filter(Boolean);
            return parts.length > 0 ? parts[parts.length - 1] : p;
        };

        const resolvedTitle = share.title || extractCleanName(share.path);

        res.json({
            token: share.token,
            type: share.type,
            title: resolvedTitle,
            path: '', // Sanitized: hide internal storage paths from guest client
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
    const { password, authDigest, otpCode, email } = req.body;
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
        if (password !== undefined || authDigest !== undefined) {
            if (!share.password_hash) return res.status(400).json({ error: 'No password required' });
            
            let realPlain = '';
            if (share.password_hash.startsWith('AES:')) {
                realPlain = decryptPassword(share.password_hash);
            }

            let ok = false;
            if (authDigest && realPlain) {
                const expectedDigest = crypto.createHash('sha256').update(`${realPlain}:${req.params.token}:nexadisk-vault-auth`).digest('hex');
                ok = (authDigest.toLowerCase() === expectedDigest.toLowerCase());
            } else if (password !== undefined) {
                if (share.password_hash.startsWith('AES:')) {
                    ok = (realPlain === String(password));
                } else {
                    ok = await bcrypt.compare(String(password), share.password_hash);
                }
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

            try {
                const shareTitle = share.title || path.basename(share.path || '') || 'Shared Resource';
                await emailService.sendVerificationCode(email, code, shareTitle);
            } catch (mailErr) {
                logger.error('[Share OTP Email Error]', mailErr);
                return res.status(500).json({ error: 'Failed to send verification code email' });
            }

            return res.json({ success: true, message: 'Verification code sent to email' });
        }

        // Email OTP — verify OTP
        if (otpCode) {
            if (!email) return res.status(400).json({ error: 'Email is required to verify OTP' });
            const stored = otpStore.get(`${share.token}:${email}`);
            if (!stored) return res.status(400).json({ error: 'No OTP requested or code expired' });
            if (Date.now() > stored.expires) {
                otpStore.delete(`${share.token}:${email}`);
                return res.status(400).json({ error: 'Verification code has expired' });
            }
            if (stored.code !== String(otpCode).trim()) {
                await logAccess(share.id, req, 'invalid_otp');
                return res.status(401).json({ error: 'Invalid verification code' });
            }

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

        const shareRoot = resolveSharedPath(share.path);
        let resolved = shareRoot;
        if (req.query.path) {
            resolved = resolveSharedPath(path.join(share.path, req.query.path));
        }

        // Security: must be within share root
        if (!isWithinRoot(shareRoot, resolved)) {
            return res.status(403).json({ error: 'Path traversal not allowed' });
        }

        if (!fs.existsSync(resolved)) {
            // Check if share.path is an SMB/Network share
            const isSmb = (share.path || '').startsWith('\\\\') || (share.path || '').startsWith('//') || (share.path || '').startsWith('smb://');
            if (isSmb) {
                try {
                    const smbEntries = await listShareSmbFiles(share.path, req.query.path || '');
                    if (smbEntries && smbEntries.length > 0) {
                        return res.json(smbEntries);
                    }
                } catch (smbErr) {
                    logger.warn(`[Share Files SMB Fallback Failed] ${smbErr.message}`);
                }

                // If listShareSmbFiles was empty or threw, but share.path is a single file with an extension:
                const cleanSmbPath = (share.path || '').replace(/\\/g, '/');
                const smbFileName = path.basename(cleanSmbPath);
                const hasExt = path.extname(smbFileName).length > 0;
                if (hasExt && !req.query.path) {
                    return res.json([{
                        name: smbFileName,
                        path: '',
                        isDirectory: false,
                        size: 0,
                        modified: new Date(),
                        extension: path.extname(smbFileName).slice(1).toLowerCase()
                    }]);
                }
            }

            logger.warn(`[Share Files] Path does not exist: "${resolved}" for share token "${req.params.token}"`);
            return res.status(404).json({ error: 'Shared file or directory not found on disk' });
        }

        let stat;
        try {
            stat = fs.statSync(resolved);
        } catch (statErr) {
            logger.warn(`[Share Files] Failed to stat path "${resolved}": ${statErr.message}`);
            return res.status(404).json({ error: 'Unable to access shared item' });
        }

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

        let entries = [];
        try {
            entries = fs.readdirSync(resolved).map(name => {
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
        } catch (dirErr) {
            logger.warn(`[Share Files] Failed to read directory "${resolved}": ${dirErr.message}`);
            return res.json([]);
        }

        res.json(entries);
    } catch (e) {
        logger.error('[Share Files Error]', e);
        res.status(e.code === 'ENOENT' ? 404 : 500).json({ error: e.message || 'Cannot read directory' });
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
        const shareRoot = resolveSharedPath(share.path);
        const fullPath = targetRel ? resolveSharedPath(path.join(share.path, targetRel)) : shareRoot;

        if (!isWithinRoot(shareRoot, fullPath)) {
            return res.status(403).json({ error: 'Path traversal not allowed' });
        }

        if (!fs.existsSync(fullPath)) {
            const isSmb = (share.path || '').startsWith('\\\\') || (share.path || '').startsWith('//') || (share.path || '').startsWith('smb://');
            if (isSmb) {
                await logAccess(share.id, req, intent === 'stream' ? 'stream_get' : 'download');
                return await streamShareSmbFile(share.path, targetRel, req, res, intent === 'stream');
            }
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
        const shareRoot = resolveSharedPath(share.path);
        const fullPath = targetRel ? resolveSharedPath(path.join(share.path, targetRel)) : shareRoot;

        if (!isWithinRoot(shareRoot, fullPath)) {
            return res.status(403).json({ error: 'Path traversal not allowed' });
        }

        if (!fs.existsSync(fullPath)) {
            const isSmb = (share.path || '').startsWith('\\\\') || (share.path || '').startsWith('//') || (share.path || '').startsWith('smb://');
            if (isSmb) {
                await logAccess(share.id, req, 'download');
                return await streamShareSmbFile(share.path, targetRel, req, res, false);
            }
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
    dest: securityQueue.getStagingDir(),
    limits: { fileSize: 5 * 1024 * 1024 * 1024 } // 5GB max
});

router.post('/upload/:token', upload.array('files'), async (req, res) => {
    try {
        const share = await getShare(req.params.token);
        if (!share) {
            (req.files || []).forEach(f => { try { fs.unlinkSync(f.path); } catch(_) {} });
            return res.status(404).json({ error: 'Share link not found or expired' });
        }

        const err = checkShareActive(share);
        if (err) {
            (req.files || []).forEach(f => { try { fs.unlinkSync(f.path); } catch(_) {} });
            return res.status(404).json({ error: err });
        }

        if (!isShareAuthorized(req, share)) {
            (req.files || []).forEach(f => { try { fs.unlinkSync(f.path); } catch(_) {} });
            return res.status(401).json({ error: 'Authentication required', authRequired: true });
        }

        if (share.type !== 'upload' && share.type !== 'exchange') {
            (req.files || []).forEach(f => { try { fs.unlinkSync(f.path); } catch(_) {} });
            return res.status(403).json({ error: 'This share does not accept uploads' });
        }

        const targetDir = resolveSharedPath(share.path);
        
        const uploaded = [];
        for (const file of (req.files || [])) {
            const safeName = path.basename(file.originalname);
            securityQueue.addFileToQueue(file.path, safeName, targetDir, share.id, null);
            uploaded.push({ name: safeName, size: file.size, status: 'queued' });
        }

        await logAccess(share.id, req, 'upload');
        res.json({ success: true, message: 'Uploads received and queued for security scanning', uploaded });
    } catch (e) {
        (req.files || []).forEach(f => { try { fs.unlinkSync(f.path); } catch(_) {} });
        logger.error('[Share Upload Error]', e);
        res.status(500).json({ error: e.message || 'Upload failed' });
    }
});

module.exports = router;
