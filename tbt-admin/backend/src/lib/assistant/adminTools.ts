/**
 * Admin chatbot tools (read-only). Totals come from the same queries as the
 * Insights page, so the chatbot and the dashboard always agree.
 *
 * Access:
 *  - super_admin / admin: everything.
 *  - account_manager / mentor: only members assigned to them, tickets assigned
 *    to them or raised by those members, and calls they host. No revenue,
 *    batch-wide or course-wide figures. (Same scope as My Workspace.)
 *  - moderator: support tickets only.
 * Phone numbers, emails, addresses, KYC, notes and message text are never
 * returned: results are sent to an outside AI service.
 */
import type { Prisma, PrismaClient } from '@prisma/client';
import { resolveRange, type DateRange } from '../insights/insightsLogic.js';
import { loadCourses, loadMentorship, loadOverview, loadRevenue, loadRiskMembers, loadSupport } from '../insights/insightsQueries.js';
import { buildMemberSearchWhere } from '../memberSearch.js';
import { OPEN_TICKET_STATUSES, isTicketOverdue } from '../myWorkspaceLogic.js';
import { ToolError, fullName, ist, listed, type AssistantTool, type ParamSpec, type ToolArgs } from './registry.js';

export interface AdminToolCtx {
  prisma: PrismaClient;
  now: Date;
  admin: { id: string; role: string };
}

const FULL = new Set(['super_admin', 'admin']);
const SCOPED = new Set(['account_manager', 'mentor']);
const isFull = (c: AdminToolCtx) => FULL.has(c.admin.role);
const canSeeMembers = (c: AdminToolCtx) => isFull(c) || SCOPED.has(c.admin.role);
const canSeeTickets = (c: AdminToolCtx) => canSeeMembers(c) || c.admin.role === 'moderator';

/** The members this admin may ask about. Every member query starts from this. */
export function memberScope(c: AdminToolCtx): Prisma.MemberWhereInput {
  return isFull(c) ? { deletedAt: null } : { deletedAt: null, accountManagerId: c.admin.id };
}

const LIMIT: ParamSpec = { type: 'integer', min: 1, max: 50, description: 'How many rows to list (default 20). The total is always returned too.' };
const limitOf = (a: ToolArgs) => Number(a.limit ?? 20);
const MEMBER_REF: ParamSpec = { type: 'string', required: true, maxLength: 60, description: 'The member\'s "id" from searchMembers, or their TBT member code.' };
const BATCH: ParamSpec = { type: 'string', maxLength: 100, description: 'Batch name or part of it, e.g. "Batch 55".' };
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const RANGE: Record<string, ParamSpec> = {
  from: { type: 'string', pattern: DATE_RE, description: 'First day, IST, YYYY-MM-DD. Give both from and to, or neither for the last 30 days.' },
  to: { type: 'string', pattern: DATE_RE, description: 'Last day (inclusive), IST, YYYY-MM-DD.' },
};
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function rangeOf(c: AdminToolCtx, a: ToolArgs): DateRange {
  if (!!a.from !== !!a.to) throw new ToolError('Give both "from" and "to", or neither.');
  const r = resolveRange(a.from ? { range: 'custom', from: a.from, to: a.to } : {}, c.now);
  if (!r.ok) throw new ToolError(r.error);
  return r.range;
}
const period = (r: DateRange) => ({ from: r.from, to: r.to, timezone: 'IST' });

async function findMember(c: AdminToolCtx, ref: string) {
  const m = await c.prisma.member.findFirst({
    where: {
      AND: [memberScope(c), UUID_RE.test(ref) ? { id: ref } : { memberId: { equals: ref, mode: 'insensitive' } }],
    },
    select: {
      id: true, memberId: true, firstName: true, lastName: true, businessName: true, businessType: true,
      city: true, state: true, membershipPlan: true, status: true, verificationStatus: true,
      createdAt: true, lastActiveAt: true, batchId: true,
      batch: { select: { name: true, startsAt: true, snapshotDays: true, program: { select: { name: true, durationDays: true } } } },
      accountManager: { select: { fullName: true } },
    },
  });
  if (!m) throw new ToolError('No such member, or you do not have access to them. Use searchMembers first.');
  return m;
}

