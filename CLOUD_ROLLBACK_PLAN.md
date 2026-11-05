# Cloud Rollback Plan — TBT LMS Platform

**Created:** 2026-11-04  
**Purpose:** Define recovery procedures for every optimization change

---

## Rollback Principles

1. All Category 1 changes are immediately reversible (< 2 minutes)
2. Deleted container images cannot be recovered — but Cloud Run revisions are protected (never delete an image referenced by an active revision)
3. Keep a record of current configurations before changing anything
4. Test on staging first for Category 2 changes
5. Incremental deploys — verify each change before applying the next

---

## Configuration Snapshot (Pre-Optimization)

Recorded 2026-11-04. Use this to restore if anything goes wrong.

### Cloud Run Services

```bash
# Restore tbt-backend-staging max instances
gcloud run services update tbt-backend-staging \
  --max-instances=12 --project=tbt-lms-platform --region=asia-south1

# Restore tbt-user-web-staging max instances
gcloud run services update tbt-user-web-staging \
  --max-instances=20 --project=tbt-lms-platform --region=asia-south1

# Restore tbt-admin-staging max instances
gcloud run services update tbt-admin-staging \
  --max-instances=20 --project=tbt-lms-platform --region=asia-south1
```

### Artifact Registry Cleanup Policy

```bash
# Remove cleanup policy if it causes unintended deletions
gcloud artifacts repositories remove-cleanup-policies cloud-run-source-deploy \
  --project=tbt-lms-platform \
  --location=asia-south1 \
  --policy=delete-untagged-older-than-30-days

# Or disable dry-run mode if testing
gcloud artifacts repositories set-cleanup-policies cloud-run-source-deploy \
  --project=tbt-lms-platform \
  --location=asia-south1 \
  --dry-run
```

### GCS Lifecycle Rules

```bash
# Remove lifecycle rule from run-sources bucket
gcloud storage buckets update gs://run-sources-tbt-lms-platform-asia-south1 \
  --clear-lifecycle

# Remove lifecycle rule from cloudbuild bucket
gcloud storage buckets update gs://tbt-lms-platform_cloudbuild \
  --clear-lifecycle
```

---

## Rollback Procedures by Change

### R1: Artifact Registry Cleanup Policy Rollback

**Scenario:** Cleanup policy unexpectedly deletes an image referenced by an active Cloud Run revision.  
**Symptoms:** Cloud Run revision status shows `FAILED`, logs show "image not found" or similar.

**Immediate response:**
```bash
# 1. Stop the cleanup policy immediately
gcloud artifacts repositories set-cleanup-policies cloud-run-source-deploy \
  --project=tbt-lms-platform --location=asia-south1 --dry-run

# 2. If a revision lost its image, deploy the latest working build
# The image cannot be recovered, but a fresh deploy creates a new image:
gcloud run deploy tbt-backend \
  --source tbt-admin/backend \
  --region=asia-south1 \
  --project=tbt-lms-platform

# 3. Investigate which policy rule caused the deletion and narrow the condition
```

**Prevention:** The cleanup policy preserves the last 10 images per package. Cloud Run only references the CURRENT active revision's image. If the current revision's image is within the last 10, it is safe.

**Before running bulk cleanup:** Verify the latest active image for each service:
```bash
# Get the image digest of the ACTIVE revision before cleanup
gcloud run services describe tbt-backend \
  --project=tbt-lms-platform --region=asia-south1 \
  --format="value(spec.template.spec.containers[0].image)"
```
Ensure this digest is NOT in the deletion list.

---

### R2: gcr.io Deletion Rollback

**Scenario:** Deleting the gcr.io repo slows down Cloud Build.  
**Symptoms:** Next Cloud Build run takes 15–20 minutes instead of 4–5 minutes (cache miss on first build after deletion).

