// Pure aggregation for the header streak widget (GET /api/user/streak).
// Zero Prisma/config imports so it is unit-testable in streakSummaryLogic.test.ts.
// The raw SQL lives in modules/user/controller.ts (getMyStreakHandler).
//
// Uses the same `tbt_activity_log` ledger and the same UTC day rule as
// `computeMemberStats` (tbtStats.ts), so the header count always matches the
// dashboard "Current Streak" stat.

import { countConsecutiveStreak } from './tbtStats.js';

export interface StreakActivityRow {
  activity_date: Date | string;
  points: number | bigint | null;
}

export interface StreakDay {
  date: string; // YYYY-MM-DD (UTC)
  active: boolean;
  points: number;
}

export interface StreakSummary {
  currentStreak: number;
  longestStreak: number;
  activeToday: boolean;
  totalActiveDays: number;
  pointsToday: number;
  last7Days: StreakDay[]; // oldest → newest, last entry is today
}

const DAY_MS = 86_400_000;

function utcDayNumber(d: Date): number {
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / DAY_MS);
}

function isoDate(dayNumber: number): string {
  return new Date(dayNumber * DAY_MS).toISOString().slice(0, 10);
}

export function computeStreakSummary(rows: StreakActivityRow[], today: Date = new Date()): StreakSummary {
  const pointsByDay = new Map<number, number>();
  for (const r of rows) {
    const day = utcDayNumber(new Date(r.activity_date));
    pointsByDay.set(day, (pointsByDay.get(day) ?? 0) + Number(r.points ?? 0));
  }

  // Same key format countConsecutiveStreak expects (non-padded YYYY-M-D).
  const dateKeys = new Set(
    [...pointsByDay.keys()].map((n) => {
      const d = new Date(n * DAY_MS);
      return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
    }),
  );
  const currentStreak = countConsecutiveStreak(dateKeys, today);

  const sortedDays = [...pointsByDay.keys()].sort((a, b) => a - b);
  let longestStreak = 0;
  let run = 0;
  for (let i = 0; i < sortedDays.length; i++) {
    run = i > 0 && sortedDays[i] === sortedDays[i - 1] + 1 ? run + 1 : 1;
    if (run > longestStreak) longestStreak = run;
  }

  const todayNum = utcDayNumber(today);
  const last7Days: StreakDay[] = [];
  for (let i = 6; i >= 0; i--) {
    const n = todayNum - i;
    last7Days.push({ date: isoDate(n), active: pointsByDay.has(n), points: pointsByDay.get(n) ?? 0 });
  }

  return {
    currentStreak,
    longestStreak: Math.max(longestStreak, currentStreak),
    activeToday: pointsByDay.has(todayNum),
    totalActiveDays: pointsByDay.size,
    pointsToday: pointsByDay.get(todayNum) ?? 0,
    last7Days,
  };
}
