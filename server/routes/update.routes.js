const express = require('express');
const router = express.Router();
const updateService = require('../services/updateService');
const { authenticateToken, requireRole } = require('../middleware/auth');
const logger = require('../utils/logger');

// Check for updates
router.get('/check', authenticateToken, async (req, res) => {
    try {
        const channel = req.query.channel || 'stable';
        const manifest = await updateService.checkUpdates({ channel });
        res.json(manifest);
    } catch (err) {
        logger.error(`[Update Routes] Check failed: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// Get Cluster Version Matrix
router.get('/cluster-matrix', authenticateToken, async (req, res) => {
    try {
        const matrix = await updateService.getClusterVersionMatrix();
        res.json(matrix);
    } catch (err) {
        logger.error(`[Update Routes] Failed to get version matrix: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// Trigger Rolling Update
router.post('/deploy', authenticateToken, requireRole(['Admin']), async (req, res) => {
    try {
        const { targetVersion, nodes } = req.body;
        const result = await updateService.executeRollingUpdate({ targetVersion, nodes });
        res.json(result);
    } catch (err) {
        logger.error(`[Update Routes] Deployment notice: ${err.message}`);
        res.status(400).json({ error: err.message });
    }
});

// Rollback Update
router.post('/rollback', authenticateToken, requireRole(['Admin']), async (req, res) => {
    try {
        const result = await updateService.rollbackUpdate();
        res.json(result);
    } catch (err) {
        logger.error(`[Update Routes] Rollback failed: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// Get Current Live Rollout Status & Logs
router.get('/status', authenticateToken, (req, res) => {
    try {
        const status = updateService.getStatus();
        res.json(status);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get & Set GitHub Repository Configuration
router.get('/config', authenticateToken, async (req, res) => {
    try {
        const repo = await updateService.getGitHubRepo();
        res.json({ repository: repo });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/config', authenticateToken, requireRole(['Admin']), async (req, res) => {
    const { repository, token } = req.body;
    try {
        if (repository) {
            const db = require('../config/database');
            await db.query(
                `INSERT INTO app_settings (key, value) VALUES ('github_repo', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
                [repository.trim()]
            );
        }
        if (token !== undefined) {
            const db = require('../config/database');
            await db.query(
                `INSERT INTO app_settings (key, value) VALUES ('github_token', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
                [token.trim()]
            );
        }
        res.json({ success: true, message: 'OTA repository settings updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Restart Server after update
router.post('/restart', authenticateToken, requireRole(['Admin']), async (req, res) => {
    try {
        logger.info(`[OTA Update] Server restart triggered by ${req.user?.username || 'admin'}`);
        res.json({ success: true, message: 'Server restart initiated. NexaDisk will reload shortly.' });

        setTimeout(() => {
            logger.info('[System Restart] Exiting process to allow service manager / container auto-restart...');
            process.exit(0);
        }, 1200);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
