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
];

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
