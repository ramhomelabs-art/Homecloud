const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('../config/database');
const logger = require('../utils/logger');
const storageProvider = require('../utils/storageProvider');
// Loaded lazily to avoid circular require with notificationService
let notificationService = null;
const getNotificationService = () => {
    if (!notificationService) notificationService = require('./notificationService');
    return notificationService;
};

class CanaryService {
    constructor() {
        this.canaries = new Map(); // path -> { expectedHash, lastCheck, status }
        this.watchdogInterval = null;
        this.isCompromised = false;
        this.compromiseDetails = null;
    }

    /**
     * Compute SHA-256 hash of a file
     */
    computeHash(filePath) {
        if (!fs.existsSync(filePath)) return null;
        const fileBuffer = fs.readFileSync(filePath);
        return crypto.createHash('sha256').update(fileBuffer).digest('hex');
    }

    /**
     * Seed canary honeypot files in storage roots
     */
    async seedCanaries() {
        try {
            const baseDir = storageProvider.getBasePath ? storageProvider.getBasePath() : path.join(__dirname, '..', '..', 'uploads');
            if (!fs.existsSync(baseDir)) {
                fs.mkdirSync(baseDir, { recursive: true });
            }

            const canaryNames = [
                '.nexadisk_canary_alpha.guard',
                '~audit_vault_canary.docx',
                '.storage_integrity_canary.db'
            ];

            for (const name of canaryNames) {
                const canaryPath = path.join(baseDir, name);
                const seedContent = `NEXADISK_AUTONOMOUS_SECURITY_CANARY_SEED_${name}_TIMESTAMP_${Date.now()}`;

                // Only write if doesn't exist
                if (!fs.existsSync(canaryPath)) {
                    fs.writeFileSync(canaryPath, seedContent, { mode: 0o644 });
                }

                const expectedHash = this.computeHash(canaryPath);
                this.canaries.set(canaryPath, {
                    name,
                    path: canaryPath,
                    expectedHash,
                    status: 'ARMED',
                    lastCheck: new Date()
                });
            }

            logger.info(`[CanaryService] Armed ${this.canaries.size} ransomware canary honeypots in ${baseDir}`);
            this.startWatchdog();
            return { armedCount: this.canaries.size, canaries: Array.from(this.canaries.values()) };
        } catch (err) {
            logger.error(`[CanaryService] Failed to seed canaries: ${err.message}`);
            return { armedCount: 0, canaries: [] };
        }
    }

    /**
     * Autonomous Watchdog: Periodically verifies canary integrity
     */
    startWatchdog() {
        if (this.watchdogInterval) return;

        this.watchdogInterval = setInterval(() => {
            this.checkCanaries();
        }, 8000); // Check every 8 seconds
    }

    /**
     * Inspect all canaries for tampering or ransomware encryption
     */
    async checkCanaries() {
        for (const [canaryPath, canary] of this.canaries.entries()) {
            if (!fs.existsSync(canaryPath)) {
                await this.triggerLockdown(canaryPath, 'Canary Honeypot File Deleted by Rogue Process [T1070]');
                return;
            }

            const currentHash = this.computeHash(canaryPath);
            if (currentHash !== canary.expectedHash) {
                await this.triggerLockdown(canaryPath, 'Canary Honeypot Modified or Encrypted by Ransomware [T1486]');
                return;
            }

            canary.lastCheck = new Date();
            canary.status = 'ARMED';
        }
    }

    /**
     * Trigger autonomous emergency defensive lockdown
     */
    async triggerLockdown(canaryPath, reason) {
        this.isCompromised = true;
        this.compromiseDetails = {
            canaryPath,
            reason,
            timestamp: new Date().toISOString()
        };

        // Stop watchdog to prevent repeated fire storms on the same incident
        this.stopWatchdog();

        logger.error(`🚨 [CanaryService] SECURITY ALERT: ${reason} at ${canaryPath}`);

        try {
            // Log high-priority MITRE security incident in PostgreSQL
            await db.query(
                "INSERT INTO security_events (event_type, details) VALUES ($1, $2)",
                ['RANSOMWARE_CANARY_TRIPPED', JSON.stringify({ canaryPath, reason, timestamp: new Date() })]
            );
        } catch (e) {
            logger.error(`[CanaryService] Failed to log security event to DB: ${e.message}`);
        }

        // 🚨 Dispatch CRITICAL alert to all configured channels (Telegram, Discord, n8n, in-app)
        try {
            const ns = getNotificationService();
            const alertTitle = '🚨 RANSOMWARE CANARY TRIPPED — Immediate Action Required';
            const alertDetail = [
                `Trigger: ${reason}`,
                `Canary: ${path.basename(canaryPath)}`,
                `Timestamp: ${new Date().toUTCString()}`,
                `MITRE ATT&CK: ${reason.includes('T1486') ? 'T1486 (Data Encrypted for Impact)' : 'T1070 (Indicator Removal)'}`,
                `Action: Investigate ${path.basename(canaryPath)} and adjacent files immediately`
            ].join('\n');
            await ns.dispatchAlert('ransomware_canary', alertTitle, alertDetail, 'error');
        } catch (e) {
            logger.error(`[CanaryService] Failed to dispatch canary alert notification: ${e.message}`);
        }
    }

    /**
     * Stop the watchdog (called on graceful shutdown or after lockdown)
     */
    stopWatchdog() {
        if (this.watchdogInterval) {
            clearInterval(this.watchdogInterval);
            this.watchdogInterval = null;
            logger.info('[CanaryService] Watchdog stopped.');
        }
    }

    /**
     * Reset the compromise state and re-arm canaries (admin action)
     */
    async reset() {
        this.isCompromised = false;
        this.compromiseDetails = null;
        this.canaries.clear();
        await this.seedCanaries();
        logger.info('[CanaryService] Canary system reset and re-armed.');
    }

    /**
     * Get real-time status of canary honeypot defense
     */
    getStatus() {
        return {
            armed: this.canaries.size > 0,
            activeCount: this.canaries.size,
            isCompromised: this.isCompromised,
            compromiseDetails: this.compromiseDetails,
            canaries: Array.from(this.canaries.values()).map(c => ({
                name: c.name,
                status: this.isCompromised ? 'TRIPPED' : c.status,
                lastCheck: c.lastCheck
            }))
        };
    }
}

const canaryService = new CanaryService();
// Initialize on module load
canaryService.seedCanaries().catch(e => logger.error(`[CanaryService] Auto-init failed: ${e.message}`));

module.exports = canaryService;
