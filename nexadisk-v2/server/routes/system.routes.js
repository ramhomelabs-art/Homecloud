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

                exec('git fetch origin && git rev-parse --short origin/main', { cwd: path.join(__dirname, '..') }, (errRemote, remoteHash) => {
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
router.post('/test-alert', authenticateToken, async (req, res) => {
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

module.exports = router;
