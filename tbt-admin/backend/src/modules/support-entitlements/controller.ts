import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  computeSupportQuota,
  SUPPORT_USAGE_COUNTS_SQL,
  APPROVED_CREDIT_PURCHASES_SQL,
} from '../../lib/supportQuota.js';
import {
  SUPPORT_CALL_CATEGORIES,
  canManageSupportSession,
  canMarkAttendance,
  isFullAccessRole,
  isSupportCallCategory,
} from '../../lib/supportCallLogic.js';
import { mapSession, SESSION_COLUMNS } from '../../lib/supportCallData.js';
import { getActingAdmin } from '../../lib/adminRole.js';
import { sendPushToMember } from '../../lib/pushNotifications.js';

const updateEntitlementSchema = z.object({
  techSupportDays:  z.number().int().min(0),
  adSupportDays:    z.number().int().min(0),
  groupCallCount:   z.number().int().min(0),
  callCreditCount:  z.number().int().min(0),
  oneToOneEnabled:  z.boolean(),
  // Optional so older admin clients that don't send them keep working (existing value is kept).
  salesCallCount:   z.number().int().min(0).optional(),
  contentCallCount: z.number().int().min(0).optional(),
});

const recordUsageSchema = z.object({
  memberId: z.string().uuid(),
  type:     z.enum(['tech_support', 'ad_support', 'group_call', 'one_to_one', 'sales_support', 'content_support']),
  batchId:  z.string().uuid().optional(),
  notes:    z.string().optional(),
});

// GET /api/support-entitlements — list all plan rows
export async function listEntitlementsHandler(req: FastifyRequest, reply: FastifyReply) {
  const rows = await req.server.prisma.$queryRawUnsafe<any[]>(
    `SELECT plan, tech_support_days, ad_support_days, group_call_count, call_credit_count,
            one_to_one_enabled, sales_call_count, content_call_count, updated_at
     FROM plan_entitlements ORDER BY
       CASE plan WHEN 'free' THEN 1 WHEN 'starter' THEN 2 WHEN 'premium' THEN 3
                 WHEN 'vip' THEN 4 WHEN 'enterprise' THEN 5 ELSE 9 END`
  );
  return reply.send({ success: true, data: rows, error: null });
}

// PUT /api/support-entitlements/:plan — update one plan's entitlements
export async function updateEntitlementHandler(
  req: FastifyRequest<{ Params: { plan: string } }>,
  reply: FastifyReply,
) {
  const { plan } = req.params;
  const parsed = updateEntitlementSchema.safeParse(req.body);
  if (!parsed.success) {
    return reply.status(400).send({ success: false, data: null, error: parsed.error.issues[0]?.message });
  }
  const { techSupportDays, adSupportDays, groupCallCount, callCreditCount, oneToOneEnabled, salesCallCount, contentCallCount } = parsed.data;

  await req.server.prisma.$executeRawUnsafe(
    `INSERT INTO plan_entitlements (plan, tech_support_days, ad_support_days, group_call_count, call_credit_count, one_to_one_enabled,
                                    sales_call_count, content_call_count, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::int, 0), COALESCE($8::int, 0), NOW())
     ON CONFLICT (plan) DO UPDATE SET
       tech_support_days  = EXCLUDED.tech_support_days,
       ad_support_days    = EXCLUDED.ad_support_days,
       group_call_count   = EXCLUDED.group_call_count,
       call_credit_count  = EXCLUDED.call_credit_count,
       one_to_one_enabled = EXCLUDED.one_to_one_enabled,
       sales_call_count   = COALESCE($7::int, plan_entitlements.sales_call_count),
       content_call_count = COALESCE($8::int, plan_entitlements.content_call_count),
       updated_at         = NOW()`,
    plan, techSupportDays, adSupportDays, groupCallCount, callCreditCount, oneToOneEnabled,
    salesCallCount ?? null, contentCallCount ?? null,
  );

  return reply.send({ success: true, data: { plan }, error: null });
}

