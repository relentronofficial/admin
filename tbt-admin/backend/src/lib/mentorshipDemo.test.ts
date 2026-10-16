import { describe, expect, it } from 'vitest';

import { demoRevenue, demoSocial, isMentorshipDemoMember, mightBeDemoMember } from './mentorshipDemo.js';

const TARGET_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_ID = '22222222-2222-2222-2222-222222222222';
const CONFIG = { memberId: TARGET_ID, email: 'demo@example.com' };
const WEEK = { isoWeek: 42, isoYear: 2026 };

describe('demo-member matching', () => {
  it('matches only when both the member id and stored email match', () => {
    expect(isMentorshipDemoMember({ id: TARGET_ID, email: 'demo@example.com' }, CONFIG)).toBe(true);
    expect(isMentorshipDemoMember({ id: TARGET_ID, email: ' Demo@Example.COM ' }, CONFIG)).toBe(true);
  });

  it('never matches another member, even one using the target email', () => {
    expect(isMentorshipDemoMember({ id: OTHER_ID, email: 'demo@example.com' }, CONFIG)).toBe(false);
    expect(mightBeDemoMember(OTHER_ID, CONFIG)).toBe(false);
  });

  it('never matches the target id when its email has changed', () => {
    expect(isMentorshipDemoMember({ id: TARGET_ID, email: 'someone-else@example.com' }, CONFIG)).toBe(false);
    expect(isMentorshipDemoMember({ id: TARGET_ID, email: null }, CONFIG)).toBe(false);
  });

  it('is disabled once either setting is removed or blank', () => {
    const member = { id: TARGET_ID, email: 'demo@example.com' };
    for (const config of [{}, { memberId: TARGET_ID }, { email: 'demo@example.com' }, { memberId: '', email: '' }, { memberId: '  ', email: 'demo@example.com' }, { memberId: TARGET_ID, email: null }]) {
      expect(isMentorshipDemoMember(member, config)).toBe(false);
      expect(mightBeDemoMember(TARGET_ID, config)).toBe(false);
    }
  });
});

describe('demo payloads', () => {
  it('revenue: same fields as the real handler, for the current week', () => {
    const r = demoRevenue(WEEK);
    expect(Object.keys(r).sort()).toEqual([
      'adBudgetSpent', 'avgOrderValue', 'conversionRate', 'customerAcqCost', 'dailyOrders', 'dailyRevenue',
      'leadsPrev', 'numberOfOrders', 'ordersPrev', 'organicLeads', 'platformBadge', 'revenueGenerated',
      'revenuePrev', 'roas', 'rtoReturnsPercent', 'updatedAt', 'weekNumber', 'year',
    ]);
    expect([r.weekNumber, r.year]).toEqual([42, 2026]);
  });

  // The dashboard shows revenue/orders as cards (revenueGenerated, numberOfOrders)
  // and as the 7-day trajectory chart (dailyRevenue, dailyOrders), plus derived
  // cards (ROAS, AOV, CAC, growth %). They must agree with each other.
  it('revenue cards and the daily trajectory chart agree', () => {
    const r = demoRevenue(WEEK);
    expect(r.dailyRevenue).toHaveLength(7);
    expect(r.dailyOrders).toHaveLength(7);
    expect(r.dailyRevenue.every((v) => Number.isFinite(v) && v > 0)).toBe(true);
    expect(r.dailyOrders.every((v) => Number.isInteger(v) && v > 0)).toBe(true);
    expect(r.dailyRevenue.reduce((a, b) => a + b, 0)).toBe(r.revenueGenerated);
    expect(r.dailyOrders.reduce((a, b) => a + b, 0)).toBe(r.numberOfOrders);
  });

  it('derived revenue cards are computed from the same base numbers', () => {
    const r = demoRevenue(WEEK);
    expect(r.roas).toBeCloseTo(r.revenueGenerated / r.adBudgetSpent, 2);
    expect(r.avgOrderValue).toBe(Math.round(r.revenueGenerated / r.numberOfOrders));
    expect(r.customerAcqCost).toBe(Math.round(r.adBudgetSpent / r.numberOfOrders));
    // Week-over-week comparisons point the same way for revenue, orders and leads.
    expect(r.revenueGenerated).toBeGreaterThan(r.revenuePrev);
    expect(r.numberOfOrders).toBeGreaterThan(r.ordersPrev);
    expect(r.organicLeads).toBeGreaterThan(r.leadsPrev);
  });

  it('social: same fields as the real handler, internally consistent', () => {
    const s = demoSocial(WEEK);
    expect(Object.keys(s).sort()).toEqual([
      'bioLinkClicks', 'bioLinkClicksPrev', 'contentUploadTarget', 'contentUploads', 'dmLeads', 'followersPrev',
      'interactions', 'interactionsPrev', 'totalFollowers', 'updatedAt', 'videoViews', 'videoViewsPrev',
      'weekNumber', 'year',
    ]);
    expect(s.contentUploads).toBeLessThanOrEqual(s.contentUploadTarget);
    expect([s.weekNumber, s.year]).toEqual([42, 2026]);
  });

  it('returns fresh objects (no shared mutable state between requests)', () => {
    const a = demoRevenue(WEEK);
    a.dailyRevenue.push(1);
    expect(demoRevenue(WEEK).dailyRevenue).toHaveLength(7);
  });
});
