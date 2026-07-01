# Disaster Recovery Testing — TBT Platform

**Last updated:** 2026-07-01  
**Scope:** Google Cloud Run backend + Supabase PostgreSQL + Upstash Redis + Cloudflare R2  
**Target RTO:** ≤ 30 minutes  
**Target RPO:** ≤ 5 minutes (Supabase PITR covers this)

---

## 1. Pre-Test Checklist

Before running any DR scenario, complete these checks:

- [ ] Notify team — DR tests may cause brief service interruption
- [ ] Take a manual Supabase snapshot: Dashboard → Database → Backups → Create backup
- [ ] Note current Cloud Run revision: `gcloud run revisions list --service tbt-backend --region asia-south1`
- [ ] Record current healthy baseline: `curl https://tbt-backend-xxx.run.app/health`
- [ ] Save current env vars: `gcloud run services describe tbt-backend --region asia-south1 --format=json > dr-pre-test-snapshot.json`

---

## 2. Scenario DR-01: Cloud Run Deployment Rollback

**Simulates:** Bad deployment that breaks the backend.  
**Goal:** Verify rollback to previous revision completes in < 5 minutes.

### Steps

```bash
# 1. Identify the last known-good revision
gcloud run revisions list \
  --service tbt-backend \
  --region asia-south1 \
  --format="table(name,status.conditions[0].status,metadata.creationTimestamp)" \
  --limit=5

# 2. Deploy a broken revision (simulate bad config)
gcloud run deploy tbt-backend \
  --image gcr.io/tbt-lms-platform/tbt-backend:latest \
  --region asia-south1 \
  --set-env-vars "DATABASE_URL=intentionally-broken-url" \
  --no-traffic

# 3. Shift 100% traffic to broken revision (simulate the incident)
gcloud run services update-traffic tbt-backend \
  --region asia-south1 \
  --to-latest

# 4. START TIMER — measure RTO from this point ──────────────

# 5. Confirm service is broken
curl -f https://tbt-backend-xxx.run.app/health && echo "STILL UP" || echo "DOWN — expected"

# 6. Rollback: route 100% traffic back to last good revision
GOOD_REVISION=$(gcloud run revisions list \
  --service tbt-backend \
  --region asia-south1\
  --filter="status.conditions[0].status=True" \
  --format="value(name)" \
  --limit=2 | tail -1)

gcloud run services update-traffic tbt-backend \
  --region asia-south1 \
  --to-revisions=${GOOD_REVISION}=100

# 7. Verify recovery
curl -f https://tbt-backend-xxx.run.app/health
# STOP TIMER ──────────────────────────────────────────────────
```

### Pass Criteria
- [ ] Health endpoint returns `{"status":"ok"}` within **5 minutes** of starting rollback
- [ ] Zero data loss (DB not affected by this scenario)
- [ ] RTO documented in results log

---

## 3. Scenario DR-02: Database Connection Pool Exhaustion Recovery

**Simulates:** Supabase connection pool saturated (all connections held).  
**Goal:** Verify the app recovers automatically when connections free up.

### Steps

```bash
# 1. Run the connection exhaustion script (uses k6 to create many concurrent DB queries)
BASE_URL=https://tbt-backend-xxx.run.app \
  ADMIN_TOKEN=<token> \
  k6 run --vus 500 --duration 1m tests/dr/db-exhaust.js

# 2. Monitor Supabase Dashboard → Database → Connections during the test
#    Look for: active_connections approaching max_connections

# 3. Stop the load and verify automatic recovery
# The pool should drain and queries resume within 60s of load stopping.
curl https://tbt-backend-xxx.run.app/health
```

### Pass Criteria
- [ ] Backend auto-recovers within **60 seconds** of load stopping (no manual restart needed)
- [ ] No `FATAL: too many connections` errors persist after load stops
- [ ] Health endpoint recovers to 200 automatically

---

## 4. Scenario DR-03: Database Point-in-Time Recovery (PITR)

**Simulates:** Accidental data deletion / corruption.  
**Goal:** Verify data can be restored to a point-in-time < 5 min ago.

> ⚠️  **Run in staging — this is DESTRUCTIVE on the target DB.**

### Steps

```bash
# 1. Record a known data state
# Log the count of members before the test
psql $DATABASE_URL -c "SELECT COUNT(*) FROM members;" > dr-pre-pitr-member-count.txt

# 2. Simulate accidental deletion (staging only!)
psql $DATABASE_URL -c "DELETE FROM members WHERE email LIKE '%dr_test_%';"
# (create a few test members first so there's something to delete)

# 3. Note the exact timestamp of the deletion
echo "Deletion time: $(date -u +%Y-%m-%dT%H:%M:%SZ)"

# 4. Go to Supabase Dashboard → Database → Backups → Point-in-time Recovery
#    Select a time 2 minutes BEFORE the deletion timestamp
#    Click "Restore"

# 5. Wait for restoration (Supabase shows progress — typically 5–15 min for small DBs)

# 6. Verify data is back
psql $DATABASE_URL -c "SELECT COUNT(*) FROM members;"
# Compare to dr-pre-pitr-member-count.txt
```

### Pass Criteria
- [ ] Restoration completes within **30 minutes**
- [ ] Member count matches pre-deletion count
- [ ] Application functions normally after PITR
- [ ] RPO verified: data loss window was < 5 minutes

---

## 5. Scenario DR-04: Redis Cache Failure

**Simulates:** Upstash Redis becomes unavailable.  
**Goal:** Verify app degrades gracefully (falls back to DB) without crashing.

