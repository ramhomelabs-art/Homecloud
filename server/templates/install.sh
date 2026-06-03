#!/bin/bash
# NexaDisk Agent - Automated Linux Installer 🛡️

echo "=========================================="
echo "   NexaDisk Agent Provisioning - Debian"
echo "=========================================="

# 1. Check for Root
if [ "$EUID" -ne 0 ]; then
  echo "Error: Please run as root (sudo bash install.sh)"
  exit 1
fi

# 2. System Update & Base Tools
echo "[1/7] Updating system packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y && apt-get install -y curl build-essential

# 3. Check for Node.js
if ! command -v node &> /dev/null; then
    echo "[2/7] Node.js not found. Installing Node.js 20.x..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
else
    echo "[2/7] Found Node.js: $(node -v)"
fi

# 4. PM2 Installation
if ! command -v pm2 &> /dev/null; then
    echo "[3/7] Installing PM2 globally..."
    npm install -g pm2
else
    echo "[3/7] PM2 already installed."
fi

# 5. Configure Main Server IP
echo "------------------------------------------"
echo "CONFIGURATION REQUIRED"
echo "------------------------------------------"
read -p "Enter NexaDisk Main Server IP (e.g., 192.168.1.50): " SERVER_IP

if [ -z "$SERVER_IP" ]; then
    echo "Error: Server IP cannot be empty."
    exit 1
fi

# 6. Setup Agent Directory
SCRIPT_PATH="$(readlink -f "$0")"
AGENT_DIR="$(dirname "$SCRIPT_PATH")"
echo "[4/7] Working in: $AGENT_DIR"

# Create .env for configuration
cat <<EOF > "$AGENT_DIR/.env"
SERVER_URL=http://$SERVER_IP:5000
PORT=5001
EOF

# 7. Install Dependencies
echo "[5/7] Installing Agent Dependencies..."
cd "$AGENT_DIR"
rm -rf node_modules package-lock.json
npm install --no-audit --no-fund

# 8. Service Persistence with PM2
echo "[6/7] Starting Agent with PM2..."
pm2 delete nexadisk-agent 2>/dev/null || true
pm2 start agent.js --name nexadisk-agent

# Save PM2 state and setup startup persistence
echo "[7/7] Configuring PM2 startup persistence..."
pm2 save
STARTUP_CMD=$(pm2 startup | grep "sudo env PATH" || true)
if [ -n "$STARTUP_CMD" ]; then
    eval "$STARTUP_CMD"
fi

# 9. Configure Firewall
if command -v ufw &> /dev/null; then
    echo "UFW: Opening port 5001..."
    ufw allow 5001/tcp
fi

echo "=========================================="
echo "SUCCESS: NexaDisk Agent is active!"
echo "Server IP configured as: $SERVER_IP"
echo "Status: pm2 status"
echo "Logs:   pm2 logs nexadisk-agent"
echo "=========================================="
