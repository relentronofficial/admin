/**
 * AI credits wallet (`/api/ai-credits`). See lib/aiCredits.ts.
 *
 * Member routes (JWT cookie, always scoped to request.memberId):
 *   GET  /                        → { balance, available, purchaseAvailable, chargingEnabled, ... }
 *   GET  /packs                   → active packs
 *   GET  /history?before=ISO      → ledger entries, newest first
 *   POST /razorpay/create-order   { packId }
 *   POST /razorpay/verify         { razorpayOrderId, razorpayPaymentId, razorpaySignature }
 * Paid events also arrive through the shared Razorpay webhook
 * (POST /api/user/courses/razorpay/webhook → handleAiCreditWebhookEvent).
 *
 * Admin routes (Clerk; writes limited to admin/super_admin):
 *   GET/POST /admin/packs, PUT/DELETE /admin/packs/:id, GET /admin/orders,
 *   GET/PUT /admin/settings (pricing; charging is off until turned on here)
 */
import type { FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../../config/env.js';
import { getActingAdmin } from '../../lib/adminRole.js';
import {
  AI_CREDIT_ORDER_TYPE,
  aiCreditPackAdminDto,
  aiCreditPackSchema,
  aiCreditSettingsSchema,
  loadAiCreditSettings,
  loadAvailableAiCredits,
  creditAiOrder,
  ledgerEntryDto,
  loadAiCreditBalance,
  mapAiCreditPack,
  rupeesToPaise,
} from '../../lib/aiCredits.js';
import { getRazorpay, verifyPaymentSignature } from '../../lib/razorpay.js';
import { adjustAiCredits, aiCreditAdjustSchema } from '../../lib/aiCredits.js';
import { usableKey } from '../../lib/assistant/openRouter.js';
import { checkProviderBalance } from '../../lib/aiProviderBalance.js';
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
    const [{ balance, available }, s, typical] = await Promise.all([
      loadAvailableAiCredits(req.server.prisma, req.memberId!),
      loadAiCreditSettings(req.server.prisma),
      // What a question usually costs (median of recent charged answers), for the estimate shown before asking.
      req.server.prisma.$queryRawUnsafe<Array<{ median: number | null }>>(
        `SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY credits_charged)::float8 AS median FROM (
           SELECT credits_charged FROM help_bot_messages WHERE credits_charged > 0 AND created_at > NOW() - INTERVAL '30 days'
            ORDER BY created_at DESC LIMIT 300) x`).catch(() => [] as Array<{ median: number | null }>),
    ]);
    const median = typical[0]?.median;
    return ok(reply, {
      balance, available, purchaseAvailable: purchaseAvailable(),
      chargingEnabled: s.chargingEnabled, minCreditsToAsk: s.minCreditsToAsk, inrPerCredit: s.inrPerCredit,
      maxCreditsPerQuestion: s.maxCreditsPerQuestion, typicalCredits: median != null && median > 0 ? Math.ceil(median) : null,
    });
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

export async function adminGetSettingsHandler(req: FastifyRequest, reply: FastifyReply) {
  return ok(reply, await loadAiCreditSettings(req.server.prisma));
}

export async function adminUpdateSettingsHandler(req: FastifyRequest, reply: FastifyReply) {
  const acting = await requirePackEditor(req, reply);
  if (!acting) return reply;
  const parsed = aiCreditSettingsSchema.safeParse(req.body);
  if (!parsed.success) return fail(reply, 400, parsed.error.issues[0]?.message ?? 'Invalid settings');
  const v = parsed.data;
  await req.server.prisma.$executeRawUnsafe(
    `UPDATE ai_credit_settings SET charging_enabled = $1, usd_to_inr = $2, rate_multiplier = $3, inr_per_credit = $4,
            min_credits_to_ask = $5, max_credits_per_question = $6, updated_by = $7, updated_at = NOW()
      WHERE id = TRUE`,
    v.chargingEnabled, v.usdToInr, v.rateMultiplier, v.inrPerCredit, v.minCreditsToAsk, v.maxCreditsPerQuestion, acting.id,
  );
  return ok(reply, await loadAiCreditSettings(req.server.prisma));
}

// ── Refunds, members, usage summary, provider balance ───────────────────────

export async function adminAdjustHandler(req: FastifyRequest, reply: FastifyReply) {
  const acting = await requirePackEditor(req, reply);
  if (!acting) return reply;
  const parsed = aiCreditAdjustSchema.safeParse(req.body);
  if (!parsed.success) return fail(reply, 400, parsed.error.issues[0]?.message ?? 'Invalid request');
  const r = await adjustAiCredits(req.server.prisma as any, parsed.data, acting.id);
  switch (r.status) {
    case 'done': return ok(reply, { balance: r.balance, credits: r.credits });
    case 'member_not_found': return fail(reply, 404, 'Member not found');
    case 'not_charged': return fail(reply, 409, 'That answer was not charged, so there is nothing to refund.');
    case 'already_refunded': return fail(reply, 409, 'That answer was already refunded.');
    case 'over_charged': return fail(reply, 409, `That answer was charged ${r.charged} credits; refund at most that.`);
    case 'insufficient': return fail(reply, 409, `The member has only ${r.balance} credits; the balance cannot go below 0.`);
  }
}

/** Members with AI credit activity (no q), or a name / phone search. */
export async function adminMembersHandler(req: FastifyRequest<{ Querystring: { q?: string } }>, reply: FastifyReply) {
  const q = (req.query?.q ?? '').trim().slice(0, 60);
  const rows = q
    ? await req.server.prisma.$queryRawUnsafe<any[]>(
      `SELECT m.id, TRIM(CONCAT(m.first_name, ' ', m.last_name)) AS name, m.phone,
              COALESCE((SELECT SUM(delta) FROM ai_credit_ledger l WHERE l.member_id = m.id), 0)::int AS balance,
              (SELECT MAX(created_at) FROM ai_credit_ledger l WHERE l.member_id = m.id) AS last_at
         FROM members m
        WHERE CONCAT(m.first_name, ' ', m.last_name) ILIKE $1 OR m.phone ILIKE $1
        ORDER BY m.first_name LIMIT 20`,
      `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`,
    )
    : await req.server.prisma.$queryRawUnsafe<any[]>(
      `SELECT m.id, TRIM(CONCAT(m.first_name, ' ', m.last_name)) AS name, m.phone, x.balance, x.last_at
         FROM (SELECT member_id, SUM(delta)::int AS balance, MAX(created_at) AS last_at FROM ai_credit_ledger GROUP BY member_id) x
         JOIN members m ON m.id = x.member_id
        ORDER BY x.last_at DESC LIMIT 50`,
    );
  return ok(reply, rows.map((r) => ({
    id: String(r.id),
    name: r.name || null,
    phone: r.phone ?? null,
    balance: Number(r.balance ?? 0),
    lastActivityAt: r.last_at ? new Date(r.last_at).toISOString() : null,
  })));
}

const clip = (s: unknown, n: number) => {
  const t = String(s ?? '');
  return t.length > n ? `${t.slice(0, n)}…` : t;
};

/** One member's credits: balance, ledger, and charged answers with the question asked. */
export async function adminMemberHandler(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const id = req.params.id;
  if (!UUID_RE.test(id)) return fail(reply, 404, 'Member not found');
  const prisma = req.server.prisma;
  const m = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, TRIM(CONCAT(first_name, ' ', last_name)) AS name, phone FROM members WHERE id = $1::uuid`,
    id,
  );
  if (!m[0]) return fail(reply, 404, 'Member not found');
  const [{ balance, available }, entries, answers] = await Promise.all([
    loadAvailableAiCredits(prisma, id),
    prisma.$queryRawUnsafe<any[]>(
      `SELECT l.id, l.delta, l.source, l.note, l.reference_id, l.created_at, a.full_name AS by_name
         FROM ai_credit_ledger l LEFT JOIN admins a ON a.id::text = l.created_by
        WHERE l.member_id = $1::uuid ORDER BY l.created_at DESC LIMIT 100`,
      id,
    ),
    prisma.$queryRawUnsafe<any[]>(
      `SELECT msg.id, msg.created_at, msg.credits_charged, msg.content AS answer,
              (SELECT q.content FROM help_bot_messages q
                WHERE q.conversation_id = msg.conversation_id AND q.role = 'user' AND q.created_at <= msg.created_at
                ORDER BY q.created_at DESC LIMIT 1) AS question,
              EXISTS (SELECT 1 FROM ai_credit_ledger r WHERE r.source = 'refund' AND r.reference_id = msg.id) AS refunded
         FROM help_bot_messages msg JOIN help_bot_conversations c ON c.id = msg.conversation_id
        WHERE c.member_id = $1::uuid AND msg.role = 'assistant' AND msg.credits_charged > 0
        ORDER BY msg.created_at DESC LIMIT 30`,
      id,
    ),
  ]);
  return ok(reply, {
    member: { id, name: m[0].name || null, phone: m[0].phone ?? null },
    balance,
    available,
    entries: entries.map((e) => ({ ...ledgerEntryDto(e), byName: e.by_name || null })),
    answers: answers.map((a) => ({
      messageId: String(a.id),
      createdAt: new Date(a.created_at).toISOString(),
      credits: Number(a.credits_charged),
      question: clip(a.question, 200),
      answer: clip(a.answer, 300),
      refunded: !!a.refunded,
    })),
  });
}

const SUMMARY_DAYS = new Set([7, 30, 90]);
const istDate = (col: string) => `to_char(${col} AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD')`;

/** Usage and sales over the last N IST days, with a per-day series. */
export async function adminSummaryHandler(req: FastifyRequest<{ Querystring: { days?: string } }>, reply: FastifyReply) {
  const days = Number(req.query?.days ?? 30);
  if (!SUMMARY_DAYS.has(days)) return fail(reply, 400, 'days must be 7, 30 or 90');
  const prisma = req.server.prisma;
  // Start of the first IST day in the range.
  const since = `((date_trunc('day', NOW() AT TIME ZONE 'Asia/Kolkata') - make_interval(days => ${days - 1})) AT TIME ZONE 'Asia/Kolkata')`;
  const settings = await loadAiCreditSettings(prisma);
  const [member, admin, ledger, sales, held, dailyCost, dailyUsed, dailySales] = await Promise.all([
    prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*)::int AS answers, COUNT(*) FILTER (WHERE credits_charged > 0)::int AS charged,
              COALESCE(SUM(cost_usd), 0)::float8 AS cost,
              COALESCE(SUM(cost_usd) FILTER (WHERE credits_charged > 0), 0)::float8 AS charged_cost
         FROM help_bot_messages WHERE role = 'assistant' AND created_at >= ${since}`,
    ),
    prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*)::int AS answers, COALESCE(SUM(cost_usd), 0)::float8 AS cost
         FROM admin_assistant_messages WHERE role = 'assistant' AND created_at >= ${since}`,
    ).catch(() => [] as any[]),
    prisma.$queryRawUnsafe<any[]>(
      `SELECT source, COALESCE(SUM(delta), 0)::int AS total FROM ai_credit_ledger WHERE created_at >= ${since} GROUP BY source`,
    ),
    prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*)::int AS orders, COALESCE(SUM(amount_paise), 0)::float8 AS paise, COALESCE(SUM(credits), 0)::int AS credits
         FROM ai_credit_orders WHERE status = 'paid' AND paid_at >= ${since}`,
    ),
    prisma.$queryRawUnsafe<any[]>(`SELECT COALESCE(SUM(delta), 0)::float8 AS total FROM ai_credit_ledger`),
    prisma.$queryRawUnsafe<any[]>(
      `SELECT d, SUM(cost)::float8 AS cost FROM (
         SELECT ${istDate('created_at')} AS d, cost_usd AS cost FROM help_bot_messages WHERE role = 'assistant' AND created_at >= ${since}
         UNION ALL
         SELECT ${istDate('created_at')}, cost_usd FROM admin_assistant_messages WHERE role = 'assistant' AND created_at >= ${since}
       ) t GROUP BY d`,
    ).catch(() => [] as any[]),
    prisma.$queryRawUnsafe<any[]>(
      `SELECT ${istDate('created_at')} AS d, (-SUM(delta))::int AS used
         FROM ai_credit_ledger WHERE source = 'usage' AND created_at >= ${since} GROUP BY 1`,
    ),
    prisma.$queryRawUnsafe<any[]>(
      `SELECT ${istDate('paid_at')} AS d, SUM(amount_paise)::float8 AS paise FROM ai_credit_orders
        WHERE status = 'paid' AND paid_at >= ${since} GROUP BY 1`,
    ),
  ]);
  const bySource: Record<string, number> = Object.fromEntries(ledger.map((r) => [String(r.source), Number(r.total)]));
  const costMap = new Map(dailyCost.map((r) => [String(r.d), Number(r.cost)]));
  const usedMap = new Map(dailyUsed.map((r) => [String(r.d), Number(r.used)]));
  const salesMap = new Map(dailySales.map((r) => [String(r.d), Number(r.paise) / 100]));
  const todayIst = Date.now() + 5.5 * 3600_000;
  const series = Array.from({ length: days }, (_, i) => {
    const date = new Date(todayIst - (days - 1 - i) * 86_400_000).toISOString().slice(0, 10);
    return { date, costUsd: costMap.get(date) ?? 0, creditsUsed: usedMap.get(date) ?? 0, salesInr: salesMap.get(date) ?? 0 };
  });
  const creditsUsed = -(bySource.usage ?? 0);
  const outstanding = Number(held[0]?.total ?? 0);
  return ok(reply, {
    days,
    memberAnswers: Number(member[0]?.answers ?? 0),
    chargedAnswers: Number(member[0]?.charged ?? 0),
    memberCostUsd: Number(member[0]?.cost ?? 0),
    chargedAnswersCostUsd: Number(member[0]?.charged_cost ?? 0),
    adminAnswers: Number(admin[0]?.answers ?? 0),
    adminCostUsd: Number(admin[0]?.cost ?? 0),
    creditsUsed,
    creditsUsedInr: creditsUsed * settings.inrPerCredit,
    creditsRefunded: bySource.refund ?? 0,
    creditsGranted: bySource.grant ?? 0,
    creditsAdjusted: bySource.adjust ?? 0,
    paidOrders: Number(sales[0]?.orders ?? 0),
    salesInr: Number(sales[0]?.paise ?? 0) / 100,
    creditsSold: Number(sales[0]?.credits ?? 0),
    creditsOutstanding: outstanding,
    creditsOutstandingInr: outstanding * settings.inrPerCredit,
    usdToInr: settings.usdToInr,
    series,
  });
}

/** Checks the OpenRouter balance now (alerting admins if it is low) and returns it. */
export async function adminProviderBalanceHandler(req: FastifyRequest, reply: FastifyReply) {
  const r = await checkProviderBalance(req.server.prisma as any, {
    key: usableKey(env.OPENROUTER_API_KEY),
    io: req.server.io as any,
    log: req.log,
    force: true,
  });
  return ok(reply, r);
}

export async function adminUpdateAlertHandler(req: FastifyRequest<{ Body: { lowBalanceAlertUsd?: unknown } }>, reply: FastifyReply) {
  if (!(await requirePackEditor(req, reply))) return reply;
  const v = Number(req.body?.lowBalanceAlertUsd);
  if (!Number.isFinite(v) || v < 0 || v > 100_000) return fail(reply, 400, 'Enter an amount in US$ from 0 to 100000');
  const usd = Math.round(v * 100) / 100;
  // A new threshold re-arms the alert, so the next check reports against it.
  await req.server.prisma.$executeRawUnsafe(
    `UPDATE ai_credit_settings SET low_balance_alert_usd = $1, balance_alerted_at = NULL WHERE id = TRUE`,
    usd,
  );
  return ok(reply, { lowBalanceAlertUsd: usd });
}
