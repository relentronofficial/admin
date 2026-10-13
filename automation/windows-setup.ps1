#Requires -RunAsAdministrator
<#
.SYNOPSIS
    TBT Autonomous Development Environment — Windows Setup
    Configures the laptop for 24/7 unattended operation.

.DESCRIPTION
    1. Prevents sleep/hibernate while on AC power
    2. Installs PM2 for process management (optional)
    3. Creates Windows Task Scheduler jobs for health monitoring + task intake
    4. Sets up Git credential caching

.NOTES
    Run once from an Administrator PowerShell:
    cd F:\admin
    powershell -ExecutionPolicy Bypass -File automation\windows-setup.ps1
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ROOT = "F:\admin"

Write-Host "TBT Autonomous Dev Environment Setup" -ForegroundColor Cyan
Write-Host ("=" * 60)

# ──────────────────────────────────────────────────────────────────
# 1. Power Management — no sleep on AC power
# ──────────────────────────────────────────────────────────────────
Write-Host "`n[1/5] Configuring power settings..." -ForegroundColor Yellow

# Disable standby (sleep) on AC power
powercfg /change standby-timeout-ac 0
# Disable hibernate on AC power
powercfg /change hibernate-timeout-ac 0
# Keep monitor on for 2 hours (can go dark but system stays awake)
powercfg /change monitor-timeout-ac 120
# Disable disk spindown on AC
powercfg /change disk-timeout-ac 0

Write-Host "  ✅ Sleep disabled on AC power" -ForegroundColor Green
Write-Host "  ✅ Hibernate disabled on AC power" -ForegroundColor Green
Write-Host "  ⚠️  NOTE: Keep laptop plugged in for 24/7 operation" -ForegroundColor DarkYellow

# ──────────────────────────────────────────────────────────────────
# 2. Git credential caching (avoid re-auth prompts)
# ──────────────────────────────────────────────────────────────────
Write-Host "`n[2/5] Configuring Git credential caching..." -ForegroundColor Yellow

git config --global credential.helper manager
git config --global core.autocrlf true
git config --global pull.rebase false

Write-Host "  ✅ Git credential manager configured" -ForegroundColor Green

# ──────────────────────────────────────────────────────────────────
# 3. GitHub CLI auth check
# ──────────────────────────────────────────────────────────────────
Write-Host "`n[3/5] Checking GitHub CLI..." -ForegroundColor Yellow

$ghInstalled = Get-Command gh -ErrorAction SilentlyContinue
if ($ghInstalled) {
    $ghStatus = gh auth status 2>&1
    if ($ghStatus -match "Logged in") {
        Write-Host "  ✅ GitHub CLI authenticated" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  GitHub CLI not authenticated. Run: gh auth login" -ForegroundColor DarkYellow
    }
} else {
    Write-Host "  ⚠️  GitHub CLI not installed. Install from: https://cli.github.com/" -ForegroundColor DarkYellow
    Write-Host "     Or: winget install GitHub.cli" -ForegroundColor Gray
}

# ──────────────────────────────────────────────────────────────────
# 4. Windows Task Scheduler — Health Monitor (every 2 hours)
# ──────────────────────────────────────────────────────────────────
Write-Host "`n[4/5] Creating scheduled tasks..." -ForegroundColor Yellow

