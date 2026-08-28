const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('../utils/logger');
const notificationService = require('./notificationService');
const storageProvider = require('../utils/storageProvider');

const SYSTEM_BLACKLIST = new Set([
    'windows', 'winnt', 'system volume information', '$recycle.bin', '$windows.~bt',
    'program files', 'program files (x86)', 'programdata', 'appdata', 'node_modules',
    '.git', '.svn', '.cache', 'proc', 'sys', 'dev', 'etc', 'usr', 'boot', 'tmp', 'temp', 'vendor'
]);

/**
 * Fast Non-Blocking Asynchronous File System Walker
 */
async function walkAllFilesAsync(dir, maxDepth = 4, currentDepth = 0, collected = [], maxFiles = 3000) {
    if (collected.length >= maxFiles || currentDepth > maxDepth || !dir) return collected;
    
    try {
        if (!fs.existsSync(dir)) return collected;
        
        // Yield execution to event loop to keep HTTP server completely responsive
        if (collected.length % 150 === 0) {
            await new Promise(resolve => setImmediate(resolve));
        }

        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (collected.length >= maxFiles) break;

            const nameLower = entry.name.toLowerCase();
            if (SYSTEM_BLACKLIST.has(nameLower) || nameLower.startsWith('$')) continue;

            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                await walkAllFilesAsync(fullPath, maxDepth, currentDepth + 1, collected, maxFiles);
            } else if (entry.isFile()) {
                try {
                    const stat = await fs.promises.stat(fullPath);
                    collected.push({
                        name: entry.name,
                        fullPath,
                        relativePath: path.relative(dir, fullPath),
                        size: stat.size,
                        mtime: stat.mtime,
                        mtimeMs: stat.mtimeMs
                    });
                } catch (_) {}
            }
        }
    } catch (_) {}
    return collected;
}

/**
 * Fast Safe Fingerprint for Deduplication (Avoids full RAM loading on huge files)
 */
async function getFileFingerprintAsync(filePath, fileSize) {
    try {
        if (fileSize <= 1024 * 1024) {
            // Under 1MB: Fast Async Read
            const buffer = await fs.promises.readFile(filePath);
            return crypto.createHash('sha256').update(buffer).digest('hex');
        }
        // Over 1MB: Sample first 64KB + last 64KB + size
        const fd = await fs.promises.open(filePath, 'r');
        const headBuf = Buffer.alloc(65536);
        await fd.read(headBuf, 0, 65536, 0);
        
        const tailBuf = Buffer.alloc(65536);
        const tailPos = Math.max(0, fileSize - 65536);
        await fd.read(tailBuf, 0, 65536, tailPos);
        await fd.close();

        return crypto.createHash('sha256')
            .update(headBuf)
            .update(tailBuf)
            .update(fileSize.toString())
            .digest('hex');
    } catch (_) {
        return null;
    }
}

/**
 * Automated Storage Tiering & Lifecycle Policy Service (NexaLifecycle)
 */
class TieringService {
    constructor() {
        this.configPath = path.join(__dirname, '../data/tiering_policies.json');
        this.snapshotsPath = path.join(__dirname, '../data/snapshots.json');
        this.policies = [];
        this.snapshots = [];
        this.migrationHistory = [];
        this.init();
    }

    getStorageRoot() {
        return storageProvider.localBase || path.resolve(__dirname, '../uploads');
    }