async function findBatch(c: AdminToolCtx, name: string) {
  const select = {
    id: true, name: true, startsAt: true, endsAt: true, isActive: true, snapshotDays: true,
    program: { select: { name: true, durationDays: true } },
  } as const;
  const exact = await c.prisma.batch.findMany({ where: { name: { equals: name, mode: 'insensitive' } }, select, take: 6 });
  const found = exact.length ? exact : await c.prisma.batch.findMany({ where: { name: { contains: name, mode: 'insensitive' } }, select, take: 6 });
  if (found.length === 0) throw new ToolError(`No batch matches "${name}". Use listBatches to see the names.`);
  if (found.length > 1) throw new ToolError(`More than one batch matches "${name}": ${found.map((b) => b.name).join(', ')}. Ask which one.`);
  return found[0];
}

/** Day 1 = start date; before the start → 0; never past the programme's length. */
export function batchDay(startsAt: Date, totalDays: number | null, now: Date): number {
  const istDayNo = (d: Date) => Math.floor((d.getTime() + 5.5 * 3600_000) / 86_400_000);
  const day = istDayNo(now) - istDayNo(startsAt) + 1;
  return Math.max(0, totalDays ? Math.min(day, totalDays) : day);
}

const MEMBER_STATUSES = ['active', 'inactive', 'paused', 'suspended', 'pending'] as const;

