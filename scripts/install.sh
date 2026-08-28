#!/usr/bin/env bash
# ==============================================================================
#  NEXADISK V2 - ENTERPRISE PRODUCTION INSTALLER (LINUX)
#  Automated deployment for Ubuntu, Debian, RHEL, Rocky Linux, and Alpine.
# ==============================================================================

set -e

COLOR_CYAN='\033[0;36m'
COLOR_GREEN='\033[0;32m'
COLOR_YELLOW='\033[1;33m'
COLOR_RED='\033[0;31m'
COLOR_RESET='\033[0m'

echo -e "${COLOR_CYAN}"
echo "================================================================"
echo "          NEXADISK ENTERPRISE STORAGE V2 - INSTALLER            "
echo "================================================================"
echo -e "${COLOR_RESET}"

# Check for root / sudo
if [ "$EUID" -ne 0 ]; then
  echo -e "${COLOR_RED}[!] Error: Please run this installer as root or with sudo.${COLOR_RESET}"
  exit 1
fi

INSTALL_DIR=${INSTALL_DIR:-"/opt/nexadisk"}
SERVICE_USER=${SERVICE_USER:-"nexadisk"}
HTTP_PORT=${HTTP_PORT:-5000}
DATA_ROOT=${DATA_ROOT:-"/var/lib/nexadisk/storage"}

echo -e "${COLOR_YELLOW}[*] Target Installation Directory: ${INSTALL_DIR}${COLOR_RESET}"
echo -e "${COLOR_YELLOW}[*] Storage Data Root:            ${DATA_ROOT}${COLOR_RESET}"
echo -e "${COLOR_YELLOW}[*] Listening Port:               ${HTTP_PORT}${COLOR_RESET}"

# 1. Install prerequisites
echo -e "\n${COLOR_CYAN}[1/5] Checking and installing system dependencies...${COLOR_RESET}"
if command -v apt-get >/dev/null 2>&1; then
    apt-get update -y
    apt-get install -y curl wget git build-essential smartmontools ffmpeg openssl libcap2-bin postgresql postgresql-contrib
elif command -v dnf >/dev/null 2>&1; then
    dnf install -y curl wget git gcc-c++ make smartmontools ffmpeg openssl postgresql-server postgresql-contrib
elif command -v apk >/dev/null 2>&1; then
    apk add --no-cache curl wget git build-base smartmontools ffmpeg openssl postgresql
fi

# Check Node.js
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d'.' -f1 | tr -d 'v')" -lt 18 ]; then
    echo -e "${COLOR_YELLOW}[*] Installing Node.js 20 LTS...${COLOR_RESET}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs || dnf install -y nodejs
fi

echo -e "${COLOR_GREEN}[✓] Node.js $(node -v) and runtime tools ready.${COLOR_RESET}"

# 2. Create Service User and Directories
echo -e "\n${COLOR_CYAN}[2/5] Creating dedicated service user and storage directories...${COLOR_RESET}"
if ! id -u "$SERVICE_USER" >/dev/null 2>&1; then
    useradd -r -s /bin/false -d "$INSTALL_DIR" "$SERVICE_USER"
    echo -e "${COLOR_GREEN}[✓] Created system user: $SERVICE_USER${COLOR_RESET}"
fi

mkdir -p "$INSTALL_DIR" "$DATA_ROOT" "/var/lib/nexadisk/trash" "/var/log/nexadisk"
chown -R "$SERVICE_USER":"$SERVICE_USER" "$INSTALL_DIR" "$DATA_ROOT" "/var/lib/nexadisk" "/var/log/nexadisk"

# 3. Generate Cryptographically Secure Secrets
echo -e "\n${COLOR_CYAN}[3/5] Generating cryptographic secrets and production .env...${COLOR_RESET}"
JWT_SECRET=$(openssl rand -hex 32)
AGENT_KEY=$(openssl rand -hex 24)
HMAC_SECRET=$(openssl rand -hex 32)
DB_PASS=$(openssl rand -hex 16)

ENV_FILE="$INSTALL_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
cat <<EOF > "$ENV_FILE"
# NexaDisk V2 Enterprise Configuration
NODE_ENV=production
PORT=${HTTP_PORT}
HOST=0.0.0.0

# Storage Locations
STORAGE_ROOT=${DATA_ROOT}
TRASH_STORAGE_ROOT=/var/lib/nexadisk/trash

# Security & Cryptography
JWT_SECRET=${JWT_SECRET}
AGENT_KEY=${AGENT_KEY}
HMAC_ENCRYPTION_SECRET=${HMAC_SECRET}
CORS_ORIGIN=*

# PostgreSQL Database
DATABASE_URL=postgres://nexadisk:${DB_PASS}@127.0.0.1:5432/nexadisk_db
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=nexadisk_db
DB_USER=nexadisk
DB_PASSWORD=${DB_PASS}
EOF
chown "$SERVICE_USER":"$SERVICE_USER" "$ENV_FILE"
chmod 600 "$ENV_FILE"
echo -e "${COLOR_GREEN}[✓] Production configuration created at $ENV_FILE${COLOR_RESET}"
fi

# 4. Systemd Service Configuration
echo -e "\n${COLOR_CYAN}[4/5] Creating systemd service unit...${COLOR_RESET}"
SYSTEMD_FILE="/etc/systemd/system/nexadisk.service"
cat <<EOF > "$SYSTEMD_FILE"
[Unit]
Description=NexaDisk V2 Enterprise Storage Service
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=${SERVICE_USER}
Group=${SERVICE_USER}
WorkingDirectory=${INSTALL_DIR}
EnvironmentFile=${INSTALL_DIR}/.env
ExecStart=$(which node) server/index.js
Restart=always
RestartSec=5s
LimitNOFILE=65536
LimitNPROC=4096
StandardOutput=append:/var/log/nexadisk/service.log
StandardError=append:/var/log/nexadisk/error.log

# Security Sandboxing
ProtectSystem=full
ProtectHome=true
PrivateTmp=true
AmbientCapabilities=CAP_SYS_ADMIN

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable nexadisk.service
echo -e "${COLOR_GREEN}[✓] Systemd service enabled: nexadisk.service${COLOR_RESET}"

# 5. Complete
echo -e "\n${COLOR_GREEN}================================================================"
echo "          NEXADISK V2 INSTALLATION COMPLETED SUCCESSFULLY!      "
echo "================================================================"
echo -e "${COLOR_RESET}"
echo -e "To start the service:     ${COLOR_CYAN}systemctl start nexadisk${COLOR_RESET}"
echo -e "To check live status:     ${COLOR_CYAN}systemctl status nexadisk${COLOR_RESET}"
echo -e "To view service logs:     ${COLOR_CYAN}journalctl -u nexadisk -f${COLOR_RESET}"
echo -e "Web Access:               ${COLOR_CYAN}http://<server-ip>:${HTTP_PORT}${COLOR_RESET}"
echo ""
