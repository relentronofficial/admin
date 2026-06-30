import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

const saveDraftSchema = z.object({
  journalEntry: z.string().optional(),
  journalFileUrl: z.string().optional(),
  completedTaskIds: z.array(z.string()).optional(),
});

const rejectSchema = z.object({
  reviewNote: z.string().min(1, 'Review note is required'),
});

// GET /api/user-batch — member's batch + day content + their progress + attendance + breaks
export async function getMyBatchHandler(req: FastifyRequest, reply: FastifyReply) {
  const memberId = req.memberId!;

  const member = await req.server.prisma.member.findUnique({
    where: { id: memberId },
    select: { batchId: true },
  });

  if (!member?.batchId) {
    return reply.send({ success: true, data: null, error: null });
  }

  const [batch, days, progress, attendance, breaks, settings] = await Promise.all([
    req.server.prisma.batch.findUnique({
      where: { id: member.batchId },
      select: {
        id: true, name: true, description: true,
        startsAt: true, endsAt: true, isActive: true,
        program: { select: { name: true, durationDays: true } },
      },
    }),
    req.server.prisma.batchDay.findMany({
      where: { batchId: member.batchId },
      orderBy: { dayNumber: 'asc' },
    }),
    req.server.prisma.memberDayProgress.findMany({
      where: { batchId: member.batchId, memberId },
      orderBy: { dayNumber: 'asc' },
    }),
    req.server.prisma.$queryRawUnsafe<any[]>(
      `SELECT day_number, status, notes, marked_at FROM member_attendance WHERE batch_id=$1 AND member_id=$2 ORDER BY day_number ASC`,
      member.batchId, memberId,
    ),
    req.server.prisma.$queryRawUnsafe<any[]>(
      `SELECT id, start_day, end_day, reason, status, admin_note, created_at FROM batch_break_requests WHERE batch_id=$1 AND member_id=$2 ORDER BY created_at DESC`,
      member.batchId, memberId,
    ),
    req.server.prisma.$queryRawUnsafe<any[]>(
      `SELECT extended_days FROM member_batch_settings WHERE batch_id=$1 AND member_id=$2 LIMIT 1`,
      member.batchId, memberId,
    ),
  ]);

  const baseDays = (batch as any)?.program?.durationDays ?? 90;
  const extendedDays = (settings[0] as any)?.extended_days ?? 0;
  const totalDays = baseDays + extendedDays;

  return reply.send({
    success: true,
    data: {
      batch,
      programName: (batch as any)?.program?.name ?? null,
      totalDays,
      days,
      progress,
      attendance,
      breaks,
    },
    error: null,
  });
}

// PUT /api/user-batch/:dayNumber — save draft
export async function saveDraftHandler(
  req: FastifyRequest<{ Params: { dayNumber: string } }>,
  reply: FastifyReply,
) {
  const memberId = req.memberId!;
  const dayNum = parseInt(req.params.dayNumber, 10);
  if (dayNum < 1) {
    return reply.status(400).send({ success: false, data: null, error: 'Day number must be at least 1' });
  }

  const parsed = saveDraftSchema.safeParse(req.body);
  if (!parsed.success) return reply.status(400).send({ success: false, data: null, error: parsed.error.issues[0]?.message });

  const member = await req.server.prisma.member.findUnique({
    where: { id: memberId },
    select: { batchId: true },
  });
  if (!member?.batchId) return reply.status(400).send({ success: false, data: null, error: 'You are not in a batch' });

  // Don't allow editing approved records
  const existing = await req.server.prisma.memberDayProgress.findUnique({
    where: { batchId_memberId_dayNumber: { batchId: member.batchId, memberId, dayNumber: dayNum } },
  });
  if (existing?.status === 'approved') {
    return reply.status(400).send({ success: false, data: null, error: 'This day has already been approved' });
  }

  const record = await req.server.prisma.memberDayProgress.upsert({
    where: { batchId_memberId_dayNumber: { batchId: member.batchId, memberId, dayNumber: dayNum } },
    create: {
      batchId: member.batchId,
      memberId,
      dayNumber: dayNum,
      status: 'in_progress',
      ...parsed.data,
    },
    update: {
      status: existing?.status === 'rejected' ? 'in_progress' : (existing?.status ?? 'in_progress'),
      ...parsed.data,
    },
  });
  return reply.send({ success: true, data: record, error: null });
}

// POST /api/user-batch/:dayNumber/submit — submit for approval
export async function submitDayHandler(
  req: FastifyRequest<{ Params: { dayNumber: string } }>,
  reply: FastifyReply,
) {
  const memberId = req.memberId!;
  const dayNum = parseInt(req.params.dayNumber, 10);

  const member = await req.server.prisma.member.findUnique({
    where: { id: memberId },
    select: { batchId: true, firstName: true, lastName: true, memberId: true },
  });
  if (!member?.batchId) return reply.status(400).send({ success: false, data: null, error: 'You are not in a batch' });

  const existing = await req.server.prisma.memberDayProgress.findUnique({
    where: { batchId_memberId_dayNumber: { batchId: member.batchId, memberId, dayNumber: dayNum } },
  });
  if (existing?.status === 'approved') {
    return reply.status(400).send({ success: false, data: null, error: 'This day has already been approved' });
  }
  if (existing?.status === 'pending_approval') {
    return reply.status(400).send({ success: false, data: null, error: 'Already submitted for review' });
  }

  const record = await req.server.prisma.memberDayProgress.upsert({
    where: { batchId_memberId_dayNumber: { batchId: member.batchId, memberId, dayNumber: dayNum } },
    create: {
      batchId: member.batchId,
      memberId,
      dayNumber: dayNum,
      status: 'pending_approval',
      submittedAt: new Date(),
    },
    update: {
      status: 'pending_approval',
      submittedAt: new Date(),
      reviewNote: null,
    },
  });

  // Notify admin room so they can review without polling
  req.server.io.to('admin').emit('admin:day_submitted', {
    memberId,
    memberName: `${member.firstName} ${member.lastName ?? ''}`.trim(),
    memberCode: member.memberId,
    batchId: member.batchId,
    dayNumber: dayNum,
  });

  return reply.send({ success: true, data: record, error: null });
}

