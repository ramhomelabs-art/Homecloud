const crypto = require('crypto');
const logger = require('../utils/logger');
const db = require('../config/database');

// Anomaly detection thresholds
const ANOMALY = {
    MAX_REQ_PER_MIN_PER_IP: 50,   // >50 req/min from one IP = suspicious
    MAX_401_RATE_PCT: 30,          // >30% 401s from one IP = brute-force attempt
    MAX_REQ_PER_MIN_PER_ENDPOINT: 100, // >100 req/min to same endpoint = scraping/scan
    SNAPSHOT_INTERVAL_MS: 60 * 60 * 1000 // Persist traffic snapshot every 1 hour
};

class TrafficService {
    constructor() {
        this.maxBuffer = 100;
        this.recentRequests = []; // Circular buffer of last 100 requests
        this.activeSessions = new Map(); // sessionId / token -> { user, ip, userAgent, device, lastActive, currentAction }
        this.totalRequests = 0;
        this.bytesIn = 0;
        this.bytesOut = 0;
        this.statusCounts = {
            '2xx': 0,
            '3xx': 0,
            '4xx': 0,
            '5xx': 0
        };
        this.historyTimeline = []; // Per-second / minute bandwidth history

        // Per-IP sliding window for anomaly detection (last 60 seconds)
        this.ipWindows = new Map(); // ip -> [{ timestamp, statusCode, path }]
        this.alertedIps = new Set(); // IPs already alerted this window — avoid spam

        // Start snapshot scheduler
        this._startSnapshotScheduler();
    }

    /**
     * Parse User-Agent string into human-friendly Device / Browser / OS
     */
    parseUserAgent(ua = '') {
        let os = 'Unknown OS';
        let browser = 'Unknown Browser';
        let type = 'Desktop';

        if (/windows/i.test(ua)) os = 'Windows';
        else if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
        else if (/android/i.test(ua)) { os = 'Android'; type = 'Mobile'; }
        else if (/iphone|ipad|ipod/i.test(ua)) { os = 'iOS'; type = 'Mobile'; }
        else if (/linux/i.test(ua)) os = 'Linux';
        else if (/curl|python|postman|insomnia|axios/i.test(ua)) { os = 'Script / API'; type = 'Bot / API'; }

        if (/edg/i.test(ua)) browser = 'Edge';
        else if (/chrome|crios/i.test(ua)) browser = 'Chrome';
        else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
        else if (/safari/i.test(ua)) browser = 'Safari';
        else if (/opera|opr/i.test(ua)) browser = 'Opera';
        else if (/curl/i.test(ua)) browser = 'cURL';
        else if (/python/i.test(ua)) browser = 'Python Script';

        return { os, browser, type, raw: ua };
    }

