const jwt = require('jsonwebtoken');
const db = require('../config/database');
const logger = require('../utils/logger');

if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'nexadisk-default-secret-key-change-in-production') {
    throw new Error('FATAL: JWT_SECRET is not set or is using the insecure default value. Set a strong secret in .env');
}
const SECRET_KEY = process.env.JWT_SECRET;

// 🔑 Token Verification Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = (authHeader && authHeader.split(' ')[1]) || req.query.token;

    if (!token) return res.status(401).json({ error: 'Access token required' });

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(401).json({ error: 'Invalid or expired token' });
        req.user = user;
        next();
    });
};

// 🛡️ Role-Based Access Control (RBAC) Middleware
const requireRole = (allowedRoles = []) => {
    return (req, res, next) => {
        if (!req.user) return res.status(401).json({ error: 'Authentication required' });
        
        // Admins bypass all role checks
        if (req.user.role === 'Admin') return next();

        // Guest users with write access (Edit or Full Access) bypass role checks for User routes
        if (req.user.isGuest) {
            const hasWriteAccess = req.user.permissions === 'Edit' || req.user.permissions === 'Full Access';
            if (hasWriteAccess && allowedRoles.includes('User')) {
                return next();
            }
        }

        if (allowedRoles.includes(req.user.role)) {
            return next();
        }

        logger.warn(`[RBAC Block] User "${req.user.username}" (Role: ${req.user.role}) denied access to ${req.originalUrl}`);
        res.status(403).json({ error: 'Insufficient privileges: Access denied' });
    };
};

// 🔗 Guest Share Access Validation Middleware
const validateShareAccess = (requiredPermission) => {
    return async (req, res, next) => {
        const { id } = req.params;
        try {
            const shareRes = await db.query('SELECT * FROM share_links WHERE id = $1', [id]);
            const share = shareRes.rows[0];

            if (!share) return res.status(404).json({ error: 'Share link not found' });

            // Handle cross-platform path formatting
            const os = require('os');
            const path = require('path');
            let sharePath = share.path;
            if (os.platform() !== 'win32' && sharePath.match(/^[a-zA-Z]:\\/)) {
                sharePath = sharePath.replace(/^[a-zA-Z]:\\/, '/').replace(/\\/g, '/');
            }
            share.resolvedPath = path.resolve(sharePath);

            // Determine if the guest holds a valid active session token
            const authHeader = req.headers['authorization'];
            const token = (authHeader && authHeader.split(' ')[1]) || req.query.token;
            let hasActiveSession = false;

            if (token) {
                try {
                    const decoded = jwt.verify(token, SECRET_KEY);
                    if (decoded && decoded.shareId === id) {
                        hasActiveSession = true;
                    }
                } catch (e) {
                    // Invalid guest token
                }
            }

            // Verify credentials (password/email restriction) if no active session
            if ((share.password_hash || share.email) && !hasActiveSession) {
                return res.status(401).json({ error: 'Verification credentials required to access share' });
            }

            // Expiry Checks
            const now = new Date();
            const expiry = new Date(share.expiry);

            if (now > expiry) {
                logger.warn(`[Share Expiry] ID: ${id} expired by time constraint.`);
                await db.query('DELETE FROM share_links WHERE id = $1', [id]);
                return res.status(410).json({ error: 'Link expired' });
            }

            if (!hasActiveSession && share.max_views !== -1 && share.view_count >= share.max_views) {
                logger.warn(`[Share Expiry] ID: ${id} expired by view count limit.`);
                await db.query('DELETE FROM share_links WHERE id = $1', [id]);
                return res.status(410).json({ error: 'Link expired' });
            }

            // Validate specific permission permissions
            const sharePerm = share.permissions;
            let allowed = false;

            if (requiredPermission === 'Upload') {
                allowed = (sharePerm === 'Upload' || sharePerm === 'Edit' || sharePerm === 'Full Access');
            } else if (requiredPermission === 'View') {
                allowed = (sharePerm === 'View' || sharePerm === 'Edit' || sharePerm === 'Full Access');
            } else if (requiredPermission === 'Edit') {
                allowed = (sharePerm === 'Edit' || sharePerm === 'Full Access');
            } else if (requiredPermission === 'Full Access') {
                allowed = (sharePerm === 'Full Access');
            }

            if (!allowed) {
                return res.status(403).json({ error: `Insufficient permissions. "${requiredPermission}" access required.` });
            }

            req.share = share;
            next();
        } catch (err) {
            logger.error(`[Share Verification Error] Failed to validate: ${err.message}`, err);
            res.status(500).json({ error: `Server error verifying share: ${err.message}` });
        }
    };
};

const authenticateGuest = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Guest session token required' });

    jwt.verify(token, SECRET_KEY, async (err, decoded) => {
        if (err || decoded.type !== 'GUEST_TOKEN') {
            return res.status(401).json({ error: 'Invalid or expired guest token' });
        }
        try {
            const shareRes = await db.query('SELECT * FROM share_links WHERE id = $1', [decoded.shareId]);
            const share = shareRes.rows[0];
            if (!share) return res.status(404).json({ error: 'Share link no longer exists' });

            if (new Date() > new Date(share.expiry)) {
                return res.status(410).json({ error: 'Link expired' });
            }

            req.share = share;
            req.guest = decoded;
            next();
        } catch (dbErr) {
            res.status(500).json({ error: 'Database verification error' });
        }
    });
};

const authenticateUpload = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Upload authorization token required' });

    jwt.verify(token, SECRET_KEY, async (err, decoded) => {
        if (err || decoded.type !== 'UPLOAD_TOKEN') {
            return res.status(401).json({ error: 'Invalid or expired upload authorization' });
        }
        try {
            const shareRes = await db.query('SELECT * FROM share_links WHERE id = $1', [decoded.shareId]);
            const share = shareRes.rows[0];
            if (!share) return res.status(404).json({ error: 'Share link no longer exists' });

            if (new Date() > new Date(share.expiry)) {
                return res.status(410).json({ error: 'Link expired' });
            }

            req.share = share;
            req.upload = decoded;
            next();
        } catch (dbErr) {
            res.status(500).json({ error: 'Database verification error' });
        }
    });
};

module.exports = {
    authenticateToken,
    requireRole,
    validateShareAccess,
    authenticateGuest,
    authenticateUpload,
    SECRET_KEY
};
