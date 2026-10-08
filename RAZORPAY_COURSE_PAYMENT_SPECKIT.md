# RAZORPAY_COURSE_PAYMENT_SPECKIT.md

Razorpay in-app payment for course purchases — backend, user-web, Flutter, and admin panel.

**Status:** Draft — 2026-09-23  
**Scope:** Additive only. The existing manual/external payment flow (`paymentLinkUrl`, admin approval) is preserved unchanged. Razorpay is an additional fast path for courses that have a `price > 0`.

---

## 1. Goals

| # | Goal |
|---|------|
| G-1 | A member can pay for a course instantly inside the app (web and mobile) using Razorpay — card, UPI, netbanking, wallet |
| G-2 | Access is granted automatically on payment success (no manual admin step) |
| G-3 | Payment records are visible in the admin panel with Razorpay reference IDs |
| G-4 | Webhook handles edge-cases where the client closes before calling verify |
| G-5 | The existing manual-access and `paymentLinkUrl` flows continue to work exactly as before |

---

## 2. Existing Infrastructure (what changes — and what does not)

### Already in place
- `CoursePayment` Prisma model — `method` enum already includes `razorpay`; `reference` field exists (will be repurposed for `razorpay_payment_id`)
- `CourseAccess` model — unchanged
- `requestCourseAccessHandler` (`POST /api/user/courses/:id/access`) — for the manual path; NOT modified
- `approveCoursePaymentHandler` (`POST /api/courses/:id/payments/:paymentId/approve`) — unchanged
- `PaywallView` in `learning/[courseId]/page.tsx` — extended (not rewritten)
- Flutter `course_detail_screen.dart` — extended (not rewritten)
- Admin payment list page at `/api/courses/payments` — shows new Razorpay rows automatically

### What changes
- 3 new backend endpoints (create-order, verify, webhook)
- 3 raw SQL columns on `course_payments` (added at startup)
- 2 new optional env vars
- `PaywallView` adds Razorpay Checkout.js button (web)
- `course_detail_screen.dart` adds `razorpay_flutter` SDK integration (mobile)
- `backend/package.json` gains `razorpay` npm package

---

## 3. DB Schema Changes

No Prisma migration. Three columns added via idempotent `ALTER TABLE` in `backend/src/plugins/prisma.ts` startup block (same pattern as `batches.xp_per_day`):

```sql
ALTER TABLE course_payments ADD COLUMN IF NOT EXISTS razorpay_order_id TEXT;
ALTER TABLE course_payments ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT;
ALTER TABLE course_payments ADD COLUMN IF NOT EXISTS razorpay_signature TEXT;
```

