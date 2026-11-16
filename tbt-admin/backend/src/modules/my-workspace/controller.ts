import type { FastifyReply, FastifyRequest } from 'fastify';
import { getActingAdmin } from '../../lib/adminRole.js';
import {
  CLOSED_TICKET_STATUSES,
  INACTIVE_FOLLOW_UP_DAYS,
  OPEN_TICKET_STATUSES,
  buildPendingWork,
  callWhen,
  isTicketOverdue,
  parsePaging,
  type CallWhen,
} from '../../lib/myWorkspaceLogic.js';

// "My Workspace": everything is scoped to the logged-in admin's own DB row
// (Clerk sub → admins.clerk_id). The existing all-data admin pages are
// untouched; these endpoints only ever return rows mapped to this admin:
//   members  → members.account_manager_id
//   tickets  → helpdesk_tickets.assigned_to, or raised by one of my members
//   calls    → support_call_sessions.host_admin_id, onboarding_meetings.host_admin_id
//   team     → admins.reporting_manager_id

type Req = FastifyRequest<{ Querystring: Record<string, string | undefined> }>;

async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  const admin = await getActingAdmin(req);
  if (!admin) {
    reply.status(403).send({ success: false, data: null, error: 'Admin account not found' });
    return null;
  }
  return admin;
}

const inactiveSince = () => new Date(Date.now() - INACTIVE_FOLLOW_UP_DAYS * 24 * 60 * 60 * 1000);

function myMembersWhere(adminId: string) {
  return { accountManagerId: adminId, deletedAt: null } as const;
}

/** Members idle for the follow-up window (never active counts as idle). */
function inactiveFilter() {
  return { status: 'active' as const, OR: [{ lastActiveAt: null }, { lastActiveAt: { lt: inactiveSince() } }] };
}

const openStatuses = [...OPEN_TICKET_STATUSES] as string[];

// ── Calls (raw SQL tables, no Prisma model) ────────────────────────────────

interface CallRow {
  id: string;
  kind: 'support_call' | 'onboarding';
  title: string;
  category: string | null;
  status: string;
  starts_at: Date;
  duration_minutes: number;
  capacity: number | null;
  booked: number | null;
  member_id: string | null;
  member_name: string | null;
}

async function loadMyCalls(req: FastifyRequest, adminId: string): Promise<CallRow[]> {
  const prisma = req.server.prisma;
  // Last 30 days + everything ahead: enough for today/upcoming and recent history.
  const [support, onboarding] = await Promise.all([
    prisma.$queryRawUnsafe<CallRow[]>(
      `SELECT s.id::text AS id, 'support_call' AS kind, s.title, s.category, s.status,
              s.starts_at, s.duration_minutes, s.capacity,
              (SELECT COUNT(*)::int FROM support_call_bookings b WHERE b.session_id = s.id AND b.status <> 'cancelled') AS booked,
              NULL::text AS member_id, NULL::text AS member_name
         FROM support_call_sessions s
        WHERE s.host_admin_id = $1::uuid AND s.starts_at > NOW() - INTERVAL '30 days'
        ORDER BY s.starts_at`,
      adminId,
    ).catch((err: any) => { req.log.warn({ err: err?.message }, 'my-workspace: support calls query failed'); return []; }),
    prisma.$queryRawUnsafe<CallRow[]>(
      `SELECT m.id::text AS id, 'onboarding' AS kind, m.title, NULL AS category, m.status,
              m.scheduled_at AS starts_at, m.duration_minutes, NULL::int AS capacity, NULL::int AS booked,
              mem.id::text AS member_id,
              TRIM(CONCAT(mem.first_name, ' ', COALESCE(mem.last_name, ''))) AS member_name
         FROM onboarding_meetings m
         LEFT JOIN members mem ON mem.id = m.member_id
        WHERE m.host_admin_id = $1::uuid AND m.scheduled_at > NOW() - INTERVAL '30 days'
        ORDER BY m.scheduled_at`,
      adminId,
    ).catch((err: any) => { req.log.warn({ err: err?.message }, 'my-workspace: onboarding calls query failed'); return []; }),
  ]);
  return [...support, ...onboarding].sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
}

// ── GET /api/my-workspace/summary ──────────────────────────────────────────

