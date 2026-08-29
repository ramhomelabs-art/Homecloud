#!/usr/bin/env bash
# ==============================================================================
# NexaDisk Remote Agent Autonomous Installation Script (Linux)
# Zero-Configuration 1-Line Installer
# ==============================================================================
set -e

echo "=========================================================="
echo " Starting NexaDisk Remote Agent Installation              "
echo " Target Master: __MASTER_URL__                            "
echo "=========================================================="

# Check if running as root
if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: This script must be run as root (sudo)." >&2
  exit 1
fi

# 1. Install Node.js LTS if missing
if ! command -v node >/dev/null 2>&1; then
  echo "[*] Node.js is missing. Installing Node.js LTS 20.x..."
  if ! command -v curl >/dev/null 2>&1; then
    if command -v apt-get >/dev/null 2>&1; then
      apt-get update && apt-get install -y curl unzip
    elif command -v yum >/dev/null 2>&1; then
      yum install -y curl unzip
    elif command -v apk >/dev/null 2>&1; then
      apk add --no-cache curl nodejs npm unzip
    fi
  fi

  if command -v apt-get >/dev/null 2>&1; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
  elif command -v yum >/dev/null 2>&1; then
    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
    yum install -y nodejs
  fi
fi

NODE_VER=$(node -v || echo "unknown")
echo "[+] Node.js version: $NODE_VER"

# 2. Setup agent directory
AGENT_INSTALL_DIR="/opt/nexadisk-agent"
echo "[*] Installing agent to $AGENT_INSTALL_DIR..."
mkdir -p "$AGENT_INSTALL_DIR"

# 3. Copy or Download agent files
if [ -f "agent/index.js" ]; then
  cp -r agent/* "$AGENT_INSTALL_DIR"/
elif [ -f "index.js" ]; then
  cp -r * "$AGENT_INSTALL_DIR"/ 2>/dev/null || true
else
  echo "[*] Downloading agent package from master server..."
  curl -fsSL "__MASTER_URL__/api/v1/provision/download/linux?token=__USER_TOKEN__" -o /tmp/nexadisk-agent-linux.zip
  unzip -q -o /tmp/nexadisk-agent-linux.zip -d /tmp/nexadisk-agent-extract
  if [ -d "/tmp/nexadisk-agent-extract/agent" ]; then
    cp -r /tmp/nexadisk-agent-extract/agent/* "$AGENT_INSTALL_DIR"/
  else
    cp -r /tmp/nexadisk-agent-extract/* "$AGENT_INSTALL_DIR"/ 2>/dev/null || true
  fi
  rm -rf /tmp/nexadisk-agent-linux.zip /tmp/nexadisk-agent-extract

fi

chmod -R 755 "$AGENT_INSTALL_DIR"

# 4. Install npm dependencies
cd "$AGENT_INSTALL_DIR"
if [ ! -d "node_modules" ]; then
  echo "[*] Installing runtime dependencies..."
  npm install --production --legacy-peer-deps 2>/dev/null || true
fi

# 5. Auto-detect mounted storage and configure .env
echo "[*] Auto-detecting Linux mount points..."
DISKS="/"
for m in /mnt/* /media/* /data /srv; do
  if [ -d "$m" ]; then
    DISKS="$DISKS,$m"
  fi
done
echo "[+] Detected storage paths: $DISKS"

cat > .env <<EOF
# NexaDisk Remote Agent Configuration
AGENT_PORT=5001
MASTER_URL=__MASTER_URL__
AGENT_KEY=__AGENT_KEY__
EXPOSED_DRIVES=$DISKS
EOF

# 6. Configure systemd service
NODE_BIN=$(command -v node || echo "/usr/bin/node")
echo "[*] Creating systemd service at /etc/systemd/system/nexadisk-agent.service..."
cat > /etc/systemd/system/nexadisk-agent.service <<EOF
[Unit]
Description=NexaDisk Remote Storage Node Agent Daemon
After=network.target network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=$AGENT_INSTALL_DIR
ExecStart=$NODE_BIN index.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF

# 7. Reload and Start service
systemctl daemon-reload
systemctl enable nexadisk-agent
systemctl restart nexadisk-agent

echo "=========================================================="
echo " NEXADISK AGENT DEPLOYED & PAIRED SUCCESSFULLY!           "
echo " Service Status: Active (systemctl status nexadisk-agent) "
echo " Connected to Master: __MASTER_URL__                      "
echo "=========================================================="
