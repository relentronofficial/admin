# RAZORPAY_PAYMENT_FIX_SPECKIT.md

Targeted fixes for the Razorpay course payment flow.  
**Status:** 2026-10-08 · discovered via static audit  
**Scope:** 3 surgical fixes — no new endpoints, no schema changes, no new hooks.

---

## Root Cause Analysis

Full implementation exists (backend + frontend) and is structurally sound.  
Two runtime bugs degrade UX and one edge case leaves stale state.

### BUG-RZ-01 — Pay button re-enables while checkout modal is open (CRITICAL)

**File:** `tbt-user-web/app/(platform)/learning/[courseId]/page.tsx` → `PaywallView`

`isCheckoutOpen` is declared as `useRef(false)`. Setting `isCheckoutOpen.current = true`
(done right before `rzp.open()`) does NOT schedule a React re-render. So after
`createOrder.mutateAsync` resolves (`createOrder.isPending → false`), the component
re-renders with `isCheckoutOpen.current` still reading as `false` — the Pay button
re-enables. The Razorpay checkout modal is now open AND the button is clickable.

A member who double-clicks can trigger `handleRazorpayPay` again → `createOrder.mutateAsync`
→ backend idempotency check returns the same order → a second Razorpay modal stacks on top
of the first, or replaces it, causing confusion. On slow connections the second click
creates a brand-new order (after the first order was expired at 14 min).

**Fix:** Replace `useRef<boolean>(false)` with `useState<boolean>(false)` so that
`setCheckoutOpen(true)` right before `rzp.open()` schedules a re-render, and the
button's `disabled` prop correctly reflects the open state.

### BUG-RZ-02 — Enrollment list stale after payment

**File:** `tbt-user-web/lib/hooks/useCourses.ts` → `useVerifyRazorpayPayment`

`onSuccess` only invalidates `["courses", courseId]` and `["user", "me"]`.  
The enrollment list query (`["user", "enrollments"]`) used by `/learning` (the
overview page) is not invalidated. A member who buys a course and navigates to `/learning`
immediately after will see the "no enrollments" state until the 5-minute stale-time expires.

**Fix:** Add `queryClient.invalidateQueries({ queryKey: ["user", "enrollments"] })` to
`useVerifyRazorpayPayment.onSuccess`.

### BUG-RZ-03 — Coin-purchase button has no visual disabled state during open checkout

**File:** `tbt-user-web/app/(platform)/learning/[courseId]/page.tsx` → coin dialog

The "Get TBT Coins" button is `disabled={createCoinOrder.isPending || verifyCoinPayment.isPending}`.
`coinPurchaseOpenRef.current` is a ref guard inside `handleGetTbtCoins` (prevents
double-execution at function level) but is NOT in the button's `disabled` prop.
After `createCoinOrder.mutateAsync` resolves the button re-enables visually.
This is less critical than BUG-RZ-01 because the function-level guard catches it, but
the UX is confusing (button appears active while checkout modal is open).

**Fix:** Add `coinPurchaseOpen` state (bool) and include it in the button's `disabled` prop,
matching the same pattern as BUG-RZ-01 fix.

---

## Implementation

### FIX-01 (`page.tsx` — PaywallView)

Replace:
```tsx
const isCheckoutOpen = useRef(false);
```
With:
```tsx
const [checkoutOpen, setCheckoutOpen] = useState(false);
```

In `handleRazorpayPay` replace every `isCheckoutOpen.current = X` with `setCheckoutOpen(X)`.

Update both button `disabled` props:
```tsx
disabled={createOrder.isPending || verifyPayment.isPending || checkoutOpen}
```

### FIX-02 (`useCourses.ts` — `useVerifyRazorpayPayment`)

Add enrollments invalidation to `onSuccess`:
```ts
queryClient.invalidateQueries({ queryKey: ["user", "enrollments"] });
```

### FIX-03 (`page.tsx` — coin dialog)

Replace `coinPurchaseOpenRef.current` guard inside `handleGetTbtCoins` with a
`coinPurchaseOpen` state, and include it in the coin-purchase button's `disabled` prop:
```tsx
disabled={createCoinOrder.isPending || verifyCoinPayment.isPending || coinPurchaseOpen}
```

---

## Files Touched

| File | Change |
|------|--------|
| `tbt-user-web/app/(platform)/learning/[courseId]/page.tsx` | FIX-01, FIX-03 |
| `tbt-user-web/lib/hooks/useCourses.ts` | FIX-02 |

No backend changes, no schema changes, no new routes.
