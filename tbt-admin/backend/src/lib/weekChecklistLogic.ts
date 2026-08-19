// Pure, DB/env-free logic for the weekly checklist feature. Week number is
// never stored — it's always derived from dayNumber. See TASK_FEATURE_SPEC.md.

const DAY_MS = 86_400_000;

export function getWeekNumber(dayNumber: number): number {
  return Math.max(1, Math.ceil(dayNumber / 7));
}

export function getWeekDayRange(weekNumber: number, totalDays?: number): { startDay: number; endDay: number } {
  const startDay = (weekNumber - 1) * 7 + 1;
  const rawEndDay = weekNumber * 7;
  const endDay = totalDays !== undefined ? Math.min(rawEndDay, totalDays) : rawEndDay;
  return { startDay, endDay };
}

export function getWeekDateRange(batchStartsAt: Date, weekNumber: number): { startDate: Date; endDate: Date } {
  const { startDay, endDay } = getWeekDayRange(weekNumber);
  const startDate = new Date(batchStartsAt.getTime() + (startDay - 1) * DAY_MS);
  const endDate = new Date(batchStartsAt.getTime() + (endDay - 1) * DAY_MS);
  return { startDate, endDate };
}

export function getCurrentDayNumber(startsAt: Date, now: Date = new Date()): number {
  return Math.floor((now.getTime() - startsAt.getTime()) / DAY_MS) + 1;
}

export function getCurrentWeekNumber(startsAt: Date, now: Date = new Date()): number {
  return getWeekNumber(Math.max(1, getCurrentDayNumber(startsAt, now)));
}

export function computeApprovalRate(approved: number, total: number): number {
  return total > 0 ? Math.round((approved / total) * 100) : 0;
}

export interface DayCountRow {
  dayNumber: number;
  approved: number;
  rejected: number;
  pending: number;
  inProgress: number;
  total: number;
}

export interface WeekSummary {
  weekNumber: number;
  startDay: number;
  endDay: number;
  startDate: string;
  endDate: string;
  totalMembers: number;
  totalAssigned: number;
  completed: number;
  pending: number;
  completionRate: number;
  dailyBreakdown: Array<DayCountRow & { approvalRate: number }>;
}

export function summarizeWeek(params: {
  weekNumber: number;
  batchStartsAt: Date;
  totalMembers: number;
  dayRows: DayCountRow[];
}): WeekSummary {
  const { startDay, endDay } = getWeekDayRange(params.weekNumber);
  const { startDate, endDate } = getWeekDateRange(params.batchStartsAt, params.weekNumber);
  const totalAssigned = params.dayRows.reduce((sum, r) => sum + r.total, 0);
  const completed = params.dayRows.reduce((sum, r) => sum + r.approved, 0);
  const pending = params.dayRows.reduce((sum, r) => sum + r.pending + r.inProgress, 0);
  return {
    weekNumber: params.weekNumber,
    startDay,
    endDay,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    totalMembers: params.totalMembers,
    totalAssigned,
    completed,
    pending,
    completionRate: computeApprovalRate(completed, totalAssigned),
    dailyBreakdown: params.dayRows.map(r => ({ ...r, approvalRate: computeApprovalRate(r.approved, r.total) })),
  };
}

export function checklistAvailableActionUrl(dayNumber: number): string {
  return `/batch-program/${dayNumber}`;
}

/** Dedup guard — a day number is only ever "newly available" once per member. */
export function shouldSendChecklistAvailableNotif(alreadyNotifiedDayNumbers: number[], dayNumber: number): boolean {
  return !alreadyNotifiedDayNumbers.includes(dayNumber);
}
