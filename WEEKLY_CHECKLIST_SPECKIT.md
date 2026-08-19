# 90-Day Task Weekly Checklist System — Speckit

Adds a **weekly rollup layer** on top of the existing 90-day batch program (`TASK_FEATURE_SPEC.md`) — required/optional task flags, per-week analytics for admins, weekly progress UI for members (web + mobile), and a real multi-device push-notification pipeline (the FCM device-registration endpoint the mobile app was already calling was previously a 404).

**Status: implemented, verified, and committed.**
Audit + verification date: 2026-08-19. Written against branch `feature/app`, HEAD `3496819`; the described changes now live in three commits on top of that: `2ef5a5a` (this document), `42580d9` (backend), `e28193d` (Admin Panel + User Web + Mobile UI). Not yet pushed to `origin/feature/app`.

Week number is a **derived value, never stored** — `ceil(dayNumber / 7)` — computed identically in three places (backend `weekChecklistLogic.ts`, user-web `batch-program/page.tsx`, mobile `batch_program_screen.dart`). This is the load-bearing invariant of the whole feature: it stays correct even if a task's `dayNumber` or a batch's `extendedDays` changes later, with no migration.

---

## 0. Key Decisions

| # | Decision | Why |
|---|---|---|
| D1 | Week number is computed, not persisted — no `week_number` column anywhere | A stored value would drift the moment `extendedDays` or a task's `dayNumber` changes. `getWeekNumber(dayNumber) = max(1, ceil(dayNumber/7))` is cheap enough to compute on every read, in every client, with zero sync risk. |
| D2 | Multi-device push via a new `NotificationDevice` table, with the legacy `Member.pushToken` column kept in sync as a fallback | `sendPushToMember()` (`pushNotifications.ts`) queries devices first, falls back to `member.pushToken` only if zero device rows exist — so any code path that still reads the old column keeps working during rollout, and members with 2+ devices (phone + tablet, reinstall) now all receive pushes instead of only the most recent one. |
| D3 | Dead FCM tokens are pruned automatically, not just logged | `sendPushNotificationDetailed()` in `firebase.ts` now distinguishes `invalidToken` (404 / `UNREGISTERED` / `NOT_FOUND` / `INVALID_ARGUMENT`) from a transient failure. `sendPushToMember()` deletes the `NotificationDevice` row and clears `member.pushToken` only on `invalidToken`, never on a network blip. |
| D4 | Task delete becomes **soft** (deactivate) once a submission exists; hard-delete only when submission count is zero | `deleteBatchTaskHandler` now checks `taskSubmission.count()` first. Historical submissions/reports must survive a task being pulled from future weeks — deleting the row would orphan `TaskSubmission.taskId` and silently corrupt past week-analytics. Callers read `data.deactivated` to know which happened; the admin confirm-dialog copy was updated to say so. |
| D5 | `isRequired` defaults to `true`, `isActive` defaults to `true` — additive-only schema change | Every existing task row (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS is_required BOOLEAN NOT NULL DEFAULT true`) becomes "required" automatically — the pre-existing 90-day checklist behavior (all tasks count toward completion) is unchanged for every task created before this feature shipped. |
| D6 | Checklist-available vs. still-pending reminders are two distinct notification types, deduplicated differently | `batchReminderCronHandler` previously sent one generic "reminder" every run for any incomplete day. It now sends `checklist_available` **once** per member per day (dedup by querying existing `AppNotificationRecipient` rows for that `actionUrl`, via `shouldSendChecklistAvailableNotif`'s underlying dedup contract) when a day has no progress row yet, and falls through to the existing daily `checklist_reminder`-style push otherwise. Prevents "Day 14 is now open!" firing every cron tick for the same day. |
| D7 | Weekly WhatsApp report delivery (`batchReports.ts`, pre-existing feature) gained a **second, independent notification channel** for the same event, not a replacement | When `reportType === 'weekly' && stats.pending > 0`, an `AppNotification` + push now fire alongside the existing WhatsApp send, guarded by its own `.catch(() => {})` so a WhatsApp failure never blocks the push and vice versa. |
| D8 | `getMyBatchHandler`'s task query changed from "program tasks only" to "program tasks **OR** this batch's inline tasks" | Before this feature, a batch created via "Clone Batch" or with only admin-authored inline tasks (`Task.batchId` set, `programId` null) silently showed **zero** tasks to members — `programTasks` was gated entirely on `batch.programId`. The `OR` clause (with `isActive: true` on both branches) fixes this as a byproduct; it was found while wiring `isRequired`/`isActive` through the same query and is in scope because the weekly UI needs the required/optional flag to render correctly for both task sources. |

---

## 1. Scope

**In scope:**
- Backend domain logic + API for weekly rollups
- Required/optional task flag, end-to-end (schema → API → Admin Panel → User Web → Mobile)
- Multi-device FCM registration + push fan-out with dead-token pruning
- Weekly progress UI: Admin Panel (Progress tab → Weeks view), User Web (`/batch-program`), Mobile (`batch_program_screen.dart`)
- Scheduler: checklist-available vs. still-pending reminder dedup
- Weekly WhatsApp report gains a parallel in-app + push notification

**Out of scope (pre-existing, untouched):**
- Daily checklist submission/approval flow (`TASK_FEATURE_SPEC.md`, already shipped)
- Break requests, attendance, extended days, `xp_per_day`
- Day-level analytics (`GET /:id/day-analytics`) — the new week-analytics endpoint is additive alongside it, not a replacement

---

## 2. Data Model Changes

All changes are additive, idempotent startup SQL in `backend/src/plugins/prisma.ts` (no migration file — this repo's established pattern, see `CLAUDE.md` pitfall #14/#28) plus matching Prisma schema entries.

### 2.1 `schema.prisma`

| Model | Change | Line (approx.) |
|---|---|---|
| `Member` | `+ notificationDevices NotificationDevice[]` | `schema.prisma:400` |
| `Task` | `+ isRequired Boolean @default(true)`, `+ isActive Boolean @default(true)`, `+ createdBy String?` | `schema.prisma:655-660` |
| `NotificationDevice` (**new model**) | `id, memberId, fcmToken (unique), platform?, lastSeenAt, createdAt` — `onDelete: Cascade` from `Member` | `schema.prisma:673-687` |
| `UiStrings` | `+ batchRequiredLabel` (default `"Required"`), `+ batchOptionalLabel` (default `"Optional"`), `+ batchWeekLabel` (default `"Week"`) | `schema.prisma:2366-2369` |

### 2.2 Startup SQL (`plugins/prisma.ts`)

```sql
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS is_required BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_by TEXT;

CREATE TABLE IF NOT EXISTS notification_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  fcm_token TEXT NOT NULL,
  platform VARCHAR(20),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS notification_devices_fcm_token_key ON notification_devices(fcm_token);
CREATE INDEX IF NOT EXISTS idx_notification_devices_member ON notification_devices(member_id);

ALTER TABLE site_configs
  ADD COLUMN IF NOT EXISTS batch_required_label TEXT NOT NULL DEFAULT 'Required',
  ADD COLUMN IF NOT EXISTS batch_optional_label TEXT NOT NULL DEFAULT 'Optional',
  ADD COLUMN IF NOT EXISTS batch_week_label TEXT NOT NULL DEFAULT 'Week';
```

No manual `prisma migrate` step is required — this runs automatically on next backend startup (staging and production both run `prisma db push` in CI per `CLAUDE.md` deployment notes, so schema stays in sync regardless).

---

## 3. Backend Domain Logic (`lib/weekChecklistLogic.ts`)

Pure functions — no DB, no Fastify, no `Date.now()`/`new Date()` defaults baked in (accepts `now` as a param) — deliberately isolated so `vitest` can test it with zero mocking. Covered by `weekChecklistLogic.test.ts` (7 `describe` blocks, all passing).

| Function | Signature | Purpose |
|---|---|---|
| `getWeekNumber` | `(dayNumber) => number` | `max(1, ceil(dayNumber/7))` |
| `getWeekDayRange` | `(weekNumber, totalDays?) => {startDay, endDay}` | Clamps `endDay` to `totalDays` for the final partial week |
| `getWeekDateRange` | `(batchStartsAt, weekNumber) => {startDate, endDate}` | Calendar dates for a week, derived from `batch.startsAt` — never hardcoded |
| `getCurrentDayNumber` / `getCurrentWeekNumber` | `(startsAt, now?) => number` | Batch-relative "today" |
| `computeApprovalRate` | `(approved, total) => number` | Rounds to nearest %, guards divide-by-zero |
| `summarizeWeek` | `(params) => WeekSummary` | Aggregates per-day rows into week totals — used by `getWeekAnalyticsHandler` |
| `checklistAvailableActionUrl` | `(dayNumber) => string` | `/batch-program/{dayNumber}` — the dedup key for "day just became available" notifications |
| `shouldSendChecklistAvailableNotif` | `(alreadyNotifiedDayNumbers, dayNumber) => boolean` | Dedup guard contract (the cron handler implements the actual DB-backed check against this same rule) |

---

## 4. Backend API Surface

| Endpoint | Handler | File | New/Changed |
|---|---|---|---|
| `GET /api/batches/:id/week-analytics?week=N` | `getWeekAnalyticsHandler` | `modules/batches/controller.ts:602` | **New.** `week` optional, defaults to the batch's current week via `getCurrentWeekNumber(batch.startsAt)`. Returns `summarizeWeek()` output merged with `memberWise[]` and `taskWise[]` (see §7). **Auth:** protected by Clerk authentication — `batchRoutes` applies `fastify.authenticate` as a plugin-wide `preHandler`, same as every other route in this module. |
| `POST /api/batches/:id/tasks` | `createBatchTaskHandler` | `modules/batches/controller.ts:763` | Changed — accepts `isRequired`, `isActive`; sets `createdBy` from `req.auth.sub`. |
| `PUT /api/batches/:id/tasks/:taskId` | `updateBatchTaskHandler` | `modules/batches/controller.ts:800` | Changed — accepts `isRequired`, `isActive` (partial update, only applied when present in body). |
| `DELETE /api/batches/:id/tasks/:taskId` | `deleteBatchTaskHandler` | `modules/batches/controller.ts:~830` | Changed — soft-deactivates instead of hard-deleting when `TaskSubmission` rows reference the task (D4). Response: `{deactivated: boolean, task?}`. |
| `POST /api/user/fcm-token` | `registerFcmTokenHandler` | `modules/user/controller.ts:4215` | **New.** Upserts `NotificationDevice` by `fcmToken`; also mirrors into legacy `Member.pushToken`. Mobile was already calling this (`kUserFcmToken` in `api.dart`) — it previously 404'd. **Validation:** returns `400` with `'token is required'` when the request body has no `token`. **Auth:** protected by JWT-cookie user authentication — `userRoutes` applies `fastify.authenticateUser` as a plugin-wide `preHandler`. |
| `DELETE /api/user/fcm-token` | `removeFcmTokenHandler` | `modules/user/controller.ts:~4235` | **New.** With `token`: deletes that one device row. Without: clears all of the member's device rows (logout-without-known-token case). **Auth:** protected by JWT-cookie user authentication (same `userRoutes` `preHandler` as above). |

`GET /api/user-batch` (`getMyBatchHandler`) task-selection query changed per D8 — now `OR`s program tasks with this batch's inline tasks, both filtered `isActive: true`, and selects the two new columns (`isRequired`, `isActive`).

---

## 5. Push Notification Architecture

### 5.1 `sendPushNotificationDetailed()` (`lib/firebase.ts`)

Return type changed from `Promise<boolean>` to `Promise<PushSendResult>` (`{ok, invalidToken}`). The old `sendPushNotification()` signature is preserved as a thin wrapper (`return (await sendPushNotificationDetailed(...)).ok`) — **no caller of the old function needed to change.**

`invalidToken` is `true` only for: HTTP 404, or FCM error `status` of `UNREGISTERED` / `NOT_FOUND` / `INVALID_ARGUMENT`. A 401 still invalidates the cached OAuth token (pre-existing behavior) but is never treated as a dead device token.

### 5.2 `sendPushToMember()` (`lib/pushNotifications.ts` — new file)

```
sendPushToMember(prisma, memberId, title, body, data?) → void, never throws
```
1. Load all `NotificationDevice` rows for the member.
2. If none exist, fall back to `member.pushToken` (single-device legacy path — covers members who logged in on a build before this feature shipped).
3. Fan out to every target in parallel (`Promise.all`).
4. On `invalidToken` per-target: delete that `NotificationDevice` row (if it came from one) and clear `member.pushToken` if it matches.

Every call site is wrapped in `.catch(() => {})` by convention already established elsewhere in this codebase (notification creation must never fault the calling flow) — `sendPushToMember` itself also never throws internally.

### 5.3 Call sites

| Caller | File | Trigger |
|---|---|---|
| `sendBatchNotif()` (shared helper) | `user-batch/controller.ts:12` | Every existing batch notification (day approved/rejected, checklist submitted, checklist available) now routes through `sendPushToMember` instead of reading `member.pushToken` directly |
| `deliverMemberReport()` | `lib/batchReports.ts:152` | New: weekly report with `pending > 0` (D7) |

### 5.4 Mobile registration lifecycle

- **Register:** `members_service.dart:32` — `POST kUserFcmToken` with `{token}`. This call already existed in the mobile codebase (fired on login/permission-grant) but had no backend route until this feature — was silently 404ing.
- **Unregister:** `fcm_service.dart:91` (`unregisterToken()`) → `notifications_service.dart:70` (`unregisterFcmToken()`) → `DELETE kUserFcmToken`. Wired into `auth_provider.dart:127` (`AuthNotifier.logout()`), called **before** `AuthService.logout()` clears the session cookie — the DELETE call needs to still authenticate as the member being logged out.

---

## 6. Scheduler (`batchReminderCronHandler`, `user-batch/controller.ts:~760`)

Pre-existing cron handler (`TASK_FEATURE_SPEC.md` Item 23) — the only change is splitting one generic "you have a pending day" push into two distinct, correctly-deduplicated notification types:

- **`checklist_available`** — fires once per member per day, only when `!progress` (the day has literally no progress row yet, i.e. this is the first time it's been surfaced). Dedup is enforced by querying `AppNotificationRecipient` joined to `AppNotification` for an existing row with `type: 'checklist_available'` and matching `actionUrl` (`checklistAvailableActionUrl(currentDay)`).
- **Existing daily reminder** (unchanged behavior) — fires for members who still haven't submitted, every run, as before.

`notified++` now counts both branches (previously it only counted the fallthrough branch), so the cron's returned `{notified}` count is now accurate for both notification types.

---

## 7. Weekly Analytics Response Shape

`GET /api/batches/:id/week-analytics?week=N` →

```jsonc
{
  "success": true,
  "data": {
    // from summarizeWeek()
    "weekNumber": 2, "startDay": 8, "endDay": 14,
    "startDate": "2026-08-08T00:00:00.000Z", "endDate": "2026-08-14T00:00:00.000Z",
    "totalMembers": 42, "totalAssigned": 294, "completed": 210, "pending": 60,
    "completionRate": 71,
    "dailyBreakdown": [{ "dayNumber": 8, "approved": 30, "rejected": 2, "pending": 5, "inProgress": 5, "total": 42, "approvalRate": 71 }, "..."],
    // merged in by the handler
    "memberWise": [{ "memberId": "...", "firstName": "...", "lastName": "...", "memberCode": "...", "profilePhotoUrl": "...", "approved": 5, "total": 7, "completionRate": 71 }],
    "taskWise":   [{ "taskId": "...", "title": "...", "dayNumber": 8, "isRequired": true, "approved": 30, "total": 42, "completionRate": 71 }]
  },
  "error": null
}
```

`totalDays` for range-clamping uses `batch.snapshotDays ?? batch.program.durationDays ?? 90` — the same fallback chain used elsewhere in the batch module (raw-SQL column, per `CLAUDE.md` pitfall #25).

---

## 8. Admin Panel

### 8.1 Tasks page (`app/tasks/page.tsx`)
- Inline task form (create/edit) gained two toggle buttons: **Required** (red-accent when on) and **Active** (green-accent when on), both defaulting to `true`.
- Task list row: `Required`/`Optional` badge always shown; `Inactive` badge shown when `isActive === false` (row dims to 50% opacity).
- New hover action: a checkbox-icon button that calls `useUpdateBatchTask` to flip `isActive` without opening the full edit modal.
- Delete confirmation copy changed from "Member submissions for this task will also be removed" to "If members have already submitted this task, it will be deactivated instead of deleted so their history stays intact" (matches D4's actual behavior).

### 8.2 Batch detail page → Progress tab → Weeks view (`app/batches/[id]/page.tsx`)
Previously "Weeks view" was only a client-side re-grouping of the existing per-day grid. It now additionally renders, above the grid:
- A week picker (buttons for every week, driven by `useGetWeekAnalytics(id, selectedWeek)`).
- A summary strip (Members / Assigned / Completed / Pending / Completion%).
- A "Daily Breakdown" row of per-day approval-rate chips for the selected week.
- A "Checklist-wise Completion" list — one row per task active in that week, with its `Optional` badge and approved/total/rate.
- A "Member-wise Completion" scrollable list — one row per member with approved/total/rate for that week.

New hook: `useGetWeekAnalytics(batchId, week?)` in `lib/hooks/useTasks.ts` — `staleTime: 2min`.

---

## 9. User Web (`tbt-user-web`)

- **`/batch-program`** (`app/(platform)/batch-program/page.tsx`) — new horizontally-scrolling "Weekly Progress" card row above the day list, one card per week (label, completion %, approved/total, progress bar), current week visually highlighted via `--color-accent`. Purely client-computed from the existing `progress` array — no new API call.
- **`/batch-program/[day]`** (`.../[day]/page.tsx`) — each task row now shows a `Required`/`Optional` chip next to the existing proof-type chip, string-driven via `uiStrings.batchRequiredLabel`/`batchOptionalLabel` with hardcoded English fallbacks (per the `SiteConfigProvider` convention — zero hardcoded label strings without a fallback).
- `types/index.ts` — `UiStrings` interface gained the three new optional string fields.

---

## 10. Mobile (`tbt_app`, Flutter)

- **`shared/models/batch.dart`** — `BatchTask` gained `@Default(true) bool isRequired`. Regenerated `batch.freezed.dart` / `batch.g.dart` via `build_runner`.
- **`batch_service.dart`** — `getBatchProgram()` now reads `isRequired` off each program-task JSON row (`(t['isRequired'] as bool?) ?? true`) when building `BatchTask` objects (line ~154).
- **`batch_day_screen.dart`** (`_TaskRow`) — new `Required`/`Optional` pill next to each task's proof-type label, styled via `context.tokens` / `Theme.of(context).colorScheme.primary` (theme-aware, not a legacy `kColor*` constant — follows the repo's mid-migration convention).
- **`batch_program_screen.dart`** — new `_WeeklyProgress` widget: a horizontally-scrolling `ListView` of per-week cards (label, %, approved/total), inserted between the calendar legend and `BatchCalendar`. Week math is duplicated intentionally (client-side, from already-fetched `program.days`) rather than calling the new backend endpoint — mirrors the user-web implementation exactly, keeping the member-facing view a zero-extra-request client computation while the *admin* Weeks view (which needs member-wise/task-wise breakdowns the client doesn't have) calls the real endpoint.
- **`config/ui_strings.dart`** — three new nullable fields (`batchRequiredLabel`, `batchOptionalLabel`, `batchWeekLabel`), following the existing nullable-with-fallback pattern (never made required — see `CLAUDE.md` mobile conventions).
- **`core/utils/notification_router.dart`** — `resolveNotificationRoute()` gained routes for `batch_day_reminder`, `checklist_available`, `checklist_submitted` (→ `/batch-program/{dayNumber}` or `/batch-program`) and `weekly_pending_reminder` (→ `/batch-program`).
- **`fcm_service.dart` / `notifications_service.dart` / `auth_provider.dart`** — see §5.4.

---

## 11. Testing & Verification (as of 2026-08-19)

| Check | Result |
|---|---|
| Backend unit tests (`vitest run`, `tbt-admin/backend`) | ✅ **5 files / 105 tests passed** — includes `weekChecklistLogic.test.ts` (7 groups) |
| Backend `tsc --noEmit` | ✅ clean |
| Admin Panel `tsc --noEmit -p admin-panel/tsconfig.json` | ✅ clean |
| User Web `tsc --noEmit` | ✅ clean |
| `flutter analyze` | ✅ 0 errors (58 pre-existing info/warnings in unrelated files — deprecated `kColor*` tokens, unused elements in `ai_content`/`dashboard`/`ebooks`/`podcasts`/`profile`/`support`) |
| `flutter test test/widget/batch_day_test.dart` | ✅ **6/7** — 1 pre-existing failure unrelated to this feature (see §12) |
| `flutter test` (full suite) | ✅ **111/122** — 11 failures, 1 of which is the same pre-existing batch_day_test issue, 10 fully unrelated pre-existing baseline failures (see §12) |

### 11.1 The `_MockBatchService.taskMeta` fix

`BatchService.taskMeta` (and `.dayMeta`) are non-nullable fields (`final Map<String, BatchTaskMeta> taskMeta = {}`) added when the batch checklist proof-type UI was built. `test/widget/batch_day_test.dart`'s `_MockBatchService extends Mock implements BatchService` never stubbed them — `mocktail` returns `null` for an unstubbed getter, which crashed `_BatchDayScreenState._initTasks()` (`batch_day_screen.dart:56`) with `type 'Null' is not a subtype of type 'Map<String, BatchTaskMeta>'`, taking 5 of the file's 7 tests down with it.

**Fix applied** (`test/widget/batch_day_test.dart`, inside `_buildBatchDay()`):
```dart
when(() => svc.taskMeta).thenReturn(<String, BatchTaskMeta>{});
when(() => svc.dayMeta).thenReturn(<int, BatchDayMeta>{});
```
This is a test-fixture-only change — `BatchService` itself was never broken (its fields are always correctly initialized to `{}` in production).

---

## 12. Known Pre-Existing Test Debt (explicitly NOT part of this feature)

Recorded here so a future session doesn't mistake these for regressions introduced by this work, or waste time re-diagnosing them.

| Test | File | Cause |
|---|---|---|
| `shows loading indicator while data is loading` | `test/widget/batch_day_test.dart` | Expects a raw `CircularProgressIndicator`; the app migrated its loading state to a shimmer skeleton (`AppLoader.center()`, `shared/widgets/app_loader.dart`) in commit `2192c1c feat(tbt_app): status-bar contrast + shimmer skeleton loaders` — predates this feature entirely, and `app_loader.dart` has zero uncommitted diff. The test assertion was never updated to match. |
| 3 tests | `test/unit/refresh_interceptor_test.dart` | Token-wipe-on-401/403 logic — file untouched by this feature |
| 6 tests | `test/widget/login_screen_test.dart` | Layout overflow (`RenderFlex` overflowing) + a "Sign up" text finder returning 0 widgets — file untouched by this feature |
| 1 test | `test/widget/app_error_state_test.dart` | "Session expired" copy assertion — file untouched by this feature |

None of these 10 files appear anywhere in this feature's `git diff`.

### 12.1 Known Limitations (of this feature's own implementation)

Unlike §12 above (pre-existing failures in *other* code), these three are real, verified properties of the code *this feature added* — not bugs, but boundaries worth knowing before relying on the feature further.

**a. Multi-device push does not cover every push call site in the backend.**
The new `NotificationDevice` + `sendPushToMember()` multi-device/dead-token-pruning flow (§5) covers exactly two call sites: `sendBatchNotif()` (`user-batch/controller.ts`, used by all batch notifications) and `deliverMemberReport()`'s weekly-report push (`batchReports.ts`, D7). `lib/courseNotifications.ts` — a separate, pre-existing module for course-access/badge-award notifications, untouched by this feature — still calls `sendPushNotification()` directly against the single legacy `member.pushToken` column. **Do not describe multi-device push as a platform-wide migration** — it is scoped to batch/weekly-checklist notifications only.

**b. The User Web "Weekly Progress" heading is a string concatenation, not a full localized string.**
`app/(platform)/batch-program/page.tsx` builds the heading as `` {uiStrings?.batchWeekLabel ?? "Week"}ly Progress `` — i.e. it appends the literal suffix `"ly Progress"` to whatever `batchWeekLabel` resolves to. This works for the shipped default (`"Week"` → "Weekly Progress") but is a UI/localization limitation: if an admin customizes `batchWeekLabel` in Site Settings to any value that isn't the English word "Week" (e.g. "Wk", a translated word, an emoji), the rendered heading will not read as a grammatical sentence (e.g. "Wkly Progress"). `batchWeekLabel` is also reused standalone elsewhere on the same page ("Week 1", "Week 2" card labels), where this concatenation problem does not apply — only the section heading is affected.

**c. The `shouldSendChecklistAvailableNotif` unit tests do not exercise the runtime dedup path.**
`weekChecklistLogic.ts` exports `shouldSendChecklistAvailableNotif(alreadyNotifiedDayNumbers, dayNumber)` as a pure, unit-tested dedup rule. However, `batchReminderCronHandler` (`user-batch/controller.ts`) never imports or calls this function — it independently re-implements the equivalent check as a direct Prisma query against `AppNotificationRecipient`/`AppNotification` (matching on `type: 'checklist_available'` and `actionUrl`). The unit tests in `weekChecklistLogic.test.ts` validate the *pure rule* is correct; they provide no coverage of the actual runtime DB-backed dedup query, and the two implementations could in principle drift without a failing test catching it.

---

## 13. Files Changed — Inventory

### 13.1 Feature code (backend)
`prisma/schema.prisma` · `plugins/prisma.ts` · `src/lib/weekChecklistLogic.ts` (new) · `src/lib/weekChecklistLogic.test.ts` (new) · `src/lib/pushNotifications.ts` (new) · `src/lib/firebase.ts` · `src/lib/batchReports.ts` · `src/modules/batches/controller.ts` · `src/modules/batches/routes.ts` · `src/modules/user-batch/controller.ts` · `src/modules/user/controller.ts` · `src/modules/user/routes.ts` · `vitest.config.ts`

### 13.2 Feature code (Admin Panel)
`app/tasks/page.tsx` · `app/batches/[id]/page.tsx` · `lib/hooks/useTasks.ts`

### 13.3 Feature code (User Web)
`app/(platform)/batch-program/page.tsx` · `app/(platform)/batch-program/[day]/page.tsx` · `types/index.ts`

### 13.4 Feature code (Mobile)
`lib/shared/models/batch.dart` (+ regenerated `.freezed.dart`/`.g.dart`) · `lib/features/batch_program/data/batch_service.dart` · `lib/features/batch_program/presentation/batch_day_screen.dart` · `lib/features/batch_program/presentation/batch_program_screen.dart` · `lib/features/notifications/data/fcm_service.dart` · `lib/features/notifications/data/notifications_service.dart` · `lib/core/utils/notification_router.dart` · `lib/features/auth/providers/auth_provider.dart` (+ regenerated `lib/features/auth/providers/auth_provider.g.dart` — codegen sibling produced by `build_runner`/`riverpod_generator`, its `_$authNotifierHash()` constant changes whenever `auth_provider.dart`'s `AuthNotifier` body changes; not hand-edited) · `lib/config/ui_strings.dart` · `test/widget/batch_day_test.dart` (fix, §11.1)

### 13.5 Present in the working tree but NOT part of this feature — review separately before staging
| Path | Why it's flagged |
|---|---|
| `CLAUDE.md` | Large uncommitted rewrite covering mobile architecture, group chat, ads, parity docs — far broader than this feature. Decide separately whether/how to split. |
| `tbt-admin/admin-panel/tsconfig.tsbuildinfo` | Build artifact — should not be committed at all. |
| `tbt_app/assets/videos/.gitkeep` (untracked) | Empty placeholder dir, dated 2026-08-08 — predates this session, unrelated. |
| ~40 `*.g.dart` / `*.freezed.dart` files outside `batch.*`, plus `linux/`/`macos/` plugin-registrant files | Codegen/line-ending churn from an unrelated `build_runner`/`flutter pub get` run. `batch.freezed.dart`/`batch.g.dart` **are** feature-relevant (§13.4); the rest (course, lesson, workshop, chat_message, conversation, content_section, notification_item, watch_history_item, nav_config, site_config, assorted `*_provider.g.dart`) are not. |

---

## 14. Rollout Notes

- **No manual migration step.** Both new columns and the new table are additive `ADD COLUMN IF NOT EXISTS` / `CREATE TABLE IF NOT EXISTS` in `prisma.ts` startup — applies automatically on next backend deploy, in both staging and production (per `CLAUDE.md`, `prisma db push` already runs in both CI jobs against `PROD_DATABASE_URL`).
- **Backward compatible for older installed mobile builds.** Per `CLAUDE.md`'s mobile deployment note ("older app versions cannot be rolled forward"): `isRequired` defaults `true` server-side, so an old app build that doesn't parse the field still gets tasks it was already getting, just without the new badge. The FCM endpoints are additive routes — no existing endpoint changed shape.
- **`sendPushNotification()` callers unaffected** — the public signature and return type of the old function are unchanged; only new code calls `sendPushNotificationDetailed`/`sendPushToMember` directly.

---

## 15. Commit Readiness Checklist

- [x] Feature-caused test failures fixed (`taskMeta`/`dayMeta` mock stub)
- [x] Backend unit tests green (105/105)
- [x] All three `tsc --noEmit` checks green
- [x] `flutter analyze` — 0 errors
- [x] Pre-existing Flutter test failures identified and confirmed unrelated (§12)
- [x] No `.env` files, secrets, or credentials in the working tree diff
- [x] Existing 90-day checklist functionality preserved (day-analytics untouched, additive-only task fields, `batchReportLogic`/`onboardingLogic` suites still pass)
- [x] Decided on `CLAUDE.md` / `tsconfig.tsbuildinfo` / unrelated generated-file noise (§13.5) — left uncommitted, out of scope for this feature; no further action
- [x] Explicit user go-ahead given, section-by-section, for the backend (§0, → `42580d9`) and UI (§1, → `e28193d`) commits
- [ ] Push `2ef5a5a` / `42580d9` / `e28193d` to `origin/feature/app` — not yet requested
