const jwt = require('jsonwebtoken');
const axios = require('axios');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const SECRET_KEY = process.env.JWT_SECRET;
const token = jwt.sign(
    { id: 'd0379c98-e674-4098-9277-55b137facd67', username: 'admin', role: 'Admin' },
    SECRET_KEY,
    { expiresIn: '24h' }
);

const headers = { Authorization: `Bearer ${token}` };

async function run() {
    try {
        console.log("Saving policy via POST...");
        const postRes = await axios.post('http://localhost:5000/api/v1/security/policy', {
            quarantineMode: 'block',
            whitelistExts: 'txt, log, .csv',
            maxScanSize: '50'
        }, { headers });
        console.log("POST Response:", postRes.status, postRes.data);

        // Now query database directly to verify
        const client = new Client({
            user: process.env.DB_USER || 'postgres',
            host: process.env.DB_HOST || 'localhost',
            database: process.env.DB_DATABASE || 'nexadisk',
            password: process.env.DB_PASSWORD || 'postgres',
            port: parseInt(process.env.DB_PORT || '5432', 10),
        });
        await client.connect();
        const res = await client.query(`SELECT * FROM app_settings`);
        console.log("DB app_settings after POST:", res.rows);
        await client.end();
    } catch (err) {
        console.error("Error:", err.response ? `${err.response.status} - ${JSON.stringify(err.response.data)}` : err.message);
    }
}

run();
