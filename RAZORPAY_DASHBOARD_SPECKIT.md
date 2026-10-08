# RAZORPAY_DASHBOARD_SPECKIT.md

Standalone Razorpay dashboard and control panel for the TBT admin application.

---

## Current state (what already exists — do NOT re-implement)

| Layer | What's live |
|---|---|
| DB | `course_payments` table — Prisma fields + raw-SQL columns: `razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature` |
| Enums | `CoursePaymentMethod`: `manual \| razorpay \| bank_transfer \| upi \| free \| external`; `CoursePaymentStatus`: `pending \| completed \| refunded \| failed` |
| Backend (admin) | `GET /api/courses/payments` (list + revenue sum, filterable); `POST /api/courses/:id/payments/:paymentId/approve`; `POST /api/courses/:id/payments/:paymentId/refund` (calls Razorpay SDK + marks refunded + revokes access) |
| Backend (user) | `POST /api/user/courses/:id/razorpay/create-order`; `POST /api/user/courses/:id/razorpay/verify` |
| Webhook | `POST /api/user/courses/razorpay/webhook` — already handles `payment.captured` (auto-grants access) and `payment.failed` (marks failed). **Missing: `refund.processed`** |
| Lib | `lib/razorpay.ts` — singleton SDK client, `verifyPaymentSignature`, `verifyWebhookSignature` |
| Lib | `lib/coursePaymentGrant.ts` — shared grant logic (mark completed, upsert access + enrollment, socket emit, admin notification) |
| Admin UI | Payments buried inside Courses page per-course Payments sub-tab only |

**Key gaps:** no standalone admin page, no analytics endpoint, no refund ID/amount stored, no live Razorpay status sync, no partial refund support.

---

## Items

### RZ-01 — DB: add refund-tracking columns

**File:** `tbt-admin/backend/src/plugins/prisma.ts` startup block

Add three idempotent `ALTER TABLE` statements after the existing `razorpay_signature` ALTER:

```sql
ALTER TABLE course_payments ADD COLUMN IF NOT EXISTS razorpay_refund_id  TEXT;
ALTER TABLE course_payments ADD COLUMN IF NOT EXISTS refunded_amount     DECIMAL(10,2);
ALTER TABLE course_payments ADD COLUMN IF NOT EXISTS refund_note         TEXT;
```

- `razorpay_refund_id` — Razorpay's refund object ID (e.g. `rfnd_xxx`). Set when a Razorpay refund is initiated (either by admin or confirmed by `refund.processed` webhook).
- `refunded_amount` — actual amount refunded in INR (supports partial). `NULL` until a refund occurs.
- `refund_note` — optional admin note recorded at refund time.

No Prisma migration needed — raw SQL only (same pattern as existing columns).

---

### RZ-02 — Backend: new `payments` module

**New files:**
- `tbt-admin/backend/src/modules/payments/controller.ts`
- `tbt-admin/backend/src/modules/payments/routes.ts`

**Register** in `backend/src/server.ts`:
```typescript
import { paymentRoutes } from './modules/payments/routes.js';
// ...
fastify.register(paymentRoutes, { prefix: '/api/payments' });
```
Place it after `/api/courses` in the route registration list. All routes use `fastify.authenticate` (Clerk — admin only).

#### RZ-02-A `GET /api/payments/stats`

Returns four aggregate numbers. No query params.

```typescript
// Response shape
{
  totalRevenue: number,          // SUM(amount) WHERE status='completed'
  pendingCount: number,          // COUNT WHERE status='pending'
  refundedTotal: number,         // SUM(amount) WHERE status='refunded'
  thisMonthRevenue: number,      // SUM(amount) WHERE status='completed' AND created_at >= first day of current month
  razorpayRevenue: number,       // SUM(amount) WHERE status='completed' AND method='razorpay'
  manualRevenue: number,         // SUM(amount) WHERE status='completed' AND method IN ('manual','bank_transfer','upi')
  failedCount: number,           // COUNT WHERE status='failed'
}
```

