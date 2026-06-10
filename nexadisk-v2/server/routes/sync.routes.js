const express = require('express');
const router = express.Router();
const syncService = require('../services/syncService');
const { authenticateToken, requireRole } = require('../middleware/auth');

// 🔄 GET /api/v1/sync/tasks
router.get('/tasks', authenticateToken, async (req, res) => {
    try {
        const tasks = await syncService.listSyncTasks();
        res.json(tasks);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 🔄 POST /api/v1/sync/tasks
router.post('/tasks', authenticateToken, requireRole(['Admin', 'Operator']), async (req, res) => {
    const { 
        name, 
        sourceNode, 
        sourcePath, 
        destNode, 
        destPath, 
        mode, 
        cronExpression, 
        intervalMinutes, 
        sanitizeMedia,
        syncMode,
        scheduleInterval
    } = req.body;

    if (!name || !sourcePath || !destPath) {
        return res.status(400).json({ error: 'Name, sourcePath, and destPath are required fields' });
    }

    // Translate frontend syncMode -> backend mode
    let targetMode = mode;
    if (syncMode) {
        targetMode = syncMode === 'backup' ? 'incremental' : syncMode;
    }
    if (!targetMode) {
        targetMode = 'incremental';
    }

    // Translate scheduleInterval -> intervalMinutes / cronExpression / active
    let targetIntervalMinutes = intervalMinutes;
    let targetCronExpression = cronExpression;
    let targetActive = true;

    if (scheduleInterval) {
        if (scheduleInterval === 'manual') {
            targetIntervalMinutes = null;
            targetCronExpression = 'manual';
            targetActive = false;
        } else if (scheduleInterval === 'hourly') {
            targetIntervalMinutes = 60;
            targetCronExpression = 'hourly';
        } else if (scheduleInterval === 'daily') {
            targetIntervalMinutes = 1440;
            targetCronExpression = 'daily';
        } else if (scheduleInterval === 'weekly') {
            targetIntervalMinutes = 10080;
            targetCronExpression = 'weekly';
        } else {
            const parsed = parseInt(scheduleInterval, 10);
            if (!isNaN(parsed)) {
                targetIntervalMinutes = parsed;
                targetCronExpression = null;
            }
        }
    }

    try {
        const id = await syncService.createSyncTask({
            name,
            sourceNode,
            sourcePath,
            destNode,
            destPath,
            mode: targetMode,
            cronExpression: targetCronExpression,
            intervalMinutes: targetIntervalMinutes,
            sanitizeMedia,
            active: targetActive
        });
        res.status(201).json({ id, message: 'Sync task created successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 🔄 DELETE /api/v1/sync/tasks/:id
router.delete('/tasks/:id', authenticateToken, requireRole(['Admin', 'Operator']), async (req, res) => {
    try {
        await syncService.deleteSyncTask(req.params.id);
        res.json({ message: 'Sync task deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 🔄 POST /api/v1/sync/tasks/:id/run (Alias for trigger)
router.post('/tasks/:id/run', authenticateToken, requireRole(['Admin', 'Operator']), async (req, res) => {
    try {
        const result = await syncService.triggerSync(req.params.id);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 🔄 POST /api/v1/sync/tasks/:id/toggle
router.post('/tasks/:id/toggle', authenticateToken, requireRole(['Admin', 'Operator']), async (req, res) => {
    const { active } = req.body;
    try {
        const db = require('../config/database');
        await db.query('UPDATE sync_tasks SET active = $1 WHERE id = $2', [active, req.params.id]);
        res.json({ message: `Sync task ${active ? 'enabled' : 'disabled'} successfully` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 🔄 GET /api/v1/sync/history
router.get('/history', authenticateToken, async (req, res) => {
    const limit = parseInt(req.query.limit || '30', 10);
    try {
        const history = await syncService.getHistory(limit);
        res.json(history);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 🔄 GET /api/v1/sync/tasks/:id/history
router.get('/tasks/:id/history', authenticateToken, async (req, res) => {
    const limit = parseInt(req.query.limit || '30', 10);
    try {
        const db = require('../config/database');
        const resDb = await db.query('SELECT * FROM sync_history WHERE task_id = $1 ORDER BY run_time DESC LIMIT $2', [req.params.id, limit]);
        res.json(resDb.rows.map(row => ({
            id: row.id,
            taskId: row.task_id,
            status: row.status,
            filesCopied: row.files_copied,
            bytesTransferred: row.bytes_transferred,
            errors: row.errors,
            runTime: row.run_time
        })));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
