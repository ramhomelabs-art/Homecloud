const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const os = require('os');
const fs = require('fs');

// Global wrapper to support cross-device moves/deletes (EXDEV/EPERM/EACCES/EINVAL errors)
const originalRenameSync = fs.renameSync;
fs.renameSync = (src, dest) => {
    try {
        originalRenameSync(src, dest);
    } catch (err) {
        if (err.code === 'EXDEV' || err.code === 'EPERM' || err.code === 'EACCES' || err.code === 'EINVAL') {
            try {
                fs.cpSync(src, dest, { recursive: true });
                fs.rmSync(src, { recursive: true, force: true });
            } catch (fallbackErr) {
                throw fallbackErr;
            }
        } else {
            throw err;
        }
    }
};

const originalRename = fs.promises.rename;
fs.promises.rename = async (src, dest) => {
    try {
        await originalRename(src, dest);
    } catch (err) {
        if (err.code === 'EXDEV' || err.code === 'EPERM' || err.code === 'EACCES' || err.code === 'EINVAL') {
            try {
                if (typeof fs.promises.cp === 'function') {
                    await fs.promises.cp(src, dest, { recursive: true });
                } else {
                    fs.cpSync(src, dest, { recursive: true });
                }
                if (typeof fs.promises.rm === 'function') {
                    await fs.promises.rm(src, { recursive: true, force: true });
                } else {
                    fs.rmSync(src, { recursive: true, force: true });
                }
            } catch (fallbackErr) {
                throw fallbackErr;
            }
        } else {
            throw err;
        }
    }
};

const { initDatabase } = require('./config/database');
const logger = require('./utils/logger');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { firewallMiddleware, loadFirewallState } = require('./middleware/firewall');

const axios = require('axios');
const clusterService = require('./services/clusterService');

