const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { authenticateToken, requireRole, SECRET_KEY } = require('../middleware/auth');
const eventBus = require('../utils/eventBus');
const logger = require('../utils/logger');

// 🔒 POST /api/v1/auth/login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    try {
        const result = await db.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = result.rows[0];

        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            return res.status(401).json({ error: 'Incorrect username or password' });
        }

        // Generate JWT token
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            SECRET_KEY,
            { expiresIn: '24h' }
        );

        eventBus.publish('USER_LOGIN', { username: user.username, role: user.role, ip: req.ip });

        res.json({
            token,
            username: user.username,
            role: user.role,
            id: user.id,
            avatar_path: user.avatar_path
        });
    } catch (err) {
        logger.error(`[Auth Login Error]: ${err.message}`, err);
        res.status(500).json({ error: err.message });
    }
});

// 👥 GET /api/v1/auth/users (Admin Only)
router.get('/users', authenticateToken, requireRole(['Admin']), async (req, res) => {
    try {
        const result = await db.query(`
            SELECT id, username, role, display_name, first_name, last_name, email, phone, 
                   department, job_title, time_zone, language, bio, account_status, 
                   avatar_path, avatar_thumbnail_path, last_login, created_at 
            FROM users 
            ORDER BY username ASC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 👥 POST /api/v1/auth/users/create (Admin Only)
router.post('/users/create', authenticateToken, requireRole(['Admin']), async (req, res) => {
    const { 
        username, password, role, display_name, first_name, last_name, 
        email, phone, department, job_title, time_zone, language, bio, account_status 
    } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    try {
        const hashedPass = await bcrypt.hash(password, 10);
        const userRes = await db.query(
            `INSERT INTO users (
                username, password_hash, role, display_name, first_name, last_name, 
                email, phone, department, job_title, time_zone, language, bio, account_status
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING id`,
            [
                username, hashedPass, role || 'User', display_name || null, first_name || null, last_name || null,
                email || null, phone || null, department || null, job_title || null, time_zone || 'UTC', 
                language || 'en', bio || null, account_status || 'active'
            ]
        );
        res.status(201).json({ success: true, message: 'User account created successfully', id: userRes.rows[0].id });
    } catch (err) {
        logger.error(`[Auth User Create Error]: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// For backwards compatibility: map POST /users to POST /users/create
router.post('/users', authenticateToken, requireRole(['Admin']), async (req, res) => {
    const { username, password, role } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }
    try {
        const hashedPass = await bcrypt.hash(password, 10);
        await db.query(
            'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)',
            [username, hashedPass, role || 'User']
        );
        res.status(201).json({ success: true, message: 'User account created successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 👥 POST /api/v1/auth/users/update (Admin Only)
router.post('/users/update', authenticateToken, requireRole(['Admin']), async (req, res) => {
    const { 
        id, username, role, display_name, first_name, last_name, 
        email, phone, department, job_title, time_zone, language, bio, account_status 
    } = req.body;

    if (!id) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    try {
        const allowedFields = [
            'username', 'role', 'display_name', 'first_name', 'last_name', 
            'email', 'phone', 'department', 'job_title', 'time_zone', 
            'language', 'bio', 'account_status'
        ];
        
        const updates = [];
        const values = [id];
        let idx = 2;

        const dataObj = { 
            username, role, display_name, first_name, last_name, 
            email, phone, department, job_title, time_zone, language, bio, account_status 
        };

        for (const field of allowedFields) {
            if (dataObj[field] !== undefined) {
                updates.push(`${field} = $${idx}`);
                values.push(dataObj[field]);
                idx++;
            }
        }

        if (updates.length > 0) {
            const query = `UPDATE users SET ${updates.join(', ')} WHERE id = $1`;
            await db.query(query, values);
        }

        res.json({ success: true, message: 'User profile updated successfully' });
    } catch (err) {
        logger.error(`[Auth User Update Error]: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// 👥 POST /api/v1/auth/users/reset-password (Admin Only)
router.post('/users/reset-password', authenticateToken, requireRole(['Admin']), async (req, res) => {
    const { id, newPassword } = req.body;
    if (!id || !newPassword) {
        return res.status(400).json({ error: 'User ID and new password are required' });
    }

    try {
        const hashedPass = await bcrypt.hash(newPassword, 10);
        await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashedPass, id]);
        res.json({ success: true, message: 'Password updated successfully' });
    } catch (err) {
        logger.error(`[Auth User Reset Password Error]: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// 👥 POST /api/v1/auth/users/delete (Admin Only)
router.post('/users/delete', authenticateToken, requireRole(['Admin']), async (req, res) => {
    const { id } = req.body;
    if (!id) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    try {
        // Find if user is admin - don't allow deleting self or primary admin
        const checkRes = await db.query('SELECT username FROM users WHERE id = $1', [id]);
        if (checkRes.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const targetUser = checkRes.rows[0].username;
        if (targetUser === 'admin') {
            return res.status(400).json({ error: 'Cannot delete the primary administrator' });
        }
        if (targetUser === req.user.username) {
            return res.status(400).json({ error: 'Cannot delete yourself' });
        }

        await db.query('DELETE FROM users WHERE id = $1', [id]);
        res.json({ success: true, message: 'User account deleted successfully' });
    } catch (err) {
        logger.error(`[Auth User Delete Error]: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// ⚙️ GET /api/v1/auth/settings
router.get('/settings', authenticateToken, async (req, res) => {
    try {
        const result = await db.query('SELECT key, value FROM app_settings');
        const settings = {};
        result.rows.forEach(r => settings[r.key] = r.value);
        res.json(settings);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ⚙️ POST /api/v1/auth/settings (Operator / Admin)
router.post('/settings', authenticateToken, requireRole(['Admin', 'Operator']), async (req, res) => {
    const settings = req.body;
    try {
        // Ensure settings table exists
        await db.query('CREATE TABLE IF NOT EXISTS app_settings (key VARCHAR(100) PRIMARY KEY, value TEXT)');

        for (const [key, value] of Object.entries(settings)) {
            await db.query(`
                INSERT INTO app_settings (key, value) VALUES ($1, $2)
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
            `, [key, String(value)]);
        }
        res.json({ message: 'Settings updated successfully' });
    } catch (err) {
        logger.error(`[Settings Save Error]: ${err.message}`, err);
        res.status(500).json({ error: err.message });
    }
});

// ⚙️ POST /api/v1/auth/settings/update (Operator / Admin)
router.post('/settings/update', authenticateToken, requireRole(['Admin', 'Operator']), async (req, res) => {
    const { key, value } = req.body;
    try {
        await db.query('CREATE TABLE IF NOT EXISTS app_settings (key VARCHAR(100) PRIMARY KEY, value TEXT)');
        await db.query(`
            INSERT INTO app_settings (key, value) VALUES ($1, $2)
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
        `, [key, String(value)]);
        res.json({ message: 'Setting updated successfully' });
    } catch (err) {
        logger.error(`[Setting Update Error]: ${err.message}`, err);
        res.status(500).json({ error: err.message });
    }
});

// ⚙️ POST /api/v1/auth/settings/password
router.post('/settings/password', authenticateToken, async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
        return res.status(400).json({ error: 'Old password and new password are required' });
    }
    try {
        const result = await db.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
        const user = result.rows[0];
        if (!user || !(await bcrypt.compare(oldPassword, user.password_hash))) {
            return res.status(401).json({ error: 'Incorrect old password' });
        }
        const hashedPass = await bcrypt.hash(newPassword, 10);
        await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashedPass, req.user.id]);
        res.json({ message: 'Password updated successfully' });
    } catch (err) {
        logger.error(`[Settings Password Error]: ${err.message}`, err);
        res.status(500).json({ error: err.message });
    }
});

// ⚙️ POST /api/v1/auth/settings/security-question
router.post('/settings/security-question', authenticateToken, async (req, res) => {
    const { question, answer } = req.body;
    if (!question || !answer) {
        return res.status(400).json({ error: 'Security question and answer are required' });
    }
    try {
        // Hash the answer for security
        const answerHash = await bcrypt.hash(answer.trim().toLowerCase(), 10);
        await db.query('UPDATE users SET security_question = $1, security_answer = $2 WHERE id = $3', [question, answerHash, req.user.id]);
        res.json({ message: 'Security verification configured successfully' });
    } catch (err) {
        logger.error(`[Settings Security Question Error]: ${err.message}`, err);
        res.status(500).json({ error: err.message });
    }
});

// 🔒 GET /api/v1/auth/verify (Confirm active admin/user session)
router.get('/verify', authenticateToken, (req, res) => {
    res.json({ valid: true, username: req.user.username, role: req.user.role });
});

module.exports = router;
