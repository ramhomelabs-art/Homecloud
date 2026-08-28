const dgram = require('dgram');
const net = require('net');
const axios = require('axios');
const os = require('os');
const db = require('../config/database');
const logger = require('../utils/logger');

class SiemService {
    constructor() {
        this.hostname = os.hostname() || 'nexadisk-master';
        this.vendor = 'NexaDisk';
        this.product = 'NexaDisk-v2';
        this.version = '2.0.0';
    }

    /**
     * Read SIEM configuration settings from database
     */
    async getConfig() {
        try {
            const keys = [
                'siem_enabled',
                'siem_format',       // 'CEF', 'LEEF', 'JSON', 'SYSLOG'
                'siem_protocol',     // 'UDP', 'TCP', 'HTTP'
                'siem_host',         // e.g. '192.168.1.50' or 'splunk.internal'
                'siem_port',         // e.g. 514, 6514, 8088
                'siem_http_url',      // e.g. 'https://splunk:8088/services/collector/event' or 'http://elk:9200/nexadisk-audit/_doc'
                'siem_api_key',      // Authorization token / HEC token
                'siem_facility',     // Default 1 (user-level messages)
                'siem_default_sev'   // Default 3 (Notice/Informational)
            ];
            const res = await db.query('SELECT key, value FROM app_settings WHERE key = ANY($1)', [keys]);
            const config = {};
            for (const row of res.rows) {
                config[row.key] = row.value;
            }
            return {
                enabled: config.siem_enabled === 'true' || config.siem_enabled === '1',
                format: (config.siem_format || 'CEF').toUpperCase(),
                protocol: (config.siem_protocol || 'UDP').toUpperCase(),
                host: config.siem_host || '127.0.0.1',
                port: parseInt(config.siem_port || '514', 10),
                httpUrl: config.siem_http_url || '',
                apiKey: config.siem_api_key || '',
                facility: parseInt(config.siem_facility || '1', 10),
                defaultSev: parseInt(config.siem_default_sev || '3', 10)
            };
        } catch (err) {
            logger.warn(`[SiemService] Failed to load SIEM configuration: ${err.message}`);
            return { enabled: false };
        }
    }

    /**
     * Map audit action to numeric severity (1 to 10 for CEF, 1 to 7 for Syslog)
     */
    mapSeverity(action = '') {
        const highSevActions = [
            'AUTH_BRUTE_FORCE', 'RANSOMWARE_CANARY_TRIPPED', 'MALWARE_DETECTED', 
            'IP_BLACKLISTED', 'INTEGRITY_VIOLATION', 'UNAUTHORIZED_ACCESS',
            'USER_LOCKOUT', 'FIREWALL_RULE_BREACH'
        ];
        const medSevActions = [
            'USER_CREATE', 'USER_DELETE', 'USER_PASSWORD_RESET', 'MFA_DISABLED',
            'SETTINGS_UPDATE', 'PERMISSIONS_CHANGE', 'CLUSTER_NODE_OFFLINE',
            'SHARE_EXPIRED', 'QUARANTINE_FILE'
        ];

        const upper = action.toUpperCase();
        if (highSevActions.some(a => upper.includes(a))) return { cef: 9, syslog: 2, label: 'CRITICAL' };
        if (medSevActions.some(a => upper.includes(a))) return { cef: 6, syslog: 4, label: 'WARNING' };
        return { cef: 3, syslog: 6, label: 'INFO' };
    }

    /**
     * Format a single audit log row into CEF (Common Event Format)
     * Format: CEF:Version|Device Vendor|Device Product|Device Version|Device Event Class ID|Name|Severity|[Extension]
     */
    formatCEF(log) {
        const sev = this.mapSeverity(log.action);
        const timestamp = log.timestamp ? new Date(log.timestamp).getTime() : Date.now();
        const safeDetails = (log.details || '').replace(/[\r\n\=]/g, ' ');
        const safeAction = (log.action || 'GENERAL_AUDIT').replace(/[\r\n|]/g, '_');
        
        const extensions = [
            `rt=${timestamp}`,
            `src=${log.ip_address || '127.0.0.1'}`,
            `suser=${log.username || 'System'}`,
            `act=${safeAction}`,
            `msg=${safeDetails}`
        ];

        if (log.id) extensions.push(`externalId=${log.id}`);
        if (log.user_agent) extensions.push(`requestClientApplication=${(log.user_agent || '').slice(0, 150).replace(/=/g, '_')}`);
        if (log.entry_hash) extensions.push(`cs1Label=AuditHash cs1=${log.entry_hash}`);

        return `CEF:0|${this.vendor}|${this.product}|${this.version}|${safeAction}|${safeAction}|${sev.cef}|${extensions.join(' ')}`;
    }

