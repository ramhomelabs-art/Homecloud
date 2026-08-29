const db = require('../config/database');
const logger = require('../utils/logger');
const geoService = require('../utils/geoService');

// In-memory cache of active bans for O(1) request-time lookup
let bannedIpsMap = new Map(); // ip -> { reason, expiresAt, country, attempts }
let geofenceConfig = { mode: 'disabled', blockedCountries: ['RU', 'KP', 'IR', 'CN'] };
let suspiciousIpScores = new Map(); // ip -> { score, lastSeen, probes: [] }

// Common Web Application Firewall (WAF) malicious probe detection patterns
const WAF_PATTERNS = [
    // Directory Traversal
    { pattern: /(\.\.[\/\\]|\.\.%2f|\.\.%5c|\/etc\/passwd|\/windows\/system32|\/proc\/self)/i, threat: 'DIRECTORY_TRAVERSAL', score: 35, mitre: 'T1083' },
    // SQL Injection Probes
    { pattern: /(union\s+select|information_schema|xp_cmdshell|benchmark\s*\(|sleep\s*\(\d+\)|waitfor\s+delay)/i, threat: 'SQL_INJECTION', score: 40, mitre: 'T1190' },
    // Remote Code Execution / Command Injection
    { pattern: /(\$\{jndi:|(cmd|powershell)\.exe|\/bin\/(sh|bash|zsh)|eval\s*\(|base64_decode\s*\(|phpinfo\s*\()/i, threat: 'COMMAND_INJECTION', score: 50, mitre: 'T1059' },
    // Malicious Scanner Reconnaissance Probes
    { pattern: /(\/\.env|\/\.git\/config|\/wp-login\.php|\/phpmyadmin|\/actuator\/health|\/swagger-ui|\/\.aws\/credentials)/i, threat: 'RECON_SCANNER', score: 30, mitre: 'T1595' }
];

/**
 * Load active bans from the database into the memory cache
 */
async function loadFirewallState() {
    try {
        const bansRes = await db.query(
            `SELECT ip, country, country_name AS "countryName", reason, attempts, expires_at AS "expiresAt"
             FROM banned_ips
             WHERE expires_at > NOW()`
        );
        const newMap = new Map();
        for (const row of bansRes.rows) {
            if (!geoService.isPrivateIp(row.ip)) {
                newMap.set(row.ip, row);
            }
        }
        bannedIpsMap = newMap;

        const geoRes = await db.query('SELECT mode, blocked_countries FROM geofence_config WHERE id = 1');
        if (geoRes.rows.length > 0) {
            geofenceConfig = {
                mode: geoRes.rows[0].mode || 'disabled',
                blockedCountries: geoRes.rows[0].blocked_countries || ['RU', 'KP', 'IR', 'CN']
            };
        }
        logger.info(`[Firewall Middleware] Loaded ${bannedIpsMap.size} active IP bans and geofence config (Mode: ${geofenceConfig.mode}).`);
    } catch (err) {
        logger.error(`[Firewall Middleware] Failed to reload firewall state: ${err.message}`);
    }
}

// Periodic background refresh every 30 seconds
setInterval(loadFirewallState, 30 * 1000);

/**
 * Extract clean client IP address from incoming Express request
 */
function getClientIp(req) {
    const xForwardedFor = req.headers['x-forwarded-for'];
    let ip = '';
    if (xForwardedFor) {
        ip = xForwardedFor.split(',')[0].trim();
    } else {
        ip = req.socket?.remoteAddress || req.ip || '127.0.0.1';
    }
    return ip.replace(/^::ffff:/, '');
}

/**
 * Automatically ban an offending IP into the database and memory cache
 */
async function autoBanIp(ip, reason, durationHours = 24) {
    if (!ip || geoService.isPrivateIp(ip)) return;
    const geo = geoService.resolveIp(ip);
    const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000);

    try {
        await db.query(`
            INSERT INTO banned_ips (ip, country, country_name, reason, attempts, banned_at, expires_at, banned_by)
            VALUES ($1, $2, $3, $4, 1, NOW(), $5, 'WAF_AUTO_DEFENSE')
            ON CONFLICT (ip) DO UPDATE SET
                attempts = banned_ips.attempts + 1,
                reason = EXCLUDED.reason,
                expires_at = EXCLUDED.expires_at,
                banned_at = NOW()
        `, [ip, geo.country, geo.countryName, reason, expiresAt]);

        bannedIpsMap.set(ip, {
            ip,
            country: geo.country,
            countryName: geo.countryName,
            reason,
            attempts: 1,
            expiresAt
        });

        logger.error(`🚨 [WAF Auto-Ban] Blacklisted IP ${ip} (${geo.countryName}) for ${durationHours}h. Reason: ${reason}`);

        // Log to security_events table
        await db.query(`
            INSERT INTO security_events (event_type, details)
            VALUES ('IP_BLACKLISTED', $1)
        `, [JSON.stringify({ ip, reason, country: geo.country, countryName: geo.countryName, expiresAt })]);

        // Dispatch alert via notificationService
        try {
            const ns = require('../services/notificationService');
            await ns.dispatchAlert('waf_ban', `🛡️ WAF Auto-Ban: ${ip}`, `IP: ${ip} (${geo.countryName})\nReason: ${reason}\nDuration: ${durationHours} hours`, 'error');
        } catch (_) {}
    } catch (err) {
        logger.error(`[Firewall Middleware] Failed to persist auto-ban for ${ip}: ${err.message}`);
    }
}

/**
 * Enterprise Firewall & WAF Request Filter Middleware
 */
function firewallMiddleware(req, res, next) {
    const ip = getClientIp(req);
    const isPrivate = geoService.isPrivateIp(ip);

    // Trusted local / loopback / private intranet requests ALWAYS bypass all firewall, WAF, and geofence restrictions
    if (isPrivate) {
        return next();
    }

    // 1. Enforce Active IP Blacklist
    if (bannedIpsMap.has(ip)) {
        const ban = bannedIpsMap.get(ip);
        if (new Date() < new Date(ban.expiresAt)) {
            logger.warn(`[Firewall] Blocked inbound request from blacklisted IP: ${ip} (Reason: ${ban.reason})`);
            return res.status(403).json({
                error: 'Access Denied: IP address blocked by NexaDisk Enterprise Firewall',
                reason: ban.reason,
                blockedIp: ip,
                expiresAt: ban.expiresAt
            });
        } else {
            // Ban expired
            bannedIpsMap.delete(ip);
        }
    }

    const geo = geoService.resolveIp(ip);

    // 2. Enforce Geofence Policy
    if (geofenceConfig.mode === 'block') {
        const blockedList = geofenceConfig.blockedCountries || [];
        if (blockedList.includes(geo.country)) {
            logger.warn(`[Firewall Geofence] Blocked request from restricted country ${geo.country} (${ip})`);
            try {
                const wafCollector = require('../services/security/wafCollector');
                wafCollector.ingestEvent({
                    source: 'express_waf',
                    sourceIp: ip,
                    method: req.method,
                    path: req.originalUrl || req.url,
                    userAgent: req.headers['user-agent'],
                    attackType: 'GEOFENCE_VIOLATION',
                    severity: 'LOW',
                    action: 'BLOCKED',
                    statusCode: 403,
                    ruleId: 'GEOFENCE-BLOCK-01',
                    ruleMessage: `Geofence block rule triggered for country ${geo.country}`
                });
            } catch (_) {}
            return res.status(403).json({
                error: `Access Denied: Geofence policy restricts traffic from country code ${geo.country}`
            });
        }
    } else if (geofenceConfig.mode === 'allow') {
        const allowedList = geofenceConfig.blockedCountries || [];
        if (!allowedList.includes(geo.country)) {
            logger.warn(`[Firewall Geofence] Blocked request from non-whitelisted country ${geo.country} (${ip})`);
            try {
                const wafCollector = require('../services/security/wafCollector');
                wafCollector.ingestEvent({
                    source: 'express_waf',
                    sourceIp: ip,
                    method: req.method,
                    path: req.originalUrl || req.url,
                    userAgent: req.headers['user-agent'],
                    attackType: 'GEOFENCE_VIOLATION',
                    severity: 'LOW',
                    action: 'BLOCKED',
                    statusCode: 403,
                    ruleId: 'GEOFENCE-ALLOW-01',
                    ruleMessage: `Geofence whitelist non-match for country ${geo.country}`
                });
            } catch (_) {}
            return res.status(403).json({
                error: `Access Denied: Geofence whitelist restricts traffic from country code ${geo.country}`
            });
        }
    }

    // 3. Web Application Firewall (WAF) Deep Packet Inspection
    const inspectTarget = `${req.originalUrl || req.url} ${JSON.stringify(req.query || {})} ${req.headers['user-agent'] || ''}`;

    for (const rule of WAF_PATTERNS) {
        if (rule.pattern.test(inspectTarget)) {
            const probeInfo = {
                ip,
                country: geo.country,
                threat: rule.threat,
                mitre: rule.mitre,
                target: req.originalUrl || req.url,
                timestamp: new Date().toISOString()
            };

            logger.warn(`🚨 [WAF Detection] ${rule.threat} probe from ${ip} targeting ${probeInfo.target}`);

            // Ingest real WAF telemetry event into wafCollector
            try {
                const wafCollector = require('../services/security/wafCollector');
                wafCollector.ingestEvent({
                    source: 'express_waf',
                    sourceIp: ip,
                    method: req.method,
                    path: req.originalUrl || req.url,
                    userAgent: req.headers['user-agent'],
                    attackType: rule.threat,
                    severity: rule.threat === 'COMMAND_INJECTION' || rule.threat === 'REMOTE_CODE_EXECUTION' ? 'CRITICAL' : 'HIGH',
                    action: 'BLOCKED',
                    statusCode: 403,
                    ruleId: `WAF-${rule.threat}`,
                    ruleMessage: `OWASP inspection triggered: ${rule.threat} [MITRE ${rule.mitre}]`,
                    details: { pattern: String(rule.pattern), inspectTarget }
                });
            } catch (_) {}

            // Calculate scoring for IP
            let currentScore = (suspiciousIpScores.get(ip)?.score || 0) + rule.score;
            suspiciousIpScores.set(ip, {
                score: currentScore,
                lastSeen: Date.now()
            });

            // If threat score exceeds threshold in production auto-ban mode
            if (currentScore >= 50 && process.env.WAF_AUTO_BAN === 'true') {
                autoBanIp(ip, `WAF Exploit Detection: ${rule.threat} [MITRE ${rule.mitre}] targeting ${probeInfo.target}`, 24);
                return res.status(403).json({
                    error: 'Access Denied: Hostile security payload detected by WAF engine. IP blacklisted.',
                    mitre: rule.mitre
                });
            }

            return res.status(403).json({
                error: 'Access Denied: Malformed or hostile payload rejected by WAF inspection.',
                threat: rule.threat,
                mitre: rule.mitre
            });
        }
    }

    next();
}

module.exports = {
    firewallMiddleware,
    loadFirewallState,
    autoBanIp,
    getClientIp
};
