import type { FastifyRequest, FastifyReply } from 'fastify';
import { env } from '../../config/env.js';

// ── BUNNY STREAM DURATION HELPER ──────────────────────────────────────

export async function fetchBunnyDuration(bunnyVideoId: string): Promise<number | null> {
  const apiKey = env.BUNNY_STREAM_API_KEY;
  const libraryId = env.BUNNY_STREAM_LIBRARY_ID;
  if (!apiKey || !libraryId) return null;
  try {
    const res = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos/${bunnyVideoId}`, {
      headers: { AccessKey: apiKey, accept: 'application/json' },
    });
    if (!res.ok) return null;
    const json = await res.json() as any;
    const length = Number(json.length ?? json.duration ?? 0);
    return length > 0 ? length : null;
  } catch {
    return null;
  }
}

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
      type: body.type || 'watch',
      ...(body.quizData !== undefined ? { quizData: body.quizData } : {}),
    },
  });
  return reply.status(201).send({ success: true, data: challenge, error: null });
}

export async function updateChallengeHandler(req: FastifyRequest, reply: FastifyReply) {
  const { cid } = req.params as any;
  const body = req.body as any;
  const data: any = {};
  ['order', 'challengeNumber', 'numberLabel', 'numberColor', 'title', 'description', 'type', 'quizData'].forEach(f => {
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
  const bunnyVideoId = body.bunnyVideoId || null;
  const bunnyDuration = bunnyVideoId ? await fetchBunnyDuration(bunnyVideoId) : null;
  const durationSeconds = bunnyDuration ?? (body.durationSeconds ? Number(body.durationSeconds) : null);
  const episode = await req.server.prisma.workshopEpisode.create({
    data: {
      challengeId: cid,
      order: body.order ?? count,
      title: body.title,
      type: body.type || 'video',
      typeLabel: body.typeLabel || 'Video',
      videoUrl: body.videoUrl,
      bunnyVideoId,
      durationSeconds,
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
  // Determine which bunnyVideoId to use for duration lookup
  let bunnyVideoId: string | null;
  if (body.bunnyVideoId !== undefined) {
    bunnyVideoId = body.bunnyVideoId || null;
  } else {
    const existing = await req.server.prisma.workshopEpisode.findUnique({ where: { id: eid }, select: { bunnyVideoId: true } });
    bunnyVideoId = existing?.bunnyVideoId ?? null;
  }
  // Prefer Bunny API truth; fall back to manual entry if Bunny unavailable
  const bunnyDuration = bunnyVideoId ? await fetchBunnyDuration(bunnyVideoId) : null;
  if (bunnyDuration !== null) {
    data.durationSeconds = bunnyDuration;
  } else if (body.durationSeconds !== undefined) {
    data.durationSeconds = body.durationSeconds ? Number(body.durationSeconds) : null;
  }
  const episode = await req.server.prisma.workshopEpisode.update({ where: { id: eid }, data });
  return reply.send({ success: true, data: episode, error: null });
}

export async function deleteEpisodeHandler(req: FastifyRequest, reply: FastifyReply) {
  const { eid } = req.params as any;
  await req.server.prisma.workshopEpisode.delete({ where: { id: eid } });
  return reply.send({ success: true, data: null, error: null });
}

export async function syncEpisodeDurationsHandler(req: FastifyRequest, reply: FastifyReply) {
  if (!env.BUNNY_STREAM_API_KEY || !env.BUNNY_STREAM_LIBRARY_ID) {
    return reply.status(400).send({ success: false, data: null, error: 'BUNNY_STREAM_API_KEY and BUNNY_STREAM_LIBRARY_ID are not configured in environment.' });
  }
  const episodes = await req.server.prisma.workshopEpisode.findMany({
    where: { bunnyVideoId: { not: null } },
    select: { id: true, bunnyVideoId: true, durationSeconds: true },
  });
  let updated = 0;
  for (const ep of episodes) {
    const real = await fetchBunnyDuration(ep.bunnyVideoId!);
    if (real !== null && real !== ep.durationSeconds) {
      await req.server.prisma.workshopEpisode.update({ where: { id: ep.id }, data: { durationSeconds: real } });
      updated++;
    }
  }
  return reply.send({ success: true, data: { total: episodes.length, updated }, error: null });
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
      isWebinar: body.isWebinar === true,
      externalMeetingUrl: body.externalMeetingUrl || null,
      externalMeetingProvider: body.externalMeetingProvider || null,
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
   'facilitatorTitle', 'facilitatorDescription', 'stayTunedMessage', 'stayTunedColor',
   'isWebinar', 'waitingRoomEnabled', 'passcode',
   'externalMeetingUrl', 'externalMeetingProvider'].forEach(f => {
    if (body[f] !== undefined) data[f] = body[f];
  });
  // UUID FK fields — coerce empty string to null so Postgres doesn't reject it
  for (const f of ['prerequisiteChallengeId', 'postSessionUnlockChallengeId'] as const) {
    if (body[f] !== undefined) data[f] = body[f] || null;
  }
  if (body.scheduledAt) data.scheduledAt = new Date(body.scheduledAt);
  // Clear endedAt whenever the call is edited so it becomes joinable again
  data.endedAt = null;
  const call = await req.server.prisma.liveCall.update({ where: { id: lcid }, data });
  return reply.send({ success: true, data: call, error: null });
}

export async function deleteLiveCallHandler(req: FastifyRequest, reply: FastifyReply) {
  const { lcid } = req.params as any;
  await req.server.prisma.liveCall.delete({ where: { id: lcid } });
  return reply.send({ success: true, data: null, error: null });
}

export async function getLiveCallStatusHandler(req: FastifyRequest, reply: FastifyReply) {
  const { lcid } = req.params as any;
  const { env } = await import('../../config/env.js');

  const lc = await req.server.prisma.liveCall.findUnique({
    where: { id: lcid },
    select: { id: true, startedAt: true, endedAt: true },
  });
  if (!lc) return reply.status(404).send({ success: false, data: null, error: { code: 'ERROR', message: 'Not found' } });

  let participantCount = 0;
  if (env.LIVEKIT_API_KEY && env.LIVEKIT_API_SECRET && env.LIVEKIT_WS_URL && lc.startedAt && !lc.endedAt) {
    try {
      const { RoomServiceClient } = await import('livekit-server-sdk');
      const httpUrl = env.LIVEKIT_WS_URL.replace(/^wss?:\/\//, 'https://');
      const svc = new RoomServiceClient(httpUrl, env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET);
      const participants = await svc.listParticipants(`workshop-live-${lcid}`);
      participantCount = participants.length;
    } catch {
      // Room not active yet or service unavailable
    }
  }

  const isLive = !!lc.startedAt && !lc.endedAt;
  return reply.send({ success: true, data: { isLive, participantCount, startedAt: lc.startedAt, endedAt: lc.endedAt }, error: null });
}

export async function getLiveCallHostTokenHandler(req: FastifyRequest, reply: FastifyReply) {
  const { lcid } = req.params as any;
  const { env } = await import('../../config/env.js');

  if (!env.LIVEKIT_API_KEY || !env.LIVEKIT_API_SECRET || !env.LIVEKIT_WS_URL) {
    return reply.status(503).send({ success: false, data: null, error: { code: 'ERROR', message: 'Live call service not configured' } });
  }

  const lc = await req.server.prisma.liveCall.findUnique({
    where: { id: lcid },
    select: { id: true, title: true, workshopId: true, startedAt: true },
  });
  if (!lc) return reply.status(404).send({ success: false, data: null, error: { code: 'ERROR', message: 'Not found' } });

  // Look up admin name from DB
  const admin = await req.server.prisma.admin.findFirst({
    where: { clerkId: req.user },
    select: { fullName: true },
  });
  const hostName = admin?.fullName || 'Host';

  const { AccessToken } = await import('livekit-server-sdk');

  const roomName = `workshop-live-${lcid}`;
  const at = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
    identity: req.user || `host-${lcid}`,
    name: hostName,
    ttl: '8h',
  });

  at.addGrant({
    room: roomName,
    roomJoin: true,
    roomAdmin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  const token = await at.toJwt();

  // Always clear endedAt so re-joining after a previous end re-opens the room.
  // Stamp startedAt only on the very first host join.
  const isFirstJoin = !lc.startedAt;
  await req.server.prisma.liveCall.update({
    where: { id: lcid },
    data: { endedAt: null, ...(isFirstJoin ? { startedAt: new Date() } : {}) },
  });

  if (isFirstJoin) {
    // Notify all enrolled members in this workshop via socket
    try {
      const enrollments = await req.server.prisma.workshopEnrollment.findMany({
        where: { workshopId: lc.workshopId },
        select: { memberId: true },
      });
      const notifPayload = {
        title: 'Live Session Started',
        body: `${lc.title} is now live — join now!`,
        type: 'live_call',
        actionUrl: `/workshop`,
      };
      for (const { memberId } of enrollments) {
        req.server.io.to(`user:${memberId}`).emit('notification', notifPayload);
      }
    } catch {
      // Non-fatal — notification failure should not block the host
    }
  }

  return reply.send({ success: true, data: { token, wsUrl: env.LIVEKIT_WS_URL, roomName }, error: null });
}

export async function endLiveCallHandler(req: FastifyRequest, reply: FastifyReply) {
  const { lcid } = req.params as any;
  const { env } = await import('../../config/env.js');

  if (!env.LIVEKIT_API_KEY || !env.LIVEKIT_API_SECRET || !env.LIVEKIT_WS_URL) {
    return reply.status(503).send({ success: false, data: null, error: { code: 'ERROR', message: 'Live call service not configured' } });
  }

  const lc = await req.server.prisma.liveCall.findUnique({
    where: { id: lcid },
    select: { id: true, workshopId: true, postSessionUnlockChallengeId: true },
  });
  if (!lc) return reply.status(404).send({ success: false, data: null, error: { code: 'ERROR', message: 'Not found' } });

  const { RoomServiceClient } = await import('livekit-server-sdk');
  const httpUrl = env.LIVEKIT_WS_URL.replace(/^wss?:\/\//, 'https://');
  const svc = new RoomServiceClient(httpUrl, env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET);

  try {
    await svc.deleteRoom(`workshop-live-${lcid}`);
  } catch {
    // Room may not exist — not an error
  }

  // Stamp endedAt so users see "Session Completed" from this point on
  await req.server.prisma.liveCall.update({ where: { id: lcid }, data: { endedAt: new Date() } });

  // Auto-unlock post-session challenge for all active enrollees
  if (lc.postSessionUnlockChallengeId) {
    const enrollments = await req.server.prisma.workshopEnrollment.findMany({
      where: { workshopId: lc.workshopId, status: 'active' },
      select: { memberId: true },
    });
    await Promise.allSettled(enrollments.map(e =>
      req.server.prisma.memberChallengeProgress.upsert({
        where: { memberId_challengeId: { memberId: e.memberId, challengeId: lc.postSessionUnlockChallengeId! } },
        create: { memberId: e.memberId, challengeId: lc.postSessionUnlockChallengeId!, status: 'not_started' },
        update: {},
      })
    ));
  }

  return reply.send({ success: true, data: null, error: null });
}

// ── CO-HOST PROMOTION ──────────────────────────────────────────────────

export async function promoteCoHostHandler(req: FastifyRequest, reply: FastifyReply) {
  const { lcid, memberId } = req.params as any;
  const { env } = await import('../../config/env.js');

  if (!env.LIVEKIT_API_KEY || !env.LIVEKIT_API_SECRET || !env.LIVEKIT_WS_URL) {
    return reply.status(503).send({ success: false, data: null, error: { code: 'ERROR', message: 'Live call service not configured' } });
  }

  const lc = await req.server.prisma.liveCall.findUnique({ where: { id: lcid }, select: { id: true } });
  if (!lc) return reply.status(404).send({ success: false, data: null, error: { code: 'ERROR', message: 'Not found' } });

  const { RoomServiceClient, AccessToken } = await import('livekit-server-sdk');
  const httpUrl = env.LIVEKIT_WS_URL.replace(/^wss?:\/\//, 'https://');
  const svc = new RoomServiceClient(httpUrl, env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET);

  let fallbackToken: string | undefined;
  try {
    // Grant publish permissions in-room without forcing the participant to reconnect
    await svc.updateParticipant(`workshop-live-${lcid}`, memberId, undefined, {
      canPublish: true,
      canPublishData: true,
      canSubscribe: true,
    });
  } catch {
    // Participant not in room yet — generate a new token so they can reconnect with publish rights
    const member = await req.server.prisma.member.findUnique({
      where: { id: memberId },
      select: { firstName: true, lastName: true },
    });
    const at = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
      identity: memberId,
      name: [member?.firstName, member?.lastName].filter(Boolean).join(' ') || memberId,
      ttl: '4h',
    });
    at.addGrant({ room: `workshop-live-${lcid}`, roomJoin: true, canPublish: true, canPublishData: true, canSubscribe: true });
    fallbackToken = await at.toJwt();
  }

  req.server.io.to(`user:${memberId}`).emit('live_call:promoted_co_host', {
    liveCallId: lcid,
    ...(fallbackToken ? { token: fallbackToken, wsUrl: env.LIVEKIT_WS_URL } : {}),
  });

  return reply.send({ success: true, data: null, error: null });
}

// ── ATTENDANCE CERTIFICATES ───────────────────────────────────────────

async function uploadBufferToR2(key: string, buffer: Buffer, contentType: string, envCfg: any): Promise<string> {
  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${envCfg.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: envCfg.CLOUDFLARE_R2_ACCESS_KEY_ID || '',
      secretAccessKey: envCfg.CLOUDFLARE_R2_SECRET_ACCESS_KEY || '',
    },
  });
  await s3.send(new PutObjectCommand({
    Bucket: envCfg.CLOUDFLARE_R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));
  return `https://${envCfg.BUNNY_CDN_URL}/${key}`;
}

async function generateCertificatePdf(
  memberName: string,
  sessionTitle: string,
  sessionDate: string,
  attendancePercent: number,
  facilitatorName?: string | null,
): Promise<Buffer> {
  const { default: PDFDocument } = await import('pdfkit');
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 60 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width;
    const bgColor = '#0d0d0d';
    const accentColor = '#dc2626';
    const textPrimary = '#ffffff';
    const textSecondary = '#a0a0a0';
    const borderColor = '#dc2626';

    // Background
    doc.rect(0, 0, W, doc.page.height).fill(bgColor);

    // Border
    doc.rect(24, 24, W - 48, doc.page.height - 48)
       .lineWidth(2)
       .stroke(borderColor);

    // Accent lines
    doc.moveTo(60, 80).lineTo(W - 60, 80).lineWidth(0.5).stroke('#444');
    doc.moveTo(60, doc.page.height - 80).lineTo(W - 60, doc.page.height - 80).lineWidth(0.5).stroke('#444');

    let y = 110;

    // Header label
    doc.fillColor(accentColor)
       .fontSize(10)
       .font('Helvetica-Bold')
       .text('TAMIL BUSINESS TRIBE', { align: 'center' });
    y += 22;

    // Title
    doc.fillColor(textPrimary)
       .fontSize(32)
       .font('Helvetica-Bold')
       .text('CERTIFICATE OF ATTENDANCE', { align: 'center' });
    y += 60;

    // Divider
    doc.fillColor('#333').rect(W / 2 - 40, y, 80, 1).fill();
    y += 20;

    // Presented to
    doc.fillColor(textSecondary).fontSize(12).font('Helvetica').text('This certifies that', { align: 'center' });
    y += 26;

    // Member name
    doc.fillColor(textPrimary).fontSize(28).font('Helvetica-Bold').text(memberName, { align: 'center' });
    y += 50;

    // Description
    doc.fillColor(textSecondary).fontSize(12).font('Helvetica').text('attended the live session', { align: 'center' });
    y += 22;

    // Session title
    doc.fillColor(accentColor).fontSize(18).font('Helvetica-Bold').text(sessionTitle, { align: 'center' });
    y += 40;

    // Details row
    const details = [
      `Date: ${sessionDate}`,
      `Attendance: ${attendancePercent}%`,
      ...(facilitatorName ? [`Facilitator: ${facilitatorName}`] : []),
    ].join('   ·   ');
    doc.fillColor(textSecondary).fontSize(11).font('Helvetica').text(details, { align: 'center' });

    doc.end();
  });
}