### Steps

```bash
# 1. Temporarily set Redis URL to a non-existent endpoint
#    (Test this in staging — update env var to an unreachable host)
gcloud run services update tbt-backend \
  --region asia-south1 \
  --update-env-vars "UPSTASH_REDIS_REST_URL=https://nonexistent.upstash.io"

# 2. Check health — should still return 200 (redis plugin skips gracefully)
curl https://tbt-backend-xxx.run.app/health

# 3. Make several API calls that normally use cache
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://tbt-backend-xxx.run.app/api/members

# 4. Restore correct Redis URL
gcloud run services update tbt-backend \
  --region asia-south1 \
  --update-env-vars "UPSTASH_REDIS_REST_URL=<real-url>"
```

### Pass Criteria
- [ ] Health endpoint stays 200 with Redis down (redis plugin is optional per CLAUDE.md)
- [ ] API endpoints still function (DB queries bypass cache)
- [ ] No unhandled exceptions in Cloud Run logs
- [ ] Recovery is immediate once correct Redis URL is restored

---

## 6. Scenario DR-05: Environment Variable Corruption Recovery

**Simulates:** A required env var is accidentally deleted.  
**Goal:** Detect quickly and restore from a known-good configuration snapshot.

### Steps

```bash
# 1. Export all current env vars to a backup file (do this regularly)
gcloud run services describe tbt-backend \
  --region asia-south1 \
  --format="json" | jq '.spec.template.spec.containers[0].env' > .env.backup.$(date +%Y%m%d)

# 2. Simulate corruption: unset a required var
gcloud run services update tbt-backend \
  --region asia-south1 \
  --remove-env-vars "JWT_ACCESS_SECRET"

# 3. Observe: health check should fail because Zod env validation causes exit(1)
curl https://tbt-backend-xxx.run.app/health
# Expect: 502/503 (Cloud Run container fails to start)

# 4. Restore from backup
# Go to GCP > Cloud Run > tbt-backend > Edit & Deploy New Revision
# Re-add JWT_ACCESS_SECRET from the backup file

# 5. Verify recovery
curl https://tbt-backend-xxx.run.app/health
```

### Pass Criteria
- [ ] Cloud Run shows container restart / startup failure in logs immediately
- [ ] Recovery time < **5 minutes** (just an env var update + new revision deploy)
- [ ] Health returns 200 after fix

---

## 7. Scenario DR-06: R2 Storage Outage

**Simulates:** Cloudflare R2 becomes unreachable (upload/download fails).  
**Goal:** Verify non-storage API routes continue working; upload endpoints return 503.

### Steps

```bash
# 1. Temporarily override R2 config with invalid credentials
gcloud run services update tbt-backend \
  --region asia-south1 \
  --update-env-vars "CLOUDFLARE_R2_ACCESS_KEY_ID=intentionally-wrong"

# 2. Test upload endpoint
curl -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"filename":"test.jpg","contentType":"image/jpeg","bucket":"site-assets","pathPrefix":"test"}' \
  https://tbt-backend-xxx.run.app/api/upload/presign
# Expect: 4xx or 5xx (not a hang)

# 3. Test non-upload endpoint — must still work
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://tbt-backend-xxx.run.app/api/members
# Expect: 200

# 4. Restore correct R2 credentials
gcloud run services update tbt-backend \
  --region asia-south1 \
  --update-env-vars "CLOUDFLARE_R2_ACCESS_KEY_ID=<real-key>"
```

### Pass Criteria
- [ ] Upload endpoints return a clear error (not a hang or 500 stack trace)
- [ ] Non-upload endpoints still return 200
- [ ] Recovery is immediate once credentials are restored

---

## 8. DR Results Log Template

After each DR test, fill in and commit this table:

| Date | Scenario | RTO Achieved | RPO Achieved | Issues Found | Status |
|------|----------|-------------|-------------|--------------|--------|
| YYYY-MM-DD | DR-01 Rollback | ___ min | N/A | None | ✅/❌ |
| YYYY-MM-DD | DR-02 DB Pool | ___ sec | N/A | None | ✅/❌ |
| YYYY-MM-DD | DR-03 PITR | ___ min | ___ min | None | ✅/❌ |
| YYYY-MM-DD | DR-04 Redis | ___ sec | N/A | None | ✅/❌ |
| YYYY-MM-DD | DR-05 Env Var | ___ min | N/A | None | ✅/❌ |
| YYYY-MM-DD | DR-06 R2 | ___ sec | N/A | None | ✅/❌ |

---

## 9. Runbook: Production Incident Response

```
1. DETECT
   - Alert: GCP Cloud Run error rate > 5% OR health check failing
   - Source: Sentry, GCP Monitoring, Better Stack

2. ASSESS (< 2 min)
   - curl https://tbt-backend-xxx.run.app/health
   - gcloud run revisions list --service tbt-backend --region asia-south1
   - Check Sentry for exception cluster
   - Check Supabase for DB alarms

3. ROLLBACK if bad deploy (< 3 min)
   gcloud run services update-traffic tbt-backend \
     --region asia-south1 \
     --to-revisions=<last-good>=100

4. RESTORE if data issue
   - Supabase PITR (see DR-03)

5. COMMUNICATE
   - Post in team channel: "Investigating incident at HH:MM UTC"
   - Update after resolution: "Resolved at HH:MM UTC. RTO: X min."

6. POST-MORTEM
   - Root cause, timeline, fix, prevention
   - Update DR runbook if new failure mode discovered
```