export const adminTools: AssistantTool<AdminToolCtx>[] = [
  {
    name: 'searchMembers',
    description: 'Find members by name, TBT member code, phone, email or business name, and/or by status or batch, and count them. Use this first whenever a person is named. If several match, ask which one is meant.',
    params: {
      search: { type: 'string', maxLength: 100, description: 'Name, member code, phone, email or business name.' },
      status: { type: 'string', enum: MEMBER_STATUSES, description: 'Only members with this account status.' },
      batch: BATCH,
      sort: { type: 'string', enum: ['name', 'newest', 'oldest', 'recently_active'], description: 'newest/oldest = by joining date. Default name.' },
      limit: LIMIT,
    },
    allowed: canSeeMembers,
    async run(c, a) {
      const and: Prisma.MemberWhereInput[] = [memberScope(c)];
      const s = buildMemberSearchWhere(a.search);
      if (s) and.push(s as Prisma.MemberWhereInput);
      if (a.status) and.push({ status: a.status as (typeof MEMBER_STATUSES)[number] });
      if (a.batch) and.push({ batchId: (await findBatch(c, String(a.batch))).id });
      const where = { AND: and };
      const [total, rows] = await Promise.all([
        c.prisma.member.count({ where }),
        c.prisma.member.findMany({
          where, take: limitOf(a),
          orderBy: [
            a.sort === 'newest' ? { createdAt: 'desc' }
              : a.sort === 'oldest' ? { createdAt: 'asc' }
                : a.sort === 'recently_active' ? { lastActiveAt: { sort: 'desc', nulls: 'last' } }
                  : { firstName: 'asc' },
            { id: 'asc' },
          ],
          select: { id: true, memberId: true, firstName: true, lastName: true, status: true, membershipPlan: true, createdAt: true, lastActiveAt: true, batch: { select: { name: true } } },
        }),
      ]);
      return listed(rows.map((m) => ({
        id: m.id, memberCode: m.memberId, name: fullName(m), status: m.status, plan: m.membershipPlan,
        batch: m.batch?.name ?? null, joined: ist(m.createdAt), lastActive: ist(m.lastActiveAt),
      })), total);
    },
  },
  {
    name: 'getMemberDetails',
    description: 'One member\'s plan, status, batch, business, joining date, account manager, course access and last activity.',
    params: { member: MEMBER_REF },
    allowed: canSeeMembers,
    async run(c, a) {
      const m = await findMember(c, String(a.member));
      const access = await c.prisma.courseAccess.findMany({
        where: { memberId: m.id, isActive: true, OR: [{ expiresAt: null }, { expiresAt: { gt: c.now } }] },
        select: { accessType: true, expiresAt: true, course: { select: { title: true } } },
        take: 50,
      });
      return {
        memberCode: m.memberId, name: fullName(m), status: m.status, verification: m.verificationStatus,
        plan: m.membershipPlan, batch: m.batch?.name ?? null, program: m.batch?.program?.name ?? null,
        business: m.businessName, businessType: m.businessType, city: m.city, state: m.state,
        accountManager: m.accountManager?.fullName ?? null, joined: ist(m.createdAt), lastActive: ist(m.lastActiveAt),
        courseAccess: access.map((x) => ({ course: x.course.title, type: x.accessType, expires: ist(x.expiresAt) })),
      };
    },
  },
  {
    name: 'getMemberProgress',
    description: 'One member\'s programme progress (days approved, waiting for approval, rejected, attendance) and course progress.',
    params: { member: MEMBER_REF },
    allowed: canSeeMembers,
    async run(c, a) {
      const m = await findMember(c, String(a.member));
      return { member: fullName(m), memberCode: m.memberId, ...(await loadProgress(c.prisma, c.now, m.id, m.batchId)) };
    },
  },
  {
    name: 'listBatches',
    description: 'All batches with start date, current programme day and member count.',
    params: {},
    allowed: isFull,
    async run(c) {
      const rows = await c.prisma.batch.findMany({
        orderBy: { startsAt: 'desc' }, take: 100,
        select: {
          name: true, startsAt: true, isActive: true, snapshotDays: true, program: { select: { name: true, durationDays: true } },
          _count: { select: { members: { where: { deletedAt: null } } } },
        },
      });
      return listed(rows.map((b) => {
        const totalDays = b.snapshotDays ?? b.program?.durationDays ?? null;
        return { name: b.name, program: b.program?.name ?? null, starts: ist(b.startsAt), active: b.isActive, currentDay: batchDay(b.startsAt, totalDays, c.now), totalDays, members: b._count.members };
      }), await c.prisma.batch.count());
    },
  },
  {
    name: 'getBatchSummary',
    description: 'One batch: start date, current day, members by status, days approved / waiting / rejected, and who was inactive for 7+ days (count).',
    params: { batch: { ...BATCH, required: true } },
    allowed: isFull,
    async run(c, a) {
      const b = await findBatch(c, String(a.batch));
      const totalDays = b.snapshotDays ?? b.program?.durationDays ?? null;
      const inBatch = { batchId: b.id, deletedAt: null };
      const weekAgo = new Date(c.now.getTime() - 7 * 86_400_000);
      const [byStatus, days, inactive] = await Promise.all([
        c.prisma.member.groupBy({ by: ['status'], where: inBatch, _count: { _all: true } }),
        c.prisma.memberDayProgress.groupBy({ by: ['status'], where: { batchId: b.id, member: inBatch }, _count: { _all: true } }),
        c.prisma.member.count({ where: { ...inBatch, status: 'active', OR: [{ lastActiveAt: null }, { lastActiveAt: { lt: weekAgo } }] } }),
      ]);
      return {
        batch: b.name, program: b.program?.name ?? null, starts: ist(b.startsAt), ends: ist(b.endsAt), active: b.isActive,
        currentDay: batchDay(b.startsAt, totalDays, c.now), totalDays,
        membersByStatus: Object.fromEntries(byStatus.map((x) => [x.status, x._count._all])),
        memberDaysByStatus: Object.fromEntries(days.map((x) => [x.status, x._count._all])),
        activeMembersInactive7Days: inactive,
        note: 'memberDaysByStatus counts one per member per day.',
      };
    },
  },
  {
    name: 'getPendingSubmissions',
    description: 'Programme day submissions waiting for approval, oldest first.',
    params: { batch: BATCH, limit: LIMIT },
    allowed: canSeeMembers,
    async run(c, a) {
      const where: Prisma.MemberDayProgressWhereInput = {
        status: 'pending_approval', member: memberScope(c),
        ...(a.batch ? { batchId: (await findBatch(c, String(a.batch))).id } : {}),
      };
      const [total, rows] = await Promise.all([
        c.prisma.memberDayProgress.count({ where }),
        c.prisma.memberDayProgress.findMany({
          where, take: limitOf(a), orderBy: { submittedAt: 'asc' },
          select: { dayNumber: true, submittedAt: true, batch: { select: { name: true } }, member: { select: { memberId: true, firstName: true, lastName: true } } },
        }),
      ]);
      return listed(rows.map((r) => ({ member: fullName(r.member), memberCode: r.member.memberId, batch: r.batch.name, day: r.dayNumber, submitted: ist(r.submittedAt) })), total);
    },
  },
  {
    name: 'getInactiveMembers',
    description: 'Active-status members with no activity for at least N days (including never active), longest idle first.',
    params: {
      days: { type: 'integer', min: 1, max: 365, description: 'Days without activity (default 7).' },
      batch: BATCH,
      limit: LIMIT,
    },
    allowed: canSeeMembers,
    async run(c, a) {
      const days = Number(a.days ?? 7);
      const since = new Date(c.now.getTime() - days * 86_400_000);
      const where: Prisma.MemberWhereInput = {
        AND: [
          memberScope(c),
          { status: 'active', OR: [{ lastActiveAt: null }, { lastActiveAt: { lt: since } }] },
          ...(a.batch ? [{ batchId: (await findBatch(c, String(a.batch))).id }] : []),
        ],
      };
      const [total, rows] = await Promise.all([
        c.prisma.member.count({ where }),
        c.prisma.member.findMany({
          where, take: limitOf(a), orderBy: { lastActiveAt: { sort: 'asc', nulls: 'first' } },
          select: { id: true, memberId: true, firstName: true, lastName: true, lastActiveAt: true, batch: { select: { name: true } } },
        }),
      ]);
      return { days, ...listed(rows.map((m) => ({ id: m.id, memberCode: m.memberId, name: fullName(m), batch: m.batch?.name ?? null, lastActive: ist(m.lastActiveAt) ?? 'never' })), total) };
    },
  },
  {
    name: 'getAtRiskMembers',
    description: 'Members most likely to drop out, with a 0-100 risk score and the reasons (same score as the Insights page).',
    params: { level: { type: 'string', enum: ['high', 'medium'], description: 'Only this risk level (default: both).' }, limit: LIMIT },
    allowed: canSeeMembers,
    async run(c, a) {
      let rows = (await loadRiskMembers(c.prisma as any, c.now)).filter((m) => (a.level ? m.level === a.level : m.level !== 'low'));
      if (!isFull(c)) {
        const mine = new Set((await c.prisma.member.findMany({ where: memberScope(c), select: { id: true } })).map((m) => m.id));
        rows = rows.filter((m) => mine.has(m.id));
      }
      return listed(rows.slice(0, limitOf(a)).map((m) => ({ id: m.id, name: m.name, batch: m.batch, plan: m.plan, score: m.score, level: m.level, reasons: m.reasons, lastActive: ist(m.lastActiveAt) ?? 'never' })), rows.length);
    },
  },
  {
    name: 'getOverview',
    description: 'Headline figures for a period against the period before it: revenue, new members, active members, lessons completed and more.',
    params: RANGE,
    allowed: isFull,
    async run(c, a) {
      const r = rangeOf(c, a);
      const o = await loadOverview(c.prisma as any, r, c.now);
      return { period: period(r), comparedWith: { from: r.prevFrom, to: r.prevTo }, figures: o.kpis, stickiness: o.stickiness };
    },
  },
  {
    name: 'getRevenueSummary',
    description: 'Money received in a period, in INR, by source (course payments, coin orders, support credits), by method and by course, plus refunds, failures and payments pending now. Revenue means completed course payments + paid coin orders + approved credit purchases; refunded payments are not counted.',
    params: RANGE,
    allowed: isFull,
    async run(c, a) {
      const r = rangeOf(c, a);
      const x = await loadRevenue(c.prisma as any, r);
      const total = (k: 'revenue' | 'revenuePrev') => Math.round(x.bySource.reduce((s, b) => s + b[k], 0) * 100) / 100;
      return {
        period: period(r), currency: 'INR', totalRevenue: total('revenue'), previousPeriodRevenue: total('revenuePrev'),
        previousPeriod: { from: r.prevFrom, to: r.prevTo },
        bySource: x.bySource, coursePaymentsByMethod: x.byMethod,
        topCourses: x.byCourse.map(({ title, count, amount }) => ({ title, count, amount })),
        buyers: x.buyers, refunds: x.refunds, failed: x.failed, pendingNow: x.pending,
        courseAccessExpiringIn30Days: x.expiringSoon.length, courseAccessExpiredLast30Days: x.expiredLast30Days,
      };
    },
  },
  {
    name: 'getCourseAnalytics',
    description: 'Each course: enrolments, completions, completion rate, active learners, lessons completed, revenue and rating. Enrolled / completed / rate / buyers / revenueAllTime are all-time; the "InPeriod" figures are for the period.',
    params: {
      course: { type: 'string', maxLength: 100, description: 'Only courses whose title contains this.' },
      sortBy: { type: 'string', enum: ['enrolled', 'lowest_completion', 'highest_completion', 'revenue'], description: 'Order (default enrolled).' },
      limit: LIMIT,
      ...RANGE,
    },
    allowed: isFull,
    async run(c, a) {
      const r = rangeOf(c, a);
      const q = String(a.course ?? '').toLowerCase();
      const rows = (await loadCourses(c.prisma as any, r)).filter((x) => !q || String(x.title).toLowerCase().includes(q));
      const rate = (x: (typeof rows)[number], none: number) => x.completionRate ?? none;
      if (a.sortBy === 'lowest_completion') rows.sort((x, y) => rate(x, 101) - rate(y, 101));
      else if (a.sortBy === 'highest_completion') rows.sort((x, y) => rate(y, -1) - rate(x, -1));
      else if (a.sortBy === 'revenue') rows.sort((x, y) => y.revenueInRange - x.revenueInRange);
      return {
        period: period(r),
        ...listed(rows.slice(0, limitOf(a)).map((x) => ({
          title: x.title, type: x.courseType, module: x.module, published: x.isPublished, lessons: x.lessons,
          enrolled: x.enrolled, completed: x.completed, completionRatePercent: x.completionRate, medianDaysToComplete: x.medianDaysToComplete,
          buyers: x.buyers, revenueAllTime: x.revenueAll, avgRatingOutOf10: x.avgRating, ratings: x.ratings,
          enrolledInPeriod: x.enrolledInRange, activeLearnersInPeriod: x.activeLearners, lessonsCompletedInPeriod: x.lessonsCompleted, revenueInPeriod: x.revenueInRange,
        })), rows.length),
      };
    },
  },
  {
    name: 'getMemberBusinessRevenue',
    description: 'Revenue the members report for THEIR OWN businesses (self-reported weekly), by week and batch. This is not TBT\'s income — use getRevenueSummary for that.',
    params: RANGE,
    allowed: isFull,
    async run(c, a) {
      const r = rangeOf(c, a);
      const x = await loadMentorship(c.prisma as any, r);
      return { period: period(r), currency: 'INR', summary: x.summary, weekly: x.weekly, byBatch: x.byBatch, topImprovers: x.topImprovers.map(({ id: _id, ...t }) => t), totalRevenueBuckets: x.totalRevenueBuckets };
    },
  },
  {
    name: 'getSupportTickets',
    description: 'Helpdesk tickets: subject, status, priority, who is assigned and whether overdue. "open" means not resolved or closed.',
    params: {
      status: { type: 'string', enum: ['open', 'overdue', 'unassigned', 'resolved', 'all'], description: 'Which tickets (default open). unassigned = open with nobody assigned.' },
      priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'], description: 'Only this priority.' },
      limit: LIMIT,
    },
    allowed: canSeeTickets,
    async run(c, a) {
      const open = { status: { in: [...OPEN_TICKET_STATUSES] as string[] } };
      const want = a.status ?? 'open';
      const and: Prisma.HelpdeskTicketWhereInput[] = [];
      if (SCOPED.has(c.admin.role)) and.push({ OR: [{ assignedTo: c.admin.id }, { member: memberScope(c) }] });
      if (want === 'open') and.push(open);
      else if (want === 'overdue') and.push(open, { resolveDeadline: { lt: c.now } });
      else if (want === 'unassigned') and.push(open, { assignedTo: null });
      else if (want === 'resolved') and.push({ status: { in: ['resolved', 'closed'] } });
      if (a.priority) and.push({ priority: String(a.priority) });
      const where = { AND: and };
      const [total, byPriority, unassigned, rows] = await Promise.all([
        c.prisma.helpdeskTicket.count({ where }),
        c.prisma.helpdeskTicket.groupBy({ by: ['priority'], where, _count: { _all: true } }),
        c.prisma.helpdeskTicket.count({ where: { AND: [...and, { assignedTo: null }] } }),
        c.prisma.helpdeskTicket.findMany({
          where, take: limitOf(a), orderBy: { createdAt: 'desc' },
          select: {
            displayNumber: true, subject: true, status: true, priority: true, createdAt: true, resolveDeadline: true, resolvedAt: true,
            category: { select: { name: true } }, assignedToAdmin: { select: { fullName: true } }, member: { select: { firstName: true, lastName: true } },
          },
        }),
      ]);
      return { showingStatus: want, totalByPriority: Object.fromEntries(byPriority.map((p) => [p.priority, p._count._all])), totalUnassigned: unassigned, ...listed(rows.map((t) => ({
        ticket: t.displayNumber, subject: t.subject, category: t.category?.name ?? null, member: fullName(t.member),
        status: t.status, priority: t.priority, assignedTo: t.assignedToAdmin?.fullName ?? null,
        created: ist(t.createdAt), overdue: isTicketOverdue(t, c.now), resolved: ist(t.resolvedAt),
      })), total) };
    },
  },
  {
    name: 'getSupportStats',
    description: 'Support workload in a period: tickets created / resolved, response times, and support-call bookings, attendance and no-shows by category and host.',
    params: RANGE,
    allowed: isFull,
    async run(c, a) {
      const r = rangeOf(c, a);
      const x = await loadSupport(c.prisma as any, r);
      return { period: period(r), tickets: x.tickets, calls: x.calls, usageByPlan: x.usageByPlan };
    },
  },
  {
    name: 'getSupportCalls',
    description: 'Scheduled expert support calls and 1:1 calls between two IST dates (default: today), with host and booking counts.',
    params: RANGE,
    allowed: canSeeMembers,
    async run(c, a) {
      if (!!a.from !== !!a.to) throw new ToolError('Give both "from" and "to", or neither for today.');
      const today = new Date(c.now.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);
      const from = String(a.from ?? today);
      const to = String(a.to ?? today);
      const start = Date.parse(`${from}T00:00:00+05:30`);
      const end = Date.parse(`${to}T00:00:00+05:30`) + 86_400_000;
      if (!(start < end) || end - start > 93 * 86_400_000) throw new ToolError('Pick valid dates, at most 93 days apart.');
      const rows = await c.prisma.$queryRawUnsafe<any[]>(
        `SELECT s.title, s.category, s.status, s.starts_at, s.duration_minutes, s.capacity,
                COALESCE(NULLIF(TRIM(a.full_name), ''), s.host_name) AS host,
                (SELECT COUNT(*)::int FROM support_call_bookings b WHERE b.session_id = s.id AND b.status <> 'cancelled') AS booked,
                COUNT(*) OVER()::int AS total
           FROM support_call_sessions s LEFT JOIN admins a ON a.id = s.host_admin_id
          WHERE s.starts_at >= $1::timestamptz AND s.starts_at < $2::timestamptz AND s.status <> 'cancelled'
            AND ($3::uuid IS NULL OR s.host_admin_id = $3::uuid)
          ORDER BY s.starts_at LIMIT 50`,
        new Date(start), new Date(end), isFull(c) ? null : c.admin.id,
      );
      return { period: { from, to, timezone: 'IST' }, ...listed(rows.map((r) => ({
        title: r.title, category: r.category, status: r.status, starts: ist(r.starts_at), minutes: Number(r.duration_minutes),
        host: r.host ?? null, booked: Number(r.booked), capacity: Number(r.capacity),
      })), Number(rows[0]?.total ?? 0)) };
    },
  },
];

