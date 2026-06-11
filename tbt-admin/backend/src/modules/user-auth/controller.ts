import { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import { generateOtp, storeOtp, verifyAndConsumeOtp } from '../../lib/otp.js';
import { sendOtp } from '../../lib/msg91.js';
import {
  setAuthCookies,
  clearAuthCookies,
  generateRefreshToken,
  storeRefreshToken,
  consumeRefreshToken,
  revokeRefreshToken,
} from '../../plugins/jwt.js';

function getRedis(fastify: FastifyInstance): any {
  return (fastify as any).redis ?? null;
}

function parseCookies(header?: string): Record<string, string> {
  if (!header) return {};
  return Object.fromEntries(
    header.split(';').map((c) => {
      const idx = c.indexOf('=');
      if (idx === -1) return [c.trim(), ''];
      return [c.slice(0, idx).trim(), c.slice(idx + 1).trim()];
    }),
  );
}

async function issueTokens(fastify: FastifyInstance, reply: any, memberId: string) {
  const accessToken: string = await (fastify as any).jwt.sign({ memberId }, { expiresIn: 900 });
  const refreshToken = generateRefreshToken();
  await storeRefreshToken(getRedis(fastify), refreshToken, memberId);
  setAuthCookies(reply, accessToken, refreshToken);
}

// POST /api/user-auth/login
export async function login(fastify: FastifyInstance, request: any, reply: any) {
  const { phone, password } = request.body as { phone: string; password?: string };

  if (!phone) return reply.status(400).send({ success: false, data: null, error: 'Phone is required' });

  const member = await fastify.prisma.member.findFirst({
    where: { phone: phone.trim() } as any,
    select: { id: true, phone: true, passwordHash: true, status: true } as any,
  });

  if (!member) {
    return reply.status(404).send({ success: false, data: null, error: 'Account not found. Please contact admin.' });
  }

  const m = member as any;

  if (m.status !== 'active') {
    return reply.status(403).send({ success: false, data: null, error: `Account is ${m.status}. Please contact admin.` });
  }

  // First-time login: no password set
  if (!m.passwordHash) {
    const otp = generateOtp();
    await storeOtp(getRedis(fastify), m.phone, otp);
    const sent = await sendOtp(m.phone, otp);
    fastify.log.info({ phone: m.phone, otp, sent }, 'OTP generated (first login)');
    return reply.send({ success: true, data: { step: 'first_login', phone: m.phone } });
  }

  // Returning user — password required
  if (!password) {
    return reply.status(400).send({ success: false, data: null, error: 'Password is required' });
  }

  const valid = await bcrypt.compare(password, m.passwordHash);
  if (!valid) {
    return reply.status(401).send({ success: false, data: null, error: 'Incorrect password' });
  }

  // Issue tokens directly — OTP step skipped until DLT SMS is approved
  await issueTokens(fastify, reply, m.id);
  const member = await fastify.prisma.member.findUnique({
    where: { id: m.id },
    select: { id: true, memberId: true, firstName: true, lastName: true, email: true, phone: true, profilePhotoUrl: true, avatarGradient: true } as any,
  });
  return reply.send({ success: true, data: { step: 'done', member } });
}

// POST /api/user-auth/verify-otp
export async function verifyOtp(fastify: FastifyInstance, request: any, reply: any) {
  const { phone, otp } = request.body as { phone: string; otp: string };

  if (!phone || !otp) {
    return reply.status(400).send({ success: false, data: null, error: 'Phone and OTP are required' });
  }

  const result = await verifyAndConsumeOtp(getRedis(fastify), phone.trim(), otp.trim());

  if (result === 'expired') return reply.status(400).send({ success: false, data: null, error: 'OTP expired. Please request a new one.' });
  if (result === 'invalid') return reply.status(400).send({ success: false, data: null, error: 'Invalid OTP. Please try again.' });
  if (result === 'max_attempts') return reply.status(429).send({ success: false, data: null, error: 'Too many failed attempts. Please request a new OTP.' });

  const member = await fastify.prisma.member.findFirst({
    where: { phone: phone.trim() } as any,
    select: { id: true, memberId: true, firstName: true, lastName: true, email: true, phone: true, profilePhotoUrl: true } as any,
  });

  if (!member) return reply.status(404).send({ success: false, data: null, error: 'Account not found' });

  await issueTokens(fastify, reply, (member as any).id);
  return reply.send({ success: true, data: member });
}

// POST /api/user-auth/set-password
export async function setPassword(fastify: FastifyInstance, request: any, reply: any) {
  const { phone, otp, password } = request.body as { phone: string; otp: string; password: string };

  if (!phone || !otp || !password) {
    return reply.status(400).send({ success: false, data: null, error: 'phone, otp and password are required' });
  }
  if (password.length < 6) {
    return reply.status(400).send({ success: false, data: null, error: 'Password must be at least 6 characters' });
  }

  const result = await verifyAndConsumeOtp(getRedis(fastify), phone.trim(), otp.trim());
  if (result === 'expired') return reply.status(400).send({ success: false, data: null, error: 'OTP expired. Please request a new one.' });
  if (result === 'invalid') return reply.status(400).send({ success: false, data: null, error: 'Invalid OTP.' });
  if (result === 'max_attempts') return reply.status(429).send({ success: false, data: null, error: 'Too many failed attempts.' });

  const passwordHash = await bcrypt.hash(password, 12);

  const member = await fastify.prisma.member.findFirst({
    where: { phone: phone.trim() } as any,
    select: { id: true } as any,
  });

  if (!member) return reply.status(404).send({ success: false, data: null, error: 'Account not found' });

  await (fastify.prisma.member as any).update({
    where: { id: (member as any).id },
    data: { passwordHash },
  });

  const updated = await fastify.prisma.member.findUnique({
    where: { id: (member as any).id },
    select: { id: true, memberId: true, firstName: true, lastName: true, email: true, phone: true, profilePhotoUrl: true } as any,
  });

  await issueTokens(fastify, reply, (member as any).id);
  return reply.send({ success: true, data: updated });
}

// POST /api/user-auth/resend-otp
export async function resendOtp(fastify: FastifyInstance, request: any, reply: any) {
  const { phone } = request.body as { phone: string };

  if (!phone) return reply.status(400).send({ success: false, data: null, error: 'Phone is required' });

  const member = await fastify.prisma.member.findFirst({
    where: { phone: phone.trim() } as any,
    select: { id: true, phone: true } as any,
  });

  if (!member) return reply.status(404).send({ success: false, data: null, error: 'Account not found' });

  const otp = generateOtp();
  await storeOtp(getRedis(fastify), (member as any).phone, otp);
  const sent = await sendOtp((member as any).phone, otp);
  if (!sent) fastify.log.warn({ phone }, 'MSG91 resend failed');

  return reply.send({ success: true, data: null });
}

// POST /api/user-auth/refresh
export async function refresh(fastify: FastifyInstance, request: any, reply: any) {
  const cookies = parseCookies(request.headers.cookie);
  const refreshToken = cookies['tbt_refresh'];

  if (!refreshToken) {
    return reply.status(401).send({ success: false, data: null, error: 'No refresh token' });
  }

  const memberId = await consumeRefreshToken(getRedis(fastify), refreshToken);
  if (!memberId) {
    clearAuthCookies(reply);
    return reply.status(401).send({ success: false, data: null, error: 'Invalid or expired refresh token' });
  }

  const member = await fastify.prisma.member.findUnique({
    where: { id: memberId },
    select: { id: true, status: true } as any,
  });

  if (!member || (member as any).status !== 'active') {
    clearAuthCookies(reply);
    return reply.status(403).send({ success: false, data: null, error: 'Account not active' });
  }

  await issueTokens(fastify, reply, memberId);
  return reply.send({ success: true, data: null });
}

// POST /api/user-auth/logout
export async function logout(fastify: FastifyInstance, request: any, reply: any) {
  const cookies = parseCookies(request.headers.cookie);
  const refreshToken = cookies['tbt_refresh'];

  if (refreshToken) {
    await revokeRefreshToken(getRedis(fastify), refreshToken).catch(() => {});
  }

  clearAuthCookies(reply);
  return reply.send({ success: true, data: null });
}

// GET /api/user-auth/me  (protected by authenticateUser)
export async function me(fastify: FastifyInstance, request: any, reply: any) {
  const member = await fastify.prisma.member.findUnique({
    where: { id: request.memberId },
    select: {
      id: true,
      memberId: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      profilePhotoUrl: true,
      avatarGradient: true,
      status: true,
    } as any,
  });

  if (!member) return reply.status(404).send({ success: false, data: null, error: 'Not found' });
  return reply.send({ success: true, data: member });
}
