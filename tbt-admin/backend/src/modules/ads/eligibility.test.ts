import { describe, expect, it } from 'vitest';

import {
  compareCampaigns,
  dayBucket,
  selectCampaign,
  skipAvailableAfterSeconds,
  subjectKeyFor,
  underFrequencyCap,
  withinDailyWindow,
  zonedParts,
  type CandidateCampaign,
  type FrequencyState,
  type RequestContext,
} from './eligibility.js';

/**
 * Eligibility engine tests — TBT_ADS_SPECKIT.md §15.
 *
 * This module is the reason the engine is pure. Every case below is a
 * fixed `now` and a fixed candidate list; nothing here touches a clock, a
 * database or a network, so a failure is always the engine's fault and never
 * the environment's.
 *
 * Acceptance criteria 16–18 are otherwise unverifiable by hand — in particular
 * 18 (deterministic ordering), which cannot be observed reliably in a running
 * system because it depends on the order Postgres happens to return rows in.
 */

// 2026-08-07T12:00:00Z is a Friday. In Asia/Kolkata that is 17:30 the same day;
// in UTC it is midday. Several tests below turn on that difference.
const NOW = new Date('2026-08-07T12:00:00Z');

function campaign(over: Partial<CandidateCampaign> = {}): CandidateCampaign {
  return {
    id: 'c1',
    campaignCode: 'c1',
    status: 'active',
    priority: 0,
    startAt: new Date('2026-08-01T00:00:00Z'),
    endAt: new Date('2026-09-01T00:00:00Z'),
    timezone: 'Asia/Kolkata',
    dailyStartTime: null,
    dailyEndTime: null,
    activeDays: null,
    targetPlatforms: ['web', 'mobile'],
    targetOs: null,
    placements: ['app_launch'],
    targetRoutes: null,
    batchIds: null,
    audienceConfig: {},
    triggerType: 'app_launch',
    triggerConfig: {},
    frequencyConfig: {},
    maxTotalImpressions: null,
    currentImpressionCount: 0n,
    createdAt: new Date('2026-07-01T00:00:00Z'),
    ...over,
  };
}

function context(over: Partial<RequestContext> = {}): RequestContext {
  return {
    memberId: 'm1',
    anonymousId: null,
    sessionId: 's1',
    platform: 'web',
    os: 'web',
    placement: 'app_launch',
    route: '/dashboard',
    triggerType: 'app_launch',
    launchCount: 5,
    sessionElapsedSeconds: 60,
    member: {
      role: 'member',
      membershipPlan: 'premium',
      batchId: 'b1',
      city: 'Chennai',
      state: 'Tamil Nadu',
    },
    ...over,
  };
}

const NO_FREQUENCY = new Map<string, FrequencyState>();

function frequency(over: Partial<FrequencyState> = {}): Map<string, FrequencyState> {
  return new Map([
    [
      'c1',
      {
        campaignId: 'c1',
        sessionCount: 0,
        dayCount: 0,
        totalCount: 0,
        lastImpressionAt: null,
        ...over,
      },
    ],
  ]);
}

/** First rejection reason for a single-candidate run, or undefined if selected. */
function reject(
  over: Partial<CandidateCampaign> = {},
  ctx: Partial<RequestContext> = {},
  freq = NO_FREQUENCY,
): string | undefined {
  return selectCampaign([campaign(over)], context(ctx), NOW, freq).rejections[0]?.reason;
}

