const express = require('express');
const router = express.Router();
const deploymentService = require('../services/deploymentService');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Get Pre-Flight System Status
router.get('/preflight', authenticateToken, (req, res) => {
    try {
        const stats = deploymentService.getDeploymentPreflight();
        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Generate Production .env configuration
router.post('/generate-env', authenticateToken, requireRole(['Admin']), (req, res) => {
    try {
        const envContent = deploymentService.generateProductionEnv(req.body);
        res.json({ content: envContent, filename: '.env.production' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Generate systemd service file
router.post('/generate-systemd', authenticateToken, requireRole(['Admin']), (req, res) => {
    try {
        const systemdContent = deploymentService.generateSystemdService(req.body);
        res.json({ content: systemdContent, filename: 'nexadisk.service' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Generate Nginx reverse proxy configuration
router.post('/generate-nginx', authenticateToken, requireRole(['Admin']), (req, res) => {
    try {
        const nginxContent = deploymentService.generateNginxConfig(req.body);
        res.json({ content: nginxContent, filename: 'nexadisk.nginx.conf' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
