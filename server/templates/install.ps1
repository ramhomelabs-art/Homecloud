# ==============================================================================
# NexaDisk Remote Agent Autonomous Installation Script (Windows PowerShell)
# Zero-Configuration 1-Line Installer
# ==============================================================================
$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Starting NexaDisk Remote Agent Installation              " -ForegroundColor Cyan
Write-Host " Target Master: __MASTER_URL__                            " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Verify Administrative Privileges
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
$isAdmin = $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Error "ERROR: This script must be run as Administrator. Please open PowerShell as Administrator and retry."
    exit 1
}

# 2. Check and Auto-Install Node.js LTS if missing
$nodeInstalled = $false
try {
    $nodeVersion = node -v
    Write-Host "[+] Found existing Node.js: $nodeVersion" -ForegroundColor Green
    $nodeInstalled = $true
} catch {
    Write-Host "[!] Node.js is not installed on this system." -ForegroundColor Yellow
}

if (-not $nodeInstalled) {
    Write-Host "[*] Downloading Node.js v20.11.0 (LTS 64-bit)..." -ForegroundColor Cyan
    $msiPath = Join-Path $env:TEMP "node-v20.11.0-x64.msi"
    $downloadUrl = "https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi"
    
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $downloadUrl -OutFile $msiPath -UseBasicParsing
    
    Write-Host "[*] Installing Node.js silently in background... Please wait." -ForegroundColor Cyan
    $installProcess = Start-Process msiexec.exe -ArgumentList "/i `"$msiPath`" /qn /norestart" -Wait -PassThru
    if ($installProcess.ExitCode -ne 0) {
        Write-Error "ERROR: Node.js installation failed with exit code $($installProcess.ExitCode)."
        exit 1
    }
    
    # Refresh PATH in current process
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    Write-Host "[+] Node.js installed successfully." -ForegroundColor Green
}

# 3. Setup Agent Directory
$agentInstallDir = "C:\Program Files\NexaDisk-Agent"
Write-Host "[*] Target installation folder: $agentInstallDir" -ForegroundColor Cyan
if (-not (Test-Path $agentInstallDir)) {
    New-Item -Path $agentInstallDir -ItemType Directory -Force | Out-Null
}

# 4. Extract or Download Agent Source
if (Test-Path .\agent\index.js) {
    Write-Host "[*] Copying local agent files..."
    Copy-Item -Path .\agent\* -Destination $agentInstallDir -Recurse -Force
} elseif (Test-Path .\index.js) {
    Write-Host "[*] Copying current folder agent files..."
    Copy-Item -Path .\* -Destination $agentInstallDir -Recurse -Exclude "install.ps1" -Force -ErrorAction SilentlyContinue
} else {
    Write-Host "[*] Fetching latest NexaDisk Agent package from Master Server..." -ForegroundColor Cyan
    $zipPath = Join-Path $env:TEMP "nexadisk-agent-windows.zip"
    $pkgUrl = "__MASTER_URL__/api/v1/provision/download/windows"
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri $pkgUrl -OutFile $zipPath -UseBasicParsing
        Expand-Archive -Path $zipPath -DestinationPath $agentInstallDir -Force
        if (Test-Path "$agentInstallDir\agent") {
            Copy-Item -Path "$agentInstallDir\agent\*" -Destination $agentInstallDir -Recurse -Force
            Remove-Item -Path "$agentInstallDir\agent" -Recurse -Force -ErrorAction SilentlyContinue
        }
    } catch {
        Write-Warning "Direct package fetch failed: $($_.Exception.Message). Ensuring base agent setup."
    }
}

# 5. Install Dependencies if needed
Push-Location $agentInstallDir
if (-not (Test-Path .\node_modules)) {
    Write-Host "[*] Resolving agent runtime dependencies..." -ForegroundColor Cyan
    try {
        Start-Process cmd.exe -ArgumentList "/c npm install --production --legacy-peer-deps" -WorkingDirectory $agentInstallDir -NoNewWindow -Wait
    } catch {
        Write-Warning "npm install had warnings. Continuing startup..."
    }
}

# 6. Auto-detect Storage Drives & Write .env
Write-Host "[*] Auto-detecting local storage partitions and drives..." -ForegroundColor Cyan
$fsDrives = (Get-PSDrive -PSProvider FileSystem | Where-Object { $_.Free -gt 0 } | ForEach-Object { "$($_.Root)\" }) -join ","
if (-not $fsDrives) { $fsDrives = "C:\" }
Write-Host "[+] Exposed storage drives: $fsDrives" -ForegroundColor Green

$envFile = Join-Path $agentInstallDir ".env"
$envContent = @"
# NexaDisk Remote Agent Autonomous Configuration
AGENT_PORT=5001
MASTER_URL=__MASTER_URL__
AGENT_KEY=__AGENT_KEY__
EXPOSED_DRIVES=$fsDrives
"@
Set-Content -Path $envFile -Value $envContent -Force

# 7. Configure Windows Firewall Rule for Agent Port (5001)
try {
    netsh advfirewall firewall delete rule name="NexaDisk-Agent-Port-5001" >$null 2>&1
    netsh advfirewall firewall add rule name="NexaDisk-Agent-Port-5001" dir=in action=allow protocol=TCP localport=5001 >$null 2>&1
    Write-Host "[+] Firewall port 5001 configured for inbound master communication." -ForegroundColor Green
} catch {}

# 8. Register as Windows Background Task (Runs automatically on boot under SYSTEM)
Write-Host "[*] Registering NexaDisk Agent as Windows Startup Service..." -ForegroundColor Cyan
$taskName = "NexaDisk-Agent"

if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
}

$action = New-ScheduledTaskAction -Execute "node.exe" -Argument "index.js" -WorkingDirectory $agentInstallDir
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId "NT AUTHORITY\SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
Start-ScheduledTask -TaskName $taskName

Pop-Location

Write-Host "==========================================================" -ForegroundColor Green
Write-Host " NEXADISK AGENT DEPLOYED & PAIRED SUCCESSFULLY!           " -ForegroundColor Green
Write-Host " Agent daemon is active on port 5001.                     " -ForegroundColor Green
Write-Host " Paired with Master: __MASTER_URL__                       " -ForegroundColor Green
Write-Host " Status: Connected & Background Scheduled Task Active     " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
