/**
 * TBT Gamification module — 90-day task path + points + levels.
 *
 * Ported from co-worker's admin-app + tbt_points_service.dart:
 *   * `tbt_activity_log`  — one row per points event (task completion,
 *                            manual grant). Total points = SUM(points)
 *                            across a member's rows.
 *   * `tbt_levels`        — level_number → required_points ladder.
 *                            Current level = max(level_number)
 *                            where required_points ≤ total.
 *   * `tbt_tasks`         — 90-day path, ordered by task_order.
 *                            Task is `current` when previous is done
 *                            and this one isn't yet; `locked` otherwise.
 *   * `tbt_task_completions` — idempotent (member_id, task_id) unique.
 *                            Completing awards `reward_points` via a
 *                            paired tbt_activity_log insert.
 *
 * Daily streak = count of distinct activity_date values counting
 * consecutively back from today. Same rule as the co-worker's version.
 */

import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  createLevelSchema,
  updateLevelSchema,
  createTaskSchema,
  updateTaskSchema,
  grantPointsSchema,
} from './schema.js';
import { computeMemberStats } from '../../lib/tbtStats.js';

function ok(reply: FastifyReply, data: any, extra?: any) {
  return reply.send({ success: true, data, error: null, ...extra });
}
function fail(reply: FastifyReply, status: number, code: string, message: string) {
  return reply.status(status).send({ success: false, data: null, error: { code, message } });
}

// ────────────────────────────────────────────────────────────────
// LEVELS — admin
// ────────────────────────────────────────────────────────────────
export async function adminListLevelsHandler(req: FastifyRequest, reply: FastifyReply) {
  const rows = await req.server.prisma.tbtLevel.findMany({
    orderBy: [{ sortOrder: 'asc' }, { levelNumber: 'asc' }],
  });
  return ok(reply, rows);
}

export async function adminCreateLevelHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = createLevelSchema.safeParse(req.body);
  if (!parsed.success) return fail(reply, 400, 'invalid_input', parsed.error.message);
  try {
    const created = await req.server.prisma.tbtLevel.create({ data: parsed.data });
    return reply.status(201).send({ success: true, data: created, error: null });
  } catch (err: any) {
    if (err?.code === 'P2002')
      return fail(reply, 409, 'duplicate_level_number', 'That level number is already used.');
    throw err;
  }
}

export async function adminUpdateLevelHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const parsed = updateLevelSchema.safeParse(req.body);
  if (!parsed.success) return fail(reply, 400, 'invalid_input', parsed.error.message);
  try {
    const updated = await req.server.prisma.tbtLevel.update({
      where: { id },
      data: parsed.data,
    });
    return ok(reply, updated);
  } catch (err: any) {
    if (err?.code === 'P2025') return fail(reply, 404, 'not_found', 'Level not found.');
    if (err?.code === 'P2002')
      return fail(reply, 409, 'duplicate_level_number', 'That level number is already used.');
    throw err;
  }
}

export async function adminDeleteLevelHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  try {
    await req.server.prisma.tbtLevel.delete({ where: { id } });
    return ok(reply, null);
  } catch (err: any) {
    if (err?.code === 'P2025') return fail(reply, 404, 'not_found', 'Level not found.');
    throw err;
  }
}

// ────────────────────────────────────────────────────────────────
// TASKS — admin
// ────────────────────────────────────────────────────────────────
export async function adminListTasksHandler(req: FastifyRequest, reply: FastifyReply) {
  const rows = await req.server.prisma.tbtTask.findMany({
    orderBy: [{ sortOrder: 'asc' }, { taskOrder: 'asc' }],
    include: { _count: { select: { completions: true } } },
  });
  return ok(reply, rows);
}

