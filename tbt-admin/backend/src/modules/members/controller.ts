import type { FastifyReply, FastifyRequest } from 'fastify';
import { createMemberSchema, updateMemberSchema } from './schema.js';

export async function listMembersHandler(request: FastifyRequest, reply: FastifyReply) {
  const { page = 1, limit = 10, search } = request.query as any;
  const skip = (page - 1) * limit;

  const where = search ? {
    OR: [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { memberId: { contains: search, mode: 'insensitive' } },
      { businessName: { contains: search, mode: 'insensitive' } },
    ]
  } : {};

  const [members, total] = await Promise.all([
    request.server.prisma.member.findMany({
      where: where as any,
      skip,
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
      include: {
        accountManager: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        },
        creator: {
          select: {
            id: true,
            fullName: true
          }
        },
        batch: true
      }
    }),
    request.server.prisma.member.count({ where: where as any }),
  ]);

  return reply.send({ success: true, data: members, meta: { total, page, limit }, error: null });
}

export async function createMemberHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const body = createMemberSchema.parse(request.body);

    // Check email uniqueness
    const existingEmail = await request.server.prisma.member.findUnique({ where: { email: body.email } });
    if (existingEmail) {
      return reply.status(409).send({ success: false, error: { code: 'CONFLICT', message: 'Email already exists' } });
    }

    const {
      dob,
      businessEstablishedOn,
      accountManagerId,
      batchId,
      createdBy,
      password,
      ...restBody
    } = body;

    // Create Clerk user if a password was provided
    let clerkId: string | undefined;
    if (password) {
      try {
        const baseUsername = body.email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_');
        const suffix = Math.floor(100 + Math.random() * 900);
        const username = `${baseUsername}_${suffix}`;
        const clerkUser = await request.server.clerk.users.createUser({
          emailAddress: [body.email],
          password,
          username,
          firstName: body.firstName,
          lastName: body.lastName || undefined,
        });
        clerkId = clerkUser.id;
      } catch (clerkErr: any) {
        const msg = clerkErr.errors?.[0]?.longMessage || clerkErr.message || 'Failed to create auth account';
        return reply.status(400).send({ success: false, error: { code: 'AUTH_FAILED', message: msg } });
      }
    }

    const data: any = {
      ...restBody,
      dob: dob ? new Date(dob) : null,
      businessEstablishedOn: businessEstablishedOn ? new Date(businessEstablishedOn) : null,
      marketingChannels: body.marketingChannels || [],
      currentChallenges: body.currentChallenges || [],
      ...(clerkId && { clerkId }),
    };

    if (accountManagerId) {
      data.accountManager = { connect: { id: accountManagerId } };
    }

    if (batchId) {
      data.batch = { connect: { id: batchId } };
    }

    if (createdBy) {
      data.creator = { connect: { id: createdBy } };
    }

    // Auto-generate if not provided from frontend.
    if (!data.memberId) {
      data.memberId = `TBT-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    let member;
    try {
      member = await request.server.prisma.member.create({ data });
    } catch (prismaErr: any) {
      // Roll back the Clerk user if DB insert fails
      if (clerkId) {
        await request.server.clerk.users.deleteUser(clerkId).catch(() => {});
      }
      throw prismaErr;
    }

    request.server.io.to('admin').emit('admin:member_joined', {
      memberId: member.id,
      fullName: member.firstName + ' ' + (member.lastName ?? ''),
      createdAt: member.createdAt,
    });

    return reply.status(201).send({ success: true, data: member, error: null });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Validation failed', fields: err.flatten().fieldErrors }
      });
    }
    request.server.log.error({ err }, 'Failed to create member');
    return reply.status(500).send({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: err.message || 'Something went wrong' } });
  }
}

export async function getMemberHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const member = await request.server.prisma.member.findUnique({ 
    where: { id },
    include: { 
        accountManager: true, 
        creator: true,
        batch: true,
        courseEnrollments: { include: { course: true } }
    }
  });
  if (!member) return reply.status(404).send({ success: false, data: null, error: 'Member not found' });
  return reply.send({ success: true, data: member, error: null });
}

export async function updateMemberHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id: string };
    const body = updateMemberSchema.parse(request.body);

    const {
      dob,
      businessEstablishedOn,
      accountManagerId,
      batchId,
      createdBy,
      password,
      ...restBody
    } = body as any;

    // Handle password update via Clerk
    if (password && password.trim() !== '') {
      const currentMember = await request.server.prisma.member.findUnique({
        where: { id },
        select: { email: true, firstName: true, lastName: true, clerkId: true }
      });
      if (!currentMember) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Member not found' } });
      }

      if ((currentMember as any).clerkId) {
        try {
          await request.server.clerk.users.updateUser((currentMember as any).clerkId, { password });
        } catch (clerkErr: any) {
          const msg = clerkErr.errors?.[0]?.longMessage || clerkErr.message || 'Failed to update auth account';
          return reply.status(400).send({ success: false, error: { code: 'AUTH_FAILED', message: msg } });
        }
      } else {
        // Member has no Clerk account yet — create one and link it
        try {
          const baseUsername = currentMember.email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_');
          const suffix = Math.floor(100 + Math.random() * 900);
          const username = `${baseUsername}_${suffix}`;
          const clerkUser = await request.server.clerk.users.createUser({
            emailAddress: [currentMember.email],
            password,
            username,
            firstName: currentMember.firstName,
            lastName: currentMember.lastName || undefined,
          });
          restBody.clerkId = clerkUser.id;
        } catch (clerkErr: any) {
          const msg = clerkErr.errors?.[0]?.longMessage || clerkErr.message || 'Failed to create auth account';
          return reply.status(400).send({ success: false, error: { code: 'AUTH_FAILED', message: msg } });
        }
      }
    }

    const data: any = {};

    // Only assign non-empty strings and valid fields from restBody
    for (const key in restBody) {
        if (restBody[key] !== "" && restBody[key] !== undefined) {
            data[key] = restBody[key];
        }
    }

    if (dob) {
      data.dob = new Date(dob as string);
    } else if (dob === "") {
      data.dob = null;
    }

    if (businessEstablishedOn) {
      data.businessEstablishedOn = new Date(businessEstablishedOn as string);
    } else if (businessEstablishedOn === "") {
      data.businessEstablishedOn = null;
    }

    if (accountManagerId !== undefined) {
      if (accountManagerId && accountManagerId.trim() !== '') {
        data.accountManager = { connect: { id: accountManagerId } };
      } else {
        data.accountManager = { disconnect: true };
      }
    }

    if (batchId !== undefined) {
      if (batchId && batchId.trim() !== '') {
        data.batch = { connect: { id: batchId } };
      } else {
        data.batch = { disconnect: true };
      }
    }
    
    if (createdBy !== undefined) {
      if (createdBy && createdBy.trim() !== '') {
        data.creator = { connect: { id: createdBy } };
      } else {
        data.creator = { disconnect: true };
      }
    }

    const member = await request.server.prisma.member.update({ 
      where: { id }, 
      data 
    });
    
    return reply.send({ success: true, data: member, error: null });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return reply.status(400).send({ 
        success: false, 
        error: { code: 'VALIDATION_ERROR', message: 'Validation failed', fields: err.flatten().fieldErrors } 
      });
    }
    request.server.log.error({ err }, 'Failed to update member');
    return reply.status(500).send({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: err.message || 'Something went wrong' } });
  }
}

export async function deleteMemberHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  // Implement soft delete if needed, but for now hard delete as per previous code
  await request.server.prisma.member.delete({ where: { id } });
  return reply.send({ success: true, data: null, error: null });
}

export async function getManagersHandler(request: FastifyRequest, reply: FastifyReply) {
  const managers = await request.server.prisma.admin.findMany({
    where: { status: 'active' },
    orderBy: { fullName: 'asc' },
    select: { id: true, fullName: true, email: true, designation: true, role: true, profilePhotoUrl: true },
  });
  return reply.send({ success: true, data: managers, error: null });
}

export async function createManagerHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { fullName, email, phone, designation } = request.body as {
      fullName: string;
      email: string;
      phone?: string;
      designation?: string;
    };

    if (!fullName?.trim() || fullName.trim().length < 2) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Full name is required (min 2 characters)' } });
    }
    if (!email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Valid email is required' } });
    }

    const existingEmail = await request.server.prisma.admin.findUnique({ where: { email: email.trim() } });
    if (existingEmail) {
      return reply.status(409).send({ success: false, error: { code: 'CONFLICT', message: 'An admin with this email already exists' } });
    }

    // Auto-generate username and password
    const baseUsername = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_');
    const suffix = Math.floor(100 + Math.random() * 900);
    const username = `${baseUsername}_${suffix}`;
    const tempPassword = `Tbt@${Math.random().toString(36).slice(-6)}${suffix}`;

    let clerkUserId = '';
    try {
      const clerkUser = await request.server.clerk.users.createUser({
        emailAddress: [email.trim()],
        password: tempPassword,
        username,
        firstName: fullName.trim().split(' ')[0],
        lastName: fullName.trim().split(' ').slice(1).join(' ') || undefined,
      });
      clerkUserId = clerkUser.id;
    } catch (clerkErr: any) {
      const msg = clerkErr.errors?.[0]?.longMessage || clerkErr.message || 'Failed to create auth account';
      return reply.status(400).send({ success: false, error: { code: 'AUTH_FAILED', message: msg } });
    }

    try {
      const sequence = await request.server.prisma.adminIdSequence.create({ data: {} });
      const employeeId = `TBT-ADMIN-${new Date().getFullYear()}-${String(sequence.id).padStart(4, '0')}`;

      const admin = await request.server.prisma.admin.create({
        data: {
          clerkId: clerkUserId,
          employeeId,
          fullName: fullName.trim(),
          email: email.trim(),
          phone: phone?.trim() || undefined,
          designation: designation?.trim() || undefined,
          username,
          role: 'account_manager',
          status: 'active',
          country: 'India',
        },
        select: { id: true, fullName: true, email: true, designation: true, role: true, employeeId: true },
      });

      return reply.status(201).send({ success: true, data: admin, error: null });
    } catch (prismaErr: any) {
      await request.server.clerk.users.deleteUser(clerkUserId).catch(() => {});
      throw prismaErr;
    }
  } catch (err: any) {
    request.server.log.error(err);
    return reply.status(500).send({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: err.message || 'Something went wrong' } });
  }
}


export async function getMemberProgressHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  const enrollments = await req.server.prisma.workshopEnrollment.findMany({
    where: { memberId: id },
    include: {
      workshop: {
        include: {
          challenges: {
            orderBy: { order: 'asc' },
            include: {
              episodes: { include: { progress: { where: { memberId: id } } } },
              assignments: { include: { submissions: { where: { memberId: id } } } },
            },
          },
        },
      },
    },
    orderBy: { enrolledAt: 'desc' },
  });

  const workshops = enrollments.map(e => {
    const challenges = e.workshop.challenges.map(c => {
      const total = c.episodes.length;
      const completed = c.episodes.filter(ep => ep.progress[0]?.isCompleted).length;
      return {
        title: c.title,
        completedCount: completed,
        totalCount: total,
        percent: total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    });
    const totalEp = challenges.reduce((s, c) => s + c.totalCount, 0);
    const completedEp = challenges.reduce((s, c) => s + c.completedCount, 0);
    const lastActivity = e.workshop.challenges.flatMap(c =>
      c.episodes.flatMap(ep => ep.progress.map(p => p.updatedAt))
    ).sort((a, b) => (b as any) - (a as any))[0] || null;

    return {
      workshopId: e.workshopId,
      workshopTitle: e.workshop.title,
      status: e.status,
      overallPercent: totalEp > 0 ? Math.round((completedEp / totalEp) * 100) : 0,
      completedCount: completedEp,
      totalCount: totalEp,
      challenges,
      assignments: e.workshop.challenges.flatMap(c =>
        c.assignments.map(a => ({
          title: a.title,
          isSubmitted: a.submissions.length > 0,
          submittedAt: a.submissions[0]?.submittedAt || null,
        }))
      ),
      lastActiveAt: lastActivity,
    };
  });

  return reply.send({ success: true, data: { workshops }, error: null });
}

// ── MEMBER BADGES ─────────────────────────────────────────────────────

export async function listMemberBadgesHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  const badges = await req.server.prisma.memberBadge.findMany({
    where: { memberId: id },
    include: { badge: { select: { id: true, name: true, description: true, iconUrl: true } } },
    orderBy: { earnedAt: 'asc' },
  });
  return reply.send({ success: true, data: badges, error: null });
}

export async function listAllBadgesHandler(_req: FastifyRequest, reply: FastifyReply) {
  const badges = await _req.server.prisma.badge.findMany({ orderBy: { name: 'asc' } });
  return reply.send({ success: true, data: badges, error: null });
}

export async function assignBadgeHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  const { badgeId } = req.body as any;
  const existing = await req.server.prisma.memberBadge.findFirst({ where: { memberId: id, badgeId } });
  if (existing) return reply.send({ success: true, data: existing, error: null });
  const mb = await req.server.prisma.memberBadge.create({ data: { memberId: id, badgeId } });
  return reply.status(201).send({ success: true, data: mb, error: null });
}

export async function removeBadgeHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id, badgeId } = req.params as any;
  await req.server.prisma.memberBadge.deleteMany({ where: { memberId: id, badgeId } });
  return reply.send({ success: true, data: null, error: null });
}

// ── MEMBER ENROLLMENTS ────────────────────────────────────────────────

export async function listMemberEnrollmentsHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  const enrollments = await req.server.prisma.workshopEnrollment.findMany({
    where: { memberId: id },
    include: {
      workshop: { select: { id: true, title: true, thumbnailUrl: true, isActive: true, slug: true } },
    },
    orderBy: { enrolledAt: 'desc' },
  });
  return reply.send({ success: true, data: enrollments, error: null });
}

export async function enrollMemberInWorkshopHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as any;
  const { workshopId } = req.body as any;
  if (!workshopId) {
    return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'workshopId is required' } });
  }
  const workshop = await req.server.prisma.workshop.findUnique({ where: { id: workshopId } });
  if (!workshop) {
    return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Workshop not found' } });
  }
  const enrollment = await req.server.prisma.workshopEnrollment.upsert({
    where: { workshopId_memberId: { workshopId, memberId: id } },
    update: { status: 'active' },
    create: { workshopId, memberId: id, status: 'active' },
  });
  return reply.status(201).send({ success: true, data: enrollment, error: null });
}

export async function removeMemberEnrollmentHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id, workshopId } = req.params as any;
  try {
    await req.server.prisma.workshopEnrollment.delete({
      where: { workshopId_memberId: { workshopId, memberId: id } },
    });
  } catch {
    return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Enrollment not found' } });
  }
  return reply.send({ success: true, data: null, error: null });
}

// ── MEMBER WATCH ANALYTICS ────────────────────────────────────────────

function parseUASimple(ua: string | null | undefined): { browser: string; os: string } {
  if (!ua) return { browser: 'Unknown', os: 'Unknown' };
  let os = 'Unknown';
  if (/windows/i.test(ua)) os = 'Windows';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
  else if (/linux/i.test(ua)) os = 'Linux';
  let browser = 'Unknown';
  if (/edg\//i.test(ua)) browser = 'Edge';
  else if (/opr\/|opera/i.test(ua)) browser = 'Opera';
  else if (/samsungbrowser/i.test(ua)) browser = 'Samsung';
  else if (/firefox\//i.test(ua)) browser = 'Firefox';
  else if (/chrome\//i.test(ua)) browser = 'Chrome';
  else if (/safari\//i.test(ua)) browser = 'Safari';
  return { browser, os };
}

export async function getMemberWatchAnalyticsHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const { page = 1, limit = 25 } = req.query as { page?: number; limit?: number };

  const member = await req.server.prisma.member.findUnique({ where: { id }, select: { id: true } });
  if (!member) {
    return reply.status(404).send({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'Member not found' } });
  }

  const [historyPage, historyTotal, allSummary, devices, securityEvents] = await Promise.all([
    // Paginated episode-level history
    req.server.prisma.memberEpisodeProgress.findMany({
      where: { memberId: id },
      orderBy: { updatedAt: 'desc' },
      take: Number(limit),
      skip: (Number(page) - 1) * Number(limit),
      select: {
        episodeId: true,
        lastWatchedSecs: true,
        actualWatchedSecs: true,
        isCompleted: true,
        completedAt: true,
        updatedAt: true,
        episode: {
          select: {
            title: true,
            durationSeconds: true,
            challenge: {
              select: {
                workshop: { select: { id: true, title: true, slug: true } },
              },
            },
          },
        },
      },
    }),

    // Total count for pagination
    req.server.prisma.memberEpisodeProgress.count({ where: { memberId: id } }),

    // Aggregate stats (all rows, minimal fields)
    req.server.prisma.memberEpisodeProgress.findMany({
      where: { memberId: id },
      select: { actualWatchedSecs: true, isCompleted: true },
    }),

    // Active devices (last 30 days)
    req.server.prisma.memberSession.findMany({
      where: { memberId: id, lastActiveAt: { gt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      orderBy: { lastActiveAt: 'desc' },
      select: { id: true, deviceId: true, ipAddress: true, userAgent: true, lastActiveAt: true, startedAt: true },
    }),

    // Security events for this member
    req.server.prisma.securityLog.findMany({
      where: { memberId: id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, eventType: true, metadata: true, createdAt: true },
    }),
  ]);

  // Aggregate stats
  const totalWatchSeconds = allSummary.reduce((s, p) => s + (p.actualWatchedSecs ?? 0), 0);
  const completedCount    = allSummary.filter(p => p.isCompleted).length;
  const inProgressCount   = allSummary.filter(p => !p.isCompleted && (p.actualWatchedSecs ?? 0) > 0).length;
  const completionRate    = allSummary.length > 0 ? Math.round((completedCount / allSummary.length) * 100) : 0;

  const historyItems = historyPage.map(p => {
    const dur = p.episode.durationSeconds ?? 0;
    const pct = dur > 0 ? Math.min(100, Math.round((p.actualWatchedSecs / dur) * 100)) : 0;
    return {
      episodeId:        p.episodeId,
      episodeTitle:     p.episode.title,
      workshopTitle:    p.episode.challenge.workshop.title,
      workshopSlug:     p.episode.challenge.workshop.slug,
      durationSeconds:  dur,
      watchedSeconds:   p.actualWatchedSecs,
      lastPositionSecs: p.lastWatchedSecs,
      progressPct:      pct,
      isCompleted:      p.isCompleted,
      completedAt:      p.completedAt?.toISOString() ?? null,
      lastWatchedAt:    p.updatedAt.toISOString(),
    };
  });

  const deviceItems = devices.map(d => {
    const { browser, os } = parseUASimple(d.userAgent);
    return {
      id:           d.id,
      deviceId:     d.deviceId ?? null,
      browser,
      os,
      ipAddress:    d.ipAddress ?? null,
      lastActiveAt: d.lastActiveAt.toISOString(),
      startedAt:    d.startedAt.toISOString(),
    };
  });

  return reply.send({
    success: true,
    data: {
      stats: {
        totalWatchSeconds,
        totalEpisodes:    allSummary.length,
        completedEpisodes: completedCount,
        inProgressEpisodes: inProgressCount,
        completionRate,
        securityFlagCount: securityEvents.length,
      },
      history:       historyItems,
      historyTotal,
      devices:       deviceItems,
      securityEvents: securityEvents.map(e => ({
        id:        e.id,
        eventType: e.eventType,
        metadata:  e.metadata ?? {},
        createdAt: e.createdAt.toISOString(),
      })),
    },
    error: null,
  });
}

export async function getMemberActivityTimelineHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const { page = 1, limit = 30 } = req.query as { page?: number; limit?: number };

  const member = await req.server.prisma.member.findUnique({ where: { id }, select: { id: true } });
  if (!member) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Member not found' } });

  const [activities, total] = await Promise.all([
    (req.server.prisma as any).activityLog.findMany({
      where: { userId: id, userType: 'member' },
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
      skip: (Number(page) - 1) * Number(limit),
    }),
    (req.server.prisma as any).activityLog.count({ where: { userId: id, userType: 'member' } }),
  ]);

  return reply.send({ success: true, data: activities, meta: { total, page: Number(page), limit: Number(limit) }, error: null });
}

export async function getAnalyticsOverviewHandler(req: FastifyRequest, reply: FastifyReply) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo  = new Date(Date.now() - 7  * 24 * 60 * 60 * 1000);

  const [
    totalMembers,
    activeMembers30d,
    totalEnrollments,
    completedEpisodes,
    completedChallenges,
    submittedAssignments,
    avgHealthScore,
    newMembersThisMonth,
  ] = await Promise.all([
    req.server.prisma.member.count(),
    req.server.prisma.member.count({ where: { lastActiveAt: { gte: thirtyDaysAgo } } }),
    req.server.prisma.workshopEnrollment.count(),
    req.server.prisma.memberEpisodeProgress.count({ where: { isCompleted: true } }),
    (req.server.prisma as any).memberChallengeProgress.count({ where: { status: 'completed' } }),
    req.server.prisma.assignmentSubmission.count(),
    req.server.prisma.member.aggregate({ _avg: { healthScore: true } }),
    req.server.prisma.member.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
  ]);

  return reply.send({
    success: true,
    data: {
      totalMembers,
      activeMembers30d,
      totalEnrollments,
      completedEpisodes,
      completedChallenges,
      submittedAssignments,
      avgHealthScore: Math.round((avgHealthScore._avg.healthScore ?? 0) * 10) / 10,
      newMembersThisMonth,
    },
    error: null,
  });
}

export async function getAtRiskMembersHandler(req: FastifyRequest, reply: FastifyReply) {
  const { inactiveDays = 7, completionThreshold = 50, page = 1, limit = 20 } = req.query as {
    inactiveDays?: number; completionThreshold?: number; page?: number; limit?: number;
  };

  const cutoff = new Date(Date.now() - Number(inactiveDays) * 24 * 60 * 60 * 1000);

  const [members, total] = await Promise.all([
    req.server.prisma.member.findMany({
      where: {
        OR: [
          { lastActiveAt: { lt: cutoff } },
          { lastActiveAt: null },
        ],
        healthScore: { lt: Number(completionThreshold) },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        healthScore: true,
        totalPoints: true,
        currentStreak: true,
        lastActiveAt: true,
        _count: { select: { workshopEnrollments: true } },
      },
      orderBy: { healthScore: 'asc' },
      take: Number(limit),
      skip: (Number(page) - 1) * Number(limit),
    }),
    req.server.prisma.member.count({
      where: {
        OR: [
          { lastActiveAt: { lt: cutoff } },
          { lastActiveAt: null },
        ],
        healthScore: { lt: Number(completionThreshold) },
      },
    }),
  ]);

  return reply.send({ success: true, data: members, meta: { total, page: Number(page), limit: Number(limit) }, error: null });
}

export async function getCompletionMatrixHandler(req: FastifyRequest, reply: FastifyReply) {
  const { workshopId } = req.params as { workshopId: string };

  const workshop = await req.server.prisma.workshop.findUnique({
    where: { id: workshopId },
    include: {
      challenges: {
        orderBy: { order: 'asc' },
        select: { id: true, title: true, numberLabel: true },
      },
    },
  });
  if (!workshop) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Workshop not found' } });

  const enrollments = await req.server.prisma.workshopEnrollment.findMany({
    where: { workshopId },
    include: {
      member: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
    orderBy: { enrolledAt: 'desc' },
  });

  const challengeIds = workshop.challenges.map(c => c.id);
  const memberIds = enrollments.map(e => e.memberId);

  const completedProgress = await (req.server.prisma as any).memberChallengeProgress.findMany({
    where: { memberId: { in: memberIds }, challengeId: { in: challengeIds }, status: 'completed' },
    select: { memberId: true, challengeId: true, completedAt: true },
  });

  const progressMap = new Map<string, Set<string>>();
  for (const p of completedProgress) {
    if (!progressMap.has(p.memberId)) progressMap.set(p.memberId, new Set());
    progressMap.get(p.memberId)!.add(p.challengeId);
  }

  const rows = enrollments.map(e => ({
    member: e.member,
    enrolledAt: e.enrolledAt,
    status: e.status,
    challenges: workshop.challenges.map(c => ({
      challengeId: c.id,
      completed: progressMap.get(e.memberId)?.has(c.id) ?? false,
    })),
    completedCount: progressMap.get(e.memberId)?.size ?? 0,
    totalCount: challengeIds.length,
  }));

  return reply.send({
    success: true,
    data: {
      workshopId,
      workshopTitle: workshop.title,
      challenges: workshop.challenges,
      rows,
    },
    error: null,
  });
}

export async function reviewAssignmentHandler(req: FastifyRequest, reply: FastifyReply) {
  const { submissionId } = req.params as { submissionId: string };
  const { reviewNote, reviewedBy } = req.body as { reviewNote?: string; reviewedBy?: string };

  const submission = await req.server.prisma.assignmentSubmission.findUnique({ where: { id: submissionId } });
  if (!submission) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Submission not found' } });

  const updated = await req.server.prisma.assignmentSubmission.update({
    where: { id: submissionId },
    data: {
      reviewNote: reviewNote ?? null,
      reviewedBy: reviewedBy ?? null,
      reviewedAt: new Date(),
    },
    select: { id: true, reviewNote: true, reviewedBy: true, reviewedAt: true, submittedAt: true, answerText: true },
  });

  return reply.send({ success: true, data: updated, error: null });
}

export async function listAllAssignmentSubmissionsHandler(req: FastifyRequest, reply: FastifyReply) {
  const { page = 1, limit = 20, reviewed, workshopId } = req.query as {
    page?: number; limit?: number; reviewed?: string; workshopId?: string;
  };

  const where: any = {};
  if (reviewed === 'true')  where.reviewedAt = { not: null };
  if (reviewed === 'false') where.reviewedAt = null;
  if (workshopId) {
    where.assignment = { challenge: { workshopId } };
  }

  const [submissions, total] = await Promise.all([
    req.server.prisma.assignmentSubmission.findMany({
      where,
      orderBy: { submittedAt: 'desc' },
      take: Number(limit),
      skip: (Number(page) - 1) * Number(limit),
      include: {
        member: { select: { id: true, firstName: true, lastName: true, email: true } },
        assignment: {
          select: {
            id: true,
            title: true,
            challenge: {
              select: {
                id: true,
                title: true,
                workshop: { select: { id: true, title: true } },
              },
            },
          },
        },
      },
    }),
    req.server.prisma.assignmentSubmission.count({ where }),
  ]);

  return reply.send({ success: true, data: submissions, meta: { total, page: Number(page), limit: Number(limit) }, error: null });
}
