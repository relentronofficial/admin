import { describe, expect, it } from 'vitest';

import {
  DEFAULT_GRAPH_MILESTONES,
  canEditGraphConfig,
  canRecordGraphProgress,
  defaultWeeks,
  findOverlappingWeek,
  hasDuplicateLabel,
  milestoneIndexForLabel,
  resolveGraphConfig,
  taskProgressCap,
  validateActivityInput,
  validateMilestoneInput,
  validateReorder,
  validateWeekInput,
  type GraphMilestoneRow,
  type GraphWeekRow,
} from './weeklyGraphConfig.js';
import { buildWeeklyGraph, type GraphTaskInput } from './weeklyGraphLogic.js';

const ME = 'member-me';
const OTHER = 'member-other';
const task = (id: string, dayNumber: number, extra: Partial<GraphTaskInput> = {}): GraphTaskInput => ({
  id, title: `Task ${id}`, dayNumber, sortOrder: 0, isRequired: true, memberId: null, ...extra,
});
const week = (id: string, label: string, startDay: number, endDay: number, sortOrder: number, isActive = true): GraphWeekRow =>
  ({ id, label, startDay, endDay, sortOrder, isActive });
const milestone = (id: string, label: string, kind: 'activity' | 'revenue', sortOrder: number, isActive = true, threshold: number | null = null): GraphMilestoneRow =>
  ({ id, label, kind, sortOrder, isActive, threshold });

const DEFAULT_MS = [
  milestone('m-ads', 'Ads', 'activity', 0),
  milestone('m-web', 'Website', 'activity', 1),
  milestone('m-fun', 'Funnels', 'activity', 2),
  milestone('m-1l', '1 lakh', 'revenue', 3),
  milestone('m-1c', '1 crore', 'revenue', 4),
];
const FOUR_WEEKS = [week('w1', 'W1', 1, 7, 0), week('w2', 'W2', 8, 14, 1), week('w3', 'W3', 15, 21, 2), week('w4', 'W4', 22, 28, 3)];

describe('defaults', () => {
  it('keeps the current five labels, three activity then two revenue', () => {
    expect(DEFAULT_GRAPH_MILESTONES.map((m) => m.label)).toEqual(['Ads', 'Website', 'Funnels', '1 lakh', '1 crore']);
    expect(taskProgressCap(DEFAULT_GRAPH_MILESTONES)).toBe(3);
  });

  it('default weeks are 7-day weeks across the program length', () => {
    expect(defaultWeeks(20)).toEqual([
      { label: 'W1', startDay: 1, endDay: 7 }, { label: 'W2', startDay: 8, endDay: 14 }, { label: 'W3', startDay: 15, endDay: 20 },
    ]);
    expect(defaultWeeks(0)).toEqual([]);
  });

  it('an unconfigured program resolves to the defaults (empty configuration is safe)', () => {
    const c = resolveGraphConfig({ weeks: [], milestones: [] });
    expect(c.source).toBe('default');
    expect(c.weeks).toBeNull();
    expect(c.milestones.map((m) => [m.id, m.label])).toEqual(DEFAULT_GRAPH_MILESTONES.map((m) => [null, m.label]));
  });
});

describe('resolveGraphConfig', () => {
  it('uses active items in admin order and remembers the full configured range', () => {
    const c = resolveGraphConfig({
      weeks: [week('b', 'Second', 8, 14, 1), week('a', 'First', 1, 7, 0), week('x', 'Off', 15, 21, 2, false)],
      milestones: [milestone('m2', 'Website', 'activity', 1), milestone('m1', 'Ads', 'activity', 0), milestone('m3', 'Old', 'activity', 2, false)],
    });
    expect(c.source).toBe('program');
    expect(c.weeks!.map((w) => w.label)).toEqual(['First', 'Second']);
    expect(c.coveredUntilDay).toBe(21);
    expect(c.milestones.map((m) => m.label)).toEqual(['Ads', 'Website']);
  });
});

