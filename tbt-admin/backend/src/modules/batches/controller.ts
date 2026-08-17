import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  createBatchSchema,
  updateBatchSchema,
  upsertBatchDaySchema,
  upsertMemberProgressSchema,
} from './schema.js';
import { deliverMemberReport, generateMemberReport } from '../../lib/batchReports.js';

export async function listBatchesHandler(req: FastifyRequest, reply: FastifyReply) {
  const { status } = req.query as { status?: string };
  const batches = await req.server.prisma.batch.findMany({
    where: status ? { isActive: status === 'active' ? true : undefined } : undefined,
    orderBy: { startsAt: 'desc' },
    select: {
      id: true,
      name: true,
      description: true,
      isActive: true,
      xpPerDay: true,
      snapshotDays: true,
      startsAt: true,
      endsAt: true,
      createdAt: true,
      _count: { select: { members: true } },
    },
  });
  if (batches.length > 0) {
    const rawRows = await req.server.prisma.$queryRawUnsafe<{ id: string; status: string }[]>(
      `SELECT id, status FROM batches WHERE id = ANY($1::uuid[])`,
      batches.map(b => b.id),
    );
    const rawMap = Object.fromEntries(rawRows.map(r => [r.id, r]));
    const data = batches.map(b => {
      const batchStatus: string = rawMap[b.id]?.status ?? 'active';
      if (status && batchStatus !== status) return null;
      return { ...b, status: batchStatus };
    }).filter(Boolean);
    return reply.send({ success: true, data, error: null });
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
      xpPerDay: true,
      snapshotDays: true,
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
  const [rawRow] = await req.server.prisma.$queryRawUnsafe<{ status: string }[]>(
    `SELECT status FROM batches WHERE id = $1::uuid`,
    req.params.id,
  );
  return reply.send({ success: true, data: { ...batch, status: rawRow?.status ?? 'active' }, error: null });
}

export async function listProgramsHandler(req: FastifyRequest, reply: FastifyReply) {
  const programs = await req.server.prisma.program.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      description: true,
      durationDays: true,
      createdAt: true,
      _count: { select: { tasks: true } },
    },
  });
  return reply.send({ success: true, data: programs, error: null });
}

export async function createProgramHandler(req: FastifyRequest, reply: FastifyReply) {
  const body = req.body as any;
  if (!body?.name?.trim()) {
    return reply.status(400).send({ success: false, data: null, error: 'Program name is required' });
  }
  const program = await req.server.prisma.program.create({
    data: {
      name: body.name.trim(),
      description: body.description?.trim() ?? null,
      durationDays: body.durationDays ? parseInt(body.durationDays) : 90,
    },
    select: { id: true, name: true, description: true, durationDays: true, createdAt: true },
  });
  return reply.status(201).send({ success: true, data: program, error: null });
}

export async function updateProgramHandler(
  req: FastifyRequest<{ Params: { programId: string } }>,
  reply: FastifyReply,
) {
  const body = req.body as any;
  const program = await req.server.prisma.program.update({
    where: { id: req.params.programId },
    data: {
      ...(body.name ? { name: body.name.trim() } : {}),
      ...(body.description !== undefined ? { description: body.description?.trim() ?? null } : {}),
      ...(body.durationDays !== undefined ? { durationDays: parseInt(body.durationDays) } : {}),
    },
    select: { id: true, name: true, description: true, durationDays: true, createdAt: true },
  });
  return reply.send({ success: true, data: program, error: null });
}

export async function deleteProgramHandler(
  req: FastifyRequest<{ Params: { programId: string } }>,
  reply: FastifyReply,
) {
  await req.server.prisma.program.delete({ where: { id: req.params.programId } });
  return reply.send({ success: true, data: null, error: null });
}

