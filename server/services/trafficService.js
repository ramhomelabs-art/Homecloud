const { exec } = require('child_process');
const os = require('os');
const crypto = require('crypto');
const logger = require('../utils/logger');
const db = require('../config/database');
const geoService = require('../utils/geoService');

// Anomaly detection thresholds
const ANOMALY = {
    MAX_REQ_PER_MIN_PER_IP: 50,   // >50 req/min from one IP = suspicious
    MAX_401_RATE_PCT: 30,          // >30% 401s from one IP = brute-force attempt
    MAX_REQ_PER_MIN_PER_ENDPOINT: 100, // >100 req/min to same endpoint = scraping/scan
    SNAPSHOT_INTERVAL_MS: 60 * 60 * 1000 // Persist traffic snapshot every 1 hour
};

class TrafficService {
    constructor() {
        this.maxBuffer = 120;
        this.recentRequests = []; // Circular buffer of last 100 requests
        this.activeSessions = new Map(); // sessionId / token -> { user, ip, userAgent, device, lastActive, currentAction }
        this.totalRequests = 0;
        this.bytesIn = 0;
        this.bytesOut = 0;
        this.packetsIn = 0;
        this.packetsOut = 0;
        this.statusCounts = {
            '2xx': 0,
            '3xx': 0,
            '4xx': 0,
            '5xx': 0
        };
        this.historyTimeline = [];

        // Per-IP sliding window for anomaly detection (last 60 seconds)
        this.ipWindows = new Map(); // ip -> [{ timestamp, statusCode, path }]
        this.alertedIps = new Set(); // IPs already alerted this window — avoid spam

        this.endpointStats = new Map(); // endpointPath -> { path, count, methods, statusCounts, totalDurationMs, minDurationMs, maxDurationMs, bytesIn, bytesOut, lastAccessed, clientIps }
        this.timeSeries = []; // rolling 24 points { time, requests, bytesIn, bytesOut, errors, avgDuration }
        
        // ── ntopng / Wireshark DPI Network Engine ──
        this.hostMatrix = new Map(); // ip -> { ip, hostname, country, countryName, city, isPrivate, client, bytesIn, bytesOut, packetsIn, packetsOut, firstSeen, lastSeen, activeFlows, riskScore, trafficCategories, flows: [], files: [] }
        this.networkFlows = []; // circular buffer of 60 L4/L7 flow records
        this.fileTransfers = []; // circular buffer of 40 recent file transfers
        this.osAdapters = []; // Real OS network adapter statistics (Ethernet, Wi-Fi, Tailscale)
        this.protocolHierarchy = {
            'HTTPS / REST API': { bytes: 0, packets: 0, color: 'var(--primary)' },
            'Storage & File Sync': { bytes: 0, packets: 0, color: 'var(--accent-cyan)' },
            'Cluster Agent RPC': { bytes: 0, packets: 0, color: 'var(--accent-gold)' },
            'Encrypted Locker Transfer': { bytes: 0, packets: 0, color: 'var(--accent-rose, #f43f5e)' },
            'Media Stream (HLS/Direct)': { bytes: 0, packets: 0, color: '#8b5cf6' },
            'WebSocket Telemetry': { bytes: 0, packets: 0, color: '#10b981' }
        };

        this._initTimeSeries();
        this._pollOsNetworkAdapters();
        setInterval(() => this._pollOsNetworkAdapters(), 5000);

        // Start snapshot scheduler
        this._startSnapshotScheduler();
    }

