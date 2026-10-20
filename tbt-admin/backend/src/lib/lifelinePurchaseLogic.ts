// Extra Lifeline purchase via Razorpay — pure checks (no Prisma, no Razorpay SDK, no I/O).
//
// A member buys exactly one Extra Lifeline (credit_pricing.credit_type =
// 'lifeline', admin-editable price). The order is created server-side and
// recorded in lifeline_razorpay_orders with the member, batch and amount; a
// lifeline is added only after the backend has verified the checkout signature
// AND re-read the order and payment from Razorpay and they pass every check
// below. Nothing here trusts the browser's success callback.

export const LIFELINE_CREDIT_TYPE = 'lifeline';
export const LIFELINE_ORDER_TYPE = 'lifeline_purchase';

/**
 * credit_pricing.price_inr to paise; null when not a usable positive price.
 * Prisma raw queries return a DECIMAL column as a Prisma.Decimal object (not a
 * string or number) — its String() is the exact decimal, so convert via String.
 */
export function priceInrToPaise(price: unknown): number | null {
  const n =
    typeof price === 'number' ? price
    : typeof price === 'string' ? (price.trim() === '' ? NaN : Number(price))
    : price !== null && typeof price === 'object' && typeof (price as { toString?: unknown }).toString === 'function' ? Number(String(price))
    : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

export interface LifelineOrderRow {
  orderId: string;
  memberId: string;
  amountPaise: number;
  currency: string;
  status: string; // 'created' | 'paid'
  paymentId: string | null;
}

/** The fields we read from Razorpay's order and payment entities. */
export interface RzpOrderLike { id?: string; amount?: number; currency?: string; status?: string; notes?: Record<string, unknown> | unknown[] | null }
export interface RzpPaymentLike { id?: string; order_id?: string; amount?: number; currency?: string; status?: string }

export type LifelinePaymentCheck =
  | { ok: true }
  | { ok: false; httpStatus: number; code: string; pending?: true };

/** Ownership of a stored order. Checked before anything is fetched from Razorpay. */
export function checkOrderOwnership(order: LifelineOrderRow | null, memberId: string): LifelinePaymentCheck {
  if (!order) return { ok: false, httpStatus: 404, code: 'ORDER_NOT_FOUND' };
  if (order.memberId !== memberId) return { ok: false, httpStatus: 403, code: 'ORDER_NOT_YOURS' };
  return { ok: true };
}

/**
 * Every check a verified-signature payment must also pass before a lifeline
 * is added: it belongs to this member's lifeline order, for the stored amount
 * and currency, and Razorpay reports the payment captured and the order paid.
 */
export function checkLifelinePayment(p: {
  memberId: string;
  order: LifelineOrderRow;
  rzpOrder: RzpOrderLike;
  rzpPayment: RzpPaymentLike;
}): LifelinePaymentCheck {
  const { memberId, order, rzpOrder, rzpPayment } = p;
  const notes = (rzpOrder.notes && !Array.isArray(rzpOrder.notes) ? rzpOrder.notes : {}) as Record<string, unknown>;

  if (rzpOrder.id !== order.orderId || rzpPayment.order_id !== order.orderId) {
    return { ok: false, httpStatus: 400, code: 'PAYMENT_ORDER_MISMATCH' };
  }
  if (notes.type !== LIFELINE_ORDER_TYPE || notes.memberId !== memberId) {
    return { ok: false, httpStatus: 400, code: 'ORDER_PRODUCT_MISMATCH' };
  }
  if (rzpOrder.amount !== order.amountPaise || rzpPayment.amount !== order.amountPaise) {
    return { ok: false, httpStatus: 400, code: 'AMOUNT_MISMATCH' };
  }
  if (rzpOrder.currency !== order.currency || rzpPayment.currency !== order.currency) {
    return { ok: false, httpStatus: 400, code: 'CURRENCY_MISMATCH' };
  }
  if (rzpPayment.status === 'failed') return { ok: false, httpStatus: 402, code: 'PAYMENT_FAILED' };
  // Authorized-but-not-captured (or still created): money not settled yet — never credit it.
  if (rzpPayment.status === 'authorized' || rzpPayment.status === 'created') {
    return { ok: false, httpStatus: 202, code: 'PAYMENT_PENDING', pending: true };
  }
  if (rzpPayment.status !== 'captured') return { ok: false, httpStatus: 400, code: 'PAYMENT_NOT_CAPTURED' };
  if (rzpOrder.status !== 'paid') return { ok: false, httpStatus: 202, code: 'PAYMENT_PENDING', pending: true };
  return { ok: true };
}
