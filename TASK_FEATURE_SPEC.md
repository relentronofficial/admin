# Task / Batch Program — Full Improvement Spec Kit

> **Scope:** All 25 improvements identified in the deep analysis of the Task (batch-program)
> feature across tbt-user-web, tbt-admin/backend, and tbt-admin/admin-panel.
>
> **Constraint:** Surgical updates only — no refactors of unrelated code.
> Follow existing patterns: R2 presigned uploads, raw SQL for new columns, TanStack Query hooks,
> Socket.IO room events, Zod schemas, and the established admin design system.

---

## Priority Tiers

| Tier | Label | Criteria |
|------|-------|----------|
| P0 | **Critical / Quick Win** | High impact, low effort, fixes real user friction |
| P1 | **High Impact** | Significant feature addition, medium effort |
| P2 | **Medium** | UX polish or admin workflow improvement |
| P3 | **Nice to Have** | Analytics, gamification, long-tail improvements |

---

## Item Index

| # | Title | Tier | Layer(s) |
|---|-------|------|----------|
| 1 | Today's Day shortcut + auto-scroll | P0 | User Web |
| 2 | Socket listener for approval/rejection | P0 | User Web |
| 3 | Prominent rejected-day callout | P0 | User Web |
| 4 | Break approval retroactively corrects attendance | P0 | Backend |
| 5 | Bulk approve/reject on Pending tab | P0 | Backend + Admin |
| 6 | Expose `taskProofs` in API and UI | P1 | Backend + User Web |
| 7 | Task proof file upload per task | P1 | User Web |
| 8 | Push/email notification on approval & rejection | P1 | Backend |
| 9 | Calendar day cells navigate to day detail | P1 | User Web |
| 10 | Submit-day guard: cannot submit future day | P1 | Backend |
| 11 | Auto-mark attendance on draft save | P1 | Backend |
| 12 | Extend Days UI in admin MemberTimelineDrawer | P1 | Admin |
| 13 | Break request: date-range picker instead of day numbers | P2 | User Web |
| 14 | Break request dates shown as calendar range in admin | P2 | Admin |
| 15 | Current-streak badge on overview page | P2 | User Web |
| 16 | Day analytics per-day approval rate chart | P2 | Backend + Admin |
| 17 | Empty state when member has no batch | P2 | User Web |
| 18 | Resource URL — inline YouTube/Vimeo embed | P2 | User Web |
| 19 | Manage Members modal — show current batch warning | P2 | Admin |
| 20 | Progress grid: filter toolbar + week grouping | P2 | Admin |
| 21 | Clone Batch action | P3 | Backend + Admin |
| 22 | Batch completion badge + certificate | P3 | Backend + User Web |
| 23 | Reminder cron endpoint | P3 | Backend |
| 24 | At-risk members section in Overview tab | P3 | Admin |
| 25 | XP per day configurable per batch | P3 | Backend + Admin |

---

---

## P0 — Critical / Quick Win

---

### Item 1 — Today's Day Shortcut + Auto-Scroll

**Problem:** On `/batch-program` the user sees a 90-day list with no indication of where today is except a highlight color. No quick way to jump directly to the current day.

**Files to change:**
- `tbt-user-web/app/(platform)/batch-program/page.tsx`

**Change description:**

1. **Pinned "Today" card** — Render a prominent card at the very top of the page (before the stats section) when `daysElapsed >= 1` and `daysElapsed <= totalDays`:

   ```
   ┌─────────────────────────────────────────────────────┐
   │  TODAY   Day 14  ·  Category Name              →   │
   │  [status badge]  Save Draft or Submit pending       │
   └─────────────────────────────────────────────────────┘
   ```

   - Background: `var(--color-accent)` with 15% opacity (`color-mix(in srgb, var(--color-accent) 15%, transparent)`)
   - Border left: 3px solid `var(--color-accent)`
   - Title from `days.find(d => d.dayNumber === daysElapsed)?.title`
   - Status badge from `progress.find(p => p.dayNumber === daysElapsed)?.status`
   - Clicking navigates to `/batch-program/{daysElapsed}`
   - Show uiString `batchTodayLabel` as the chip label

2. **Auto-scroll the day list** — The scrollable day list already renders all 90 rows. On mount, after data loads, call:
   ```typescript
   useEffect(() => {
     if (!data) return;
     const el = document.getElementById(`day-row-${daysElapsed}`);
     el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
   }, [data]);
   ```
   Add `id={`day-row-${day.dayNumber}`}` to each day list row element.

