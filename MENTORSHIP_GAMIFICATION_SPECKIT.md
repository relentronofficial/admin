# MENTORSHIP_GAMIFICATION_SPECKIT.md

Speckit for the five gamification features described by Shakthi that are currently absent from
the application. Based on a gap analysis performed 2026-09-08 against the live codebase.

---

## Feature Index

| ID | Feature | Area | Priority |
|---|---|---|---|
| MG-01 | Plan Entitlement System | Backend + Admin + Profile | P0 |
| MG-02 | Program-Wide Lifeline Ledger | Backend + User Web | P0 |
| MG-03 | Multi-Stage Process Tasks | Backend + Admin + User Web | P1 |
| MG-04 | Early Completion Bonus | Backend + User Web | P1 |
| MG-05 | Buy Extra Support / Call Credits | Backend + Admin + User Web | P2 |

---

## MG-01 — Plan Entitlement System

### What
Every membership plan (`free | starter | premium | vip | enterprise`) has a fixed allocation of
support resources. The member's profile shows exactly what they're entitled to and how much
they've consumed.

The entitlements are:
- **Tech support days** — one-to-one troubleshooting sessions
- **Ad support days** — ad review / feedback sessions
- **Group calls** — live group call access count
- **Personalised call lifelines** — how many "extra personalised calls" can be redeemed (distinct
  from focus-mode lifelines; see MG-02)
- **One-to-one with Shakthi** — boolean; gated at the plan level

### DB Changes (startup ALTER in `prisma.ts`)

```sql
-- Plan-level entitlement definitions (one row per plan tier)
CREATE TABLE IF NOT EXISTS plan_entitlements (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan                   VARCHAR(50) NOT NULL UNIQUE,  -- matches membershipPlan enum
  tech_support_days      INT NOT NULL DEFAULT 0,
  ad_support_days        INT NOT NULL DEFAULT 0,
  group_call_count       INT NOT NULL DEFAULT 0,
  call_credit_count      INT NOT NULL DEFAULT 0,       -- extra personalised call slots
  one_to_one_enabled     BOOLEAN NOT NULL DEFAULT false,
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Per-member usage ledger (append-only; one row per session used)
CREATE TABLE IF NOT EXISTS support_usage (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id    UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  batch_id     UUID REFERENCES batches(id) ON DELETE SET NULL,
  type         VARCHAR(50) NOT NULL,  -- 'tech_support' | 'ad_support' | 'group_call' | 'one_to_one'
  notes        TEXT,
  recorded_by  TEXT,                  -- admin Clerk ID who recorded the use
  used_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_support_usage_member ON support_usage(member_id);
CREATE INDEX IF NOT EXISTS idx_support_usage_type   ON support_usage(member_id, type);
```

Seed default rows for all five plans into `plan_entitlements` on startup (upsert):
```sql
INSERT INTO plan_entitlements (plan, tech_support_days, ad_support_days, group_call_count,
  call_credit_count, one_to_one_enabled)
VALUES
  ('free',       0,  0,  0,  0, false),
  ('starter',    2,  2,  4,  0, false),
  ('premium',    5,  5, 10,  1, true),
  ('vip',       10, 10, 20,  3, true),
  ('enterprise', 0,  0,  0,  0, false)   -- customised per member manually
ON CONFLICT (plan) DO NOTHING;
```

### Backend API

**Admin routes (`/api/support-entitlements` — Clerk-protected):**

| Method | Path | Description |
|---|---|---|
| GET | `/api/support-entitlements` | List all plan entitlement rows |
| PUT | `/api/support-entitlements/:plan` | Update entitlements for a plan |
| GET | `/api/support-entitlements/usage` | Paginated support usage log (all members) |
| POST | `/api/support-entitlements/usage` | Admin manually records a support session use |
| DELETE | `/api/support-entitlements/usage/:id` | Admin corrects a mistaken usage record |

Request body for PUT:
```typescript
{ techSupportDays: number; adSupportDays: number; groupCallCount: number;
  callCreditCount: number; oneToOneEnabled: boolean }
```

**User routes (`/api/user/support-quota` — `authenticateUser`):**

| Method | Path | Description |
|---|---|---|
| GET | `/api/user/support-quota` | Returns entitlement + used count per type |

Response shape:
```typescript
{
  plan: string;
  techSupport:   { allocated: number; used: number; remaining: number };
  adSupport:     { allocated: number; used: number; remaining: number };
  groupCall:     { allocated: number; used: number; remaining: number };
  callCredits:   { allocated: number; used: number; remaining: number };
  oneToOne:      boolean;
}
```

