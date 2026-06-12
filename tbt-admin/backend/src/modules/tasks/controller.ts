import type { FastifyReply, FastifyRequest } from 'fastify';
import { taskInitiativeSchema, updateTaskSchema } from './schema.js';

export async function listTasksHandler(request: FastifyRequest, reply: FastifyReply) {
  const { programId, stepId, page = 1, limit = 50 } = request.query as any;
  const where: any = {};
  if (programId) where.programId = programId;
  if (stepId) where.stepId = stepId;

  const [tasks, total] = await Promise.all([
    request.server.prisma.task.findMany({
      where,
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
      orderBy: [{ dayNumber: 'asc' }, { sortOrder: 'asc' }],
      include: { program: { select: { id: true, name: true } }, step: true },
    }),
    request.server.prisma.task.count({ where }),
  ]);
  return reply.send({ success: true, data: tasks, meta: { total, page: Number(page), limit: Number(limit) }, error: null });
}

export async function createTaskInitiativeHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = taskInitiativeSchema.parse(request.body);

  const program = await request.server.prisma.program.findUnique({ where: { id: body.programId } });
  if (!program) {
    return reply.status(404).send({ success: false, data: null, error: 'Program not found' });
  }

  const task = await request.server.prisma.task.create({
    data: {
      programId: body.programId,
      stepId: body.stepId ?? null,
      dayNumber: body.dayNumber,
      title: body.title,
      description: body.description ?? null,
      deliverables: body.deliverables ?? null,
      contentUrl: body.contentUrl ?? null,
      basePoints: body.basePoints,
      proofType: body.proofType,
      estimatedMinutes: body.estimatedMinutes,
      isMilestone: body.isMilestone,
      milestoneLabel: body.milestoneLabel ?? null,
      bonusPoints: body.bonusPoints,
      sortOrder: body.sortOrder,
    },
    include: { program: { select: { id: true, name: true } }, step: true },
  });
  return reply.status(201).send({ success: true, data: task, error: null });
}

export async function getTaskHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const task = await request.server.prisma.task.findUnique({
    where: { id },
    include: { program: true, step: true, submissions: { take: 10, orderBy: { createdAt: 'desc' } } },
  });
  if (!task) return reply.status(404).send({ success: false, data: null, error: 'Task not found' });
  return reply.send({ success: true, data: task, error: null });
}

export async function updateTaskHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const body = updateTaskSchema.parse(request.body);
  const task = await request.server.prisma.task.update({ where: { id }, data: body as any });
  return reply.send({ success: true, data: task, error: null });
}

export async function deleteTaskHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  await request.server.prisma.task.delete({ where: { id } });
  return reply.send({ success: true, data: null, error: null });
}
