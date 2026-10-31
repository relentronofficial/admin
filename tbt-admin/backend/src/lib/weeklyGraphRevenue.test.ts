import { describe, expect, it } from 'vitest';
import { amountFromRevenueLabel, resolveGraphConfig, validateMilestoneInput, type GraphMilestoneRow, type GraphWeekRow } from './weeklyGraphConfig.js';
import { buildWeeklyGraph, revenueProgressLevel, type GraphTaskInput } from './weeklyGraphLogic.js';
import { isoWeekStartIst, revenueEntriesForProgram } from './weeklyGraphRevenue.js';

const ME = 'member-me';
const task = (id: string, dayNumber: number, extra: Partial<GraphTaskInput> = {}): GraphTaskInput => ({
  id, title: `Task ${id}`, dayNumber, sortOrder: 0, isRequired: true, memberId: null, ...extra,
});
const week = (id: string, label: string, startDay: number, endDay: number, sortOrder: number): GraphWeekRow =>
  ({ id, label, startDay, endDay, sortOrder, isActive: true });
const milestone = (id: string, label: string, kind: 'activity' | 'revenue', sortOrder: number, threshold: number | null = null): GraphMilestoneRow =>
  ({ id, label, kind, sortOrder, isActive: true, threshold });

const FOUR_WEEKS = [week('w1', 'W1', 1, 7, 0), week('w2', 'W2', 8, 14, 1), week('w3', 'W3', 15, 21, 2), week('w4', 'W4', 22, 28, 3)];
const REV_MS = [
  milestone('m-ads', 'Ads', 'activity', 0),
  milestone('m-web', 'Website', 'activity', 1),
  milestone('m-fun', 'Funnels', 'activity', 2),
  milestone('m-1l', '₹1 Lakh', 'revenue', 3, 100000),
  milestone('m-5l', '₹5 Lakhs', 'revenue', 4, 500000),
];

describe('isoWeekStartIst', () => {
  it('gives Monday 00:00 IST of the ISO week', () => {
    expect(isoWeekStartIst(2026, 43).toISOString()).toBe('2026-10-18T18:30:00.000Z'); // Mon 19 Oct 2026 IST
    expect(isoWeekStartIst(2026, 1).toISOString()).toBe('2025-12-28T18:30:00.000Z'); // Mon 29 Dec 2025 IST
    expect(isoWeekStartIst(2020, 53).toISOString()).toBe('2020-12-27T18:30:00.000Z'); // a 53-week year
  });
});

