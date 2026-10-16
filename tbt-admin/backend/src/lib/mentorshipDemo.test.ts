import { describe, expect, it } from 'vitest';

import {
  demoRevenue,
  demoSocial,
  demoStats,
  isMentorshipDemoMember,
  mightBeDemoMember,
  type MentorshipStats,
} from './mentorshipDemo.js';

const TARGET_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_ID = '22222222-2222-2222-2222-222222222222';
const CONFIG = { memberId: TARGET_ID, email: 'demo@example.com' };
const WEEK = { isoWeek: 42, isoYear: 2026 };

const realStats: MentorshipStats = {
  dailyTimeSpentHrs: 0, dailyTimeGoalHrs: 2, weeklyReportSubmitted: false, streakDays: 0,
  totalEpisodes: 0, completedEpisodes: 0, tasksCompleted: 0, tasksTotal: 0, leaderboardRank: null,
  daysElapsed: 3, activeDays: 1, totalDays: 90, programName: 'TBT – eComm Mastery',
};

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

  it('is disabled unless both settings are present', () => {
    const member = { id: TARGET_ID, email: 'demo@example.com' };
    expect(isMentorshipDemoMember(member, {})).toBe(false);
    expect(isMentorshipDemoMember(member, { memberId: TARGET_ID })).toBe(false);
    expect(isMentorshipDemoMember(member, { email: 'demo@example.com' })).toBe(false);
    expect(isMentorshipDemoMember(member, { memberId: '', email: '' })).toBe(false);
    expect(mightBeDemoMember(TARGET_ID, { memberId: TARGET_ID, email: '' })).toBe(false);
  });
});

describe('demo payloads', () => {
  it('revenue: same fields as the real handler, internally consistent, current week', () => {
    const r = demoRevenue(WEEK);
    expect(Object.keys(r).sort()).toEqual([
      'adBudgetSpent', 'avgOrderValue', 'conversionRate', 'customerAcqCost', 'dailyOrders', 'dailyRevenue',
      'leadsPrev', 'numberOfOrders', 'ordersPrev', 'organicLeads', 'platformBadge', 'revenueGenerated',
      'revenuePrev', 'roas', 'rtoReturnsPercent', 'updatedAt', 'weekNumber', 'year',
    ]);
    expect(r.weekNumber).toBe(42);
    expect(r.year).toBe(2026);
    expect(r.dailyRevenue).toHaveLength(7);
    expect(r.dailyRevenue.reduce((a, b) => a + b, 0)).toBe(r.revenueGenerated);
    expect(r.dailyOrders.reduce((a, b) => a + b, 0)).toBe(r.numberOfOrders);
  });

  it('social: same fields as the real handler', () => {
    expect(Object.keys(demoSocial(WEEK)).sort()).toEqual([
      'bioLinkClicks', 'bioLinkClicksPrev', 'contentUploadTarget', 'contentUploads', 'dmLeads', 'followersPrev',
      'interactions', 'interactionsPrev', 'totalFollowers', 'updatedAt', 'videoViews', 'videoViewsPrev',
      'weekNumber', 'year',
    ]);
  });

  it('stats: keeps the real program identity and never exceeds the program length', () => {
    const s = demoStats(realStats);
    expect(Object.keys(s).sort()).toEqual(Object.keys(realStats).sort());
    expect(s.programName).toBe('TBT – eComm Mastery');
    expect(s.totalDays).toBe(90);
    expect(s.dailyTimeGoalHrs).toBe(2);
    expect(s.completedEpisodes).toBeLessThanOrEqual(s.totalEpisodes);
    expect(s.tasksCompleted).toBeLessThanOrEqual(s.tasksTotal);

    const short = demoStats({ ...realStats, totalDays: 14 });
    expect(short.daysElapsed).toBe(14);
    expect(short.activeDays).toBeLessThanOrEqual(14);
    expect(short.streakDays).toBeLessThanOrEqual(14);
  });

  it('does not mutate the real stats object', () => {
    const copy = { ...realStats };
    demoStats(realStats);
    expect(realStats).toEqual(copy);
  });
});
