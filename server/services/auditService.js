const crypto = require('crypto');
const db = require('../config/database');
const logger = require('../utils/logger');
let siemService = null;
const getSiemService = () => {
    if (!siemService) siemService = require('./siemService');
    return siemService;
};

const GENESIS_PREV_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

class AuditService {
    constructor() {
        this.lastHash = null;
    }

    /**
     * Compute SHA-256 hash for an audit log entry (chain-linked)
     */
    computeEntryHash(prevHash, timestamp, userId, username, action, details, ipAddress, userAgent) {
        const timeEpochSec = timestamp ? Math.floor(new Date(timestamp).getTime() / 1000) : Math.floor(Date.now() / 1000);
        const payload = [
            prevHash || GENESIS_PREV_HASH,
            String(timeEpochSec),
            userId || '',
            username || '',
            action || '',
            details || '',
            ipAddress || '',
            userAgent || ''
        ].join('|');

        return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
    }

    /**
     * Get the latest hash from the ledger to link the new block
     */
    async getLatestHash() {
        if (this.lastHash) return this.lastHash;
        try {
            const res = await db.query('SELECT entry_hash FROM audit_logs WHERE entry_hash IS NOT NULL ORDER BY timestamp DESC LIMIT 1');
            if (res.rows.length > 0 && res.rows[0].entry_hash) {
                this.lastHash = res.rows[0].entry_hash;
                return this.lastHash;
            }
        } catch (_) {}
        return GENESIS_PREV_HASH;
    }

    /**
     * Log an audit event into the tamper-evident cryptographic ledger.
     * @param {string|null} userId - The user performing the action.
     * @param {string|null} username - The username performing the action.
     * @param {string} action - Action identifier (e.g. 'FILE_UPLOAD').
     * @param {string} details - Detailed descriptive text.
     * @param {object} [req] - Express request object (to extract IP and User-Agent).
     */
    async log(userId, username, action, details, req) {
        let ipAddress = '';
        let userAgent = '';

        if (req) {
            const xForwardedFor = req.headers['x-forwarded-for'];
            if (xForwardedFor) {
                ipAddress = xForwardedFor.split(',')[0].trim();
            } else {
                ipAddress = req.socket?.remoteAddress || req.ip || '';
            }
            if (ipAddress === '::1' || ipAddress === '::ffff:127.0.0.1') {
                ipAddress = '127.0.0.1';
            }
            userAgent = req.headers['user-agent'] || '';
        }

        const now = new Date();
        let validUserId = userId;

        // Verify if user_id exists in users table to prevent FK constraint failures
        if (validUserId) {
            try {
                const userCheck = await db.query('SELECT id FROM users WHERE id = $1', [validUserId]);
                if (userCheck.rows.length === 0) {
                    validUserId = null;
                }
            } catch (_) {
                validUserId = null;
            }
        }

        try {
            const prevHash = await this.getLatestHash();
            const entryHash = this.computeEntryHash(prevHash, now, validUserId, username, action, details, ipAddress, userAgent);

            const insertRes = await db.query(`
                INSERT INTO audit_logs (user_id, username, action, details, ip_address, user_agent, timestamp, prev_hash, entry_hash)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING id, timestamp, prev_hash, entry_hash
            `, [validUserId || null, username || null, action, details || '', ipAddress, userAgent, now, prevHash, entryHash]);

            this.lastHash = entryHash;



            const insertedRow = {
                id: insertRes.rows[0]?.id,
                user_id: userId,
                username: username || 'System',
                action,
                details: details || '',
                ip_address: ipAddress,
                user_agent: userAgent,
                timestamp: insertRes.rows[0]?.timestamp || now,
                prev_hash: prevHash,
                entry_hash: entryHash
            };

            logger.info(`[Audit] ${username || 'System'} executed ${action}: ${details}`);

            // Dispatch to SIEM in background (non-blocking)
            try {
                const siem = getSiemService();
                siem.forward(insertedRow).catch(e => logger.debug(`[AuditService] SIEM forward skipped: ${e.message}`));
            } catch (_) {}

            return insertedRow;
        } catch (err) {
            logger.error(`[AuditService] Failed to write audit log: ${err.message}`, err);
        }
    }

    /**
     * Retrieve audit logs matching criteria.
     */
    async getLogs(filters = {}) {
        const conditions = [];
        const values = [];
        let idx = 1;

        if (filters.username) {
            conditions.push(`username ILIKE $${idx++}`);
            values.push(`%${filters.username}%`);
        }
        if (filters.action) {
            conditions.push(`action = $${idx++}`);
            values.push(filters.action);
        }
        if (filters.search) {
            conditions.push(`(details ILIKE $${idx} OR username ILIKE $${idx} OR action ILIKE $${idx} OR ip_address ILIKE $${idx})`);
            values.push(`%${filters.search}%`);
            idx++;
        }
        if (filters.startDate) {
            conditions.push(`timestamp >= $${idx++}`);
            values.push(new Date(filters.startDate));
        }
        if (filters.endDate) {
            conditions.push(`timestamp <= $${idx++}`);
            values.push(new Date(filters.endDate));
        }

        const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

        try {
            const countRes = await db.query(`SELECT COUNT(*) FROM audit_logs ${whereClause}`, values);
            const total = parseInt(countRes.rows[0].count, 10);

            const limit = Math.min(filters.limit ? parseInt(filters.limit, 10) : 50, 1000);
            const offset = filters.offset ? parseInt(filters.offset, 10) : 0;

            const selectValues = [...values, limit, offset];
            const dataRes = await db.query(`
                SELECT id, user_id, username, action, details, ip_address, user_agent, timestamp, prev_hash, entry_hash
                FROM audit_logs
                ${whereClause}
                ORDER BY timestamp DESC
                LIMIT $${idx} OFFSET $${idx + 1}
            `, selectValues);

            return {
                logs: dataRes.rows,
                total,
                limit,
                offset
            };
        } catch (err) {
            logger.error(`[AuditService] Failed to get audit logs: ${err.message}`, err);
            throw err;
        }
    }

