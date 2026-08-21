import type { FastifyRequest, FastifyReply } from 'fastify';
import { createAdminNotification } from '../../lib/adminNotifications.js';
import {
  canEditMeeting,
  canStartMeeting,
  canJoinMeeting,
  canEndMeeting,
  canCancelMeeting,
  type OnboardingMeetingStatus,
} from '../../lib/onboardingMeetingLogic.js';
import {
  isLiveKitConfigured,
  onboardingRoomName,
  getOnboardingRoomServiceClient,
  mintOnboardingToken,
} from '../../lib/onboardingLiveKit.js';
import {
  createOnboardingMeetingSchema,
  updateOnboardingMeetingSchema,
  cancelOnboardingMeetingSchema,
} from './schema.js';

const MEETING_LIST_SELECT = {
  id: true, memberId: true, hostAdminId: true, title: true, description: true,
  status: true, scheduledAt: true, durationMinutes: true, startedAt: true,
  endedAt: true, cancelledAt: true, cancelReason: true, recordingUrl: true,
  createdAt: true,
  member: { select: { id: true, firstName: true, lastName: true, memberId: true, phone: true } },
  hostAdmin: { select: { id: true, fullName: true } },
  _count: { select: { participants: true } },
} as const;

async function notifyMemberIds(req: FastifyRequest, memberIds: string[], payload: { title: string; body: string; type?: string }) {
  const notif = { type: payload.type ?? 'system', title: payload.title, body: payload.body, createdAt: new Date().toISOString() };
  for (const memberId of memberIds) {
    req.server.io.to(`user:${memberId}`).emit('notification', notif);
    void req.server.prisma.notification.create({
      data: { memberId, type: 'system', title: payload.title, body: payload.body, isRead: false },
    }).catch(() => {});
  }
}

async function getParticipantMemberIds(req: FastifyRequest, meetingId: string): Promise<string[]> {
  const rows = await req.server.prisma.onboardingMeetingParticipant.findMany({
    where: { meetingId, memberId: { not: null } },
    select: { memberId: true },
  });
  return rows.map((r) => r.memberId as string).filter(Boolean);
}

// ── Admin (Clerk) ────────────────────────────────────────────────────────

// GET /api/onboarding-meetings/admin — dashboard listing, filterable by status
export async function adminListMeetingsHandler(req: FastifyRequest, reply: FastifyReply) {
  const { status, memberId, page = '1', limit = '25' } = req.query as Record<string, string>;
  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (memberId) where.memberId = memberId;

  const take = Math.min(Number(limit) || 25, 100);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

  const [rows, total] = await Promise.all([
    req.server.prisma.onboardingMeeting.findMany({
      where, select: MEETING_LIST_SELECT, orderBy: { scheduledAt: 'desc' }, take, skip,
    }),
    req.server.prisma.onboardingMeeting.count({ where }),
  ]);

  return reply.send({ success: true, data: rows, meta: { total, page: Number(page), limit: take }, error: null });
}

// GET /api/onboarding-meetings/admin/:id — full detail incl participants
export async function adminGetMeetingHandler(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const meeting = await req.server.prisma.onboardingMeeting.findUnique({
    where: { id: req.params.id },
    include: {
      member: { select: { id: true, firstName: true, lastName: true, memberId: true, phone: true, verificationStatus: true } },
      hostAdmin: { select: { id: true, fullName: true } },
      creator: { select: { id: true, fullName: true } },
      participants: {
        include: {
          member: { select: { id: true, firstName: true, lastName: true, memberId: true } },
          admin: { select: { id: true, fullName: true } },
        },
      },
    },
  });
  if (!meeting) return reply.status(404).send({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'Meeting not found' } });
  return reply.send({ success: true, data: meeting, error: null });
}

