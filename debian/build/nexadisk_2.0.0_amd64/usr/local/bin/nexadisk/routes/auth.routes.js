const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');
const db = require('../config/database');
const { authenticateToken, requireRole, SECRET_KEY } = require('../middleware/auth');
const eventBus = require('../utils/eventBus');
const logger = require('../utils/logger');
const auditService = require('../services/auditService');
const totp = require('../utils/totp');

// 🔒 POST /api/v1/auth/login
router.post('/login', async (req, res) => {
    const { username, password, mfaCode } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    try {
        const result = await db.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = result.rows[0];

        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            return res.status(401).json({ error: 'Incorrect username or password' });
        }

        // Check if MFA is enabled
        if (user.mfa_enabled) {
            if (!mfaCode) {
                return res.json({ mfaRequired: true });
            }
            const verified = totp.verifyTOTP(mfaCode, user.mfa_secret);
            if (!verified) {
                return res.status(401).json({ error: 'Incorrect verification code' });
            }
        }

        // Generate JWT token
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            SECRET_KEY,
            { expiresIn: '24h' }
        );

        eventBus.publish('USER_LOGIN', { username: user.username, role: user.role, ip: req.ip });
        await auditService.log(user.id, user.username, 'USER_LOGIN', `Successfully logged in`, req);

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
        await auditService.log(req.user.id, req.user.username, 'USER_CREATE', `Created user account: ${username} (Role: ${role || 'User'})`, req);
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

        await auditService.log(req.user.id, req.user.username, 'USER_UPDATE', `Updated profile settings for user (ID: ${id})`, req);
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
        await auditService.log(req.user.id, req.user.username, 'USER_PASSWORD_RESET', `Administratively reset password for user (ID: ${id})`, req);
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
        await auditService.log(req.user.id, req.user.username, 'USER_DELETE', `Deleted user account: ${targetUser} (ID: ${id})`, req);
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
        await auditService.log(req.user.id, req.user.username, 'SETTINGS_UPDATE', `Updated system setting: ${key} = ${value}`, req);
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
        await auditService.log(req.user.id, req.user.username, 'PASSWORD_CHANGE', `Updated account password`, req);
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
        await auditService.log(req.user.id, req.user.username, 'MFA_SETUP', `Configured security recovery question`, req);
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

// 🔒 POST /api/v1/auth/mfa/setup (Generate unique base32 secret + offline QR code)
router.post('/mfa/setup', authenticateToken, async (req, res) => {
    try {
        const secret = totp.generateSecret();
        const username = req.user.username || 'User';
        const otpAuthUri = `otpauth://totp/NexaDisk:${encodeURIComponent(username)}?secret=${secret}&issuer=NexaDisk`;
        let qrCode = null;
        try {
            qrCode = await QRCode.toDataURL(otpAuthUri, { width: 200, margin: 2 });
        } catch (qrErr) {
            logger.warn(`[MFA Setup] QR generation failed, falling back to external: ${qrErr.message}`);
        }
        res.json({ secret, qrCode, otpAuthUri });
    } catch (err) {
        logger.error(`[MFA Setup Error]: ${err.message}`, err);
        res.status(500).json({ error: err.message });
    }
});

// 🔒 POST /api/v1/auth/mfa/verify (Verify and enable MFA)
router.post('/mfa/verify', authenticateToken, async (req, res) => {
    const { secret, code } = req.body;
    if (!secret || !code) {
        return res.status(400).json({ error: 'Secret and verification code are required' });
    }

    try {
        const verified = totp.verifyTOTP(code, secret);
        if (!verified) {
            return res.status(400).json({ error: 'Invalid verification code' });
        }

        await db.query('UPDATE users SET mfa_enabled = true, mfa_secret = $1 WHERE id = $2', [secret, req.user.id]);
        await auditService.log(req.user.id, req.user.username, 'MFA_ENABLE', `Enabled two-factor authenticator`, req);
        res.json({ success: true, message: 'Two-factor authentication successfully enabled' });
    } catch (err) {
        logger.error(`[MFA Verify Error]: ${err.message}`, err);
        res.status(500).json({ error: err.message });
    }
});

// 🔒 POST /api/v1/auth/mfa/disable (Disable MFA)
router.post('/mfa/disable', authenticateToken, async (req, res) => {
    const { password } = req.body;
    if (!password) {
        return res.status(400).json({ error: 'Password is required to disable Two-Factor Authentication' });
    }

    try {
        const result = await db.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
        const user = result.rows[0];
        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            return res.status(401).json({ error: 'Incorrect password' });
        }

        await db.query('UPDATE users SET mfa_enabled = false, mfa_secret = null WHERE id = $2', [req.user.id]);
        await auditService.log(req.user.id, req.user.username, 'MFA_DISABLE', `Disabled two-factor authenticator`, req);
        res.json({ success: true, message: 'Two-factor authentication successfully disabled' });
    } catch (err) {
        logger.error(`[MFA Disable Error]: ${err.message}`, err);
        res.status(500).json({ error: err.message });
    }
});