describe('revenueEntriesForProgram', () => {
  // Batch starts Wednesday 21 Oct 2026, 00:00 IST.
  const start = new Date('2026-10-20T18:30:00.000Z');

  it('no report date: each week goes on its Thursday (the program week holding most of its days)', () => {
    const e = revenueEntriesForProgram(
      [{ isoYear: 2026, isoWeek: 45, revenue: 3000 }, { isoYear: 2026, isoWeek: 43, revenue: 1000 }, { isoYear: 2026, isoWeek: 44, revenue: 2000 }],
      start,
    );
    // W43 Thu 22 Oct → day 2; W44 Thu 29 Oct → day 9; W45 Thu 5 Nov → day 16.
    expect(e.map((x) => [x.isoWeek, x.dayNumber, x.amount])).toEqual([[43, 2, 1000], [44, 9, 2000], [45, 16, 3000]]);
  });

  it('a week goes on the program day the member reported it (created_at), Wednesday start', () => {
    const at = (iso: string) => new Date(iso);
    const e = revenueEntriesForProgram([
      // Reported Fri 23 Oct (W43) → day 3, program week 1.
      { isoYear: 2026, isoWeek: 43, revenue: 1000, reportedAt: at('2026-10-23T06:00:00.000Z') },
      // Reported Tue 27 Oct 23:50 IST (W44, but still program week 1: days 1–7 = 21–27 Oct) → day 7.
      { isoYear: 2026, isoWeek: 44, revenue: 2000, reportedAt: at('2026-10-27T18:20:00.000Z') },
      // Reported Wed 4 Nov (W45) → day 15, program week 3.
      { isoYear: 2026, isoWeek: 45, revenue: 3000, reportedAt: at('2026-11-04T05:00:00.000Z') },
    ], start);
    expect(e.map((x) => [x.isoWeek, x.dayNumber])).toEqual([[43, 3], [44, 7], [45, 15]]);
  });

  it('a report date outside its week (e.g. entered later by an admin) falls back to the Thursday', () => {
    const e = revenueEntriesForProgram([{ isoYear: 2026, isoWeek: 44, revenue: 2000, reportedAt: new Date('2026-12-01T05:00:00.000Z') }], start);
    expect(e.map((x) => x.dayNumber)).toEqual([9]);
  });

  it('a week reported before the batch started still counts on day 1', () => {
    // Reported Mon 19 Oct (W43), two days before the Wednesday start.
    const e = revenueEntriesForProgram([{ isoYear: 2026, isoWeek: 43, revenue: 1000, reportedAt: new Date('2026-10-19T05:00:00.000Z') }], start);
    expect(e.map((x) => x.dayNumber)).toEqual([1]);
  });

  it("places by IST calendar date, whatever the batch start's time of day", () => {
    // Batch starts Monday 19 Oct 2026: once at 05:30 IST (stored as midnight UTC), once at 18:30 IST.
    for (const startsAt of [new Date('2026-10-19T00:00:00.000Z'), new Date('2026-10-19T13:00:00.000Z')]) {
      const e = revenueEntriesForProgram([
        { isoYear: 2026, isoWeek: 43, revenue: 1 },
        // Reported Mon 26 Oct 00:10 IST (Sun 25 Oct 18:40 UTC) → day 8, the first day of program week 2, never day 7.
        { isoYear: 2026, isoWeek: 44, revenue: 2, reportedAt: new Date('2026-10-25T18:40:00.000Z') },
      ], startsAt);
      expect(e.map((x) => x.dayNumber)).toEqual([4, 8]);
    }
  });

  it('skips blank weeks and weeks entirely before the batch start; never invents ₹0', () => {
    const e = revenueEntriesForProgram(
      [{ isoYear: 2026, isoWeek: 42, revenue: 5000 }, { isoYear: 2026, isoWeek: 44, revenue: null }, { isoYear: 2026, isoWeek: 99, revenue: 1 }],
      start,
    );
    expect(e).toEqual([]);
  });
});

describe('revenue milestone thresholds (admin input)', () => {
  it('a revenue milestone takes a positive amount; blank or null means no threshold', () => {
    expect(validateMilestoneInput({ label: '₹1 Lakh', kind: 'revenue', threshold: 100000 })).toMatchObject({ ok: true, value: { threshold: 100000 } });
    expect(validateMilestoneInput({ label: '₹1 Lakh', kind: 'revenue', threshold: '250000.456' })).toMatchObject({ ok: true, value: { threshold: 250000.46 } });
    expect(validateMilestoneInput({ label: '₹1 Lakh', kind: 'revenue', threshold: '' })).toMatchObject({ ok: true, value: { threshold: null } });
    for (const bad of [0, -5, 'abc', Infinity, 2e12]) {
      expect(validateMilestoneInput({ label: 'X', kind: 'revenue', threshold: bad }).ok).toBe(false);
    }
  });

  it('an activity milestone never has a threshold', () => {
    expect(validateMilestoneInput({ label: 'Ads', kind: 'activity', threshold: 5000 }).ok).toBe(false);
    // Switching a revenue milestone to activity drops its saved threshold.
    const current = { label: '₹1 Lakh', kind: 'revenue' as const, isActive: true, threshold: 100000 };
    expect(validateMilestoneInput({ kind: 'activity' }, current)).toMatchObject({ ok: true, value: { kind: 'activity', threshold: null } });
  });

  it('an update without a threshold keeps the saved one; null clears it', () => {
    const current = { label: '₹1 Lakh', kind: 'revenue' as const, isActive: true, threshold: 100000 };
    expect(validateMilestoneInput({ label: '₹1L' }, current)).toMatchObject({ ok: true, value: { label: '₹1L', threshold: 100000 } });
    expect(validateMilestoneInput({ threshold: null }, current)).toMatchObject({ ok: true, value: { threshold: null } });
  });

  it('only saved revenue milestones carry a threshold into the graph; built-in defaults never do', () => {
    const c = resolveGraphConfig({ weeks: [], milestones: [{ ...milestone('m-a', 'Ads', 'activity', 0), threshold: 999 }, milestone('m-r', '₹1 Lakh', 'revenue', 1, 100000)] });
    expect(c.milestones.map((m) => m.threshold)).toEqual([null, 100000]);
    expect(resolveGraphConfig({ weeks: [], milestones: [] }).milestones.every((m) => m.threshold === null)).toBe(true);
  });
});