// POST /api/onboarding-meetings/admin — schedule a new meeting
export async function adminCreateMeetingHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = createOnboardingMeetingSchema.safeParse(req.body);
  if (!parsed.success) {
    return reply.status(400).send({ success: false, data: null, error: { code: 'BAD_REQUEST', message: parsed.error.issues[0]?.message ?? 'Invalid request body' } });
  }
  const { memberId, hostAdminId, title, description, scheduledAt, durationMinutes, participantMemberIds, participantAdminIds } = parsed.data;

  const member = await req.server.prisma.member.findUnique({ where: { id: memberId }, select: { id: true, firstName: true, lastName: true } });
  if (!member) return reply.status(404).send({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'Member not found' } });

  const creatorAdmin = await req.server.prisma.admin.findFirst({ where: { clerkId: req.user }, select: { id: true } });

  const meeting = await req.server.prisma.onboardingMeeting.create({
    data: {
      memberId,
      hostAdminId: hostAdminId ?? null,
      createdBy: creatorAdmin?.id ?? null,
      title: title || 'Onboarding Verification Call',
      description,
      scheduledAt: new Date(scheduledAt),
      durationMinutes: durationMinutes ?? 30,
      participants: {
        create: [
          { memberId, role: 'participant', status: 'invited' },
          ...(hostAdminId ? [{ adminId: hostAdminId, role: 'host', status: 'invited' as const }] : []),
          ...(participantMemberIds ?? []).filter((id) => id !== memberId).map((id) => ({ memberId: id, role: 'participant', status: 'invited' as const })),
          ...(participantAdminIds ?? []).filter((id) => id !== hostAdminId).map((id) => ({ adminId: id, role: 'participant', status: 'invited' as const })),
        ],
      },
    },
    select: MEETING_LIST_SELECT,
  });

  const fullName = `${member.firstName} ${member.lastName ?? ''}`.trim();
  await notifyMemberIds(req, [memberId, ...(participantMemberIds ?? [])], {
    title: 'Onboarding Meeting Scheduled',
    body: `A verification call "${meeting.title}" has been scheduled for ${new Date(meeting.scheduledAt).toLocaleString()}.`,
  });
  req.server.io.to('admin').emit('admin:onboarding_meeting_scheduled', { meetingId: meeting.id, memberId, fullName });

  return reply.status(201).send({ success: true, data: meeting, error: null });
}

// PUT /api/onboarding-meetings/admin/:id — edit schedule/host/participants/title
export async function adminUpdateMeetingHandler(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const parsed = updateOnboardingMeetingSchema.safeParse(req.body);
  if (!parsed.success) {
    return reply.status(400).send({ success: false, data: null, error: { code: 'BAD_REQUEST', message: parsed.error.issues[0]?.message ?? 'Invalid request body' } });
  }

  const existing = await req.server.prisma.onboardingMeeting.findUnique({ where: { id: req.params.id }, select: { id: true, status: true, memberId: true } });
  if (!existing) return reply.status(404).send({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'Meeting not found' } });
  if (!canEditMeeting(existing.status as OnboardingMeetingStatus)) {
    return reply.status(400).send({ success: false, data: null, error: { code: 'BAD_REQUEST', message: 'Only a scheduled meeting can be edited' } });
  }

  const { participantMemberIds, participantAdminIds, hostAdminId, scheduledAt, ...rest } = parsed.data;
  const data: Record<string, unknown> = { ...rest };
  if (hostAdminId !== undefined) data.hostAdminId = hostAdminId;
  if (scheduledAt) data.scheduledAt = new Date(scheduledAt);

  if (participantMemberIds !== undefined || participantAdminIds !== undefined || hostAdminId !== undefined) {
    // Full-replace of the still-"invited" (not-yet-joined) invite list,
    // keeping the onboarding subject member permanent and never duplicating
    // a row for anyone who already joined before this edit (canEditMeeting
    // only guarantees "not started" at the meeting level — a participant
    // can still have joined earlier via the scheduled-status join window).
    const alreadyActive = await req.server.prisma.onboardingMeetingParticipant.findMany({
      where: { meetingId: existing.id, NOT: { status: 'invited' } },
      select: { memberId: true, adminId: true },
    });
    const activeMemberIds = new Set(alreadyActive.map((p) => p.memberId).filter(Boolean));
    const activeAdminIds = new Set(alreadyActive.map((p) => p.adminId).filter(Boolean));

    await req.server.prisma.onboardingMeetingParticipant.deleteMany({
      where: { meetingId: existing.id, status: 'invited', NOT: { memberId: existing.memberId } },
    });
    const creates: Array<{ memberId?: string; adminId?: string; role: string; status: string }> = [];
    if (hostAdminId && !activeAdminIds.has(hostAdminId)) creates.push({ adminId: hostAdminId, role: 'host', status: 'invited' });
    for (const id of participantMemberIds ?? []) {
      if (id !== existing.memberId && !activeMemberIds.has(id)) creates.push({ memberId: id, role: 'participant', status: 'invited' });
    }
    for (const id of participantAdminIds ?? []) {
      if (id !== hostAdminId && !activeAdminIds.has(id)) creates.push({ adminId: id, role: 'participant', status: 'invited' });
    }
    if (creates.length) {
      await req.server.prisma.onboardingMeetingParticipant.createMany({ data: creates.map((c) => ({ ...c, meetingId: existing.id })) });
    }
  }

  const updated = await req.server.prisma.onboardingMeeting.update({ where: { id: existing.id }, data, select: MEETING_LIST_SELECT });
  return reply.send({ success: true, data: updated, error: null });
}

