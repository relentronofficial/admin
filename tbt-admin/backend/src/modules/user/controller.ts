import type { FastifyReply, FastifyRequest } from 'fastify';

// ─── Shared helpers ───────────────────────────────────────────────────────────

function ok(reply: FastifyReply, data: unknown, meta?: object) {
  return reply.send({ success: true, data, error: null, ...(meta && { meta }) });
}

function fail(reply: FastifyReply, status: number, message: string) {
  return reply.status(status).send({ success: false, data: null, error: { code: 'ERROR', message } });
}

// ─── Profile ─────────────────────────────────────────────────────────────────

export async function getMeHandler(request: FastifyRequest, reply: FastifyReply) {
  const [member, allTiers, uiStrings] = await Promise.all([
    request.server.prisma.member.findUnique({
      where: { id: request.memberId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        dob: true,
        profilePhotoUrl: true,
        avatarGradient: true,
        currentTier: true,
        membershipPlan: true,
        displayBadges: {
          select: {
            badge: { select: { id: true, label: true, color: true, bgColor: true } },
          },
        },
        subscriptions: {
          where: { status: 'active' },
          orderBy: { endsAt: 'desc' },
          take: 1,
          select: { status: true, startsAt: true, endsAt: true },
        },
      },
    }),
    request.server.prisma.tier.findMany({
      where: { isActive: true },
      orderBy: { tierNumber: 'asc' },
      select: { tierNumber: true, label: true, unlockConditionText: true },
    }),
    request.server.prisma.uiStrings.findFirst(),
  ]);

  if (!member) return fail(reply, 404, 'Member not found');

  const activeSub = member.subscriptions[0] ?? null;
  const memberTier = member.currentTier ?? 1;

  const tiers = allTiers.map((t) => ({
    tierNumber: t.tierNumber,
    label: t.label,
    status: t.tierNumber <= memberTier ? 'unlocked' : 'locked',
    unlockConditionText: t.tierNumber <= memberTier ? null : (t.unlockConditionText ?? null),
  }));

  const personalLabel = uiStrings?.profilePersonalLabel ?? 'Personal Details';
  const subscriptionLabel = uiStrings?.profileSubscriptionLabel ?? 'Subscription';
  const tiersLabel = uiStrings?.profileTiersLabel ?? 'Tier Access';

  const sections = [
    {
      id: 'personal',
      label: personalLabel,
      fields: ['firstName', 'lastName', 'email', 'phone', 'dob'],
      fieldLabels: {
        firstName: uiStrings?.profileFirstNameLabel ?? 'First Name',
        lastName: uiStrings?.profileLastNameLabel ?? 'Last Name',
        email: uiStrings?.profileEmailLabel ?? 'Email',
        phone: uiStrings?.profilePhoneLabel ?? 'Phone',
        dob: uiStrings?.profileDobLabel ?? 'Date of Birth',
      },
    },
    {
      id: 'subscription',
      label: subscriptionLabel,
      fields: ['startDate', 'endDate'],
      fieldLabels: {
        startDate: uiStrings?.profileSubStartLabel ?? 'Start Date',
        endDate: uiStrings?.profileSubEndLabel ?? 'End Date',
      },
    },
    { id: 'tiers', label: tiersLabel, fields: [] as string[], fieldLabels: {} },
  ];

  return ok(reply, {
    id: member.id,
    firstName: member.firstName,
    lastName: member.lastName ?? null,
    email: member.email,
    phone: member.phone,
    dob: member.dob ? member.dob.toISOString().split('T')[0] : null,
    avatarUrl: member.profilePhotoUrl ?? null,
    avatarGradient: member.avatarGradient ?? null,
    currentTier: memberTier,
    badges: member.displayBadges.map((db) => db.badge),
    subscription: activeSub
      ? {
          startDate: activeSub.startsAt.toISOString().split('T')[0],
          endDate: activeSub.endsAt.toISOString().split('T')[0],
          status: activeSub.status,
        }
      : null,
    tiers,
    sections,
    saveLabel: uiStrings?.profileSaveLabel ?? 'Save Changes',
    signOutLabel: uiStrings?.profileSignOutLabel ?? 'Sign Out',
  });
}

export async function updateMeHandler(request: FastifyRequest, reply: FastifyReply) {
  const { firstName, lastName, phone, dob } = request.body as {
    firstName?: string;
    lastName?: string;
    phone?: string;
    dob?: string | null;
  };

  const data: Record<string, unknown> = {};
  if (firstName?.trim()) data.firstName = firstName.trim();
  if (lastName !== undefined) data.lastName = lastName?.trim() || null;
  if (phone?.trim()) data.phone = phone.trim();
  if (dob !== undefined) data.dob = dob ? new Date(dob) : null;

  if (Object.keys(data).length === 0) return fail(reply, 400, 'No fields to update');

  const member = await request.server.prisma.member.update({
    where: { id: request.memberId },
    data,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      dob: true,
      profilePhotoUrl: true,
      avatarGradient: true,
    },
  });

  return ok(reply, {
    ...member,
    dob: member.dob ? member.dob.toISOString().split('T')[0] : null,
    avatarUrl: member.profilePhotoUrl ?? null,
  });
}

// ─── Courses (user-facing, published only) ────────────────────────────────────

export async function listUserCoursesHandler(request: FastifyRequest, reply: FastifyReply) {
  const { page = 1, limit = 24, search, level } = request.query as {
    page?: number;
    limit?: number;
    search?: string;
    level?: string;
  };

  const where: Record<string, unknown> = { isPublished: true };
  if (level) where.level = level;
  if (search?.trim()) {
    where.OR = [
      { title: { contains: search.trim(), mode: 'insensitive' } },
      { description: { contains: search.trim(), mode: 'insensitive' } },
    ];
  }

  const [courses, total] = await Promise.all([
    (request.server.prisma.course.findMany as any)({
      where: where,
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        thumbnailUrl: true,
        level: true,
        durationHours: true,
        totalLessons: true,
        isPublished: true,
        isFeatured: true,
        createdAt: true,
        creator: {
          select: { id: true, fullName: true, profilePhotoUrl: true, designation: true },
        },
        _count: { select: { enrollments: true } },
      },
      orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
      take: Number(limit),
      skip: (Number(page) - 1) * Number(limit),
    }) as Promise<any[]>,
    request.server.prisma.course.count({ where: where as any }),
  ]);

  const data = (courses as any[]).map((c: any) => ({
    id: c.id,
    title: c.title,
    slug: c.slug,
    description: c.description,
    thumbnailUrl: c.thumbnailUrl,
    level: c.level,
    durationHours: c.durationHours ? Number(c.durationHours) : null,
    isPublished: c.isPublished,
    isFeatured: c.isFeatured,
    createdAt: c.createdAt,
    instructor: c.creator ?? null,
    _count: { lessons: c.totalLessons, enrollments: c._count?.enrollments ?? 0 },
  }));

  return ok(reply, data, { total, page: Number(page), limit: Number(limit) });
}

export async function getUserCourseHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };

  const course = await request.server.prisma.course.findUnique({
    where: { id },
    include: {
      creator: {
        select: { id: true, fullName: true, profilePhotoUrl: true, designation: true },
      },
      courseEpisodes: {
        where: { isVisible: true },
        orderBy: { order: 'asc' },
      },
      _count: { select: { enrollments: true } },
    },
  });

  if (!course) return fail(reply, 404, 'Course not found');

  const lessons = course.courseEpisodes.map((ep) => ({
    id: ep.id,
    title: ep.title,
    description: null as string | null,
    videoUrl: ep.videoUrl,
    duration: ep.durationSeconds ? Math.round(ep.durationSeconds / 60) : null,
    durationSeconds: ep.durationSeconds ?? null,
    order: ep.order,
    isFree: false,
  }));

  return ok(reply, {
    id: course.id,
    title: course.title,
    slug: course.slug,
    description: course.description,
    thumbnailUrl: course.thumbnailUrl,
    level: course.level,
    durationHours: course.durationHours ? Number(course.durationHours) : null,
    isPublished: course.isPublished,
    isFeatured: course.isFeatured,
    createdAt: course.createdAt,
    instructor: course.creator ?? null,
    lessons,
    _count: { lessons: lessons.length, enrollments: course._count?.enrollments ?? 0 },
  });
}

