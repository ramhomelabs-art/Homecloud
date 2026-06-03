# NexaDisk Agent Installation Script for Windows
# Run as Administrator: powershell -ExecutionPolicy Bypass -File install-agent.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  NexaDisk Agent Installation Script   " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
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
Write-Host "[1/5] Checking Node.js installation..." -ForegroundColor Yellow
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

# Install dependencies
Write-Host ""
Write-Host "[2/5] Installing agent dependencies..." -ForegroundColor Yellow
if ($offlineMode) {
    npm install --offline --cache ./dependencies
}
else {
    npm install
}
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ Dependency installation failed!" -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ Agent dependencies installed" -ForegroundColor Green

# Check if .env exists
Write-Host ""
Write-Host "[3/5] Checking environment configuration..." -ForegroundColor Yellow
if (Test-Path ".env") {
    Write-Host "  ✓ .env file already exists" -ForegroundColor Green
}
else {
    Write-Host "  ! Creating .env from template..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "  ✓ .env file created" -ForegroundColor Green
    Write-Host "  ! IMPORTANT: Edit .env and set SERVER_URL to your main server IP" -ForegroundColor Yellow
}

# Configure firewall
Write-Host ""
Write-Host "[4/5] Configuring Windows Firewall..." -ForegroundColor Yellow
try {
    # Check if rule already exists
    $existingRule = Get-NetFirewallRule -DisplayName "NexaDisk Agent" -ErrorAction SilentlyContinue
    if ($existingRule) {
        Write-Host "  ! Firewall rule already exists, removing old rule..." -ForegroundColor Yellow
        Remove-NetFirewallRule -DisplayName "NexaDisk Agent"
    }
    
    # Get port from .env or use default
    $port = 5001
    if (Test-Path ".env") {
        $envContent = Get-Content ".env"
        $portLine = $envContent | Where-Object { $_ -match "^PORT=" }
        if ($portLine) {
            $port = ($portLine -split "=")[1].Trim()
        }
    }
    
    # Add firewall rule
    New-NetFirewallRule -DisplayName "NexaDisk Agent" -Direction Inbound -Protocol TCP -LocalPort $port -Action Allow | Out-Null
    Write-Host "  ✓ Firewall rule added for port $port" -ForegroundColor Green
}
catch {
    Write-Host "  ! Could not configure firewall automatically" -ForegroundColor Yellow
    Write-Host "  Please manually allow port 5001 in Windows Firewall" -ForegroundColor Yellow
}

# 5. Service Persistence with PM2
Write-Host ""
Write-Host "[5/5] Configuring PM2 Process Manager..." -ForegroundColor Yellow
try {
    & pm2 delete nexadisk-agent
    Write-Host "  ! Stopped existing nexadisk-agent process" -ForegroundColor Yellow
}
catch {}

& pm2 start agent.js --name nexadisk-agent
& pm2 save
Write-Host "  ✓ NexaDisk Agent started with PM2 persistence" -ForegroundColor Green

# Installation complete
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Agent Installation Complete! ✓       " -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. NexaDisk Agent is now running via PM2 in the background!" -ForegroundColor White
Write-Host "  2. Edit .env file if you haven't already:" -ForegroundColor White
Write-Host "     - SERVER_URL (your main NexaDisk server IP)" -ForegroundColor Gray
Write-Host "     - AGENT_KEY (MUST match the Master Hub's key)" -ForegroundColor Gray
Write-Host ""
Write-Host "  3. Manage the service:" -ForegroundColor White
Write-Host "     pm2 status" -ForegroundColor Gray
Write-Host "     pm2 logs nexadisk-agent" -ForegroundColor Gray
Write-Host "     pm2 restart nexadisk-agent" -ForegroundColor Gray
Write-Host ""
Write-Host "  4. In main NexaDisk UI:" -ForegroundColor White
Write-Host "     - Go to Devices -> Find this agent -> Click Approve" -ForegroundColor Gray