export async function generateCertificatesHandler(req: FastifyRequest, reply: FastifyReply) {
  const { lcid } = req.params as any;
  const { minAttendancePercent = 70 } = (req.body as any) ?? {};
  const { env } = await import('../../config/env.js');

  const lc = await req.server.prisma.liveCall.findUnique({
    where: { id: lcid },
    select: { id: true, title: true, startedAt: true, endedAt: true, facilitatorName: true },
  });
  if (!lc) return reply.status(404).send({ success: false, data: null, error: { code: 'ERROR', message: 'Not found' } });
  if (!lc.startedAt || !lc.endedAt) {
    return reply.status(400).send({ success: false, data: null, error: { code: 'ERROR', message: 'Session has not ended yet' } });
  }

  const sessionDurationSec = Math.max(1, Math.round((lc.endedAt.getTime() - lc.startedAt.getTime()) / 1000));

  // Aggregate attendance per member
  const attendance = await req.server.prisma.liveCallAttendance.findMany({
    where: { liveCallId: lcid, memberId: { not: null } },
    select: { memberId: true, durationSec: true, member: { select: { firstName: true, lastName: true } } },
  });

  const memberMap = new Map<string, { name: string; totalSec: number }>();
  for (const a of attendance) {
    if (!a.memberId) continue;
    const name = [a.member?.firstName, a.member?.lastName].filter(Boolean).join(' ') || 'Member';
    const existing = memberMap.get(a.memberId);
    memberMap.set(a.memberId, {
      name,
      totalSec: (existing?.totalSec ?? 0) + (a.durationSec ?? 0),
    });
  }

  const sessionDate = lc.startedAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const canUpload = !!(env.CLOUDFLARE_R2_ACCESS_KEY_ID && env.CLOUDFLARE_R2_SECRET_ACCESS_KEY && env.CLOUDFLARE_R2_ACCOUNT_ID && env.BUNNY_CDN_URL);

  let generated = 0;
  const errors: string[] = [];

  await Promise.allSettled(Array.from(memberMap.entries()).map(async ([memberId, info]) => {
    const pct = Math.min(100, Math.round((info.totalSec / sessionDurationSec) * 100));
    if (pct < minAttendancePercent) return;

    try {
      let certUrl = `https://tbt.internal/certificates/${lcid}/${memberId}`;
      if (canUpload) {
        const pdfBuf = await generateCertificatePdf(info.name, lc.title, sessionDate, pct, lc.facilitatorName);
        const key = `certificates/${lcid}/${memberId}.pdf`;
        certUrl = await uploadBufferToR2(key, pdfBuf, 'application/pdf', env);
      }

      await req.server.prisma.liveCallCertificate.upsert({
        where: { liveCallId_memberId: { liveCallId: lcid, memberId } },
        create: { liveCallId: lcid, memberId, attendancePercent: pct, certificateUrl: certUrl },
        update: { attendancePercent: pct, certificateUrl: certUrl },
      });
      generated++;
    } catch (err: any) {
      errors.push(`${memberId}: ${err.message}`);
    }
  }));

  if (errors.length) req.log.warn({ errors }, 'Some certificates failed to generate');

  return reply.send({ success: true, data: { generated, errors: errors.length }, error: null });
}

