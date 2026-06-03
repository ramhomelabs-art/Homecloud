const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const os = require('os');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const multer = require('multer');
const bodyParser = require('body-parser');
const AdmZip = require('adm-zip');
const db = require('../config/database');
const { getDirectorySize } = require('../utils/fileHelpers');
const { validateShareAccess } = require('../middleware/auth');

const SECRET_KEY = process.env.JWT_SECRET;
const API_BASE = '/api';

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const { path: targetPath, agentId } = req.query;
        if (agentId) return cb(null, os.tmpdir());
        const dest = targetPath || os.tmpdir();
        cb(null, dest);
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});
const upload = multer({ storage });

const getGateHTML = (share, error = '') => {
    return `
    <html>
    <head>
        <title>NexaDisk | Secure Gate</title>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800&family=Inter:wght@400;500;700&display=swap" rel="stylesheet">
        <style>
            :root {
                --bg-deep: #05070a;
                --accent-gold: #f2c94c;
                --accent-gold-glow: rgba(242, 201, 76, 0.15);
                --accent-cyan: #00f2ff;
                --border-dim: rgba(255, 255, 255, 0.05);
                --border-bright: rgba(242, 201, 76, 0.3);
            }
            body {
                background: radial-gradient(circle at 50% 50%, #111422 0%, #05070a 100%);
                color: #fff;
                font-family: 'Inter', sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100vh;
                margin: 0;
                overflow: hidden;
                position: relative;
            }
            body::before {
                content: '';
                position: absolute;
                width: 150%;
                height: 150%;
                background: radial-gradient(circle at 20% 30%, rgba(242, 201, 76, 0.04) 0%, transparent 40%),
                            radial-gradient(circle at 80% 70%, rgba(0, 242, 255, 0.04) 0%, transparent 40%);
                animation: drift 20s infinite linear;
                z-index: 1;
            }
            @keyframes drift {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
            .card {
                position: relative;
                background: rgba(13, 17, 23, 0.8);
                backdrop-filter: blur(20px);
                border: 1px solid var(--border-bright);
                padding: 40px 24px;
                border-radius: 24px;
                width: 100%;
                max-width: 440px;
                box-sizing: border-box;
                text-align: center;
                box-shadow: 0 24px 80px rgba(0, 0, 0, 0.6);
                z-index: 10;
            }
            .logo-icon {
                width: 60px;
                height: 60px;
                background: linear-gradient(135deg, var(--accent-gold), var(--accent-cyan));
                border-radius: 16px;
                margin: 0 auto 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 8px 24px var(--accent-gold-glow);
            }
            h2 {
                font-family: 'Outfit', sans-serif;
                font-size: 26px;
                font-weight: 800;
                margin: 0 0 8px 0;
                background: linear-gradient(to right, #ffffff, #8b949e);
                -webkit-background-clip: text;
                background-clip: text;
                -webkit-text-fill-color: transparent;
            }
            p.subtitle {
                color: #8b949e;
                font-size: 14px;
                margin: 0 0 32px 0;
            }
            .input-group {
                text-align: left;
                margin-bottom: 20px;
            }
            .input-group label {
                display: block;
                font-size: 11px;
                font-weight: 700;
                color: #8b949e;
                margin-bottom: 8px;
                text-transform: uppercase;
                letter-spacing: 0.8px;
            }
            input {
                width: 100%;
                padding: 14px 16px;
                background: rgba(0, 0, 0, 0.3);
                border: 1px solid var(--border-dim);
                border-radius: 12px;
                color: #fff;
                font-size: 15px;
                outline: none;
                transition: all 0.3s;
                box-sizing: border-box;
            }
            input:focus {
                border-color: var(--accent-gold);
                background: rgba(0, 0, 0, 0.5);
                box-shadow: 0 0 0 4px var(--accent-gold-glow);
            }
            button {
                width: 100%;
                padding: 16px;
                background: var(--accent-gold);
                border: none;
                font-weight: 700;
                font-size: 16px;
                color: #000;
                border-radius: 12px;
                cursor: pointer;
                margin-top: 12px;
                transition: all 0.3s;
            }
            button:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 24px rgba(242, 201, 76, 0.3);
                filter: brightness(1.1);
            }
            .meta-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 12px;
                margin-top: 32px;
                padding-top: 24px;
                border-top: 1px solid var(--border-dim);
            }
            .meta-item {
                background: rgba(0, 0, 0, 0.2);
                padding: 12px;
                border-radius: 10px;
                border: 1px solid var(--border-dim);
                text-align: left;
            }
            .meta-label {
                font-size: 9px;
                font-weight: 700;
                color: #484f58;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .meta-val {
                font-size: 12px;
                font-weight: 600;
                color: #c9d1d9;
                margin-top: 4px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .error {
                background: rgba(248, 81, 73, 0.1);
                border: 1px solid rgba(248, 81, 73, 0.2);
                color: #f85149;
                font-size: 13px;
                padding: 12px;
                border-radius: 10px;
                margin-bottom: 24px;
                font-weight: 500;
            }
            @media (max-width: 480px) {
                body {
                    padding: 16px;
                    height: auto;
                    min-height: 100vh;
                    overflow-y: auto;
                }
                .card {
                    padding: 32px 16px;
                }
                .meta-grid {
                    grid-template-columns: 1fr;
                }
            }
        </style>
    </head>
    <body>
        <div class="card">
            <div class="logo-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: #000;">
                    <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
                    <path d="M3 5V19A9 3 0 0 0 21 19V5"></path>
                    <path d="M3 12A9 3 0 0 0 21 12"></path>
                </svg>
            </div>
            <h2>Secure Gateway</h2>
            <p class="subtitle">Verification credentials required to access share</p>
            
            ${error ? `<div class="error">${error}</div>` : ''}
            
            <form method="POST" action="/public/share/${share.id}/verify">
                ${share.email ? `
                <div class="input-group">
                    <label>Destination Email</label>
                    <input type="email" name="email" placeholder="e.g. user@example.com" required />
                </div>
                ` : ''}
                ${share.password ? `
                <div class="input-group">
                    <label>Passkey Protection</label>
                    <input type="password" name="password" placeholder="Enter passkey to verify" required />
                </div>
                ` : ''}
                ${!share.email && !share.password ? `
                <p style="color: #8b949e; font-size: 14px; margin: 20px 0;">This folder is publicly accessible with no email or passkey constraints.</p>
                ` : ''}
                <button type="submit">Unlock & Access</button>
            </form>
            <div class="meta-grid">
                <div class="meta-item">
                    <div class="meta-label">EXPIRY TIME</div>
                    <div class="meta-val" title="${new Date(share.expiry).toLocaleString()}">${new Date(share.expiry).toLocaleString()}</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">ACCESS LIMIT</div>
                    <div class="meta-val">${share.max_views === -1 ? 'Unlimited' : (share.max_views - share.view_count) + ' Left'}</div>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;
};

router.get('/:id/list', validateShareAccess('View'), async (req, res) => {
    const { share } = req;
    const subPath = req.query.path || '';
    const fullPath = path.join(share.resolvedPath, subPath);
    if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ error: 'Not found' });
    }
    const stats = fs.statSync(fullPath);
    const normalizedFull = path.normalize(fullPath);
    const normalizedBase = path.normalize(share.resolvedPath);
    if (!normalizedFull.startsWith(normalizedBase)) {
        return res.status(403).json({ error: 'Access denied' });
    }
    if (!stats.isDirectory()) {
        return res.json([{ name: path.basename(fullPath), isDirectory: false, size: stats.size, modified: stats.mtime, path: subPath, extension: path.extname(fullPath).slice(1) }]);
    }
    try {
        const files = fs.readdirSync(fullPath, { withFileTypes: true });
        res.json(files.map(file => {
            const fPath = path.join(fullPath, file.name);
            let s = { size: 0, mtime: new Date() };
            try { s = fs.statSync(fPath); } catch (e) { }
            return { name: file.name, isDirectory: file.isDirectory(), size: file.isDirectory() ? getDirectorySize(fPath, 2) : s.size, modified: s.mtime, path: path.join(subPath, file.name), extension: file.isDirectory() ? '' : path.extname(file.name).slice(1) };
        }));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id/view', (req, res) => {
    const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
    if (fs.existsSync(clientDist)) return res.sendFile(path.join(clientDist, 'index.html'));
    res.status(404).send('Application UI not found');
});

router.get('/:id/download', validateShareAccess('View'), async (req, res) => {
    const { share } = req;
    const subPath = req.query.path || '';
    const fullPath = path.join(share.resolvedPath, subPath);
    if (!fullPath.startsWith(path.normalize(share.path))) return res.status(403).json({ error: 'Forbidden' });
    if (!fs.existsSync(fullPath)) return res.status(404).json({ error: 'Not found' });
    
    const stats = fs.statSync(fullPath);
    if (stats.isDirectory()) {
        try {
            const zip = new AdmZip();
            zip.addLocalFolder(fullPath);
            const zipBuffer = zip.toBuffer();
            res.set({
                'Content-Type': 'application/zip',
                'Content-Disposition': `attachment; filename="${path.basename(fullPath)}.zip"`,
                'Content-Length': zipBuffer.length
            });
            return res.send(zipBuffer);
        } catch (zipErr) {
            console.error(`[Guest Download ZIP Error] Failed to archive: ${zipErr.message}`);
            return res.status(500).json({ error: `Failed to create ZIP: ${zipErr.message}` });
        }
    }
    res.download(fullPath);
});

router.post('/:id/download/zip', validateShareAccess('View'), async (req, res) => {
    const { share } = req;
    const { paths } = req.body;
    if (!paths || !Array.isArray(paths) || paths.length === 0) {
        return res.status(400).json({ error: 'Paths array is required' });
    }

    try {
        const zip = new AdmZip();
        for (const subPath of paths) {
            const fullPath = path.join(share.resolvedPath, subPath);
            if (!fullPath.startsWith(share.resolvedPath)) continue;
            if (fs.existsSync(fullPath)) {
                const stats = fs.statSync(fullPath);
                if (stats.isDirectory()) {
                    zip.addLocalFolder(fullPath, path.basename(fullPath));
                } else {
                    zip.addLocalFile(fullPath);
                }
            }
        }
        const zipBuffer = zip.toBuffer();
        res.set({
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename="Share-Selection-${Date.now()}.zip"`,
            'Content-Length': zipBuffer.length
        });
        res.send(zipBuffer);
    } catch (err) {
        console.error(`[Public ZIP Selection Error]: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

router.post('/:id/upload', validateShareAccess('Edit'), upload.array('files'), (req, res) => {
    const { share } = req;
    const subPath = req.body.path || '';
    const targetDir = path.join(share.resolvedPath, subPath);
    if (!targetDir.startsWith(share.resolvedPath)) return res.status(403).json({ error: 'Forbidden' });
    req.files.forEach(file => fs.renameSync(file.path, path.join(targetDir, file.originalname)));
    res.json({ message: 'Upload successful' });
});

router.post('/:id/rename', validateShareAccess('Edit'), (req, res) => {
    const { share } = req;
    const { oldPath, newName } = req.body;
    const oldFullPath = path.join(share.resolvedPath, oldPath);
    if (!oldFullPath.startsWith(share.resolvedPath)) return res.status(403).json({ error: 'Forbidden' });
    fs.renameSync(oldFullPath, path.join(path.dirname(oldFullPath), newName));
    res.json({ message: 'Renamed successfully' });
});

router.delete('/:id/delete', validateShareAccess('Full Access'), (req, res) => {
    const { share } = req;
    const { path: subPath } = req.body;
    const fullPath = path.join(share.resolvedPath, subPath);
    if (!fullPath.startsWith(share.resolvedPath) || fullPath === share.resolvedPath) return res.status(403).json({ error: 'Forbidden' });
    if (fs.statSync(fullPath).isDirectory()) fs.rmSync(fullPath, { recursive: true });
    else fs.unlinkSync(fullPath);
    res.json({ message: 'Deleted successfully' });
});

router.get('/:id', (req, res) => {
    const { id } = req.params;
    db.get("SELECT * FROM shares WHERE id = ?", [id], (err, share) => {
        if (!share) return res.status(404).send('Share not found');

        const now = new Date();
        const expiry = new Date(share.expiry);
        if (now > expiry || (share.max_views !== -1 && share.view_count >= share.max_views)) {
            db.run("DELETE FROM shares WHERE id = ?", [id]);
            return res.status(410).send('Link expired');
        }
        res.send(getGateHTML(share));
    });
});

router.post('/:id/verify', bodyParser.urlencoded({ extended: true }), (req, res) => {
    const { id } = req.params;
    const { email, password } = req.body;
    db.get("SELECT * FROM shares WHERE id = ?", [id], async (err, share) => {
        if (!share) return res.status(404).send('Link invalid');

        const now = new Date();
        const expiry = new Date(share.expiry);
        if (now > expiry || (share.max_views !== -1 && share.view_count >= share.max_views)) {
            db.run("DELETE FROM shares WHERE id = ?", [id]);
            return res.status(410).send('Link expired');
        }

        let valid = true;
        if (share.email && share.email !== email) valid = false;
        if (share.password && !(await bcrypt.compare(password, share.password))) valid = false;
        if (!valid) return res.send(getGateHTML(share, 'Security mismatch'));
        db.run("UPDATE shares SET view_count = view_count + 1 WHERE id = ?", [id]);
        const guestToken = jwt.sign({ shareId: id, permissions: share.permissions, path: share.path, isGuest: true }, SECRET_KEY, { expiresIn: '2h' });
        res.send(`<html><script>localStorage.setItem('guestToken', '${guestToken}'); localStorage.setItem('shareId', '${id}'); window.location.href = '/public/share/${id}/view';</script></html>`);
    });
});

module.exports = router;