// Global axios interceptor to inject Authorization header for agents
axios.interceptors.request.use((config) => {
    if (config.url && process.env.AGENT_KEY) {
        const isTelegram = config.url.includes('api.telegram.org');
        const isDiscord  = config.url.includes('discord.com') || config.url.includes('discordapp.com');
        const agents = Object.values(clusterService.agents || {});
        const isAgent = agents.some(agent => agent.url && config.url.startsWith(agent.url));
        const isLocalHost = config.url.startsWith('http://localhost') || config.url.startsWith('http://127.0.0.1');
        
        if ((isAgent || isLocalHost) && !isTelegram && !isDiscord) {
            config.headers['Authorization'] = `Bearer ${process.env.AGENT_KEY}`;
        }
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

const app = express();
app.set('trust proxy', 1);

// Set security headers using Helmet (with CSP and frameguard disabled for seamless inline PDF and iframe streaming)
app.use(helmet({
    contentSecurityPolicy: false,
    frameguard: false,
    crossOriginOpenerPolicy: false,
    originAgentCluster: false,
    crossOriginResourcePolicy: false
}));

const PORT = process.env.PORT || 5000;

// ── Crash on missing or default JWT secret or AGENT_KEY ──────────────────────
if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'nexadisk-default-secret-key-change-in-production') {
    logger.error('FATAL: JWT_SECRET is not set or is using the insecure default value.');
    logger.error('Please set a unique, random JWT_SECRET in your .env file and restart.');
    process.exit(1);
}
if (!process.env.AGENT_KEY || process.env.AGENT_KEY === 'nexadisk-agent-secret-key') {
    logger.error('FATAL: AGENT_KEY is not set or is using the insecure default value.');
    logger.error('Please set a unique, random AGENT_KEY in your .env file and restart.');
    process.exit(1);
}

// Serve Mobile Client (Legacy location)
app.use('/mobile', express.static(path.join(__dirname, '..', 'mobile')));

// Function to check if an origin is local or within private IPv4 / intranet ranges
const isPrivateOrLocalOrigin = (origin) => {
    if (!origin) return true;
    try {
        const parsed = new URL(origin);
        const hostname = parsed.hostname;
        // Localhost & loopbacks
        if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '0.0.0.0') return true;
        // 10.0.0.0 - 10.255.255.255
        if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
        // 172.16.0.0 - 172.31.255.255 (e.g. 172.24.0.58)
        if (/^172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
        // 192.168.0.0 - 192.168.255.255
        if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
        // Tailscale / CGNAT (100.64.0.0 - 100.127.255.255)
        if (/^100\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
        // Local / private domain names
        if (hostname.endsWith('.local') || hostname.endsWith('.internal') || hostname.endsWith('.lan') || hostname.endsWith('.home')) return true;
        return false;
    } catch (_) {
        return false;
    }
};

app.use(cors((req, callback) => {
    callback(null, {
        credentials: true,
        origin: (origin, cb) => {
            if (!origin) return cb(null, true);
            
            // 1. Check process.env.CORS_ORIGIN
            const allowed = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:5000')
                .split(',')
                .map(o => o.trim())
                .filter(Boolean);
                
            if (allowed.includes('*') || allowed.includes(origin)) {
                return cb(null, true);
            }

            // 2. Same-host or same-origin matching
            const host = req.headers.host;
            if (host) {
                const hostNameOnly = host.split(':')[0];
                if (origin.includes(hostNameOnly)) {
                    return cb(null, true);
                }
            }

            // 3. Private network / LAN / intranet origins (e.g. 172.24.0.58, 192.168.x.x, 10.x.x.x)
            if (isPrivateOrLocalOrigin(origin)) {
                return cb(null, true);
            }

            // 4. In development mode, allow dynamically
            if (process.env.NODE_ENV !== 'production') {
                return cb(null, true);
            }
            
            cb(new Error(`CORS: Origin '${origin}' is not allowed`));
        }
    });
}));
app.use(bodyParser.json());

// --- ENTERPRISE FIREWALL & WAF DEEP INSPECTION ---
app.use(firewallMiddleware);

// --- SANITIZE INTERNAL ERRORS TO PREVENT LEAKS ---
app.use((req, res, next) => {
    const originalJson = res.json;
    res.json = function (body) {
        if (body && typeof body === 'object' && body.error && res.statusCode >= 500) {
            logger.error(`[Internal Server Error URL: ${req.method} ${req.url}]: ${body.error}`);
            body.error = 'Internal server error';
        }
        return originalJson.call(this, body);
    };
    const originalSend = res.send;
    res.send = function (body) {
        if (res.statusCode >= 500 && typeof body === 'string' && body !== 'Internal Server Error' && body !== 'Internal server error') {
            logger.error(`[Internal Server Error URL: ${req.method} ${req.url}]: ${body}`);
            return originalSend.call(this, 'Internal Server Error');
        }
        return originalSend.call(this, body);
    };
    next();
});

// --- NO-CACHE HEADERS FOR ALL API RESPONSES ---
app.use('/api/', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
});

// --- BACKWARDS COMPATIBILITY REWRITE MIDDLEWARE ---
app.use((req, res, next) => {
    if (req.url.startsWith('/api/') && !req.url.startsWith('/api/v1/')) {
        const subPath = req.url.slice(5);
        if (subPath.startsWith('login') || subPath.startsWith('users') || subPath.startsWith('settings') || subPath.startsWith('verify')) {
            req.url = '/api/v1/auth/' + subPath;
        } else if (subPath.startsWith('files')) {
            req.url = '/api/v1/files/' + subPath.replace(/^files\/?/, '');
        } else if (subPath.startsWith('duplicates')) {
            req.url = '/api/v1/files/' + subPath;
        } else if (subPath.startsWith('share/create') || subPath.startsWith('share/list')) {
            // Only rewrite admin management routes to v1/shares
            req.url = '/api/v1/shares/' + subPath.replace(/^share\/?/, '');
        } else if (subPath.startsWith('sync')) {
            req.url = '/api/v1/sync/' + subPath.replace(/^sync\/?/, '');
        } else if (subPath.startsWith('system')) {
            req.url = '/api/v1/system/' + subPath.replace(/^system\/?/, '');
        } else if (subPath.startsWith('quarantine')) {
            req.url = '/api/v1/quarantine/' + subPath.replace(/^quarantine\/?/, '');
        } else if (subPath.startsWith('agents')) {
            req.url = '/api/v1/agents/' + subPath.replace(/^agents\/?/, '');
        } else if (subPath.startsWith('storage')) {
            req.url = '/api/v1/storage/' + subPath.replace(/^storage\/?/, '');
        } else if (subPath.startsWith('network')) {
            req.url = '/api/v1/network/' + subPath.replace(/^network\/?/, '');
        } else if (subPath.startsWith('provision')) {
            req.url = '/api/v1/provision/' + subPath.replace(/^provision\/?/, '');
        } else if (subPath.startsWith('activities')) {
            req.url = '/api/v1/files/activities';
        } else if (subPath.startsWith('operations')) {
            req.url = '/api/v1/files/operations/' + subPath.replace(/^operations\/?/, '');
        } else if (subPath.startsWith('security')) {
            req.url = '/api/v1/security/' + subPath.replace(/^security\/?/, '');
        } else if (subPath.startsWith('trash')) {
            req.url = '/api/v1/trash/' + subPath.replace(/^trash\/?/, '');
        } else if (subPath.startsWith('sessions')) {
            req.url = '/api/v1/auth/sessions';
        } else if (subPath.startsWith('lockers')) {
            req.url = '/api/v1/lockers/' + subPath.replace(/^lockers\/?/, '');
        }
        logger.debug(`[API Rewrite] ${req.originalUrl} -> ${req.url}`);
    }
    next();
});

const isPrivateIp = (ip) => {
    if (!ip) return false;
    const normalized = ip.replace(/^::ffff:/, '');
    if (normalized === '127.0.0.1' || normalized === '::1' || normalized === 'localhost') return true;
    if (normalized.startsWith('10.')) return true;
    if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(normalized)) return true;
    if (normalized.startsWith('192.168.')) return true;
    return false;
};

// General API limiter — balanced for dashboard polling while blocking DoS
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.RATE_LIMIT_MAX ? parseInt(process.env.RATE_LIMIT_MAX) : 10000, // Increased default to support multi-tab polling
    message: { error: 'Too many requests from this IP, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        if (process.env.DISABLE_RATE_LIMITER === 'true') return true;
        return isPrivateIp(req.ip);
    }
});
app.use('/api/', apiLimiter);