// ── HOST CONTROLS ─────────────────────────────────────────────────────

async function getLkSvc(env: any) {
  const { RoomServiceClient } = await import('livekit-server-sdk');
  const httpUrl = (env.LIVEKIT_WS_URL as string).replace(/^wss?:\/\//, 'https://');
  return new RoomServiceClient(httpUrl, env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET);
}

export async function muteParticipantHandler(req: FastifyRequest, reply: FastifyReply) {
  const { lcid, identity } = req.params as any;
  const { trackSid, muted = true } = req.body as any;
  const { env } = await import('../../config/env.js');
  if (!env.LIVEKIT_API_KEY) return reply.status(503).send({ success: false, data: null, error: { code: 'ERROR', message: 'Not configured' } });
  const svc = await getLkSvc(env);
  await svc.mutePublishedTrack(`workshop-live-${lcid}`, identity, trackSid, muted);
  return reply.send({ success: true, data: null, error: null });
}

export async function removeParticipantHandler(req: FastifyRequest, reply: FastifyReply) {
  const { lcid, identity } = req.params as any;
  const { env } = await import('../../config/env.js');
  if (!env.LIVEKIT_API_KEY) return reply.status(503).send({ success: false, data: null, error: { code: 'ERROR', message: 'Not configured' } });
  const svc = await getLkSvc(env);
  await svc.removeParticipant(`workshop-live-${lcid}`, identity);
  return reply.send({ success: true, data: null, error: null });
}

export async function muteAllHandler(req: FastifyRequest, reply: FastifyReply) {
  const { lcid } = req.params as any;
  const { env } = await import('../../config/env.js');
  if (!env.LIVEKIT_API_KEY) return reply.status(503).send({ success: false, data: null, error: { code: 'ERROR', message: 'Not configured' } });
  const svc = await getLkSvc(env);
  const roomName = `workshop-live-${lcid}`;
  const participants = await svc.listParticipants(roomName);
  for (const p of participants) {
    if (p.identity?.startsWith('user_')) continue; // skip host
    for (const track of p.tracks ?? []) {
      if (track.type === 0 /* AUDIO */ && !track.muted) {
        await svc.mutePublishedTrack(roomName, p.identity!, track.sid!, true).catch(() => {});
      }
    }
  }
  return reply.send({ success: true, data: null, error: null });
}

export async function lockRoomHandler(req: FastifyRequest, reply: FastifyReply) {
  const { lcid } = req.params as any;
  const { locked } = req.body as any;
  const call = await req.server.prisma.liveCall.update({
    where: { id: lcid },
    data: { isLocked: !!locked },
    select: { id: true, isLocked: true },
  });
  // Emit socket so members know immediately
  const enrollments = await req.server.prisma.workshopEnrollment.findMany({
    where: { workshop: { liveCalls: { some: { id: lcid } } } },
    select: { memberId: true },
  });
  for (const { memberId } of enrollments) {
    req.server.io.to(`user:${memberId}`).emit('live_call:lock', { liveCallId: lcid, isLocked: call.isLocked });
  }
  return reply.send({ success: true, data: call, error: null });
}

export async function admitParticipantHandler(req: FastifyRequest, reply: FastifyReply) {
  const { lcid } = req.params as any;
  const { memberId } = req.body as any;
  // Emit socket to the member telling them they've been admitted
  req.server.io.to(`user:${memberId}`).emit('live_call:admitted', { liveCallId: lcid });
  return reply.send({ success: true, data: null, error: null });
}

// ── RECORDING ─────────────────────────────────────────────────────────

export async function startRecordingHandler(req: FastifyRequest, reply: FastifyReply) {
  const { lcid } = req.params as any;
  const { env } = await import('../../config/env.js');
  if (!env.LIVEKIT_API_KEY || !env.LIVEKIT_API_SECRET || !env.LIVEKIT_WS_URL) {
    return reply.status(503).send({ success: false, data: null, error: { code: 'ERROR', message: 'Not configured' } });
  }

  const lc = await req.server.prisma.liveCall.findUnique({ where: { id: lcid }, select: { id: true, egressId: true } });
  if (!lc) return reply.status(404).send({ success: false, data: null, error: { code: 'ERROR', message: 'Not found' } });
  if (lc.egressId) return reply.status(409).send({ success: false, data: null, error: { code: 'ERROR', message: 'Already recording' } });

  const { EgressClient } = await import('livekit-server-sdk');
  const httpUrl = env.LIVEKIT_WS_URL.replace(/^wss?:\/\//, 'https://');
  const egress = new EgressClient(httpUrl, env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET);

  const output = { fileType: 0 /* MP4 */, filepath: `recordings/workshop-live-${lcid}-{time}.mp4` };
  const info = await egress.startRoomCompositeEgress(`workshop-live-${lcid}`, { file: output } as any);
  const egressId = info.egressId;

  await req.server.prisma.liveCall.update({ where: { id: lcid }, data: { egressId, recordingStartedAt: new Date() } });
  return reply.send({ success: true, data: { egressId }, error: null });
}

export async function stopRecordingHandler(req: FastifyRequest, reply: FastifyReply) {
  const { lcid } = req.params as any;
  const { env } = await import('../../config/env.js');
  if (!env.LIVEKIT_API_KEY || !env.LIVEKIT_API_SECRET || !env.LIVEKIT_WS_URL) {
    return reply.status(503).send({ success: false, data: null, error: { code: 'ERROR', message: 'Not configured' } });
  }

  const lc = await req.server.prisma.liveCall.findUnique({ where: { id: lcid }, select: { id: true, egressId: true } });
  if (!lc) return reply.status(404).send({ success: false, data: null, error: { code: 'ERROR', message: 'Not found' } });
  if (!lc.egressId) return reply.status(409).send({ success: false, data: null, error: { code: 'ERROR', message: 'Not recording' } });

  const { EgressClient } = await import('livekit-server-sdk');
  const httpUrl = env.LIVEKIT_WS_URL.replace(/^wss?:\/\//, 'https://');
  const egress = new EgressClient(httpUrl, env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET);
  await egress.stopEgress(lc.egressId);

  await req.server.prisma.liveCall.update({ where: { id: lcid }, data: { egressId: null } });
  return reply.send({ success: true, data: null, error: null });
}

// ── POLLS ─────────────────────────────────────────────────────────────

export async function createPollHandler(req: FastifyRequest, reply: FastifyReply) {
  const { lcid } = req.params as any;
  const { question, options, endsAt } = req.body as { question: string; options: string[]; endsAt?: string };

  const poll = await req.server.prisma.liveCallPoll.create({
    data: {
      liveCallId: lcid,
      question,
      endsAt: endsAt ? new Date(endsAt) : null,
      options: {
        create: options.map((optionText, i) => ({ optionText, order: i })),
      },
    },
    include: { options: { orderBy: { order: 'asc' } } },
  });

  // Broadcast to all enrolled members via socket
  const enrollments = await req.server.prisma.workshopEnrollment.findMany({
    where: { workshop: { liveCalls: { some: { id: lcid } } } },
    select: { memberId: true },
  });
  for (const { memberId } of enrollments) {
    req.server.io.to(`user:${memberId}`).emit('live_call:poll', { liveCallId: lcid, poll });
  }

  return reply.status(201).send({ success: true, data: poll, error: null });
}

export async function closePollHandler(req: FastifyRequest, reply: FastifyReply) {
  const { pollId } = req.params as any;
  const poll = await req.server.prisma.liveCallPoll.update({
    where: { id: pollId },
    data: { isActive: false },
    include: {
      options: {
        include: { _count: { select: { votes: true } } },
        orderBy: { order: 'asc' },
      },
    },
  });
  // Broadcast results
  const enrollments = await req.server.prisma.workshopEnrollment.findMany({
    where: { workshop: { liveCalls: { some: { id: poll.liveCallId } } } },
    select: { memberId: true },
  });
  for (const { memberId } of enrollments) {
    req.server.io.to(`user:${memberId}`).emit('live_call:poll_closed', { pollId, results: poll.options });
  }
  return reply.send({ success: true, data: poll, error: null });
}

export async function getPollsHandler(req: FastifyRequest, reply: FastifyReply) {
  const { lcid } = req.params as any;
  const polls = await req.server.prisma.liveCallPoll.findMany({
    where: { liveCallId: lcid },
    orderBy: { createdAt: 'desc' },
    include: {
      options: {
        include: { _count: { select: { votes: true } } },
        orderBy: { order: 'asc' },
      },
    },
  });
  return reply.send({ success: true, data: polls, error: null });
}

// ── ATTENDANCE ────────────────────────────────────────────────────────

export async function getAttendanceHandler(req: FastifyRequest, reply: FastifyReply) {
  const { lcid } = req.params as any;
  const records = await req.server.prisma.liveCallAttendance.findMany({
    where: { liveCallId: lcid },
    orderBy: { joinedAt: 'asc' },
    include: {
      member: { select: { id: true, firstName: true, lastName: true, email: true, memberId: true } },
    },
  });
  return reply.send({ success: true, data: records, error: null });
}

// ── REMINDERS ─────────────────────────────────────────────────────────

export async function sendRemindersHandler(req: FastifyRequest, reply: FastifyReply) {
  const { lcid } = req.params as any;
  const lc = await req.server.prisma.liveCall.findUnique({
    where: { id: lcid },
    select: { id: true, title: true, scheduledAt: true, workshopId: true },
  });
  if (!lc) return reply.status(404).send({ success: false, data: null, error: { code: 'ERROR', message: 'Not found' } });

  const enrollments = await req.server.prisma.workshopEnrollment.findMany({
    where: { workshopId: lc.workshopId },
    include: { member: { select: { id: true, firstName: true, email: true, phone: true } } },
  });

  const { env } = await import('../../config/env.js');
  const scheduledTime = lc.scheduledAt ? new Date(lc.scheduledAt).toLocaleString() : 'soon';

  // Lazy-init shared clients once
  const resend = env.RESEND_API_KEY ? new (await import('resend')).Resend(env.RESEND_API_KEY) : null;
  const twilioClient = (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN)
    ? (await import('twilio')).default(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN)
    : null;

  let emailsSent = 0, smsSent = 0;

  // Process in batches of 20 to avoid overwhelming external APIs while still parallelising
  const BATCH = 20;
  for (let i = 0; i < enrollments.length; i += BATCH) {
    const batch = enrollments.slice(i, i + BATCH);
    const results = await Promise.allSettled(batch.map(async ({ member }) => {
      // In-app notification via socket (synchronous emit, no await needed)
      req.server.io.to(`user:${member.id}`).emit('notification', {
        title: 'Live Session Reminder',
        body: `"${lc.title}" starts soon. Don't miss it!`,
        type: 'live_call',
      });

      if (resend && member.email) {
        await resend.emails.send({
          from: 'TBT <noreply@tamillbiznesstribe.com>',
          to: member.email,
          subject: `Reminder: "${lc.title}" starts soon`,
          html: `<p>Hi ${member.firstName},</p><p>Your live session <strong>${lc.title}</strong> is scheduled for ${scheduledTime}. Log in to TBT to join.</p>`,
        });
        return 'email';
      }

      if (twilioClient && env.TWILIO_PHONE_NUMBER && member.phone) {
        await twilioClient.messages.create({
          body: `TBT Reminder: "${lc.title}" starts soon. Log in to join.`,
          from: env.TWILIO_PHONE_NUMBER,
          to: member.phone,
        });
        return 'sms';
      }
    }));

    for (const r of results) {
      if (r.status === 'fulfilled') {
        if (r.value === 'email') emailsSent++;
        else if (r.value === 'sms') smsSent++;
      }
    }
  }

  return reply.send({ success: true, data: { emailsSent, smsSent, notified: enrollments.length }, error: null });
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

// ── PRE-SESSION RESOURCES ─────────────────────────────────────────────────────

export async function listResourcesHandler(req: FastifyRequest, reply: FastifyReply) {
  const { lcid } = req.params as any;
  const resources = await req.server.prisma.liveCallResource.findMany({
    where: { liveCallId: lcid },
    orderBy: { order: 'asc' },
  });
  return reply.send({ success: true, data: resources, error: null });
}

export async function createResourceHandler(req: FastifyRequest, reply: FastifyReply) {
  const { lcid } = req.params as any;
  const { title, url, type } = req.body as any;
  const maxOrder = await req.server.prisma.liveCallResource.findFirst({
    where: { liveCallId: lcid },
    orderBy: { order: 'desc' },
    select: { order: true },
  });
  const resource = await req.server.prisma.liveCallResource.create({
    data: { liveCallId: lcid, title, url, type: type ?? 'link', order: (maxOrder?.order ?? -1) + 1 },
  });
  return reply.send({ success: true, data: resource, error: null });
}

export async function updateResourceHandler(req: FastifyRequest, reply: FastifyReply) {
  const { rid } = req.params as any;
  const body = req.body as any;
  const fields: any = {};
  if (body.title !== undefined) fields.title = body.title;
  if (body.url !== undefined) fields.url = body.url;
  if (body.type !== undefined) fields.type = body.type;
  if (body.order !== undefined) fields.order = body.order;
  const resource = await req.server.prisma.liveCallResource.update({ where: { id: rid }, data: fields });
  return reply.send({ success: true, data: resource, error: null });
}

export async function deleteResourceHandler(req: FastifyRequest, reply: FastifyReply) {
  const { rid } = req.params as any;
  await req.server.prisma.liveCallResource.delete({ where: { id: rid } });
  return reply.send({ success: true, data: null, error: null });
}

export async function reorderResourcesHandler(req: FastifyRequest, reply: FastifyReply) {
  const { ids } = req.body as { ids: string[] };
  await Promise.all(ids.map((id, order) =>
    req.server.prisma.liveCallResource.update({ where: { id }, data: { order } })
  ));
  return reply.send({ success: true, data: null, error: null });
}

// ── RSVP (admin) ──────────────────────────────────────────────────────────────

export async function listRsvpsHandler(req: FastifyRequest, reply: FastifyReply) {
  const { lcid } = req.params as any;
  const rsvps = await req.server.prisma.liveCallRsvp.findMany({
    where: { liveCallId: lcid },
    include: {
      member: { select: { id: true, firstName: true, lastName: true, email: true, memberId: true } },
    },
    orderBy: { confirmedAt: 'asc' },
  });
  const confirmed = rsvps.filter(r => r.status === 'confirmed').length;
  const declined = rsvps.filter(r => r.status === 'declined').length;
  return reply.send({ success: true, data: { confirmed, declined, members: rsvps }, error: null });
}

// ── LIVE CALL ANALYTICS ────────────────────────────────────────────────

export async function getLiveCallAnalyticsHandler(req: FastifyRequest, reply: FastifyReply) {
  const { lcid } = req.params as any;
  const [lc, attendance, polls] = await Promise.all([
    req.server.prisma.liveCall.findUnique({ where: { id: lcid } }),
    req.server.prisma.liveCallAttendance.findMany({ where: { liveCallId: lcid } }),
    req.server.prisma.liveCallPoll.findMany({
      where: { liveCallId: lcid },
      include: { options: { include: { votes: true } } },
    }),
  ]);
  if (!lc) return reply.status(404).send({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'Not found' } });

  const durations = attendance.map(a => a.durationSec ?? 0).filter(d => d > 0);
  const totalDuration = lc.endedAt && lc.startedAt
    ? Math.round((new Date(lc.endedAt).getTime() - new Date(lc.startedAt).getTime()) / 1000)
    : null;

  return reply.send({
    success: true,
    data: {
      totalAttendees: attendance.length,
      avgStaySeconds: durations.length
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : 0,
      sessionDurationSeconds: totalDuration,
      pollParticipation: polls.length
        ? Math.round(polls.reduce((sum, p) => sum + p.options.reduce((s, o) => s + o.votes.length, 0), 0) / polls.length)
        : 0,
      polls: polls.map(p => ({
        question: p.question,
        totalVotes: p.options.reduce((s, o) => s + o.votes.length, 0),
        options: p.options
          .map(o => ({ text: o.optionText, votes: o.votes.length }))
          .sort((a, b) => b.votes - a.votes),
      })),
    },
    error: null,
  });
}

// ── AI SUMMARY ─────────────────────────────────────────────────────────

export async function summarizeLiveCallHandler(req: FastifyRequest, reply: FastifyReply) {
  const { lcid } = req.params as any;
  const { env } = await import('../../config/env.js');
  if (!env.ANTHROPIC_API_KEY) {
    return reply.status(503).send({ success: false, data: null, error: { code: 'NO_API_KEY', message: 'ANTHROPIC_API_KEY not configured' } });
  }
  await generateLiveCallSummary(req.server.prisma, lcid);
  return reply.send({ success: true, data: null, error: null });
}

export async function generateLiveCallSummary(prisma: any, liveCallId: string) {
  const { env } = await import('../../config/env.js');
  if (!env.ANTHROPIC_API_KEY) return;

  const lc = await prisma.liveCall.findUnique({
    where: { id: liveCallId },
    include: {
      attendance: true,
      polls: { include: { options: { include: { votes: true } } } },
    },
  });
  if (!lc) return;

  const attendanceCount = lc.attendance.length;
  const avgDuration = lc.attendance.reduce((a: number, r: any) => a + (r.durationSec ?? 0), 0) / (attendanceCount || 1);
  const pollSummary = lc.polls.map((p: any) => {
    const winner = [...p.options].sort((a: any, b: any) => b.votes.length - a.votes.length)[0];
    return `Poll: "${p.question}" — top answer: "${winner?.optionText}" (${winner?.votes.length} votes)`;
  }).join('\n');

  const prompt = `Summarize this live session in 3-5 bullet points for members who missed it.
Title: ${lc.title}
Attendees: ${attendanceCount}, avg stay: ${Math.round(avgDuration / 60)} min
${pollSummary || '(no poll data)'}
Write bullet points only. Be concise and practical.`;

  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    const message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    });
    const summary = (message.content[0] as any)?.text ?? '';
    if (summary) {
      await prisma.liveCall.update({ where: { id: liveCallId }, data: { aiSummary: summary } });
    }
  } catch {
    // Non-fatal — summary generation is best-effort
  }
}

