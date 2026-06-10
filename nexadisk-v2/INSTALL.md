# NexaDisk v2 Core Enterprise Installation & Deployment Guide

This document details the configuration, deployment, and execution of the **NexaDisk v2 Core Enterprise Edition** platform on Windows and Linux nodes.

---

## 🛠️ Prerequisites & Requirements

Before starting the installation, ensure the following database and runtime engines are active on your system:

1. **Node.js**: Version `18.x` or `20.x` (LTS recommended).
2. **PostgreSQL Database**: Version `14.x` or higher (persists user metadata, shares, and sync histories).
3. **Redis Key-Value Cache**: Version `5.x` or higher (coordinates BullMQ task queues, background workers, and notifications).
4. **7-Zip CLI** (Optional): Install `7z` or `7za` on your system path to enable extended compression formats (`.7z`, `.rar`, `.tar.gz`).

---

## 📂 System Installation Steps

### 1. Database Setup (PostgreSQL)

Log into your local or remote PostgreSQL instance and run the database creation sequence:

```bash
# Connect as postgres user
psql -U postgres

# Create database for NexaDisk
CREATE DATABASE nexadisk;

# Grant privileges (adjust user/password as needed)
ALTER USER postgres WITH PASSWORD 'postgres';
```
> [!NOTE]
> The database schema (tables, constraints, indexes, default admin account) will be automatically initialized and seeded by the NexaDisk v2 application during the first server startup.

---

### 2. Queue Configuration (Redis)

Start the Redis server on port `6379`.
If Redis is not running or is unreachable, NexaDisk will log a connection warning and automatically transition to a **local in-memory task queue** fallback.

---

### 3. Environment Configurations

Create a `.env` configuration file in the root backend directory:

```ini
# NexaDisk Server Port
PORT=5000
NODE_ENV=production

# JWT Encryption Key
JWT_SECRET=your_long_random_jwt_secret_key_here

# PostgreSQL Credentials
DB_USER=postgres
DB_PASSWORD=postgres
DB_HOST=localhost
DB_DATABASE=nexadisk
DB_PORT=5432

# Redis Cache
REDIS_HOST=localhost
REDIS_PORT=6379

# Storage Drivers ('local' or 's3')
STORAGE_TYPE=local
LOCAL_STORAGE_BASE=/opt/nexadisk/nexadisk-v2/uploads

# Wasabi / MinIO / AWS S3 Driver Configuration (Only if STORAGE_TYPE=s3)
# S3_ACCESS_KEY_ID=your_key_id
# S3_SECRET_ACCESS_KEY=your_secret_key
# S3_ENDPOINT=https://s3.wasabisys.com
# S3_BUCKET=nexadisk-bucket

# Cluster Authentication Token
AGENT_KEY=your_secure_cluster_token
```

---

### 4. Running Backend Server

Navigate to the `server/` directory, install packages, and start the gateway:

```bash
cd server
npm install --legacy-peer-deps
npm start
```

On successful boot, you should see logs indicating active connections:
```text
info: Connected to PostgreSQL successfully.
info: Connected to Redis for Task Queue successfully.
info: Default Administrator account ("admin"/"admin") seeded.
info: ✅ PostgreSQL tables successfully verified/initialized.
info: ✅ NexaDisk v2 Core Enterprise Server running on port 5000
```

---

### 5. Running Frontend Client

To run the React dashboard locally in development mode:

```bash
cd client
npm install --legacy-peer-deps
npm run dev
```

To compile a optimized production build served by the backend server:

```bash
cd client
npm run build
```

---

## 🔑 Default Credentials

- **Default Administrator**:
  - **Username**: `admin`
  - **Password**: `admin`
- **Default Agent Encryption Key**: `nexadisk-agent-secret-key`

---

## ⚡ Deployment & Systemd Service (Linux)

To run the NexaDisk server as a daemon on Debian/Ubuntu systems:

1. Create a systemd service file `/etc/systemd/system/nexadisk.service`:
```ini
[Unit]
Description=NexaDisk v2 Core Enterprise Server
After=network.target postgresql.service redis-server.service

[Service]
Type=simple
User=nexadisk
WorkingDirectory=/opt/nexadisk/nexadisk-v2/server
ExecStart=/usr/bin/node index.js
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

2. Reload daemon and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable nexadisk
sudo systemctl start nexadisk
```

---

## 🔌 Offline / Local Installation

NexaDisk supports fully local, offline installation for both the Master Server and Remote Agent nodes.

### 1. Offline Master Server Installation (Debian VM)

To deploy the Master Server to an offline Debian VM:

1. **Download Packages on an Internet-Connected Machine**:
   On a machine with internet access, run the download sequence to cache all required Debian packages (`nodejs`, `postgresql`, `cifs-utils`, and dependencies) locally:
   ```bash
   ./install_deb.sh --download-deps
   ```
   This will create a `dependencies/` folder in the root directory containing all the `.deb` files.

2. **Transfer Project Folder to Offline VM**:
   Compress and copy the entire `nexadisk-v2/` folder (including the newly created `dependencies/` directory) to the target Debian VM.

3. **Install Offline**:
   On the offline Debian VM, run the installer:
   ```bash
   ./install_deb.sh
   ```
   The script automatically detects the local `dependencies/` folder and installs all packages offline without requiring internet connectivity.

---

### 2. Remote Agent Node Provisioning

To provision and install the agent on another machine (Windows or Linux):

1. Log in to the NexaDisk Web UI, open the **Nodes** section, and click **Provision New Node**.
2. Select the target Operating System (**Windows** or **Linux**) and click **Download Setup Package**.
   - This downloads a pre-configured ZIP containing the agent codebase and a customized installer script (`install.ps1` or `install.sh`) prepopulated with your Master Node's URL and authentication key.
3. Extract the ZIP package on the target machine.
4. Run the installer with administrative privileges:
   - **Linux**: `sudo ./install.sh`
   - **Windows**: Right-click PowerShell, select **Run as Administrator**, then run `.\install.ps1`
5. The installer will automatically:
   - Verify Node.js is present (or download and install it, verifying SHA-256 checksums on Windows).
   - Install local Node dependencies.
   - Configure background startup scripts (systemd service on Linux, Startup Scheduled Task on Windows).