Controller logic: `JOIN plan_entitlements pe ON pe.plan = m.membership_plan` +
`SELECT type, COUNT(*) FROM support_usage WHERE member_id = $1 GROUP BY type`.

### Admin Panel Changes

**New page: `admin-panel/app/settings/entitlements/page.tsx`**
- Table: one row per plan; editable inline (5 number inputs + toggle per row)
- "Save" calls `PUT /api/support-entitlements/:plan`
- New sidebar link under Settings: "Plan Entitlements"

**Members page extension (`/members/[id]`):**
- New "Support Usage" tab
- Shows quota cards (tech / ad / group / one-to-one) with used/remaining
- "Record Session" button → modal → selects type + optional notes → POST usage

Hook additions to `useTbt.ts`:
```typescript
useGetPlanEntitlements()         // GET /api/support-entitlements
useUpdatePlanEntitlements(plan)  // PUT /api/support-entitlements/:plan
useMemberSupportQuota(memberId)  // GET /api/support-entitlements/usage?memberId=
useRecordSupportUsage()          // POST /api/support-entitlements/usage
useDeleteSupportUsage()          // DELETE /api/support-entitlements/usage/:id
```

### User Web Changes

**Profile page (`app/(platform)/profile/`):**
- Add "Your Mentorship Benefits" section below basic profile info
- Six cards in a 2×3 grid:
  - Tech Support: `N / M days used`
  - Ad Support: `N / M days used`
  - Group Calls: `N / M used`
  - Extra Call Credits: `N remaining` (links to MG-05 buy flow)
  - One-to-One: `Included` / `Not in your plan`
  - Lifelines: `N remaining` (program-wide — MG-02)
- All values from `useUserSupportQuota()` hook in `lib/hooks/useUser.ts`

Hook to add to `lib/hooks/useUser.ts`:
```typescript
export function useUserSupportQuota() {
  return useQuery({ queryKey: ["user", "support-quota"], queryFn: () => quotaService.getQuota(), staleTime: 60_000 });
}
```

---

## MG-02 — Program-Wide Lifeline Ledger

### What
The current lifeline system resets every page load (`freeLifelinesPerSession`). The described
system allocates N lifelines for the entire 90-day program. Once used, they're gone unless
purchased (see MG-05). "Lifelines" here refer to focus-timer unlocks on course episodes and
batch tasks — not support sessions.

### DB Changes (add columns to existing raw-SQL tables)

```sql
-- Track per-member program-wide focus lifelines
ALTER TABLE member_batch_settings ADD COLUMN IF NOT EXISTS lifelines_total  INT NOT NULL DEFAULT 3;
ALTER TABLE member_batch_settings ADD COLUMN IF NOT EXISTS lifelines_used   INT NOT NULL DEFAULT 0;

-- Also track on the lifeline_usages table which already exists — no new table needed
-- lifeline_usages already has: member_id, batch_id, task_id, day_number, coins_spent, used_at
-- Add episode linkage for course-context lifelines:
ALTER TABLE lifeline_usages ADD COLUMN IF NOT EXISTS episode_id UUID REFERENCES course_episodes(id) ON DELETE SET NULL;
ALTER TABLE lifeline_usages ADD COLUMN IF NOT EXISTS context    VARCHAR(50) DEFAULT 'task'; -- 'task' | 'episode'
```

`lifelines_total` defaults to 3 (matching the passage). Admin can override per member via
`useUpsertMemberBatchSettings`.

### Backend Changes

**New route: `POST /api/user-batch/lifeline/use`** (authenticateUser)

Request body:
```typescript
{ batchId: string; taskId?: string; episodeId?: string; context: 'task' | 'episode' }
```

Handler logic:
1. Fetch `member_batch_settings` row for `(memberId, batchId)`
2. If `lifelines_used >= lifelines_total` → return `{ success: false, reason: 'exhausted', coinsRequired: 50 }`
3. `UPDATE member_batch_settings SET lifelines_used = lifelines_used + 1 WHERE ...`
4. INSERT into `lifeline_usages`
5. Return `{ success: true, lifelinesRemaining: total - used - 1 }`

**Modified route: `GET /api/user-batch`** — extend response to include:
```typescript
lifelinesTotal: number;
lifelinesUsed: number;
lifelinesRemaining: number;
```

