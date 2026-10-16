import { describe, expect, it } from 'vitest';

import { computeTierActiveDays } from './activityDays.js';
import {
  buildDemoActivity,
  buildDemoGraphInputs,
  demoProgramDay,
  demoRevenue,
  demoSocial,
  demoStats,
  isDemoActiveDay,
  isMentorshipDemoMember,
  mightBeDemoMember,
} from './mentorshipDemo.js';
import { computeStreakSummary } from './streakSummaryLogic.js';
import { buildWeeklyGraph, MAX_TASK_PROGRESS_LEVEL } from './weeklyGraphLogic.js';

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

// ── Demo activity history: streak, Tier Access, Weekly Activity Graph, stats ──

const START = '2026-09-01';
const at = (key: string) => new Date(`${key}T00:00:00Z`);
const addDays = (key: string, n: number) => new Date(Date.parse(`${key}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** Everything the demo endpoints derive, exactly as lib/mentorshipDemoRequest.ts does. */
function overlay(program: { programStartDay: string | null; totalDays: number }, todayKey: string) {
  const today = at(todayKey);
  const { rows, currentDay } = buildDemoActivity(program, today);
  const streak = computeStreakSummary(rows, today);
  const tierActiveDays = computeTierActiveDays({
    activityDays: rows.map((r) => r.activity_date as string), programStartDay: program.programStartDay, totalDays: program.totalDays,
  });
  const graph = currentDay === null ? null : (() => {
    const { tasks, submissions } = buildDemoGraphInputs(program, currentDay);
    return buildWeeklyGraph({ memberId: 'm', tasks, submissions, dayProgress: [], totalDays: program.totalDays, currentDay });
  })();
  return { rows, currentDay, streak, tierActiveDays, graph };
}

describe('demo activity history', () => {
  it('derives the program day from the real program start', () => {
    expect(demoProgramDay({ programStartDay: START, totalDays: 90 }, at(START))).toBe(1);
    expect(demoProgramDay({ programStartDay: START, totalDays: 90 }, at(addDays(START, 29)))).toBe(30);
    expect(demoProgramDay({ programStartDay: null, totalDays: 0 }, at(START))).toBeNull();
  });

  it('only marks days inside the program window, up to today', () => {
    const { rows } = buildDemoActivity({ programStartDay: START, totalDays: 90 }, at(addDays(START, 29)));
    const keys = rows.map((r) => r.activity_date as string);
    expect(keys.every((k) => k >= START && k <= addDays(START, 29))).toBe(true);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('the most recent 12 days are active, so the member is on a live streak today', () => {
    const o = overlay({ programStartDay: START, totalDays: 90 }, addDays(START, 29));
    expect(o.streak.activeToday).toBe(true);
    expect(o.streak.currentStreak).toBeGreaterThanOrEqual(12);
    expect(o.streak.last7Days.every((d) => d.active)).toBe(true);
    for (let d = 19; d <= 30; d++) expect(isDemoActiveDay(d, 30, 90)).toBe(true);
    expect(isDemoActiveDay(5, 30, 90)).toBe(false); // rest day before the streak run
    expect(isDemoActiveDay(31, 30, 90)).toBe(false); // future day
  });

  it('no activity before the program starts', () => {
    const o = overlay({ programStartDay: START, totalDays: 90 }, addDays(START, -3));
    expect(o.rows).toHaveLength(0);
    expect(o.streak.currentStreak).toBe(0);
    expect(o.tierActiveDays).toBe(0);
    expect(o.graph!.weeks.every((w) => w.progressLevel === null || w.progressLevel === 0)).toBe(true);
  });

  it('no activity after the program ends', () => {
    const o = overlay({ programStartDay: START, totalDays: 14 }, addDays(START, 40));
    expect(o.rows.every((r) => (r.activity_date as string) <= addDays(START, 13))).toBe(true);
    expect(o.tierActiveDays).toBeLessThanOrEqual(14);
    expect(o.streak.activeToday).toBe(false);
  });

  it('a member without a batch still gets a demo streak but no Tier Access days or graph', () => {
    const o = overlay({ programStartDay: null, totalDays: 0 }, '2026-10-16');
    expect(o.streak.currentStreak).toBe(12);
    expect(o.tierActiveDays).toBe(0);
    expect(o.graph).toBeNull();
  });
});

describe('demo consistency across streak, Tier Access, graph and dashboard', () => {
  const cases: Array<[string, number, number]> = [
    ['90-day program, day 30', 90, 29],
    ['90-day program, day 1', 90, 0],
    ['14-day program, day 10', 14, 9],
    ['104-day program (extended), day 75', 104, 74],
  ];

  for (const [label, totalDays, offset] of cases) {
    it(label, () => {
      const program = { programStartDay: START, totalDays };
      const o = overlay(program, addDays(START, offset));

      // Tier Access == the streak's active-day count (every demo day is inside the window)
      expect(o.tierActiveDays).toBe(o.streak.totalActiveDays);
      expect(o.tierActiveDays).toBeLessThanOrEqual(totalDays);

      // Graph follows the real program length
      expect(o.graph!.weeks).toHaveLength(Math.ceil(totalDays / 7));

      // An activity is completed exactly when its day is an active streak day
      const activeKeys = new Set(o.rows.map((r) => r.activity_date as string));
      for (const w of o.graph!.weeks) {
        for (const a of w.activities) {
          expect(a.completed).toBe(activeKeys.has(addDays(START, a.dayNumber - 1)));
        }
        // Points never reach the revenue milestones; future weeks are not plotted
        if (w.progressLevel !== null) expect(w.progressLevel).toBeLessThanOrEqual(MAX_TASK_PROGRESS_LEVEL);
        if (w.weekNumber > o.graph!.currentWeek) expect(w.progressLevel).toBeNull();
        // A started week with nothing completed sits on the baseline
        if (w.progressLevel !== null && w.completed === 0) expect(w.progressLevel).toBe(0);
      }

      // Dashboard counters come from the same numbers
      const real = { streakDays: 99, activeDays: 99, tasksCompleted: 99, tasksTotal: 99, programName: 'Real program', totalDays, completedEpisodes: 3 };
      const s = demoStats(real, { streak: o.streak, tierActiveDays: o.tierActiveDays, graph: o.graph });
      expect(s.streakDays).toBe(o.streak.currentStreak);
      expect(s.activeDays).toBe(o.tierActiveDays);
      expect(s.tasksCompleted).toBe(o.graph!.summary.completed);
      expect(s.tasksTotal).toBe(o.graph!.summary.total);
      // Not demo-controlled: stays real
      expect(s.programName).toBe('Real program');
      expect(s.completedEpisodes).toBe(3);
    });
  }

  it('completed milestone weeks reach their level (Ads, Website, Funnels) and nothing higher', () => {
    const o = overlay({ programStartDay: START, totalDays: 90 }, addDays(START, 59)); // day 60, week 9
    const level = (n: number) => o.graph!.weeks[n - 1].progressLevel!;
    expect(level(2)).toBeGreaterThanOrEqual(1);
    expect(level(4)).toBeGreaterThanOrEqual(2);
    expect(level(6)).toBeGreaterThanOrEqual(3);
    expect(Math.max(...o.graph!.weeks.map((w) => w.progressLevel ?? 0))).toBe(MAX_TASK_PROGRESS_LEVEL);
  });

  it('demo graph activities never belong to a real member (no member-specific rows)', () => {
    const { tasks } = buildDemoGraphInputs({ programStartDay: START, totalDays: 21 }, 10);
    expect(tasks.every((t) => t.memberId === null && t.id.startsWith('demo-'))).toBe(true);
  });
});
