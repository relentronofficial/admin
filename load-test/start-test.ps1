# TBT Load Test — All-in-one runner
# Usage: .\start-test.ps1 [scenario]
# Example: .\start-test.ps1 06
#
# This script:
#   1. Reads CLERK_SECRET from clerk-secret.txt (or prompts you to paste it)
#   2. Gets a fresh Clerk JWT via get-token.mjs
#   3. Immediately runs the k6 scenario
#
# One-time setup: save your Clerk secret key into clerk-secret.txt
#   echo "sk_test_YOUR_KEY_HERE" > clerk-secret.txt

param([string]$Scenario = "06")

$K6  = "F:\k6.exe"
$DIR = "$PSScriptRoot\scenarios"

# ── Step 1: Get CLERK_SECRET ──────────────────────────────────────────────────
$secretFile = "$PSScriptRoot\clerk-secret.txt"

if (Test-Path $secretFile) {
  $env:CLERK_SECRET = (Get-Content $secretFile -Raw).Trim()
  Write-Host "Using CLERK_SECRET from clerk-secret.txt" -ForegroundColor Green
} else {
  Write-Host "clerk-secret.txt not found." -ForegroundColor Yellow
  Write-Host "Paste your Clerk secret key and press Enter:" -ForegroundColor Yellow
  $env:CLERK_SECRET = Read-Host
}

if (-not $env:CLERK_SECRET) {
  Write-Error "CLERK_SECRET is empty. Aborting."
  exit 1
}

# ── Step 2: Generate fresh JWT ────────────────────────────────────────────────
Write-Host "`nGenerating Clerk JWT..." -ForegroundColor Cyan
node "$PSScriptRoot\get-token.mjs"

if ($LASTEXITCODE -ne 0) {
  Write-Error "get-token.mjs failed. Check your CLERK_SECRET."
  exit 1
}

$TOKEN = (Get-Content "$PSScriptRoot\token.txt" -Raw -ErrorAction SilentlyContinue).Trim()
if (-not $TOKEN) {
  Write-Error "token.txt is empty after get-token.mjs. Aborting."
  exit 1
}

Write-Host "Token ready. Starting test immediately..." -ForegroundColor Green

# ── Step 3: Run k6 ───────────────────────────────────────────────────────────
$file = Get-ChildItem "$DIR\${Scenario}*.js" | Select-Object -First 1
if (-not $file) {
  Write-Error "Scenario $Scenario not found in $DIR"
  exit 1
}

$env:K6_WEB_DASHBOARD        = "true"
$env:K6_WEB_DASHBOARD_EXPORT = "$PSScriptRoot\results\report-$Scenario-$(Get-Date -Format 'yyyyMMdd-HHmm').html"
New-Item -ItemType Directory -Force "$PSScriptRoot\results" | Out-Null

Write-Host "`n=== Running $($file.Name) ===" -ForegroundColor Cyan
& $K6 run `
  --env TOKEN=$TOKEN `
  --out "json=$PSScriptRoot\results\$($file.BaseName)-$(Get-Date -Format 'HHmm').json" `
  $file.FullName