// ── RECORDING CHAPTERS (admin) ────────────────────────────────────────────────

export async function listChaptersHandler(req: FastifyRequest, reply: FastifyReply) {
  const { lcid } = req.params as any;
  const chapters = await req.server.prisma.recordingChapter.findMany({
    where: { liveCallId: lcid },
    orderBy: { order: 'asc' },
  });
  return reply.send({ success: true, data: chapters, error: null });
}

export async function createChapterHandler(req: FastifyRequest, reply: FastifyReply) {
  const { lcid } = req.params as any;
  const { label, timestampSeconds } = req.body as any;
  const count = await req.server.prisma.recordingChapter.count({ where: { liveCallId: lcid } });
  const chapter = await req.server.prisma.recordingChapter.create({
    data: { liveCallId: lcid, label, timestampSeconds, order: count },
  });
  return reply.status(201).send({ success: true, data: chapter, error: null });
}

export async function deleteChapterHandler(req: FastifyRequest, reply: FastifyReply) {
  const { chapterId } = req.params as any;
  await req.server.prisma.recordingChapter.delete({ where: { id: chapterId } });
  return reply.send({ success: true, data: null, error: null });
}

export async function reorderChaptersHandler(req: FastifyRequest, reply: FastifyReply) {
  const { lcid } = req.params as any;
  const { ids } = req.body as { ids: string[] };
  await Promise.all(ids.map((id, order) => req.server.prisma.recordingChapter.update({ where: { id }, data: { order } })));
  return reply.send({ success: true, data: null, error: null });
}

