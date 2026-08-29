/**
 * update-db.js — NexaDisk Database Schema & Migration Runner
 * Usage: node scripts/update-db.js
 * Automatically verifies, updates, and migrates all PostgreSQL tables and schemas.
 */

require('dotenv').config();
const { initDatabase, pool } = require('../config/database');
const logger = require('../utils/logger');

async function runMigration() {
    console.log('---------------------------------------------------------');
    console.log('⚡ NexaDisk Database Schema & Migration Runner (v2.4.4)');
    console.log('---------------------------------------------------------');
    console.log('Connecting to PostgreSQL database...');

    try {
        await initDatabase();
        console.log('✅ All PostgreSQL schemas, tables, and migrations updated successfully.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Database migration error:', err);
        process.exit(1);
    } finally {
        try {
            await pool.end();
        } catch (_) {}
    }
}

runMigration();