// POST /api/onboarding-meetings/admin/:id/start — manual start without joining
export async function adminStartMeetingHandler(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const meeting = await req.server.prisma.onboardingMeeting.findUnique({ where: { id: req.params.id }, select: { id: true, status: true, memberId: true, title: true } });
  if (!meeting) return reply.status(404).send({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'Meeting not found' } });
  if (!canStartMeeting(meeting.status as OnboardingMeetingStatus)) {
    return reply.status(400).send({ success: false, data: null, error: { code: 'BAD_REQUEST', message: 'Only a scheduled meeting can be started' } });
  }

  const updated = await req.server.prisma.onboardingMeeting.update({
    where: { id: meeting.id }, data: { status: 'live', startedAt: new Date() }, select: MEETING_LIST_SELECT,
  });

  const memberIds = await getParticipantMemberIds(req, meeting.id);
  await notifyMemberIds(req, memberIds, { title: 'Onboarding Meeting Started', body: `"${meeting.title}" is now live — join now.`, type: 'live_call' });
  req.server.io.to('admin').emit('admin:onboarding_meeting_started', { meetingId: meeting.id });

  return reply.send({ success: true, data: updated, error: null });
}

// POST /api/onboarding-meetings/admin/:id/end — admin ends an active meeting
export async function adminEndMeetingHandler(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const { env } = await import('../../config/env.js');
  const meeting = await req.server.prisma.onboardingMeeting.findUnique({ where: { id: req.params.id }, select: { id: true, status: true, memberId: true, title: true } });
  if (!meeting) return reply.status(404).send({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'Meeting not found' } });
  if (!canEndMeeting(meeting.status as OnboardingMeetingStatus)) {
    return reply.status(400).send({ success: false, data: null, error: { code: 'BAD_REQUEST', message: 'Only a live meeting can be ended' } });
  }

  if (isLiveKitConfigured(env)) {
    try {
      const svc = await getOnboardingRoomServiceClient(env as any);
      await svc.deleteRoom(onboardingRoomName(meeting.id));
    } catch {
      // Room may already be empty/gone — not fatal
    }
  }

  const updated = await req.server.prisma.onboardingMeeting.update({
    where: { id: meeting.id }, data: { status: 'completed', endedAt: new Date() }, select: MEETING_LIST_SELECT,
  });
  await req.server.prisma.onboardingMeetingParticipant.updateMany({
    where: { meetingId: meeting.id, status: 'joined' }, data: { status: 'left', leftAt: new Date() },
  });

  const memberIds = await getParticipantMemberIds(req, meeting.id);
  await notifyMemberIds(req, memberIds, { title: 'Onboarding Meeting Ended', body: `"${meeting.title}" has ended.` });
  req.server.io.to('admin').emit('admin:onboarding_meeting_ended', { meetingId: meeting.id });

  return reply.send({ success: true, data: updated, error: null });
}

