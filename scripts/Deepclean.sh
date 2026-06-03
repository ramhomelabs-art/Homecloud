#!/bin/bash

# NexaDisk Professional: Deep Clean Utility
# WARNING: This script removes build artifacts and stops all NexaDisk services.
# Run: chmod +x Deepclean.sh && sudo ./Deepclean.sh

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${RED}!!! WARNING: Deep Clean Initiated !!!${NC}"
echo -e "${YELLOW}This will stop services and remove all build artifacts.${NC}"

# Root check
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}This script must be run as root (sudo)${NC}"
   exit 1
fi

# 1. Stop Services
echo -e "${YELLOW}[1/5] Stopping all NexaDisk services...${NC}"
# Stop PM2
pm2 stop nexadisk 2>/dev/null || true
pm2 delete nexadisk 2>/dev/null || true
# Stop Systemd
systemctl stop nexadisk 2>/dev/null || true
systemctl disable nexadisk 2>/dev/null || true

# 2. Unmount Network Shares
echo -e "${YELLOW}[2/5] Unmounting network shares...${NC}"
if [ -d "/opt/nexadisk/mnt" ]; then
    for mnt in /opt/nexadisk/mnt/*; do
        if [ -d "$mnt" ]; then
            echo -e "  - Unmounting $mnt"
            umount -f "$mnt" 2>/dev/null || true
            rmdir "$mnt" 2>/dev/null || true
        fi
    done
fi

# 3. Prune Build Artifacts
echo -e "${YELLOW}[3/5] Pruning node_modules, builds, and locks...${NC}"
# Get project root (parent of scripts dir)
PROJECT_ROOT="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"
cd "$PROJECT_ROOT"

echo -e "  - Cleaning root..."
rm -rf node_modules package-lock.json 2>/dev/null || true

echo -e "  - Cleaning server..."
rm -rf server/node_modules server/package-lock.json 2>/dev/null || true

echo -e "  - Cleaning client..."
rm -rf client/node_modules client/package-lock.json client/dist 2>/dev/null || true

echo -e "  - Cleaning agent..."
rm -rf agent/node_modules agent/package-lock.json 2>/dev/null || true

echo -e "  - Cleaning mobile..."
rm -rf mobile/node_modules mobile/package-lock.json 2>/dev/null || true

# 4. Optional: Reset Database
echo -e "${YELLOW}[4/5] Resetting database...${NC}"
if [ -f "server/database.sqlite" ]; then
    echo -e "  - Removing server/database.sqlite"
    rm -f server/database.sqlite
fi

# 5. Cleanup Logs
echo -e "${YELLOW}[5/5] Clearing application logs...${NC}"
rm -rf server/logs/*.log 2>/dev/null || true
rm -rf logs/*.log 2>/dev/null || true
pm2 flush nexadisk 2>/dev/null || true

echo -e "${GREEN}====================================${NC}"
echo -e "${GREEN}    Deep Clean Complete!            ${NC}"
echo -e "${GREEN}====================================${NC}"
echo -e "${CYAN}The environment is now pristine and ready for a fresh install.${NC}"