    /**
     * Format a single audit log row into LEEF (Log Event Extended Format - IBM QRadar)
     */
    formatLEEF(log) {
        const sev = this.mapSeverity(log.action);
        const isoTime = log.timestamp ? new Date(log.timestamp).toISOString() : new Date().toISOString();
        const safeDetails = (log.details || '').replace(/[\r\n\t]/g, ' ');
        const safeAction = (log.action || 'GENERAL_AUDIT').replace(/[\r\n|]/g, '_');

        const fields = [
            `devTime=${isoTime}`,
            `devTimeFormat=yyyy-MM-dd'T'HH:mm:ss.SSSZ`,
            `src=${log.ip_address || '127.0.0.1'}`,
            `usrName=${log.username || 'System'}`,
            `cat=${safeAction}`,
            `sev=${sev.cef}`,
            `msg=${safeDetails}`
        ];

        if (log.id) fields.push(`eventId=${log.id}`);
        if (log.entry_hash) fields.push(`hash=${log.entry_hash}`);

        return `LEEF:2.0|${this.vendor}|${this.product}|${this.version}|${safeAction}|\t${fields.join('\t')}`;
    }

    /**
     * Format a single audit log row into ECS-compliant JSON (Elastic Common Schema)
     */
    formatECSJSON(log) {
        const sev = this.mapSeverity(log.action);
        return JSON.stringify({
            '@timestamp': log.timestamp ? new Date(log.timestamp).toISOString() : new Date().toISOString(),
            ecs: { version: '8.0.0' },
            event: {
                id: log.id || undefined,
                action: log.action,
                category: ['authentication', 'configuration', 'file'],
                severity: sev.cef,
                outcome: sev.label === 'CRITICAL' ? 'failure' : 'success'
            },
            host: {
                hostname: this.hostname
            },
            service: {
                name: 'nexadisk-enterprise',
                version: this.version
            },
            user: {
                name: log.username || 'System',
                id: log.user_id || undefined
            },
            source: {
                ip: log.ip_address || '127.0.0.1'
            },
            user_agent: log.user_agent ? { original: log.user_agent } : undefined,
            message: log.details || '',
            nexadisk: {
                entry_hash: log.entry_hash || undefined,
                prev_hash: log.prev_hash || undefined
            }
        });
    }

    /**
     * Format a single audit log row into Syslog RFC 5424 string
     */
    formatSyslog(log) {
        const sev = this.mapSeverity(log.action);
        const pri = (1 * 8) + sev.syslog; // Facility 1 (user) * 8 + severity
        const timestamp = log.timestamp ? new Date(log.timestamp).toISOString() : new Date().toISOString();
        const safeDetails = (log.details || '').replace(/[\r\n]/g, ' ');
        const safeAction = (log.action || 'AUDIT').replace(/\s+/g, '_');

        return `<${pri}>1 ${timestamp} ${this.hostname} NexaDisk - - [audit@5432 action="${safeAction}" user="${log.username || 'System'}" ip="${log.ip_address || '127.0.0.1'}"] ${safeDetails}`;
    }

    /**
     * Ship a formatted payload over UDP to remote Syslog/SIEM collector
     */
    async sendUDP(payload, host, port) {
        return new Promise((resolve, reject) => {
            const client = dgram.createSocket('udp4');
            const message = Buffer.from(payload + '\n', 'utf8');

            client.send(message, 0, message.length, port, host, (err) => {
                client.close();
                if (err) return reject(err);
                resolve(true);
            });
        });
    }

    /**
     * Ship a formatted payload over TCP to remote Syslog/SIEM collector
     */
    async sendTCP(payload, host, port) {
        return new Promise((resolve, reject) => {
            const client = new net.Socket();
            client.setTimeout(4000);

            client.connect(port, host, () => {
                client.write(payload + '\n', 'utf8', () => {
                    client.end();
                    resolve(true);
                });
            });

            client.on('error', (err) => {
                client.destroy();
                reject(err);
            });

            client.on('timeout', () => {
                client.destroy();
                reject(new Error(`TCP connection to SIEM ${host}:${port} timed out after 4000ms`));
            });
        });
    }

    /**
     * Ship formatted payload over HTTP/HTTPS (Splunk HEC, Elastic Bulk/Index, Custom Webhook)
     */
    async sendHTTP(payload, url, apiKey) {
        const headers = { 'Content-Type': 'application/json' };
        if (apiKey) {
            // Support Splunk Splunk <HEC-TOKEN> or standard Bearer
            headers['Authorization'] = apiKey.startsWith('Splunk ') ? apiKey : `Bearer ${apiKey}`;
        }

        let body = payload;
        try {
            if (typeof payload === 'string' && (payload.startsWith('{') || payload.startsWith('['))) {
                body = JSON.parse(payload);
            }
        } catch (_) {}

        await axios.post(url, body, {
            headers,
            timeout: 5000
        });
    }

