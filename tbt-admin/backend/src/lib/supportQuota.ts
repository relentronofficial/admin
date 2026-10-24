// Pure computation behind GET /api/support-entitlements/member/:memberId and
// GET /api/user/support-quota — no I/O, so the allocated/used/remaining math
// can be unit-tested without a database.
export interface PlanEntitlementRow {
  tech_support_days: number;
  ad_support_days: number;
  group_call_count: number;
  call_credit_count: number;
  one_to_one_enabled: boolean;
  sales_call_count?: number;
  content_call_count?: number;
}

export interface UsageCountRow {
  type: string;
  cnt: number;
}

export interface LifelineRow {
  lifelines_total: number;
  lifelines_used: number;
}

/** SUM(quantity) of a member's approved credit_purchases, grouped by credit_type. */
export interface PurchasedCreditRow {
  credit_type: string;
  qty: number;
}

// MG-05 credit types → the support bucket they add allocation to.
// `lifeline` is handled separately (member_batch_settings.lifelines_total).
const CREDIT_TYPE_TO_USAGE_TYPE: Record<string, string> = {
  tech_support: 'tech_support',
  ad_support: 'ad_support',
  group_call_45: 'group_call',
  group_call_60: 'group_call',
  one_to_one_45: 'one_to_one',
  one_to_one_60: 'one_to_one',
};

export function creditTypeToUsageType(creditType: string): string | null {
  return CREDIT_TYPE_TO_USAGE_TYPE[creditType] ?? null;
}

// Before 2026-10-15 approving a purchased credit wrongly inserted a
// support_usage row with this note, so buying a call *reduced* remaining
// quota. Those rows are not real calls: usage counts skip them, and the
// purchase is counted as extra allocation instead (from credit_purchases).
export const LEGACY_CREDIT_USAGE_NOTE_PREFIX = 'Credit purchase approved (';

export const SUPPORT_USAGE_COUNTS_SQL = `
  SELECT type, COUNT(*)::int AS cnt FROM support_usage
  WHERE member_id = $1::uuid
    AND (notes IS NULL OR notes NOT LIKE '${LEGACY_CREDIT_USAGE_NOTE_PREFIX}%')
  GROUP BY type`;

export const APPROVED_CREDIT_PURCHASES_SQL = `
  SELECT credit_type, COALESCE(SUM(quantity), 0)::int AS qty FROM credit_purchases
  WHERE member_id = $1::uuid AND status = 'approved'
  GROUP BY credit_type`;

/** Not-cancelled support-call bookings paid with TBT coins, grouped by category. */
export interface CoinUnlockRow {
  type: string;
  cnt: number;
}

export const COIN_UNLOCKED_BOOKINGS_SQL = `
  SELECT s.category AS type, COUNT(*)::int AS cnt
  FROM support_call_bookings b JOIN support_call_sessions s ON s.id = b.session_id
  WHERE b.member_id = $1::uuid AND b.coin_cost IS NOT NULL AND b.status <> 'cancelled'
  GROUP BY s.category`;

/** Upfront coin-purchased extra call quota, grouped by category. */
export interface CoinPurchasedCallRow {
  type: string;
  cnt: number;
}

export const COIN_PURCHASED_CALLS_SQL = `
  SELECT category AS type, COALESCE(SUM(quantity), 0)::int AS cnt
  FROM support_call_coin_purchases
  WHERE member_id = $1::uuid
  GROUP BY category`;

export interface SupportQuotaBucket {
  allocated: number;
  used: number;
  remaining: number;
  /** Calls in `allocated` that were unlocked with TBT coins (the rest are included). */
  unlocked: number;
}

export interface SupportQuota {
  plan: string;
  techSupport: SupportQuotaBucket;
  adSupport: SupportQuotaBucket;
  groupCall: SupportQuotaBucket;
  callCredits: SupportQuotaBucket;
  salesSupport: SupportQuotaBucket;
  contentSupport: SupportQuotaBucket;
  oneToOne: boolean;
  lifelines: { total: number; used: number; remaining: number };
}

const DEFAULT_ENTITLEMENT: PlanEntitlementRow = {
  tech_support_days: 0,
  ad_support_days: 0,
  group_call_count: 0,
  call_credit_count: 0,
  one_to_one_enabled: false,
};

const DEFAULT_LIFELINES_TOTAL = 3;

function bucket(included: number, used: number, unlocked = 0): SupportQuotaBucket {
  const allocated = included + unlocked;
  return { allocated, used, remaining: Math.max(0, allocated - used), unlocked };
}

export function computeSupportQuota(
  plan: string,
  entRows: PlanEntitlementRow[],
  usageRows: UsageCountRow[],
  lifelineRows: LifelineRow[],
  purchasedRows: PurchasedCreditRow[] = [],
  coinUnlockRows: CoinUnlockRow[] = [],
  coinPurchasedCallRows: CoinPurchasedCallRow[] = [],
): SupportQuota {
  const ent = entRows[0] ?? DEFAULT_ENTITLEMENT;

  const usageMap: Record<string, number> = {};
  for (const row of usageRows) usageMap[row.type] = row.cnt;

  const extra: Record<string, number> = {};
  for (const row of purchasedRows) {
    const type = creditTypeToUsageType(row.credit_type);
    if (type) extra[type] = (extra[type] ?? 0) + Math.max(0, Number(row.qty) || 0);
  }

  // Coin-paid bookings (per-slot) AND upfront coin-purchased quota both add to
  // the allocation so they never eat into the plan's included calls.
  const unlocked: Record<string, number> = {};
  for (const row of coinUnlockRows) unlocked[row.type] = (unlocked[row.type] ?? 0) + Math.max(0, Number(row.cnt) || 0);
  for (const row of coinPurchasedCallRows) unlocked[row.type] = (unlocked[row.type] ?? 0) + Math.max(0, Number(row.cnt) || 0);

  const lifelinesTotal = lifelineRows[0]?.lifelines_total ?? DEFAULT_LIFELINES_TOTAL;
  const lifelinesUsed = lifelineRows[0]?.lifelines_used ?? 0;

  return {
    plan,
    techSupport: bucket(ent.tech_support_days + (extra['tech_support'] ?? 0), usageMap['tech_support'] ?? 0, unlocked['tech_support']),
    adSupport: bucket(ent.ad_support_days + (extra['ad_support'] ?? 0), usageMap['ad_support'] ?? 0, unlocked['ad_support']),
    groupCall: bucket(ent.group_call_count + (extra['group_call'] ?? 0), usageMap['group_call'] ?? 0, unlocked['group_call']),
    callCredits: bucket(ent.call_credit_count + (extra['one_to_one'] ?? 0), usageMap['one_to_one'] ?? 0, unlocked['one_to_one']),
    salesSupport: bucket(ent.sales_call_count ?? 0, usageMap['sales_support'] ?? 0, unlocked['sales_support']),
    contentSupport: bucket(ent.content_call_count ?? 0, usageMap['content_support'] ?? 0, unlocked['content_support']),
    oneToOne: !!ent.one_to_one_enabled,
    lifelines: { total: lifelinesTotal, used: lifelinesUsed, remaining: Math.max(0, lifelinesTotal - lifelinesUsed) },
  };
}
