const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const clusterService = require('../services/clusterService');
const storageProvider = require('../utils/storageProvider');
const logger = require('../utils/logger');

// 🗑️ GET /api/v1/trash (Get all items in the trash bin for current user)
router.get('/', authenticateToken, async (req, res) => {
    try {
        let query = 'SELECT * FROM trash_items';
        let params = [];
        if (req.user.role !== 'Admin') {
            query += ' WHERE deleted_by = $1';
            params.push(req.user.id);
        }
        query += ' ORDER BY deleted_at DESC';
        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (err) {
        logger.error(`[Trash List Error]: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// 🗑️ POST /api/v1/trash/restore/:id (Restore a trashed item)
router.post('/restore/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        // Fetch trash item
        const result = await db.query('SELECT * FROM trash_items WHERE id = $1', [id]);
        const item = result.rows[0];
        if (!item) {
            return res.status(404).json({ error: 'Trash item not found' });
        }

        // Verify authorization (ownership or Admin role)
        if (item.deleted_by !== req.user.id && req.user.role !== 'Admin') {
            return res.status(403).json({ error: 'Access denied: Cannot restore this item' });
        }

        if (item.agent_id) {
            // Restore on remote node agent
            const agent = clusterService.agents[item.agent_id];
            if (!agent || agent.status !== 'approved') {
                return res.status(400).json({ error: 'Storage agent is offline or unapproved' });
            }
            try {
                await axios.post(`${agent.url}/api/v1/files/trash/restore`, {
                    trashPath: item.trash_path,
                    originalPath: item.original_path
                });
            } catch (err) {
                return res.status(502).json({ error: `Agent restoration failed: ${err.message}` });
            }
        } else {
            // Restore on local master filesystem
            if (fs.existsSync(item.trash_path)) {
                const resolvedDest = storageProvider.resolvePath(item.original_path);
                let finalDest = resolvedDest;
                if (fs.existsSync(finalDest)) {
                    const dir = path.dirname(resolvedDest);
                    const ext = path.extname(resolvedDest);
                    const base = path.basename(resolvedDest, ext);
                    finalDest = path.join(dir, `${base}_restored_${Date.now()}${ext}`);
                }
                const parentDir = path.dirname(finalDest);
                if (!fs.existsSync(parentDir)) {
                    fs.mkdirSync(parentDir, { recursive: true });
                }
                fs.renameSync(item.trash_path, finalDest);
            } else {
                return res.status(404).json({ error: 'Trashed file does not exist on disk' });
            }
        }

        // Delete trash DB record
        await db.query('DELETE FROM trash_items WHERE id = $1', [id]);
        res.json({ success: true, message: 'Item restored successfully' });
    } catch (err) {
        logger.error(`[Trash Restore Error]: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// 🗑️ DELETE /api/v1/trash/permanent/:id (Permanently delete a trashed item)
router.delete('/permanent/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db.query('SELECT * FROM trash_items WHERE id = $1', [id]);
        const item = result.rows[0];
        if (!item) {
            return res.status(404).json({ error: 'Trash item not found' });
        }

        if (item.deleted_by !== req.user.id && req.user.role !== 'Admin') {
            return res.status(403).json({ error: 'Access denied: Cannot purge this item' });
        }

        if (item.agent_id) {
            const agent = clusterService.agents[item.agent_id];
            if (agent && agent.status === 'approved') {
                try {
                    await axios.delete(`${agent.url}/api/v1/files/trash/permanent`, {
                        data: { trashPath: item.trash_path }
                    });
                } catch (err) {
                    logger.warn(`Failed to delete trash path from agent: ${err.message}`);
                }
            }
        } else {
            if (fs.existsSync(item.trash_path)) {
                const stat = fs.statSync(item.trash_path);
                if (stat.isDirectory()) {
                    fs.rmSync(item.trash_path, { recursive: true, force: true });
                } else {
                    fs.unlinkSync(item.trash_path);
                }
            }
        }

        await db.query('DELETE FROM trash_items WHERE id = $1', [id]);
        res.json({ success: true, message: 'Item permanently deleted' });
    } catch (err) {
        logger.error(`[Trash Permanent Delete Error]: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// 🗑️ DELETE /api/v1/trash/empty (Empty the entire trash bin for the user)
router.delete('/empty', authenticateToken, async (req, res) => {
    try {
        let query = 'SELECT * FROM trash_items';
        let params = [];
        if (req.user.role !== 'Admin') {
            query += ' WHERE deleted_by = $1';
            params.push(req.user.id);
        }
        const result = await db.query(query, params);
        const items = result.rows;

        for (const item of items) {
            if (item.agent_id) {
                const agent = clusterService.agents[item.agent_id];
                if (agent && agent.status === 'approved') {
                    try {
                        await axios.delete(`${agent.url}/api/v1/files/trash/permanent`, {
                            data: { trashPath: item.trash_path }
                        });
                    } catch (err) {
                        logger.warn(`Failed to empty trash path from agent: ${err.message}`);
                    }
                }
            } else {
                if (fs.existsSync(item.trash_path)) {
                    const stat = fs.statSync(item.trash_path);
                    if (stat.isDirectory()) {
                        fs.rmSync(item.trash_path, { recursive: true, force: true });
                    } else {
                        fs.unlinkSync(item.trash_path);
                    }
                }
            }
        }

        let deleteQuery = 'DELETE FROM trash_items';
        let deleteParams = [];
        if (req.user.role !== 'Admin') {
            deleteQuery += ' WHERE deleted_by = $1';
            deleteParams.push(req.user.id);
        }
        await db.query(deleteQuery, deleteParams);

        res.json({ success: true, message: 'Trash bin emptied' });
    } catch (err) {
        logger.error(`[Trash Empty Error]: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
