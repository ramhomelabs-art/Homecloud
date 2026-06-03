const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { executeAICommand } = require('../utils/aiAutomator');
const { authenticateToken } = require('../middleware/auth');
const { sendAiAlert } = require('../utils/notifier');

// GET all rules
router.get('/rules', authenticateToken, (req, res) => {
    db.all("SELECT * FROM ai_rules ORDER BY created_at DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// POST create rule
router.post('/rules', authenticateToken, (req, res) => {
    const { name, triggerFolder, aiInstruction, actionType } = req.body;
    if (!name || !triggerFolder || !aiInstruction) {
        return res.status(400).json({ error: 'Name, trigger folder, and AI instruction are required' });
    }

    db.run(
        "INSERT INTO ai_rules (name, triggerFolder, aiInstruction, actionType, active) VALUES (?, ?, ?, ?, 1)",
        [name, triggerFolder, aiInstruction, actionType || 'route'],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID, message: 'AI rule created successfully' });
        }
    );
});

// DELETE delete rule
router.delete('/rules/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    db.run("DELETE FROM ai_rules WHERE id = ?", [id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Rule deleted successfully' });
    });
});

// POST toggle rule active status
router.post('/rules/:id/toggle', authenticateToken, (req, res) => {
    const { id } = req.params;
    const { active } = req.body;

    db.run(
        "UPDATE ai_rules SET active = ? WHERE id = ?",
        [active ? 1 : 0, id],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: `Rule ${active ? 'enabled' : 'disabled'} successfully` });
        }
    );
});

// POST manual copilot command execution
router.post('/copilot', authenticateToken, async (req, res) => {
    const { command, node } = req.body;
    if (!command) {
        return res.status(400).json({ error: 'Command text is required' });
    }

    try {
        const result = await executeAICommand(command, node || 'local');
        
        // Save execution to logs
        db.run(
            "INSERT INTO ai_logs (command, status, logText, filesAffected) VALUES (?, ?, ?, ?)",
            [command, result.status, result.logs.join('\n'), JSON.stringify(result.filesAffected)],
            (err) => {
                if (err) console.error('[AI Automator API] Failed to write logs to DB:', err.message);
            }
        );

        // Send Telegram alert asynchronously
        sendAiAlert(command, result).catch(alertErr => {
            console.error('[AI Alert Notification Error]:', alertErr.message);
        });

        res.json(result);
    } catch (err) {
        // Log the failure to the database as well
        db.run(
            "INSERT INTO ai_logs (command, status, logText, filesAffected) VALUES (?, 'Failed', ?, ?)",
            [command, err.message, JSON.stringify([])],
            (dbErr) => {
                if (dbErr) console.error('[AI Automator API] Failed to write failure logs to DB:', dbErr.message);
            }
        );

        // Send Telegram failure alert asynchronously
        sendAiAlert(command, { status: 'Failed', logs: err.message, filesAffected: [] }).catch(alertErr => {
            console.error('[AI Alert Notification Error]:', alertErr.message);
        });

        res.status(500).json({ error: err.message });
    }
});

// GET all execution logs
router.get('/logs', authenticateToken, (req, res) => {
    db.all("SELECT * FROM ai_logs ORDER BY created_at DESC LIMIT 100", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        
        const parsedRows = rows.map(row => {
            try {
                row.filesAffected = row.filesAffected ? JSON.parse(row.filesAffected) : [];
            } catch (e) {
                row.filesAffected = [];
            }
            return row;
        });

        res.json(parsedRows);
    });
});

module.exports = router;
