# NexaDisk Agent Setup Guide

## What is the Agent?

The NexaDisk Agent allows you to connect remote servers to your main NexaDisk instance, enabling multi-server file management from a single interface.

## Prerequisites

- Node.js (v16 or higher)
- Network connectivity to the main NexaDisk server
- Open port 5001 (or custom port)

## Installation

### Quick Installation (Recommended)

**Windows:**
```powershell
cd agent
powershell -ExecutionPolicy Bypass -File scripts\install-agent.ps1
```

**Linux/macOS:**
```bash
cd agent
chmod +x scripts/install-agent.sh
sudo scripts/install-agent.sh
```

The installer will:
- Check Node.js/npm installation
- Install dependencies
- Create .env from template
- Configure firewall rules

### Manual Installation

### 1. Copy Agent Files

Copy the `agent` directory to your remote server:

```bash
# Using scp
scp -r agent/ user@remote-server:/path/to/agent/

# Or using rsync
rsync -avz agent/ user@remote-server:/path/to/agent/
```

### 2. Install Dependencies

```bash
cd agent
npm install
```

### 3. Configure Environment

Create `.env` file from template:

```bash
cp .env.example .env
```

Edit `.env` and configure:

```env
# Main server URL
SERVER_URL=http://192.168.1.100:5000

# Agent port
PORT=5001

# (Optional) Manually specify agent IP if auto-detection fails
AGENT_IP=192.168.1.101
```

### 4. Configure Firewall

**Windows:**
```powershell
netsh advfirewall firewall add rule name="NexaDisk Agent" dir=in action=allow protocol=TCP localport=5001
```

**Linux (UFW):**
```bash
sudo ufw allow 5001/tcp
```

**Linux (firewalld):**
```bash
sudo firewall-cmd --permanent --add-port=5001/tcp
sudo firewall-cmd --reload
```

### 5. Start the Agent

```bash
npm start
```

The agent will automatically register with the main server and send heartbeats every 10 seconds.

## Verification

1. Check agent logs for successful connection:
   ```
   Agent listening on port 5001
   [Heartbeat] Sent to http://192.168.1.100:5000
   ```

2. In the main NexaDisk interface:
   - Go to **Devices** view
   - You should see the agent listed as "Pending"
   - Click **Approve** to enable file operations

## Running as a Service

### Windows (NSSM)

1. Download NSSM: https://nssm.cc/download
2. Install service:
   ```powershell
   nssm install NexaDiskAgent "C:\Program Files\nodejs\node.exe" "C:\path\to\agent\agent.js"
   nssm set NexaDiskAgent AppDirectory "C:\path\to\agent"
   nssm start NexaDiskAgent
   ```

### Linux (systemd)

1. Create service file `/etc/systemd/system/nexadisk-agent.service`:
   ```ini
   [Unit]
   Description=NexaDisk Agent
   After=network.target

   [Service]
   Type=simple
   User=nexadisk
   WorkingDirectory=/path/to/agent
   ExecStart=/usr/bin/node agent.js
   Restart=always
   RestartSec=10

   [Install]
   WantedBy=multi-user.target
   ```

2. Enable and start:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable nexadisk-agent
   sudo systemctl start nexadisk-agent
   ```

3. Check status:
   ```bash
   sudo systemctl status nexadisk-agent
   ```

## Troubleshooting

### Agent not appearing in main server

1. **Check network connectivity:**
   ```bash
   ping <server-ip>
   telnet <server-ip> 5000
   ```

2. **Verify SERVER_URL in .env:**
   - Must be accessible from agent machine
   - Use IP address, not localhost

3. **Check firewall:**
   - Port 5001 must be open on agent
   - Port 5000 must be accessible on server

### "Connection refused" errors

1. **Verify main server is running:**
   ```bash
   curl http://<server-ip>:5000/api/devices
   ```

2. **Check agent logs** for detailed error messages

3. **Ensure CORS is enabled** on main server (already configured)

### Agent shows as "Disconnected"

1. **Check heartbeat interval** - Should send every 10 seconds
2. **Verify network stability**
3. **Restart agent:**
   ```bash
   npm start
   ```

## Security Considerations

1. **Use HTTPS** in production:
   - Set up reverse proxy (nginx/Apache)
   - Use SSL certificates

2. **Firewall rules:**
   - Only allow connections from trusted IPs
   - Use VPN for remote agents

3. **Authentication:**
   - Agents must be manually approved in main interface
   - Pending agents cannot access files

## API Endpoints

The agent exposes these endpoints:

- `GET /stats` - System statistics
- `GET /files/list?path=<path>` - List files
- `POST /files/create/folder` - Create folder
- `POST /files/delete` - Delete file/folder
- `POST /files/move` - Move file/folder
- `POST /files/copy` - Copy file/folder
- `POST /files/upload` - Upload files
- `GET /files/download?path=<path>` - Download file

All endpoints are called by the main server, not directly by users.

## Performance Tips

1. **Network bandwidth:**
   - File transfers go through main server
   - Large files may be slow over WAN

2. **Disk space:**
   - Ensure adequate space for uploads
   - Monitor disk usage

3. **Resource usage:**
   - Agent is lightweight (~50MB RAM)
   - CPU usage minimal except during file operations

## Updating the Agent

1. Stop the agent
2. Pull latest code or copy new files
3. Run `npm install` to update dependencies
4. Restart the agent

## Uninstalling

1. Stop the agent service
2. Remove from main server (disconnect in UI)
3. Delete agent directory
4. Remove firewall rules

---

For more information, see the main README.md
