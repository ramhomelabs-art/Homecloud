const express = require('express');
const router = express.Router();
const trafficService = require('../services/trafficService');
const { authenticateToken, requireRole } = require('../middleware/auth');
const requireAdmin = requireRole(['Admin', 'Administrator', 'Operator']);
const db = require('../config/database');
const logger = require('../utils/logger');
const { loadFirewallState, getClientIp } = require('../middleware/firewall');
const auditService = require('../services/auditService');

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

// ─── GET /api/v1/traffic/history (Forensics & Historical Bandwidth) ──────────
router.get('/history', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const snapshotsRes = await db.query(`
            SELECT key, value 
            FROM app_settings 
            WHERE key LIKE 'traffic_snapshot_%'
            ORDER BY key DESC 
            LIMIT 48
        `);

        const history = snapshotsRes.rows.map(row => {
            try {
                return JSON.parse(row.value);
            } catch (_) {
                return null;
            }
        }).filter(Boolean).reverse();

        res.json({ count: history.length, history });
    } catch (err) {
        logger.error(`[TrafficRoutes] GET /history failed: ${err.message}`);
        res.status(500).json({ error: 'Failed to retrieve historical traffic snapshots' });
    }
});

// ─── GET /api/v1/traffic/threat-intel (MITRE & Attack Intelligence) ──────────
router.get('/threat-intel', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const [recentEvents, topBanned, geoStats] = await Promise.all([
            db.query(`
                SELECT event_type, details, created_at
                FROM security_events
                ORDER BY created_at DESC
                LIMIT 20
            `),
            db.query(`
                SELECT ip, country, country_name AS "countryName", reason, attempts, banned_at, expires_at
                FROM banned_ips
                WHERE expires_at > NOW()
                ORDER BY attempts DESC
                LIMIT 10
            `),
            db.query(`
                SELECT country, country_name AS "countryName", COUNT(*) as count
                FROM banned_ips
                GROUP BY country, country_name
                ORDER BY count DESC
                LIMIT 10
            `)
        ]);

        res.json({
            recentIncidents: recentEvents.rows,
            activeBans: topBanned.rows,
            geographicDistribution: geoStats.rows,
            mitreTechniques: [
                { id: 'T1190', name: 'Exploit Public-Facing Application', risk: 'HIGH' },
                { id: 'T1083', name: 'File and Directory Discovery / Traversal', risk: 'MEDIUM' },
                { id: 'T1059', name: 'Command and Scripting Interpreter Injection', risk: 'CRITICAL' },
                { id: 'T1595', name: 'Active Reconnaissance / Vulnerability Scanning', risk: 'MEDIUM' },
                { id: 'T1486', name: 'Data Encrypted for Impact (Ransomware)', risk: 'CRITICAL' },
                { id: 'T1078', name: 'Valid Accounts / Credential Abuse', risk: 'HIGH' }
            ]
        });
    } catch (err) {
        logger.error(`[TrafficRoutes] GET /threat-intel failed: ${err.message}`);
        res.status(500).json({ error: 'Failed to retrieve threat intelligence telemetry' });
    }
});

// ─── POST /api/v1/traffic/kill-session ───────────────────────────────────────
router.post('/kill-session', authenticateToken, requireAdmin, async (req, res) => {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });

    const killed = trafficService.killSession(sessionId);
    if (killed) {
        await auditService.log(req.user.id, req.user.username, 'SESSION_TERMINATED', `Manually terminated active session ID: ${sessionId}`, req);
    }
    res.json({ success: killed, message: killed ? 'Session terminated successfully' : 'Session not found' });
});

// ─── POST /api/v1/traffic/ban-client ─────────────────────────────────────────
router.post('/ban-client', authenticateToken, requireAdmin, async (req, res) => {
    const { ip, reason } = req.body;
    if (!ip) return res.status(400).json({ error: 'IP address is required' });

    try {
        const geoService = require('../utils/geoService');
        const geo = geoService.resolveIp(ip);

        // 1. Insert into persistent banned_ips table
        await db.query(`
            INSERT INTO banned_ips (ip, country, country_name, reason, attempts, banned_at, expires_at, banned_by)
            VALUES ($1, $2, $3, $4, 1, NOW(), NOW() + INTERVAL '24 hours', $5)
            ON CONFLICT (ip) DO UPDATE SET
                reason = EXCLUDED.reason,
                attempts = banned_ips.attempts + 1,
                banned_at = NOW(),
                expires_at = NOW() + INTERVAL '24 hours',
                banned_by = EXCLUDED.banned_by
        `, [ip, geo.country, geo.countryName, reason || 'Banned from Live Traffic Inspector', req.user.username]);

        // 2. Log to security_events for Threat Radar and audit trail
        await db.query(
            "INSERT INTO security_events (event_type, details) VALUES ($1, $2)",
            ['IP_BLACKLISTED', JSON.stringify({ ip, reason: reason || 'Banned from Live Traffic Inspector', bannedBy: req.user.username })]
        );

        // 3. Reload in-memory firewall state
        await loadFirewallState();

        // 4. Terminate any active sessions from this IP
        trafficService.killSession(ip);

        await auditService.log(req.user.id, req.user.username, 'IP_BLACKLISTED', `Administratively blacklisted IP address: ${ip} (${geo.countryName}). Reason: ${reason || 'Manual ban'}`, req);

        logger.warn(`[TrafficRoutes] Admin ${req.user.username} blacklisted IP ${ip}`);
        res.json({ success: true, message: `IP ${ip} (${geo.countryName}) has been dropped and blacklisted.` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
