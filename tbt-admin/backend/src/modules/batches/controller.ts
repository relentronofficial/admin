import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  createBatchSchema,
  updateBatchSchema,
  upsertBatchDaySchema,
  upsertMemberProgressSchema,
} from './schema.js';

export async function listBatchesHandler(req: FastifyRequest, reply: FastifyReply) {
  const batches = await req.server.prisma.batch.findMany({
    orderBy: { startsAt: 'desc' },
    select: {
      id: true,
      name: true,
      description: true,
      isActive: true,
      startsAt: true,
      endsAt: true,
      createdAt: true,
      _count: { select: { members: true } },
    },
  });
  if (batches.length > 0) {
    const xpRows = await req.server.prisma.$queryRawUnsafe<{ id: string; xp_per_day: number }[]>(
      `SELECT id, xp_per_day FROM batches WHERE id = ANY($1::uuid[])`,
      batches.map(b => b.id),
    );
    const xpMap = Object.fromEntries(xpRows.map(r => [r.id, Number(r.xp_per_day)]));
    return reply.send({ success: true, data: batches.map(b => ({ ...b, xpPerDay: xpMap[b.id] ?? 50 })), error: null });
  }
  return reply.send({ success: true, data: batches, error: null });
}

export async function getBatchHandler(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const batch = await req.server.prisma.batch.findUnique({
    where: { id: req.params.id },
    select: {
      id: true,
      name: true,
      description: true,
      isActive: true,
      startsAt: true,
      endsAt: true,
      createdAt: true,
      program: { select: { id: true, name: true, durationDays: true } },
      members: {
        select: {
          id: true,
          memberId: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          profilePhotoUrl: true,
          status: true,
          membershipPlan: true,
        },
        orderBy: { createdAt: 'asc' },
      },
      _count: { select: { members: true } },
    },
  });
  if (!batch) return reply.status(404).send({ success: false, data: null, error: 'Batch not found' });
  const [xpRow] = await req.server.prisma.$queryRawUnsafe<{ xp_per_day: number }[]>(
    `SELECT xp_per_day FROM batches WHERE id = $1`,
    req.params.id,
  );
  return reply.send({ success: true, data: { ...batch, xpPerDay: Number(xpRow?.xp_per_day ?? 50) }, error: null });
}

export async function listProgramsHandler(req: FastifyRequest, reply: FastifyReply) {
  const programs = await req.server.prisma.program.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, description: true },
  });
  return reply.send({ success: true, data: programs, error: null });
}

export async function createBatchHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = createBatchSchema.safeParse(req.body);
  if (!parsed.success) return reply.status(400).send({ success: false, data: null, error: parsed.error.issues[0]?.message });

  const { startsAt, endsAt, programId, xpPerDay, ...rest } = parsed.data;
  const batch = await req.server.prisma.batch.create({
    data: {
      ...rest,
      startsAt: new Date(startsAt),
      endsAt: endsAt ? new Date(endsAt) : null,
      ...(programId ? { program: { connect: { id: programId } } } : {}),
    },
    select: {
      id: true,
      name: true,
      description: true,
      isActive: true,
      startsAt: true,
      endsAt: true,
      createdAt: true,
      programId: true,
      program: { select: { id: true, name: true } },
      _count: { select: { members: true } },
    },
  });
  if (xpPerDay !== undefined) {
    await req.server.prisma.$executeRawUnsafe(`UPDATE batches SET xp_per_day=$1 WHERE id=$2`, xpPerDay, batch.id);
  }
  return reply.status(201).send({ success: true, data: { ...batch, xpPerDay: xpPerDay ?? 50 }, error: null });
}

export async function updateBatchHandler(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const parsed = updateBatchSchema.safeParse(req.body);
  if (!parsed.success) return reply.status(400).send({ success: false, data: null, error: parsed.error.issues[0]?.message });

  const { startsAt, endsAt, programId, xpPerDay, ...rest } = parsed.data;
  const batch = await req.server.prisma.batch.update({
    where: { id: req.params.id },
    data: {
      ...rest,
      ...(startsAt ? { startsAt: new Date(startsAt) } : {}),
      ...(endsAt !== undefined ? { endsAt: endsAt ? new Date(endsAt) : null } : {}),
      ...(programId !== undefined
        ? (programId ? { program: { connect: { id: programId } } } : { program: { disconnect: true } })
        : {}),
    },
    select: {
      id: true,
      name: true,
      description: true,
      isActive: true,
      startsAt: true,
      endsAt: true,
      createdAt: true,
      programId: true,
      program: { select: { id: true, name: true } },
      _count: { select: { members: true } },
    },
  });
  if (xpPerDay !== undefined) {
    await req.server.prisma.$executeRawUnsafe(`UPDATE batches SET xp_per_day=$1 WHERE id=$2`, xpPerDay, batch.id);
  }
  return reply.send({ success: true, data: { ...batch, xpPerDay: xpPerDay ?? 50 }, error: null });
}

