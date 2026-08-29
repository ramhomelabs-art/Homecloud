const crypto = require('crypto');
const db = require('../../config/database');
const logger = require('../../utils/logger');
const geoService = require('../../utils/geoService');
const eventBus = require('../../utils/eventBus');

// MITRE ATT&CK Mapping dictionary
const MITRE_MAPPINGS = {
    SQL_INJECTION: { code: 'T1190', name: 'Exploit Public-Facing Application (SQLi)', defaultSeverity: 'HIGH', baseScore: 45 },
    XSS: { code: 'T1203', name: 'Exploitation for Client Execution (XSS)', defaultSeverity: 'MEDIUM', baseScore: 35 },
    DIRECTORY_TRAVERSAL: { code: 'T1083', name: 'File and Directory Discovery (Path Traversal)', defaultSeverity: 'HIGH', baseScore: 35 },
    COMMAND_INJECTION: { code: 'T1059', name: 'Command and Scripting Interpreter', defaultSeverity: 'CRITICAL', baseScore: 60 },
    REMOTE_CODE_EXECUTION: { code: 'T1210', name: 'Exploitation of Remote Services (RCE)', defaultSeverity: 'CRITICAL', baseScore: 75 },
    RECON_SCANNER: { code: 'T1595', name: 'Active Scanning & Vulnerability Recon', defaultSeverity: 'LOW', baseScore: 15 },
    BRUTE_FORCE: { code: 'T1110', name: 'Brute Force Credential Access', defaultSeverity: 'HIGH', baseScore: 40 },
    MALICIOUS_BOT: { code: 'T1071', name: 'Application Layer Protocol Botnet Traffic', defaultSeverity: 'MEDIUM', baseScore: 25 },
    RATE_LIMIT_EXCEEDED: { code: 'T1499', name: 'Endpoint Resource Exhaustion', defaultSeverity: 'MEDIUM', baseScore: 20 },
    RANSOMWARE_CANARY_HIT: { code: 'T1486', name: 'Data Encrypted for Impact (Canary Hit)', defaultSeverity: 'CRITICAL', baseScore: 100 },
    GEOFENCE_VIOLATION: { code: 'T1565', name: 'Geofence Policy Restricted Origin', defaultSeverity: 'LOW', baseScore: 10 },
    SUSPICIOUS_PAYLOAD: { code: 'T1027', name: 'Obfuscated / Malicious Request Body', defaultSeverity: 'MEDIUM', baseScore: 30 }
};

class WafCollector {
    constructor() {
        this.sseClients = new Set();
        this.ipScoreTracker = new Map(); // ip -> { cumulativeScore, lastSeen, history: [] }
        this.totalProcessed = 0;
        this.blockedCount = 0;
        this.allowedCount = 0;
        this.lastEventAt = null;
        this.collectorStartedAt = new Date();
        this.initialized = false;
        this.pingInterval = null;
        this.decayInterval = null;
    }

    /**
     * Initialize background workers and event bus subscribers
     */
    init() {
        if (this.initialized) return;
        this.initialized = true;

        // Periodic SSE Keep-Alive Ping (every 15 seconds)
        this.pingInterval = setInterval(() => {
            this.broadcastPing();
        }, 15000);

        // Periodic IP Score Decay (every 5 minutes)
        this.decayInterval = setInterval(() => {
            this.decayIpScores();
        }, 5 * 60 * 1000);

        // Subscribe to system event bus for internal security triggers
        eventBus.subscribe('CANARY_TRIGGERED', (data) => {
            this.ingestEvent({
                source: 'nexadisk_canary',
                sourceIp: data?.ip || '127.0.0.1',
                attackType: 'RANSOMWARE_CANARY_HIT',
                severity: 'CRITICAL',
                action: 'BLOCKED',
                path: data?.canaryPath || '/uploads/.sys_canary',
                ruleId: 'CANARY-HONEYPOT-01',
                ruleMessage: `Ransomware Canary tripwire modified: ${data?.canaryPath || 'System Trap'}`,
                details: data
            });
        });

        logger.info('🛡️ [WafCollector] NexaDisk Real-Time WAF Security Event Collector initialized.');
    }

