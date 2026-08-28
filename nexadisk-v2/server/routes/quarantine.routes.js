const express = require('express');
const router = express.Router();
const fs = require('fs');
const db = require('../config/database');
const securityService = require('../services/securityService');
const { authenticateToken, requireRole } = require('../middleware/auth');
const logger = require('../utils/logger');

// All quarantine routes require authentication and proper roles
router.use(authenticateToken);
router.use(requireRole(['Admin', 'Operator']));

// ── GET /api/v1/quarantine/stats ─────────────────────────────────────────────
router.get('/stats', async (req, res) => {
    try {
        const stats = await securityService.getStats();
        res.json(stats);
    } catch (err) {
        logger.error(`[Quarantine Routes] Stats error: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/v1/quarantine/list ──────────────────────────────────────────────
router.get('/list', async (req, res) => {
    try {
        const { status = 'all', limit = 50, offset = 0 } = req.query;
        const list = await securityService.getQuarantineList(
            status,
            parseInt(limit, 10),
            parseInt(offset, 10)
        );
        res.json(list);
    } catch (err) {
        logger.error(`[Quarantine Routes] List error: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/v1/quarantine/:id ───────────────────────────────────────────────
router.get('/:id', async (req, res) => {
    try {
        const record = await securityService.getRecordById(req.params.id);
        if (!record) return res.status(404).json({ error: 'Quarantine record not found' });
        res.json(record);
    } catch (err) {
        logger.error(`[Quarantine Routes] Fetch error: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/v1/quarantine/:id/scan (re-scan) ───────────────────────────────
router.post('/:id/scan', async (req, res) => {
    try {
        const record = await securityService.getRecordById(req.params.id);
        if (!record) return res.status(404).json({ error: 'Record not found' });
        if (!fs.existsSync(record.quarantine_path)) {
            return res.status(410).json({ error: 'Quarantined file no longer exists on disk' });
        }

        const result = await securityService.deepScan(record.quarantine_path, record.original_name);
        await db.query(
            'UPDATE quarantine SET verdict = $1, score = $2, threats = $3, scan_details = $4, scan_id = $5 WHERE id = $6',
            [result.verdict, result.score, JSON.stringify(result.threats), JSON.stringify(result.details), result.scanId, record.id]
        );

        res.json({ message: 'Re-scan complete', ...result });
    } catch (err) {
        logger.error(`[Quarantine Routes] Re-scan error: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/v1/quarantine/:id/approve ─────────────────────────────────────
router.post('/:id/approve', async (req, res) => {
    try {
        const reviewerId = req.user.id;
        await securityService.approveQuarantine(req.params.id, reviewerId);
        res.json({ message: 'File approved and moved to target.' });
    } catch (err) {
        logger.error(`[Quarantine Routes] Approve error: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// ── DELETE /api/v1/quarantine/:id/reject ────────────────────────────────────
router.delete('/:id/reject', async (req, res) => {
    try {
        const reviewerId = req.user.id;
        await securityService.rejectQuarantine(req.params.id, reviewerId);
        res.json({ message: 'File rejected and deleted.' });
    } catch (err) {
        logger.error(`[Quarantine Routes] Reject error: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
