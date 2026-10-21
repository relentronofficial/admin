// DB access for Expert Support Call booking. Rules live in supportCallLogic.ts;
// this file only loads rows. `db` is the Prisma client or a transaction client.
import {
  computeSupportQuota,
  SUPPORT_USAGE_COUNTS_SQL,
  APPROVED_CREDIT_PURCHASES_SQL,
  COIN_UNLOCKED_BOOKINGS_SQL,
} from './supportQuota.js';
import { categoryQuota, quotaBucketFor, type CategoryQuota, type SupportCallCategory } from './supportCallLogic.js';

type Db = { $queryRawUnsafe: <T = any>(query: string, ...values: any[]) => Promise<T> };
type TxDb = Db & { $executeRawUnsafe: (query: string, ...values: any[]) => Promise<number> };

// tbt_activity_log sources for coin-paid support calls (reference_id = booking id).
export const COIN_CALL_SPEND_SOURCE = 'support_call_unlock';
export const COIN_CALL_REFUND_SOURCE = 'support_call_refund';

export const SESSION_COLUMNS = `
  s.id, s.category, s.title, s.description, s.host_admin_id, s.host_name, s.starts_at,
  s.duration_minutes, s.capacity, s.status, s.created_at, s.updated_at,
  (s.meeting_url IS NOT NULL AND btrim(s.meeting_url) <> '') AS has_meeting_url`;

/** Session row → logic/session shape (never includes meeting_url). */
export function mapSession(r: any) {
  return {
    id: r.id as string,
    category: r.category as string,
    title: r.title as string,
    description: (r.description ?? null) as string | null,
    hostAdminId: (r.host_admin_id ?? null) as string | null,
    hostName: (r.host_name ?? null) as string | null,
    startsAt: new Date(r.starts_at),
    durationMinutes: Number(r.duration_minutes),
    capacity: Number(r.capacity),
    status: r.status as string,
    hasMeetingUrl: !!r.has_meeting_url,
  };
}

/** Reserved = this member's bookings still awaiting attendance on live sessions. */
export async function countReserved(db: Db, memberId: string, category: string): Promise<number> {
  const rows = await db.$queryRawUnsafe<any[]>(
    `SELECT COUNT(*)::int AS n FROM support_call_bookings b
     JOIN support_call_sessions s ON s.id = b.session_id
     WHERE b.member_id = $1::uuid AND b.status = 'booked' AND s.status = 'scheduled' AND s.category = $2`,
    memberId, category,
  );
  return rows[0]?.n ?? 0;
}

/** Member's quota for one category, computed exactly like GET /api/user/support-quota plus reservations. */
export async function loadCategoryQuota(
  db: Db,
  memberId: string,
  plan: string,
  category: SupportCallCategory,
): Promise<CategoryQuota> {
  const [entRows, usageRows, purchasedRows, coinRows, reserved] = await Promise.all([
    db.$queryRawUnsafe<any[]>(
      `SELECT tech_support_days, ad_support_days, group_call_count, call_credit_count, one_to_one_enabled,
              COALESCE(sales_call_count, 0) AS sales_call_count, COALESCE(content_call_count, 0) AS content_call_count
       FROM plan_entitlements WHERE plan = $1`,
      plan,
    ),
    db.$queryRawUnsafe<any[]>(SUPPORT_USAGE_COUNTS_SQL, memberId),
    db.$queryRawUnsafe<any[]>(APPROVED_CREDIT_PURCHASES_SQL, memberId),
    db.$queryRawUnsafe<any[]>(COIN_UNLOCKED_BOOKINGS_SQL, memberId),
    countReserved(db, memberId, category),
  ]);
  const quota = computeSupportQuota(plan, entRows, usageRows, [], purchasedRows, coinRows);
  return categoryQuota(quotaBucketFor(quota, category), reserved);
}

/** TBT coin balance — the same ledger sum every coin spend checks against. */
export async function loadCoinBalance(db: Db, memberId: string): Promise<number> {
  const rows = await db.$queryRawUnsafe<any[]>(
    `SELECT COALESCE(SUM(points), 0)::bigint AS balance FROM tbt_activity_log WHERE member_id = $1::uuid`,
    memberId,
  );
  return Number(rows[0]?.balance ?? 0);
}

/** Serialises this member's coin spends inside the caller's transaction. */
export async function lockCoinWallet(tx: TxDb, memberId: string): Promise<void> {
  await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtext($1))`, `coin_wallet:${memberId}`);
}

export type CoinDebitResult = { ok: true; balance: number } | { ok: false; balance: number };

/**
 * Spends `cost` coins inside the caller's transaction: wallet lock, balance
 * check and the negative ledger row, so parallel spends can't take the balance
 * below zero. On `ok: false` nothing is written. `balance` is the balance after
 * the debit (or the unchanged balance when refused).
 */
export async function debitCoins(
  tx: TxDb,
  memberId: string,
  cost: number,
  source: string,
  referenceId: string | null = null,
): Promise<CoinDebitResult> {
  await lockCoinWallet(tx, memberId);
  const balance = await loadCoinBalance(tx, memberId);
  if (!(cost > 0) || balance < cost) return { ok: false, balance };
  await tx.$executeRawUnsafe(
    `INSERT INTO tbt_activity_log (member_id, points, source, reference_id, activity_date)
     VALUES ($1::uuid, $2, $3, $4::uuid, NOW()::DATE)`,
    memberId, -cost, source, referenceId,
  );
  return { ok: true, balance: balance - cost };
}

/** Admin-set coin price for one extra call, or null when coin unlock is off. */
export async function loadCallCoinCost(db: Db, category: string): Promise<number | null> {
  const rows = await db.$queryRawUnsafe<any[]>(
    `SELECT coin_cost FROM support_call_coin_pricing WHERE category = $1`, category,
  );
  const v = rows[0]?.coin_cost;
  return v == null ? null : Number(v);
}

export async function loadAllCallCoinCosts(db: Db): Promise<Record<string, number | null>> {
  const rows = await db.$queryRawUnsafe<any[]>(`SELECT category, coin_cost FROM support_call_coin_pricing`);
  const out: Record<string, number | null> = {};
  for (const r of rows) out[r.category] = r.coin_cost == null ? null : Number(r.coin_cost);
  return out;
}

/** Refund a cancelled coin-paid booking. Idempotent per booking (unique ledger reference). */
export async function refundCallCoins(tx: TxDb, memberId: string, bookingId: string, coins: number): Promise<number> {
  if (!(coins > 0)) return 0;
  const rows = await tx.$queryRawUnsafe<any[]>(
    `INSERT INTO tbt_activity_log (member_id, points, source, reference_id, activity_date)
     VALUES ($1::uuid, $2, '${COIN_CALL_REFUND_SOURCE}', $3::uuid, NOW()::DATE)
     ON CONFLICT (member_id, source, reference_id) WHERE reference_id IS NOT NULL DO NOTHING
     RETURNING id`,
    memberId, coins, bookingId,
  );
  return rows.length > 0 ? coins : 0;
}
