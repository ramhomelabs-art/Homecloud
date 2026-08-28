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

// ── STARRED ITEMS ─────────────────────────────────────────────────────────────

router.get("/starred", async (req, res) => {
    try {
        const result = await db.query(
            `SELECT id, path, name, is_directory, starred_at FROM starred_items WHERE user_id = $1 ORDER BY starred_at DESC`,
            [req.user.id]
        );
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get("/star/check", async (req, res) => {
    const { path: filePath } = req.query;
    if (!filePath) return res.status(400).json({ error: "path is required" });
    try {
        const result = await db.query(`SELECT id FROM starred_items WHERE user_id = $1 AND path = $2`, [req.user.id, filePath]);
        res.json({ starred: result.rows.length > 0 });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/star", async (req, res) => {
    const { path: filePath, name, isDirectory } = req.body;
    if (!filePath || !name) return res.status(400).json({ error: "path and name are required" });
    try {
        const result = await db.query(
            `INSERT INTO starred_items (user_id, path, name, is_directory) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, path) DO NOTHING RETURNING *`,
            [req.user.id, filePath, name, !!isDirectory]
        );
        await auditService.log(req.user.id, req.user.username, 'FILE_STAR', `Starred path: ${filePath}`, req);
        res.json({ message: "Starred", item: result.rows[0] || null });
    } catch (err) { logger.error(`[Social] POST star error: ${err.message}`); res.status(500).json({ error: err.message }); }
});

router.delete("/star", async (req, res) => {
    const filePath = req.query.path || req.body?.path;
    if (!filePath) return res.status(400).json({ error: "path is required" });
    try {
        await db.query(`DELETE FROM starred_items WHERE user_id = $1 AND path = $2`, [req.user.id, filePath]);
        await auditService.log(req.user.id, req.user.username, 'FILE_UNSTAR', `Unstarred path: ${filePath}`, req);
        res.json({ message: "Unstarred" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── TAGS ──────────────────────────────────────────────────────────────────────

router.get("/tags", async (req, res) => {
    try {
        const result = await db.query(`SELECT id, name, color, created_at FROM tags WHERE user_id = $1 ORDER BY name`, [req.user.id]);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/tags", async (req, res) => {
    const { name, color } = req.body;
    if (!name) return res.status(400).json({ error: "name is required" });
    try {
        const result = await db.query(
            `INSERT INTO tags (user_id, name, color) VALUES ($1, $2, $3) ON CONFLICT (user_id, name) DO UPDATE SET color = EXCLUDED.color RETURNING *`,
            [req.user.id, name.trim().substring(0, 100), color || "#6366f1"]
        );
        await auditService.log(req.user.id, req.user.username, 'TAG_CREATE', `Created tag: ${name} with color: ${color || "#6366f1"}`, req);
        res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete("/tags/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const check = await db.query(`SELECT id, name FROM tags WHERE id = $1 AND user_id = $2`, [id, req.user.id]);
        if (check.rows.length === 0) return res.status(404).json({ error: "Tag not found" });
        const tagName = check.rows[0].name;
        await db.query(`DELETE FROM tags WHERE id = $1`, [id]);
        await auditService.log(req.user.id, req.user.username, 'TAG_DELETE', `Deleted tag: ${tagName} (ID: ${id})`, req);
        res.json({ message: "Tag deleted" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get("/file-tags", async (req, res) => {
    const { path: filePath } = req.query;
    try {
        if (filePath) {
            const result = await db.query(
                `SELECT t.id, t.name, t.color, ft.tagged_at, ft.path FROM file_tags ft JOIN tags t ON t.id = ft.tag_id WHERE ft.path = $1 AND ft.user_id = $2 ORDER BY t.name`,
                [filePath, req.user.id]
            );
            res.json(result.rows);
        } else {
            const result = await db.query(
                `SELECT t.id, t.name, t.color, ft.tagged_at, ft.path FROM file_tags ft JOIN tags t ON t.id = ft.tag_id WHERE ft.user_id = $1 ORDER BY ft.path, t.name`,
                [req.user.id]
            );
            res.json(result.rows);
        }
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/file-tags", async (req, res) => {
    const { path: filePath, tagId } = req.body;
    if (!filePath || !tagId) return res.status(400).json({ error: "path and tagId are required" });
    try {
        const tagCheck = await db.query(`SELECT id, name FROM tags WHERE id = $1 AND user_id = $2`, [tagId, req.user.id]);
        if (tagCheck.rows.length === 0) return res.status(404).json({ error: "Tag not found" });
        await db.query(`INSERT INTO file_tags (tag_id, user_id, path) VALUES ($1, $2, $3) ON CONFLICT (tag_id, path) DO NOTHING`, [tagId, req.user.id, filePath]);
        await auditService.log(req.user.id, req.user.username, 'FILE_TAG_ATTACH', `Attached tag: ${tagCheck.rows[0].name} to path: ${filePath}`, req);
        res.json({ message: "Tag attached" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete("/file-tags", async (req, res) => {
    const { path: filePath, tagId } = req.body;
    if (!filePath || !tagId) return res.status(400).json({ error: "path and tagId are required" });
    try {
        const tagCheck = await db.query(`SELECT name FROM tags WHERE id = $1`, [tagId]);
        const tagName = tagCheck.rows[0]?.name || tagId;
        await db.query(`DELETE FROM file_tags WHERE tag_id = $1 AND path = $2 AND user_id = $3`, [tagId, filePath, req.user.id]);
        await auditService.log(req.user.id, req.user.username, 'FILE_TAG_REMOVE', `Removed tag: ${tagName} from path: ${filePath}`, req);
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
        const result = await db.query(
            `INSERT INTO file_comments (user_id, path, comment) VALUES ($1, $2, $3) RETURNING *`,
            [req.user.id, filePath, comment.trim().substring(0, 2000)]
        );
        const full = await db.query(
            `SELECT fc.id, fc.comment, fc.created_at, u.username, u.display_name FROM file_comments fc JOIN users u ON u.id = fc.user_id WHERE fc.id = $1`,
            [result.rows[0].id]
        );
        await auditService.log(req.user.id, req.user.username, 'COMMENT_ADD', `Added comment on path: ${filePath}`, req);
        res.json(full.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete("/comments/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const isAdmin = ["Admin", "Operator"].includes(req.user.role);
        const check = await db.query(
            isAdmin ? `SELECT id, path FROM file_comments WHERE id = $1` : `SELECT id, path FROM file_comments WHERE id = $1 AND user_id = $2`,
            isAdmin ? [id] : [id, req.user.id]
        );
        if (check.rows.length === 0) return res.status(404).json({ error: "Comment not found" });
        const filePath = check.rows[0].path;
        await db.query(`DELETE FROM file_comments WHERE id = $1`, [id]);
        await auditService.log(req.user.id, req.user.username, 'COMMENT_DELETE', `Deleted comment (ID: ${id}) on path: ${filePath}`, req);
        res.json({ message: "Comment deleted" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