describe('task progress cap and label links', () => {
  it('tasks only reach activity milestones below the first revenue milestone', () => {
    expect(taskProgressCap([{ kind: 'activity' }, { kind: 'revenue' }, { kind: 'activity' }])).toBe(1);
    expect(taskProgressCap([{ kind: 'revenue' }])).toBe(0);
  });

  it('matches a legacy milestone label case-insensitively, singular or plural', () => {
    const ms = [{ label: 'Ads' }, { label: 'Website' }, { label: 'Funnels' }];
    expect(milestoneIndexForLabel(ms, 'ad')).toBe(0);
    expect(milestoneIndexForLabel(ms, ' FUNNEL ')).toBe(2);
    expect(milestoneIndexForLabel(ms, 'Launch ads')).toBe(-1);
    expect(milestoneIndexForLabel(ms, null)).toBe(-1);
  });
});

describe('server-side validation', () => {
  it('weeks: label, whole days in range, end after start', () => {
    expect(validateWeekInput({ label: ' W5 ', startDay: 29, endDay: 35 })).toEqual({ ok: true, value: { label: 'W5', startDay: 29, endDay: 35, isActive: true } });
    expect(validateWeekInput({ label: '', startDay: 1, endDay: 7 }).ok).toBe(false);
    expect(validateWeekInput({ label: 'x'.repeat(61), startDay: 1, endDay: 7 }).ok).toBe(false);
    expect(validateWeekInput({ label: 'W', startDay: 0, endDay: 7 }).ok).toBe(false);
    expect(validateWeekInput({ label: 'W', startDay: 1.5, endDay: 7 }).ok).toBe(false);
    expect(validateWeekInput({ label: 'W', startDay: 9, endDay: 8 }).ok).toBe(false);
    expect(validateWeekInput({ label: 'W', startDay: 1, endDay: 99999 }).ok).toBe(false);
    expect(validateWeekInput({ label: 'W', startDay: 1, endDay: 7, isActive: 'yes' }).ok).toBe(false);
  });

  it('week update keeps unspecified fields (rename only)', () => {
    const current = { label: 'W1', startDay: 1, endDay: 7, isActive: true };
    expect(validateWeekInput({ label: 'Kick-off' }, current)).toEqual({ ok: true, value: { ...current, label: 'Kick-off' } });
    expect(validateWeekInput({ isActive: false }, current)).toEqual({ ok: true, value: { ...current, isActive: false } });
  });

  it('milestones: label and kind', () => {
    expect(validateMilestoneInput({ label: '₹5 Lakhs', kind: 'revenue' })).toEqual({ ok: true, value: { label: '₹5 Lakhs', kind: 'revenue', isActive: true, threshold: null } });
    expect(validateMilestoneInput({ label: 'Sales Automation' })).toEqual({ ok: true, value: { label: 'Sales Automation', kind: 'activity', isActive: true, threshold: null } });
    expect(validateMilestoneInput({ label: 'X', kind: 'profit' }).ok).toBe(false);
    expect(validateMilestoneInput({ label: '   ' }).ok).toBe(false);
  });

  it('activities: title, ids or null, booleans', () => {
    const id = '11111111-1111-1111-1111-111111111111';
    expect(validateActivityInput({ title: ' Set up pixel ', weekId: id })).toEqual({ ok: true, value: { title: 'Set up pixel', weekId: id, milestoneId: null, isRequired: true, isActive: true } });
    expect(validateActivityInput({ title: '' }).ok).toBe(false);
    expect(validateActivityInput({ title: 'x', weekId: 'not-an-id' }).ok).toBe(false);
    expect(validateActivityInput({ title: 'x', isActive: 1 }).ok).toBe(false);
  });

  it('rejects duplicate labels case-insensitively (ignoring the item being edited)', () => {
    const items = [{ id: '1', label: 'Ads' }, { id: '2', label: 'Website' }];
    expect(hasDuplicateLabel(items, ' ads ')).toBe(true);
    expect(hasDuplicateLabel(items, 'ADS', '1')).toBe(false);
    expect(hasDuplicateLabel(items, 'Funnels')).toBe(false);
  });

  it('rejects overlapping active weeks; disabled weeks never clash', () => {
    expect(findOverlappingWeek(FOUR_WEEKS, { startDay: 7, endDay: 9, isActive: true })?.label).toBe('W1');
    expect(findOverlappingWeek(FOUR_WEEKS, { startDay: 29, endDay: 35, isActive: true })).toBeNull();
    expect(findOverlappingWeek(FOUR_WEEKS, { startDay: 1, endDay: 7, isActive: true }, 'w1')).toBeNull();
    expect(findOverlappingWeek(FOUR_WEEKS, { startDay: 1, endDay: 7, isActive: false })).toBeNull();
    expect(findOverlappingWeek([week('d', 'Old', 1, 7, 0, false)], { startDay: 1, endDay: 7, isActive: true })).toBeNull();
  });

  it('reorder must list every existing id exactly once', () => {
    expect(validateReorder(['a', 'b', 'c'], ['c', 'a', 'b'])).toEqual({ ok: true, value: ['c', 'a', 'b'] });
    expect(validateReorder(['a', 'b'], ['a']).ok).toBe(false);
    expect(validateReorder(['a', 'b'], ['a', 'a']).ok).toBe(false);
    expect(validateReorder(['a', 'b'], ['a', 'z']).ok).toBe(false);
    expect(validateReorder(['a'], 'a').ok).toBe(false);
  });
});

