const { Client } = require('pg');
require('dotenv').config();

async function check() {
    const client = new Client({
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_DATABASE || 'nexadisk',
        password: process.env.DB_PASSWORD || 'postgres',
        port: parseInt(process.env.DB_PORT || '5432', 10),
    });
    await client.connect();
    console.log("Connected successfully to DB.");
    
    // Check users
    const usersRes = await client.query(`SELECT id, username, role FROM users`);
    console.log("Users:", usersRes.rows);

    // Check security events
    try {
        const eventsRes = await client.query(`SELECT * FROM security_events ORDER BY created_at DESC LIMIT 10`);
        console.log("Security events (last 10):", JSON.stringify(eventsRes.rows, null, 2));
    } catch (err) {
        console.error("Error reading security_events table:", err.message);
    }
    
    await client.end();
}
check().catch(console.error);
