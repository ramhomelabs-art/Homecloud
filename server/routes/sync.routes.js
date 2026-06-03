const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { runSyncTask, computeNextRun } = require('../utils/syncRunner');
const { authenticateToken } = require('../middleware/auth');

// GET all tasks
router.get('/tasks', authenticateToken, (req, res) => {
    db.all("SELECT * FROM sync_tasks ORDER BY created_at DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// POST create task
router.post('/tasks', authenticateToken, (req, res) => {
    const { name, sourceNode, sourcePath, destNode, destPath, syncMode, scheduleInterval } = req.body;
    if (!name || !sourcePath || !destPath) {
        return res.status(400).json({ error: 'Name, source path, and destination path are required' });
    }

    const nextRun = computeNextRun(scheduleInterval);

    db.run(
        `INSERT INTO sync_tasks 
        (name, sourceNode, sourcePath, destNode, destPath, syncMode, scheduleInterval, nextRun, lastStatus) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Idle')`,
        [name, sourceNode || 'local', sourcePath, destNode || 'local', destPath, syncMode || 'backup', scheduleInterval || 'manual', nextRun],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID, message: 'Sync task created successfully' });
        }
    );
});

// POST trigger task execution manually
router.post('/tasks/:id/run', authenticateToken, (req, res) => {
    const { id } = req.params;
    db.get("SELECT lastStatus FROM sync_tasks WHERE id = ?", [id], (err, task) => {
        if (err || !task) {
            return res.status(404).json({ error: 'Task not found' });
        }
        if (task.lastStatus === 'In Progress') {
            return res.status(400).json({ error: 'Task is already running' });
        }

        // Run sync task in the background
        runSyncTask(id)
            .then(result => {
                console.log(`[Manual Sync Trigger] Task ${id} finished:`, result);
            })
            .catch(runErr => {
                console.error(`[Manual Sync Trigger] Task ${id} failed:`, runErr.message);
            });

        res.json({ message: 'Sync task execution started in the background' });
    });
});

// POST toggle task active status
router.post('/tasks/:id/toggle', authenticateToken, (req, res) => {
    const { id } = req.params;
    const { active } = req.body;

    db.get("SELECT scheduleInterval FROM sync_tasks WHERE id = ?", [id], (err, task) => {
        if (err || !task) return res.status(404).json({ error: 'Task not found' });

        const nextRun = active ? computeNextRun(task.scheduleInterval) : null;
        db.run(
            "UPDATE sync_tasks SET active = ?, nextRun = ? WHERE id = ?",
            [active ? 1 : 0, nextRun, id],
            function (updateErr) {
                if (updateErr) return res.status(500).json({ error: updateErr.message });
                res.json({ message: `Task ${active ? 'enabled' : 'disabled'} successfully` });
            }
        );
    });
});

// DELETE delete task
router.delete('/tasks/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    db.run("DELETE FROM sync_tasks WHERE id = ?", [id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Task deleted successfully' });
    });
});

// GET task execution history logs
router.get('/tasks/:id/history', authenticateToken, (req, res) => {
    const { id } = req.params;
    db.all(
        "SELECT * FROM sync_history WHERE taskId = ? ORDER BY runTime DESC LIMIT 100",
        [id],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        }
    );
});

module.exports = router;
