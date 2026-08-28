const express = require('express');
const router = express.Router();
const trafficService = require('../services/trafficService');
const { authenticateToken, requireRole } = require('../middleware/auth');
const requireAdmin = requireRole(['Admin', 'Administrator', 'Operator']);
const db = require('../config/database');
const logger = require('../utils/logger');

// ─── GET /api/v1/traffic/live ────────────────────────────────────────────────
router.get('/live', authenticateToken, requireAdmin, (req, res) => {
    try {
        const telemetry = trafficService.getLiveTelemetry();
        res.json(telemetry);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── GET /api/v1/traffic/sessions ────────────────────────────────────────────
router.get('/sessions', authenticateToken, requireAdmin, (req, res) => {
    try {
        const sessions = trafficService.getActiveSessions();
        res.json({ sessions, count: sessions.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── POST /api/v1/traffic/kill-session ───────────────────────────────────────
router.post('/kill-session', authenticateToken, requireAdmin, (req, res) => {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });

    const killed = trafficService.killSession(sessionId);
    res.json({ success: killed, message: killed ? 'Session terminated successfully' : 'Session not found' });
});

// ─── POST /api/v1/traffic/ban-client ─────────────────────────────────────────
router.post('/ban-client', authenticateToken, requireAdmin, async (req, res) => {
    const { ip, reason } = req.body;
    if (!ip) return res.status(400).json({ error: 'IP address is required' });

    try {
        // 1. Insert into persistent banned_ips table
        await db.query(`
            INSERT INTO banned_ips (ip, country, country_name, reason, attempts, banned_at, expires_at, banned_by)
            VALUES ($1, 'XX', 'Unknown Origin', $2, 1, NOW(), NOW() + INTERVAL '24 hours', $3)
            ON CONFLICT (ip) DO UPDATE SET
                reason = EXCLUDED.reason,
                attempts = banned_ips.attempts + 1,
                banned_at = NOW(),
                expires_at = NOW() + INTERVAL '24 hours',
                banned_by = EXCLUDED.banned_by
        `, [ip, reason || 'Banned from Live Traffic Inspector', req.user.username]);

        // 2. Log to security_events for Threat Radar and audit trail
        await db.query(
            "INSERT INTO security_events (event_type, details) VALUES ($1, $2)",
            ['IP_BLACKLISTED', JSON.stringify({ ip, reason: reason || 'Banned from Live Traffic Inspector', bannedBy: req.user.username })]
        );

        // 3. Also terminate any active sessions from this IP
        trafficService.killSession(ip);

        logger.warn(`[TrafficRoutes] Admin ${req.user.username} blacklisted IP ${ip}`);
        res.json({ success: true, message: `IP ${ip} has been dropped and blacklisted.` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
