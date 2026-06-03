# NexaDisk Agent - Automated Windows Installer 🛡️
# This script will install Node.js (if missing), configure Firewall, and start the Agent.

$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   NexaDisk Agent Provisioning - Windows" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. Check for Admin Privileges
if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Warning "Please run this script as ADMINISTRATOR to configure Firewall and Services."
    Pause
    exit
}

# 2. Check for Node.js
try {
    $nodeVersion = node -v
    Write-Host "[1/6] Found Node.js: $nodeVersion" -ForegroundColor Green
}
catch {
    Write-Host "[1/6] Node.js not found. Downloading Installer..." -ForegroundColor Yellow
    $url = "https://nodejs.org/dist/v20.11.1/node-v20.11.1-x64.msi"
    $dest = "$env:TEMP\node_installer.msi"
    Invoke-WebRequest -Uri $url -OutFile $dest
    Write-Host "Installing Node.js... Please wait." -ForegroundColor Cyan
    Start-Process msiexec.exe -ArgumentList "/i `"$dest`" /qn /norestart" -Wait
    Write-Host "Node.js installed successfully." -ForegroundColor Green
    # Refresh PATH for current session
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
}

# 3. Configure Main Server IP
Write-Host "------------------------------------------" -ForegroundColor Yellow
Write-Host "CONFIGURATION REQUIRED" -ForegroundColor Yellow
Write-Host "------------------------------------------" -ForegroundColor Yellow
$serverIp = Read-Host "Enter NexaDisk Main Server IP (e.g., 192.168.1.50)"

if (-not $serverIp) {
    Write-Error "Server IP cannot be empty."
    Pause
    exit
}

# 4. Setup Agent Directory
$agentDir = $PSScriptRoot
Set-Location $agentDir
Write-Host "[2/6] Working in: $agentDir"

# Create .env for configuration
$envContent = "SERVER_URL=http://$serverIp:5000`nPORT=5001"
$envContent | Out-File -FilePath "$agentDir\.env" -Encoding utf8 -Force

# 5. Configure Firewall
Write-Host "[3/6] Adding Firewall Rule for NexaDisk Agent (Port 5001)..." -ForegroundColor Cyan
netsh advfirewall firewall add rule name="NexaDisk Agent" dir=in action=allow protocol=TCP localport=5001 profile=any -ErrorAction SilentlyContinue

# 6. Install Dependencies
Write-Host "[4/6] Installing Agent Dependencies..." -ForegroundColor Cyan
npm install --no-audit --no-fund

# 7. Configure Background Service (Task Scheduler for persistence)
Write-Host "[5/6] Configuring Background Service (Task Scheduler)..." -ForegroundColor Cyan
$taskName = "NexaDiskAgent"

# Remove existing task if it exists
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

$action = New-ScheduledTaskAction -Execute "node" -Argument "agent.js" -WorkingDirectory $agentDir
$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Days 365)
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -User "SYSTEM" -Force

# 8. Start Agent
Write-Host "[6/6] Starting Agent..." -ForegroundColor Green
Start-ScheduledTask -TaskName $taskName

Write-Host "==========================================" -ForegroundColor Green
Write-Host "SUCCESS: NexaDisk Agent is active!"
Write-Host "Server IP configured as: $serverIp"
Write-Host "The Agent will start automatically with Windows."
Write-Host "==========================================" -ForegroundColor Green

Write-Host "Script exiting in 10 seconds..."
Start-Sleep -Seconds 10