// ── LIVE CALL FEEDBACK (admin) ────────────────────────────────────────────────

export async function getLiveCallFeedbackAdminHandler(req: FastifyRequest, reply: FastifyReply) {
  const { lcid } = req.params as any;
  const feedbacks = await req.server.prisma.liveCallFeedback.findMany({
    where: { liveCallId: lcid },
    include: { member: { select: { firstName: true, lastName: true } } },
    orderBy: { submittedAt: 'desc' },
  });
  const total = feedbacks.length;
  const avgRating = total > 0 ? feedbacks.reduce((s, f) => s + f.rating, 0) / total : 0;
  const breakdown: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
  feedbacks.forEach(f => { breakdown[String(f.rating)] = (breakdown[String(f.rating)] ?? 0) + 1; });
  const comments = feedbacks.filter(f => f.comment).map(f => ({
    memberName: [f.member.firstName, f.member.lastName].filter(Boolean).join(' ') || 'Member',
    comment: f.comment,
    rating: f.rating,
    submittedAt: f.submittedAt,
  }));
  return reply.send({ success: true, data: { avgRating: Math.round(avgRating * 10) / 10, totalResponses: total, breakdown, comments }, error: null });
}

// ── LIVE CALL Q&A (admin) ──────────────────────────────────────────────────────