describe('revenue milestones from reported revenue', () => {
  const rev = (dayNumber: number, amount: number) => ({ isoYear: 2026, isoWeek: 1, dayNumber, amount });
  const build = (extra: Partial<Parameters<typeof buildWeeklyGraph>[0]> = {}) => buildWeeklyGraph({
    memberId: ME, tasks: [], submissions: [], dayProgress: [], totalDays: 28, currentDay: 20,
    config: resolveGraphConfig({ weeks: FOUR_WEEKS, milestones: REV_MS }), ...extra,
  });
  const ms = (g: ReturnType<typeof build>, id: string) => g.config.milestones.find((m) => m.id === id)!;

  it('reaches a revenue milestone in the week the running total crosses its threshold', () => {
    const g = build({ revenue: [rev(3, 60000), rev(10, 50000)] });
    expect(g.weeks.map((w) => [w.revenue, w.cumulativeRevenue])).toEqual([[60000, 60000], [50000, 110000], [null, 110000], [null, null]]);
    expect(ms(g, 'm-1l')).toMatchObject({ reached: true, reachedBy: 'revenue', reachedWeek: 2, threshold: 100000 });
    expect(ms(g, 'm-5l')).toMatchObject({ reached: false, reachedBy: null, reachedWeek: null, threshold: 500000 });
    // W1 (₹60k) stays below ₹1 Lakh; W2 onwards is on it, ₹10k of the way to ₹5 Lakhs
    // (4 + 10k/400k = 4.03, revenueProgressLevel); W4 has not started.
    expect(g.weeks.map((w) => w.progressLevel)).toEqual([0, 4.03, 4.03, null]);
    expect(g.revenue).toEqual({ source: 'self_reported', totalToDate: 110000 });
  });

  it('recalculates from the data: revenue edited below the threshold un-reaches it', () => {
    const g = build({ revenue: [rev(3, 60000), rev(10, 20000)] });
    expect(ms(g, 'm-1l')).toMatchObject({ reached: false, reachedBy: null });
    expect(g.weeks[1].progressLevel).toBe(0);
  });

  it('no reported revenue: nothing reached, no revenue figures, nothing assumed', () => {
    const g = build({ revenue: [] });
    expect(g.config.milestones.filter((m) => m.kind === 'revenue').every((m) => !m.reached)).toBe(true);
    expect(g.weeks.every((w) => w.revenue === null && w.cumulativeRevenue === null)).toBe(true);
    expect(g.revenue.totalToDate).toBeNull();
  });

  it('no threshold set: the amount the label names is used (same rule as the website); a label naming none is never reached', () => {
    const noThreshold = [
      ...REV_MS.map((m) => (m.id === 'm-1l' ? { ...m, threshold: null } : m)),
      milestone('m-big', 'Big revenue', 'revenue', 5),
    ];
    const g = build({ config: resolveGraphConfig({ weeks: FOUR_WEEKS, milestones: noThreshold }), revenue: [rev(3, 60_000), rev(10, 50_000)] });
    // "₹1 Lakh" → ₹1,00,000: reached in W2 (running ₹1,10,000); the response still reports no admin threshold.
    expect(ms(g, 'm-1l')).toMatchObject({ reached: true, reachedBy: 'revenue', reachedWeek: 2, threshold: null });
    expect(ms(g, 'm-5l')).toMatchObject({ reached: false });
    expect(ms(g, 'm-big')).toMatchObject({ reached: false, threshold: null });
    expect(g.weeks.map((w) => w.progressLevel)).toEqual([0, 4.03, 4.03, null]); // identical to the ₹1,00,000 threshold case
    // The built-in default rows ("1 lakh", "5 Lakhs", "1 crore") work the same way.
    const d = buildWeeklyGraph({ memberId: ME, tasks: [], submissions: [], dayProgress: [], totalDays: 14, currentDay: 9, revenue: [rev(1, 9_00_000)] });
    expect(d.config.milestones.filter((m) => m.reached).map((m) => m.label)).toEqual(['1 lakh', '5 Lakhs']);
    expect(d.config.milestones.every((m) => m.threshold === null)).toBe(true);
  });

  it('the label rule matches the website parser', () => {
    // Same cases as tbt-user-web weeklyGraphRevenueAxis amountFromRevenueLabel.
    const cases: Array<[string, number | null]> = [
      ['1 lakh', 1_00_000], ['5 Lakhs', 5_00_000], ['1 crore', 1_00_00_000], ['₹1 Crore', 1_00_00_000], ['2.5 crores', 2_50_00_000],
      ['50L', 50_00_000], ['1 Cr', 1_00_00_000], ['₹1,00,000', 1_00_000], ['10k', 10_000], ['Rs. 25 lacs', 25_00_000],
      ['Ads', null], ['Big revenue', null], ['', null], ['0 lakh', null],
    ];
    for (const [label, amount] of cases) expect([label, amountFromRevenueLabel(label)]).toEqual([label, amount]);
  });

  it('adding or completing an activity linked to a revenue milestone never reaches it', () => {
    const g = build({ tasks: [task('t', 2, { graphMilestoneId: 'm-1l' })], submissions: [{ taskId: 't', dayNumber: 2, status: 'approved' }] });
    expect(ms(g, 'm-1l').reached).toBe(false);
    // The marker still sits on that milestone's row: position only.
    expect(g.weeks[0].activities[0]).toMatchObject({ milestoneId: 'm-1l', milestoneLabel: '₹1 Lakh', level: 4, completed: true });
    expect(g.weeks[0].progressLevel).toBe(3); // capped at the last activity milestone
  });

  it('an admin/mentor record still reaches a revenue milestone (manual override)', () => {
    const g = build({ records: [{ milestoneId: 'm-5l', weekId: 'w3' }] });
    expect(ms(g, 'm-5l')).toMatchObject({ reached: true, reachedBy: 'record', reachedWeek: 3 });
    expect(g.weeks[2].progressLevel).toBe(5);
  });

  it('revenue evidence is reported ahead of a record for the same milestone', () => {
    const g = build({ revenue: [rev(3, 150000)], records: [{ milestoneId: 'm-1l', weekId: 'w3' }] });
    expect(ms(g, 'm-1l')).toMatchObject({ reached: true, reachedBy: 'revenue', reachedWeek: 1 });
  });

  it('each activity carries its own milestone link, so several in one week stay separate', () => {
    const g = build({ tasks: [task('a', 1, { graphMilestoneId: 'm-ads' }), task('b', 2, { graphMilestoneId: 'm-web' }), task('c', 3)] });
    expect(g.weeks[0].activities.map((a) => [a.taskId, a.milestoneLabel, a.level])).toEqual([['a', 'Ads', 1], ['b', 'Website', 2], ['c', null, 0]]);
  });

  it('W1–W10 show exactly ten weeks; adding W11 shows eleven', () => {
    const ten = Array.from({ length: 10 }, (_, i) => week(`w${i + 1}`, `W${i + 1}`, i * 7 + 1, i * 7 + 7, i));
    const g10 = build({ config: resolveGraphConfig({ weeks: ten, milestones: REV_MS }), totalDays: 90, currentDay: 40 });
    expect(g10.weeks.map((w) => w.label)).toEqual(ten.map((w) => w.label));
    const eleven = [...ten, week('w11', 'W11', 71, 77, 10)];
    const g11 = build({ config: resolveGraphConfig({ weeks: eleven, milestones: REV_MS }), totalDays: 90, currentDay: 40 });
    expect(g11.weeks).toHaveLength(11);
    expect(g11.weeks.at(-1)).toMatchObject({ label: 'W11', weekId: 'w11', startDay: 71, endDay: 77 });
  });
});