// POST /api/onboarding-meetings/admin/:id/cancel
export async function adminCancelMeetingHandler(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const parsed = cancelOnboardingMeetingSchema.safeParse(req.body);
  if (!parsed.success) {
    return reply.status(400).send({ success: false, data: null, error: { code: 'BAD_REQUEST', message: 'A reason is required to cancel a meeting' } });
  }
  const meeting = await req.server.prisma.onboardingMeeting.findUnique({ where: { id: req.params.id }, select: { id: true, status: true, memberId: true, title: true } });
  if (!meeting) return reply.status(404).send({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'Meeting not found' } });
  if (!canCancelMeeting(meeting.status as OnboardingMeetingStatus)) {
    return reply.status(400).send({ success: false, data: null, error: { code: 'BAD_REQUEST', message: 'Only a scheduled meeting can be cancelled' } });
  }

  const updated = await req.server.prisma.onboardingMeeting.update({
    where: { id: meeting.id },
    data: { status: 'cancelled', cancelledAt: new Date(), cancelReason: parsed.data.reason },
    select: MEETING_LIST_SELECT,
  });

  const memberIds = await getParticipantMemberIds(req, meeting.id);
  await notifyMemberIds(req, memberIds, { title: 'Onboarding Meeting Cancelled', body: `"${meeting.title}" was cancelled: ${parsed.data.reason}` });
  req.server.io.to('admin').emit('admin:onboarding_meeting_cancelled', { meetingId: meeting.id });

  return reply.send({ success: true, data: updated, error: null });
}

// GET /api/onboarding-meetings/admin/:id/status — live participant count for dashboard polling
export async function adminGetMeetingStatusHandler(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const { env } = await import('../../config/env.js');
  const meeting = await req.server.prisma.onboardingMeeting.findUnique({ where: { id: req.params.id }, select: { id: true, status: true, startedAt: true, endedAt: true } });
  if (!meeting) return reply.status(404).send({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'Meeting not found' } });

  let participantCount = 0;
  if (meeting.status === 'live' && isLiveKitConfigured(env)) {
    try {
      const svc = await getOnboardingRoomServiceClient(env as any);
      const participants = await svc.listParticipants(onboardingRoomName(meeting.id));
      participantCount = participants.length;
    } catch {
      // Room not active yet
    }
  }

  return reply.send({ success: true, data: { status: meeting.status, participantCount, startedAt: meeting.startedAt, endedAt: meeting.endedAt }, error: null });
}

