import { describe, expect, it } from 'vitest';

import {
  buildWeeklyGraph,
  deriveActivityStatus,
  isTaskVisibleToMember,
  MAX_TASK_PROGRESS_LEVEL,
  milestoneLevelForLabel,
  weekProgressLevel,
  type GraphTaskInput,
} from './weeklyGraphLogic.js';

const ME = 'member-me';
const OTHER = 'member-other';

const task = (id: string, dayNumber: number, extra: Partial<GraphTaskInput> = {}): GraphTaskInput => ({
  id, title: `Task ${id}`, dayNumber, sortOrder: 0, isRequired: true, memberId: null, ...extra,
});

describe('deriveActivityStatus', () => {
  const base = { taskId: 't1', dayNumber: 3, currentDay: 5 };

  it('is completed only when the submission is approved', () => {
    expect(deriveActivityStatus({ ...base, submission: { taskId: 't1', dayNumber: 3, status: 'approved' } })).toBe('completed');
  });

  it('never reports a submitted-but-unreviewed task as completed', () => {
    expect(deriveActivityStatus({
      ...base,
      submission: { taskId: 't1', dayNumber: 3, status: 'pending' },
      dayProgress: { dayNumber: 3, status: 'pending_approval', completedTaskIds: [] },
    })).toBe('submitted');
  });

  it('a ticked task in an in-progress day is in progress, not completed', () => {
    expect(deriveActivityStatus({
      ...base, dayProgress: { dayNumber: 3, status: 'in_progress', completedTaskIds: ['t1'] },
    })).toBe('in_progress');
  });

  it('rejected submissions and rejected days need revision', () => {
    expect(deriveActivityStatus({ ...base, submission: { taskId: 't1', dayNumber: 3, status: 'rejected' } })).toBe('needs_revision');
    expect(deriveActivityStatus({ ...base, submission: { taskId: 't1', dayNumber: 3, status: 'resubmission_required' } })).toBe('needs_revision');
    expect(deriveActivityStatus({
      ...base,
      submission: { taskId: 't1', dayNumber: 3, status: 'pending' },
      dayProgress: { dayNumber: 3, status: 'rejected', completedTaskIds: [] },
    })).toBe('needs_revision');
  });

  it('an approved day completes touched tasks but not untouched ones', () => {
    const day = { dayNumber: 3, status: 'approved', completedTaskIds: ['t1'] };
    expect(deriveActivityStatus({ ...base, dayProgress: day })).toBe('completed');
    expect(deriveActivityStatus({ ...base, taskId: 't2', dayProgress: day })).toBe('not_started');
  });

  it('distinguishes days that have not opened from days left untouched', () => {
    expect(deriveActivityStatus({ ...base, dayNumber: 9 })).toBe('upcoming');
    expect(deriveActivityStatus({ ...base, dayNumber: 2 })).toBe('not_started');
  });
});

describe('isTaskVisibleToMember', () => {
  it('shows global tasks and own assignments, hides other members\' assignments', () => {
    expect(isTaskVisibleToMember({ memberId: null }, ME)).toBe(true);
    expect(isTaskVisibleToMember({ memberId: ME }, ME)).toBe(true);
    expect(isTaskVisibleToMember({ memberId: OTHER }, ME)).toBe(false);
  });
});