export async function summaryHandler(req: Req, reply: FastifyReply) {
  const admin = await requireAdmin(req, reply);
  if (!admin) return;
  const prisma = req.server.prisma;
  const now = new Date();
  const mine = myMembersWhere(admin.id);

  const [
    membersTotal, membersActive, membersInactive, membersUnderReview,
    assignedOpen, memberTicketsOpen, memberTicketsUnassigned, team, calls,
  ] = await Promise.all([
    prisma.member.count({ where: mine }),
    prisma.member.count({ where: { ...mine, status: 'active' } }),
    prisma.member.count({ where: { ...mine, ...inactiveFilter() } }),
    prisma.member.count({ where: { ...mine, verificationStatus: 'under_review' } }),
    prisma.helpdeskTicket.findMany({
      where: { assignedTo: admin.id, status: { in: openStatuses } },
      select: { status: true, resolveDeadline: true },
    }),
    prisma.helpdeskTicket.count({ where: { member: mine, status: { in: openStatuses } } }),
    prisma.helpdeskTicket.count({ where: { member: mine, status: { in: openStatuses }, assignedTo: null } }),
    prisma.admin.count({ where: { reportingManagerId: admin.id, deletedAt: null } }),
    loadMyCalls(req, admin.id),
  ]);

  const buckets = { today: 0, upcoming: 0, past: 0 } as Record<CallWhen, number>;
  for (const c of calls) {
    buckets[callWhen({ startsAt: new Date(c.starts_at), durationMinutes: c.duration_minutes, status: c.status }, now)]++;
  }

  const counts = {
    ticketsNew: assignedOpen.filter((t) => t.status === 'new').length,
    ticketsOverdue: assignedOpen.filter((t) => isTicketOverdue(t, now)).length,
    ticketsOpen: assignedOpen.length,
    memberTicketsUnassigned,
    membersUnderReview,
    membersInactive,
    callsToday: buckets.today,
  };

  return reply.send({
    success: true,
    data: {
      admin: { id: admin.id, fullName: admin.fullName, role: admin.role },
      counts: {
        ...counts,
        membersTotal,
        membersActive,
        memberTicketsOpen,
        callsUpcoming: buckets.upcoming,
        team,
      },
      pending: buildPendingWork(counts),
      inactiveDays: INACTIVE_FOLLOW_UP_DAYS,
    },
  });
}

// ── GET /api/my-workspace/members?filter=all|active|inactive|under_review|pending&search= ──

