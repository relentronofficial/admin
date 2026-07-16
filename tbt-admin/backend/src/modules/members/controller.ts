import type { FastifyReply, FastifyRequest } from 'fastify';
import bcrypt from 'bcrypt';
import { createMemberSchema, updateMemberSchema } from './schema.js';
import { invalidateCache } from '../../lib/cache.js';
import { createAdminNotification } from '../../lib/adminNotifications.js';

/**
 * Compose a Prisma `where` clause from the members-list query params.
 *
 * Shared by [listMembersHandler] and [exportMembersHandler] so the two
 * endpoints can never diverge on what "the current filter" means. Every
 * dimension is optional and combinable — the intent is a
 * multi-dimensional filter panel where users tick as many facets as
 * they need and the query narrows accordingly.
 *
 * All multi-value dimensions accept either a repeated query param
 * (`?batchId=a&batchId=b`) or a comma-separated string (`?batchId=a,b`).
 * Both are normalised via [toArray] so the caller doesn't have to
 * hand-parse them.
 */
function toArray(v: unknown): string[] {
  if (v == null || v === '') return [];
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  return String(v).split(',').map((s) => s.trim()).filter(Boolean);
}

function toBool(v: unknown): boolean | undefined {
  if (v === undefined || v === '' || v === null) return undefined;
  if (v === true || v === 'true' || v === '1') return true;
  if (v === false || v === 'false' || v === '0') return false;
  return undefined;
}

/**
 * Parse an ISO date string. Returns undefined on invalid input rather
 * than throwing — the caller wants "no filter" behaviour, not a 500.
 */
function toDate(v: unknown): Date | undefined {
  if (typeof v !== 'string' || !v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export function buildMembersWhereClause(query: any): any {
  const {
    search,
    status,           // single value (kept for backwards-compat with the tab bar)
    showArchived,
    batchId,          // multi
    membershipPlan,   // multi
    verificationStatus, // multi
    gender,           // multi
    state,            // multi
    businessStage,    // multi
    churnRisk,        // multi
    currentTier,      // multi (numeric)
    sector,           // multi
    industry,         // multi
    joinedFrom,       // ISO date
    joinedTo,         // ISO date
    hasMarketingTeam, // boolean
    hasVideoEditing,  // boolean
  } = query;

  const where: any = showArchived === 'true'
    ? { deletedAt: { not: null } }
    : { deletedAt: null };

  // Status tab (single-select at the top of the page) takes priority
  // over any multi-select status filter to keep the tab UX intuitive.
  if (status && showArchived !== 'true') where.status = status;

  // Text search across the identity fields most admins look for by.
  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { memberId: { contains: search, mode: 'insensitive' } },
      { businessName: { contains: search, mode: 'insensitive' } },
    ];
  }

  // Multi-select facets. Each dimension only narrows further — an empty
  // list means "any value" for that facet.
  const batchIds = toArray(batchId);
  if (batchIds.length) where.batchId = { in: batchIds };

  const plans = toArray(membershipPlan);
  if (plans.length) where.membershipPlan = { in: plans };

  const verifications = toArray(verificationStatus);
  if (verifications.length) where.verificationStatus = { in: verifications };

  const genders = toArray(gender);
  if (genders.length) where.gender = { in: genders };

  const states = toArray(state);
  if (states.length) where.state = { in: states };

  const businessStages = toArray(businessStage);
  if (businessStages.length) where.businessStage = { in: businessStages };

  const churnRisks = toArray(churnRisk);
  if (churnRisks.length) where.churnRisk = { in: churnRisks };

  const sectors = toArray(sector);
  if (sectors.length) where.sector = { in: sectors };

  const industries = toArray(industry);
  if (industries.length) where.industry = { in: industries };

  const tiers = toArray(currentTier)
    .map((t) => Number(t))
    .filter((n) => Number.isFinite(n));
  if (tiers.length) where.currentTier = { in: tiers };

  // Join date range. Prisma treats `gte`/`lte` independently so we can
  // set either bound alone.
  const fromDate = toDate(joinedFrom);
  const toDateVal = toDate(joinedTo);
  if (fromDate || toDateVal) {
    where.createdAt = {};
    if (fromDate) where.createdAt.gte = fromDate;
    if (toDateVal) where.createdAt.lte = toDateVal;
  }

  const marketingTeam = toBool(hasMarketingTeam);
  if (marketingTeam !== undefined) where.hasMarketingTeam = marketingTeam;

  const videoEditing = toBool(hasVideoEditing);
  if (videoEditing !== undefined) where.hasVideoEditing = videoEditing;

  return where;
}

