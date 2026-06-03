const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const os = require('os');
const fs = require('fs');

// Initialize database (triggers migrations and setup)
require('./config/database');

const { localLogBuffer } = require('./config/sharedState');

// Intercept console logs in server for UI Console access
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

const addToServerBuffer = (level, args) => {
    const msg = args.map(arg => {
        if (arg instanceof Error) return arg.stack || arg.message;
        if (typeof arg === 'object') {
            try { return JSON.stringify(arg); } catch (e) { return String(arg); }
        }
        return String(arg);
    }).join(' ');
    const line = `[${new Date().toISOString()}] [${level}] ${msg}`;
    localLogBuffer.push(line);
    if (localLogBuffer.length > 150) {
        localLogBuffer.shift();
    }
};

console.log = (...args) => {
    addToServerBuffer('INFO', args);
    originalLog.apply(console, args);
};
console.error = (...args) => {
    addToServerBuffer('ERROR', args);
    originalError.apply(console, args);
};
console.warn = (...args) => {
    addToServerBuffer('WARN', args);
    originalWarn.apply(console, args);
};

// Import middleware and utilities
const { errorHandler, notFound } = require('./middleware/errorHandler');
const logger = require('./utils/logger');

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
const SECRET_KEY = process.env.JWT_SECRET;

if (!SECRET_KEY) {
    console.error('FATAL ERROR: JWT_SECRET is not defined in environment variables.');
    console.error('Please create a .env file based on .env.example');
    process.exit(1);
}

// Serve Mobile Client (Legacy location)
app.use('/mobile', express.static(path.join(__dirname, '..', 'mobile')));

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(bodyParser.json());

// --- RATE LIMITING ---
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10000, // Limit each IP to 10000 requests per windowMs
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
const agentsRouter = require('./routes/agents.routes');
const networkRouter = require('./routes/network.routes');
const provisionRouter = require('./routes/provision.routes');
const publicRouter = require('./routes/public.routes');
const sharesRouter = require('./routes/shares.routes');
const syncRouter = require('./routes/sync.routes');
const aiRouter = require('./routes/ai.routes');
const systemRouter = require('./routes/system.routes');

app.use('/api', authRouter);
app.use('/api', filesRouter);
app.use('/api', agentsRouter);
app.use('/api/network', networkRouter);
app.use('/api/provision', provisionRouter);
app.use('/public/share', publicRouter);
app.use('/api/share', sharesRouter);
app.use('/api/sync', syncRouter);
app.use('/api/ai', aiRouter);
app.use('/api/system', systemRouter);

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

    logger.debug(`Device Detection: isMobile=${isMobile}, forceMobile=${forceMobile}, UA=${ua}`);

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

// --- START SERVER ---
app.listen(PORT, () => {
    logger.info(`✅ NexaDisk Server running on port ${PORT}`);
    logger.info(`🔒 Environment: ${process.env.NODE_ENV || 'development'}`);
    
    // Initialize background sync scheduler
    try {
        const { startScheduler } = require('./utils/syncRunner');
        startScheduler();
    } catch (schedErr) {
        logger.error('❌ Failed to start background sync scheduler:', schedErr.message);
    }
});