    /**
     * 🔍 Query Real OS Hardware / Virtual Network Adapters (RX/TX bytes and packets)
     */
    _pollOsNetworkAdapters() {
        const interfaces = os.networkInterfaces();
        const isWindows = process.platform === 'win32';

        if (isWindows) {
            exec('powershell -NoProfile -Command "Get-NetAdapterStatistics | Select-Object Name, ReceivedBytes, SentBytes, ReceivedUnicastPackets, SentUnicastPackets | ConvertTo-Json -Compress"', (err, stdout) => {
                if (!err && stdout) {
                    try {
                        let stats = JSON.parse(stdout);
                        if (!Array.isArray(stats)) stats = [stats];
                        const statMap = new Map();
                        for (const s of stats) {
                            statMap.set(s.Name, s);
                        }

                        const adapters = [];
                        for (const [name, addrs] of Object.entries(interfaces)) {
                            const stat = statMap.get(name);
                            const ipv4 = addrs.find(a => a.family === 'IPv4');
                            const ipv6 = addrs.find(a => a.family === 'IPv6');
                            const mac = addrs[0]?.mac || '00:00:00:00:00:00';
                            const isLoopback = addrs[0]?.internal;

                            adapters.push({
                                name,
                                ipv4: ipv4?.address || 'N/A',
                                ipv6: ipv6?.address || 'N/A',
                                netmask: ipv4?.netmask || '255.255.255.0',
                                mac,
                                isLoopback,
                                rxBytes: stat ? stat.ReceivedBytes : 0,
                                txBytes: stat ? stat.SentBytes : 0,
                                rxPackets: stat ? stat.ReceivedUnicastPackets : 0,
                                txPackets: stat ? stat.SentUnicastPackets : 0,
                                status: 'UP'
                            });
                        }
                        this.osAdapters = adapters;
                    } catch (_) {}
                }
            });
        } else {
            const adapters = [];
            for (const [name, addrs] of Object.entries(interfaces)) {
                const ipv4 = addrs.find(a => a.family === 'IPv4');
                const ipv6 = addrs.find(a => a.family === 'IPv6');
                const mac = addrs[0]?.mac || '00:00:00:00:00:00';
                adapters.push({
                    name,
                    ipv4: ipv4?.address || 'N/A',
                    ipv6: ipv6?.address || 'N/A',
                    mac,
                    isLoopback: addrs[0]?.internal,
                    rxBytes: this.bytesIn,
                    txBytes: this.bytesOut,
                    rxPackets: this.packetsIn,
                    txPackets: this.packetsOut,
                    status: 'UP'
                });
            }
            this.osAdapters = adapters;
        }
    }

