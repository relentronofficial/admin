# SUPPORT_CALLS_ONE_TO_ONE_SPECKIT

**Status:** Phase 1 complete (codebase inspection) · Phase 2 in progress (speckit) · Implementation follows
**Created:** 2026-10-16  
**Branch:** `feat/support-calls-one-to-one`

---

## Phase 1 — Codebase Inspection Summary

### What already exists (fully implemented in PR #85 / #91)

The existing system is more complete than the task description implies. Before implementing anything, every component was read and traced end-to-end.

#### Database schema (`backend/src/plugins/prisma.ts`, lines 2155–2198)

```sql
support_call_sessions (
  id, category VARCHAR(30), title, description, host_admin_id UUID FK admins,
  host_name, starts_at TIMESTAMPTZ, duration_minutes INT, capacity INT,
  meeting_url TEXT (private), status VARCHAR(20) DEFAULT 'scheduled', created_by, created_at, updated_at
)
support_call_bookings (
  id, session_id FK sessions, member_id FK members,
  status VARCHAR(20) DEFAULT 'booked', booked_at, cancelled_at, usage_id FK support_usage, updated_at
)
Unique index: uq_support_call_bookings_active (session_id, member_id) WHERE status <> 'cancelled'
```

`category = 'one_to_one'` IS one of the six categories. `capacity = 1` is enforced by the backend when category is `one_to_one`. Group calls have `capacity > 1`. The schema already handles both call types through the same table.

#### Backend routes — all implemented

**Admin (Clerk-protected, `support-entitlements` module):**
| Route | Handler |
|---|---|
| `GET /api/support-entitlements/sessions` | list (filter: category, scope: upcoming/past/all) |
| `POST /api/support-entitlements/sessions` | create (enforces capacity=1 for one_to_one) |
| `PUT /api/support-entitlements/sessions/:id` | update |
| `POST /api/support-entitlements/sessions/:id/cancel` | cancel + notify booked members |
| `GET /api/support-entitlements/sessions/:id/bookings` | view bookings (member name, phone) |
| `PUT /api/support-entitlements/bookings/:id/status` | mark attended / no_show |

**Member (JWT cookie, `user` module at `/api/user/support-calls`):**
| Route | Handler |
|---|---|
| `GET /support-calls?category=` | sessions + quota (incl. reserved) + history |
| `POST /support-calls/sessions/:id/book` | book — concurrency-safe (tx + advisory lock + unique index) |
| `POST /support-calls/bookings/:id/cancel` | cancel (2-hour cutoff enforced) |
| `GET /support-calls/bookings/:id/join` | meeting URL (10-min window enforced) |

#### Pure business logic (`backend/src/lib/supportCallLogic.ts`) — 25 unit tests

- `canBook` — validates session status, start time, duplicate, member status, quota, capacity
- `canCancelBooking` — 2-hour cutoff enforced
- `joinState` — 10-min before start to session end
- `canMarkAttendance` — after start, only once
- `canManageSupportSession` — admin/super_admin see all; mentor sees own sessions only

#### Admin UI (`admin-panel/app/support-calls/page.tsx`) — fully built

- Session list (scope tabs: upcoming/past/all, category dropdown)
- Create/edit modal with all fields (category, title, description, host account, host name shown to members, date/time in IST, duration, seats, meeting link)
- Capacity field is auto-locked to 1 when `category = one_to_one`
- Bookings drawer: member name, phone, mark attended/no-show
- Cancel session (with confirmation)

#### Member UI (`tbt-user-web`) — fully built

- `SupportCallPanel.tsx` — 3-step flow: choose date (IST calendar) → choose time slot → confirm booking
- Real-time clock sync via `getServerNow()` (30 s refresh)
- `slotState`: available / mine / full / started / blocked
- My bookings: cancel / join / live badge
- Call history with status labels
- `lib/supportCallSlots.ts` — all calendar + slot utilities (IST timezone throughout)

#### Quota system

`one_to_one` category maps to `callCredits` bucket in `computeSupportQuota`, which reads `call_credit_count` from `plan_entitlements`. `one_to_one_enabled` is a separate boolean stored in `plan_entitlements` but is not used by the booking gate — only `call_credit_count > 0` matters.

---

### Root cause: why members see no slots

After full inspection, there is **no code bug in the booking flow**. The flow is correct end-to-end. Members cannot book because:

