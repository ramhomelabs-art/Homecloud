const jwt = require('jsonwebtoken');
const path = require('path');
const os = require('os');
const db = require('../config/database');

const SECRET_KEY = process.env.JWT_SECRET;

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = (authHeader && authHeader.split(' ')[1]) || req.query.token;
    if (!token) return res.sendStatus(401);
    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

const requireAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'Administrator') return next();
    res.status(403).json({ error: 'Access denied: Administrator role required' });
};

const validateShareAccess = (requiredPermission) => {
    return (req, res, next) => {
        const { id } = req.params;
        db.get("SELECT * FROM shares WHERE id = ?", [id], async (err, share) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!share) return res.status(404).json({ error: 'Share not found' });

            // Robust path handling for cross-platform legacy shares
            let sharePath = share.path;
            if (os.platform() !== 'win32' && sharePath.match(/^[a-zA-Z]:\\/)) {
                sharePath = sharePath.replace(/^[a-zA-Z]:\\/, '/').replace(/\\/g, '/');
            }
            share.resolvedPath = path.resolve(sharePath);

            // Determine if the client holds a valid guest token session for this share
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
                    // Invalid/expired token
                }
            }

            const now = new Date();
            const expiry = new Date(share.expiry);

            if (now > expiry) {
                console.log(`[Share Expiry] ID: ${id} Expired: Time limit reached. (Now: ${now.toISOString()}, Exp: ${expiry.toISOString()})`);
                db.run("DELETE FROM shares WHERE id = ?", [id]);
                return res.status(410).json({ error: 'Link expired' });
            }

            // Exceeded views: only block/delete if they do not have an active guest session
            if (!hasActiveSession && share.max_views !== -1 && share.view_count >= share.max_views) {
                console.log(`[Share Expiry] ID: ${id} Expired: View limit reached. (View limit: ${share.view_count}/${share.max_views})`);
                db.run("DELETE FROM shares WHERE id = ?", [id]);
                return res.status(410).json({ error: 'Link expired' });
            }

            const levels = { 'View': 0, 'Edit': 1, 'Full Access': 2 };
            const shareLevel = levels[share.permissions] || 0;
            const requiredLevel = levels[requiredPermission] || 0;
            if (shareLevel < requiredLevel) return res.status(403).json({ error: `Insufficient permissions. ${requiredPermission} access required.` });
            req.share = share;
            next();
        });
    };
};

module.exports = {
    authenticateToken,
    requireAdmin,
    validateShareAccess
};