/** Programme + course progress for one member — shared by the admin and member tools. */
export async function loadProgress(prisma: PrismaClient, now: Date, memberId: string, batchId: string | null) {
  const [batch, days, present, settings, enrollments] = await Promise.all([
    batchId
      ? prisma.batch.findUnique({ where: { id: batchId }, select: { name: true, startsAt: true, snapshotDays: true, program: { select: { name: true, durationDays: true } } } })
      : null,
    batchId ? prisma.memberDayProgress.findMany({ where: { memberId, batchId }, select: { dayNumber: true, status: true }, orderBy: { dayNumber: 'asc' } }) : [],
    batchId ? prisma.memberAttendance.count({ where: { memberId, batchId, status: 'present' } }) : 0,
    batchId
      ? prisma.$queryRawUnsafe<Array<{ extended_days: number | null }>>(
          `SELECT extended_days FROM member_batch_settings WHERE batch_id = $1::uuid AND member_id = $2::uuid LIMIT 1`, batchId, memberId)
      : [],
    prisma.courseEnrollment.findMany({
      where: { memberId }, take: 50, orderBy: { enrolledAt: 'desc' },
      select: { progressPercentage: true, enrolledAt: true, completedAt: true, course: { select: { title: true } } },
    }),
  ]);
  const of = (s: string) => days.filter((d) => d.status === s).map((d) => d.dayNumber);
  const totalDays = batch ? (batch.snapshotDays ?? batch.program?.durationDays ?? 90) + Number(settings[0]?.extended_days ?? 0) : null;
  return {
    program: batch && {
      batch: batch.name, program: batch.program?.name ?? null, starts: ist(batch.startsAt),
      currentDay: batchDay(batch.startsAt, totalDays, now), totalDays,
      daysApproved: of('approved').length, daysWaitingForApproval: of('pending_approval'), daysRejected: of('rejected'),
      daysAttended: present,
    },
    courses: enrollments.map((e) => ({ course: e.course.title, progressPercent: e.progressPercentage, enrolled: ist(e.enrolledAt), completed: ist(e.completedAt) })),
  };
}