    /**
     * Forward an active audit entry to configured external SIEM
     */
    async forward(auditEntry) {
        const config = await this.getConfig();
        if (!config.enabled) return;

        let payload = '';
        switch (config.format) {
            case 'CEF':
                payload = this.formatCEF(auditEntry);
                break;
            case 'LEEF':
                payload = this.formatLEEF(auditEntry);
                break;
            case 'JSON':
                payload = this.formatECSJSON(auditEntry);
                break;
            case 'SYSLOG':
            default:
                payload = this.formatSyslog(auditEntry);
                break;
        }

        try {
            if (config.protocol === 'UDP') {
                await this.sendUDP(payload, config.host, config.port);
            } else if (config.protocol === 'TCP') {
                await this.sendTCP(payload, config.host, config.port);
            } else if (config.protocol === 'HTTP' && config.httpUrl) {
                await this.sendHTTP(payload, config.httpUrl, config.apiKey);
            }
            logger.debug(`[SiemService] Dispatched ${config.format} audit log over ${config.protocol} to ${config.host || config.httpUrl}`);
        } catch (err) {
            logger.error(`[SiemService] SIEM log shipping failed (${config.protocol}): ${err.message}`);
        }
    }

    /**
     * Test SIEM collector connectivity
     */
    async testConnection(testConfig) {
        const cfg = {
            format: testConfig.format || 'CEF',
            protocol: (testConfig.protocol || 'UDP').toUpperCase(),
            host: testConfig.host || '127.0.0.1',
            port: parseInt(testConfig.port || '514', 10),
            httpUrl: testConfig.httpUrl || '',
            apiKey: testConfig.apiKey || ''
        };

        const sampleEvent = {
            id: 'test-event-001',
            timestamp: new Date().toISOString(),
            action: 'SIEM_INTEGRATION_TEST',
            username: 'admin',
            ip_address: '127.0.0.1',
            user_agent: 'NexaDisk-SIEM-Validator/2.0',
            details: 'Synthetic enterprise SIEM connectivity probe from NexaDisk core server.',
            entry_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
        };

        let payload = '';
        if (cfg.format === 'CEF') payload = this.formatCEF(sampleEvent);
        else if (cfg.format === 'LEEF') payload = this.formatLEEF(sampleEvent);
        else if (cfg.format === 'JSON') payload = this.formatECSJSON(sampleEvent);
        else payload = this.formatSyslog(sampleEvent);

        if (cfg.protocol === 'UDP') {
            await this.sendUDP(payload, cfg.host, cfg.port);
            return { success: true, message: `Successfully transmitted UDP packet to ${cfg.host}:${cfg.port}`, payload };
        } else if (cfg.protocol === 'TCP') {
            await this.sendTCP(payload, cfg.host, cfg.port);
            return { success: true, message: `Successfully established TCP session and streamed frame to ${cfg.host}:${cfg.port}`, payload };
        } else if (cfg.protocol === 'HTTP') {
            if (!cfg.httpUrl) throw new Error('HTTP URL is required for HTTP protocol test');
            await this.sendHTTP(payload, cfg.httpUrl, cfg.apiKey);
            return { success: true, message: `Successfully delivered HTTP POST to ${cfg.httpUrl}`, payload };
        }

        throw new Error(`Unsupported protocol: ${cfg.protocol}`);
    }

    /**
     * Batch export audit logs to CEF format text
     */
    exportCEF(logs = []) {
        return logs.map(l => this.formatCEF(l)).join('\n');
    }

    /**
     * Batch export audit logs to LEEF format text
     */
    exportLEEF(logs = []) {
        return logs.map(l => this.formatLEEF(l)).join('\n');
    }

    /**
     * Batch export audit logs to JSON Lines (ECS)
     */
    exportJSON(logs = []) {
        return JSON.stringify(logs.map(l => JSON.parse(this.formatECSJSON(l))), null, 2);
    }

    /**
     * Batch export audit logs to standard compliance CSV format
     */
    exportCSV(logs = []) {
        const headers = ['ID', 'Timestamp', 'Username', 'User ID', 'Action', 'Severity', 'IP Address', 'User Agent', 'Details', 'Prev Hash', 'Entry Hash'];
        const escapeCSV = (val) => `"${String(val || '').replace(/"/g, '""')}"`;

        const rows = logs.map(l => {
            const sev = this.mapSeverity(l.action).label;
            return [
                escapeCSV(l.id),
                escapeCSV(l.timestamp),
                escapeCSV(l.username),
                escapeCSV(l.user_id),
                escapeCSV(l.action),
                escapeCSV(sev),
                escapeCSV(l.ip_address),
                escapeCSV(l.user_agent),
                escapeCSV(l.details),
                escapeCSV(l.prev_hash),
                escapeCSV(l.entry_hash)
            ].join(',');
        });

        return [headers.join(','), ...rows].join('\n');
    }
}

module.exports = new SiemService();