describe('buildWeeklyGraph', () => {
  it('represents every activity of a week with its own status (multiple activities per week)', () => {
    const graph = buildWeeklyGraph({
      memberId: ME,
      tasks: [task('a', 1), task('b', 2), task('c', 3, { isRequired: false }), task('d', 4)],
      submissions: [
        { taskId: 'a', dayNumber: 1, status: 'approved' },
        { taskId: 'b', dayNumber: 2, status: 'pending' },
        { taskId: 'c', dayNumber: 3, status: 'rejected' },
      ],
      dayProgress: [{ dayNumber: 2, status: 'pending_approval', completedTaskIds: [] }],
      totalDays: 14,
      currentDay: 4,
    });

    const week1 = graph.weeks[0];
    expect(week1.activities.map((a) => [a.taskId, a.status])).toEqual([
      ['a', 'completed'], ['b', 'submitted'], ['c', 'needs_revision'], ['d', 'not_started'],
    ]);
    expect(week1.total).toBe(4);
    expect(week1.completed).toBe(1);
    expect(week1.completionPercent).toBe(25);
    expect(week1.requiredTotal).toBe(3);
    expect(week1.requiredCompleted).toBe(1);
  });

  it('plots no point (null) for weeks without activities instead of 0%', () => {
    const graph = buildWeeklyGraph({
      memberId: ME, tasks: [task('a', 1)], submissions: [], dayProgress: [], totalDays: 14, currentDay: 1,
    });
    expect(graph.weeks).toHaveLength(2);
    expect(graph.weeks[1].total).toBe(0);
    expect(graph.weeks[1].completionPercent).toBeNull();
  });

  it('returns an empty graph (no fabricated data) when nothing is assigned', () => {
    const graph = buildWeeklyGraph({ memberId: ME, tasks: [], submissions: [], dayProgress: [], totalDays: 21, currentDay: 3 });
    expect(graph.hasActivities).toBe(false);
    expect(graph.summary).toEqual({ total: 0, completed: 0, completionPercent: null });
    expect(graph.weeks.every((w) => w.activities.length === 0 && w.completionPercent === null)).toBe(true);
  });

  it('never includes another member\'s assigned activities', () => {
    const graph = buildWeeklyGraph({
      memberId: ME,
      tasks: [task('mine', 1, { memberId: ME }), task('theirs', 1, { memberId: OTHER }), task('global', 2)],
      submissions: [], dayProgress: [], totalDays: 7, currentDay: 1,
    });
    const ids = graph.weeks.flatMap((w) => w.activities.map((a) => a.taskId));
    expect(ids).toEqual(['mine', 'global']);
  });

  it('moves an activity to its new week when its day assignment changes', () => {
    const before = buildWeeklyGraph({ memberId: ME, tasks: [task('a', 3)], submissions: [], dayProgress: [], totalDays: 21, currentDay: 1 });
    const after = buildWeeklyGraph({ memberId: ME, tasks: [task('a', 17)], submissions: [], dayProgress: [], totalDays: 21, currentDay: 1 });
    expect(before.weeks[0].activities.map((a) => a.taskId)).toEqual(['a']);
    expect(after.weeks[0].activities).toHaveLength(0);
    expect(after.weeks[2].activities.map((a) => a.taskId)).toEqual(['a']);
  });

  it('keeps an approved submission when the task was later moved to another day', () => {
    const graph = buildWeeklyGraph({
      memberId: ME,
      tasks: [task('a', 10)],
      submissions: [{ taskId: 'a', dayNumber: 3, status: 'approved' }],
      dayProgress: [], totalDays: 14, currentDay: 12,
    });
    expect(graph.weeks[1].activities[0].status).toBe('completed');
  });

  it('extends the weeks to cover activities scheduled past totalDays', () => {
    const graph = buildWeeklyGraph({ memberId: ME, tasks: [task('late', 16)], submissions: [], dayProgress: [], totalDays: 14, currentDay: 1 });
    expect(graph.weeks).toHaveLength(3);
    expect(graph.weeks[2].activities.map((a) => a.taskId)).toEqual(['late']);
  });

  it('orders activities by day then sortOrder and flags the current week', () => {
    const graph = buildWeeklyGraph({
      memberId: ME,
      tasks: [task('y', 9, { sortOrder: 1 }), task('x', 9, { sortOrder: 0 }), task('w', 8)],
      submissions: [], dayProgress: [], totalDays: 14, currentDay: 9,
    });
    expect(graph.currentWeek).toBe(2);
    expect(graph.weeks[1].isCurrent).toBe(true);
    expect(graph.weeks[1].activities.map((a) => a.taskId)).toEqual(['w', 'x', 'y']);
  });
});

