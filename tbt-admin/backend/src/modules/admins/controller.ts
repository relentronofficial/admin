import type { FastifyReply, FastifyRequest } from 'fastify';
import { createAdminSchema, updateAdminSchema, updateStatusSchema, updateRBACSchema } from './schema.js';

export async function generateIdHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const sequence = await request.server.prisma.adminIdSequence.create({ data: {} });
    const year = new Date().getFullYear();
    const paddedId = String(sequence.id).padStart(4, '0');
    const adminId = `TBT-ADMIN-${year}-${paddedId}`;
    return reply.send({ success: true, data: adminId });
  } catch (err: any) {
    request.server.log.error(err);
    const randomId = Math.floor(1000 + Math.random() * 9000);
    const fallbackId = `TBT-ADMIN-2026-${randomId}`;
    return reply.send({ success: true, data: fallbackId });
  }
}

export async function checkUsernameHandler(request: FastifyRequest, reply: FastifyReply) {
  const { username } = request.query as { username: string };
  if (!username) return reply.send({ success: true, data: { available: false } });
  
  const admin = await request.server.prisma.admin.findUnique({ where: { username } });
  return reply.send({ success: true, data: { available: !admin } });
}

export async function checkEmailHandler(request: FastifyRequest, reply: FastifyReply) {
  const { email } = request.query as { email: string };
  if (!email) return reply.send({ success: true, data: { available: false } });

  const admin = await request.server.prisma.admin.findUnique({ where: { email } });
  return reply.send({ success: true, data: { available: !admin } });
}

export async function searchAdminsHandler(request: FastifyRequest, reply: FastifyReply) {
  const { q, role, limit = 8 } = request.query as { q: string; role?: string; limit?: number };
  
  const roles = role ? role.split(',') : undefined;

  const admins = await request.server.prisma.admin.findMany({
    where: {
      AND: [
        { fullName: { contains: q, mode: 'insensitive' } },
        roles ? { role: { in: roles as any } } : {},
        { status: 'active' }
      ]
    },
    take: Number(limit),
    select: {
      id: true,
      fullName: true,
      designation: true,
      employeeId: true,
      role: true,
    }
  });

  return reply.send({ success: true, data: admins });
}

export async function listAdminsHandler(request: FastifyRequest, reply: FastifyReply) {
  const { page = 1, limit = 10, search } = request.query as any;
  const skip = (page - 1) * limit;

  const where = search ? {
    OR: [
      { fullName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { employeeId: { contains: search, mode: 'insensitive' } },
      { username: { contains: search, mode: 'insensitive' } },
    ]
  } : {};

  const [admins, total] = await Promise.all([
    request.server.prisma.admin.findMany({
      where: where as any,
      skip,
      take: Number(limit),
      orderBy: { createdAt: 'desc' }
    }),
    request.server.prisma.admin.count({ where: where as any }),
  ]);

  return reply.send({
    success: true,
    data: admins,
    meta: { total, page, limit },
    error: null
  });
}

export async function createAdminHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const body = createAdminSchema.parse(request.body);

    // Resolve the requesting admin's UUID (Clerk sub is not a UUID)
    const creatorAdmin = await request.server.prisma.admin.findUnique({
      where: { clerkId: request.user },
      select: { id: true },
    });

    const existingEmail = await request.server.prisma.admin.findUnique({ where: { email: body.email } });
    if (existingEmail) {
      return reply.status(409).send({ success: false, error: { code: 'CONFLICT', message: 'Email already exists' } });
    }

    if (body.username) {
        const existingUsername = await request.server.prisma.admin.findUnique({ where: { username: body.username } });
        if (existingUsername) {
          return reply.status(409).send({ success: false, error: { code: 'CONFLICT', message: 'Username already exists' } });
        }
    }

    // Clerk User Creation
    let clerkUserId = '';
    try {
      const clerkUser = await request.server.clerk.users.createUser({
        emailAddress: [body.email],
        password: body.password || Math.random().toString(36).slice(-12),
        username: body.username,
        firstName: body.fullName.split(' ')[0],
        lastName: body.fullName.split(' ').slice(1).join(' ') || undefined,
      });
      clerkUserId = clerkUser.id;
    } catch (clerkErr: any) {
      const errorMessage = clerkErr.errors?.[0]?.longMessage || clerkErr.message || 'Failed to create auth account';
      return reply.status(400).send({ success: false, error: { code: 'AUTH_FAILED', message: errorMessage } });
    }

    try {
      const admin = await request.server.prisma.admin.create({
        data: {
          clerkId: clerkUserId,
          fullName: body.fullName,
          email: body.email,
          phone: body.phone,
          username: body.username,
          alternatePhone: body.alternatePhone,
          dob: body.dob ? new Date(body.dob) : undefined,
          bloodGroup: body.bloodGroup,
          profilePhotoUrl: body.profilePhotoUrl,
          role: body.role,
          department: body.department,
          designation: body.designation,
          employeeId: body.employeeId,
          country: body.country,
          state: body.state,
          city: body.city,
          address: body.address,
          status: body.status,
          notes: body.notes,
          tags: body.tags,
          permissions: body.permissions,
          reportingManagerId: body.reportingManagerId,
          createdBy: creatorAdmin?.id ?? undefined,
        }
      });

      return reply.status(201).send({ success: true, data: admin, error: null });
    } catch (prismaErr: any) {
      await request.server.clerk.users.deleteUser(clerkUserId);
      throw prismaErr;
    }
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation failed', fields: err.flatten().fieldErrors } });
    }
    request.server.log.error(err);
    return reply.status(500).send({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: err.message || 'Something went wrong' } });
  }
}

export async function getAdminHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const admin = await request.server.prisma.admin.findUnique({
    where: { id },
    include: {
      reportingManager: true,
      subordinates: true
    }
  });

  if (!admin) return reply.status(404).send({ success: false, data: null, error: 'Admin not found' });
  return reply.send({ success: true, data: admin, error: null });
}

export async function updateAdminHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id: string };
    const body = updateAdminSchema.parse(request.body);

    const admin = await request.server.prisma.admin.update({
      where: { id },
      data: {
        ...body as any,
        dob: body.dob ? new Date(body.dob) : undefined,
      }
    });

    return reply.send({ success: true, data: admin, error: null });
  } catch (err: any) {
    request.server.log.error(err);
    return reply.status(500).send({ success: false, error: { code: 'UPDATE_FAILED', message: err.message } });
  }
}

export async function deleteAdminHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  await request.server.prisma.admin.delete({ where: { id } });
  return reply.send({ success: true, data: null, error: null });
}

export async function updateStatusHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const { status } = updateStatusSchema.parse(request.body);

  const admin = await request.server.prisma.admin.update({
    where: { id },
    data: { status: status as any },
  });

  return reply.send({ success: true, data: admin, error: null });
}

export async function updateRBAChandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const permissions = updateRBACSchema.parse(request.body);

  const admin = await request.server.prisma.admin.update({
    where: { id },
    data: { permissions },
  });

  return reply.send({ success: true, data: admin, error: null });
}
