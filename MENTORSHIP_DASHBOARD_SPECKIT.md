# MENTORSHIP_DASHBOARD_SPECKIT.md
## Mentorship Dashboard — Full-Stack BMAD

**Status:** Ready to implement  
**Route:** `/batch-program/mentorship`  
**Target:** `tbt-user-web` (page + hooks) + `tbt-admin/backend` (endpoints + DB)

---

## 1. What We're Building

A dedicated "Mentorship Dashboard" page sitting under the batch-program umbrella. When a member opens it they immediately see a real-time snapshot of everything happening inside their mentorship program: time invested, support consumed, their journey progress, and their own business revenue stats (self-reported weekly). All numbers count up on entry; progress bars animate from 0; cards stagger in. The existing `/batch-program` day-tracker stays at its current URL, unchanged. This is an additive page only.

---

## 2. UI Sections (from reference image)

### 2.1 Header Bar
```
┌─ [Program Name e.g. "TBT - eComm Mastery"] ──── [✓ Weekly Report Submitted] [🔥 37 Days] [❤️❤️❤️♡♡] ─┐
```
- Program name from `batch.program.name` (fallback: batch name)
- Weekly Report Submitted badge: green pill, shown only when `weeklyReportSubmitted === true`
- Streak: fire emoji + `streakDays` Days (amber pill)
- Lifelines: render 5 heart icons, filled for `lifelinesTotal - lifelinesUsed`, hollow for used

### 2.2 Top KPI Strip (4 cards)

| Card | Metric | Source |
|------|--------|--------|
| Daily Time Spent | `3.15 hrs` vs goal | `SUM(watched_seconds)/3600` from `member_episode_progress` today |
| Support Delivered | `12 Calls` / `100 Total` | sum of all support types used vs sum of all allocated |
| Revenue Generated | `₹4,57,856` | latest week's `revenue_generated` from `member_revenue_reports` |
| Organic Growth (Weekly) | `+12.5%` | computed from `organic_leads` vs `organic_leads_prev` in revenue report |

### 2.3 Customer Journey (6 mini-tiles, Live Update badge)

| Tile | Metric | Source |
|------|--------|--------|
| Daily Usage | `2/12` sessions | `(attendance count today)/(batch goal sessions)` |
| Modules | `32/75` | enrolled course episodes completed / total |
| Tasks | `32/75` (with % bar) | approved task submissions / total batch tasks |
| Support Days | `48d left` | `totalDays - daysElapsed` |
| Tier Access | `126/385d` | days since member joined / batch totalDays |
| Leaderboard | `#45th` | rank from `tbt_activity_log` aggregate |

### 2.4 Expert Support Calls (6 type tiles + summary badges)

Header badges: `12 MC Completed` (total calls used) · `2/5 Quota Remaining` (remaining across all types)

| Tile | Label | DB Type | Entitlement Column |
|------|-------|---------|-------------------|
| Sales Calls | used/total | `sales_support` | `sales_call_count` (NEW) |
| Tech Calls | used/total | `tech_support` | `tech_support_days` |
| Content Calls | used/total | `content_support` | `content_call_count` (NEW) |
| Marketing Calls | used/total | `ad_support` | `ad_support_days` |
| Mentor 1-On-1 | used/total | `one_to_one` | `call_credit_count` |
| Live Group Q&A | used/total | `group_call` | `group_call_count` |

### 2.5 Revenue Stats (4 cards — member self-reported)

Member enters their own weekly business numbers via an inline edit modal. Each card shows current week + % change vs prior week + a contextual badge.

| Card | Primary | Sub-lines | Badge |
|------|---------|-----------|-------|
| Revenue Generated | `₹N` + `+X%` | Avg Order Value · Last N orders | — |
| Number of Orders | `N Orders` + `+X%` | BTO/Revenue ratio | Low Risk / High Risk |
| Ad Budget Spent | `₹N` | ROAS · Customer Acq. Cost | Highly Profitable / Watch Out |
| Organic Inbound Leads | `N Leads` + `+X%` | Free Customers label | — |

A single "Update This Week's Stats" button opens an inline form with all 9 fields.

---

## 3. Data Sources & API Design

### 3.1 Existing APIs (reuse — no changes)