describe('roles', () => {
  it('only Admin and Super Admin edit the configuration; Mentor may also record member milestones', () => {
    expect(['super_admin', 'admin'].every(canEditGraphConfig)).toBe(true);
    expect(['mentor', 'moderator', 'account_manager', '', null, undefined].some(canEditGraphConfig)).toBe(false);
    expect(['super_admin', 'admin', 'mentor'].every(canRecordGraphProgress)).toBe(true);
    expect(['moderator', 'account_manager', null].some(canRecordGraphProgress)).toBe(false);
  });
});

describe('member graph from the program configuration', () => {
  const config = (weeks = FOUR_WEEKS, milestones = DEFAULT_MS) => resolveGraphConfig({ weeks, milestones });
  const build = (extra: Partial<Parameters<typeof buildWeeklyGraph>[0]> = {}) => buildWeeklyGraph({
    memberId: ME, tasks: [], submissions: [], dayProgress: [], totalDays: 28, currentDay: 20, config: config(), ...extra,
  });

  it('uses configured week labels, order and ids; the Y axis comes from the config', () => {
    const g = build({ config: config([week('w2', 'Launch', 8, 14, 0), week('w1', 'Setup', 1, 7, 1)]), totalDays: 14 });
    expect(g.weeks.map((w) => [w.label, w.weekId])).toEqual([['Launch', 'w2'], ['Setup', 'w1']]);
    expect(g.config.source).toBe('program');
    expect(g.config.milestones.map((m) => m.label)).toEqual(['Ads', 'Website', 'Funnels', '1 lakh', '1 crore']);
  });

  it('adding W5 makes the new week appear in the graph', () => {
    const before = build({ totalDays: 28 });
    const after = build({ totalDays: 28, config: config([...FOUR_WEEKS, week('w5', 'W5', 29, 35, 4)]) });
    expect(before.weeks.map((w) => w.label)).toEqual(['W1', 'W2', 'W3', 'W4']);
    expect(after.weeks.map((w) => w.label)).toEqual(['W1', 'W2', 'W3', 'W4', 'W5']);
    expect(after.weeks[4].progressLevel).toBeNull(); // not started yet
  });

  it('renaming a week or milestone keeps the activity and its approved progress (links are ids)', () => {
    const tasks = [task('t1', 3, { graphMilestoneId: 'm-web' })];
    const submissions = [{ taskId: 't1', dayNumber: 3, status: 'approved' }];
    const renamedWeeks = [week('w1', 'Kick-off', 1, 7, 0), ...FOUR_WEEKS.slice(1)];
    const renamedMs = DEFAULT_MS.map((m) => (m.id === 'm-web' ? { ...m, label: 'Online Store' } : m));
    const g = build({ tasks, submissions, config: config(renamedWeeks, renamedMs) });
    expect(g.weeks[0].label).toBe('Kick-off');
    expect(g.weeks[0].activities[0]).toMatchObject({ taskId: 't1', completed: true });
    expect(g.weeks[0].progressLevel).toBe(3); // 1 of 1 done → share 3; milestone link to "Online Store" (level 2) also counted
    expect(g.config.milestones[1].label).toBe('Online Store');
  });

  it('a milestone link lifts its week to that milestone', () => {
    const tasks = [task('a', 1), task('b', 2), task('c', 3), task('d', 4, { graphMilestoneId: 'm-fun' })];
    const g = build({ tasks, submissions: [{ taskId: 'd', dayNumber: 4, status: 'approved' }] });
    expect(g.weeks[0].progressLevel).toBe(3); // 1 of 4 = 0.75, Funnels link → 3
  });

  it('disabling a week hides it and its activities without deleting any progress', () => {
    const tasks = [task('t1', 3), task('t2', 10)];
    const submissions = [{ taskId: 't1', dayNumber: 3, status: 'approved' }];
    const disabled = [week('w1', 'W1', 1, 7, 0, false), ...FOUR_WEEKS.slice(1)];
    const g = build({ tasks, submissions, config: config(disabled) });
    expect(g.weeks.map((w) => w.label)).toEqual(['W2', 'W3', 'W4']);
    expect(g.weeks.flatMap((w) => w.activities.map((a) => a.taskId))).toEqual(['t2']);
    // Re-enabling brings the approved activity straight back
    const back = build({ tasks, submissions });
    expect(back.weeks[0].activities[0]).toMatchObject({ taskId: 't1', completed: true });
  });

  it('an explicit week link wins over the day number; a link to a disabled week hides the activity', () => {
    const g = build({ tasks: [task('t1', 3, { graphWeekId: 'w3' })] });
    expect(g.weeks[2].activities.map((a) => a.taskId)).toEqual(['t1']);
    const hidden = build({ tasks: [task('t1', 3, { graphWeekId: 'w3' })], config: config([...FOUR_WEEKS.slice(0, 2), week('w3', 'W3', 15, 21, 2, false), FOUR_WEEKS[3]]) });
    expect(hidden.weeks.flatMap((w) => w.activities)).toHaveLength(0);
  });

  it('a disabled milestone leaves the axis and stops lifting points', () => {
    const tasks = [task('a', 1), task('b', 2), task('c', 3, { graphMilestoneId: 'm-fun' })];
    const submissions = [{ taskId: 'c', dayNumber: 3, status: 'approved' }];
    const ms = DEFAULT_MS.map((m) => (m.id === 'm-fun' ? { ...m, isActive: false } : m));
    const g = build({ tasks, submissions, config: config(FOUR_WEEKS, ms) });
    expect(g.config.milestones.map((m) => m.label)).toEqual(['Ads', 'Website', '1 lakh', '1 crore']);
    expect(g.weeks[0].progressLevel).toBeCloseTo(0.67, 2); // 1 of 3 × cap 2, no Funnels lift
  });

  it('task completion never reaches a revenue milestone; an admin record does', () => {
    const tasks = [task('a', 1)];
    const submissions = [{ taskId: 'a', dayNumber: 1, status: 'approved' }];
    expect(build({ tasks, submissions }).weeks[0].progressLevel).toBe(3); // capped at Funnels
    const g = build({ tasks, submissions, records: [{ milestoneId: 'm-1l', weekId: 'w2' }] });
    expect(g.weeks[1].progressLevel).toBe(4); // "1 lakh" recorded in W2
    expect(g.weeks[0].progressLevel).toBe(3);
  });

  it('a renamed revenue milestone (₹5 Lakhs) keeps its recorded achievement', () => {
    const ms = DEFAULT_MS.map((m) => (m.id === 'm-1l' ? { ...m, label: '₹5 Lakhs' } : m));
    const g = build({ config: config(FOUR_WEEKS, ms), records: [{ milestoneId: 'm-1l', weekId: 'w1' }] });
    expect(g.config.milestones[3].label).toBe('₹5 Lakhs');
    expect(g.weeks[0].progressLevel).toBe(4);
  });

  it('records for disabled/unknown milestones or weeks, or future weeks, are not plotted', () => {
    const ms = DEFAULT_MS.map((m) => (m.id === 'm-1c' ? { ...m, isActive: false } : m));
    const g = build({ config: config(FOUR_WEEKS, ms), currentDay: 10, records: [
      { milestoneId: 'm-1c', weekId: 'w1' }, { milestoneId: 'nope', weekId: 'w1' }, { milestoneId: 'm-1l', weekId: 'w4' },
    ] });
    expect(g.weeks[0].progressLevel).toBe(0);
    expect(g.weeks[3].progressLevel).toBeNull();
  });

  it('shows exactly the configured weeks: none is generated past the configured range', () => {
    // Program length (35 days) runs past the configured W1–W4 (days 1–28).
    const g = build({ tasks: [task('in-range', 20), task('late', 31)], totalDays: 35 });
    expect(g.weeks.map((w) => w.label)).toEqual(['W1', 'W2', 'W3', 'W4']);
    expect(g.weeks.every((w) => w.weekId !== null)).toBe(true);
    // An activity on a day no configured week covers is not shown until a week is added for it.
    expect(g.weeks.flatMap((w) => w.activities.map((a) => a.taskId))).toEqual(['in-range']);
  });

  it('another member\'s assigned activity never appears, whatever the configuration', () => {
    const g = build({ tasks: [task('mine', 2, { memberId: ME }), task('theirs', 2, { memberId: OTHER, graphMilestoneId: 'm-fun' })],
      submissions: [{ taskId: 'theirs', dayNumber: 2, status: 'approved' }] });
    expect(g.weeks.flatMap((w) => w.activities.map((a) => a.taskId))).toEqual(['mine']);
    expect(g.weeks[0].progressLevel).toBe(0);
  });

  it('without a configuration the graph is exactly the original one', () => {
    const args = { memberId: ME, tasks: [task('a', 1, { isMilestone: true, milestoneLabel: 'Ads' }), task('b', 9)],
      submissions: [{ taskId: 'a', dayNumber: 1, status: 'approved' }], dayProgress: [], totalDays: 14, currentDay: 9 };
    const legacy = buildWeeklyGraph(args);
    const defaults = buildWeeklyGraph({ ...args, config: resolveGraphConfig({ weeks: [], milestones: [] }) });
    expect(defaults).toEqual(legacy);
    expect(legacy.weeks.map((w) => [w.label, w.weekId, w.progressLevel])).toEqual([['W1', null, 3], ['W2', null, 0]]);
    expect(legacy.config.source).toBe('default');
  });
});

