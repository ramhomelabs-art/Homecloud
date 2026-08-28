/**
 * social.routes.js — NexaDisk Collaboration & Organization Layer
 */
const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { authenticateToken } = require("../middleware/auth");
const logger = require("../utils/logger");
const auditService = require("../services/auditService");

router.use(authenticateToken);

const isUUID = (str) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

const resolveUserId = async (user) => {
    if (!user) return null;
    if (isUUID(user.id)) return user.id;
    if (user.username) {
        try {
            const res = await db.query('SELECT id FROM users WHERE username = $1', [user.username]);
            if (res.rows.length > 0) return res.rows[0].id;
        } catch (e) {
            logger.warn(`[Social] Failed to resolve user ID for username ${user.username}: ${e.message}`);
        }
    }
    return null;
};

// ── STARRED ITEMS ─────────────────────────────────────────────────────────────

router.get("/starred", async (req, res) => {
    try {
        const userId = await resolveUserId(req.user);
        if (!userId) return res.json([]);
        const result = await db.query(
            `SELECT id, path, name, is_directory, starred_at FROM starred_items WHERE user_id = $1 ORDER BY starred_at DESC`,
            [userId]
        );
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get("/star/check", async (req, res) => {
    const { path: filePath } = req.query;
    if (!filePath) return res.status(400).json({ error: "path is required" });
    try {
        const userId = await resolveUserId(req.user);
        if (!userId) return res.json({ starred: false });
        const result = await db.query(`SELECT id FROM starred_items WHERE user_id = $1 AND path = $2`, [userId, filePath]);
        res.json({ starred: result.rows.length > 0 });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/star", async (req, res) => {
    const { path: filePath, name, isDirectory } = req.body;
    if (!filePath || !name) return res.status(400).json({ error: "path and name are required" });
    try {
        const userId = await resolveUserId(req.user);
        if (!userId) return res.status(400).json({ error: "Valid user account required to star files" });
        const result = await db.query(
            `INSERT INTO starred_items (user_id, path, name, is_directory) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, path) DO NOTHING RETURNING *`,
            [userId, filePath, name, !!isDirectory]
        );
        await auditService.log(userId, req.user.username, 'FILE_STAR', `Starred path: ${filePath}`, req);
        res.json({ message: "Starred", item: result.rows[0] || null });
    } catch (err) { logger.error(`[Social] POST star error: ${err.message}`); res.status(500).json({ error: err.message }); }
});

router.delete("/star", async (req, res) => {
    const filePath = req.query.path || req.body?.path;
    if (!filePath) return res.status(400).json({ error: "path is required" });
    try {
        const userId = await resolveUserId(req.user);
        if (!userId) return res.json({ message: "Unstarred" });
        await db.query(`DELETE FROM starred_items WHERE user_id = $1 AND path = $2`, [userId, filePath]);
        await auditService.log(userId, req.user.username, 'FILE_UNSTAR', `Unstarred path: ${filePath}`, req);
        res.json({ message: "Unstarred" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── TAGS ──────────────────────────────────────────────────────────────────────

router.get("/tags", async (req, res) => {
    try {
        const userId = await resolveUserId(req.user);
        if (!userId) return res.json([]);
        const result = await db.query(`SELECT id, name, color, created_at FROM tags WHERE user_id = $1 ORDER BY name`, [userId]);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/tags", async (req, res) => {
    const { name, color } = req.body;
    if (!name) return res.status(400).json({ error: "name is required" });
    try {
        const userId = await resolveUserId(req.user);
        if (!userId) return res.status(400).json({ error: "Valid user account required to create tags" });
        const result = await db.query(
            `INSERT INTO tags (user_id, name, color) VALUES ($1, $2, $3) ON CONFLICT (user_id, name) DO UPDATE SET color = EXCLUDED.color RETURNING *`,
            [userId, name.trim().substring(0, 100), color || "#6366f1"]
        );
        await auditService.log(userId, req.user.username, 'TAG_CREATE', `Created tag: ${name} with color: ${color || "#6366f1"}`, req);
        res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete("/tags/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const userId = await resolveUserId(req.user);
        if (!userId) return res.status(404).json({ error: "Tag not found" });
        const check = await db.query(`SELECT id, name FROM tags WHERE id = $1 AND user_id = $2`, [id, userId]);
        if (check.rows.length === 0) return res.status(404).json({ error: "Tag not found" });
        const tagName = check.rows[0].name;
        await db.query(`DELETE FROM tags WHERE id = $1`, [id]);
        await auditService.log(userId, req.user.username, 'TAG_DELETE', `Deleted tag: ${tagName} (ID: ${id})`, req);
        res.json({ message: "Tag deleted" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get("/file-tags", async (req, res) => {
    const { path: filePath } = req.query;
    try {
        const userId = await resolveUserId(req.user);
        if (!userId) return res.json([]);
        if (filePath) {
            const result = await db.query(
                `SELECT t.id, t.name, t.color, ft.tagged_at, ft.path FROM file_tags ft JOIN tags t ON t.id = ft.tag_id WHERE ft.path = $1 AND ft.user_id = $2 ORDER BY t.name`,
                [filePath, userId]
            );
            res.json(result.rows);
        } else {
            const result = await db.query(
                `SELECT t.id, t.name, t.color, ft.tagged_at, ft.path FROM file_tags ft JOIN tags t ON t.id = ft.tag_id WHERE ft.user_id = $1 ORDER BY ft.path, t.name`,
                [userId]
            );
            res.json(result.rows);
        }
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/file-tags", async (req, res) => {
    const { path: filePath, tagId } = req.body;
    if (!filePath || !tagId) return res.status(400).json({ error: "path and tagId are required" });
    try {
        const userId = await resolveUserId(req.user);
        if (!userId) return res.status(404).json({ error: "Tag not found" });
        const tagCheck = await db.query(`SELECT id, name FROM tags WHERE id = $1 AND user_id = $2`, [tagId, userId]);
        if (tagCheck.rows.length === 0) return res.status(404).json({ error: "Tag not found" });
        await db.query(`INSERT INTO file_tags (tag_id, user_id, path) VALUES ($1, $2, $3) ON CONFLICT (tag_id, path) DO NOTHING`, [tagId, userId, filePath]);
        await auditService.log(userId, req.user.username, 'FILE_TAG_ATTACH', `Attached tag: ${tagCheck.rows[0].name} to path: ${filePath}`, req);
        res.json({ message: "Tag attached" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete("/file-tags", async (req, res) => {
    const { path: filePath, tagId } = req.body;
    if (!filePath || !tagId) return res.status(400).json({ error: "path and tagId are required" });
    try {
        const userId = await resolveUserId(req.user);
        if (!userId) return res.json({ message: "Tag removed" });
        const tagCheck = await db.query(`SELECT name FROM tags WHERE id = $1`, [tagId]);
        const tagName = tagCheck.rows[0]?.name || tagId;
        await db.query(`DELETE FROM file_tags WHERE tag_id = $1 AND path = $2 AND user_id = $3`, [tagId, filePath, userId]);
        await auditService.log(userId, req.user.username, 'FILE_TAG_REMOVE', `Removed tag: ${tagName} from path: ${filePath}`, req);
        res.json({ message: "Tag removed" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── COMMENTS ──────────────────────────────────────────────────────────────────

router.get("/comments", async (req, res) => {
    const { path: filePath } = req.query;
    if (!filePath) return res.status(400).json({ error: "path is required" });
    try {
        const result = await db.query(
            `SELECT fc.id, fc.comment, fc.created_at, u.username, u.display_name, u.avatar_thumbnail_path FROM file_comments fc JOIN users u ON u.id = fc.user_id WHERE fc.path = $1 ORDER BY fc.created_at ASC`,
            [filePath]
        );
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/comments", async (req, res) => {
    const { path: filePath, comment } = req.body;
    if (!filePath || !comment?.trim()) return res.status(400).json({ error: "path and comment are required" });
    try {
        const userId = await resolveUserId(req.user);
        if (!userId) return res.status(400).json({ error: "Valid user account required to post comments" });
        const result = await db.query(
            `INSERT INTO file_comments (user_id, path, comment) VALUES ($1, $2, $3) RETURNING *`,
            [userId, filePath, comment.trim().substring(0, 2000)]
        );
        const full = await db.query(
            `SELECT fc.id, fc.comment, fc.created_at, u.username, u.display_name FROM file_comments fc JOIN users u ON u.id = fc.user_id WHERE fc.id = $1`,
            [result.rows[0].id]
        );
        await auditService.log(userId, req.user.username, 'COMMENT_ADD', `Added comment on path: ${filePath}`, req);
        res.json(full.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete("/comments/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const isAdmin = ["Admin", "Operator"].includes(req.user.role);
        const userId = await resolveUserId(req.user);
        const check = await db.query(
            isAdmin ? `SELECT id, path FROM file_comments WHERE id = $1` : `SELECT id, path FROM file_comments WHERE id = $1 AND user_id = $2`,
            isAdmin ? [id] : [id, userId]
        );
        if (check.rows.length === 0) return res.status(404).json({ error: "Comment not found" });
        const filePath = check.rows[0].path;
        await db.query(`DELETE FROM file_comments WHERE id = $1`, [id]);
        await auditService.log(userId, req.user.username, 'COMMENT_DELETE', `Deleted comment (ID: ${id}) on path: ${filePath}`, req);
        res.json({ message: "Comment deleted" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