| Hook | Data used |
|------|-----------|
| `useMyBatchProgram()` | `batch.program.name`, `batch.name`, `totalDays`, `attendance[]`, `breaks[]`, `lifelinesTotal`, `lifelinesUsed` |
| `useUserSupportQuota()` | all support type quotas (already has allocated/used/remaining) |
| `useMyStreakPoints()` | `currentStreak` for streak badge |
| `useDashboardStats()` | not used here — avoid double-fetch |

### 3.2 New Endpoint: `GET /api/user/mentorship/stats`

**Handler:** `getMentorshipStatsHandler` in `user/controller.ts`  
**Registered:** `GET /mentorship/stats` in `user/routes.ts`  
**Auth:** `fastify.authenticateUser` (inherited from module hook)  
**Cache:** `cacheGetOrCompute(redis, \`mentorship:stats:${memberId}\`, 60, fn)` (singleflight, 60s TTL)

**Parallel queries (Promise.all):**
```
Q1: SUM(watched_seconds) from member_episode_progress
    WHERE member_id = $1 AND DATE(updated_at AT TIME ZONE 'Asia/Kolkata') = CURRENT_DATE AT TIME ZONE 'Asia/Kolkata'

Q2: SELECT COUNT(*)::int as enrolled_episodes
    FROM course_episodes ce
    JOIN course_enrollments enrollment ON enrollment.course_id = ce.course_id
    WHERE enrollment.member_id = $1 AND enrollment.completed_at IS NULL

Q3: SELECT COUNT(*)::int as completed_episodes
    FROM member_episode_progress
    WHERE member_id = $1 AND is_completed = true

Q4: Approved task submissions count vs total batch tasks (from task_submissions + tasks)

Q5: WITH ranked AS (
      SELECT member_id, RANK() OVER (ORDER BY SUM(points) DESC) AS rk
      FROM tbt_activity_log GROUP BY member_id
    ) SELECT rk FROM ranked WHERE member_id = $1

Q6: SELECT current_streak FROM course_streaks WHERE member_id = $1

Q7: Check course_weekly_feedback for current week (weekNumber = ISO week of today)
    → weeklyReportSubmitted boolean

Q8: batch start date (from batch.started_at) → compute daysElapsed
```

**Response shape:**
```typescript
{
  dailyTimeSpentHrs: number;          // Q1 / 3600
  dailyTimeGoalHrs: number;           // 2.0 default (configurable via site_config later)
  weeklyReportSubmitted: boolean;     // Q7
  streakDays: number;                 // Q6
  totalEpisodes: number;              // Q2
  completedEpisodes: number;          // Q3
  tasksCompleted: number;             // Q4 approved
  tasksTotal: number;                 // Q4 total
  leaderboardRank: number | null;     // Q5
  daysElapsed: number;                // from batch start
}
```

Notes:
- `dailyTimeGoalHrs` hardcoded to 2.0 initially; can be a `site_config` key later
- `leaderboardRank` is expensive — wrapped in try/catch, returns `null` on timeout
- All counts default to 0 if no batch is assigned

### 3.3 New Endpoint: `GET /api/user/mentorship/revenue`

Returns the member's revenue report for the **current ISO week** (week number + year). If no row exists yet, returns `null` (frontend shows "Not set yet" + "Add Stats" prompt).

**Response:**
```typescript
{
  weekNumber: number;
  year: number;
  revenueGenerated: number | null;
  revenuePrev: number | null;
  numberOfOrders: number | null;
  ordersPrev: number | null;
  adBudgetSpent: number | null;
  roas: number | null;
  customerAcqCost: number | null;
  organicLeads: number | null;
  leadsPrev: number | null;
  avgOrderValue: number | null;
  updatedAt: string | null;
}
```

Computed client-side (to avoid backend complexity):
- Revenue growth %: `(revenueGenerated - revenuePrev) / revenuePrev * 100`
- Orders growth %: `(numberOfOrders - ordersPrev) / ordersPrev * 100`
- Leads growth %: `(organicLeads - leadsPrev) / leadsPrev * 100`
- BTO/Revenue ratio: `adBudgetSpent / revenueGenerated * 100` (if both non-null)
- Organic growth label: same as leads growth %

### 3.4 New Endpoint: `PUT /api/user/mentorship/revenue`

Upserts the revenue row for the current ISO week. Member can update freely throughout the week.

