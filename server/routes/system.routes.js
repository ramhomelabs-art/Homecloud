const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const path = require('path');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const getGitInfo = () => {
    return new Promise((resolve) => {
        // Check if inside a git work tree
        exec('git rev-parse --is-inside-work-tree', { cwd: path.join(__dirname, '../..') }, (err, stdout) => {
            if (err || stdout.trim() !== 'true') {
                return resolve({
                    isGit: false,
                    localHash: 'v1.0.0',
                    remoteHash: 'v1.0.0',
                    updateAvailable: false
                });
            }

            // Get local commit hash
            exec('git rev-parse --short HEAD', { cwd: path.join(__dirname, '../..') }, (errLocal, localHash) => {
                const lHash = errLocal ? 'unknown' : localHash.trim();

                // Fetch remote changes first, then check remote hash
                exec('git fetch origin && git rev-parse --short origin/main', { cwd: path.join(__dirname, '../..') }, (errRemote, remoteHash) => {
                    if (errRemote) {
                        // Remote check might fail if offline or git origin not configured
                        return resolve({
                            isGit: true,
                            localHash: lHash,
                            remoteHash: 'unknown',
                            updateAvailable: false
                        });
                    }

                    const rHash = remoteHash.trim();
                    resolve({
                        isGit: true,
                        localHash: lHash,
                        remoteHash: rHash,
                        updateAvailable: lHash !== rHash && lHash !== 'unknown' && rHash !== 'unknown'
                    });
                });
            });
        });
    });
};

// GET system git version details
router.get('/version', authenticateToken, async (req, res) => {
    try {
        const info = await getGitInfo();
        res.json(info);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST execute system updates
router.post('/update', authenticateToken, requireAdmin, (req, res) => {
    res.json({ message: 'Update process started in the background. NexaDisk will restart shortly.' });

    const updateCmd = process.platform === 'win32' ? 'update.bat' : 'sudo ./update.sh';

    setTimeout(() => {
        console.log(`[System Update] Executing update command: "${updateCmd}"`);
        exec(updateCmd, { cwd: path.join(__dirname, '../..') }, (err, stdout, stderr) => {
            if (err) {
                console.error(`[System Update Error] Upgrade failed:`, err.message);
                return;
            }
            console.log(`[System Update Output]`, stdout);
        });
    }, 1500);
});

module.exports = router;