export async function enrollCourseHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id: courseId } = request.params as { id: string };

  const course = await request.server.prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, isPublished: true },
  });
  if (!course || !course.isPublished) return fail(reply, 404, 'Course not found');

  const existing = await request.server.prisma.courseEnrollment.findUnique({
    where: { memberId_courseId: { memberId: request.memberId, courseId } },
  });
  if (existing) return fail(reply, 409, 'Already enrolled in this course');

  const enrollment = await (request.server.prisma.courseEnrollment.create as any)({
    data: { memberId: request.memberId, courseId, progressPercentage: 0 },
    include: {
      course: {
        select: { id: true, title: true, thumbnailUrl: true, level: true, isFeatured: true, isPublished: true, slug: true, createdAt: true, durationHours: true },
      },
    },
  }) as any;

  return reply.status(201).send({
    success: true,
    data: {
      id: enrollment.id,
      courseId: enrollment.courseId,
      memberId: enrollment.memberId,
      enrolledAt: enrollment.enrolledAt,
      completedAt: enrollment.completedAt,
      progressPercent: enrollment.progressPercentage,
      course: enrollment.course,
    },
    error: null,
  });
}

// ─── Enrollments ─────────────────────────────────────────────────────────────

export async function getEnrollmentsHandler(request: FastifyRequest, reply: FastifyReply) {
  const enrollments = await (request.server.prisma.courseEnrollment.findMany as any)({
    where: { memberId: request.memberId },
    include: {
      course: {
        select: {
          id: true,
          title: true,
          slug: true,
          description: true,
          thumbnailUrl: true,
          level: true,
          durationHours: true,
          totalLessons: true,
          isPublished: true,
          isFeatured: true,
          createdAt: true,
          creator: {
            select: { id: true, fullName: true, profilePhotoUrl: true, designation: true },
          },
          _count: { select: { enrollments: true } },
        },
      },
    },
    orderBy: { enrolledAt: 'desc' },
  }) as any[];

  const data = enrollments.map((e: any) => ({
    id: e.id,
    courseId: e.courseId,
    memberId: e.memberId,
    enrolledAt: e.enrolledAt,
    completedAt: e.completedAt ?? null,
    progressPercent: e.progressPercentage,
    course: {
      ...e.course,
      durationHours: e.course?.durationHours ? Number(e.course.durationHours) : null,
      instructor: e.course?.creator ?? null,
      _count: {
        lessons: e.course?.totalLessons ?? 0,
        enrollments: e.course?._count?.enrollments ?? 0,
      },
    },
  }));

  return ok(reply, data);
}

export async function getLessonProgressHandler(request: FastifyRequest, reply: FastifyReply) {
  const { courseId } = request.params as { courseId: string };

  const progress = await (request.server.prisma as any).courseEpisodeProgress.findMany({
    where: { memberId: request.memberId, episode: { courseId } },
    select: { episodeId: true, completed: true, completedAt: true },
  });

  const data = (progress as any[]).map((p) => ({
    lessonId: p.episodeId,
    completed: p.completed,
    watchedSeconds: 0,
    completedAt: p.completedAt ?? null,
  }));

  return ok(reply, data);
}

export async function markLessonCompleteHandler(request: FastifyRequest, reply: FastifyReply) {
  const { courseId, lessonId: episodeId } = request.params as { courseId: string; lessonId: string };
  const { watchedSeconds } = request.body as { watchedSeconds?: number };

  const episode = await request.server.prisma.courseEpisode.findFirst({
    where: { id: episodeId, courseId },
    select: { id: true },
  });
  if (!episode) return fail(reply, 404, 'Episode not found in this course');

  const now = new Date();
  await (request.server.prisma as any).courseEpisodeProgress.upsert({
    where: { memberId_episodeId: { memberId: request.memberId, episodeId } },
    create: { memberId: request.memberId, episodeId, completed: true, completedAt: now },
    update: { completed: true, completedAt: now },
  });

  await recalculateCourseProgress(request, courseId);

  return ok(reply, {
    lessonId: episodeId,
    completed: true,
    watchedSeconds: watchedSeconds ?? 0,
    completedAt: now.toISOString(),
  });
}

async function recalculateCourseProgress(request: FastifyRequest, courseId: string) {
  const [total, completed] = await Promise.all([
    request.server.prisma.courseEpisode.count({ where: { courseId } }),
    (request.server.prisma as any).courseEpisodeProgress.count({
      where: { memberId: request.memberId, episode: { courseId }, completed: true },
    }),
  ]);

  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  await request.server.prisma.courseEnrollment.updateMany({
    where: { memberId: request.memberId, courseId },
    data: {
      progressPercentage: pct,
      completedAt: pct === 100 ? new Date() : null,
    },
  });
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export async function getDashboardStatsHandler(request: FastifyRequest, reply: FastifyReply) {
  const now = new Date();

  const [totalCourses, completedCourses, member, upcomingEvents, unreadNotifications] =
    await Promise.all([
      request.server.prisma.courseEnrollment.count({
        where: { memberId: request.memberId },
      }),
      request.server.prisma.courseEnrollment.count({
        where: { memberId: request.memberId, completedAt: { not: null } },
      }),
      request.server.prisma.member.findUnique({
        where: { id: request.memberId },
        select: { totalPoints: true, currentStreak: true },
      }),
      request.server.prisma.event.count({
        where: { eventDate: { gt: now }, status: 'scheduled' },
      }),
      request.server.prisma.notification.count({
        where: { memberId: request.memberId, isRead: false },
      }),
    ]);

  return ok(reply, {
    totalCourses,
    completedCourses,
    inProgressCourses: totalCourses - completedCourses,
    totalPoints: member?.totalPoints ?? 0,
    currentStreak: member?.currentStreak ?? 0,
    upcomingEvents,
    unreadNotifications,
  });
}

export async function getContinueLearningHandler(request: FastifyRequest, reply: FastifyReply) {
  // Enrollments that are not yet completed
  const enrollments = await request.server.prisma.courseEnrollment.findMany({
    where: { memberId: request.memberId, completedAt: null, progressPercentage: { lt: 100 } },
    orderBy: { enrolledAt: 'desc' },
    take: 6,
    select: {
      courseId: true,
      progressPercentage: true,
      course: { select: { title: true, thumbnailUrl: true } },
    },
  });

  // For each enrollment, find the most recently accessed lesson
  const items = await Promise.all(
    enrollments.map(async (e) => {
      const lastProgress = await request.server.prisma.lessonProgress.findFirst({
        where: {
          memberId: request.memberId,
          lesson: { module: { courseId: e.courseId } },
        },
        orderBy: { updatedAt: 'desc' },
        select: { lessonId: true, lesson: { select: { title: true } } },
      });

      // Find the next uncompleted lesson
      const nextLesson = await request.server.prisma.lesson.findFirst({
        where: {
          module: { courseId: e.courseId },
          isPublished: true,
          progress: { none: { memberId: request.memberId, completed: true } },
        },
        orderBy: [{ module: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
        select: { id: true, title: true },
      });

      return {
        courseId: e.courseId,
        title: e.course.title,
        thumbnailUrl: e.course.thumbnailUrl ?? null,
        progressPercent: e.progressPercentage,
        lastLessonId: nextLesson?.id ?? lastProgress?.lessonId ?? null,
        lastLessonTitle: nextLesson?.title ?? lastProgress?.lesson?.title ?? null,
      };
    })
  );

  return ok(reply, items);
}

// ─── Events ──────────────────────────────────────────────────────────────────

export async function listUserEventsHandler(request: FastifyRequest, reply: FastifyReply) {
  const { page = 1, limit = 24, search } = request.query as {
    page?: number;
    limit?: number;
    search?: string;
  };

  const where: Record<string, unknown> = {};
  if (search?.trim()) {
    where.OR = [
      { title: { contains: search.trim(), mode: 'insensitive' } },
      { description: { contains: search.trim(), mode: 'insensitive' } },
    ];
  }

  const [events, total] = await Promise.all([
    request.server.prisma.event.findMany({
      where: where as any,
      orderBy: { eventDate: 'asc' },
      take: Number(limit),
      skip: (Number(page) - 1) * Number(limit),
    }),
    request.server.prisma.event.count({ where: where as any }),
  ]);

  return ok(reply, events, { total, page: Number(page), limit: Number(limit) });
}

export async function getUserEventHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const event = await request.server.prisma.event.findUnique({ where: { id } });
  if (!event) return fail(reply, 404, 'Event not found');
  return ok(reply, event);
}

export async function registerForEventHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id: eventId } = request.params as { id: string };

  const event = await request.server.prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, status: true },
  });
  if (!event) return fail(reply, 404, 'Event not found');

  const existing = await request.server.prisma.eventRegistration.findFirst({
    where: { memberId: request.memberId, eventId },
  });
  if (existing) return ok(reply, { registered: true });

  await request.server.prisma.eventRegistration.create({
    data: { memberId: request.memberId, eventId },
  });

  return reply.status(201).send({ success: true, data: { registered: true }, error: null });
}

