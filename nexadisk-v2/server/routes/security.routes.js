const express = require('express');
const router = express.Router();
const db = require('../config/database');
const securityService = require('../services/securityService');
const { authenticateAdmin, authenticateToken } = require('../middleware/auth');
const logger = require('../utils/logger');
const fs = require('fs');

// 🛡️ Middleware to ensure Admin access for SOC features
// We can use authenticateToken if all SOC features require normal auth,
// but let's use authenticateToken + role check or just authenticateAdmin.
const requireAdmin = (req, res, next) => {
    if (req.user && (req.user.role === 'Admin' || req.user.role === 'Operator')) {
        return next();
    }
    return res.status(403).json({ error: 'Security Center access denied' });
};

// ─── GET /api/v1/security/stats ───────────────────────────────────────────────
// Get aggregated stats for the SOC Dashboard
router.get('/stats', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const stats = {
            totalScans: 0,
            clean: 0,
            suspicious: 0,
            malicious: 0,
            quarantined: 0,
            recentThreats: [],
            timeline: []
        };

        // Aggregates
        const aggRes = await db.query(`
            SELECT status, COUNT(*) as count 
            FROM security_scans 
            GROUP BY status
        `);
        aggRes.rows.forEach(r => {
            const count = parseInt(r.count, 10);
            stats.totalScans += count;
            if (r.status === 'clean') stats.clean += count;
            if (r.status === 'suspicious') stats.suspicious += count;
            if (r.status === 'malicious') stats.malicious += count;
        });

        const qRes = await db.query(`SELECT COUNT(*) FROM quarantine WHERE status = 'pending'`);
        stats.quarantined = parseInt(qRes.rows[0].count, 10);

        // Recent threats
        const rtRes = await db.query(`
            SELECT s.id as scan_id, s.file_path, s.status as scan_status, s.scan_date, 
                   t.threat_name, t.severity,
                   q.id as quarantine_id, q.status as quarantine_status, q.target_path, q.quarantine_path
            FROM security_scans s
            JOIN security_threats t ON s.id = t.scan_id
            LEFT JOIN quarantine q ON s.id = q.scan_id
            ORDER BY s.scan_date DESC LIMIT 10
        `);

        stats.recentThreats = rtRes.rows.map(r => {
            let fileExists = false;
            if (r.quarantine_id && r.quarantine_status === 'pending') {
                fileExists = r.quarantine_path ? fs.existsSync(r.quarantine_path) : false;
            } else {
                fileExists = r.file_path ? fs.existsSync(r.file_path) : false;
            }
            // Strip quarantine_path before sending to frontend
            const { quarantine_path, ...clientRow } = r;
            return {
                ...clientRow,
                file_exists: fileExists
            };
        });

        // Timeline (Last 30 Days)
        const timelineRes = await db.query(`
            SELECT DATE(scan_date) as date, 
                   COUNT(*) as total,
                   COUNT(*) FILTER (WHERE status = 'clean') as clean,
                   COUNT(*) FILTER (WHERE status != 'clean') as infected
            FROM security_scans 
            WHERE scan_date > CURRENT_DATE - INTERVAL '30 days'
            GROUP BY DATE(scan_date)
            ORDER BY date ASC
        `);
        stats.timeline = timelineRes.rows;

        res.json(stats);
    } catch (err) {
        logger.error(`[SOC] Stats error: ${err.message}`);
        res.status(500).json({ error: 'Failed to fetch security stats' });
    }
});

// ─── GET /api/v1/security/history ─────────────────────────────────────────────
router.get('/history', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        const historyRes = await db.query(`
            SELECT s.*, 
                   COALESCE(json_agg(t.*) FILTER (WHERE t.id IS NOT NULL), '[]') as threats
            FROM security_scans s
            LEFT JOIN security_threats t ON s.id = t.scan_id
            GROUP BY s.id
            ORDER BY s.scan_date DESC 
            LIMIT $1 OFFSET $2
        `, [limit, offset]);
        
        res.json(historyRes.rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch scan history' });
    }
});

// ─── GET /api/v1/security/quarantine ──────────────────────────────────────────
router.get('/quarantine', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const qList = await securityService.getQuarantineList('pending', 100, 0);
        res.json(qList);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch quarantine list' });
    }
});