// Sensitive-operations limiter — for share creation, user management, admin ops
const sensitiveOpsLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500, // Increased threshold for multiple parallel operations
    message: { error: 'Too many sensitive operations from this IP. Please slow down.' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        if (process.env.DISABLE_RATE_LIMITER === 'true') return true;
        return isPrivateIp(req.ip);
    }
});
app.use('/api/v1/shares', sensitiveOpsLimiter);
app.use('/api/v1/users', sensitiveOpsLimiter);

// Strict rate limit for login and OTP endpoints to prevent brute-force
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30, // Balanced for multiple tabs reloading
    message: { error: 'Too many authentication attempts. Please try again in 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Only count failed attempts
    skip: (req) => {
        if (process.env.DISABLE_RATE_LIMITER === 'true') return true;
        return isPrivateIp(req.ip);
    }
});
app.use('/api/v1/auth/login', authLimiter);
app.use('/api/share/auth', authLimiter);
app.use('/api/v1/guest/verify', authLimiter);

// --- SECURITY HEADERS & REQUEST LOGGING ---
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    logger.info(`${req.method} ${req.url}`, { ip: req.ip });
    next();
});

// --- REGISTER MODULAR ROUTERS ---
const authRouter = require('./routes/auth.routes');
const filesRouter = require('./routes/files.routes');
const clusterRouter = require('./routes/cluster.routes');
const provisionRouter = require('./routes/provision.routes');
const sharesRouter = require('./routes/shares.routes');
const shareRouter = require('./routes/share.routes');
const syncRouter = require('./routes/sync.routes');
const systemRouter = require('./routes/system.routes');
const quarantineRouter = require('./routes/quarantine.routes');
const securityRouter = require('./routes/security.routes');
const profileRouter = require('./routes/profile.routes');
const trashRouter = require('./routes/trash.routes');
const socialRouter = require('./routes/social.routes');
const publicRouter = require('./routes/public.routes');
const guestRouter = require('./routes/guest.routes');
const auditRouter = require('./routes/audit.routes');
const lockersRouter = require('./routes/lockers.routes');
const trafficRouter = require('./routes/traffic.routes');
const cloudRouter = require('./routes/cloud.routes');
const tieringRouter = require('./routes/tiering.routes');
const siteMeshRouter = require('./routes/siteMesh.routes');
const updateRouter = require('./routes/update.routes');
const deploymentRouter = require('./routes/deployment.routes');
const trafficService = require('./services/trafficService');