export async function adminCreateTaskHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = createTaskSchema.safeParse(req.body);
  if (!parsed.success) return fail(reply, 400, 'invalid_input', parsed.error.message);
  try {
    const created = await req.server.prisma.tbtTask.create({ data: parsed.data });
    return reply.status(201).send({ success: true, data: created, error: null });
  } catch (err: any) {
    if (err?.code === 'P2002')
      return fail(reply, 409, 'duplicate_task_order', 'That task order is already used.');
    throw err;
  }
}

export async function adminUpdateTaskHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const parsed = updateTaskSchema.safeParse(req.body);
  if (!parsed.success) return fail(reply, 400, 'invalid_input', parsed.error.message);
  try {
    const updated = await req.server.prisma.tbtTask.update({
      where: { id },
      data: parsed.data,
    });
    return ok(reply, updated);
  } catch (err: any) {
    if (err?.code === 'P2025') return fail(reply, 404, 'not_found', 'Task not found.');
    if (err?.code === 'P2002')
      return fail(reply, 409, 'duplicate_task_order', 'That task order is already used.');
    throw err;
  }
}

export async function adminDeleteTaskHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  try {
    await req.server.prisma.tbtTask.delete({ where: { id } });
    return ok(reply, null);
  } catch (err: any) {
    if (err?.code === 'P2025') return fail(reply, 404, 'not_found', 'Task not found.');
    throw err;
  }
}

// ────────────────────────────────────────────────────────────────
// LEADERBOARD + Admin dashboard
// ────────────────────────────────────────────────────────────────
export async function adminLeaderboardHandler(req: FastifyRequest, reply: FastifyReply) {
  const { limit = '50' } = req.query as Record<string, string>;
  const l = Math.min(200, Math.max(1, Number(limit) || 50));
  // Group + sum via Prisma. For a monster-scale board switch to a
  // raw query with LIMIT and a proper index; at LMS scale (a few
  // thousand members) the groupBy is fine.
  const grouped = await req.server.prisma.tbtActivityLog.groupBy({
    by: ['memberId'],
    _sum: { points: true },
    orderBy: { _sum: { points: 'desc' } },
    take: l,
  });
  const memberIds = grouped.map((g) => g.memberId);
  const members = memberIds.length
    ? await req.server.prisma.member.findMany({
        where: { id: { in: memberIds } },
        select: { id: true, firstName: true, lastName: true, email: true, profilePhotoUrl: true },
      })
    : [];
  const byId = new Map(members.map((m) => [m.id, m]));
  const rows = grouped.map((g, i) => ({
    rank: i + 1,
    memberId: g.memberId,
    totalPoints: g._sum.points ?? 0,
    member: byId.get(g.memberId) ?? null,
  }));
  return ok(reply, rows);
}

export async function adminGrantPointsHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = grantPointsSchema.safeParse(req.body);
  if (!parsed.success) return fail(reply, 400, 'invalid_input', parsed.error.message);
  const { memberId, points, source } = parsed.data;
  const member = await req.server.prisma.member.findUnique({ where: { id: memberId }, select: { id: true } });
  if (!member) return fail(reply, 404, 'not_found', 'Member not found.');
  const created = await req.server.prisma.tbtActivityLog.create({
    data: { memberId, points, source },
  });
  return reply.status(201).send({ success: true, data: created, error: null });
}

export async function adminDashboardHandler(req: FastifyRequest, reply: FastifyReply) {
  const [levels, tasks, completions, totalPointsRow, activeMembers] = await Promise.all([
    req.server.prisma.tbtLevel.count(),
    req.server.prisma.tbtTask.count(),
    req.server.prisma.tbtTaskCompletion.count(),
    req.server.prisma.tbtActivityLog.aggregate({ _sum: { points: true } }),
    req.server.prisma.tbtActivityLog.findMany({
      distinct: ['memberId'],
      select: { memberId: true },
    }),
  ]);
  return ok(reply, {
    levels,
    tasks,
    completions,
    totalPointsAwarded: totalPointsRow._sum.points ?? 0,
    activeMembers: activeMembers.length,
  });
}

