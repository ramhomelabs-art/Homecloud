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

echo "=========================================================="
echo " Starting NexaDisk Debian Package Build Sequence          "
echo "=========================================================="

# 1. Verify required host build tools are present
check_tool() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR: Required build tool '$1' is missing. Please install it." >&2
    exit 1
  fi
}

check_tool dpkg-deb
check_tool fakeroot
check_tool node
check_tool npm

# 2. Check for CIFS mount dependencies (optional alert during build, check during post-install)
if ! command -v mount.cifs >/dev/null 2>&1; then
  echo "WARNING: 'cifs-utils' was not found on this system."
  echo "         CIFS/SMB network mounting requires 'cifs-utils'."
  echo "         Please install it on the target server with: sudo apt install cifs-utils"
  echo ""
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
