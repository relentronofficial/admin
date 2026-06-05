import type { FastifyRequest, FastifyReply } from 'fastify';

// ── WORKSHOPS ─────────────────────────────────────────────────────────

export async function listWorkshopsHandler(req: FastifyRequest, reply: FastifyReply) {
  const { page = 1, limit = 20, search } = req.query as any;
  const where: any = search ? { title: { contains: search, mode: 'insensitive' } } : {};
  const [workshops, total] = await Promise.all([
    req.server.prisma.workshop.findMany({
      where,
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
      include: {
        batch: { select: { id: true, name: true } },
        _count: { select: { enrollments: true } },
      },
    }),
    req.server.prisma.workshop.count({ where }),
  ]);
  return reply.send({ success: true, data: workshops, meta: { total, page: Number(page), limit: Number(limit) }, error: null });
}

export async function createWorkshopHandler(req: FastifyRequest, reply: FastifyReply) {
  const body = req.body as any;
  const slug = body.slug || body.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const workshop = await req.server.prisma.workshop.create({
    data: {
      title: body.title,
      slug,
      description: body.description,
      thumbnailUrl: body.thumbnailUrl,
      isActive: body.isActive ?? true,
      deliveryMode: body.deliveryMode || 'online',
      requiredTier: Number(body.requiredTier) || 1,
      ...(body.batchId ? { batchId: body.batchId } : {}),
    },
  });
  return reply.status(201).send({ success: true, data: workshop, error: null });
}

export async function getWorkshopHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  const workshop = await req.server.prisma.workshop.findUnique({
    where: { id },
    include: {
      batch: true,
      challenges: {
        orderBy: { order: 'asc' },
        include: {
          episodes: { orderBy: { order: 'asc' } },
          assignments: { orderBy: { order: 'asc' } },
        },
      },
      liveCalls: { orderBy: { scheduledAt: 'asc' } },
      flowItems: {
        orderBy: { order: 'asc' },
        include: { challenge: true, liveCall: true },
      },
      _count: { select: { enrollments: true } },
    },
  });
  if (!workshop) return reply.status(404).send({ success: false, error: 'Not found', data: null });
  return reply.send({ success: true, data: workshop, error: null });
}

export async function updateWorkshopHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  const body = req.body as any;
  const data: any = {};
  const allowedFields = [
    'title', 'slug', 'description', 'thumbnailUrl', 'isActive', 'deliveryMode', 'requiredTier',
    'tabChallengesLabel', 'tabQaLabel', 'tabAssignmentLabel', 'progressWidgetLabel',
    'progressMilestoneCount', 'workshopFlowLabel', 'backLabel', 'backUrl',
  ];
  allowedFields.forEach(f => { if (body[f] !== undefined) data[f] = body[f]; });
  if (body.batchId !== undefined) data.batchId = body.batchId || null;
  const workshop = await req.server.prisma.workshop.update({ where: { id }, data });
  return reply.send({ success: true, data: workshop, error: null });
}

export async function deleteWorkshopHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  await req.server.prisma.workshop.delete({ where: { id } });
  return reply.send({ success: true, data: null, error: null });
}

// ── ENROLLMENTS ───────────────────────────────────────────────────────

export async function listEnrollmentsHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  const enrollments = await req.server.prisma.workshopEnrollment.findMany({
    where: { workshopId: id },
    include: {
      member: { select: { id: true, firstName: true, lastName: true, email: true, memberId: true } },
    },
    orderBy: { enrolledAt: 'desc' },
  });
  return reply.send({ success: true, data: enrollments, error: null });
}

