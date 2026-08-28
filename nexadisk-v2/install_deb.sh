#!/usr/bin/env bash
# ==============================================================================
# NexaDisk Server Debian Package Build & Deployment Script
# ==============================================================================
# This script bundles the NexaDisk backend server files, installs production
# dependencies, configures systemd, and generates a standalone .deb package.
#
# Requirements:
# - Debian / Ubuntu-based Linux distribution
# - dpkg-deb, fakeroot, node, npm
# ==============================================================================
set -e

# Parse command-line options
DOWNLOAD_ONLY=false
if [ "$1" = "--download-deps" ] || [ "$1" = "-d" ]; then
  DOWNLOAD_ONLY=true
fi

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
  mkdir -p dependencies/partial
  
  echo "Downloading required package .debs locally to './dependencies'..."
  sudo apt-get update
  sudo apt-get install -y --download-only -o Dir::Cache::archives="$(pwd)/dependencies" \
    nodejs postgresql postgresql-contrib cifs-utils dpkg-dev fakeroot curl
  
  # Clean up partial directory structure if created by apt
  if [ -d "dependencies/partial" ]; then
    find dependencies/partial/ -name "*.deb" -exec mv {} dependencies/ \; 2>/dev/null || true
    rm -rf dependencies/partial
  fi
  
  echo "=========================================================="
  echo " CACHE DOWNLOAD COMPLETE!                                 "
  echo " All dependencies (.debs) are saved in: ./dependencies/   "
  echo " Copy this entire folder to your offline server, and run  "
  echo " ./install_deb.sh (without parameters) to install offline. "
  echo "=========================================================="
  exit 0
fi

echo "=========================================================="
echo " Starting NexaDisk Debian Package Build Sequence          "
echo "=========================================================="

# Check for pre-downloaded offline packages
OFFLINE_MODE=false
if [ -d "dependencies" ] && ls dependencies/*.deb >/dev/null 2>&1; then
  OFFLINE_MODE=true
  echo "Offline mode detected: Installing packages from local './dependencies' folder..."
  sudo apt-get install -y ./dependencies/*.deb
fi

# 1. Verify and automatically install missing host build/runtime tools
install_dependency() {
  local tool=$1
  local pkg=$2
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "Host dependency '$tool' is missing. Attempting to install package '$pkg'..."
    if command -v apt-get >/dev/null 2>&1; then
      sudo apt-get update
      sudo apt-get install -y "$pkg"
    else
      echo "ERROR: apt-get not found. Please install '$pkg' manually." >&2
      exit 1
    fi
  fi
}

# Ensure curl is installed first (only if online)
if [ "$OFFLINE_MODE" = false ]; then
  install_dependency curl curl
fi

# If node/npm is missing, configure NodeSource repository and install nodejs (v20)
if ! command -v node >/dev/null 2>&1; then
  if [ "$OFFLINE_MODE" = true ]; then
    echo "ERROR: Node.js was not installed correctly by the local packages." >&2
    exit 1
  fi
  echo "Node.js is missing. Configuring NodeSource repository and installing Node.js (v20)..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

# Ensure packaging utilities are present
install_dependency dpkg-deb dpkg-dev
install_dependency fakeroot fakeroot

# 2. Check and install PostgreSQL and CIFS dependencies
if ! command -v psql >/dev/null 2>&1; then
  echo "PostgreSQL is missing. Installing database packages..."
  if command -v apt-get >/dev/null 2>&1; then
    sudo apt-get install -y postgresql postgresql-contrib
  else
    echo "ERROR: apt-get not found. Please install postgresql manually." >&2
    exit 1
  fi
fi

if ! command -v mount.cifs >/dev/null 2>&1; then
  echo "cifs-utils is missing. Installing CIFS network mounting tools..."
  if command -v apt-get >/dev/null 2>&1; then
    sudo apt-get install -y cifs-utils
  else
    echo "ERROR: apt-get not found. Please install cifs-utils manually." >&2
    exit 1
  fi
fi

# 3. Setup build directory variables
BUILD_DIR="debian/build"
PACKAGE_NAME="nexadisk"
VERSION="$(node -p "require('./server/package.json').version")"
ARCH="$(dpkg --print-architecture)"
PKG_DIR="${BUILD_DIR}/${PACKAGE_NAME}_${VERSION}_${ARCH}"

echo "Building package: ${PACKAGE_NAME} v${VERSION} (${ARCH})"
echo "Build workspace: ${PKG_DIR}"

# 4. Clean previous builds and initialize folder tree
rm -rf "${BUILD_DIR}"
mkdir -p "${PKG_DIR}"/usr/local/bin/${PACKAGE_NAME}
mkdir -p "${PKG_DIR}"/etc/${PACKAGE_NAME}
mkdir -p "${PKG_DIR}"/var/lib/${PACKAGE_NAME}
mkdir -p "${PKG_DIR}"/lib/systemd/system
mkdir -p "${PKG_DIR}"/DEBIAN

# 5. Copy server files to installation path
echo "Copying server files..."
cp -r server/* "${PKG_DIR}"/usr/local/bin/${PACKAGE_NAME}/

# 6. Install production dependencies inside build package
echo "Installing server production dependencies..."
pushd "${PKG_DIR}"/usr/local/bin/${PACKAGE_NAME} > /dev/null
if [ -f "package-lock.json" ]; then
  npm ci --only=production --legacy-peer-deps
else
  npm install --only=production --legacy-peer-deps
fi
popd > /dev/null

# 7. Generate systemd service configuration file
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

# 8. Generate Debian control configuration file
echo "Generating package control file..."
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

# 9. Create debian post-installation configuration script
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
chown -R nexadisk:nexadisk /var/lib/nexadisk
chown -R nexadisk:nexadisk /etc/nexadisk

# Reload systemd services
if [ -d /run/systemd/system ]; then
  systemctl daemon-reload || true
fi

echo "=========================================================="
echo " NexaDisk installation complete!                          "
echo " Start the service with: sudo systemctl start nexadisk    "
echo " Enable on startup with: sudo systemctl enable nexadisk   "
echo "=========================================================="
EOF
chmod 755 "${PKG_DIR}"/DEBIAN/postinst

# 10. Compile the debian package
echo "Packaging using dpkg-deb..."
fakeroot dpkg-deb --build "${PKG_DIR}" "${BUILD_DIR}/${PACKAGE_NAME}_${VERSION}_${ARCH}.deb"

echo ""
echo "=========================================================="
echo " BUILD SUCCESSFUL!                                        "
echo " Package location: ${BUILD_DIR}/${PACKAGE_NAME}_${VERSION}_${ARCH}.deb"
echo "=========================================================="
