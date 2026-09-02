const express = require('express');
const router = express.Router();
const tieringService = require('../services/tieringService');
const { authenticateToken, requireRole } = require('../middleware/auth');

/**
 * Storage Tiering & Lifecycle Routes
 */

// GET /api/v1/tiering/policies
router.get('/policies', authenticateToken, (req, res) => {
    res.json({ success: true, policies: tieringService.getPolicies() });
});

// POST /api/v1/tiering/policies
router.post('/policies', authenticateToken, requireRole(['Admin', 'Administrator', 'Operator']), (req, res) => {
    try {
        const policy = tieringService.createPolicy(req.body);
        res.json({ success: true, policy, message: 'Tiering policy created successfully' });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

// PUT /api/v1/tiering/policies/:id
router.put('/policies/:id', authenticateToken, requireRole(['Admin', 'Administrator', 'Operator']), (req, res) => {
    try {
        const policy = tieringService.updatePolicy(req.params.id, req.body);
        res.json({ success: true, policy, message: 'Tiering policy updated' });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

// DELETE /api/v1/tiering/policies/:id
router.delete('/policies/:id', authenticateToken, requireRole(['Admin', 'Administrator', 'Operator']), (req, res) => {
    try {
        tieringService.deletePolicy(req.params.id);
        res.json({ success: true, message: 'Policy removed' });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

// GET /api/v1/tiering/targets - List all selectable storage targets (nodes, drives, cloud mounts)
router.get('/targets', authenticateToken, async (req, res) => {
    try {
        const targets = await tieringService.getStorageTargets();
        res.json({ success: true, targets });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/v1/tiering/run - Run manual sweep
router.post('/run', authenticateToken, requireRole(['Admin', 'Administrator', 'Operator']), async (req, res) => {
    try {
        const { targetId, path: customPath } = req.body;
        const result = await tieringService.runTieringSweep({ targetId, path: customPath });
        res.json({ success: true, ...result, message: 'Lifecycle tiering sweep completed successfully' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/v1/tiering/stats - Storage distribution stats
router.get('/stats', authenticateToken, async (req, res) => {
    try {
        const { targetId, path: customPath } = req.query;
        const stats = await tieringService.getTierStats({ targetId, path: customPath });
        res.json({ success: true, ...stats });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/v1/tiering/dedup - Deduplication analysis
router.get('/dedup', authenticateToken, async (req, res) => {
    try {
        const { targetId, path: customPath } = req.query;
        const result = await tieringService.analyzeDeduplication({ targetId, path: customPath });
        res.json({ success: true, ...result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/v1/tiering/snapshots
router.get('/snapshots', authenticateToken, (req, res) => {
    res.json({ success: true, snapshots: tieringService.getSnapshots() });
});

// POST /api/v1/tiering/snapshots
router.post('/snapshots', authenticateToken, requireRole(['Admin', 'Administrator', 'Operator']), async (req, res) => {
    try {
        const { label, targetId, path: customPath } = req.body;
        const snap = await tieringService.createSnapshot(label, { targetId, path: customPath });
        res.json({ success: true, snapshot: snap, message: 'Snapshot generated' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/v1/tiering/snapshots/:id/manifest
router.get('/snapshots/:id/manifest', authenticateToken, (req, res) => {
    try {
        const manifest = tieringService.getSnapshotManifest(req.params.id);
        res.json({ success: true, ...manifest });
    } catch (e) {
        res.status(404).json({ error: e.message });
    }
});

// DELETE /api/v1/tiering/snapshots/:id
router.delete('/snapshots/:id', authenticateToken, requireRole(['Admin', 'Administrator', 'Operator']), (req, res) => {
    try {
        const result = tieringService.deleteSnapshot(req.params.id);
        res.json({ success: true, ...result });
    } catch (e) {
        res.status(404).json({ error: e.message });
    }
});

// GET /api/v1/tiering/config - Scheduler settings
router.get('/config', authenticateToken, (req, res) => {
    try {
        res.json({ success: true, config: tieringService.getSettings() });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/v1/tiering/config - Update scheduler settings
router.post('/config', authenticateToken, requireRole(['Admin', 'Administrator', 'Operator']), (req, res) => {
    try {
        const updated = tieringService.updateSettings(req.body);
        res.json({ success: true, config: updated, message: 'Tiering scheduler configuration updated' });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

// POST /api/v1/tiering/simulate - Dry run policy simulation
router.post('/simulate', authenticateToken, async (req, res) => {
    try {
        const { candidate, targetId, path: customPath } = req.body;
        const result = await tieringService.simulatePolicy(candidate, { targetId, path: customPath });
        res.json({ success: true, ...result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/v1/tiering/dedup/reclaim - Reclaim space from duplicate files
router.post('/dedup/reclaim', authenticateToken, requireRole(['Admin', 'Administrator', 'Operator']), async (req, res) => {
    try {
        const { targetId, path: customPath, strategy, groupHashes } = req.body;
        const result = await tieringService.reclaimDeduplication({ targetId, path: customPath, strategy, groupHashes });
        res.json({ success: true, ...result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/v1/tiering/snapshots/:id/export - Export snapshot manifest as JSON or CSV
router.get('/snapshots/:id/export', authenticateToken, (req, res) => {
    try {
        const format = (req.query.format || 'json').toLowerCase();
        const exportResult = tieringService.exportSnapshot(req.params.id, format);
        res.setHeader('Content-Type', exportResult.mime);
        res.setHeader('Content-Disposition', `attachment; filename="${exportResult.filename}"`);
        res.send(exportResult.data);
    } catch (e) {
        res.status(404).json({ error: e.message });
    }
});

// POST /api/v1/tiering/snapshots/:id/restore
router.post('/snapshots/:id/restore', authenticateToken, requireRole(['Admin', 'Administrator', 'Operator']), (req, res) => {
    try {
        const result = tieringService.restoreSnapshot(req.params.id);
        res.json(result);
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

module.exports = router;
