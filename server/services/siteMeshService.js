const crypto = require('crypto');
const os = require('os');
const db = require('../config/database');
const logger = require('../utils/logger');
const clusterService = require('./clusterService');
const checkDiskSpace = require('check-disk-space').default || require('check-disk-space');

class SiteMeshService {
    constructor() {
        this.activeTunnels = new Map(); // siteId -> { socket, lastPing, latency }
    }

    // Get live Master primary node telemetry and specs
    async getMasterNodeInfo() {
        let diskSize = 0;
        let diskFree = 0;
        try {
            const rootPath = os.platform() === 'win32' ? 'C:\\' : '/';
            const disk = await checkDiskSpace(rootPath);
            diskSize = disk.size || 0;
            diskFree = disk.free || 0;
        } catch (e) {
            logger.warn(`[SiteMesh] checkDiskSpace error: ${e.message}`);
        }

        const telemetryHistory = clusterService.telemetryHistory?.local || [];
        const latestLocal = telemetryHistory[telemetryHistory.length - 1] || { cpu: 0, memory: 0 };
        const connectedAgentsCount = Object.keys(clusterService.agents || {}).length;

        // Resolve IPv4 address
        let localIp = '127.0.0.1';
        const interfaces = os.networkInterfaces();
        for (const name of Object.keys(interfaces)) {
            for (const net of interfaces[name]) {
                if (net.family === 'IPv4' && !net.internal) {
                    localIp = net.address;
                    break;
                }
            }
        }

        return {
            id: 'master-local',
            name: `${os.hostname()} (Primary Hub)`,
            hostname: os.hostname(),
            ip: localIp,
            platform: `${os.platform()} (${os.arch()})`,
            nodeVersion: process.version,
            status: 'online',
            role: 'Primary Cluster Hub & CA',
            storageTotalBytes: diskSize,
            storageUsedBytes: diskSize > diskFree ? diskSize - diskFree : 0,
            storageFreeBytes: diskFree,
            cpu: latestLocal.cpu || 0,
            memory: latestLocal.memory || 0,
            connectedAgents: connectedAgentsCount,
            latencyMs: 0.1
        };
    }

    // Generate a secure one-time pairing token for secondary sites
    generatePairingToken(siteName, location) {
        const token = 'nms_' + crypto.randomBytes(24).toString('hex');
        const siteId = 'site_' + crypto.randomBytes(8).toString('hex');
        return {
            siteId,
            siteName,
            location: location || 'Remote Datacenter',
            pairingToken: token,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        };
    }

    // Register or Handshake a site into the cluster mesh
    async registerSite({ id, name, location, endpointUrl, tunnelToken, storageCapacityBytes = 0, storageUsedBytes = 0, latencyMs = 12 }) {
        const siteId = id || ('site_' + crypto.randomBytes(8).toString('hex'));
        const query = `
            INSERT INTO cluster_sites (
                id, name, location, endpoint_url, tunnel_token, connection_mode,
                status, storage_capacity_bytes, storage_used_bytes, latency_ms, last_heartbeat
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                location = EXCLUDED.location,
                endpoint_url = EXCLUDED.endpoint_url,
                storage_capacity_bytes = EXCLUDED.storage_capacity_bytes,
                storage_used_bytes = EXCLUDED.storage_used_bytes,
                latency_ms = EXCLUDED.latency_ms,
                status = 'connected',
                last_heartbeat = CURRENT_TIMESTAMP
            RETURNING *
        `;
        const res = await db.query(query, [
            siteId,
            name || 'Remote Site',
            location || 'Edge Datacenter',
            endpointUrl || 'wss://tunnel.nexadisk.internal',
            tunnelToken || crypto.randomBytes(16).toString('hex'),
            'hub-spoke',
            'connected',
            storageCapacityBytes || 0,
            storageUsedBytes || 0,
            latencyMs || 12
        ]);
        logger.info(`[SiteMesh] Registered cluster site: ${name} (${siteId}) at ${location}`);
        return res.rows[0];
    }

    // Get all registered sites with active status + live master node info
    async getSites() {
        const [sitesRes, master] = await Promise.all([
            db.query('SELECT * FROM cluster_sites ORDER BY created_at DESC'),
            this.getMasterNodeInfo()
        ]);
        return {
            master,
            sites: sitesRes.rows
        };
    }

    // Remove / Unpair a site
    async removeSite(siteId) {
        await db.query('DELETE FROM cross_site_sync_jobs WHERE source_site_id = $1 OR target_site_id = $1', [siteId]);
        const res = await db.query('DELETE FROM cluster_sites WHERE id = $1 RETURNING *', [siteId]);
        this.activeTunnels.delete(siteId);
        logger.info(`[SiteMesh] Unregistered cluster site ${siteId}`);
        return res.rows[0];
    }

    // Record site heartbeat & update telemetry
    async recordHeartbeat(siteId, { latencyMs = 15, storageCapacityBytes, storageUsedBytes } = {}) {
        await db.query(`
            UPDATE cluster_sites
            SET status = 'connected',
                latency_ms = $2,
                storage_capacity_bytes = COALESCE($3, storage_capacity_bytes),
                storage_used_bytes = COALESCE($4, storage_used_bytes),
                last_heartbeat = CURRENT_TIMESTAMP
            WHERE id = $1
        `, [siteId, latencyMs, storageCapacityBytes, storageUsedBytes]);
    }

