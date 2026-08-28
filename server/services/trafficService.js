const crypto = require('crypto');
const logger = require('../utils/logger');

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
