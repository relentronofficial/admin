// End-to-end scenario for the Weekly Activity Graph with fake data: the same
// pure pipeline the member endpoint (getMyWeeklyGraphHandler) runs —
// stored rows → resolveGraphConfig, member_revenue_reports rows →
// revenueEntriesForProgram, everything → buildWeeklyGraph. No DB, no network.
import { describe, expect, it } from 'vitest';
import { buildWeeklyGraph } from './weeklyGraphLogic.js';
import { resolveGraphConfig, defaultWeeks, type GraphMilestoneRow, type GraphWeekRow } from './weeklyGraphConfig.js';
import { revenueEntriesForProgram } from './weeklyGraphRevenue.js';

const DAY = 86_400_000;
const IST = 330 * 60_000;
const MEMBER = 'fixture-member';
const AMOUNTS = [5_000, 15_000, 30_000, 60_000, 1_00_000]; // test amounts for W1..W5

const WEEKS: GraphWeekRow[] = [1, 2, 3, 4, 5].map((n) => ({
  id: `w${n}`, label: `W${n}`, startDay: (n - 1) * 7 + 1, endDay: n * 7, sortOrder: n - 1, isActive: true,
}));
const ms = (i: number, label: string, kind: 'activity' | 'revenue', threshold: number | null = null): GraphMilestoneRow =>
  ({ id: `m${i}`, label, kind, sortOrder: i, isActive: true, threshold });
const WITH_THRESHOLDS = [
  ms(0, 'Ads', 'activity'), ms(1, 'Website', 'activity'), ms(2, 'Funnels', 'activity'),
  ms(3, '1 lakh', 'revenue', 1_00_000), ms(4, '5 Lakhs', 'revenue', 5_00_000), ms(5, '1 crore', 'revenue', 1_00_00_000),
];
const WITHOUT_THRESHOLDS = WITH_THRESHOLDS.map((m) => ({ ...m, threshold: null }));

// One approved activity in each of W1–W4 (task-progress input), W5's not approved yet.
const TASKS = [3, 10, 17, 24, 31].map((dayNumber, i) => ({
  id: `t${i + 1}`, title: `Fixture task ${i + 1}`, dayNumber, sortOrder: 0, isRequired: true, memberId: null,
  graphMilestoneId: ['m0', 'm1', 'm2', 'm0', 'm2'][i],
}));
const SUBMISSIONS = TASKS.slice(0, 4).map((t) => ({ taskId: t.id, dayNumber: t.dayNumber, status: 'approved' }));

/** ISO week (IST) of an instant — what the member's save handler stores. */
function isoWeekOfIst(d: Date) {
  const local = new Date(d.getTime() + IST);
  const t = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
  t.setUTCDate(t.getUTCDate() + 3 - ((t.getUTCDay() + 6) % 7));
  const isoYear = t.getUTCFullYear();
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  jan4.setUTCDate(jan4.getUTCDate() + 3 - ((jan4.getUTCDay() + 6) % 7));
  return { isoYear, isoWeek: 1 + Math.round((t.getTime() - jan4.getTime()) / (7 * DAY)) };
}

/** The member saves week n's amount on day `dayInWeek` (1–7) of program week n, at noon IST. */
const saved = (batchStart: Date, dayInWeek: number) => AMOUNTS.map((revenue, i) => {
  const reportedAt = new Date(batchStart.getTime() + (i * 7 + dayInWeek - 1) * DAY + 12 * 3_600_000);
  return { ...isoWeekOfIst(reportedAt), revenue, reportedAt };
});

const graph = (batchStart: Date, milestones: GraphMilestoneRow[], dayInWeek = 3) => buildWeeklyGraph({
  memberId: MEMBER, tasks: TASKS, submissions: SUBMISSIONS, dayProgress: [], totalDays: 35, currentDay: 31,
  config: resolveGraphConfig({ weeks: WEEKS, milestones }), records: [],
  revenue: revenueEntriesForProgram(saved(batchStart, dayInWeek), batchStart),
});

