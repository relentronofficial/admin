// Mentorship dashboard demo mode — a read-time overlay for ONE configured member.
//
// Pure: no Prisma, no Fastify, no clock. The request layer
// (lib/mentorshipDemoRequest.ts) resolves the signed-in member (req.memberId
// from the verified tbt_access cookie + their email read from the DB) and the
// member's real program window, and passes them in; nothing here trusts client
// input.
//
// Nothing is written to the database. Demo values replace API responses for
// the target member only; their real rows stay untouched underneath, so
// unsetting the config restores their real view immediately. Every other
// member's responses are unchanged.
//
// Overlaid endpoints:
//   GET  /api/user/mentorship/revenue, /social   → demoRevenue / demoSocial
//   PUT  /api/user/mentorship/revenue, /social   → demo payload, no write
//   GET  /api/user/streak                        → navbar Top Streak
//   GET  /api/user/mentorship/stats              → streak / Tier Access / task counters
//   GET  /api/user-batch/weekly-graph            → Weekly Activity Graph
//
// Consistency: streak, Tier Access, the dashboard counters and the graph are
// all derived from ONE in-memory demo history (buildDemoActivity +
// buildDemoGraphInputs) through the same pure functions the real endpoints use
// (computeStreakSummary, computeTierActiveDays, buildWeeklyGraph), so they
// cannot disagree. The graph stays capped at Funnels by weeklyGraphLogic —
// task completion never reaches the revenue milestones. Course progress, daily
// time, rank and the weekly-report flag stay real (not demo-controlled).
//
// Configured by two backend env vars (both required, see config/env.ts):
//   MENTORSHIP_DEMO_MEMBER_ID — the target member's stable members.id (UUID)
//   MENTORSHIP_DEMO_EMAIL     — the same member's email as stored in members.email
// Unset either one to disable demo mode.

import type { StreakActivityRow, StreakSummary } from './streakSummaryLogic.js';
import type { GraphSubmissionInput, GraphTaskInput, WeeklyGraph } from './weeklyGraphLogic.js';

export interface MentorshipDemoConfig {
  memberId?: string | null;
  email?: string | null;
}

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();

/** Cheap pre-check (no DB): is demo mode configured at all, and could this member be the target? */
export function mightBeDemoMember(memberId: string, config: MentorshipDemoConfig): boolean {
  return !!norm(config.memberId) && !!norm(config.email) && norm(memberId) === norm(config.memberId);
}

/**
 * Demo mode applies only when BOTH the authenticated member's id and their
 * stored email match the configured target. A partial config never enables it.
 */
export function isMentorshipDemoMember(
  member: { id: string; email: string | null | undefined },
  config: MentorshipDemoConfig,
): boolean {
  return mightBeDemoMember(member.id, config) && !!norm(member.email) && norm(member.email) === norm(config.email);
}

// ── Demo payloads (same shapes as the real handlers) ─────────────────────────

const DAILY_REVENUE = [52000, 61500, 48800, 70200, 88400, 96300, 82700];
const DAILY_ORDERS = [64, 75, 59, 86, 108, 117, 101];
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function demoRevenue(week: { isoWeek: number; isoYear: number }) {
  const revenueGenerated = sum(DAILY_REVENUE); // 499,900
  const numberOfOrders = sum(DAILY_ORDERS);    // 610
  return {
    weekNumber: week.isoWeek,
    year: week.isoYear,
    revenueGenerated,
    revenuePrev: 412000,
    numberOfOrders,
    ordersPrev: 528,
    adBudgetSpent: 48500,
    roas: Math.round((revenueGenerated / 48500) * 100) / 100,
    customerAcqCost: Math.round(48500 / numberOfOrders),
    organicLeads: 142,
    leadsPrev: 118,
    avgOrderValue: Math.round(revenueGenerated / numberOfOrders),
    rtoReturnsPercent: 4.2,
    conversionRate: 3.8,
    platformBadge: null,
    dailyRevenue: [...DAILY_REVENUE],
    dailyOrders: [...DAILY_ORDERS],
    updatedAt: null,
  };
}

export function demoSocial(week: { isoWeek: number; isoYear: number }) {
  return {
    weekNumber: week.isoWeek,
    year: week.isoYear,
    totalFollowers: 12450,
    followersPrev: 11280,
    videoViews: 186000,
    videoViewsPrev: 142500,
    contentUploads: 6,
    contentUploadTarget: 7,
    interactions: 9840,
    interactionsPrev: 7610,
    dmLeads: 58,
    bioLinkClicks: 1320,
    bioLinkClicksPrev: 1045,
    updatedAt: null,
  };
}

// ── Demo activity history (streak, Tier Access, Weekly Activity Graph) ───────

/** The member's real program window on the program calendar; null start = not in a batch. */
export interface DemoProgram {
  programStartDay: string | null; // 'YYYY-MM-DD'
  totalDays: number;
}