// POST /api/onboarding-meetings/admin/:id/host-token
export async function adminGetHostTokenHandler(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const { env } = await import('../../config/env.js');
  if (!isLiveKitConfigured(env)) {
    return reply.status(503).send({ success: false, data: null, error: { code: 'ERROR', message: 'Live meeting service not configured' } });
  }

  const meeting = await req.server.prisma.onboardingMeeting.findUnique({ where: { id: req.params.id }, select: { id: true, status: true, title: true, memberId: true, startedAt: true } });
  if (!meeting) return reply.status(404).send({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'Meeting not found' } });
  if (!canJoinMeeting(meeting.status as OnboardingMeetingStatus)) {
    return reply.status(400).send({ success: false, data: null, error: { code: 'BAD_REQUEST', message: 'This meeting is not currently joinable' } });
  }

  const admin = await req.server.prisma.admin.findFirst({ where: { clerkId: req.user }, select: { id: true, fullName: true } });
  const hostName = admin?.fullName || 'Host';
  const token = await mintOnboardingToken(env as any, { meetingId: meeting.id, identity: req.user!, name: hostName, role: 'host' });

  const isFirstJoin = meeting.status === 'scheduled';
  // Authoritative meeting start time — never derive duration from client
  // connect time. See ONBOARDING_LIVE_MEETING_SPECKIT.md (duration fix).
  const startedAt = isFirstJoin ? new Date() : meeting.startedAt;
  await req.server.prisma.onboardingMeeting.update({
    where: { id: meeting.id },
    data: isFirstJoin ? { status: 'live', startedAt } : {},
  });
  if (admin) {
    await req.server.prisma.onboardingMeetingParticipant.updateMany({
      where: { meetingId: meeting.id, adminId: admin.id }, data: { status: 'joined', joinedAt: new Date(), identity: req.user },
    });
  }

  if (isFirstJoin) {
    const memberIds = await getParticipantMemberIds(req, meeting.id);
    await notifyMemberIds(req, memberIds, { title: 'Onboarding Meeting Started', body: `"${meeting.title}" is now live — join now.`, type: 'live_call' });
    req.server.io.to('admin').emit('admin:onboarding_meeting_started', { meetingId: meeting.id });
  }

  return reply.send({
    success: true,
    data: { token, wsUrl: env.LIVEKIT_WS_URL, roomName: onboardingRoomName(meeting.id), startedAt, title: meeting.title },
    error: null,
  });
}

// POST /api/onboarding-meetings/admin/:id/participants/:participantId/remove
export async function adminRemoveParticipantHandler(req: FastifyRequest<{ Params: { id: string; participantId: string } }>, reply: FastifyReply) {
  const { env } = await import('../../config/env.js');
  const participant = await req.server.prisma.onboardingMeetingParticipant.findUnique({ where: { id: req.params.participantId } });
  if (!participant || participant.meetingId !== req.params.id) {
    return reply.status(404).send({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'Participant not found' } });
  }

  if (participant.identity && isLiveKitConfigured(env)) {
    try {
      const svc = await getOnboardingRoomServiceClient(env as any);
      await svc.removeParticipant(onboardingRoomName(req.params.id), participant.identity);
    } catch {
      // Already gone / room not live
    }
  }

  await req.server.prisma.onboardingMeetingParticipant.update({
    where: { id: participant.id }, data: { status: 'removed', leftAt: new Date() },
  });
  return reply.send({ success: true, data: null, error: null });
}

// POST /api/onboarding-meetings/admin/:id/participants/:participantId/mute
// Mirrors workshops' muteAllHandler track-lookup pattern (mute the
// participant's published audio track) — scoped to a single participant
// instead of the whole room. Not a copy of muteParticipantHandler's
// signature (that one takes a trackSid from the client); here the
// audio track is resolved server-side via listParticipants so the admin
// UI only ever needs the participant row id, same as remove.
export async function adminMuteParticipantHandler(req: FastifyRequest<{ Params: { id: string; participantId: string } }>, reply: FastifyReply) {
  const { env } = await import('../../config/env.js');
  if (!isLiveKitConfigured(env)) {
    return reply.status(503).send({ success: false, data: null, error: { code: 'ERROR', message: 'Live meeting service not configured' } });
  }
  const participant = await req.server.prisma.onboardingMeetingParticipant.findUnique({ where: { id: req.params.participantId } });
  if (!participant || participant.meetingId !== req.params.id) {
    return reply.status(404).send({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'Participant not found' } });
  }
  if (!participant.identity) {
    return reply.status(400).send({ success: false, data: null, error: { code: 'BAD_REQUEST', message: 'Participant has not joined the room yet' } });
  }

  const svc = await getOnboardingRoomServiceClient(env as any);
  const roomName = onboardingRoomName(req.params.id);
  const roomParticipants = await svc.listParticipants(roomName).catch(() => []);
  const live = roomParticipants.find((p) => p.identity === participant.identity);
  if (!live) {
    return reply.status(400).send({ success: false, data: null, error: { code: 'BAD_REQUEST', message: 'Participant is not currently in the room' } });
  }

  const audioTrack = (live.tracks ?? []).find((t) => t.type === 0 /* AUDIO */ && !t.muted);
  if (!audioTrack?.sid) {
    // Already muted (or never published audio) — treat as success, not an error.
    return reply.send({ success: true, data: null, error: null });
  }
  await svc.mutePublishedTrack(roomName, participant.identity, audioTrack.sid, true);
  return reply.send({ success: true, data: null, error: null });
}