// GET /api/support-entitlements/usage — paginated support usage log (admin)
export async function listUsageHandler(
  req: FastifyRequest<{ Querystring: { memberId?: string; type?: string; page?: string; limit?: string } }>,
  reply: FastifyReply,
) {
  try {
    const { memberId, type, page = '1', limit = '50' } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (memberId) { conditions.push(`su.member_id = $${idx++}::uuid`); values.push(memberId); }
    if (type)     { conditions.push(`su.type = $${idx++}`);             values.push(type); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows, total] = await Promise.all([
      req.server.prisma.$queryRawUnsafe<any[]>(
        `SELECT su.id, su.member_id, su.type, su.notes, su.recorded_by, su.used_at, su.batch_id,
                m.first_name, m.last_name, m.phone
         FROM support_usage su
         JOIN members m ON m.id = su.member_id
         ${where}
         ORDER BY su.used_at DESC
         LIMIT ${parseInt(limit, 10)} OFFSET ${offset}`,
        ...values,
      ),
      req.server.prisma.$queryRawUnsafe<any[]>(
        `SELECT COUNT(*)::int AS count FROM support_usage su ${where}`,
        ...values,
      ),
    ]);

    return reply.send({
      success: true,
      data: rows,
      meta: { total: (total[0] as any)?.count ?? 0, page: parseInt(page, 10), limit: parseInt(limit, 10) },
      error: null,
    });
  } catch (err: any) {
    req.server.log.error({ err, memberId: req.query?.memberId }, 'listUsageHandler failed');
    return reply.status(500).send({ success: false, data: null, error: err?.message || 'Failed to load support usage' });
  }
}

// POST /api/support-entitlements/usage — admin records a support session
export async function recordUsageHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = recordUsageSchema.safeParse(req.body);
  if (!parsed.success) {
    return reply.status(400).send({ success: false, data: null, error: parsed.error.issues[0]?.message });
  }
  const { memberId, type, batchId, notes } = parsed.data;
  const recordedBy = req.user as string;

  const member = await req.server.prisma.member.findUnique({
    where: { id: memberId },
    select: { id: true, membershipPlan: true },
  });
  if (!member) return reply.status(404).send({ success: false, data: null, error: 'Member not found' });

  await req.server.prisma.$executeRawUnsafe(
    `INSERT INTO support_usage (member_id, batch_id, type, notes, recorded_by)
     VALUES ($1::uuid, $2, $3, $4, $5)`,
    memberId, batchId ?? null, type, notes ?? null, recordedBy,
  );

  return reply.send({ success: true, data: { memberId, type }, error: null });
}

// DELETE /api/support-entitlements/usage/:id — admin corrects a mistaken record
export async function deleteUsageHandler(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  await req.server.prisma.$executeRawUnsafe(
    `DELETE FROM support_usage WHERE id = $1::uuid`, req.params.id,
  );
  return reply.send({ success: true, data: null, error: null });
}

// GET /api/support-entitlements/member/:memberId — admin view of a specific member's quota
export async function getMemberSupportQuotaHandler(
  req: FastifyRequest<{ Params: { memberId: string } }>,
  reply: FastifyReply,
) {
  const { memberId } = req.params;
  try {
    const member = await req.server.prisma.member.findUnique({
      where: { id: memberId },
      select: { membershipPlan: true, batchId: true },
    });
    if (!member) return reply.status(404).send({ success: false, data: null, error: 'Member not found' });

    const plan = (member.membershipPlan as string | null) ?? 'free';

    const [entRows, usageRows, lifelineRows, purchasedRows] = await Promise.all([
      req.server.prisma.$queryRawUnsafe<any[]>(
        `SELECT tech_support_days, ad_support_days, group_call_count, call_credit_count, one_to_one_enabled,
                COALESCE(sales_call_count, 0) AS sales_call_count, COALESCE(content_call_count, 0) AS content_call_count
         FROM plan_entitlements WHERE plan = $1`,
        plan,
      ),
      req.server.prisma.$queryRawUnsafe<any[]>(SUPPORT_USAGE_COUNTS_SQL, memberId),
      member.batchId
        ? req.server.prisma.$queryRawUnsafe<any[]>(
            `SELECT lifelines_total, lifelines_used FROM member_batch_settings WHERE member_id = $1::uuid AND batch_id = $2::uuid LIMIT 1`,
            memberId, member.batchId,
          )
        : Promise.resolve([]),
      req.server.prisma.$queryRawUnsafe<any[]>(APPROVED_CREDIT_PURCHASES_SQL, memberId),
    ]);

    const data = computeSupportQuota(plan, entRows, usageRows, lifelineRows, purchasedRows);

    return reply.send({ success: true, data, error: null });
  } catch (err: any) {
    req.server.log.error({ err, memberId }, 'getMemberSupportQuotaHandler failed');
    return reply.status(500).send({ success: false, data: null, error: err?.message || 'Failed to load support quota' });
  }
}

