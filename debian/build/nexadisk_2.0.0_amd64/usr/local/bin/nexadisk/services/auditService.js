const db = require('../config/database');
const logger = require('../utils/logger');

class AuditService {
    /**
     * Log an audit event.
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
            // Check x-forwarded-for header (first IP in sequence)
            const xForwardedFor = req.headers['x-forwarded-for'];
            if (xForwardedFor) {
                ipAddress = xForwardedFor.split(',')[0].trim();
            } else {
                ipAddress = req.socket.remoteAddress || req.ip || '';
            }
            // Normalize localhost IPv6 to IPv4 format
            if (ipAddress === '::1' || ipAddress === '::ffff:127.0.0.1') {
                ipAddress = '127.0.0.1';
            }
            userAgent = req.headers['user-agent'] || '';
        }

        try {
            await db.query(`
                INSERT INTO audit_logs (user_id, username, action, details, ip_address, user_agent)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [userId || null, username || null, action, details || '', ipAddress, userAgent]);

            logger.info(`[Audit] ${username || 'System'} executed ${action}: ${details}`);
        } catch (err) {
            logger.error(`[AuditService] Failed to write audit log: ${err.message}`, err);
        }
    }

    /**
     * Retrieve audit logs matching criteria.
     * @param {object} [filters]
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
            conditions.push(`(details ILIKE $${idx} OR username ILIKE $${idx} OR action ILIKE $${idx})`);
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
            // Get total matching count
            const countRes = await db.query(`SELECT COUNT(*) FROM audit_logs ${whereClause}`, values);
            const total = parseInt(countRes.rows[0].count, 10);

            // Set limit/offset
            const limit = filters.limit ? parseInt(filters.limit, 10) : 50;
            const offset = filters.offset ? parseInt(filters.offset, 10) : 0;

            const selectValues = [...values, limit, offset];
            const dataRes = await db.query(`
                SELECT * FROM audit_logs
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
}

module.exports = new AuditService();
