const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('../config/database');
const { authenticateGuest } = require('../middleware/auth');
const fileService = require('../services/fileService');
const emailService = require('../services/emailService');
const logger = require('../utils/logger');

// 🔐 POST /api/v1/guest/verify
router.post('/verify', async (req, res) => {
    const { id, email, password, otp } = req.body;
    if (!id) return res.status(400).json({ error: 'Share ID is required' });

    try {
        const shareRes = await db.query('SELECT * FROM shares WHERE id = $1', [id]);
        const share = shareRes.rows[0];
        if (!share) return res.status(404).json({ error: 'Share link not found or expired' });

        // Expiration check
        if (new Date() > new Date(share.expiry)) {
            await db.query('DELETE FROM shares WHERE id = $1', [id]);
            return res.status(410).json({ error: 'Link expired' });
        }

        // View limit check
        if (share.max_views !== -1 && share.view_count >= share.max_views) {
            await db.query('DELETE FROM shares WHERE id = $1', [id]);
            return res.status(410).json({ error: 'Link view limit reached' });
        }

        // 1. Password Verification
        if (share.password_hash) {
            if (!password) return res.status(401).json({ error: 'Password required' });
            const passwordMatch = await bcrypt.compare(password, share.password_hash);
            if (!passwordMatch) {
                await db.query(
                    'INSERT INTO share_access_logs (share_id, ip_address, user_agent, status) VALUES ($1, $2, $3, $4)',
                    [id, req.ip, req.headers['user-agent'] || null, 'invalid_password']
                );
                return res.status(401).json({ error: 'Incorrect passkey credentials' });
            }
        }

        // 2. Email Verification & OTP
        if (share.email) {
            if (!email) return res.status(401).json({ error: 'Email authorization required' });
            if (share.email.toLowerCase() !== email.toLowerCase()) {
                await db.query(
                    'INSERT INTO share_access_logs (share_id, ip_address, user_agent, status) VALUES ($1, $2, $3, $4)',
                    [id, req.ip, req.headers['user-agent'] || null, 'invalid_email']
                );
                return res.status(401).json({ error: 'Email address not authorized for this share' });
            }

            // Verify OTP code if passed, else generate and request it
            if (otp) {
                const otpRes = await db.query(
                    'SELECT * FROM guest_sessions WHERE share_id = $1 AND email = $2 AND otp_code = $3 AND otp_expires_at > CURRENT_TIMESTAMP',
                    [id, email.toLowerCase(), otp]
                );
                if (otpRes.rows.length === 0) {
                    return res.status(401).json({ error: 'Incorrect or expired OTP verification code' });
                }
                // Clear the used OTP session
                await db.query('DELETE FROM guest_sessions WHERE share_id = $1 AND email = $2', [id, email.toLowerCase()]);
            } else {
                // Generate 6-digit PIN
                const otpCode = crypto.randomInt(100000, 999999).toString();
                const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

                // Clean old OTP codes for this share/email
                await db.query('DELETE FROM guest_sessions WHERE share_id = $1 AND email = $2', [id, email.toLowerCase()]);

                // Store code
                await db.query(
                    'INSERT INTO guest_sessions (share_id, email, otp_code, otp_expires_at) VALUES ($1, $2, $3, $4)',
                    [id, email.toLowerCase(), otpCode, otpExpires]
                );

                logger.info(`[Email OTP] Generated code for guest ${email}: "${otpCode}"`);
                
                // Dispatch real email via SMTP
                const shareTitle = share.name || 'Shared Resource';
                const emailResult = await emailService.sendOTP({
                    to: email,
                    otpCode,
                    shareTitle,
                    expiresMinutes: 10
                });

                return res.json({ 
                    otpRequired: true, 
                    email, 
                    simulated: !!emailResult.simulated 
                });
            }
        }

        // Create log record
        await db.query(
            'INSERT INTO share_access_logs (share_id, ip_address, user_agent, status) VALUES ($1, $2, $3, $4)',
            [id, req.ip, req.headers['user-agent'] || null, 'success']
        );

        // Increment views
        await fileService.incrementShareViewCount(id);

        // Generate Guest Token
        const guestToken = jwt.sign(
            { type: 'GUEST_TOKEN', shareId: id, email: email || 'anonymous', path: share.path },
            process.env.JWT_SECRET,
            { expiresIn: '4h' }
        );

        res.json({ token: guestToken });
    } catch (err) {
        logger.error(`[Guest Portal Auth Error]: ${err.message}`, err);
        res.status(500).json({ error: err.message });
    }
});

// 📂 GET /api/v1/guest/list
router.get('/list', authenticateGuest, async (req, res) => {
    const subPath = req.query.path || '';
    const targetPath = path.join(req.share.path, subPath);
    const normalizedTarget = path.normalize(targetPath).toLowerCase();
    const normalizedBase = path.normalize(req.share.path).toLowerCase();

    if (!normalizedTarget.startsWith(normalizedBase)) {
        return res.status(403).json({ error: 'Path traversal forbidden' });
    }

    try {
        const files = await fileService.listDirectory(targetPath);
        res.json(files);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 📂 GET /api/v1/guest/download
router.get('/download', authenticateGuest, async (req, res) => {
    const targetFile = req.query.path || '';
    if (!targetFile) return res.status(400).json({ error: 'File path required' });

    const targetPath = path.join(req.share.path, targetFile);
    const normalizedTarget = path.normalize(targetPath).toLowerCase();
    const normalizedBase = path.normalize(req.share.path).toLowerCase();

    if (!normalizedTarget.startsWith(normalizedBase)) {
        return res.status(403).json({ error: 'Path traversal forbidden' });
    }

    try {
        if (!fs.existsSync(targetPath)) {
            return res.status(404).json({ error: 'Requested file not found' });
        }
        res.download(targetPath);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