**Response:**
- No action required. Cloud Build will rebuild its cache layer-by-layer on the next build. Subsequent builds will use the new cache and return to normal speed.
- This is not a rollback scenario — it is an expected one-time slow build.

**There is no rollback for the gcr.io deletion because it is not harmful.** The cache self-heals.

---

### R3: .dockerignore Addition Rollback

**Scenario:** A `.dockerignore` file accidentally excludes a file needed inside the container.  
**Symptoms:** Application startup failure, missing file error in Cloud Run logs.

**Immediate response:**
```bash
# Delete the offending .dockerignore file and push
git rm tbt-admin/backend/.dockerignore
git commit -m "revert: remove dockerignore causing startup failure"
git push origin main
# Wait for CI/CD to build and deploy
```

**Timeline:** CI/CD pipeline completes in ~10 minutes. Downtime depends on when Cloud Run routes traffic to the new revision.

**Zero-downtime note:** Cloud Run uses traffic splitting. The broken revision may start failing health checks; Cloud Run will automatically stop routing traffic to it if the new (previous) revision is still active. Set rollback traffic to the previous revision manually if needed:
```bash
gcloud run services update-traffic tbt-backend \
  --to-revisions=tbt-backend-00XXX-xxx=100 \
  --project=tbt-lms-platform --region=asia-south1
```

---

### R4: Backend Dockerfile Optimization Rollback

**Scenario:** Multi-stage Dockerfile causes runtime issue (missing native module, Prisma binary mismatch, etc.)  
**Symptoms:** Backend fails to start, Prisma errors, missing shared libraries.

**Immediate response:**
```bash
# 1. Revert Dockerfile
git revert <commit-hash>
git push origin main
# CI/CD deploys previous Dockerfile automatically

# 2. If faster rollback needed, deploy from previous revision
gcloud run services update-traffic tbt-backend \
  --to-revisions=tbt-backend-00XXX-xxx=100 \
  --project=tbt-lms-platform --region=asia-south1
```

**Prevention:** Always test the new Dockerfile on staging (`tbt-backend-staging`) and verify all Prisma migrations, background jobs (BullMQ), and socket connections work before promoting to production.

---

### R5: Load Balancer Removal Rollback (Category 3)

**Scenario:** DNS migration to Cloud Run domain mapping fails. Users cannot reach `app.tamilbusinesstribe.com`.  
**Symptoms:** DNS resolution failures, SSL errors, 502/404 from Cloud Run.

**Emergency rollback:**
```bash
# 1. Restore DNS A record to 34.8.132.225 (at your DNS provider)
# This immediately restores traffic to the load balancer

# 2. If the load balancer was deleted, re-provision (30–60 minutes):
# a. Create NEG
gcloud compute network-endpoint-groups create tbt-user-web-neg \
  --region=asia-south1 \
  --network-endpoint-type=SERVERLESS \
  --cloud-run-service=tbt-user-web \
  --project=tbt-lms-platform

# b. Create backend service
gcloud compute backend-services create tbt-user-web-backend \
  --global \
  --load-balancing-scheme=EXTERNAL_MANAGED \
  --project=tbt-lms-platform
gcloud compute backend-services add-backend tbt-user-web-backend \
  --global \
  --network-endpoint-group=tbt-user-web-neg \
  --network-endpoint-group-region=asia-south1 \
  --project=tbt-lms-platform

# c. Create URL map, proxy, forwarding rules
# (Full procedure is lengthy — only needed if LB deleted prematurely)
```

**Prevention:** Keep the load balancer running for at least 72 hours after DNS migration. Only delete after confirming `app.tamilbusinesstribe.com` resolves and works via Cloud Run domain mapping with zero errors.

**DNS propagation risk:** Set TTL to 60 seconds at least 24 hours before the migration to ensure fast failover.

---

## Monitoring During Optimization

### Check Cloud Run health during/after each change