**Body (all optional, null = clear):**
```typescript
{
  revenueGenerated?: number | null;
  revenuePrev?: number | null;
  numberOfOrders?: number | null;
  ordersPrev?: number | null;
  adBudgetSpent?: number | null;
  roas?: number | null;
  customerAcqCost?: number | null;
  organicLeads?: number | null;
  leadsPrev?: number | null;
  avgOrderValue?: number | null;
}
```

Uses `INSERT ... ON CONFLICT (member_id, week_number, year) DO UPDATE SET ...` pattern.  
Invalidates `mentorship:stats:${memberId}` Redis key after write (not needed for revenue but clean habit).

---

## 4. Database Changes

### 4.1 `member_revenue_reports` table (NEW — raw SQL, no Prisma model)

Location: `tbt-admin/backend/src/plugins/prisma.ts` startup block

```sql
-- MP-01 (one $executeRawUnsafe per statement):
CREATE TABLE IF NOT EXISTS member_revenue_reports (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id           UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  week_number         INT NOT NULL,
  year                INT NOT NULL,
  revenue_generated   DECIMAL(15,2),
  revenue_prev        DECIMAL(15,2),
  number_of_orders    INT,
  orders_prev         INT,
  ad_budget_spent     DECIMAL(15,2),
  roas                DECIMAL(8,2),
  customer_acq_cost   DECIMAL(10,2),
  organic_leads       INT,
  leads_prev          INT,
  avg_order_value     DECIMAL(10,2),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(member_id, week_number, year)
);

CREATE INDEX IF NOT EXISTS idx_revenue_reports_member
  ON member_revenue_reports(member_id, year DESC, week_number DESC);
```

### 4.2 Extend `plan_entitlements` — 2 new columns (MP-02)

```sql
ALTER TABLE plan_entitlements ADD COLUMN IF NOT EXISTS sales_call_count  INT NOT NULL DEFAULT 0;
ALTER TABLE plan_entitlements ADD COLUMN IF NOT EXISTS content_call_count INT NOT NULL DEFAULT 0;
```

Default seed values (update existing rows via `ON CONFLICT (plan) DO UPDATE`):
```
starter:    sales=3, content=3
premium:    sales=7, content=7
vip:        sales=15, content=15
```

These values match the spirit of the existing ad_support / tech_support defaults.

---

## 5. Backend Implementation Steps

### MP-03: Handler `getMentorshipStatsHandler`

File: `tbt-admin/backend/src/modules/user/controller.ts`

Pattern: wrap all 8 queries in `Promise.all`, compute `daysElapsed` from `batch.startedAt`, return normalised shape. Use `cacheGetOrCompute` from `lib/cache.ts`. Handle missing batch gracefully (member not in a batch → all zeros + `leaderboardRank: null`).

```typescript
export async function getMentorshipStatsHandler(request, reply) {
  const memberId = request.memberId!;
  const redis = request.server.redis ?? null;

  const result = await cacheGetOrCompute(
    redis,
    `mentorship:stats:${memberId}`,
    60,
    async () => {
      const prisma = request.server.prisma;

      // Q1 — daily watched time (IST)
      const [timeRow] = await prisma.$queryRawUnsafe(`...`) as any[];

      // Q2/Q3 — episode progress
      // Q4 — task progress (join tasks + task_submissions)
      // Q5 — leaderboard rank (try/catch, 200ms timeout guard)
      // Q6 — streak (courseStreak model)
      // Q7 — weekly report submitted
      // Q8 — batch info (from user-batch controller pattern)

      // Promise.all([...])
      // compute and return shape
    }
  );

  return ok(reply, result);
}
```

### MP-04: Handlers `getMentorshipRevenueHandler` + `upsertMentorshipRevenueHandler`

Both use raw SQL (no Prisma model). ISO week/year computed with `date-fns/getISOWeek` + `getYear`.

```typescript
// GET — fetch current week's row or null
export async function getMentorshipRevenueHandler(request, reply) { ... }

// PUT — upsert
export async function upsertMentorshipRevenueHandler(request, reply) { ... }
```

### MP-05: Register routes in `user/routes.ts`

