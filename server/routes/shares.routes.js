const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

router.post('/create', authenticateToken, async (req, res) => {
    const { path, password, email, expiryHours, maxViews, agentId, permissions } = req.body;
    const shareId = crypto.randomBytes(16).toString('hex');
    const hashedPass = password ? await bcrypt.hash(password, 10) : null;
    const expiry = new Date(Date.now() + (expiryHours || 24) * 3600000).toISOString();
    db.run("INSERT INTO shares (id, path, password, email, expiry, max_views, agent_id, permissions) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [shareId, path, hashedPass, email, expiry, maxViews || -1, agentId || null, permissions || 'Full Access'], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({
                shareId,
                url: `${req.protocol}://${req.get('host')}/public/share/${shareId}`,
                credentials: { email, passkey: password }
            });
        });
});

router.put('/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { password, email, expiryHours, maxViews, permissions } = req.body;

    const expiry = expiryHours ? new Date(Date.now() + expiryHours * 3600000).toISOString() : null;
    let query = "UPDATE shares SET email = ?, max_views = ?, permissions = ?";
    let params = [email, maxViews, permissions];
    if (expiry) {
        query += ", expiry = ?";
        params.push(expiry);
    }
    if (password) {
        const hashedPass = await bcrypt.hash(password, 10);
        query += ", password = ?";
        params.push(hashedPass);
    }
    query += " WHERE id = ?";
    params.push(id);

    db.run(query, params, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Share updated successfully' });
    });
});

router.get('/list', authenticateToken, (req, res) => {
    db.all("SELECT * FROM shares ORDER BY created_at DESC", (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

router.delete('/:id', authenticateToken, (req, res) => {
    db.run("DELETE FROM shares WHERE id = ?", [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Share revoked' });
    });
});

module.exports = router;
