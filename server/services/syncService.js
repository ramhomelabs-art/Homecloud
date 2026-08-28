const db = require('../config/database');
const taskQueue = require('../utils/taskQueue');
const eventBus = require('../utils/eventBus');
const logger = require('../utils/logger');

class SyncService {
    async createSyncTask({ name, sourceNode, sourcePath, destNode, destPath, mode, cronExpression, intervalMinutes, sanitizeMedia, active }) {
        // Compute initial next run time if scheduled
        const nextRun = intervalMinutes 
            ? new Date(Date.now() + intervalMinutes * 60000).toISOString() 
            : null;
        
        const res = await db.query(`
            INSERT INTO sync_tasks (name, source_node, source_path, dest_node, dest_path, mode, cron_expression, interval_minutes, sanitize_media, next_run, active)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING id
        `, [
            name,
            sourceNode || 'local',
            sourcePath,
            destNode || 'local',
            destPath,
            mode || 'incremental',
            cronExpression || null,
            intervalMinutes || null,
            sanitizeMedia || false,
            nextRun,
            active !== undefined ? active : true
        ]);

        const taskId = res.rows[0].id;
        logger.info(`[SyncService] Registered sync task: ${name} (ID: ${taskId})`);
        return taskId;
    }

    async getSyncTaskById(id) {
        const res = await db.query('SELECT * FROM sync_tasks WHERE id = $1', [id]);
        return res.rows[0];
    }

    async deleteSyncTask(id) {
        await db.query('DELETE FROM sync_tasks WHERE id = $1', [id]);
        logger.info(`[SyncService] Deleted sync task: ${id}`);
    }

    async listSyncTasks() {
        const res = await db.query('SELECT * FROM sync_tasks ORDER BY created_at DESC');
        return res.rows.map(row => ({
            id: row.id,
            name: row.name,
            sourceNode: row.source_node,
            sourcePath: row.source_path,
            destNode: row.dest_node,
            destPath: row.dest_path,
            syncMode: row.mode,
            scheduleInterval: row.cron_expression || row.interval_minutes,
            sanitizeMedia: row.sanitize_media,
            lastRun: row.last_run,
            lastStatus: row.last_status,
            active: row.active,
            nextRun: row.next_run,
            createdAt: row.created_at
        }));
    }

    async getHistory(limit = 30) {
        const res = await db.query('SELECT * FROM sync_history ORDER BY run_time DESC LIMIT $1', [limit]);
        return res.rows;
    }

    // Enqueue the sync task execution to workers
    async triggerSync(taskId) {
        const task = await this.getSyncTaskById(taskId);
        if (!task) throw new Error('Sync task not found');

        // Mark task history as Running first
        await db.query(
            "UPDATE sync_tasks SET last_run = CURRENT_TIMESTAMP, last_status = 'In Progress' WHERE id = $1",
            [taskId]
        );

        const job = await taskQueue.addJob('sync-worker', 'run_sync_job', {
            taskId
        });

        logger.info(`[SyncService] Enqueued sync job for task "${task.name}" (Job ID: ${job.id})`);
        return { jobId: job.id, message: 'Backup synchronization task enqueued.' };
    }

    // Log sync run outcomes to history database
    async logHistory(taskId, status, filesCopied, bytesTransferred, errors = null) {
        await db.query(`
            INSERT INTO sync_history (task_id, status, files_copied, bytes_transferred, errors)
            VALUES ($1, $2, $3, $4, $5)
        `, [taskId, status, filesCopied, bytesTransferred, errors]);
        
        eventBus.publish('SYNC_COMPLETED', { taskId, status, filesCopied, errors });
    }

    // Start background poller (runs every 60s)
    startScheduler() {
        logger.info('[SyncService] Starting synchronization scheduler polling loop...');
        setInterval(async () => {
            try {
                const now = new Date();
                const res = await db.query(
                    "SELECT * FROM sync_tasks WHERE active = TRUE AND next_run <= $1",
                    [now.toISOString()]
                );

                for (const task of res.rows) {
                    logger.info(`[SyncService Scheduler] Auto-triggering scheduled job: ${task.name}`);
                    await this.triggerSync(task.id);

                    // Compute next run time
                    const interval = task.interval_minutes || 60;
                    const nextRun = new Date(Date.now() + interval * 60000).toISOString();
                    
                    await db.query(
                        "UPDATE sync_tasks SET next_run = $1 WHERE id = $2",
                        [nextRun, task.id]
                    );
                }
            } catch (err) {
                logger.error(`[SyncService Scheduler] Polling loop error: ${err.message}`, err);
            }
        }, 60000); // 1-minute intervals
    }
}

const syncService = new SyncService();
module.exports = syncService;