// 🔒 GET /api/v1/auth/sessions (Return real login history for current user)
router.get('/sessions', authenticateToken, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT ip_address, user_agent, timestamp
            FROM audit_logs
            WHERE user_id = $1 AND action = 'USER_LOGIN'
            ORDER BY timestamp DESC
            LIMIT 5
        `, [req.user.id]);

        const parseUserAgent = (ua) => {
            if (!ua) return { browser: 'Unknown Browser', os: 'Unknown OS', icon: 'monitor' };
            let browser = 'Browser';
            let os = 'Unknown OS';
            let icon = 'monitor';

            if (/Chrome\//.test(ua) && !/Chromium|Edg\/|OPR\//.test(ua)) browser = 'Chrome';
            else if (/Firefox\//.test(ua)) browser = 'Firefox';
            else if (/Edg\//.test(ua)) browser = 'Edge';
            else if (/OPR\/|Opera/.test(ua)) browser = 'Opera';
            else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) browser = 'Safari';

            if (/Windows/.test(ua)) { os = 'Windows'; icon = 'monitor'; }
            else if (/Macintosh|Mac OS X/.test(ua)) { os = 'macOS'; icon = 'laptop'; }
            else if (/Linux/.test(ua) && !/Android/.test(ua)) { os = 'Linux'; icon = 'monitor'; }
            else if (/Android/.test(ua)) { os = 'Android'; icon = 'smartphone'; }
            else if (/iPhone|iPad/.test(ua)) { os = 'iOS'; icon = 'smartphone'; }

            return { browser, os, icon };
        };

        const sessions = result.rows.map((row, idx) => {
            const { browser, os, icon } = parseUserAgent(row.user_agent);
            const ip = row.ip_address || '127.0.0.1';
            const isLocal = ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.');
            const location = isLocal ? 'Local Network' : 'Remote';
            const ts = new Date(row.timestamp);
            const now = new Date();
            const diffMs = now - ts;
            const diffMins = Math.floor(diffMs / 60000);
            const diffHrs = Math.floor(diffMins / 60);
            const diffDays = Math.floor(diffHrs / 24);
            let timeAgo;
            if (diffMins < 5) timeAgo = 'Active Now';
            else if (diffMins < 60) timeAgo = `${diffMins} min ago`;
            else if (diffHrs < 24) timeAgo = `${diffHrs} hr${diffHrs > 1 ? 's' : ''} ago`;
            else timeAgo = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

            return {
                device: `${browser} • ${os}`,
                ip: ip === '127.0.0.1' || ip === '::1' ? '127.0.0.1 (Localhost)' : ip,
                location,
                status: timeAgo,
                isActive: diffMins < 5,
                icon
            };
        });

        res.json(sessions);
    } catch (err) {
        logger.error(`[Sessions Error]: ${err.message}`, err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
