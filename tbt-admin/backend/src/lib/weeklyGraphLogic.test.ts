import { describe, expect, it } from 'vitest';

import {
  buildWeeklyGraph,
  deriveActivityStatus,
  isTaskVisibleToMember,
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