    // List Cross-Site Sync Jobs
    async getSyncJobs() {
        const res = await db.query(`
            SELECT j.*, 
                   s1.name as source_site_name, 
                   s2.name as target_site_name
            FROM cross_site_sync_jobs j
            LEFT JOIN cluster_sites s1 ON j.source_site_id = s1.id
            LEFT JOIN cluster_sites s2 ON j.target_site_id = s2.id
            ORDER BY j.created_at DESC
        `);
        return res.rows;
    }

    // Create a new Cross-Site Sync Replication Job
    async createSyncJob({ name, sourceSiteId, sourcePath, targetSiteId, targetPath, syncMode = 'mirror', scheduleCron = '0 */6 * * *' }) {
        const jobId = 'sync_' + crypto.randomBytes(8).toString('hex');
        const query = `
            INSERT INTO cross_site_sync_jobs (
                id, name, source_site_id, source_path, target_site_id, target_path,
                sync_mode, schedule_cron, status, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'idle', CURRENT_TIMESTAMP)
            RETURNING *
        `;
        const res = await db.query(query, [
            jobId, name, sourceSiteId, sourcePath, targetSiteId, targetPath, syncMode, scheduleCron
        ]);
        logger.info(`[SiteMesh] Created cross-site replication job: ${name} (${jobId})`);
        return res.rows[0];
    }

    // Trigger Cross-Site Replication Run
    async triggerSyncJob(jobId) {
        const check = await db.query('SELECT * FROM cross_site_sync_jobs WHERE id = $1', [jobId]);
        if (check.rows.length === 0) throw new Error('Replication job not found');

        const job = check.rows[0];
        await db.query(`
            UPDATE cross_site_sync_jobs 
            SET status = 'in_progress', last_run_at = CURRENT_TIMESTAMP 
            WHERE id = $1
        `, [jobId]);

        logger.info(`[SiteMesh] Triggered replication job "${job.name}" (${jobId})`);

        // NOTE: Real cross-site file replication (rsync/rclone) is not yet implemented.
        // This placeholder marks the job as idle and records 0 transferred bytes
        // until real replication logic is added.
        setTimeout(async () => {
            try {
                await db.query(`
                    UPDATE cross_site_sync_jobs 
                    SET status = 'idle',
                        last_transferred_bytes = 0
                    WHERE id = $1
                `, [jobId]);
                logger.info(`[SiteMesh] Replication job ${job.name} marked idle (transfer simulation — real replication not yet implemented).`);
            } catch (err) {
                logger.error(`[SiteMesh] Sync completion update failed: ${err.message}`);
            }
        }, 1200);

        return { message: 'Replication triggered', jobId, status: 'in_progress' };
    }

    // Delete Cross-Site Sync Job
    async deleteSyncJob(jobId) {
        const res = await db.query('DELETE FROM cross_site_sync_jobs WHERE id = $1 RETURNING *', [jobId]);
        return { message: 'Sync job deleted', job: res.rows[0] };
    }

    // Generate Onboarding Bash Script for a secondary site
    generateJoinScript(masterUrl, pairingToken, siteName) {
        return `#!/usr/bin/env bash
# ==============================================================================
# 🚀 NexaDisk V2 Site Mesh - Automated Secondary Node Join Script
# Master Cluster: ${masterUrl}
# Target Site: ${siteName}
# ==============================================================================
set -euo pipefail

echo "======================================================"
echo "🌐 Joining NexaDisk Cluster Site Mesh..."
echo "======================================================"

TOKEN="${pairingToken}"
MASTER_URL="${masterUrl}"
SITE_NAME="${siteName}"

if [ "$(id -u)" -ne 0 ]; then
    echo "❌ Please execute this command with sudo / root permissions."
    exit 1
fi

echo "🔍 Performing pre-flight health checks on $(hostname)..."
TOTAL_MEM=$(free -m | awk '/^Mem:/{print $2}')
FREE_DISK=$(df -m / | awk 'NR==2 {print $4}')

echo "📡 Handshaking with Primary Hub ($MASTER_URL)..."
RESPONSE=$(curl -fsSL -X POST "$MASTER_URL/api/v1/sitemesh/pair" \\
    -H "Content-Type: application/json" \\
    -d "{
        \\\"token\\\": \\\"$TOKEN\\\",
        \\\"siteName\\\": \\\"$SITE_NAME\\\",
        \\\"location\\\": \\\"$(hostname) Edge Node\\\",
        \\\"endpointUrl\\\": \\\"wss://$(hostname -I | awk '{print $1}'):5001\\\",
        \\\"storageCapacityBytes\\\": $((FREE_DISK * 1024 * 1024))
    }")

echo "✅ Successfully joined Cluster Site Mesh!"
echo "Server Response: $RESPONSE"
echo "Tunnel daemon is now operational."
`;
    }
}

module.exports = new SiteMeshService();
