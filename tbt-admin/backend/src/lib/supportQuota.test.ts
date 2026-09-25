import { describe, it, expect } from 'vitest';
import { computeSupportQuota } from './supportQuota.js';

describe('computeSupportQuota', () => {
  it('computes allocated/used/remaining for a fully populated plan', () => {
    const result = computeSupportQuota(
      'premium',
      [{ tech_support_days: 5, ad_support_days: 5, group_call_count: 10, call_credit_count: 1, one_to_one_enabled: true }],
      [
        { type: 'tech_support', cnt: 2 },
        { type: 'ad_support', cnt: 5 },
        { type: 'group_call', cnt: 0 },
        { type: 'one_to_one', cnt: 1 },
      ],
      [{ lifelines_total: 3, lifelines_used: 1 }],
    );

    expect(result.plan).toBe('premium');
    expect(result.techSupport).toEqual({ allocated: 5, used: 2, remaining: 3 });
    expect(result.adSupport).toEqual({ allocated: 5, used: 5, remaining: 0 });
    expect(result.groupCall).toEqual({ allocated: 10, used: 0, remaining: 10 });
    expect(result.callCredits).toEqual({ allocated: 1, used: 1, remaining: 0 });
    expect(result.oneToOne).toBe(true);
    expect(result.lifelines).toEqual({ total: 3, used: 1, remaining: 2 });
  });

  // Regression: getMemberSupportQuotaHandler must not throw when a member's
  // plan has no seeded plan_entitlements row (e.g. a legacy/custom plan
  // value) — it should fall back to zero allocation instead of 500ing.
  it('falls back to zero allocation when the plan has no entitlement row', () => {
    const result = computeSupportQuota('legacy_custom_plan', [], [], []);

    expect(result.techSupport).toEqual({ allocated: 0, used: 0, remaining: 0 });
    expect(result.adSupport).toEqual({ allocated: 0, used: 0, remaining: 0 });
    expect(result.groupCall).toEqual({ allocated: 0, used: 0, remaining: 0 });
    expect(result.callCredits).toEqual({ allocated: 0, used: 0, remaining: 0 });
    expect(result.oneToOne).toBe(false);
  });

  it('clamps remaining at zero when usage exceeds the allocation', () => {
    const result = computeSupportQuota(
      'starter',
      [{ tech_support_days: 2, ad_support_days: 2, group_call_count: 4, call_credit_count: 0, one_to_one_enabled: false }],
      [{ type: 'tech_support', cnt: 9 }],
      [],
    );

    expect(result.techSupport).toEqual({ allocated: 2, used: 9, remaining: 0 });
  });

  it('defaults lifelines to 3 total / 0 used when the member has no batch settings row', () => {
    const result = computeSupportQuota('free', [], [], []);
    expect(result.lifelines).toEqual({ total: 3, used: 0, remaining: 3 });
  });

  it('ignores usage rows for types not tracked in the response shape', () => {
    const result = computeSupportQuota(
      'free',
      [{ tech_support_days: 1, ad_support_days: 0, group_call_count: 0, call_credit_count: 0, one_to_one_enabled: false }],
      [{ type: 'some_future_type', cnt: 99 }],
      [],
    );
    expect(result.techSupport).toEqual({ allocated: 1, used: 0, remaining: 1 });
  });
});