const MONDAY = new Date(Date.UTC(2026, 8, 27, 18, 30));    // Mon 28 Sep 2026, 00:00 IST
const WEDNESDAY = new Date(Date.UTC(2026, 8, 29, 18, 30)); // Wed 30 Sep 2026, 00:00 IST
const FRIDAY = new Date(Date.UTC(2026, 9, 1, 18, 30));     // Fri 2 Oct 2026, 00:00 IST

describe('scenario: W1–W5 revenue lands in the program week it was reported in', () => {
  for (const [name, start] of [['Monday', MONDAY], ['Wednesday', WEDNESDAY], ['Friday', FRIDAY]] as const) {
    for (const dayInWeek of [1, 3, 7]) {
      it(`${name} start, reported on day ${dayInWeek} of each week: ₹5,000 / ₹15,000 / ₹30,000 / ₹60,000 / ₹1,00,000`, () => {
        const g = graph(start, WITH_THRESHOLDS, dayInWeek);
        expect(g.weeks.map((w) => [w.label, w.revenue])).toEqual([
          ['W1', 5_000], ['W2', 15_000], ['W3', 30_000], ['W4', 60_000], ['W5', 1_00_000],
        ]);
        expect(g.weeks.find((w) => w.isCurrent)!.label).toBe('W5');
        expect(g.revenue.totalToDate).toBe(2_10_000);
      });
    }
  }
});

describe('scenario: revenue milestones, thresholds present vs absent', () => {
  it('thresholds present: "1 lakh" reached in W4 (running ₹1,10,000); "5 Lakhs" not reached', () => {
    const g = graph(WEDNESDAY, WITH_THRESHOLDS);
    const m = Object.fromEntries(g.config.milestones.map((x) => [x.label, x]));
    expect(g.weeks.map((w) => w.cumulativeRevenue)).toEqual([5_000, 20_000, 50_000, 1_10_000, 2_10_000]);
    expect(m['1 lakh']).toMatchObject({ reached: true, reachedBy: 'revenue', reachedWeek: 4, threshold: 1_00_000 });
    expect(m['5 Lakhs']).toMatchObject({ reached: false });
  });

  it('thresholds absent: the labels\' amounts give the same reached milestones and line as the thresholds', () => {
    const a = graph(WEDNESDAY, WITH_THRESHOLDS);
    const b = graph(WEDNESDAY, WITHOUT_THRESHOLDS);
    const pick = (g: typeof a) => g.config.milestones.map((m) => [m.label, m.reached, m.reachedWeek, m.reachedBy]);
    expect(pick(b)).toEqual(pick(a));
    expect(b.weeks.map((w) => w.progressLevel)).toEqual(a.weeks.map((w) => w.progressLevel));
    expect(b.config.milestones.every((m) => m.threshold === null)).toBe(true); // no admin threshold is invented
  });

  it('the task-progress part of the line is unchanged: W1–W3 at the Funnels cap from approved tasks alone', () => {
    const g = graph(MONDAY, WITH_THRESHOLDS);
    expect(g.weeks.slice(0, 3).map((w) => w.progressLevel)).toEqual([3, 3, 3]);
    expect(g.weeks.map((w) => [w.completed, w.total])).toEqual([[1, 1], [1, 1], [1, 1], [1, 1], [0, 1]]);
  });
});

describe('scenario: 28-day program, 35-day batch, never configured', () => {
  it('a member graph given the program span lists W1–W5, the same as defaultWeeks of that span', () => {
    const g = buildWeeklyGraph({
      memberId: MEMBER, tasks: [], submissions: [], dayProgress: [], totalDays: 28, currentDay: 31, defaultSpanDays: 35,
    });
    expect(g.weeks.map((w) => [w.label, w.startDay, w.endDay])).toEqual(defaultWeeks(35).map((w) => [w.label, w.startDay, w.endDay]));
    expect(g.weeks.map((w) => w.label)).toEqual(['W1', 'W2', 'W3', 'W4', 'W5']);
  });
});
