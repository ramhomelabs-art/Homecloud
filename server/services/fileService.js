const path = require('path');
const crypto = require('crypto');
const db = require('../config/database');
const storageProvider = require('../utils/storageProvider');
const taskQueue = require('../utils/taskQueue');
const eventBus = require('../utils/eventBus');
const logger = require('../utils/logger');

class FileService {
    // List directory details via StorageProvider
    async listDirectory(targetPath) {
        return storageProvider.readdir(targetPath);
    }

    async getMetadata(targetPath) {
        const stats = await storageProvider.stat(targetPath);
        return {
            name: path.basename(targetPath),
            path: targetPath,
            size: stats.size,
            isDirectory: stats.isDirectory,
            modified: stats.modified
        };
    }

    async deletePath(targetPath) {
        await storageProvider.delete(targetPath);
        eventBus.publish('FILE_DELETED', { path: targetPath });
        return true;
    }

    async createFolder(targetPath) {
        await storageProvider.mkdir(targetPath);
        eventBus.publish('FOLDER_CREATED', { path: targetPath });
        return true;
    }

    // ─── SHARE LINKS OPERATIONS (PostgreSQL) ────────────────────────────────
    async createShare(userId, { filePath, password, email, expiryHours, maxViews, permissions, type: explicitType, title, description }) {
        const shareId = crypto.randomBytes(16).toString('hex');
        const token = crypto.randomBytes(4).toString('hex').toUpperCase(); // 8-char short code
        
        // Determine share type: prefer explicit type param, fall back to permissions string
        let type = explicitType || 'download';
        if (!explicitType) {
            const permStr = String(permissions || '').toLowerCase();
            if (permStr.includes('upload')) type = 'upload';
            else if (permStr.includes('edit') || permStr.includes('exchange') || permStr.includes('full')) type = 'exchange';
        }

        const bcrypt = require('bcrypt');
        const hashedPass = password ? await bcrypt.hash(password, 10) : null;
        const expiry = expiryHours 
            ? new Date(Date.now() + expiryHours * 3600000).toISOString()
            : new Date(Date.now() + 24 * 3600000).toISOString(); // Default 24h

        const shareTitle = title || path.basename(filePath);
        const shareDescription = description || '';

        // Insert share link
        const shareRes = await db.query(`
            INSERT INTO share_links (token, type, owner_id, path, title, description, expires_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, token
        `, [
            token,
            type,
            userId,
            filePath,
            shareTitle,
            shareDescription,
            expiry
        ]);

        const dbShareId = shareRes.rows[0].id;

        // Insert security config
        await db.query(`
            INSERT INTO share_security (share_id, password_hash, email_verification, max_views, max_downloads, allowed_extensions, max_file_size)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
            dbShareId,
            hashedPass,
            !!email,
            maxViews || -1,
            -1,
            null,
            -1
        ]);

        logger.info(`[FileService] Created share link: ${token} (type: ${type}) -> ${filePath}`);
        return { shareId: token, token, type, expiry };
    }

    async getShareById(idOrToken) {
        if (!idOrToken) return null;
        const res = await db.query(`
            SELECT sl.*, ss.password_hash, ss.email_verification, ss.max_views, ss.max_downloads
            FROM share_links sl
            LEFT JOIN share_security ss ON ss.share_id = sl.id
            WHERE sl.id::text = $1 OR UPPER(sl.token) = UPPER($1)
        `, [idOrToken.trim()]);
        return res.rows[0];
    }

    async incrementShareViewCount(idOrToken) {
        // Deprecated: view counts are logged in share_access_logs and computed dynamically.
        // We log it as a page access log
        const share = await this.getShareById(idOrToken);
        if (share) {
            await db.query(
                "INSERT INTO share_access_logs (share_link_id, ip_address, user_agent, country_code, status) VALUES ($1, '127.0.0.1', 'System', 'Local', 'access')",
                [share.id]
            );
        }
    }

    async deleteShare(idOrToken) {
        if (!idOrToken) return;
        await db.query('DELETE FROM share_links WHERE id::text = $1 OR UPPER(token) = UPPER($1)', [idOrToken.trim()]);
        logger.info(`[FileService] Deleted share link: ${idOrToken}`);
    }

    async updateShare(idOrToken, { password, email, expiryHours, maxViews, permissions }) {
        const share = await this.getShareById(idOrToken);
        if (!share) return;
        const shareId = share.id;

        if (expiryHours !== undefined) {
            const expiry = expiryHours 
                ? new Date(Date.now() + expiryHours * 3600000).toISOString()
                : new Date(Date.now() + 24 * 3600000).toISOString();
            await db.query('UPDATE share_links SET expires_at = $1 WHERE id = $2', [expiry, shareId]);
        }

        if (permissions !== undefined) {
            let type = 'download';
            const permStr = String(permissions || '').toLowerCase();
            if (permStr.includes('upload')) type = 'upload';
            else if (permStr.includes('edit') || permStr.includes('exchange') || permStr.includes('full')) type = 'exchange';
            await db.query('UPDATE share_links SET type = $1 WHERE id = $2', [type, shareId]);
        }

        const bcrypt = require('bcrypt');
        const updates = [];
        const params = [];
        let index = 1;

        if (password !== undefined) {
            const hashedPass = password ? await bcrypt.hash(password, 10) : null;
            updates.push(`password_hash = $${index++}`);
            params.push(hashedPass);
        }
        if (email !== undefined) {
            updates.push(`email_verification = $${index++}`);
            params.push(!!email);
        }
        if (maxViews !== undefined) {
            updates.push(`max_views = $${index++}`);
            params.push(maxViews || -1);
        }

        if (updates.length > 0) {
            params.push(shareId);
            const query = `UPDATE share_security SET ${updates.join(', ')} WHERE share_id = $${index}`;
            await db.query(query, params);
        }
        logger.info(`[FileService] Updated share config for link ID: ${shareId}`);
    }

    async getActiveShares() {
        const res = await db.query(`
            SELECT sl.*, ss.password_hash, ss.email_verification, ss.max_views, ss.max_downloads,
            (SELECT COUNT(*) FROM share_access_logs WHERE share_link_id = sl.id AND status = 'access') as view_count
            FROM share_links sl
            LEFT JOIN share_security ss ON ss.share_id = sl.id
            ORDER BY sl.created_at DESC
        `);
        return res.rows.map(row => ({
            ...row,
            id: row.token, // Map token to ID for UI link generation
            shareId: row.id,
            password: !!row.password_hash,
            email: row.email_verification ? 'Required' : null,
            permissions: row.type === 'upload' ? 'Upload' : row.type === 'exchange' ? 'Full Access' : 'View'
        }));
    }

    // ─── ASYNCHRONOUS ZIP PACKAGING ─────────────────────────────────────────
    async enqueueZipDirectory(sourcePath, outputZipName) {
        const tempZipPath = path.join(process.env.LOCAL_STORAGE_BASE || path.resolve(__dirname, '..', 'uploads'), `zip-${Date.now()}.zip`);
        
        // Enqueue zipping job to workers
        const job = await taskQueue.addJob('file-worker', 'zip_directory', {
            sourcePath,
            tempZipPath,
            outputZipName
        });

        return { jobId: job.id, message: 'Archive packaging task enqueued.' };
    }
}

const fileService = new FileService();
module.exports = fileService;
