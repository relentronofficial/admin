/**
 * AI credits wallet (`/api/ai-credits`). See lib/aiCredits.ts.
 *
 * Member routes (JWT cookie, always scoped to request.memberId):
 *   GET  /                        → { balance, purchaseAvailable }
 *   GET  /packs                   → active packs
 *   GET  /history?before=ISO      → ledger entries, newest first
 *   POST /razorpay/create-order   { packId }
 *   POST /razorpay/verify         { razorpayOrderId, razorpayPaymentId, razorpaySignature }
 * Paid events also arrive through the shared Razorpay webhook
 * (POST /api/user/courses/razorpay/webhook → handleAiCreditWebhookEvent).
 *
 * Admin routes (Clerk; writes limited to admin/super_admin):
 *   GET/POST /admin/packs, PUT/DELETE /admin/packs/:id, GET /admin/orders
 */
import type { FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../../config/env.js';
import { getActingAdmin } from '../../lib/adminRole.js';
import {
  AI_CREDIT_ORDER_TYPE,
  aiCreditPackAdminDto,
  aiCreditPackSchema,
  creditAiOrder,
  ledgerEntryDto,
  loadAiCreditBalance,
  mapAiCreditPack,
  rupeesToPaise,
} from '../../lib/aiCredits.js';
import { getRazorpay, verifyPaymentSignature } from '../../lib/razorpay.js';
import { isFullAccessRole } from '../../lib/supportCallLogic.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HISTORY_PAGE = 30;

const ok = (reply: FastifyReply, data: unknown, meta?: object) =>
  reply.send({ success: true, data, error: null, ...(meta && { meta }) });
const fail = (reply: FastifyReply, status: number, message: string) =>
  reply.status(status).send({ success: false, data: null, error: { code: 'ERROR', message } });

const purchaseAvailable = () => !!(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);

// ── Member ──────────────────────────────────────────────────────────────────

export async function walletHandler(req: FastifyRequest, reply: FastifyReply) {
  try {
    return ok(reply, { balance: await loadAiCreditBalance(req.server.prisma, req.memberId!), purchaseAvailable: purchaseAvailable() });
  } catch (err) {
    req.log.error({ err }, 'ai credit balance read failed');
    return fail(reply, 503, 'Could not load your AI credits');
  }
}

export async function packsHandler(req: FastifyRequest, reply: FastifyReply) {
  const rows = await req.server.prisma.$queryRawUnsafe<any[]>(
    `SELECT id, label, credits, price_inr FROM ai_credit_packs WHERE is_active = TRUE ORDER BY sort_order ASC, price_inr ASC`,
  );
  return ok(reply, { packs: rows.map(mapAiCreditPack), purchaseAvailable: purchaseAvailable() });
}

export async function historyHandler(req: FastifyRequest<{ Querystring: { before?: string } }>, reply: FastifyReply) {
  const before = req.query?.before;
  if (before != null && Number.isNaN(Date.parse(before))) return fail(reply, 400, 'Invalid cursor');
  const rows = await req.server.prisma.$queryRawUnsafe<any[]>(
    `SELECT id, delta, source, note, created_at FROM ai_credit_ledger
      WHERE member_id = $1::uuid AND ($2::timestamptz IS NULL OR created_at < $2::timestamptz)
      ORDER BY created_at DESC LIMIT ${HISTORY_PAGE}`,
    req.memberId!, before ?? null,
  );
  const items = rows.map(ledgerEntryDto);
  return ok(reply, items, { nextBefore: items.length === HISTORY_PAGE ? items[items.length - 1].createdAt : null });
}

export async function createOrderHandler(req: FastifyRequest, reply: FastifyReply) {
  const memberId = req.memberId!;
  if (!purchaseAvailable()) return fail(reply, 503, 'RAZORPAY_NOT_CONFIGURED');
  const { packId } = (req.body ?? {}) as { packId?: unknown };
  if (typeof packId !== 'string' || !UUID_RE.test(packId)) return fail(reply, 404, 'PACK_NOT_FOUND');
  const rows = await req.server.prisma.$queryRawUnsafe<any[]>(
    `SELECT id, label, credits, price_inr FROM ai_credit_packs WHERE id = $1::uuid AND is_active = TRUE`, packId,
  );
  if (!rows[0]) return fail(reply, 404, 'PACK_NOT_FOUND');
  const pack = mapAiCreditPack(rows[0]);
  const amountPaise = rupeesToPaise(pack.priceInr);

  let rzpOrder: any;
  try {
    rzpOrder = await getRazorpay().orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: `tbt-ai-${memberId.slice(0, 8)}-${Date.now()}`,
      notes: { memberId, type: AI_CREDIT_ORDER_TYPE, credits: String(pack.credits), packId: pack.id },
    });
  } catch {
    return fail(reply, 500, 'ORDER_CREATE_FAILED');
  }
  // Credits and amount are fixed here; /verify and the webhook read them back from this row.
  try {
    await req.server.prisma.$executeRawUnsafe(
      `INSERT INTO ai_credit_orders (member_id, razorpay_order_id, pack_id, credits, amount_paise, currency)
       VALUES ($1::uuid, $2, $3::uuid, $4, $5, 'INR')`,
      memberId, rzpOrder.id, pack.id, pack.credits, amountPaise,
    );
  } catch (err) {
    req.log.error({ err }, 'ai credit order record failed');
    return fail(reply, 500, 'ORDER_CREATE_FAILED');
  }
  return ok(reply, { orderId: rzpOrder.id, amount: amountPaise, currency: 'INR', keyId: env.RAZORPAY_KEY_ID, credits: pack.credits, packId: pack.id });
}

