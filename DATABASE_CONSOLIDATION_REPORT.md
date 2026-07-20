# Database Consolidation Report

**Generated**: 2026-07-20 · after Modules 1–7 shipped
**Sources compared**:
- `co-worker/FULL_MIGRATION.sql` (805 lines, 15 sections)
- Primary schema = `tbt-admin/backend/prisma/schema.prisma` + startup `ALTER TABLE / CREATE TABLE IF NOT EXISTS` block in `plugins/prisma.ts`

---

## TL;DR

The primary schema is **already fully consolidated** — every module we agreed to port (7 of 7) has its tables, indexes, constraints, and seeds running idempotently on every backend boot via `plugins/prisma.ts`. Nothing "missing" needs a manual SQL run.

The five sections we deliberately **skipped** don't map to features in this LMS product; adopting them would create dead schema (see rationale in §B below).

For audit and posterity, this report also produces **`FINAL_MIGRATION.sql`** — a standalone, idempotent, safe-to-re-run copy of every statement the backend currently applies. It's a reference file, not a required action. Cloud Run staging already has all this schema applied.

---

## A. Section-by-section status

| # | Co-worker section | Primary status | Notes |
|---|---|---|---|
| 1 | POSTS (community feed) | **skipped** | Not requested; this LMS has no social/community feed backend. Their `posts` shape (likes/comments/mentor flag/approval) doesn't map to anything we ship. |
| 2 | HOME CAROUSEL | **already exists** | Primary has `hero_slides` + `hero_slides` admin CRUD from before the merge. |
| 3 | PODCAST (categories, series, episodes, progress) | **✅ ported (Module 2)** | `podcast_progress` renamed to `podcast_episode_progress` to avoid collision with a legacy dead `podcast_progress` table on the primary. |
| 4 | E-BOOKS (categories, books, banners, bookmarks, progress) | **✅ ported (Module 3)** | Full 5-table port. |
| 5 | MORNING RITUAL (habits, buttons_config) | **skipped** | Not requested. The co-worker's app used LAN-polling to fetch these — the model doesn't fit our product. |
| 6 | LEGAL PAGES (Terms, Privacy) | **already exists** | Primary uses the generic `site_configs` / `ui_strings` tables for legal copy already. |
| 7 | MOBILE NOTIFICATIONS | **skipped (collides)** | Primary has `notifications` + `app_notifications` with a totally different shape. Adopting `mobile_notifications` would duplicate the notification channel. |
| 8 | ADMIN NOTIFICATIONS | **already exists** | `admin_notifications` was in the primary before the merge. |
| 9 | SUPPORT (settings, categories, faqs, tickets, feedback) | **✅ ported (Module 4)** | All 5 tables renamed `helpdesk_*` to avoid collision with the primary's scaffolded `support_tickets` + `support_messages` Prisma models. |
| 10 | TBT POINTS (activity_log, levels) | **✅ ported (Module 6)** | `user_id TEXT` → `member_id UUID` FK. All 6 levels seeded. |
| 11 | TBT TASKS (90-day path) | **✅ ported (Module 6)** | All 5 seed tasks preserved verbatim with their reward_points. |
| 12 | USER CONNECTIONS (follow graph) | **skipped** | Not requested; social/follow features excluded from the merge. |
| 13 | CONTENT BUDDY AI (conversations, messages, saved, usage) | **✅ ported (Module 1)** | Rate-limit counters now use composite PK on `(member_id, window_type, window_start)`. |
| 14 | (reserved) | — | Numbering placeholder in the co-worker file. |
| 15 | STORAGE BUCKETS (Supabase Storage) | **skipped by design** | Primary uses Cloudflare R2 (`lib/r2.ts`) via presigned URLs. Adopting Supabase Storage buckets would create a second storage layer no code writes to. |

**Ported: 5 sections (3, 4, 9, 10+11, 13)**
**Already-existed: 3 sections (2, 6, 8)**
**Skipped by design: 5 sections (1, 5, 7, 12, 15)**

Nothing is genuinely "missing".

---

## B. Why the skipped sections were skipped

1. **posts** (community feed) — This is a social product feature (user-generated posts + likes/comments/mentor gating + approval). It has no backend equivalent in an LMS. Adding the table without the corresponding social features would leave dead schema in production.

2. **habits / buttons_config** (Morning Ritual) — The co-worker's app used it via LAN polling of the admin server (`192.168.0.123:5000`). Our architecture is Cloud Run; the LAN-poll model doesn't apply.

3. **mobile_notifications** — Column-level collision with the primary's `notifications` table (which has different columns: `reference_id` / `reference_type` / `is_read` vs the primary's `body` / `metadata`). Two parallel notification systems would fragment the notification pipeline.

