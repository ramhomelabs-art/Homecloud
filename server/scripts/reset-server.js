const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const db = require('../config/database');

async function resetServer() {
    console.log('====================================================');
    console.log('🔄 NexaDisk Enterprise Server Factory Reset');
    console.log('====================================================\n');

    try {
        console.log('⏳ Connecting to PostgreSQL database...');
        
        const tablesToClear = [
            'users', 'cluster_sites', 'cross_site_sync_jobs', 'persistent_agents',
            'share_links', 'network_shares', 'security_scans', 'system_alerts',
            'trash_items', 'lockers', 'sync_tasks', 'cloud_mounts', 'audit_logs',
            'file_stars', 'file_tags', 'file_comments', 'file_versions'
        ];

        for (const table of tablesToClear) {
            try {
                await db.query(`DELETE FROM ${table}`);
            } catch (e) {
                // Table might not exist yet, safe to ignore
            }
        }

        // 2. Reset app_settings to factory default
        console.log('⚙️ Resetting setup state to First-Time OOBE mode...');
        await db.query(`
            INSERT INTO app_settings (key, value) 
            VALUES ('initial_setup_completed', 'false') 
            ON CONFLICT (key) DO UPDATE SET value = 'false'
        `);

        await db.query(`
            INSERT INTO app_settings (key, value) 
            VALUES ('appName', 'NexaDisk') 
            ON CONFLICT (key) DO UPDATE SET value = 'NexaDisk'
        `);

        console.log('\n====================================================');
        console.log('✅ FACTORY RESET COMPLETE!');
        console.log('====================================================');
        console.log('1. Open http://localhost:5173 in your browser.');
        console.log('2. The First-Time Welcome & Setup Wizard will launch automatically.');
        console.log('3. You can configure your Super Admin account and cluster from scratch.\n');

        process.exit(0);
    } catch (err) {
        console.error('❌ Reset failed:', err.message);
        process.exit(1);
    }
}

resetServer();