Single raw SQL query with conditional aggregates for performance.

#### RZ-02-B `GET /api/payments/list`

Query params: `page` (default 1), `limit` (default 25), `method`, `status`, `courseId`, `memberId`, `dateFrom` (ISO), `dateTo` (ISO), `search` (member name / email).

Returns paginated `course_payments` rows joined with member + course. Also merges `razorpay_order_id`, `razorpay_payment_id`, `razorpay_refund_id`, `refunded_amount`, `refund_note` from raw SQL columns.

```typescript
// Each row shape
{
  id, amount, currency, method, status,
  reference, notes, paidAt, createdAt, updatedAt,
  razorpayOrderId, razorpayPaymentId, razorpayRefundId,
  refundedAmount, refundNote,
  member: { id, firstName, lastName, email, phone },
  course: { id, title },
}
```

Meta: `{ total, page, limit, totalRevenue }` (totalRevenue = completed rows matching filters).

This endpoint is intentionally separate from `GET /api/courses/payments` (which is scoped per-course). This one is the global view.

#### RZ-02-C `GET /api/payments/analytics`

Query params: `days` (default 30, max 365), `groupBy` (`day` | `month`, default `day`).

Returns time-series revenue data for the chart.

```typescript
// Response
{
  series: Array<{
    date: string,          // 'YYYY-MM-DD' (day) or 'YYYY-MM' (month)
    total: number,         // all completed payments
    razorpay: number,
    manual: number,        // manual + bank_transfer + upi
  }>,
  summary: {
    totalRevenue: number,
    razorpayRevenue: number,
    manualRevenue: number,
    growthPercent: number,  // (current period / prior period - 1) * 100, null if no prior data
  }
}
```

Use a single `generate_series` + `LEFT JOIN` raw SQL query — do not loop N DB calls.

#### RZ-02-D `GET /api/payments/:paymentId/razorpay-sync`

Fetches live payment data from the Razorpay API for a single payment record.

- Lookup `course_payments` by `paymentId` — 404 if not found.
- If `method !== 'razorpay'` or `razorpay_payment_id IS NULL` — return `{ synced: false, reason: 'not_razorpay' }`.
- Call `getRazorpay().payments.fetch(razorpayPaymentId)`.
- Return the live Razorpay status alongside the DB row's current status so the admin can see any mismatch.
- **Do not auto-update the DB status** — this is a read-only sync for display. Admin can trigger approve/refund from the UI if needed.

```typescript
// Response
{
  synced: true,
  razorpayStatus: string,        // 'captured' | 'authorized' | 'failed' | 'refunded'
  razorpayAmount: number,        // in paise
  razorpayMethod: string,        // 'card' | 'netbanking' | 'upi' | 'wallet' etc.
  razorpayCreatedAt: string,     // ISO
  razorpayRefundStatus: string,  // 'null' | 'partial' | 'full'
  dbStatus: string,              // current status in our DB
  mismatch: boolean,             // razorpayStatus doesn't match dbStatus
}
```

Wrap the Razorpay SDK call in try/catch — return 502 with the Razorpay error message if the API call fails.

#### RZ-02-E `POST /api/payments/:paymentId/approve`

Proxy wrapper around the existing `approveCoursePaymentHandler` logic — eliminates the need for the caller to know the `courseId`.

- Lookup `course_payments` by `paymentId` to get `courseId`.
- Run the same approval flow: update status to `completed`, upsert `CourseAccess` + `CourseEnrollment`, emit socket + notification.
- Reuse `coursePaymentGrant.ts` where possible.

#### RZ-02-F `POST /api/payments/:paymentId/refund`

Extended version of the existing refund handler with partial refund support.

Request body:
```typescript
{
  amount?: number,    // INR. If omitted → full refund. Must be <= original payment amount.
  note?: string,      // stored as refund_note
  speed?: 'normal' | 'optimum',  // default 'normal'
}
```