export async function deleteBatchHandler(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  await req.server.prisma.member.updateMany({
    where: { batchId: req.params.id },
    data: { batchId: null },
  });
  await req.server.prisma.batch.delete({ where: { id: req.params.id } });
  return reply.send({ success: true, data: null, error: null });
}

export async function cloneBatchHandler(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const schema = { name: '', startsAt: '' };
  const body = req.body as any;
  if (!body?.name?.trim()) return reply.status(400).send({ success: false, data: null, error: 'name is required' });
  if (!body?.startsAt) return reply.status(400).send({ success: false, data: null, error: 'startsAt is required' });

  const source = await req.server.prisma.batch.findUnique({
    where: { id: req.params.id },
    include: { days: { orderBy: { dayNumber: 'asc' } } },
  });
  if (!source) return reply.status(404).send({ success: false, data: null, error: 'Batch not found' });

  const newBatch = await req.server.prisma.batch.create({
    data: {
      name: body.name.trim(),
      description: source.description,
      isActive: false,
      startsAt: new Date(body.startsAt),
      endsAt: null,
      ...(source.programId ? { program: { connect: { id: source.programId } } } : {}),
    },
    select: {
      id: true,
      name: true,
      description: true,
      isActive: true,
      startsAt: true,
      endsAt: true,
      createdAt: true,
      programId: true,
      _count: { select: { members: true } },
    },
  });

  if (source.days.length > 0) {
    await req.server.prisma.batchDay.createMany({
      data: source.days.map(d => ({
        batchId: newBatch.id,
        dayNumber: d.dayNumber,
        title: d.title,
        notes: d.notes,
        resourceUrl: d.resourceUrl,
        tasks: d.tasks ?? undefined,
        category: d.category,
      })),
    });
  }

  return reply.status(201).send({ success: true, data: newBatch, error: null });
}

// ─── Day content handlers ──────────────────────────────────────────────────────

export async function listBatchDaysHandler(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const days = await req.server.prisma.batchDay.findMany({
    where: { batchId: req.params.id },
    orderBy: { dayNumber: 'asc' },
  });
  return reply.send({ success: true, data: days, error: null });
}

