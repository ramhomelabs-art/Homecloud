const express = require('express');
const router = express.Router();
const cloudMountService = require('../services/cloudMountService');
const { authenticateToken, requireRole } = require('../middleware/auth');
const requireAdmin = requireRole(['Admin', 'Administrator', 'Operator']);
const db = require('../config/database');
const logger = require('../utils/logger');

// ─── GET /api/v1/cloud/mounts ────────────────────────────────────────────────
router.get('/mounts', authenticateToken, (req, res) => {
    try {
        const mounts = cloudMountService.getMounts();
        res.json({ mounts, count: mounts.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── POST /api/v1/cloud/mounts ───────────────────────────────────────────────
router.post('/mounts', authenticateToken, requireAdmin, async (req, res) => {
    const { label, type, path, username, password, extraConfig } = req.body;
    try {
        const newMount = await cloudMountService.addMount({
            label,
            type,
            path,
            username,
            password,
            extraConfig
        });
        res.json({ success: true, message: `Successfully connected ${type} mount "${label}"`, mount: newMount });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── POST /api/v1/cloud/mounts/:id/test ──────────────────────────────────────
router.post('/mounts/:id/test', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        const testResult = await cloudMountService.testConnection(id);
        res.json(testResult);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── GET /api/v1/cloud/mounts/:id/files ──────────────────────────────────────
router.get('/mounts/:id/files', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { path: subPath } = req.query;
    try {
        const files = await cloudMountService.listRemoteFiles(id, subPath || '/');
        res.json({ files, count: files.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── POST /api/v1/cloud/mounts/:id/import ────────────────────────────────────
router.post('/mounts/:id/import', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { fileName, targetFolder } = req.body;
    if (!fileName) return res.status(400).json({ error: 'fileName is required' });

    try {
        const result = await cloudMountService.importCloudFile(id, fileName, targetFolder || '/');
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── DELETE /api/v1/cloud/mounts/:id ─────────────────────────────────────────
router.delete('/mounts/:id', authenticateToken, requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await cloudMountService.removeMount(id);
        res.json({ success: true, message: 'Mount successfully disconnected' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
