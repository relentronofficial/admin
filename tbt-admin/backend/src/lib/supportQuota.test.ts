import { describe, it, expect } from 'vitest';
import {
  computeSupportQuota,
  creditTypeToUsageType,
  LEGACY_CREDIT_USAGE_NOTE_PREFIX,
  SUPPORT_USAGE_COUNTS_SQL,
} from './supportQuota.js';

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

  it('computes sales and content call buckets from their own allocation + usage types', () => {
    const result = computeSupportQuota(
      'premium',
      [{ tech_support_days: 0, ad_support_days: 0, group_call_count: 0, call_credit_count: 0, one_to_one_enabled: false, sales_call_count: 7, content_call_count: 5 }],
      [
        { type: 'sales_support', cnt: 2 },
        { type: 'content_support', cnt: 4 },
      ],
      [],
    );
    expect(result.salesSupport).toEqual({ allocated: 7, used: 2, remaining: 5 });
    expect(result.contentSupport).toEqual({ allocated: 5, used: 4, remaining: 1 });
  });

  it('treats a plan row without sales/content columns as zero allocation', () => {
    const result = computeSupportQuota(
      'free',
      [{ tech_support_days: 0, ad_support_days: 0, group_call_count: 0, call_credit_count: 0, one_to_one_enabled: false }],
      [{ type: 'sales_support', cnt: 1 }],
      [],
    );
    expect(result.salesSupport).toEqual({ allocated: 0, used: 1, remaining: 0 });
    expect(result.contentSupport).toEqual({ allocated: 0, used: 0, remaining: 0 });
  });

  // Regression: an approved credit purchase must ADD allocation (MG-05
  // "add credits to member"), not count as a used call.
  it('adds approved purchased credits to the matching bucket allocation', () => {
    const result = computeSupportQuota(
      'starter',
      [{ tech_support_days: 2, ad_support_days: 2, group_call_count: 4, call_credit_count: 0, one_to_one_enabled: false }],
      [{ type: 'group_call', cnt: 1 }],
      [],
      [
        { credit_type: 'tech_support', qty: 1 },
        { credit_type: 'ad_support', qty: 2 },
        { credit_type: 'group_call_45', qty: 1 },
        { credit_type: 'group_call_60', qty: 2 },
        { credit_type: 'one_to_one_45', qty: 1 },
        { credit_type: 'one_to_one_60', qty: 1 },
      ],
    );
    expect(result.techSupport).toEqual({ allocated: 3, used: 0, remaining: 3 });
    expect(result.adSupport).toEqual({ allocated: 4, used: 0, remaining: 4 });
    expect(result.groupCall).toEqual({ allocated: 7, used: 1, remaining: 6 });
    expect(result.callCredits).toEqual({ allocated: 2, used: 0, remaining: 2 });
  });

  it('ignores lifeline and unknown purchase types for support buckets', () => {
    const result = computeSupportQuota(
      'free',
      [],
      [],
      [],
      [{ credit_type: 'lifeline', qty: 5 }, { credit_type: 'mystery', qty: 3 }],
    );
    expect(result.techSupport).toEqual({ allocated: 0, used: 0, remaining: 0 });
    expect(result.groupCall).toEqual({ allocated: 0, used: 0, remaining: 0 });
    expect(result.callCredits).toEqual({ allocated: 0, used: 0, remaining: 0 });
    expect(result.lifelines).toEqual({ total: 3, used: 0, remaining: 3 });
  });

  it('maps credit types to support usage types', () => {
    expect(creditTypeToUsageType('group_call_60')).toBe('group_call');
    expect(creditTypeToUsageType('one_to_one_45')).toBe('one_to_one');
    expect(creditTypeToUsageType('tech_support')).toBe('tech_support');
    expect(creditTypeToUsageType('lifeline')).toBeNull();
  });

  it('usage count SQL excludes legacy credit-approval rows', () => {
    expect(SUPPORT_USAGE_COUNTS_SQL).toContain(`NOT LIKE '${LEGACY_CREDIT_USAGE_NOTE_PREFIX}%'`);
    expect(SUPPORT_USAGE_COUNTS_SQL).toContain('notes IS NULL');
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