**Edge cases:**
- `daysElapsed === 0` (batch hasn't started): hide the today card entirely, show a "Batch starts on [date]" notice instead.
- `daysElapsed > totalDays` (batch ended): show "Batch completed" in place of the today card.

**uiStrings needed:** No new strings — use existing `batchTodayLabel`.

---

### Item 2 — Socket Listener for Approval / Rejection

**Problem:** The backend already emits `batch:day_approved` and `batch:day_rejected` to `user:{memberId}` room (lines 246–248 and 294–298 of `user-batch/controller.ts`), but the user web batch-program pages have no listener for these events. The user must manually refresh to see the update.

**Files to change:**
- `tbt-user-web/app/(platform)/batch-program/page.tsx`
- `tbt-user-web/app/(platform)/batch-program/[day]/page.tsx`

**Change description:**

In both pages, add a `useEffect` that listens on the socket:

```typescript
const { socket } = useSocket();
const queryClient = useQueryClient();

useEffect(() => {
  if (!socket) return;

  const handleApproved = (payload: { dayNumber: number; xpAwarded: number }) => {
    queryClient.invalidateQueries({ queryKey: ['my-batch'] });
    toast.success(`Day ${payload.dayNumber} approved! +${payload.xpAwarded} XP`);
  };

  const handleRejected = (payload: { dayNumber: number; reviewNote: string }) => {
    queryClient.invalidateQueries({ queryKey: ['my-batch'] });
    toast.error(`Day ${payload.dayNumber} needs revision`);
  };

  socket.on('batch:day_approved', handleApproved);
  socket.on('batch:day_rejected', handleRejected);
  return () => {
    socket.off('batch:day_approved', handleApproved);
    socket.off('batch:day_rejected', handleRejected);
  };
}, [socket]);
```

On the `[day]/page.tsx`, if the currently viewed day matches `payload.dayNumber`, additionally navigate back to the overview page (or re-render in place by checking if `dayNum === payload.dayNumber`).

**Dependencies:** `useSocket` is already in `tbt-user-web/lib/socket/useSocket.ts`. No new backend work needed.

---

### Item 3 — Prominent Rejected-Day Callout

**Problem:** When a day is rejected, `reviewNote` is displayed somewhere in the page but not highlighted. Users miss the admin's specific feedback.

**Files to change:**
- `tbt-user-web/app/(platform)/batch-program/[day]/page.tsx`

**Change description:**

When `progress?.status === 'rejected'` and `progress?.reviewNote` is non-empty, render a callout block as the **first element inside the page content area** (before the day title):

```
┌─────────────────────────────────────────────────────────┐
│  ⚠  Revision Requested                                  │
│  ─────────────────────────────────────────────────────  │
│  "Please add more detail to your journal entry and      │
│   check off all three tasks before resubmitting."       │
└─────────────────────────────────────────────────────────┘
```

Styling:
- Background: `color-mix(in srgb, #f59e0b 12%, transparent)` (amber tint)
- Border: `1px solid #f59e0b`
- Border-radius: `8px`
- Padding: `16px`
- Header text: `text-[#f59e0b] font-bold text-sm`
- Body text: `text-[#f0f0f0] text-sm mt-2 italic`

Only show when `status === 'rejected'`. When `reviewNote` is null/empty, show a fallback: "This day was sent back for revision. Please update and resubmit."

**uiStrings needed:** `batchRevisionLabel` already exists. Add `batchRevisionFeedbackLabel` for the header chip ("Revision Requested").

---

### Item 4 — Break Approval Retroactively Corrects Attendance

**Problem:** If a member manually marked themselves "absent" on days 10–15 and then an admin approves a break for those same days, the attendance records remain "absent". The backend only computes break status at mark-time.

**Files to change:**
- `tbt-admin/backend/src/modules/batches/controller.ts` — `approveBreakHandler`

**Change description:**

After the `UPDATE batch_break_requests` SQL in `approveBreakHandler`, add:

```typescript
// Retroactively correct attendance for days already marked absent (or not yet marked)
// within the approved break range
const breakRecord = record; // from the RETURNING * above
await req.server.prisma.$executeRawUnsafe(
  `INSERT INTO member_attendance (member_id, batch_id, day_number, status, marked_at, updated_at)
   SELECT $1, $2, gs.day, 'break', NOW(), NOW()
   FROM generate_series($3::int, $4::int) AS gs(day)
   ON CONFLICT (member_id, batch_id, day_number)
   DO UPDATE SET status = 'break', updated_at = NOW()
   WHERE member_attendance.status IN ('absent', 'not_marked')
      OR member_attendance.status IS NULL`,
  record.member_id,
  req.params.id,
  record.start_day,
  record.end_day,
);
```

> Note: The `WHERE` clause in `ON CONFLICT DO UPDATE` uses `member_attendance.*` syntax (the existing row). The correct Postgres idiom is to omit a WHERE on the DO UPDATE clause and instead use a CASE expression or just always set status to 'break' for days in the break range — since an approved break should always override absent.

Simplified version (safer):
```sql
INSERT INTO member_attendance (member_id, batch_id, day_number, status, marked_at, updated_at)
SELECT $1, $2, gs.day, 'break', NOW(), NOW()
FROM generate_series($3::int, $4::int) AS gs(day)
ON CONFLICT (member_id, batch_id, day_number)
DO UPDATE SET status = 'break', updated_at = NOW()
```

This always marks break days as "break" even if they were previously "present" — which is correct because an approved break supersedes any prior attendance.

**Edge cases:**
- `record` may be `undefined` if the `reqId` didn't match — check `if (!record) return 404` before the retroactive update.
- Parse `record.member_id`, `record.start_day`, `record.end_day` from the raw SQL result (snake_case columns from `$queryRawUnsafe`).

---

### Item 5 — Bulk Approve / Reject on Admin Pending Tab

**Problem:** The Pending tab requires clicking, opening a modal, approving, and closing for every single submission. At 50 members this is 150+ clicks per daily review cycle.

**Files to change:**
- `tbt-admin/backend/src/modules/batches/controller.ts` — add `bulkApproveHandler`
- `tbt-admin/backend/src/modules/batches/routes.ts` — register new route
- `tbt-admin/backend/src/modules/batches/schema.ts` — add `bulkApproveSchema`
- `tbt-admin/admin-panel/lib/hooks/useTbt.ts` — add `useBulkApproveBatchDays`
- `tbt-admin/admin-panel/app/batches/[id]/page.tsx` — add checkboxes + bulk action bar to Pending tab

#### Backend

**New schema** (`schema.ts`):
```typescript
export const bulkApproveSchema = z.object({
  items: z.array(z.object({
    memberId: z.string().uuid(),
    dayNumber: z.number().int().min(1),
  })).min(1, 'At least one item required'),
});
```

**New handler** (`controller.ts`):
```typescript
export async function bulkApproveDaysHandler(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const parsed = bulkApproveSchema.safeParse(req.body);
  if (!parsed.success) return reply.status(400).send({ ... });

  const adminId = (req as any).auth?.sub ?? null;
  const batchId = req.params.id;
  const results = [];

  for (const item of parsed.data.items) {
    const record = await req.server.prisma.memberDayProgress.upsert({
      where: { batchId_memberId_dayNumber: { batchId, memberId: item.memberId, dayNumber: item.dayNumber } },
      create: { batchId, memberId: item.memberId, dayNumber: item.dayNumber, status: 'approved', isCompleted: true, completedAt: new Date(), reviewedAt: new Date(), reviewedBy: adminId },
      update: { status: 'approved', isCompleted: true, completedAt: new Date(), reviewedAt: new Date(), reviewedBy: adminId, reviewNote: null },
    });
    // Award XP (non-blocking)
    req.server.prisma.pointsLedger.create({
      data: { memberId: item.memberId, points: 50, reason: `Batch day ${item.dayNumber} approved`, referenceType: 'batch_day', referenceId: record.id },
    }).catch(() => {});
    // Notify member
    req.server.io.to(`user:${item.memberId}`).emit('batch:day_approved', { dayNumber: item.dayNumber, batchId, xpAwarded: 50 });
    results.push(record);
  }

  return reply.send({ success: true, data: { approved: results.length }, error: null });
}
```

**New route** (`routes.ts`):
```typescript
fastify.post('/:id/pending/bulk-approve', { preHandler: [fastify.authenticate] }, bulkApproveDaysHandler);
```

#### Admin Panel

**New hook** (`useTbt.ts`):
```typescript
export const useBulkApproveBatchDays = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ batchId, items }: { batchId: string; items: { memberId: string; dayNumber: number }[] }) =>
      apiClient.post(`/api/batches/${batchId}/pending/bulk-approve`, { items }),
    onSuccess: (_, { batchId }) => {
      qc.invalidateQueries({ queryKey: ['batch-pending', batchId] });
      qc.invalidateQueries({ queryKey: ['batch-progress', batchId] });
    },
  });
};
```

**Pending tab UI changes** (`batches/[id]/page.tsx`):

1. Add `selectedIds: Set<string>` state (key = `${memberId}:${dayNumber}`)
2. Add a checkbox column as the first column of each pending row
3. Add a "Select All" checkbox in the table header
4. Show a sticky action bar at the top of the table when `selectedIds.size > 0`:
   ```
   ┌────────────────────────────────────────────────────────┐
   │  ✓ 12 selected    [Bulk Approve]   [Clear Selection]   │
   └────────────────────────────────────────────────────────┘
   ```
5. "Bulk Approve" button calls `useBulkApproveBatchDays` with the selected items, then clears selection.

**Edge cases:**
- Disable "Bulk Approve" while mutation is in-flight (show spinner)
- After success: show toast "12 days approved"
- Only expose bulk approve (not bulk reject — rejection requires a per-member review note)

---

---

## P1 — High Impact

---

### Item 6 — Expose `taskProofs` in API Response

**Problem:** `taskProofs` is written to `member_day_progress.task_proofs` via raw SQL in `saveDraftHandler` (line 125–129 of `user-batch/controller.ts`) but the `getMyBatchHandler` query already retrieves it (`SELECT *, task_proofs as "taskProofs"` on line 42). The column exists and is returned; it just isn't documented or used by the frontend.

**Files to change:**
- `tbt-user-web/types/index.ts` — add `taskProofs` field to `MemberDayProgress` type
- `tbt-user-web/app/(platform)/batch-program/[day]/page.tsx` — read and display `taskProofs`
- `tbt-admin/admin-panel/app/batches/[id]/page.tsx` — show task proofs in `CellModal`

**Change description:**

**Types (`types/index.ts`):**
Add to `MemberDayProgress` (or equivalent interface):
```typescript
taskProofs?: Record<string, string> | null; // { [taskId]: urlOrText }
```

**User web day detail page:**
For each task in the checklist, if `taskProofs?.[task.id]` exists, show a small "Proof attached" chip with a link icon that opens `taskProofs[task.id]` in a new tab. This is read-only display; the upload UI is Item 7.

**Admin CellModal:**
In the task checklist section of `CellModal`, for each task that has a proof, show a "View Proof" link (small, underlined) next to the task title. Opens the proof URL in a new tab.

**No backend change needed** — the column is already written and returned.

---

### Item 7 — Task Proof File Upload

**Problem:** Members can check tasks as done but cannot attach evidence (screenshot, document, photo).

**Files to change:**
- `tbt-user-web/app/(platform)/batch-program/[day]/page.tsx`
- `tbt-user-web/lib/hooks/useBatchProgram.ts` — `useSaveBatchDraft` already accepts `taskProofs`

**Change description:**

In the task checklist on the day detail page, add a small file attach button next to each task item. It appears only when the task is checked (`completedTaskIds.includes(task.id)`).

**Upload flow:**
1. User clicks the attach icon on a checked task
2. A file input (hidden, `accept="image/*,application/pdf"`) opens
3. On file select: call the R2 presigned URL pattern:
   ```typescript
   const { uploadUrl, publicUrl } = await getPresignedUrl.mutateAsync({
     filename: file.name,
     contentType: file.type,
     bucket: 'batch-proofs',
     pathPrefix: `${batchId}/${memberId}/day-${dayNumber}`,
   });
   await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
   ```
4. Store `publicUrl` in local `taskProofs` state: `{ ...prev, [task.id]: publicUrl }`
5. Call `saveDraftMutation.mutate({ dayNumber, completedTaskIds, taskProofs })` — `taskProofs` already in the schema

**Hook change (`useBatchProgram.ts`):**
`useSaveBatchDraft` already passes `taskProofs` in the body (line 8 of `user-batch/controller.ts`). No hook change needed.

**UI:**
- Attach icon: paperclip SVG, `text-[#606060] hover:text-[#dc2626]`, 16px
- When proof exists: show a small green checkmark + "View" link instead of the paperclip
- Uploading state: spinner in place of paperclip

**New hook needed** (`useBatchProgram.ts`):
```typescript
export const useUploadTaskProof = () => {
  // Uses useGetPresignedUrl from useAdmin
  // Returns: async (file, batchId, memberId, dayNumber, taskId) => publicUrl
};
```

> `useGetPresignedUrl` is from `@/lib/hooks/useAdmin` — not from `useTbt`.

**Bucket:** Add `'batch-proofs'` to the allowed bucket list in `backend/src/modules/upload/controller.ts` (wherever `bucket` is validated).

---

### Item 8 — Push/Email Notification on Approval & Rejection

**Problem:** Backend emits socket events but no push notification or SMS. Users who aren't in the app never hear about approvals or rejections.

**Files to change:**
- `tbt-admin/backend/src/modules/user-batch/controller.ts` — `approveDayHandler` and `rejectDayHandler`

**Change description:**

After the socket emit in each handler, create an `AppNotification` record (same pattern as other modules):

**In `approveDayHandler`** (after line 247):
```typescript
// Push notification
req.server.prisma.appNotification.create({
  data: {
    memberId: req.params.memberId,
    title: `Day ${dayNum} Approved! 🎉`,
    body: `You earned +50 XP. Keep going!`,
    type: 'batch_day_approved',
    referenceId: record.id,
    referenceType: 'batch_day',
  },
}).catch(() => {});
```

**In `rejectDayHandler`** (after line 295):
```typescript
req.server.prisma.appNotification.create({
  data: {
    memberId: req.params.memberId,
    title: `Day ${dayNum} Needs Revision`,
    body: parsed.data.reviewNote.slice(0, 100),
    type: 'batch_day_rejected',
    referenceId: record.id,
    referenceType: 'batch_day',
  },
}).catch(() => {});
```

**Check first:** Look at how `app-notifications` module creates notifications and whether there's a Firebase push dispatch tied to `appNotification.create`. If the `app-notifications` module has a Prisma middleware or a BullMQ job that fires push on insert, the above is sufficient. If not, also call the Firebase push service directly (follow the pattern in the notifications module).

**Edge cases:**
- Non-blocking: both calls use `.catch(() => {})` so notification failure never breaks the approval flow.
- No `AppNotification` type collision: use `'batch_day_approved'` and `'batch_day_rejected'` as new `type` enum values. Check if `type` is an enum in the schema or a plain string.

---

### Item 9 — Calendar Day Cells Navigate to Day Detail

**Problem:** Clicking a calendar day cell on `/batch-program` does nothing. Users must scroll the list below to find and click the day.

**Files to change:**
- `tbt-user-web/app/(platform)/batch-program/page.tsx`

**Change description:**

In the calendar rendering section, wrap each day cell in a `<Link href={`/batch-program/${dayNumber}`}>` from `next/link`. The `dayNumber` is computed from the calendar position: `weekIndex * 7 + dayIndex + 1` (offset by batch start weekday).

**Conditions:**
- Only make past and today cells clickable (where `dayNumber <= daysElapsed`)
- Future cells (`dayNumber > daysElapsed`) render as non-interactive divs (same visual, no link)
- Add `cursor-pointer hover:ring-1 hover:ring-[var(--color-accent)]` to clickable cells
- Add `cursor-not-allowed opacity-50` to future cells

**Note:** Verify how the current calendar maps grid position → dayNumber. The calendar likely uses `startOfMonth` + weekday offset to compute the visible grid, not necessarily 1:1 with `dayNumber`. Ensure you compute `dayNumber = calendarDate - batchStartDate + 1` correctly.

---

### Item 10 — Guard Against Submitting Future Days

**Problem:** `submitDayHandler` has no check that `dayNumber <= daysElapsed`. A user could POST to `/api/user-batch/30/submit` on Day 1.

**Files to change:**
- `tbt-admin/backend/src/modules/user-batch/controller.ts` — `submitDayHandler`

**Change description:**

After fetching `member.batchId`, also fetch `batch.startsAt`:
```typescript
const batch = await req.server.prisma.batch.findUnique({
  where: { id: member.batchId },
  select: { startsAt: true },
});

const daysElapsed = Math.floor(
  (Date.now() - new Date(batch!.startsAt).getTime()) / 86_400_000
);

if (dayNum > daysElapsed + 1) {
  return reply.status(400).send({
    success: false,
    data: null,
    error: `Day ${dayNum} is not available yet`,
  });
}
```

> Allow `daysElapsed + 1` as a 1-day buffer (submit today even if the clock edge is tight).

Apply the same guard in `saveDraftHandler` as well so drafts cannot be created for future days.

---

### Item 11 — Auto-Mark Attendance on Draft Save

**Problem:** Attendance is only auto-recorded when a member clicks "Submit for Review". If a member saves a draft but never submits, they are marked absent even though they engaged.

**Files to change:**
- `tbt-admin/backend/src/modules/user-batch/controller.ts` — `saveDraftHandler`

**Change description:**

At the end of `saveDraftHandler` (after the `taskProofs` raw update), add the same attendance upsert logic that exists in `submitDayHandler`:

```typescript
// Auto-mark attendance as present on draft save (only if not already recorded)
const onBreak = await req.server.prisma.$queryRawUnsafe<any[]>(
  `SELECT id FROM batch_break_requests WHERE batch_id=$1 AND member_id=$2 AND status='approved' AND start_day<=$3 AND end_day>=$3 LIMIT 1`,
  member.batchId, memberId, dayNum,
);
await req.server.prisma.$executeRawUnsafe(
  `INSERT INTO member_attendance (member_id, batch_id, day_number, status, marked_at, updated_at)
   VALUES ($1,$2,$3,$4,NOW(),NOW())
   ON CONFLICT (member_id, batch_id, day_number) DO NOTHING`,
  memberId, member.batchId, dayNum, onBreak.length > 0 ? 'break' : 'present',
);
```

Use `ON CONFLICT DO NOTHING` so this never overwrites an existing "absent" record that was manually set by admin.

---

### Item 12 — Extend Days UI in Admin MemberTimelineDrawer

**Problem:** `upsertMemberSettingsHandler` and `useUpsertMemberBatchSettings` hook exist and work, but there is **no UI** anywhere in the admin panel that calls them. Extended days can only be set via raw API call.

**Files to change:**
- `tbt-admin/admin-panel/app/batches/[id]/page.tsx` — `MemberTimelineDrawer` component (lines 423–521)

**Change description:**

At the bottom of `MemberTimelineDrawer`, add an "Extend Days" collapsible section:

```
┌─────────────────────────────────────────────────────┐
│  Extended Days                              [Edit]  │
│  Current: +3 days  (Total: 93 days)                │
│                                                     │
│  [when editing]                                     │
│  Add Grace Days: [____]  Note: [__________]        │
│                                      [Save] [Cancel]│
└─────────────────────────────────────────────────────┘
```

- Show current `extendedDays` from `getMemberProgress` response
- "Edit" button toggles an inline form with:
  - Number input `extendedDays` (min 0, max 30)
  - Optional text input `notes`
- On "Save": call `useUpsertMemberBatchSettings({ batchId, memberId, extendedDays, notes })`
- On success: invalidate `['batch-member-progress', batchId, memberId]` and `['batch-progress', batchId]`
- Show toast: "Extended by N days"

**Hook already exists** (`useUpsertMemberBatchSettings` in `useTbt.ts`) — no new hook needed.

---

---

## P2 — Medium

---

### Item 13 — Break Request: Date Range Picker

**Problem:** The "Request Break" modal asks for `startDay` and `endDay` as integer inputs. Users don't know what day number "10" corresponds to in calendar terms.

**Files to change:**
- `tbt-user-web/app/(platform)/batch-program/page.tsx` — BreakRequestModal section

**Change description:**

Replace the two number inputs with two `<input type="date">` fields (or a lightweight date-range UI using native inputs):

- **Start Date** input: `min = batch.startsAt`, `max = batch.endsAt ?? (startsAt + totalDays days)`
- **End Date** input: `min = startDate`, `max = same as above`

On submit, compute day numbers from dates:
```typescript
const startDay = Math.ceil((new Date(startDate).getTime() - new Date(batch.startsAt).getTime()) / 86_400_000) + 1;
const endDay   = Math.ceil((new Date(endDate).getTime()  - new Date(batch.startsAt).getTime()) / 86_400_000) + 1;
```

Send the computed `startDay` and `endDay` to the existing `POST /api/user-batch/break` endpoint — no backend change needed.

**Client-side validation:**
- `startDay >= 1` and `endDay <= totalDays`
- `startDay <= endDay`
- End date ≥ Start date (native browser enforcement)
- Show computed day range text below: "Days 10–15 of your batch"

---

### Item 14 — Break Dates as Calendar Range in Admin Breaks Tab

**Problem:** Admin sees "Start Day: 10, End Day: 15" without knowing what dates those are.

**Files to change:**
- `tbt-admin/admin-panel/app/batches/[id]/page.tsx` — Breaks tab table

**Change description:**

In the Breaks tab, the batch `startsAt` is already available from the `useGetBatch` hook response. Compute and display the calendar date range alongside day numbers:

```typescript
const dayToDate = (batchStartsAt: string, dayNumber: number) => {
  const d = new Date(batchStartsAt);
  d.setDate(d.getDate() + dayNumber - 1);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};
```

Render in the table cell:
```
Days 10–15
Jul 14 – Jul 19
```

No backend change needed.

---

### Item 15 — Current Submit Streak on Overview Page

**Problem:** The overview stats show approved count and attendance rate but not momentum (consecutive days submitted/approved).

**Files to change:**
- `tbt-user-web/app/(platform)/batch-program/page.tsx`

**Change description:**

Compute a submit streak locally from the `progress` array returned by `useMyBatchProgram`:

```typescript
const submitStreak = useMemo(() => {
  let streak = 0;
  // Walk backwards from today's day
  for (let day = daysElapsed; day >= 1; day--) {
    const p = progressMap[day]; // progressMap = Map<dayNumber, MemberDayProgress>
    if (p && ['pending_approval', 'approved'].includes(p.status)) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}, [progress, daysElapsed]);
```

Add a stat card to the existing stats row:
- Label: "Current Streak" (from uiStrings or static — check if `batchStreakLabel` exists; if not use hardcoded for now and add to uiStrings later)
- Value: `{submitStreak} days`
- Icon: flame SVG in accent color

Show 0 if no submissions yet. Show a special treatment (gold border) if streak ≥ 7.

---

### Item 16 — Per-Day Approval Rate Analytics

**Problem:** Admins can see overall stats and per-member breakdown but not which days have low approval rates — a leading indicator of which content is too hard or unclear.

#### Backend

**Files to change:**
- `tbt-admin/backend/src/modules/batches/controller.ts` — add `getDayAnalyticsHandler`
- `tbt-admin/backend/src/modules/batches/routes.ts` — add route

**New handler:**
```typescript
export async function getDayAnalyticsHandler(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const rows = await req.server.prisma.$queryRawUnsafe<any[]>(
    `SELECT
       day_number,
       COUNT(*) FILTER (WHERE status = 'approved')        AS approved,
       COUNT(*) FILTER (WHERE status = 'rejected')        AS rejected,
       COUNT(*) FILTER (WHERE status = 'pending_approval') AS pending,
       COUNT(*) FILTER (WHERE status = 'in_progress')     AS in_progress,
       COUNT(*)                                            AS total
     FROM member_day_progress
     WHERE batch_id = $1
     GROUP BY day_number
     ORDER BY day_number ASC`,
    req.params.id,
  );
  // Compute approval rate per day
  const data = rows.map(r => ({
    dayNumber: Number(r.day_number),
    approved: Number(r.approved),
    rejected: Number(r.rejected),
    pending: Number(r.pending),
    inProgress: Number(r.in_progress),
    total: Number(r.total),
    approvalRate: r.total > 0 ? Math.round((Number(r.approved) / Number(r.total)) * 100) : 0,
  }));
  return reply.send({ success: true, data, error: null });
}
```

**New route:**
```typescript
fastify.get('/:id/day-analytics', { preHandler: [fastify.authenticate] }, getDayAnalyticsHandler);
```

#### Admin Panel

**New hook** (`useTbt.ts`):
```typescript
export const useBatchDayAnalytics = (batchId: string) =>
  useQuery({
    queryKey: ['batch-day-analytics', batchId],
    queryFn: () => apiClient.get(`/api/batches/${batchId}/day-analytics`),
    enabled: !!batchId,
    staleTime: 5 * 60 * 1000,
  });
```

**Overview tab addition** (`batches/[id]/page.tsx`):

Add a "Day-by-Day Completion" section below the existing stats cards. Render a simple horizontal bar chart using only divs (no chart library — keep it consistent with the rest of the admin UI):

```
Day 1   ████████████████████ 92%
Day 2   ██████████████████   84%
Day 3   ████████████         56%   ← low approval
Day 4   ██████████████████   82%
...
```

Each bar:
- Width: `${approvalRate}%` of container
- Color: green if ≥ 70%, amber if 40–69%, red if < 40%
- Show: `Day N  [bar]  N%  (approved/total)`

Cap display to days where `total > 0` (skip unconfigured future days).

---

### Item 17 — Empty State When Member Has No Batch

**Problem:** If a member is not assigned to a batch, the page shows a text string from `uiStrings.batchNotAssignedMsg` but no meaningful empty state with guidance.

**Files to change:**
- `tbt-user-web/app/(platform)/batch-program/page.tsx`

**Change description:**

When `data === null` (API returns `data: null`), render a full empty state:

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│              📋  (icon, 48px)                       │
│                                                     │
│         You're not enrolled in a batch yet          │
│                                                     │
│   [batchNotAssignedMsg from uiStrings]              │
│                                                     │
│   [Message Support]                                 │
│                                                     │
└─────────────────────────────────────────────────────┘
```

- "Message Support" button: links to `/messages` (existing messages feature)
- Icon: SVG clipboard or calendar (inline SVG, no icon library import)
- Use existing uiStrings for the message text

---

### Item 18 — Resource URL Inline Embed

**Problem:** The day detail page shows a resource link that opens in a new tab. If it's a YouTube/Vimeo video, the user leaves the task context.

**Files to change:**
- `tbt-user-web/app/(platform)/batch-program/[day]/page.tsx`

**Change description:**

Add a `getEmbedUrl(url: string): string | null` helper:

```typescript
function getEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    // YouTube
    if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) {
      const vid = u.searchParams.get('v') ?? u.pathname.split('/').pop();
      return vid ? `https://www.youtube.com/embed/${vid}` : null;
    }
    // Vimeo
    if (u.hostname.includes('vimeo.com')) {
      const vid = u.pathname.split('/').filter(Boolean).pop();
      return vid ? `https://player.vimeo.com/video/${vid}` : null;
    }
    return null;
  } catch {
    return null;
  }
}
```

In the resource section:
- If `getEmbedUrl(day.resourceUrl)` returns a URL: render an `<iframe>` (16:9 aspect ratio, `rounded-lg`, `border-0`, width 100%)
- Else: render the existing external link button

**Security:** Set `sandbox="allow-scripts allow-same-origin allow-presentation"` on the iframe for YouTube/Vimeo. Do not render iframes for arbitrary URLs — only whitelist YouTube and Vimeo patterns.

---

### Item 19 — Manage Members Modal: Show Current Batch Warning

**Problem:** When searching for members to add to a batch, the modal doesn't show if a member is already in a different batch. Assigning them silently overrides their current batch with no warning.

**Files to change:**
- `tbt-admin/admin-panel/app/batches/page.tsx` — Manage Members modal

**Change description:**

The member search results from `useListMembers` already include `batchId` on each member object (since it's in the Prisma `select` for members). The batch list from `useListBatches` gives us the name lookup.

Changes:
1. In the Manage Members modal, build a `batchNameMap: Record<string, string>` from `useListBatches()` data (`{ [batch.id]: batch.name }`)
2. For each member in search results, if `member.batchId && member.batchId !== currentBatchId`, show a chip: `Currently in: [Batch Name]` in amber
3. When clicking "Add" on such a member, show a `window.confirm` (or an inline confirmation row): "This will move [Name] from [Old Batch] to [New Batch]. Confirm?"
4. Only proceed with `useUpdateMember({ batchId: newBatchId })` after confirmation

**No backend change needed.**

---

### Item 20 — Progress Grid Filter Toolbar + Week Grouping

**Problem:** The members × days matrix is unreadable at scale (50 members × 90 days = 4,500 cells).

**Files to change:**
- `tbt-admin/admin-panel/app/batches/[id]/page.tsx` — Progress tab

**Change description:**

Add a filter/view toolbar above the grid:

```
[Filter: All ▼]  [View: Days | Weeks]  [Show: All members | Behind only | Pending today]
```

**Filter: Show options**
- "All members" (default)
- "Behind only" — filter to members where `approvedCount < daysElapsed - 2`
- "Pending today" — filter to members who have a `pending_approval` record for today's day

**View: Days vs Weeks**
- "Days" (default): current behavior
- "Weeks": group 7 day-columns under a "Week 1", "Week 2" … header, show a single aggregate cell per week per member. Cell color = worst status in that week (red > amber > green)

**Implementation note:** Week grouping is client-side only — the data is the same. Group columns:
```typescript
const weeks = Array.from({ length: Math.ceil(totalDays / 7) }, (_, i) => ({
  label: `W${i + 1}`,
  days: Array.from({ length: 7 }, (_, j) => i * 7 + j + 1).filter(d => d <= totalDays),
}));
```

**No backend change needed.**

---

---

## P3 — Nice to Have

---

### Item 21 — Clone Batch

**Problem:** No way to reuse a batch's 90-day program for a new cohort. All day content must be re-entered manually.

#### Backend

**Files to change:**
- `tbt-admin/backend/src/modules/batches/controller.ts` — add `cloneBatchHandler`
- `tbt-admin/backend/src/modules/batches/routes.ts` — add route

**New handler:**
```typescript
export async function cloneBatchHandler(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const schema = z.object({
    name: z.string().min(1),
    startsAt: z.string().min(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return reply.status(400).send({ ... });

  // Fetch source batch + days
  const source = await req.server.prisma.batch.findUnique({
    where: { id: req.params.id },
    include: { days: { orderBy: { dayNumber: 'asc' } } },
  });
  if (!source) return reply.status(404).send({ ... });

  // Create new batch
  const newBatch = await req.server.prisma.batch.create({
    data: {
      name: parsed.data.name,
      description: source.description,
      programId: source.programId,
      startsAt: new Date(parsed.data.startsAt),
      endsAt: null, // let admin set end date
      isActive: false, // start inactive
    },
  });

  // Clone all days
  if (source.days.length > 0) {
    await req.server.prisma.batchDay.createMany({
      data: source.days.map(d => ({
        batchId: newBatch.id,
        dayNumber: d.dayNumber,
        title: d.title,
        notes: d.notes,
        resourceUrl: d.resourceUrl,
        category: d.category,
        tasks: d.tasks,
      })),
    });
  }

  return reply.status(201).send({ success: true, data: newBatch, error: null });
}
```

**New route:**
```typescript
fastify.post('/:id/clone', { preHandler: [fastify.authenticate] }, cloneBatchHandler);
```

#### Admin Panel

**New hook** (`useTbt.ts`):
```typescript
export const useCloneBatch = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name, startsAt }: { id: string; name: string; startsAt: string }) =>
      apiClient.post(`/api/batches/${id}/clone`, { name, startsAt }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['batches'] }),
  });
};
```

**Batch list page:** Add a "Clone" icon button on each batch card. Clicking it opens a small modal:
- "New Batch Name" text input (pre-filled with "Copy of [source name]")
- "Start Date" date input
- [Clone Batch] button

---

### Item 22 — Batch Completion Badge + Certificate

**Problem:** Completing all 90 days has no special reward. The course platform awards badges and certificates; batch completion should too.

#### Backend

**Files to change:**
- `tbt-admin/backend/src/modules/user-batch/controller.ts` — `approveDayHandler`

**Change description:**

In `approveDayHandler`, after awarding XP, check if this approval brings the member to full completion:

```typescript
// Check if member just completed the full batch
const approvedCount = await req.server.prisma.memberDayProgress.count({
  where: { batchId: req.params.id, memberId: req.params.memberId, status: 'approved' },
});