- Lookup payment — 404 if not found, 409 if `status !== 'completed'`.
- If `method === 'razorpay'` and `razorpay_payment_id` is set: call `getRazorpay().payments.refund(razorpayPaymentId, { amount: Math.round(refundAmount * 100), speed, notes })`.
- On Razorpay success: capture the refund ID from the response (`rzpRefund.id`).
- Update DB: `SET status='refunded', razorpay_refund_id=$1, refunded_amount=$2, refund_note=$3, updated_at=NOW()`.
- Revoke `CourseAccess` (same as existing handler).
- If `method !== 'razorpay'`: skip Razorpay call, still update DB + revoke access.
- Return `{ refunded: true, razorpayRefundId, refundedAmount }`.

---

### RZ-03 — Backend: webhook — add `refund.processed` and `refund.failed`

**File:** `tbt-admin/backend/src/modules/user/controller.ts` — `razorpayWebhookHandler`

After the existing `payment.captured` block, add two more event handlers:

#### `refund.processed`
```typescript
if (body.event === 'refund.processed') {
  const entity = body?.payload?.refund?.entity;
  const rzpPaymentId: string = entity?.payment_id;
  const rzpRefundId: string = entity?.id;
  const refundedAmountPaise: number = entity?.amount ?? 0;

  if (rzpPaymentId && rzpRefundId) {
    await request.server.prisma.$executeRawUnsafe(
      `UPDATE course_payments
       SET status='refunded', razorpay_refund_id=$1, refunded_amount=$2, updated_at=NOW()
       WHERE razorpay_payment_id=$3 AND method='razorpay'`,
      rzpRefundId,
      (refundedAmountPaise / 100).toFixed(2),
      rzpPaymentId,
    ).catch(() => {});
  }
  return reply.send({ ok: true });
}
```

#### `refund.failed`
```typescript
if (body.event === 'refund.failed') {
  // Best-effort admin notification only — do not change payment status
  const entity = body?.payload?.refund?.entity;
  void createAdminNotification(request.server.prisma, {
    title: 'Razorpay Refund Failed',
    body: `Refund for payment ${entity?.payment_id ?? 'unknown'} failed on Razorpay. Check the Razorpay dashboard.`,
    type: 'course_access_request',
    metadata: { paymentId: entity?.payment_id, refundId: entity?.id },
  }).catch(() => {});
  return reply.send({ ok: true });
}
```

Import `createAdminNotification` at the top of the file (already imported elsewhere in the module).

---

### RZ-04 — Admin panel: TanStack Query hooks

**File:** `tbt-admin/admin-panel/lib/hooks/useTbt.ts` — add to bottom

```typescript
// ── Razorpay / Payments dashboard ────────────────────────────────────────────

export function usePaymentStats() {
  return useQuery({
    queryKey: ['payments', 'stats'],
    queryFn: () => apiClient.get('/api/payments/stats').then(r => r.data),
    staleTime: 60_000,
  });
}

export function usePaymentList(params: {
  page?: number; limit?: number; method?: string; status?: string;
  courseId?: string; memberId?: string; dateFrom?: string; dateTo?: string; search?: string;
}) {
  return useQuery({
    queryKey: ['payments', 'list', params],
    queryFn: () => apiClient.get('/api/payments/list', { params }).then(r => r.data),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

export function usePaymentAnalytics(days: number = 30, groupBy: 'day' | 'month' = 'day') {
  return useQuery({
    queryKey: ['payments', 'analytics', days, groupBy],
    queryFn: () => apiClient.get('/api/payments/analytics', { params: { days, groupBy } }).then(r => r.data),
    staleTime: 300_000,
  });
}

export function useSyncRazorpayPayment() {
  return useMutation({
    mutationFn: (paymentId: string) =>
      apiClient.get(`/api/payments/${paymentId}/razorpay-sync`).then(r => r.data),
  });
}

export function useApprovePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (paymentId: string) =>
      apiClient.post(`/api/payments/${paymentId}/approve`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments'] });
    },
  });
}

export function useRefundPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ paymentId, amount, note, speed }: {
      paymentId: string; amount?: number; note?: string; speed?: 'normal' | 'optimum';
    }) => apiClient.post(`/api/payments/${paymentId}/refund`, { amount, note, speed }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments'] });
    },
  });
}
```

