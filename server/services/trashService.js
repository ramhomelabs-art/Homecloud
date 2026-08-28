const db = require('../config/database');
const fs = require('fs');
const logger = require('../utils/logger');
const clusterService = require('./clusterService');
const axios = require('axios');

async function pruneTrash() {
    logger.info('[TrashService] Running scheduled daily trash pruning...');
    try {
        const res = await db.query(
            "SELECT * FROM trash_items WHERE deleted_at < NOW() - INTERVAL '30 days'"
        );
        const items = res.rows;
        if (items.length > 0) {
            logger.info(`[TrashService] Found ${items.length} trash item(s) older than 30 days to prune.`);
        }

        for (const item of items) {
            try {
                if (item.agent_id) {
                    const agent = clusterService.agents[item.agent_id];
                    if (agent && agent.status === 'approved') {
                        await axios.delete(`${agent.url}/api/v1/files/trash/permanent`, {
                            data: { trashPath: item.trash_path }
                        });
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
                await db.query('DELETE FROM trash_items WHERE id = $1', [item.id]);
                logger.info(`[TrashService] Successfully pruned trash item: ${item.original_name} (${item.id})`);
            } catch (itemErr) {
                logger.error(`[TrashService] Error pruning item ${item.id}: ${itemErr.message}`);
            }
        }
    } catch (err) {
        logger.error(`[TrashService] Pruning worker query error: ${err.message}`);
    }
}

function startPruningWorker() {
    logger.info('[TrashService] Initializing daily trash pruning background worker...');
    // Run immediately on boot
    setImmediate(pruneTrash);
    // Run every 24 hours
    setInterval(pruneTrash, 24 * 60 * 60 * 1000);
}

module.exports = {
    startPruningWorker,
    pruneTrash
};