1. **No sessions have been published** for `one_to_one` (or any other) category. The admin creates a session → it becomes immediately bookable. If no admin has created a session for a category, the member calendar correctly shows "No available slots right now."
2. **Quota may be 0** — if `call_credit_count = 0` in `plan_entitlements` for a member's plan, they see "Not included in your plan" even if sessions exist.

**Fix**: Admin must publish at least one `one_to_one` session and the member's plan must have `call_credit_count ≥ 1`.

---

### Genuine code gaps identified

| # | Gap | Severity |
|---|---|---|
| G1 | **No admin/mentor notification when a member books a session** | HIGH — the assigned mentor doesn't know someone booked their 1:1 slot |
| G2 | **No "call type" filter in admin UI** — can filter by individual category but not by "all 1-to-1" vs "all group" at once | MEDIUM — UX improvement |
| G3 | **No session draft/unpublish state** — sessions are published immediately; only cancel removes them from member view | LOW — cancel works adequately |
| G4 | **`notificationRouter.ts` has no route for `support_call_booked`** — admin bell click has no target page | HIGH — blocked after G1 is added |

Gaps G1 and G4 are implemented in this speckit. G2 (call-type tab) is also implemented. G3 is out of scope (cancel covers the need).

---

## User Stories and Acceptance Criteria

### US1 — Admin creates and publishes a one-to-one session

**Given** an admin or mentor is logged in and opens `/support-calls`  
**When** they click "New Session" and select category "Mentor 1-On-1"  
**Then** the Seats field auto-locks to 1 (enforced by both UI and backend)  
**And** on save the session appears in the Upcoming list immediately  
**And** it appears in the member calendar for the `one_to_one` category on the correct date

**Acceptance:**
- `POST /api/support-entitlements/sessions` with `category=one_to_one, capacity=2` → 400 "Mentor 1-On-1 sessions have exactly 1 seat"
- Session card in admin shows "♟ Mentor 1-On-1" + "1:1" badge
- Member `GET /api/user/support-calls?category=one_to_one` returns the session under `sessions[]`

### US2 — Member sees available dates and time slots

**Given** a member with `call_credit_count ≥ 1` opens the Mentor 1-On-1 panel  
**When** sessions exist for the `one_to_one` category  
**Then** the calendar highlights those dates  
**And** selecting a date shows the available time slots for that day  
**And** the quota chip shows `used / allocated / remaining`

**Acceptance:**
- Calendar days with available slots show a green dot; past days are greyed/struck
- Empty state copy: "No available slots right now. Please check again later."
- If `call_credit_count = 0`: tile shows 0/0 and panel shows "Not included in your plan"

### US3 — Member books an available slot

**Given** the member selects a date and a time slot  
**When** they click "Confirm Booking"  
**Then** the backend validates session status, start time, member status, quota, capacity, duplicate  
**And** inserts a `support_call_bookings` row atomically  
**And** the panel transitions to show the booking under "My bookings"  
**And** the admin/mentor receives an in-app notification (G1 fix)

**Acceptance:**
- Two concurrent book requests → only one succeeds (409 for the other)
- Booking with no remaining quota → 403 `quota_exhausted`
- Full session → 409 `session_full`
- Already booked → 409 `already_booked`

### US4 — Admin/mentor receives booking notification

**Given** a member successfully books a session  
**When** the booking is confirmed  
**Then** an `admin_notifications` row is inserted with `type = 'support_call_booked'`  
**And** a `admin:support_call_booked` socket event fires to the `'admin'` room  
**And** if the session has `host_admin_id`, a push notification is sent to that mentor  
**And** clicking the admin bell notification routes to `/support-calls`

**Acceptance:**
- `admin_notifications` row exists after a booking is made
- Socket event payload: `{ sessionId, sessionTitle, memberName, category, startsAt }`
- `resolveNotificationRoute` maps `support_call_booked` → `/support-calls`
- Notification is idempotent — booking retry (unique index 409) never duplicates the notification

### US5 — Member views, cancels, and joins bookings

**Given** the member has an upcoming booking  
**Then** it appears in "My bookings" with Cancel and (within window) Join buttons  
**When** they cancel more than 2 hours before start → booking status → `cancelled`; quota restored in next fetch  
**When** they cancel within 2 hours → 403 `cancel_cutoff`  
**When** they join within 10 min before start to session end → meeting URL returned  
**When** they join outside that window → 403 with human-readable message

