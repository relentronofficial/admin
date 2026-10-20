// Extra Lifeline purchase via Razorpay (member, JWT cookie — /api/user/*).
//
//   POST /api/user/lifelines/razorpay/create-order
//   POST /api/user/lifelines/razorpay/verify
//
// Same shape as the TBT coin purchase (controller.ts createCoinOrderHandler /
// verifyCoinPaymentHandler), but sells exactly one program lifeline at the
// admin-configured credit_pricing price. The order is stored server-side
// (lifeline_razorpay_orders) so verification can check ownership and amount;
// a lifeline is added only after the signature is valid AND Razorpay itself
// reports the payment captured for this order (lib/lifelinePurchaseLogic.ts).
// The status flip created → paid and the lifelines_total + 1 run in one
// transaction, so a repeated or concurrent verify can never add twice.
import type { FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../../config/env.js';
import { getRazorpay, verifyPaymentSignature } from '../../lib/razorpay.js';
import {
  LIFELINE_CREDIT_TYPE,
  LIFELINE_ORDER_TYPE,
  checkLifelinePayment,
  checkOrderOwnership,
  priceInrToPaise,
  type LifelineOrderRow,
} from '../../lib/lifelinePurchaseLogic.js';

function ok(reply: FastifyReply, data: unknown) {
  return reply.send({ success: true, data, error: null });
}

function fail(reply: FastifyReply, status: number, message: string) {
  return reply.status(status).send({ success: false, data: null, error: { code: 'ERROR', message } });
}

const razorpayConfigured = () => !!env.RAZORPAY_KEY_ID && !!env.RAZORPAY_KEY_SECRET;

async function lifelineState(prisma: any, memberId: string, batchId: string) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT lifelines_total, lifelines_used FROM member_batch_settings WHERE member_id=$1::uuid AND batch_id=$2::uuid LIMIT 1`,
    memberId, batchId,
  );
  const total = Number((rows as any[])[0]?.lifelines_total ?? 3);
  const used = Number((rows as any[])[0]?.lifelines_used ?? 0);
  return { lifelinesTotal: total, lifelinesUsed: used, lifelinesRemaining: Math.max(0, total - used) };
}

// POST /api/user/lifelines/razorpay/create-order
export async function createLifelineOrderHandler(request: FastifyRequest, reply: FastifyReply) {
  const memberId = request.memberId!;
  if (!razorpayConfigured()) return fail(reply, 503, 'RAZORPAY_NOT_CONFIGURED');
  const prisma = request.server.prisma;

  // Lifelines belong to the member's current batch — taken from the server, never the client.
  const [member] = await prisma.$queryRawUnsafe<any[]>(
    `SELECT batch_id::text AS "batchId" FROM members WHERE id = $1::uuid`, memberId,
  );
  const batchId: string | null = member?.batchId ?? null;
  if (!batchId) return fail(reply, 400, 'NOT_IN_BATCH');

  const [pricing] = await prisma.$queryRawUnsafe<any[]>(
    `SELECT price_inr, label FROM credit_pricing WHERE credit_type = $1`, LIFELINE_CREDIT_TYPE,
  );
  const amountPaise = priceInrToPaise(pricing?.price_inr);
  if (amountPaise === null) return fail(reply, 503, 'PRICE_NOT_CONFIGURED');

  let rzpOrder: any;
  try {
    rzpOrder = await getRazorpay().orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: `tbt-lifeline-${memberId.slice(0, 8)}-${Date.now()}`,
      notes: { memberId, batchId, type: LIFELINE_ORDER_TYPE },
    });
  } catch {
    return fail(reply, 500, 'ORDER_CREATE_FAILED');
  }

  await prisma.$executeRawUnsafe(
    `INSERT INTO lifeline_razorpay_orders (order_id, member_id, batch_id, amount_paise, currency)
     VALUES ($1, $2::uuid, $3::uuid, $4, 'INR')`,
    rzpOrder.id, memberId, batchId, amountPaise,
  );

  return ok(reply, {
    orderId: rzpOrder.id,
    amount: amountPaise,
    currency: 'INR',
    keyId: env.RAZORPAY_KEY_ID,
    label: (pricing?.label as string | undefined) ?? 'Extra Lifeline',
  });
}

// POST /api/user/lifelines/razorpay/verify  { razorpayOrderId, razorpayPaymentId, razorpaySignature }
export async function verifyLifelinePaymentHandler(request: FastifyRequest, reply: FastifyReply) {
  const memberId = request.memberId!;
  if (!razorpayConfigured()) return fail(reply, 503, 'RAZORPAY_NOT_CONFIGURED');
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = (request.body ?? {}) as Record<string, unknown>;
  if (typeof razorpayOrderId !== 'string' || typeof razorpayPaymentId !== 'string' || typeof razorpaySignature !== 'string'
    || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    return fail(reply, 400, 'INVALID_PAYMENT_DETAILS');
  }
  if (!verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature)) {
    return fail(reply, 400, 'SIGNATURE_INVALID');
  }
  const prisma = request.server.prisma;

  const [row] = await prisma.$queryRawUnsafe<any[]>(
    `SELECT order_id AS "orderId", member_id::text AS "memberId", batch_id::text AS "batchId",
            amount_paise AS "amountPaise", currency, status, payment_id AS "paymentId"
     FROM lifeline_razorpay_orders WHERE order_id = $1`,
    razorpayOrderId,
  );
  const order = row ? ({ ...row, amountPaise: Number(row.amountPaise) } as LifelineOrderRow & { batchId: string }) : null;
  const owner = checkOrderOwnership(order, memberId);
  if (!owner.ok) return fail(reply, owner.httpStatus, owner.code);

  // Already credited: same payment → idempotent success; a different payment → conflict.
  if (order!.status === 'paid') {
    if (order!.paymentId !== razorpayPaymentId) return fail(reply, 409, 'ORDER_ALREADY_PAID');
    return ok(reply, { lifelineAdded: false, alreadyProcessed: true, ...(await lifelineState(prisma, memberId, order!.batchId)) });
  }

  let rzpOrder: any;
  let rzpPayment: any;
  try {
    [rzpOrder, rzpPayment] = await Promise.all([
      getRazorpay().orders.fetch(razorpayOrderId),
      getRazorpay().payments.fetch(razorpayPaymentId),
    ]);
  } catch {
    return fail(reply, 502, 'RAZORPAY_UNAVAILABLE');
  }
  const check = checkLifelinePayment({ memberId, order: order!, rzpOrder, rzpPayment });
  if (!check.ok) return fail(reply, check.httpStatus, check.code);

  let added: { lifelines_total: number; lifelines_used: number } | null = null;
  try {
    added = await prisma.$transaction(async (tx: any) => {
      const flipped = await tx.$queryRawUnsafe(
        `UPDATE lifeline_razorpay_orders SET status = 'paid', payment_id = $3, paid_at = NOW()
         WHERE order_id = $1 AND member_id = $2::uuid AND status = 'created'
         RETURNING batch_id::text AS "batchId"`,
        razorpayOrderId, memberId, razorpayPaymentId,
      );
      if ((flipped as any[]).length === 0) return null; // a concurrent verify got here first
      await tx.$executeRawUnsafe(
        `INSERT INTO member_batch_settings (member_id, batch_id) VALUES ($1::uuid, $2::uuid)
         ON CONFLICT (member_id, batch_id) DO NOTHING`,
        memberId, order!.batchId,
      );
      const [settings] = await tx.$queryRawUnsafe(
        `UPDATE member_batch_settings SET lifelines_total = lifelines_total + 1
         WHERE member_id = $1::uuid AND batch_id = $2::uuid
         RETURNING lifelines_total, lifelines_used`,
        memberId, order!.batchId,
      );
      return settings;
    });
  } catch (err: any) {
    // payment_id is UNIQUE: one Razorpay payment can never pay for two orders.
    if (err?.code === 'P2010' || /unique|duplicate/i.test(String(err?.message))) return fail(reply, 409, 'PAYMENT_ALREADY_USED');
    throw err;
  }

  const state = added
    ? {
        lifelinesTotal: Number(added.lifelines_total),
        lifelinesUsed: Number(added.lifelines_used),
        lifelinesRemaining: Math.max(0, Number(added.lifelines_total) - Number(added.lifelines_used)),
      }
    : await lifelineState(prisma, memberId, order!.batchId);
  return ok(reply, { lifelineAdded: !!added, alreadyProcessed: !added, ...state });
}