```bash
# Real-time service status
gcloud run services list --project=tbt-lms-platform --region=asia-south1 \
  --format="table(metadata.name,status.conditions[0].type,status.conditions[0].status)"

# Check latest revision status
gcloud run revisions list --service=tbt-backend \
  --project=tbt-lms-platform --region=asia-south1 \
  --format="table(metadata.name,status.conditions[0].status,metadata.creationTimestamp)" \
  --limit=5
```

### Check Cloud Build is still working after gcr.io deletion

```bash
# Trigger a manual backend deploy to verify build pipeline
gcloud run deploy tbt-backend-staging \
  --source tbt-admin/backend \
  --region=asia-south1 \
  --project=tbt-lms-platform

# Monitor build
gcloud builds list --limit=1 --project=tbt-lms-platform \
  --format="table(id,status,createTime,duration)"
```

### Verify image cleanup didn't break active revisions

```bash
# For each service, verify the active image exists in Artifact Registry
SERVICE="tbt-backend"
IMAGE=$(gcloud run services describe $SERVICE \
  --project=tbt-lms-platform --region=asia-south1 \
  --format="value(spec.template.spec.containers[0].image)")
echo "Active image: $IMAGE"
gcloud artifacts docker images describe "$IMAGE" \
  --project=tbt-lms-platform 2>&1 | head -5
```

---

## Decision Log

Record every change made here for audit purposes.

| Date | Change | Applied by | Result |
|---|---|---|---|
| 2026-11-04 | Audit completed, reports created | Claude Code | No infrastructure changes made |
| 2026-11-04 | .dockerignore added to backend, admin-panel, user-web | Claude Code | ✅ Committed; reduces build context size |
| 2026-11-04 | Staging max instances reduced (backend 12→2, user-web 20→2, admin 20→2) | Claude Code | ✅ Applied |
| 2026-11-04 | Backend Dockerfile already multi-stage | Claude Code | ✅ No change needed |
| 2026-11-05 | Backend build moved to GitHub Actions (--image instead of --source) | Claude Code | ✅ CI runs cleaner; Cloud Build only for user-web + admin |
| 2026-11-05 | Production backend max instances reduced 10→5 | Claude Code | ✅ Applied; peak usage was 3 |
| 2026-11-05 | Staging backend deploy-staging.yml uses --image (Phase 7) | Claude Code | ✅ Committed |
| 2026-11-05 | Cloud Monitoring alerts created (3 policies, email channel) | Claude Code | ✅ All 3 enabled |
| 2026-11-05 | AR cleanup policy set on cloud-run-source-deploy | Claude Code | ✅ Keep-10 + delete-untagged-30d; dry-run disabled |
| 2026-11-05 | Bulk AR image cleanup: 2,114 untagged images deleted | Claude Code | ✅ cloud-run-source-deploy: ~329 GB → ~126 GB |
| 2026-11-05 | GCS lifecycle rule: run-sources 30d, cloudbuild 90d | Claude Code | ✅ Applied; 12.5 GiB will reduce over 30 days |
| 2026-11-05 | gcr.io deletion | Skipped | Only 395 MB (not 372 GB) — fresh cache, negligible savings |
| 2026-11-05 | Cloud Run revision cleanup (Phase 9) — 3-pass approach | Claude Code | ✅ Background task running; target: keep 25 newest per service across 6 services |
| 2026-11-05 | Cloud Build eliminated for user-web + admin (Phase 10) | Claude Code | ✅ ci-cd.yml: added build-user-web-image + build-admin-image GHA jobs; deploy-staging.yml: added build-user-web-staging job; all --source replaced with --image; saves ~₹1,500–2,500/month |
| 2026-11-06 | Supabase code decommission (Phase 11) | Claude Code | ✅ Removed supabase.ts plugin, all 4 fallback blocks in upload+user controllers, @supabase/supabase-js+ws packages, 3 Supabase secrets from CI/CD; env vars made optional; Supabase project stays alive until 2026-12-05 rollback window |