    /**
     * Record an inbound HTTP request
     */
    recordRequest(req, res, durationMs) {
        const path = req.originalUrl || req.url;
        
        // Filter out high-frequency internal UI polling heartbeats to keep the traffic feed clean
        if (
            path.startsWith('/api/v1/traffic/') ||
            path.startsWith('/api/v1/agents/metrics') ||
            path.startsWith('/api/v1/auth/verify') ||
            path.startsWith('/api/v1/auth/settings') ||
            path.startsWith('/api/v1/social/') ||
            path.startsWith('/api/v1/trash') ||
            path.startsWith('/api/v1/shares/list') ||
            path.startsWith('/api/v1/network/list') ||
            path.startsWith('/api/v1/storage/local') ||
            path.startsWith('/api/v1/files/activities') ||
            path.startsWith('/api/v1/auth/users')
        ) {
            return;
        }

        this.totalRequests++;
        const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || req.ip || '127.0.0.1';
        const cleanIp = ip === '::1' || ip === '::ffff:127.0.0.1' ? '127.0.0.1' : ip;
        const userAgent = req.headers['user-agent'] || 'Unknown';
        const parsedUa = this.parseUserAgent(userAgent);
        const method = req.method;
        const statusCode = res.statusCode || 200;
        const sizeIn = parseInt(req.headers['content-length'] || 0, 10);
        const sizeOut = parseInt(res.getHeader('content-length') || 0, 10);

        this.bytesIn += sizeIn;
        this.bytesOut += sizeOut;

        const category = `${Math.floor(statusCode / 100)}xx`;
        if (this.statusCounts[category] !== undefined) {
            this.statusCounts[category]++;
        }

        let username = req.user?.username || (req.guestToken ? `Guest (${req.guestToken.slice(0, 6)})` : 'Anonymous');
        let role = req.user?.role || (req.guestToken ? 'Guest' : 'Visitor');

        if (path.startsWith('/api/v1/agents/register')) {
            const agentHost = req.body?.hostname || req.body?.id || 'Dev-01';
            username = `Fleet Agent (${agentHost})`;
            role = 'Agent';
            parsedUa.browser = 'NexaDisk Agent Daemon';
            parsedUa.os = 'Cluster Node';
            parsedUa.type = 'Storage Agent';
        }

        const requestRecord = {
            id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            timestamp: new Date().toISOString(),
            method,
            path,
            statusCode,
            durationMs,
            sizeIn,
            sizeOut,
            ip: cleanIp,
            username,
            client: parsedUa
        };

        this.recentRequests.unshift(requestRecord);
        if (this.recentRequests.length > this.maxBuffer) {
            this.recentRequests.pop();
        }

        // Update active session tracking
        const sessionKey = req.headers['authorization'] || (role === 'Agent' ? `agent_${username}` : cleanIp);
        this.activeSessions.set(sessionKey, {
            id: sessionKey.slice(0, 16),
            username,
            ip: cleanIp,
            client: parsedUa,
            lastActive: new Date().toISOString(),
            currentAction: `${method} ${path}`,
            role
        });

        // Prune old sessions (> 15 minutes inactive)
        const now = Date.now();
        for (const [k, session] of this.activeSessions.entries()) {
            if (now - new Date(session.lastActive).getTime() > 15 * 60 * 1000) {
                this.activeSessions.delete(k);
            }
        }

        // 🔍 Run anomaly detection (skip internal/private IPs)
        if (cleanIp !== '127.0.0.1' && !cleanIp.startsWith('192.168.') && !cleanIp.startsWith('10.')) {
            this._checkAnomalies(cleanIp, statusCode, path);
        }
    }

    /**
     * 🔍 Behavioral Anomaly Detection Engine
     * Runs per request — lightweight sliding-window analysis over the last 60 seconds
     */
    _checkAnomalies(ip, statusCode, path) {
        const now = Date.now();
        const windowMs = 60 * 1000; // 1-minute window

        // Initialize per-IP window
        if (!this.ipWindows.has(ip)) {
            this.ipWindows.set(ip, []);
        }
        const window = this.ipWindows.get(ip);
        window.push({ timestamp: now, statusCode, path });

        // Evict entries older than 1 minute
        const fresh = window.filter(e => now - e.timestamp < windowMs);
        this.ipWindows.set(ip, fresh);

        // --- Rule 1: High request rate per IP (>50 req/min) ---
        if (fresh.length > ANOMALY.MAX_REQ_PER_MIN_PER_IP && !this.alertedIps.has(`rate_${ip}`)) {
            this.alertedIps.add(`rate_${ip}`);
            setTimeout(() => this.alertedIps.delete(`rate_${ip}`), windowMs);
            this._fireAnomalyAlert('high_request_rate', ip, {
                count: fresh.length,
                threshold: ANOMALY.MAX_REQ_PER_MIN_PER_IP,
                rule: 'High Request Rate — Possible DoS / Scraping'
            });
        }

        // --- Rule 2: High 401 rate (>30% of req/min = brute-force) ---
        const errors401 = fresh.filter(e => e.statusCode === 401).length;
        const errorRate = fresh.length > 5 ? Math.round((errors401 / fresh.length) * 100) : 0;
        if (errorRate > ANOMALY.MAX_401_RATE_PCT && !this.alertedIps.has(`auth_${ip}`)) {
            this.alertedIps.add(`auth_${ip}`);
            setTimeout(() => this.alertedIps.delete(`auth_${ip}`), windowMs);
            this._fireAnomalyAlert('brute_force_attempt', ip, {
                authFailureRate: `${errorRate}%`,
                failedAttempts: errors401,
                totalRequests: fresh.length,
                rule: 'Credential Brute-Force Detected — High 401 Rate'
            });
        }

        // --- Rule 3: Single-endpoint hammering (>100 req/min to same path) ---
        const pathCounts = {};
        for (const e of fresh) {
            const stripped = e.path.split('?')[0]; // ignore query params
            pathCounts[stripped] = (pathCounts[stripped] || 0) + 1;
        }
        for (const [p, count] of Object.entries(pathCounts)) {
            const alertKey = `endpoint_${ip}_${p}`;
            if (count > ANOMALY.MAX_REQ_PER_MIN_PER_ENDPOINT && !this.alertedIps.has(alertKey)) {
                this.alertedIps.add(alertKey);
                setTimeout(() => this.alertedIps.delete(alertKey), windowMs);
                this._fireAnomalyAlert('endpoint_scan', ip, {
                    endpoint: p,
                    count,
                    threshold: ANOMALY.MAX_REQ_PER_MIN_PER_ENDPOINT,
                    rule: 'Endpoint Hammering — Possible API Scan / Enumeration'
                });
            }
        }
    }