const batchSettings = await req.server.prisma.$queryRawUnsafe<any[]>(
  `SELECT extended_days FROM member_batch_settings WHERE batch_id=$1 AND member_id=$2 LIMIT 1`,
  req.params.id, req.params.memberId,
);
const batch = await req.server.prisma.batch.findUnique({
  where: { id: req.params.id },
  select: { program: { select: { durationDays: true } } },
});
const totalDays = (batch?.program?.durationDays ?? 90) + ((batchSettings[0] as any)?.extended_days ?? 0);

if (approvedCount >= totalDays) {
  // Emit completion event
  req.server.io.to(`user:${req.params.memberId}`).emit('batch:completed', {
    batchId: req.params.id,
    totalDays,
  });
  // Create push notification
  req.server.prisma.appNotification.create({
    data: {
      memberId: req.params.memberId,
      title: `Batch Complete! 🏆`,
      body: `You completed all ${totalDays} days. Your certificate is ready.`,
      type: 'batch_completed',
      referenceId: req.params.id,
      referenceType: 'batch',
    },
  }).catch(() => {});
  // Award bonus XP
  req.server.prisma.pointsLedger.create({
    data: {
      memberId: req.params.memberId,
      points: 500,
      reason: `Batch completion bonus`,
      referenceType: 'batch',
      referenceId: req.params.id,
    },
  }).catch(() => {});
}
```

**Certificate generation:** Add a new endpoint `GET /api/user-batch/certificate` that:
- Verifies all days approved for the member's batch
- Generates a PDF via `pdfkit` (same pattern as course certificates)
- Returns the PDF as a response (`Content-Type: application/pdf`) or uploads to R2 and returns a URL

#### User Web

Add a "Download Certificate" button on the `/batch-program` overview page that appears only when `approvedCount >= totalDays`. Calls `GET /api/user-batch/certificate`.

---

### Item 23 — Daily Reminder Cron

**Problem:** No automated reminder for members who haven't submitted their current day's task.

**Files to change:**
- `tbt-admin/backend/src/modules/user-batch/routes.ts` — add cron route
- `tbt-admin/backend/src/modules/user-batch/controller.ts` — add `batchReminderCronHandler`

**New handler:**
```typescript
export async function batchReminderCronHandler(req: FastifyRequest, reply: FastifyReply) {
  // Cron secret check (same pattern as /api/workshops/cron/generate-recurring)
  if (req.headers['x-cron-secret'] !== process.env.CRON_SECRET) {
    return reply.status(401).send({ success: false, data: null, error: 'Unauthorized' });
  }

  const today = new Date();
  const activeBatches = await req.server.prisma.batch.findMany({
    where: { isActive: true },
    select: { id: true, startsAt: true, members: { select: { id: true, firstName: true, phone: true } } },
  });

  let notified = 0;
  for (const batch of activeBatches) {
    const daysElapsed = Math.floor(
      (today.getTime() - new Date(batch.startsAt).getTime()) / 86_400_000
    ) + 1;
    if (daysElapsed < 1) continue;

    for (const member of batch.members) {
      // Check if today's day is submitted
      const progress = await req.server.prisma.memberDayProgress.findUnique({
        where: { batchId_memberId_dayNumber: { batchId: batch.id, memberId: member.id, dayNumber: daysElapsed } },
        select: { status: true },
      });
      const needsReminder = !progress || ['not_started', 'in_progress'].includes(progress.status ?? 'not_started');

      if (needsReminder && member.phone) {
        // Send WhatsApp/SMS reminder via Twilio or the existing notification system
        // Pattern: same as WhatsApp OTP in user-auth module
        notified++;
        // Non-blocking fire-and-forget
      }
    }
  }

  return reply.send({ success: true, data: { notified }, error: null });
}
```

**New route:**
```typescript
fastify.post('/cron/batch-reminder', batchReminderCronHandler);
// Note: No auth middleware — protected by x-cron-secret header instead
```

**Cron schedule:** Add to Vercel cron config or Cloud Run scheduled job:
- Schedule: `0 20 * * *` (8 PM IST = 14:30 UTC)
- Endpoint: `POST https://backend-url/api/user-batch/cron/batch-reminder`
- Header: `x-cron-secret: <CRON_SECRET>`