// ── Expert Support Call sessions (SUPPORT_CALLS_SPECKIT.md) ───────────────────
// super_admin/admin manage every session; mentor accounts only sessions they
// host (host_admin_id = their admin id). Other roles get 403.

const SESSION_ADMIN_COLUMNS = `${SESSION_COLUMNS}, s.meeting_url, s.created_by,
  (SELECT COUNT(*)::int FROM support_call_bookings x WHERE x.session_id = s.id AND x.status <> 'cancelled') AS active_count,
  (SELECT COUNT(*)::int FROM support_call_bookings x WHERE x.session_id = s.id AND x.status = 'booked') AS booked_count`;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().nullable().transform((v) => (v ? v : null));

const meetingUrlSchema = z
  .string().trim().max(1000).optional().nullable()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || /^https:\/\/\S+$/i.test(v), { message: 'Meeting link must be an https:// URL' });

const createSessionSchema = z.object({
  category:        z.enum(SUPPORT_CALL_CATEGORIES),
  title:           z.string().trim().min(1, 'Title is required').max(200),
  description:     optionalText(2000),
  hostAdminId:     z.string().uuid().optional().nullable(),
  hostName:        optionalText(120),
  startsAt:        z.string().datetime({ offset: true, message: 'Start time is invalid' }),
  durationMinutes: z.number().int().min(5).max(480),
  capacity:        z.number().int().min(1).max(500),
  meetingUrl:      meetingUrlSchema,
});
const updateSessionSchema = createSessionSchema.partial();

const attendanceSchema = z.object({ status: z.enum(['attended', 'no_show']) });

function sfail(reply: FastifyReply, status: number, error: string) {
  return reply.status(status).send({ success: false, data: null, error });
}

function adminSessionDto(r: any) {
  const s = mapSession(r);
  const active = Number(r.active_count ?? 0);
  return {
    ...s,
    startsAt: s.startsAt.toISOString(),
    meetingUrl: (r.meeting_url ?? null) as string | null,
    activeBookings: active,
    pendingAttendance: Number(r.booked_count ?? 0),
    seatsLeft: Math.max(0, s.capacity - active),
  };
}

type ActingAdmin = { id: string; fullName: string; role: string };

/** Acting admin + role gate. Replies 403 and returns null when not allowed. */
async function requireSessionManager(req: FastifyRequest, reply: FastifyReply): Promise<ActingAdmin | null> {
  const acting = await getActingAdmin(req);
  if (!acting || !canManageSupportSession(acting.role, acting.id)) {
    sfail(reply, 403, 'Support call sessions are limited to Admin, Super Admin and Mentor accounts.');
    return null;
  }
  return acting as ActingAdmin;
}

// GET /api/support-entitlements/sessions?category=&scope=upcoming|past|all
export async function listSupportSessionsHandler(req: FastifyRequest, reply: FastifyReply) {
  const acting = await requireSessionManager(req, reply);
  if (!acting) return;
  const { category, scope = 'upcoming' } = req.query as { category?: string; scope?: string };
  const conds: string[] = [];
  const vals: any[] = [];
  if (category) {
    if (!isSupportCallCategory(category)) return sfail(reply, 400, 'Unknown category');
    vals.push(category);
    conds.push(`s.category = $${vals.length}`);
  }
  if (!isFullAccessRole(acting.role)) {
    vals.push(acting.id);
    conds.push(`s.host_admin_id = $${vals.length}::uuid`);
  }
  if (scope === 'upcoming') conds.push(`s.starts_at + make_interval(mins => s.duration_minutes) > NOW()`);
  if (scope === 'past') conds.push(`s.starts_at + make_interval(mins => s.duration_minutes) <= NOW()`);
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const order = scope === 'past' ? 'DESC' : 'ASC';
  const rows = await req.server.prisma.$queryRawUnsafe<any[]>(
    `SELECT ${SESSION_ADMIN_COLUMNS} FROM support_call_sessions s ${where} ORDER BY s.starts_at ${order} LIMIT 200`,
    ...vals,
  );
  return reply.send({ success: true, data: rows.map(adminSessionDto), error: null });
}

