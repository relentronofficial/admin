import { describe, expect, it } from 'vitest';
import {
  buildCohortGrid,
  buildDigestText,
  buildFunnel,
  digestAlerts,
  fillSeries,
  istDate,
  median,
  pageSection,
  pctChange,
  resolveRange,
  riskScore,
  type DigestInput,
  type RiskInput,
} from './insightsLogic.js';

// 22 Nov 2026, 06:00 IST
const NOW = new Date('2026-11-22T00:30:00Z');

describe('dates and ranges', () => {
  it('uses IST calendar days', () => {
    expect(istDate(new Date('2026-11-21T19:00:00Z'))).toBe('2026-11-22'); // 00:30 IST
    expect(istDate(new Date('2026-11-21T18:00:00Z'))).toBe('2026-11-21'); // 23:30 IST
  });

  it('defaults to the last 30 days with an equal previous period', () => {
    const r = resolveRange({}, NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.range).toMatchObject({ key: '30d', from: '2026-10-24', to: '2026-11-22', days: 30, prevFrom: '2026-09-24', prevTo: '2026-10-23', bucket: 'day' });
    expect(r.range.start.toISOString()).toBe('2026-10-23T18:30:00.000Z');
    expect(r.range.end.toISOString()).toBe('2026-11-22T18:30:00.000Z');
  });

  it('7d and 90d presets', () => {
    const a = resolveRange({ range: '7d' }, NOW);
    expect(a.ok && a.range.from).toBe('2026-11-16');
    const b = resolveRange({ range: '90d' }, NOW);
    expect(b.ok && b.range.days).toBe(90);
  });

  it('custom ranges are validated, clipped to today and weekly when long', () => {
    expect(resolveRange({ range: 'custom', from: '2026-11-10' }, NOW).ok).toBe(false);
    expect(resolveRange({ range: 'custom', from: '2026-11-10', to: '2026-11-01' }, NOW).ok).toBe(false);
    expect(resolveRange({ range: 'custom', from: '2024-01-01', to: '2026-11-01' }, NOW).ok).toBe(false);
    const r = resolveRange({ range: 'custom', from: '2026-11-01', to: '2026-12-31' }, NOW);
    expect(r.ok && r.range.to).toBe('2026-11-22');
    const long = resolveRange({ range: 'custom', from: '2026-01-01', to: '2026-11-22' }, NOW);
    expect(long.ok && long.range.bucket).toBe('week');
  });
});

