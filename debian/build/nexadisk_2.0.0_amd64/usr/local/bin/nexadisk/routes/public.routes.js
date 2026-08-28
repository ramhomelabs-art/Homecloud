const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const db = require('../config/database');
const fileService = require('../services/fileService');
const logger = require('../utils/logger');

const getExpiredHTML = () => {
    return `
    <html>
    <head><title>NexaDisk | Expired</title><link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;800&display=swap" rel="stylesheet"></head>
    <body style="background:#05070a;color:#fff;font-family:'Outfit',sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
        <div style="text-align:center;background:#0d1117;padding:40px;border-radius:16px;border:1px solid #f85149;">
            <h1 style="color:#f85149;margin-bottom:8px;">Link Expired</h1>
            <p style="color:#8b949e;">This share link has expired or reached its access view limit.</p>
        </div>
    </body>
    </html>
    `;
};

// 🔗 GET /public/share/:id (Legacy Link compatibility redirect)
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const share = await fileService.getShareById(id);
        if (!share) return res.status(404).send(getExpiredHTML());

        const now = new Date();
        const expiry = new Date(share.expiry);
        if (now > expiry || (share.max_views !== -1 && share.view_count >= share.max_views)) {
            await fileService.deleteShare(id);
            return res.status(410).send(getExpiredHTML());
        }

        // Redirect to new UI React Portals
        if (share.permissions === 'Upload') {
            return res.redirect(`/u/${id}`);
        } else {
            return res.redirect(`/g/${id}`);
        }
    } catch (err) {
        logger.error(`[Public Share Error]: ${err.message}`, err);
        res.status(500).send('Internal Server Error');
    }
});

// 🔗 GET /api/v1/public/info/:id (Unauthenticated share info)
router.get('/info/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const share = await fileService.getShareById(id);
        if (!share) return res.status(404).json({ error: 'Share link not found or expired' });

        if (share.password_hash || share.email) {
            return res.status(401).json({ error: 'Authentication required', authRequired: true });
        }

        res.json({
            id: share.id,
            path: share.path,
            permissions: share.permissions,
            created_at: share.created_at
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 🔗 GET /api/v1/public/download/:id (Direct stream of open shares)
router.get('/download/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const share = await fileService.getShareById(id);
        if (!share) return res.status(404).json({ error: 'Share link not found' });

        if (share.password_hash || share.email) {
            return res.status(401).json({ error: 'Access Denied: Authentication required' });
        }

        if (new Date() > new Date(share.expiry)) {
            return res.status(410).json({ error: 'Link expired' });
        }

        const targetFile = req.query.path || '';
        const targetPath = path.join(share.path, targetFile);
        const normalizedTarget = path.normalize(targetPath).toLowerCase();
        const normalizedBase = path.normalize(share.path).toLowerCase();

        if (!normalizedTarget.startsWith(normalizedBase)) {
            return res.status(403).json({ error: 'Path traversal forbidden' });
        }

        if (!fs.existsSync(targetPath)) {
            return res.status(404).json({ error: 'File not found' });
        }

        await fileService.incrementShareViewCount(id);
        res.download(targetPath);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
