import { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import { generateOtp, storeOtp, verifyAndConsumeOtp, checkOtpRateLimit } from '../../lib/otp.js';
import { sendOtpWhatsapp, sendOtpWhatsappDiagnostic } from '../../lib/whatsapp.js';
import { sendOtp as sendOtpSms } from '../../lib/msg91.js';

async function sendOtpWithFallback(phone: string, otp: string): Promise<boolean> {
  const waOk = await sendOtpWhatsapp(phone, otp);
  if (waOk) return true;
  // WhatsApp delivery failed — fall back to SMS via MSG91
  return sendOtpSms(phone, otp);
}
import { env } from '../../config/env.js';
import {
  setAuthCookies,
  clearAuthCookies,
  generateRefreshToken,
  storeRefreshToken,
  consumeRefreshToken,
  revokeRefreshToken,
  revokeAllForMember,
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

/// Decides what to put in the `otp` field of an OTP-issuing endpoint's
/// response body.
///
///   * **`sent === true`** → WhatsApp delivered successfully.
///     Return `undefined` so the mobile / web client shows the OTP
///     entry screen and the user copies the code from WhatsApp.
///   * **`sent === false` AND non-production** → WhatsApp delivery
///     failed but we're in dev / staging — return the OTP so the
///     testing engineer can proceed without a real phone. Mobile
///     pre-fills the boxes (but does NOT auto-submit; the user still
///     taps Verify — see otp_screen.dart).
///   * **`sent === false` AND production** → WhatsApp is genuinely
///     broken for a real user. Return `undefined` so the mobile
///     surfaces "OTP delivery failed, try resending" instead of
///     silently leaking the OTP into the response body (which older
///     mobile builds auto-submitted, bypassing 2FA entirely).
///
/// A separate `delivered` boolean is included in the response so the
/// client can distinguish "OTP is on the way" from "delivery failed,
/// user should press Resend".
// Shared 429 response for OTP rate-limit rejections. Includes
// retryAfterSeconds so the mobile client can render a countdown
// instead of a bare error toast.
function otpRateLimitReply(reply: any, gate: Extract<Awaited<ReturnType<typeof checkOtpRateLimit>>, { ok: false }>) {
  const message = gate.reason === 'cooldown'
    ? `Please wait ${gate.retryAfterSeconds}s before requesting another OTP.`
    : 'Too many OTP requests. Please try again in an hour.';
  return reply
    .status(429)
    .header('Retry-After', String(gate.retryAfterSeconds))
    .send({
      success: false,
      data: null,
      error: message,
      retryAfterSeconds: gate.retryAfterSeconds,
    });
}

function otpResponseFields(sent: boolean, otp: string): {
  otp?: string;
  delivered: boolean;
} {
  const isProduction = env.NODE_ENV === 'production';
  if (sent) return { delivered: true };
  return {
    delivered: false,
    ...(isProduction ? {} : { otp }),
  };
}

function normalizePhoneForLookup(raw: string): string[] {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return [digits, `91${digits}`, `+91${digits}`];
  if (digits.length === 12 && digits.startsWith('91')) return [digits, `+${digits}`, digits.slice(2)];
  return [raw.trim(), digits];
}

// POST /api/user-auth/login
export async function login(fastify: FastifyInstance, request: any, reply: any) {
  const { phone, password } = request.body as { phone: string; password?: string };

  if (!phone) return reply.status(400).send({ success: false, data: null, error: 'Phone is required' });

  const member = await fastify.prisma.member.findFirst({
    where: { phone: { in: normalizePhoneForLookup(phone) } } as any,
    select: { id: true, phone: true, passwordHash: true, status: true, deletedAt: true } as any,
  });

  if (!member) {
    return reply.status(404).send({ success: false, data: null, error: 'Account not found. Please contact admin.' });
  }

  const m = member as any;

  if (m.deletedAt) {
    return reply.status(403).send({ success: false, data: null, error: 'Account not found. Please contact admin.' });
  }

  if (['inactive', 'suspended', 'paused'].includes(m.status)) {
    return reply.status(403).send({ success: false, data: null, error: `Account is ${m.status}. Please contact admin.` });
  }

  // Account has no passwordHash yet (first-time member, or admin-created
  // without a password). We only send the "set your password" OTP when the
  // client explicitly asked for it by submitting an EMPTY password field.
  // If the client sent a non-empty password, they're trying to authenticate
  // against a hash that doesn't exist — reject as invalid credentials to
  // prevent a "any password → OTP → session" bypass on passwordless accounts.
  if (!m.passwordHash) {
    if (password && password.length > 0) {
      fastify.log.warn({ phone: m.phone }, 'Login: password submitted for passwordless account — returning 401');
      return reply.status(401).send({
        success: false,
        data: null,
        error: 'Invalid phone or password',
      });
    }
    const gate = await checkOtpRateLimit(getRedis(fastify), m.phone);
    if (!gate.ok) return otpRateLimitReply(reply, gate);
    const otp = generateOtp();
    await storeOtp(getRedis(fastify), m.phone, otp);
    const sent = await sendOtpWithFallback(m.phone, otp);
    fastify.log.info({ phone: m.phone, sent }, 'OTP generated (first login)');
    return reply.send({
      success: true,
      data: { step: 'first_login', phone: m.phone, ...otpResponseFields(sent, otp) },
    });
  }

  // Password required for returning users
  if (!password) {
    return reply.status(400).send({ success: false, data: null, error: 'Password is required' });
  }

  const valid = await bcrypt.compare(password, m.passwordHash);

  // SECURITY: bcrypt mismatch MUST return 401. A prior "auto-heal stale hash"
  // shortcut (commit 46144dd6) silently sent an OTP on any wrong password
  // and the follow-up OTP verify issued session cookies — which meant anyone
  // who could receive the target phone's OTP could log in with any password.
  // Users who genuinely forgot their password must use the Forgot Password
  // flow (POST /api/user-auth/forgot-password) which they trigger explicitly.
  if (!valid) {
    fastify.log.warn({ phone: m.phone }, 'Login: bcrypt mismatch — returning 401');
    return reply.status(401).send({
      success: false,
      data: null,
      error: 'Invalid phone or password',
    });
  }

  const gate = await checkOtpRateLimit(getRedis(fastify), m.phone);
  if (!gate.ok) return otpRateLimitReply(reply, gate);
  const otp = generateOtp();
  await storeOtp(getRedis(fastify), m.phone, otp);
  const sent = await sendOtpWithFallback(m.phone, otp);
  fastify.log.info({ phone: m.phone, sent }, 'OTP generated');
  return reply.send({
    success: true,
    data: { step: 'otp_required', phone: m.phone, ...otpResponseFields(sent, otp) },
  });
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
    where: { phone: { in: normalizePhoneForLookup(phone) } } as any,
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
    where: { phone: { in: normalizePhoneForLookup(phone) } } as any,
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

// POST /api/user-auth/forgot-password
export async function forgotPassword(fastify: FastifyInstance, request: any, reply: any) {
  const { phone } = request.body as { phone: string };

  if (!phone) return reply.status(400).send({ success: false, data: null, error: 'Phone is required' });

  const member = await fastify.prisma.member.findFirst({
    where: { phone: { in: normalizePhoneForLookup(phone) } } as any,
    select: { id: true, phone: true, status: true } as any,
  });

  if (!member) {
    return reply.status(404).send({ success: false, data: null, error: 'Account not found. Please contact admin.' });
  }

  const m = member as any;
  if (['inactive', 'suspended', 'paused'].includes(m.status)) {
    return reply.status(403).send({ success: false, data: null, error: `Account is ${m.status}. Please contact admin.` });
  }

  const gate = await checkOtpRateLimit(getRedis(fastify), m.phone);
  if (!gate.ok) return otpRateLimitReply(reply, gate);
  const otp = generateOtp();
  await storeOtp(getRedis(fastify), m.phone, otp);
  const sent = await sendOtpWithFallback(m.phone, otp);
  fastify.log.info({ phone: m.phone, sent }, 'OTP generated (forgot password)');

  return reply.send({
    success: true,
    data: { step: 'reset_password', phone: m.phone, ...otpResponseFields(sent, otp) },
  });
}

// POST /api/user-auth/resend-otp
export async function resendOtp(fastify: FastifyInstance, request: any, reply: any) {
  const { phone } = request.body as { phone: string };

  if (!phone) return reply.status(400).send({ success: false, data: null, error: 'Phone is required' });

  const member = await fastify.prisma.member.findFirst({
    where: { phone: { in: normalizePhoneForLookup(phone) } } as any,
    select: { id: true, phone: true } as any,
  });

  if (!member) return reply.status(404).send({ success: false, data: null, error: 'Account not found' });

  const gate = await checkOtpRateLimit(getRedis(fastify), (member as any).phone);
  if (!gate.ok) return otpRateLimitReply(reply, gate);
  const otp = generateOtp();
  await storeOtp(getRedis(fastify), (member as any).phone, otp);
  const sent = await sendOtpWithFallback((member as any).phone, otp);
  if (!sent) fastify.log.warn({ phone }, 'OTP resend failed (WhatsApp + SMS both failed)');

  return reply.send({ success: true, data: null });
}

// POST /api/user-auth/refresh
//
// Session-preservation rules mirror the mobile client's expectations:
//
//   * 401  → refresh token invalid / revoked / expired. The mobile
//            side wipes local tokens and lands on /login. Only send
//            401 when we're certain the token is genuinely dead.
//   * 403  → account is HARD-blocked (inactive / suspended / paused).
//            Same effect on the client as 401.
//   * 5xx  → transient backend problem. The mobile side KEEPS its
//            tokens intact and retries. Never invalidate on our end
//            in this case either — leave the refresh cookie alone.
//   * 200  → success, new access + refresh cookies attached.
//
// Historic bug: this endpoint used to return 403 for any status
// other than `active`. That included `pending` — meaning newly-
// signed-up members would land, get logged out by their first
// refresh, and bounce back to /login in a loop. Now we allow both
// `active` and `pending` through (matches `authenticateUser`
// middleware in plugins/jwt.ts).
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

  let member: { id: string; status: string } | null;
  try {
    member = (await fastify.prisma.member.findUnique({
      where: { id: memberId },
      select: { id: true, status: true } as any,
    })) as any;
  } catch (err: any) {
    // DB blip — the refresh token WAS valid (peek+rotate succeeded).
    // Return 5xx so the mobile client keeps its tokens and retries,
    // rather than wrongly logging out because of an infra hiccup.
    request.server.log.warn({ err: err.message }, 'refresh: member lookup failed');
    return reply.status(503).send({ success: false, data: null, error: 'Service temporarily unavailable' });
  }

  if (!member) {
    // Account deleted → really invalid, clear cookies.
    clearAuthCookies(reply);
    return reply.status(401).send({ success: false, data: null, error: 'Account not found' });
  }

  // Hard-block statuses actually invalidate the session.
  // `pending` is intentionally NOT here — pending members can hold a
  // valid session while the admin approves them; SubscriptionGate on
  // the client surfaces the pending state via /me.
  const HARD_BLOCKED = new Set(['inactive', 'suspended', 'paused']);
  if (HARD_BLOCKED.has(member.status)) {
    clearAuthCookies(reply);
    return reply.status(403).send({ success: false, data: null, error: `Account is ${member.status}` });
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

// DELETE /api/user-auth/sessions  (member-facing: sign out on ALL devices)
// Requires an authenticated member. Wipes every refresh token for this
// member from Redis, so any other device holding a session will be
// signed out on its next refresh.
export async function revokeAllSessions(
  fastify: FastifyInstance,
  request: any,
  reply: any,
) {
  const memberId = request.memberId as string | undefined;
  if (!memberId) {
    return reply
      .status(401)
      .send({ success: false, data: null, error: 'Unauthorized' });
  }
  const deleted = await revokeAllForMember(getRedis(fastify), memberId);
  // Also clear THIS request's cookies so the caller gets a clean state.
  clearAuthCookies(reply);
  return reply.send({
    success: true,
    data: { revokedSessions: deleted },
  });
}

// GET /api/user-auth/whatsapp-diagnostic?phone=<10-digits>
//
// Admin diagnostic endpoint — protected by CRON_SECRET header (same
// pattern as the existing cron endpoints). Does a live send-OTP call
// against the @zacx BSP and returns the raw response envelope so the
// exact failure reason is visible without SSHing into Cloud Run.
//
// Never logs / returns the access token. Only the last 4 chars of the
// token are echoed for correlation ("does the deployed token match
// what I have in the zacx dashboard?").
//
// Usage:
//   curl -H "x-cron-secret: $CRON_SECRET" \
//     "https://tbt-backend-.../api/user-auth/whatsapp-diagnostic?phone=7010834661"
export async function whatsappDiagnostic(
  fastify: FastifyInstance,
  request: any,
  reply: any,
) {
  const secret = request.headers['x-cron-secret'];
  if (!env.CRON_SECRET || secret !== env.CRON_SECRET) {
    return reply.status(401).send({ success: false, error: 'Unauthorized' });
  }
  const phone = (request.query?.phone as string) ?? '';
  if (!phone || phone.length < 8) {
    return reply.status(400).send({
      success: false,
      error: 'Missing or invalid ?phone=<digits> query parameter',
    });
  }

  // Use a fixed OTP for the diagnostic call so nobody accidentally
  // ends up logged in from a stray verification — this OTP is NOT
  // stored in Redis, so it can't be verified against a subsequent
  // /verify-otp call.
  const diagnostic = await sendOtpWhatsappDiagnostic(phone, '000000');

  // Attach a short human-readable hint so whoever's reading the
  // response (probably the person triaging the outage) doesn't have
  // to parse @zacx-specific status codes on the spot.
  const hint = interpretationHint(diagnostic.interpreted);

  return reply.send({
    success: true,
    data: {
      ...diagnostic,
      hint,
    },
  });
}

function interpretationHint(
  interpreted: 'success' | 'bsp_rejected' | 'bad_credentials' | 'network_error' | 'not_configured',
): string {
  switch (interpreted) {
    case 'success':
      return 'BSP accepted the send. If the phone still didn\'t receive it, check @zacx delivery logs and Meta template approval status.';
    case 'bsp_rejected':
      return 'BSP rejected the send. Read `response.body` — typical causes: template not approved, template argument count mismatch, phone not opted in to WhatsApp Business, account balance depleted.';
    case 'bad_credentials':
      return '401/403 from BSP. WABA_ACCESS_TOKEN is invalid or expired — rotate it in the @zacx dashboard and update the Cloud Run secret.';
    case 'network_error':
      return 'Could not reach the BSP endpoint. Verify WABA_API_BASE_URL points at the correct @zacx host and Cloud Run has outbound network to it.';
    case 'not_configured':
      return 'One or more WABA_* env vars are missing on Cloud Run. See `configured` field.';
  }
}

// POST /api/members/:id/sessions/revoke  (admin-facing helper — exported
// so the admin module can wire it under the Clerk-protected auth
// middleware. Kills every session for a target member id.)
export async function adminRevokeMemberSessions(
  fastify: FastifyInstance,
  request: any,
  reply: any,
) {
  const targetId = (request.params as any)?.id as string | undefined;
  if (!targetId) {
    return reply
      .status(400)
      .send({ success: false, data: null, error: 'Member id required' });
  }
  const deleted = await revokeAllForMember(getRedis(fastify), targetId);
  return reply.send({
    success: true,
    data: { memberId: targetId, revokedSessions: deleted },
  });
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
      verificationStatus: true,
      onboardingCompleted: true,
      onboardingSubmittedAt: true,
      onboardingReviewNote: true,
    } as any,
  });

  if (!member) return reply.status(404).send({ success: false, data: null, error: 'Not found' });
  return reply.send({ success: true, data: member });
}

// POST /api/user-auth/signup  (public — self-registration)
export async function signup(fastify: FastifyInstance, request: any, reply: any) {
  const { firstName, lastName, phone, email, password, businessName, city, state, productServiceType } =
    request.body as {
      firstName: string; lastName?: string; phone: string; email: string;
      password: string; businessName?: string; city?: string; state?: string;
      productServiceType?: string;
    };

  if (!firstName || !phone || !email || !password) {
    return reply.status(400).send({ success: false, data: null, error: 'firstName, phone, email and password are required' });
  }
  if (password.length < 6) {
    return reply.status(400).send({ success: false, data: null, error: 'Password must be at least 6 characters' });
  }

  const phoneVariants = normalizePhoneForLookup(phone);

  const [existingPhone, existingEmail] = await Promise.all([
    fastify.prisma.member.findFirst({ where: { phone: { in: phoneVariants }, deletedAt: null } as any, select: { id: true } as any }),
    fastify.prisma.member.findFirst({ where: { email, deletedAt: null } as any, select: { id: true } as any }),
  ]);

  if (existingPhone) {
    return reply.status(409).send({ success: false, data: null, error: 'An account with this phone number already exists. Please log in.' });
  }
  if (existingEmail) {
    return reply.status(409).send({ success: false, data: null, error: 'An account with this email already exists. Please log in.' });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const memberId = `TBT-${Math.floor(1000 + Math.random() * 9000)}`;

  const member = await (fastify.prisma.member as any).create({
    data: {
      firstName,
      lastName: lastName || null,
      phone: phone.trim(),
      email,
      passwordHash,
      memberId,
      businessName: businessName || null,
      city: city || null,
      state: state || null,
      productServiceType: productServiceType || null,
      status: 'pending',
      membershipPlan: 'free',
    },
  });

  // Admins are notified when the member actually SUBMITS the onboarding
  // wizard (modules/onboarding/controller.ts submitOnboardingHandler), not
  // here — signup only creates the account; there's nothing to review yet.
  // See SELF_ONBOARDING_SPECKIT.md §5.4.
  fastify.log.info({ memberId: member.id, phone: member.phone }, 'New self-signup — awaiting onboarding');
  return reply.status(201).send({ success: true, data: null });
}