describe('number helpers', () => {
  it('pctChange', () => {
    expect(pctChange(150, 100)).toBe(50);
    expect(pctChange(50, 100)).toBe(-50);
    expect(pctChange(5, 0)).toBeNull();
  });
  it('median', () => {
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
  it('fillSeries fills missing days and weeks', () => {
    const s = fillSeries({ from: '2026-11-20', to: '2026-11-22', bucket: 'day' }, [{ bucket: '2026-11-21', n: 4 }], ['n']);
    expect(s).toEqual([{ bucket: '2026-11-20', n: 0 }, { bucket: '2026-11-21', n: 4 }, { bucket: '2026-11-22', n: 0 }]);
    const w = fillSeries({ from: '2026-11-01', to: '2026-11-22', bucket: 'week' }, [], ['n']);
    expect(w.map((x) => x.bucket)).toEqual(['2026-11-01', '2026-11-08', '2026-11-15', '2026-11-22']);
  });
});

describe('buildFunnel', () => {
  it('computes conversion and drop-off per step', () => {
    const f = buildFunnel([
      { key: 'a', label: 'Signed up', count: 200 },
      { key: 'b', label: 'Submitted', count: 120 },
      { key: 'c', label: 'Approved', count: 90 },
    ]);
    expect(f[0]).toMatchObject({ ofStart: 100, ofPrevious: null, dropped: 0 });
    expect(f[1]).toMatchObject({ ofStart: 60, ofPrevious: 60, dropped: 80 });
    expect(f[2]).toMatchObject({ ofStart: 45, ofPrevious: 75, dropped: 30 });
  });
  it('handles an empty first step', () => {
    expect(buildFunnel([{ key: 'a', label: 'A', count: 0 }, { key: 'b', label: 'B', count: 0 }])[1].ofStart).toBeNull();
  });
});

describe('buildCohortGrid', () => {
  it('marks weeks not reached or not tracked as null', () => {
    const grid = buildCohortGrid(
      [
        { cohort: '2026-09', size: 10, firstSignup: '2026-09-01', lastSignup: '2026-09-30', activeByWeek: { 0: 9, 7: 4 } },
        { cohort: '2026-11', size: 4, firstSignup: '2026-11-02', lastSignup: '2026-11-20', activeByWeek: { 0: 4 } },
      ],
      10,
      '2026-11-22',
      '2026-10-20',
    );
    // Sept cohort: weeks before the earliest member's tracked week are null.
    expect(grid[0].weeks[0]).toBeNull();
    expect(grid[0].weeks[6]).toBeNull(); // 2026-09-01 + 42d is before tracking started
    expect(grid[0].weeks[7]).toBe(40); // 2026-09-01 + 49d = tracking start; last sign-up + 49d = 11-18 reached
    expect(grid[0].weeks[8]).toBeNull(); // last sign-up + 56d is still in the future
    // Nov cohort: week 0 measurable, week 1 not reached for the 20 Nov sign-up.
    expect(grid[1].weeks[0]).toBe(100);
    expect(grid[1].weeks[1]).toBeNull();
  });
});

describe('riskScore', () => {
  const base: RiskInput = {
    daysSinceActive: 0, activeDaysLast7: 5, activeDaysPrev7: 5, weeklyReportRequired: true,
    missedWeeklyReports: 0, avgLessonRating: 8, accessEndsInDays: null, daysSinceLastLesson: 2, staleOpenTickets: 0,
  };
  it('a healthy member scores low with no reasons', () => {
    expect(riskScore(base)).toEqual({ score: 0, level: 'low', reasons: [] });
  });
  it('stacks factors into a high score with reasons', () => {
    const r = riskScore({ ...base, daysSinceActive: 10, activeDaysLast7: 0, activeDaysPrev7: 4, missedWeeklyReports: 2, avgLessonRating: 4, daysSinceLastLesson: 20, accessEndsInDays: 5, staleOpenTickets: 1 });
    expect(r.score).toBe(90);
    expect(r.level).toBe('high');
    expect(r.reasons).toContain('Inactive 10 days');
    expect(r.reasons).toContain('Missed the last 2 weekly reports');
    expect(r.reasons).toContain('Course access ends in 5 days');
  });
  it('never active counts like long inactivity, capped at 100', () => {
    const r = riskScore({ ...base, daysSinceActive: null });
    expect(r.score).toBe(35);
    expect(r.reasons[0]).toBe('Never active');
  });
  it('weekly report only counts when required', () => {
    expect(riskScore({ ...base, weeklyReportRequired: false, missedWeeklyReports: 2 }).score).toBe(0);
  });
});

describe('pageSection', () => {
  const id = '3f2b8a40-1c2d-4e5f-8a9b-0c1d2e3f4a5b';
  it('maps paths to sections', () => {
    expect(pageSection('/community')).toEqual({ section: 'community', refId: '' });
    expect(pageSection(`/courses/${id}?x=1`)).toEqual({ section: 'course-page', refId: id });
    expect(pageSection(`/learning/${id}`)).toEqual({ section: 'learning', refId: id });
    expect(pageSection('/workshop/some-slug')).toEqual({ section: 'workshops', refId: '' });
    expect(pageSection('/Profile')).toEqual({ section: 'profile', refId: '' });
  });
  it('ignores unknown or malformed paths', () => {
    expect(pageSection('/')).toBeNull();
    expect(pageSection('/admin-secret')).toBeNull();
    expect(pageSection('https://evil.example/community')).toBeNull();
    expect(pageSection(42)).toBeNull();
  });
});

describe('digest', () => {
  const d: DigestInput = {
    weekLabel: '16–22 Nov 2026', revenue: 150000, revenuePrev: 100000, newMembers: 12, newMembersPrev: 10,
    activeMembers: 70, activeMembersPrev: 100, lessonsCompleted: 300, lessonsCompletedPrev: 300,
    weeklyReportCompliance: 55, failedPayments: 2, pendingPayments: 3, openTickets: 4, overdueTickets: 1,
    highRiskMembers: 6, topRisk: [{ name: 'Priya S', score: 80, reasons: ['Inactive 14 days', 'Missed the last 2 weekly reports', 'x'] }],
  };
  it('raises alerts for low compliance, failed payments, overdue tickets and an activity drop', () => {
    expect(digestAlerts(d)).toEqual([
      'Weekly report compliance is 55% (below 60%)',
      '2 failed payments last week',
      '1 support ticket past the resolve deadline',
      'Active members fell 30% week on week',
    ]);
  });
  it('builds a readable summary', () => {
    const t = buildDigestText(d);
    expect(t).toContain('Revenue: ₹1,50,000 (+50%)');
    expect(t).toContain('Lessons completed: 300 (+0%)');
    expect(t).toContain('• Priya S (80) — Inactive 14 days; Missed the last 2 weekly reports');
  });
});