**Admin panel: `useUpsertMemberBatchSettings` hook** — already exists; add `lifelinesTotal`
to its request body so admin can grant extra lifelines per member.

### User Web Changes

**`app/(platform)/learning/[courseId]/page.tsx`**

Current `freeLifelinesPerSession` is a session-local state initialized from `config`. Replace
with DB-backed program-wide count when the course belongs to a batch:

1. Add `useProgramLifelines(batchId)` hook that calls `GET /api/user-batch` and extracts
   `lifelinesRemaining`. Only relevant when member has an active batch.
2. When `batchId` is available (from `useMe().batchId`), use program-wide count instead of
   session count.
3. When a lifeline is consumed: call `POST /api/user-batch/lifeline/use` before deducting
   locally. On failure with `reason: 'exhausted'` and no coins → show "Buy a lifeline" prompt
   (links to MG-05).
4. On page load, `lifelinesLeft` state is initialized from the DB count (not `config.freeLifelinesPerSession`).
5. The `freeLifelinesPerSession` site config becomes the fallback only for courses NOT
   associated with any batch (standalone courses without a program context).

**`app/(platform)/batch-program/[day]/page.tsx`** (task focus timers, if applicable)
- Same lifeline count from `useMyBatchProgram().lifelinesRemaining`

Hook to add to `lib/hooks/useBatchProgram.ts`:
```typescript
export function useUseProgramLifeline() {
  return useMutation({
    mutationFn: (body: { batchId: string; taskId?: string; episodeId?: string; context: 'task' | 'episode' }) =>
      batchService.useLifeline(body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["user-batch"] }); },
  });
}
```

---

## MG-03 — Multi-Stage Process Tasks

### What
A "process" groups multiple sequential tasks inside a single batch day (or program). Each stage
has its own timer. Stage N+1 is locked until Stage N is submitted and approved. The classic
example: ad script process → Stage 1: Write script (8h timer) → Stage 2: Shoot (8h timer) →
Stage 3: Edit (8h timer).

The team reviews each stage's submission independently before the next stage unlocks.

### DB Changes (startup ALTER in `prisma.ts`)

```sql
-- Process definitions (belong to a batch or program day)
CREATE TABLE IF NOT EXISTS task_processes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id     UUID REFERENCES batches(id) ON DELETE CASCADE,
  program_id   UUID REFERENCES programs(id) ON DELETE CASCADE,
  day_number   INT,                           -- if batch-scoped
  title        TEXT NOT NULL,
  description  TEXT,
  position     INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (batch_id IS NOT NULL OR program_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_task_processes_batch ON task_processes(batch_id, day_number);

-- Link tasks to a process and give them a stage position
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS process_id     UUID REFERENCES task_processes(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS stage_position INT;  -- order within the process; NULL = not part of a process
```

A task with `process_id` set behaves like a stage. The stage at `stage_position = 1` is
immediately available. Stage N+1 becomes available only when Stage N's `task_submissions` row
has `status = 'approved'`.

`task_processes` rows are separate from tasks — a process is the container; tasks are the
stages inside it.

### Backend Changes

**New routes under `/api/batches` (Clerk-protected admin):**

| Method | Path | Description |
|---|---|---|
| GET | `/api/batches/:id/processes` | List processes for a batch |
| POST | `/api/batches/:id/processes` | Create a process (+ its stage tasks inline) |
| PUT | `/api/batches/processes/:pid` | Update process title/description/position |
| DELETE | `/api/batches/processes/:pid` | Delete process (cascades to stage tasks) |
| PUT | `/api/batches/processes/:pid/reorder` | Reorder stages `{ ids: string[] }` |

POST body for creating a process:
```typescript
{
  title: string;
  description?: string;
  dayNumber?: number;
  stages: Array<{
    title: string;
    description?: string;
    timerSeconds: number;        // e.g. 28800 for 8 hours
    submissionType: 'text' | 'file' | 'url';
    position: number;
  }>;
}
```
Creates one `task_processes` row and N `tasks` rows (with `process_id` and `stage_position` set).

**Modified `GET /api/user-batch/:dayNumber`** — stage locking logic:

For each task that has a `process_id`:
1. Fetch all tasks in the same process, ordered by `stage_position`
2. For stage N (where N > 1): check if stage N-1 has a `task_submissions` row with
   `status = 'approved'` for this member
3. If not approved → set `stageLocked: true` on the response item
4. Group tasks by `process_id` in the response: add a `processes` array alongside `tasks`