async function resolveHost(
  req: FastifyRequest,
  acting: ActingAdmin,
  hostAdminId: string | null | undefined,
  hostName: string | null | undefined,
) {
  // Mentors always host their own sessions.
  if (!isFullAccessRole(acting.role)) return { hostAdminId: acting.id as string | null, hostName: hostName ?? acting.fullName };
  if (!hostAdminId) return { hostAdminId: null as string | null, hostName: hostName ?? null };
  const host = await req.server.prisma.admin.findUnique({ where: { id: hostAdminId }, select: { id: true, fullName: true } });
  if (!host) return null;
  return { hostAdminId: host.id as string | null, hostName: hostName ?? host.fullName };
}

// POST /api/support-entitlements/sessions
export async function createSupportSessionHandler(req: FastifyRequest, reply: FastifyReply) {
  const acting = await requireSessionManager(req, reply);
  if (!acting) return;
  const parsed = createSessionSchema.safeParse(req.body);
  if (!parsed.success) return sfail(reply, 400, parsed.error.issues[0]?.message ?? 'Invalid session');
  const d = parsed.data;
  const startsAt = new Date(d.startsAt);
  if (startsAt.getTime() <= Date.now()) return sfail(reply, 400, 'Start time must be in the future');
  if (d.category === 'one_to_one' && d.capacity !== 1) return sfail(reply, 400, 'Mentor 1-On-1 sessions have exactly 1 seat');
  const host = await resolveHost(req, acting, d.hostAdminId, d.hostName);
  if (!host) return sfail(reply, 400, 'Host admin not found');

  const rows = await req.server.prisma.$queryRawUnsafe<any[]>(
    `INSERT INTO support_call_sessions
       (category, title, description, host_admin_id, host_name, starts_at, duration_minutes, capacity, meeting_url, created_by)
     VALUES ($1, $2, $3, $4::uuid, $5, $6, $7, $8, $9, $10)
     RETURNING id`,
    d.category, d.title, d.description, host.hostAdminId, host.hostName, startsAt, d.durationMinutes, d.capacity, d.meetingUrl, req.user,
  );
  const created = await req.server.prisma.$queryRawUnsafe<any[]>(
    `SELECT ${SESSION_ADMIN_COLUMNS} FROM support_call_sessions s WHERE s.id = $1::uuid`, rows[0].id,
  );
  return reply.status(201).send({ success: true, data: adminSessionDto(created[0]), error: null });
}

/** Loads a session the acting admin may manage; replies 404 (also for other mentors' sessions). */
async function loadManagedSession(
  reply: FastifyReply,
  db: { $queryRawUnsafe: (q: string, ...v: any[]) => Promise<any> },
  id: string,
  acting: ActingAdmin,
  lock = false,
) {
  if (!UUID_RE.test(id)) {
    sfail(reply, 404, 'Session not found');
    return null;
  }
  const rows = (await db.$queryRawUnsafe(
    `SELECT ${SESSION_ADMIN_COLUMNS} FROM support_call_sessions s WHERE s.id = $1::uuid ${lock ? 'FOR UPDATE' : ''}`, id,
  )) as any[];
  const row = rows[0];
  if (!row || !canManageSupportSession(acting.role, acting.id, { hostAdminId: row.host_admin_id })) {
    sfail(reply, 404, 'Session not found');
    return null;
  }
  return row;
}

