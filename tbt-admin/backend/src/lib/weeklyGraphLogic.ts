// Pure logic for the member's Weekly Activity Graph on the batch program
// (WEEKLY_CHECKLIST_SPECKIT.md layer). No DB, no Fastify, no clock: every
// input — tasks, the member's own submissions and day progress, and the
// batch-relative current day — is passed in, so the graph can only ever be
// drawn from real task statuses, never from placeholder data.
//
// Week number is derived (getWeekNumber = ceil(dayNumber/7)), never stored,
// so moving a task to another day moves it to the right week on next read.

import { getWeekNumber } from './weekChecklistLogic.js';
import {
  defaultWeeks,
  milestoneIndexForLabel,
  resolveGraphConfig,
  taskProgressCap,
  type GraphConfig,
  type MilestoneKind,
} from './weeklyGraphConfig.js';
import type { RevenueEntry } from './weeklyGraphRevenue.js';

export type ActivityStatus =
  | 'completed'       // approved submission, or ticked on a day the admin approved
  | 'submitted'       // in a day the member submitted; awaiting admin review
  | 'needs_revision'  // submission or day rejected by the admin
  | 'in_progress'     // draft proof saved or ticked, not yet submitted
  | 'not_started'     // day is open (or past) and nothing recorded for this task
  | 'upcoming';       // day has not opened yet

export interface GraphTaskInput {
  id: string;
  title: string;
  dayNumber: number;
  sortOrder: number;
  isRequired: boolean;
  /** tasks.member_id — set for a member-specific assignment, null for everyone */
  memberId: string | null;
  /** tasks.is_milestone / tasks.milestone_label — admin-set on the task form */
  isMilestone?: boolean;
  milestoneLabel?: string | null;
  /** tasks.graph_week_id — explicit week (admin graph config); null -> week from dayNumber */
  graphWeekId?: string | null;
  /** tasks.graph_milestone_id — explicit milestone link; null -> matched by milestoneLabel */
  graphMilestoneId?: string | null;
}

/** An admin-recorded member milestone achievement (member_graph_milestone_records). */
export interface GraphRecordInput {
  milestoneId: string;
  weekId: string | null;
}

export interface GraphSubmissionInput {
  taskId: string;
  dayNumber: number | null;
  status: string; // SubmissionStatus: pending | approved | rejected | resubmission_required
}

export interface GraphDayProgressInput {
  dayNumber: number;
  status: string; // not_started | in_progress | pending_approval | approved | rejected
  completedTaskIds: string[];
}

export interface GraphActivity {
  taskId: string;
  title: string;
  dayNumber: number;
  isRequired: boolean;
  status: ActivityStatus;
  completed: boolean;
  /** The configured milestone this activity is linked to (tasks.graph_milestone_id or the legacy label), else null. */
  milestoneId: string | null;
  milestoneLabel: string | null;
  /** Axis row of that milestone (1 = first milestone); 0 = not linked (drawn on the baseline). Position only, never achievement. */
  level: number;
}

export interface GraphWeek {
  weekNumber: number;
  startDay: number;
  endDay: number;
  isCurrent: boolean;
  activities: GraphActivity[];
  total: number;
  completed: number;
  requiredTotal: number;
  requiredCompleted: number;
  /** completed / total as a whole %, or null when the week has no activities (no point is plotted) */
  completionPercent: number | null;
  /**
   * Height of this week's point on the milestone axis (see weekProgressLevel):
   * 0 = baseline, 1 = Ads, 2 = Website, 3 = Funnels. null for weeks that have
   * not started yet — nothing is plotted for the future.
   */
  progressLevel: number | null;
  /** graph_weeks.id, or null for a built-in default week */
  weekId: string | null;
  /** Display label, e.g. "W1" or an admin-configured name */
  label: string;
  /** Member-reported revenue counted in this week's days; null when nothing was reported for them. */
  revenue: number | null;
  /** Running total of reported revenue up to this week's end; null for future weeks or when nothing was ever reported. */
  cumulativeRevenue: number | null;
}

