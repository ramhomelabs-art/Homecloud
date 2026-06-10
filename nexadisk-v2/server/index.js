const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const os = require('os');
const fs = require('fs');

const { initDatabase } = require('./config/database');
const logger = require('./utils/logger');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const app = express();
app.set('trust proxy', 1);

// Set security headers using Helmet
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://static.cloudflareinsights.com"],
            "img-src": ["'self'", "data:", "blob:", "https:*"],
            "connect-src": ["'self'", "https://static.cloudflareinsights.com"]
        },
    },
    crossOriginOpenerPolicy: false,
    originAgentCluster: false
}));

const PORT = process.env.PORT || 5000;
const SECRET_KEY = process.env.JWT_SECRET || 'nexadisk-default-secret-key-change-in-production';

// Serve Mobile Client (Legacy location)
app.use('/mobile', express.static(path.join(__dirname, '..', 'mobile')));

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const allowed = (process.env.CORS_ORIGIN || 'http://localhost:5173')
            .split(',')
            .map(o => o.trim());
        if (allowed.includes(origin) || allowed.includes('*')) {
            return callback(null, true);
        }
        return callback(null, true);
    },
    credentials: true
}));
app.use(bodyParser.json());

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
        } else if (subPath.startsWith('ai') || subPath.startsWith('copilot')) {
            req.url = '/api/v1/ai/' + subPath.replace(/^ai\/?/, '');
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
        }
        logger.debug(`[API Rewrite] ${req.originalUrl} -> ${req.url}`);
    }
    next();
});

// --- RATE LIMITING ---
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10000,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/', apiLimiter);

// --- SECURITY HEADERS & REQUEST LOGGING ---
app.use((req, res, next) => {
    res.setHeader('Content-Security-Policy',
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        "img-src 'self' data: blob:; " +
        "font-src 'self' https://fonts.gstatic.com; " +
        "connect-src 'self'; " +
        "frame-ancestors 'none'; " +
        "base-uri 'self'; " +
        "form-action 'self';"
    );

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
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
const automationRouter = require('./routes/automation.routes');
const systemRouter = require('./routes/system.routes');
const quarantineRouter = require('./routes/quarantine.routes');
const securityRouter = require('./routes/security.routes');
const profileRouter = require('./routes/profile.routes');

app.use('/api/v1/auth', authRouter);
app.use('/api/v1/files', filesRouter);
app.use('/api/v1/agents', clusterRouter.agents);
app.use('/api/v1/storage', clusterRouter.storage);
app.use('/api/v1/network', clusterRouter.network);
app.use('/api/v1/provision', provisionRouter);
app.use('/api/share', shareRouter);      // PUBLIC gateway: /api/share/info/:token, /api/share/auth/:token, etc.
app.use('/api/v1/shares', sharesRouter); // ADMIN management: /api/v1/shares/create, /api/v1/shares/list, etc.
app.use('/api/v1/sync', syncRouter);
app.use('/api/v1/ai', automationRouter);
app.use('/api/v1/system', systemRouter);
app.use('/api/v1/quarantine', quarantineRouter);
app.use('/api/v1/security', securityRouter);
app.use('/api/v1/profile', profileRouter);

// --- OTHER ENDPOINTS ---
app.get('/.well-known/appspecific/com.chrome.devtools.json', (req, res) => res.json({}));

// --- STATIC FRONTEND SERVING ---
const clientDist = path.join(__dirname, '..', 'client', 'dist');
const mobileDist = path.join(__dirname, '..', 'mobile');

app.get('/', (req, res, next) => {
    const ua = req.headers['user-agent'] || '';
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobi/i.test(ua);
    const forceMobile = req.query.ui === 'mobile';
    const forceDesktop = req.query.ui === 'desktop';

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

    if ((isMobile || forceMobile) && !forceDesktop && fs.existsSync(path.join(mobileDist, 'index.html'))) {
        return res.sendFile(path.join(mobileDist, 'index.html'));
    }

    if (fs.existsSync(clientDist)) {
        return res.sendFile(path.join(clientDist, 'index.html'));
    }
    next();
});

app.use('/mobile', express.static(mobileDist));
app.use(express.static(clientDist));

app.get('*', (req, res, next) => {
    if (req.url.startsWith('/api') || req.url.startsWith('/public') || req.url.startsWith('/mobile')) return next();

    const ua = req.headers['user-agent'] || '';
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobi/i.test(ua);

    if (isMobile && fs.existsSync(path.join(mobileDist, 'index.html'))) {
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

        // 2. Start telemetry polling
        const clusterService = require('./services/clusterService');
        clusterService.startTelemetryPolling();

        // 3. Start sync scheduler
        const syncService = require('./services/syncService');
        syncService.startScheduler();

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
