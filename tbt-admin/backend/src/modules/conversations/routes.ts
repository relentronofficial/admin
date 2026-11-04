import { FastifyInstance } from 'fastify';
import {
  listAdminConversationsHandler,
  getAdminConversationMessagesHandler,
  sendAdminChatMessageHandler,
  editAdminChatMessageHandler,
  deleteAdminChatMessageHandler,
  closeConversationHandler,
  raiseTicketFromDmHandler,
  toggleDmReactionHandler,
  forwardDmMessageHandler,
  toggleDmPinHandler,
  toggleDmAdminStarHandler,
  listAdminStarredMessagesHandler,
} from './controller.js';

export async function conversationsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/',         listAdminConversationsHandler);
  fastify.get('/starred',  listAdminStarredMessagesHandler);   // before /:id to avoid param conflict

  fastify.get('/:id/messages', getAdminConversationMessagesHandler);
  fastify.post('/:id/messages', {
    schema: {
      body: {
        type: 'object',
        required: ['body'],
        properties: { body: { type: 'string', minLength: 1, maxLength: 5000 } },
      },
    },
  }, sendAdminChatMessageHandler);
  fastify.put('/:id/messages/:messageId',                      editAdminChatMessageHandler);
  fastify.delete('/:id/messages/:messageId',                   deleteAdminChatMessageHandler);
  fastify.post('/:id/messages/:messageId/raise-ticket',        raiseTicketFromDmHandler);
  fastify.post('/:id/messages/:messageId/react',               toggleDmReactionHandler);
  fastify.post('/:id/messages/:messageId/forward',             forwardDmMessageHandler);
  fastify.patch('/:id/messages/:messageId/pin',                toggleDmPinHandler);
  fastify.patch('/:id/messages/:messageId/star',               toggleDmAdminStarHandler);
  fastify.patch('/:id/close',                                  closeConversationHandler);
}
