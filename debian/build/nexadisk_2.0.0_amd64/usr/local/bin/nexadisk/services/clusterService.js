const axios = require('axios');
const os = require('os');
const db = require('../config/database');
const eventBus = require('../utils/eventBus');
const logger = require('../utils/logger');

// Local in-memory state cache for agent details and telemetry history
const agentsState = {};
const telemetryHistory = {
    local: []
};

class ClusterService {
    constructor() {
        this.agents = agentsState;
        this.telemetryHistory = telemetryHistory;
    }

    async registerAgent({ id, hostname, url, disks }) {
        // Look up persistent status in PostgreSQL
        let res = await db.query('SELECT * FROM persistent_agents WHERE id = $1', [id]);
        let status = 'pending';

        if (res.rows.length === 0) {
            await db.query(
                'INSERT INTO persistent_agents (id, hostname, url, status) VALUES ($1, $2, $3, $4)',
                [id, hostname, url, 'pending']
            );
        } else {
            status = res.rows[0].status;
            // Update hostname/url if changed
            await db.query(
                'UPDATE persistent_agents SET hostname = $1, url = $2, lastSeen = CURRENT_TIMESTAMP WHERE id = $3',
                [hostname, url, id]
            );
        }

        // Cache state in memory
        this.agents[id] = {
            id,
            hostname,
            url,
            status,
            online: true,
            lastSeen: new Date(),
            ip: null,
            cpu: 0,
            memory: 0,
            disks: disks || []
        };

        if (!this.telemetryHistory[id]) {
            this.telemetryHistory[id] = [];
        }

        logger.info(`[ClusterService] Registered agent node: ${hostname} (${id}) with status "${status}"`);
        return { status };
    }

    async approveAgent(id, approve = true) {
        const status = approve ? 'approved' : 'rejected';
        await db.query('UPDATE persistent_agents SET status = $1 WHERE id = $2', [status, id]);

        if (this.agents[id]) {
            this.agents[id].status = status;
        }

        logger.info(`[ClusterService] Agent node ${id} status updated to: ${status}`);
        eventBus.publish('AGENT_STATUS_CHANGED', { id, status });
        return true;
    }

    async getAgentsList() {
        // Query persistent DB table
        const res = await db.query('SELECT * FROM persistent_agents');
        
        // Merge with active in-memory online state details
        return res.rows.map(row => {
            const cached = this.agents[row.id] || {};
            return {
                id: row.id,
                hostname: row.hostname,
                url: row.url,
                status: row.status,
                lastSeen: row.lastseen,
                online: cached.online || false,
                ip: cached.ip || null,
                cpu: cached.cpu || 0,
                memory: cached.memory || 0,
                disks: cached.disks || []
            };
        });
    }

    getTelemetryHistory() {
        return this.telemetryHistory;
    }

    // Dynamic CPU calculation using Node os ticks
    _getCPUUsage() {
        const cpus = os.cpus();
        let user = 0, nice = 0, sys = 0, idle = 0, irq = 0;
        for (const cpu of cpus) {
            user += cpu.times.user;
            nice += cpu.times.nice;
            sys += cpu.times.sys;
            idle += cpu.times.idle;
            irq += cpu.times.irq;
        }
        const total = user + nice + sys + idle + irq;
        return { idle, total };
    }

    startTelemetryPolling() {
        logger.info('[ClusterService] Starting Master & Remote Agent telemetry polling loop (10s intervals)...');
        
        let lastCPU = this._getCPUUsage();

        setInterval(async () => {
            // 1. Calculate Local Master CPU/Memory
            const nextCPU = this._getCPUUsage();
            const idleDiff = nextCPU.idle - lastCPU.idle;
            const totalDiff = nextCPU.total - lastCPU.total;
            const cpuPercentage = totalDiff > 0 ? Math.round(100 * (1 - idleDiff / totalDiff)) : 0;
            lastCPU = nextCPU;

            const totalMem = os.totalmem();
            const freeMem = os.freemem();
            const memPercentage = Math.round(100 * (1 - freeMem / totalMem));

            const localMetric = {
                timestamp: new Date().toISOString(),
                cpu: cpuPercentage,
                memory: memPercentage,
                latency: 0
            };

            this.telemetryHistory.local.push(localMetric);
            if (this.telemetryHistory.local.length > 30) this.telemetryHistory.local.shift();

            // 2. Poll Remote Agents
            for (const agentId of Object.keys(this.agents)) {
                const agent = this.agents[agentId];
                if (agent.status !== 'approved') continue;

                const startTime = Date.now();
                try {
                    const res = await axios.get(`${agent.url}/api/storage/local`, { timeout: 3000 });
                    const latency = Date.now() - startTime;
                    
                    const cpu = res.data?.cpu || 0;
                    const memory = res.data?.memory || 0;
                    const disks = res.data?.disks || [];
                    const ip = res.data?.ip || null;

                    agent.online = true;
                    agent.ip = ip;
                    agent.cpu = cpu;
                    agent.memory = memory;
                    agent.disks = disks;
                    agent.lastSeen = new Date();

                    const metric = {
                        timestamp: new Date().toISOString(),
                        cpu,
                        memory,
                        latency
                    };

                    this.telemetryHistory[agentId].push(metric);
                    if (this.telemetryHistory[agentId].length > 30) this.telemetryHistory[agentId].shift();
                } catch (err) {
                    // Node went offline
                    if (agent.online) {
                        logger.warn(`Agent node ${agent.hostname} (${agentId}) transitioned to OFFLINE: ${err.message}`);
                        agent.online = false;
                        eventBus.publish('AGENT_WENT_OFFLINE', { id: agentId, hostname: agent.hostname });
                    }
                }
            }
        }, 10000); // 10-second telemetry polling
    }
}

const clusterService = new ClusterService();
module.exports = clusterService;
