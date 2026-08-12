import { describe, expect, it } from 'vitest';

import {
  createCampaignSchema,
  updateCampaignSchema,
  eligibleRequestSchema,
  validateCampaignInvariants,
} from './schema.js';

/**
 * Validation and sanitisation tests — TBT_ADS_SPECKIT.md §13/§14.
 *
 * Included alongside the eligibility engine because these schemas are pure too,
 * and because they are the only thing standing between an admin typo and a
 * campaign that renders a dead CTA — or a `javascript:` URL — to every member.
 */

const VALID = {
  campaignCode: 'diwali-promo',
  name: 'Diwali Promo',
  mediaType: 'image',
  mediaUrl: 'https://cdn.example.com/creative.webp',
  mediaDurationSeconds: 10,
  startAt: '2026-08-01T00:00:00.000Z',
  endAt: '2026-09-01T00:00:00.000Z',
  targetPlatforms: ['web'],
  placements: ['home'],
  triggerType: 'app_launch',
};

const create = (over: Record<string, unknown> = {}) =>
  createCampaignSchema.safeParse({ ...VALID, ...over });

/** Cross-field rules, run the way the activation gate runs them. */
const invariants = (over: Record<string, unknown> = {}) =>
  validateCampaignInvariants({ ...VALID, ...over });

describe('field validation (§13)', () => {
  it('accepts a well-formed campaign', () => {
    expect(create().success).toBe(true);
  });

  it('constrains the campaign code to a slug', () => {
    expect(create({ campaignCode: 'Bad Code' }).success).toBe(false);
    expect(create({ campaignCode: 'UPPER' }).success).toBe(false);
    expect(create({ campaignCode: 'ok-123' }).success).toBe(true);
  });

  it('bounds priority to 0-1000 and rejects negative caps', () => {
    expect(create({ priority: 0 }).success).toBe(true);
    expect(create({ priority: 1000 }).success).toBe(true);
    expect(create({ priority: 1001 }).success).toBe(false);
    expect(create({ priority: -1 }).success).toBe(false);
    expect(create({ maxTotalImpressions: -5 }).success).toBe(false);
    expect(create({ maxTotalImpressions: 0 }).success).toBe(true);
  });

  it('requires at least one platform and one placement', () => {
    expect(create({ targetPlatforms: [] }).success).toBe(false);
    expect(create({ placements: [] }).success).toBe(false);
  });

  it('validates the timezone by asking Intl to use it', () => {
    expect(create({ timezone: 'Asia/Kolkata' }).success).toBe(true);
    expect(create({ timezone: 'America/New_York' }).success).toBe(true);
    expect(create({ timezone: 'Mars/Olympus' }).success).toBe(false);
  });

  it('constrains active days to the 0-6 (Sunday-first) convention', () => {
    expect(create({ activeDays: [0, 6] }).success).toBe(true);
    expect(create({ activeDays: [7] }).success).toBe(false);
    expect(create({ activeDays: [-1] }).success).toBe(false);
  });

  it('constrains daily times to HH:mm', () => {
    expect(create({ dailyStartTime: '09:00', dailyEndTime: '17:30' }).success).toBe(true);
    expect(create({ dailyStartTime: '9am' }).success).toBe(false);
    expect(create({ dailyStartTime: '24:00' }).success).toBe(false);
  });
});

