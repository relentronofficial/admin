import { FastifyInstance } from 'fastify';
import {
  listAdminConversationsHandler,
  getAdminConversationMessagesHandler,
  sendAdminChatMessageHandler,
  closeConversationHandler,
} from './controller.js';
export async function conversationsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/',             listAdminConversationsHandler);
  fastify.get('/:id/messages', getAdminConversationMessagesHandler);
  fastify.post(
    '/:id/messages',
    {
      schema: {
        body: {
          type: 'object',
          required: ['body'],
          properties: {
            body: { type: 'string', minLength: 1, maxLength: 5000 },
          },
        },
      },
    },
    sendAdminChatMessageHandler
  );
  fastify.patch('/:id/close',  closeConversationHandler);
}