describe('milestone axis progress', () => {
  it('maps admin milestone labels to axis levels (exact, case-insensitive); others are 0', () => {
    expect(milestoneLevelForLabel('Ads')).toBe(1);
    expect(milestoneLevelForLabel(' website ')).toBe(2);
    expect(milestoneLevelForLabel('FUNNELS')).toBe(3);
    expect(milestoneLevelForLabel('1 lakh')).toBe(0);
    expect(milestoneLevelForLabel('1 crore')).toBe(0);
    expect(milestoneLevelForLabel('Launch ads campaign')).toBe(0);
    expect(milestoneLevelForLabel(null)).toBe(0);
  });

  it('keeps a week with nothing completed (or nothing assigned) at the baseline', () => {
    expect(weekProgressLevel({ total: 4, completed: 0, completedMilestoneLevel: 0 })).toBe(0);
    expect(weekProgressLevel({ total: 0, completed: 0, completedMilestoneLevel: 0 })).toBe(0);
  });

  it('scales the share of completed tasks onto Ads..Funnels and never past Funnels', () => {
    expect(weekProgressLevel({ total: 4, completed: 1, completedMilestoneLevel: 0 })).toBe(0.75);
    expect(weekProgressLevel({ total: 3, completed: 2, completedMilestoneLevel: 0 })).toBe(2);
    expect(weekProgressLevel({ total: 4, completed: 4, completedMilestoneLevel: 0 })).toBe(MAX_TASK_PROGRESS_LEVEL);
  });

  it('a completed milestone task lifts the week to at least its milestone level', () => {
    expect(weekProgressLevel({ total: 10, completed: 1, completedMilestoneLevel: 2 })).toBe(2);
    expect(weekProgressLevel({ total: 2, completed: 2, completedMilestoneLevel: 1 })).toBe(3);
  });

  it('derives each week from approved work only; incomplete milestones do not count', () => {
    const graph = buildWeeklyGraph({
      memberId: ME,
      tasks: [
        task('ads', 1, { isMilestone: true, milestoneLabel: 'Ads' }),
        task('w1b', 2),
        task('site', 8, { isMilestone: true, milestoneLabel: 'Website' }),
        task('w2b', 9),
        task('w3', 15),
      ],
      submissions: [
        { taskId: 'ads', dayNumber: 1, status: 'approved' },
        { taskId: 'site', dayNumber: 8, status: 'pending' }, // awaiting review — not completed
      ],
      dayProgress: [{ dayNumber: 9, status: 'in_progress', completedTaskIds: ['w2b'] }], // ticked only
      totalDays: 21,
      currentDay: 16,
    });
    // W1: 1 of 2 done → share 1.5, Ads milestone (1) is lower → 1.5
    expect(graph.weeks[0].progressLevel).toBe(1.5);
    // W2: nothing approved → baseline, even though work is submitted/ticked
    expect(graph.weeks[1].progressLevel).toBe(0);
    // W3 (current): nothing completed → baseline, not carried up from W1
    expect(graph.weeks[2].progressLevel).toBe(0);
  });

  it('plots no point for weeks that have not started', () => {
    const graph = buildWeeklyGraph({
      memberId: ME,
      tasks: [task('a', 1), task('b', 20)],
      submissions: [{ taskId: 'a', dayNumber: 1, status: 'approved' }],
      dayProgress: [], totalDays: 28, currentDay: 3,
    });
    expect(graph.weeks.map((w) => w.progressLevel)).toEqual([3, null, null, null]);
  });

  it('follows the configured program length (number of weeks)', () => {
    const short = buildWeeklyGraph({ memberId: ME, tasks: [], submissions: [], dayProgress: [], totalDays: 14, currentDay: 20 });
    const long = buildWeeklyGraph({ memberId: ME, tasks: [], submissions: [], dayProgress: [], totalDays: 90, currentDay: 20 });
    expect(short.weeks).toHaveLength(2);
    expect(long.weeks).toHaveLength(13);
    expect(long.weeks.slice(0, 3).map((w) => w.progressLevel)).toEqual([0, 0, 0]);
    expect(long.weeks[3].progressLevel).toBeNull();
  });

  it('ignores another member\'s completed milestone task', () => {
    const graph = buildWeeklyGraph({
      memberId: ME,
      tasks: [task('mine', 1), task('theirs', 1, { memberId: OTHER, isMilestone: true, milestoneLabel: 'Funnels' })],
      submissions: [{ taskId: 'theirs', dayNumber: 1, status: 'approved' }],
      dayProgress: [], totalDays: 7, currentDay: 2,
    });
    expect(graph.weeks[0].progressLevel).toBe(0);
  });
});

