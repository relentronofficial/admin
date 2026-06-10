# TBT Load Test Runner
# Usage: .\run.ps1 [scenario]
# Examples:
#   .\run.ps1 01       -> public endpoints only
#   .\run.ps1 02       -> member dashboard
#   .\run.ps1 05       -> full journey (main test)
#   .\run.ps1 06       -> 45-second capacity burst (JWT-safe, 500 VUs)
#   .\run.ps1 all      -> run all scenarios sequentially
#
# Workshop slugs are discovered dynamically from the API at test start.
# No SLUG env var needed — scenarios 03, 05, 06 auto-fetch all active workshops.
#
# NOTE: Run `$env:CLERK_SECRET="sk_test_..."; node get-token.mjs` first to refresh token.txt
#       Clerk JWTs expire in ~60s — run the test immediately after get-token.mjs.

param([string]$Scenario = "05")

$K6    = "F:\k6.exe"
$DIR   = "$PSScriptRoot\scenarios"
$TOKEN = Get-Content "$PSScriptRoot\token.txt" -Raw -ErrorAction SilentlyContinue

if (-not $TOKEN) {
  Write-Error "No token found. Run: node get-token.mjs first."
  exit 1
}
$TOKEN = $TOKEN.Trim()

$env:K6_WEB_DASHBOARD = "true"
$env:K6_WEB_DASHBOARD_EXPORT = "$PSScriptRoot\results\report-$Scenario-$(Get-Date -Format 'yyyyMMdd-HHmm').html"

New-Item -ItemType Directory -Force "$PSScriptRoot\results" | Out-Null

function Run-Scenario($num) {
  $file = Get-ChildItem "$DIR\${num}*.js" | Select-Object -First 1
  if (-not $file) { Write-Error "Scenario $num not found"; return }
  Write-Host "`n=== Running $($file.Name) ===" -ForegroundColor Cyan
  & $K6 run `
    --env TOKEN=$TOKEN `
    --out "json=$PSScriptRoot\results\$($file.BaseName)-$(Get-Date -Format 'HHmm').json" `
    $file.FullName
}

if ($Scenario -eq "all") {
  foreach ($n in @("01","02","03","05","06")) { Run-Scenario $n }
} else {
  Run-Scenario $Scenario
}
