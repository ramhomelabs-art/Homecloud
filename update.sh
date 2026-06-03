#!/bin/bash

# NexaDisk Update Script for Debian/Ubuntu
# Version: 1.0.0
# Description: Pulls updates from GitHub, rebuilds assets, and restarts the systemd service.

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}====================================================${NC}"
echo -e "${CYAN}             Updating NexaDisk Core                 ${NC}"
echo -e "${CYAN}====================================================${NC}"

# Check for root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}Error: This script must be run as root (sudo) to restart systemd services.${NC}"
   exit 1
fi

APP_DIR="/opt/nexadisk"

if [ ! -d "$APP_DIR/.git" ]; then
    echo -e "${RED}Error: NexaDisk directory is not a Git repository. Please clone from GitHub to enable automatic updates.${NC}"
    exit 1
fi

cd "$APP_DIR"

echo -e "${YELLOW}Stashing local modifications (if any)...${NC}"
git stash || true

echo -e "${YELLOW}Pulling latest changes from GitHub...${NC}"
git pull origin main

echo -e "${YELLOW}Checking and installing backend dependencies...${NC}"
cd server
npm install --production
cd ..

echo -e "${YELLOW}Checking and installing frontend dependencies...${NC}"
cd client
npm install
echo -e "${YELLOW}Rebuilding production frontend assets...${NC}"
npm run build
cd ..

echo -e "${YELLOW}Restarting NexaDisk systemd service...${NC}"
systemctl restart nexadisk

echo -e "${GREEN}====================================================${NC}"
echo -e "${GREEN}      NexaDisk updated successfully and online!     ${NC}"
echo -e "${GREEN}====================================================${NC}"
