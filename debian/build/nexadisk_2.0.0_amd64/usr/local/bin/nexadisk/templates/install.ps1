# ==============================================================================
# NexaDisk Remote Agent Installation Script (Windows PowerShell)
# ==============================================================================
$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Starting NexaDisk Agent Installation                     " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Verify Administrative Privileges
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
$isAdmin = $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Error "ERROR: This script must be run as Administrator. Please open PowerShell as Administrator and retry."
    exit 1
}

# 2. Check and Install Node.js
$nodeInstalled = $false
try {
    $nodeVersion = node -v
    Write-Host "Found existing Node.js: $nodeVersion"
    $nodeInstalled = $true
} catch {
    Write-Host "Node.js is not installed on this system."
}

if (-not $nodeInstalled) {
    # Check if a local node MSI exists
    $localMsi = Get-ChildItem -Path . -Filter "node-v*.msi" -Recurse | Select-Object -First 1
    $msiPath = ""
    
    if ($localMsi -ne $null) {
        Write-Host "Found local Node.js installer: $($localMsi.FullName)"
        $msiPath = $localMsi.FullName
    } else {
        Write-Host "No local Node.js installer found. Downloading Node.js v20.11.0 (LTS)..."
        $msiPath = Join-Path $env:TEMP "node-v20.11.0-x64.msi"
        $downloadUrl = "https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi"
        $expectedSha256 = "439632831206f4c80252570d10c0e74287f32997193557e0344d156578a1b643"
        
        Invoke-WebRequest -Uri $downloadUrl -OutFile $msiPath
        
        # Verify SHA-256 Checksum
        Write-Host "Verifying download integrity (SHA-256)..."
        $hash = Get-FileHash -Path $msiPath -Algorithm SHA256
        if ($hash.Hash.ToLower() -ne $expectedSha256.ToLower()) {
            Write-Error "ERROR: SHA-256 signature verification failed. Download may be corrupted or compromised."
            exit 1
        }
        Write-Host "Integrity verified successfully."
    }
    
    # Run Node.js Installer Silently
    Write-Host "Installing Node.js... Please wait."
    $installProcess = Start-Process msiexec.exe -ArgumentList "/i `"$msiPath`" /qn /norestart" -Wait -PassThru
    if ($installProcess.ExitCode -ne 0) {
        Write-Error "ERROR: Node.js installation failed with exit code $($installProcess.ExitCode)."
        exit 1
    }
    
    # Refresh PATH environment variable in current session
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    Write-Host "Node.js installation completed successfully."
}

# 3. Setup Agent Directory
$agentInstallDir = "C:\Program Files\NexaDisk-Agent"
Write-Host "Installing agent files to $agentInstallDir..."
if (-not (Test-Path $agentInstallDir)) {
    New-Item -Path $agentInstallDir -ItemType Directory -Force | Out-Null
}

# Copy files from extraction directory
if (Test-Path .\agent) {
    Copy-Item -Path .\agent\* -Destination $agentInstallDir -Recurse -Force
} else {
    # If running from inside agent folder
    Copy-Item -Path .\* -Destination $agentInstallDir -Recurse -Exclude "install.ps1" -Force -ErrorAction SilentlyContinue
}

# 4. Install npm dependencies
Push-Location $agentInstallDir
if (-not (Test-Path .\node_modules)) {
    Write-Host "Installing Node dependencies..."
    try {
        Start-Process cmd.exe -ArgumentList "/c npm install --production --legacy-peer-deps" -WorkingDirectory $agentInstallDir -NoNewWindow -Wait
    } catch {
        Write-Warning "npm install failed. Node modules may need to be pre-packaged or installed manually."
    }
}

# 5. Generate Environment Config
$envFile = Join-Path $agentInstallDir ".env"
if (-not (Test-Path $envFile)) {
    Write-Host "Generating environment configuration..."
    $envContent = @"
# NexaDisk Remote Agent Configuration
AGENT_PORT=5001
MASTER_URL=__MASTER_URL__
AGENT_KEY=__AGENT_KEY__
EXPOSED_DRIVES=C:\
"@
    Set-Content -Path $envFile -Value $envContent
} else {
    # Replace placeholders in existing .env if present
    $envContent = Get-Content -Path $envFile -Raw
    $envContent = $envContent -replace "__MASTER_URL__", "__MASTER_URL__"
    $envContent = $envContent -replace "__AGENT_KEY__", "__AGENT_KEY__"
    Set-Content -Path $envFile -Value $envContent
}
Pop-Location

# 6. Register as Windows Startup Task (SYSTEM Privileges)
Write-Host "Registering startup scheduled task..."
$taskName = "NexaDisk-Agent"

# Clean existing task if any
if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
}

$action = New-ScheduledTaskAction -Execute "node.exe" -Argument "index.js" -WorkingDirectory $agentInstallDir
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId "NT AUTHORITY\SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
Start-ScheduledTask -TaskName $taskName

Write-Host "==========================================================" -ForegroundColor Green
Write-Host " AGENT INSTALLATION SUCCESSFUL!                           " -ForegroundColor Green
Write-Host " Agent registered as startup task and started.            " -ForegroundColor Green
Write-Host " Verify using: Get-ScheduledTask -TaskName $taskName      " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
