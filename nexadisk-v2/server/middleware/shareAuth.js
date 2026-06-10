const jwt = require('jsonwebtoken');
const db = require('../config/database');
const logger = require('../utils/logger');
const path = require('path');
const os = require('os');

const SECRET_KEY = process.env.JWT_SECRET || 'nexadisk-default-secret-key-change-in-production';

const validateShare = (requiredPermission) => {
    return async (req, res, next) => {
        const tokenVal = req.params.token || req.body.token || req.query.token;
        if (!tokenVal) {
            return res.status(400).json({ error: 'Share token is required' });
        }

        try {
            // 1. Fetch share link
            const shareRes = await db.query('SELECT * FROM share_links WHERE token = $1', [tokenVal]);
            const share = shareRes.rows[0];
            if (!share) {
                return res.status(404).json({ error: 'Share link not found' });
            }

            // 2. Expiry check
            if (share.expires_at && new Date() > new Date(share.expires_at)) {
                logger.warn(`[Share Auth] Token ${tokenVal} expired by time constraint.`);
                return res.status(410).json({ error: 'Link expired' });
            }

            // 3. Check share type permission compatibility
            // 'download' requires share type download or exchange
            // 'upload' requires share type upload or exchange
            // 'exchange' requires share type exchange
            if (requiredPermission === 'download' && share.type !== 'download' && share.type !== 'exchange') {
                return res.status(403).json({ error: 'Invalid share type for downloads' });
            }
            if (requiredPermission === 'upload' && share.type !== 'upload' && share.type !== 'exchange') {
                return res.status(403).json({ error: 'Invalid share type for uploads' });
            }
            if (requiredPermission === 'exchange' && share.type !== 'exchange') {
                return res.status(403).json({ error: 'Invalid share type for exchange' });
            }

            // 4. Fetch security policies
            const secRes = await db.query('SELECT * FROM share_security WHERE share_id = $1', [share.id]);
            const security = secRes.rows[0] || {
                password_hash: null,
                email_verification: false,
                max_views: -1,
                max_downloads: -1,
                allowed_extensions: null,
                max_file_size: -1
            };

            // 5. Views limit check
            if (security.max_views !== -1) {
                const viewsCountRes = await db.query(
                    "SELECT COUNT(*) FROM share_access_logs WHERE share_link_id = $1 AND status = 'access'",
                    [share.id]
                );
                const viewsCount = parseInt(viewsCountRes.rows[0].count, 10);
                if (viewsCount >= security.max_views) {
                    logger.warn(`[Share Auth] Token ${tokenVal} view limit reached (${viewsCount}/${security.max_views}).`);
                    return res.status(410).json({ error: 'Link expired (view limit reached)' });
                }
            }

            // 6. Downloads limit check (only if action is download)
            if (requiredPermission === 'download' && security.max_downloads !== -1) {
                const downloadsCountRes = await db.query(
                    "SELECT COUNT(*) FROM share_access_logs WHERE share_link_id = $1 AND status = 'download'",
                    [share.id]
                );
                const downloadsCount = parseInt(downloadsCountRes.rows[0].count, 10);
                if (downloadsCount >= security.max_downloads) {
                    logger.warn(`[Share Auth] Token ${tokenVal} download limit reached (${downloadsCount}/${security.max_downloads}).`);
                    return res.status(403).json({ error: 'Download limit exceeded' });
                }
            }

            // 7. Verify security credentials (password/email restriction)
            const passwordRequired = !!security.password_hash;
            const emailRequired = !!security.email_verification;

            if (passwordRequired || emailRequired) {
                const authHeader = req.headers['authorization'];
                const sessionToken = authHeader && authHeader.split(' ')[1];

                if (!sessionToken) {
                    return res.status(401).json({ error: 'Verification required', requiresAuth: true });
                }

                try {
                    const decoded = jwt.verify(sessionToken, SECRET_KEY);
                    if (!decoded || decoded.token !== share.token || decoded.type !== 'SHARE_SESSION_TOKEN') {
                        return res.status(401).json({ error: 'Invalid or expired share session token', requiresAuth: true });
                    }
                    req.shareSession = decoded;
                } catch (jwtErr) {
                    return res.status(401).json({ error: 'Session expired, verification required', requiresAuth: true });
                }
            }

            // Resolve file system path safely
            let sharePath = share.path;
            if (os.platform() !== 'win32' && sharePath.match(/^[a-zA-Z]:\\/)) {
                sharePath = sharePath.replace(/^[a-zA-Z]:\\/, '/').replace(/\\/g, '/');
            }
            share.resolvedPath = path.resolve(sharePath);

            req.share = share;
            req.security = security;
            next();
        } catch (err) {
            logger.error(`[Share Auth Error] ${err.message}`, err);
            res.status(500).json({ error: 'Internal server error verifying share' });
        }
    };
};

module.exports = {
    validateShare,
    SECRET_KEY
};
