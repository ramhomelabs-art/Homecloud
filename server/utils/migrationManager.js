/**
 * Database Migration System
 * Handles database schema versioning and migrations
 */

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

class MigrationManager {
    constructor(dbPath) {
        this.db = new sqlite3.Database(dbPath);
        this.migrationsDir = path.join(__dirname, '../migrations');
    }

    // Initialize migrations table
    async init() {
        return new Promise((resolve, reject) => {
            this.db.run(`
                CREATE TABLE IF NOT EXISTS migrations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT UNIQUE NOT NULL,
                    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    // Get applied migrations
    async getAppliedMigrations() {
        return new Promise((resolve, reject) => {
            this.db.all('SELECT name FROM migrations ORDER BY id', (err, rows) => {
                if (err) reject(err);
                else resolve(rows.map(r => r.name));
            });
        });
    }

    // Get pending migrations
    async getPendingMigrations() {
        const applied = await this.getAppliedMigrations();
        const allMigrations = fs.readdirSync(this.migrationsDir)
            .filter(f => f.endsWith('.sql'))
            .sort();

        return allMigrations.filter(m => !applied.includes(m));
    }

    // Run a single migration
    async runMigration(filename) {
        const filePath = path.join(this.migrationsDir, filename);
        const sql = fs.readFileSync(filePath, 'utf8');

        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                this.db.run('BEGIN TRANSACTION');

                this.db.exec(sql, (err) => {
                    if (err) {
                        this.db.run('ROLLBACK');
                        reject(err);
                        return;
                    }

                    this.db.run(
                        'INSERT INTO migrations (name) VALUES (?)',
                        [filename],
                        (err) => {
                            if (err) {
                                this.db.run('ROLLBACK');
                                reject(err);
                                return;
                            }

                            this.db.run('COMMIT', (err) => {
                                if (err) reject(err);
                                else resolve();
                            });
                        }
                    );
                });
            });
        });
    }

    // Run all pending migrations
    async migrate() {
        await this.init();
        const pending = await this.getPendingMigrations();

        if (pending.length === 0) {
            console.log('✅ No pending migrations');
            return;
        }

        console.log(`📦 Running ${pending.length} migration(s)...`);

        for (const migration of pending) {
            try {
                await this.runMigration(migration);
                console.log(`✅ Applied: ${migration}`);
            } catch (err) {
                console.error(`❌ Failed to apply ${migration}:`, err.message);
                throw err;
            }
        }

        console.log('✅ All migrations completed');
    }

    // Close database connection
    close() {
        this.db.close();
    }
}

module.exports = MigrationManager;