// ── Member (JWT cookie) ──────────────────────────────────────────────────

// GET /api/onboarding-meetings — this member's onboarding meetings
export async function listMyMeetingsHandler(req: FastifyRequest, reply: FastifyReply) {
  const memberId = req.memberId!;
  const rows = await req.server.prisma.onboardingMeeting.findMany({
    where: { OR: [{ memberId }, { participants: { some: { memberId } } }] },
    select: MEETING_LIST_SELECT,
    orderBy: { scheduledAt: 'desc' },
  });
  return reply.send({ success: true, data: rows, error: null });
}

// POST /api/onboarding-meetings/:id/token — member join
export async function joinMyMeetingHandler(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const { env } = await import('../../config/env.js');
  if (!isLiveKitConfigured(env)) {
    return reply.status(503).send({ success: false, data: null, error: { code: 'ERROR', message: 'Live meeting service not configured' } });
  }
  const memberId = req.memberId!;

  const meeting = await req.server.prisma.onboardingMeeting.findUnique({ where: { id: req.params.id }, select: { id: true, status: true, title: true, startedAt: true } });
  if (!meeting) return reply.status(404).send({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'Meeting not found' } });

  const participant = await req.server.prisma.onboardingMeetingParticipant.findFirst({ where: { meetingId: meeting.id, memberId } });
  if (!participant) return reply.status(403).send({ success: false, data: null, error: { code: 'FORBIDDEN', message: 'You are not invited to this meeting' } });
  if (participant.status === 'removed') {
    return reply.status(403).send({ success: false, data: null, error: { code: 'FORBIDDEN', message: 'You have been removed from this meeting' } });
  }
  if (!canJoinMeeting(meeting.status as OnboardingMeetingStatus)) {
    return reply.status(400).send({ success: false, data: null, error: { code: 'BAD_REQUEST', message: 'This meeting is not currently joinable' } });
  }

  const member = await req.server.prisma.member.findUnique({ where: { id: memberId }, select: { firstName: true, lastName: true } });
  const name = `${member?.firstName ?? ''} ${member?.lastName ?? ''}`.trim() || 'Member';
  const token = await mintOnboardingToken(env as any, { meetingId: meeting.id, identity: memberId, name, role: 'participant' });

  await req.server.prisma.onboardingMeetingParticipant.update({
    where: { id: participant.id }, data: { status: 'joined', joinedAt: participant.joinedAt ?? new Date(), identity: memberId },
  });

  return reply.send({
    success: true,
    data: { token, wsUrl: env.LIVEKIT_WS_URL, roomName: onboardingRoomName(meeting.id), status: meeting.status, title: meeting.title, startedAt: meeting.startedAt },
    error: null,
  });
}

// POST /api/onboarding-meetings/:id/leave — explicit member leave
export async function leaveMyMeetingHandler(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const memberId = req.memberId!;
  const participant = await req.server.prisma.onboardingMeetingParticipant.findFirst({ where: { meetingId: req.params.id, memberId } });
  if (!participant) return reply.status(404).send({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'Not a participant of this meeting' } });

  await req.server.prisma.onboardingMeetingParticipant.update({
    where: { id: participant.id }, data: { status: 'left', leftAt: new Date() },
  });
  return reply.send({ success: true, data: null, error: null });
}