    /**
     * Ingest and normalize a WAF security event from BunkerWeb, Nginx, or internal filters
     * @param {Object} rawEvent Raw event payload
     * @returns {Promise<Object>} Normalized Security Event
     */
    async ingestEvent(rawEvent = {}) {
        try {
            const normalized = this.normalize(rawEvent);

            // 1. Calculate / Update Cumulative Threat Score for Source IP
            const scoreMeta = this.calculateThreatScore(normalized);
            normalized.threatScore = scoreMeta.score;

            // 2. Persist to PostgreSQL Database
            await this.persistToDb(normalized);

            // 3. Update in-memory telemetry stats
            this.totalProcessed++;
            if (normalized.action === 'BLOCKED') {
                this.blockedCount++;
            } else {
                this.allowedCount++;
            }
            this.lastEventAt = new Date().toISOString();

            // 4. Publish to Internal EventBus (for alerts/notifications)
            eventBus.publish('WAF_SECURITY_EVENT', normalized);

            // 5. Broadcast to connected Live SSE Clients (Zero Polling, Real-Time Push)
            this.broadcastToSse(normalized);

            logger.info(`🛡️ [WAF Event Ingested] ${normalized.attackType} from ${normalized.sourceIp} (${normalized.country}) -> ${normalized.action} [Score: ${normalized.threatScore}]`);
            return normalized;
        } catch (err) {
            logger.error(`[WafCollector] Failed to ingest WAF event: ${err.message}`, err);
            return null;
        }
    }

    /**
     * Normalize raw event into strict NexaDisk security event schema
     */
    normalize(raw) {
        const id = raw.id || crypto.randomUUID();
        const timestamp = raw.timestamp ? new Date(raw.timestamp).toISOString() : new Date().toISOString();
        const source = raw.source || 'bunkerweb'; // 'bunkerweb' | 'express_waf' | 'simulator'
        const isSimulated = source === 'simulator' || Boolean(raw.isSimulated);

        // Sanitize source IP
        let sourceIp = (raw.sourceIp || raw.ip || raw.client_ip || raw.remote_addr || '127.0.0.1').replace(/^::ffff:/, '').trim();
        const sourcePort = parseInt(raw.sourcePort || raw.port || 0, 10) || null;
        const destination = raw.destination || raw.host || 'nexadisk';
        const method = (raw.method || raw.http_method || 'GET').toUpperCase();
        
        // Sanitize path (strip null bytes and control chars)
        let rawPath = raw.path || raw.url || raw.uri || raw.request_uri || '/';
        const path = String(rawPath).replace(/[\x00-\x1f\x7f]/g, '').slice(0, 500);
        
        const userAgent = raw.userAgent || raw.user_agent || raw.http_user_agent || 'Unknown';

        // Categorize attack type
        const attackType = this.categorizeAttackType(raw.attackType || raw.type || raw.rule_category || raw.rule_tag);
        const mitreInfo = MITRE_MAPPINGS[attackType] || { code: 'T1190', name: 'Exploit Public-Facing Application', defaultSeverity: 'MEDIUM', baseScore: 30 };

        const severity = (raw.severity || mitreInfo.defaultSeverity || 'MEDIUM').toUpperCase();
        const action = (raw.action || (severity === 'CRITICAL' || severity === 'HIGH' ? 'BLOCKED' : 'ALLOWED')).toUpperCase();
        const statusCode = parseInt(raw.statusCode || raw.status || (action === 'BLOCKED' ? 403 : 200), 10);

        // GeoIP Enrichment via geoService
        const geo = geoService.resolveIp(sourceIp);
        const country = raw.country || geo.country || 'XX';
        const countryName = raw.countryName || geo.countryName || 'Global Network';
        const city = raw.city || geo.city || 'Unknown';
        const latitude = raw.latitude != null ? Number(raw.latitude) : (geo.lat || 0.0);
        const longitude = raw.longitude != null ? Number(raw.longitude) : (geo.lng || 0.0);

        const ruleId = raw.ruleId || raw.rule_id || raw.id_rule || 'WAF-GENERIC-01';
        const ruleMessage = raw.ruleMessage || raw.rule_message || raw.msg || `${mitreInfo.name} detected on ${path}`;

        // Sanitize details payload (remove passwords, tokens, sensitive authorization headers)
        const details = { ...(raw.details || raw.metadata || {}) };
        if (details.password) details.password = '***REDACTED***';
        if (details.token) details.token = '***REDACTED***';
        if (details.authorization) details.authorization = '***REDACTED***';
        if (details.cookie) details.cookie = '***REDACTED***';

        return {
            id,
            timestamp,
            source,
            isSimulated,
            sourceIp,
            sourcePort,
            destination,
            method,
            path,
            userAgent: userAgent.slice(0, 255),
            attackType,
            severity,
            threatScore: 0, // Computed in next step
            action,
            statusCode,
            country,
            countryName,
            city,
            latitude,
            longitude,
            mitreTechnique: mitreInfo.code,
            mitreName: mitreInfo.name,
            ruleId,
            ruleMessage: String(ruleMessage).slice(0, 500),
            details
        };
    }

