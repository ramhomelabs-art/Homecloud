const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const os = require('os');
const rateLimit = require('express-rate-limit');
const db = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { sendAlert } = require('../utils/notifier');

const SECRET_KEY = process.env.JWT_SECRET;

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    message: 'Too many login attempts, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

router.get('/settings', authenticateToken, (req, res) => {
    db.all("SELECT key, value FROM app_settings", (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const settings = {
            platform: os.platform()
        };
        rows.forEach(row => settings[row.key] = row.value);
        res.json(settings);
    });
});

router.post('/settings/update', authenticateToken, (req, res) => {
    const { key, value } = req.body;
    db.run("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)", [key, value], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

router.post('/login', authLimiter, (req, res) => {
    const { username, password } = req.body;
    db.get("SELECT * FROM users WHERE username = ?", [username], async (err, user) => {
        if (user && await bcrypt.compare(password, user.password)) {
            const token = jwt.sign({
                username: user.username,
                role: user.role || 'User'
            }, SECRET_KEY, { expiresIn: '8h' });

            // Dispatch login alert
            sendAlert('user_login', {
                title: 'User Login',
                text: `User "${user.username}" successfully logged in.`,
                htmlText: `🔑 <b>[User Login]</b>\nUser: <code>${user.username}</code>\nRole: <b>${user.role || 'User'}</b>\nIP: <code>${req.ip || 'unknown'}</code>`,
                type: 'info'
            }).catch(alertErr => console.error('[Login Alert Error]:', alertErr.message));

            return res.json({
                token,
                username: user.username,
                role: user.role || 'User'
            });
        }
        res.status(401).json({ message: 'Invalid credentials' });
    });
});

router.post('/settings/password', authenticateToken, (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const username = req.user.username;
    db.get("SELECT * FROM users WHERE username = ?", [username], async (err, user) => {
        if (err || !user) return res.status(500).json({ error: 'User not found' });
        if (await bcrypt.compare(oldPassword, user.password)) {
            const hashedNew = await bcrypt.hash(newPassword, 10);
            db.run("UPDATE users SET password = ? WHERE username = ?", [hashedNew, username], (err) => {
                if (err) return res.status(500).json({ error: 'Database error' });
                res.json({ message: 'Password updated successfully' });
            });
        } else {
            res.status(401).json({ error: 'Incorrect old password' });
        }
    });
});

router.get('/users', authenticateToken, requireAdmin, (req, res) => {
    db.all("SELECT id, username, role FROM users", (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

router.post('/users/create', authenticateToken, requireAdmin, async (req, res) => {
    const { username, password, role, securityQuestion, securityAnswer } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const hashedAnswer = securityAnswer ? await bcrypt.hash(securityAnswer.toLowerCase().trim(), 10) : null;
        db.run(
            "INSERT INTO users (username, password, role, security_question, security_answer) VALUES (?, ?, ?, ?, ?)",
            [username, hashedPassword, role || 'User', securityQuestion || null, hashedAnswer],
            (err) => {
                if (err) return res.status(400).json({ error: 'Username already exists' });
                res.json({ message: 'User created successfully' });
            }
        );
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/users/update', authenticateToken, requireAdmin, (req, res) => {
    const { id, username, role } = req.body;
    db.run("UPDATE users SET username = ?, role = ? WHERE id = ?", [username, role, id], function (err) {
        if (err) return res.status(400).json({ error: 'Update failed or username exists' });
        res.json({ message: 'User updated successfully' });
    });
});

router.post('/users/reset-password', authenticateToken, requireAdmin, async (req, res) => {
    const { id, newPassword } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        db.run("UPDATE users SET password = ? WHERE id = ?", [hashedPassword, id], (err) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            res.json({ message: 'Password reset successfully' });
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/users/delete', authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.body;
    db.get("SELECT username FROM users WHERE id = ?", [id], (err, targetUser) => {
        if (err) return res.status(500).json({ error: err.message });
        if (targetUser && targetUser.username === req.user.username) {
            return res.status(400).json({ error: 'Cannot delete yourself' });
        }
        db.run("DELETE FROM users WHERE id = ?", [id], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'User deleted successfully' });
        });
    });
});

router.post('/settings/security-question', authenticateToken, async (req, res) => {
    const { question, answer } = req.body;
    const username = req.user.username;
    if (!question || !answer) return res.status(400).json({ error: 'Question and answer are required' });
    try {
        const hashedAnswer = await bcrypt.hash(answer.toLowerCase().trim(), 10);
        db.run(
            "UPDATE users SET security_question = ?, security_answer = ? WHERE username = ?",
            [question, hashedAnswer, username],
            (err) => {
                if (err) return res.status(500).json({ error: 'Database error' });
                res.json({ message: 'Security question updated successfully' });
            }
        );
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/auth/forgot-password/question', (req, res) => {
    const { username } = req.query;
    if (!username) return res.status(400).json({ error: 'Username required' });
    db.get(
        "SELECT security_question FROM users WHERE username = ?",
        [username],
        (err, user) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!user) return res.status(404).json({ error: 'User not found' });
            if (!user.security_question) {
                return res.status(400).json({ error: 'No security question set. Please contact your system administrator.' });
            }
            res.json({ question: user.security_question });
        }
    );
});

router.post('/auth/forgot-password/reset', async (req, res) => {
    const { username, answer, newPassword } = req.body;
    if (!username || !answer || !newPassword) {
        return res.status(400).json({ error: 'Username, answer, and new password are required' });
    }
    db.get(
        "SELECT security_answer FROM users WHERE username = ?",
        [username],
        async (err, user) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!user) return res.status(404).json({ error: 'User not found' });
            if (!user.security_answer) return res.status(400).json({ error: 'Security question not configured for this user.' });

            try {
                const match = await bcrypt.compare(answer.toLowerCase().trim(), user.security_answer);
                if (!match) return res.status(401).json({ error: 'Incorrect verification answer' });

                const hashedPassword = await bcrypt.hash(newPassword, 10);
                db.run(
                    "UPDATE users SET password = ? WHERE username = ?",
                    [hashedPassword, username],
                    (errUpdate) => {
                        if (errUpdate) return res.status(500).json({ error: 'Database update failed' });
                        res.json({ message: 'Password reset successfully. You can now log in.' });
                    }
                );
            } catch (e) {
                res.status(500).json({ error: e.message });
            }
        }
    );
});

module.exports = router;