export async function enrollMembersHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  const { memberIds } = req.body as any;

  const [workshop, created] = await Promise.all([
    req.server.prisma.workshop.findUnique({ where: { id }, select: { title: true } }),
    req.server.prisma.$transaction(
      memberIds.map((memberId: string) =>
        req.server.prisma.workshopEnrollment.upsert({
          where: { workshopId_memberId: { workshopId: id, memberId } },
          update: { status: 'active' },
          create: { workshopId: id, memberId, status: 'active' },
        })
      )
    ),
  ]);

  if (workshop) {
    memberIds.forEach((memberId: string) => {
      req.server.io.to(`user:${memberId}`).emit('workshop:enrolled', {
        workshopId: id,
        workshopTitle: workshop.title,
      });
    });
  }

  return reply.status(201).send({ success: true, data: created, error: null });
}

export async function updateEnrollmentHandler(req: FastifyRequest, reply: FastifyReply) {
  const { enrollmentId } = req.params as any;
  const { status } = req.body as any;
  const enrollment = await req.server.prisma.workshopEnrollment.update({
    where: { id: enrollmentId },
    data: { status, ...(status === 'completed' ? { completedAt: new Date() } : {}) },
  });
  return reply.send({ success: true, data: enrollment, error: null });
}

export async function deleteEnrollmentHandler(req: FastifyRequest, reply: FastifyReply) {
  const { enrollmentId } = req.params as any;

  const enrollment = await req.server.prisma.workshopEnrollment.findUnique({
    where: { id: enrollmentId },
    select: { memberId: true, workshopId: true },
  });

  await req.server.prisma.workshopEnrollment.delete({ where: { id: enrollmentId } });

  if (enrollment) {
    req.server.io.to(`user:${enrollment.memberId}`).emit('workshop:removed', {
      workshopId: enrollment.workshopId,
    });
  }

  return reply.send({ success: true, data: null, error: null });
}

// ── FLOW ──────────────────────────────────────────────────────────────

export async function getWorkshopFlowHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  const items = await req.server.prisma.workshopFlowItem.findMany({
    where: { workshopId: id },
    orderBy: { order: 'asc' },
    include: {
      challenge: { include: { episodes: { orderBy: { order: 'asc' } } } },
      liveCall: true,
    },
  });
  return reply.send({ success: true, data: items, error: null });
}

export async function upsertFlowItemHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id, itemId } = req.params as any;
  const body = req.body as any;
  if (itemId) {
    const item = await req.server.prisma.workshopFlowItem.update({
      where: { id: itemId },
      data: {
        type: body.type,
        label: body.label,
        description: body.description,
        order: body.order,
        challengeId: body.challengeId || null,
        liveCallId: body.liveCallId || null,
      },
    });
    return reply.send({ success: true, data: item, error: null });
  }
  const item = await req.server.prisma.workshopFlowItem.create({
    data: {
      workshopId: id,
      type: body.type,
      label: body.label,
      description: body.description,
      order: body.order ?? 0,
      challengeId: body.challengeId || null,
      liveCallId: body.liveCallId || null,
    },
  });
  return reply.status(201).send({ success: true, data: item, error: null });
}

export async function deleteFlowItemHandler(req: FastifyRequest, reply: FastifyReply) {
  const { itemId } = req.params as any;
  await req.server.prisma.workshopFlowItem.delete({ where: { id: itemId } });
  return reply.send({ success: true, data: null, error: null });
}

export async function reorderFlowHandler(req: FastifyRequest, reply: FastifyReply) {
  const { ids } = req.body as any;
  await req.server.prisma.$transaction(
    ids.map((id: string, idx: number) =>
      req.server.prisma.workshopFlowItem.update({ where: { id }, data: { order: idx } })
    )
  );
  return reply.send({ success: true, data: null, error: null });
}

// ── CHALLENGES ────────────────────────────────────────────────────────

export async function listChallengesHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  const challenges = await req.server.prisma.challenge.findMany({
    where: { workshopId: id },
    orderBy: { order: 'asc' },
    include: {
      episodes: { orderBy: { order: 'asc' } },
      assignments: { orderBy: { order: 'asc' } },
      _count: { select: { episodes: true } },
    },
  });
  return reply.send({ success: true, data: challenges, error: null });
}

