const express = require('express');
const router = express.Router();
const path = require('path');
const db = require('../config/database');
const automationService = require('../services/automationService');
const { authenticateToken } = require('../middleware/auth');
const logger = require('../utils/logger');

router.use(authenticateToken);

const extractPathFromInstruction = (instruction) => {
    const quoteRegex = /(["'])(.*?)\1/;
    const quoteMatch = instruction.match(quoteRegex);
    if (quoteMatch && quoteMatch[2]) return quoteMatch[2];

    const winRegex = /[a-zA-Z]:[\\/][^,\s]+/;
    const unixRegex = /(?:\/[a-zA-Z0-9_\-\.]+)+/;
    const winMatch = instruction.match(winRegex);
    if (winMatch) return winMatch[0];
    const unixMatch = instruction.match(unixRegex);
    if (unixMatch) return unixMatch[0];
    return null;
};

// ── GET /api/v1/ai/rules ─────────────────────────────────────────────────────
router.get('/rules', async (req, res) => {
    try {
        const rules = await automationService.getRules();
        const mappedRules = rules.map(r => ({
            id: r.id,
            name: `AI Rule #${r.id}`,
            triggerFolder: r.trigger_path,
            aiInstruction: r.instructions,
            actionType: r.action_type,
            schedule: r.schedule || 'on_upload',
            active: r.active,
            created_at: r.created_at
        }));
        res.json(mappedRules);
    } catch (err) {
        logger.error(`[Automation Routes] Get rules error: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/v1/ai/rules ────────────────────────────────────────────────────
router.post('/rules', async (req, res) => {
    const { triggerFolder, aiInstruction, actionType, schedule } = req.body;
    if (!triggerFolder || !aiInstruction) {
        return res.status(400).json({ error: 'Trigger folder and AI instruction are required' });
    }

    try {
        const id = await automationService.createRule(
            triggerFolder, 
            aiInstruction, 
            actionType || 'organize',
            schedule || 'on_upload'
        );
        res.json({ id, message: 'AI rule created successfully' });
    } catch (err) {
        logger.error(`[Automation Routes] Create rule error: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// ── DELETE /api/v1/ai/rules/:id ──────────────────────────────────────────────
router.delete('/rules/:id', async (req, res) => {
    try {
        await automationService.deleteRule(req.params.id);
        res.json({ message: 'Rule deleted successfully' });
    } catch (err) {
        logger.error(`[Automation Routes] Delete rule error: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/v1/ai/rules/:id/toggle ─────────────────────────────────────────
router.post('/rules/:id/toggle', async (req, res) => {
    const { id } = req.params;
    try {
        // Retrieve current active state
        const ruleRes = await db.query('SELECT active FROM ai_rules WHERE id = $1', [id]);
        if (ruleRes.rows.length === 0) {
            return res.status(404).json({ error: 'Rule not found' });
        }
        const nextActive = !ruleRes.rows[0].active;
        await db.query('UPDATE ai_rules SET active = $1 WHERE id = $2', [nextActive, id]);

        res.json({ message: `Rule ${nextActive ? 'enabled' : 'disabled'} successfully` });
    } catch (err) {
        logger.error(`[Automation Routes] Toggle rule error: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/v1/ai/rules/:id/run ────────────────────────────────────────────
router.post('/rules/:id/run', async (req, res) => {
    const { id } = req.params;
    try {
        const ruleRes = await db.query('SELECT * FROM ai_rules WHERE id = $1', [id]);
        if (ruleRes.rows.length === 0) {
            return res.status(404).json({ error: 'Rule not found' });
        }
        const rule = ruleRes.rows[0];

        // Execute rule instructions (dryRun = false)
        const result = await automationService.executeInstruction(rule.trigger_path, rule.instructions, rule.id, false);
        res.json({
            message: 'Rule executed successfully',
            status: result.status,
            logs: result.logs,
            filesAffected: result.filesAffected
        });
    } catch (err) {
        logger.error(`[Automation Routes] Run rule error: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/v1/ai/copilot (Manual Execution) ───────────────────────────────
router.post('/copilot', async (req, res) => {
    const { command, dryRun } = req.body;
    if (!command) {
        return res.status(400).json({ error: 'Command instruction text is required' });
    }

    try {
        const targetPath = extractPathFromInstruction(command);
        if (!targetPath) {
            return res.status(400).json({ error: 'Could not resolve a valid target folder path inside the instruction' });
        }



        // Run execution (dryRun support)
        const result = await automationService.executeInstruction(targetPath, command, null, !!dryRun);

        res.json({
            status: result.status,
            logs: result.logs,
            filesAffected: result.filesAffected
        });
    } catch (err) {
        logger.error(`[Automation Routes] Copilot execution error: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/v1/ai/logs ──────────────────────────────────────────────────────
router.get('/logs', async (req, res) => {
    try {
        const logs = await automationService.getLogs(100);
        const mappedLogs = logs.map(l => {
            let files = [];
            try {
                files = l.files_affected ? JSON.parse(l.files_affected) : [];
            } catch (e) {
                files = Array.isArray(l.files_affected) ? l.files_affected : [];
            }
            return {
                id: l.id,
                ruleId: l.rule_id,
                command: l.command,
                status: l.status,
                logText: l.log_text,
                filesAffected: files,
                created_at: l.created_at
            };
        });
        res.json(mappedLogs);
    } catch (err) {
        logger.error(`[Automation Routes] Get logs error: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/v1/ai/stats ─────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
    try {
        const stats = await automationService.getStats();
        res.json(stats);
    } catch (err) {
        logger.error(`[Automation Routes] Get stats error: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