---

### Item 24 — At-Risk Members in Admin Overview Tab

**Problem:** Admins see "Behind: N members" count but no list of who they are or how far behind.

**Files to change:**
- `tbt-admin/admin-panel/app/batches/[id]/page.tsx` — Overview tab

**Change description:**

The Overview tab already has `daysElapsed` computed and the member progress data from `useGetBatchProgress`. Add an "At Risk" section below the stat cards:

```
┌─────────────────────────────────────────────────────┐
│  ⚠  At Risk Members  (5 behind by 5+ days)         │
│─────────────────────────────────────────────────────│
│  Priya K.   Day 3 of 18   15 days behind   [View]  │
│  Rajan M.   Day 6 of 18   12 days behind   [View]  │
└─────────────────────────────────────────────────────┘
```

**Logic:**
```typescript
const atRisk = members
  .map(m => {
    const approved = progress.filter(p => p.memberId === m.id && p.status === 'approved').length;
    const behind = daysElapsed - approved;
    return { ...m, approved, behind };
  })
  .filter(m => m.behind >= 5)  // 5+ days behind threshold
  .sort((a, b) => b.behind - a.behind);
```

"View" button opens `MemberTimelineDrawer` for that member.

Show section only when `atRisk.length > 0`. If all members are on track, show a green "All members on track" message instead.

