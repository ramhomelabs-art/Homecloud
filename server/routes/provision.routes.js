const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const AdmZip = require('adm-zip');
const { authenticateToken, requireRole } = require('../middleware/auth');
const logger = require('../utils/logger');

// Flexible auth: header Bearer token OR ?token= query parameter (for direct curl / powershell / browser downloads)
const flexibleAuth = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const headerToken = authHeader && authHeader.split(' ')[1];
    const queryToken = req.query.token;
    const token = headerToken || queryToken;

    if (!token) {
        return res.status(401).json({ error: 'Authentication token is required' });
    }

    const jwt = require('jsonwebtoken');
    const secret = process.env.JWT_SECRET;
    if (!secret) return res.status(500).json({ error: 'Server misconfiguration: JWT_SECRET not set' });
    jwt.verify(token, secret, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired token' });
        req.user = user;
        next();
    });
};

// ── GET /api/v1/provision/info (Fleet pairing metadata & commands) ───────────
router.get('/info', flexibleAuth, (req, res) => {
    const masterUrl = `${req.protocol}://${req.get('host')}`;
    const agentKey = process.env.AGENT_KEY;
    if (!agentKey) return res.status(500).json({ error: 'Server misconfiguration: AGENT_KEY not set' });
    const userToken = req.query.token || (req.headers['authorization'] || '').split(' ')[1] || '';

    const windowsCommand = `irm "${masterUrl}/api/v1/provision/script/windows?token=${userToken}" | iex`;
    const linuxCommand = `curl -fsSL "${masterUrl}/api/v1/provision/script/linux?token=${userToken}" | sudo bash`;

    res.json({
        masterUrl,
        agentKey,
        windowsCommand,
        linuxCommand
    });
});

// ── GET /api/v1/provision/script/windows (Dynamic 1-Line PowerShell Script) ───
router.get('/script/windows', flexibleAuth, (req, res) => {
    const templateDir = path.join(__dirname, '..', 'templates');
    const pScript = path.join(templateDir, 'install.ps1');
    const masterUrl = `${req.protocol}://${req.get('host')}`;
    const agentKey = process.env.AGENT_KEY;
    const userToken = req.query.token || (req.headers['authorization'] || '').split(' ')[1] || '';
    if (!agentKey) return res.status(500).send('# Error: Server misconfiguration: AGENT_KEY not set.');

    if (!fs.existsSync(pScript)) {
        return res.status(404).send('# Error: Windows install template not found on server.');
    }

    let content = fs.readFileSync(pScript, 'utf8');
    content = content.replace(/__MASTER_URL__/g, masterUrl);
    content = content.replace(/__AGENT_KEY__/g, agentKey);
    content = content.replace(/__USER_TOKEN__/g, userToken);

    res.set({
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store'
    });
    res.send(content);
});

// ── GET /api/v1/provision/script/linux (Dynamic 1-Line Bash Script) ───────────
router.get('/script/linux', flexibleAuth, (req, res) => {
    const templateDir = path.join(__dirname, '..', 'templates');
    const sScript = path.join(templateDir, 'install.sh');
    const masterUrl = `${req.protocol}://${req.get('host')}`;
    const agentKey = process.env.AGENT_KEY;
    const userToken = req.query.token || (req.headers['authorization'] || '').split(' ')[1] || '';
    if (!agentKey) return res.status(500).send('# Error: Server misconfiguration: AGENT_KEY not set.');

    if (!fs.existsSync(sScript)) {
        return res.status(404).send('# Error: Linux install template not found on server.');
    }

    let content = fs.readFileSync(sScript, 'utf8');
    content = content.replace(/__MASTER_URL__/g, masterUrl);
    content = content.replace(/__AGENT_KEY__/g, agentKey);
    content = content.replace(/__USER_TOKEN__/g, userToken);

    res.set({
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store'
    });
    res.send(content);
});


// ── GET /api/v1/provision/download/:os (Offline Standalone ZIP package) ───────
router.get('/download/:os', flexibleAuth, (req, res) => {
    const osType = req.params.os; // 'windows' or 'linux'
    const agentDir = path.join(__dirname, '..', '..', 'agent');
    const zip = new AdmZip();

    logger.info(`[Provisioning] Generating node agent package for ${osType}...`);

    // 1. Add agent source folder
    if (fs.existsSync(agentDir)) {
        zip.addLocalFolder(agentDir, 'agent');
    } else {
        logger.warn(`[Provisioning] Agent directory not found at ${agentDir}`);
    }

    // 2. Add installer templates with resolved master URL and agent key
    const templateDir = path.join(__dirname, '..', 'templates');
    const masterUrl = `${req.protocol}://${req.get('host')}`;
    const agentKey = process.env.AGENT_KEY;
    if (!agentKey) return res.status(500).json({ error: 'Server misconfiguration: AGENT_KEY not set' });

    if (osType === 'windows') {
        const pScript = path.join(templateDir, 'install.ps1');
        if (fs.existsSync(pScript)) {
            let content = fs.readFileSync(pScript, 'utf8');
            content = content.replace(/__MASTER_URL__/g, masterUrl);
            content = content.replace(/__AGENT_KEY__/g, agentKey);
            zip.addFile('install.ps1', Buffer.from(content, 'utf8'));
        }
    } else {
        const sScript = path.join(templateDir, 'install.sh');
        if (fs.existsSync(sScript)) {
            let content = fs.readFileSync(sScript, 'utf8');
            content = content.replace(/__MASTER_URL__/g, masterUrl);
            content = content.replace(/__AGENT_KEY__/g, agentKey);
            zip.addFile('install.sh', Buffer.from(content, 'utf8'));
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