Add to the startup `ALTER TABLE` block in `prisma.ts` — **three separate `$executeRawUnsafe` calls** (never one multi-statement call — see pitfall #32 in CLAUDE.md).

---

## 4. Environment Variables

Add to `backend/src/config/env.ts` (both optional — backend skips gracefully if unset, same pattern as other optional services):

```ts
RAZORPAY_KEY_ID: z.string().optional().or(z.literal('')),
RAZORPAY_KEY_SECRET: z.string().optional().or(z.literal('')),
RAZORPAY_WEBHOOK_SECRET: z.string().optional().or(z.literal('')),
```

Add to `backend/.env.example` and GCP Secret Manager (`prod-RAZORPAY_KEY_ID`, etc.).

`RAZORPAY_KEY_ID` is also needed on the frontend for Checkout.js:
- `tbt-user-web`: `NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_live_...`
- Flutter: passed from API response (`keyId` field) — no env var needed in app

---

## 5. Backend — New Service

**`backend/src/lib/razorpay.ts`** — thin wrapper (never instantiate Razorpay twice):

```ts
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { env } from '../config/env.js';

let _instance: Razorpay | null = null;

export function getRazorpay(): Razorpay {
  if (!_instance) {
    if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
      throw new Error('Razorpay is not configured (missing RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET)');
    }
    _instance = new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET });
  }
  return _instance;
}

export function verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
  const body = `${orderId}|${paymentId}`;
  const expected = crypto
    .createHmac('sha256', env.RAZORPAY_KEY_SECRET ?? '')
    .update(body)
    .digest('hex');
  return expected === signature;
}

export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const expected = crypto
    .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET ?? '')
    .update(rawBody)
    .digest('hex');
  return expected === signature;
}
```

Install: `npm install razorpay -w backend`

---

## 6. Backend — New Endpoints

All three are added to `backend/src/modules/user/controller.ts` + `routes.ts`.

Route prefix: `/api/user/courses` (existing prefix for user-facing course routes).

### 6.1 `POST /api/user/courses/:id/razorpay/create-order`

**Auth:** `fastify.authenticateUser` (JWT cookie)  
**Guard:** Skip if `RAZORPAY_KEY_ID` is unset (return 503 `RAZORPAY_NOT_CONFIGURED`)

**Logic:**
1. Load course: `price`, `isPublished`, `access_duration_days` (raw SQL)
2. If `price == null || price <= 0` → 400 `COURSE_IS_FREE` (use enrollment instead)
3. Check `CourseAccess` — if already active → 409 `ALREADY_HAS_ACCESS`
4. Idempotency: find any existing `CoursePayment` with `memberId + courseId + status='pending' + method='razorpay'`. If found and `razorpay_order_id` is not null → return existing order (re-use within 15 min; Razorpay orders expire in 15 min by default)
5. Create Razorpay order:
   ```ts
   const order = await getRazorpay().orders.create({
     amount: Math.round(Number(course.price) * 100), // paise
     currency: 'INR',
     receipt: `tbt-${courseId.slice(0, 8)}-${Date.now()}`,
     notes: { courseId, memberId },
   });
   ```
6. Create `CoursePayment` row:
   ```sql
   INSERT INTO course_payments (id, member_id, course_id, amount, currency, method, status, razorpay_order_id)
   VALUES (gen_random_uuid(), $1, $2, $3, 'INR', 'razorpay', 'pending', $4)
   ```
   (Use `$executeRawUnsafe` because `razorpay_order_id` is not in the Prisma schema)
7. Return:
   ```json
   {
     "orderId": "order_abc123",
     "amount": 199900,
     "currency": "INR",
     "keyId": "rzp_live_...",
     "paymentRecordId": "<coursePaymentId>"
   }
   ```

### 6.2 `POST /api/user/courses/:id/razorpay/verify`

**Auth:** `fastify.authenticateUser`  
**Body:** `{ razorpayOrderId, razorpayPaymentId, razorpaySignature, paymentRecordId }`

**Logic:**
1. Find `CoursePayment` by `paymentRecordId` — must belong to `memberId` and `courseId`
2. If `status === 'completed'` → idempotent 200 (already granted, return access)
3. Verify HMAC: `verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature)`
4. If invalid → 400 `SIGNATURE_INVALID`
5. Update payment:
   ```sql
   UPDATE course_payments
   SET status='completed', razorpay_payment_id=$1, razorpay_signature=$2,
       reference=$1, paid_at=NOW(), updated_at=NOW()
   WHERE id=$3
   ```
6. Upsert `CourseAccess`:
   ```ts
   prisma.courseAccess.upsert({
     where: { memberId_courseId: { memberId, courseId } },
     create: { memberId, courseId, accessType: hasDuration ? 'duration' : 'lifetime',
               expiresAt: hasDuration ? addDays(new Date(), durationDays) : null,
               isActive: true, paymentId: paymentRecordId },
     update: { isActive: true, revokedAt: null, revokedBy: null, paymentId: paymentRecordId,
               accessType: hasDuration ? 'duration' : 'lifetime',
               expiresAt: hasDuration ? addDays(new Date(), durationDays) : null },
   })
   ```
7. Upsert `CourseEnrollment` (progress = 0)
8. Emit socket `course:access_granted` → `user:{memberId}` room
9. Send admin notification (type `course_access_request`, metadata includes `paymentId`, `method: 'razorpay'`) — same helper as existing flow
10. Invalidate `me:{memberId}` cache
11. Return `{ accessGranted: true, courseId }`

### 6.3 `POST /api/user/courses/razorpay/webhook`

**Auth:** NONE — bypass JWT. Verify `x-razorpay-signature` header against raw body.  
**Raw body required** — register route with `{ config: { rawBody: true } }` in Fastify.

**Logic:**
1. Read `x-razorpay-signature` header
2. `verifyWebhookSignature(rawBody, signature)` → 400 if invalid
3. Parse body: `event = body.event`, only handle `payment.captured`
4. Extract `razorpayOrderId` from `payload.payment.entity.order_id`
5. Find `CoursePayment` by `razorpay_order_id` — if not found or already `completed`, return 200 (idempotent)
6. Run same grant logic as step 5-10 of verify endpoint (extract into a shared helper `grantCourseAccessAfterPayment`)
7. Always return 200 (Razorpay retries on non-200)

**Route registration in `user/routes.ts`:**
```ts
// Webhook must be registered BEFORE the authenticateUser preHandler applies.
// Register it as a top-level route on the fastify instance, not inside the
// authenticated group.
fastify.post('/api/user/courses/razorpay/webhook', {
  config: { rawBody: true },
}, webhookHandler);
```

---

## 7. Shared Helper: `grantCourseAccessAfterPayment`

Extract the grant logic into `backend/src/lib/coursePaymentGrant.ts` so both `/verify` and `/webhook` call the same function:

```ts
export async function grantCourseAccessAfterPayment(params: {
  prisma: PrismaClient;
  io: Server;
  paymentRecordId: string;
  razorpayPaymentId: string;
  razorpaySignature?: string;
  memberId: string;
  courseId: string;
}): Promise<void>
```

This prevents the grant logic from drifting between the two call sites.

---

## 8. Routes Registration (`user/routes.ts`)

```ts
// Unauthenticated (webhook must come first — before authenticateUser group)
fastify.post('/razorpay/webhook', { config: { rawBody: true } }, razorpayWebhookHandler);

// Inside authenticateUser group:
fastify.post('/courses/:id/razorpay/create-order', createRazorpayOrderHandler);
fastify.post('/courses/:id/razorpay/verify', verifyRazorpayPaymentHandler);
```

The webhook is at `/api/user/courses/razorpay/webhook` following the existing prefix.

---

## 9. User-Web — `PaywallView` Changes

**File:** `tbt-user-web/app/(platform)/learning/[courseId]/page.tsx`

The existing `handleGetAccess` covers the manual/external path. Add a **separate** `handleRazorpayPay` function.

### 9.1 Script loading

Add a `useEffect` in `PaywallView` that loads `https://checkout.razorpay.com/v1/checkout.js` once:

```ts
useEffect(() => {
  if (!(window as any).Razorpay) {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
  }
}, []);
```

### 9.2 New hook: `useCreateRazorpayOrder` / `useVerifyRazorpayPayment`

Add to `tbt-user-web/lib/hooks/useCourses.ts`:

```ts
export const useCreateRazorpayOrder = () =>
  useMutation({
    mutationFn: (courseId: string) => coursesService.createRazorpayOrder(courseId),
  });

export const useVerifyRazorpayPayment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      courseId: string;
      razorpayOrderId: string;
      razorpayPaymentId: string;
      razorpaySignature: string;
      paymentRecordId: string;
    }) => coursesService.verifyRazorpayPayment(params),
    onSuccess: (_data, { courseId }) => {
      queryClient.invalidateQueries({ queryKey: ['courses', courseId] });
      queryClient.invalidateQueries({ queryKey: ['user', 'me'] });
    },
  });
};
```

Add corresponding methods to `lib/api/services/courses.service.ts`.

### 9.3 `handleRazorpayPay` in `PaywallView`

```ts
const createOrder = useCreateRazorpayOrder();
const verifyPayment = useVerifyRazorpayPayment();

const handleRazorpayPay = async () => {
  try {
    const order = await createOrder.mutateAsync(courseId);
    const rzp = new (window as any).Razorpay({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      order_id: order.orderId,
      name: 'Tamil Business Tribe',
      description: course.title,
      image: course.thumbnailUrl ?? undefined,
      prefill: { name: me?.name, email: me?.email, contact: me?.phone },
      theme: { color: '#dc2626' },
      handler: async (response: any) => {
        try {
          await verifyPayment.mutateAsync({
            courseId,
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
            paymentRecordId: order.paymentRecordId,
          });
          toast.success('Payment successful! Redirecting to course...');
          router.push(`/learning/${courseId}`);
        } catch {
          toast.error('Payment verified failed. Please contact support.');
        }
      },
      modal: {
        ondismiss: () => {
          toast('Payment cancelled.', { icon: 'ℹ️' });
        },
      },
    });
    rzp.open();
  } catch (e: any) {
    toast.error(e.message ?? 'Could not initiate payment. Try again.');
  }
};
```

### 9.4 Button Rendering Logic in `PaywallView`

Determine which CTA to show:

```
const hasPriceForRazorpay = course.price != null && Number(course.price) > 0 && !course.pendingPayment;
const showRazorpay = hasPriceForRazorpay && Boolean(process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID);
```

If `showRazorpay` → show **"Pay ₹X now"** primary button + Razorpay `handleRazorpayPay`.  
Otherwise → keep existing **"Request Access"** button + `handleGetAccess`.

Both buttons are never shown at the same time.

If `course.pendingPayment` exists (regardless of method) → show existing pending-state UI.

---

## 10. Flutter — `course_detail_screen.dart` Changes

### 10.1 Add `razorpay_flutter` package

```yaml
# pubspec.yaml
razorpay_flutter: ^1.3.8
```

Run `flutter pub get`.

### 10.2 `_CoursePaywallState` — Razorpay integration

Import `package:razorpay_flutter/razorpay_flutter.dart`.

In the state class:

```dart
Razorpay? _razorpay;

@override
void initState() {
  super.initState();
  _razorpay = Razorpay();
  _razorpay!.on(Razorpay.EVENT_PAYMENT_SUCCESS, _handlePaymentSuccess);
  _razorpay!.on(Razorpay.EVENT_PAYMENT_ERROR, _handlePaymentError);
  _razorpay!.on(Razorpay.EVENT_EXTERNAL_WALLET, _handleExternalWallet);
}

@override
void dispose() {
  _razorpay?.clear();
  super.dispose();
}
```

Add `_handleRazorpayPay`:
```dart
Future<void> _handleRazorpayPay(CourseDetail course) async {
  if (_requesting) return;
  setState(() => _requesting = true);

  try {
    final svc = ref.read(coursesServiceProvider);
    final order = await svc.createRazorpayOrder(widget.courseId);

    final options = {
      'key': order.keyId,
      'amount': order.amount,           // paise
      'currency': order.currency,
      'order_id': order.orderId,
      'name': 'Tamil Business Tribe',
      'description': course.title,
      'timeout': 300,
      'theme': {'color': '#dc2626'},
    };
    _razorpay!.open(options);
    // SDK callbacks handle success/failure — setState is called there
    // (don't set _requesting=false here; it's cleared in callbacks)
  } catch (e) {
    setState(() => _requesting = false);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not initiate payment: $e')),
      );
    }
  }
}

void _handlePaymentSuccess(PaymentSuccessResponse response) async {
  try {
    await ref.read(coursesServiceProvider).verifyRazorpayPayment(
      courseId: widget.courseId,
      razorpayOrderId: response.orderId ?? '',
      razorpayPaymentId: response.paymentId ?? '',
      razorpaySignature: response.signature ?? '',
      paymentRecordId: _pendingPaymentRecordId ?? '',
    );
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Payment successful! You now have access.'),
        backgroundColor: Color(0xFF16a34a),
      ),
    );
    ref.invalidate(courseDetailProvider(widget.courseId));
  } catch (e) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Verification failed: $e. Contact support.')),
      );
    }
  } finally {
    if (mounted) setState(() => _requesting = false);
  }
}

void _handlePaymentError(PaymentFailureResponse response) {
  setState(() => _requesting = false);
  if (mounted) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(response.message ?? 'Payment failed. Try again.')),
    );
  }
}

void _handleExternalWallet(ExternalWalletResponse response) {
  setState(() => _requesting = false);
}
```

Store `_pendingPaymentRecordId` (from `createRazorpayOrder` response) in the state before calling `_razorpay!.open()`.

### 10.3 Button in `_PaywallWidget`

Condition: `course.price != null && course.price! > 0 && course.pendingPayment == null`

Show **"Pay ₹X Now"** primary button → calls `_handleRazorpayPay`.

Keep the existing logic for `paymentLinkUrl` and `pendingPayment` unchanged.

### 10.4 `CoursesService` — new methods

In `tbt_app/lib/features/courses/data/courses_service.dart` add:

```dart
Future<RazorpayOrderResult> createRazorpayOrder(String courseId) async {
  final res = await _dio.post<Map<String, dynamic>>(
    '$kCourses/$courseId/razorpay/create-order',
  );
  final d = res.data?['data'] as Map<String, dynamic>? ?? {};
  return RazorpayOrderResult(
    orderId: d['orderId'] as String,
    amount: (d['amount'] as num).toInt(),
    currency: d['currency'] as String,
    keyId: d['keyId'] as String,
    paymentRecordId: d['paymentRecordId'] as String,
  );
}

Future<void> verifyRazorpayPayment({
  required String courseId,
  required String razorpayOrderId,
  required String razorpayPaymentId,
  required String razorpaySignature,
  required String paymentRecordId,
}) async {
  await _dio.post<void>(
    '$kCourses/$courseId/razorpay/verify',
    data: {
      'razorpayOrderId': razorpayOrderId,
      'razorpayPaymentId': razorpayPaymentId,
      'razorpaySignature': razorpaySignature,
      'paymentRecordId': paymentRecordId,
    },
  );
}
```

Add a plain `RazorpayOrderResult` class (not freezed — same pattern as `BatchTaskMeta`):

```dart
class RazorpayOrderResult {
  const RazorpayOrderResult({
    required this.orderId,
    required this.amount,
    required this.currency,
    required this.keyId,
    required this.paymentRecordId,
  });
  final String orderId;
  final int amount;      // paise
  final String currency;
  final String keyId;
  final String paymentRecordId;
}
```

---

## 11. Admin Panel Changes

### 11.1 Payment List (`admin-panel/app/courses/page.tsx`)

The existing `useListCoursePayments` hook and payment table already pull from `GET /api/courses/payments`. That query returns all `CoursePayment` rows, which now includes Razorpay rows.

**Only change:** Add `razorpay_order_id` and `razorpay_payment_id` columns to the payment list table. These come from the existing `listCoursePaymentsHandler` query — add them to the `SELECT`:

```ts
// In courses/controller.ts listCoursePaymentsHandler:
// The raw SQL columns won't appear in Prisma result — add a supplementary query:
const paymentIds = payments.map(p => p.id);
const rzpRows = paymentIds.length
  ? await req.server.prisma.$queryRawUnsafe<any[]>(
      `SELECT id, razorpay_order_id, razorpay_payment_id
       FROM course_payments WHERE id = ANY($1::uuid[])`,
      paymentIds,
    )
  : [];
const rzpByPaymentId = Object.fromEntries(rzpRows.map(r => [r.id, r]));
// Merge into response
const data = payments.map(p => ({ ...p, ...rzpByPaymentId[p.id] }));
```

### 11.2 `approveCoursePaymentHandler` — no change needed

Razorpay payments auto-approve themselves. The admin approval handler is only invoked for the manual path. No guard needed; it's safe to call on an already-completed payment — it will find `status !== 'pending'` and return 400.

---

## 12. `getCourseDetailHandler` — Paywall Data Change

**File:** `backend/src/modules/user/controller.ts` — `getCourseDetailHandler`

The existing `pendingPayment` field is read from `CoursePayment` with `status='pending'`. Add `razorpay_order_id` to the pending-payment response so the client can re-use an existing order (within 15 min):

```ts
const pendingPayment = await (prisma as any).coursePayment.findFirst({
  where: { memberId, courseId, status: 'pending' },
  select: { id: true, amount: true, method: true },
}).catch(() => null);

// Augment with razorpay_order_id if applicable
let pendingPaymentRow = pendingPayment ? { ...pendingPayment, paymentUrl: null, razorpayOrderId: null } : null;
if (pendingPayment?.method === 'razorpay') {
  const rzpRow = await prisma.$queryRawUnsafe<any[]>(
    `SELECT razorpay_order_id FROM course_payments WHERE id=$1::uuid`, pendingPayment.id,
  ).catch(() => []);
  if (pendingPaymentRow) pendingPaymentRow.razorpayOrderId = rzpRow[0]?.razorpay_order_id ?? null;
}
```

---

## 13. Razorpay Webhook Configuration

1. In Razorpay Dashboard → Webhooks → Add: `https://tbt-backend-XXX.run.app/api/user/courses/razorpay/webhook`
2. Events to subscribe: `payment.captured` only
3. Copy the webhook secret → set as `RAZORPAY_WEBHOOK_SECRET` env var

---

## 14. Security Notes

| Concern | Mitigation |
|---------|-----------|
| Client faking payment success | HMAC signature verified server-side in `/verify` using `RAZORPAY_KEY_SECRET` |
| Replay attacks on `/verify` | `CoursePayment.status` check — idempotent, can't double-grant |
| Webhook spoofing | `x-razorpay-signature` verified against `RAZORPAY_WEBHOOK_SECRET` |
| Access granted for wrong course | `paymentRecordId` lookup includes `memberId` AND `courseId` check |
| Double-order creation | Idempotency check: reuse existing pending order within 15 min |
| Free courses being ordered | Guard: `price > 0` required in `createRazorpayOrder` handler |
| Already-enrolled member re-paying | Guard: `CourseAccess` check in `createRazorpayOrder` → 409 |
| Env vars absent | Backend returns 503 `RAZORPAY_NOT_CONFIGURED`; frontend hides Razorpay button |
| Razorpay in WebView (mobile) | Use native `razorpay_flutter` SDK (never WebView) — SDK handles this correctly |

---

## 15. Error Handling Matrix

| Scenario | HTTP | Code | User-facing message |
|----------|------|------|---------------------|
| Razorpay not configured | 503 | `RAZORPAY_NOT_CONFIGURED` | Hidden (button not shown) |
| Course is free | 400 | `COURSE_IS_FREE` | — |
| Already has access | 409 | `ALREADY_HAS_ACCESS` | "You already have access" |
| Invalid signature | 400 | `SIGNATURE_INVALID` | "Payment verification failed. Contact support." |
| Razorpay order creation fails | 500 | `ORDER_CREATE_FAILED` | "Could not initiate payment. Try again." |
| Payment dismissed by user | — | — | "Payment cancelled" toast |
| Webhook — order not found | 200 | — | (silent; already granted or wrong env) |

---

## 16. Implementation Checklist

Items are ordered — each unblocks the next. Do not parallelize steps that depend on each other.

### Phase 1 — Backend foundation
- [ ] **P1-1**: Add `razorpay` npm package (`npm install razorpay -w backend`)
- [ ] **P1-2**: Add `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` to `env.ts` (optional)
- [ ] **P1-3**: Add 3 `ALTER TABLE course_payments ADD COLUMN IF NOT EXISTS` calls to `prisma.ts` startup block
- [ ] **P1-4**: Create `backend/src/lib/razorpay.ts` singleton + signature helpers
- [ ] **P1-5**: Create `backend/src/lib/coursePaymentGrant.ts` shared grant helper

### Phase 2 — Backend endpoints
- [ ] **P2-1**: Add `createRazorpayOrderHandler` to `user/controller.ts`
- [ ] **P2-2**: Add `verifyRazorpayPaymentHandler` to `user/controller.ts`
- [ ] **P2-3**: Add `razorpayWebhookHandler` to `user/controller.ts` (raw body)
- [ ] **P2-4**: Register all 3 routes in `user/routes.ts` (webhook outside auth group)
- [ ] **P2-5**: Update `getCourseDetailHandler` to include `razorpayOrderId` in pending payment
- [ ] **P2-6**: Update `listCoursePaymentsHandler` to include `razorpay_order_id`/`razorpay_payment_id`
- [ ] **P2-7**: Run `npx tsc --noEmit -p backend/tsconfig.json` — zero errors

### Phase 3 — User web
- [ ] **P3-1**: Add `NEXT_PUBLIC_RAZORPAY_KEY_ID` to `tbt-user-web` env
- [ ] **P3-2**: Add `createRazorpayOrder` + `verifyRazorpayPayment` to `courses.service.ts`
- [ ] **P3-3**: Add `useCreateRazorpayOrder` + `useVerifyRazorpayPayment` hooks to `useCourses.ts`
- [ ] **P3-4**: Update `PaywallView` — script loader, `handleRazorpayPay`, button logic
- [ ] **P3-5**: Run `npm run typecheck` — zero errors

### Phase 4 — Flutter
- [ ] **P4-1**: Add `razorpay_flutter: ^1.3.8` to `pubspec.yaml` + `flutter pub get`
- [ ] **P4-2**: Add `RazorpayOrderResult` data class to `courses_service.dart`
- [ ] **P4-3**: Add `createRazorpayOrder` + `verifyRazorpayPayment` to `CoursesService`
- [ ] **P4-4**: Update `course_detail_screen.dart` — `Razorpay` instance, callbacks, button logic
- [ ] **P4-5**: Run `flutter analyze` — zero issues

### Phase 5 — Admin panel
- [ ] **P5-1**: Update `listCoursePaymentsHandler` (already in P2-6) — confirm columns appear in admin UI
- [ ] **P5-2**: Add `razorpay_order_id` column to payment table in `courses/page.tsx`

### Phase 6 — Verification
- [ ] **P6-1**: Configure Razorpay test mode keys in local `.env`
- [ ] **P6-2**: Test full web flow: create order → Razorpay test checkout → verify → access granted
- [ ] **P6-3**: Test webhook: use Razorpay test webhook + `ngrok` or Razorpay Dashboard "Test" button
- [ ] **P6-4**: Test Flutter flow on device (not emulator — Razorpay SDK requires real device for UPI)
- [ ] **P6-5**: Test edge cases: already-enrolled member, free course, duplicate order
- [ ] **P6-6**: Deploy to staging → run with live test keys → confirm
- [ ] **P6-7**: Switch to live keys in production env → `git push origin main:production`

---

## 17. File Touch Summary

| File | Change |
|------|--------|
| `backend/package.json` | Add `razorpay` |
| `backend/src/config/env.ts` | 3 optional env vars |
| `backend/src/plugins/prisma.ts` | 3 `ALTER TABLE` startup lines |
| `backend/src/lib/razorpay.ts` | New — singleton + signature helpers |
| `backend/src/lib/coursePaymentGrant.ts` | New — shared access-grant helper |
| `backend/src/modules/user/controller.ts` | 3 new handlers + extend 2 existing handlers |
| `backend/src/modules/user/routes.ts` | 3 new route registrations |
| `backend/src/modules/courses/controller.ts` | Extend `listCoursePaymentsHandler` |
| `tbt-user-web/.env.local` | Add `NEXT_PUBLIC_RAZORPAY_KEY_ID` |
| `tbt-user-web/lib/api/services/courses.service.ts` | 2 new methods |
| `tbt-user-web/lib/hooks/useCourses.ts` | 2 new hooks |
| `tbt-user-web/app/(platform)/learning/[courseId]/page.tsx` | Extend `PaywallView` |
| `tbt_app/pubspec.yaml` | Add `razorpay_flutter` |
| `tbt_app/lib/features/courses/data/courses_service.dart` | 2 new methods + `RazorpayOrderResult` class |
| `tbt_app/lib/features/courses/presentation/course_detail_screen.dart` | Razorpay SDK hooks + button |
| `admin-panel/app/courses/page.tsx` | Add Razorpay columns to payment table |

**Files NOT touched:** `prisma/schema.prisma` (raw SQL only), `CourseAccess`/`CourseEnrollment` models, existing `requestCourseAccessHandler`, `approveCoursePaymentHandler`, Flutter paywall existing states.
