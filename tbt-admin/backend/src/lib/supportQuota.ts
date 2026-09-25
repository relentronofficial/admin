// Pure computation behind GET /api/support-entitlements/member/:memberId — no I/O,
// so the allocated/used/remaining math can be unit-tested without a database.
export interface PlanEntitlementRow {
  tech_support_days: number;
  ad_support_days: number;
  group_call_count: number;
  call_credit_count: number;
  one_to_one_enabled: boolean;
}

export interface UsageCountRow {
  type: string;
  cnt: number;
}

export interface LifelineRow {
  lifelines_total: number;
  lifelines_used: number;
}

export interface SupportQuotaBucket {
  allocated: number;
  used: number;
  remaining: number;
}

export interface SupportQuota {
  plan: string;
  techSupport: SupportQuotaBucket;
  adSupport: SupportQuotaBucket;
  groupCall: SupportQuotaBucket;
  callCredits: SupportQuotaBucket;
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

function bucket(allocated: number, used: number): SupportQuotaBucket {
  return { allocated, used, remaining: Math.max(0, allocated - used) };
}

export function computeSupportQuota(
  plan: string,
  entRows: PlanEntitlementRow[],
  usageRows: UsageCountRow[],
  lifelineRows: LifelineRow[],
): SupportQuota {
  const ent = entRows[0] ?? DEFAULT_ENTITLEMENT;

  const usageMap: Record<string, number> = {};
  for (const row of usageRows) usageMap[row.type] = row.cnt;

  const lifelinesTotal = lifelineRows[0]?.lifelines_total ?? DEFAULT_LIFELINES_TOTAL;
  const lifelinesUsed = lifelineRows[0]?.lifelines_used ?? 0;

  return {
    plan,
    techSupport: bucket(ent.tech_support_days, usageMap['tech_support'] ?? 0),
    adSupport: bucket(ent.ad_support_days, usageMap['ad_support'] ?? 0),
    groupCall: bucket(ent.group_call_count, usageMap['group_call'] ?? 0),
    callCredits: bucket(ent.call_credit_count, usageMap['one_to_one'] ?? 0),
    oneToOne: !!ent.one_to_one_enabled,
    lifelines: { total: lifelinesTotal, used: lifelinesUsed, remaining: Math.max(0, lifelinesTotal - lifelinesUsed) },
  };
}
