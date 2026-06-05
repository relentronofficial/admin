import { FastifyInstance } from 'fastify';
import { verifyTokenHandler, refreshTokenHandler, getMeHandler, generatePasswordHandler } from './controller.js';

export async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/verify-token', verifyTokenHandler);
  fastify.post('/refresh', refreshTokenHandler);
  fastify.get('/generate-password', generatePasswordHandler);
  
  fastify.get('/me', {
    preHandler: [fastify.authenticate],
  }, getMeHandler);
}
