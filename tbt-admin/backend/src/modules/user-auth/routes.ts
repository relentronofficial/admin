import { FastifyInstance } from 'fastify';
import * as controller from './controller.js';
import { devPeekOtp } from '../../lib/otp.js';

export async function userAuthRoutes(fastify: FastifyInstance) {
  fastify.post('/signup', (req, reply) => controller.signup(fastify, req, reply));
  fastify.post('/login', (req, reply) => controller.login(fastify, req, reply));
  fastify.post('/forgot-password', (req, reply) => controller.forgotPassword(fastify, req, reply));
  fastify.post('/verify-otp', (req, reply) => controller.verifyOtp(fastify, req, reply));
  fastify.post('/set-password', (req, reply) => controller.setPassword(fastify, req, reply));
  fastify.post('/resend-otp', (req, reply) => controller.resendOtp(fastify, req, reply));
  fastify.post('/refresh', (req, reply) => controller.refresh(fastify, req, reply));
  fastify.post('/logout', (req, reply) => controller.logout(fastify, req, reply));
  // Member-facing "sign out on all devices". Requires the current
  // access token (authenticateUser) and kills every refresh token
  // for the member across all devices — any other device holding a
  // stale access token will lose access on its next refresh.
  fastify.delete('/sessions', {
    preHandler: [fastify.authenticateUser],
    handler: (req, reply) => controller.revokeAllSessions(fastify, req, reply),
  });
  fastify.get('/me', {
    preHandler: [fastify.authenticateUser],
    handler: (req, reply) => controller.me(fastify, req, reply),
  });

  // DEV ONLY — peek at current in-memory OTP for a phone. Never runs in production.
  if (process.env.NODE_ENV !== 'production') {
    fastify.get('/dev-otp/:phone', (req, reply) => {
      const { phone } = req.params as { phone: string };
      const otp = devPeekOtp(decodeURIComponent(phone));
      if (!otp) return reply.status(404).send({ otp: null });
      return reply.send({ otp });
    });
  }

  // Admin-only WhatsApp diagnostic. Protected by CRON_SECRET header
  // (same pattern as the cron endpoints — no Clerk / member auth
  // required, so support engineers can hit it during an incident
  // without extra credentials).
  fastify.get('/whatsapp-diagnostic',
    (req, reply) => controller.whatsappDiagnostic(fastify, req, reply));
}