**Acceptance:** (already covered by existing 25 unit tests + UI tests)

### US6 — Admin and mentor manage sessions and bookings

**Given** a mentor is logged in  
**Then** they see only sessions where `host_admin_id = their admin id`  
**And** admin/super_admin see all sessions  
**When** an admin cancels a session → all `booked` bookings → `cancelled`; members notified  
**When** admin marks attended/no_show → inserts `support_usage` row; calls up only on attendance, not on booking

**Acceptance:** (existing backend enforcement; tested in unit tests)

### US7 — Existing group calls continue without regression

**Given** all 6 categories are unchanged  
**Then** `group_call` sessions with `capacity > 1` continue to work  
**And** all 25 existing unit tests still pass  
**And** existing admin UI category filter still works

---

## Technical Implementation Plan

### T1 — Backend: admin notification on booking (G1 + G4)

**File:** `tbt-admin/backend/src/modules/user/controller.ts`  
**Location:** `bookSupportCallHandler`, after the successful INSERT into `support_call_bookings`

Add after booking insertion (non-blocking `void` calls so they never fail the booking response):
1. Load member name (`first_name + last_name`) and session's `host_admin_id` + title + category + `starts_at`
2. Call `createAdminNotification(request.server.prisma, { title, body, type: 'support_call_booked', metadata: { sessionId, category, memberName, startsAt } })`
3. Emit `admin:support_call_booked` to `'admin'` socket room
4. If `host_admin_id` is set, send push notification to that admin (use existing `sendPushToMember` pattern adapted for admin push, or skip if not available — non-fatal)

Import: `createAdminNotification` from `../../lib/adminNotifications.js`

**File:** `tbt-admin/admin-panel/lib/utils/notificationRouter.ts`  
Add case: `'support_call_booked'` → `'/support-calls'`

**File:** `CLAUDE.md` socket events table — add `admin:support_call_booked` to `'admin'` room row.

### T2 — Admin UI: call-type filter tab (G2)

**File:** `tbt-admin/admin-panel/app/support-calls/page.tsx`

Add a "Call type" toggle alongside the scope tabs:
- "All" (default)
- "1:1 only" — passes `callType=one_to_one` param; UI filters `sessions.filter(s => s.capacity === 1)`
- "Group only" — filters `sessions.filter(s => s.capacity > 1)`

This is client-side filtering of the fetched list (no backend change needed) since all sessions are already returned by category/scope. Add a `callType` state (`'all' | 'one_to_one' | 'group'`) and filter `sessions` before render.

Also add a "1:1" badge on session cards where `session.capacity === 1` (to make it immediately visible without reading the category label).

### T3 — Tests

**File:** `tbt-admin/backend/src/lib/supportCallLogic.test.ts`  
Add 2 new tests:
- `canBook` with `one_to_one` session (capacity=1): verify full-session rejection when `activeBookingCount=1`
- `canManageSupportSession`: verify mentor can't manage a session with `hostAdminId = null`