4. **user_connections** (follow graph) — Social feature. Same rationale as `posts`.

5. **Supabase Storage buckets** — The primary uses Cloudflare R2 exclusively via `lib/r2.ts` and presigned-URL uploads. Enabling Supabase Storage on the side would create two storage layers without a code path that writes to Supabase Storage.

If any of these become desired later, each is a self-contained port (schema + Prisma model + API module) that follows the same pattern as Modules 1–7.

---

## C. Column-level renames for the collisions

Two tables in `FULL_MIGRATION.sql` collided with existing scaffolded models in the primary and were renamed non-destructively (no `DROP` — legacy models still compile untouched):

| Co-worker table | Renamed to (primary) | Reason |
|---|---|---|
| `podcast_progress` | `podcast_episode_progress` | Primary had a legacy `podcast_progress` Prisma model + `podcasts` table from an earlier scaffolded-but-never-wired attempt. |
| `support_settings` | `helpdesk_settings` | Primary has scaffolded `SupportTicket` + `SupportMessage` Prisma models with different shape (member-only, priority enum, message thread). |
| `support_categories` | `helpdesk_categories` | Same as above. |
| `support_faqs` | `helpdesk_faqs` | Same as above. |
| `support_tickets` | `helpdesk_tickets` | Same as above. |
| `support_feedback` | `helpdesk_feedback` | Same as above. |

All other tables kept their co-worker names verbatim.

---

## D. Field-level adaptations applied at port time

Every ported table underwent the same three adaptations before being merged:

1. **`user_id TEXT` → `member_id UUID`** — the co-worker used a per-device anonymous UUID stored in `shared_preferences`. Our stack has real JWT-cookie auth, so all FK columns became `UUID REFERENCES members(id) ON DELETE CASCADE` (or `ON DELETE SET NULL` for the helpdesk tickets where anonymous submission remains valid).

2. **RLS policies dropped** — the co-worker enabled Postgres RLS with `"Allow public read access"` + `"Allow all access for admin portal"`. The primary enforces auth in the Fastify middleware layer, so RLS policies are inert and were not ported (would only add confusion).

3. **Idempotent guards** — all `CREATE TABLE IF NOT EXISTS`, all `INSERT ... ON CONFLICT DO NOTHING`. Seeds preserve admin edits on re-run.

---

## E. Data-loss risk audit — CONFIRMED ZERO

Every table on both sides:
- ✅ Coexists non-destructively (the 6 renamed tables sit next to the primary's legacy models without touching them)
- ✅ Uses `IF NOT EXISTS` guards (safe to boot repeatedly)
- ✅ Uses `ON CONFLICT` for seeds (admin-edited rows preserved)
- ✅ No `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, or `DELETE FROM` runs at boot

The primary's boot-time schema application has run successfully on Cloud Run staging every commit through Module 7 — schema is already in place there.

---

## F. Deliverable — `FINAL_MIGRATION.sql`

Written to repo root as `FINAL_MIGRATION.sql`. It is:
- **Idempotent** — safe to re-run against any Supabase instance
- **Non-destructive** — no drops, no truncates, no data mutations
- **Complete** — every `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE`, `CREATE INDEX`, and seed statement the backend applies at boot
- **Reference-only** — Cloud Run staging already has this schema; you don't need to run this manually. The file exists for audit trails and disaster-recovery cold-starts.

If you want to bootstrap a fresh Supabase project (e.g. staging→prod promotion or a DR restore), `FINAL_MIGRATION.sql` is the single script to run. Otherwise, leave it alone — the backend applies it on every boot.

---

## G. Verifying the primary's live state

To confirm what's actually running on staging Supabase, hit the Supabase SQL editor:

```sql
-- Count tables that landed via the merge
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    -- Module 1
    'ai_conversations', 'ai_messages', 'saved_ai_content', 'ai_usage_counters',
    -- Module 2
    'podcast_categories', 'podcast_series', 'podcast_episodes', 'podcast_episode_progress',
    -- Module 3
    'ebook_categories', 'ebooks', 'ebook_banners', 'ebook_bookmarks', 'ebook_progress',
    -- Module 4
    'helpdesk_settings', 'helpdesk_categories', 'helpdesk_faqs', 'helpdesk_tickets', 'helpdesk_feedback',
    -- Module 6
    'tbt_activity_log', 'tbt_levels', 'tbt_tasks', 'tbt_task_completions'
  )
ORDER BY table_name;
```

Expected: **21 rows** (every ported table across Modules 1–4 and 6).

---

**Bottom line**: Nothing needs a manual SQL run. The schema is consolidated, idempotent, and already applied on staging. `FINAL_MIGRATION.sql` is a reference artifact — keep it in the repo for audit / DR.