export async function listLiveCallQuestionsAdminHandler(req: FastifyRequest, reply: FastifyReply) {
  const { lcid } = req.params as any;
  const questions = await req.server.prisma.liveCallQuestion.findMany({
    where: { liveCallId: lcid },
    include: { member: { select: { id: true, firstName: true, lastName: true, memberId: true } } },
    orderBy: [{ isAnswered: 'asc' }, { submittedAt: 'asc' }],
  });
  return reply.send({ success: true, data: questions, error: null });
}

export async function updateLiveCallQuestionHandler(req: FastifyRequest, reply: FastifyReply) {
  const { lcid, qid } = req.params as any;
  const { isAnswered, isHidden } = req.body as any;
  const data: any = {};
  if (typeof isAnswered === 'boolean') {
    data.isAnswered = isAnswered;
    data.answeredAt = isAnswered ? new Date() : null;
  }
  if (typeof isHidden === 'boolean') data.isHidden = isHidden;
  const question = await req.server.prisma.liveCallQuestion.update({ where: { id: qid }, data });
  req.server.io.to('admin').emit('live_call:question_answered', { questionId: qid, liveCallId: lcid, isAnswered: question.isAnswered });
  return reply.send({ success: true, data: question, error: null });
}

export async function createAssignmentHandler(req: FastifyRequest, reply: FastifyReply) {
  const body = req.body as any;
  const assignment = await req.server.prisma.assignment.create({
    data: {
      challengeId: body.challengeId,
      order: body.order || 0,
      title: body.title,
      questionText: body.questionText || null,
      assignmentType: body.assignmentType || 'qa',
      typeLabel: body.typeLabel || (body.assignmentType === 'image_upload' ? 'IMAGE' : body.assignmentType === 'file_upload' ? 'FILE' : body.assignmentType === 'video_upload' ? 'VIDEO' : 'QUESTION'),
      allowEdit: body.allowEdit ?? false,
      editDeadline: body.editDeadline ? new Date(body.editDeadline) : null,
    },
  });
  return reply.status(201).send({ success: true, data: assignment, error: null });
}

