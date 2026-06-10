const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const AdmZip = require('adm-zip');
const { authenticateToken } = require('../middleware/auth');
const logger = require('../utils/logger');

// ── GET /api/v1/provision/download/:os ──────────────────────────────────────
router.get('/download/:os', authenticateToken, (req, res) => {
    const osType = req.params.os; // 'windows' or 'linux'
    const agentDir = path.join(__dirname, '..', '..', 'agent');
    const zip = new AdmZip();

    logger.info(`[Provisioning] Generating node agent package for ${osType}...`);

    // 1. Add agent source folder if exists
    if (fs.existsSync(agentDir)) {
        zip.addLocalFolder(agentDir, 'agent');
    } else {
        // Fallback: If agent source folder doesn't exist, we can add a dummy file or report error
        logger.warn(`[Provisioning] Agent directory not found at ${agentDir}`);
    }

    // 2. Add installer templates
    const templateDir = path.join(__dirname, '..', 'templates');
    if (osType === 'windows') {
        const pScript = path.join(templateDir, 'install.ps1');
        if (fs.existsSync(pScript)) zip.addLocalFile(pScript, '', 'install.ps1');
    } else {
        const sScript = path.join(templateDir, 'install.sh');
        if (fs.existsSync(sScript)) zip.addLocalFile(sScript, '', 'install.sh');
    }

    try {
        const zipBuffer = zip.toBuffer();
        res.set({
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename=NexaDisk-Agent-${osType}.zip`,
            'Content-Length': zipBuffer.length
        });
        res.send(zipBuffer);
    } catch (err) {
        logger.error(`[Provisioning] Failed to generate agent zip: ${err.message}`);
        res.status(500).json({ error: `Failed to compile agent package: ${err.message}` });
    }
});

module.exports = router;
