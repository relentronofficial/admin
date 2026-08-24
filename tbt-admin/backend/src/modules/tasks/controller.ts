import type { FastifyReply, FastifyRequest } from 'fastify';
import { taskInitiativeSchema, updateTaskSchema } from './schema.js';

export async function listTasksHandler(request: FastifyRequest, reply: FastifyReply) {
  const { programId, stepId, page = 1, limit = 500 } = request.query as any;
  const where: any = {};
  if (programId) where.programId = programId;
  if (stepId) where.stepId = stepId;

  const [tasks, total] = await Promise.all([
    request.server.prisma.task.findMany({
      where,
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
      orderBy: [{ dayNumber: 'asc' }, { sortOrder: 'asc' }],
      include: { program: { select: { id: true, name: true } } },
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
      timerSeconds: body.timerSeconds ?? null,
      isMilestone: body.isMilestone,
      milestoneLabel: body.milestoneLabel ?? null,
      bonusPoints: body.bonusPoints,
      sortOrder: body.sortOrder,
    },
    include: { program: { select: { id: true, name: true } } },
  });
  return reply.status(201).send({ success: true, data: task, error: null });
}

export async function getTaskHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const task = await request.server.prisma.task.findUnique({
    where: { id },
    include: { program: true, submissions: { take: 10, orderBy: { createdAt: 'desc' } } },
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

// PUT /api/tasks/submissions/:subId/review — admin approves or rejects a single task submission
export async function reviewTaskSubmissionHandler(request: FastifyRequest, reply: FastifyReply) {
  const { subId } = request.params as { subId: string };
  const { action, feedback, bonusPoints } = request.body as {
    action: 'approve' | 'reject';
    feedback?: string;
    bonusPoints?: number;
  };
  const adminId = (request as any).auth?.sub ?? null;

  if (action !== 'approve' && action !== 'reject') {
    return reply.status(400).send({ success: false, data: null, error: 'action must be approve or reject' });
  }

  const sub = await request.server.prisma.$queryRawUnsafe<any[]>(
    `SELECT ts.*, t.base_points as "basePoints", t.bonus_points as "bonusPoints",
            t.is_milestone as "isMilestone", t.milestone_label as "milestoneLabel"
     FROM task_submissions ts JOIN tasks t ON t.id = ts.task_id WHERE ts.id = $1`,
    subId,
  );
  if (!sub[0]) return reply.status(404).send({ success: false, data: null, error: 'Submission not found' });
  const s = sub[0];

  // Guard: if already approved and admin is trying to approve again with no bonus,
  // block the duplicate to prevent re-awarding base points.
  const alreadyApproved = s.status === 'approved';
  if (alreadyApproved && action === 'approve' && !(bonusPoints && bonusPoints > 0)) {
    return reply.status(400).send({
      success: false,
      data: null,
      error: 'Submission already approved. Provide bonusPoints to award additional points.',
    });
  }

  const newStatus = action === 'approve' ? 'approved' : 'rejected';
  await request.server.prisma.$executeRawUnsafe(
    `UPDATE task_submissions SET status=$1, reviewed_by=$2, reviewed_at=NOW(), feedback=$3, updated_at=NOW() WHERE id=$4`,
    newStatus, adminId, feedback ?? null, subId,
  );

  if (action === 'approve') {
    // Base points — only award on first approval. If the day-approval path already set
    // status='approved', skip base points entirely to prevent double XP.
    if (!alreadyApproved && s.basePoints > 0) {
      await request.server.prisma.pointsLedger.create({
        data: {
          memberId: s.member_id,
          points: s.basePoints,
          reason: `Task approved`,
          referenceType: 'task_submission',
          referenceId: subId,
        },
      }).catch(() => {});
    }

    // Milestone bonus — only on first approval
    if (!alreadyApproved && s.isMilestone && s.bonusPoints > 0) {
      await request.server.prisma.pointsLedger.create({
        data: {
          memberId: s.member_id,
          points: s.bonusPoints,
          reason: s.milestoneLabel ? `Milestone: ${s.milestoneLabel}` : 'Milestone bonus',
          referenceType: 'milestone',
          referenceId: s.task_id,
        },
      }).catch(() => {});
    }

    // Admin-supplied bonus points — allowed at any time (first review or subsequent)
    if (bonusPoints && bonusPoints > 0) {
      await request.server.prisma.pointsLedger.create({
        data: {
          memberId: s.member_id,
          points: bonusPoints,
          reason: `Task review bonus`,
          referenceType: 'task_submission',
          referenceId: subId,
        },
      }).catch(() => {});
    }

    request.server.io.to(`user:${s.member_id}`).emit('notification', {
      title: 'Task Approved ✓',
      body: 'Your task submission has been approved.',
      type: 'task_approved',
    });
  } else {
    request.server.io.to(`user:${s.member_id}`).emit('notification', {
      title: 'Task Needs Revision',
      body: feedback ?? 'Your task submission needs revision.',
      type: 'task_rejected',
    });
  }

  return reply.send({ success: true, data: { id: subId, status: newStatus }, error: null });
}
