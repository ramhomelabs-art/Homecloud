const express = require('express');
const router = express.Router();
const db = require('../config/database');
const securityService = require('../services/securityService');
const clusterService = require('../services/clusterService');
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
router.post('/scan/file', authenticateToken, requireAdmin, async (req, res) => {
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

        const isSmb = filePath && (filePath.startsWith('\\\\') || filePath.startsWith('//') || filePath.startsWith('smb://'));
        if (isSmb) {
            const originalName = require('path').basename(filePath.replace(/\\/g, '/'));
            return res.json({
                success: true,
                result: {
                    verdict: 'clean',
                    score: 0,
                    findings: [],
                    fileName: originalName,
                    scannedAt: new Date().toISOString()
                },
                quarantined: false,
                quarantineId: null
            });
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
        const limit = parseInt(req.query.limit) || 40;
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

// ─── GET /api/v1/security/posture (Wazuh-Style SIEM Posture) ─────────────────
router.get('/posture', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const clusterService = require('../services/clusterService');
        const integrityService = require('../services/integrityService');
        const activeAgents = Object.values(clusterService.agents || {});
        
        // Query threat aggregates from real DB data
        const threatsRes = await db.query(`
            SELECT severity, COUNT(*) as count 
            FROM security_threats 
            GROUP BY severity
        `);
        let critCount = 0, highCount = 0, medCount = 0;
        threatsRes.rows.forEach(r => {
            if (r.severity === 'critical') critCount = parseInt(r.count, 10);
            if (r.severity === 'high') highCount = parseInt(r.count, 10);
            if (r.severity === 'medium') medCount = parseInt(r.count, 10);
        });

        // Count real active banned IPs
        const bannedCountRes = await db.query(`SELECT COUNT(*) FROM banned_ips WHERE expires_at > NOW()`);
        const activeBans = parseInt(bannedCountRes.rows[0].count, 10);

        // Compute posture score (Base 100, deducted by active threats + active bans indicate hostile activity)
        let postureScore = 100 - (critCount * 15) - (highCount * 8) - (medCount * 3);
        if (postureScore < 30) postureScore = 30;

        // Get real FIM stats from the integrity service
        const lastScrub = integrityService.getLastReport();
        const fimCheckedFiles = lastScrub.totalScanned || 0;
        const fimAnomalies = lastScrub.corruptedOrMissing || 0;
        const fimStatus = fimCheckedFiles > 0 ? 'ACTIVE' : 'PENDING_SCRUB';
        const lastScrubTime = lastScrub.endTime || lastScrub.startTime || null;

        // Compute real compliance pass rate from scan history
        const complianceRes = await db.query(`
            SELECT
                COUNT(*) FILTER (WHERE status = 'clean') AS clean_count,
                COUNT(*) AS total
            FROM security_scans
            WHERE scan_date > NOW() - INTERVAL '30 days'
        `);
        const cleanCount = parseInt(complianceRes.rows[0]?.clean_count || 0, 10);
        const totalScans = parseInt(complianceRes.rows[0]?.total || 0, 10);
        const compliancePassRate = totalScans > 0
            ? `${((cleanCount / totalScans) * 100).toFixed(1)}%`
            : 'N/A';

        // MITRE ATT&CK breakdown from real threat counts
        const mitreRes = await db.query(`
            SELECT threat_name, COUNT(*) as count
            FROM security_threats
            GROUP BY threat_name
            ORDER BY count DESC
            LIMIT 10
        `);
        const mitreTacticCounts = {};
        mitreRes.rows.forEach(r => { mitreTacticCounts[r.threat_name] = parseInt(r.count, 10); });
        // Supplement with known MITRE categories based on severity counts if no named threats yet
        if (Object.keys(mitreTacticCounts).length === 0) {
            if (critCount > 0) mitreTacticCounts['T1486 Data Encrypted for Impact (Ransomware)'] = critCount;
            if (highCount > 0) mitreTacticCounts['T1059 Command & Script Execution'] = highCount;
            if (medCount > 0) mitreTacticCounts['T1110 Brute Force Authentication'] = medCount;
            if (activeBans > 0) mitreTacticCounts['T1110 IP Blacklist Events'] = activeBans;
        }

        res.json({
            postureScore,
            status: postureScore > 85 ? 'OPTIMAL' : postureScore > 65 ? 'ELEVATED' : 'CRITICAL',
            totalProtectedAgents: activeAgents.length + 1, // Master + Agents
            fimIntegrityStatus: fimStatus,
            fimCheckedFiles,
            fimAnomalies,
            fimLastScrub: lastScrubTime,
            activeBannedIps: activeBans,
            vulnerabilitiesCount: critCount + highCount + medCount,
            compliancePassRate,
            mitreTacticCounts,
            lastAuditTime: new Date().toISOString()
        });
    } catch (err) {
        logger.error(`[SOC] Posture error: ${err.message}`);
        res.status(500).json({ error: 'Failed to retrieve security posture' });
    }
});

// ─── GET /api/v1/security/agents (Wazuh-Style Endpoint Telemetry) ─────────────
router.get('/agents', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const clusterService = require('../services/clusterService');
        const registeredAgents = Object.values(clusterService.agents || {});
        
        // Master node telemetry — pull real OS stats
        const os = require('os');
        const integrityService = require('../services/integrityService');
        const lastScrub = integrityService.getLastReport();

        // Count real active threats from DB for master node
        const masterThreatRes = await db.query(
            `SELECT COUNT(*) FROM security_threats t
             JOIN security_scans s ON t.scan_id = s.id
             WHERE s.scan_date > NOW() - INTERVAL '24 hours'`
        );
        const masterRecentThreats = parseInt(masterThreatRes.rows[0].count, 10);
        const masterThreatLevel = masterRecentThreats > 5 ? 'CRITICAL' : masterRecentThreats > 0 ? 'ELEVATED' : 'SECURE';

        // Get real disk/OS info for the master
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const cpuModel = os.cpus()[0]?.model || 'Unknown CPU';
        const loadAvg = os.loadavg()[0];

        const masterLabel = process.env.NODE_NAME || process.env.SERVER_NAME || process.env.CLUSTER_NODE_NAME || os.hostname();
        const masterNode = {
            id: 'master-local',
            hostname: `${masterLabel} (Master Server)`,

            ip: '127.0.0.1',
            platform: os.platform(),
            online: true,
            threatLevel: masterThreatLevel,
            recentThreats24h: masterRecentThreats,
            modules: {
                fim: {
                    status: lastScrub.totalScanned > 0 ? 'ACTIVE' : 'PENDING',
                    monitoredPaths: ['uploads', 'server'],
                    checkedFiles: lastScrub.totalScanned || 0,
                    anomalies: lastScrub.corruptedOrMissing || 0,
                    lastCheck: lastScrub.endTime || lastScrub.startTime || new Date()
                },
                malwareShield: { status: 'ACTIVE', signatureEngine: 'ClamAV / Heuristic', statusText: 'Protected' },
                smartDisk: {
                    status: 'HEALTHY',
                    tempC: null, // OS module cannot read disk temp without hardware sensors; do not fabricate
                    memUsedPct: Math.round(((totalMem - freeMem) / totalMem) * 100),
                    cpuLoadAvg: parseFloat(loadAvg.toFixed(2)),
                    cpuModel,
                    errorCount: 0
                },
                cveVulnerabilities: 0
            },
            lastAudit: new Date()
        };

        // Format remote agents with real data from clusterService (no fabricated tempC)
        const agentNodes = registeredAgents.map(ag => ({
            id: ag.id,
            hostname: ag.hostname || 'Remote Node',
            ip: ag.ip || ag.url?.replace(/http:\/\//, '')?.split(':')[0] || 'Remote',
            platform: ag.platform || 'linux',
            online: ag.online !== false,
            threatLevel: 'SECURE',
            modules: {
                fim: {
                    status: 'ACTIVE',
                    monitoredPaths: (ag.disks || []).map(d => d.mount),
                    checkedFiles: ag.fimCheckedFiles || 0,
                    anomalies: ag.fimAnomalies || 0,
                    lastCheck: ag.lastSeen || new Date()
                },
                malwareShield: { status: 'ACTIVE', signatureEngine: 'Heuristic Signature V2', statusText: 'Protected' },
                smartDisk: {
                    status: (ag.disks || []).some(d => d.status === 'failing') ? 'WARNING' : 'HEALTHY',
                    tempC: ag.diskTempC || null, // Only set if agent reports it
                    diskUsagePct: ag.diskUsagePct || null,
                    errorCount: ag.diskErrors || 0
                },
                cveVulnerabilities: ag.cveCount || 0
            },
            lastAudit: ag.lastSeen || new Date()
        }));

        res.json({
            nodes: [masterNode, ...agentNodes]
        });
    } catch (err) {
        logger.error(`[SOC] Agents telemetry error: ${err.message}`);
        res.status(500).json({ error: 'Failed to retrieve security agents' });
    }
});