// PUT /api/support-entitlements/sessions/:id
export async function updateSupportSessionHandler(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const acting = await requireSessionManager(req, reply);
  if (!acting) return;
  const parsed = updateSessionSchema.safeParse(req.body);
  if (!parsed.success) return sfail(reply, 400, parsed.error.issues[0]?.message ?? 'Invalid session');
  const d = parsed.data;

  return req.server.prisma.$transaction(async (tx) => {
    const row = await loadManagedSession(reply, tx, req.params.id, acting, true);
    if (!row) return reply;
    const current = adminSessionDto(row);
    if (current.status !== 'scheduled') return sfail(reply, 409, 'Cancelled sessions cannot be edited');
    if (d.category && d.category !== current.category && current.activeBookings > 0) {
      return sfail(reply, 409, 'Category cannot change once members have booked');
    }
    const category = d.category ?? current.category;
    const capacity = d.capacity ?? current.capacity;
    if (category === 'one_to_one' && capacity !== 1) return sfail(reply, 400, 'Mentor 1-On-1 sessions have exactly 1 seat');
    if (capacity < current.activeBookings) {
      return sfail(reply, 409, `Capacity cannot be below the ${current.activeBookings} existing booking(s)`);
    }
    const startsAt = d.startsAt ? new Date(d.startsAt) : null;
    if (startsAt && startsAt.getTime() <= Date.now()) return sfail(reply, 400, 'Start time must be in the future');

    let hostAdminId = current.hostAdminId;
    let hostName = d.hostName !== undefined ? d.hostName : current.hostName;
    if (isFullAccessRole(acting.role) && d.hostAdminId !== undefined && d.hostAdminId !== current.hostAdminId) {
      const host = await resolveHost(req, acting, d.hostAdminId, d.hostName);
      if (!host) return sfail(reply, 400, 'Host admin not found');
      hostAdminId = host.hostAdminId;
      hostName = host.hostName;
    }

    await tx.$executeRawUnsafe(
      `UPDATE support_call_sessions SET
         category = $2, title = $3, description = $4, host_admin_id = $5::uuid, host_name = $6,
         starts_at = $7, duration_minutes = $8, capacity = $9, meeting_url = $10, updated_at = NOW()
       WHERE id = $1::uuid`,
      current.id,
      category,
      d.title ?? current.title,
      d.description !== undefined ? d.description : current.description,
      hostAdminId,
      hostName,
      startsAt ?? new Date(current.startsAt),
      d.durationMinutes ?? current.durationMinutes,
      capacity,
      d.meetingUrl !== undefined ? d.meetingUrl : current.meetingUrl,
    );
    const updated = await tx.$queryRawUnsafe<any[]>(
      `SELECT ${SESSION_ADMIN_COLUMNS} FROM support_call_sessions s WHERE s.id = $1::uuid`, current.id,
    );
    return reply.send({ success: true, data: adminSessionDto(updated[0]), error: null });
  });
}

// POST /api/support-entitlements/sessions/:id/cancel — cancels the session and its open bookings
export async function cancelSupportSessionHandler(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const acting = await requireSessionManager(req, reply);
  if (!acting) return;

  const result = await req.server.prisma.$transaction(async (tx) => {
    const row = await loadManagedSession(reply, tx, req.params.id, acting, true);
    if (!row) return null;
    if (row.status !== 'scheduled') {
      sfail(reply, 409, 'Session is already cancelled');
      return null;
    }
    await tx.$executeRawUnsafe(
      `UPDATE support_call_sessions SET status = 'cancelled', updated_at = NOW() WHERE id = $1::uuid`, row.id,
    );
    const affected = await tx.$queryRawUnsafe<any[]>(
      `UPDATE support_call_bookings SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
       WHERE session_id = $1::uuid AND status = 'booked'
       RETURNING member_id`,
      row.id,
    );
    return { row, memberIds: affected.map((a) => a.member_id as string) };
  });
  if (!result) return reply;

  const { row, memberIds } = result;
  if (memberIds.length) {
    const when = new Date(row.starts_at).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
    });
    const title = 'Support call cancelled';
    const message = `"${row.title}" on ${when} IST was cancelled. The call has been returned to your quota.`;
    try {
      await req.server.prisma.appNotification.create({
        data: {
          title, message, type: 'support_call_cancelled', actionUrl: '/courses',
          recipients: { create: memberIds.map((memberId) => ({ memberId })) },
        },
      });
      const io = (req.server as any).io;
      for (const memberId of memberIds) {
        io?.to(`user:${memberId}`).emit('notification', { type: 'support_call_cancelled', title, message, actionUrl: '/courses' });
        await sendPushToMember(req.server.prisma, memberId, title, message, { type: 'support_call_cancelled' }).catch(() => {});
      }
    } catch (err) {
      req.server.log.error({ err, sessionId: row.id }, 'support call cancel notification failed');
    }
  }
  return reply.send({ success: true, data: { id: row.id, status: 'cancelled', cancelledBookings: memberIds.length }, error: null });
}

