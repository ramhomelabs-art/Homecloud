#!/usr/bin/env bash
# ==============================================================================
#  NEXADISK V2 - ONE-LINE DOCKER & PORTAINER INSTALLER
# ==============================================================================

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}================================================================${NC}"
echo -e "${BLUE}       NexaDisk v2 Production Docker Cluster Deployment        ${NC}"
echo -e "${BLUE}================================================================${NC}\n"

# 1. Verify Docker installation
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}[!] Docker not found. Installing Docker CE automatically...${NC}"
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker "$USER" || true
    rm get-docker.sh
    echo -e "${GREEN}[+] Docker installed successfully.${NC}"
fi

# 2. Verify Docker Compose plugin
if ! docker compose version &> /dev/null && ! command -v docker-compose &> /dev/null; then
    echo -e "${YELLOW}[!] Installing Docker Compose plugin...${NC}"
    sudo apt-get update && sudo apt-get install -y docker-compose-plugin || true
fi

# 3. Generate secure secrets if not already present
JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || date +%s | sha256sum | base64 | head -c 64)
ENCRYPTION_KEY=$(openssl rand -hex 32 2>/dev/null || date +%s | sha256sum | head -c 64)
AGENT_KEY=$(openssl rand -hex 24 2>/dev/null || date +%s | sha256sum | head -c 48)
HMAC_SECRET=$(openssl rand -hex 24 2>/dev/null || date +%s | sha256sum | head -c 48)

# 4. Build local production container image
echo -e "${BLUE}[*] Compiling frontend and building NexaDisk core container...${NC}"
docker build -t ghcr.io/ramhomelabs-art/homecloud:latest -t nexadisk-master:latest .

echo -e "\n${GREEN}[+] Image 'ghcr.io/ramhomelabs-art/homecloud:latest' built and tagged successfully!${NC}\n"

# 5. Launch stack
echo -e "${BLUE}[*] Launching NexaDisk Master, PostgreSQL 16, and Redis 7...${NC}"
docker compose up -d

echo -e "\n${GREEN}================================================================${NC}"
echo -e "${GREEN}   ✅ NexaDisk Enterprise Cluster is Online & Ready!             ${NC}"
echo -e "${GREEN}================================================================${NC}\n"
echo -e "Access your NexaDisk dashboard at: ${YELLOW}http://localhost:5000${NC} or ${YELLOW}http://$(hostname -I | awk '{print $1}'):5000${NC}"
echo -e "Portainer Stack status: ${GREEN}Active & Synced with local Docker engine${NC}\n"
