## Debian Package Installation Script

This script builds and installs the NexaDisk server as a Debian package.
It assumes you have `dpkg-deb`, `fakeroot`, and `lintian` installed on a Debian/Ubuntu system.

```bash
#!/usr/bin/env bash
set -e

# 1. Ensure required tools are present
if ! command -v dpkg-deb >/dev/null 2>&1; then
  echo "dpkg-deb not found. Install dpkg-dev." >&2
  exit 1
fi
if ! command -v fakeroot >/dev/null 2>&1; then
  echo "fakeroot not found. Install fakeroot." >&2
  exit 1
fi

# 2. Prepare build directory
BUILD_DIR="debian/build"
PACKAGE_NAME="nexadisk"
VERSION="$(node -p "require('./server/package.json').version")"
ARCH="$(dpkg --print-architecture)"
PKG_DIR="${BUILD_DIR}/${PACKAGE_NAME}_${VERSION}_${ARCH}"

rm -rf "${BUILD_DIR}"
mkdir -p "${PKG_DIR}"/usr/local/bin
mkdir -p "${PKG_DIR}"/etc/${PACKAGE_NAME}
mkdir -p "${PKG_DIR}"/var/lib/${PACKAGE_NAME}
mkdir -p "${PKG_DIR}"/lib/systemd/system

# 3. Copy server files
cp -r server "${PKG_DIR}"/usr/local/bin/${PACKAGE_NAME}
# Install node_modules for production
pushd "${PKG_DIR}"/usr/local/bin/${PACKAGE_NAME} > /dev/null
npm ci --only=production
popd > /dev/null

# 4. Add systemd service
cat > "${PKG_DIR}"/lib/systemd/system/${PACKAGE_NAME}.service <<'EOF'
[Unit]
Description=NexaDisk Server
After=network.target

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

# 5. Create control file
cat > "${PKG_DIR}"/DEBIAN/control <<'EOF'
Package: ${PACKAGE_NAME}
Version: ${VERSION}
Section: utils
Priority: optional
Architecture: ${ARCH}
Maintainer: Ram Nagaraj <ram@example.com>
Description: NexaDisk server with real‑time updates, AV scanning, and web UI.
EOF

# 6. Build the .deb package
fakeroot dpkg-deb --build "${PKG_DIR}" "${BUILD_DIR}/${PACKAGE_NAME}_${VERSION}_${ARCH}.deb"

# 7. Install the package (optional)
# sudo dpkg -i "${BUILD_DIR}/${PACKAGE_NAME}_${VERSION}_${ARCH}.deb"

# 8. Enable and start the service
# sudo systemctl daemon-reload
# sudo systemctl enable ${PACKAGE_NAME}.service
# sudo systemctl start ${PACKAGE_NAME}.service

echo "Debian package built at ${BUILD_DIR}/${PACKAGE_NAME}_${VERSION}_${ARCH}.deb"
```

**Usage**:
```bash
chmod +x install_deb.sh
./install_deb.sh
```
The script will create a `.deb` file you can distribute or install on other Debian/Ubuntu machines.
