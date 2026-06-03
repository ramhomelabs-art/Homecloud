const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const logger = require('../utils/logger');
const MigrationManager = require('../utils/migrationManager');

const DB_PATH = process.env.DB_PATH 
    ? path.resolve(process.env.DB_PATH) 
    : path.resolve(__dirname, '..', 'database.sqlite');

const db = new sqlite3.Database(DB_PATH);

// Run migrations automatically on startup
new MigrationManager(DB_PATH).migrate()
    .then(() => {
        logger.info('✅ Database migrations successfully applied/verified.');
        
        // Execute backward-compatibility checks
        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE,
                password TEXT,
                role TEXT DEFAULT 'User'
            )`);

            db.run("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'User'", (err) => { });
            db.run("UPDATE users SET role = 'Administrator' WHERE username = 'admin'");

            db.run(`CREATE TABLE IF NOT EXISTS shares (
                id TEXT PRIMARY KEY,
                path TEXT,
                password TEXT,
                email TEXT,
                max_views INTEGER DEFAULT -1,
                view_count INTEGER DEFAULT 0,
                expiry DATETIME,
                agent_id TEXT,
                permissions TEXT DEFAULT 'View',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            db.run("ALTER TABLE shares ADD COLUMN agent_id TEXT", (err) => { });
            db.run("ALTER TABLE shares ADD COLUMN permissions TEXT DEFAULT 'View'", (err) => { });

            db.run(`CREATE TABLE IF NOT EXISTS network_shares (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                path TEXT,
                label TEXT,
                username TEXT,
                password TEXT,
                type TEXT DEFAULT 'SMB',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS persistent_agents (
                id TEXT PRIMARY KEY,
                hostname TEXT,
                url TEXT,
                status TEXT DEFAULT 'pending',
                lastSeen DATETIME
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT
            )`, () => {
                db.get("SELECT value FROM app_settings WHERE key = 'appName'", (err, row) => {
                    if (!row) {
                        db.run("INSERT INTO app_settings (key, value) VALUES ('appName', 'NexaDisk')");
                    }
                });
            });

            db.run(`CREATE TABLE IF NOT EXISTS sync_tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                sourceNode TEXT,
                sourcePath TEXT,
                destNode TEXT,
                destPath TEXT,
                syncMode TEXT,
                scheduleInterval TEXT,
                lastRun DATETIME,
                lastStatus TEXT,
                lastError TEXT,
                nextRun DATETIME,
                active INTEGER DEFAULT 1,
                sanitizeMedia INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            db.run("ALTER TABLE sync_tasks ADD COLUMN sanitizeMedia INTEGER DEFAULT 0", (err) => { });

            db.run(`CREATE TABLE IF NOT EXISTS sync_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                taskId INTEGER,
                runTime DATETIME DEFAULT CURRENT_TIMESTAMP,
                status TEXT,
                filesCopied INTEGER DEFAULT 0,
                bytesTransferred INTEGER DEFAULT 0,
                errors TEXT,
                FOREIGN KEY(taskId) REFERENCES sync_tasks(id) ON DELETE CASCADE
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS ai_rules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                triggerFolder TEXT,
                aiInstruction TEXT,
                actionType TEXT,
                active INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS ai_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ruleId INTEGER,
                command TEXT,
                status TEXT,
                logText TEXT,
                filesAffected TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);
        });
    })
    .catch(err => logger.error('❌ Failed to run database migrations:', err));

module.exports = db;
