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

        this.endpointStats = new Map(); // endpointPath -> { path, count, methods, statusCounts, totalDurationMs, minDurationMs, maxDurationMs, bytesIn, bytesOut, lastAccessed, clientIps }
        this.timeSeries = []; // rolling 24 points { time, requests, bytesIn, bytesOut, errors, avgDuration }
        this._initTimeSeries();

        // Start snapshot scheduler
        this._startSnapshotScheduler();
    }

    _initTimeSeries() {
        const now = Date.now();
        for (let i = 24; i >= 0; i--) {
            const d = new Date(now - i * 5000);
            const timeLabel = d.toTimeString().split(' ')[0];
            this.timeSeries.push({
                time: timeLabel,
                requests: 0,
                bytesIn: 0,
                bytesOut: 0,
                errors: 0,
                avgDuration: 0
            });
        }
    }

    /**
     * Record time series sample
     */
    _recordTimeSeriesSample(durationMs, statusCode, sizeIn, sizeOut) {
        const now = new Date();
        const timeLabel = now.toTimeString().split(' ')[0];
        const isError = statusCode >= 400;

        let currentBucket = this.timeSeries[this.timeSeries.length - 1];
        if (!currentBucket || currentBucket.time !== timeLabel) {
            currentBucket = {
                time: timeLabel,
                requests: 0,
                bytesIn: 0,
                bytesOut: 0,
                errors: 0,
                avgDuration: 0,
                _durations: []
            };
            this.timeSeries.push(currentBucket);
            if (this.timeSeries.length > 30) {
                this.timeSeries.shift();
            }
        }

        currentBucket.requests++;
        currentBucket.bytesIn += sizeIn;
        currentBucket.bytesOut += sizeOut;
        if (isError) currentBucket.errors++;
        if (!currentBucket._durations) currentBucket._durations = [];
        currentBucket._durations.push(durationMs);
        currentBucket.avgDuration = Math.round(
            currentBucket._durations.reduce((a, b) => a + b, 0) / currentBucket._durations.length
        );
    }

    /**
     * Parse User-Agent string into human-friendly Device / Browser / OS
     */
    parseUserAgent(ua = '') {
        let os = 'Windows';
        let browser = 'Chrome';
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
    recordRequest(req, res, durationMs = 0) {
        const path = req.originalUrl || req.url;
        
        // Filter out high-frequency internal UI polling heartbeats to keep the traffic feed clean
        if (
            path.startsWith('/api/v1/traffic/live') ||
            path.startsWith('/api/v1/traffic/sessions') ||
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

        // Record time series sample
        this._recordTimeSeriesSample(durationMs, statusCode, sizeIn, sizeOut);

        // Update Endpoint Analytics
        const cleanPath = path.split('?')[0];
        if (!this.endpointStats.has(cleanPath)) {
            this.endpointStats.set(cleanPath, {
                path: cleanPath,
                count: 0,
                methods: {},
                statusCounts: { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 },
                totalDurationMs: 0,
                minDurationMs: Infinity,
                maxDurationMs: 0,
                bytesIn: 0,
                bytesOut: 0,
                lastAccessed: new Date().toISOString(),
                clientIps: new Set()
            });
        }
        const epStat = this.endpointStats.get(cleanPath);
        epStat.count++;
        epStat.methods[method] = (epStat.methods[method] || 0) + 1;
        if (epStat.statusCounts[category] !== undefined) {
            epStat.statusCounts[category]++;
        }
        epStat.totalDurationMs += durationMs;
        if (durationMs < epStat.minDurationMs) epStat.minDurationMs = durationMs;
        if (durationMs > epStat.maxDurationMs) epStat.maxDurationMs = durationMs;
        epStat.bytesIn += sizeIn;
        epStat.bytesOut += sizeOut;
        epStat.lastAccessed = new Date().toISOString();
        epStat.clientIps.add(cleanIp);

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
     */
    _checkAnomalies(ip, statusCode, path) {
        const now = Date.now();
        const windowMs = 60 * 1000;

        if (!this.ipWindows.has(ip)) {
            this.ipWindows.set(ip, []);
        }
        const window = this.ipWindows.get(ip);
        window.push({ timestamp: now, statusCode, path });

        const fresh = window.filter(e => now - e.timestamp < windowMs);
        this.ipWindows.set(ip, fresh);

        if (fresh.length > ANOMALY.MAX_REQ_PER_MIN_PER_IP && !this.alertedIps.has(`rate_${ip}`)) {
            this.alertedIps.add(`rate_${ip}`);
            setTimeout(() => this.alertedIps.delete(`rate_${ip}`), windowMs);
            this._fireAnomalyAlert('high_request_rate', ip, {
                count: fresh.length,
                threshold: ANOMALY.MAX_REQ_PER_MIN_PER_IP,
                rule: 'High Request Rate — Possible DoS / Scraping'
            });
        }

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

        const pathCounts = {};
        for (const e of fresh) {
            const stripped = e.path.split('?')[0];
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

    async _persistSnapshot() {
        try {
            const snapshot = {
                total_requests: this.totalRequests,
                bytes_in: this.bytesIn,
                bytes_out: this.bytesOut,
                status_counts: this.statusCounts,
                top_ips: this.getTopIps(),
                top_endpoints: this.getTopEndpoints(10),
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
     * Calculate Top API Endpoints accessed
     */
    getTopEndpoints(limit = 10) {
        const total = this.totalRequests || 1;
        const list = Array.from(this.endpointStats.values()).map(ep => {
            const avgDuration = ep.count > 0 ? Math.round(ep.totalDurationMs / ep.count) : 0;
            const errorCount = (ep.statusCounts['4xx'] || 0) + (ep.statusCounts['5xx'] || 0);
            const errorRate = ep.count > 0 ? parseFloat(((errorCount / ep.count) * 100).toFixed(1)) : 0;
            const percentage = parseFloat(((ep.count / total) * 100).toFixed(1));
            const primaryMethod = Object.entries(ep.methods).sort((a, b) => b[1] - a[1])[0]?.[0] || 'GET';

            return {
                path: ep.path,
                count: ep.count,
                percentage,
                methods: ep.methods,
                primaryMethod,
                avgDuration,
                minDuration: ep.minDurationMs === Infinity ? 0 : ep.minDurationMs,
                maxDuration: ep.maxDurationMs,
                statusCounts: ep.statusCounts,
                errorRate,
                bytesIn: ep.bytesIn,
                bytesOut: ep.bytesOut,
                lastAccessed: ep.lastAccessed,
                uniqueClients: ep.clientIps.size
            };
        });

        return list.sort((a, b) => b.count - a.count).slice(0, limit);
    }

    /**
     * Get HTTP method distribution
     */
    getMethodDistribution() {
        const methods = { GET: 0, POST: 0, PUT: 0, DELETE: 0, PATCH: 0, OTHER: 0 };
        for (const ep of this.endpointStats.values()) {
            for (const [m, count] of Object.entries(ep.methods)) {
                if (methods[m] !== undefined) methods[m] += count;
                else methods.OTHER += count;
            }
        }
        return methods;
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
            recentRequests: this.recentRequests.slice(0, 80),
            topIps: this.getTopIps(),
            topEndpoints: this.getTopEndpoints(12),
            methodDistribution: this.getMethodDistribution(),
            timeSeries: this.timeSeries
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
     * Clear recent requests stream buffer
     */
    clearBuffer() {
        this.recentRequests = [];
        return true;
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
            .slice(0, 6);
    }
}

module.exports = new TrafficService();