describe('selection pipeline', () => {
  it('selects a campaign that satisfies every step', () => {
    const result = selectCampaign([campaign()], context(), NOW, NO_FREQUENCY);
    expect(result.selected?.id).toBe('c1');
    expect(result.rejections).toEqual([]);
  });

  it('rejects a campaign whose window has not opened or has closed', () => {
    expect(reject({ startAt: new Date('2026-08-08T00:00:00Z') })).toBe('schedule_window');
    expect(reject({ endAt: new Date('2026-08-06T00:00:00Z') })).toBe('schedule_window');
  });

  it('rejects anything not active, whatever else matches', () => {
    for (const status of ['draft', 'scheduled', 'paused', 'completed', 'archived']) {
      expect(reject({ status })).toBe('not_active');
    }
  });

  it('matches platform, OS and placement', () => {
    expect(reject({ targetPlatforms: ['mobile'] })).toBe('platform');
    expect(reject({ targetOs: ['ios'] })).toBe('os');
    expect(reject({ targetOs: ['ios', 'web'] })).toBeUndefined();
    expect(reject({ targetOs: null })).toBeUndefined();
    expect(reject({ placements: ['home'] })).toBe('placement');
  });

  it('matches routes by exact value and by prefix glob', () => {
    expect(reject({ targetRoutes: ['/dashboard'] })).toBeUndefined();
    expect(reject({ targetRoutes: ['/learning/*'] })).toBe('route');
    expect(reject({ targetRoutes: ['/learning/*'] }, { route: '/learning/abc' })).toBeUndefined();
    expect(reject({ targetRoutes: ['/dash*'] })).toBeUndefined();
    // A campaign with no route restriction reaches every route.
    expect(reject({ targetRoutes: null }, { route: '/anywhere' })).toBeUndefined();
    // A route-restricted campaign cannot match a request that carries no route.
    expect(reject({ targetRoutes: ['/dashboard'] }, { route: null })).toBe('route');
  });

  it('requires the trigger type to match and its config to be satisfied', () => {
    expect(reject({ triggerType: 'route_enter' })).toBe('trigger');
    expect(reject({ triggerConfig: { afterNLaunches: 9 } })).toBe('trigger');
    expect(reject({ triggerConfig: { afterNLaunches: 5 } })).toBeUndefined();
    expect(reject({ triggerConfig: { delaySeconds: 120 } })).toBe('trigger');
    expect(reject({ triggerConfig: { delaySeconds: 30 } })).toBeUndefined();
  });

  it('spaces repeating triggers from the last impression, not from the first request', () => {
    // Nothing to space out yet — the first impression must not be blocked.
    expect(reject({ triggerConfig: { repeatIntervalSeconds: 300 } })).toBeUndefined();
    expect(
      reject({ triggerConfig: { repeatIntervalSeconds: 300 } }, {}, frequency({
        lastImpressionAt: new Date(NOW.getTime() - 10_000),
      })),
    ).toBe('trigger');
    expect(
      reject({ triggerConfig: { repeatIntervalSeconds: 300 } }, {}, frequency({
        lastImpressionAt: new Date(NOW.getTime() - 301_000),
      })),
    ).toBeUndefined();
  });

  it('enforces the total impression cap', () => {
    expect(reject({ maxTotalImpressions: 10n, currentImpressionCount: 10n })).toBe('total_cap');
    expect(reject({ maxTotalImpressions: 10n, currentImpressionCount: 9n })).toBeUndefined();
    expect(reject({ maxTotalImpressions: null, currentImpressionCount: 9_999n })).toBeUndefined();
  });

  it('returns no campaign when every candidate is rejected', () => {
    const result = selectCampaign([campaign({ placements: ['home'] })], context(), NOW, NO_FREQUENCY);
    expect(result.selected).toBeNull();
    expect(result.rejections).toHaveLength(1);
  });
});

describe('audience matching', () => {
  it('honours scope', () => {
    expect(reject({ audienceConfig: { scope: 'guests' } })).toBe('audience');
    expect(reject({ audienceConfig: { scope: 'authenticated' } })).toBeUndefined();
    expect(
      reject({ audienceConfig: { scope: 'guests' } }, { memberId: null, member: null, anonymousId: 'a1' }),
    ).toBeUndefined();
    expect(
      reject({ audienceConfig: { scope: 'authenticated' } }, { memberId: null, member: null, anonymousId: 'a1' }),
    ).toBe('audience');
  });

  it('narrows by plan, role, region and member id', () => {
    expect(reject({ audienceConfig: { plans: ['premium'] } })).toBeUndefined();
    expect(reject({ audienceConfig: { plans: ['free'] } })).toBe('audience');
    expect(reject({ audienceConfig: { roles: ['member'] } })).toBeUndefined();
    expect(reject({ audienceConfig: { roles: ['staff'] } })).toBe('audience');
    expect(reject({ audienceConfig: { regions: ['Chennai'] } })).toBeUndefined();
    expect(reject({ audienceConfig: { regions: ['Tamil Nadu'] } })).toBeUndefined();
    expect(reject({ audienceConfig: { regions: ['Mumbai'] } })).toBe('audience');
    expect(reject({ audienceConfig: { memberIds: ['m1'] } })).toBeUndefined();
    expect(reject({ audienceConfig: { memberIds: ['m2'] } })).toBe('audience');
  });

  it('treats any narrowing rule as implicitly authenticated-only', () => {
    // A guest has none of these attributes, so a campaign that sets one can
    // never match a guest — even with scope left at its default of "all".
    const guest = { memberId: null, member: null, anonymousId: 'a1' };
    expect(reject({ audienceConfig: { plans: ['premium'] } }, guest)).toBe('audience');
    expect(reject({ audienceConfig: { regions: ['Chennai'] } }, guest)).toBe('audience');
    // ...but an unrestricted campaign still reaches them.
    expect(reject({ audienceConfig: {} }, guest)).toBeUndefined();
  });

  it('applies the project-wide batch convention: null = everyone', () => {
    expect(reject({ batchIds: null })).toBeUndefined();
    expect(reject({ batchIds: [] })).toBeUndefined();
    expect(reject({ batchIds: ['b1'] })).toBeUndefined();
    expect(reject({ batchIds: ['b2'] })).toBe('batch');
    expect(reject({ batchIds: ['b1'] }, { member: null, memberId: null, anonymousId: 'a1' })).toBe('batch');
  });
});