describe('cross-field rules (§13)', () => {
  it('requires the end date to be after the start date', () => {
    expect(invariants()).toEqual([]);
    expect(invariants({ endAt: '2026-07-01T00:00:00.000Z' })[0]).toMatch(/End date must be after/);
  });

  it('rejects an identical daily window but allows one that wraps midnight', () => {
    expect(invariants({ dailyStartTime: '09:00', dailyEndTime: '09:00' })[0]).toMatch(/identical/);
    // start > end is a legitimate overnight window, and the eligibility engine
    // implements it — rejecting it here would break a working feature.
    expect(invariants({ dailyStartTime: '22:00', dailyEndTime: '02:00' })).toEqual([]);
  });

  it('requires image campaigns to carry a creative and a display duration', () => {
    expect(invariants({ mediaUrl: null })[0]).toMatch(/media URL/);
    expect(invariants({ mediaDurationSeconds: 0 })[0]).toMatch(/duration/);
  });

  it('requires video campaigns to carry a URL or a Bunny id', () => {
    expect(invariants({ mediaType: 'video', mediaUrl: null, bunnyVideoId: null })[0]).toMatch(/Bunny/);
    expect(invariants({ mediaType: 'video', mediaUrl: null, bunnyVideoId: 'v1' })).toEqual([]);
  });

  it('keeps the skip gate inside the creative', () => {
    expect(invariants({ skipConfig: { enabled: true, type: 'seconds', value: 30 } })[0])
      .toMatch(/exceed the media duration/);
    expect(invariants({ skipConfig: { enabled: true, type: 'seconds', value: 5 } })).toEqual([]);
    expect(invariants({ skipConfig: { enabled: true, type: 'percent', value: 140 } })[0])
      .toMatch(/between 0 and 100/);
    expect(invariants({ skipConfig: { enabled: true, type: 'percent', value: 50 } })).toEqual([]);
  });
});

describe('URL safety (§13/§14)', () => {
  const cta = (config: Record<string, unknown>) =>
    invariants({ ctaConfig: { enabled: true, text: 'Go', ...config } });

  it('names the dangerous scheme it rejected', () => {
    for (const target of [
      'javascript:alert(1)',
      'JavaScript:alert(1)',
      'data:text/html,<script>x</script>',
      'vbscript:msgbox',
      'file:///etc/passwd',
    ]) {
      const issues = cta({ type: 'external_url', target });
      expect(issues.length).toBeGreaterThan(0);
      // The specific message is the point: an admin can act on "javascript:
      // URLs are not allowed" and can only guess at "invalid URL".
      expect(issues[0]).toMatch(/not allowed/);
    }
  });

  it('allows only http and https for external targets', () => {
    expect(cta({ type: 'external_url', target: 'https://example.com/x?y=1' })).toEqual([]);
    expect(cta({ type: 'external_url', target: 'http://example.com' })).toEqual([]);
    expect(cta({ type: 'external_url', target: 'ftp://example.com' })[0]).toMatch(/http/);
    expect(cta({ type: 'external_url', target: 'not a url' }).length).toBeGreaterThan(0);
  });

  it('requires internal routes to be root-relative and not protocol-relative', () => {
    expect(cta({ type: 'internal_route', target: '/courses/abc' })).toEqual([]);
    expect(cta({ type: 'internal_route', target: 'courses' })[0]).toMatch(/must start with/);
    // `//evil.com` is a same-origin-looking open redirect.
    expect(cta({ type: 'internal_route', target: '//evil.com' })[0]).toMatch(/cannot start with/);
  });

  it('requires internal routes to point at a route the clients actually have', () => {
    expect(cta({ type: 'internal_route', target: '/Products' })).toEqual([]);
    expect(cta({ type: 'internal_route', target: '/nope/x' })[0]).toMatch(/not a known app route/);
    // Prefixes match whole segments: /profiled is not /profile.
    expect(cta({ type: 'internal_route', target: '/profiled' })[0]).toMatch(/not a known app route/);
    // Query strings and fragments are legitimate on a CTA target.
    expect(cta({ type: 'internal_route', target: '/courses/abc?ref=ad#top' })).toEqual([]);
  });

  it('requires text and target whenever the CTA is enabled', () => {
    expect(invariants({ ctaConfig: { enabled: true } }).length).toBeGreaterThan(0);
    expect(invariants({ ctaConfig: { enabled: true, text: 'Go' } }).length).toBeGreaterThan(0);
    // A disabled CTA needs nothing.
    expect(invariants({ ctaConfig: { enabled: false } })).toEqual([]);
  });
});