// ────────────────────────────────────────────────────────────────
// MEMBER-FACING
// ────────────────────────────────────────────────────────────────

async function _fetchMemberSummary(prisma: any, memberId: string) {
  // Points + streak are computed by the shared helper so this endpoint
  // and the profile stats row (backed by /api/user/me) always agree.
  // The helper backfills legacy workshop/challenge/assignment/course_xp
  // events into `tbt_activity_log` on first read, so old activity
  // counts even though it never wrote to the ledger.
  const stats = await computeMemberStats(prisma, memberId);
  const totalPoints = stats.totalPoints;
  const streak = stats.currentStreak;

  const [tasks, completions, levels] = await Promise.all([
    prisma.tbtTask.findMany({
      where: { status: 'active' },
      orderBy: [{ sortOrder: 'asc' }, { taskOrder: 'asc' }],
    }),
    prisma.tbtTaskCompletion.findMany({ where: { memberId } }),
    prisma.tbtLevel.findMany({ orderBy: { requiredPoints: 'asc' } }),
  ]);

  // Level = highest requirement met.
  const sortedLevels = (levels as Array<any>).sort((a, b) => a.requiredPoints - b.requiredPoints);
  let currentLevel: any = null;
  let nextLevel: any = null;
  for (const lv of sortedLevels) {
    if (totalPoints >= lv.requiredPoints) {
      currentLevel = lv;
    } else if (nextLevel == null) {
      nextLevel = lv;
    }
  }

  // Decorate tasks with locked / current / completed status.
  const completedIds = new Set((completions as Array<{ taskId: string }>).map((c) => c.taskId));
  const decorated = (tasks as Array<any>).map((t, idx) => {
    const isCompleted = completedIds.has(t.id);
    const prev = idx === 0 ? null : (tasks as Array<any>)[idx - 1];
    const prevDone = prev == null ? true : completedIds.has(prev.id);
    let status: 'completed' | 'current' | 'locked' = 'locked';
    if (isCompleted) status = 'completed';
    else if (prevDone) status = 'current';
    return {
      ...t,
      isCompleted,
      isLocked: status === 'locked',
      status,
      completedAt: isCompleted
        ? (completions as Array<{ taskId: string; completedAt: Date }>).find((c) => c.taskId === t.id)
            ?.completedAt ?? null
        : null,
    };
  });

  return {
    totalPoints,
    dailyStreak: streak,
    currentLevel,
    nextLevel,
    tasks: decorated,
  };
}

export async function myPathHandler(req: FastifyRequest, reply: FastifyReply) {
  const summary = await _fetchMemberSummary(req.server.prisma, req.memberId!);
  return ok(reply, summary);
}

export async function completeTaskHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };

  const task = await req.server.prisma.tbtTask.findUnique({
    where: { id },
    select: { id: true, taskOrder: true, rewardPoints: true, status: true },
  });
  if (!task) return fail(reply, 404, 'not_found', 'Task not found.');
  if (task.status !== 'active') return fail(reply, 400, 'inactive_task', 'Task is not active.');

  // Enforce "no skipping" — previous tasks must be complete.
  if (task.taskOrder > 1) {
    const prevIds = await req.server.prisma.tbtTask.findMany({
      where: { taskOrder: { lt: task.taskOrder }, status: 'active' },
      select: { id: true },
    });
    if (prevIds.length > 0) {
      const doneCount = await req.server.prisma.tbtTaskCompletion.count({
        where: {
          memberId: req.memberId!,
          taskId: { in: prevIds.map((p) => p.id) },
        },
      });
      if (doneCount < prevIds.length) {
        return fail(reply, 400, 'locked', 'Complete the previous tasks first.');
      }
    }
  }

  // Idempotent — the unique (member_id, task_id) constraint stops
  // double-award. We also short-circuit here to avoid throwing.
  const existing = await req.server.prisma.tbtTaskCompletion.findUnique({
    where: { memberId_taskId: { memberId: req.memberId!, taskId: task.id } },
  });
  if (existing) {
    return ok(reply, { alreadyCompleted: true, completion: existing });
  }

  // Award both rows atomically — same transaction so a mid-flight
  // failure doesn't leave a completion without its points ledger row.
  const result = await req.server.prisma.$transaction(async (tx) => {
    const completion = await tx.tbtTaskCompletion.create({
      data: { memberId: req.memberId!, taskId: task.id },
    });
    const activity =
      task.rewardPoints > 0
        ? await tx.tbtActivityLog.create({
            data: {
              memberId: req.memberId!,
              points: task.rewardPoints,
              source: 'task_completion',
            },
          })
        : null;
    return { completion, activity };
  });

  return reply.status(201).send({ success: true, data: result, error: null });
}

