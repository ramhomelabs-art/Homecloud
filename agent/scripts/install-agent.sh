#!/bin/bash

# NexaDisk Agent Installation Script for Linux/macOS
# Run: chmod +x install-agent.sh && sudo ./install-agent.sh

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  NexaDisk Agent Installation Script   ${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}ERROR: This script must be run as root!${NC}"
    echo -e "${YELLOW}Please run: sudo ./install-agent.sh${NC}"
    exit 1
fi

# Check Node.js installation
echo -e "${YELLOW}[1/5] Checking Node.js installation...${NC}"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}  ✓ Node.js $NODE_VERSION found${NC}"
else
    echo -e "${RED}  ✗ Node.js not found!${NC}"
    echo -e "${YELLOW}  Please install Node.js from https://nodejs.org/${NC}"
    exit 1
fi

# Check npm installation
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo -e "${GREEN}  ✓ npm $NPM_VERSION found${NC}"
else
    echo -e "${RED}  ✗ npm not found!${NC}"
    exit 1
fi

# 2.1 PM2 Installation
echo -e "${YELLOW}[2.1] Checking PM2 installation...${NC}"
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}  ! PM2 not found. Installing globally...${NC}"
    npm install -g pm2
    echo -e "${GREEN}  ✓ PM2 installed globally${NC}"
else
    echo -e "${GREEN}  ✓ PM2 already installed${NC}"
fi

# 3. Environment Configuration
echo ""
echo -e "${YELLOW}[3/5] Checking environment configuration...${NC}"
if [ -f ".env" ]; then
    echo -e "${GREEN}  ✓ .env file already exists${NC}"
else
    echo -e "${YELLOW}  ! Creating .env from template...${NC}"
    cp .env.example .env
    echo -e "${GREEN}  ✓ .env file created${NC}"
    echo -e "${YELLOW}  ! IMPORTANT: Edit .env and set SERVER_URL and AGENT_KEY to match your Master Hub${NC}"
fi

# Configure firewall
echo ""
echo -e "${YELLOW}[4/5] Configuring firewall...${NC}"

# Get port from .env or use default
PORT=5001
if [ -f ".env" ]; then
    PORT_LINE=$(grep "^PORT=" .env || echo "")
    if [ ! -z "$PORT_LINE" ]; then
        PORT=$(echo "$PORT_LINE" | cut -d'=' -f2 | tr -d ' ')
    fi
fi

if command -v ufw &> /dev/null; then
    # UFW (Ubuntu/Debian)
    ufw allow $PORT/tcp comment "NexaDisk Agent" 2>/dev/null || true
    echo -e "${GREEN}  ✓ UFW rule added for port $PORT${NC}"
elif command -v firewall-cmd &> /dev/null; then
    # firewalld (CentOS/RHEL/Fedora)
    firewall-cmd --permanent --add-port=$PORT/tcp 2>/dev/null || true
    firewall-cmd --reload 2>/dev/null || true
    echo -e "${GREEN}  ✓ Firewalld rule added for port $PORT${NC}"
else
    echo -e "${YELLOW}  ! No firewall detected or could not configure automatically${NC}"
    echo -e "${YELLOW}  Please manually allow port $PORT${NC}"
fi

# 5. Service Persistence with PM2
echo ""
echo -e "${YELLOW}[5/5] Configuring PM2 Process Manager...${NC}"
pm2 delete nexadisk-agent 2>/dev/null || true
pm2 start agent.js --name nexadisk-agent
pm2 save
echo -e "${GREEN}  ✓ NexaDisk Agent started with PM2 persistence${NC}"

# Installation complete
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Agent Installation Complete! ✓       ${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${CYAN}Next steps:${NC}"
echo -e "  1. NexaDisk Agent is now running via PM2!"
echo -e "  2. Edit .env file if you haven't already:"
echo -e "     - SERVER_URL (your main NexaDisk server IP)"
echo -e "     - AGENT_KEY (MUST match the Master Hub's key)"
echo ""
echo -e "  3. Manage the service:"
echo -e "     ${NC}pm2 status${NC} (Check status)"
echo -e "     ${NC}pm2 logs nexadisk-agent${NC} (View logs)"
echo -e "     ${NC}pm2 restart nexadisk-agent${NC} (Restart)"
echo ""
echo -e "  4. In main NexaDisk UI:"
echo -e "     - Go to Devices -> Find this agent -> Click Approve"
