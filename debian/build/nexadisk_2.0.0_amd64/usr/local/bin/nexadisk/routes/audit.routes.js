const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const auditService = require('../services/auditService');

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
        res.status(500).json({ error: 'Failed to retrieve audit logs' });
    }
});

module.exports = router;