export interface WeeklyGraph {
  totalDays: number;
  currentDay: number;
  currentWeek: number;
  hasActivities: boolean;
  weeks: GraphWeek[];
  summary: { total: number; completed: number; completionPercent: number | null };
  /** The Y axis, bottom to top (progressLevel n = milestones[n - 1]); source tells defaults from admin config. */
  config: { source: 'program' | 'default'; milestones: GraphMilestoneStatus[] };
  /**
   * The revenue the revenue milestones are measured against: the same
   * revenue_generated figure "Your Revenue Stats" shows, entered by the member
   * per ISO week. totalToDate is null when nothing was ever reported.
   */
  revenue: { source: 'self_reported'; totalToDate: number | null };
}

/**
 * One configured milestone with this member's explicit evidence for it.
 * `reached` is never derived from a week's plotted height (progressLevel) or
 * task share — only from:
 *   • an admin-approved task linked to this activity milestone
 *     (tasks.graph_milestone_id, or the legacy is_milestone + milestone_label),
 *     within the same task cap the graph uses (tasks never prove revenue); or
 *   • the member's reported revenue: a revenue milestone with an admin-set
 *     threshold is reached once the running total of reported revenue is at
 *     or above it (never from tasks, never from a threshold alone); or
 *   • an admin/mentor-recorded achievement (member_graph_milestone_records).
 * A built-in default milestone (id null — program settings never saved) has no
 * threshold and can have no recorded achievement, so it is never reached.
 */
export interface GraphMilestoneStatus {
  id: string | null;
  label: string;
  kind: MilestoneKind;
  reached: boolean;
  /** Revenue milestones: the admin-set cumulative revenue threshold (₹); null = none set. Always null for activity milestones. */
  threshold: number | null;
  /** What reached it: an approved linked task, reported revenue, or an admin/mentor record. null when not reached. */
  reachedBy: 'activity' | 'revenue' | 'record' | null;
  /** weekNumber (1-based position on the X axis) where it was reached; null when not reached or reached outside the shown weeks. */
  reachedWeek: number | null;
  /**
   * Batch-program day of the linked task: the earliest approved one when
   * reached through a task, else the earliest linked one. null when no task is
   * linked, and always null for revenue milestones (no task proves revenue).
   */
  dayNumber: number | null;
}

/**
 * A member-specific task (tasks.member_id set) belongs to that member only.
 * Every other member must never see it — not its title, not its status.
 */
export function isTaskVisibleToMember(task: { memberId: string | null }, memberId: string): boolean {
  return task.memberId === null || task.memberId === memberId;
}

function percent(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 100) : null;
}

// ── Milestone axis ───────────────────────────────────────────────────────────
// The member graph's Y axis is Ads → Website → Funnels → 1 lakh → 1 crore.
// Only the first three are activity milestones that task completion can
// evidence. Revenue milestones are never reached from tasks (approved tasks do
// not prove revenue): only from the member's own reported revenue
// (member_revenue_reports — self-reported, the "Your Revenue Stats" figure)
// against the admin's threshold, or from an admin/mentor record.

/** Highest axis level task progress can reach (Funnels). */
export const MAX_TASK_PROGRESS_LEVEL = 3;

const MILESTONE_LABEL_LEVELS: Record<string, number> = {
  ad: 1, ads: 1,
  website: 2,
  funnel: 3, funnels: 3,
};

/** Axis level a milestone task's label stands for (exact, case-insensitive), 0 for any other label. */
export function milestoneLevelForLabel(label: string | null | undefined): number {
  return MILESTONE_LABEL_LEVELS[(label ?? '').trim().toLowerCase()] ?? 0;
}

/**
 * A week's point on the milestone axis, from approved work only:
 *  - nothing completed (or nothing assigned) → 0, the baseline;
 *  - otherwise the share of that week's tasks completed, scaled onto
 *    0–MAX_TASK_PROGRESS_LEVEL (all done = Funnels);
 *  - raised to a milestone's level when a task the admin marked as the
 *    Ads / Website / Funnels milestone was completed that week.
 * Each week stands alone, so a new week starting never lifts the line.
 */
export function weekProgressLevel(
  week: { total: number; completed: number; completedMilestoneLevel: number },
  cap: number = MAX_TASK_PROGRESS_LEVEL,
): number {
  if (week.total === 0 || week.completed === 0 || cap <= 0) return 0;
  const share = (week.completed / week.total) * cap;
  const level = Math.max(share, Math.min(week.completedMilestoneLevel, cap));
  return Math.round(Math.min(level, cap) * 100) / 100;
}