export async function createBatchHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = createBatchSchema.safeParse(req.body);
  if (!parsed.success) return reply.status(400).send({ success: false, data: null, error: parsed.error.issues[0]?.message });

  const { startsAt, endsAt, programId, xpPerDay, ...rest } = parsed.data;

  // FIX-15: snapshot program duration at creation so edits to the program don't affect running batches
  let snapshotDays: number | undefined;
  if (programId) {
    const prog = await req.server.prisma.program.findUnique({ where: { id: programId }, select: { durationDays: true } });
    snapshotDays = prog?.durationDays ?? undefined;
  }

  const batch = await req.server.prisma.batch.create({
    data: {
      ...rest,
      startsAt: new Date(startsAt),
      endsAt: endsAt ? new Date(endsAt) : null,
      ...(programId ? { program: { connect: { id: programId } } } : {}),
      xpPerDay: xpPerDay ?? 50,
      ...(snapshotDays !== undefined ? { snapshotDays } : {}),
    },
    select: {
      id: true,
      name: true,
      description: true,
      isActive: true,
      xpPerDay: true,
      snapshotDays: true,
      startsAt: true,
      endsAt: true,
      createdAt: true,
      programId: true,
      program: { select: { id: true, name: true } },
      _count: { select: { members: true } },
    },
  });
  return reply.status(201).send({ success: true, data: batch, error: null });
}