```typescript
import { getMentorshipStatsHandler, getMentorshipRevenueHandler, upsertMentorshipRevenueHandler } from './controller.js';

// ── Mentorship Dashboard ───────────────────────────────────────────────────
fastify.get('/mentorship/stats',   getMentorshipStatsHandler);
fastify.get('/mentorship/revenue', getMentorshipRevenueHandler);
fastify.put('/mentorship/revenue', upsertMentorshipRevenueHandler);
```

---

## 6. Frontend Implementation Steps

### MP-06: `lib/api/services/mentorship.service.ts` (NEW)

```typescript
import apiClient from "../client";
import type { ApiResponse } from "@/types";

export type MentorshipStats = {
  dailyTimeSpentHrs: number;
  dailyTimeGoalHrs: number;
  weeklyReportSubmitted: boolean;
  streakDays: number;
  totalEpisodes: number;
  completedEpisodes: number;
  tasksCompleted: number;
  tasksTotal: number;
  leaderboardRank: number | null;
  daysElapsed: number;
};

export type MentorshipRevenue = {
  weekNumber: number;
  year: number;
  revenueGenerated: number | null;
  revenuePrev: number | null;
  numberOfOrders: number | null;
  ordersPrev: number | null;
  adBudgetSpent: number | null;
  roas: number | null;
  customerAcqCost: number | null;
  organicLeads: number | null;
  leadsPrev: number | null;
  avgOrderValue: number | null;
  updatedAt: string | null;
};

export const mentorshipService = {
  getStats: () =>
    apiClient.get<never, ApiResponse<MentorshipStats>>("/api/user/mentorship/stats"),

  getRevenue: () =>
    apiClient.get<never, ApiResponse<MentorshipRevenue | null>>("/api/user/mentorship/revenue"),

  upsertRevenue: (data: Partial<Omit<MentorshipRevenue, "weekNumber" | "year" | "updatedAt">>) =>
    apiClient.put<never, ApiResponse<MentorshipRevenue>>("/api/user/mentorship/revenue", data),
};
```

### MP-07: `lib/hooks/useMentorship.ts` (NEW)

```typescript
"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { mentorshipService } from "@/lib/api/services/mentorship.service";

export const useMentorshipStats = () =>
  useQuery({
    queryKey: ["user", "mentorship-stats"],
    queryFn: async () => {
      const res = await mentorshipService.getStats();
      return res.data;
    },
    staleTime: 60_000,       // matches backend cache TTL
    refetchInterval: 120_000, // poll every 2 min for "live" feel
  });

export const useMentorshipRevenue = () =>
  useQuery({
    queryKey: ["user", "mentorship-revenue"],
    queryFn: async () => {
      const res = await mentorshipService.getRevenue();
      return res.data ?? null;
    },
    staleTime: 300_000,
  });

export const useUpsertMentorshipRevenue = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: mentorshipService.upsertRevenue,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user", "mentorship-revenue"] });
      qc.invalidateQueries({ queryKey: ["user", "mentorship-stats"] });
    },
  });
};
```

### MP-08: `/batch-program/mentorship/page.tsx` (NEW page)

**File:** `tbt-user-web/app/(platform)/batch-program/mentorship/page.tsx`

Structure:
```
MentorshipDashboard                        ("use client")
  ├── MentorshipHeader                     (program name, badges, streak, lifelines)
  ├── KpiStrip                             (4 animated KPI cards)
  ├── CustomerJourney                      (6 mini-tiles + "Live Update" badge)
  ├── ExpertSupportCalls                   (6 call-type tiles + header badges)
  ├── RevenueStats                         (4 revenue cards + edit button/modal)
  └── [existing batch-program content]     (place a navigation link back to /batch-program)
```

**Data fetching:**
```typescript
const { data: stats, isLoading: statsLoading } = useMentorshipStats();
const { data: batchData, isLoading: batchLoading } = useMyBatchProgram();
const { data: quota } = useUserSupportQuota();
const { data: revenue } = useMentorshipRevenue();
const { data: me } = useMe();
```

All sections receive their data as props. While loading, show skeleton cards with the same grid layout.

---

## 7. Animation Specification (MP-09 & MP-10)

### 7.1 Libraries
- **framer-motion** v12 (already installed) — entrance animations, stagger, hover glow
- **Custom `useCountUp` hook** — `requestAnimationFrame`-based, no extra package

