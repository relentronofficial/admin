/**
 * Member chatbot tools (read-only). Every query is pinned to ctx.memberId,
 * which comes from the signed-in session — no tool takes a member argument, so
 * one member can never ask about another. Join links and answers are not
 * returned.
 */
import type { PrismaClient } from '@prisma/client';
import { loadCategoryQuota, loadCoinBalance } from '../supportCallData.js';
import { SUPPORT_CALL_CATEGORIES } from '../supportCallLogic.js';
import { isTaskVisibleToMember } from '../weeklyGraphLogic.js';
import type { HelpBotAction } from '../helpBot/actions.js';
import type { PageRef } from '../helpBot/extras.js';
import { batchDay, loadProgress } from './adminTools.js';
import { ToolError, ist, listed, type AssistantTool } from './registry.js';

export interface MemberToolCtx {
  prisma: PrismaClient;
  now: Date;
  memberId: string;
  /** Things prepared for the member to confirm; nothing is done until they do. */
  actions?: HelpBotAction[];
  /** The page the member has open (lib/helpBot/extras.ts parsePage). */
  page?: PageRef;
}

const always = () => true;

async function me(c: MemberToolCtx) {
  const m = await c.prisma.member.findFirst({
    where: { id: c.memberId, deletedAt: null },
    select: { id: true, batchId: true, membershipPlan: true },
  });
  if (!m) throw new ToolError('Your account could not be found.');
  return m;
}

