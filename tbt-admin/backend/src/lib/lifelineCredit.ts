// Extra Lifeline — the ONE place a paid Razorpay order becomes a lifeline.
//
// Used by all three paths that can learn about a payment:
//   • POST /api/user/lifelines/razorpay/verify  (browser, signature-checked)
//   • the Razorpay webhook                       (signature-checked raw body)
//   • the reconciliation job                     (jobs/lifelineReconcile.ts)
//
// None of them is trusted on its own: the saved order is re-read from the
// database and the order + payment are re-fetched from Razorpay, then checked
// (lib/lifelinePurchaseLogic.ts) before anything is credited.
//
// Exactly-once is enforced by the database, not by memory:
//   • one transaction flips the order to 'paid' with a conditional UPDATE
//     (… WHERE status IN ('created','expired') RETURNING) and only then adds
//     1 to member_batch_settings.lifelines_total. Under Postgres row locking a
//     concurrent second UPDATE re-checks the WHERE after the first commits and
//     matches nothing, so racing verify / webhook / reconciliation calls credit
//     once;
//   • payment_id is UNIQUE, so one Razorpay payment can never pay two orders.
import { getRazorpay } from './razorpay.js';
import { checkLifelinePayment, type LifelineOrderRow } from './lifelinePurchaseLogic.js';

/** What we read from Razorpay. The live implementation wraps the SDK; tests pass a fake. */
export interface LifelineRazorpayReader {
  fetchOrder(orderId: string): Promise<any>;
  fetchPayment(paymentId: string): Promise<any>;
  /** All payments made against an order (reconciliation). */
  fetchOrderPayments(orderId: string): Promise<any[]>;
}

export const liveLifelineRazorpayReader: LifelineRazorpayReader = {
  fetchOrder: (orderId) => getRazorpay().orders.fetch(orderId),
  fetchPayment: (paymentId) => getRazorpay().payments.fetch(paymentId),
  fetchOrderPayments: async (orderId) => {
    const res: any = await getRazorpay().orders.fetchPayments(orderId);
    return Array.isArray(res?.items) ? res.items : [];
  },
};

export interface LifelineState {
  lifelinesTotal: number;
  lifelinesUsed: number;
  lifelinesRemaining: number;
}

export type LifelineCreditOutcome =
  /** This call added the lifeline. */
  | { kind: 'credited'; state: LifelineState }
  /** Already credited for this same payment — nothing added (idempotent success). */
  | { kind: 'already'; state: LifelineState }
  /** Will never succeed as-is (wrong owner/order/amount/currency/product, failed payment, …). */
  | { kind: 'rejected'; httpStatus: number; code: string }
  /** Payment not settled yet (authorized, order unpaid) — safe to ask again later. */
  | { kind: 'pending'; httpStatus: 202; code: 'PAYMENT_PENDING' }
  /** Razorpay or the database was unavailable — nothing changed, safe to retry. */
  | { kind: 'transient'; httpStatus: 502 | 503; code: string };

type OrderRow = LifelineOrderRow & { batchId: string };

const CREDITABLE_STATUSES = `('created', 'expired')`;

/** A unique-constraint violation (payment_id) as surfaced by Prisma raw queries or the pg driver. */
export function isUniqueViolation(err: any): boolean {
  const code = err?.meta?.code ?? err?.code;
  return code === '23505' || /23505|unique constraint|duplicate key/i.test(String(err?.message ?? ''));
}

async function loadOrder(prisma: any, orderId: string): Promise<OrderRow | null> {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT order_id AS "orderId", member_id::text AS "memberId", batch_id::text AS "batchId",
            amount_paise AS "amountPaise", currency, status, payment_id AS "paymentId"
     FROM lifeline_razorpay_orders WHERE order_id = $1`,
    orderId,
  );
  const row = (rows as any[])[0];
  return row ? { ...row, amountPaise: Number(row.amountPaise) } : null;
}

export async function readLifelineState(prisma: any, memberId: string, batchId: string): Promise<LifelineState> {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT lifelines_total, lifelines_used FROM member_batch_settings WHERE member_id=$1::uuid AND batch_id=$2::uuid LIMIT 1`,
    memberId, batchId,
  );
  const total = Number((rows as any[])[0]?.lifelines_total ?? 3);
  const used = Number((rows as any[])[0]?.lifelines_used ?? 0);
  return { lifelinesTotal: total, lifelinesUsed: used, lifelinesRemaining: Math.max(0, total - used) };
}