describe('deploy safety (schema guard)', () => {
  it('the new tables, indexes and task columns are startup-owned, so a deploy never drops them', async () => {
    const { readFileSync } = await import('node:fs');
    const { extractStartupManagedObjects, guardSchemaDiff } = await import('./schemaGuardLogic.js');
    const managed = extractStartupManagedObjects(readFileSync(new URL('../plugins/prisma.ts', import.meta.url), 'utf8'));
    for (const t of ['graph_weeks', 'graph_milestones', 'member_graph_milestone_records']) expect(managed.tables.has(t)).toBe(true);
    expect(managed.columns.get('tasks')?.has('graph_week_id')).toBe(true);
    expect(managed.columns.get('tasks')?.has('graph_milestone_id')).toBe(true);
    // What `prisma migrate diff` would propose (these objects are not in schema.prisma):
    const diff = [
      'DROP TABLE "graph_weeks";',
      'DROP TABLE "member_graph_milestone_records";',
      'ALTER TABLE "tasks" DROP CONSTRAINT "tasks_graph_week_id_fkey";',
      'ALTER TABLE "tasks" DROP COLUMN "graph_week_id";',
      'DROP INDEX "idx_graph_weeks_program";',
    ].join('\n');
    const result = guardSchemaDiff(diff, managed);
    expect(result.blocked).toEqual([]);
    expect(result.apply.join('\n')).not.toMatch(/DROP/);
    expect(result.skipped.length).toBeGreaterThanOrEqual(5);
  });
});

