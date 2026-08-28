const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const db = require('../config/database');
const securityService = require('./securityService');
const logger = require('../utils/logger');

const STORAGE_ROOT = process.env.PROFILE_STORAGE_ROOT || '/var/lib/nexadisk/profiles';

class ProfileService {
    constructor() {
        if (!fs.existsSync(STORAGE_ROOT)) {
            fs.mkdirSync(STORAGE_ROOT, { recursive: true });
        }
    }

    async getUserProfile(userId) {
        const res = await db.query(
            'SELECT id, username, role, display_name, first_name, last_name, email, phone, department, job_title, time_zone, language, bio, account_status, avatar_path, avatar_thumbnail_path, last_login, created_at, avatar_updated_at, mfa_enabled FROM users WHERE id = $1',
            [userId]
        );
        return res.rows[0];
    }

    async updateUserProfile(userId, data) {
        const allowedFields = [
            'username', 'role', 'display_name', 'first_name', 'last_name', 
            'email', 'phone', 'department', 'job_title', 'time_zone', 
            'language', 'bio', 'account_status'
        ];
        
        const updates = [];
        const values = [userId];
        let idx = 2;

        for (const field of allowedFields) {
            if (data[field] !== undefined) {
                updates.push(`${field} = $${idx}`);
                values.push(data[field]);
                idx++;
            }
        }

        if (updates.length === 0) return this.getUserProfile(userId);

        const query = `UPDATE users SET ${updates.join(', ')} WHERE id = $1 RETURNING *`;
        const res = await db.query(query, values);
        return res.rows[0];
    }

    async processAvatar(userId, file) {
        const userDir = path.join(STORAGE_ROOT, userId);
        if (!fs.existsSync(userDir)) {
            fs.mkdirSync(userDir, { recursive: true });
        }

        logger.info(`[ProfileService] Processing avatar upload for user ${userId}`);

        // 1. Validate File Ext & Size (handled by multer in routes but good to verify)
        if (file.size > 5 * 1024 * 1024) {
            throw new Error('Avatar exceeds 5MB size limit');
        }

        // 2. Validate Security (deepScan logic)
        const scanResult = await securityService.deepScan(file.path, file.originalname);
        if (scanResult.verdict === 'malicious') {
            await this._logSecurityEvent(userId, 'avatar_upload_blocked', { file: file.originalname, reason: 'Malicious file detected', score: scanResult.score });
            throw new Error('File rejected by security scanner');
        }
        if (scanResult.verdict === 'suspicious') {
            await this._logSecurityEvent(userId, 'avatar_upload_blocked', { file: file.originalname, reason: 'Suspicious file detected', score: scanResult.score });
            throw new Error('File flagged as suspicious and blocked');
        }

        // 3. Image Processing using Sharp
        const originalWebpPath = path.join(userDir, 'avatar.webp');
        const thumb256Path = path.join(userDir, 'avatar-256.webp');
        const thumb128Path = path.join(userDir, 'avatar-128.webp');
        const thumb64Path = path.join(userDir, 'avatar-64.webp');

        try {
            const image = sharp(file.path);
            const metadata = await image.metadata();

            if (!['jpeg', 'jpg', 'png', 'webp'].includes(metadata.format)) {
                throw new Error('Unsupported image format');
            }

            // Strip metadata and save as original 512x512
            await image
                .resize(512, 512, { fit: 'cover', position: 'center' })
                .webp({ quality: 80, lossless: false })
                .withMetadata(false) // strips EXIF, GPS
                .toFile(originalWebpPath);

            // Generate thumbnails
            await image.resize(256, 256, { fit: 'cover' }).webp({ quality: 80 }).withMetadata(false).toFile(thumb256Path);
            await image.resize(128, 128, { fit: 'cover' }).webp({ quality: 80 }).withMetadata(false).toFile(thumb128Path);
            await image.resize(64, 64, { fit: 'cover' }).webp({ quality: 80 }).withMetadata(false).toFile(thumb64Path);

            // 4. Update DB
            const dbOriginalPath = `/profiles/${userId}/avatar.webp`;
            const dbThumbPath = `/profiles/${userId}/avatar-128.webp`;

            await db.query(
                'UPDATE users SET avatar_path = $1, avatar_thumbnail_path = $2, avatar_updated_at = CURRENT_TIMESTAMP WHERE id = $3',
                [dbOriginalPath, dbThumbPath, userId]
            );

            await this._logSecurityEvent(userId, 'avatar_updated', { path: dbOriginalPath });

            return {
                avatar_path: dbOriginalPath,
                avatar_thumbnail_path: dbThumbPath
            };
        } catch (err) {
            logger.error(`[ProfileService] Avatar processing failed: ${err.message}`);
            throw err;
        } finally {
            // Clean up original uploaded file
            try { if (fs.existsSync(file.path)) fs.unlinkSync(file.path); } catch (e) {}
        }
    }

    async removeAvatar(userId) {
        const userDir = path.join(STORAGE_ROOT, userId);
        if (fs.existsSync(userDir)) {
            fs.rmSync(userDir, { recursive: true, force: true });
        }
        await db.query(
            'UPDATE users SET avatar_path = NULL, avatar_thumbnail_path = NULL, avatar_updated_at = CURRENT_TIMESTAMP WHERE id = $1',
            [userId]
        );
        await this._logSecurityEvent(userId, 'avatar_removed', {});
    }

    async _logSecurityEvent(userId, eventType, details) {
        try {
            await db.query(
                'INSERT INTO security_events (event_type, details) VALUES ($1, $2)',
                [eventType, JSON.stringify({ userId, ...details })]
            );
        } catch (err) {
            logger.error(`[ProfileService] Failed to log security event: ${err.message}`);
        }
    }
}

module.exports = new ProfileService();