export async function updateAssignmentHandler(req: FastifyRequest, reply: FastifyReply) {
  const { aid } = req.params as any;
  const body = req.body as any;
  const data: any = {};
  ['title', 'questionText', 'assignmentType', 'typeLabel', 'order', 'allowEdit'].forEach(f => {
    if (body[f] !== undefined) data[f] = body[f];
  });
  if (body.editDeadline !== undefined) data.editDeadline = body.editDeadline ? new Date(body.editDeadline) : null;
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
    select: {
      id: true,
      answerText: true,
      imageUrl: true,
      submittedAt: true,
      reviewNote: true,
      reviewedAt: true,
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

// ── BREAKOUT ROOMS ────────────────────────────────────────────────────

export async function getBreakoutRoomsHandler(req: FastifyRequest, reply: FastifyReply) {
  const { lcid } = req.params as any;
  const rooms = await req.server.prisma.breakoutRoom.findMany({
    where: { liveCallId: lcid },
    orderBy: { createdAt: 'asc' },
  });
  return reply.send({ success: true, data: rooms, error: null });
}

export async function createBreakoutRoomsHandler(req: FastifyRequest, reply: FastifyReply) {
  const { lcid } = req.params as any;
  const body = req.body as any;
  const count: number = Math.min(Math.max(Number(body.count) || 2, 1), 20);
  const names: string[] = Array.isArray(body.names) ? body.names : [];

  const lc = await req.server.prisma.liveCall.findUnique({ where: { id: lcid }, select: { id: true } });
  if (!lc) return reply.status(404).send({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'Live call not found' } });

  const rooms = [];
  for (let i = 0; i < count; i++) {
    const name = names[i] || `Breakout Room ${i + 1}`;
    const roomName = `breakout-${lcid}-${i + 1}-${Date.now()}`;
    const room = await req.server.prisma.breakoutRoom.create({
      data: { liveCallId: lcid, name, roomName, isActive: true },
    });
    rooms.push(room);
  }
  return reply.status(201).send({ success: true, data: rooms, error: null });
}

export async function assignToBreakoutHandler(req: FastifyRequest, reply: FastifyReply) {
  const { lcid, brid } = req.params as any;
  const body = req.body as any;
  const identity: string = body.identity;

  const { env } = await import('../../config/env.js');
  if (!env.LIVEKIT_API_KEY || !env.LIVEKIT_API_SECRET || !env.LIVEKIT_WS_URL) {
    return reply.status(503).send({ success: false, data: null, error: { code: 'ERROR', message: 'Live call service not configured' } });
  }

  const room = await req.server.prisma.breakoutRoom.findUnique({ where: { id: brid } });
  if (!room || room.liveCallId !== lcid) {
    return reply.status(404).send({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'Breakout room not found' } });
  }

  const member = await req.server.prisma.member.findUnique({
    where: { id: identity },
    select: { id: true, firstName: true, lastName: true },
  });

  const { AccessToken } = await import('livekit-server-sdk');
  const at = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
    identity,
    name: member ? [member.firstName, member.lastName].filter(Boolean).join(' ') : identity,
    ttl: '4h',
  });
  at.addGrant({
    room: room.roomName,
    roomJoin: true,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
  });
  const token = await at.toJwt();

  req.server.io.to(`user:${identity}`).emit('live_call:breakout_assigned', {
    liveCallId: lcid,
    breakoutRoomId: brid,
    roomName: room.roomName,
    roomLabel: room.name,
    token,
    wsUrl: env.LIVEKIT_WS_URL,
  });

  return reply.send({ success: true, data: { token, wsUrl: env.LIVEKIT_WS_URL, roomName: room.roomName }, error: null });
}

