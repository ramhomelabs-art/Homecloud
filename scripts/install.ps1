# NexaDisk Installation Script for Windows
# Run as Administrator: powershell -ExecutionPolicy Bypass -File install.ps1

Write-Host "================================" -ForegroundColor Cyan
Write-Host "  NexaDisk Installation Script  " -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: This script must be run as Administrator!" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    exit 1
}

# Detect offline mode
$offlineMode = Test-Path "dependencies"
if ($offlineMode) {
    Write-Host "  ! 'dependencies' folder detected. Enabling Offline Installation Mode." -ForegroundColor Cyan
}

# Check Node.js installation
Write-Host "[1/8] Checking Node.js installation..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "  ✓ Node.js $nodeVersion found" -ForegroundColor Green
}
catch {
    Write-Host "  ✗ Node.js not found!" -ForegroundColor Red
    Write-Host "  Please install Node.js from https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

# Check npm installation
try {
    $npmVersion = npm --version
    Write-Host "  ✓ npm $npmVersion found" -ForegroundColor Green
}
catch {
    Write-Host "  ✗ npm not found!" -ForegroundColor Red
    exit 1
}

# Install PM2
Write-Host ""
Write-Host "[1.1] Checking PM2 installation..." -ForegroundColor Yellow
try {
    $pm2Version = pm2 --version
    Write-Host "  ✓ PM2 $pm2Version found" -ForegroundColor Green
}
catch {
    if ($offlineMode) {
        Write-Host "  ! PM2 not found. In offline mode, please install PM2 manually from dependencies folder." -ForegroundColor Yellow
    }
    else {
        Write-Host "  ! PM2 not found. Installing globally..." -ForegroundColor Yellow
        npm install -g pm2
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  ✗ PM2 installation failed!" -ForegroundColor Red
            exit 1
        }
        # Install PM2 startup helper for Windows
        npm install -g pm2-windows-startup
        pm2-startup install
        Write-Host "  ✓ PM2 installed and configured for Windows" -ForegroundColor Green
    }
}

# Install server dependencies
Write-Host ""
Write-Host "[2/8] Installing server dependencies..." -ForegroundColor Yellow
Set-Location -Path "server"
if ($offlineMode) {
    npm install --offline --cache ../dependencies
}
else {
    npm install
}
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ Server dependency installation failed!" -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ Server dependencies installed" -ForegroundColor Green
Set-Location -Path ".."

# Install client dependencies
Write-Host ""
Write-Host "[3/8] Installing client dependencies..." -ForegroundColor Yellow
Set-Location -Path "client"
if ($offlineMode) {
    npm install --offline --cache ../dependencies
}
else {
    npm install
}
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ Client dependency installation failed!" -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ Client dependencies installed" -ForegroundColor Green
Set-Location -Path ".."

# Install agent dependencies
Write-Host ""
Write-Host "[4/8] Installing agent dependencies..." -ForegroundColor Yellow
Set-Location -Path "agent"
if ($offlineMode) {
    npm install --offline --cache ../dependencies
}
else {
    npm install
}
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ Agent dependency installation failed!" -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ Agent dependencies installed" -ForegroundColor Green
Set-Location -Path ".."

# Check if .env exists
Write-Host ""
Write-Host "[5/8] Checking environment configuration..." -ForegroundColor Yellow
if (Test-Path ".env") {
    Write-Host "  ✓ .env file already exists" -ForegroundColor Green
}
else {
    Write-Host "  ! Creating .env from template..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    
    # Generate secure JWT secret
    $bytes = New-Object byte[] 64
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($bytes)
    $jwtSecret = [System.BitConverter]::ToString($bytes).Replace("-", "").ToLower()
    
    # Generate secure Agent Key
    $agentBytes = New-Object byte[] 32
    $rng.GetBytes($agentBytes)
    $agentKey = [System.BitConverter]::ToString($agentBytes).Replace("-", "").ToLower()
    
    # Update values in .env
    $envContent = Get-Content ".env"
    $envContent = $envContent -replace 'JWT_SECRET=.*', "JWT_SECRET=$jwtSecret"
    $envContent = $envContent -replace 'AGENT_KEY=.*', "AGENT_KEY=$agentKey"
    $envContent | Set-Content ".env"
    
    Write-Host "  ✓ .env file created with secure secrets" -ForegroundColor Green
    Write-Host "  ! Please review and update .env file if needed" -ForegroundColor Yellow
}