    /**
     * Fire an anomaly alert via notificationService (lazy loaded)
     */
    async _fireAnomalyAlert(eventKey, ip, details) {
        logger.warn(`[TrafficService IDS] Anomaly detected from ${ip}: ${details.rule}`);
        try {
            const ns = require('./notificationService');
            const title = `🔴 Network Anomaly: ${details.rule}`;
            const body = [
                `Source IP: ${ip}`,
                ...Object.entries(details)
                    .filter(([k]) => k !== 'rule')
                    .map(([k, v]) => `${k}: ${v}`)
            ].join('\n');
            await ns.dispatchAlert(eventKey, title, body, 'error');
        } catch (e) {
            logger.error(`[TrafficService IDS] Failed to dispatch anomaly alert: ${e.message}`);
        }
    }

    /**
     * Persist an hourly traffic snapshot to the database for forensics
     */
    async _persistSnapshot() {
        try {
            const snapshot = {
                total_requests: this.totalRequests,
                bytes_in: this.bytesIn,
                bytes_out: this.bytesOut,
                status_counts: this.statusCounts,
                top_ips: this.getTopIps(),
                active_sessions: this.activeSessions.size,
                captured_at: new Date().toISOString()
            };
            await db.query(
                `INSERT INTO app_settings (key, value) VALUES ($1, $2)
                 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
                [`traffic_snapshot_${Date.now()}`, JSON.stringify(snapshot)]
            );
            logger.info('[TrafficService] Hourly traffic snapshot persisted to DB.');
        } catch (e) {
            logger.error(`[TrafficService] Snapshot persistence failed: ${e.message}`);
        }
    }

    _startSnapshotScheduler() {
        setInterval(() => {
            this._persistSnapshot();
        }, ANOMALY.SNAPSHOT_INTERVAL_MS);
    }

    /**
     * Get live telemetry payload
     */
    getLiveTelemetry() {
        const errorRequests = (this.statusCounts['4xx'] || 0) + (this.statusCounts['5xx'] || 0);
        const errorRate = this.totalRequests > 0 ? ((errorRequests / this.totalRequests) * 100).toFixed(1) : '0.0';

        return {
            totalRequests: this.totalRequests,
            bytesIn: this.bytesIn,
            bytesOut: this.bytesOut,
            errorRate: parseFloat(errorRate),
            statusCounts: this.statusCounts,
            activeSessionCount: this.activeSessions.size,
            recentRequests: this.recentRequests.slice(0, 50),
            topIps: this.getTopIps()
        };
    }

    /**
     * Get list of currently active sessions
     */
    getActiveSessions() {
        return Array.from(this.activeSessions.values());
    }

    /**
     * Terminate an active session
     */
    killSession(sessionId) {
        for (const [key, session] of this.activeSessions.entries()) {
            if (session.id === sessionId || key.includes(sessionId)) {
                this.activeSessions.delete(key);
                logger.info(`[TrafficService] Session terminated for ${session.username} (${session.ip})`);
                return true;
            }
        }
        return false;
    }

    /**
     * Calculate Top Client IPs
     */
    getTopIps() {
        const ipCounts = {};
        for (const req of this.recentRequests) {
            ipCounts[req.ip] = (ipCounts[req.ip] || 0) + 1;
        }
        return Object.entries(ipCounts)
            .map(([ip, count]) => ({ ip, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
    }
}

module.exports = new TrafficService();