---

### RZ-05 — Admin panel: `/payments` page

**New file:** `tbt-admin/admin-panel/app/payments/page.tsx`

`"use client"` page. Layout: `DashboardLayout` wraps everything automatically.

#### Section 1 — Stats row (always visible)

Four cards in a 4-column grid:

| Card | Value | Sub-label |
|---|---|---|
| Total Revenue | `₹{totalRevenue.toLocaleString('en-IN')}` | All time — completed |
| Razorpay Revenue | `₹{razorpayRevenue.toLocaleString('en-IN')}` | via Razorpay |
| Pending Approvals | `{pendingCount}` | Needs action |
| Refunds | `₹{refundedTotal.toLocaleString('en-IN')}` | Total refunded |

Each card follows the admin design system: `bg-[#181818] border border-[#2a2a2a] rounded-2xl p-5`. Accent icon top-left, large number, sub-label below. Skeleton while loading.

#### Section 2 — Revenue chart (recharts)

A responsive `AreaChart` (or `BarChart` for `groupBy=month`) below the stats row.

- Period selector: **7d / 30d / 90d / 12m** pill buttons. `30d` is default. Switching to `12m` flips `groupBy` to `month`.
- Three area series: `total` (accent colour), `razorpay` (blue `#60a5fa`), `manual` (muted `#a0a0a0`).
- Y-axis: `₹` formatted. X-axis: date labels. Tooltip shows all three values.
- Install `recharts` if not already present (`npm install recharts -w admin-panel`). Check first.

#### Section 3 — Payments table

Filters row:
- Search input (member name or email) — debounced 300 ms
- Status select: `All | Pending | Completed | Refunded | Failed`
- Method select: `All | Razorpay | Manual | Bank Transfer | UPI | Free | External`
- Date range: two `<input type="date">` (From / To)
- **Export CSV** button — top-right of filter row

Table columns:
| Column | Notes |
|---|---|
| Member | `firstName lastName` + email below in muted |
| Course | Course title |
| Amount | `₹X,XX,XXX` |
| Method | Pill badge — Razorpay = blue, manual = muted, upi = green, free = gray |
| Status | Pill badge — pending = amber, completed = green, refunded = gray, failed = red |
| Razorpay IDs | `razorpayPaymentId` (truncated, copyable on click). If null show `—` |
| Refund | `₹X` + refund ID if refunded. `—` otherwise. |
| Date | `createdAt` formatted `DD MMM YYYY` |
| Actions | See below |

**Per-row action buttons** (icon buttons, 28×28):
- **Approve** (green check icon) — shown only when `status === 'pending'`. Calls `useApprovePayment`. Shows spinner while mutating.
- **Refund** (arrow-return-left icon) — shown only when `status === 'completed'`. Opens `RefundModal`.
- **Sync** (refresh icon) — shown only when `method === 'razorpay'`. Calls `useSyncRazorpayPayment`. Opens `RazorpaySyncModal` with live data. Shows spinner while fetching.

Pagination: `Previous / Next` with page number display. 25 rows per page default.

#### Modal: `RefundModal`

Triggered by the Refund action button.

Fields:
- Amount (INR) — pre-filled with full payment amount. Editable for partial refunds. Must be `> 0` and `<= original amount`.
- Note (optional text) — stored as `refund_note`.
- Speed — radio: `Normal (3–5 days)` / `Optimum (instant, higher fee)`. Default: Normal.
- Non-Razorpay payments: amount + note only; no speed selector; warning text "This will mark the payment as refunded in TBT only — no actual payment gateway refund will be initiated."

Confirm button text: `Refund ₹{amount}`. Destructive styling (red). Disabled while mutating.

#### Modal: `RazorpaySyncModal`