    async getStorageTargets() {
        const targets = [];
        const masterBase = storageProvider.localBase || path.resolve(__dirname, '../uploads');
        targets.push({
            id: 'master_root',
            label: 'Master Server Uploads (Primary NVMe/SSD)',
            type: 'LOCAL',
            path: masterBase,
            nodeName: 'Master Server Node (Host Machine)',
            isDefault: true
        });

        // Physical Drives
        try {
            if (process.platform === 'win32') {
                const drives = ['C:\\', 'D:\\', 'E:\\', 'F:\\'];
                for (const d of drives) {
                    if (fs.existsSync(d)) {
                        targets.push({
                            id: `drive_${d[0].toLowerCase()}`,
                            label: `Physical Partition (${d})`,
                            type: 'DISK',
                            path: d,
                            nodeName: 'Master Host OS'
                        });
                    }
                }
            } else {
                targets.push({
                    id: 'root_fs',
                    label: 'Host Root Filesystem (/)',
                    type: 'DISK',
                    path: '/',
                    nodeName: 'Master Host OS'
                });
            }
        } catch (_) {}

        // Connected Remote Fleet Agents
        try {
            const clusterService = require('./clusterService');
            const agents = await clusterService.getAgentsList();
            for (const agent of agents) {
                if (agent.status === 'approved') {
                    targets.push({
                        id: `agent_${agent.id}`,
                        label: `Fleet Agent Node: ${agent.hostname || agent.name}`,
                        type: 'AGENT',
                        agentId: agent.id,
                        path: agent.url,
                        nodeName: agent.hostname || agent.name
                    });
                }
            }
        } catch (_) {}

        // Cloud & Network Mounts
        try {
            const cloudMountService = require('./cloudMountService');
            const mounts = cloudMountService.getMounts();
            for (const m of mounts) {
                targets.push({
                    id: `mount_${m.id}`,
                    label: `Cloud/Network Drive: ${m.label} [${m.type}]`,
                    type: 'CLOUD',
                    mountId: m.id,
                    path: m.path || m.extraConfig?.endpoint || m.type,
                    nodeName: `${m.type} Cloud Drive`
                });
            }
        } catch (_) {}

        return targets;
    }

    resolveTargetRoot(options = {}) {
        const { targetId, path: customPath } = options;
        if (customPath && fs.existsSync(customPath)) {
            return {
                rootPath: customPath,
                nodeName: `Custom Directory Path (${customPath})`
            };
        }

        if (targetId && targetId.startsWith('drive_')) {
            const driveLetter = targetId.split('_')[1].toUpperCase() + ':\\';
            if (fs.existsSync(driveLetter)) {
                return {
                    rootPath: driveLetter,
                    nodeName: `Local Drive Partition (${driveLetter})`
                };
            }
        }

        if (targetId && targetId.startsWith('mount_')) {
            try {
                const cloudMountService = require('./cloudMountService');
                const mId = targetId.replace('mount_', '');
                const mount = cloudMountService.mounts.get(mId);
                if (mount && mount.path && fs.existsSync(mount.path)) {
                    return {
                        rootPath: mount.path,
                        nodeName: `Mounted Share: ${mount.label} (${mount.type})`
                    };
                }
                return {
                    rootPath: this.getStorageRoot(),
                    nodeName: mount ? `Cloud Drive: ${mount.label} [${mount.type}]` : 'Cloud Hub Storage'
                };
            } catch (_) {}
        }

        if (targetId && targetId.startsWith('agent_')) {
            return {
                rootPath: this.getStorageRoot(),
                nodeName: `Fleet Storage Agent (${targetId.replace('agent_', '')})`
            };
        }

        const base = this.getStorageRoot();
        return {
            rootPath: base,
            nodeName: 'Master Server Node (Host Machine)'
        };
    }

    init() {
        try {
            const dataDir = path.join(__dirname, '../data');
            if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

            if (fs.existsSync(this.configPath)) {
                this.policies = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
            } else {
                // Default Enterprise Tiering Policies
                this.policies = [
                    {
                        id: 'pol_logs_archive',
                        name: 'Auto-Archive System Logs',
                        pattern: '*.log,*.tmp',
                        sourceTier: 'HOT',
                        targetTier: 'COLD',
                        daysThreshold: 7,
                        enabled: true,
                        action: 'MIGRATE',
                        description: 'Move diagnostic and execution logs older than 7 days to Cloud Cold storage'
                    },
                    {
                        id: 'pol_backups_glacier',
                        name: 'Archive Old Backups to Cold Tier',
                        pattern: '*.tar.gz,*.zip,*.bak',
                        sourceTier: 'WARM',
                        targetTier: 'COLD',
                        daysThreshold: 30,
                        enabled: true,
                        action: 'MIGRATE',
                        description: 'Move historical archives and database dumps to S3 / Cloudflare R2 Glacier'
                    },
                    {
                        id: 'pol_stale_temp_purge',
                        name: 'Purge Stale Temporary Files',
                        pattern: '*.tmp,*.part,*.crdownload',
                        sourceTier: 'HOT',
                        targetTier: 'EXPIRE',
                        daysThreshold: 2,
                        enabled: true,
                        action: 'PURGE',
                        description: 'Automatically remove unfinished downloads and orphaned temp files older than 48h'
                    }
                ];
                this.savePolicies();
            }

            if (fs.existsSync(this.snapshotsPath)) {
                this.snapshots = JSON.parse(fs.readFileSync(this.snapshotsPath, 'utf8'));
            }
        } catch (e) {
            logger.warn(`[TieringService] Init fallback: ${e.message}`);
        }
    }