export async function recallAllHandler(req: FastifyRequest, reply: FastifyReply) {
  const { lcid } = req.params as any;

  await req.server.prisma.breakoutRoom.updateMany({
    where: { liveCallId: lcid, isActive: true },
    data: { isActive: false },
  });

  // Notify all connected members in this live call room to return
  req.server.io.to(`live:${lcid}`).emit('live_call:breakout_recall', { liveCallId: lcid });

  return reply.send({ success: true, data: null, error: null });
}

export async function deleteBreakoutRoomHandler(req: FastifyRequest, reply: FastifyReply) {
  const { brid } = req.params as any;
  await req.server.prisma.breakoutRoom.delete({ where: { id: brid } });
  return reply.send({ success: true, data: null, error: null });
}

// ── LIVE CALL TEMPLATES ───────────────────────────────────────────────

export async function listLiveCallTemplatesHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  const templates = await req.server.prisma.liveCallTemplate.findMany({
    where: { workshopId: id },
    orderBy: { createdAt: 'asc' },
  });
  return reply.send({ success: true, data: templates, error: null });
}

export async function createLiveCallTemplateHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  const body = req.body as any;

  const workshop = await req.server.prisma.workshop.findUnique({ where: { id }, select: { id: true } });
  if (!workshop) return reply.status(404).send({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'Workshop not found' } });

  const template = await req.server.prisma.liveCallTemplate.create({
    data: {
      workshopId: id,
      title: body.title,
      label: body.label ?? 'LIVE CALL:',
      labelColor: body.labelColor ?? '#ff3d8b',
      recurrence: body.recurrence ?? 'weekly',
      dayOfWeek: Number(body.dayOfWeek ?? 1),
      timeHour: Number(body.timeHour ?? 10),
      timeMinute: Number(body.timeMinute ?? 0),
      durationMinutes: Number(body.durationMinutes ?? 60),
      liveUrlUnlocksMinutesBefore: Number(body.liveUrlUnlocksMinutesBefore ?? 30),
      facilitatorName: body.facilitatorName ?? null,
      stayTunedMessage: body.stayTunedMessage ?? 'Stay tuned — the link will unlock before the session begins',
      stayTunedColor: body.stayTunedColor ?? '#00c4cc',
      isActive: body.isActive !== false,
      weeksAhead: Number(body.weeksAhead ?? 4),
    },
  });
  return reply.status(201).send({ success: true, data: template, error: null });
}

export async function updateLiveCallTemplateHandler(req: FastifyRequest, reply: FastifyReply) {
  const { tid } = req.params as any;
  const body = req.body as any;

  const allowed = [
    'title', 'label', 'labelColor', 'recurrence', 'dayOfWeek', 'timeHour',
    'timeMinute', 'durationMinutes', 'liveUrlUnlocksMinutesBefore', 'facilitatorName',
    'stayTunedMessage', 'stayTunedColor', 'isActive', 'weeksAhead',
  ] as const;
  const data: Record<string, any> = {};
  for (const f of allowed) {
    if (body[f] !== undefined) data[f] = body[f];
  }

  const template = await req.server.prisma.liveCallTemplate.update({ where: { id: tid }, data });
  return reply.send({ success: true, data: template, error: null });
}

export async function deleteLiveCallTemplateHandler(req: FastifyRequest, reply: FastifyReply) {
  const { tid } = req.params as any;
  await req.server.prisma.liveCallTemplate.delete({ where: { id: tid } });
  return reply.send({ success: true, data: null, error: null });
}

function nextOccurrence(dayOfWeek: number, timeHour: number, timeMinute: number, after: Date): Date {
  const d = new Date(after);
  d.setUTCSeconds(0, 0);
  d.setUTCHours(timeHour, timeMinute);
  // dayOfWeek: 0=Sun ... 6=Sat
  let diff = (dayOfWeek - d.getUTCDay() + 7) % 7;
  // Same weekday: use today if the scheduled time is still ahead, else next week
  if (diff === 0 && d <= after) diff = 7;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

async function generateFromTemplate(prisma: any, template: any, weeksAhead: number): Promise<number> {
  const now = new Date();
  const cutoff = new Date(now.getTime() + weeksAhead * 7 * 24 * 60 * 60 * 1000);

  const existing = await prisma.liveCall.findMany({
    where: {
      workshopId: template.workshopId,
      scheduledAt: { gte: now },
      title: template.title,
    },
    select: { scheduledAt: true },
  });
  const existingTimes = new Set(existing.map((lc: any) => lc.scheduledAt.toISOString()));

  let created = 0;
  let cursor = nextOccurrence(template.dayOfWeek, template.timeHour, template.timeMinute, now);
  while (cursor <= cutoff) {
    const iso = cursor.toISOString();
    if (!existingTimes.has(iso)) {
      await prisma.liveCall.create({
        data: {
          workshopId: template.workshopId,
          title: template.title,
          label: template.label,
          labelColor: template.labelColor,
          scheduledAt: cursor,
          liveUrlUnlocksMinutesBefore: template.liveUrlUnlocksMinutesBefore,
          facilitatorName: template.facilitatorName,
          stayTunedMessage: template.stayTunedMessage,
          stayTunedColor: template.stayTunedColor,
        },
      });
      created++;
    }
    cursor = new Date(cursor.getTime() + 7 * 24 * 60 * 60 * 1000);
  }
  return created;
}

export async function generateNowHandler(req: FastifyRequest, reply: FastifyReply) {
  const { tid } = req.params as any;
  const template = await req.server.prisma.liveCallTemplate.findUnique({ where: { id: tid } });
  if (!template) return reply.status(404).send({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'Template not found' } });

  const created = await generateFromTemplate(req.server.prisma, template, template.weeksAhead);
  await req.server.prisma.liveCallTemplate.update({ where: { id: tid }, data: { lastGeneratedAt: new Date() } });

  return reply.send({ success: true, data: { created }, error: null });
}

export async function generateRecurringHandler(req: FastifyRequest, reply: FastifyReply) {
  const secret = (req.headers['x-cron-secret'] as string) || '';
  const { env } = await import('../../config/env.js');
  if (!env.CRON_SECRET || secret !== env.CRON_SECRET) {
    return reply.status(401).send({ success: false, data: null, error: { code: 'UNAUTHORIZED', message: 'Invalid cron secret' } });
  }

  const templates = await req.server.prisma.liveCallTemplate.findMany({ where: { isActive: true } });
  let totalCreated = 0;
  for (const t of templates) {
    try {
      const n = await generateFromTemplate(req.server.prisma, t, t.weeksAhead);
      totalCreated += n;
      await req.server.prisma.liveCallTemplate.update({ where: { id: t.id }, data: { lastGeneratedAt: new Date() } });
    } catch {
      // continue on individual failure
    }
  }
  return reply.send({ success: true, data: { templatesProcessed: templates.length, created: totalCreated }, error: null });
}
