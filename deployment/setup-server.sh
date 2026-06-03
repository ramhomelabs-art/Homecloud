#!/bin/bash

# NexaDisk Professional: Debian/Ubuntu Master Setup Script
# Run: chmod +x setup-server.sh && sudo ./setup-server.sh

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}==============================================${NC}"
echo -e "${CYAN}    NexaDisk Professional Server Setup       ${NC}"
echo -e "${CYAN}==============================================${NC}"

# Root check
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}This script must be run as root (sudo)${NC}"
   exit 1
fi

# 1. System Updates
echo -e "${YELLOW}[1/7] Updating system packages...${NC}"
apt-get update -y && apt-get upgrade -y
apt-get install -y curl build-essential git unzip sqlite3 smbclient cifs-utils ufw nginx

# 2. Node.js 20.x
echo -e "${YELLOW}[2/7] Installing Node.js 20.x...${NC}"
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi
echo -e "${GREEN}  ✓ Node.js $(node -v) installed${NC}"

# 3. PM2 Global
echo -e "${YELLOW}[3/7] Installing PM2 Process Manager...${NC}"
npm install -g pm2
pm2 startup | tail -n 1 | bash

# 4. Directory & Permissions
echo -e "${YELLOW}[4/7] Setting up application directory...${NC}"
APP_DIR="/opt/nexadisk"
mkdir -p $APP_DIR
# Assuming current directory is the project root during deployment
cp -r . $APP_DIR/
useradd -m -s /bin/bash nexadisk || true
chown -R nexadisk:nexadisk $APP_DIR

# 5. Core Installation
echo -e "${YELLOW}[5/7] Installing dependencies...${NC}"
cd $APP_DIR
sudo -u nexadisk npm run install-all || {
    echo -e "${YELLOW}  ! run-script fail, trying manual install...${NC}"
    cd server && sudo -u nexadisk npm install && cd ..
    cd client && sudo -u nexadisk npm install && npm run build && cd ..
}

# 6. Systemd Service
echo -e "${YELLOW}[6/7] Configuring Systemd service...${NC}"
cat <<EOF > /etc/systemd/system/nexadisk.service
[Unit]
Description=NexaDisk Professional Server
After=network.target

[Service]
Type=simple
User=nexadisk
WorkingDirectory=/opt/nexadisk/server
ExecStart=/usr/bin/node index.js
Restart=always
Environment=NODE_ENV=production
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable nexadisk
systemctl start nexadisk

# 7. Nginx & Firewall
echo -e "${YELLOW}[7/7] Configuring Nginx Reverse Proxy & Firewall...${NC}"
cat <<EOF > /etc/nginx/sites-available/nexadisk
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

ln -sf /etc/nginx/sites-available/nexadisk /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx

# Firewall setup
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 22/tcp
echo "y" | ufw enable

echo -e "${GREEN}==============================================${NC}"
echo -e "${GREEN}    Setup Complete! NexaDisk is Ready.       ${NC}"
echo -e "${GREEN}==============================================${NC}"
echo -e "${CYAN}Access your server at: http://$(hostname -I | awk '{print $1}')${NC}"
echo -e "${CYAN}Manage service: sudo systemctl status nexadisk${NC}"