// Regression: the member graph's progression line is drawn through each started
// week's progressLevel (user-web weeklyGraphProgression.ts), so these levels must
// follow the member's real activity statuses in an admin-configured program.
describe('weekly progress for the progression line (admin-configured program)', () => {
  const config = resolveGraphConfig({ weeks: FOUR_WEEKS, milestones: DEFAULT_MS });
  // Admin-configured activities: two per week, the first of W1 linked to Ads and of W2 to Funnels.
  const tasks = [
    task('a1', 2, { graphMilestoneId: 'm-ads' }), task('b1', 3),
    task('a2', 9, { graphMilestoneId: 'm-fun' }), task('b2', 10),
    task('a3', 16, { graphMilestoneId: 'm-web' }), task('b3', 17),
    task('a4', 23), task('b4', 24),
  ];
  const build = (over: { submissions?: any[]; dayProgress?: any[]; currentDay?: number } = {}) =>
    buildWeeklyGraph({
      memberId: ME, tasks, totalDays: 28, currentDay: over.currentDay ?? 25, config,
      submissions: over.submissions ?? [], dayProgress: over.dayProgress ?? [],
    });
  const approved = (taskId: string, dayNumber: number) => ({ taskId, dayNumber, status: 'approved' });
  const statusOf = (g: ReturnType<typeof build>, id: string) => g.weeks.flatMap((w) => w.activities).find((a) => a.taskId === id)!.status;
  const levels = (g: ReturnType<typeof build>) => g.weeks.map((w) => w.progressLevel);

  const pattern = {
    submissions: [
      approved('a1', 2),                       // W1: Ads milestone approved, b1 incomplete
      approved('a2', 9), approved('b2', 10),   // W2: everything approved, incl. the Funnels milestone
      { taskId: 'a3', dayNumber: 16, status: 'pending' }, // W3: draft proof only
      approved('a4', 23),                      // W4 (current): half approved
    ],
    dayProgress: [
      { dayNumber: 17, status: 'pending_approval', completedTaskIds: ['b3'] }, // W3: submitted, awaiting approval
    ],
  };

  it('completed, incomplete, pending approval and missed activities keep their own statuses', () => {
    const g = build(pattern);
    expect(statusOf(g, 'a1')).toBe('completed');
    expect(statusOf(g, 'b1')).toBe('not_started'); // missed: day passed, nothing recorded
    expect(statusOf(g, 'a3')).toBe('in_progress'); // draft saved, not submitted
    expect(statusOf(g, 'b3')).toBe('submitted');   // awaiting approval
    expect(statusOf(g, 'b4')).toBe('not_started');
  });

  it('weekly levels go up with approved work and down when a week is not approved', () => {
    const g = build(pattern);
    expect(levels(g)).toEqual([1.5, 3, 0, 1.5]);
    // W1 → W2 rises, W2 → W3 falls to the baseline (pending/awaiting never count), W3 → W4 rises again.
    const [w1, w2, w3, w4] = levels(g) as number[];
    expect(w2).toBeGreaterThan(w1);
    expect(w3).toBeLessThan(w2);
    expect(w4).toBeGreaterThan(w3);
  });

  it('an activity approved later lifts its own week, not the week it was approved in', () => {
    const later = build({
      ...pattern,
      submissions: [...pattern.submissions.filter((s) => s.taskId !== 'a3'), approved('a3', 16)],
    });
    expect(statusOf(later, 'a3')).toBe('completed');
    expect(later.weeks[2].progressLevel).toBe(2); // W3 now reaches its Website link
    expect(later.weeks[3].progressLevel).toBe(1.5); // W4 unchanged
    // An approved day accepts the ticked, awaiting task too.
    const dayApproved = build({ ...pattern, dayProgress: [{ dayNumber: 17, status: 'approved', completedTaskIds: ['b3'] }] });
    expect(statusOf(dayApproved, 'b3')).toBe('completed');
    expect(dayApproved.weeks[2].progressLevel).toBe(1.5);
  });

  it('a rejected submission pulls its week back down; future weeks get no point', () => {
    const g = build({ ...pattern, submissions: [...pattern.submissions.filter((s) => s.taskId !== 'a2'), { taskId: 'a2', dayNumber: 9, status: 'rejected' }], currentDay: 12 });
    expect(statusOf(g, 'a2')).toBe('needs_revision');
    expect(g.weeks[1].progressLevel).toBe(1.5); // only b2 approved, no Funnels lift
    expect(g.weeks[2].progressLevel).toBeNull();
    expect(g.weeks[3].progressLevel).toBeNull();
  });

  it("another member's assignment never affects this member's line", () => {
    const g = buildWeeklyGraph({
      memberId: ME, tasks: [...tasks, task('x1', 3, { memberId: OTHER })], totalDays: 28, currentDay: 25, config,
      submissions: pattern.submissions, dayProgress: pattern.dayProgress,
    });
    expect(g.weeks[0].activities.map((a) => a.taskId)).not.toContain('x1');
    expect(levels(g)).toEqual([1.5, 3, 0, 1.5]);
  });
});