// --- REAL-TIME INBOUND TRAFFIC INTERCEPTOR ---
app.use((req, res, next) => {
    const start = Date.now();
    let bytesSent = 0;
    const origWrite = res.write;
    const origEnd = res.end;

    res.write = function (chunk, ...args) {
        if (chunk) {
            bytesSent += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(String(chunk));
        }
        return origWrite.apply(res, [chunk, ...args]);
    };

    res.end = function (chunk, ...args) {
        if (chunk) {
            bytesSent += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(String(chunk));
        }
        return origEnd.apply(res, [chunk, ...args]);
    };

    res.on('finish', () => {
        const duration = Date.now() - start;
        const bytesIn = parseInt(req.headers['content-length'] || 0, 10);
        const bytesOut = bytesSent || parseInt(res.getHeader('content-length') || 0, 10);
        trafficService.recordRequest(req, res, duration, bytesIn, bytesOut);
    });
    next();
});

app.use('/api/v1/auth', authRouter);
app.use('/api/auth', authRouter);            // Legacy fallback
app.use('/api', authRouter);                 // Legacy fallback for /api/users
app.use('/api/v1/files', filesRouter);
app.use('/api/files', filesRouter);          // Legacy fallback
app.use('/api/v1/agents', clusterRouter.agents);
app.use('/api/v1/storage', clusterRouter.storage);
app.use('/api/v1/network', clusterRouter.network);
app.use('/api/v1/provision', provisionRouter);
app.use('/api/share', shareRouter);      // PUBLIC gateway: /api/share/info/:token, /api/share/auth/:token, etc.
app.use('/public/share', publicRouter);
app.use('/public/share/:id', guestRouter);
app.use('/api/v1/shares', sharesRouter); // ADMIN management: /api/v1/shares/create, /api/v1/shares/list, etc.
app.use('/api/shares', sharesRouter);    // Legacy fallback
app.use('/api/v1/social', socialRouter);
app.use('/api/social', socialRouter);    // Legacy fallback
app.use('/api/v1/trash', trashRouter);
app.use('/api/trash', trashRouter);      // Legacy fallback
app.use('/api/v1/sync', syncRouter);
app.use('/api/v1/system', systemRouter);
app.use('/api/v1/quarantine', quarantineRouter);
app.use('/api/v1/security', securityRouter);
app.use('/api/v1/profile', profileRouter);
app.use('/api/v1/audit', auditRouter);
app.use('/api/v1/lockers', lockersRouter);
app.use('/api/v1/traffic', trafficRouter);
app.use('/api/v1/cloud', cloudRouter);
app.use('/api/v1/tiering', tieringRouter);
app.use('/api/v1/sitemesh', siteMeshRouter);
app.use('/api/v1/updates', updateRouter);
app.use('/api/v1/deployment', deploymentRouter);

