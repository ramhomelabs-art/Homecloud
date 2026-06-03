# NexaDisk Quick Start Guide

## 🚀 Installation (5 Minutes)

### Windows

1. **Run the installer as Administrator:**
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts\install.ps1
   ```

2. **Start the server:**
   ```powershell
   cd server
   npm start
   ```

3. **Access the application:**
   - Open browser: http://localhost:5000
   - Login: `admin` / `admin`

### Linux/macOS

1. **Run the installer:**
   ```bash
   chmod +x scripts/install.sh
   sudo scripts/install.sh
   ```

2. **Start the server:**
   ```bash
   cd server
   npm start
   ```

3. **Access the application:**
   - Open browser: http://localhost:5000
   - Login: `admin` / `admin`

---

## 📋 What the Installer Does

✅ Checks Node.js and npm installation  
✅ Installs all dependencies (server, client, agent)  
✅ Creates `.env` with secure JWT secret  
✅ Configures firewall rules (ports 5000, 5001)  
✅ Builds the client application  
✅ Creates logs directory  

---

## 🔧 Manual Installation (if installer fails)

### 1. Install Dependencies

```bash
# Server
cd server
npm install

# Client
cd ../client
npm install

# Agent (optional)
cd ../agent
npm install
```

### 2. Configure Environment

```bash
# Copy template
cp .env.example .env

# Generate JWT secret (Linux/macOS)
openssl rand -hex 64

# Or (Windows PowerShell)
[System.BitConverter]::ToString((1..64 | ForEach-Object { Get-Random -Maximum 256 })).Replace("-","").ToLower()

# Edit .env and paste the secret
nano .env  # or use any text editor
```

### 3. Build Client

```bash
cd client
npm run build
```

### 4. Start Server

```bash
cd ../server
npm start
```

---

## 🌐 Setting Up Remote Agents

### 1. Copy Agent to Remote Server

```bash
scp -r agent/ user@remote-server:/path/to/agent/
```

### 2. Configure Agent

```bash
# On remote server
cd /path/to/agent
cp .env.example .env

# Edit .env
nano .env
```

Set:
```env
SERVER_URL=http://192.168.1.100:5000  # Your main server IP
PORT=5001
```

### 3. Start Agent

```bash
npm start
```

### 4. Approve Agent

1. In NexaDisk UI, go to **Devices**
2. Find pending agent
3. Click **Approve**

See `agent/README.md` for detailed setup including running as a service.

---

## 🔒 Security Checklist

After installation:

1. **Change default password:**
   - Login as `admin`
   - Go to Settings → Change Password

2. **Review .env file:**
   - Ensure JWT_SECRET is set
   - Update PORT if needed

3. **Configure firewall:**
   - Allow only trusted IPs (production)
   - Use VPN for remote agents

4. **Enable HTTPS (production):**
   - Set up reverse proxy (nginx/Apache)
   - Use SSL certificates (Let's Encrypt)

---

## 🐛 Troubleshooting

### Port already in use

```bash
# Find process using port 5000
# Windows:
netstat -ano | findstr :5000

# Linux/macOS:
lsof -i :5000

# Kill the process or change PORT in .env
```

### Cannot connect to server

1. Check if server is running
2. Verify firewall allows port 5000
3. Try accessing via IP instead of localhost

### Agent not appearing

1. Check `SERVER_URL` in agent's `.env`
2. Ensure main server is accessible from agent
3. Verify firewall allows port 5001 on agent
4. Check agent logs for errors

### Database errors

```bash
# Delete and recreate database
cd server
rm database.sqlite
npm start  # Migrations will recreate tables
```

---

## 📚 Next Steps

- Read `README.md` for detailed documentation
- See `docs/API.md` for API reference
- Check `agent/README.md` for agent setup
- Review security best practices in README

---

## 🆘 Getting Help

If you encounter issues:

1. Check logs in `logs/` directory
2. Review error messages in console
3. Ensure all dependencies are installed
4. Verify Node.js version (16+)

---

## 🎯 Common Use Cases

### Local File Management
- Just run the server
- No agent needed
- Access local drives

### Multi-Server Setup
1. Run server on main machine
2. Install agents on remote servers
3. Approve agents in UI
4. Manage all servers from one interface

### Sharing Files
1. Right-click file → Share
2. Set password (optional)
3. Set expiration
4. Share the link

---

**You're all set! Enjoy using NexaDisk! 🚀**