export async function createChallengeHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  const body = req.body as any;
  const count = await req.server.prisma.challenge.count({ where: { workshopId: id } });
  const num = Number(body.challengeNumber) || count + 1;
  const challenge = await req.server.prisma.challenge.create({
    data: {
      workshopId: id,
      order: body.order ?? count,
      challengeNumber: num,
      numberLabel: body.numberLabel || `Challenge ${String(num).padStart(2, '0')}:`,
      numberColor: body.numberColor || '#00c4cc',
      title: body.title,
      description: body.description,
    },
  });
  return reply.status(201).send({ success: true, data: challenge, error: null });
}

export async function updateChallengeHandler(req: FastifyRequest, reply: FastifyReply) {
  const { cid } = req.params as any;
  const body = req.body as any;
  const data: any = {};
  ['order', 'challengeNumber', 'numberLabel', 'numberColor', 'title', 'description'].forEach(f => {
    if (body[f] !== undefined) data[f] = body[f];
  });
  const challenge = await req.server.prisma.challenge.update({ where: { id: cid }, data });
  return reply.send({ success: true, data: challenge, error: null });
}

export async function deleteChallengeHandler(req: FastifyRequest, reply: FastifyReply) {
  const { cid } = req.params as any;
  await req.server.prisma.challenge.delete({ where: { id: cid } });
  return reply.send({ success: true, data: null, error: null });
}

// ── EPISODES ──────────────────────────────────────────────────────────

export async function listEpisodesHandler(req: FastifyRequest, reply: FastifyReply) {
  const { cid } = req.params as any;
  const episodes = await req.server.prisma.workshopEpisode.findMany({
    where: { challengeId: cid },
    orderBy: { order: 'asc' },
  });
  return reply.send({ success: true, data: episodes, error: null });
}

export async function createEpisodeHandler(req: FastifyRequest, reply: FastifyReply) {
  const { cid } = req.params as any;
  const body = req.body as any;
  const count = await req.server.prisma.workshopEpisode.count({ where: { challengeId: cid } });
  const episode = await req.server.prisma.workshopEpisode.create({
    data: {
      challengeId: cid,
      order: body.order ?? count,
      title: body.title,
      type: body.type || 'video',
      typeLabel: body.typeLabel || 'Video',
      videoUrl: body.videoUrl,
      bunnyVideoId: body.bunnyVideoId || null,
      durationSeconds: body.durationSeconds ? Number(body.durationSeconds) : null,
      durationLabel: body.durationLabel,
    },
  });
  return reply.status(201).send({ success: true, data: episode, error: null });
}

export async function updateEpisodeHandler(req: FastifyRequest, reply: FastifyReply) {
  const { eid } = req.params as any;
  const body = req.body as any;
  const data: any = {};
  ['order', 'title', 'type', 'typeLabel', 'videoUrl', 'bunnyVideoId', 'durationLabel'].forEach(f => {
    if (body[f] !== undefined) data[f] = body[f];
  });
  if (body.durationSeconds !== undefined) data.durationSeconds = body.durationSeconds ? Number(body.durationSeconds) : null;
  const episode = await req.server.prisma.workshopEpisode.update({ where: { id: eid }, data });
  return reply.send({ success: true, data: episode, error: null });
}

export async function deleteEpisodeHandler(req: FastifyRequest, reply: FastifyReply) {
  const { eid } = req.params as any;
  await req.server.prisma.workshopEpisode.delete({ where: { id: eid } });
  return reply.send({ success: true, data: null, error: null });
}

export async function reorderEpisodesHandler(req: FastifyRequest, reply: FastifyReply) {
  const { ids } = req.body as any;
  await req.server.prisma.$transaction(
    ids.map((id: string, i: number) =>
      req.server.prisma.workshopEpisode.update({ where: { id }, data: { order: i } })
    )
  );
  return reply.send({ success: true, data: null, error: null });
}

// ── LIVE CALLS ────────────────────────────────────────────────────────