// ─── Webinars ─────────────────────────────────────────────────────────────────

export async function listUserWebinarsHandler(request: FastifyRequest, reply: FastifyReply) {
  const { page = 1, limit = 24, status } = request.query as {
    page?: number;
    limit?: number;
    status?: string;
  };

  const where: Record<string, unknown> = {};
  if (status) where.status = status;

  const [webinars, total] = await Promise.all([
    request.server.prisma.webinar.findMany({
      where: where as any,
      include: {
        host: {
          select: { id: true, fullName: true, profilePhotoUrl: true, designation: true },
        },
      },
      orderBy: { scheduledAt: 'desc' },
      take: Number(limit),
      skip: (Number(page) - 1) * Number(limit),
    }),
    request.server.prisma.webinar.count({ where: where as any }),
  ]);

  const data = webinars.map((w) => ({
    id: w.id,
    title: w.title,
    description: w.description,
    scheduledAt: w.scheduledAt,
    durationMinutes: w.durationMinutes,
    status: w.status,
    streamUrl: w.meetingUrl ?? null,
    recordingUrl: w.recordingUrl ?? null,
    host: w.host ?? null,
  }));

  return ok(reply, data, { total, page: Number(page), limit: Number(limit) });
}

export async function getUserWebinarHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const webinar = await request.server.prisma.webinar.findUnique({
    where: { id },
    include: {
      host: {
        select: { id: true, fullName: true, profilePhotoUrl: true, designation: true },
      },
    },
  });
  if (!webinar) return fail(reply, 404, 'Webinar not found');

  return ok(reply, {
    id: webinar.id,
    title: webinar.title,
    description: webinar.description,
    scheduledAt: webinar.scheduledAt,
    durationMinutes: webinar.durationMinutes,
    status: webinar.status,
    streamUrl: webinar.meetingUrl ?? null,
    recordingUrl: webinar.recordingUrl ?? null,
    host: webinar.host ?? null,
  });
}

export async function getWebinarTokenHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id: webinarId } = request.params as { id: string };

  const webinar = await request.server.prisma.webinar.findUnique({
    where: { id: webinarId },
    select: { id: true, title: true, meetingUrl: true, status: true },
  });
  if (!webinar) return fail(reply, 404, 'Webinar not found');

  // Ensure member is registered (upsert so joining auto-registers)
  await request.server.prisma.webinarRegistration.upsert({
    where: { memberId_webinarId: { memberId: request.memberId, webinarId } },
    create: { memberId: request.memberId, webinarId, attended: true, joinTime: new Date() },
    update: { attended: true, joinTime: new Date() },
  });

  return ok(reply, {
    token: webinar.meetingUrl ?? '',
    channel: webinarId,
  });
}

// ─── Notifications ────────────────────────────────────────────────────────────

export async function getUserNotificationsHandler(request: FastifyRequest, reply: FastifyReply) {
  const { page = 1, limit = 50, unread } = request.query as {
    page?: number;
    limit?: number;
    unread?: string;
  };

  const where: Record<string, unknown> = { memberId: request.memberId };
  if (unread === 'true') where.readAt = null;

  const [recipients, total] = await Promise.all([
    request.server.prisma.appNotificationRecipient.findMany({
      where: where as any,
      orderBy: { notification: { createdAt: 'desc' } },
      take: Number(limit),
      skip: (Number(page) - 1) * Number(limit),
      include: {
        notification: {
          select: { title: true, message: true, type: true, createdAt: true },
        },
      },
    }),
    request.server.prisma.appNotificationRecipient.count({ where: where as any }),
  ]);

  const data = recipients.map((r) => ({
    id: r.id,
    title: r.notification.title,
    body: r.notification.message,
    type: r.notification.type,
    data: null as null,
    isRead: r.readAt !== null,
    createdAt: r.notification.createdAt,
  }));

  return ok(reply, data, { total, page: Number(page), limit: Number(limit) });
}

export async function markNotificationReadHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };

  const recipient = await request.server.prisma.appNotificationRecipient.findFirst({
    where: { id, memberId: request.memberId },
  });
  if (!recipient) return fail(reply, 404, 'Notification not found');

  const updated = await request.server.prisma.appNotificationRecipient.update({
    where: { id },
    data: { readAt: new Date() },
    include: { notification: { select: { title: true, message: true, type: true, createdAt: true } } },
  });

  return ok(reply, {
    id: updated.id,
    title: updated.notification.title,
    body: updated.notification.message,
    type: updated.notification.type,
    isRead: true,
    createdAt: updated.notification.createdAt,
  });
}

export async function markAllNotificationsReadHandler(request: FastifyRequest, reply: FastifyReply) {
  const result = await request.server.prisma.appNotificationRecipient.updateMany({
    where: { memberId: request.memberId, readAt: null },
    data: { readAt: new Date() },
  });

  return ok(reply, { updated: result.count });
}

// ─── Messages ────────────────────────────────────────────────────────────────

export async function getUserMessagesHandler(request: FastifyRequest, reply: FastifyReply) {
  const { page = 1, limit = 20, unread } = request.query as {
    page?: number; limit?: number; unread?: boolean;
  };
  const skip = (Number(page) - 1) * Number(limit);
  const where = {
    memberId: request.memberId,
    ...(unread ? { isRead: false } : {}),
  };

  const [messages, total] = await Promise.all([
    request.server.prisma.directMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: Number(limit),
    }),
    request.server.prisma.directMessage.count({ where }),
  ]);

  // Batch-resolve admin senders to avoid N+1
  const adminIds = [...new Set(
    messages.filter(m => m.senderType === 'admin').map(m => m.senderId)
  )];
  const admins = adminIds.length > 0
    ? await request.server.prisma.admin.findMany({
        where: { id: { in: adminIds } },
        select: { id: true, fullName: true, profilePhotoUrl: true },
      })
    : [];
  const adminMap = Object.fromEntries(admins.map(a => [a.id, a]));

  const data = messages.map(m => {
    const sender = m.senderType === 'admin' ? adminMap[m.senderId] : null;
    return {
      id:              m.id,
      subject:         m.subject,
      body:            m.body,
      senderName:      sender?.fullName ?? 'TBT Team',
      senderAvatarUrl: sender?.profilePhotoUrl ?? null,
      isRead:          m.isRead,
      createdAt:       m.createdAt,
    };
  });

  return ok(reply, data, { total, page: Number(page), limit: Number(limit) });
}

