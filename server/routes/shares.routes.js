/**
 * shares.routes.js — ADMIN SHARE MANAGEMENT
 * Requires NexaDisk user authentication.
 * Mounted at /api/v1/shares
 *
 * POST   /api/v1/shares/create     — Create a share link
 * GET    /api/v1/shares/list       — List all active shares
 * DELETE /api/v1/shares/:token     — Revoke a share
 * PUT    /api/v1/shares/:token     — Update a share
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const db = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const logger = require('../utils/logger');
const { encryptPassword, decryptPassword } = require('../utils/crypto');

const ADMIN_ROLES = ['Admin', 'Operator', 'Power User', 'User'];

// ─── POST /api/v1/shares/create ───────────────────────────────────────────────
router.post('/create', authenticateToken, requireRole(ADMIN_ROLES), async (req, res) => {
    const { path: filePath, password, email, expiryHours, maxViews, permissions, type: explicitType, title, description } = req.body;

    if (!filePath) return res.status(400).json({ error: 'path is required' });

    try {
        const token = crypto.randomBytes(4).toString('hex').toUpperCase(); // 8-char e.g. "A3F7B2C1"

        // Determine share type
        let type = explicitType || 'download';
        if (!explicitType) {
            const p = String(permissions || '').toLowerCase();
            if (p.includes('upload')) type = 'upload';
            else if (p.includes('edit') || p.includes('full') || p.includes('exchange')) type = 'exchange';
        }

        const passwordHash = password ? await bcrypt.hash(password, 10) : null;
        const hours = parseInt(expiryHours) || 24;
        const extractCleanName = (p) => {
            if (!p) return 'Shared Resource';
            const normalized = String(p).replace(/\\/g, '/').replace(/\/+$/, '');
            const parts = normalized.split('/').filter(Boolean);
            return parts.length > 0 ? parts[parts.length - 1] : p;
        };
        const shareTitle = title || extractCleanName(filePath);

        // Insert share_links
        const slRes = await db.query(`
            INSERT INTO share_links (token, type, owner_id, path, title, description, expires_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, token
        `, [token, type, req.user.id, filePath, shareTitle, description || '', expiresAt]);

        const shareId = slRes.rows[0].id;

        // Insert share_security
        await db.query(`
            INSERT INTO share_security (share_id, password_hash, email_verification, max_views, max_downloads)
            VALUES ($1, $2, $3, $4, $5)
        `, [shareId, passwordHash, !!email, parseInt(maxViews) || -1, -1]);

        logger.info(`[Shares] Created ${type} share ${token} → ${filePath}`);
        res.json({ token, type, expiresAt });
    } catch (e) {
        logger.error('[Shares Create Error]', e);
        res.status(500).json({ error: e.message });
    }
});

// ─── GET /api/v1/shares/list ──────────────────────────────────────────────────
router.get('/list', authenticateToken, async (req, res) => {
    try {
        const r = await db.query(`
            SELECT 
                sl.id as uuid, sl.token, sl.type, sl.path, sl.title, sl.description,
                sl.created_at, sl.expires_at,
                ss.password_hash, ss.email_verification, ss.max_views, ss.max_downloads,
                (SELECT COUNT(*) FROM share_access_logs WHERE share_link_id = sl.id AND status = 'access') AS view_count,
                u.username AS owner_name
            FROM share_links sl
            LEFT JOIN share_security ss ON ss.share_id = sl.id
            LEFT JOIN users u ON u.id = sl.owner_id
            ORDER BY sl.created_at DESC
        `);

        const shares = r.rows.map(s => ({
            token: s.token,
            type: s.type,
            path: s.path,
            title: s.title,
            description: s.description,
            created_at: s.created_at,
            expires_at: s.expires_at,
            has_password: !!s.password_hash,
            password: s.password_hash ? (s.password_hash.startsWith('AES:') ? decryptPassword(s.password_hash) : '********') : null,
            email_verification: !!s.email_verification,
            max_views: s.max_views === null ? -1 : parseInt(s.max_views),
            view_count: parseInt(s.view_count) || 0,
            owner_name: s.owner_name || 'NexaDisk'
        }));

        res.json(shares);
    } catch (e) {
        logger.error('[Shares List Error]', e);
        res.status(500).json({ error: e.message });
    }
});

// ─── DELETE /api/v1/shares/:token ─────────────────────────────────────────────
router.delete('/:token', authenticateToken, requireRole(ADMIN_ROLES), async (req, res) => {
    try {
        await db.query('DELETE FROM share_links WHERE token = $1', [req.params.token]);
        logger.info(`[Shares] Revoked share ${req.params.token}`);
        res.json({ success: true });
    } catch (e) {
        logger.error('[Shares Delete Error]', e);
        res.status(500).json({ error: e.message });
    }
});

// ─── PUT /api/v1/shares/:token ────────────────────────────────────────────────
router.put('/:token', authenticateToken, requireRole(ADMIN_ROLES), async (req, res) => {
    const { password, email, expiryHours, maxViews } = req.body;
    try {
        const slRes = await db.query('SELECT id FROM share_links WHERE token = $1', [req.params.token]);
        if (!slRes.rows[0]) return res.status(404).json({ error: 'Share not found' });
        const shareId = slRes.rows[0].id;

        if (expiryHours !== undefined) {
            const hours = parseInt(expiryHours) || 24;
            await db.query(
                'UPDATE share_links SET expires_at = $1 WHERE id = $2',
                [new Date(Date.now() + hours * 3600 * 1000).toISOString(), shareId]
            );
        }

        const ssUpdates = [];
        const ssParams = [];
        let idx = 1;

        if (password !== undefined) {
            const h = password ? await bcrypt.hash(password, 10) : null;
            ssUpdates.push(`password_hash = $${idx++}`);
            ssParams.push(h);
        }
        if (email !== undefined) {
            ssUpdates.push(`email_verification = $${idx++}`); ssParams.push(!!email);
        }
        if (maxViews !== undefined) {
            ssUpdates.push(`max_views = $${idx++}`); ssParams.push(parseInt(maxViews) || -1);
        }

        if (ssUpdates.length > 0) {
            ssParams.push(shareId);
            await db.query(
                `UPDATE share_security SET ${ssUpdates.join(', ')} WHERE share_id = $${idx}`,
                ssParams
            );
        }

        logger.info(`[Shares] Updated share ${req.params.token}`);
        res.json({ success: true });
    } catch (e) {
        logger.error('[Shares Update Error]', e);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
