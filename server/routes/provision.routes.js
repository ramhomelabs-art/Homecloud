const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const AdmZip = require('adm-zip');
const { authenticateToken } = require('../middleware/auth');

router.get('/download/:os', authenticateToken, (req, res) => {
    const osType = req.params.os; // 'windows' or 'linux'
    const agentDir = path.join(__dirname, '..', '..', 'agent');
    const zip = new AdmZip();

    // 1. Add agent source
    if (fs.existsSync(agentDir)) {
        zip.addLocalFolder(agentDir, 'agent');
    }

    // 2. Add appropriate installer
    const templateDir = path.join(__dirname, '..', 'templates');
    if (osType === 'windows') {
        const pScript = path.join(templateDir, 'install.ps1');
        if (fs.existsSync(pScript)) zip.addLocalFile(pScript, '', 'install.ps1');
    } else {
        const sScript = path.join(templateDir, 'install.sh');
        if (fs.existsSync(sScript)) zip.addLocalFile(sScript, '', 'install.sh');
    }

    const zipBuffer = zip.toBuffer();
    res.set({
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename=NexaDisk-Agent-${osType}.zip`,
        'Content-Length': zipBuffer.length
    });
    res.send(zipBuffer);
});

module.exports = router;