// GET /api/support-entitlements/sessions/:id/bookings
export async function listSupportSessionBookingsHandler(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const acting = await requireSessionManager(req, reply);
  if (!acting) return;
  const row = await loadManagedSession(reply, req.server.prisma, req.params.id, acting);
  if (!row) return;
  const rows = await req.server.prisma.$queryRawUnsafe<any[]>(
    `SELECT b.id, b.status, b.booked_at, b.cancelled_at, b.member_id,
            m.first_name, m.last_name, m.phone, m.email
     FROM support_call_bookings b JOIN members m ON m.id = b.member_id
     WHERE b.session_id = $1::uuid
     ORDER BY b.booked_at ASC`,
    row.id,
  );
  return reply.send({
    success: true,
    data: rows.map((r) => ({
      id: r.id,
      status: r.status,
      bookedAt: r.booked_at,
      cancelledAt: r.cancelled_at,
      memberId: r.member_id,
      memberName: [r.first_name, r.last_name].filter(Boolean).join(' '),
      phone: r.phone,
      email: r.email,
    })),
    error: null,
  });
}

// PUT /api/support-entitlements/bookings/:id/status — attended | no_show (both consume the call)
export async function markSupportBookingHandler(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const acting = await requireSessionManager(req, reply);
  if (!acting) return;
  const parsed = attendanceSchema.safeParse(req.body);
  if (!parsed.success) return sfail(reply, 400, 'Status must be attended or no_show');
  const { status } = parsed.data;
  if (!UUID_RE.test(req.params.id)) return sfail(reply, 404, 'Booking not found');

  return req.server.prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRawUnsafe<any[]>(
      `SELECT b.id AS booking_id, b.status AS booking_status, b.member_id, m.batch_id AS member_batch_id, ${SESSION_COLUMNS}
       FROM support_call_bookings b
       JOIN support_call_sessions s ON s.id = b.session_id
       JOIN members m ON m.id = b.member_id
       WHERE b.id = $1::uuid
       FOR UPDATE OF b`,
      req.params.id,
    );
    const r = rows[0];
    if (!r || !canManageSupportSession(acting.role, acting.id, { hostAdminId: r.host_admin_id })) {
      return sfail(reply, 404, 'Booking not found');
    }
    const rule = canMarkAttendance({ bookingStatus: r.booking_status, session: mapSession(r), now: new Date() });
    if (!rule.ok) return sfail(reply, rule.status, rule.message);

    // support_usage stays the single source of truth for "completed" calls.
    const usage = await tx.$queryRawUnsafe<any[]>(
      `INSERT INTO support_usage (member_id, batch_id, type, notes, recorded_by)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5) RETURNING id`,
      r.member_id,
      r.member_batch_id ?? null,
      r.category,
      `Support call ${status === 'attended' ? 'attended' : 'no-show'}: ${r.title}`,
      req.user,
    );
    await tx.$executeRawUnsafe(
      `UPDATE support_call_bookings SET status = $2, usage_id = $3::uuid, updated_at = NOW() WHERE id = $1::uuid`,
      r.booking_id, status, usage[0].id,
    );
    return reply.send({ success: true, data: { id: r.booking_id, status, usageId: usage[0].id }, error: null });
  });
}