/**
 * Credit one lifeline for `orderId` paid by `paymentId`, at most once.
 * `actingMemberId` (browser verify) must own the order; the webhook and the
 * reconciliation job omit it and the saved order's member is used.
 */
export async function creditLifelineOrder(
  prisma: any,
  rzp: LifelineRazorpayReader,
  p: { orderId: string; paymentId: string; actingMemberId?: string },
): Promise<LifelineCreditOutcome> {
  let order: OrderRow | null;
  try {
    order = await loadOrder(prisma, p.orderId);
  } catch {
    return { kind: 'transient', httpStatus: 503, code: 'DB_UNAVAILABLE' };
  }
  if (!order) return { kind: 'rejected', httpStatus: 404, code: 'ORDER_NOT_FOUND' };
  if (p.actingMemberId !== undefined && order.memberId !== p.actingMemberId) {
    return { kind: 'rejected', httpStatus: 403, code: 'ORDER_NOT_YOURS' };
  }

  const settled = async (o: OrderRow): Promise<LifelineCreditOutcome> => {
    if (o.paymentId !== p.paymentId) return { kind: 'rejected', httpStatus: 409, code: 'ORDER_ALREADY_PAID' };
    try {
      return { kind: 'already', state: await readLifelineState(prisma, o.memberId, o.batchId) };
    } catch {
      return { kind: 'transient', httpStatus: 503, code: 'DB_UNAVAILABLE' };
    }
  };
  if (order.status === 'paid') return settled(order);

  let rzpOrder: any;
  let rzpPayment: any;
  try {
    [rzpOrder, rzpPayment] = await Promise.all([rzp.fetchOrder(p.orderId), rzp.fetchPayment(p.paymentId)]);
  } catch {
    return { kind: 'transient', httpStatus: 502, code: 'RAZORPAY_UNAVAILABLE' };
  }
  const check = checkLifelinePayment({ memberId: order.memberId, order, rzpOrder: rzpOrder ?? {}, rzpPayment: rzpPayment ?? {} });
  if (!check.ok) {
    return check.pending
      ? { kind: 'pending', httpStatus: 202, code: 'PAYMENT_PENDING' }
      : { kind: 'rejected', httpStatus: check.httpStatus, code: check.code };
  }

  let credited: { lifelines_total: number; lifelines_used: number } | null;
  try {
    credited = await prisma.$transaction(async (tx: any) => {
      const flipped = await tx.$queryRawUnsafe(
        `UPDATE lifeline_razorpay_orders SET status = 'paid', payment_id = $3, paid_at = NOW()
         WHERE order_id = $1 AND member_id = $2::uuid AND status IN ${CREDITABLE_STATUSES}
         RETURNING order_id`,
        p.orderId, order!.memberId, p.paymentId,
      );
      if ((flipped as any[]).length === 0) return null; // another path credited it first
      await tx.$executeRawUnsafe(
        `INSERT INTO member_batch_settings (member_id, batch_id) VALUES ($1::uuid, $2::uuid)
         ON CONFLICT (member_id, batch_id) DO NOTHING`,
        order!.memberId, order!.batchId,
      );
      const [settings] = await tx.$queryRawUnsafe(
        `UPDATE member_batch_settings SET lifelines_total = lifelines_total + 1
         WHERE member_id = $1::uuid AND batch_id = $2::uuid
         RETURNING lifelines_total, lifelines_used`,
        order!.memberId, order!.batchId,
      );
      return settings;
    });
  } catch (err) {
    if (isUniqueViolation(err)) return { kind: 'rejected', httpStatus: 409, code: 'PAYMENT_ALREADY_USED' };
    return { kind: 'transient', httpStatus: 503, code: 'DB_UNAVAILABLE' };
  }

  if (!credited) {
    // Lost the race: report what the winner recorded.
    try {
      const now = await loadOrder(prisma, p.orderId);
      if (now?.status === 'paid') return settled(now);
    } catch {
      return { kind: 'transient', httpStatus: 503, code: 'DB_UNAVAILABLE' };
    }
    return { kind: 'transient', httpStatus: 503, code: 'ORDER_STATE_CHANGED' };
  }

  const total = Number(credited.lifelines_total);
  const used = Number(credited.lifelines_used);
  return { kind: 'credited', state: { lifelinesTotal: total, lifelinesUsed: used, lifelinesRemaining: Math.max(0, total - used) } };
}