Response additions per task:
```typescript
{
  processId?: string;
  processTitle?: string;
  stagePosition?: number;
  stageLocked?: boolean;     // true if previous stage not yet approved
  totalStagesInProcess?: number;
}
```

**Modified `POST /api/user-batch/:dayNumber/submit` (stage submission)**:
- If `taskId` belongs to a process, also record which `stage_position` was submitted
- After admin approves a stage submission → check if there is a next stage → emit
  `notification` socket event to `user:{memberId}` with type `batch:stage_unlocked`,
  payload `{ processTitle, nextStageTitle, stagePosition }`

### Admin Panel Changes

**Batch day editor (`admin-panel/app/batches/[id]/`)**

Add "Processes" tab alongside existing "Tasks" tab.

Process card shows:
- Process title, description
- Stage list: Stage 1 (title, timer badge), Stage 2 …
- Add Stage button
- Drag-to-reorder stages
- Delete process button

"Create Process" flow:
1. Enter process title + description
2. Add stages inline (title, timer in hours, submission type)
3. Save → `POST /api/batches/:id/processes`

Hook additions to `useTbt.ts`:
```typescript
useListBatchProcesses(batchId)           // GET /api/batches/:id/processes
useCreateBatchProcess()                  // POST /api/batches/:id/processes
useUpdateBatchProcess()                  // PUT /api/batches/processes/:pid
useDeleteBatchProcess()                  // DELETE /api/batches/processes/:pid
useReorderBatchProcessStages()           // PUT /api/batches/processes/:pid/reorder
```

**Submissions review page (`admin-panel/app/batches/[id]/`)** — existing submission review
panel needs a "Stage X of Y" label when viewing a process-stage submission.

### User Web Changes

**`app/(platform)/batch-program/[day]/page.tsx`**

Render processes as collapsed accordion cards above the standalone task list:

```
[Process: Ad Script Campaign]
  Stage 1: Write the Script      [8h timer] [Submit] ← unlocked
  Stage 2: Shoot the Video       [8h timer] [Locked — submit Stage 1 first]
  Stage 3: Edit                  [8h timer] [Locked]
```

- `stageLocked: true` → show lock icon, "Complete previous stage first" tooltip
- On stage submission: member writes text / uploads file → `useSubmitBatchDay` with `taskId`
- Stage approval notification (`batch:stage_unlocked`) → toast + accordion auto-expands next stage

---

## MG-04 — Early Completion Bonus

### What
If a member completes a task or episode before the focus timer expires, they receive a bonus XP
award. The faster they finish, the more they're celebrated. This creates a positive FOMO loop
in addition to the negative one (content locking).

### DB Changes

```sql
ALTER TABLE member_episode_progress ADD COLUMN IF NOT EXISTS timer_started_at TIMESTAMPTZ;
ALTER TABLE member_episode_progress ADD COLUMN IF NOT EXISTS timer_seconds     INT;   -- duration that was active
ALTER TABLE member_episode_progress ADD COLUMN IF NOT EXISTS completed_early   BOOLEAN DEFAULT false;
```

No new table — use `source = 'early_completion'` in the existing `MemberXP` model. Add via
startup ALTER:
```sql
-- MemberXP.source is a Prisma enum; add the value if not present
ALTER TYPE "XpSource" ADD VALUE IF NOT EXISTS 'early_completion';
```

Also add a site-config column:
```sql
ALTER TABLE site_configs ADD COLUMN IF NOT EXISTS early_completion_bonus_xp INT NOT NULL DEFAULT 5;
```

Admin exposes this in Settings → Site as "Early Completion Bonus XP".

### Backend Changes

**Modified `POST /api/user/courses/:courseId/episodes/:episodeId/complete`:**

Add optional fields to the request body:
```typescript
{ watchedSeconds: number; isCompleted: boolean; timerStartedAt?: number; timerSeconds?: number }
```

In the handler, after recording completion:
```typescript
if (isCompleted && timerStartedAt && timerSeconds) {
  const elapsed = Math.floor((Date.now() - timerStartedAt) / 1000);
  if (elapsed < timerSeconds) {
    // award bonus XP
    const bonusXp = config.earlyCompletionBonusXp ?? 5;
    await prisma.memberXP.create({ data: { memberId, courseId, episodeId, points: bonusXp, source: 'early_completion' } });
    // mark the progress row
    await prisma.$executeRawUnsafe(
      'UPDATE member_episode_progress SET completed_early = true, timer_started_at = $1, timer_seconds = $2 WHERE member_id = $3::uuid AND episode_id = $4::uuid',
      new Date(timerStartedAt), timerSeconds, memberId, episodeId
    );
    return { ..., bonusXpAwarded: bonusXp, completedEarly: true };
  }
}
return { ..., bonusXpAwarded: 0, completedEarly: false };
```

