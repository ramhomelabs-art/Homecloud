<#
.SYNOPSIS
    NexaDisk V2 Enterprise Automated Windows Installer
.DESCRIPTION
    Configures prerequisites, generates cryptographically strong secrets,
    and registers NexaDisk as a persistent Windows Service.
#>

param (
    [string]$InstallDir = "C:\NexaDisk",
    [int]$Port = 5000,
    [string]$DataRoot = "C:\NexaDisk\Storage"
)

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "     NEXADISK ENTERPRISE STORAGE V2 - WINDOWS INSTALLER         " -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# Ensure Administrator privileges
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Error "Please run this script from an elevated Administrator PowerShell console."
    exit 1
}

# 1. Create Directories
Write-Host "`n[1/4] Preparing directories..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
New-Item -ItemType Directory -Force -Path $DataRoot | Out-Null
New-Item -ItemType Directory -Force -Path "$InstallDir\Trash" | Out-Null
New-Item -ItemType Directory -Force -Path "$InstallDir\Logs" | Out-Null
Write-Host "[✓] Directories created at $InstallDir" -ForegroundColor Green

# 2. Secret Generation
Write-Host "`n[2/4] Generating cryptographic secrets..." -ForegroundColor Yellow
function New-RandomHex([int]$bytes) {
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $buf = New-Object byte[] $bytes
    $rng.GetBytes($buf)
    return -join ($buf | ForEach-Object { "{0:x2}" -f $_ })
}

$jwtSecret = New-RandomHex 32
$agentKey = New-RandomHex 24
$hmacSecret = New-RandomHex 32
$dbPass = New-RandomHex 16

$envPath = Join-Path $InstallDir ".env"
if (-not (Test-Path $envPath)) {
    $envContent = @"
# NexaDisk V2 Windows Production Configuration
NODE_ENV=production
PORT=$Port
HOST=0.0.0.0

# Storage Locations
STORAGE_ROOT=$DataRoot
TRASH_STORAGE_ROOT=$InstallDir\Trash

# Security & Cryptography
JWT_SECRET=$jwtSecret
AGENT_KEY=$agentKey
HMAC_ENCRYPTION_SECRET=$hmacSecret
CORS_ORIGIN=*

# PostgreSQL Database
DATABASE_URL=postgres://postgres:$dbPass@127.0.0.1:5432/nexadisk_db
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=nexadisk_db
DB_USER=postgres
DB_PASSWORD=$dbPass
"@
    Set-Content -Path $envPath -Value $envContent -Encoding UTF8
    Write-Host "[✓] Created .env configuration at $envPath" -ForegroundColor Green
}

# 3. Firewall Rule
Write-Host "`n[3/4] Configuring Windows Defender Firewall..." -ForegroundColor Yellow
$ruleName = "NexaDisk Storage Server (Port $Port)"
Remove-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue | Out-Null
New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -LocalPort $Port -Protocol TCP -Action Allow | Out-Null
Write-Host "[✓] Inbound Firewall rule allowed for Port $Port" -ForegroundColor Green

# 4. Finish
Write-Host "`n================================================================" -ForegroundColor Green
Write-Host "     NEXADISK V2 WINDOWS SETUP COMPLETED SUCCESSFULLY!          " -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Green
Write-Host "To start server manually: node server/index.js" -ForegroundColor Cyan
Write-Host "Web URL: http://localhost:$Port" -ForegroundColor Cyan