export async function verifyHandler(req: FastifyRequest, reply: FastifyReply) {
  const memberId = req.memberId!;
  if (!purchaseAvailable()) return fail(reply, 503, 'RAZORPAY_NOT_CONFIGURED');
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = (req.body ?? {}) as any;
  if (
    typeof razorpayOrderId !== 'string' || typeof razorpayPaymentId !== 'string' || typeof razorpaySignature !== 'string' ||
    !verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature)
  ) {
    return fail(reply, 400, 'SIGNATURE_INVALID');
  }
  const result = await creditAiOrder(req.server.prisma as any, { razorpayOrderId, razorpayPaymentId, memberId });
  if (result.status === 'not_found') return fail(reply, 404, 'ORDER_NOT_FOUND');
  if (result.status === 'amount_mismatch') return fail(reply, 409, 'AMOUNT_MISMATCH');
  const credited = result.status === 'credited';
  return ok(reply, {
    creditsAdded: credited ? result.credits : 0,
    balance: await loadAiCreditBalance(req.server.prisma, memberId),
    alreadyProcessed: !credited,
  });
}

// ── Admin ───────────────────────────────────────────────────────────────────

async function requirePackEditor(req: FastifyRequest, reply: FastifyReply) {
  const acting = await getActingAdmin(req);
  if (!acting || !isFullAccessRole(acting.role)) {
    fail(reply, 403, 'Only Admin and Super Admin accounts can manage AI credits.');
    return null;
  }
  return acting;
}

/** Admin scope hook: AI credit sales and packs are for Admin and Super Admin only. */
export async function requireFullAccessAdmin(req: FastifyRequest, reply: FastifyReply) {
  if (!(await requirePackEditor(req, reply))) return reply;
}

const PACK_COLS = 'id, label, credits, price_inr, is_active, sort_order';

export async function adminListPacksHandler(req: FastifyRequest, reply: FastifyReply) {
  const rows = await req.server.prisma.$queryRawUnsafe<any[]>(
    `SELECT ${PACK_COLS} FROM ai_credit_packs ORDER BY sort_order ASC, price_inr ASC`,
  );
  return ok(reply, rows.map(aiCreditPackAdminDto));
}

