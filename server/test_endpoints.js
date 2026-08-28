const jwt = require('jsonwebtoken');
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const SECRET_KEY = process.env.JWT_SECRET;
const token = jwt.sign(
    { id: 'd0379c98-e674-4098-9277-55b137facd67', username: 'admin', role: 'Admin' },
    SECRET_KEY,
    { expiresIn: '24h' }
);

const headers = { Authorization: `Bearer ${token}` };
const endpoints = [
    { name: 'stats', url: 'http://localhost:5000/api/v1/security/stats' },
    { name: 'quarantine', url: 'http://localhost:5000/api/v1/security/quarantine' },
    { name: 'policy', url: 'http://localhost:5000/api/v1/security/policy' },
    { name: 'events', url: 'http://localhost:5000/api/v1/security/events' },
    { name: 'agents', url: 'http://localhost:5000/api/v1/agents' }
];

async function run() {
    console.log("Testing endpoints...");
    for (const ep of endpoints) {
        try {
            const res = await axios.get(ep.url, { headers });
            console.log(`[PASS] ${ep.name}: status ${res.status}, keys:`, Object.keys(res.data));
        } catch (err) {
            console.error(`[FAIL] ${ep.name}:`, err.response ? `${err.response.status} - ${JSON.stringify(err.response.data)}` : err.message);
        }
    }
}

run();