export async function markMessageReadHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  await request.server.prisma.directMessage.updateMany({
    where: { id, memberId: request.memberId },
    data:  { isRead: true, readAt: new Date() },
  });
  return ok(reply, { id, isRead: true });
}

export async function markAllMessagesReadHandler(request: FastifyRequest, reply: FastifyReply) {
  const result = await request.server.prisma.directMessage.updateMany({
    where: { memberId: request.memberId, isRead: false },
    data:  { isRead: true, readAt: new Date() },
  });
  return ok(reply, { updated: result.count });
}

// ─── Home ─────────────────────────────────────────────────────────────────────

export async function getHomeHeroHandler(request: FastifyRequest, reply: FastifyReply) {
  const [slides, siteConfig] = await Promise.all([
    request.server.prisma.heroSlide.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    }),
    request.server.prisma.siteConfig.findFirst({
      select: { heroAutoPlayIntervalMs: true },
    }),
  ]);

  return ok(reply, {
    slides: slides.map((s) => ({
      id: s.id,
      order: s.order,
      title: s.title,
      description: s.description ?? null,
      bgVideoUrl: s.bgVideoUrl ?? null,
      bgImageUrl: s.bgImageUrl ?? null,
      bgMuteDefault: s.bgMuteDefault,
      ctaLabel: s.ctaLabel,
      ctaUrl: s.ctaUrl,
      ctaType: s.ctaType,
      badgeText: s.badgeText ?? null,
      isActive: s.isActive,
    })),
    autoPlayIntervalMs: siteConfig?.heroAutoPlayIntervalMs ?? 5000,
  });
}

