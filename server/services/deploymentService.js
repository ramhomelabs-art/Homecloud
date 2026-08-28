const crypto = require('crypto');
const os = require('os');
const fs = require('fs');
const path = require('path');

class DeploymentService {
    generateProductionEnv({ port = 5000, storagePath = '/var/lib/nexadisk/storage', dbHost = '127.0.0.1', dbUser = 'nexadisk', dbName = 'nexadisk_db' } = {}) {
        const jwtSecret = crypto.randomBytes(32).toString('hex');
        const agentKey = crypto.randomBytes(24).toString('hex');
        const hmacSecret = crypto.randomBytes(32).toString('hex');
        const dbPass = crypto.randomBytes(16).toString('hex');

        return `# ==============================================================================
#  NEXADISK ENTERPRISE V2 - PRODUCTION ENVIRONMENT CONFIGURATION
#  Generated: ${new Date().toISOString()}
# ==============================================================================

NODE_ENV=production
PORT=${port}
HOST=0.0.0.0

# Storage Locations
STORAGE_ROOT=${storagePath}
TRASH_STORAGE_ROOT=${path.join(path.dirname(storagePath), 'trash')}

# Cryptographic Keys (Auto-Generated High Entropy)
JWT_SECRET=${jwtSecret}
AGENT_KEY=${agentKey}
HMAC_ENCRYPTION_SECRET=${hmacSecret}
CORS_ORIGIN=*

# PostgreSQL 16 Database
DATABASE_URL=postgres://${dbUser}:${dbPass}@${dbHost}:5432/${dbName}
DB_HOST=${dbHost}
DB_PORT=5432
DB_NAME=${dbName}
DB_USER=${dbUser}
DB_PASSWORD=${dbPass}
`;
    }

    generateSystemdService({ installDir = '/opt/nexadisk', user = 'nexadisk' } = {}) {
        return `[Unit]
Description=NexaDisk V2 Enterprise Storage Service
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=${user}
Group=${user}
WorkingDirectory=${installDir}
EnvironmentFile=${installDir}/.env
ExecStart=/usr/bin/node server/index.js
Restart=always
RestartSec=5s
LimitNOFILE=65536
LimitNPROC=4096
StandardOutput=append:/var/log/nexadisk/service.log
StandardError=append:/var/log/nexadisk/error.log

# Sandboxing
ProtectSystem=full
ProtectHome=true
PrivateTmp=true
AmbientCapabilities=CAP_SYS_ADMIN

[Install]
WantedBy=multi-user.target
`;
    }

    generateNginxConfig({ domain = 'storage.example.com', backendPort = 5000 } = {}) {
        return `server {
    listen 80;
    server_name ${domain};
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ${domain};

    ssl_certificate /etc/letsencrypt/live/${domain}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${domain}/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    client_max_body_size 100G;

    location / {
        proxy_pass http://127.0.0.1:${backendPort};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
        proxy_buffering off;
    }
}
`;
    }

    getDeploymentPreflight() {
        const mem = process.memoryUsage();
        return {
            platform: os.platform(),
            arch: os.arch(),
            release: os.release(),
            hostname: os.hostname(),
            nodeVersion: process.version,
            cpuCount: os.cpus().length,
            totalMemoryGB: (os.totalmem() / 1e9).toFixed(2),
            freeMemoryGB: (os.freemem() / 1e9).toFixed(2),
            uptimeHours: (os.uptime() / 3600).toFixed(1),
            processMemoryMB: (mem.rss / 1e6).toFixed(1),
            recommendedMode: os.platform() === 'win32' ? 'Native Windows Service' : 'Systemd / Docker Compose',
            status: 'Ready for Deployment'
        };
    }
}

module.exports = new DeploymentService();