### 7.2 `useCountUp` hook
```typescript
// lib/hooks/useCountUp.ts
export function useCountUp(target: number, duration = 1200, decimals = 0): string {
  // Uses useEffect + requestAnimationFrame
  // Easing: cubic-bezier ease-out
  // Returns formatted string (e.g. "3.15" or "45,856")
  // Restarts whenever `target` changes
}
```

### 7.3 Page entrance — stagger container
```typescript
const container = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } } };

// Wrap each section in <motion.div variants={item}>
// Wrap page in <motion.div variants={container} initial="hidden" animate="show">
```

### 7.4 KPI cards — glow pulse on load
```css
@keyframes glow-pulse {
  0%, 100% { box-shadow: 0 0 0px 0px color-mix(in srgb, var(--color-accent) 30%, transparent); }
  50%       { box-shadow: 0 0 18px 4px color-mix(in srgb, var(--color-accent) 40%, transparent); }
}
.kpi-card { animation: glow-pulse 2.4s ease-in-out 0.5s 2; }
```
Apply once on mount (2 cycles), then stop. Do NOT loop forever (performance).

### 7.5 Progress bars — animate width from 0
```typescript
// CSS transition on mounted state:
const [mounted, setMounted] = useState(false);
useEffect(() => { const t = setTimeout(() => setMounted(true), 200); return () => clearTimeout(t); }, []);

<div style={{ width: mounted ? `${pct}%` : "0%", transition: "width 1s cubic-bezier(0.4,0,0.2,1)" }} />
```

### 7.6 Streak badge — heartbeat
```css
@keyframes heartbeat {
  0%, 100% { transform: scale(1); }
  14%       { transform: scale(1.15); }
  28%       { transform: scale(1); }
  42%       { transform: scale(1.1); }
}
.streak-badge { animation: heartbeat 1.6s ease-in-out 0.8s 1; }
```

### 7.7 Lifeline hearts — stagger in
```typescript
// Each heart: <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
//   transition={{ delay: 0.6 + index * 0.1, type: "spring", stiffness: 400, damping: 15 }} />
```

### 7.8 Revenue cards — number flip on update
When `revenue` data changes (after user saves), trigger a `key` change on the CountUp to restart the count-up animation:
```typescript
<CountUpNumber key={`${revenue?.weekNumber}-${revenue?.revenueGenerated}`} value={revenue?.revenueGenerated ?? 0} />
```

### 7.9 Performance rules
- All `motion.div` must use `layout={false}` unless needed — prevents reflow cost
- Glow CSS animation runs on `transform`/`box-shadow` only — GPU composited
- `refetchInterval: 120_000` on stats — "live update" badge without hammering
- Skeleton placeholders during load to avoid layout shift
- `will-change: transform` on animated cards, removed after animation ends via `onAnimationComplete`

---

## 8. Visual Design Spec

### Color palette (uses theme tokens + local)
```
Background (page):   var(--color-bg-primary)   → dark: #0d0d0d
Card background:     var(--color-bg-surface)    → dark: #141414
Card border:         color-mix(in srgb, var(--color-accent) 20%, transparent)
Metric number:       #ffffff (always white, even in light mode — on dark card)
Section label:       var(--color-text-subtle)
Growth positive:     #22c55e (green-500)
Growth negative:     #ef4444 (red-500)
Accent strip:        var(--color-accent) (TBT brand color)
Streak badge bg:     rgba(251,146,60,0.15) + border amber-500/30
Weekly badge bg:     rgba(34,197,94,0.15)  + border green-500/30
```

### KPI card structure
```
┌─────────────────────────────────────┐
│  DAILY TIME SPENT          [label]  │
│                                     │
│  3.15 hrs                           │  ← CountUp, large white text
│  vs 2hr goal             [+57.5%]  │  ← small muted + growth badge
└─────────────────────────────────────┘
```

### Customer Journey tile
```
┌──────────────────┐
│ Daily Usage      │
│ 2  /12           │  ← large/small numbers
│ ████░░░░ 16%    │  ← progress bar (accent color)
└──────────────────┘
```

### Support call tile
```
┌──────────────────┐
│ SALES CALLS      │
│ 2  /7            │  ← used/total
│ ██░░░░░░ 29%    │
└──────────────────┘
```

### Revenue card
```
┌─────────────────────────────────────┐
│ REVENUE GENERATED         [+0.7%]  │
│                                     │
│ ₹4,57,856                          │
│ Avg Order Value ₹51,980            │
│ Last 2 orders                      │
└─────────────────────────────────────┘
```