export async function getBatchDayDetailHandler(
  req: FastifyRequest<{ Params: { id: string; dayNumber: string } }>,
  reply: FastifyReply,
) {
  const dayNum = parseInt(req.params.dayNumber, 10);
  const [day, progress] = await Promise.all([
    req.server.prisma.batchDay.findUnique({
      where: { batchId_dayNumber: { batchId: req.params.id, dayNumber: dayNum } },
    }),
    req.server.prisma.memberDayProgress.findMany({
      where: { batchId: req.params.id, dayNumber: dayNum },
      include: {
        member: {
          select: { id: true, firstName: true, lastName: true, profilePhotoUrl: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    }),
  ]);
  return reply.send({ success: true, data: { day, progress }, error: null });
}

export async function upsertBatchDayHandler(
  req: FastifyRequest<{ Params: { id: string; dayNumber: string } }>,
  reply: FastifyReply,
) {
  const parsed = upsertBatchDaySchema.safeParse(req.body);
  if (!parsed.success) return reply.status(400).send({ success: false, data: null, error: parsed.error.issues[0]?.message });

  const dayNum = parseInt(req.params.dayNumber, 10);
  if (dayNum < 1) {
    return reply.status(400).send({ success: false, data: null, error: 'Day number must be at least 1' });
  }

  const day = await req.server.prisma.batchDay.upsert({
    where: { batchId_dayNumber: { batchId: req.params.id, dayNumber: dayNum } },
    create: {
      batchId: req.params.id,
      dayNumber: dayNum,
      ...parsed.data,
    },
    update: parsed.data,
  });
  return reply.send({ success: true, data: day, error: null });
}

// ─── Progress handlers ─────────────────────────────────────────────────────────

export async function getBatchProgressHandler(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const [members, progress, batch] = await Promise.all([
    req.server.prisma.member.findMany({
      where: { batchId: req.params.id },
      select: {
        id: true,
        memberId: true,
        firstName: true,
        lastName: true,
        profilePhotoUrl: true,
        status: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
    req.server.prisma.memberDayProgress.findMany({
      where: { batchId: req.params.id },
      select: {
        memberId: true,
        dayNumber: true,
        status: true,
        isCompleted: true,
        completedAt: true,
        submittedAt: true,
        journalEntry: true,
        journalFileUrl: true,
        completedTaskIds: true,
        reviewNote: true,
        updatedAt: true,
      },
    }),
    req.server.prisma.batch.findUnique({
      where: { id: req.params.id },
      select: { id: true, name: true, startsAt: true, endsAt: true, isActive: true },
    }),
  ]);
  return reply.send({ success: true, data: { batch, members, progress }, error: null });
}

export async function getMemberProgressHandler(
  req: FastifyRequest<{ Params: { id: string; memberId: string } }>,
  reply: FastifyReply,
) {
  const [progress, days, attendance, breaks, settings] = await Promise.all([
    req.server.prisma.memberDayProgress.findMany({
      where: { batchId: req.params.id, memberId: req.params.memberId },
      orderBy: { dayNumber: 'asc' },
    }),
    req.server.prisma.batchDay.findMany({
      where: { batchId: req.params.id },
      orderBy: { dayNumber: 'asc' },
    }),
    req.server.prisma.$queryRawUnsafe<any[]>(
      `SELECT day_number, status, notes, marked_at FROM member_attendance WHERE batch_id=$1 AND member_id=$2 ORDER BY day_number ASC`,
      req.params.id, req.params.memberId,
    ),
    req.server.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM batch_break_requests WHERE batch_id=$1 AND member_id=$2 ORDER BY created_at DESC`,
      req.params.id, req.params.memberId,
    ),
    req.server.prisma.$queryRawUnsafe<any[]>(
      `SELECT extended_days FROM member_batch_settings WHERE batch_id=$1 AND member_id=$2 LIMIT 1`,
      req.params.id, req.params.memberId,
    ),
  ]);
  const extendedDays = (settings[0] as any)?.extended_days ?? 0;
  return reply.send({ success: true, data: { progress, days, attendance, breaks, extendedDays }, error: null });
}

// Admin: GET /api/batches/:id/attendance/:memberId
export async function getAttendanceHandler(
  req: FastifyRequest<{ Params: { id: string; memberId: string } }>,
  reply: FastifyReply,
) {
  const records = await req.server.prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM member_attendance WHERE batch_id = $1 AND member_id = $2 ORDER BY day_number ASC`,
    req.params.id, req.params.memberId,
  );
  return reply.send({ success: true, data: records, error: null });
}

// Admin: PUT /api/batches/:id/attendance/:memberId/:dayNumber
export async function upsertAttendanceHandler(
  req: FastifyRequest<{ Params: { id: string; memberId: string; dayNumber: string } }>,
  reply: FastifyReply,
) {
  const dayNum = parseInt(req.params.dayNumber, 10);
  const { status = 'present', notes } = (req.body as any) ?? {};
  const [record] = await req.server.prisma.$queryRawUnsafe<any[]>(
    `INSERT INTO member_attendance (member_id, batch_id, day_number, status, notes, marked_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,NOW(),NOW())
     ON CONFLICT (member_id, batch_id, day_number)
     DO UPDATE SET status=EXCLUDED.status, notes=EXCLUDED.notes, updated_at=NOW()
     RETURNING *`,
    req.params.memberId, req.params.id, dayNum, status, notes ?? null,
  );
  return reply.send({ success: true, data: record, error: null });
}

// Admin: GET /api/batches/:id/breaks
export async function getBreakRequestsHandler(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const records = await req.server.prisma.$queryRawUnsafe<any[]>(
    `SELECT br.*, m.first_name, m.last_name, m.member_id as member_code
     FROM batch_break_requests br
     JOIN members m ON m.id = br.member_id
     WHERE br.batch_id = $1
     ORDER BY br.created_at DESC`,
    req.params.id,
  );
  return reply.send({ success: true, data: records, error: null });
}

// Admin: PUT /api/batches/:id/breaks/:reqId/approve
export async function approveBreakHandler(
  req: FastifyRequest<{ Params: { id: string; reqId: string } }>,
  reply: FastifyReply,
) {
  const adminId = (req as any).auth?.sub ?? null;
  const [record] = await req.server.prisma.$queryRawUnsafe<any[]>(
    `UPDATE batch_break_requests SET status='approved', reviewed_by=$1, reviewed_at=NOW(), updated_at=NOW()
     WHERE id=$2 AND batch_id=$3 RETURNING *`,
    adminId, req.params.reqId, req.params.id,
  );

  if (!record) {
    return reply.status(404).send({ success: false, data: null, error: 'Break request not found' });
  }

  // Retroactively mark every day in the approved break range as 'break'.
  // Uses ON CONFLICT DO UPDATE so existing attendance rows (present/absent) are overwritten —
  // an approved break supersedes whatever was previously recorded.
  await req.server.prisma.$executeRawUnsafe(
    `INSERT INTO member_attendance (member_id, batch_id, day_number, status, marked_at, updated_at)
     SELECT $1, $2, gs.day, 'break', NOW(), NOW()
     FROM generate_series($3::int, $4::int) AS gs(day)
     ON CONFLICT (member_id, batch_id, day_number)
     DO UPDATE SET status = 'break', updated_at = NOW()`,
    record.member_id,
    req.params.id,
    record.start_day,
    record.end_day,
  );

  return reply.send({ success: true, data: record, error: null });
}

// Admin: PUT /api/batches/:id/breaks/:reqId/reject
export async function rejectBreakHandler(
  req: FastifyRequest<{ Params: { id: string; reqId: string } }>,
  reply: FastifyReply,
) {
  const adminId = (req as any).auth?.sub ?? null;
  const { adminNote } = (req.body as any) ?? {};
  const [record] = await req.server.prisma.$queryRawUnsafe<any[]>(
    `UPDATE batch_break_requests SET status='rejected', admin_note=$1, reviewed_by=$2, reviewed_at=NOW(), updated_at=NOW()
     WHERE id=$3 AND batch_id=$4 RETURNING *`,
    adminNote ?? null, adminId, req.params.reqId, req.params.id,
  );
  return reply.send({ success: true, data: record ?? null, error: null });
}

// Admin: PUT /api/batches/:id/members/:memberId/settings
export async function upsertMemberSettingsHandler(
  req: FastifyRequest<{ Params: { id: string; memberId: string } }>,
  reply: FastifyReply,
) {
  const adminId = (req as any).auth?.sub ?? null;
  const { extendedDays = 0, notes } = (req.body as any) ?? {};
  const [record] = await req.server.prisma.$queryRawUnsafe<any[]>(
    `INSERT INTO member_batch_settings (member_id, batch_id, extended_days, notes, updated_by, updated_at)
     VALUES ($1,$2,$3,$4,$5,NOW())
     ON CONFLICT (member_id, batch_id)
     DO UPDATE SET extended_days=EXCLUDED.extended_days, notes=EXCLUDED.notes, updated_by=EXCLUDED.updated_by, updated_at=NOW()
     RETURNING *`,
    req.params.memberId, req.params.id, extendedDays, notes ?? null, adminId,
  );
  return reply.send({ success: true, data: record, error: null });
}

export async function getDayAnalyticsHandler(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const rows = await req.server.prisma.$queryRawUnsafe<any[]>(
    `SELECT
       day_number,
       COUNT(*) FILTER (WHERE status = 'approved')         AS approved,
       COUNT(*) FILTER (WHERE status = 'rejected')         AS rejected,
       COUNT(*) FILTER (WHERE status = 'pending_approval') AS pending,
       COUNT(*) FILTER (WHERE status = 'in_progress')      AS in_progress,
       COUNT(*)                                             AS total
     FROM member_day_progress
     WHERE batch_id = $1
     GROUP BY day_number
     ORDER BY day_number ASC`,
    req.params.id,
  );
  const data = rows.map(r => ({
    dayNumber:    Number(r.day_number),
    approved:     Number(r.approved),
    rejected:     Number(r.rejected),
    pending:      Number(r.pending),
    inProgress:   Number(r.in_progress),
    total:        Number(r.total),
    approvalRate: Number(r.total) > 0 ? Math.round((Number(r.approved) / Number(r.total)) * 100) : 0,
  }));
  return reply.send({ success: true, data, error: null });
}

export async function upsertMemberProgressHandler(
  req: FastifyRequest<{ Params: { id: string; memberId: string; dayNumber: string } }>,
  reply: FastifyReply,
) {
  const parsed = upsertMemberProgressSchema.safeParse(req.body);
  if (!parsed.success) return reply.status(400).send({ success: false, data: null, error: parsed.error.issues[0]?.message });

  const dayNum = parseInt(req.params.dayNumber, 10);
  const { isCompleted, ...rest } = parsed.data;

  const completedAt = isCompleted === true ? new Date() : isCompleted === false ? null : undefined;
  const statusFromCompleted = isCompleted === true ? 'approved' : isCompleted === false ? 'in_progress' : undefined;

  const record = await req.server.prisma.memberDayProgress.upsert({
    where: {
      batchId_memberId_dayNumber: {
        batchId: req.params.id,
        memberId: req.params.memberId,
        dayNumber: dayNum,
      },
    },
    create: {
      batchId: req.params.id,
      memberId: req.params.memberId,
      dayNumber: dayNum,
      isCompleted: isCompleted ?? false,
      status: isCompleted ? 'approved' : 'in_progress',
      completedAt: isCompleted ? new Date() : null,
      ...rest,
    },
    update: {
      ...(isCompleted !== undefined ? { isCompleted, completedAt, status: statusFromCompleted } : {}),
      ...rest,
    },
  });
  return reply.send({ success: true, data: record, error: null });
}
