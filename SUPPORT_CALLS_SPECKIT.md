# SUPPORT_CALLS_SPECKIT — Expert Support Call booking

Status: **IMPLEMENTED & VERIFIED LOCALLY — awaiting PR approval** (2026-10-15). Decisions in §7, limitations in §10, task status in §11.

## 1. Context — what exists today

| Piece | Where | Notes |
|---|---|---|
| Six tiles (Sales, Tech, Content, Marketing, Mentor 1-On-1, Live Group Q&A) | `tbt-user-web/components/features/mentorship/MentorshipDashboard.tsx` → `SupportCallTile` | Display-only. The component renders on **/courses, /profile and /batch-program/mentorship**, so the new behaviour appears on all three. |
| Quota API | `GET /api/user/support-quota` → `getSupportQuotaHandler` (`user/controller.ts`) | `allocated` = `plan_entitlements` row for the member's `membershipPlan`; `used` = count of `support_usage` rows per type. |
| Usage ledger | `support_usage` (raw SQL, `prisma.ts`) | Rows are written **after the fact** by admins (`/settings/entitlements` → `POST /api/support-entitlements/usage`) and by credit-purchase approval. |
| Booking / sessions / meeting links | — | **None exist** for any of the six categories. Webinars (`meetingUrl`) and workshop live calls are separate features and not tied to these categories. |

Category ↔ existing `support_usage.type` (unchanged, reused everywhere):

| Tile | type | allocated column |
|---|---|---|
| Sales Calls | `sales_support` | `sales_call_count` |
| Tech Calls | `tech_support` | `tech_support_days` |
| Content Calls | `content_support` | `content_call_count` |
| Marketing Calls | `ad_support` | `ad_support_days` |
| Mentor 1-On-1 | `one_to_one` | `call_credit_count` |
| Live Group Q&A | `group_call` | `group_call_count` |

## 2. Data model (new, additive only)

Two raw-SQL tables created idempotently in `backend/src/plugins/prisma.ts` (same pattern as MG-01 tables; protected by the CI schema guard, no Prisma model, no migration of existing data).

```sql
CREATE TABLE IF NOT EXISTS support_call_sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category         VARCHAR(30)  NOT NULL,       -- one of the six support_usage types
  title            VARCHAR(200) NOT NULL,
  description      TEXT,
  host_admin_id    UUID REFERENCES admins(id) ON DELETE SET NULL,  -- owning mentor/admin (scopes mentor access)
  host_name        VARCHAR(120),                -- shown to members (no host contact details)
  starts_at        TIMESTAMPTZ  NOT NULL,
  duration_minutes INT          NOT NULL DEFAULT 45,
  capacity         INT          NOT NULL DEFAULT 1,   -- 1 for 1:1 calls, N for group calls
  meeting_url      TEXT,                        -- PRIVATE: only via the join endpoint
  status           VARCHAR(20)  NOT NULL DEFAULT 'scheduled',  -- scheduled | cancelled
  created_by       TEXT,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_scs_category_start ON support_call_sessions(category, starts_at);

CREATE TABLE IF NOT EXISTS support_call_bookings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID NOT NULL REFERENCES support_call_sessions(id) ON DELETE CASCADE,
  member_id    UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  status       VARCHAR(20) NOT NULL DEFAULT 'booked',  -- booked | cancelled | attended | no_show
  booked_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cancelled_at TIMESTAMPTZ,
  usage_id     UUID REFERENCES support_usage(id) ON DELETE SET NULL,  -- set when marked attended
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- one live booking per member per session (duplicate-booking guard at DB level)
CREATE UNIQUE INDEX IF NOT EXISTS uq_scb_session_member_active
  ON support_call_bookings(session_id, member_id) WHERE status <> 'cancelled';
CREATE INDEX IF NOT EXISTS idx_scb_member ON support_call_bookings(member_id);
```

## 3. Business rules (server-enforced)