describe('schedule and recurrence', () => {
  it('reads wall-clock parts in the campaign timezone, not the server one', () => {
    expect(zonedParts(NOW, 'Asia/Kolkata')).toMatchObject({ hour: 17, minute: 30, weekday: 5 });
    expect(zonedParts(NOW, 'UTC')).toMatchObject({ hour: 12, minute: 0, weekday: 5 });
  });

  it('falls back to UTC for an unusable timezone instead of throwing', () => {
    // A misconfigured campaign must degrade, not take down the eligibility
    // request for every other campaign in the list.
    expect(() => zonedParts(NOW, 'Not/AZone')).not.toThrow();
    expect(zonedParts(NOW, 'Not/AZone')).toMatchObject({ hour: 12 });
  });

  it('rolls the day bucket at midnight in the campaign timezone', () => {
    expect(dayBucket(NOW, 'Asia/Kolkata')).toBe('2026-08-07');
    // 20:00 UTC is already the 8th in IST but still the 7th in UTC. This is the
    // whole reason day buckets are computed per campaign.
    const evening = new Date('2026-08-07T20:00:00Z');
    expect(dayBucket(evening, 'Asia/Kolkata')).toBe('2026-08-08');
    expect(dayBucket(evening, 'UTC')).toBe('2026-08-07');
  });

  it('evaluates active days in the campaign timezone', () => {
    expect(reject({ activeDays: [5] })).toBeUndefined(); // Friday IST
    expect(reject({ activeDays: [4] })).toBe('schedule_day');
    expect(reject({ activeDays: [] })).toBeUndefined(); // empty = every day
    // 20:00 UTC on Friday is Saturday in IST — the day rule must follow.
    const saturdayIst = new Date('2026-08-07T20:00:00Z');
    expect(
      selectCampaign([campaign({ activeDays: [6] })], context(), saturdayIst, NO_FREQUENCY).selected,
    ).not.toBeNull();
  });

  it('handles daily windows, including ones that cross midnight', () => {
    const ist = 'Asia/Kolkata';
    expect(withinDailyWindow(NOW, ist, '17:00', '18:00')).toBe(true);
    expect(withinDailyWindow(NOW, ist, '18:00', '19:00')).toBe(false);
    expect(withinDailyWindow(NOW, ist, '22:00', '19:00')).toBe(true); // wraps midnight
    expect(withinDailyWindow(NOW, ist, '22:00', '02:00')).toBe(false);
    // The same instant is outside the same window in a different zone.
    expect(withinDailyWindow(NOW, 'UTC', '17:00', '18:00')).toBe(false);
    // Both null means all day; a malformed value is ignored rather than fatal.
    expect(withinDailyWindow(NOW, ist, null, null)).toBe(true);
    expect(withinDailyWindow(NOW, ist, '25:00', '18:00')).toBe(true);
  });

  it('keeps a daily window correct across a DST transition', () => {
    // New York, 2026-11-01: clocks go back at 02:00 local. A 09:00–17:00 local
    // window must stay 09:00–17:00 local on both sides of the change — which is
    // a different UTC offset either side, so naive offset arithmetic breaks.
    const beforeDst = new Date('2026-10-30T18:00:00Z'); // 14:00 EDT (UTC-4)
    const afterDst = new Date('2026-11-06T18:00:00Z'); // 13:00 EST (UTC-5)
    expect(withinDailyWindow(beforeDst, 'America/New_York', '09:00', '17:00')).toBe(true);
    expect(withinDailyWindow(afterDst, 'America/New_York', '09:00', '17:00')).toBe(true);

    // 22:00 UTC is 18:00 EDT (inside 09:00-19:00) but 17:00 EST (also inside).
    // Push to 23:30 UTC: 19:30 EDT — outside; 18:30 EST — inside.
    const lateOct = new Date('2026-10-30T23:30:00Z');
    const lateNov = new Date('2026-11-06T23:30:00Z');
    expect(withinDailyWindow(lateOct, 'America/New_York', '09:00', '19:00')).toBe(false);
    expect(withinDailyWindow(lateNov, 'America/New_York', '09:00', '19:00')).toBe(true);
  });
});