**No backend change needed** — data already returned by `useGetBatchProgress`.

---

### Item 25 — Configurable XP Per Day Per Batch

**Problem:** `approveDayHandler` always awards 50 XP regardless of batch program difficulty.

#### Backend

**Files to change:**
- `tbt-admin/backend/src/plugins/prisma.ts` — add startup `ALTER TABLE` for `xp_per_day`
- `tbt-admin/backend/src/modules/batches/schema.ts` — add `xpPerDay` to create/update schemas
- `tbt-admin/backend/src/modules/batches/controller.ts` — read `xp_per_day` in `createBatchHandler`, `updateBatchHandler`, `getBatchHandler`
- `tbt-admin/backend/src/modules/user-batch/controller.ts` — `approveDayHandler` reads `batch.xpPerDay`

**Startup migration** (`prisma.ts`):
```typescript
await prisma.$executeRawUnsafe(
  `ALTER TABLE batches ADD COLUMN IF NOT EXISTS xp_per_day INT DEFAULT 50`
);
```

**Schema change** (`schema.ts`):
```typescript
export const createBatchSchema = z.object({
  // ... existing fields ...
  xpPerDay: z.number().int().min(0).max(500).default(50).optional(),
});
```

**`approveDayHandler` change:**
Fetch `batch.xpPerDay` before awarding XP:
```typescript
const batch = await req.server.prisma.$queryRawUnsafe<any[]>(
  `SELECT xp_per_day FROM batches WHERE id=$1 LIMIT 1`, req.params.id,
);
const xpAmount = (batch[0] as any)?.xp_per_day ?? 50;
// Use xpAmount instead of hardcoded 50 in pointsLedger.create and socket emit
```

