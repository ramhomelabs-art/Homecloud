#!/bin/bash

# NexaDisk Master Installation Script for Debian/Ubuntu
# Version: 1.0.0
# Description: Automates the deployment of NexaDisk Professional including 
# System updates, Node.js 20, Nginx reverse proxy, and Systemd service.

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}====================================================${NC}"
echo -e "${CYAN}    NexaDisk Professional Deployment (Debian)       ${NC}"
echo -e "${CYAN}====================================================${NC}"

# Check for root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}Error: This script must be run as root (sudo).${NC}"
   exit 1
fi

# 1. Prerequisites & System Updates
echo -e "${YELLOW}[1/6] Updating system and installing dependencies...${NC}"
apt-get update -y && apt-get upgrade -y
apt-get install -y curl build-essential git unzip rsync cifs-utils sqlite3 nginx ufw

# 2. Node.js 20.x Installation
echo -e "${YELLOW}[2/6] Setting up Node.js 20.x environment...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${CYAN}Downloading and installing Node.js 20.x...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi
echo -e "${GREEN}✓ Node.js $(node -v) is active.${NC}"

# 3. Application Directory & User
echo -e "${YELLOW}[3/6] Configuring application environment...${NC}"
APP_DIR="/opt/nexadisk"
echo -e "${CYAN}Deploying application to $APP_DIR...${NC}"

if [ ! -d "$APP_DIR" ]; then
    mkdir -p "$APP_DIR"
fi

# Copy files from current directory (excluding node_modules)
CURRENT_DIR=$(pwd)
if [ "$CURRENT_DIR" != "$APP_DIR" ]; then
    echo -e "${CYAN}Syncing files to $APP_DIR...${NC}"
    rsync -av --exclude='node_modules' --exclude='.git' . "$APP_DIR/"
else
    echo -e "${YELLOW}Already in $APP_DIR, skipping redundant sync.${NC}"
    # Even if in same dir, ensure node_modules from other OS are removed
    rm -rf node_modules server/node_modules client/node_modules
fi

# Create dedicated user if not exists
if ! id "nexadisk" &>/dev/null; then
    echo -e "${CYAN}Creating 'nexadisk' system user...${NC}"
    useradd -m -r -s /bin/bash nexadisk
fi

chown -R nexadisk:nexadisk "$APP_DIR"

# 4. Dependency Installation & Build
echo -e "${YELLOW}[4/6] Installing dependencies and building frontend...${NC}"
cd "$APP_DIR"

# Server installation
echo -e "${CYAN}Installing backend dependencies...${NC}"
cd server
sudo -u nexadisk npm install
cd ..

# Client installation and build
echo -e "${CYAN}Installing frontend dependencies and building dashboard...${NC}"
cd client
sudo -u nexadisk npm install
sudo -u nexadisk npm run build
cd ..

# 5. Environment & Service Configuration
echo -e "${YELLOW}[5/6] Setting up system services...${NC}"

# Create .env if missing
if [ ! -f "$APP_DIR/.env" ]; then
    echo -e "${CYAN}Generating default production .env file...${NC}"
    cat <<EOF > "$APP_DIR/.env"
PORT=5000
NODE_ENV=production
JWT_SECRET=$(openssl rand -hex 64)
DB_PATH=./database.sqlite
UPLOAD_DIR=./uploads
CORS_ORIGIN=*
EOF
    chown nexadisk:nexadisk "$APP_DIR/.env"
fi

# Create Systemd Service
echo -e "${CYAN}Creating NexaDisk systemd service...${NC}"
cat <<EOF > /etc/systemd/system/nexadisk.service
[Unit]
Description=NexaDisk Professional Server
After=network.target

[Service]
Type=simple
User=nexadisk
WorkingDirectory=$APP_DIR/server
ExecStart=/usr/bin/node index.js
Restart=always
Environment=NODE_ENV=production
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=nexadisk

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable nexadisk
systemctl restart nexadisk

# 6. Nginx Reverse Proxy
echo -e "${YELLOW}[6/6] Configuring Nginx Reverse Proxy...${NC}"
cat <<EOF > /etc/nginx/sites-available/nexadisk
server {
    listen 80;
    server_name _; # Adjust to your domain if available

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        
        # Security headers
        add_header X-Frame-Options "SAMEORIGIN";
        add_header X-XSS-Protection "1; mode=block";
        add_header X-Content-Type-Options "nosniff";
    }

    # Optional: Increase client max body size for large uploads
    client_max_body_size 500M;
}
EOF

ln -sf /etc/nginx/sites-available/nexadisk /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
systemctl restart nginx

# Configure sudoers for network mounting
echo -e "${YELLOW}Configuring sudoers for network mounting...${NC}"
echo "nexadisk ALL=(ALL) NOPASSWD: /usr/bin/mount, /usr/bin/umount" > /etc/sudoers.d/nexadisk
chmod 440 /etc/sudoers.d/nexadisk

# Firewall Setup
echo -e "${YELLOW}Configuring Firewall (UFW)...${NC}"
ufw allow 80/tcp
ufw allow 22/tcp
echo "y" | ufw enable

echo -e "${GREEN}====================================================${NC}"
echo -e "${GREEN}    Installation Complete! NexaDisk is online.      ${NC}"
echo -e "${GREEN}====================================================${NC}"
echo -e "${CYAN}Local Access: http://$(hostname -I | awk '{print $1}')${NC}"
echo -e "${CYAN}Service Logs: sudo journalctl -u nexadisk -f${NC}"
echo -e "${CYAN}Configuration: $APP_DIR/server/.env${NC}"
echo -e "${CYAN}====================================================${NC}"