describe('frequency capping', () => {
  const cap = (config: Record<string, unknown>, state: Partial<FrequencyState>) =>
    underFrequencyCap(
      campaign({ frequencyConfig: config }),
      {
        campaignId: 'c1',
        sessionCount: 0,
        dayCount: 0,
        totalCount: 0,
        lastImpressionAt: null,
        ...state,
      } as FrequencyState,
      NOW,
    );

  it('enforces the once_per_* modes independently of each other', () => {
    expect(cap({ mode: 'once_per_session' }, { sessionCount: 1 })).toBe(false);
    expect(cap({ mode: 'once_per_session' }, { dayCount: 9, totalCount: 9 })).toBe(true);
    expect(cap({ mode: 'once_per_day' }, { dayCount: 1 })).toBe(false);
    expect(cap({ mode: 'once_per_day' }, { sessionCount: 0, totalCount: 9 })).toBe(true);
    expect(cap({ mode: 'once_per_user' }, { totalCount: 1 })).toBe(false);
    expect(cap({ mode: 'unlimited' }, { totalCount: 500 })).toBe(true);
  });

  it('enforces numeric caps even in unlimited mode', () => {
    expect(cap({ mode: 'unlimited', maxPerSession: 2 }, { sessionCount: 2 })).toBe(false);
    expect(cap({ maxPerDay: 3 }, { dayCount: 3 })).toBe(false);
    expect(cap({ maxPerDay: 3 }, { dayCount: 2 })).toBe(true);
    expect(cap({ maxPerUser: 5 }, { totalCount: 5 })).toBe(false);
  });

  it('enforces a minimum interval between impressions', () => {
    expect(cap({ minIntervalSeconds: 600 }, { lastImpressionAt: new Date(NOW.getTime() - 60_000) })).toBe(false);
    expect(cap({ minIntervalSeconds: 600 }, { lastImpressionAt: new Date(NOW.getTime() - 601_000) })).toBe(true);
    // No prior impression means nothing to space from.
    expect(cap({ minIntervalSeconds: 600 }, {})).toBe(true);
  });

  it('applies the strictest of several caps set together', () => {
    const config = { mode: 'unlimited', maxPerDay: 5, maxPerSession: 1 };
    expect(cap(config, { dayCount: 1, sessionCount: 1 })).toBe(false);
    expect(cap(config, { dayCount: 4, sessionCount: 0 })).toBe(true);
  });

  it('surfaces as a frequency rejection through the pipeline', () => {
    expect(reject({ frequencyConfig: { mode: 'once_per_user' } }, {}, frequency({ totalCount: 1 })))
      .toBe('frequency');
  });

  it('treats a missing frequency row as "nothing seen yet"', () => {
    expect(reject({ frequencyConfig: { mode: 'once_per_user' } }, {}, new Map())).toBeUndefined();
  });
});

