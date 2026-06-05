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