export const memberTools: AssistantTool<MemberToolCtx>[] = [
  {
    name: 'getMyProgress',
    description: 'The signed-in member\'s programme progress (current day, days approved, waiting, rejected, attendance) and course progress.',
    params: {},
    allowed: always,
    async run(c) {
      const m = await me(c);
      return loadProgress(c.prisma, c.now, m.id, m.batchId);
    },
  },
  {
    name: 'getMyTasks',
    description: 'The signed-in member\'s programme tasks for one day (default: their current day), with the status of what they submitted.',
    params: { day: { type: 'integer', min: 1, max: 1000, description: 'Programme day (default: the current day). Days not reached yet are not available.' } },
    allowed: always,
    async run(c, a) {
      const m = await me(c);
      if (!m.batchId) return { inProgram: false };
      const batch = await c.prisma.batch.findUnique({ where: { id: m.batchId }, select: { startsAt: true, programId: true } });
      if (!batch) return { inProgram: false };
      const current = batchDay(batch.startsAt, null, c.now);
      if (current < 1) return { inProgram: true, started: false, starts: ist(batch.startsAt) };
      const day = Number(a.day ?? current);
      if (day > current) throw new ToolError(`Day ${day} has not been reached yet. The current day is ${current}.`);
      const [tasks, progress, submissions] = await Promise.all([
        c.prisma.task.findMany({
          where: { isActive: true, dayNumber: day, OR: [{ batchId: m.batchId }, ...(batch.programId ? [{ programId: batch.programId, batchId: null }] : [])] },
          orderBy: { sortOrder: 'asc' },
          select: { id: true, title: true, isRequired: true, estimatedMinutes: true },
        }),
        c.prisma.memberDayProgress.findFirst({ where: { memberId: m.id, batchId: m.batchId, dayNumber: day }, select: { status: true } }),
        c.prisma.taskSubmission.findMany({ where: { memberId: m.id, batchId: m.batchId, dayNumber: day }, select: { taskId: true, status: true } }),
      ]);
      // tasks.member_id (raw column) assigns a task to one member only.
      const owners = tasks.length
        ? await c.prisma.$queryRawUnsafe<Array<{ id: string; member_id: string | null }>>(
            `SELECT id::text, member_id::text FROM tasks WHERE id = ANY($1::uuid[])`, tasks.map((t) => t.id))
        : [];
      const owner = new Map(owners.map((o) => [o.id, o.member_id]));
      const status = new Map(submissions.map((s) => [s.taskId, s.status]));
      const mine = tasks.filter((t) => owner.has(t.id) && isTaskVisibleToMember({ memberId: owner.get(t.id) ?? null }, m.id));
      return {
        inProgram: true, started: true, currentDay: current, day, dayStatus: progress?.status ?? 'not_started',
        tasks: mine.map((t) => ({ title: t.title, required: t.isRequired, estimatedMinutes: t.estimatedMinutes, status: status.get(t.id) ?? 'not_submitted' })),
      };
    },
  },
  {
    name: 'getMyCourses',
    description: 'Courses the signed-in member can access, when access ends, and how far they have got.',
    params: {},
    allowed: always,
    async run(c) {
      const [access, enrollments] = await Promise.all([
        c.prisma.courseAccess.findMany({ where: { memberId: c.memberId, isActive: true }, take: 100, select: { courseId: true, accessType: true, expiresAt: true, course: { select: { title: true } } } }),
        c.prisma.courseEnrollment.findMany({ where: { memberId: c.memberId }, take: 100, select: { courseId: true, progressPercentage: true, completedAt: true, course: { select: { title: true } } } }),
      ]);
      const progress = new Map(enrollments.map((e) => [e.courseId, e]));
      const granted = access.map((x) => ({
        course: x.course.title, access: x.accessType, expires: ist(x.expiresAt),
        accessEnded: !!x.expiresAt && x.expiresAt <= c.now,
        progressPercent: progress.get(x.courseId)?.progressPercentage ?? 0, completed: !!progress.get(x.courseId)?.completedAt,
      }));
      const has = new Set(access.map((x) => x.courseId));
      const others = enrollments.filter((e) => !has.has(e.courseId)).map((e) => ({ course: e.course.title, progressPercent: e.progressPercentage, completed: !!e.completedAt }));
      return { courses: granted, startedWithoutASeparateGrant: others };
    },
  },
  {
    name: 'getMyPoints',
    description: 'The signed-in member\'s TBT coin balance and what they earned or spent in the last 30 days, by source.',
    params: {},
    allowed: always,
    async run(c) {
      const [balance, rows] = await Promise.all([
        loadCoinBalance(c.prisma, c.memberId),
        c.prisma.$queryRawUnsafe<Array<{ source: string; points: number }>>(
          `SELECT source, SUM(points)::int AS points FROM tbt_activity_log
            WHERE member_id = $1::uuid AND activity_date > ($2::timestamptz AT TIME ZONE 'Asia/Kolkata')::date - 30
            GROUP BY source ORDER BY ABS(SUM(points)) DESC LIMIT 20`, c.memberId, c.now),
      ]);
      return { coinBalance: balance, last30Days: rows.map((r) => ({ source: r.source, points: Number(r.points) })) };
    },
  },
  {
    name: 'getMySupportQuota',
    description: 'How many expert support calls of each kind the signed-in member has: included, used, booked ahead and remaining.',
    params: {},
    allowed: always,
    async run(c) {
      const m = await me(c);
      const quotas = await Promise.all(SUPPORT_CALL_CATEGORIES.map((k) => loadCategoryQuota(c.prisma, m.id, String(m.membershipPlan), k)));
      return { plan: m.membershipPlan, calls: SUPPORT_CALL_CATEGORIES.map((k, i) => ({ category: k, allocated: quotas[i].allocated, used: quotas[i].used, bookedAhead: quotas[i].reserved, remaining: quotas[i].remaining })) };
    },
  },
  {
    name: 'getMyUpcomingCalls',
    description: 'Support calls the signed-in member has booked that have not ended. The join link is only on the Support Calls screen.',
    params: {},
    allowed: always,
    async run(c) {
      const rows = await c.prisma.$queryRawUnsafe<any[]>(
        `SELECT s.title, s.category, s.starts_at, s.duration_minutes, COALESCE(NULLIF(TRIM(a.full_name), ''), s.host_name) AS host
           FROM support_call_bookings b JOIN support_call_sessions s ON s.id = b.session_id
           LEFT JOIN admins a ON a.id = s.host_admin_id
          WHERE b.member_id = $1::uuid AND b.status = 'booked' AND s.status = 'scheduled'
            AND s.starts_at + make_interval(mins => s.duration_minutes) > $2::timestamptz
          ORDER BY s.starts_at LIMIT 20`, c.memberId, c.now);
      return listed(rows.map((r) => ({ title: r.title, category: r.category, starts: ist(r.starts_at), minutes: Number(r.duration_minutes), host: r.host ?? null })), rows.length);
    },
  },
  {
    name: 'getMyTickets',
    description: 'The signed-in member\'s own support tickets and their status.',
    params: {},
    allowed: always,
    async run(c) {
      const where = { memberId: c.memberId };
      const [total, rows] = await Promise.all([
        c.prisma.helpdeskTicket.count({ where }),
        c.prisma.helpdeskTicket.findMany({ where, take: 20, orderBy: { createdAt: 'desc' }, select: { displayNumber: true, subject: true, status: true, createdAt: true, adminRepliedAt: true } }),
      ]);
      return listed(rows.map((t) => ({ ticket: t.displayNumber, subject: t.subject, status: t.status, created: ist(t.createdAt), lastTeamReply: ist(t.adminRepliedAt) })), total);
    },
  },
  {
    name: 'searchHelp',
    description: 'Search the TBT help questions and answers. Use for "how do I…" questions.',
    params: { query: { type: 'string', required: true, maxLength: 100, description: 'One or two key words, e.g. "certificate".' } },
    allowed: always,
    async run(c, a) {
      const like = `%${String(a.query).replace(/[\\%_]/g, '\\$&')}%`;
      const rows = await c.prisma.$queryRawUnsafe<Array<{ question: string; answer: string }>>(
        `SELECT question, LEFT(answer, 1500) AS answer FROM (
           SELECT question, answer FROM helpdesk_faqs WHERE status = 'active'
           UNION ALL SELECT question, answer_text FROM course_page_faqs WHERE is_active AND answer_type = 'text' AND answer_text IS NOT NULL
           UNION ALL SELECT question, answer FROM module_faqs WHERE is_published
         ) f WHERE question ILIKE $1 OR answer ILIKE $1
         ORDER BY (question ILIKE $1) DESC, question LIMIT 8`, like);
      return listed(rows, rows.length);
    },
  },
];
