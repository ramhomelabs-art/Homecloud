#!/bin/bash

# NexaDisk Professional: Automated Installation Orchestrator
# Supports: Debian, Ubuntu (Production Environment)
# Run: chmod +x install.sh && sudo ./install.sh

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}==============================================${NC}"
echo -e "${CYAN}    NexaDisk Professional: Auto-Install       ${NC}"
echo -e "${CYAN}==============================================${NC}"

# Root check
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}Error: This script must be run as root (sudo)${NC}"
   exit 1
fi

# 1. Pre-flight Checks
echo -e "${YELLOW}[1/6] Running system pre-flight checks...${NC}"
if ! command -v apt-get &> /dev/null; then
    echo -e "${RED}Error: Only Debian/Ubuntu based systems are supported by this automation.${NC}"
    exit 1
fi

# 2. Dependency Injection
echo -e "${YELLOW}[2/6] Injecting system dependencies...${NC}"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl build-essential sqlite3 smbclient cifs-utils git nginx ufw

# 3. Runtime Environment (Node.js 20)
echo -e "${YELLOW}[3/6] Configuring Node.js runtime...${NC}"
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y -qq nodejs
fi
npm install -g pm2 -qq

# 4. Application Installation
echo -e "${YELLOW}[4/6] Installing application modules...${NC}"
PROJECT_ROOT="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"
cd "$PROJECT_ROOT"

echo -e "  - Initializing Server..."
cd server && npm install --silent && cd ..

echo -e "  - Initializing Agent..."
cd agent && npm install --silent && cd ..

# 5. Production Build
echo -e "${YELLOW}[5/6] Generating production build (Frontend)...${NC}"
cd client
npm install --silent
npm run build --silent
cd ..

# 6. Service Activation
echo -e "${YELLOW}[6/6] Activating NexaDisk service...${NC}"
cd server
pm2 delete nexadisk 2>/dev/null || true
pm2 start index.js --name nexadisk
pm2 save --force
pm2 startup | tail -n 1 | bash 2>/dev/null || true

echo -e "${GREEN}==============================================${NC}"
echo -e "${GREEN}    Installation Successful! ✓               ${NC}"
echo -e "${GREEN}==============================================${NC}"
echo -e "${CYAN}Server Port: 5000${NC}"
echo -e "${CYAN}Control Utility: scripts/nexadisk-ctl.sh${NC}"
echo -e ""
echo -e "Run ${YELLOW}./scripts/nexadisk-ctl.sh status${NC} to verify."