Similarly for **`POST /api/user-batch/:dayNumber/submit`** (task context):
```typescript
if (timerStartedAt && timerSeconds && elapsed < timerSeconds) {
  // insert into tbt_activity_log with activity_type = 'early_completion'
  bonusXpAwarded = config.earlyCompletionBonusXp ?? 5;
}
```

### User Web Changes

**`app/(platform)/learning/[courseId]/page.tsx`**

1. When focus dialog "Start Focus" is clicked: record `timerStartedAtRef.current = Date.now()`.
2. Pass `timerStartedAt` and `timerSeconds` to `useMarkLessonComplete`:
   ```typescript
   markComplete.mutate({ episodeId, watchedSeconds, isCompleted: true,
     timerStartedAt: timerStartedAtRef.current ?? undefined,
     timerSeconds: currentLessonTimerDuration ?? undefined });
   ```
3. On success, if `bonusXpAwarded > 0 && completedEarly`:
   - Show special XP flash: `+${baseXp} XP  +${bonusXp} Early Bird Bonus!`
   - Confetti or green pulse animation (distinct from normal XP flash)

**`app/(platform)/batch-program/[day]/page.tsx`** — same: pass `timerStartedAt` on submission.

### Admin Panel Changes

**Settings → Site page** — add "Early Completion Bonus XP" number input (default 5).
Saves to `site_configs.early_completion_bonus_xp` via existing site-config update endpoint.

---

## MG-05 — Buy Extra Support / Call Credits

### What
When a member exhausts their plan's support allocation (e.g., all 5 ad support days used),
they can purchase additional 45-minute or 60-minute sessions. They can also top up focus-mode
lifelines (already partially exists via coins; this adds a proper purchase flow).

### DB Changes

```sql
CREATE TABLE IF NOT EXISTS credit_purchases (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id      UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  credit_type    VARCHAR(50) NOT NULL,   -- 'tech_support' | 'ad_support' | 'group_call_45' | 'group_call_60' | 'one_to_one_45' | 'one_to_one_60' | 'lifeline'
  quantity       INT NOT NULL DEFAULT 1,
  amount_inr     DECIMAL(10,2) NOT NULL,
  status         VARCHAR(50) NOT NULL DEFAULT 'pending',  -- 'pending' | 'approved' | 'rejected'
  payment_ref    TEXT,
  admin_note     TEXT,
  reviewed_by    TEXT,
  reviewed_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_credit_purchases_member ON credit_purchases(member_id);
CREATE INDEX IF NOT EXISTS idx_credit_purchases_status ON credit_purchases(status);
```

Also add pricing config table:
```sql
CREATE TABLE IF NOT EXISTS credit_pricing (
  credit_type   VARCHAR(50) PRIMARY KEY,
  price_inr     DECIMAL(10,2) NOT NULL,
  label         TEXT NOT NULL,
  description   TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO credit_pricing (credit_type, price_inr, label, description) VALUES
  ('tech_support',    999,  'Tech Support Session',    '45-minute tech support call'),
  ('ad_support',      999,  'Ad Support Session',      '45-minute ad review session'),
  ('group_call_45',   499,  '45-min Group Call',       'Extra group call slot'),
  ('group_call_60',   699,  '60-min Group Call',       'Extra group call slot'),
  ('one_to_one_45',  1999,  'One-to-One (45 min)',     'Personalised call with coach'),
  ('one_to_one_60',  2999,  'One-to-One (60 min)',     'Personalised call with coach'),
  ('lifeline',        199,  'Extra Lifeline',          'One focus-mode lifeline unlock')
ON CONFLICT (credit_type) DO NOTHING;
```

### Backend Changes

**User routes (`/api/user/credits` — authenticateUser):**

| Method | Path | Description |
|---|---|---|
| GET | `/api/user/credits/pricing` | Returns credit_pricing rows |
| POST | `/api/user/credits/purchase` | Creates pending purchase; body: `{ creditType, quantity, paymentRef? }` |
| GET | `/api/user/credits/purchases` | Member's purchase history |

**Admin routes (`/api/credits` — Clerk-protected):**