describe('revenue progression between ₹1 lakh, ₹5 lakhs and ₹1 crore', () => {
  // Axis: Ads 1, Website 2, Funnels 3, ₹1 lakh 4, ₹5 lakhs 5, ₹1 crore 6.
  const T = [null, null, null, 100000, 500000, 10000000];

  it('revenueProgressLevel: nothing below the first threshold, then proportional between thresholds', () => {
    expect(revenueProgressLevel(0, T)).toBe(0);
    expect(revenueProgressLevel(99999, T)).toBe(0); // revenue alone never lifts the line before ₹1 lakh
    expect(revenueProgressLevel(100000, T)).toBe(4);
    expect(revenueProgressLevel(300000, T)).toBe(4.5); // halfway from ₹1 lakh to ₹5 lakhs
    expect(revenueProgressLevel(500000, T)).toBe(5);
    expect(revenueProgressLevel(5250000, T)).toBe(5.5);
    expect(revenueProgressLevel(10000000, T)).toBe(6); // ₹1 crore reached
    expect(revenueProgressLevel(25000000, T)).toBe(6); // capped at the top milestone
  });

  it('a revenue milestone without a threshold is skipped; a non-increasing order never lowers the point', () => {
    expect(revenueProgressLevel(300000, [null, null, null, 100000, null, 10000000])).toBe(4.04); // 1L → 1Cr spans two rows: 4 + 200k/9.9M × 2
    expect(revenueProgressLevel(300000, [null, null, null, 500000, 100000])).toBe(5);
  });

  const config = resolveGraphConfig({
    weeks: FOUR_WEEKS,
    milestones: [
      milestone('m-ads', 'Ads', 'activity', 0), milestone('m-web', 'Website', 'activity', 1), milestone('m-fun', 'Funnels', 'activity', 2),
      milestone('m-1l', '₹1 lakh', 'revenue', 3, 100000), milestone('m-5l', '₹5 lakhs', 'revenue', 4, 500000),
      milestone('m-1c', '₹1 crore', 'revenue', 5, 10000000),
    ],
  });
  const tasks = [task('a1', 2, { graphMilestoneId: 'm-fun' }), task('a2', 9), task('a3', 16), task('a4', 23)];
  const build = (revenue: Array<{ dayNumber: number; amount: number }>, approvedIds: string[] = ['a1']) =>
    buildWeeklyGraph({
      memberId: ME, tasks, totalDays: 28, currentDay: 25, config,
      submissions: approvedIds.map((id) => ({ taskId: id, dayNumber: tasks.find((t) => t.id === id)!.dayNumber, status: 'approved' })),
      dayProgress: [],
      revenue: revenue.map((e, i) => ({ isoYear: 2026, isoWeek: 40 + i, ...e })),
    });

  it('weekly points follow cumulative revenue up to ₹1 crore', () => {
    const g = build([{ dayNumber: 8, amount: 100000 }, { dayNumber: 15, amount: 200000 }, { dayNumber: 22, amount: 9700000 }]);
    expect(g.weeks.map((w) => w.progressLevel)).toEqual([3, 4, 4.5, 6]);
    const m = Object.fromEntries(g.config.milestones.map((x) => [x.label, [x.reached, x.reachedWeek]]));
    expect(m['₹1 lakh']).toEqual([true, 2]);
    expect(m['₹5 lakhs']).toEqual([true, 4]);
    expect(m['₹1 crore']).toEqual([true, 4]);
  });

  it('a revenue update is reflected on the next build', () => {
    const before = build([{ dayNumber: 8, amount: 100000 }]);
    const after = build([{ dayNumber: 8, amount: 100000 }, { dayNumber: 15, amount: 400000 }]);
    expect(before.weeks[2].progressLevel).toBe(4);
    expect(after.weeks[2].progressLevel).toBe(5);
  });

  it('activity progress and revenue never overwrite each other: each week takes the higher of the two', () => {
    // W1: Funnels activity (3) with ₹50k revenue (below ₹1 lakh) → activity wins, revenue does not pull it down.
    const g = build([{ dayNumber: 1, amount: 50000 }]);
    expect(g.weeks[0].progressLevel).toBe(3);
    expect(g.config.milestones.find((x) => x.label === '₹1 lakh')!.reached).toBe(false);
    // W2: no approved activity, ₹3 lakhs cumulative → revenue wins; the activity milestone stays unreached by revenue.
    const r = build([{ dayNumber: 8, amount: 300000 }], []);
    expect(r.weeks[1].progressLevel).toBe(4.5);
    expect(r.config.milestones.find((x) => x.label === 'Funnels')!.reached).toBe(false);
  });
});
