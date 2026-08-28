const { Pool } = require('pg');
const logger = require('../utils/logger');

const poolConfig = process.env.DATABASE_URL 
    ? { connectionString: process.env.DATABASE_URL }
    : {
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_DATABASE || process.env.DB_NAME || 'nexadisk',
        password: process.env.DB_PASSWORD || 'postgres',
        port: parseInt(process.env.DB_PORT || '5432', 10),
    };

poolConfig.max = 20;
poolConfig.idleTimeoutMillis = 30000;
poolConfig.connectionTimeoutMillis = 5000;

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
    logger.error('Unexpected error on idle PostgreSQL client:', err);
});

async function initDatabase() {
    let client;
    try {
        client = await pool.connect();
        logger.info('Connected to PostgreSQL successfully.');

        // 0. Enable UUID extension
        await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

        // 1. Create USERS table
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                username VARCHAR(100) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                role VARCHAR(50) DEFAULT 'User' CHECK (role IN ('Admin', 'Operator', 'Power User', 'User', 'Guest', 'Read-Only')),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await client.query('CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)');

        // Ensure user profile management columns exist
        const usersColumns = [
            { name: 'first_name', type: 'VARCHAR(100)' },
            { name: 'last_name', type: 'VARCHAR(100)' },
            { name: 'display_name', type: 'VARCHAR(150)' },
            { name: 'email', type: 'VARCHAR(255)' },
            { name: 'phone', type: 'VARCHAR(50)' },
            { name: 'department', type: 'VARCHAR(150)' },
            { name: 'job_title', type: 'VARCHAR(150)' },
            { name: 'time_zone', type: 'VARCHAR(50) DEFAULT \'UTC\'' },
            { name: 'language', type: 'VARCHAR(20) DEFAULT \'en\'' },
            { name: 'bio', type: 'TEXT' },
            { name: 'last_login', type: 'TIMESTAMP WITH TIME ZONE' },
            { name: 'account_status', type: 'VARCHAR(50) DEFAULT \'active\'' },
            { name: 'avatar_path', type: 'TEXT' },
            { name: 'avatar_thumbnail_path', type: 'TEXT' },
            { name: 'avatar_updated_at', type: 'TIMESTAMP WITH TIME ZONE' },
            { name: 'security_question', type: 'VARCHAR(255)' },
            { name: 'security_answer', type: 'VARCHAR(255)' },
            { name: 'mfa_enabled', type: 'BOOLEAN DEFAULT FALSE' },
            { name: 'mfa_secret', type: 'VARCHAR(255)' }
        ];
        for (const col of usersColumns) {
            await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`);
        }

        // 2. Create SHARE_LINKS table
        await client.query(`
            CREATE TABLE IF NOT EXISTS share_links (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                token VARCHAR(100) UNIQUE NOT NULL,
                type VARCHAR(50) NOT NULL,
                owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
                path TEXT NOT NULL,
                title VARCHAR(255),
                description TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP WITH TIME ZONE
            )
        `);
        await client.query('CREATE INDEX IF NOT EXISTS idx_share_links_token ON share_links(token)');

        // 3. Create PERSISTENT_AGENTS table
        await client.query(`
            CREATE TABLE IF NOT EXISTS persistent_agents (
                id VARCHAR(100) PRIMARY KEY,
                hostname VARCHAR(255) NOT NULL,
                url VARCHAR(255) NOT NULL,
                status VARCHAR(50) DEFAULT 'pending',
                compliance_status VARCHAR(50) DEFAULT 'pending_audit',
                compliance_score INTEGER DEFAULT 0,
                compliance_report JSONB DEFAULT '{}'::jsonb,
                pairing_key_hash VARCHAR(255),
                last_audit TIMESTAMP WITH TIME ZONE,
                quarantine_reason TEXT,
                lastSeen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);
        // Ensure compliance columns exist if table was created previously
        await client.query('ALTER TABLE persistent_agents ADD COLUMN IF NOT EXISTS compliance_status VARCHAR(50) DEFAULT \'pending_audit\'');
        await client.query('ALTER TABLE persistent_agents ADD COLUMN IF NOT EXISTS compliance_score INTEGER DEFAULT 0');
        await client.query('ALTER TABLE persistent_agents ADD COLUMN IF NOT EXISTS compliance_report JSONB DEFAULT \'{}\'::jsonb');
        await client.query('ALTER TABLE persistent_agents ADD COLUMN IF NOT EXISTS pairing_key_hash VARCHAR(255)');
        await client.query('ALTER TABLE persistent_agents ADD COLUMN IF NOT EXISTS last_audit TIMESTAMP WITH TIME ZONE');
        await client.query('ALTER TABLE persistent_agents ADD COLUMN IF NOT EXISTS quarantine_reason TEXT');

        // 4. Create NETWORK_SHARES table
        await client.query(`
            CREATE TABLE IF NOT EXISTS network_shares (
                id SERIAL PRIMARY KEY,
                path TEXT NOT NULL,
                label VARCHAR(150) NOT NULL,
                username VARCHAR(100),
                password VARCHAR(255),
                type VARCHAR(50) DEFAULT 'SMB',
                extra_config TEXT,
                status VARCHAR(50) DEFAULT 'CONNECTED',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);
        // Ensure columns exist if table was created previously
        await client.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'network_shares' AND column_name = 'extra_config') THEN 
                    ALTER TABLE network_shares ADD COLUMN extra_config TEXT; 
                END IF; 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'network_shares' AND column_name = 'status') THEN 
                    ALTER TABLE network_shares ADD COLUMN status VARCHAR(50) DEFAULT 'CONNECTED'; 
                END IF; 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'network_shares' AND column_name = 'type') THEN 
                    ALTER TABLE network_shares ADD COLUMN type VARCHAR(50) DEFAULT 'SMB'; 
                END IF; 
            END $$;
        `);

        // 5. Create SECURITY_SCANS table
        await client.query(`
            CREATE TABLE IF NOT EXISTS security_scans (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                file_path TEXT NOT NULL,
                file_hash VARCHAR(255),
                scanner VARCHAR(100) DEFAULT 'NexaDisk Engine',
                score INTEGER DEFAULT 0,
                status VARCHAR(50) DEFAULT 'clean' CHECK (status IN ('clean', 'suspicious', 'malicious', 'failed')),
                scan_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                duration INTEGER DEFAULT 0
            )
        `);

        // 5a. Create QUARANTINE table
        await client.query(`
            CREATE TABLE IF NOT EXISTS quarantine (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                original_name VARCHAR(255) NOT NULL,
                quarantine_path TEXT NOT NULL,
                target_path TEXT NOT NULL,
                share_id UUID REFERENCES share_links(id) ON DELETE CASCADE,
                size BIGINT DEFAULT 0,
                mime_type VARCHAR(100),
                verdict VARCHAR(50) DEFAULT 'pending' CHECK (verdict IN ('clean', 'suspicious', 'malicious')),
                score INTEGER DEFAULT 0,
                threats JSONB DEFAULT '[]'::jsonb,
                scan_details JSONB DEFAULT '{}'::jsonb,
                status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
                uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                reviewed_at TIMESTAMP WITH TIME ZONE,
                reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
                scan_id UUID REFERENCES security_scans(id) ON DELETE SET NULL
            )
        `);
        await client.query('ALTER TABLE quarantine ADD COLUMN IF NOT EXISTS scan_id UUID REFERENCES security_scans(id) ON DELETE SET NULL');
        try {
            await client.query('ALTER TABLE quarantine DROP CONSTRAINT IF EXISTS quarantine_share_id_fkey');
            await client.query('ALTER TABLE quarantine ADD CONSTRAINT quarantine_share_id_fkey FOREIGN KEY (share_id) REFERENCES share_links(id) ON DELETE CASCADE');
        } catch (e) {
            logger.warn(`[Database Migration] Failed to adjust quarantine_share_id_fkey: ${e.message}`);
        }
        await client.query('CREATE INDEX IF NOT EXISTS idx_quarantine_status ON quarantine(status)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_quarantine_verdict ON quarantine(verdict)');

        // 5b. Create SECURITY_THREATS table
        await client.query(`
            CREATE TABLE IF NOT EXISTS security_threats (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                scan_id UUID REFERENCES security_scans(id) ON DELETE CASCADE,
                threat_name VARCHAR(255) NOT NULL,
                severity VARCHAR(50) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
                description TEXT
            )
        `);

        // 5c. Create SECURITY_EVENTS table
        await client.query(`
            CREATE TABLE IF NOT EXISTS security_events (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                event_type VARCHAR(100) NOT NULL,
                details JSONB DEFAULT '{}'::jsonb,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 6. Create SYNC TASKS table
        await client.query(`
            CREATE TABLE IF NOT EXISTS sync_tasks (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                name VARCHAR(150) NOT NULL,
                source_node VARCHAR(100) NOT NULL,
                source_path TEXT NOT NULL,
                dest_node VARCHAR(100) NOT NULL,
                dest_path TEXT NOT NULL,
                mode VARCHAR(50) DEFAULT 'incremental' CHECK (mode IN ('incremental', 'mirror')),
                cron_expression VARCHAR(100),
                interval_minutes INTEGER,
                active BOOLEAN DEFAULT TRUE,
                sanitize_media BOOLEAN DEFAULT FALSE,
                last_run TIMESTAMP WITH TIME ZONE,
                next_run TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await client.query('CREATE INDEX IF NOT EXISTS idx_sync_tasks_active ON sync_tasks(active)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_sync_tasks_next_run ON sync_tasks(next_run)');
        await client.query('ALTER TABLE sync_tasks ADD COLUMN IF NOT EXISTS last_status VARCHAR(100)');

        // 7. Create SYNC HISTORY table
        await client.query(`
            CREATE TABLE IF NOT EXISTS sync_history (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                task_id UUID REFERENCES sync_tasks(id) ON DELETE CASCADE,
                run_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                status VARCHAR(50) NOT NULL CHECK (status IN ('Success', 'Failed', 'Running')),
                files_copied INTEGER DEFAULT 0,
                bytes_transferred BIGINT DEFAULT 0,
                errors TEXT
            )
        `);
        await client.query('CREATE INDEX IF NOT EXISTS idx_sync_history_task ON sync_history(task_id, run_time DESC)');



        // 10. Create APP_SETTINGS table
        await client.query(`
            CREATE TABLE IF NOT EXISTS app_settings (
                key VARCHAR(100) PRIMARY KEY,
                value TEXT
            )
        `);

        // 11. Create SHARE_SECURITY table
        await client.query(`
            CREATE TABLE IF NOT EXISTS share_security (
                id SERIAL PRIMARY KEY,
                share_id UUID REFERENCES share_links(id) ON DELETE CASCADE,
                password_hash VARCHAR(255),
                email_verification BOOLEAN DEFAULT FALSE,
                max_views INTEGER DEFAULT -1,
                max_downloads INTEGER DEFAULT -1,
                allowed_extensions TEXT,
                max_file_size BIGINT DEFAULT -1
            )
        `);

        // 12. Create SHARE_UPLOADS table
        await client.query(`
            CREATE TABLE IF NOT EXISTS share_uploads (
                id SERIAL PRIMARY KEY,
                share_id UUID REFERENCES share_links(id) ON DELETE CASCADE,
                file_name VARCHAR(255) NOT NULL,
                size BIGINT NOT NULL,
                uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                ip_address VARCHAR(50)
            )
        `);

        // 13. Create SHARE_ACCESS_LOGS table
        await client.query(`
            CREATE TABLE IF NOT EXISTS share_access_logs (
                id SERIAL PRIMARY KEY,
                share_id UUID REFERENCES share_links(id) ON DELETE CASCADE,
                share_link_id UUID REFERENCES share_links(id) ON DELETE CASCADE,
                ip_address VARCHAR(50),
                browser VARCHAR(150),
                user_agent TEXT,
                country VARCHAR(100),
                country_code VARCHAR(10),
                action VARCHAR(100),
                status VARCHAR(100),
                timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Migration/Compatibility for existing databases
        await client.query('ALTER TABLE share_access_logs ADD COLUMN IF NOT EXISTS share_link_id UUID REFERENCES share_links(id) ON DELETE CASCADE');
        await client.query('ALTER TABLE share_access_logs ADD COLUMN IF NOT EXISTS user_agent TEXT');
        await client.query('ALTER TABLE share_access_logs ADD COLUMN IF NOT EXISTS country_code VARCHAR(10)');
        await client.query('ALTER TABLE share_access_logs ADD COLUMN IF NOT EXISTS status VARCHAR(100)');
        await client.query('ALTER TABLE share_access_logs ADD COLUMN IF NOT EXISTS browser VARCHAR(150)');
        await client.query('ALTER TABLE share_access_logs ADD COLUMN IF NOT EXISTS country VARCHAR(100)');
        await client.query('ALTER TABLE share_access_logs ADD COLUMN IF NOT EXISTS action VARCHAR(100)');
        await client.query('ALTER TABLE share_access_logs ADD COLUMN IF NOT EXISTS timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP');
        await client.query('ALTER TABLE share_access_logs ALTER COLUMN action DROP NOT NULL');

        // 14. Create SYSTEM_ALERTS table
        await client.query(`
            CREATE TABLE IF NOT EXISTS system_alerts (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                name VARCHAR(255) NOT NULL,
                status TEXT NOT NULL,
                error VARCHAR(50) DEFAULT 'info' CHECK (error IN ('info', 'warning', 'error')),
                timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await client.query('CREATE INDEX IF NOT EXISTS idx_system_alerts_timestamp ON system_alerts(timestamp DESC)');

        // 15. Create TRASH_ITEMS table
        await client.query(`
            CREATE TABLE IF NOT EXISTS trash_items (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                original_name VARCHAR(255) NOT NULL,
                original_path TEXT NOT NULL,
                trash_path TEXT NOT NULL,
                size BIGINT DEFAULT 0,
                is_directory BOOLEAN DEFAULT FALSE,
                deleted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                deleted_by UUID REFERENCES users(id) ON DELETE SET NULL,
                agent_id VARCHAR(100)
            )
        `);
        await client.query('CREATE INDEX IF NOT EXISTS idx_trash_items_deleted_by ON trash_items(deleted_by)');

        // 16. Create STARRED_ITEMS table
        await client.query(`
            CREATE TABLE IF NOT EXISTS starred_items (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                path TEXT NOT NULL,
                name VARCHAR(500) NOT NULL,
                is_directory BOOLEAN DEFAULT FALSE,
                starred_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, path)
            )
        `);
        await client.query('CREATE INDEX IF NOT EXISTS idx_starred_items_user ON starred_items(user_id)');

        // 17. Create TAGS table
        await client.query(`
            CREATE TABLE IF NOT EXISTS tags (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                name VARCHAR(100) NOT NULL,
                color VARCHAR(20) DEFAULT '#6366f1',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, name)
            )
        `);
        await client.query('CREATE INDEX IF NOT EXISTS idx_tags_user ON tags(user_id)');

        // 18. Create FILE_TAGS join table
        await client.query(`
            CREATE TABLE IF NOT EXISTS file_tags (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                path TEXT NOT NULL,
                tagged_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(tag_id, path)
            )
        `);
        await client.query('CREATE INDEX IF NOT EXISTS idx_file_tags_path ON file_tags(path)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_file_tags_tag ON file_tags(tag_id)');

        // 19. Create FILE_COMMENTS table
        await client.query(`
            CREATE TABLE IF NOT EXISTS file_comments (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                path TEXT NOT NULL,
                comment TEXT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await client.query('CREATE INDEX IF NOT EXISTS idx_file_comments_path ON file_comments(path)');

        // 20. Create FILE_VERSIONS table
        await client.query(`
            CREATE TABLE IF NOT EXISTS file_versions (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                user_id UUID REFERENCES users(id) ON DELETE SET NULL,
                original_path TEXT NOT NULL,
                version_num INTEGER NOT NULL DEFAULT 1,
                stored_path TEXT NOT NULL,
                size BIGINT DEFAULT 0,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await client.query('CREATE INDEX IF NOT EXISTS idx_file_versions_path ON file_versions(original_path)');

        // 21. Create AUDIT_LOGS table (Cryptographically Tamper-Evident Hash Chain)
        await client.query(`
            CREATE TABLE IF NOT EXISTS audit_logs (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                user_id UUID REFERENCES users(id) ON DELETE SET NULL,
                username VARCHAR(100),
                action VARCHAR(100) NOT NULL,
                details TEXT,
                ip_address VARCHAR(50),
                user_agent TEXT,
                timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                prev_hash VARCHAR(64) DEFAULT '0000000000000000000000000000000000000000000000000000000000000000',
                entry_hash VARCHAR(64)
            )
        `);
        await client.query('ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS prev_hash VARCHAR(64) DEFAULT \'0000000000000000000000000000000000000000000000000000000000000000\'');
        await client.query('ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entry_hash VARCHAR(64)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_username ON audit_logs(username)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_entry_hash ON audit_logs(entry_hash)');

        // 22. Create LOCKERS table
        await client.query(`
            CREATE TABLE IF NOT EXISTS lockers (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                name VARCHAR(100) NOT NULL,
                parent_path TEXT NOT NULL,
                vault_path TEXT NOT NULL,
                size_mb INTEGER DEFAULT -1,
                salt VARCHAR(255) NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                encryption_algorithm VARCHAR(50) DEFAULT 'AES-256-CTR',
                auto_lock_timeout INTEGER DEFAULT 15,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                user_id UUID REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        // 23. Create FILE_COMMENTS table
        await client.query(`
            CREATE TABLE IF NOT EXISTS file_comments (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                file_path TEXT,
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                username VARCHAR(100) NOT NULL,
                comment TEXT NOT NULL,
                pinned BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await client.query('ALTER TABLE file_comments ADD COLUMN IF NOT EXISTS file_path TEXT');
        await client.query('CREATE INDEX IF NOT EXISTS idx_file_comments_path ON file_comments(file_path)');

        // 24. Create ENCRYPTED_SECRETS table
        await client.query(`
            CREATE TABLE IF NOT EXISTS encrypted_secrets (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                title VARCHAR(255) NOT NULL,
                category VARCHAR(50) DEFAULT 'general',
                encrypted_payload TEXT NOT NULL,
                iv VARCHAR(64) NOT NULL,
                auth_tag VARCHAR(64) NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await client.query('CREATE INDEX IF NOT EXISTS idx_encrypted_secrets_user ON encrypted_secrets(user_id)');

        // 25. Create BANNED_IPS table for persistent firewall bans
        await client.query(`
            CREATE TABLE IF NOT EXISTS banned_ips (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                ip VARCHAR(50) NOT NULL UNIQUE,
                country VARCHAR(10) DEFAULT 'XX',
                country_name VARCHAR(100) DEFAULT 'Unknown',
                reason TEXT DEFAULT 'Manual Administrator Blacklist',
                attempts INTEGER DEFAULT 1,
                banned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours'),
                banned_by VARCHAR(100) DEFAULT 'system'
            )
        `);
        await client.query('CREATE INDEX IF NOT EXISTS idx_banned_ips_ip ON banned_ips(ip)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_banned_ips_expires ON banned_ips(expires_at)');

        // 26. Create GEOFENCE_CONFIG table for persistent geofence settings
        await client.query(`
            CREATE TABLE IF NOT EXISTS geofence_config (
                id INTEGER PRIMARY KEY DEFAULT 1,
                mode VARCHAR(50) DEFAULT 'whitelist_all',
                blocked_countries JSONB DEFAULT '["RU","KP","IR","CN"]'::jsonb
            )
        `);
        await client.query(`
            INSERT INTO geofence_config (id, mode, blocked_countries)
            VALUES (1, 'whitelist_all', '["RU","KP","IR","CN"]'::jsonb)
            ON CONFLICT (id) DO NOTHING
        `);

        // 27. Create CLUSTER_SITES table for Multi-Site / Multi-Region Federation
        await client.query(`
            CREATE TABLE IF NOT EXISTS cluster_sites (
                id VARCHAR(100) PRIMARY KEY,
                name VARCHAR(150) NOT NULL,
                location VARCHAR(150) DEFAULT 'Remote Site',
                endpoint_url VARCHAR(255),
                tunnel_token VARCHAR(255),
                connection_mode VARCHAR(50) DEFAULT 'hub-spoke',
                status VARCHAR(50) DEFAULT 'connected',
                storage_capacity_bytes BIGINT DEFAULT 0,
                storage_used_bytes BIGINT DEFAULT 0,
                latency_ms INTEGER DEFAULT 0,
                details JSONB DEFAULT '{}'::jsonb,
                last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await client.query('ALTER TABLE cluster_sites ADD COLUMN IF NOT EXISTS details JSONB DEFAULT \'{}\'::jsonb');

        // 28. Create CROSS_SITE_SYNC_JOBS table for site-to-site replication
        await client.query(`
            CREATE TABLE IF NOT EXISTS cross_site_sync_jobs (
                id VARCHAR(100) PRIMARY KEY,
                name VARCHAR(150) NOT NULL,
                source_site_id VARCHAR(100) NOT NULL,
                source_path VARCHAR(500) NOT NULL,
                target_site_id VARCHAR(100) NOT NULL,
                target_path VARCHAR(500) NOT NULL,
                sync_mode VARCHAR(50) DEFAULT 'mirror',
                schedule_cron VARCHAR(50) DEFAULT '0 */6 * * *',
                status VARCHAR(50) DEFAULT 'idle',
                last_sync_status VARCHAR(50) DEFAULT 'idle',
                last_sync_time TIMESTAMP WITH TIME ZONE,
                last_run_at TIMESTAMP WITH TIME ZONE,
                bytes_transferred BIGINT DEFAULT 0,
                last_transferred_bytes BIGINT DEFAULT 0,
                enabled BOOLEAN DEFAULT true,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await client.query('ALTER TABLE cross_site_sync_jobs ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT \'idle\'');
        await client.query('ALTER TABLE cross_site_sync_jobs ADD COLUMN IF NOT EXISTS last_run_at TIMESTAMP WITH TIME ZONE');
        await client.query('ALTER TABLE cross_site_sync_jobs ADD COLUMN IF NOT EXISTS last_transferred_bytes BIGINT DEFAULT 0');
        const settingsCheck = await client.query("SELECT * FROM app_settings WHERE key = 'appName'");
        if (settingsCheck.rows.length === 0) {
            await client.query("INSERT INTO app_settings (key, value) VALUES ('appName', 'NexaDisk')");
        }

        // Check if initial setup is completed
        const setupCheck = await client.query("SELECT value FROM app_settings WHERE key = 'initial_setup_completed'");
        const isSetupCompleted = setupCheck.rows[0]?.value === 'true';

        // Seed default admin user ONLY if not in initial setup mode and no users exist
        if (isSetupCompleted) {
            const adminCheck = await client.query("SELECT * FROM users WHERE username = 'admin'");
            if (adminCheck.rows.length === 0) {
                const bcrypt = require('bcrypt');
                const crypto = require('crypto');
                const adminPass = crypto.randomBytes(16).toString('hex');
                const adminPassHash = await bcrypt.hash(adminPass, 10);
                await client.query(
                    "INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)",
                    ['admin', adminPassHash, 'Admin']
                );
                logger.warn('******************************************************************');
                logger.warn(`REGENERATED ADMINISTRATOR PASSWORD: ${adminPass}`);
                logger.warn('******************************************************************');
            }
        }

        // Reset any sync tasks that were stuck in progress due to server crash/restart
        await client.query("UPDATE sync_tasks SET last_status = 'Failed' WHERE last_status = 'In Progress'");

        logger.info('✅ PostgreSQL tables successfully verified/initialized.');
    } catch (err) {
        logger.error('❌ Failed to connect to PostgreSQL or run initial schema creation:', err);
        logger.warn('Please ensure PostgreSQL is running and credentials in .env are configured.');
    } finally {
        if (client) client.release();
    }
}

module.exports = {
    pool,
    query: (text, params) => pool.query(text, params),
    initDatabase
};