- **Remaining** per category = `allocated − used − reserved`, where `used` is the existing `support_usage` count (unchanged) and `reserved` = the member's bookings with `status='booked'` on `scheduled` sessions in that category.
- **Book** allowed only if: session `scheduled`, `starts_at > now`, seats left (`capacity − active bookings > 0`), member has no active booking on that session, member `status='active'`, and remaining ≥ 1. A category with `allocated = 0` (e.g. Mentor 1-On-1 = 0/0) is never bookable and shows "Not included in your plan".
- **Concurrency**: book runs in one transaction — `SELECT … FOR UPDATE` on the session row (capacity) + `pg_advisory_xact_lock(hashtext(member_id || category))` (quota across sessions) + the unique index (duplicates). Double-clicks and parallel requests cannot overbook or overspend.
- **Booking ≠ completion.** Booking only reserves. Quota becomes **used** only when an admin marks the booking **attended**, which inserts one `support_usage` row (type = category, `recorded_by` = admin) and links it via `usage_id`. Existing tiles/summary therefore keep their current meaning ("completed calls").
- **Cancel (member)**: own `booked` booking, until **2 hours** before `starts_at` (decided). Releases the reservation.
- **Cancel (admin, whole session)**: session → `cancelled`, its `booked` bookings → `cancelled`; members get an in-app notification.
- **No-show** (decided): admin marks `no_show` → it **consumes** the call exactly like `attended` (one `support_usage` row, linked via `usage_id`).
- **Who manages sessions** (decided): `super_admin` / `admin` manage every session. `mentor` accounts manage only sessions where `host_admin_id` = their own admin id — they can create sessions (host forced to themselves), edit/cancel them, see their bookings and mark attendance. Other roles get 403. Enforced server-side via `getActingAdmin()` (same pattern as helpdesk). Note: the admin Sidebar has no role-based hiding today, so mentors already see every admin page in the menu; that is pre-existing and unchanged.
- **Join**: `GET …/bookings/:id/join` returns `meeting_url` only if the booking is the caller's, status `booked`/`attended`, session `scheduled`, URL set, and `now ∈ [starts_at − 10 min, starts_at + duration]`. Otherwise 403 with a reason ("opens 10 minutes before start", "session ended", "link not added yet"). The URL is never included in list responses.
- **Times**: stored as UTC `timestamptz`; admin enters IST; members see `Asia/Kolkata` with an "IST" label.

## 4. API

Member (`user` module, `/api/user/support-calls`, `authenticateUser`; member id from JWT only, never from the client):