// ─── POST /api/v1/security/quarantine/approve ─────────────────────────────────
router.post('/quarantine/approve', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.body;
        await securityService.approveQuarantine(id, req.user.id);
        res.json({ success: true, message: 'File restored from quarantine.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── POST /api/v1/security/quarantine/reject ──────────────────────────────────
router.post('/quarantine/reject', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.body;
        await securityService.rejectQuarantine(id, req.user.id);
        res.json({ success: true, message: 'Quarantined file deleted securely.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── POST /api/v1/security/scan/file ──────────────────────────────────────────
// Manual scan triggered by user via Explorer
router.post('/scan/file', authenticateToken, async (req, res) => {
    try {
        const { filePath, agentId } = req.body;
        
        if (agentId && agentId !== 'local') {
            const clusterService = require('../services/clusterService');
            if (clusterService.agents[agentId]) {
                const agent = clusterService.agents[agentId];
                if (agent.status !== 'approved') return res.status(403).json({ error: 'Agent not approved' });
                try {
                    const resp = await axios.post(`${agent.url}/api/v1/security/scan/file`, { filePath });
                    return res.json(resp.data);
                } catch (e) {
                    return res.status(502).json({ error: `Agent manual scan failed: ${e.message}` });
                }
            }
        }

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found' });
        }
        
        const originalName = require('path').basename(filePath);
        const result = await securityService.deepScan(filePath, originalName);
        
        let quarantined = false;
        let quarantineId = null;
        if (result.verdict === 'malicious' || result.verdict === 'suspicious') {
            const crypto = require('crypto');
            quarantineId = crypto.randomUUID();
            const stat = fs.statSync(filePath);
            
            try {
                await securityService.quarantineFile(
                    quarantineId,
                    originalName,
                    filePath,
                    filePath,
                    null,
                    stat.size,
                    null,
                    result
                );
                quarantined = true;
            } catch (qErr) {
                logger.error(`[SOC] Failed to quarantine manually scanned file: ${qErr.message}`);
            }
        }
        
        res.json({ success: true, result, quarantined, quarantineId });
    } catch (err) {
        logger.error(`[SOC] Manual scan error: ${err.message}`);
        res.status(500).json({ error: 'Scan failed' });
    }
});


// ─── POST /api/v1/security/scans/:id/allow ────────────────────────────────────
router.post('/scans/:id/allow', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Update scan status
        await db.query(
            "UPDATE security_scans SET status = 'clean', score = 0 WHERE id = $1",
            [id]
        );
        // Clear threats
        await db.query(
            "DELETE FROM security_threats WHERE scan_id = $1",
            [id]
        );
        
        res.json({ success: true, message: 'Threat allowed and scan record marked clean.' });
    } catch (err) {
        logger.error(`[SOC] Allow scan error: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// ─── DELETE /api/v1/security/scans/:id ────────────────────────────────────────

router.delete('/scans/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Fetch scan record
        const scanRes = await db.query('SELECT * FROM security_scans WHERE id = $1', [id]);
        if (scanRes.rows.length === 0) {
            return res.status(404).json({ error: 'Scan record not found' });
        }
        
        const scan = scanRes.rows[0];
        
        // 1. Delete file on disk if it exists
        if (scan.file_path && fs.existsSync(scan.file_path)) {
            try {
                fs.unlinkSync(scan.file_path);
            } catch (err) {
                logger.error(`[SOC] Failed to delete file ${scan.file_path}: ${err.message}`);
            }
        }
        
        // 2. If quarantined, reject it
        const qRes = await db.query('SELECT * FROM quarantine WHERE scan_id = $1 AND status = \'pending\'', [id]);
        if (qRes.rows.length > 0) {
            try {
                await securityService.rejectQuarantine(qRes.rows[0].id, req.user.id);
            } catch (err) {
                logger.error(`[SOC] Failed to reject quarantine for scan ${id}: ${err.message}`);
            }
        }
        
        // 3. Delete scan record (cascades to threats)
        await db.query('DELETE FROM security_scans WHERE id = $1', [id]);
        
        res.json({ success: true, message: 'Threat cleared and scan record removed.' });
    } catch (err) {
        logger.error(`[SOC] Clear threat error: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// ─── GET /api/v1/security/policy ──────────────────────────────────────────────
router.get('/policy', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const keys = ['sec_policy_quarantine_mode', 'sec_policy_whitelist_exts', 'sec_policy_max_scan_size'];
        const resDb = await db.query('SELECT key, value FROM app_settings WHERE key = ANY($1)', [keys]);
        
        const policy = {
            quarantineMode: 'quarantine',
            whitelistExts: '',
            maxScanSize: '100' // MB
        };

        resDb.rows.forEach(row => {
            if (row.key === 'sec_policy_quarantine_mode') policy.quarantineMode = row.value;
            if (row.key === 'sec_policy_whitelist_exts') policy.whitelistExts = row.value;
            if (row.key === 'sec_policy_max_scan_size') policy.maxScanSize = row.value;
        });

        res.json(policy);
    } catch (err) {
        logger.error(`[SOC] Get policy error: ${err.message}`);
        res.status(500).json({ error: 'Failed to retrieve security policy' });
    }
});

// ─── POST /api/v1/security/policy ─────────────────────────────────────────────
router.post('/policy', authenticateToken, requireAdmin, async (req, res) => {
    const { quarantineMode, whitelistExts, maxScanSize } = req.body;
    try {
        const queries = [
            { key: 'sec_policy_quarantine_mode', val: quarantineMode || 'quarantine' },
            { key: 'sec_policy_whitelist_exts', val: whitelistExts || '' },
            { key: 'sec_policy_max_scan_size', val: maxScanSize || '100' }
        ];

        for (const q of queries) {
            await db.query(
                `INSERT INTO app_settings (key, value) VALUES ($1, $2)
                 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
                [q.key, q.val]
            );
        }

        // Log a security event about policy change
        await db.query(
            "INSERT INTO security_events (event_type, details) VALUES ($1, $2)",
            ['POLICY_CHANGE', JSON.stringify({ quarantineMode, whitelistExts, maxScanSize, updatedBy: req.user.username })]
        );

        res.json({ success: true, message: 'Security policy updated successfully.' });
    } catch (err) {
        logger.error(`[SOC] Save policy error: ${err.message}`);
        res.status(500).json({ error: 'Failed to update security policy' });
    }
});

// ─── GET /api/v1/security/events ──────────────────────────────────────────────
router.get('/events', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 30;
        const resDb = await db.query(
            'SELECT * FROM security_events ORDER BY created_at DESC LIMIT $1',
            [limit]
        );
        res.json(resDb.rows.map(row => ({
            id: row.id,
            eventType: row.event_type,
            details: row.details,
            createdAt: row.created_at
        })));
    } catch (err) {
        logger.error(`[SOC] Get events error: ${err.message}`);
        res.status(500).json({ error: 'Failed to retrieve security events' });
    }
});

module.exports = router;