| Method | Path | Description |
|---|---|---|
| GET | `/api/credits/pending` | Pending purchase list |
| POST | `/api/credits/:id/approve` | Approve purchase → add credits to member |
| POST | `/api/credits/:id/reject` | Reject with note |
| GET | `/api/credits/pricing` | Read pricing config |
| PUT | `/api/credits/pricing/:creditType` | Update price or label |

**Approve handler logic:**
- Sets `status = 'approved'`, records `reviewed_by`, `reviewed_at`
- Inserts into `support_usage` (for `tech_support | ad_support | group_call | one_to_one` types)
  OR increments `lifelines_total` in `member_batch_settings` (for `lifeline` type)
- Emits `notification` socket to `user:{memberId}`: `{ type: 'credit_approved', creditType, quantity }`

### Admin Panel Changes

**New page: `admin-panel/app/credits/page.tsx`**
- Tabs: "Pending" | "All Purchases" | "Pricing"
- Pending tab: list of purchases with member name, type, amount, payment ref; Approve/Reject buttons
- Pricing tab: editable table of `credit_pricing` rows

New sidebar link: "Credits" (under Billing section or near Members).

Hook additions to `useTbt.ts`:
```typescript
useListCreditPurchases(params?: { status?: string; memberId?: string })
useApproveCreditPurchase()
useRejectCreditPurchase()
useGetCreditPricing()
useUpdateCreditPricing()
```

### User Web Changes

**Profile page — "Your Mentorship Benefits" section (from MG-01)**

Alongside each quota card that has `remaining === 0`:
- Show a "Buy Extra" button
- Opens `CreditPurchaseModal` → lists available SKUs for that type (e.g., 45-min / 60-min)
  with prices from `useGetCreditPricing()`
- Selecting an option → confirm purchase → `POST /api/user/credits/purchase`
- Pending state shown: "Pending admin approval"
- On socket `credit_approved` event → invalidate support quota, show toast "Your extra session has been added!"

Hook additions to `lib/hooks/useUser.ts`:
```typescript
export function useCreditPricing() { ... }
export function usePurchaseCredit() { ... }
export function useMyCreditPurchases() { ... }
```

---

## Implementation Order

These features are independent enough to be built in parallel streams, but MG-01 is a dependency
for MG-05 (quota display). Recommended sprint order:

**Sprint 1 (foundation):**
1. MG-02 — Program-Wide Lifelines (DB + backend + user web). Smallest change, highest UX impact.
2. MG-01 — Plan Entitlement System (DB + backend + admin + profile). Unlocks MG-05.

**Sprint 2 (gamification):**
3. MG-04 — Early Completion Bonus (DB + backend + user web). Self-contained.
4. MG-03 — Multi-Stage Processes (DB + backend + admin + user web). Largest surface area.

**Sprint 3 (monetisation):**
5. MG-05 — Buy Extra Credits (DB + backend + admin + user web). Depends on MG-01 for display.

---

## Shared Constants

Add these to `site_configs` (startup ALTER + pub config endpoint):
```sql
ALTER TABLE site_configs ADD COLUMN IF NOT EXISTS early_completion_bonus_xp INT NOT NULL DEFAULT 5;
```

`pub/controller.ts` — add to the config response:
```typescript
earlyCompletionBonusXp: extraRows[0]?.early_completion_bonus_xp ?? 5,
```

`SiteConfig` type in `tbt-user-web/types/index.ts` — add:
```typescript
earlyCompletionBonusXp: number;
```

---

## Notes

- **`lifeline_usages` table already exists** (`prisma.ts:332`) — MG-02 only needs two ALTER
  TABLE ADD COLUMN statements; no new table.
- **`freeLifelinesPerSession` site config** — keep it; it remains the fallback for courses
  outside a batch context (standalone courses). When batchId is present, MG-02's DB count
  takes precedence.
- **`task_steps` table does not exist** — MG-03 deliberately avoids it; stage tasks are
  regular `tasks` rows with `process_id` + `stage_position` columns. Do not reference `steps`.
- **No Prisma migration files** — all new tables use `CREATE TABLE IF NOT EXISTS` in the
  startup block in `prisma.ts`. All new columns use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.
  Split into one `$executeRawUnsafe` call per statement (see pitfall #32).
- **Admin socket event for stage unlock** — emit to `user:{memberId}` room (not `live:*` or
  `workshop:*`). Payload: `{ type: 'batch:stage_unlocked', processTitle, nextStageTitle }`.
