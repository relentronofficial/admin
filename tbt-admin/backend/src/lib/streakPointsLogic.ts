// Pure aggregation for the Streak Points history endpoint (GET
// /api/user/streak-points). Deliberately zero imports of Prisma/config so this
// can be unit-tested with no .env / database present — see
// streakPointsLogic.test.ts. The raw SQL join lives in
// modules/user/controller.ts (getMyStreakPointsHandler).

export interface StreakPointsRow {
  points: number;
  reference_type: string;
  title: string | null;
  created_at: string | Date;
}

export interface StreakPointsHistoryEntry {
  type: 'video' | 'task';
  title: string;
  points: number;
  createdAt: string | Date;
}

export interface StreakPointsSummary {
  total: number;
  videoTotal: number;
  taskTotal: number;
  history: StreakPointsHistoryEntry[];
}

export function computeStreakPointsSummary(rows: StreakPointsRow[]): StreakPointsSummary {
  let videoTotal = 0;
  let taskTotal = 0;
  const history: StreakPointsHistoryEntry[] = rows.map((r) => {
    const type: 'video' | 'task' = r.reference_type === 'episode_completion' ? 'video' : 'task';
    const points = Number(r.points) || 0;
    if (type === 'video') videoTotal += points;
    else taskTotal += points;
    return { type, title: r.title ?? (type === 'video' ? 'Video' : 'Task'), points, createdAt: r.created_at };
  });
  return { total: videoTotal + taskTotal, videoTotal, taskTotal, history };
}
