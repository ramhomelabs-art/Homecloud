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

async function run() {
    try {
        const res = await axios.get('http://localhost:5001/api/v1/agents/metrics', { headers });
        console.log("Status:", res.status);
        console.log("Metrics payload keys:", Object.keys(res.data));
        console.log("Local Metrics History (last 3):", JSON.stringify(res.data.metricsHistory?.local?.slice(-3), null, 2));
    } catch (err) {
        console.error("Error:", err.response ? `${err.response.status} - ${JSON.stringify(err.response.data)}` : err.message);
    }
}

run();