const DAY_MS = 86_400_000;
const DEMO_STREAK_RUN = 12;      // the most recent 12 program days are all active
const DEMO_REST_EVERY = 5;       // before that, every 5th program day is a rest day
const DEMO_POINTS_PER_DAY = 30;
const DEMO_TASK_OFFSETS = [0, 2, 4, 6]; // 4 activities per week, on days 1/3/5/7 of the week
// The last activity of these weeks is an admin-style milestone (weeklyGraphLogic
// maps these labels to the Ads / Website / Funnels axis levels).
const DEMO_MILESTONES: Record<number, string> = { 2: 'Ads', 4: 'Website', 6: 'Funnels' };

const dayNum = (key: string) => Math.floor(Date.parse(`${key}T00:00:00Z`) / DAY_MS);
const keyOf = (n: number) => new Date(n * DAY_MS).toISOString().slice(0, 10);

/** 1-based program day containing `today` (UTC-midnight Date on the program calendar), or null with no program. */
export function demoProgramDay(program: DemoProgram, today: Date): number | null {
  if (!program.programStartDay || Number.isNaN(Date.parse(`${program.programStartDay}T00:00:00Z`))) return null;
  return Math.floor(today.getTime() / DAY_MS) - dayNum(program.programStartDay) + 1;
}

/** Is program day `day` active in the demo history (as of program day `currentDay`)? */
export function isDemoActiveDay(day: number, currentDay: number, totalDays: number): boolean {
  if (day < 1 || day > currentDay || day > totalDays) return false;
  const lastActive = Math.min(currentDay, totalDays);
  return day > lastActive - DEMO_STREAK_RUN || day % DEMO_REST_EVERY !== 0;
}

/**
 * Demo qualifying-activity rows, in the same shape getMyStreakHandler reads
 * from tbt_activity_log. With a program: every active program day up to today
 * (never before the start or past the end). Without one: the last
 * DEMO_STREAK_RUN days ending today.
 */
export function buildDemoActivity(program: DemoProgram, today: Date): { rows: StreakActivityRow[]; currentDay: number | null } {
  const todayN = Math.floor(today.getTime() / DAY_MS);
  const currentDay = demoProgramDay(program, today);
  const rows: StreakActivityRow[] = [];
  if (currentDay === null) {
    for (let i = DEMO_STREAK_RUN - 1; i >= 0; i--) rows.push({ activity_date: keyOf(todayN - i), points: DEMO_POINTS_PER_DAY });
    return { rows, currentDay };
  }
  const startN = dayNum(program.programStartDay!);
  for (let d = 1; d <= Math.min(currentDay, program.totalDays); d++) {
    if (isDemoActiveDay(d, currentDay, program.totalDays)) rows.push({ activity_date: keyOf(startN + d - 1), points: DEMO_POINTS_PER_DAY });
  }
  return { rows, currentDay };
}

/**
 * Demo activities for the Weekly Activity Graph: 4 per week across the real
 * program length. An activity is completed (approved) exactly when its day is
 * an active day in the same demo history, so a week's points follow the streak.
 */
export function buildDemoGraphInputs(program: DemoProgram, currentDay: number): {
  tasks: GraphTaskInput[];
  submissions: GraphSubmissionInput[];
} {
  const tasks: GraphTaskInput[] = [];
  const submissions: GraphSubmissionInput[] = [];
  const weeks = Math.ceil(Math.max(program.totalDays, 0) / 7);
  for (let w = 1; w <= weeks; w++) {
    const days = DEMO_TASK_OFFSETS.map((o) => (w - 1) * 7 + 1 + o).filter((d) => d <= program.totalDays);
    days.forEach((dayNumber, k) => {
      const id = `demo-w${w}-${k + 1}`;
      const milestone = k === days.length - 1 ? DEMO_MILESTONES[w] : undefined;
      tasks.push({
        id, title: `Week ${w} activity ${k + 1}`, dayNumber, sortOrder: k, isRequired: true, memberId: null,
        isMilestone: !!milestone, milestoneLabel: milestone ?? null,
      });
      if (isDemoActiveDay(dayNumber, currentDay, program.totalDays)) submissions.push({ taskId: id, dayNumber, status: 'approved' });
    });
  }
  return { tasks, submissions };
}

/**
 * Dashboard counters from the same demo history: streak and Tier Access match
 * the navbar, task counts match the Weekly Activity Graph. Everything else
 * (program identity, course progress, daily time, rank, weekly report) stays real.
 */
export function demoStats<T extends { streakDays: number; activeDays: number; tasksCompleted: number; tasksTotal: number }>(
  real: T,
  demo: { streak: StreakSummary; tierActiveDays: number; graph: WeeklyGraph | null },
): T {
  return {
    ...real,
    streakDays: demo.streak.currentStreak,
    activeDays: demo.tierActiveDays,
    tasksCompleted: demo.graph ? demo.graph.summary.completed : real.tasksCompleted,
    tasksTotal: demo.graph ? demo.graph.summary.total : real.tasksTotal,
  };
}