export async function listLevelsHandler(req: FastifyRequest, reply: FastifyReply) {
  const rows = await req.server.prisma.tbtLevel.findMany({
    orderBy: [{ sortOrder: 'asc' }, { levelNumber: 'asc' }],
  });
  return ok(reply, rows);
}

export async function leaderboardHandler(req: FastifyRequest, reply: FastifyReply) {
  const { limit = '20', period = 'all' } = req.query as Record<string, string>;
  const l = Math.min(100, Math.max(1, Number(limit) || 20));

  // Compute the activityDate lower-bound for the period filter.
  // `week` → last 7 calendar days; `month` → last 30 days; `all` → no filter.
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let since: Date | null = null;
  if (period === 'week') {
    since = new Date(startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000);
  } else if (period === 'month') {
    since = new Date(startOfToday.getTime() - 29 * 24 * 60 * 60 * 1000);
  }

  const grouped = await req.server.prisma.tbtActivityLog.groupBy({
    by: ['memberId'],
    _sum: { points: true },
    where: since ? { activityDate: { gte: since } } : undefined,
    orderBy: { _sum: { points: 'desc' } },
    take: l,
  });
  const memberIds = grouped.map((g) => g.memberId);
  const members = memberIds.length
    ? await req.server.prisma.member.findMany({
        where: { id: { in: memberIds } },
        select: { id: true, firstName: true, lastName: true, profilePhotoUrl: true },
      })
    : [];
  const byId = new Map(members.map((m) => [m.id, m]));
  const rows = grouped.map((g, i) => ({
    rank: i + 1,
    memberId: g.memberId,
    totalPoints: g._sum.points ?? 0,
    isMe: g.memberId === req.memberId,
    member: byId.get(g.memberId) ?? null,
  }));
  return ok(reply, rows);
}

/**
 * Admin activity-log view. Returns paginated activity_log entries with
 * member info joined in. Supports filters:
 *   * memberId=<uuid>
 *   * source=<task_completion|manual|...>
 *   * period=all|week|month (default all)
 *   * page, limit
 */
export async function adminActivityLogHandler(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const {
    memberId,
    source,
    period = 'all',
    page = '1',
    limit = '50',
  } = req.query as Record<string, string>;

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(200, Math.max(1, Number(limit) || 50));

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let since: Date | null = null;
  if (period === 'week') {
    since = new Date(startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000);
  } else if (period === 'month') {
    since = new Date(startOfToday.getTime() - 29 * 24 * 60 * 60 * 1000);
  }

  const where: Record<string, unknown> = {};
  if (memberId) where.memberId = memberId;
  if (source) where.source = source;
  if (since) where.activityDate = { gte: since };

  const [rows, total] = await Promise.all([
    req.server.prisma.tbtActivityLog.findMany({
      where: where as any,
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
      include: {
        member: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePhotoUrl: true,
          },
        },
      },
    }),
    req.server.prisma.tbtActivityLog.count({ where: where as any }),
  ]);

  return reply.send({
    success: true,
    data: rows,
    meta: { total, page: pageNum, limit: limitNum },
    error: null,
  });
}
