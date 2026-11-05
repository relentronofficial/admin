# Supabase Decommission Plan

**Target date:** 2026-12-05 (30-day rollback window from Cloud SQL migration 2026-11-05)  
**Rollback:** Revert `prod-DATABASE_URL` / `prod-DIRECT_URL` to version 1 in Secret Manager and redeploy — Supabase project must remain intact until this date.

## Current Supabase usage (as of 2026-11-05)

| Component | Status |
|---|---|
| PostgreSQL database | Migrated to Cloud SQL (`tbt-db-production`). Supabase DB is idle. |
| Supabase Storage | **Never reached in production.** `upload/controller.ts` and `user/controller.ts` gate storage calls on `!env.CLOUDFLARE_R2_ACCESS_KEY_ID`. Since R2 is configured in production, the Supabase path is dead code. |
| Supabase Auth | Not used — admin panel uses Clerk, user web uses custom JWT cookies. |
| Supabase Realtime | Not used — Socket.IO + Redis pub/sub handles real-time. |

## Pre-decommission checklist (do before 2026-12-05)

- [ ] Confirm production backend has been running on Cloud SQL for ≥ 30 days with no DB-related incidents
- [ ] Confirm staging backend connects to Cloud SQL (check `stg-DATABASE_URL` secret)
- [ ] Run final DB health check: `GET https://tbt-backend-464464507912.asia-south1.run.app/health` → `{ db: "ok" }`
- [ ] Export Supabase DB one final time as a local backup (optional — Cloud SQL has daily backups going back 7 days):
  ```bash
  pg_dump "postgresql://postgres:<password>@db.apbnvyqlcyfeypvqiyzf.supabase.co:5432/postgres" \
    > supabase-final-backup-$(date +%Y%m%d).sql
  ```

## Code changes (one PR)

### 1. `tbt-admin/backend/src/config/env.ts`
Make the three Supabase vars optional (`.optional()`) first, then remove entirely after deploy confirms they're unused:
```typescript
// Remove these three lines:
SUPABASE_URL: z.string().url(),
SUPABASE_ANON_KEY: z.string(),
SUPABASE_SERVICE_KEY: z.string(),
```

### 2. `tbt-admin/backend/src/server.ts`
```typescript
// Remove this import:
import supabasePlugin from './plugins/supabase.js';

// Remove this registration:
await fastify.register(supabasePlugin);
```

### 3. `tbt-admin/backend/src/modules/upload/controller.ts`
Remove the `if (!env.CLOUDFLARE_R2_ACCESS_KEY_ID || ...)` Supabase fallback block (lines ~133–165). The function should proceed directly to the R2 path (lines after the block). Remove the `SUPABASE_URL` publicUrl construction.

### 4. `tbt-admin/backend/src/modules/user/controller.ts`
Remove three identical Supabase fallback blocks in `presignProfilePhotoHandler`, `assignmentImagePresignHandler`, `assignmentFilePresignHandler` (lines ~5891–5900, ~5928–5937, ~5958–5967). Each block is guarded by `!env.CLOUDFLARE_R2_ACCESS_KEY_ID`.

### 5. `tbt-admin/backend/src/plugins/supabase.ts`
Delete the file entirely.

### 6. `tbt-admin/package.json` (or `tbt-admin/backend/package.json`)
Remove `@supabase/supabase-js` from dependencies. Run `npm install` to update lockfile.

## CI/CD changes

### `.github/workflows/ci-cd.yml` — both staging and production `--set-secrets` blocks
Remove these three entries from every `gcloud run deploy` `--set-secrets` flag:
```
SUPABASE_URL=stg-SUPABASE_URL:latest,
SUPABASE_ANON_KEY=stg-SUPABASE_ANON_KEY:latest,
SUPABASE_SERVICE_KEY=stg-SUPABASE_SERVICE_KEY:latest,
```
(and the `prod-` variants in the production deploy step)

### `.github/workflows/deploy-staging.yml`
Same: remove the three `stg-SUPABASE_*` entries from `deploy-backend-staging`'s `--set-secrets`.

## GCP Secret Manager cleanup

After the backend deploys without the Supabase secrets and runs cleanly for 48 hours:

```bash
# Disable (reversible — keeps the secret, disables the version)
gcloud secrets versions disable 1 --secret=prod-SUPABASE_URL --project=tbt-lms-platform
gcloud secrets versions disable 1 --secret=prod-SUPABASE_ANON_KEY --project=tbt-lms-platform
gcloud secrets versions disable 1 --secret=prod-SUPABASE_SERVICE_KEY --project=tbt-lms-platform
gcloud secrets versions disable 1 --secret=stg-SUPABASE_URL --project=tbt-lms-platform
gcloud secrets versions disable 1 --secret=stg-SUPABASE_ANON_KEY --project=tbt-lms-platform
gcloud secrets versions disable 1 --secret=stg-SUPABASE_SERVICE_KEY --project=tbt-lms-platform

# Delete secrets entirely (irreversible — only after 2+ weeks of clean operation)
gcloud secrets delete prod-SUPABASE_URL --project=tbt-lms-platform
gcloud secrets delete prod-SUPABASE_ANON_KEY --project=tbt-lms-platform
gcloud secrets delete prod-SUPABASE_SERVICE_KEY --project=tbt-lms-platform
gcloud secrets delete stg-SUPABASE_URL --project=tbt-lms-platform
gcloud secrets delete stg-SUPABASE_ANON_KEY --project=tbt-lms-platform
gcloud secrets delete stg-SUPABASE_SERVICE_KEY --project=tbt-lms-platform
```

## Supabase project deactivation

1. Log in to `https://supabase.com/dashboard/project/apbnvyqlcyfeypvqiyzf`
2. Settings → General → **Pause project** (free tier — reversible, keeps data for 90 days)
3. After 2 weeks of confirmed clean operation: Settings → General → **Delete project** (irreversible)

## Rollback (if needed before 2026-12-05)

```bash
# Revert production DATABASE_URL to Supabase
gcloud secrets versions enable 1 --secret=prod-DATABASE_URL --project=tbt-lms-platform
gcloud secrets versions enable 1 --secret=prod-DIRECT_URL --project=tbt-lms-platform
# Disable the Cloud SQL version
gcloud secrets versions disable 2 --secret=prod-DATABASE_URL --project=tbt-lms-platform
gcloud secrets versions disable 2 --secret=prod-DIRECT_URL --project=tbt-lms-platform
# Redeploy
gh workflow run ci-cd.yml --ref main
```
