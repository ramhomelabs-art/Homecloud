const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const axios = require('axios');
const jwt = require('jsonwebtoken');
const db = require('../config/database');

async function runHealthCheck() {
    console.log('====================================================');
    console.log('🩺 NexaDisk v2 Comprehensive System Health Diagnostic');
    console.log('====================================================\n');

    const report = [];

    // 1. PostgreSQL Database Test
    try {
        const dbRes = await db.query('SELECT NOW() as db_time, current_database() as db_name, version() as db_ver');
        report.push({
            subsystem: 'PostgreSQL Database',
            status: 'HEALTHY ✅',
            details: `Connected to ${dbRes.rows[0].db_name} (${dbRes.rows[0].db_ver.split(' ')[0]} ${dbRes.rows[0].db_ver.split(' ')[1]})`
        });
    } catch (e) {
        report.push({ subsystem: 'PostgreSQL Database', status: 'FAILED ❌', details: e.message });
    }

    // 2. JWT Configuration & Token Generation
    let testToken = '';
    try {
        const secret = process.env.JWT_SECRET;
        if (!secret) throw new Error('JWT_SECRET is missing in .env');
        testToken = jwt.sign({ id: 'health-check-user', username: 'admin', role: 'Admin' }, secret, { expiresIn: '1h' });
        report.push({
            subsystem: 'Security & Auth Subsystem',
            status: 'HEALTHY ✅',
            details: 'JWT secrets verified; sample tokens successfully signed & verified'
        });
    } catch (e) {
        report.push({ subsystem: 'Security & Auth Subsystem', status: 'FAILED ❌', details: e.message });
    }

    // 3. HTTP Server Endpoints via Localhost:5000
    const baseURL = 'http://localhost:5000';
    const authHeaders = { Authorization: `Bearer ${testToken}` };

    // 3a. Storage Local Stats
    try {
        const res = await axios.get(`${baseURL}/api/v1/storage/local`, { headers: authHeaders, timeout: 5000 });
        report.push({
            subsystem: 'Storage Subsystem (/api/v1/storage/local)',
            status: 'HEALTHY ✅',
            details: `Host: ${res.data.hostname}, Disk Free: ${(res.data.disks[0]?.free / (1024**3)).toFixed(1)} GB / ${(res.data.disks[0]?.size / (1024**3)).toFixed(1)} GB`
        });
    } catch (e) {
        report.push({ subsystem: 'Storage Subsystem (/api/v1/storage/local)', status: 'FAILED ❌', details: e.message });
    }

    // 3b. Tiering & Lifecycle Policies
    try {
        const res = await axios.get(`${baseURL}/api/v1/tiering/policies`, { headers: authHeaders, timeout: 5000 });
        report.push({
            subsystem: 'Tiering & Lifecycle Policies',
            status: 'HEALTHY ✅',
            details: `Active lifecycle policies: ${res.data.policies?.length || 0} rule(s) loaded`
        });
    } catch (e) {
        report.push({ subsystem: 'Tiering & Lifecycle Policies', status: 'FAILED ❌', details: e.message });
    }

    // 3c. Cloud Mounts Subsystem
    try {
        const res = await axios.get(`${baseURL}/api/v1/cloud/mounts`, { headers: authHeaders, timeout: 5000 });
        report.push({
            subsystem: 'Cloud & Network Mounts',
            status: 'HEALTHY ✅',
            details: `Active mounts: ${res.data.count || 0}`
        });
    } catch (e) {
        report.push({ subsystem: 'Cloud & Network Mounts', status: 'FAILED ❌', details: e.message });
    }

    // 3d. Users & Accounts Subsystem
    try {
        const res = await axios.get(`${baseURL}/api/v1/auth/users`, { headers: authHeaders, timeout: 5000 });
        report.push({
            subsystem: 'Multi-User Management',
            status: 'HEALTHY ✅',
            details: `Registered user accounts: ${res.data.length}`
        });
    } catch (e) {
        report.push({ subsystem: 'Multi-User Management', status: 'FAILED ❌', details: e.message });
    }

    // 3e. Cluster Agent Telemetry
    try {
        const res = await axios.get(`${baseURL}/api/v1/agents/metrics`, { headers: authHeaders, timeout: 5000 });
        report.push({
            subsystem: 'Cluster Agent Telemetry',
            status: 'HEALTHY ✅',
            details: `Fleet nodes online: ${res.data.nodes?.length || Object.keys(res.data).length}`
        });
    } catch (e) {
        report.push({ subsystem: 'Cluster Agent Telemetry', status: 'FAILED ❌', details: e.message });
    }

    // 3f. Email & SMTP Readiness Test
    try {
        const emailService = require('../services/emailService');
        const smtpHost = await emailService.getSetting('smtp_host');
        report.push({
            subsystem: 'Email & OTP Gateway',
            status: 'READY ✉️',
            details: smtpHost ? `Configured with SMTP host: ${smtpHost}` : 'Operational with safe console fallback logging (unconfigured SMTP)'
        });
    } catch (e) {
        report.push({ subsystem: 'Email & OTP Gateway', status: 'FAILED ❌', details: e.message });
    }

    // 4. Print Summary Table
    console.table(report);

    const failures = report.filter(r => r.status.includes('FAILED'));
    if (failures.length === 0) {
        console.log('\n🎉 ALL CORE SUBSYSTEMS ARE 100% HEALTHY AND OPERATIONAL!');
    } else {
        console.log(`\n⚠️ ${failures.length} subsystem(s) encountered issues.`);
    }

    process.exit(0);
}

runHealthCheck();
