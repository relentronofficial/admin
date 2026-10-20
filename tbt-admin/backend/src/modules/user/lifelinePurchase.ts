// Extra Lifeline purchase via Razorpay (member, JWT cookie — /api/user/*).
//
//   POST /api/user/lifelines/razorpay/create-order
//   POST /api/user/lifelines/razorpay/verify
//   + the lifeline branch of the Razorpay webhook (handleLifelineWebhookEvent,
//     called from razorpayWebhookHandler after its signature check)
//
// Same shape as the TBT coin purchase (controller.ts createCoinOrderHandler /
// verifyCoinPaymentHandler), but sells exactly one program lifeline at the
// admin-configured credit_pricing price. The order is stored server-side
// (lifeline_razorpay_orders) so every crediting path can check ownership and
// amount. Crediting itself — verify, webhook and the reconciliation job alike —
// goes through lib/lifelineCredit.ts creditLifelineOrder, which credits each
// order at most once.
import type { FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../../config/env.js';
import { getRazorpay, verifyPaymentSignature } from '../../lib/razorpay.js';
import { LIFELINE_CREDIT_TYPE, LIFELINE_ORDER_TYPE, priceInrToPaise } from '../../lib/lifelinePurchaseLogic.js';
import { creditLifelineOrder, liveLifelineRazorpayReader } from '../../lib/lifelineCredit.js';

function ok(reply: FastifyReply, data: unknown) {
  return reply.send({ success: true, data, error: null });
}

function fail(reply: FastifyReply, status: number, message: string) {
  return reply.status(status).send({ success: false, data: null, error: { code: 'ERROR', message } });
}

const razorpayConfigured = () => !!env.RAZORPAY_KEY_ID && !!env.RAZORPAY_KEY_SECRET;

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

  const outcome = await creditLifelineOrder(request.server.prisma, liveLifelineRazorpayReader, {
    orderId: razorpayOrderId,
    paymentId: razorpayPaymentId,
    actingMemberId: memberId,
  });
  if (outcome.kind === 'credited') return ok(reply, { lifelineAdded: true, alreadyProcessed: false, ...outcome.state });
  if (outcome.kind === 'already') return ok(reply, { lifelineAdded: false, alreadyProcessed: true, ...outcome.state });
  return fail(reply, outcome.httpStatus, outcome.code);
}

/** Webhook events that can mean a lifeline order was paid. */
const PAID_EVENTS = new Set(['payment.captured', 'order.paid']);

/**
 * Lifeline branch of the Razorpay webhook. Called by razorpayWebhookHandler
 * AFTER it verified the signature over the raw body. Returns null when the
 * event is not about a lifeline order (the caller then runs its unchanged
 * course-payment logic).
 *
 * The event payload is only used to find which order/payment to look at:
 * the order must exist in lifeline_razorpay_orders, and creditLifelineOrder
 * re-fetches the order and payment from Razorpay and checks them before
 * crediting. Duplicate deliveries are acknowledged without crediting again.
 *
 * Status codes: 200 = done or nothing to do (Razorpay stops retrying);
 * 503 = transient (Razorpay/DB unavailable, payment not settled yet) — Razorpay
 * retries the delivery.
 */
export async function handleLifelineWebhookEvent(
  prisma: any,
  body: any,
  log?: { warn: (obj: unknown, msg: string) => void },
): Promise<{ status: number; payload: { ok: boolean } } | null> {
  const payment = body?.payload?.payment?.entity;
  const orderId: unknown = payment?.order_id ?? body?.payload?.order?.entity?.id;
  if (typeof orderId !== 'string' || !orderId) return null;

  let known: any[];
  try {
    known = await prisma.$queryRawUnsafe(`SELECT 1 FROM lifeline_razorpay_orders WHERE order_id = $1`, orderId);
  } catch (err: any) {
    // Table missing (startup DDL never ran) → no lifeline orders can exist: leave
    // the event to the course logic so course webhooks keep working.
    const code = err?.meta?.code ?? err?.code;
    if (code === '42P01' || /42P01|relation .* does not exist/i.test(String(err?.message ?? ''))) return null;
    return { status: 503, payload: { ok: false } };
  }
  if (known.length === 0) return null; // not a lifeline order → course logic

  // Failed/refund and other events for a lifeline order need no action.
  if (!PAID_EVENTS.has(body?.event)) return { status: 200, payload: { ok: true } };
  const paymentId: unknown = payment?.id;
  if (typeof paymentId !== 'string' || !paymentId) return { status: 200, payload: { ok: true } };

  const outcome = await creditLifelineOrder(prisma, liveLifelineRazorpayReader, { orderId, paymentId });
  if (outcome.kind === 'credited' || outcome.kind === 'already') return { status: 200, payload: { ok: true } };
  if (outcome.kind === 'rejected') {
    // Retrying cannot fix a mismatch — acknowledge, and leave a trace for support (no payment details).
    log?.warn({ code: outcome.code }, '[lifeline-webhook] paid event not credited');
    return { status: 200, payload: { ok: true } };
  }
  return { status: 503, payload: { ok: false } };
}
