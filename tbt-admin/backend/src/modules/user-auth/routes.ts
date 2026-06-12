import { FastifyInstance } from 'fastify';
import * as controller from './controller.js';

export async function userAuthRoutes(fastify: FastifyInstance) {
  fastify.post('/login', (req, reply) => controller.login(fastify, req, reply));
  fastify.post('/forgot-password', (req, reply) => controller.forgotPassword(fastify, req, reply));
  fastify.post('/verify-otp', (req, reply) => controller.verifyOtp(fastify, req, reply));
  fastify.post('/set-password', (req, reply) => controller.setPassword(fastify, req, reply));
  fastify.post('/resend-otp', (req, reply) => controller.resendOtp(fastify, req, reply));
  fastify.post('/refresh', (req, reply) => controller.refresh(fastify, req, reply));
  fastify.post('/logout', (req, reply) => controller.logout(fastify, req, reply));
  fastify.get('/me', {
    preHandler: [fastify.authenticateUser],
    handler: (req, reply) => controller.me(fastify, req, reply),
  });
}
