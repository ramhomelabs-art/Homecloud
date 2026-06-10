#!/usr/bin/env bash
# ==============================================================================
# NexaDisk Remote Agent Installation Script (Linux)
# ==============================================================================
set -e

echo "=========================================================="
echo " Starting NexaDisk Agent Installation                     "
echo "=========================================================="

# Check if running as root
if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: This script must be run as root (sudo)." >&2
  exit 1
fi

# 1. Install Node.js if missing
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is missing. Attempting to install..."
  
  # Check if a local node package exists
  LOCAL_DEB=$(find . -name "nodejs*.deb" -o -name "node*.deb" | head -n 1)
  if [ -n "$LOCAL_DEB" ] && [ -f "$LOCAL_DEB" ]; then
    echo "Found local Node.js package: $LOCAL_DEB"
    echo "Installing locally..."
    apt-get install -y "$LOCAL_DEB"
  else
    echo "No local Node.js package found. Downloading from NodeSource (online)..."
    if ! command -v curl >/dev/null 2>&1; then
      apt-get update && apt-get install -y curl
    fi
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
  fi
fi

# Verify Node.js version
NODE_VER=$(node -v)
echo "Node.js version: $NODE_VER"

# 2. Setup agent directory
AGENT_INSTALL_DIR="/opt/nexadisk-agent"
echo "Installing agent to $AGENT_INSTALL_DIR..."
mkdir -p "$AGENT_INSTALL_DIR"

# Copy agent files from extraction path (expecting agent folder in current path or .)
if [ -d "agent" ]; then
  cp -r agent/* "$AGENT_INSTALL_DIR"/
else
  # If running from inside the agent directory
  cp -r * "$AGENT_INSTALL_DIR"/ 2>/dev/null || true
fi

# Ensure correct permissions
chmod -R 755 "$AGENT_INSTALL_DIR"

# 3. Install npm dependencies if node_modules is missing
cd "$AGENT_INSTALL_DIR"
if [ ! -d "node_modules" ]; then
  echo "Installing agent dependencies..."
  if [ -f "package-lock.json" ]; then
    npm ci --production --legacy-peer-deps || npm install --production --legacy-peer-deps || echo "Warning: npm install failed. Running offline?"
  else
    npm install --production --legacy-peer-deps || echo "Warning: npm install failed. Running offline?"
  fi
fi

# 4. Generate .env file if it doesn't exist
if [ ! -f ".env" ]; then
  echo "Configuring agent environment variables..."
  cat > .env <<EOF
# NexaDisk Remote Agent Configuration
AGENT_PORT=5001
MASTER_URL=__MASTER_URL__
AGENT_KEY=__AGENT_KEY__
EXPOSED_DRIVES=/
EOF
else
  # If it exists, replace placeholders in existing .env if they are present
  sed -i 's|__MASTER_URL__|'"__MASTER_URL__"'|g' .env 2>/dev/null || true
  sed -i 's|__AGENT_KEY__|'"__AGENT_KEY__"'|g' .env 2>/dev/null || true
fi

# 5. Setup systemd service
echo "Generating systemd service configuration..."
cat > /lib/systemd/system/nexadisk-agent.service <<EOF
[Unit]
Description=NexaDisk Remote Node Agent
After=network.target

[Service]
Type=simple
WorkingDirectory=$AGENT_INSTALL_DIR
ExecStart=/usr/bin/node index.js
Restart=always
User=root
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd and start service
echo "Enabling and starting nexadisk-agent service..."
systemctl daemon-reload
systemctl enable nexadisk-agent
systemctl restart nexadisk-agent

echo "=========================================================="
echo " AGENT INSTALLATION SUCCESSFUL!                           "
echo " The agent is active and running.                         "
echo " Service Status: systemctl status nexadisk-agent          "
echo "=========================================================="