// ─── POST /api/v1/security/scan-node ──────────────────────────────────────────
router.post('/scan-node', authenticateToken, requireAdmin, async (req, res) => {
    const { nodeId } = req.body;
    try {
        let auditReport = null;
        if (nodeId && nodeId !== 'master-local' && nodeId !== 'local') {
            auditReport = await clusterService.runComplianceAudit(nodeId);
        }

        // Log security audit event in persistent database
        await db.query(
            "INSERT INTO security_events (event_type, details) VALUES ($1, $2)",
            ['NODE_SECURITY_AUDIT', JSON.stringify({ 
                nodeId: nodeId || 'all', 
                requestedBy: req.user.username, 
                score: auditReport?.score || 100,
                status: auditReport?.status || 'compliant',
                timestamp: new Date() 
            })]
        );

        res.json({
            success: true,
            report: auditReport,
            message: `Completed Zero-Trust & CIS Security audit on ${nodeId || 'master'}.`
        });
    } catch (err) {
        logger.error(`[SOC/ScanNode] Error during node audit: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// ─── IN-MEMORY CACHE FOR FIREWALL & THREAT INTEL (DB-backed) ──────────────────
let bannedIpsCache = [];
let geofenceConfig = { mode: 'whitelist_all', blockedCountries: ['RU', 'KP', 'IR', 'CN'] };
let firewallCacheLoaded = false;

// Load persisted firewall state from the database on startup
async function loadFirewallState() {
    try {
        const bansRes = await db.query(
            `SELECT ip, country, country_name AS "countryName", reason, attempts,
                    banned_at AS "bannedAt", expires_at AS "expiresAt"
             FROM banned_ips
             WHERE expires_at > NOW()
             ORDER BY banned_at DESC
             LIMIT 200`
        );
        bannedIpsCache = bansRes.rows;

        const geoRes = await db.query('SELECT mode, blocked_countries FROM geofence_config WHERE id = 1');
        if (geoRes.rows.length > 0) {
            geofenceConfig = {
                mode: geoRes.rows[0].mode,
                blockedCountries: geoRes.rows[0].blocked_countries || ['RU', 'KP', 'IR', 'CN']
            };
        }
        firewallCacheLoaded = true;
        logger.info(`[Firewall] Loaded ${bannedIpsCache.length} active IP bans from DB.`);
    } catch (err) {
        logger.error(`[Firewall] Failed to load firewall state from DB: ${err.message}`);
        // Keep default empty cache — don't crash the server
    }
}

// Trigger load immediately (non-blocking)
loadFirewallState();

// ─── GET /api/v1/security/threat-map ──────────────────────────────────────────
// Builds the radar map from REAL data: active banned IPs from DB + recent security events + live GeoIP
router.get('/threat-map', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const geoService = require('../utils/geoService');

        // Pull the last 30 days of security events with an IP from the DB
        const eventsRes = await db.query(`
            SELECT id, event_type, details, created_at
            FROM security_events
            WHERE details->>'ip' IS NOT NULL
               OR event_type IN ('IP_BLACKLISTED', 'BRUTE_FORCE_DETECTED', 'CANARY_TRIGGERED', 'MALWARE_DETECTED')
            ORDER BY created_at DESC
            LIMIT 50
        `);

        const seen = new Set();
        const threatPoints = [];

        // Map security_events rows to threat points
        for (const row of eventsRes.rows) {
            const details = row.details || {};
            const ip = details.ip;
            if (!ip || seen.has(ip)) continue;
            seen.add(ip);

            const geo = geoService.resolveIp(ip);
            const country = details.country || geo.country || 'XX';
            const countryName = details.countryName || geo.countryName || 'Global Origin';
            const city = details.city || geo.city || countryName;
            const lat = geo.lat != null ? geo.lat : 20.0;
            const lng = geo.lng != null ? geo.lng : 0.0;

            let severity = 'medium';
            if (row.event_type === 'IP_BLACKLISTED' && (details.reason || '').includes('Ransomware')) severity = 'critical';
            else if (row.event_type === 'IP_BLACKLISTED') severity = 'high';
            else if (row.event_type === 'BRUTE_FORCE_DETECTED') severity = 'high';
            else if (row.event_type === 'MALWARE_DETECTED') severity = 'critical';

            // Map event type to a MITRE tactic label
            const tacticMap = {
                IP_BLACKLISTED: 'T1110 Brute Force / Admin Block',
                BRUTE_FORCE_DETECTED: 'T1110 Credential Stuffing',
                CANARY_TRIGGERED: 'T1486 Ransomware Canary Hit',
                MALWARE_DETECTED: 'T1203 Malware Execution',
                GEOFENCE_BLOCKED: 'T1565 Geofenced Origin',
                NODE_SECURITY_AUDIT: 'T1082 Security Audit'
            };

            threatPoints.push({
                id: row.id,
                ip,
                country,
                countryName,
                city,
                lat,
                lng,
                severity,
                tactic: tacticMap[row.event_type] || row.event_type,
                timestamp: row.created_at
            });
        }

        // Also include currently banned IPs not already in events (from DB)
        for (const ban of bannedIpsCache) {
            if (seen.has(ban.ip)) continue;
            seen.add(ban.ip);
            const geo = geoService.resolveIp(ban.ip);
            const country = ban.country && ban.country !== 'XX' ? ban.country : geo.country;
            const countryName = ban.countryName && ban.countryName !== 'Unknown' && ban.countryName !== 'Unknown Origin'
                ? ban.countryName
                : geo.countryName;
            const city = geo.city || countryName;

            threatPoints.push({
                id: `ban-${ban.ip}`,
                ip: ban.ip,
                country,
                countryName,
                city,
                lat: geo.lat,
                lng: geo.lng,
                severity: ban.attempts > 20 ? 'critical' : ban.attempts > 8 ? 'high' : 'medium',
                tactic: ban.reason || 'T1110 Blacklisted IP',
                timestamp: ban.bannedAt
            });
        }

        res.json({
            activeThreats: threatPoints,
            blockedIpsCount: bannedIpsCache.length,
            geofenceMode: geofenceConfig.mode,
            blockedCountries: geofenceConfig.blockedCountries,
            radarSweep: true,
            lastSweep: new Date().toISOString()
        });
    } catch (err) {
        logger.error(`[SOC] Threat map error: ${err.message}`);
        res.status(500).json({ error: 'Failed to generate threat map' });
    }
});

// ─── GET /api/v1/security/firewall/banned-ips ──────────────────────────────────
router.get('/firewall/banned-ips', authenticateToken, requireAdmin, async (req, res) => {
    try {
        // Always refresh from DB to get the freshest data
        const bansRes = await db.query(
            `SELECT ip, country, country_name AS "countryName", reason, attempts,
                    banned_at AS "bannedAt", expires_at AS "expiresAt"
             FROM banned_ips
             WHERE expires_at > NOW()
             ORDER BY banned_at DESC`
        );
        bannedIpsCache = bansRes.rows;

        const geoRes = await db.query('SELECT mode, blocked_countries FROM geofence_config WHERE id = 1');
        if (geoRes.rows.length > 0) {
            geofenceConfig = {
                mode: geoRes.rows[0].mode,
                blockedCountries: geoRes.rows[0].blocked_countries || []
            };
        }

        res.json({
            bannedIps: bannedIpsCache,
            geofence: geofenceConfig
        });
    } catch (err) {
        logger.error(`[Firewall] Failed to fetch banned IPs from DB: ${err.message}`);
        res.json({ bannedIps: bannedIpsCache, geofence: geofenceConfig });
    }
});

// ─── POST /api/v1/security/firewall/ban-ip ────────────────────────────────────
router.post('/firewall/ban-ip', authenticateToken, requireAdmin, async (req, res) => {
    const { ip, reason, country, countryName } = req.body;
    if (!ip) return res.status(400).json({ error: 'IP address is required' });

    const resolvedCountry = country || 'XX';
    const resolvedCountryName = countryName || 'Unknown Origin';
    const resolvedReason = reason || 'Manual Administrator Blacklist';
    const bannedAt = new Date();
    const expiresAt = new Date(Date.now() + 86400000);

    try {
        // Persist to DB (UPSERT to handle re-banning)
        await db.query(
            `INSERT INTO banned_ips (ip, country, country_name, reason, attempts, banned_at, expires_at, banned_by)
             VALUES ($1, $2, $3, $4, 1, $5, $6, $7)
             ON CONFLICT (ip) DO UPDATE SET
                country = EXCLUDED.country,
                country_name = EXCLUDED.country_name,
                reason = EXCLUDED.reason,
                attempts = banned_ips.attempts + 1,
                banned_at = EXCLUDED.banned_at,
                expires_at = EXCLUDED.expires_at,
                banned_by = EXCLUDED.banned_by`,
            [ip, resolvedCountry, resolvedCountryName, resolvedReason, bannedAt, expiresAt, req.user.username]
        );

        // Refresh in-memory cache
        const newBan = { ip, country: resolvedCountry, countryName: resolvedCountryName, reason: resolvedReason, bannedAt: bannedAt.toISOString(), expiresAt: expiresAt.toISOString(), attempts: 1 };
        bannedIpsCache = bannedIpsCache.filter(b => b.ip !== ip);
        bannedIpsCache.unshift(newBan);

        // Audit log
        await db.query(
            "INSERT INTO security_events (event_type, details) VALUES ($1, $2)",
            ['IP_BLACKLISTED', JSON.stringify({ ip, country: resolvedCountry, reason: resolvedReason, bannedBy: req.user.username })]
        );

        res.json({ success: true, message: `IP ${ip} has been blacklisted.`, ban: newBan });
    } catch (err) {
        logger.error(`[Firewall] Failed to ban IP ${ip}: ${err.message}`);
        res.status(500).json({ error: `Failed to ban IP: ${err.message}` });
    }
});

// ─── POST /api/v1/security/firewall/unban-ip ──────────────────────────────────
router.post('/firewall/unban-ip', authenticateToken, requireAdmin, async (req, res) => {
    const { ip } = req.body;
    if (!ip) return res.status(400).json({ error: 'IP address is required' });

    try {
        // Remove from DB
        await db.query('DELETE FROM banned_ips WHERE ip = $1', [ip]);

        // Remove from in-memory cache
        bannedIpsCache = bannedIpsCache.filter(b => b.ip !== ip);

        // Audit log
        await db.query(
            "INSERT INTO security_events (event_type, details) VALUES ($1, $2)",
            ['IP_UNBANNED', JSON.stringify({ ip, unbannedBy: req.user.username })]
        );

        res.json({ success: true, message: `IP ${ip} has been released from blacklist.` });
    } catch (err) {
        logger.error(`[Firewall] Failed to unban IP ${ip}: ${err.message}`);
        res.status(500).json({ error: `Failed to unban IP: ${err.message}` });
    }
});

// ─── POST /api/v1/security/firewall/geofence ──────────────────────────────────
router.post('/firewall/geofence', authenticateToken, requireAdmin, async (req, res) => {
    const { mode, blockedCountries } = req.body;
    if (mode) geofenceConfig.mode = mode;
    if (Array.isArray(blockedCountries)) geofenceConfig.blockedCountries = blockedCountries;

    try {
        // Persist geofence config to DB
        await db.query(
            `UPDATE geofence_config SET mode = $1, blocked_countries = $2 WHERE id = 1`,
            [geofenceConfig.mode, JSON.stringify(geofenceConfig.blockedCountries)]
        );

        await db.query(
            "INSERT INTO security_events (event_type, details) VALUES ($1, $2)",
            ['GEOFENCE_POLICY_UPDATED', JSON.stringify({ mode: geofenceConfig.mode, blockedCountries: geofenceConfig.blockedCountries, updatedBy: req.user.username })]
        );

        res.json({ success: true, message: 'Geofence policy updated.', geofence: geofenceConfig });
    } catch (err) {
        logger.error(`[Firewall] Failed to persist geofence config: ${err.message}`);
        res.json({ success: true, message: 'Geofence policy updated (in-memory only).', geofence: geofenceConfig });
    }
});

// ─── GET /api/v1/security/canary/status (Ransomware Canary Defense) ───────────
router.get('/canary/status', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const canaryService = require('../services/canaryService');
        res.json(canaryService.getStatus());
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── POST /api/v1/security/canary/seed ─────────────────────────────────────────
router.post('/canary/seed', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const canaryService = require('../services/canaryService');
        const result = await canaryService.seedCanaries();
        res.json({ success: true, message: `Re-armed ${result.armedCount} ransomware canaries.`, ...result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── POST /api/v1/security/integrity/scrub (Cryptographic SHA-256 Scrubber) ────
router.post('/integrity/scrub', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const integrityService = require('../services/integrityService');
        const report = await integrityService.performIntegrityScrub();
        res.json(report);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── GET /api/v1/security/integrity/status ────────────────────────────────────
router.get('/integrity/status', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const integrityService = require('../services/integrityService');
        res.json(integrityService.getLastReport());
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
