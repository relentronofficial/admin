// Request-side glue for mentorship demo mode (pure rules live in mentorshipDemo.ts).
// Shared by the `user` and `user-batch` controllers so every overlaid endpoint
// uses the same identity check and the same demo history.

import type { FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../config/env.js';
import { localDayKey, programToday, resolveProgramTimezone, computeTierActiveDays } from './activityDays.js';
import { computeStreakSummary, type StreakSummary } from './streakSummaryLogic.js';
import { buildWeeklyGraph, type WeeklyGraph } from './weeklyGraphLogic.js';
import { loadGraphConfig } from './weeklyGraphConfigData.js';
import {
  buildDemoActivity,
  buildDemoGraphInputs,
  isMentorshipDemoMember,
  mightBeDemoMember,
  type DemoProgram,
} from './mentorshipDemo.js';

/**
 * True only for the configured member. request.memberId is set by
 * fastify.authenticateUser from the verified tbt_access cookie, and the email
 * is read from the DB — no header, body, query or client flag is consulted.
 * Every other member returns false on the id pre-check without a DB lookup.
 */
export async function isMentorshipDemoRequest(request: FastifyRequest): Promise<boolean> {
  const memberId = request.memberId;
  if (!memberId) return false;
  const config = { memberId: env.MENTORSHIP_DEMO_MEMBER_ID, email: env.MENTORSHIP_DEMO_EMAIL };
  if (!mightBeDemoMember(memberId, config)) return false;
  const member = await request.server.prisma.member
    .findUnique({ where: { id: memberId }, select: { id: true, email: true } })
    .catch(() => null);
  return !!member && isMentorshipDemoMember(member, config);
}

/**
 * Marks a demo response: an invisible `x-tbt-demo` header for verification, and
 * `Cache-Control: private, no-store` so no browser, proxy or CDN cache can keep
 * or replay a demo body. Demo bodies are also never written to the Redis
 * caches — overlays run after cacheGetOrCompute, whose per-member keys only
 * ever hold real data.
 */
export function markDemo(reply: FastifyReply): void {
  reply.header('x-tbt-demo', 'mentorship');
  reply.header('cache-control', 'private, no-store');
}

/** The member's real program window (same rules as GET /api/user-batch and /mentorship/stats). */
export async function loadDemoProgram(request: FastifyRequest): Promise<DemoProgram & { batchId: string | null; programId: string | null }> {
  const prisma = request.server.prisma;
  const memberId = request.memberId!;
  const member = await prisma.member.findUnique({ where: { id: memberId }, select: { batchId: true } }).catch(() => null);
  const batchId = (member as any)?.batchId ?? null;
  if (!batchId) return { batchId: null, programId: null, programStartDay: null, totalDays: 0 };

  const [batch, settings] = await Promise.all([
    prisma.batch.findUnique({
      where: { id: batchId },
      select: { startsAt: true, snapshotDays: true, programId: true, program: { select: { durationDays: true } } },
    }).catch(() => null),
    prisma.$queryRawUnsafe<Array<{ extended_days: number | null }>>(
      `SELECT extended_days FROM member_batch_settings WHERE batch_id=$1::uuid AND member_id=$2::uuid LIMIT 1`,
      batchId, memberId,
    ).catch(() => []),
  ]);
  if (!batch) return { batchId: null, programId: null, programStartDay: null, totalDays: 0 };

  const baseDays = (batch as any).snapshotDays ?? (batch as any).program?.durationDays ?? 90;
  const totalDays = baseDays + ((settings as any[])[0]?.extended_days ?? 0);
  const startsAt = (batch as any).startsAt ? new Date((batch as any).startsAt) : null;
  return {
    batchId,
    programId: (batch as any).programId ?? null,
    programStartDay: startsAt ? localDayKey(startsAt, programTz()) : null,
    totalDays,
  };
}

const programTz = () => resolveProgramTimezone(env.PROGRAM_TIMEZONE);

export interface DemoOverlay {
  streak: StreakSummary;
  tierActiveDays: number;
  /** null when the member is not in a batch — same as the real weekly-graph endpoint */
  graph: WeeklyGraph | null;
}

/** Streak, Tier Access and the weekly graph, all from one demo history. */
export async function buildDemoOverlay(request: FastifyRequest, now: Date = new Date()): Promise<DemoOverlay> {
  const program = await loadDemoProgram(request);
  const today = programToday(now, programTz());
  const { rows, currentDay } = buildDemoActivity(program, today);
  const streak = computeStreakSummary(rows, today);
  const tierActiveDays = computeTierActiveDays({
    activityDays: rows.map((r) => r.activity_date as string),
    programStartDay: program.programStartDay,
    totalDays: program.totalDays,
  });
  let graph: WeeklyGraph | null = null;
  if (program.batchId && program.programStartDay && currentDay !== null) {
    const { tasks, submissions } = buildDemoGraphInputs(program, currentDay);
    graph = buildWeeklyGraph({
      memberId: request.memberId!, tasks, submissions, dayProgress: [], totalDays: program.totalDays, currentDay,
      // Same axis as the member's real graph (the program's admin config, or defaults).
      config: await loadGraphConfig(request.server.prisma, program.programId),
    });
  }
  return { streak, tierActiveDays, graph };
}
