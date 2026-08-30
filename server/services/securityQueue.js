const fs = require('fs');
const path = require('path');
const os = require('os');
const EventEmitter = require('events');
const securityService = require('./securityService');
const logger = require('../utils/logger');
const crypto = require('crypto');

class SecurityQueue extends EventEmitter {
    constructor() {
        super();
        this.stagingDir = path.join(process.cwd(), 'security_staging');
        this.queue = [];
        this.isProcessing = false;

        if (!fs.existsSync(this.stagingDir)) {
            fs.mkdirSync(this.stagingDir, { recursive: true });
        }
    }

    getStagingDir() {
        return this.stagingDir;
    }

    addFileToQueue(stagedPath, originalName, targetDir, shareId = null, ownerId = null) {
        this.queue.push({ stagedPath, originalName, targetDir, shareId, ownerId });
        this.processNext();
    }

    async processNext() {
        if (this.isProcessing || this.queue.length === 0) return;
        this.isProcessing = true;

        const job = this.queue.shift();
        const { stagedPath, originalName, targetDir, shareId } = job;

        logger.info(`[SecurityQueue] Starting scan for ${originalName}...`);

        try {
            if (!fs.existsSync(stagedPath)) {
                throw new Error('File no longer exists in staging');
            }

            const scanResult = await securityService.deepScan(stagedPath, originalName);
            
            // Generate Quarantine ID
            const quarantineId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
            const destPath = path.join(targetDir, originalName);

            if (scanResult.verdict === 'malicious') {
                logger.warn(`[SecurityQueue] Blocked malicious file: ${originalName} (Score: ${scanResult.score})`);
                await securityService.quarantineFile(
                    quarantineId,
                    originalName,
                    stagedPath,
                    destPath,
                    shareId,
                    fs.statSync(stagedPath).size,
                    'application/octet-stream',
                    scanResult
                );
                this.emit('fileBlocked', { originalName, result: scanResult });
            } 
            else if (scanResult.verdict === 'suspicious') {
                logger.warn(`[SecurityQueue] Quarantined suspicious file: ${originalName} (Score: ${scanResult.score})`);
                await securityService.quarantineFile(
                    quarantineId,
                    originalName,
                    stagedPath,
                    destPath,
                    shareId,
                    fs.statSync(stagedPath).size,
                    'application/octet-stream',
                    scanResult
                );
                this.emit('fileQuarantined', { originalName, result: scanResult });
            } 
            else {
                // Clean -> Deliver to destination (Agent / SMB / Local)
                const { deliverFileToDestination } = require('../utils/fileHelpers');
                await deliverFileToDestination(stagedPath, targetDir, originalName);
                this.emit('fileClean', { originalName, destPath });

                // Clear directory size cache so changes reflect immediately in Explorer
                try {
                    const { clearDirSizeCache } = require('../utils/fileHelpers');
                    if (typeof clearDirSizeCache === 'function') clearDirSizeCache();
                } catch (cErr) {
                    logger.error(`[SecurityQueue] Failed to clear directory cache: ${cErr.message}`);
                }

                // Trigger in-app notification & audit log for guest portal uploads
                try {
                    const notificationService = require('./notificationService');
                    await notificationService.dispatchAlert(
                        'file_upload',
                        'Guest Upload Received 📥',
                        `File: ${originalName}\nFolder: ${path.basename(targetDir)}`,
                        'info'
                    );
                } catch (nErr) {
                    logger.error(`[SecurityQueue] Failed to send guest upload notification: ${nErr.message}`);
                }

                try {
                    const auditService = require('./auditService');
                    await auditService.log(
                        null,
                        'Guest User',
                        'FILE_UPLOAD',
                        `Uploaded file "${originalName}" to directory "${targetDir}" via shared portal`,
                        null
                    );
                } catch (aErr) {
                    logger.error(`[SecurityQueue] Failed to write audit log for guest upload: ${aErr.message}`);
                }
            }
        } catch (e) {
            logger.error(`[SecurityQueue] Failed to process ${originalName}: ${e.message}`, e);
            try { fs.unlinkSync(stagedPath); } catch (ignore) {}
        } finally {
            this.isProcessing = false;
            // Process the next one
            setTimeout(() => this.processNext(), 100);
        }
    }
}

const securityQueue = new SecurityQueue();
module.exports = securityQueue;