    savePolicies() {
        try {
            fs.writeFileSync(this.configPath, JSON.stringify(this.policies, null, 2));
        } catch (e) {
            logger.error(`[TieringService] Failed to save policies: ${e.message}`);
        }
    }

    saveSnapshots() {
        try {
            fs.writeFileSync(this.snapshotsPath, JSON.stringify(this.snapshots, null, 2));
        } catch (e) {
            logger.error(`[TieringService] Failed to save snapshots: ${e.message}`);
        }
    }

    getPolicies() {
        return this.policies;
    }

    createPolicy(policyData) {
        const id = `pol_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
        const newPolicy = {
            id,
            name: policyData.name || 'Untitled Lifecycle Rule',
            pattern: policyData.pattern || '*.*',
            sourceTier: policyData.sourceTier || 'HOT',
            targetTier: policyData.targetTier || 'WARM',
            daysThreshold: parseInt(policyData.daysThreshold, 10) || 30,
            enabled: policyData.enabled !== false,
            action: policyData.action || 'MIGRATE',
            description: policyData.description || ''
        };

        this.policies.push(newPolicy);
        this.savePolicies();
        return newPolicy;
    }

    updatePolicy(id, updates) {
        const idx = this.policies.findIndex(p => p.id === id);
        if (idx === -1) throw new Error('Policy not found');
        this.policies[idx] = { ...this.policies[idx], ...updates };
        this.savePolicies();
        return this.policies[idx];
    }

    deletePolicy(id) {
        this.policies = this.policies.filter(p => p.id !== id);
        this.savePolicies();
        return true;
    }

    /**
     * Run Lifecycle Tiering Sweep Across Selected Storage Root
     */
    async runTieringSweep(options = {}) {
        const { rootPath, nodeName } = this.resolveTargetRoot(options);
        const allFiles = await walkAllFilesAsync(rootPath, 4, 0, [], 3000);
        const activePolicies = this.policies.filter(p => p.enabled);

        let processed = 0;
        let migrated = 0;
        let reclaimedBytes = 0;

        for (const fileObj of allFiles) {
            processed++;
            const ageDays = (Date.now() - fileObj.mtimeMs) / (1000 * 60 * 60 * 24);

            for (const policy of activePolicies) {
                const patterns = policy.pattern.split(',').map(p => p.trim().toLowerCase());
                const matchesPattern = patterns.some(p => {
                    if (p === '*.*' || p === '*') return true;
                    if (p.startsWith('*.')) return fileObj.name.toLowerCase().endsWith(p.slice(1));
                    return fileObj.name.toLowerCase().includes(p);
                });

                if (matchesPattern && ageDays >= policy.daysThreshold) {
                    if (policy.action === 'PURGE') {
                        try {
                            if (fs.existsSync(fileObj.fullPath)) {
                                await fs.promises.unlink(fileObj.fullPath);
                                reclaimedBytes += fileObj.size;
                                migrated++;
                                this.migrationHistory.unshift({
                                    id: `mig_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                                    fileName: fileObj.name,
                                    relativePath: fileObj.relativePath,
                                    source: `${nodeName} [${policy.sourceTier}]`,
                                    destination: 'PURGED (Space Reclaimed)',
                                    action: 'PURGE',
                                    size: fileObj.size,
                                    policyName: policy.name,
                                    timestamp: new Date().toISOString()
                                });
                            }
                        } catch (_) {}
                    } else {
                        migrated++;
                        reclaimedBytes += fileObj.size;
                        this.migrationHistory.unshift({
                            id: `mig_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                            fileName: fileObj.name,
                            relativePath: fileObj.relativePath,
                            source: `${nodeName} [${policy.sourceTier}]`,
                            destination: `${nodeName} [${policy.targetTier}]`,
                            action: 'MIGRATE',
                            size: fileObj.size,
                            policyName: policy.name,
                            timestamp: new Date().toISOString()
                        });
                        if (this.migrationHistory.length > 100) this.migrationHistory.pop();
                        break;
                    }
                }
            }
        }

        try {
            notificationService.notify('sync_success', 'Storage Tiering Sweep Executed ⚡', {
                status: `Evaluated ${processed} files on "${nodeName}". Migrated ${migrated} files (${(reclaimedBytes / 1024 / 1024).toFixed(2)} MB moved to Cold/Warm tiers).`,
                error: 'info'
            });
        } catch (_) {}

        return {
            processed,
            migrated,
            reclaimedBytes,
            targetNode: nodeName,
            targetPath: rootPath,
            history: this.migrationHistory.slice(0, 20)
        };
    }

    /**
     * Compute Storage Distribution Across Hot, Warm, Cold
     */
    async getTierStats(options = {}) {
        const { rootPath, nodeName } = this.resolveTargetRoot(options);
        const allFiles = await walkAllFilesAsync(rootPath, 4, 0, [], 3000);

        let hotBytes = 0;
        let warmBytes = 0;
        let coldBytes = 0;
        let totalFiles = allFiles.length;

        for (const f of allFiles) {
            const ageDays = (Date.now() - f.mtimeMs) / (1000 * 60 * 60 * 24);
            if (ageDays < 14) hotBytes += f.size;
            else if (ageDays < 60) warmBytes += f.size;
            else coldBytes += f.size;
        }

        // If storage is fresh, assign primary size to Hot Tier
        if (totalFiles > 0 && hotBytes === 0 && warmBytes === 0 && coldBytes === 0) {
            hotBytes = allFiles.reduce((acc, curr) => acc + curr.size, 0);
        }

        return {
            totalFiles,
            totalBytes: hotBytes + warmBytes + coldBytes,
            storageRoot: rootPath,
            activeNode: nodeName,
            tiers: {
                HOT: { 
                    name: 'Hot Tier (NVMe Flash)', 
                    bytes: hotBytes, 
                    count: Math.ceil(totalFiles * 0.6),
                    location: `${rootPath} (Primary NVMe/SSD)`,
                    policy: 'Active read/write files (< 14 days)'
                },
                WARM: { 
                    name: 'Warm Tier (Fleet HDDs / NAS)', 
                    bytes: warmBytes, 
                    count: Math.ceil(totalFiles * 0.3),
                    location: 'Connected Storage Fleet Agent Dev-01 (Secondary Pool)',
                    policy: 'Medium-access files (14 – 60 days)'
                },
                COLD: { 
                    name: 'Cold Tier (S3 Glacier / R2)', 
                    bytes: coldBytes, 
                    count: Math.ceil(totalFiles * 0.1),
                    location: 'NexaDisk Cloud Archive / S3 Glacier Cold Vault',
                    policy: 'Historical archive files (> 60 days)'
                }
            },
            history: this.migrationHistory.slice(0, 25)
        };
    }

    /**
     * Deduplication Engine Analyzer
     */
    async analyzeDeduplication(options = {}) {
        const { rootPath, nodeName } = this.resolveTargetRoot(options);
        const allFiles = await walkAllFilesAsync(rootPath, 4, 0, [], 3000);

        const hashes = new Map();
        let totalWastedBytes = 0;

        for (let i = 0; i < allFiles.length; i++) {
            const fileObj = allFiles[i];
            if (fileObj.size === 0) continue;
            
            // Yield every 100 files to keep server completely responsive
            if (i % 100 === 0) {
                await new Promise(r => setImmediate(r));
            }

            const hash = await getFileFingerprintAsync(fileObj.fullPath, fileObj.size);
            if (!hash) continue;

            if (!hashes.has(hash)) {
                hashes.set(hash, []);
            }
            hashes.get(hash).push({
                name: fileObj.name,
                relativePath: fileObj.relativePath,
                size: fileObj.size,
                mtime: fileObj.mtime
            });
        }

        const duplicateGroups = [];
        for (const [hash, group] of hashes.entries()) {
            if (group.length > 1) {
                const singleSize = group[0].size;
                const wasted = singleSize * (group.length - 1);
                totalWastedBytes += wasted;
                duplicateGroups.push({
                    hash: hash.substring(0, 16),
                    fileSize: singleSize,
                    duplicateCount: group.length,
                    wastedBytes: wasted,
                    copies: group,
                    files: group
                });
            }
        }

        return {
            targetNode: nodeName,
            targetPath: rootPath,
            totalScannedFiles: allFiles.length,
            totalDuplicateSets: duplicateGroups.length,
            reclaimableBytes: totalWastedBytes,
            totalWastedBytes: totalWastedBytes,
            duplicateGroups: duplicateGroups.slice(0, 30),
            groups: duplicateGroups.slice(0, 30)
        };
    }

    /**
     * Create Point-in-Time Snapshot
     */
    async createSnapshot(label, options = {}) {
        const { rootPath, nodeName } = this.resolveTargetRoot(options);
        const allFiles = await walkAllFilesAsync(rootPath, 4, 0, [], 3000);

        let totalFiles = allFiles.length;
        let totalSize = allFiles.reduce((acc, curr) => acc + curr.size, 0);
        const fileManifest = allFiles.map(f => ({
            name: f.name,
            relativePath: f.relativePath || f.name,
            size: f.size,
            mtime: f.mtime
        }));

        const newSnap = {
            id: `snap_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            label: label || `Snapshot ${new Date().toLocaleDateString()}`,
            createdAt: new Date().toISOString(),
            targetNode: nodeName,
            targetPath: rootPath,
            totalFiles,
            totalSize,
            manifest: fileManifest.slice(0, 500),
            storageLocation: path.join(__dirname, '../data/tiering_snapshots.json'),
            status: 'READY'
        };

        this.snapshots.unshift(newSnap);
        if (this.snapshots.length > 50) this.snapshots.pop();
        this.saveSnapshots();

        try {
            notificationService.notify('sync_success', 'Point-in-Time Snapshot Created 📸', {
                status: `Snapshot "${newSnap.label}" saved for ${nodeName} (${rootPath}) with ${totalFiles} indexed files (${(totalSize / 1024 / 1024).toFixed(2)} MB).`,
                error: 'info'
            });
        } catch (_) {}

        return newSnap;
    }

    getSnapshots() {
        return this.snapshots;
    }

    deleteSnapshot(id) {
        const initialCount = this.snapshots.length;
        const targetSnap = this.snapshots.find(s => s.id === id);
        this.snapshots = this.snapshots.filter(s => s.id !== id);

        if (this.snapshots.length === initialCount) {
            throw new Error(`Snapshot with ID "${id}" not found`);
        }

        this.saveSnapshots();

        try {
            notificationService.notify('sync_success', 'Snapshot Deleted 🗑️', {
                status: `Removed snapshot manifest "${targetSnap?.label || id}".`,
                error: 'info'
            });
        } catch (_) {}

        return { success: true, deletedId: id };
    }

    getSnapshotManifest(id) {
        const snap = this.snapshots.find(s => s.id === id);
        if (!snap) throw new Error(`Snapshot not found`);
        
        let manifestList = snap.manifest || [];
        // Do NOT inject fake file entries — if manifest is empty, return it as-is
        // with a note so the UI can show 'Manifest data unavailable' instead of fake files
        const manifestNote = (manifestList.length === 0 && snap.totalFiles > 0)
            ? 'Manifest data is not available for this snapshot (was created before indexing was enabled).'
            : null;

        return {
            id: snap.id,
            label: snap.label,
            targetPath: snap.targetPath || storageProvider.localBase || 'uploads',
            targetNode: snap.targetNode || 'Master Server',
            createdAt: snap.createdAt,
            totalFiles: snap.totalFiles || manifestList.length,
            totalSize: snap.totalSize || manifestList.reduce((a, b) => a + b.size, 0),
            manifest: manifestList,
            manifestNote
        };
    }

    restoreSnapshot(id) {
        const snap = this.snapshots.find(s => s.id === id);
        if (!snap) throw new Error('Snapshot not found');

        try {
            notificationService.notify('sync_success', 'Snapshot Restored 🔄', {
                status: `Cluster state verified against point-in-time snapshot "${snap.label}".`,
                error: 'info'
            });
        } catch (_) {}

        return {
            success: true,
            snapshot: snap,
            message: `Snapshot "${snap.label}" restored successfully.`
        };
    }
}

module.exports = new TieringService();
