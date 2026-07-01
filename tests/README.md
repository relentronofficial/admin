# TBT Testing Suite

Comprehensive test suite covering: Stress, Spike, Soak/Endurance, Scalability, Vulnerability, Crash, and Disaster Recovery testing.

## Prerequisites

| Test Type | Tool | Install |
|---|---|---|
| Stress / Spike / Soak / Scalability | [k6](https://k6.io) | `winget install k6` or `choco install k6` |
| Vulnerability / Crash | Node.js 18+ | Built-in (no deps) |
| Disaster Recovery | gcloud CLI + psql | Manual runbook |

## Environment Variables

```bash
# Required for all tests
export BASE_URL=https://tbt-backend-HASH-uc.a.run.app   # Cloud Run URL
# or for local:
export BASE_URL=http://localhost:8000

# Optional — enables authenticated test scenarios
export ADMIN_TOKEN=<Clerk JWT from admin panel>          # Open DevTools → Network → any /api request → Authorization header
export USER_TOKEN=<tbt_access cookie value>              # DevTools → Application → Cookies → tbt_access
```

On Windows PowerShell:
```powershell
$env:BASE_URL = "https://tbt-backend-HASH-uc.a.run.app"
$env:ADMIN_TOKEN = "<token>"
$env:USER_TOKEN = "<token>"
```

---

## 1. Stress Test

Ramps from 10 → 500 VUs over ~14 min. Finds the breaking point.

```bash
k6 run tests/k6/stress-test.js
```

**Watch for:** `stress_error_rate` staying under 10%, `p(95)` under 3s.

---

## 2. Spike Test

Instant jump to 1000 VUs for 1 minute. Tests Cloud Run auto-scaling.

```bash
k6 run tests/k6/spike-test.js
```

**Watch for:** 429s are OK (rate limiter protecting the system). 503/502 = Cloud Run didn't scale fast enough.

---

## 3. Soak / Endurance Test

80 VUs sustained for 2 hours. Surfaces memory leaks and connection leaks.

```bash
k6 run tests/k6/soak-test.js
```

**Watch for:** `soak_late_latency` p95 > 30% higher than `soak_early_latency` p95 → possible memory/connection leak.

---

## 4. Scalability Test

Step-function load: 10 → 25 → 50 → 100 → 150 → 200 → 300 → 400 VUs (3 min each step).

```bash
k6 run tests/k6/scalability-test.js
```

**Analyse results:** Plot RPS vs VUs and p95 latency vs VUs. The inflection point where latency climbs while RPS plateaus is your saturation point.

---

## 5. Vulnerability Scan

OWASP Top-10 probe — tests SQL injection, auth bypass, CORS, rate limiting, XSS, IDOR, mass assignment, path traversal, payload limits.

```bash
node tests/vulnerability/vulnerability-scan.js
```

**Output:** `tests/results/vulnerability-report.json`  
Exit code 1 if any FAIL found.

---

## 6. Crash Test

Pushes the backend with malformed data, protocol abuse, and oversized payloads. After each scenario, verifies the health endpoint is still alive.

```bash
# Run all scenarios
node tests/crash/crash-test.js

# Run a specific scenario
SCENARIO=malformed node tests/crash/crash-test.js
SCENARIO=concurrent node tests/crash/crash-test.js
SCENARIO=large_payload node tests/crash/crash-test.js
SCENARIO=prototype_pollution node tests/crash/crash-test.js
SCENARIO=path_edge node tests/crash/crash-test.js
SCENARIO=method_confusion node tests/crash/crash-test.js
SCENARIO=slow_client node tests/crash/crash-test.js
```

**Output:** `tests/results/crash-report.json`

---

## 7. Disaster Recovery Testing

Manual runbook with 6 DR scenarios. See `tests/dr/disaster-recovery.md`.

| Scenario | What it tests |
|---|---|
| DR-01 | Cloud Run deployment rollback |
| DR-02 | Database connection pool exhaustion recovery |
| DR-03 | Supabase PITR (point-in-time recovery) |
| DR-04 | Redis cache failure graceful degradation |
| DR-05 | Environment variable corruption recovery |
| DR-06 | Cloudflare R2 outage graceful degradation |

```bash
# DR-02 uses k6:
BASE_URL=... ADMIN_TOKEN=... k6 run --vus 500 --duration 1m tests/dr/db-exhaust.js
```

---

## Quick Smoke Run (all node tests, ~2 min)

```bash
node tests/vulnerability/vulnerability-scan.js && node tests/crash/crash-test.js
```

---

## Results

All test runs write JSON reports to `tests/results/`:
- `vulnerability-report.json`
- `crash-report.json`
- `stress-summary.json`
- `spike-summary.json`
- `soak-summary.json`
- `scalability-summary.json`

These files are gitignored (results are environment-specific).
