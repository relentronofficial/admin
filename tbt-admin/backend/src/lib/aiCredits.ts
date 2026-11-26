// AI credits: the paid wallet members spend on the TBT Assistant.
//
// Members buy credit packs through Razorpay. Every order gets an
// ai_credit_orders row when it is created, which fixes who it belongs to, how
// many credits it buys and the amount charged; crediting reads those values
// from the row, never from the client. The row's UUID is the ledger reference,
// so /verify and the webhook can both run for the same payment and the credits
// land exactly once (same design as TBT coin orders, lib/coinOrders.ts).
//
// The balance is the sum of ai_credit_ledger.delta. AI credits are separate
// from TBT coins on purpose: coins are earned free through gamification,
// while every AI credit is backed by money paid for the AI provider.
import { z } from 'zod';

export const AI_CREDIT_ORDER_TYPE = 'ai_credit_purchase';

/** Ledger sources. 'usage' (Phase 2) is negative; the rest are positive except 'adjust'. */
export const AI_CREDIT_SOURCES = ['purchase', 'usage', 'refund', 'grant', 'adjust'] as const;
export type AiCreditSource = (typeof AI_CREDIT_SOURCES)[number];

export const AI_CREDITS_DDL = [
  `CREATE TABLE IF NOT EXISTS ai_credit_packs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label       VARCHAR(120) NOT NULL,
    credits     INT NOT NULL CHECK (credits > 0),
    price_inr   DECIMAL(10,2) NOT NULL CHECK (price_inr > 0),
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order  INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS ai_credit_orders (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id           UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    razorpay_order_id   VARCHAR(64) NOT NULL UNIQUE,
    pack_id             UUID REFERENCES ai_credit_packs(id) ON DELETE SET NULL,
    credits             INT NOT NULL CHECK (credits > 0),
    amount_paise        INT NOT NULL CHECK (amount_paise > 0),
    currency            VARCHAR(10) NOT NULL DEFAULT 'INR',
    status              VARCHAR(20) NOT NULL DEFAULT 'created',
    razorpay_payment_id VARCHAR(64),
    failure_reason      TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    paid_at             TIMESTAMPTZ
  )`,
  `CREATE INDEX IF NOT EXISTS idx_ai_credit_orders_member ON ai_credit_orders(member_id, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS ai_credit_ledger (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id     UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    delta         INT NOT NULL CHECK (delta <> 0),
    source        VARCHAR(20) NOT NULL CHECK (source IN ('purchase','usage','refund','grant','adjust')),
    reference_id  UUID,
    note          TEXT,
    created_by    TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  // One ledger row per (source, reference): a paid order is credited once.
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_credit_ledger_ref ON ai_credit_ledger(source, reference_id) WHERE reference_id IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS idx_ai_credit_ledger_member ON ai_credit_ledger(member_id, created_at DESC)`,
  // Pricing. Charging stays off until an admin turns it on.
  `CREATE TABLE IF NOT EXISTS ai_credit_settings (
    id                        BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
    charging_enabled          BOOLEAN NOT NULL DEFAULT FALSE,
    usd_to_inr                NUMERIC(10,4) NOT NULL DEFAULT 90 CHECK (usd_to_inr > 0),
    rate_multiplier           NUMERIC(6,3) NOT NULL DEFAULT 1.10 CHECK (rate_multiplier >= 1),
    inr_per_credit            NUMERIC(10,4) NOT NULL DEFAULT 0.10 CHECK (inr_per_credit > 0),
    min_credits_to_ask        INT NOT NULL DEFAULT 10 CHECK (min_credits_to_ask > 0),
    max_credits_per_question  INT NOT NULL DEFAULT 60 CHECK (max_credits_per_question > 0),
    updated_by                TEXT,
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `INSERT INTO ai_credit_settings (id) VALUES (TRUE) ON CONFLICT DO NOTHING`,
  // Credits set aside while a question is being answered, so parallel questions
  // cannot spend the same credits. A hold left behind by a crash lapses.
  `CREATE TABLE IF NOT EXISTS ai_credit_holds (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id   UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    credits     INT NOT NULL CHECK (credits > 0),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at  TIMESTAMPTZ NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_ai_credit_holds_member ON ai_credit_holds(member_id, expires_at)`,
  // AI provider (OpenRouter) balance watch: alert admins below a threshold (lib/aiProviderBalance.ts).
  `ALTER TABLE ai_credit_settings
    ADD COLUMN IF NOT EXISTS low_balance_alert_usd NUMERIC(10,2) NOT NULL DEFAULT 10,
    ADD COLUMN IF NOT EXISTS balance_checked_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS balance_alerted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_balance_usd NUMERIC(12,4),
    ADD COLUMN IF NOT EXISTS last_balance_source VARCHAR(20)`,
];

// ── Admin changes to a member's credits ─────────────────────────────────────

/**
 * grant  — free credits (credits > 0)
 * refund — credits back for one charged answer (messageId, at most what it was charged) or a general refund (credits > 0)
 * adjust — a correction either way; never takes the balance below 0
 */
export const aiCreditAdjustSchema = z.object({
  memberId: z.string().uuid('Pick a member'),
  kind: z.enum(['grant', 'refund', 'adjust']),
  credits: z.number().int('Credits must be a whole number').refine((v) => v !== 0, 'Credits cannot be 0')
    .refine((v) => Math.abs(v) <= 1_000_000, 'Too many credits'),
  note: z.string().trim().min(3, 'Add a short reason').max(300),
  messageId: z.string().uuid().optional(),
}).superRefine((v, ctx) => {
  if (v.kind !== 'adjust' && v.credits < 0) ctx.addIssue({ code: 'custom', message: 'Credits must be above 0', path: ['credits'] });
  if (v.messageId && v.kind !== 'refund') ctx.addIssue({ code: 'custom', message: 'Only a refund can name an answer', path: ['messageId'] });
});
export type AiCreditAdjust = z.infer<typeof aiCreditAdjustSchema>;

export type AdjustResult =
  | { status: 'done'; balance: number; credits: number }
  | { status: 'member_not_found' }
  | { status: 'not_charged' }
  | { status: 'over_charged'; charged: number }
  | { status: 'already_refunded' }
  | { status: 'insufficient'; balance: number };

/** Applies an admin grant / refund / adjustment under the member's credits lock. */
export async function adjustAiCredits(prisma: Prisma, input: AiCreditAdjust, adminId: string): Promise<AdjustResult> {
  return prisma.$transaction(async (tx) => {
    const member = await tx.$queryRawUnsafe<any[]>(`SELECT 1 FROM members WHERE id = $1::uuid`, input.memberId);
    if (!member.length) return { status: 'member_not_found' } as const;
    await tx.$queryRawUnsafe(`SELECT pg_advisory_xact_lock(hashtext('ai-credits:' || $1))`, input.memberId);
    if (input.messageId) {
      const used = await tx.$queryRawUnsafe<any[]>(
        `SELECT -delta AS charged FROM ai_credit_ledger WHERE source = 'usage' AND reference_id = $1::uuid AND member_id = $2::uuid`,
        input.messageId, input.memberId,
      );
      if (!used.length) return { status: 'not_charged' } as const;
      const charged = Number(used[0].charged);
      if (input.credits > charged) return { status: 'over_charged', charged } as const;
    }
    const balance = await loadAiCreditBalance(tx, input.memberId);
    if (balance + input.credits < 0) return { status: 'insufficient', balance } as const;
    const rows = await tx.$queryRawUnsafe<any[]>(
      `INSERT INTO ai_credit_ledger (member_id, delta, source, reference_id, note, created_by)
       VALUES ($1::uuid, $2, $3, $4::uuid, $5, $6)
       ON CONFLICT (source, reference_id) WHERE reference_id IS NOT NULL DO NOTHING
       RETURNING id`,
      input.memberId, input.credits, input.kind, input.messageId ?? null, input.note, adminId,
    );
    if (!rows.length) return { status: 'already_refunded' } as const;
    return { status: 'done', balance: balance + input.credits, credits: input.credits } as const;
  });
}

// ── Charging for answers ────────────────────────────────────────────────────

export interface AiCreditSettings {
  chargingEnabled: boolean;
  usdToInr: number;
  rateMultiplier: number;
  inrPerCredit: number;
  minCreditsToAsk: number;
  maxCreditsPerQuestion: number;
}

export const DEFAULT_AI_CREDIT_SETTINGS: AiCreditSettings = {
  chargingEnabled: false, usdToInr: 90, rateMultiplier: 1.1, inrPerCredit: 0.1, minCreditsToAsk: 10, maxCreditsPerQuestion: 60,
};

export const aiCreditSettingsSchema = z.object({
  chargingEnabled: z.boolean(),
  usdToInr: z.number().positive().max(1000),
  rateMultiplier: z.number().min(1, 'The rate multiplier cannot be below 1').max(10),
  inrPerCredit: z.number().positive().max(1000),
  minCreditsToAsk: z.number().int().positive().max(100_000),
  maxCreditsPerQuestion: z.number().int().positive().max(100_000),
}).refine((s) => s.minCreditsToAsk <= s.maxCreditsPerQuestion, { message: 'The minimum to ask cannot be above the most one question may use' });

/** How long a hold lasts; longer than the slowest answer (10 AI calls at 60 s would be cut by the client anyway). */
export const HOLD_MINUTES = 15;

/** Credits for an AI cost: provider cost in USD → rupees → credits, rounded up. Free answers cost 0. */
export function creditsForCost(costUsd: number, s: AiCreditSettings): number {
  if (!(costUsd > 0)) return 0;
  const inr = costUsd * s.usdToInr * s.rateMultiplier;
  // Round to 6 places first so float noise (e.g. 3.0000000004) does not add a credit.
  return Math.max(1, Math.ceil(Number((inr / s.inrPerCredit).toFixed(6))));
}

/** The provider spend (USD) that `credits` pays for: the loop stops spending past it. */
export function costCapUsd(credits: number, s: AiCreditSettings): number {
  return (credits * s.inrPerCredit) / (s.usdToInr * s.rateMultiplier);
}

/** How much to set aside for one question, or null when the member cannot ask. */
export function holdFor(available: number, s: AiCreditSettings): number | null {
  if (available < s.minCreditsToAsk) return null;
  return Math.min(available, s.maxCreditsPerQuestion);
}

export function mapAiCreditSettings(r: any): AiCreditSettings {
  if (!r) return { ...DEFAULT_AI_CREDIT_SETTINGS };
  return {
    chargingEnabled: !!r.charging_enabled,
    usdToInr: Number(r.usd_to_inr),
    rateMultiplier: Number(r.rate_multiplier),
    inrPerCredit: Number(r.inr_per_credit),
    minCreditsToAsk: Number(r.min_credits_to_ask),
    maxCreditsPerQuestion: Number(r.max_credits_per_question),
  };
}

export async function loadAiCreditSettings(db: Db): Promise<AiCreditSettings> {
  const rows = await db.$queryRawUnsafe<any[]>(`SELECT * FROM ai_credit_settings WHERE id = TRUE`);
  return mapAiCreditSettings(rows[0]);
}

/** Balance minus credits set aside for questions still being answered. */
export async function loadAvailableAiCredits(db: Db, memberId: string): Promise<{ balance: number; available: number }> {
  const rows = await db.$queryRawUnsafe<any[]>(
    `SELECT (SELECT COALESCE(SUM(delta), 0) FROM ai_credit_ledger WHERE member_id = $1::uuid)::int AS balance,
            (SELECT COALESCE(SUM(credits), 0) FROM ai_credit_holds WHERE member_id = $1::uuid AND expires_at > NOW())::int AS held`,
    memberId,
  );
  const balance = Number(rows[0]?.balance ?? 0);
  return { balance, available: balance - Number(rows[0]?.held ?? 0) };
}

export type HoldResult = { ok: true; holdId: string; credits: number } | { ok: false; available: number };

/** Sets credits aside for one question. Serialised per member, so two questions cannot both pass on the same credits. */
export async function reserveAiCredits(prisma: Prisma, memberId: string, s: AiCreditSettings): Promise<HoldResult> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRawUnsafe(`SELECT pg_advisory_xact_lock(hashtext('ai-credits:' || $1))`, memberId);
    await tx.$executeRawUnsafe(`DELETE FROM ai_credit_holds WHERE member_id = $1::uuid AND expires_at <= NOW()`, memberId);
    const { available } = await loadAvailableAiCredits(tx, memberId);
    const credits = holdFor(available, s);
    if (credits == null) return { ok: false, available } as const;
    const rows = await tx.$queryRawUnsafe<any[]>(
      `INSERT INTO ai_credit_holds (member_id, credits, expires_at) VALUES ($1::uuid, $2, NOW() + INTERVAL '${HOLD_MINUTES} minutes') RETURNING id::text`,
      memberId, credits,
    );
    return { ok: true, holdId: String(rows[0].id), credits } as const;
  });
}

/**
 * Ends a hold: charges `credits` (never more than were held) against the answer
 * `messageId`, or just releases it when credits is 0. Returns the credits charged.
 */
export async function settleAiCredits(
  prisma: Prisma,
  input: { memberId: string; holdId: string; held: number; credits: number; messageId: string | null },
): Promise<number> {
  const charge = Math.max(0, Math.min(Math.floor(input.credits), input.held));
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`DELETE FROM ai_credit_holds WHERE id = $1::uuid AND member_id = $2::uuid`, input.holdId, input.memberId);
    // A hold that lapsed (very slow answer) still charges: the answer was given.
    if (charge === 0 || !input.messageId) return 0;
    const rows = await tx.$queryRawUnsafe<any[]>(
      `INSERT INTO ai_credit_ledger (member_id, delta, source, reference_id, note)
       VALUES ($1::uuid, $2, 'usage', $3::uuid, 'Assistant answer')
       ON CONFLICT (source, reference_id) WHERE reference_id IS NOT NULL DO NOTHING
       RETURNING id`,
      input.memberId, -charge, input.messageId,
    );
    if (!rows.length) return 0;
    await tx.$executeRawUnsafe(`UPDATE help_bot_messages SET credits_charged = $2 WHERE id = $1::uuid`, input.messageId, charge);
    return charge;
  });
}

/** Releases a hold without charging (the answer failed or was never given). */
export async function releaseAiCredits(db: Tx, memberId: string, holdId: string): Promise<void> {
  await db.$executeRawUnsafe(`DELETE FROM ai_credit_holds WHERE id = $1::uuid AND member_id = $2::uuid`, holdId, memberId);
}

export const aiCreditPackSchema = z.object({
  label: z.string().trim().min(1, 'Label is required').max(120),
  credits: z.number().int().positive('Credits must be above 0').max(10_000_000),
  priceInr: z.number().positive('Price must be above 0').max(10_000_000)
    .refine((v) => Math.round(v * 100) === v * 100, { message: 'Price can have at most 2 decimals' }),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export interface AiCreditPack { id: string; label: string; credits: number; priceInr: number }

export function mapAiCreditPack(r: any): AiCreditPack {
  return { id: String(r.id), label: String(r.label), credits: Number(r.credits), priceInr: Number(r.price_inr) };
}

export function aiCreditPackAdminDto(r: any) {
  return { ...mapAiCreditPack(r), isActive: !!r.is_active, sortOrder: Number(r.sort_order ?? 0) };
}

export function rupeesToPaise(priceInr: number): number {
  return Math.round(priceInr * 100);
}

export function ledgerEntryDto(r: any) {
  return {
    id: String(r.id),
    delta: Number(r.delta),
    source: String(r.source) as AiCreditSource,
    note: r.note ?? null,
    createdAt: new Date(r.created_at).toISOString(),
  };
}

type Db = { $queryRawUnsafe: <T = any>(query: string, ...values: any[]) => Promise<T> };
type Tx = Db & { $executeRawUnsafe: (query: string, ...values: any[]) => Promise<number> };
type Prisma = { $transaction: <T>(fn: (tx: Tx) => Promise<T>) => Promise<T> };

export async function loadAiCreditBalance(db: Db, memberId: string): Promise<number> {
  const rows = await db.$queryRawUnsafe<any[]>(
    `SELECT COALESCE(SUM(delta), 0)::int AS balance FROM ai_credit_ledger WHERE member_id = $1::uuid`,
    memberId,
  );
  return Number(rows[0]?.balance ?? 0);
}

export type AiCreditResult =
  | { status: 'credited'; credits: number; memberId: string }
  | { status: 'already_credited'; credits: number; memberId: string }
  | { status: 'not_found' }
  | { status: 'amount_mismatch' };

/**
 * Credits a paid AI credit order once. `memberId` (from /verify) scopes the
 * lookup to the caller: another member's order behaves as not found.
 * `amountPaise` (from the webhook's payment entity) must match the order.
 */
export async function creditAiOrder(
  prisma: Prisma,
  input: { razorpayOrderId: string; razorpayPaymentId: string; memberId?: string; amountPaise?: number },
): Promise<AiCreditResult> {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRawUnsafe<any[]>(
      `SELECT id, member_id, credits, amount_paise, status FROM ai_credit_orders WHERE razorpay_order_id = $1 FOR UPDATE`,
      input.razorpayOrderId,
    );
    const order = rows[0];
    if (!order || (input.memberId && order.member_id !== input.memberId)) return { status: 'not_found' } as const;
    if (input.amountPaise != null && Number(order.amount_paise) !== Number(input.amountPaise)) {
      return { status: 'amount_mismatch' } as const;
    }
    const credits = Number(order.credits);
    const memberId = String(order.member_id);
    if (order.status === 'paid') return { status: 'already_credited', credits, memberId } as const;

    const inserted = await tx.$queryRawUnsafe<any[]>(
      `INSERT INTO ai_credit_ledger (member_id, delta, source, reference_id, note)
       VALUES ($1::uuid, $2, 'purchase', $3::uuid, $4)
       ON CONFLICT (source, reference_id) WHERE reference_id IS NOT NULL DO NOTHING
       RETURNING id`,
      memberId, credits, order.id, 'Bought AI credits',
    );
    await tx.$executeRawUnsafe(
      `UPDATE ai_credit_orders SET status = 'paid', razorpay_payment_id = $2, paid_at = NOW(), failure_reason = NULL
       WHERE id = $1::uuid`,
      order.id, input.razorpayPaymentId,
    );
    if (inserted.length === 0) return { status: 'already_credited', credits, memberId } as const;
    return { status: 'credited', credits, memberId } as const;
  });
}

const PAID_EVENTS = new Set(['payment.captured', 'order.paid']);

const isMissingRelation = (err: any) => /relation .* does not exist/i.test(String(err?.message ?? ''));

/**
 * Razorpay webhook events for AI credit orders. Returns null when the order is
 * not an AI credit order, so the caller's coin/course logic handles it.
 */
export async function handleAiCreditWebhookEvent(
  prisma: Prisma & Tx,
  body: any,
  log?: { warn: (obj: unknown, msg: string) => void; error: (obj: unknown, msg: string) => void },
): Promise<{ status: number; payload: { ok: boolean } } | null> {
  const payment = body?.payload?.payment?.entity;
  const orderId: unknown = payment?.order_id ?? body?.payload?.order?.entity?.id;
  if (typeof orderId !== 'string' || !orderId) return null;

  let known: any[];
  try {
    known = await prisma.$queryRawUnsafe<any[]>(`SELECT 1 FROM ai_credit_orders WHERE razorpay_order_id = $1`, orderId);
  } catch (err) {
    // Leave the event to the coin/course logic. If the database is really down
    // that logic fails too and answers 500, so Razorpay retries the event.
    if (!isMissingRelation(err)) log?.error({ err, orderId }, '[ai-credits] order lookup failed');
    return null;
  }
  if (known.length === 0) return null;

  if (body?.event === 'payment.failed') {
    // A failed attempt never credits; a later successful attempt on the same order still can.
    await prisma.$executeRawUnsafe(
      `UPDATE ai_credit_orders SET status = 'failed', failure_reason = $2 WHERE razorpay_order_id = $1 AND status = 'created'`,
      orderId, String(payment?.error_description ?? 'payment.failed').slice(0, 500),
    ).catch(() => {});
    return { status: 200, payload: { ok: true } };
  }
  if (!PAID_EVENTS.has(body?.event)) {
    if (String(body?.event ?? '').startsWith('refund.')) log?.warn({ orderId, event: body.event }, '[ai-credits] refund event: adjust credits by hand');
    return { status: 200, payload: { ok: true } };
  }
  const paymentId: unknown = payment?.id;
  if (typeof paymentId !== 'string' || !paymentId) return { status: 200, payload: { ok: true } };

  try {
    const r = await creditAiOrder(prisma, {
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
      amountPaise: payment?.amount != null ? Number(payment.amount) : undefined,
    });
    // Retrying cannot fix a mismatch: acknowledge it and leave a trace for support.
    if (r.status === 'amount_mismatch') log?.error({ orderId }, '[ai-credits] webhook amount mismatch: not credited');
    return { status: 200, payload: { ok: true } };
  } catch (err) {
    log?.error({ err, orderId }, '[ai-credits] webhook credit failed');
    // 500 so Razorpay retries the event later.
    return { status: 500, payload: { ok: false } };
  }
}
