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
    const masterUrl = `${req.protocol}://${req.get('host')}`;
    const agentKey = process.env.AGENT_KEY || 'nexadisk-agent-secret-key';

    if (osType === 'windows') {
        const pScript = path.join(templateDir, 'install.ps1');
        if (fs.existsSync(pScript)) {
            let content = fs.readFileSync(pScript, 'utf8');
            content = content.replace(/__MASTER_URL__/g, masterUrl);
            content = content.replace(/__AGENT_KEY__/g, agentKey);
            zip.addFile('install.ps1', Buffer.from(content, 'utf8'));
        } else {
            logger.warn(`[Provisioning] Template install.ps1 not found at ${pScript}`);
        }
    } else {
        const sScript = path.join(templateDir, 'install.sh');
        if (fs.existsSync(sScript)) {
            let content = fs.readFileSync(sScript, 'utf8');
            content = content.replace(/__MASTER_URL__/g, masterUrl);
            content = content.replace(/__AGENT_KEY__/g, agentKey);
            zip.addFile('install.sh', Buffer.from(content, 'utf8'));
        } else {
            logger.warn(`[Provisioning] Template install.sh not found at ${sScript}`);
        }
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