export async function getHomeSectionsHandler(request: FastifyRequest, reply: FastifyReply) {
  const { memberTier } = request.query as { memberTier?: string };
  const tierNum = parseInt(memberTier || '1', 10);

  const sections = await request.server.prisma.contentSection.findMany({
    where: { isVisible: true },
    orderBy: { order: 'asc' },
    include: {
      items: {
        where: { isVisible: true },
        orderBy: { order: 'asc' },
        include: {
          course: {
            select: {
              id: true,
              slug: true,
              _count: { select: { courseEpisodes: { where: { isVisible: true } } } },
              courseEpisodes: {
                where: { isVisible: true },
                orderBy: { order: 'asc' },
                take: 20,
                select: {
                  id: true,
                  order: true,
                  title: true,
                  thumbnailUrl: true,
                  durationSeconds: true,
                },
              },
            },
          },
          workshop: {
            select: {
              id: true,
              slug: true,
              challenges: {
                orderBy: { order: 'asc' },
                select: {
                  episodes: {
                    orderBy: { order: 'asc' },
                    take: 20,
                    select: {
                      id: true,
                      order: true,
                      title: true,
                      durationSeconds: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  return ok(reply, {
    sections: sections.map((s) => ({
      id: s.id,
      title: s.title,
      slug: s.slug,
      order: s.order,
      isVisible: s.isVisible,
      requiredTier: s.requiredTier,
      isLocked: tierNum < s.requiredTier,
      lockLabel: tierNum < s.requiredTier ? (s.lockBadgeText ?? null) : null,
      items: s.items.map((item) => {
        const workshopEpisodes = (item.workshop?.challenges ?? []).flatMap(
          (ch: any) => ch.episodes ?? []
        );
        const resolvedPlayUrl = item.workshop
          ? `/workshop/${item.workshop.slug}`
          : item.course
            ? `/learning/${item.course.id}`
            : (item.playUrl ?? null);

        return {
          id: item.id,
          title: item.title,
          thumbnailUrl: item.thumbnailUrl ?? null,
          requiredTier: item.requiredTier,
          isLocked: tierNum < item.requiredTier,
          lockBadgeText: tierNum < item.requiredTier ? (item.lockBadgeText ?? null) : null,
          contentType: item.contentType,
          categoryTag: item.categoryTag ?? null,
          playUrl: resolvedPlayUrl,
          courseId: item.courseId ?? null,
          workshopId: item.workshopId ?? null,
          episodeCount: workshopEpisodes.length > 0
            ? workshopEpisodes.length
            : (item.course?._count?.courseEpisodes ?? null),
          episodes: workshopEpisodes.length > 0
            ? workshopEpisodes.map((ep: any) => ({
                id: ep.id,
                order: ep.order,
                title: ep.title,
                thumbnailUrl: null,
                durationSeconds: ep.durationSeconds ?? null,
              }))
            : (item.course?.courseEpisodes ?? []).map((ep) => ({
                id: ep.id,
                order: ep.order,
                title: ep.title,
                thumbnailUrl: ep.thumbnailUrl ?? null,
                durationSeconds: ep.durationSeconds,
              })),
        };
      }),
    })),
  });
}

// ─── Workshops (user-facing) ──────────────────────────────────────────────────

export async function listWorkshopsHandler(request: FastifyRequest, reply: FastifyReply) {
  const [workshops, enrollments] = await Promise.all([
    request.server.prisma.workshop.findMany({
      where: { isActive: true },
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        thumbnailUrl: true,
        deliveryMode: true,
        requiredTier: true,
        _count: { select: { challenges: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    request.server.prisma.workshopEnrollment.findMany({
      where: { memberId: request.memberId },
      select: { workshopId: true, status: true },
    }),
  ]);

  const enrollmentMap = new Map(enrollments.map((e) => [e.workshopId, e.status]));

  const data = workshops.map((w) => {
    const enrollStatus = enrollmentMap.get(w.id) ?? null;
    return {
      id: w.id,
      title: w.title,
      slug: w.slug,
      description: w.description ?? null,
      thumbnailUrl: w.thumbnailUrl ?? null,
      deliveryMode: w.deliveryMode,
      deliveryModeLabel:
        w.deliveryMode === 'online' ? 'Online'
        : w.deliveryMode === 'offline' ? 'In-Person'
        : 'Hybrid',
      requiredTier: w.requiredTier,
      challengeCount: w._count.challenges,
      enrollmentStatus: enrollStatus,
      enrolledBadge: enrollStatus === 'active' ? { label: 'Enrolled', color: '#22c55e' } : null,
      completedBadgeIconType: enrollStatus === 'completed' ? 'checkmark' : null,
    };
  });

  return ok(reply, data);
}

export async function getMyWorkshopsHandler(request: FastifyRequest, reply: FastifyReply) {
  const enrollments = await request.server.prisma.workshopEnrollment.findMany({
    where: { memberId: request.memberId },
    include: {
      workshop: {
        select: {
          id: true,
          title: true,
          slug: true,
          thumbnailUrl: true,
          deliveryMode: true,
          isActive: true,
        },
      },
    },
    orderBy: { enrolledAt: 'desc' },
  });

  const active = enrollments.filter((e) => e.status === 'active');
  const completed = enrollments.filter((e) => e.status === 'completed');

  const mapItem = (e: (typeof enrollments)[0]) => ({
    id: e.workshop.id,
    title: e.workshop.title,
    thumbnailUrl: e.workshop.thumbnailUrl ?? null,
    slug: e.workshop.slug,
    enrollmentStatus: e.status,
    enrolledBadge: e.status === 'active' ? { label: 'Enrolled', color: '#22c55e' } : null,
    completedBadgeIconType: e.status === 'completed' ? 'checkmark' : null,
    deliveryMode: e.workshop.deliveryMode,
    deliveryModeLabel:
      e.workshop.deliveryMode === 'online'
        ? 'Online'
        : e.workshop.deliveryMode === 'offline'
          ? 'In-Person'
          : 'Hybrid',
  });

  return ok(reply, {
    sections: [
      ...(active.length > 0
        ? [{ id: 'active', label: 'Workshops', items: active.map(mapItem) }]
        : []),
      ...(completed.length > 0
        ? [{ id: 'completed', label: 'Completed Workshops', items: completed.map(mapItem) }]
        : []),
    ],
  });
}

export async function getWorkshopDetailHandler(request: FastifyRequest, reply: FastifyReply) {
  const { slug } = request.params as { slug: string };

  const workshop = await request.server.prisma.workshop.findFirst({
    where: { slug },
    include: {
      enrollments: {
        where: { memberId: request.memberId },
        select: { status: true },
      },
      challenges: {
        select: { id: true, episodes: { select: { id: true } } },
        orderBy: { order: 'asc' },
      },
      liveCalls: {
        where: { scheduledAt: { gt: new Date() } },
        orderBy: { scheduledAt: 'asc' },
        take: 1,
        select: { id: true, scheduledAt: true },
      },
    },
  });

  if (!workshop) return fail(reply, 404, 'Workshop not found');

  const enrollment = (workshop as any).enrollments?.[0];
  const allEpisodes = (workshop as any).challenges?.flatMap((c: any) => c.episodes ?? []) ?? [];

  const progress = await request.server.prisma.memberEpisodeProgress.findMany({
    where: { memberId: request.memberId, episodeId: { in: allEpisodes.map((e: any) => e.id) } },
    select: { episodeId: true, isCompleted: true },
  });

  const completedCount = progress.filter((p) => p.isCompleted).length;
  const totalCount = allEpisodes.length;

  // Determine what the main area should show by default
  const hasUpcomingCall = ((workshop as any).liveCalls ?? []).length > 0;
  const defaultMainAreaType = hasUpcomingCall ? 'countdown' : null;

  return ok(reply, {
    id: workshop.id,
    title: workshop.title,
    backLabel: workshop.backLabel,
    backUrl: workshop.backUrl,
    sidebar: {
      tabs: [
        { id: 'challenges', label: workshop.tabChallengesLabel, order: 1 },
        { id: 'qa', label: workshop.tabQaLabel, order: 2 },
        { id: 'assignment', label: workshop.tabAssignmentLabel, order: 3 },
      ],
    },
    learningProgress: {
      label: workshop.progressWidgetLabel,
      percentage: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0,
      completedCount,
      totalCount,
      milestoneCount: workshop.progressMilestoneCount,
    },
    workshopFlowLabel: workshop.workshopFlowLabel,
    defaultMainAreaType,
    enrollmentStatus: enrollment?.status ?? null,
  });
}

export async function getWorkshopFlowHandler(request: FastifyRequest, reply: FastifyReply) {
  const { slug } = request.params as { slug: string };

  const workshop = await request.server.prisma.workshop.findFirst({
    where: { slug },
    include: {
      flowItems: {
        orderBy: { order: 'asc' },
        include: {
          challenge: {
            include: {
              episodes: {
                orderBy: { order: 'asc' },
                include: {
                  progress: {
                    where: { memberId: request.memberId },
                    select: { isCompleted: true },
                  },
                },
              },
            },
          },
          liveCall: true,
        },
      },
    },
  });

  if (!workshop) return fail(reply, 404, 'Workshop not found');

  const flowItems = await Promise.all(
    (workshop as any).flowItems.map(async (item: any) => {
      if (item.type === 'challenge' && item.challenge) {
        const ch = item.challenge;
        const totalEps = ch.episodes.length;
        const completedEps = ch.episodes.filter((e: any) => e.progress?.[0]?.isCompleted).length;

        return {
          id: item.id,
          order: item.order,
          type: item.type,
          challengeNumber: ch.challengeNumber ?? null,
          numberLabel: ch.numberLabel ?? `Challenge ${String(ch.challengeNumber ?? '').padStart(2, '0')}:`,
          numberColor: ch.numberColor ?? '#00c4cc',
          title: ch.title,
          description: ch.description ?? null,
          progressPercent: totalEps > 0 ? Math.round((completedEps / totalEps) * 100) : 0,
          isExpanded: false,
          episodes: ch.episodes.map((ep: any) => ({
            id: ep.id,
            order: ep.order,
            title: ep.title,
            type: ep.type,
            typeLabel: ep.typeLabel,
            durationSeconds: ep.durationSeconds ?? null,
            durationLabel: ep.durationLabel ?? null,
            isCompleted: ep.progress?.[0]?.isCompleted ?? false,
            isLocked: false,
            lockIconType: ep.lockIconType,
            completedIconType: ep.completedIconType,
          })),
        };
      }

      if ((item.type === 'live_call' || item.type === 'custom') && item.liveCall) {
        const lc = item.liveCall;
        const now = new Date();
        const scheduledAt = new Date(lc.scheduledAt);
        const status = scheduledAt < now ? 'past' : 'upcoming';

        return {
          id: item.id,
          order: item.order,
          type: 'live_call',
          label: lc.label,
          labelColor: lc.labelColor,
          title: lc.title,
          scheduledAt: lc.scheduledAt,
          status,
          recordingAvailable: status === 'past' && !!lc.recordingUrl,
          recordingLabel: lc.recordingUrl ? (lc.recordingLabel ?? 'Missed it? View the recording.') : null,
          prerequisiteNote: lc.prerequisiteNote ?? null,
          liveUrl: status === 'upcoming' ? (lc.liveUrl ?? null) : null,
          liveUrlUnlocksMinutesBefore: lc.liveUrlUnlocksMinutesBefore ?? 30,
          facilitatorName: lc.facilitatorName ?? null,
          facilitatorTitle: lc.facilitatorTitle ?? null,
          facilitatorDescription: lc.facilitatorDescription ?? null,
          countdownConfig:
            status === 'upcoming'
              ? {
                  stayTunedMessage: lc.stayTunedMessage,
                  stayTunedColor: lc.stayTunedColor,
                }
              : null,
          isCompleted: status === 'past',
        };
      }

      return {
        id: item.id,
        order: item.order,
        type: item.type,
        label: item.label ?? null,
        description: item.description ?? null,
        isCompleted: item.isCompleted,
        isExpanded: false,
      };
    })
  );

  return ok(reply, { flowItems });
}

export async function getWorkshopQaHandler(request: FastifyRequest, reply: FastifyReply) {
  const { slug } = request.params as { slug: string };
  const { page = 1, limit = 20 } = request.query as { page?: number; limit?: number };

  const workshop = await request.server.prisma.workshop.findFirst({
    where: { slug },
    select: { id: true },
  });
  if (!workshop) return fail(reply, 404, 'Workshop not found');

  const [posts, total] = await Promise.all([
    request.server.prisma.qAPost.findMany({
      where: { workshopId: workshop.id },
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
      skip: (Number(page) - 1) * Number(limit),
      include: {
        member: { select: { firstName: true, lastName: true, profilePhotoUrl: true } },
        replies: {
          include: {
            member: { select: { firstName: true, lastName: true, profilePhotoUrl: true } },
            admin: { select: { fullName: true, profilePhotoUrl: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    }),
    request.server.prisma.qAPost.count({ where: { workshopId: workshop.id } }),
  ]);

  const timeAgo = (d: Date) => {
    const diff = Date.now() - d.getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 24) return `${h || 1}h`;
    const days = Math.floor(h / 24);
    return `${days}d`;
  };

  return ok(reply, {
    heading: 'Do you have any questions?',
    promptText: 'Got something on your mind? Post your question and let\'s explore it together!',
    inputPlaceholder: 'Type your Question here...',
    submitLabel: 'Ask Now',
    communityHeading: 'Others Asked questions',
    communityHeadingHighlight: 'questions',
    posts: posts.map((p) => ({
      id: p.id,
      author: {
        name: [p.member.firstName, p.member.lastName].filter(Boolean).join(' '),
        avatarUrl: p.member.profilePhotoUrl ?? null,
      },
      timeAgo: timeAgo(p.createdAt),
      questionText: p.questionText,
      replyLabel: 'Reply',
      replies: p.replies.map((r) => ({
        id: r.id,
        author: r.admin
          ? { name: r.admin.fullName, avatarUrl: r.admin.profilePhotoUrl ?? null }
          : {
              name: [r.member?.firstName, r.member?.lastName].filter(Boolean).join(' '),
              avatarUrl: r.member?.profilePhotoUrl ?? null,
            },
        timeAgo: timeAgo(r.createdAt),
        replyText: r.replyText,
      })),
    })),
    pagination: { total, page: Number(page), limit: Number(limit) },
  });
}

export async function postWorkshopQaHandler(request: FastifyRequest, reply: FastifyReply) {
  const { slug } = request.params as { slug: string };
  const { questionText } = request.body as { questionText: string };

  if (!questionText?.trim()) return fail(reply, 400, 'Question text is required');

  const workshop = await request.server.prisma.workshop.findFirst({
    where: { slug },
    select: { id: true },
  });
  if (!workshop) return fail(reply, 404, 'Workshop not found');

  const post = await request.server.prisma.qAPost.create({
    data: { workshopId: workshop.id, memberId: request.memberId, questionText: questionText.trim() },
    select: { id: true, questionText: true, createdAt: true, member: { select: { firstName: true, lastName: true } } },
  });

  const memberName = [post.member.firstName, post.member.lastName].filter(Boolean).join(' ');
  request.server.io.to(`workshop:${slug}`).emit('qa:new_question', {
    id: post.id,
    questionText: post.questionText,
    memberName,
    createdAt: post.createdAt,
    replies: [],
  });

  return reply.status(201).send({ success: true, data: post, error: null });
}

export async function postQaReplyHandler(request: FastifyRequest, reply: FastifyReply) {
  const { postId } = request.params as { postId: string };
  const { replyText } = request.body as { replyText: string };

  if (!replyText?.trim()) return fail(reply, 400, 'Reply text is required');

  const post = await request.server.prisma.qAPost.findUnique({
    where: { id: postId },
    select: { id: true, workshop: { select: { slug: true } } },
  });
  if (!post) return fail(reply, 404, 'Post not found');

  const r = await request.server.prisma.qAReply.create({
    data: { postId, memberId: request.memberId, replyText: replyText.trim() },
    select: { id: true, replyText: true, createdAt: true },
  });

  request.server.io.to(`workshop:${post.workshop.slug}`).emit('qa:new_reply', {
    postId,
    reply: {
      id: r.id,
      replyText: r.replyText,
      createdAt: r.createdAt,
    },
  });

  return reply.status(201).send({ success: true, data: r, error: null });
}

export async function getWorkshopAssignmentsHandler(request: FastifyRequest, reply: FastifyReply) {
  const { slug } = request.params as { slug: string };

  const [workshop, uiStrings] = await Promise.all([
    request.server.prisma.workshop.findFirst({
      where: { slug },
      include: {
        challenges: {
          orderBy: { order: 'asc' },
          include: {
            assignments: {
              orderBy: { order: 'asc' },
              include: {
                submissions: {
                  where: { memberId: request.memberId },
                  select: {
                    id: true,
                    answerText: true,
                    submittedAt: true,
                    completedIconType: true,
                    yourAnswerLabel: true,
                    backLabel: true,
                  },
                },
              },
            },
          } as any,
        },
      },
    }),
    request.server.prisma.uiStrings.findFirst(),
  ]);

  if (!workshop) return fail(reply, 404, 'Workshop not found');

  const ctaLabel = uiStrings?.assignmentCtaLabel ?? 'Answer';
  const submitLabel = uiStrings?.assignmentSubmitLabel ?? 'Submit';
  const cancelLabel = uiStrings?.assignmentCancelLabel ?? 'Cancel';

  return ok(reply, {
    groups: (workshop as any).challenges.map((ch: any) => ({
      challengeLabel: ch.numberLabel?.replace(':', '') ?? `Challenge ${String(ch.challengeNumber ?? '').padStart(2, '0')}`,
      challengeTitle: ch.title,
      assignments: ch.assignments.map((a: any) => {
        const sub = a.submissions?.[0] ?? null;
        return {
          id: a.id,
          title: a.title,
          typeLabel: a.typeLabel,
          iconType: a.iconType,
          ctaLabel,
          submitLabel,
          cancelLabel,
          submission: sub
            ? {
                isSubmitted: true,
                submittedAt: sub.submittedAt,
                answerText: sub.answerText,
                completedIcon: sub.completedIconType,
                yourAnswerLabel: sub.yourAnswerLabel,
                backLabel: sub.backLabel,
              }
            : { isSubmitted: false },
        };
      }),
    })),
  });
}

export async function submitAssignmentHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id: assignmentId } = request.params as { id: string };
  const { answerText } = request.body as { answerText: string };

  if (!answerText?.trim()) return fail(reply, 400, 'Answer text is required');

  const assignment = await request.server.prisma.assignment.findUnique({
    where: { id: assignmentId },
  });
  if (!assignment) return fail(reply, 404, 'Assignment not found');

  const submission = await request.server.prisma.assignmentSubmission.upsert({
    where: { assignmentId_memberId: { assignmentId, memberId: request.memberId } },
    create: { assignmentId, memberId: request.memberId, answerText: answerText.trim() },
    update: { answerText: answerText.trim(), submittedAt: new Date() },
    select: { id: true, answerText: true, submittedAt: true },
  });

  return ok(reply, submission);
}

// ─── Episodes ─────────────────────────────────────────────────────────────────

export async function getEpisodePlaybackHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };

  const [episode, uiStrings] = await Promise.all([
    request.server.prisma.workshopEpisode.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        videoUrl: true,
        durationSeconds: true,
        progress: {
          where: { memberId: request.memberId },
          select: { lastWatchedSecs: true, isCompleted: true },
        },
      },
    }),
    request.server.prisma.uiStrings.findFirst(),
  ]);

  if (!episode) return fail(reply, 404, 'Episode not found');

  const prog = (episode as any).progress?.[0];

  return ok(reply, {
    id: episode.id,
    title: episode.title,
    description: episode.description ?? null,
    videoUrl: episode.videoUrl ?? null,
    videoType: 'iframe',
    durationSeconds: episode.durationSeconds ?? null,
    resumeAtSeconds: prog?.lastWatchedSecs ?? 0,
    qualityOptions: ['auto'],
    defaultQuality: 'auto',
    speedOptions: ['0.5x', '0.75x', '1x', '1.25x', '1.5x', '2x'],
    defaultSpeed: '1x',
    playerLabels: {
      completeLabel: uiStrings?.episodeCompleteLabel ?? 'Mark Complete',
      backLabel: uiStrings?.watchBackLabel ?? 'Back',
      autoLabel: uiStrings?.playerAutoLabel ?? 'Auto',
      fullscreenLabel: 'Fullscreen',
    },
  });
}

export async function postEpisodeProgressHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id: episodeId } = request.params as { id: string };
  const { watchedSeconds, isCompleted } = request.body as {
    watchedSeconds?: number;
    isCompleted?: boolean;
  };

  await request.server.prisma.memberEpisodeProgress.upsert({
    where: { memberId_episodeId: { memberId: request.memberId, episodeId } },
    create: {
      memberId: request.memberId,
      episodeId,
      lastWatchedSecs: watchedSeconds ?? 0,
      isCompleted: isCompleted ?? false,
    },
    update: {
      lastWatchedSecs: watchedSeconds ?? 0,
      isCompleted: isCompleted ?? false,
    },
  });

  return ok(reply, { updated: true });
}

// ─── Products & Resources ─────────────────────────────────────────────────────

export async function getUserProductsHandler(request: FastifyRequest, reply: FastifyReply) {
  const [pageConfig, products] = await Promise.all([
    request.server.prisma.productsPageConfig.findFirst(),
    request.server.prisma.product.findMany({
      where: { isVisible: true },
      orderBy: { order: 'asc' },
      include: { ctas: { orderBy: { order: 'asc' } } },
    }),
  ]);

  return ok(reply, {
    pageTitle: pageConfig?.pageTitle ?? 'Products',
    pageBg: pageConfig?.pageBg ?? '',
    products: products.map((p) => ({
      id: p.id,
      order: p.order,
      title: p.title,
      description: p.description ?? null,
      thumbnailUrl: p.thumbnailUrl ?? null,
      isVisible: p.isVisible,
      ctas: p.ctas.map((c) => ({
        label: c.label,
        url: c.url,
        type: c.type,
        openInNewTab: c.openInNewTab,
      })),
    })),
  });
}

export async function getUserResourcesHandler(request: FastifyRequest, reply: FastifyReply) {
  const { search, view = 'list', page = 1, limit = 20 } = request.query as {
    search?: string;
    view?: string;
    page?: number;
    limit?: number;
  };

  const [pageConfig, resources, total] = await Promise.all([
    request.server.prisma.resourcesPageConfig.findFirst(),
    request.server.prisma.appResource.findMany({
      where: {
        isVisible: true,
        ...(search?.trim()
          ? { title: { contains: search.trim(), mode: 'insensitive' } }
          : {}),
      },
      orderBy: { order: 'asc' },
      take: Number(limit),
      skip: (Number(page) - 1) * Number(limit),
    }),
    request.server.prisma.appResource.count({
      where: {
        isVisible: true,
        ...(search?.trim()
          ? { title: { contains: search.trim(), mode: 'insensitive' } }
          : {}),
      },
    }),
  ]);

  return ok(reply, {
    pageTitle: pageConfig?.pageTitle ?? 'Resources',
    searchPlaceholder: pageConfig?.searchPlaceholder ?? 'Search resources...',
    totalCount: total,
    totalLabel: 'resources',
    viewOptions: ['list', 'grid'],
    resources: resources.map((r) => ({
      id: r.id,
      title: r.title,
      author: r.author ?? null,
      date: r.date ? r.date.toISOString().split('T')[0] : null,
      fileUrl: r.fileUrl,
      previewUrl: r.previewUrl ?? null,
      fileType: r.fileType,
      fileTypeIconUrl: r.fileTypeIconUrl ?? null,
      fileCount: r.fileCount,
      order: r.order,
      isVisible: r.isVisible,
      hoverActions: [
        { type: 'preview', iconType: 'eye', label: r.previewLabel },
        { type: 'download', iconType: 'download', label: r.downloadLabel },
      ],
    })),
    pagination: { total, page: Number(page), limit: Number(limit) },
  });
}

// ─── Conversations (live chat) ────────────────────────────────────────────────

export async function startConversationHandler(request: FastifyRequest, reply: FastifyReply) {
  const { subject, body } = request.body as { subject: string; body: string };
  const memberId = request.memberId!;

  const conversation = await request.server.prisma.$transaction(async (tx) => {
    const convo = await tx.conversation.create({
      data: { memberId, subject, adminUnreadCount: 1, lastMessageAt: new Date() },
    });
    await tx.directMessage.create({
      data: { conversationId: convo.id, memberId, senderId: memberId, senderType: 'member', body },
    });
    return convo;
  });

  const member = await request.server.prisma.member.findUnique({
    where: { id: memberId },
    select: { firstName: true, lastName: true },
  });
  const memberName = `${member?.firstName ?? ''} ${member?.lastName ?? ''}`.trim() || 'A member';

  request.server.io.to('admin').emit('chat:conversation_new', {
    conversationId: conversation.id,
    memberName,
    subject,
  });

  return reply.status(201).send({ success: true, data: { id: conversation.id }, error: null });
}

export async function listMemberConversationsHandler(request: FastifyRequest, reply: FastifyReply) {
  const memberId = request.memberId!;

  const conversations = await request.server.prisma.conversation.findMany({
    where: { memberId },
    orderBy: { lastMessageAt: 'desc' },
    include: {
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { body: true, senderType: true, createdAt: true },
      },
    },
  });

  return ok(reply, conversations.map((c) => ({
    id:                c.id,
    subject:           c.subject,
    status:            c.status,
    memberUnreadCount: c.memberUnreadCount,
    lastMessageAt:     c.lastMessageAt,
    lastMessage:       c.messages[0] ?? null,
  })));
}

export async function getMemberConversationMessagesHandler(request: FastifyRequest, reply: FastifyReply) {
  const memberId = request.memberId!;
  const { id } = request.params as { id: string };

  const convo = await request.server.prisma.conversation.findFirst({ where: { id, memberId } });
  if (!convo) return fail(reply, 404, 'Conversation not found');

  await request.server.prisma.conversation.update({ where: { id }, data: { memberUnreadCount: 0 } });

  const messages = await request.server.prisma.directMessage.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: 'asc' },
  });

  const adminIds = [...new Set(messages.filter((m) => m.senderType === 'admin').map((m) => m.senderId))];
  const [admins, memberProfile] = await Promise.all([
    adminIds.length > 0
      ? request.server.prisma.admin.findMany({
          where: { id: { in: adminIds } },
          select: { id: true, fullName: true, profilePhotoUrl: true },
        })
      : Promise.resolve([]),
    request.server.prisma.member.findUnique({
      where: { id: memberId },
      select: { firstName: true, lastName: true, profilePhotoUrl: true },
    }),
  ]);
  const adminMap = Object.fromEntries(admins.map((a) => [a.id, a]));
  const memberName = `${memberProfile?.firstName ?? ''} ${memberProfile?.lastName ?? ''}`.trim() || 'You';

  const data = messages.map((m) => {
    const admin = m.senderType === 'admin' ? adminMap[m.senderId] : null;
    return {
      id:              m.id,
      senderType:      m.senderType,
      senderId:        m.senderId,
      senderName:      m.senderType === 'member' ? memberName : (admin?.fullName ?? 'TBT Team'),
      senderAvatarUrl: m.senderType === 'member'
        ? (memberProfile?.profilePhotoUrl ?? null)
        : (admin?.profilePhotoUrl ?? null),
      body:            m.body,
      createdAt:       m.createdAt,
    };
  });

  return ok(reply, data, { conversationId: id, status: convo.status, subject: convo.subject });
}

export async function sendMemberChatMessageHandler(request: FastifyRequest, reply: FastifyReply) {
  const memberId = request.memberId!;
  const { id } = request.params as { id: string };
  const { body } = request.body as { body: string };

  const convo = await request.server.prisma.conversation.findFirst({
    where: { id, memberId, status: 'open' },
  });
  if (!convo) return fail(reply, 404, 'Conversation not found or closed');

  const message = await request.server.prisma.$transaction(async (tx) => {
    const msg = await tx.directMessage.create({
      data: { conversationId: id, memberId, senderId: memberId, senderType: 'member', body },
    });
    await tx.conversation.update({
      where: { id },
      data: { lastMessageAt: new Date(), adminUnreadCount: { increment: 1 } },
    });
    return msg;
  });

  request.server.io.to(`conversation:${id}`).emit('chat:message', {
    conversationId: id,
    message: {
      id:         message.id,
      senderId:   memberId,
      senderType: 'member',
      senderName: 'Member',
      body,
      createdAt:  message.createdAt,
    },
  });

  request.server.io.to('admin').emit('chat:unread_ping', { conversationId: id });

  return reply.status(201).send({ success: true, data: { id: message.id }, error: null });
}

// ─── Workshop Challenges ──────────────────────────────────────────────────────

export async function getWorkshopChallengesHandler(request: FastifyRequest, reply: FastifyReply) {
  const { slug } = request.params as { slug: string };

  const workshop = await request.server.prisma.workshop.findFirst({
    where: { slug },
    select: { id: true },
  });
  if (!workshop) return fail(reply, 404, 'Workshop not found');

  // Use flow item order so admin drag-and-drop reordering is respected,
  // and live calls are interleaved at the admin-configured position.
  const flowItems = await request.server.prisma.workshopFlowItem.findMany({
    where: { workshopId: workshop.id, type: { in: ['challenge_start', 'live_call'] } },
    orderBy: { order: 'asc' },
    include: {
      challenge: {
        include: {
          episodes: {
            orderBy: { order: 'asc' },
            include: {
              progress: { where: { memberId: request.memberId }, select: { isCompleted: true, lastWatchedSecs: true } },
            },
          },
          memberProgress: {
            where: { memberId: request.memberId },
            select: { status: true, completedAt: true, answersData: true },
          },
        },
      },
      liveCall: true,
    },
  });

  // Pre-compute statuses for challenge items only (live calls don't block progress)
  const challengeFlowItems = (flowItems as any[]).filter(fi => fi.type === 'challenge_start');
  const challengeStatuses: string[] = challengeFlowItems.map(fi => {
    const ch = fi.challenge;
    if (!ch) return 'not_started';
    if (!ch.type || ch.type === 'watch') {
      const total = ch.episodes.length;
      const done = ch.episodes.filter((e: any) => e.progress?.[0]?.isCompleted).length;
      if (total === 0) return 'not_started';
      if (done >= total) return 'completed';
      if (done > 0) return 'in_progress';
      return 'not_started';
    }
    return ch.memberProgress?.[0]?.status ?? 'not_started';
  });

  const now = new Date();
  let challengeIdx = 0;

  const result = (flowItems as any[]).map(fi => {
    if (fi.type === 'live_call') {
      const lc = fi.liveCall;
      if (!lc) return null;
      const scheduled = lc.scheduledAt ? new Date(lc.scheduledAt) : null;
      const isPast = scheduled ? scheduled < now : false;
      const unlockAt = scheduled && lc.liveUrlUnlocksMinutesBefore
        ? new Date(scheduled.getTime() - lc.liveUrlUnlocksMinutesBefore * 60 * 1000)
        : null;
      const isUnlocked = unlockAt ? now >= unlockAt : !!lc.liveUrl;
      return {
        id: fi.id,
        type: 'live_call',
        liveCallId: lc.id,
        label: lc.label ?? 'LIVE CALL:',
        labelColor: lc.labelColor ?? '#ff3d8b',
        title: lc.title,
        scheduledAt: lc.scheduledAt?.toISOString() ?? null,
        liveUrl: isUnlocked ? lc.liveUrl : null,
        liveUrlUnlocksMinutesBefore: lc.liveUrlUnlocksMinutesBefore ?? 30,
        facilitatorName: lc.facilitatorName ?? null,
        facilitatorTitle: lc.facilitatorTitle ?? null,
        stayTunedMessage: lc.stayTunedMessage ?? null,
        stayTunedColor: lc.stayTunedColor ?? '#2dd4bf',
        status: isPast ? 'past' : 'upcoming',
        isLocked: false,
        progressPercent: isPast ? 100 : 0,
        numberLabel: null,
        numberColor: null,
        description: null,
        quizData: null,
        episodes: [],
        submission: null,
      };
    }

    // challenge_start
    const ch = fi.challenge;
    if (!ch) return null;
    const idx = challengeIdx++;
    const allPrevCompleted = challengeStatuses.slice(0, idx).every(s => s === 'completed');
    const isLocked = idx > 0 && !allPrevCompleted;
    const rawStatus = challengeStatuses[idx];
    const status = isLocked ? 'locked' : rawStatus;
    const totalEps = ch.episodes.length;
    const doneEps = ch.episodes.filter((e: any) => e.progress?.[0]?.isCompleted).length;

    return {
      id: ch.id,
      order: ch.order,
      challengeNumber: ch.challengeNumber,
      numberLabel: ch.numberLabel,
      numberColor: ch.numberColor,
      title: ch.title,
      description: ch.description ?? null,
      type: ch.type ?? 'watch',
      quizData: ch.quizData ?? null,
      status,
      isLocked,
      progressPercent: (!ch.type || ch.type === 'watch')
        ? (totalEps > 0 ? Math.round((doneEps / totalEps) * 100) : 0)
        : rawStatus === 'completed' ? 100 : rawStatus === 'in_progress' ? 30 : 0,
      episodes: (!ch.type || ch.type === 'watch') ? ch.episodes.map((ep: any) => ({
        id: ep.id,
        order: ep.order,
        title: ep.title,
        description: ep.description ?? null,
        typeLabel: ep.typeLabel,
        videoUrl: ep.videoUrl ?? null,
        durationLabel: ep.durationLabel ?? null,
        durationSeconds: ep.durationSeconds ?? null,
        isCompleted: ep.progress?.[0]?.isCompleted ?? false,
        lastWatchedSecs: ep.progress?.[0]?.lastWatchedSecs ?? 0,
      })) : [],
      submission: ch.memberProgress?.[0] ?? null,
    };
  }).filter(Boolean);

  return ok(reply, { challenges: result });
}

export async function completeChallengeHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const { answersData } = (request.body as any) ?? {};

  const challenge = await request.server.prisma.challenge.findUnique({
    where: { id },
    select: { id: true, workshopId: true, order: true },
  });
  if (!challenge) return fail(reply, 404, 'Challenge not found');

  // Sequential lock check
  const prevChallenges = await request.server.prisma.challenge.findMany({
    where: { workshopId: challenge.workshopId, order: { lt: challenge.order } },
    select: { id: true, type: true, order: true },
    orderBy: { order: 'asc' },
  });

  for (const prev of prevChallenges) {
    if (!prev.type || prev.type === 'watch') {
      const epIds = await request.server.prisma.workshopEpisode.findMany({ where: { challengeId: prev.id }, select: { id: true } });
      const doneCount = await request.server.prisma.memberEpisodeProgress.count({ where: { memberId: request.memberId, episodeId: { in: epIds.map(e => e.id) }, isCompleted: true } });
      if (doneCount < epIds.length) return fail(reply, 403, 'Complete previous challenges first');
    } else {
      const prevProgress = await (request.server.prisma as any).memberChallengeProgress.findFirst({
        where: { memberId: request.memberId, challengeId: prev.id, status: 'completed' },
      });
      if (!prevProgress) return fail(reply, 403, 'Complete previous challenges first');
    }
  }

  const now = new Date();
  await (request.server.prisma as any).memberChallengeProgress.upsert({
    where: { memberId_challengeId: { memberId: request.memberId, challengeId: id } },
    create: { memberId: request.memberId, challengeId: id, status: 'completed', completedAt: now, answersData: answersData ?? null },
    update: { status: 'completed', completedAt: now, answersData: answersData ?? null },
  });

  return ok(reply, { status: 'completed', completedAt: now.toISOString() });
}

export async function completeWorkshopEpisodeHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };

  const episode = await request.server.prisma.workshopEpisode.findUnique({
    where: { id },
    select: { id: true, challengeId: true },
  });
  if (!episode) return fail(reply, 404, 'Episode not found');

  const now = new Date();
  await request.server.prisma.memberEpisodeProgress.upsert({
    where: { memberId_episodeId: { memberId: request.memberId, episodeId: id } },
    create: { memberId: request.memberId, episodeId: id, isCompleted: true, completedAt: now, lastWatchedSecs: 0 },
    update: { isCompleted: true, completedAt: now },
  });

  return ok(reply, { episodeId: id, isCompleted: true });
}
