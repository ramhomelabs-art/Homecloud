#!/usr/bin/env bash
# ==============================================================================
# NexaDisk Server Debian Package Build & Deployment Script
# ==============================================================================
# This script installs host dependencies, compiles the frontend, packages the
# server files as a .deb package, installs the package, configures/starts
# PostgreSQL database, seeds database tables, and sets up systemd automation.
#
# Requirements:
# - Debian / Ubuntu-based Linux distribution
# ==============================================================================
set -e

# Parse command-line options
DOWNLOAD_ONLY=false
OFFLINE_MODE=false

if [ "$1" = "--download-deps" ] || [ "$1" = "-d" ]; then
  DOWNLOAD_ONLY=true
fi

# Define local offline dependencies folder
OFFLINE_DIR="Offline"

# ==============================================================================
# PHASE 1: DOWNLOAD DEPS (If requested)
# ==============================================================================
if [ "$DOWNLOAD_ONLY" = true ]; then
  echo "=========================================================="
  echo " Preparing Offline Dependencies Cache                     "
  echo "=========================================================="
  
  if ! command -v apt-get >/dev/null 2>&1; then
    echo "ERROR: apt-get not found. Package downloading is only supported on Debian/Ubuntu systems." >&2
    exit 1
  fi
  
  # Add NodeSource repo to fetch official Node.js (v20) package
  echo "Setting up NodeSource repository..."
  if ! command -v curl >/dev/null 2>&1; then
    sudo apt-get update && sudo apt-get install -y curl
  fi
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  
  # Create dependencies cache directory
  mkdir -p "${OFFLINE_DIR}/partial"
  
  echo "Downloading required package .debs locally to './${OFFLINE_DIR}'..."
  sudo apt-get update
  sudo apt-get install -y --download-only -o Dir::Cache::archives="$(pwd)/${OFFLINE_DIR}" \
    nodejs postgresql postgresql-contrib cifs-utils dpkg-dev fakeroot curl
  
  # Clean up partial directory structure if created by apt
  if [ -d "${OFFLINE_DIR}/partial" ]; then
    find "${OFFLINE_DIR}/partial/" -name "*.deb" -exec mv {} "${OFFLINE_DIR}/" \; 2>/dev/null || true
    rm -rf "${OFFLINE_DIR}/partial"
  fi
  
  echo "=========================================================="
  echo " CACHE DOWNLOAD COMPLETE!                                 "
  echo " All dependencies (.debs) are saved in: ./${OFFLINE_DIR}/   "
  echo " Copy this entire folder to your offline server, and run  "
  echo " ./install_deb.sh to install offline.                      "
  echo "=========================================================="
  exit 0
fi

# ==============================================================================
# PHASE 2: CHECK & INSTALL HOST DEPENDENCIES
# ==============================================================================
echo "=========================================================="
echo " Starting NexaDisk Dependency Check & Install             "
echo "=========================================================="