export async function listLiveCallsHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  const calls = await req.server.prisma.liveCall.findMany({
    where: { workshopId: id },
    orderBy: { scheduledAt: 'asc' },
  });
  return reply.send({ success: true, data: calls, error: null });
}

export async function createLiveCallHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  const body = req.body as any;
  const count = await req.server.prisma.liveCall.count({ where: { workshopId: id } });
  const call = await req.server.prisma.liveCall.create({
    data: {
      workshopId: id,
      order: body.order ?? count,
      type: body.type || 'custom',
      label: body.label || 'LIVE CALL:',
      labelColor: body.labelColor || '#ff3d8b',
      title: body.title,
      scheduledAt: new Date(body.scheduledAt),
      liveUrl: body.liveUrl || null,
      liveUrlUnlocksMinutesBefore: Number(body.liveUrlUnlocksMinutesBefore) || 30,
      recordingUrl: body.recordingUrl || null,
      recordingLabel: body.recordingLabel || null,
      prerequisiteNote: body.prerequisiteNote || null,
      facilitatorName: body.facilitatorName || null,
      facilitatorTitle: body.facilitatorTitle || null,
      facilitatorDescription: body.facilitatorDescription || null,
      stayTunedMessage: body.stayTunedMessage || 'Stay tuned — the link will unlock before the session begins',
      stayTunedColor: body.stayTunedColor || '#00c4cc',
    },
  });
  return reply.status(201).send({ success: true, data: call, error: null });
}

export async function updateLiveCallHandler(req: FastifyRequest, reply: FastifyReply) {
  const { lcid } = req.params as any;
  const body = req.body as any;
  const data: any = {};
  ['order', 'type', 'label', 'labelColor', 'title', 'liveUrl', 'liveUrlUnlocksMinutesBefore',
   'recordingUrl', 'recordingLabel', 'prerequisiteNote', 'facilitatorName',
   'facilitatorTitle', 'facilitatorDescription', 'stayTunedMessage', 'stayTunedColor'].forEach(f => {
    if (body[f] !== undefined) data[f] = body[f];
  });
  if (body.scheduledAt) data.scheduledAt = new Date(body.scheduledAt);
  const call = await req.server.prisma.liveCall.update({ where: { id: lcid }, data });
  return reply.send({ success: true, data: call, error: null });
}

export async function deleteLiveCallHandler(req: FastifyRequest, reply: FastifyReply) {
  const { lcid } = req.params as any;
  await req.server.prisma.liveCall.delete({ where: { id: lcid } });
  return reply.send({ success: true, data: null, error: null });
}

// ── ASSIGNMENTS ───────────────────────────────────────────────────────

export async function listAssignmentsHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  const challenges = await req.server.prisma.challenge.findMany({
    where: { workshopId: id },
    orderBy: { order: 'asc' },
    include: {
      assignments: {
        orderBy: { order: 'asc' },
        include: { _count: { select: { submissions: true } } },
      },
    },
  });
  return reply.send({ success: true, data: challenges, error: null });
}

export async function createAssignmentHandler(req: FastifyRequest, reply: FastifyReply) {
  const body = req.body as any;
  const assignment = await req.server.prisma.assignment.create({
    data: {
      challengeId: body.challengeId,
      order: body.order || 0,
      title: body.title,
      questionText: body.questionText,
      typeLabel: body.typeLabel || 'QUESTION',
    },
  });
  return reply.status(201).send({ success: true, data: assignment, error: null });
}

export async function updateAssignmentHandler(req: FastifyRequest, reply: FastifyReply) {
  const { aid } = req.params as any;
  const body = req.body as any;
  const data: any = {};
  ['title', 'questionText', 'typeLabel', 'order'].forEach(f => {
    if (body[f] !== undefined) data[f] = body[f];
  });
  const assignment = await req.server.prisma.assignment.update({ where: { id: aid }, data });
  return reply.send({ success: true, data: assignment, error: null });
}

