/**
 * Course payment ↔ Razorpay reconciliation — pure rules (no I/O), unit-tested.
 * The admin Payments page uses these to say whether a course_payments row is
 * backed by money Razorpay actually captured.
 */

/** One Razorpay payment attempt on an order (subset of the API object). */
export interface RzpPaymentLite {
  id: string;
  status: string; // created | authorized | captured | refunded | failed
  amount: number; // paise
  amount_refunded?: number; // paise
  method?: string | null;
  created_at?: number; // unix seconds
}

export type ReconcileVerdict =
  | 'ok' // TBT and Razorpay agree
  | 'not_paid_on_razorpay' // TBT says completed, Razorpay has no captured payment
  | 'paid_outside_razorpay' // recorded as a non-Razorpay (manual etc.) payment; the order was never paid — expected
  | 'paid_not_recorded' // Razorpay captured money, TBT still pending / failed
  | 'amount_mismatch' // both paid, amounts differ
  | 'refund_mismatch' // refund state differs between TBT and Razorpay
  | 'unpaid_checkout' // checkout opened, never paid (both sides agree)
  | 'no_order' // row has no Razorpay order id to check
  | 'error'; // Razorpay API call failed

export interface ReconcileResult {
  verdict: ReconcileVerdict;
  /** the captured (or refunded) Razorpay payment that backs this row, if any */
  capturedPaymentId: string | null;
  capturedAmount: number | null; // rupees
  refundedAmount: number | null; // rupees
  attempts: number;
}

const PAID = new Set(['captured', 'refunded']);

/** Rupee amounts equal to the paisa. */
const sameAmount = (rupees: number, paise: number) => Math.round(rupees * 100) === paise;

export function reconcileCoursePayment(
  row: { status: string; amount: number; razorpayOrderId: string | null; method?: string | null },
  payments: RzpPaymentLite[] | null,
): ReconcileResult {
  const base = { capturedPaymentId: null, capturedAmount: null, refundedAmount: null, attempts: payments?.length ?? 0 };
  if (!row.razorpayOrderId) return { ...base, verdict: 'no_order' };
  if (payments == null) return { ...base, verdict: 'error' };

  const paid = payments.filter((p) => PAID.has(p.status));
  const best = paid.find((p) => sameAmount(row.amount, p.amount)) ?? paid[0] ?? null;
  const res: ReconcileResult = {
    ...base,
    capturedPaymentId: best?.id ?? null,
    capturedAmount: best ? best.amount / 100 : null,
    refundedAmount: best && best.amount_refunded ? best.amount_refunded / 100 : best?.status === 'refunded' ? best.amount / 100 : null,
    verdict: 'ok',
  };
  const rzpRefunded = !!best && (best.status === 'refunded' || (best.amount_refunded ?? 0) > 0);

  if (row.status === 'completed') {
    if (!best) return { ...res, verdict: row.method && row.method !== 'razorpay' ? 'paid_outside_razorpay' : 'not_paid_on_razorpay' };
    if (rzpRefunded) return { ...res, verdict: 'refund_mismatch' };
    if (!sameAmount(row.amount, best.amount)) return { ...res, verdict: 'amount_mismatch' };
    return res;
  }
  if (row.status === 'refunded') {
    if (!best) return { ...res, verdict: 'not_paid_on_razorpay' };
    return { ...res, verdict: rzpRefunded ? 'ok' : 'refund_mismatch' };
  }
  // pending / failed
  if (best) return { ...res, verdict: 'paid_not_recorded' };
  return { ...res, verdict: 'unpaid_checkout' };
}