describe('sanitisation of member-facing text (§14)', () => {
  it('strips markup from the campaign name and description', () => {
    const parsed = create({ name: 'Diwali <script>alert(1)</script>Promo' });
    expect(parsed.success).toBe(true);
    expect(parsed.data!.name).toBe('Diwali alert(1)Promo');

    expect(create({ name: 'Deal <b>50%</b> off' }).data!.name).toBe('Deal 50% off');
    expect(create({ description: 'Line<br>two <img src=x onerror=y>' }).data!.description)
      .toBe('Linetwo');
  });

  it('strips stray angle brackets rather than rejecting the campaign', () => {
    // An admin writing "Save 50% <today>" made a typographic choice, not an
    // attack — bouncing the whole campaign for it would be obnoxious.
    const parsed = create({ name: 'Save 50% <today>' });
    expect(parsed.success).toBe(true);
    expect(parsed.data!.name).toBe('Save 50%');
  });

  it('rejects a name that sanitises down to nothing', () => {
    // `min(1)` alone passes this and then renders as a blank campaign name.
    expect(create({ name: '<b></b>' }).success).toBe(false);
    expect(create({ name: '<script></script>' }).success).toBe(false);
  });

  it('collapses control characters, which hide payloads in logs and exports', () => {
    const dirty = `Promo${String.fromCharCode(9)}${String.fromCharCode(0)}x`;
    expect(create({ name: dirty }).data!.name).toBe('Promo x');
  });

  it('sanitises the CTA button text', () => {
    const parsed = create({
      ctaConfig: {
        enabled: true,
        text: '<i>Learn</i> More',
        type: 'internal_route',
        target: '/courses/x',
      },
    });
    expect(parsed.success).toBe(true);
    expect((parsed.data!.ctaConfig as { text: string }).text).toBe('Learn More');
  });

  it('sanitises patches too — update must not be a way around it', () => {
    const parsed = updateCampaignSchema.safeParse({ name: '<script>x</script>Sale' });
    expect(parsed.success).toBe(true);
    expect(parsed.data!.name).toBe('xSale');
  });
});

describe('client-supplied identity (§14)', () => {
  it('never accepts a memberId from the caller', () => {
    // The identity always comes from the verified JWT. The schema does not even
    // declare the field, so an injected one is stripped rather than honoured.
    const parsed = eligibleRequestSchema.safeParse({
      sessionId: 's1',
      anonymousId: 'a1',
      platform: 'web',
      placement: 'home',
      triggerType: 'app_launch',
      memberId: '00000000-0000-0000-0000-000000000001',
    });
    expect(parsed.success).toBe(true);
    expect(parsed.data as Record<string, unknown>).not.toHaveProperty('memberId');
  });

  it('requires a session id and a recognised platform', () => {
    const base = { sessionId: 's1', platform: 'web', placement: 'home', triggerType: 'app_launch' };
    expect(eligibleRequestSchema.safeParse(base).success).toBe(true);
    expect(eligibleRequestSchema.safeParse({ ...base, sessionId: '' }).success).toBe(false);
    expect(eligibleRequestSchema.safeParse({ ...base, platform: 'tv' }).success).toBe(false);
    expect(eligibleRequestSchema.safeParse({ ...base, triggerType: 'telepathy' }).success).toBe(false);
  });
});

describe('update patches (§13)', () => {
  it('leaves absent keys absent instead of resolving them to defaults', () => {
    // A shared base carrying `.default()` would make a one-field PATCH silently
    // reset priority, objectFit, timezone and every config object.
    const parsed = updateCampaignSchema.safeParse({ priority: 7 });
    expect(parsed.success).toBe(true);
    expect(Object.keys(parsed.data!)).toEqual(['priority']);
  });

  it('still validates the fields it is given', () => {
    expect(updateCampaignSchema.safeParse({ priority: 5000 }).success).toBe(false);
    expect(updateCampaignSchema.safeParse({ timezone: 'Mars/Olympus' }).success).toBe(false);
  });
});