    /**
     * Retrieve ALL logs matching criteria (for batch SIEM export)
     */
    async getAllLogsForExport(filters = {}, maxRows = 5000) {
        const conditions = [];
        const values = [];
        let idx = 1;

        if (filters.username) {
            conditions.push(`username ILIKE $${idx++}`);
            values.push(`%${filters.username}%`);
        }
        if (filters.action) {
            conditions.push(`action = $${idx++}`);
            values.push(filters.action);
        }
        if (filters.startDate) {
            conditions.push(`timestamp >= $${idx++}`);
            values.push(new Date(filters.startDate));
        }
        if (filters.endDate) {
            conditions.push(`timestamp <= $${idx++}`);
            values.push(new Date(filters.endDate));
        }

        const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
        const dataRes = await db.query(`
            SELECT id, user_id, username, action, details, ip_address, user_agent, timestamp, prev_hash, entry_hash
            FROM audit_logs
            ${whereClause}
            ORDER BY timestamp ASC
            LIMIT $${idx}
        `, [...values, maxRows]);

        return dataRes.rows;
    }

    /**
     * Cryptographically verify the entire audit chain from oldest to newest.
     * Detects deleted rows, modified fields, or injected counterfeit entries.
     */
    async verifyIntegrity() {
        try {
            const res = await db.query(`
                SELECT id, user_id, username, action, details, ip_address, user_agent, timestamp, prev_hash, entry_hash
                FROM audit_logs
                ORDER BY timestamp ASC
            `);

            const logs = res.rows;
            if (logs.length === 0) {
                return {
                    verified: true,
                    totalRecords: 0,
                    status: 'EMPTY_LEDGER',
                    message: 'Audit ledger is currently empty.'
                };
            }

            let expectedPrevHash = GENESIS_PREV_HASH;
            let invalidEntries = [];

            for (let i = 0; i < logs.length; i++) {
                const log = logs[i];

                // Check if entry has hash (legacy unhashed entries are ignored for breakages)
                if (!log.entry_hash) {
                    continue;
                }

                // Verify previous hash chain linkage
                if (log.prev_hash && log.prev_hash !== expectedPrevHash && expectedPrevHash !== GENESIS_PREV_HASH) {
                    invalidEntries.push({
                        id: log.id,
                        index: i,
                        reason: 'CHAIN_LINKAGE_BROKEN',
                        expectedPrevHash,
                        actualPrevHash: log.prev_hash,
                        timestamp: log.timestamp
                    });
                }

                // Verify content integrity
                const computed = this.computeEntryHash(
                    log.prev_hash,
                    log.timestamp,
                    log.user_id,
                    log.username,
                    log.action,
                    log.details,
                    log.ip_address,
                    log.user_agent
                );

                if (computed !== log.entry_hash) {
                    invalidEntries.push({
                        id: log.id,
                        index: i,
                        reason: 'CONTENT_TAMPERED',
                        expectedHash: computed,
                        recordedHash: log.entry_hash,
                        timestamp: log.timestamp
                    });
                }

                expectedPrevHash = log.entry_hash;
            }

            const isClean = invalidEntries.length === 0;
            return {
                verified: isClean,
                totalRecords: logs.length,
                hashedRecords: logs.filter(l => !!l.entry_hash).length,
                status: isClean ? 'VERIFIED_SECURE' : 'COMPROMISED',
                issuesCount: invalidEntries.length,
                issues: invalidEntries.slice(0, 10),
                latestHash: this.lastHash || expectedPrevHash,
                verifiedAt: new Date().toISOString()
            };
        } catch (err) {
            logger.error(`[AuditService] Ledger verification failed: ${err.message}`, err);
            return {
                verified: false,
                status: 'VERIFICATION_ERROR',
                error: err.message
            };
        }
    }

    /**
     * Get aggregate statistics for Security & Compliance dashboard
     */
    async getAuditStats() {
        try {
            const [totalRes, actionsRes, usersRes, recentAlerts] = await Promise.all([
                db.query('SELECT COUNT(*) FROM audit_logs'),
                db.query('SELECT action, COUNT(*) as count FROM audit_logs GROUP BY action ORDER BY count DESC LIMIT 8'),
                db.query('SELECT username, COUNT(*) as count FROM audit_logs WHERE username IS NOT NULL GROUP BY username ORDER BY count DESC LIMIT 5'),
                db.query('SELECT * FROM audit_logs WHERE action ILIKE \'%FAIL%\' OR action ILIKE \'%DENIED%\' OR action ILIKE \'%BRUTE%\' OR action ILIKE \'%LOCK%\' ORDER BY timestamp DESC LIMIT 5')
            ]);

            return {
                totalAuditEvents: parseInt(totalRes.rows[0]?.count || 0, 10),
                topActions: actionsRes.rows,
                topUsers: usersRes.rows,
                securityIncidents: recentAlerts.rows
            };
        } catch (err) {
            logger.error(`[AuditService] Failed to load audit stats: ${err.message}`);
            return { totalAuditEvents: 0, topActions: [], topUsers: [], securityIncidents: [] };
        }
    }
}

module.exports = new AuditService();