// Admin: PUT /api/batches/:id/progress/:memberId/:dayNumber/approve
export async function approveDayHandler(
  req: FastifyRequest<{ Params: { id: string; memberId: string; dayNumber: string } }>,
  reply: FastifyReply,
) {
  const adminId = (req as any).auth?.sub ?? null;
  const dayNum = parseInt(req.params.dayNumber, 10);

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
      status: 'approved',
      isCompleted: true,
      completedAt: new Date(),
      reviewedAt: new Date(),
      reviewedBy: adminId,
    },
    update: {
      status: 'approved',
      isCompleted: true,
      completedAt: new Date(),
      reviewedAt: new Date(),
      reviewedBy: adminId,
      reviewNote: null,
    },
  });
  return reply.send({ success: true, data: record, error: null });
}

// Admin: PUT /api/batches/:id/progress/:memberId/:dayNumber/reject
export async function rejectDayHandler(
  req: FastifyRequest<{ Params: { id: string; memberId: string; dayNumber: string } }>,
  reply: FastifyReply,
) {
  const parsed = rejectSchema.safeParse(req.body);
  if (!parsed.success) return reply.status(400).send({ success: false, data: null, error: parsed.error.issues[0]?.message });

  const adminId = (req as any).auth?.sub ?? null;
  const dayNum = parseInt(req.params.dayNumber, 10);

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
      status: 'rejected',
      reviewNote: parsed.data.reviewNote,
      reviewedAt: new Date(),
      reviewedBy: adminId,
    },
    update: {
      status: 'rejected',
      isCompleted: false,
      completedAt: null,
      reviewNote: parsed.data.reviewNote,
      reviewedAt: new Date(),
      reviewedBy: adminId,
    },
  });
  return reply.send({ success: true, data: record, error: null });
}

// POST /api/user-batch/attendance — mark attendance for a day
export async function markAttendanceHandler(req: FastifyRequest, reply: FastifyReply) {
  const memberId = req.memberId!;
  const { dayNumber, notes } = (req.body as any) ?? {};
  if (!dayNumber || typeof dayNumber !== 'number') {
    return reply.status(400).send({ success: false, data: null, error: 'dayNumber is required' });
  }

  const member = await req.server.prisma.member.findUnique({
    where: { id: memberId },
    select: { batchId: true },
  });
  if (!member?.batchId) return reply.status(400).send({ success: false, data: null, error: 'Not in a batch' });

  // Check if day is on approved break — mark as break
  const breaks = await req.server.prisma.$queryRawUnsafe<any[]>(
    `SELECT id FROM batch_break_requests WHERE batch_id=$1 AND member_id=$2 AND status='approved' AND start_day<=$3 AND end_day>=$3 LIMIT 1`,
    member.batchId, memberId, dayNumber,
  );
  const status = breaks.length > 0 ? 'break' : 'present';

  const [record] = await req.server.prisma.$queryRawUnsafe<any[]>(
    `INSERT INTO member_attendance (member_id, batch_id, day_number, status, notes, marked_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,NOW(),NOW())
     ON CONFLICT (member_id, batch_id, day_number)
     DO UPDATE SET status=EXCLUDED.status, notes=EXCLUDED.notes, marked_at=NOW(), updated_at=NOW()
     RETURNING *`,
    memberId, member.batchId, dayNumber, status, notes ?? null,
  );
  return reply.send({ success: true, data: record, error: null });
}

// POST /api/user-batch/break — request a break
export async function requestBreakHandler(req: FastifyRequest, reply: FastifyReply) {
  const memberId = req.memberId!;
  const { startDay, endDay, reason } = (req.body as any) ?? {};
  if (!startDay || !endDay || startDay > endDay) {
    return reply.status(400).send({ success: false, data: null, error: 'Invalid day range' });
  }

  const member = await req.server.prisma.member.findUnique({
    where: { id: memberId },
    select: { batchId: true },
  });
  if (!member?.batchId) return reply.status(400).send({ success: false, data: null, error: 'Not in a batch' });

  const [record] = await req.server.prisma.$queryRawUnsafe<any[]>(
    `INSERT INTO batch_break_requests (member_id, batch_id, start_day, end_day, reason)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    memberId, member.batchId, startDay, endDay, reason ?? null,
  );
  return reply.send({ success: true, data: record, error: null });
}

// Admin: GET /api/batches/:id/pending — all pending approval records
export async function getPendingApprovalsHandler(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const records = await req.server.prisma.memberDayProgress.findMany({
    where: { batchId: req.params.id, status: 'pending_approval' },
    include: {
      member: {
        select: { id: true, firstName: true, lastName: true, profilePhotoUrl: true, memberId: true },
      },
    },
    orderBy: [{ submittedAt: 'asc' }, { dayNumber: 'asc' }],
  });
  return reply.send({ success: true, data: records, error: null });
}