$nodeExe = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $nodeExe) {
    Write-Host "  ❌ Node.js not found. Install from: https://nodejs.org" -ForegroundColor Red
    Write-Host "     Skipping scheduled task creation." -ForegroundColor Gray
} else {
    Write-Host "  Node.js found: $nodeExe" -ForegroundColor Gray

    # Health check — every 2 hours
    $healthAction = New-ScheduledTaskAction `
        -Execute $nodeExe `
        -Argument "$ROOT\automation\health-check.mjs" `
        -WorkingDirectory $ROOT

    $healthTrigger = New-ScheduledTaskTrigger `
        -RepetitionInterval (New-TimeSpan -Hours 2) `
        -Once `
        -At (Get-Date).Date.AddHours(9)

    $taskSettings = New-ScheduledTaskSettingsSet `
        -ExecutionTimeLimit (New-TimeSpan -Minutes 5) `
        -MultipleInstances IgnoreNew `
        -RunOnlyIfNetworkAvailable `
        -StartWhenAvailable

    # Remove existing task if present
    Unregister-ScheduledTask -TaskName "TBT-HealthMonitor" -Confirm:$false -ErrorAction SilentlyContinue

    Register-ScheduledTask `
        -TaskName "TBT-HealthMonitor" `
        -Action $healthAction `
        -Trigger $healthTrigger `
        -Settings $taskSettings `
        -RunLevel Highest `
        -Description "TBT Platform Health Monitoring - runs every 2h" | Out-Null

    Write-Host "  ✅ Created: TBT-HealthMonitor (every 2h)" -ForegroundColor Green

    # Task intake — every 30 minutes (checks for new GitHub Issues)
    $intakeAction = New-ScheduledTaskAction `
        -Execute $nodeExe `
        -Argument "$ROOT\automation\task-intake.mjs" `
        -WorkingDirectory $ROOT

    $intakeTrigger = New-ScheduledTaskTrigger `
        -RepetitionInterval (New-TimeSpan -Minutes 30) `
        -Once `
        -At (Get-Date).Date.AddHours(8)

    Unregister-ScheduledTask -TaskName "TBT-TaskIntake" -Confirm:$false -ErrorAction SilentlyContinue

    Register-ScheduledTask `
        -TaskName "TBT-TaskIntake" `
        -Action $intakeAction `
        -Trigger $intakeTrigger `
        -Settings $taskSettings `
        -RunLevel Highest `
        -Description "TBT GitHub Issues -> Local Queue Sync - runs every 30min" | Out-Null

    Write-Host "  ✅ Created: TBT-TaskIntake (every 30min)" -ForegroundColor Green
    Write-Host "  ⚠️  NOTE: Set GITHUB_TOKEN in System Environment Variables" -ForegroundColor DarkYellow
    Write-Host "           for task-intake.mjs to authenticate with GitHub" -ForegroundColor DarkYellow
}

# ──────────────────────────────────────────────────────────────────
# 5. Environment variable guidance
# ──────────────────────────────────────────────────────────────────
Write-Host "`n[5/5] Environment variable checklist..." -ForegroundColor Yellow

$requiredVars = @(
    @{ Name = "GITHUB_TOKEN"; Purpose = "GitHub API access (task-intake.mjs)" }
)

foreach ($v in $requiredVars) {
    $val = [System.Environment]::GetEnvironmentVariable($v.Name, "Machine")
    if ($val) {
        Write-Host "  ✅ $($v.Name) is set (System)" -ForegroundColor Green
    } else {
        $userVal = [System.Environment]::GetEnvironmentVariable($v.Name, "User")
        if ($userVal) {
            Write-Host "  ✅ $($v.Name) is set (User)" -ForegroundColor Green
        } else {
            Write-Host "  ❌ $($v.Name) NOT SET — $($v.Purpose)" -ForegroundColor Red
            Write-Host "     To set: [System.Environment]::SetEnvironmentVariable('$($v.Name)', 'YOUR_VALUE', 'User')" -ForegroundColor Gray
        }
    }
}

# ──────────────────────────────────────────────────────────────────
# Summary
# ──────────────────────────────────────────────────────────────────
Write-Host "`n" + ("=" * 60) -ForegroundColor Cyan
Write-Host "Setup complete. Next steps:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  1. Keep laptop plugged in (AC power required for no-sleep)" -ForegroundColor White
Write-Host "  2. Set GITHUB_TOKEN as a System environment variable" -ForegroundColor White
Write-Host "     Create a token at: https://github.com/settings/tokens" -ForegroundColor Gray
Write-Host "     Scopes needed: repo, read:org" -ForegroundColor Gray
Write-Host "  3. Open the Dev Dashboard in admin panel:" -ForegroundColor White
Write-Host "     https://v0-tbt-ott-admin.vercel.app/devops" -ForegroundColor Gray
Write-Host "  4. Submit tasks by creating GitHub Issues with label 'devops:pending'" -ForegroundColor White
Write-Host "     https://github.com/relentronofficial/admin/issues/new" -ForegroundColor Gray
Write-Host ""
Write-Host "  Task Scheduler jobs created:" -ForegroundColor White
Write-Host "  - TBT-HealthMonitor: runs every 2h" -ForegroundColor Gray
Write-Host "  - TBT-TaskIntake: syncs GitHub Issues every 30min" -ForegroundColor Gray
Write-Host ""
Write-Host "  Run manually:" -ForegroundColor White
Write-Host "  node automation/health-check.mjs" -ForegroundColor Gray
Write-Host "  node automation/task-intake.mjs" -ForegroundColor Gray