---

## 9. Revenue Edit Modal

A `<dialog>` or bottom-sheet overlay triggered by "Update This Week's Stats" button:

**Fields (9 inputs, numeric):**
1. Revenue Generated (₹)
2. Revenue — Previous Week (₹) [for growth % calc]
3. Number of Orders
4. Orders — Previous Week
5. Ad Budget Spent (₹)
6. ROAS
7. Customer Acquisition Cost (₹/customer)
8. Organic Inbound Leads
9. Leads — Previous Week

On submit: `useUpsertMentorshipRevenue().mutateAsync(formData)`.  
Optimistic UI: update local state immediately, revert on error.  
Dismiss on outside click or Escape key.

---

## 10. Implementation Order

| Item | File(s) | Dependency |
|------|---------|------------|
| MP-01 | `tbt-admin/backend/src/plugins/prisma.ts` | none — DB first |
| MP-02 | same as MP-01 | after MP-01 block |
| MP-03 | `tbt-admin/backend/src/modules/user/controller.ts` | MP-01 |
| MP-04 | same as MP-03 | MP-01 |
| MP-05 | `tbt-admin/backend/src/modules/user/routes.ts` | MP-03, MP-04 |
| MP-06 | `tbt-user-web/lib/api/services/mentorship.service.ts` | MP-05 |
| MP-07 | `tbt-user-web/lib/hooks/useMentorship.ts` | MP-06 |
| MP-08 | `tbt-user-web/lib/hooks/useCountUp.ts` | none |
| MP-09 | `tbt-user-web/app/(platform)/batch-program/mentorship/page.tsx` | MP-07, MP-08 |
| MP-10 | Inline CSS in page + globals.css keyframes | MP-09 |

---

## 11. Edge Cases & Guards

| Scenario | Handling |
|----------|----------|
| Member not in any batch | Stats endpoint returns all zeros; UI shows "No active batch" placeholder inside tiles |
| No revenue report for current week | Revenue section shows "No data yet" state with prominent "Add Your Stats →" button |
| `leaderboardRank` query times out | Returns `null`; UI shows `#—` placeholder, no error |
| `dailyTimeSpentHrs` = 0 | Shows `0.00 hrs` — no zero-state hiding |
| Support quota all zeros | Call tiles still render with `0/0`; no division-by-zero |
| Growth % with `prev = 0` | Show `—` instead of `∞%` or NaN |
| Revenue prev week null | Growth badge hidden (can't compute), current value shown |
| `streakDays = 0` | Streak badge shows `0 Days` with muted style instead of amber |
| `weeklyReportSubmitted = false` | Badge hidden (not shown as "not submitted") |

---

## 12. What NOT to Build

- Do not add admin UI for viewing member revenue reports (member-private, admin has no business seeing raw revenue numbers unless specified later)
- Do not add export/download for this page (out of scope)
- Do not add gamification (XP, coins) tied to revenue entry — no incentive to inflate
- Do not show revenue data to other members (leaderboard context only if explicitly asked)
- Do not auto-advance or auto-refresh the existing `/batch-program` page when navigating here

---

## 13. Files Changed / Created Summary

**Backend (`tbt-admin/backend/`):**
- `src/plugins/prisma.ts` — MP-01 + MP-02 (3 new raw-SQL blocks)
- `src/modules/user/controller.ts` — MP-03 + MP-04 (3 new exported functions)
- `src/modules/user/routes.ts` — MP-05 (3 new route registrations)

**Frontend (`tbt-user-web/`):**
- `lib/api/services/mentorship.service.ts` — NEW (MP-06)
- `lib/hooks/useMentorship.ts` — NEW (MP-07)
- `lib/hooks/useCountUp.ts` — NEW (MP-08, shared utility)
- `app/(platform)/batch-program/mentorship/page.tsx` — NEW (MP-09 + MP-10)
- `app/globals.css` — add `glow-pulse`, `heartbeat` keyframes (MP-10)

**No changes to:**
- `app/(platform)/batch-program/page.tsx` (existing day-tracker stays untouched)
- `app/(platform)/batch-program/[day]/page.tsx`
- Any existing hooks or services
- Navbar (link to mentorship page can be added separately from the batch-program page as a tab or CTA)
