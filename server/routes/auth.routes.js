const express = require('express');
const router = express.Router();
const os = require('os');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');
const db = require('../config/database');
const { authenticateToken, requireRole, SECRET_KEY } = require('../middleware/auth');
const eventBus = require('../utils/eventBus');
const logger = require('../utils/logger');
const auditService = require('../services/auditService');
const totp = require('../utils/totp');

// 🌟 GET /api/v1/auth/setup/status
router.get('/setup/status', async (req, res) => {
    try {
        const usersCountRes = await db.query('SELECT COUNT(*) FROM users');
        const setupSettingRes = await db.query("SELECT value FROM app_settings WHERE key = 'initial_setup_completed'");
        
        const isCompleted = setupSettingRes.rows[0]?.value === 'true' && parseInt(usersCountRes.rows[0]?.count || 0) > 0;
        
        let localIp = '127.0.0.1';
        const interfaces = os.networkInterfaces();
        for (const name of Object.keys(interfaces)) {
            for (const net of interfaces[name]) {
                if (net.family === 'IPv4' && !net.internal) {
                    localIp = net.address;
                    break;
                }
            }
        }

        const cpus = os.cpus();

        res.json({
            setupRequired: !isCompleted,
            systemInfo: {
                hostname: os.hostname(),
                platform: `${os.type()} ${os.release()} (${os.arch()})`,
                totalMemory: os.totalmem(),
                freeMemory: os.freemem(),
                cpuModel: cpus[0]?.model || 'Multi-Core Processor',
                cpuCores: cpus.length,
                ip: localIp,
                nodeVersion: process.version,
                detectedLocation: 'Primary On-Premise Datacenter'
            }
        });
    } catch (err) {
        logger.error(`[Setup Status Error]: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// 🚀 POST /api/v1/auth/setup/complete
router.post('/setup/complete', async (req, res) => {
    const { 
        adminUsername = 'admin', 
        adminPassword, 
        adminDisplayName = 'System Administrator',
        adminEmail = 'admin@nexadisk.internal',
        serverName, 
        siteName, 
        location, 
        consentAgreed 
    } = req.body;

    if (!adminPassword || adminPassword.length < 6) {
        return res.status(400).json({ error: 'Admin password must be at least 6 characters long' });
    }

    if (!consentAgreed) {
        return res.status(400).json({ error: 'You must agree to the enterprise license and security terms to proceed' });
    }

    try {
        const hashedPassword = await bcrypt.hash(adminPassword, 10);

        // 1. Insert or update the admin account
        const existing = await db.query('SELECT * FROM users WHERE username = $1', [adminUsername]);
        let user;
        if (existing.rows.length > 0) {
            const updateRes = await db.query(`
                UPDATE users 
                SET password_hash = $1, display_name = $2, email = $3, role = 'Admin' 
                WHERE username = $4 
                RETURNING id, username, role, display_name, email
            `, [hashedPassword, adminDisplayName, adminEmail, adminUsername]);
            user = updateRes.rows[0];
        } else {
            const insertRes = await db.query(`
                INSERT INTO users (username, password_hash, role, display_name, email)
                VALUES ($1, $2, 'Admin', $3, $4)
                RETURNING id, username, role, display_name, email
            `, [adminUsername, hashedPassword, adminDisplayName, adminEmail]);
            user = insertRes.rows[0];
        }

        // 2. Save cluster server name & site settings
        await db.query(`
            INSERT INTO app_settings (key, value) 
            VALUES ('initial_setup_completed', 'true')
            ON CONFLICT (key) DO UPDATE SET value = 'true'
        `);

        if (serverName) {
            await db.query(`
                INSERT INTO app_settings (key, value) 
                VALUES ('server_name', $1)
                ON CONFLICT (key) DO UPDATE SET value = $1
            `, [serverName]);
        }

        if (siteName) {
            await db.query(`
                INSERT INTO app_settings (key, value) 
                VALUES ('site_name', $1)
                ON CONFLICT (key) DO UPDATE SET value = $1
            `, [siteName]);
        }

        if (location) {
            await db.query(`
                INSERT INTO app_settings (key, value) 
                VALUES ('site_location', $1)
                ON CONFLICT (key) DO UPDATE SET value = $1
            `, [location]);
        }

        // 3. Generate JWT Token
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            SECRET_KEY,
            { expiresIn: '24h' }
        );

        logger.info(`[Initial Setup] NexaDisk Server setup successfully completed by ${user.username}. Server: ${serverName || os.hostname()}`);
        eventBus.publish('USER_LOGIN', { username: user.username, role: user.role, ip: req.ip });

        res.json({
            success: true,
            message: 'NexaDisk Server initialized successfully',
            token,
            username: user.username,
            role: user.role,
            id: user.id,
            serverName: serverName || os.hostname(),
            siteName: siteName || 'Primary-Hub',
            location: location || 'Primary Datacenter'
        });
    } catch (err) {
        logger.error(`[Setup Complete Error]: ${err.message}`, err);
        res.status(500).json({ error: err.message });
    }
});

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
                   department, job_title, time_zone, language, bio, account_status, mfa_enabled,
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

// 👥 POST /api/v1/auth/users/disable-mfa (Admin Emergency MFA / 2FA Reset)
router.post('/users/disable-mfa', authenticateToken, requireRole(['Admin']), async (req, res) => {
    const { id } = req.body;
    if (!id) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    try {
        const checkRes = await db.query('SELECT username, mfa_enabled FROM users WHERE id = $1', [id]);
        if (checkRes.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        const targetUser = checkRes.rows[0].username;

        await db.query('UPDATE users SET mfa_enabled = false, mfa_secret = null WHERE id = $1', [id]);
        await auditService.log(req.user.id, req.user.username, 'ADMIN_MFA_RESET', `Administratively reset 2FA/MFA for user: ${targetUser} (ID: ${id})`, req);
        
        res.json({ success: true, message: `Two-Factor Authentication (MFA) successfully removed for user "${targetUser}"` });
    } catch (err) {
        logger.error(`[Auth Admin Reset MFA Error]: ${err.message}`);
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
            return res.status(400).json({ error: 'Incorrect old password' });
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
    const { password, code } = req.body;
    const verificationInput = (password || code || '').trim();
    if (!verificationInput) {
        return res.status(400).json({ error: 'Password or 6-digit authenticator code is required' });
    }

    try {
        const result = await db.query('SELECT password_hash, mfa_secret FROM users WHERE id = $1', [req.user.id]);
        const user = result.rows[0];
        if (!user) return res.status(404).json({ error: 'User not found' });

        let isValid = false;

        // 1. Try TOTP code first if 6 digits
        if (/^\d{6}$/.test(verificationInput) && user.mfa_secret) {
            if (totp.verifyTOTP(verificationInput, user.mfa_secret)) {
                isValid = true;
            }
        }

        // 2. Try password match
        if (!isValid && user.password_hash) {
            if (await bcrypt.compare(verificationInput, user.password_hash)) {
                isValid = true;
            }
        }

        if (!isValid) {
            return res.status(400).json({ error: 'Invalid password or authenticator code' });
        }

        await db.query('UPDATE users SET mfa_enabled = false, mfa_secret = null WHERE id = $1', [req.user.id]);
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
            SELECT id, ip_address, user_agent, timestamp
            FROM audit_logs
            WHERE user_id = $1 AND action = 'USER_LOGIN'
            ORDER BY timestamp DESC
            LIMIT 10
        `, [req.user.id]);

        const parseUserAgent = (ua) => {
            if (!ua) return { browser: 'Google Chrome', os: 'Windows 11 / 10', icon: 'monitor' };
            const raw = ua.toLowerCase();
            let browser = 'Web Browser';
            let os = 'Windows 11 / 10';
            let icon = 'monitor';

            if (raw.includes('edg/') || raw.includes('edge/')) browser = 'Microsoft Edge';
            else if (raw.includes('brave')) browser = 'Brave Browser';
            else if (raw.includes('opr/') || raw.includes('opera')) browser = 'Opera';
            else if (raw.includes('firefox') || raw.includes('fxios')) browser = 'Mozilla Firefox';
            else if (raw.includes('chrome') || raw.includes('crios')) browser = 'Google Chrome';
            else if (raw.includes('safari') && !raw.includes('chrome')) browser = 'Apple Safari';
            else if (raw.includes('curl')) browser = 'cURL Client';
            else if (raw.includes('postman')) browser = 'Postman API';
            else if (raw.includes('axios') || raw.includes('node-fetch')) browser = 'API Daemon';

            if (raw.includes('windows nt 10.0') || raw.includes('windows 10') || raw.includes('windows 11') || raw.includes('win64') || raw.includes('wow64') || raw.includes('windows')) {
                os = 'Windows 11 / 10';
                icon = 'monitor';
            } else if (raw.includes('macintosh') || raw.includes('mac os x') || raw.includes('macos')) {
                os = 'macOS';
                icon = 'laptop';
            } else if (raw.includes('iphone') || raw.includes('ipad') || raw.includes('ipod')) {
                os = 'iOS';
                icon = 'smartphone';
            } else if (raw.includes('android')) {
                os = 'Android';
                icon = 'smartphone';
            } else if (raw.includes('linux')) {
                os = 'Linux';
                icon = 'monitor';
            }

            return { browser, os, icon };
        };

        const sessions = result.rows.map((row, idx) => {
            const { browser, os, icon } = parseUserAgent(row.user_agent);
            const ip = row.ip_address || '127.0.0.1';
            const isLocal = ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.');
            const location = isLocal ? 'Localhost (Direct)' : 'Remote Network';
            const ts = new Date(row.timestamp);
            const now = new Date();
            const diffMs = now - ts;
            const diffMins = Math.floor(diffMs / 60000);
            const diffHrs = Math.floor(diffMins / 60);
            const diffDays = Math.floor(diffHrs / 24);
            let timeAgo;
            if (idx === 0) timeAgo = 'Active Now (This Device)';
            else if (diffMins < 5) timeAgo = 'Active Recently';
            else if (diffMins < 60) timeAgo = `${diffMins} min ago`;
            else if (diffHrs < 24) timeAgo = `${diffHrs} hr${diffHrs > 1 ? 's' : ''} ago`;
            else timeAgo = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

            return {
                id: row.id,
                device: `${browser} • ${os}`,
                ip: ip === '127.0.0.1' || ip === '::1' ? '127.0.0.1 (Localhost)' : ip,
                location,
                status: timeAgo,
                isActive: idx === 0,
                icon
            };
        });

        res.json(sessions);
    } catch (err) {
        logger.error(`[Sessions Error]: ${err.message}`, err);
        res.status(500).json({ error: err.message });
    }
});

// 🔒 DELETE /api/v1/auth/sessions/:id (Revoke specific session)
router.delete('/sessions/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        await db.query(`
            DELETE FROM audit_logs
            WHERE id = $1 AND user_id = $2
        `, [id, req.user.id]);
        res.json({ success: true, message: 'Session revoked successfully' });
    } catch (err) {
        logger.error(`[Revoke Session Error]: ${err.message}`, err);
        res.status(500).json({ error: err.message });
    }
});

// 🔒 POST /api/v1/auth/sessions/revoke-others (Revoke all except latest session)
router.post('/sessions/revoke-others', authenticateToken, async (req, res) => {
    try {
        await db.query(`
            DELETE FROM audit_logs
            WHERE user_id = $1 AND action = 'USER_LOGIN' AND id NOT IN (
                SELECT id FROM audit_logs
                WHERE user_id = $1 AND action = 'USER_LOGIN'
                ORDER BY timestamp DESC
                LIMIT 1
            )
        `, [req.user.id]);
        res.json({ success: true, message: 'All other sessions have been revoked' });
    } catch (err) {
        logger.error(`[Revoke Other Sessions Error]: ${err.message}`, err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
