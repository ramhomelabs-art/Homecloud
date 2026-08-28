const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const auditService = require('../services/auditService');
const siemService = require('../services/siemService');
const db = require('../config/database');
const logger = require('../utils/logger');

// 📋 GET /api/v1/audit (Query audit logs with filtering & pagination)
router.get('/', authenticateToken, requireRole(['Admin', 'Operator']), async (req, res) => {
    try {
        const filters = {
            username: req.query.username,
            action: req.query.action,
            search: req.query.search,
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            limit: req.query.limit,
            offset: req.query.offset
        };
        const result = await auditService.getLogs(filters);
        res.json(result);
    } catch (err) {
        logger.error(`[Audit Routes] GET / failed: ${err.message}`);
        res.status(500).json({ error: 'Failed to retrieve audit logs' });
    }
});

// 📊 GET /api/v1/audit/stats (Security & Audit Dashboard Aggregations)
router.get('/stats', authenticateToken, requireRole(['Admin', 'Operator']), async (req, res) => {
    try {
        const stats = await auditService.getAuditStats();
        res.json(stats);
    } catch (err) {
        logger.error(`[Audit Routes] GET /stats failed: ${err.message}`);
        res.status(500).json({ error: 'Failed to retrieve audit statistics' });
    }
});

// 🛡️ GET /api/v1/audit/verify-integrity (Cryptographic Tamper-Evident Verification)
router.get('/verify-integrity', authenticateToken, requireRole(['Admin']), async (req, res) => {
    try {
        const result = await auditService.verifyIntegrity();
        res.json(result);
    } catch (err) {
        logger.error(`[Audit Routes] GET /verify-integrity failed: ${err.message}`);
        res.status(500).json({ error: 'Failed to execute cryptographic integrity verification' });
    }
});

// 📥 GET /api/v1/audit/export/:format (Export logs to CEF, LEEF, JSON, CSV)
router.get('/export/:format', authenticateToken, requireRole(['Admin', 'Operator']), async (req, res) => {
    const { format } = req.params;
    const filters = {
        username: req.query.username,
        action: req.query.action,
        startDate: req.query.startDate,
        endDate: req.query.endDate
    };

    try {
        const logs = await auditService.getAllLogsForExport(filters, 5000);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

        switch (format.toLowerCase()) {
            case 'cef': {
                const cefData = siemService.exportCEF(logs);
                res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                res.setHeader('Content-Disposition', `attachment; filename="nexadisk-audit-${timestamp}.cef"`);
                return res.send(cefData);
            }
            case 'leef': {
                const leefData = siemService.exportLEEF(logs);
                res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                res.setHeader('Content-Disposition', `attachment; filename="nexadisk-audit-${timestamp}.leef"`);
                return res.send(leefData);
            }
            case 'json': {
                const jsonData = siemService.exportJSON(logs);
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                res.setHeader('Content-Disposition', `attachment; filename="nexadisk-audit-${timestamp}.json"`);
                return res.send(jsonData);
            }
            case 'csv': {
                const csvData = siemService.exportCSV(logs);
                res.setHeader('Content-Type', 'text/csv; charset=utf-8');
                res.setHeader('Content-Disposition', `attachment; filename="nexadisk-audit-${timestamp}.csv"`);
                return res.send(csvData);
            }
            default:
                return res.status(400).json({ error: `Unsupported export format: '${format}'. Allowed: 'cef', 'leef', 'json', 'csv'` });
        }
    } catch (err) {
        logger.error(`[Audit Routes] GET /export/${format} failed: ${err.message}`);
        res.status(500).json({ error: 'Failed to export audit logs' });
    }
});

// ⚙️ GET /api/v1/audit/siem/config (Retrieve SIEM Integration Settings)
router.get('/siem/config', authenticateToken, requireRole(['Admin']), async (req, res) => {
    try {
        const config = await siemService.getConfig();
        res.json(config);
    } catch (err) {
        logger.error(`[Audit Routes] GET /siem/config failed: ${err.message}`);
        res.status(500).json({ error: 'Failed to retrieve SIEM configuration' });
    }
});

// ⚙️ POST /api/v1/audit/siem/config (Save SIEM Integration Settings)
router.post('/siem/config', authenticateToken, requireRole(['Admin']), async (req, res) => {
    const { enabled, format, protocol, host, port, httpUrl, apiKey, facility, defaultSev } = req.body;

    try {
        const updates = [
            { key: 'siem_enabled', value: enabled ? 'true' : 'false' },
            { key: 'siem_format', value: format || 'CEF' },
            { key: 'siem_protocol', value: protocol || 'UDP' },
            { key: 'siem_host', value: host || '127.0.0.1' },
            { key: 'siem_port', value: String(port || 514) },
            { key: 'siem_http_url', value: httpUrl || '' },
            { key: 'siem_api_key', value: apiKey || '' },
            { key: 'siem_facility', value: String(facility || 1) },
            { key: 'siem_default_sev', value: String(defaultSev || 3) }
        ];

        for (const item of updates) {
            await db.query(`
                INSERT INTO app_settings (key, value) VALUES ($1, $2)
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
            `, [item.key, item.value]);
        }

        await auditService.log(req.user.id, req.user.username, 'SETTINGS_UPDATE', `Updated SIEM forwarder configuration (Enabled: ${enabled}, Protocol: ${protocol}, Format: ${format})`, req);
        res.json({ success: true, message: 'SIEM configuration updated successfully' });
    } catch (err) {
        logger.error(`[Audit Routes] POST /siem/config failed: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// 🧪 POST /api/v1/audit/siem/test (Test Connectivity to Remote SIEM / Syslog)
router.post('/siem/test', authenticateToken, requireRole(['Admin']), async (req, res) => {
    try {
        const testResult = await siemService.testConnection(req.body);
        res.json(testResult);
    } catch (err) {
        logger.warn(`[Audit Routes] SIEM test connection failed: ${err.message}`);
        res.status(400).json({ success: false, error: err.message });
    }
});

module.exports = router;