export async function adminCreatePackHandler(req: FastifyRequest, reply: FastifyReply) {
  if (!(await requirePackEditor(req, reply))) return reply;
  const parsed = aiCreditPackSchema.safeParse(req.body);
  if (!parsed.success) return fail(reply, 400, parsed.error.issues[0]?.message ?? 'Invalid pack');
  const { label, credits, priceInr, isActive = true, sortOrder = 0 } = parsed.data;
  const rows = await req.server.prisma.$queryRawUnsafe<any[]>(
    `INSERT INTO ai_credit_packs (label, credits, price_inr, is_active, sort_order) VALUES ($1, $2, $3, $4, $5) RETURNING ${PACK_COLS}`,
    label, credits, priceInr, isActive, sortOrder,
  );
  return reply.status(201).send({ success: true, data: aiCreditPackAdminDto(rows[0]), error: null });
}

export async function adminUpdatePackHandler(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  if (!(await requirePackEditor(req, reply))) return reply;
  if (!UUID_RE.test(req.params.id)) return fail(reply, 404, 'Pack not found');
  const parsed = aiCreditPackSchema.safeParse(req.body);
  if (!parsed.success) return fail(reply, 400, parsed.error.issues[0]?.message ?? 'Invalid pack');
  const { label, credits, priceInr, isActive = true, sortOrder = 0 } = parsed.data;
  // Orders already created keep the credits and amount fixed on them.
  const rows = await req.server.prisma.$queryRawUnsafe<any[]>(
    `UPDATE ai_credit_packs SET label = $2, credits = $3, price_inr = $4, is_active = $5, sort_order = $6, updated_at = NOW()
      WHERE id = $1::uuid RETURNING ${PACK_COLS}`,
    req.params.id, label, credits, priceInr, isActive, sortOrder,
  );
  if (!rows[0]) return fail(reply, 404, 'Pack not found');
  return ok(reply, aiCreditPackAdminDto(rows[0]));
}

export async function adminDeletePackHandler(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  if (!(await requirePackEditor(req, reply))) return reply;
  if (!UUID_RE.test(req.params.id)) return fail(reply, 404, 'Pack not found');
  const n = await req.server.prisma.$executeRawUnsafe(`DELETE FROM ai_credit_packs WHERE id = $1::uuid`, req.params.id);
  if (!n) return fail(reply, 404, 'Pack not found');
  return ok(reply, { id: req.params.id });
}

const ORDER_STATUSES = new Set(['created', 'paid', 'failed']);

export async function adminListOrdersHandler(req: FastifyRequest<{ Querystring: { status?: string } }>, reply: FastifyReply) {
  const status = req.query?.status;
  if (status != null && !ORDER_STATUSES.has(status)) return fail(reply, 400, 'Invalid status');
  const rows = await req.server.prisma.$queryRawUnsafe<any[]>(
    `SELECT o.id, o.member_id, TRIM(CONCAT(m.first_name, ' ', m.last_name)) AS member_name, o.credits, o.amount_paise,
            o.status, o.razorpay_order_id, o.failure_reason, o.created_at, o.paid_at, p.label AS pack_label
       FROM ai_credit_orders o
       JOIN members m ON m.id = o.member_id
       LEFT JOIN ai_credit_packs p ON p.id = o.pack_id
      WHERE ($1::text IS NULL OR o.status = $1)
      ORDER BY o.created_at DESC LIMIT 200`,
    status ?? null,
  );
  return ok(reply, rows.map((r) => ({
    id: String(r.id),
    memberId: String(r.member_id),
    memberName: r.member_name || null,
    packLabel: r.pack_label ?? null,
    credits: Number(r.credits),
    amountInr: Number(r.amount_paise) / 100,
    status: String(r.status),
    razorpayOrderId: String(r.razorpay_order_id),
    failureReason: r.failure_reason ?? null,
    createdAt: new Date(r.created_at).toISOString(),
    paidAt: r.paid_at ? new Date(r.paid_at).toISOString() : null,
  })));
}