export async function deleteAssignmentHandler(req: FastifyRequest, reply: FastifyReply) {
  const { aid } = req.params as any;
  await req.server.prisma.assignment.delete({ where: { id: aid } });
  return reply.send({ success: true, data: null, error: null });
}

export async function listSubmissionsHandler(req: FastifyRequest, reply: FastifyReply) {
  const { aid } = req.params as any;
  const submissions = await req.server.prisma.assignmentSubmission.findMany({
    where: { assignmentId: aid },
    include: {
      member: { select: { id: true, firstName: true, lastName: true, email: true, memberId: true } },
    },
    orderBy: { submittedAt: 'desc' },
  });
  return reply.send({ success: true, data: submissions, error: null });
}

// ── Q&A ───────────────────────────────────────────────────────────────

export async function listQAHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  const { page = 1, limit = 20 } = req.query as any;
  const [posts, total] = await Promise.all([
    req.server.prisma.qAPost.findMany({
      where: { workshopId: id },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
      include: {
        member: { select: { id: true, firstName: true, lastName: true, profilePhotoUrl: true } },
        replies: {
          include: {
            member: { select: { id: true, firstName: true, lastName: true } },
            admin: { select: { id: true, fullName: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        _count: { select: { replies: true } },
      },
    }),
    req.server.prisma.qAPost.count({ where: { workshopId: id } }),
  ]);
  return reply.send({ success: true, data: posts, meta: { total, page: Number(page), limit: Number(limit) }, error: null });
}

export async function replyQAHandler(req: FastifyRequest, reply: FastifyReply) {
  const { postId } = req.params as any;
  const { replyText } = req.body as any;
  const admin = (req as any).admin;
  const qaReply = await req.server.prisma.qAReply.create({
    data: { postId, replyText, adminId: admin?.id || null },
  });
  return reply.status(201).send({ success: true, data: qaReply, error: null });
}

export async function deleteQAPostHandler(req: FastifyRequest, reply: FastifyReply) {
  const { postId } = req.params as any;
  await req.server.prisma.qAPost.delete({ where: { id: postId } });
  return reply.send({ success: true, data: null, error: null });
}

export async function deleteQAReplyHandler(req: FastifyRequest, reply: FastifyReply) {
  const { replyId } = req.params as any;
  await req.server.prisma.qAReply.delete({ where: { id: replyId } });
  return reply.send({ success: true, data: null, error: null });
}

// ── PROGRESS ──────────────────────────────────────────────────────────

export async function getMemberProgressHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id, memberId } = req.params as any;
  const challenges = await req.server.prisma.challenge.findMany({
    where: { workshopId: id },
    orderBy: { order: 'asc' },
    include: {
      episodes: { include: { progress: { where: { memberId } } } },
      assignments: { include: { submissions: { where: { memberId } } } },
    },
  });
  const result = challenges.map(c => {
    const totalEp = c.episodes.length;
    const completedEp = c.episodes.filter(e => e.progress[0]?.isCompleted).length;
    return {
      id: c.id,
      title: c.title,
      challengeNumber: c.challengeNumber,
      totalEpisodes: totalEp,
      completedEpisodes: completedEp,
      percent: totalEp > 0 ? Math.round((completedEp / totalEp) * 100) : 0,
      assignments: c.assignments.map(a => ({
        id: a.id,
        title: a.title,
        isSubmitted: a.submissions.length > 0,
        submittedAt: a.submissions[0]?.submittedAt || null,
      })),
    };
  });
  const totalEp = result.reduce((s, c) => s + c.totalEpisodes, 0);
  const completedEp = result.reduce((s, c) => s + c.completedEpisodes, 0);
  return reply.send({
    success: true,
    data: {
      challenges: result,
      totalEpisodes: totalEp,
      completedEpisodes: completedEp,
      overallPercent: totalEp > 0 ? Math.round((completedEp / totalEp) * 100) : 0,
    },
    error: null,
  });
}