export async function listMembersHandler(request: FastifyRequest, reply: FastifyReply) {
  const { page = 1, limit = 10 } = request.query as any;
  const skip = (page - 1) * limit;

  const where = buildMembersWhereClause(request.query);

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

/**
 * GET /api/members/export
 *
 * Streams a CSV of every member matching the same filter set the list
 * endpoint would return, unpaginated. Called by the Export button in
 * the admin panel with the current filter query params.
 */
export async function exportMembersHandler(request: FastifyRequest, reply: FastifyReply) {
  const where = buildMembersWhereClause(request.query);

  const members = await request.server.prisma.member.findMany({
    where: where as any,
    orderBy: { createdAt: 'desc' },
    include: {
      batch: { select: { name: true } },
      accountManager: { select: { fullName: true } },
    },
  }) as any[];

  // Header + rows. Escaping rules: wrap every cell in double-quotes,
  // double any embedded double-quotes. Comma / newline safe.
  const escape = (v: unknown): string => {
    if (v == null) return '';
    const s = String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  const header = [
    'Member ID', 'First Name', 'Last Name', 'Email', 'Phone', 'Status',
    'Membership Plan', 'Verification', 'Batch', 'Account Manager',
    'Business Name', 'City', 'State', 'Sector', 'Industry', 'Business Stage',
    'Churn Risk', 'Health Score', 'Current Tier', 'Total Points',
    'Joined', 'Last Active',
  ];
  const rows = members.map((m) => [
    m.memberId, m.firstName, m.lastName ?? '', m.email, m.phone, m.status,
    m.membershipPlan, m.verificationStatus,
    m.batch?.name ?? '',
    m.accountManager?.fullName ?? '',
    m.businessName ?? '', m.city ?? '', m.state ?? '',
    m.sector ?? '', m.industry ?? '', m.businessStage ?? '',
    m.churnRisk, m.healthScore, m.currentTier, m.totalPoints,
    m.createdAt?.toISOString?.() ?? '',
    m.lastActiveAt?.toISOString?.() ?? '',
  ]);

  const csv = [header, ...rows]
    .map((row) => row.map(escape).join(','))
    .join('\r\n');

  const filename = `members-${new Date().toISOString().slice(0, 10)}.csv`;
  reply
    .header('Content-Type', 'text/csv; charset=utf-8')
    .header('Content-Disposition', `attachment; filename="${filename}"`);
  return reply.send(csv);
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

    // Create Clerk user and hash password for user-web login if a password was provided
    let clerkId: string | undefined;
    let passwordHash: string | undefined;
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
        passwordHash = await bcrypt.hash(password, 12);
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
      ...(passwordHash && { passwordHash }),
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

    const joinedFullName = member.firstName + ' ' + (member.lastName ?? '');
    request.server.io.to('admin').emit('admin:member_joined', {
      memberId: member.id,
      fullName: joinedFullName,
      createdAt: member.createdAt,
    });
    void createAdminNotification(request.server.prisma, {
      title: 'New Member Added',
      body: `${joinedFullName} was added as a new member.`,
      type: 'member_joined',
      metadata: { memberId: member.id },
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
  if (!member || (member as any).deletedAt) return reply.status(404).send({ success: false, data: null, error: 'Member not found' });
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
      subscriptionEndsAt,
      ...restBody
    } = body as any;

    // Handle password update — sync to both Clerk and passwordHash (user-web login)
    let newPasswordHash: string | undefined;
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

      // Always sync to passwordHash so the user-web login works with the same password
      newPasswordHash = await bcrypt.hash(password, 12);
    }

    const data: any = {};

    if (newPasswordHash) data.passwordHash = newPasswordHash;

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

    let previousBatchProgressDays = 0;
    if (batchId !== undefined) {
      if (batchId && batchId.trim() !== '') {
        const prev = await request.server.prisma.member.findUnique({
          where: { id },
          select: { batchId: true },
        });
        if (prev?.batchId && prev.batchId !== batchId) {
          // Preserve old progress — do NOT delete; count detached days for the response
          previousBatchProgressDays = await request.server.prisma.memberDayProgress.count({
            where: { batchId: prev.batchId, memberId: id },
          });
        }
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

    // If a paid plan + end date are provided, deactivate old subscriptions and create a new one
    const effectivePlan = data.membershipPlan;
    if (subscriptionEndsAt && subscriptionEndsAt.trim() !== '' && effectivePlan && effectivePlan !== 'free') {
      await request.server.prisma.subscription.updateMany({
        where: { memberId: id, status: 'active' },
        data: { status: 'inactive' },
      });
      await request.server.prisma.subscription.create({
        data: {
          memberId: id,
          plan: effectivePlan as any,
          startsAt: new Date(),
          endsAt: new Date(subscriptionEndsAt),
          amount: 0,
          status: 'active',
        },
      });
    }

    return reply.send({ success: true, data: member, meta: { previousBatchProgressDays }, error: null });
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
  const member = await request.server.prisma.member.findUnique({
    where: { id },
    select: { id: true, deletedAt: true } as any,
  });
  if (!member || (member as any).deletedAt) {
    return reply.status(404).send({ success: false, data: null, error: 'Member not found' });
  }
  await request.server.prisma.member.update({
    where: { id },
    data: { deletedAt: new Date() } as any,
  });
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
  const [enrollments, courseEnrollments] = await Promise.all([
    req.server.prisma.workshopEnrollment.findMany({
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
    }),
    (req.server.prisma as any).courseEnrollment.findMany({
      where: { memberId: id },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            slug: true,
            courseEpisodes: {
              where: { isVisible: true },
              orderBy: { order: 'asc' },
              select: {
                id: true,
                title: true,
                durationSeconds: true,
                progress: { where: { memberId: id }, select: { completed: true, actualWatchedSecs: true, updatedAt: true } },
              },
            },
          },
        },
      },
      orderBy: { enrolledAt: 'desc' },
    }),
  ]);

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

  const courses = (courseEnrollments as any[]).map(e => {
    const episodes = (e.course.courseEpisodes as any[]) ?? [];
    const total = episodes.length;
    const completed = episodes.filter(ep => ep.progress[0]?.completed).length;
    const lastActivity = episodes
      .flatMap(ep => (ep.progress as any[]).map(p => p.updatedAt))
      .sort((a, b) => (b as any) - (a as any))[0] || null;
    return {
      courseId: e.courseId,
      courseTitle: e.course.title,
      status: e.completedAt ? 'completed' : 'active',
      overallPercent: total > 0 ? Math.round((completed / total) * 100) : (e.progressPercentage ?? 0),
      completedCount: completed,
      totalCount: total,
      episodes: episodes.map(ep => ({
        title: ep.title,
        isCompleted: !!ep.progress[0]?.completed,
        watchedSeconds: ep.progress[0]?.actualWatchedSecs ?? 0,
        durationSeconds: ep.durationSeconds ?? 0,
      })),
      lastActiveAt: lastActivity,
    };
  });

  return reply.send({ success: true, data: { workshops, courses }, error: null });
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

  const [workshopHistory, workshopHistoryTotal, workshopSummary, courseHistory, courseHistoryTotal, courseSummary, devices, securityEvents] = await Promise.all([
    // Paginated episode-level history (workshops)
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

    // Total count for pagination (workshops)
    req.server.prisma.memberEpisodeProgress.count({ where: { memberId: id } }),

    // Aggregate stats — workshops (all rows, minimal fields)
    req.server.prisma.memberEpisodeProgress.findMany({
      where: { memberId: id },
      select: { actualWatchedSecs: true, isCompleted: true },
    }),

    // Paginated episode-level history (courses)
    (req.server.prisma as any).courseEpisodeProgress.findMany({
      where: { memberId: id },
      orderBy: { updatedAt: 'desc' },
      take: Number(limit),
      skip: (Number(page) - 1) * Number(limit),
      select: {
        episodeId: true,
        lastWatchedSecs: true,
        actualWatchedSecs: true,
        completed: true,
        completedAt: true,
        updatedAt: true,
        episode: {
          select: {
            title: true,
            durationSeconds: true,
            course: { select: { id: true, title: true, slug: true } },
          },
        },
      },
    }),

    // Total count for pagination (courses)
    (req.server.prisma as any).courseEpisodeProgress.count({ where: { memberId: id } }),

    // Aggregate stats — courses
    (req.server.prisma as any).courseEpisodeProgress.findMany({
      where: { memberId: id },
      select: { actualWatchedSecs: true, completed: true },
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

  // Aggregate stats — union of workshop + course progress rows
  const allSummary = [
    ...workshopSummary.map((p: any) => ({ actualWatchedSecs: p.actualWatchedSecs, isCompleted: p.isCompleted })),
    ...(courseSummary as any[]).map((p: any) => ({ actualWatchedSecs: p.actualWatchedSecs, isCompleted: p.completed })),
  ];
  const totalWatchSeconds = allSummary.reduce((s, p) => s + (p.actualWatchedSecs ?? 0), 0);
  const completedCount    = allSummary.filter(p => p.isCompleted).length;
  const inProgressCount   = allSummary.filter(p => !p.isCompleted && (p.actualWatchedSecs ?? 0) > 0).length;
  const completionRate    = allSummary.length > 0 ? Math.round((completedCount / allSummary.length) * 100) : 0;
  const historyTotal      = workshopHistoryTotal + Number(courseHistoryTotal);

  // Merge workshop + course watch history, sort by updatedAt desc, cap at page size
  const workshopHistoryItems = workshopHistory.map(p => {
    const dur = p.episode.durationSeconds ?? 0;
    const pct = dur > 0 ? Math.min(100, Math.round((p.actualWatchedSecs / dur) * 100)) : 0;
    return {
      type:             'workshop' as const,
      episodeId:        p.episodeId,
      episodeTitle:     p.episode.title,
      parentTitle:      p.episode.challenge.workshop.title,
      parentSlug:       p.episode.challenge.workshop.slug,
      // legacy field names kept for existing UI
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
  const courseHistoryItems = (courseHistory as any[]).map((p: any) => {
    const dur = p.episode.durationSeconds ?? 0;
    const pct = dur > 0 ? Math.min(100, Math.round((p.actualWatchedSecs / dur) * 100)) : 0;
    return {
      type:             'course' as const,
      episodeId:        p.episodeId,
      episodeTitle:     p.episode.title,
      parentTitle:      p.episode.course.title,
      parentSlug:       p.episode.course.slug,
      // legacy field name reused so existing UI column keeps working
      workshopTitle:    p.episode.course.title,
      workshopSlug:     p.episode.course.slug,
      durationSeconds:  dur,
      watchedSeconds:   p.actualWatchedSecs,
      lastPositionSecs: p.lastWatchedSecs,
      progressPct:      pct,
      isCompleted:      p.completed,
      completedAt:      p.completedAt?.toISOString() ?? null,
      lastWatchedAt:    p.updatedAt.toISOString(),
    };
  });
  const historyItems = [...workshopHistoryItems, ...courseHistoryItems]
    .sort((a, b) => (b.lastWatchedAt > a.lastWatchedAt ? 1 : -1))
    .slice(0, Number(limit));

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
  const activeFilter  = { deletedAt: null } as any;

  const [
    totalMembers,
    activeMembers30d,
    totalEnrollments,
    completedEpisodes,
    completedChallenges,
    submittedAssignments,
    avgHealthScore,
    newMembersLast7d,
  ] = await Promise.all([
    req.server.prisma.member.count({ where: activeFilter }),
    req.server.prisma.member.count({ where: { ...activeFilter, lastActiveAt: { gte: thirtyDaysAgo } } }),
    req.server.prisma.workshopEnrollment.count(),
    req.server.prisma.memberEpisodeProgress.count({ where: { isCompleted: true } }),
    req.server.prisma.memberChallengeProgress.count({ where: { status: 'completed' } }),
    req.server.prisma.assignmentSubmission.count(),
    req.server.prisma.member.aggregate({ where: activeFilter, _avg: { healthScore: true } }),
    req.server.prisma.member.count({ where: { ...activeFilter, createdAt: { gte: sevenDaysAgo } } }),
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
      newMembersLast7d,
    },
    error: null,
  });
}

export async function getAtRiskMembersHandler(req: FastifyRequest, reply: FastifyReply) {
  const { inactiveDays = 7, completionThreshold = 50, page = 1, limit = 20 } = req.query as {
    inactiveDays?: number; completionThreshold?: number; page?: number; limit?: number;
  };

  const safeThreshold = Math.max(0, Math.min(100, Number(completionThreshold) || 50));
  const cutoff = new Date(Date.now() - Number(inactiveDays) * 24 * 60 * 60 * 1000);

  const where = {
    deletedAt: null,
    OR: [
      { lastActiveAt: { lt: cutoff } },
      { lastActiveAt: null },
    ],
    healthScore: { lt: safeThreshold },
  } as any;

  const [members, total] = await Promise.all([
    req.server.prisma.member.findMany({
      where,
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
      orderBy: [{ healthScore: 'asc' }, { createdAt: 'asc' }],
      take: Number(limit),
      skip: (Number(page) - 1) * Number(limit),
    }),
    req.server.prisma.member.count({ where }),
  ]);

  return reply.send({ success: true, data: members, meta: { total, page: Number(page), limit: Number(limit) }, error: null });
}

export async function getCompletionMatrixHandler(req: FastifyRequest, reply: FastifyReply) {
  const { workshopId } = req.params as { workshopId: string };
  const { page = 1, limit = 50 } = req.query as { page?: number; limit?: number };

  const workshop = await req.server.prisma.workshop.findUnique({
    where: { id: workshopId },
    select: { id: true, title: true },
  });
  if (!workshop) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Workshop not found' } });

  // 1. Get challenges ordered by WorkshopFlowItem.order (user-visible sequence)
  const [flowItems, allChallenges] = await Promise.all([
    req.server.prisma.workshopFlowItem.findMany({
      where: { workshopId, challengeId: { not: null } },
      select: { challengeId: true, order: true },
      orderBy: { order: 'asc' },
    }),
    req.server.prisma.challenge.findMany({
      where: { workshopId },
      select: { id: true, title: true, numberLabel: true, type: true },
    }),
  ]);

  const flowOrderMap = new Map<string, number>();
  for (const fi of flowItems) {
    if (fi.challengeId) flowOrderMap.set(fi.challengeId, fi.order);
  }
  const challenges = allChallenges.sort((a, b) =>
    (flowOrderMap.get(a.id) ?? 9999) - (flowOrderMap.get(b.id) ?? 9999)
  );

  // 2. Paginated enrollments
  const [enrollments, enrollmentTotal] = await Promise.all([
    req.server.prisma.workshopEnrollment.findMany({
      where: { workshopId },
      include: { member: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: { enrolledAt: 'desc' },
      take: Number(limit),
      skip: (Number(page) - 1) * Number(limit),
    }),
    req.server.prisma.workshopEnrollment.count({ where: { workshopId } }),
  ]);

  const memberIds = enrollments.map(e => e.memberId);
  const watchChallengeIds   = challenges.filter(c => c.type === 'watch').map(c => c.id);
  const nonWatchChallengeIds = challenges.filter(c => c.type !== 'watch').map(c => c.id);

  // 3. Non-watch: MemberChallengeProgress
  // 4. Watch: check all episodes completed via MemberEpisodeProgress
  const [challengeProgressRows, watchEpisodes] = await Promise.all([
    nonWatchChallengeIds.length > 0
      ? req.server.prisma.memberChallengeProgress.findMany({
          where: { memberId: { in: memberIds }, challengeId: { in: nonWatchChallengeIds }, status: 'completed' },
          select: { memberId: true, challengeId: true },
        })
      : Promise.resolve([]),
    watchChallengeIds.length > 0
      ? req.server.prisma.workshopEpisode.findMany({
          where: { challengeId: { in: watchChallengeIds } },
          select: { id: true, challengeId: true },
        })
      : Promise.resolve([]),
  ]);

  // memberId → Set<challengeId> for non-watch challenges
  const challengeProgressMap = new Map<string, Set<string>>();
  for (const p of challengeProgressRows) {
    if (!challengeProgressMap.has(p.memberId)) challengeProgressMap.set(p.memberId, new Set());
    challengeProgressMap.get(p.memberId)!.add(p.challengeId);
  }

  // challengeId → episodeId[] for watch challenges
  const episodesByChallengeId = new Map<string, string[]>();
  for (const ep of watchEpisodes) {
    if (!episodesByChallengeId.has(ep.challengeId)) episodesByChallengeId.set(ep.challengeId, []);
    episodesByChallengeId.get(ep.challengeId)!.push(ep.id);
  }

  const allEpisodeIds = watchEpisodes.map(e => e.id);
  const completedEpisodeRows = allEpisodeIds.length > 0 && memberIds.length > 0
    ? await req.server.prisma.memberEpisodeProgress.findMany({
        where: { memberId: { in: memberIds }, episodeId: { in: allEpisodeIds }, isCompleted: true },
        select: { memberId: true, episodeId: true },
      })
    : [];

  // memberId → Set<episodeId> for completed watch episodes
  const completedEpisodeMap = new Map<string, Set<string>>();
  for (const ep of completedEpisodeRows) {
    if (!completedEpisodeMap.has(ep.memberId)) completedEpisodeMap.set(ep.memberId, new Set());
    completedEpisodeMap.get(ep.memberId)!.add(ep.episodeId);
  }

  function isChallengeCompleted(memberId: string, challenge: { id: string; type: string }): boolean {
    if (challenge.type !== 'watch') {
      return challengeProgressMap.get(memberId)?.has(challenge.id) ?? false;
    }
    const epIds = episodesByChallengeId.get(challenge.id) ?? [];
    if (epIds.length === 0) return false;
    const memberEps = completedEpisodeMap.get(memberId) ?? new Set<string>();
    return epIds.every(eid => memberEps.has(eid));
  }

  const rows = enrollments.map(e => ({
    member: e.member,
    enrolledAt: e.enrolledAt,
    status: e.status,
    challenges: challenges.map(c => ({
      challengeId: c.id,
      type: c.type,
      completed: isChallengeCompleted(e.memberId, c),
    })),
    completedCount: challenges.filter(c => isChallengeCompleted(e.memberId, c)).length,
    totalCount: challenges.length,
  }));

  return reply.send({
    success: true,
    data: {
      workshopId,
      workshopTitle: workshop.title,
      challenges: challenges.map(c => ({ id: c.id, title: c.title, numberLabel: c.numberLabel, type: c.type })),
      rows,
      enrollmentTotal,
    },
    error: null,
    meta: { total: enrollmentTotal, page: Number(page), limit: Number(limit) },
  });
}

export async function reviewAssignmentHandler(req: FastifyRequest, reply: FastifyReply) {
  const { submissionId } = req.params as { submissionId: string };
  const { reviewNote } = req.body as { reviewNote?: string };

  const submission = await req.server.prisma.assignmentSubmission.findUnique({ where: { id: submissionId } });
  if (!submission) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Submission not found' } });
  if (submission.reviewedAt) return reply.status(409).send({ success: false, error: { code: 'ALREADY_REVIEWED', message: 'This submission has already been reviewed' } });

  const admin = await req.server.prisma.admin.findFirst({
    where: { clerkId: req.user as string },
    select: { fullName: true },
  });
  const reviewedBy = admin?.fullName ?? (req.user as string);

  const updated = await req.server.prisma.assignmentSubmission.update({
    where: { id: submissionId },
    data: { reviewNote: reviewNote ?? null, reviewedBy, reviewedAt: new Date() },
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

// POST /api/members/:id/approve  (admin only — approve a self-registered pending member)
export async function approveMemberHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id: string };
    const body = (request.body || {}) as Record<string, any>;

    const existing = await request.server.prisma.member.findUnique({
      where: { id },
      select: { id: true, status: true } as any,
    });
    if (!existing) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Member not found' } });
    if ((existing as any).status !== 'pending') {
      return reply.status(400).send({ success: false, error: { code: 'BAD_REQUEST', message: 'Member is not in pending status' } });
    }

    const { password, dob, businessEstablishedOn, accountManagerId, batchId, subscriptionEndsAt, status: _ignoredStatus, ...rest } = body;

    // Filter out empty strings — enum fields (gender, preferredSessionMode, etc.) reject "" in Prisma
    const data: any = { status: 'active' };
    for (const key in rest) {
      if ((rest as any)[key] !== '' && (rest as any)[key] !== undefined) {
        data[key] = (rest as any)[key];
      }
    }

    if (dob) data.dob = new Date(dob);
    if (businessEstablishedOn) data.businessEstablishedOn = new Date(businessEstablishedOn);
    if (accountManagerId) data.accountManager = { connect: { id: accountManagerId } };
    if (batchId) data.batch = { connect: { id: batchId } };

    if (password && password.trim() !== '') {
      const bcrypt = await import('bcrypt');
      data.passwordHash = await bcrypt.hash(password, 12);
      try {
        const member = await request.server.prisma.member.findUnique({ where: { id }, select: { email: true, firstName: true, lastName: true, clerkId: true } });
        if (member) {
          if ((member as any).clerkId) {
            await request.server.clerk.users.updateUser((member as any).clerkId, { password });
          } else {
            const baseUsername = (member.email).split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_');
            const clerkUser = await request.server.clerk.users.createUser({
              emailAddress: [member.email], password,
              username: `${baseUsername}_${Math.floor(100 + Math.random() * 900)}`,
              firstName: member.firstName, lastName: member.lastName || undefined,
            });
            data.clerkId = clerkUser.id;
          }
        }
      } catch (_) {}
    }

    const updated = await request.server.prisma.member.update({ where: { id }, data });

    // Create subscription if a paid plan + end date are provided
    const approvedPlan = data.membershipPlan;
    if (subscriptionEndsAt && subscriptionEndsAt.trim() !== '' && approvedPlan && approvedPlan !== 'free') {
      await request.server.prisma.subscription.create({
        data: {
          memberId: id,
          plan: approvedPlan as any,
          startsAt: new Date(),
          endsAt: new Date(subscriptionEndsAt),
          amount: 0,
          status: 'active',
        },
      });
    }

    void invalidateCache(request.server.redis ?? null, `me:${id}`);
    request.server.io.to('admin').emit('admin:member_approved', { memberId: id });

    // Notify the member in real-time and persist an in-app notification
    request.server.io.to(`user:${id}`).emit('notification', {
      type: 'system',
      title: 'Account Approved',
      body: 'Your TBT account has been approved. Welcome to the community!',
      createdAt: new Date().toISOString(),
    });
    request.server.prisma.notification.create({
      data: {
        memberId: id,
        type: 'system',
        title: 'Account Approved',
        body: 'Your TBT account has been approved. Welcome to the community!',
        isRead: false,
      },
    }).catch(() => {});

    return reply.send({ success: true, data: updated, error: null });
  } catch (err: any) {
    request.server.log.error({ err }, 'Failed to approve member');
    return reply.status(500).send({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: err.message } });
  }
}