Triggered by the Sync action button. Shows live data from Razorpay API.

Sections:
- **Live Razorpay Status** — large status badge
- **Details**: amount (paise → INR), method (card/UPI/etc.), captured at
- **Refund status**: `none | partial | full`
- **Mismatch warning** — amber banner if `mismatch === true`: "Our DB shows `{dbStatus}` but Razorpay shows `{razorpayStatus}`. Review and take action if needed."
- Close button only. No auto-update from this modal.

#### CSV export

Client-side: on button click, fetch all pages matching current filters (set `limit=9999`), then use a helper to build CSV from the response. Trigger browser download via `URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))`.

CSV columns: `id, member_name, member_email, course, amount, currency, method, status, razorpay_payment_id, razorpay_order_id, razorpay_refund_id, refunded_amount, created_at, paid_at`.

---

### RZ-06 — Admin panel: sidebar entry

**File:** `tbt-admin/admin-panel/components/Sidebar.tsx`

Add a "Payments" nav item pointing to `/payments`. Icon: `CreditCard` from lucide-react. Position: after "Courses" in the sidebar list. No sub-items.

---

## Implementation order

| Step | Item | Why first |
|---|---|---|
| 1 | RZ-01 | DB columns needed by everything else |
| 2 | RZ-03 | Webhook enhancement — pure backend, no deps |
| 3 | RZ-02-A, RZ-02-B, RZ-02-C | Stats + list + analytics endpoints |
| 4 | RZ-02-D | Sync endpoint (reads from Razorpay) |
| 5 | RZ-02-E, RZ-02-F | Approve + refund (uses new columns) |
| 6 | RZ-04 | Hooks (depends on backend being ready) |
| 7 | RZ-05 | Admin page (depends on hooks) |
| 8 | RZ-06 | Sidebar last — one-liner |

---

## Backend file map

| New/modified file | Purpose |
|---|---|
| `backend/src/plugins/prisma.ts` | RZ-01: 3 new ALTER TABLE statements |
| `backend/src/modules/payments/routes.ts` | RZ-02: new module, 6 routes |
| `backend/src/modules/payments/controller.ts` | RZ-02: handler functions |
| `backend/src/server.ts` | Register `/api/payments` module |
| `backend/src/modules/user/controller.ts` | RZ-03: 2 new webhook event blocks |

## Admin panel file map

| New/modified file | Purpose |
|---|---|
| `admin-panel/lib/hooks/useTbt.ts` | RZ-04: 6 new hooks |
| `admin-panel/app/payments/page.tsx` | RZ-05: full payments page |
| `admin-panel/components/Sidebar.tsx` | RZ-06: Payments nav entry |

---

## Env vars (no new ones needed)

All three Razorpay env vars already exist and are optional-flagged:
- `RAZORPAY_KEY_ID` — already used by SDK
- `RAZORPAY_KEY_SECRET` — already used by SDK
- `RAZORPAY_WEBHOOK_SECRET` — already used by webhook handler

The live-sync endpoint (`RZ-02-D`) calls `getRazorpay()` which will throw if `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` are not set — return a 503 with a clear "Razorpay not configured" message in that case.

---

## Webhook registration (manual step — not code)

The webhook endpoint is already live at:
```
POST https://tbt-backend-464464507912.asia-south1.run.app/api/user/courses/razorpay/webhook
```

After deploying RZ-03, go to the Razorpay dashboard → Webhooks and ensure these events are checked:
- `payment.captured` ✅ (already handled)
- `payment.failed` ✅ (already handled)
- `refund.processed` ← **add this after RZ-03 deploy**
- `refund.failed` ← **add this after RZ-03 deploy**

---

## Out of scope

- Razorpay subscription / recurring billing — TBT uses one-time course payments only
- Disputes / chargebacks — no Razorpay API support for this; handle via Razorpay dashboard directly
- Multi-currency — all payments are INR; currency column exists but is always `INR`
- Razorpay Payment Links — no current integration; keep out of scope