#### Admin Panel

**Create/Edit Batch modal** (`batches/page.tsx`):
Add a "XP Per Day" number input (default 50, min 0, max 500) to the batch create/edit form.

---

---

## Cross-Cutting Implementation Notes

### New uiStrings needed

The following keys should be added to the `UiStrings` backend API (`GET /api/pub/config/ui-strings`) and the UI-strings admin page for the user-web items:

| Key | Default value |
|-----|---------------|
| `batchRevisionFeedbackLabel` | "Revision Requested" |
| `batchStreakLabel` | "Current Streak" |
| `batchStreakUnit` | "days" |
| `batchNoAssignedCta` | "Message Support" |
| `batchTodayShortcutLabel` | "Continue Today" |
| `batchCertificateLabel` | "Download Certificate" |
| `batchCompletedMsg` | "Congratulations! You completed the full batch." |

Add these to:
1. `tbt-admin/backend/src/modules/config/controller.ts` — `getUiStringsHandler` default object
2. `tbt-admin/admin-panel/app/site-config/page.tsx` — UI strings editor section
3. `tbt-user-web/types/index.ts` — `UiStrings` interface

---

### New `batch-proofs` R2 Bucket

For Item 7 (task proof uploads), add `'batch-proofs'` to the allowed bucket list in the upload module. Check `tbt-admin/backend/src/modules/upload/controller.ts` for where bucket names are validated — add `'batch-proofs'` to that allowlist.

---

### Socket Events Summary

| Event | Direction | Payload | When |
|-------|-----------|---------|------|
| `batch:day_approved` | Server → `user:{id}` | `{ dayNumber, batchId, xpAwarded }` | Already exists — needs frontend listener |
| `batch:day_rejected` | Server → `user:{id}` | `{ dayNumber, batchId, reviewNote }` | Already exists — needs frontend listener |
| `batch:completed` | Server → `user:{id}` | `{ batchId, totalDays }` | New — Item 22 |
| `admin:day_submitted` | Server → `admin` room | `{ memberId, memberName, batchId, dayNumber }` | Already exists |

---

### Implementation Order (Recommended)

Start with items that unblock each other or share a file touch:

**Sprint 1 (P0 — 1–2 days):**
Items 2, 3, 1, 4, 5

**Sprint 2 (P1 — 3–4 days):**
Items 10, 11, 6, 7, 12, 8, 9

**Sprint 3 (P2 — 3–4 days):**
Items 13, 14, 15, 17, 18, 19, 20, 16

**Sprint 4 (P3 — 2–3 days):**
Items 21, 24, 25, 22, 23

---

*Spec prepared: 2026-06-30. All file paths relative to `F:\admin`.*