export async function membersHandler(req: Req, reply: FastifyReply) {
  const admin = await requireAdmin(req, reply);
  if (!admin) return;
  const { page, limit, skip } = parsePaging(req.query);
  const filter = req.query.filter ?? 'all';
  const search = (req.query.search ?? '').trim();

  const where: any = { ...myMembersWhere(admin.id) };
  if (filter === 'active') where.status = 'active';
  else if (filter === 'pending') where.status = 'pending';
  else if (filter === 'under_review') where.verificationStatus = 'under_review';
  else if (filter === 'inactive') Object.assign(where, inactiveFilter());
  if (search) {
    const and = [{
      OR: [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { memberId: { contains: search, mode: 'insensitive' } },
        { businessName: { contains: search, mode: 'insensitive' } },
      ],
    }];
    // inactiveFilter() already uses OR — combine through AND so neither is lost.
    where.AND = and;
  }

  const prisma = req.server.prisma;
  const [rows, total] = await Promise.all([
    prisma.member.findMany({
      where,
      select: {
        id: true, memberId: true, firstName: true, lastName: true, email: true, phone: true,
        businessName: true, profilePhotoUrl: true, status: true, verificationStatus: true,
        membershipPlan: true, lastActiveAt: true, createdAt: true,
        batch: { select: { id: true, name: true } },
      },
      orderBy: [{ lastActiveAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
      skip,
      take: limit,
    }),
    prisma.member.count({ where }),
  ]);

  // Open tickets per listed member, one query.
  const ids = rows.map((r) => r.id);
  const ticketCounts = ids.length
    ? await prisma.helpdeskTicket.groupBy({
        by: ['memberId'],
        where: { memberId: { in: ids }, status: { in: openStatuses } },
        _count: { _all: true },
      })
    : [];
  const openByMember = new Map(ticketCounts.map((t: any) => [t.memberId, t._count._all]));

  return reply.send({
    success: true,
    data: rows.map((r) => ({ ...r, openTickets: openByMember.get(r.id) ?? 0 })),
    meta: { total, page, limit },
  });
}

// ── GET /api/my-workspace/tickets?scope=assigned|my_members|all&status=open|new|overdue|unassigned|closed|all ──

export async function ticketsHandler(req: Req, reply: FastifyReply) {
  const admin = await requireAdmin(req, reply);
  if (!admin) return;
  const { page, limit, skip } = parsePaging(req.query);
  const scope = req.query.scope ?? 'all';
  const status = req.query.status ?? 'open';
  const now = new Date();

  const assigned = { assignedTo: admin.id };
  const fromMyMembers = { member: myMembersWhere(admin.id) };
  const scopeWhere =
    scope === 'assigned' ? assigned
      : scope === 'my_members' ? fromMyMembers
        : { OR: [assigned, fromMyMembers] };

  const statusWhere: any =
    status === 'all' ? {}
      : status === 'closed' ? { status: { in: [...CLOSED_TICKET_STATUSES] } }
        : status === 'new' ? { status: 'new' }
          : status === 'overdue' ? { status: { in: openStatuses }, resolveDeadline: { lt: now } }
            : status === 'unassigned' ? { status: { in: openStatuses }, assignedTo: null }
              : { status: { in: openStatuses } };

  const where: any = { AND: [scopeWhere, statusWhere] };
  const prisma = req.server.prisma;
  const [rows, total] = await Promise.all([
    prisma.helpdeskTicket.findMany({
      where,
      select: {
        id: true, displayNumber: true, subject: true, name: true, status: true, priority: true,
        createdAt: true, updatedAt: true, resolveDeadline: true, assignedTo: true, memberId: true,
        member: { select: { id: true, firstName: true, lastName: true, accountManagerId: true } },
        assignedToAdmin: { select: { id: true, fullName: true } },
        category: { select: { name: true } },
      },
      orderBy: [{ createdAt: 'desc' }],
      skip,
      take: limit,
    }),
    prisma.helpdeskTicket.count({ where }),
  ]);

  return reply.send({
    success: true,
    data: rows.map((t: any) => ({
      ...t,
      overdue: isTicketOverdue(t, now),
      assignedToMe: t.assignedTo === admin.id,
      fromMyMember: t.member?.accountManagerId === admin.id,
    })),
    meta: { total, page, limit },
  });
}

// ── GET /api/my-workspace/calls?when=today|upcoming|past|all ──────────────

export async function callsHandler(req: Req, reply: FastifyReply) {
  const admin = await requireAdmin(req, reply);
  if (!admin) return;
  const when = req.query.when ?? 'all';
  const now = new Date();
  const calls = (await loadMyCalls(req, admin.id)).map((c) => ({
    id: c.id,
    kind: c.kind,
    title: c.title,
    category: c.category,
    status: c.status,
    startsAt: new Date(c.starts_at).toISOString(),
    durationMinutes: c.duration_minutes,
    capacity: c.capacity,
    booked: c.booked,
    memberId: c.member_id,
    memberName: c.member_name,
    when: callWhen({ startsAt: new Date(c.starts_at), durationMinutes: c.duration_minutes, status: c.status }, now),
  }));
  const list = when === 'all' ? calls : calls.filter((c) => c.when === when);
  // Past calls read most recent first.
  if (when === 'past') list.reverse();
  return reply.send({ success: true, data: list, meta: { total: list.length } });
}

// ── GET /api/my-workspace/team ────────────────────────────────────────────

export async function teamHandler(req: Req, reply: FastifyReply) {
  const admin = await requireAdmin(req, reply);
  if (!admin) return;
  const prisma = req.server.prisma;
  const team = await prisma.admin.findMany({
    where: { reportingManagerId: admin.id, deletedAt: null },
    select: {
      id: true, fullName: true, email: true, role: true, designation: true, department: true,
      status: true, profilePhotoUrl: true, lastLoginAt: true,
    },
    orderBy: { fullName: 'asc' },
  });
  const ids = team.map((a) => a.id);
  const [memberCounts, ticketCounts] = ids.length
    ? await Promise.all([
        prisma.member.groupBy({ by: ['accountManagerId'], where: { accountManagerId: { in: ids }, deletedAt: null }, _count: { _all: true } }),
        prisma.helpdeskTicket.groupBy({ by: ['assignedTo'], where: { assignedTo: { in: ids }, status: { in: openStatuses } }, _count: { _all: true } }),
      ])
    : [[], []];
  const membersBy = new Map((memberCounts as any[]).map((m) => [m.accountManagerId, m._count._all]));
  const ticketsBy = new Map((ticketCounts as any[]).map((t) => [t.assignedTo, t._count._all]));

  return reply.send({
    success: true,
    data: team.map((a) => ({ ...a, members: membersBy.get(a.id) ?? 0, openTickets: ticketsBy.get(a.id) ?? 0 })),
    meta: { total: team.length },
  });
}
