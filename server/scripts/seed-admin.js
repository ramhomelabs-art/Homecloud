const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const bcrypt = require('bcrypt');
const { pool } = require('../config/database');

async function seed() {
    let client;
    try {
        client = await pool.connect();
        
        // Initialize DB structure
        const { initDatabase } = require('../config/database');
        await initDatabase();
        
        // Verify or seed admin
        const res = await client.query("SELECT * FROM users WHERE username = 'admin'");
        if (res.rows.length === 0) {
            const hash = await bcrypt.hash('admin123', 10);
            await client.query("INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)", ['admin', hash, 'Admin']);
            console.log("==========================================================");
            console.log(" SEED STATUS: DEFAULT ADMIN CREATED                       ");
            console.log(" Username: admin                                          ");
            console.log(" Password: admin123                                       ");
            console.log(" IMPORTANT: Change this password upon first login!         ");
            console.log("==========================================================");
        } else {
            console.log("==========================================================");
            console.log(" SEED STATUS: Admin user already exists. Skipping seed.   ");
            console.log("==========================================================");
        }
    } catch (e) {
        console.error("SEED ERROR: ", e);
        process.exit(1);
    } finally {
        if (client) client.release();
        await pool.end();
    }
}

seed();