    /**
     * Categorize free-form text or rule strings into standardized attack types
     */
    categorizeAttackType(typeStr) {
        if (!typeStr) return 'SUSPICIOUS_PAYLOAD';
        const lower = String(typeStr).toLowerCase();

        if (lower.includes('sqli') || lower.includes('sql') || lower.includes('injection') && lower.includes('database')) return 'SQL_INJECTION';
        if (lower.includes('xss') || lower.includes('script') || lower.includes('cross-site')) return 'XSS';
        if (lower.includes('traversal') || lower.includes('lfi') || lower.includes('path') || lower.includes('passwd')) return 'DIRECTORY_TRAVERSAL';
        if (lower.includes('rce') || lower.includes('remote code') || lower.includes('eval') || lower.includes('jndi')) return 'REMOTE_CODE_EXECUTION';
        if (lower.includes('cmd') || lower.includes('command') || lower.includes('shell') || lower.includes('powershell')) return 'COMMAND_INJECTION';
        if (lower.includes('scan') || lower.includes('recon') || lower.includes('nikto') || lower.includes('nmap') || lower.includes('crawler')) return 'RECON_SCANNER';
        if (lower.includes('brute') || lower.includes('credential') || lower.includes('login')) return 'BRUTE_FORCE';
        if (lower.includes('bot') || lower.includes('bad-bot') || lower.includes('scraper')) return 'MALICIOUS_BOT';
        if (lower.includes('rate') || lower.includes('flood') || lower.includes('limit') || lower.includes('dos')) return 'RATE_LIMIT_EXCEEDED';
        if (lower.includes('canary') || lower.includes('ransom')) return 'RANSOMWARE_CANARY_HIT';
        if (lower.includes('geofence') || lower.includes('country')) return 'GEOFENCE_VIOLATION';

        return 'SUSPICIOUS_PAYLOAD';
    }

    /**
     * Compute cumulative score for an IP over time with exponential decay
     */
    calculateThreatScore(event) {
        const ip = event.sourceIp;
        const mitre = MITRE_MAPPINGS[event.attackType] || { baseScore: 25 };
        let baseIncrement = mitre.baseScore;

        if (event.severity === 'CRITICAL') baseIncrement = Math.max(baseIncrement, 60);
        else if (event.severity === 'HIGH') baseIncrement = Math.max(baseIncrement, 40);
        else if (event.severity === 'MEDIUM') baseIncrement = Math.max(baseIncrement, 25);
        else if (event.severity === 'LOW') baseIncrement = Math.max(baseIncrement, 10);

        if (geoService.isPrivateIp(ip)) {
            return { score: baseIncrement, level: 'LOW' };
        }

        const now = Date.now();
        const current = this.ipScoreTracker.get(ip) || { cumulativeScore: 0, lastSeen: now, history: [] };
        
        // Add new score capped at 100
        const updatedScore = Math.min(100, current.cumulativeScore + baseIncrement);
        current.cumulativeScore = updatedScore;
        current.lastSeen = now;
        current.history.push({ time: now, type: event.attackType, inc: baseIncrement });

        if (current.history.length > 20) current.history.shift();
        this.ipScoreTracker.set(ip, current);

        let level = 'LOW';
        if (updatedScore >= 80) level = 'CRITICAL';
        else if (updatedScore >= 50) level = 'HIGH';
        else if (updatedScore >= 25) level = 'MEDIUM';

        return { score: updatedScore, level };
    }

