# Installation Scripts

This directory contains automated installation scripts for NexaDisk.

## Main Application Installation

### Windows
```powershell
powershell -ExecutionPolicy Bypass -File scripts\install.ps1
```

### Linux/macOS
```bash
chmod +x scripts/install.sh
sudo scripts/install.sh
```

## What the Scripts Do

1. **Check Prerequisites**
   - Verify Node.js and npm installation
   - Check for administrator/root privileges

2. **Install Dependencies**
   - Server dependencies
   - Client dependencies
   - Agent dependencies

3. **Configure Environment**
   - Create `.env` from template
   - Generate secure JWT secret (128 characters)

4. **Setup Firewall**
   - Windows: Add rules via `New-NetFirewallRule`
   - Linux: Configure UFW or firewalld
   - Ports: 5000 (server), 5001 (agent)

5. **Build Application**
   - Build client production bundle
   - Create logs directory

## Agent Installation

For installing agents on remote servers, see:
- `agent/scripts/install-agent.ps1` (Windows)
- `agent/scripts/install-agent.sh` (Linux/macOS)

Or refer to `agent/README.md` for detailed instructions.

## Manual Installation

If the automated scripts fail, see `QUICKSTART.md` for manual installation steps.

## Troubleshooting

### "Execution Policy" Error (Windows)
Run PowerShell as Administrator and use:
```powershell
powershell -ExecutionPolicy Bypass -File scripts\install.ps1
```

### "Permission Denied" Error (Linux)
Make script executable:
```bash
chmod +x scripts/install.sh
sudo scripts/install.sh
```

### Node.js Not Found
Install Node.js from https://nodejs.org/ (v16 or higher recommended)

### Firewall Configuration Failed
Manually configure firewall:

**Windows:**
```powershell
netsh advfirewall firewall add rule name="NexaDisk Server" dir=in action=allow protocol=TCP localport=5000
netsh advfirewall firewall add rule name="NexaDisk Agent" dir=in action=allow protocol=TCP localport=5001
```

**Linux (UFW):**
```bash
sudo ufw allow 5000/tcp
sudo ufw allow 5001/tcp
```

**Linux (firewalld):**
```bash
sudo firewall-cmd --permanent --add-port=5000/tcp
sudo firewall-cmd --permanent --add-port=5001/tcp
sudo firewall-cmd --reload
```

## Support

For more information:
- Main documentation: `../README.md`
- Quick start guide: `../QUICKSTART.md`
- Agent setup: `../agent/README.md`
- API documentation: `../docs/API.md`