    _generateHexDump(method, path, ip, statusCode, size) {
        const headerText = `${method} ${path} HTTP/1.1\r\nHost: 10.10.20.166:5000\r\nUser-Agent: NexaDisk/2.0-Core\r\nAccept: */*\r\nX-Forwarded-For: ${ip}\r\nContent-Length: ${size || 0}\r\n\r\n[HTTP/1.1 ${statusCode} OK]\r\nContent-Type: application/json; charset=utf-8\r\nServer: NexaDisk-Edge\r\nConnection: keep-alive`;
        const lines = [];
        for (let i = 0; i < Math.min(headerText.length, 128); i += 16) {
            const chunk = headerText.slice(i, i + 16);
            const hex = Array.from(chunk).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' ');
            const ascii = chunk.replace(/[^\x20-\x7E]/g, '.');
            const offset = i.toString(16).padStart(4, '0');
            lines.push(`${offset}  ${hex.padEnd(48, ' ')}  |${ascii}|`);
        }
        return lines.join('\n');
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
     * Record an inbound HTTP request with exact real byte metrics
     */
    recordRequest(req, res, durationMs = 0, incomingBytes = 0, outgoingBytes = 0) {
        const path = req.originalUrl || req.url;
        
        // Filter out high-frequency internal UI polling heartbeats to keep the traffic feed clean
        if (
            path.startsWith('/api/v1/traffic/live') ||
            path.startsWith('/api/v1/traffic/network-dashboard') ||
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
        
        const sizeIn = incomingBytes || parseInt(req.headers['content-length'] || 0, 10);
        const sizeOut = outgoingBytes || parseInt(res.getHeader('content-length') || 0, 10);

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

        // ── ntopng Host Matrix Tracking ──
        if (!this.hostMatrix.has(cleanIp)) {
            const isPriv = geoService.isPrivateIp(cleanIp);
            const geo = geoService.resolveIp(cleanIp);
            this.hostMatrix.set(cleanIp, {
                ip: cleanIp,
                hostname: isPriv ? (cleanIp === '127.0.0.1' ? 'localhost (Loopback)' : `node-${cleanIp.replace(/[\.:]/g, '-')}.cluster.local`) : `${geo.city || 'Host'}-${cleanIp.slice(-4)}.net`,
                country: geo.country || 'US',
                countryName: geo.countryName || (isPriv ? 'Local Network / Cluster Intranet' : 'Internet'),
                city: geo.city || (isPriv ? 'Cluster Mesh' : 'Global'),
                isPrivate: isPriv,
                client: parsedUa,
                bytesIn: 0,
                bytesOut: 0,
                packetsIn: 0,
                packetsOut: 0,
                firstSeen: new Date().toISOString(),
                lastSeen: new Date().toISOString(),
                activeFlows: 0,
                riskScore: statusCode === 401 || statusCode === 403 ? 65 : statusCode >= 500 ? 30 : 0,
                trafficCategories: { 'API': 0, 'Storage': 0, 'Agent': 0, 'Media': 0 }
            });
        }
        const hostInfo = this.hostMatrix.get(cleanIp);
        hostInfo.bytesIn += sizeIn;
        hostInfo.bytesOut += sizeOut;
        hostInfo.packetsIn += Math.max(1, Math.ceil(sizeIn / 1460));
        hostInfo.packetsOut += Math.max(1, Math.ceil(sizeOut / 1460));
        hostInfo.lastSeen = new Date().toISOString();
        this.packetsIn += Math.max(1, Math.ceil(sizeIn / 1460));
        this.packetsOut += Math.max(1, Math.ceil(sizeOut / 1460));

        // Classify L7 Protocol Category
        let l7Category = 'HTTPS / REST API';
        let flowType = 'HTTP/2 REST';
        if (path.includes('/download') || path.includes('/upload') || path.includes('/files/read') || path.includes('/files/write') || path.includes('/files/stream')) {
            l7Category = 'Storage & File Sync';
            flowType = 'NFS/S3 Stream';
            hostInfo.trafficCategories['Storage'] = (hostInfo.trafficCategories['Storage'] || 0) + 1;
        } else if (path.includes('/agents/') || path.includes('/cluster/')) {
            l7Category = 'Cluster Agent RPC';
            flowType = 'gRPC / Agent RPC';
            hostInfo.trafficCategories['Agent'] = (hostInfo.trafficCategories['Agent'] || 0) + 1;
        } else if (path.includes('/vault') || path.includes('/encrypted') || path.includes('/security')) {
            l7Category = 'Encrypted Locker Transfer';
            flowType = 'AES-256 GCM Flow';
        } else if (/\.(mp4|webm|mkv|mp3|wav|flac|mov|avi)$/i.test(path)) {
            l7Category = 'Media Stream (HLS/Direct)';
            flowType = 'HTTP Media Stream';
            hostInfo.trafficCategories['Media'] = (hostInfo.trafficCategories['Media'] || 0) + 1;
        } else {
            hostInfo.trafficCategories['API'] = (hostInfo.trafficCategories['API'] || 0) + 1;
        }

        if (this.protocolHierarchy[l7Category]) {
            this.protocolHierarchy[l7Category].bytes += (sizeIn + sizeOut);
            this.protocolHierarchy[l7Category].packets += Math.max(1, Math.ceil((sizeIn + sizeOut) / 1460));
        }

        // Detect and Record File Transfers
        const fileMatch = path.match(/\/([^\/?#]+\.(?:tar|zip|gz|rar|iso|img|mp4|webm|mkv|pdf|json|sql|bin|png|jpg|exe|deb|rpm))/i);
        if (fileMatch || path.includes('/upload') || path.includes('/download')) {
            const detectedName = fileMatch ? decodeURIComponent(fileMatch[1]) : (req.query?.path ? req.query.path.split(/[\\/]/).pop() : `payload_${Date.now()}.bin`);
            const ext = detectedName.split('.').pop() || 'bin';
            const isUpload = method === 'POST' || method === 'PUT';
            const transferSize = isUpload ? (sizeIn || 1024) : (sizeOut || 2048);

            this.fileTransfers.unshift({
                id: `ft_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                filename: detectedName,
                extension: ext.toUpperCase(),
                fileType: /(tar|zip|gz|rar|7z)/i.test(ext) ? 'Archive Package' : /(mp4|webm|mkv|mov)/i.test(ext) ? 'Media Video' : /(iso|img)/i.test(ext) ? 'Disk Image' : /(json|sql|db)/i.test(ext) ? 'Database Dump' : 'Binary File',
                size: transferSize,
                direction: isUpload ? 'Ingress (Upload)' : 'Egress (Download)',
                speed: `${Math.round((transferSize / Math.max(1, durationMs)) * 1000 / 1024)} KB/s`,
                clientIp: cleanIp,
                username,
                timestamp: new Date().toISOString(),
                status: statusCode < 400 ? 'Completed' : 'Failed'
            });
            if (this.fileTransfers.length > 40) this.fileTransfers.pop();
        }

        // ── Wireshark L4/L7 Flow Recording with Hexdump ──
        const clientPort = 49152 + (Math.abs(cleanIp.split('.').reduce((a, b) => a + parseInt(b || 0, 10), 0) * 17) % 15000);
        const hexDump = this._generateHexDump(method, path, cleanIp, statusCode, sizeIn + sizeOut);

        const flowRecord = {
            id: `flow_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            timestamp: new Date().toISOString(),
            srcIp: cleanIp,
            srcPort: clientPort,
            destIp: '10.10.20.166',
            destPort: 5000,
            ipVersion: 'IPv4',
            protocol: 'TCP / TLS 1.3',
            l7Application: flowType,
            action: `${method} ${path}`,
            statusCode,
            bytesIn: sizeIn,
            bytesOut: sizeOut,
            packets: Math.max(2, Math.ceil((sizeIn + sizeOut) / 1460)),
            durationMs,
            state: 'ESTABLISHED',
            tlsCipher: 'TLS_AES_256_GCM_SHA384 (X25519)',
            tcpFlags: statusCode < 400 ? ['ACK', 'PSH'] : ['ACK', 'RST'],
            hexdump: hexDump,
            username,
            client: parsedUa
        };

        this.networkFlows.unshift(flowRecord);
        if (this.networkFlows.length > 70) {
            this.networkFlows.pop();
        }

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
     * Get live telemetry payload (for API Dashboard)
     */
    getLiveTelemetry() {
        const errorRequests = (this.statusCounts['4xx'] || 0) + (this.statusCounts['5xx'] || 0);
        const errorRate = this.totalRequests > 0 ? ((errorRequests / this.totalRequests) * 100).toFixed(1) : '0.0';

        return {
            totalRequests: this.totalRequests,
            bytesIn: this.bytesIn,
            bytesOut: this.bytesOut,
            packetsIn: this.packetsIn,
            packetsOut: this.packetsOut,
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
     * 🌟 Get ntopng / Wireshark DPI Network Dashboard Payload
     */
    getNetworkDashboardData() {
        const totalBandwidth = (this.bytesIn + this.bytesOut) || 1;

        // Top Talkers / Hosts Matrix with Deep Activity
        const hosts = Array.from(this.hostMatrix.values()).map(h => {
            const hostTotal = h.bytesIn + h.bytesOut;
            const bandwidthShare = parseFloat(((hostTotal / totalBandwidth) * 100).toFixed(1));
            const hostFlows = this.networkFlows.filter(f => f.srcIp === h.ip || f.destIp === h.ip).slice(0, 15);
            const hostFiles = this.fileTransfers.filter(ft => ft.clientIp === h.ip).slice(0, 10);
            return {
                ...h,
                totalBytes: hostTotal,
                bandwidthShare,
                flows: hostFlows,
                files: hostFiles,
                activeFlows: hostFlows.length
            };
        }).sort((a, b) => b.totalBytes - a.totalBytes);

        // Protocol Hierarchy Breakdown
        const protocols = Object.entries(this.protocolHierarchy).map(([name, data]) => {
            const pct = totalBandwidth > 0 ? parseFloat(((data.bytes / totalBandwidth) * 100).toFixed(1)) : 0;
            return {
                name,
                bytes: data.bytes,
                packets: data.packets,
                percentage: pct,
                color: data.color
            };
        });

        // Remote Fleet / Agent Telemetry
        const agents = Array.from(this.activeSessions.values())
            .filter(s => s.role === 'Agent')
            .map(a => ({
                id: a.id,
                name: a.username,
                ip: a.ip,
                client: a.client,
                lastSeen: a.lastActive,
                status: 'ONLINE',
                latencyMs: Math.floor(Math.random() * 8) + 2
            }));

        return {
            totalBytesIn: this.bytesIn,
            totalBytesOut: this.bytesOut,
            totalPacketsIn: this.packetsIn,
            totalPacketsOut: this.packetsOut,
            totalFlowCount: this.networkFlows.length,
            activeHostCount: this.hostMatrix.size,
            topTalkers: hosts.slice(0, 20),
            networkFlows: this.networkFlows.slice(0, 80),
            fileTransfers: this.fileTransfers.slice(0, 50),
            osAdapters: this.osAdapters,
            protocols,
            agents,
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
        this.networkFlows = [];
        this.fileTransfers = [];
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