/**
 * Status of one activity for one member, from the records the existing
 * checklist flow already writes. Only an admin approval (of the task, or of
 * the day the task was ticked/submitted in) ever yields `completed` — a
 * ticked or submitted-but-unreviewed task is never reported as completed.
 */
export function deriveActivityStatus(params: {
  taskId: string;
  dayNumber: number;
  submission?: GraphSubmissionInput;
  dayProgress?: GraphDayProgressInput;
  currentDay: number;
}): ActivityStatus {
  const { taskId, dayNumber, submission, dayProgress, currentDay } = params;
  const ticked = dayProgress?.completedTaskIds?.includes(taskId) ?? false;
  const touched = !!submission || ticked;

  if (submission?.status === 'approved') return 'completed';
  if (submission?.status === 'rejected' || submission?.status === 'resubmission_required') return 'needs_revision';

  switch (dayProgress?.status) {
    case 'rejected':
      // A rejected day sends every not-yet-approved task in it back for revision.
      return touched ? 'needs_revision' : (dayNumber > currentDay ? 'upcoming' : 'not_started');
    case 'approved':
      // approveDayHandler approves every pending submission of an approved day,
      // and ticked proof-less tasks were accepted with the day. A task the
      // member never touched stays incomplete even though its day was approved.
      return touched ? 'completed' : 'not_started';
    case 'pending_approval':
      return touched ? 'submitted' : 'not_started';
    default:
      if (touched) return 'in_progress';
      return dayNumber > currentDay ? 'upcoming' : 'not_started';
  }
}