These tests verify the 1:1-specific enforcement rules. Add the test file to `vitest.config.ts` (it's already there — confirmed line 16 of vitest.config.ts).

---

## API Contract (existing, documented for clarity)

### GET /api/user/support-calls?category=one_to_one
```typescript
// Response
{
  category: "one_to_one",
  quota: { allocated: number, used: number, reserved: number, remaining: number },
  sessions: [{
    id: string,
    title: string,
    description: string | null,
    hostName: string | null,
    startsAt: string,        // ISO 8601 UTC
    durationMinutes: number,
    capacity: 1,             // always 1 for one_to_one
    seatsLeft: 0 | 1,
    myBooking: {
      id: string, status: "booked"|"attended"|"no_show",
      canCancel: boolean, canJoin: boolean, joinMessage: string | null
    } | null
  }],
  history: [{ bookingId, title, startsAt, durationMinutes, status }]
}
```

### POST /api/user/support-calls/sessions/:id/book
```typescript
// 201
{ id: string, sessionId: string, status: "booked", bookedAt: string }
// 403: not_included | quota_exhausted | member_inactive
// 409: already_booked | session_full | session_unavailable | session_started
```

### admin:support_call_booked (new socket event — T1)
```typescript
// Payload (to 'admin' room)
{
  type: "support_call_booked",
  sessionId: string,
  sessionTitle: string,
  category: SupportCallCategory,
  startsAt: string,
  memberName: string,
  memberId: string,
  hostAdminId: string | null,
}
```

---

## Data Model Changes

No new tables or columns are required. The existing `support_call_sessions.capacity` field is the 1:1 discriminator (capacity=1 ↔ 1-to-1). The `admin_notifications` table already exists and is used by other features.

---

## Authorization Rules (unchanged)

| Actor | Permitted |
|---|---|
| `super_admin`, `admin` | Manage all sessions and bookings |
| `mentor` | Manage only sessions where `host_admin_id = their admin id` |
| Member | Book/cancel/join own bookings only; other members' booking IDs → 404 |
| Unauth | Nothing — all routes require auth |

Meeting URL is never included in list responses, only returned by `GET /bookings/:id/join` inside the join window.

---

## Booking and Cancellation Rules (unchanged)

| Rule | Value |
|---|---|
| Cancel cutoff | 2 hours before `starts_at` |
| Join window | 10 min before start → session end |
| No-show | Consumes the call (same as attended) |
| Duplicate booking | Blocked by advisory lock + unique index |
| Concurrent booking (same exclusive slot) | Advisory lock on `memberId:category` + `FOR UPDATE` on session row |

---

## Testing Strategy

### Unit tests (existing, still pass after T1/T3)
`src/lib/supportCallLogic.test.ts` — 25 tests covering all booking/cancel/join/attendance/role rules.

### New unit tests (T3)
2 additional cases added to `supportCallLogic.test.ts` for 1:1-specific edge cases.

### Backend integration (manual — dev/staging)
1. Admin creates an `one_to_one` session with `capacity=1` → created
2. Admin tries `capacity=2` for `one_to_one` → 400
3. Member with quota books → 201; admin bell shows notification
4. Second member books same 1:1 slot → 409 `session_full`
5. Member cancels > 2h before → 200; same slot reappears in calendar
6. Member cancels < 2h before → 403 `cancel_cutoff`
7. Member joins outside window → 403; inside window → `meetingUrl` returned
8. Group call (`capacity=5`) still accepts up to 5 bookings
9. All 25 unit tests: `npm test` from `tbt-admin/`

### Frontend (browser — Edge/Chrome, desktop + mobile 375px)
- All 6 tiles open the correct panel
- Mentor 1-On-1 tile: calendar shows only `one_to_one` dates; group call tile shows only `group_call` dates
- Select date → slots appear; confirm → success banner; booking in "My bookings"
- Admin support-calls page: "1:1 only" filter shows capacity=1 sessions; cards show "1:1" badge
- Admin bell: booking notification appears; clicking → `/support-calls`

---

## Deployment Requirements

- `tbt-admin/backend` (Cloud Run staging `tbt-backend-staging`) — T1 changes
- `tbt-admin/admin-panel` (Vercel, auto-deploy from `main`) — T1/T2 changes
- `tbt-user-web` (Cloud Run staging `tbt-user-web-staging`) — no changes in this speckit (UI already correct)

---

## Known Limitations

- No session draft/unpublish state (G3 deferred) — cancel is the workaround to remove a session from member view
- Admin push notification to mentor on booking requires Firebase tokens on admin accounts (not currently collected); the admin bell + socket is the primary notification path
- `call_credit_count` must be configured per plan in `/settings/entitlements` before members see a bookable quota; new deployments start at 0
- Pre-existing: 8 `MentorshipDashboard.test.tsx` tests fail on `main` with "No QueryClient set" — not related to this feature

---

## Implementation Task Status

| Task | Description | Status |
|---|---|---|
| T1-backend | `bookSupportCallHandler` emits admin notification + socket event | ⬜ Pending |
| T1-notifRouter | `resolveNotificationRoute` maps `support_call_booked` → `/support-calls` | ⬜ Pending |
| T1-CLAUDE | CLAUDE.md socket events table updated | ⬜ Pending |
| T2-admin | Call-type filter + 1:1 badge on admin support-calls page | ⬜ Pending |
| T3-tests | 2 new unit tests for 1:1-specific rules | ⬜ Pending |
| V1 | `npm test` passes; backend + admin typecheck pass | ⬜ Pending |
| V2 | Admin creates 1:1 session → member can book → admin bell shows notification | ⬜ Pending |
