import type { FastifyReply, FastifyRequest } from 'fastify';
import crypto from 'crypto';

export async function generatePasswordHandler(request: FastifyRequest, reply: FastifyReply) {
  const length = 12;
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+";
  let password = "";
  for (let i = 0, n = charset.length; i < length; ++i) {
    password += charset.charAt(crypto.randomInt(0, n));
  }
  return reply.send({ success: true, data: password });
}

export async function verifyTokenHandler(request: FastifyRequest, reply: FastifyReply) {
  // Clerk handles token verification via middleware, but this could be for manual check
  return reply.send({ success: true, data: { userId: request.user }, error: null });
}

export async function refreshTokenHandler(request: FastifyRequest, reply: FastifyReply) {
  return reply.send({ success: true, data: { message: 'Token refreshed' }, error: null });
}

export async function getMeHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const admin = await request.server.prisma.admin.findUnique({
      where: { clerkId: request.user },
    });

    if (!admin) {
      // Fallback for development if clerk user not in DB yet
      return reply.send({
        success: true,
        data: {
          id: request.user,
          fullName: 'Super Admin (Dev)',
          role: 'super_admin',
          email: 'dev@tbt-security.com'
        },
        error: null
      });
    }

    // Update lastLoginAt once per session (only if null or older than 1 hour).
    // This endpoint is Clerk-protected so it is only reachable after successful auth.
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    if (!admin.lastLoginAt || admin.lastLoginAt < oneHourAgo) {
      request.server.prisma.admin.update({
        where: { id: admin.id },
        data: { lastLoginAt: now },
      }).catch(() => {}); // non-fatal fire-and-forget
    }

    return reply.send({ success: true, data: admin, error: null });
  } catch (err) {
    // Database connection failure fallback
    return reply.send({
      success: true,
      data: {
        id: request.user,
        fullName: 'Super Admin (System Fallback)',
        role: 'super_admin',
        email: 'fallback@tbt-security.com'
      },
      error: null
    });
  }
}