// --- HEALTH CHECK ENDPOINTS ---
app.get(['/api/v1/health', '/api/v1/system/health', '/api/v1/system/stats', '/health', '/api/health'], (req, res) => {
    res.json({
        status: 'ok',
        service: 'NexaDisk Master Cluster',
        version: '2.4.4',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// --- OTHER ENDPOINTS ---
app.get('/.well-known/appspecific/com.chrome.devtools.json', (req, res) => res.json({}));

// --- STATIC FRONTEND SERVING ---
const clientDist = path.join(__dirname, '..', 'client', 'dist');
const mobileDist = path.join(__dirname, '..', 'mobile');

app.use('/mobile', express.static(mobileDist));
app.use('/assets', express.static(path.join(clientDist, 'assets'), {
    maxAge: '1y',
    immutable: true
}));
app.use(express.static(clientDist, {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('index.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
    }
}));

app.get('*', (req, res, next) => {
    // Never send index.html for API requests, public static paths, assets, or requests with file extensions
    if (
        req.url.startsWith('/api') || 
        req.url.startsWith('/public') || 
        req.url.startsWith('/mobile') || 
        req.url.startsWith('/assets') ||
        path.extname(req.path) !== ''
    ) {
        return next();
    }

    const ua = req.headers['user-agent'] || '';
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobi/i.test(ua);
    const forceMobile = req.query.ui === 'mobile';
    const forceDesktop = req.query.ui === 'desktop';

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    if ((isMobile || forceMobile) && !forceDesktop && fs.existsSync(path.join(mobileDist, 'index.html'))) {
        return res.sendFile(path.join(mobileDist, 'index.html'));
    }

    if (fs.existsSync(clientDist)) {
        return res.sendFile(path.join(clientDist, 'index.html'));
    }
    next();
});

// 404 handler
app.use(notFound);

// Global error handler
app.use(errorHandler);

// --- START SERVER & DB ---
async function startServer() {
    try {
        // 1. Initialize DB tables
        await initDatabase();

        // 1.1. Load firewall state and alerts from database
        await loadFirewallState();
        const notificationService = require('./services/notificationService');
        await notificationService.loadPersistedAlerts();

        // 1.15. Initialize WAF Security Event Collector & SSE Pipeline
        const wafCollector = require('./services/security/wafCollector');
        wafCollector.init();

        // 1.2. Load and restore saved Cloud & Network Mounts
        const cloudMountService = require('./services/cloudMountService');
        await cloudMountService.init();

        // 1.5. Auto-remount saved network drives
        const networkService = require('./services/networkService');
        await networkService.init();

        // 2. Start telemetry polling
        const clusterService = require('./services/clusterService');
        clusterService.startTelemetryPolling();

        // 3. Start sync scheduler
        const syncService = require('./services/syncService');
        syncService.startScheduler();

        // 3.5. Start daily trash pruning worker
        const trashService = require('./services/trashService');
        trashService.startPruningWorker();

        // 4. Initialize BullMQ Task Workers
        const { initWorkers } = require('./workers');
        initWorkers();

        // 5. Start listening
        app.listen(PORT, '0.0.0.0', () => {
            logger.info(`✅ NexaDisk v2 Core Enterprise Server running on port ${PORT}`);
            logger.info(`🔒 Environment: ${process.env.NODE_ENV || 'development'}`);
        });

    } catch (err) {
        logger.error(`❌ NexaDisk Server startup failed: ${err.message}`, err);
        process.exit(1);
    }
}

startServer();

// --- GLOBAL CRASH PROTECTION ---
process.on('uncaughtException', (err) => {
    logger.error('🔴 UNCAUGHT EXCEPTION (server kept alive):', {
        message: err.message,
        stack: err.stack
    });
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('🔴 UNHANDLED PROMISE REJECTION (server kept alive):', {
        reason: reason instanceof Error ? reason.stack : String(reason),
        promise: String(promise)
    });
});

process.on('SIGTERM', () => {
    logger.info('📴 SIGTERM received — graceful shutdown initiated.');
    process.exit(0);
});

process.on('SIGINT', () => {
    logger.info('📴 SIGINT received — graceful shutdown initiated.');
    process.exit(0);
});
