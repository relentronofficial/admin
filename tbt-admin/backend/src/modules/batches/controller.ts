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
  return reply.send({ success: true, data: batch, error: null });
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

  const { startsAt, endsAt, programId, ...rest } = parsed.data;
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
  return reply.status(201).send({ success: true, data: batch, error: null });
}

export async function updateBatchHandler(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const parsed = updateBatchSchema.safeParse(req.body);
  if (!parsed.success) return reply.status(400).send({ success: false, data: null, error: parsed.error.issues[0]?.message });

  const { startsAt, endsAt, programId, ...rest } = parsed.data;
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
  if (dayNum < 1 || dayNum > 90) {
    return reply.status(400).send({ success: false, data: null, error: 'Day number must be 1-90' });
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
  const [progress, days] = await Promise.all([
    req.server.prisma.memberDayProgress.findMany({
      where: { batchId: req.params.id, memberId: req.params.memberId },
      orderBy: { dayNumber: 'asc' },
    }),
    req.server.prisma.batchDay.findMany({
      where: { batchId: req.params.id },
      orderBy: { dayNumber: 'asc' },
    }),
  ]);
  return reply.send({ success: true, data: { progress, days }, error: null });
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
