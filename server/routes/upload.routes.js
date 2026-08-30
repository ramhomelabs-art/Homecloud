const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const os = require('os');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const bcrypt = require('bcrypt');

const db = require('../config/database');
const { authenticateUpload } = require('../middleware/auth');
const securityService = require('../services/securityService');
const logger = require('../utils/logger');

const securityQueue = require('../services/securityQueue');

const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, securityQueue.getStagingDir());
        },
        filename: (req, file, cb) => {
            cb(null, `${Date.now()}-${Math.random().toString(36).substring(2, 8)}-${file.originalname}`);
        }
    }),
    limits: { fileSize: 500 * 1024 * 1024 } // 500MB Limit
});

// 📁 POST /api/v1/upload/verify
router.post('/verify', async (req, res) => {
    const { id, password } = req.body;
    if (!id) return res.status(400).json({ error: 'Share ID is required' });

    try {
        let shareRes = await db.query(`
            SELECT sl.*, ss.password_hash, ss.email_verification, ss.max_views, ss.max_downloads
            FROM share_links sl
            LEFT JOIN share_security ss ON ss.share_id = sl.id
            WHERE UPPER(sl.token) = UPPER($1) OR sl.id::text = $1
        `, [id.trim()]);
        const share = shareRes.rows[0];
        if (!share) return res.status(404).json({ error: 'Share link not found or expired' });

        if (share.permissions !== 'Upload' && share.permissions !== 'Edit' && share.permissions !== 'Full Access') {
            return res.status(403).json({ error: 'Access Denied: This link does not authorize uploads' });
        }

        if (new Date() > new Date(share.expiry)) {
            await db.query('DELETE FROM share_links WHERE id = $1', [id]);
            return res.status(410).json({ error: 'Link expired' });
        }

        if (share.password_hash) {
            if (!password) return res.status(401).json({ error: 'Password credentials required' });
            const passwordMatch = await bcrypt.compare(password, share.password_hash);
            if (!passwordMatch) {
                return res.status(401).json({ error: 'Incorrect passkey credentials' });
            }
        }

        // Generate UPLOAD_TOKEN
        const uploadToken = jwt.sign(
            { type: 'UPLOAD_TOKEN', shareId: id, path: share.path },
            process.env.JWT_SECRET,
            { expiresIn: '2h' }
        );

        res.json({ token: uploadToken });
    } catch (err) {
        logger.error(`[Upload Portal Auth Error]: ${err.message}`, err);
        res.status(500).json({ error: err.message });
    }
});

// 📁 POST /api/v1/upload/drop ( threat scanning pipeline )
router.post('/drop', authenticateUpload, upload.array('files'), async (req, res) => {
    const { share } = req;
    const subPath = req.body.path || '';

    let baseDir = share.path || '';
    const cleanSmb = baseDir.replace(/\\/g, '/').replace(/^.*?uploads\//i, '').replace(/^(smb:)?\/+/, '');
    const isSmb = baseDir.startsWith('\\\\') || baseDir.startsWith('//') || baseDir.startsWith('smb://') || /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\//.test(cleanSmb);

    let targetDir = '';
    if (isSmb) {
        targetDir = subPath ? `//${cleanSmb}/${subPath.replace(/^[\\\/]+/, '').replace(/\\/g, '/')}` : `//${cleanSmb}`;
    } else {
        try {
            const stats = fs.statSync(baseDir);
            if (!stats.isDirectory()) baseDir = path.dirname(baseDir);
        } catch (e) {}

        targetDir = path.join(baseDir, subPath);
        const normalizedTarget = path.normalize(targetDir).toLowerCase();
        const normalizedBase = path.normalize(baseDir).toLowerCase();

        if (!normalizedTarget.startsWith(normalizedBase)) {
            req.files.forEach(f => { try { fs.unlinkSync(f.path); } catch (e) {} });
            return res.status(403).json({ error: 'Path traversal forbidden' });
        }
    }

    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
    }

    const results = [];

    try {
        if (!isSmb && !fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        for (const file of req.files) {
            // Queue the file for scanning instead of blocking the upload
            securityQueue.addFileToQueue(file.path, file.originalname, targetDir, share.id, null);
            results.push({ 
                name: file.originalname, 
                status: 'queued', 
                message: 'Upload received and queued for security scanning' 
            });
        }

        res.json({ message: 'Uploads queued successfully', results });
    } catch (unhandledErr) {
        logger.error(`[Upload Portal Drop Error] Unhandled Exception: ${unhandledErr.message}`, unhandledErr);
        res.status(500).json({ error: unhandledErr.message });
    }
});

module.exports = router;