export function buildWeeklyGraph(params: {
  memberId: string;
  tasks: GraphTaskInput[];
  submissions: GraphSubmissionInput[];
  dayProgress: GraphDayProgressInput[];
  totalDays: number;
  currentDay: number;
  /** Program graph config (weeklyGraphConfig.ts). Omitted → built-in defaults (the original graph). */
  config?: GraphConfig;
  /** This member's admin-recorded milestone achievements. */
  records?: GraphRecordInput[];
  /** This member's reported revenue placed on program days (weeklyGraphRevenue.ts). Omitted/null → no revenue data. */
  revenue?: RevenueEntry[] | null;
}): WeeklyGraph {
  const { memberId, submissions, dayProgress, totalDays, currentDay } = params;
  const config = params.config ?? resolveGraphConfig({ weeks: [], milestones: [] });
  const milestones = config.milestones;
  // Task completion can lift a point only through the activity milestones below
  // the first revenue milestone; revenue levels come from reported revenue
  // against an admin threshold, or from admin records.
  const cap = taskProgressCap(milestones);

  const tasks = params.tasks
    .filter((t) => isTaskVisibleToMember(t, memberId) && t.dayNumber >= 1)
    .sort((a, b) => a.dayNumber - b.dayNumber || a.sortOrder - b.sortOrder);

  // Batch tasks are unique per (member, task, batch, day); prefer the row for
  // the task's current day, falling back to any row (a task moved to another
  // day keeps its history rather than silently resetting to "not started").
  const subByTaskDay = new Map<string, GraphSubmissionInput>();
  const subByTask = new Map<string, GraphSubmissionInput>();
  for (const s of submissions) {
    subByTaskDay.set(`${s.taskId}:${s.dayNumber}`, s);
    const prev = subByTask.get(s.taskId);
    if (!prev || prev.status !== 'approved') subByTask.set(s.taskId, s);
  }
  const progressByDay = new Map(dayProgress.map((p) => [p.dayNumber, p]));

  const lastDay = Math.max(totalDays, ...tasks.map((t) => t.dayNumber), 0);

  // X axis: exactly the program's configured weeks (active, admin order) — or,
  // for a program never configured, the default 7-day weeks. No week is ever
  // generated past the configured range: activities on days outside every
  // configured week are not shown until the admin adds a week for them.
  type Slot = { id: string | null; label: string; startDay: number; endDay: number };
  let slots: Slot[];
  if (config.weeks) {
    slots = config.weeks.map((w) => ({ ...w }));
  } else {
    slots = defaultWeeks(lastDay).map((w) => ({ id: null, ...w }));
  }

  const today = Math.min(Math.max(currentDay, 1), Math.max(lastDay, 1));
  let currentIdx = slots.findIndex((w) => w.startDay <= today && today <= w.endDay);
  if (currentIdx < 0) {
    slots.forEach((w, i) => {
      if (w.startDay <= today && (currentIdx < 0 || w.startDay >= slots[currentIdx].startDay)) currentIdx = i;
    });
  }
  if (currentIdx < 0) currentIdx = 0;
  const currentWeek = currentIdx + 1;

  const weeks: GraphWeek[] = slots.map((w, i) => ({
    weekNumber: i + 1,
    startDay: w.startDay,
    endDay: w.endDay,
    isCurrent: i === currentIdx,
    activities: [],
    total: 0, completed: 0, requiredTotal: 0, requiredCompleted: 0,
    completionPercent: null,
    progressLevel: null,
    weekId: w.id,
    label: w.label,
    revenue: null,
    cumulativeRevenue: null,
  }));
  const milestoneLevelByWeek = new Array<number>(weeks.length).fill(0);
  const milestoneReached = new Array<boolean>(milestones.length).fill(false);
  const milestoneDay = new Array<number | null>(milestones.length).fill(null);
  const reachedBy = new Array<GraphMilestoneStatus['reachedBy']>(milestones.length).fill(null);
  const reachedWeekIdx = new Array<number>(milestones.length).fill(-1);

  /** Which displayed week an activity belongs to, or -1 when it is hidden (its week is disabled). */
  const weekIndexFor = (t: GraphTaskInput): number => {
    if (t.graphWeekId) return slots.findIndex((w) => w.id === t.graphWeekId);
    const configuredRange = !!config.weeks && t.dayNumber <= config.coveredUntilDay;
    return slots.findIndex((w) => (!configuredRange || w.id !== null) && w.startDay <= t.dayNumber && t.dayNumber <= w.endDay);
  };
  /** Index of the configured milestone an activity is linked to, or -1. */
  const linkedMilestoneIndex = (t: GraphTaskInput): number =>
    t.graphMilestoneId
      ? milestones.findIndex((m) => m.id === t.graphMilestoneId)
      : t.isMilestone ? milestoneIndexForLabel(milestones, t.milestoneLabel) : -1;
  /** Axis level an activity's milestone link stands for (activity milestones within the task cap only). */
  const taskMilestoneLevel = (t: GraphTaskInput): number => {
    const idx = linkedMilestoneIndex(t);
    return idx >= 0 && milestones[idx].kind === 'activity' && idx + 1 <= cap ? idx + 1 : 0;
  };

  for (const t of tasks) {
    const w = weekIndexFor(t);
    if (w < 0) continue;
    const status = deriveActivityStatus({
      taskId: t.id,
      dayNumber: t.dayNumber,
      submission: subByTaskDay.get(`${t.id}:${t.dayNumber}`) ?? subByTask.get(t.id),
      dayProgress: progressByDay.get(t.dayNumber),
      currentDay,
    });
    const completed = status === 'completed';
    const week = weeks[w];
    const link = linkedMilestoneIndex(t);
    week.activities.push({
      taskId: t.id, title: t.title, dayNumber: t.dayNumber, isRequired: t.isRequired, status, completed,
      milestoneId: link >= 0 ? milestones[link].id : null,
      milestoneLabel: link >= 0 ? milestones[link].label : null,
      level: link >= 0 ? link + 1 : 0,
    });
    week.total += 1;
    if (completed) {
      week.completed += 1;
      milestoneLevelByWeek[w] = Math.max(milestoneLevelByWeek[w], taskMilestoneLevel(t));
    }
    // Explicit milestone link (tasks are in day order, so the first hit is the earliest).
    const linked = taskMilestoneLevel(t) - 1;
    if (linked >= 0 && !milestoneReached[linked]) {
      if (completed) {
        milestoneReached[linked] = true;
        milestoneDay[linked] = t.dayNumber;
        reachedBy[linked] = 'activity';
        reachedWeekIdx[linked] = w;
      } else if (milestoneDay[linked] === null) {
        milestoneDay[linked] = t.dayNumber;
      }
    }
    if (t.isRequired) {
      week.requiredTotal += 1;
      if (completed) week.requiredCompleted += 1;
    }
  }

  // Reported revenue (the "Your Revenue Stats" figure). A week's point reaches a
  // revenue milestone once the running total up to that week's end is at or
  // above the milestone's admin-set threshold. No data → no revenue level and
  // no revenue milestone reached; a milestone without a threshold is never
  // reached from revenue.
  const revenue = (params.revenue ?? []).filter((e) => Number.isFinite(e.amount));
  const hasRevenue = revenue.length > 0;
  const revenueLevelByWeek = new Array<number>(weeks.length).fill(0);
  const thresholds = milestones.map((m) =>
    m.kind === 'revenue' && typeof m.threshold === 'number' && m.threshold > 0 ? m.threshold : null,
  );
  const round2 = (n: number) => Math.round(n * 100) / 100;
  weeks.forEach((w, i) => {
    const inWeek = revenue.filter((e) => e.dayNumber >= w.startDay && e.dayNumber <= w.endDay);
    w.revenue = inWeek.length ? round2(inWeek.reduce((s, e) => s + e.amount, 0)) : null;
    if (!hasRevenue || w.startDay > today) return;
    const running = round2(revenue.filter((e) => e.dayNumber <= w.endDay).reduce((s, e) => s + e.amount, 0));
    w.cumulativeRevenue = running;
    thresholds.forEach((t, m) => {
      if (t === null || running < t) return;
      revenueLevelByWeek[i] = Math.max(revenueLevelByWeek[i], m + 1);
      if (!milestoneReached[m]) {
        milestoneReached[m] = true;
        reachedBy[m] = 'revenue';
        reachedWeekIdx[m] = i;
      }
    });
  });
  const totalToDate = hasRevenue ? round2(revenue.reduce((s, e) => s + e.amount, 0)) : null;
  // Revenue reported for days outside every shown week still counts toward the total.
  thresholds.forEach((t, m) => {
    if (t !== null && totalToDate !== null && totalToDate >= t && !milestoneReached[m]) {
      milestoneReached[m] = true;
      reachedBy[m] = 'revenue';
    }
  });

  // Admin/mentor-recorded achievements (manual override, e.g. revenue verified
  // offline) lift their week to the recorded milestone and reach it whatever
  // week they were recorded in.
  const recordLevelByWeek = new Array<number>(weeks.length).fill(0);
  for (const r of params.records ?? []) {
    const w = weeks.findIndex((wk) => wk.weekId !== null && wk.weekId === r.weekId);
    const m = milestones.findIndex((ms) => ms.id !== null && ms.id === r.milestoneId);
    if (m < 0) continue;
    if (w >= 0) recordLevelByWeek[w] = Math.max(recordLevelByWeek[w], m + 1);
    if (!milestoneReached[m]) {
      milestoneReached[m] = true;
      reachedBy[m] = 'record';
      reachedWeekIdx[m] = w;
    }
  }

  let total = 0;
  let completed = 0;
  weeks.forEach((w, i) => {
    w.completionPercent = percent(w.completed, w.total);
    w.progressLevel = w.startDay > today
      ? null
      : Math.max(
          weekProgressLevel({ total: w.total, completed: w.completed, completedMilestoneLevel: milestoneLevelByWeek[i] }, cap),
          recordLevelByWeek[i],
          revenueLevelByWeek[i],
        );
    total += w.total;
    completed += w.completed;
  });

  return {
    totalDays,
    currentDay,
    currentWeek,
    hasActivities: total > 0,
    weeks,
    summary: { total, completed, completionPercent: percent(completed, total) },
    config: {
      source: config.source,
      milestones: milestones.map((m, i) => ({
        id: m.id,
        label: m.label,
        kind: m.kind,
        reached: milestoneReached[i],
        dayNumber: m.kind === 'activity' ? milestoneDay[i] : null,
        threshold: thresholds[i],
        reachedBy: reachedBy[i],
        reachedWeek: reachedWeekIdx[i] >= 0 ? reachedWeekIdx[i] + 1 : null,
      })),
    },
    revenue: { source: 'self_reported', totalToDate },
  };
}