# Check if we have pre-downloaded offline packages in Offline/
if [ -d "${OFFLINE_DIR}" ] && ls "${OFFLINE_DIR}"/*.deb >/dev/null 2>&1; then
  OFFLINE_MODE=true
  echo "Offline mode detected: Installing packages from local './${OFFLINE_DIR}' folder..."
  sudo dpkg -i "${OFFLINE_DIR}"/*.deb || sudo apt-get install -f -y
else
  echo "Online mode detected: Fetching updates and packages from repositories..."
fi

# Dependency check helper
install_dependency() {
  local tool=$1
  local pkg=$2
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "Host dependency '$tool' is missing. Attempting to install package '$pkg'..."
    if [ "$OFFLINE_MODE" = true ]; then
      echo "ERROR: Tool '$tool' is missing and cannot be installed offline. Please verify ./Offline contents." >&2
      exit 1
    fi
    sudo apt-get update
    sudo apt-get install -y "$pkg"
  fi
}

# Ensure core build utilities
if [ "$OFFLINE_MODE" = false ]; then
  install_dependency curl curl
fi

if ! command -v node >/dev/null 2>&1; then
  if [ "$OFFLINE_MODE" = true ]; then
    echo "ERROR: Node.js was not installed correctly by the local packages." >&2
    exit 1
  fi
  echo "Node.js is missing. Configuring NodeSource repository and installing Node.js (v20)..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

install_dependency dpkg-deb dpkg-dev
install_dependency fakeroot fakeroot
install_dependency psql postgresql
install_dependency mount.cifs cifs-utils

# ==============================================================================
# PHASE 3: VERIFY INSTALLATION
# ==============================================================================
echo "Checking tool versions..."
NODE_VER=$(node -v 2>&1 || true)
NPM_VER=$(npm -v 2>&1 || true)
PSQL_VER=$(psql --version 2>&1 || true)

echo "Verification results:"
echo " - Node.js: $NODE_VER"
echo " - npm: $NPM_VER"
echo " - PostgreSQL: $PSQL_VER"

if [[ -z "$NODE_VER" || -z "$NPM_VER" || -z "$PSQL_VER" ]]; then
  echo "ERROR: Tool installation verification failed. Please check logs above." >&2
  exit 1
fi

# ==============================================================================
# PHASE 4: CONFIGURE & START POSTGRESQL DATABASE
# ==============================================================================
echo "Starting PostgreSQL database service..."
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Wait for PostgreSQL to listen
echo "Waiting for PostgreSQL service to be ready..."
until sudo pg_isready -h localhost >/dev/null 2>&1; do
  sleep 1
done
echo "PostgreSQL is online!"

# Configure postgres user password and database
echo "Configuring PostgreSQL user roles and databases..."
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';"
sudo -u postgres psql -c "CREATE DATABASE nexadisk;" 2>/dev/null || true

# ==============================================================================
# PHASE 5: COMPILING FRONTEND (PRODUCTION BUILD)
# ==============================================================================
echo "Building client frontend static assets..."
pushd client >/dev/null
npm install --legacy-peer-deps
npm run build
popd >/dev/null

# ==============================================================================
# PHASE 6: PACKAGING AS DEBIAN PACKAGE (.DEB)
# ==============================================================================
BUILD_DIR="debian/build"
PACKAGE_NAME="nexadisk"
VERSION="$(node -p "require('./server/package.json').version")"
ARCH="$(dpkg --print-architecture)"
PKG_DIR="${BUILD_DIR}/${PACKAGE_NAME}_${VERSION}_${ARCH}"

echo "Building package workspace: ${PKG_DIR}"
rm -rf "${BUILD_DIR}"
mkdir -p "${PKG_DIR}"/usr/local/bin/${PACKAGE_NAME}
mkdir -p "${PKG_DIR}"/usr/local/bin/client/dist
mkdir -p "${PKG_DIR}"/etc/${PACKAGE_NAME}
mkdir -p "${PKG_DIR}"/var/lib/${PACKAGE_NAME}/uploads
mkdir -p "${PKG_DIR}"/lib/systemd/system
mkdir -p "${PKG_DIR}"/DEBIAN

# Copy files
echo "Copying built server files..."
cp -r server/* "${PKG_DIR}"/usr/local/bin/${PACKAGE_NAME}/
cp -r client/dist/* "${PKG_DIR}"/usr/local/bin/client/dist/

# Install server production dependencies
echo "Installing server production node modules..."
pushd "${PKG_DIR}"/usr/local/bin/${PACKAGE_NAME} >/dev/null
npm install --only=production --legacy-peer-deps
popd >/dev/null

# Generate systemd service definition
echo "Generating systemd service configuration..."
cat > "${PKG_DIR}"/lib/systemd/system/${PACKAGE_NAME}.service <<EOF
[Unit]
Description=NexaDisk Core Enterprise Server
After=network.target postgresql.service

[Service]
Type=simple
WorkingDirectory=/usr/local/bin/nexadisk
ExecStart=/usr/bin/node index.js
Restart=on-failure
User=nexadisk
Group=nexadisk
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

# Generate Debian Control
echo "Generating package control config..."
cat > "${PKG_DIR}"/DEBIAN/control <<EOF
Package: ${PACKAGE_NAME}
Version: ${VERSION}
Section: utils
Priority: optional
Architecture: ${ARCH}
Maintainer: Ram Nagaraj <ram@example.com>
Depends: nodejs (>= 16.0.0), postgresql (>= 12), cifs-utils
Description: NexaDisk v2 Enterprise Server with real-time updates, AV scanning, and web UI.
EOF

# Generate postinst script
echo "Generating package postinst script..."
cat > "${PKG_DIR}"/DEBIAN/postinst <<EOF
#!/bin/sh
set -e

# Create nexadisk system user/group if not exists
if ! getent group nexadisk >/dev/null; then
  groupadd --system nexadisk
fi
if ! getent passwd nexadisk >/dev/null; then
  useradd --system --gid nexadisk --no-create-home --shell /bin/false nexadisk
fi

# Set proper file permissions
chown -R nexadisk:nexadisk /usr/local/bin/nexadisk
chown -R nexadisk:nexadisk /usr/local/bin/client
chown -R nexadisk:nexadisk /var/lib/nexadisk
chown -R nexadisk:nexadisk /etc/nexadisk

# Generate production .env configuration
if [ ! -f /usr/local/bin/.env ]; then
  echo "Generating secure JWT_SECRET and AGENT_KEY credentials..."
  JWT_SEC=\$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  AG_KEY=\$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  cat > /usr/local/bin/.env <<OUT
PORT=5000
NODE_ENV=production
DB_USER=postgres
DB_PASSWORD=postgres
DB_HOST=localhost
DB_DATABASE=nexadisk
DB_PORT=5432
STORAGE_TYPE=local
LOCAL_STORAGE_BASE=/var/lib/nexadisk/uploads
JWT_SECRET=\${JWT_SEC}
AGENT_KEY=\${AG_KEY}
OUT
  chown nexadisk:nexadisk /usr/local/bin/.env
  chmod 600 /usr/local/bin/.env
fi

# Configure passwordless sudo for mounting cifs shares
if [ -d /etc/sudoers.d ]; then
  echo "nexadisk ALL=(ALL) NOPASSWD: /bin/mount, /usr/bin/mount, /bin/umount, /usr/bin/umount" > /etc/sudoers.d/nexadisk
  chmod 0440 /etc/sudoers.d/nexadisk
fi

# Reload systemd services
if [ -d /run/systemd/system ]; then
  systemctl daemon-reload || true
fi
EOF
chmod 755 "${PKG_DIR}"/DEBIAN/postinst

# Compile package
echo "Packaging Debian installer using dpkg-deb..."
fakeroot dpkg-deb --build "${PKG_DIR}" "${BUILD_DIR}/${PACKAGE_NAME}_${VERSION}_${ARCH}.deb"

# ==============================================================================
# PHASE 7: INSTALLING DEBIAN PACKAGE
# ==============================================================================
echo "Installing the compiled Debian package..."
sudo dpkg -i "${BUILD_DIR}/${PACKAGE_NAME}_${VERSION}_${ARCH}.deb" || sudo apt-get install -f -y

# ==============================================================================
# PHASE 8: SEEDING DATABASE & ADMIN ACCOUNT
# ==============================================================================
echo "Seeding the admin account and initializing database tables..."
# Run seeding script under the nexadisk user
sudo -u nexadisk node /usr/local/bin/nexadisk/scripts/seed-admin.js

# ==============================================================================
# PHASE 9: START SERVER & CONFIGURE SYSTEMD AUTOMATION
# ==============================================================================
echo "Enabling and starting the NexaDisk systemd service..."
sudo systemctl daemon-reload
sudo systemctl enable nexadisk
sudo systemctl restart nexadisk

# ==============================================================================
# PHASE 10: POST INSTALLATION HEALTH CHECK
# ==============================================================================
echo "Running post-installation health check..."
sleep 3

# Check port 5000 status
if command -v ss >/dev/null 2>&1; then
  PORT_CHECK=$(sudo ss -tlnp | grep :5000 || true)
elif command -v netstat >/dev/null 2>&1; then
  PORT_CHECK=$(sudo netstat -tlnp | grep :5000 || true)
else
  PORT_CHECK="Skip (ss and netstat missing)"
fi

# Check service status
SERVICE_STATUS=$(sudo systemctl is-active nexadisk || true)

# Fetch HTTP health code
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/api/v1/auth/verify || true)

echo "----------------------------------------------------------"
echo "Health Check Report:"
echo " - Service Active Status: $SERVICE_STATUS"
if [ "$PORT_CHECK" != "Skip (ss and netstat missing)" ]; then
  echo " - Port 5000 Listening: $([ ! -z "$PORT_CHECK" ] && echo 'YES' || echo 'NO')"
fi
echo " - HTTP API response code: $HTTP_CODE"
echo "----------------------------------------------------------"

if [ "$SERVICE_STATUS" = "active" ]; then
  echo "=========================================================="
  echo " DEPLOYMENT COMPLETED SUCCESSFULLY!                      "
  echo " NexaDisk Server is online and configured under systemd.  "
  echo " Access Web UI at: http://localhost:5000                  "
  echo " Default login: admin / admin123 (Change password immediately)"
  echo "=========================================================="
else
  echo "ERROR: Health check failed! NexaDisk service is not active." >&2
  echo "Displaying systemctl status & service log output:" >&2
  sudo systemctl status nexadisk --no-pager || true
  sudo journalctl -u nexadisk -n 50 --no-pager || true
  exit 1
fi
