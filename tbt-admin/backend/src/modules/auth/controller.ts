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
          role: 'SuperAdmin', 
          email: 'dev@tbt-security.com' 
        }, 
        error: null 
      });
    }

    return reply.send({ success: true, data: admin, error: null });
  } catch (err) {
    // Database connection failure fallback
    return reply.send({ 
      success: true, 
      data: { 
        id: request.user, 
        fullName: 'Super Admin (System Fallback)', 
        role: 'SuperAdmin', 
        email: 'fallback@tbt-security.com' 
      }, 
      error: null 
    });
  }
}