describe('buildWeeklyGraph — per-milestone reached/dayNumber (Learning Roadmap)', () => {
  const approved = (taskId: string, dayNumber: number) => ({ taskId, dayNumber, status: 'approved' });
  const graph = (over: Partial<Parameters<typeof buildWeeklyGraph>[0]> = {}) =>
    buildWeeklyGraph({ memberId: ME, tasks: [], submissions: [], dayProgress: [], totalDays: 28, currentDay: 20, ...over });
  const saved = {
    source: 'program' as const, weeks: null, coveredUntilDay: 0,
    milestones: [
      { id: 'm-ads', label: 'Ads', kind: 'activity' as const },
      { id: 'm-web', label: 'Website', kind: 'activity' as const },
      { id: 'm-fun', label: 'Funnels', kind: 'activity' as const },
      { id: 'm-1l', label: '1 lakh', kind: 'revenue' as const },
      { id: 'm-1c', label: '1 crore', kind: 'revenue' as const },
    ],
  };
  const status = (g: ReturnType<typeof graph>) => g.config.milestones.map((m) => [m.label, m.reached, m.dayNumber]);

  it('keeps every existing milestone field and adds reached=false / dayNumber=null when nothing is linked', () => {
    const g = graph();
    expect(g.config.milestones.map((m) => ({ id: m.id, label: m.label, kind: m.kind }))).toEqual([
      { id: null, label: 'Ads', kind: 'activity' }, { id: null, label: 'Website', kind: 'activity' },
      { id: null, label: 'Funnels', kind: 'activity' }, { id: null, label: '1 lakh', kind: 'revenue' },
      { id: null, label: '5 Lakhs', kind: 'revenue' },
      { id: null, label: '1 crore', kind: 'revenue' },
    ]);
    expect(g.config.milestones.every((m) => m.reached === false && m.dayNumber === null)).toBe(true);
  });

  it('is reached only through an approved linked task — never from task share or the plotted height', () => {
    // Every task of week 1 approved → week plots at Funnels, but no task is a milestone.
    const g = graph({ tasks: [task('a', 1), task('b', 2)], submissions: [approved('a', 1), approved('b', 2)] });
    expect(g.weeks[0].progressLevel).toBe(MAX_TASK_PROGRESS_LEVEL);
    expect(g.config.milestones.some((m) => m.reached)).toBe(false);
  });

  it('a linked but unapproved task gives the day, not reached; approval reaches it', () => {
    const tasks = [task('ads', 3, { graphMilestoneId: 'm-ads' }), task('web', 9, { graphMilestoneId: 'm-web' })];
    expect(status(graph({ config: saved, tasks, submissions: [{ taskId: 'ads', dayNumber: 3, status: 'pending' }] })).slice(0, 2))
      .toEqual([['Ads', false, 3], ['Website', false, 9]]);
    expect(status(graph({ config: saved, tasks, submissions: [approved('ads', 3)] })).slice(0, 2))
      .toEqual([['Ads', true, 3], ['Website', false, 9]]);
  });

  it('uses the earliest approved linked task day when reached, else the earliest linked day', () => {
    const tasks = [task('w1', 4, { graphMilestoneId: 'm-web' }), task('w2', 11, { graphMilestoneId: 'm-web' })];
    expect(status(graph({ config: saved, tasks }))[1]).toEqual(['Website', false, 4]);
    expect(status(graph({ config: saved, tasks, submissions: [approved('w2', 11)] }))[1]).toEqual(['Website', true, 11]);
  });

  it('legacy is_milestone + milestone_label links work on unsaved (default) settings', () => {
    const g = graph({ tasks: [task('f', 5, { isMilestone: true, milestoneLabel: 'funnel' })], submissions: [approved('f', 5)] });
    expect(status(g)[2]).toEqual(['Funnels', true, 5]);
  });

  it("ignores other members' tasks", () => {
    const g = graph({ config: saved, tasks: [task('x', 2, { memberId: OTHER, graphMilestoneId: 'm-ads' })], submissions: [approved('x', 2)] });
    expect(status(g)[0]).toEqual(['Ads', false, null]);
  });

  it('revenue milestones: never from tasks, only from a recorded achievement, and never have a day', () => {
    const tasks = [task('rev', 6, { graphMilestoneId: 'm-1l' }), task('rev2', 7, { isMilestone: true, milestoneLabel: '1 lakh' })];
    expect(status(graph({ config: saved, tasks, submissions: [approved('rev', 6), approved('rev2', 7)] })).slice(3))
      .toEqual([['1 lakh', false, null], ['1 crore', false, null]]);
    const recorded = graph({ config: saved, records: [{ milestoneId: 'm-1l', weekId: null }] });
    expect(status(recorded).slice(3)).toEqual([['1 lakh', true, null], ['1 crore', false, null]]);
  });

  it('a recorded achievement reaches an activity milestone too, whatever its week', () => {
    expect(status(graph({ config: saved, records: [{ milestoneId: 'm-web', weekId: 'gone' }] }))[1]).toEqual(['Website', true, null]);
  });

  it('default (unsaved) revenue milestones can never be reached — records need a saved milestone id', () => {
    const g = graph({ records: [{ milestoneId: 'anything', weekId: null }] });
    expect(g.config.milestones.slice(3).map((m) => [m.id, m.reached])).toEqual([[null, false], [null, false], [null, false]]);
  });
});
