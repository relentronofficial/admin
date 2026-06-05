import { FastifyInstance } from 'fastify';
import { sendMessageHandler } from './controller.js';

export async function messagesRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.post(
    '/send',
    {
      schema: {
        body: {
          type: 'object',
          required: ['memberId', 'subject', 'body'],
          properties: {
            memberId: { type: 'string', format: 'uuid' },
            subject:  { type: 'string', minLength: 1, maxLength: 200 },
            body:     { type: 'string', minLength: 1, maxLength: 5000 },
          },
        },
      },
    },
    sendMessageHandler
  );
}