    /**
     * Decay IP threat scores over time to prevent permanent high scores on intermittent events
     */
    decayIpScores() {
        const now = Date.now();
        const decayWindowMs = 15 * 60 * 1000; // 15 minutes

        for (const [ip, entry] of this.ipScoreTracker.entries()) {
            const age = now - entry.lastSeen;
            if (age > decayWindowMs * 4) {
                // Remove inactive IP after 1 hour
                this.ipScoreTracker.delete(ip);
            } else if (age > decayWindowMs) {
                // Decay score by 20%
                entry.cumulativeScore = Math.max(0, Math.floor(entry.cumulativeScore * 0.8));
            }
        }
    }

    /**
     * Persist normalized event to PostgreSQL database
     */
    async persistToDb(event) {
        try {
            await db.query(`
                INSERT INTO security_events (
                    id, event_type, source, source_ip, source_port, destination,
                    method, path, user_agent, attack_type, severity, threat_score,
                    action, status_code, country, city, latitude, longitude,
                    mitre_technique, rule_id, rule_message, details, created_at
                ) VALUES (
                    $1, $2, $3, $4, $5, $6,
                    $7, $8, $9, $10, $11, $12,
                    $13, $14, $15, $16, $17, $18,
                    $19, $20, $21, $22, $23
                )
            `, [
                event.id,
                event.attackType,
                event.source,
                event.sourceIp,
                event.sourcePort,
                event.destination,
                event.method,
                event.path,
                event.userAgent,
                event.attackType,
                event.severity,
                event.threatScore,
                event.action,
                event.statusCode,
                event.country,
                event.city,
                event.latitude,
                event.longitude,
                event.mitreTechnique,
                event.ruleId,
                event.ruleMessage,
                JSON.stringify(event.details),
                event.timestamp
            ]);
        } catch (err) {
            logger.error(`[WafCollector] Database persistence failed for event ${event.id}: ${err.message}`);
        }
    }

    /**
     * Register a new Server-Sent Events (SSE) live connection
     */
    addSseClient(req, res) {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no' // Disable Nginx proxy buffering for instant stream delivery
        });

        // Send initial connection establishment frame
        res.write(`event: init\ndata: ${JSON.stringify({
            message: 'Connected to NexaDisk Live WAF Security Telemetry Stream',
            status: this.getHealthStatus().status,
            activeThreatsCount: this.totalProcessed,
            connectedAt: new Date().toISOString()
        })}\n\n`);

        this.sseClients.add(res);
        logger.info(`📡 [WafCollector SSE] Client connected. Total active live listeners: ${this.sseClients.size}`);

        req.on('close', () => {
            this.sseClients.delete(res);
            logger.info(`📡 [WafCollector SSE] Client disconnected. Total active live listeners: ${this.sseClients.size}`);
        });
    }

    /**
     * Broadcast keepalive ping to prevent client timeout
     */
    broadcastPing() {
        if (this.sseClients.size === 0) return;
        const pingPayload = `: ping ${Date.now()}\n\n`;
        for (const client of this.sseClients) {
            try {
                client.write(pingPayload);
            } catch (_) {
                this.sseClients.delete(client);
            }
        }
    }

    /**
     * Push a normalized event immediately to all active SSE browser connections
     */
    broadcastToSse(event) {
        if (this.sseClients.size === 0) return;
        const sseFrame = `event: waf_event\ndata: ${JSON.stringify(event)}\n\n`;

        for (const client of this.sseClients) {
            try {
                client.write(sseFrame);
            } catch (err) {
                this.sseClients.delete(client);
            }
        }
    }

    /**
     * Calculate WAF Collector Health Status
     * Distinguishes: ONLINE, DEGRADED (no telemetry for > 120s), and OFFLINE
     */
    getHealthStatus() {
        const now = Date.now();
        let status = 'ONLINE';

        if (!this.initialized) {
            status = 'OFFLINE';
        } else if (this.lastEventAt) {
            const silenceSeconds = Math.floor((now - new Date(this.lastEventAt).getTime()) / 1000);
            // If more than 3 minutes since last telemetry was ingested, label DEGRADED
            if (silenceSeconds > 180) {
                status = 'DEGRADED';
            }
        }

        return {
            status,
            totalProcessed: this.totalProcessed,
            blockedCount: this.blockedCount,
            allowedCount: this.allowedCount,
            lastEventAt: this.lastEventAt,
            uptimeSeconds: Math.floor((now - this.collectorStartedAt.getTime()) / 1000),
            activeSseListeners: this.sseClients.size
        };
    }
}

const wafCollector = new WafCollector();
module.exports = wafCollector;