describe('ordering determinism (criterion 18)', () => {
  it('sorts by priority first', () => {
    const low = campaign({ id: 'low', priority: 1 });
    const high = campaign({ id: 'high', priority: 9 });
    expect(selectCampaign([low, high], context(), NOW, NO_FREQUENCY).selected?.id).toBe('high');
    expect(selectCampaign([high, low], context(), NOW, NO_FREQUENCY).selected?.id).toBe('high');
  });

  it('breaks a priority tie by earliest start, then earliest creation', () => {
    const earlier = campaign({ id: 'a', priority: 5, startAt: new Date('2026-08-01T00:00:00Z') });
    const later = campaign({ id: 'b', priority: 5, startAt: new Date('2026-08-02T00:00:00Z') });
    expect(selectCampaign([later, earlier], context(), NOW, NO_FREQUENCY).selected?.id).toBe('a');

    const older = campaign({ id: 'x', priority: 5, createdAt: new Date('2026-07-01T00:00:00Z') });
    const newer = campaign({ id: 'y', priority: 5, createdAt: new Date('2026-07-02T00:00:00Z') });
    expect(selectCampaign([newer, older], context(), NOW, NO_FREQUENCY).selected?.id).toBe('x');
  });

  it('is total: identical priority AND timestamps still order stably by id', () => {
    // Bulk-created campaigns genuinely share a timestamp to the millisecond.
    // Without the id tie-break the winner would vary with the order Postgres
    // returned the rows in — which is the non-determinism criterion 18 forbids.
    const a = campaign({ id: 'aaa', priority: 5 });
    const b = campaign({ id: 'bbb', priority: 5 });
    const c = campaign({ id: 'ccc', priority: 5 });

    for (const order of [[a, b, c], [c, b, a], [b, c, a], [c, a, b]]) {
      expect(selectCampaign(order, context(), NOW, NO_FREQUENCY).selected?.id).toBe('aaa');
    }
    expect(compareCampaigns(a, b)).toBeLessThan(0);
    expect(compareCampaigns(b, a)).toBeGreaterThan(0);
    expect(compareCampaigns(a, a)).toBe(0);
  });

  it('never lets a rejected campaign win on ordering alone', () => {
    const blocked = campaign({ id: 'aaa', priority: 100, placements: ['home'] });
    const eligible = campaign({ id: 'zzz', priority: 1 });
    expect(selectCampaign([blocked, eligible], context(), NOW, NO_FREQUENCY).selected?.id).toBe('zzz');
  });
});

describe('helpers', () => {
  it('resolves a single non-null subject key, preferring the member', () => {
    expect(subjectKeyFor('m1', 'a1')).toBe('m:m1');
    expect(subjectKeyFor(null, 'a1')).toBe('a:a1');
    expect(subjectKeyFor(null, null)).toBeNull();
  });

  it('computes the skip unlock point for each skip type', () => {
    expect(skipAvailableAfterSeconds({ enabled: true, type: 'immediate' }, 30)).toBe(0);
    expect(skipAvailableAfterSeconds({ enabled: true, type: 'seconds', value: 5 }, 30)).toBe(5);
    expect(skipAvailableAfterSeconds({ enabled: true, type: 'percent', value: 50 }, 30)).toBe(15);
    expect(skipAvailableAfterSeconds({ enabled: true, type: 'after_end' }, 30)).toBeNull();
    expect(skipAvailableAfterSeconds({ enabled: false, type: 'seconds', value: 5 }, 30)).toBeNull();
    // Percent gating is impossible without a known duration.
    expect(skipAvailableAfterSeconds({ enabled: true, type: 'percent', value: 50 }, null)).toBeNull();
    expect(skipAvailableAfterSeconds(null, 30)).toBeNull();
  });
});

describe('purity', () => {
  it('does not mutate its inputs', () => {
    const candidates = [campaign({ id: 'a', priority: 1 }), campaign({ id: 'b', priority: 9 })];
    const snapshot = JSON.stringify(candidates, (_k, v) => (typeof v === 'bigint' ? String(v) : v));
    selectCampaign(candidates, context(), NOW, NO_FREQUENCY);
    expect(JSON.stringify(candidates, (_k, v) => (typeof v === 'bigint' ? String(v) : v))).toBe(snapshot);
    // Ordering happens on a copy — the caller's array keeps its own order.
    expect(candidates.map((c) => c.id)).toEqual(['a', 'b']);
  });

  it('is reproducible: same inputs, same answer', () => {
    const args = () => [campaign({ id: 'a' }), campaign({ id: 'b' })] as CandidateCampaign[];
    const first = selectCampaign(args(), context(), NOW, NO_FREQUENCY);
    const second = selectCampaign(args(), context(), NOW, NO_FREQUENCY);
    expect(first.selected?.id).toBe(second.selected?.id);
    expect(first.rejections).toEqual(second.rejections);
  });
});