# Create logs directory
Write-Host ""
Write-Host "[6/8] Creating logs directory..." -ForegroundColor Yellow
if (-not (Test-Path "logs")) {
    New-Item -ItemType Directory -Path "logs" | Out-Null
    Write-Host "  ✓ Logs directory created" -ForegroundColor Green
}
else {
    Write-Host "  ✓ Logs directory already exists" -ForegroundColor Green
}

# Configure firewall
Write-Host ""
Write-Host "[7/8] Configuring Windows Firewall..." -ForegroundColor Yellow
try {
    # Check if rule already exists
    $existingRule = Get-NetFirewallRule -DisplayName "NexaDisk Server" -ErrorAction SilentlyContinue
    if ($existingRule) {
        Write-Host "  ! Firewall rule already exists, removing old rule..." -ForegroundColor Yellow
        Remove-NetFirewallRule -DisplayName "NexaDisk Server"
    }
    
    # Add firewall rule for server
    New-NetFirewallRule -DisplayName "NexaDisk Server" -Direction Inbound -Protocol TCP -LocalPort 5000 -Action Allow | Out-Null
    Write-Host "  ✓ Firewall rule added for port 5000" -ForegroundColor Green
    
    # Add firewall rule for agent
    $existingAgentRule = Get-NetFirewallRule -DisplayName "NexaDisk Agent" -ErrorAction SilentlyContinue
    if ($existingAgentRule) {
        Remove-NetFirewallRule -DisplayName "NexaDisk Agent"
    }
    New-NetFirewallRule -DisplayName "NexaDisk Agent" -Direction Inbound -Protocol TCP -LocalPort 5001 -Action Allow | Out-Null
    Write-Host "  ✓ Firewall rule added for port 5001 (agent)" -ForegroundColor Green
}
catch {
    Write-Host "  ! Could not configure firewall automatically" -ForegroundColor Yellow
    Write-Host "  Please manually allow ports 5000 and 5001 in Windows Firewall" -ForegroundColor Yellow
}

# Build client
Write-Host ""
Write-Host "[8/8] Building client application..." -ForegroundColor Yellow
Set-Location -Path "client"
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ Client build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ Client built successfully" -ForegroundColor Green
Set-Location -Path ".."

# 9. Service Persistence with PM2
Write-Host ""
Write-Host "[9/9] Configuring PM2 Process Manager..." -ForegroundColor Yellow
Set-Location -Path "server"
try {
    & pm2 delete nexadisk
    Write-Host "  ! Stopped existing nexadisk process" -ForegroundColor Yellow
}
catch {}

& pm2 start index.js --name nexadisk
& pm2 save
Write-Host "  ✓ NexaDisk started with PM2 persistence" -ForegroundColor Green
Set-Location -Path ".."

# Installation complete
Write-Host ""
Write-Host "================================" -ForegroundColor Green
Write-Host "  Installation Complete! ✓      " -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. NexaDisk is now running via PM2 in the background!" -ForegroundColor White
Write-Host "  2. Access the application:" -ForegroundColor White
Write-Host "     http://localhost:5000" -ForegroundColor Gray
Write-Host ""
Write-Host "  3. Manage the service:" -ForegroundColor White
Write-Host "     pm2 status" -ForegroundColor Gray
Write-Host "     pm2 logs nexadisk" -ForegroundColor Gray
Write-Host "     pm2 restart nexadisk" -ForegroundColor Gray
Write-Host ""
Write-Host "  4. Default credentials:" -ForegroundColor White
Write-Host "     Username: admin" -ForegroundColor Gray
Write-Host "     Password: admin" -ForegroundColor Gray
Write-Host ""
Write-Host "  5. Remote Nodes (Agents):" -ForegroundColor White
Write-Host "     To add other computers, use the scripts in the 'agent\scripts' folder." -ForegroundColor Gray
Write-Host ""
Write-Host "For more information, see README.md" -ForegroundColor Cyan