export async function updateBatchHandler(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const parsed = updateBatchSchema.safeParse(req.body);
  if (!parsed.success) return reply.status(400).send({ success: false, data: null, error: parsed.error.issues[0]?.message });

  const { startsAt, endsAt, programId, xpPerDay, ...rest } = parsed.data;

  // Re-snapshot if program changes
  let snapshotDays: number | undefined;
  if (programId) {
    const prog = await req.server.prisma.program.findUnique({ where: { id: programId }, select: { durationDays: true } });
    snapshotDays = prog?.durationDays ?? undefined;
  }

  const batch = await req.server.prisma.batch.update({
    where: { id: req.params.id },
    data: {
      ...rest,
      ...(startsAt ? { startsAt: new Date(startsAt) } : {}),
      ...(endsAt !== undefined ? { endsAt: endsAt ? new Date(endsAt) : null } : {}),
      ...(programId !== undefined
        ? (programId ? { program: { connect: { id: programId } } } : { program: { disconnect: true } })
        : {}),
      ...(xpPerDay !== undefined ? { xpPerDay } : {}),
      ...(snapshotDays !== undefined ? { snapshotDays } : {}),
    },
    select: {
      id: true,
      name: true,
      description: true,
      isActive: true,
      xpPerDay: true,
      snapshotDays: true,
      startsAt: true,
      endsAt: true,
      createdAt: true,
      programId: true,
      program: { select: { id: true, name: true } },
      _count: { select: { members: true } },
    },
  });
  return reply.send({ success: true, data: batch, error: null });
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
      xpPerDay: source.xpPerDay,
      ...(source.snapshotDays != null ? { snapshotDays: source.snapshotDays } : {}),
      ...(source.programId ? { program: { connect: { id: source.programId } } } : {}),
    },
    select: {
      id: true,
      name: true,
      description: true,
      isActive: true,
      xpPerDay: true,
      snapshotDays: true,
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

  // Clone task table rows linked to the source batch
  const sourceTasks = await req.server.prisma.task.findMany({
    where: { batchId: req.params.id },
    orderBy: [{ dayNumber: 'asc' }, { sortOrder: 'asc' }],
  });
  if (sourceTasks.length > 0) {
    await req.server.prisma.task.createMany({
      data: sourceTasks.map(t => ({
        programId: t.programId,
        batchId: newBatch.id,
        stepId: t.stepId,
        dayNumber: t.dayNumber,
        title: t.title,
        description: t.description,
        deliverables: t.deliverables,
        contentUrl: t.contentUrl,
        basePoints: t.basePoints,
        bonusPoints: t.bonusPoints,
        proofType: t.proofType,
        estimatedMinutes: t.estimatedMinutes,
        isMilestone: t.isMilestone,
        milestoneLabel: t.milestoneLabel,
        sortOrder: t.sortOrder,
      })),
    });
  }

  return reply.status(201).send({ success: true, data: { ...newBatch, clonedTaskCount: sourceTasks.length }, error: null });
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
  const { page = '1', limit = '50', memberId, status, dayNumber } = req.query as {
    page?: string; limit?: string; memberId?: string; status?: string; dayNumber?: string;
  };
  const pageNum  = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10)));
  const skip     = (pageNum - 1) * limitNum;

  const progressWhere: any = { batchId: req.params.id };
  if (memberId)   progressWhere.memberId   = memberId;
  if (status)     progressWhere.status     = status;
  if (dayNumber)  progressWhere.dayNumber  = parseInt(dayNumber, 10);

  const [members, progress, progressTotal, batch] = await Promise.all([
    req.server.prisma.member.findMany({
      where: { batchId: req.params.id },
      select: { id: true, memberId: true, firstName: true, lastName: true, profilePhotoUrl: true, status: true },
      orderBy: { createdAt: 'asc' },
    }),
    req.server.prisma.memberDayProgress.findMany({
      where: progressWhere,
      select: {
        memberId: true, dayNumber: true, status: true, isCompleted: true,
        completedAt: true, submittedAt: true, journalEntry: true,
        journalFileUrl: true, completedTaskIds: true, reviewNote: true, updatedAt: true,
      },
      orderBy: [{ dayNumber: 'asc' }, { memberId: 'asc' }],
      skip,
      take: limitNum,
    }),
    req.server.prisma.memberDayProgress.count({ where: progressWhere }),
    req.server.prisma.batch.findUnique({
      where: { id: req.params.id },
      select: { id: true, name: true, startsAt: true, endsAt: true, isActive: true },
    }),
  ]);
  return reply.send({
    success: true,
    data: { batch, members, progress },
    meta: { total: progressTotal, page: pageNum, limit: limitNum },
    error: null,
  });
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
      `SELECT day_number, status, notes, marked_at FROM member_attendance WHERE batch_id=$1::uuid AND member_id=$2::uuid ORDER BY day_number ASC`,
      req.params.id, req.params.memberId,
    ),
    req.server.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM batch_break_requests WHERE batch_id=$1::uuid AND member_id=$2::uuid ORDER BY created_at DESC`,
      req.params.id, req.params.memberId,
    ),
    req.server.prisma.$queryRawUnsafe<any[]>(
      `SELECT extended_days FROM member_batch_settings WHERE batch_id=$1::uuid AND member_id=$2::uuid LIMIT 1`,
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
    `SELECT * FROM member_attendance WHERE batch_id = $1::uuid AND member_id = $2::uuid ORDER BY day_number ASC`,
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
     VALUES ($1::uuid,$2::uuid,$3,$4,$5,NOW(),NOW())
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
     WHERE br.batch_id = $1::uuid
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
     WHERE id=$2::uuid AND batch_id=$3::uuid RETURNING *`,
    adminId, req.params.reqId, req.params.id,
  );

  if (!record) {
    return reply.status(404).send({ success: false, data: null, error: 'Break request not found' });
  }

  // Retroactively mark every day in the approved break range as 'break'.
  // Preserves 'present' status — break fills only absent/unmarked days.
  await req.server.prisma.$executeRawUnsafe(
    `INSERT INTO member_attendance (member_id, batch_id, day_number, status, marked_at, updated_at)
     SELECT $1::uuid, $2::uuid, gs.day, 'break', NOW(), NOW()
     FROM generate_series($3::int, $4::int) AS gs(day)
     ON CONFLICT (member_id, batch_id, day_number)
     DO UPDATE SET
       status = CASE
         WHEN member_attendance.status = 'present' THEN member_attendance.status
         ELSE 'break'
       END,
       updated_at = NOW()`,
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
     WHERE id=$3::uuid AND batch_id=$4::uuid RETURNING *`,
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
     VALUES ($1::uuid,$2::uuid,$3,$4,$5,NOW())
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
     WHERE batch_id = $1::uuid
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

// ─── Inline Task CRUD ────────────────────────────────────────────────────────

// GET /api/batches/:id/tasks?dayNumber=N
export async function listBatchTasksHandler(
  req: FastifyRequest<{ Params: { id: string }; Querystring: { dayNumber?: string } }>,
  reply: FastifyReply,
) {
  const dayNumber = req.query.dayNumber ? parseInt(req.query.dayNumber, 10) : undefined;
  const tasks = await req.server.prisma.task.findMany({
    where: {
      batchId: req.params.id,
      ...(dayNumber !== undefined ? { dayNumber } : {}),
    },
    orderBy: [{ dayNumber: 'asc' }, { sortOrder: 'asc' }],
  });
  return reply.send({ success: true, data: tasks, error: null });
}

// POST /api/batches/:id/tasks
export async function createBatchTaskHandler(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const {
    dayNumber, title, description, deliverables, contentUrl,
    basePoints = 100, bonusPoints = 0, proofType = 'watch',
    estimatedMinutes = 15, isMilestone = false, milestoneLabel, sortOrder = 0,
  } = req.body as any;
  if (!dayNumber || !title) {
    return reply.status(400).send({ success: false, data: null, error: 'dayNumber and title are required' });
  }
  const task = await req.server.prisma.task.create({
    data: {
      batchId: req.params.id,
      dayNumber: parseInt(String(dayNumber), 10),
      title,
      description: description ?? null,
      deliverables: deliverables ?? null,
      contentUrl: contentUrl ?? null,
      basePoints,
      bonusPoints,
      proofType,
      estimatedMinutes,
      isMilestone,
      milestoneLabel: milestoneLabel ?? null,
      sortOrder,
    },
  });
  return reply.status(201).send({ success: true, data: task, error: null });
}

// PUT /api/batches/:id/tasks/:taskId
export async function updateBatchTaskHandler(
  req: FastifyRequest<{ Params: { id: string; taskId: string } }>,
  reply: FastifyReply,
) {
  const {
    dayNumber, title, description, deliverables, contentUrl,
    basePoints, bonusPoints, proofType, estimatedMinutes,
    isMilestone, milestoneLabel, sortOrder,
  } = req.body as any;
  const task = await req.server.prisma.task.update({
    where: { id: req.params.taskId },
    data: {
      ...(dayNumber !== undefined ? { dayNumber: parseInt(String(dayNumber), 10) } : {}),
      ...(title !== undefined ? { title } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(deliverables !== undefined ? { deliverables } : {}),
      ...(contentUrl !== undefined ? { contentUrl } : {}),
      ...(basePoints !== undefined ? { basePoints } : {}),
      ...(bonusPoints !== undefined ? { bonusPoints } : {}),
      ...(proofType !== undefined ? { proofType } : {}),
      ...(estimatedMinutes !== undefined ? { estimatedMinutes } : {}),
      ...(isMilestone !== undefined ? { isMilestone } : {}),
      ...(milestoneLabel !== undefined ? { milestoneLabel } : {}),
      ...(sortOrder !== undefined ? { sortOrder } : {}),
    },
  });
  return reply.send({ success: true, data: task, error: null });
}

// DELETE /api/batches/:id/tasks/:taskId
export async function deleteBatchTaskHandler(
  req: FastifyRequest<{ Params: { id: string; taskId: string } }>,
  reply: FastifyReply,
) {
  await req.server.prisma.task.delete({ where: { id: req.params.taskId } });
  return reply.send({ success: true, data: null, error: null });
}

// PUT /api/batches/:id/tasks/reorder
export async function reorderBatchTasksHandler(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const { ids } = req.body as { ids: string[] };
  if (!Array.isArray(ids)) {
    return reply.status(400).send({ success: false, data: null, error: 'ids array required' });
  }
  await Promise.all(
    ids.map((id, idx) => req.server.prisma.task.update({ where: { id }, data: { sortOrder: idx } })),
  );
  return reply.send({ success: true, data: null, error: null });
}

// POST /api/batches/:id/tasks/migrate-json
// Reads batch_days.tasks JSON and creates proper Task rows. Clears JSON after migration.
export async function migrateJsonTasksHandler(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const days = await req.server.prisma.batchDay.findMany({
    where: { batchId: req.params.id },
    orderBy: { dayNumber: 'asc' },
  });

  let created = 0;
  for (const day of days) {
    const jsonTasks = Array.isArray((day as any).tasks) ? (day as any).tasks : [];
    for (let i = 0; i < jsonTasks.length; i++) {
      const t = jsonTasks[i];
      if (!t?.title) continue;
      const existing = await req.server.prisma.task.findFirst({
        where: { batchId: req.params.id, dayNumber: day.dayNumber, title: t.title },
      });
      if (!existing) {
        await req.server.prisma.task.create({
          data: {
            batchId: req.params.id,
            dayNumber: day.dayNumber,
            title: t.title,
            proofType: t.proofType ?? 'watch',
            basePoints: t.basePoints ?? 100,
            sortOrder: i,
          },
        });
        created++;
      }
    }
    // Clear JSON blob after migration
    await req.server.prisma.$executeRawUnsafe(
      `UPDATE batch_days SET tasks = NULL WHERE id = $1`,
      day.id,
    );
  }
  return reply.send({ success: true, data: { created }, error: null });
}

// POST /api/batches/:id/complete
export async function markBatchCompleteHandler(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  await req.server.prisma.$executeRawUnsafe(
    `UPDATE batches SET status='completed', is_active=false, updated_at=NOW() WHERE id=$1::uuid`,
    req.params.id,
  );
  const batch = await req.server.prisma.batch.findUnique({
    where: { id: req.params.id },
    select: { id: true, name: true, isActive: true, startsAt: true, endsAt: true },
  });
  return reply.send({ success: true, data: batch, error: null });
}

// POST /api/batches/:id/archive
export async function archiveBatchHandler(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  await req.server.prisma.$executeRawUnsafe(
    `UPDATE batches SET status='archived', is_active=false, updated_at=NOW() WHERE id=$1::uuid`,
    req.params.id,
  );
  const batch = await req.server.prisma.batch.findUnique({
    where: { id: req.params.id },
    select: { id: true, name: true, isActive: true, startsAt: true, endsAt: true },
  });
  return reply.send({ success: true, data: batch, error: null });
}

// GET /api/batches/:id/all-tasks — program tasks + batch-inline tasks combined
export async function getAllBatchTasksHandler(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const batch = await req.server.prisma.batch.findUnique({
    where: { id: req.params.id },
    select: { programId: true },
  });
  if (!batch) return reply.status(404).send({ success: false, data: null, error: 'Batch not found' });

  const tasks = await req.server.prisma.task.findMany({
    where: {
      OR: [
        { batchId: req.params.id },
        ...(batch.programId ? [{ programId: batch.programId, batchId: null }] : []),
      ],
    },
    orderBy: [{ dayNumber: 'asc' }, { sortOrder: 'asc' }],
  });

  return reply.send({
    success: true,
    data: tasks.map(t => ({ ...t, source: t.batchId === req.params.id ? 'batch' : 'program' })),
    error: null,
  });
}

// GET /api/batches/:id/submissions?dayNumber=N&memberId=X&status=Y
export async function getBatchSubmissionsHandler(
  req: FastifyRequest<{ Params: { id: string }; Querystring: { dayNumber?: string; memberId?: string; status?: string } }>,
  reply: FastifyReply,
) {
  const { dayNumber, memberId, status } = req.query;
  const submissions = await req.server.prisma.$queryRawUnsafe<any[]>(
    `SELECT ts.id, ts.task_id as "taskId", ts.member_id as "memberId",
            ts.response_value as "responseValue", ts.proof_url as "proofUrl",
            ts.proof_type as "proofType", ts.status, ts.feedback,
            ts.day_number as "dayNumber", ts.reviewed_at as "reviewedAt",
            t.title as "taskTitle", t.base_points as "basePoints",
            t.proof_type as "taskProofType", t.deliverables, t.is_milestone as "isMilestone",
            m.first_name as "firstName", m.last_name as "lastName",
            m.member_id as "memberCode", m.profile_photo_url as "profilePhotoUrl"
     FROM task_submissions ts
     JOIN tasks t ON t.id = ts.task_id
     JOIN members m ON m.id = ts.member_id
     WHERE ts.batch_id = $1
       AND ($2::int IS NULL OR ts.day_number = $2)
       AND ($3::uuid IS NULL OR ts.member_id = $3)
       AND ($4::text IS NULL OR ts.status::text = $4)
     ORDER BY ts.day_number ASC, m.first_name ASC`,
    req.params.id,
    dayNumber ? parseInt(dayNumber, 10) : null,
    memberId ?? null,
    status ?? null,
  );
  return reply.send({ success: true, data: submissions, error: null });
}

// ── Batch report delivery (weekly/monthly WhatsApp reports) ──────────────

// GET /api/batches/reports/history — paginated WhatsApp report delivery log
export async function getReportHistoryHandler(req: FastifyRequest, reply: FastifyReply) {
  const { page = '1', limit = '25', reportType, status, memberId } = req.query as {
    page?: string; limit?: string; reportType?: string; status?: string; memberId?: string;
  };
  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip = (pageNum - 1) * limitNum;

  const where: any = { reportType: { not: null } };
  if (reportType) where.reportType = reportType;
  if (status) where.status = status;
  if (memberId) where.memberId = memberId;

  const [rows, total] = await Promise.all([
    req.server.prisma.whatsappMessage.findMany({
      where,
      select: {
        id: true, memberId: true, reportType: true, reportPeriod: true, status: true,
        failureReason: true, sentAt: true,
        member: { select: { firstName: true, lastName: true, phone: true, memberId: true } },
      },
      orderBy: { sentAt: 'desc' },
      skip,
      take: limitNum,
    }),
    req.server.prisma.whatsappMessage.count({ where }),
  ]);

  return reply.send({ success: true, data: rows, meta: { total, page: pageNum, limit: limitNum }, error: null });
}

const reportTypeParam = (v: unknown): 'weekly' | 'monthly' | null =>
  v === 'weekly' || v === 'monthly' ? v : null;

// POST /api/batches/reports/preview — dry run, computes the report without sending or logging
export async function previewBatchReportHandler(req: FastifyRequest, reply: FastifyReply) {
  const { memberId, reportType } = (req.body ?? {}) as { memberId?: string; reportType?: string };
  const type = reportTypeParam(reportType);
  if (!memberId || !type) {
    return reply.status(400).send({ success: false, data: null, error: 'memberId and reportType ("weekly"|"monthly") are required' });
  }
  const report = await generateMemberReport(req.server.prisma, memberId, type);
  return reply.send({ success: true, data: report, error: null });
}

// POST /api/batches/reports/send-test — admin manual trigger, sends to one member now.
// Still respects the per-period duplicate check unless force=true.
export async function sendTestBatchReportHandler(req: FastifyRequest, reply: FastifyReply) {
  const { memberId, reportType, force } = (req.body ?? {}) as { memberId?: string; reportType?: string; force?: boolean };
  const type = reportTypeParam(reportType);
  if (!memberId || !type) {
    return reply.status(400).send({ success: false, data: null, error: 'memberId and reportType ("weekly"|"monthly") are required' });
  }
  const result = await deliverMemberReport(req.server.prisma, memberId, type, { force: !!force });
  return reply.send({ success: true, data: result, error: null });
}