| Method | Path | Returns |
|---|---|---|
| GET | `/api/user/support-calls?category=<type>` | `{ category, quota: {allocated, used, reserved, remaining}, sessions: [{id, title, description, hostName, startsAt, durationMinutes, capacity, seatsLeft, myBooking: {id, status, canCancel, canJoin, joinMessage} | null}]\| null}], history: [{bookingId, title, startsAt, status}] }` — upcoming sessions only, no other members, no meeting URL |
| POST | `/api/user/support-calls/sessions/:id/book` | `{ booking }` · 409 already booked / full · 403 no quota / not included |
| POST | `/api/user/support-calls/bookings/:id/cancel` | `{ booking }` · 403 past cutoff / not yours (404 for other members' ids) |
| GET | `/api/user/support-calls/bookings/:id/join` | `{ meetingUrl }` inside the join window only |

Admin (`support-entitlements` module, Clerk `authenticate`; admin/super_admin see all sessions, mentors only their own — other mentors' ids return 404):

| Method | Path |
|---|---|
| GET / POST | `/api/support-entitlements/sessions` (filters: category, from, to, status) |
| PUT | `/api/support-entitlements/sessions/:id` |
| POST | `/api/support-entitlements/sessions/:id/cancel` |
| GET | `/api/support-entitlements/sessions/:id/bookings` (member name + phone, admin only) |
| PUT | `/api/support-entitlements/bookings/:id/status` (`attended` \| `no_show`) |

Pure rules (quota maths, join window, cancel cutoff, bookability) live in `backend/src/lib/supportCallLogic.ts` with Vitest tests added to `vitest.config.ts#include`.

## 5. UI

**Website** (no visual change to the section; tiles keep size/colours/typography):
- `SupportCallTile` becomes a `<button>` (keyboard + focus ring) that opens **`SupportCallPanel`** (new file in `components/features/mentorship/`): centred modal on desktop, full-width bottom sheet on mobile, same dark surface tokens as the section.
- Panel: category name + icon; quota line (`used/allocated completed · N reserved · N remaining`); upcoming sessions (title, host, `Thu, 23 Oct · 4:00 PM IST · 45 min`, seats left for group calls) with **Book** / **Booked ✓ + Cancel** / **Join** (only inside window); "My calls" history; states: loading skeleton, error + Retry, empty "No sessions scheduled yet — the team will add slots here", "Not included in your plan" for 0-limit categories. Buttons disable while a request is in flight; success/error toasts; quota + list refetch after each action.
- New `lib/api/services/supportCalls.service.ts` + `lib/hooks/useSupportCalls.ts`; invalidates `["user","support-quota"]` so the tiles/summary update.

**Admin**: new page `admin-panel/app/support-calls/page.tsx` + Sidebar entry "Support Calls" under the Support group — sessions table (category filter, upcoming/past), create/edit modal (category, title, description, host name, date-time IST, duration, capacity, meeting link), cancel session, bookings drawer with Mark attended / No-show. Hooks added to `useTbt.ts`.

## 6. Out of scope (v1)

WhatsApp/e-mail reminders, rescheduling (cancel + rebook covers it), recurring session templates, LiveKit-hosted rooms (admin pastes the existing meeting link, same as webinars), Flutter app.

## 7. Decisions (2026-10-15)

- **Q1** Member cancellation cutoff → **2 hours** before start.
- **Q2** No-show → **consumes** the call.
- **Q3** Credit-purchase bug (approve inserted a `support_usage` *usage* row, so buying a call reduced remaining quota; MG-05 intent is "add credits to member") → fixed **first, in a separate PR**: approved `credit_purchases` add to `allocated`; approval no longer writes usage rows.
- **Q4** Session management → **admins + mentor accounts** (mentors scoped to their own sessions, see §3).

## 8. Test plan

Unit: `supportCallLogic` (quota incl. reserved, 0/0 category, join window edges, cancel cutoff). Integration on a throwaway DB + local backend: each of the six categories; book → reserved; duplicate → 409; capacity full → 409; quota exhausted across two sessions in parallel → only one succeeds; cancel releases; another member's booking id → 404; join outside window → 403, inside → URL; admin mark attended → `support_usage` row and tiles' `used` +1; admin cancel session. Browser (Edge, desktop 1440 + mobile 375): all six tiles open the right panel, states (loading/empty/error/not-included), existing dashboard sections unchanged on /courses, /profile, /batch-program/mentorship. Backend + admin + website typecheck, tests, production builds.

## 9. Delivery

One PR into `main` (backend + admin + website; reviewed). After approval/merge: admin deploys via Vercel from `main`; backend + website reach production via the usual `main → production` promotion (only on explicit go-ahead). Live check needs a member login and an admin login; reported as unverified otherwise.

## 10. Implementation notes & known limitations

- Files: backend `lib/supportCallLogic.ts` (+ tests), `lib/supportCallData.ts`, `plugins/prisma.ts` (DDL), `modules/user/{controller,routes}.ts`, `modules/support-entitlements/{controller,routes}.ts`; admin `app/support-calls/page.tsx`, `lib/hooks/useTbt.ts`, `components/layout/Sidebar.tsx`; website `components/features/mentorship/SupportCallPanel.tsx`, `MentorshipDashboard.tsx` (tiles → buttons), `lib/hooks/useSupportCalls.ts`, `lib/api/services/supportCalls.service.ts`.
- The dashboard's "Quota Remaining" summary chip is unchanged (allocated − completed). The per-category panel additionally shows reserved bookings and "left to book".
- Panel strings follow the surrounding `MentorshipDashboard` (hard-coded English), not `uiStrings`.
- Pre-existing, not changed: on a 375px screen `/courses` overflows by ~42px because of the Weekly Revenue chart's Daily/Cumulative toggle (`MentorshipDashboard.tsx` WeeklyChartSection, since 2dbec1f0). Mobile browsers then lay the page out wider than the screen (the site header is clipped too). The panel's mobile sheet is pinned left and capped at `100vw`, so it and its close button stay fully on screen regardless. Fixing that toggle is a separate change.
- Sessions in progress stay listed (so booked members can join) and show "Live now"; booking them is closed in the UI and rejected by the server.
- Pre-existing, not changed: 8 `MentorshipDashboard.test.tsx` tests fail on `main` ("No QueryClient set").

## 11. Task status (updated 2026-10-15)

| # | Task | Status | Where |
|---|---|---|---|
| T1 | Credit-purchase quota bug (Q3) | ✅ Done | PR #84 |
| T2 | Startup DDL: `support_call_sessions`, `support_call_bookings` | ✅ Done | PR #85 |
| T3 | Pure rules + 25 unit tests (`supportCallLogic`) | ✅ Done | PR #85 |
| T4 | Member API: list / book / cancel / join | ✅ Done | PR #85 |
| T5 | Admin/mentor API: sessions CRUD, cancel + notify, bookings, attendance | ✅ Done | PR #85 |
| T6 | Admin page `/support-calls` + Sidebar entry | ✅ Done | PR #85 |
| T7 | Website: six tiles → panel (sessions, book, cancel, join, quota, history, states) | ✅ Done | PR #85 |
| T8 | Live-session state + mobile sheet fit | ✅ Done | PR #85 (`64d9d600`) |
| T9 | Verification on latest `main` (be8558f3) + #84 + #85 | ✅ Done | backend tsc / 302 unit / build; integration all pass (booking + credit suites); admin tsc + prod build; website tsc + build; browser 60/60 (Edge, desktop + 375px); website vitest 73 pass, 8 fail — identical on `main` |
| T10 | Independent approval of #84, then merge | ⏳ Blocked — needs a reviewer who is not the PR author | PR #84 |
| T11 | Merge #84 → #85 retargets to `main` → CI → approval → merge | ⏳ Blocked on T10 | PR #85 |
| T12 | Deploy: admin via Vercel from `main`; backend + website via `main → production` push | ⏳ Blocked on T11 | CI/CD |
| T13 | Live verification (admin/mentor publishes; member books, cancels, joins; quota/attendance update) | ⏳ Blocked on T12 + needs an admin login and a member login | — |
