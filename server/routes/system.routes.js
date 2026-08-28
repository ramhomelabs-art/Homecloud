const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const path = require('path');
const { authenticateToken, requireRole } = require('../middleware/auth');
const notificationService = require('../services/notificationService');
const logger = require('../utils/logger');

const getGitInfo = () => {
    let appVersion = '2.0.0';
    try {
        const pkg = require(path.join(__dirname, '..', 'package.json'));
        appVersion = pkg.version || '2.0.0';
    } catch (e) {}

    return new Promise((resolve) => {
        exec('git rev-parse --is-inside-work-tree', { cwd: path.join(__dirname, '..') }, (err, stdout) => {
            if (err || stdout.trim() !== 'true') {
                return resolve({
                    isGit: false,
                    localHash: `v${appVersion}`,
                    remoteHash: `v${appVersion}`,
                    updateAvailable: false
                });
            }

            exec('git rev-parse --short HEAD', { cwd: path.join(__dirname, '..') }, (errLocal, localHash) => {
                const lHash = errLocal ? 'unknown' : localHash.trim();
                const localVersionStr = lHash === 'unknown' ? `v${appVersion}` : `v${appVersion} (${lHash})`;

                exec('git rev-parse --short origin/main', { cwd: path.join(__dirname, '..') }, (errRemote, remoteHash) => {
                    if (errRemote) {
                        return resolve({
                            isGit: true,
                            localHash: localVersionStr,
                            remoteHash: 'unknown',
                            updateAvailable: false
                        });
                    }

                    const rHash = remoteHash.trim();
                    const remoteVersionStr = rHash === 'unknown' ? 'unknown' : `v${appVersion} (${rHash})`;
                    
                    resolve({
                        isGit: true,
                        localHash: localVersionStr,
                        remoteHash: remoteVersionStr,
                        updateAvailable: lHash !== rHash && lHash !== 'unknown' && rHash !== 'unknown'
                    });
                });
            });
        });
    });
};

// ── GET /api/v1/system/version ──────────────────────────────────────────────
router.get('/version', authenticateToken, async (req, res) => {
    try {
        const info = await getGitInfo();
        res.json(info);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/v1/system/settings ─────────────────────────────────────────────
router.get('/settings', authenticateToken, async (req, res) => {
    const db = require('../config/database');
    try {
        const result = await db.query('SELECT key, value FROM app_settings');
        const settings = {};
        result.rows.forEach(r => { settings[r.key] = r.value; });
        res.json(settings);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/v1/system/update ──────────────────────────────────────────────
router.post('/update', authenticateToken, requireRole(['Admin']), (req, res) => {
    res.json({ message: 'Update process started in the background. NexaDisk will restart shortly.' });

    const updateCmd = process.platform === 'win32' ? 'update.bat' : 'sudo ./update.sh';

    setTimeout(() => {
        logger.info(`[System Update] Executing update command: "${updateCmd}"`);
        exec(updateCmd, { cwd: path.join(__dirname, '../..') }, (err, stdout, stderr) => {
            if (err) {
                logger.error(`[System Update Error] Upgrade failed: ${err.message}`);
                return;
            }
            logger.info(`[System Update Output] ${stdout}`);
        });
    }, 1500);
});

// ── POST /api/v1/system/test-alert ──────────────────────────────────────────
router.post('/test-alert', authenticateToken, requireRole(['Admin']), async (req, res) => {
    try {
        const title = 'Telegram Bot Test 🔔';
        const detail = 'This is a mock system alert dispatched from the NexaDisk Alert Management Console to verify Telegram bot connectivity and settings.';
        await notificationService.sendTelegramMessage(`<b>[${title}]</b>\n${detail}`);
        await notificationService.sendInAppAlert(title, detail, 'info');
        res.json({ success: true });
    } catch (err) {
        logger.error(`[System Routes] Test alert failed: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/v1/system/test-discord ─────────────────────────────────────────
router.post('/test-discord', authenticateToken, requireRole(['Admin']), async (req, res) => {
    try {
        const title = 'Discord Webhook Test 🚀';
        const detail = 'This is a test alert dispatched from the **NexaDisk Alert Control Room** to verify your Discord webhook integration.\n\n✅ Connection successful!';
        await notificationService.sendDiscordMessage(title, detail, 'info');
        await notificationService.sendInAppAlert(title, 'Discord webhook test dispatched successfully.', 'info');
        res.json({ success: true });
    } catch (err) {
        logger.error(`[System Routes] Discord test failed: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/v1/system/test-email ───────────────────────────────────────────
router.post('/test-email', authenticateToken, requireRole(['Admin', 'Operator']), async (req, res) => {
    const emailService = require('../services/emailService');
    const { targetEmail, config } = req.body;
    const recipient = targetEmail || req.user?.email;

    if (!recipient) {
        return res.status(400).json({ error: 'Target email address is required for SMTP test' });
    }

    try {
        const result = await emailService.sendTestEmail(recipient, config);
        if (result.success) {
            res.json({ success: true, message: `Test email dispatched to ${recipient}`, messageId: result.messageId });
        } else {
            res.status(400).json({ error: result.error || 'Failed to send test email' });
        }
    } catch (err) {
        logger.error(`[System Routes] Email test failed: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
