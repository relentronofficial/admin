import { FastifyInstance } from 'fastify';
import {
  listPendingPurchasesHandler,
  listAllPurchasesHandler,
  approvePurchaseHandler,
  rejectPurchaseHandler,
  getCreditPricingHandler,
  updateCreditPricingHandler,
} from './controller.js';

export async function creditsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/pending', listPendingPurchasesHandler);
  fastify.get('/all', listAllPurchasesHandler);
  fastify.post('/:id/approve', approvePurchaseHandler);
  fastify.post('/:id/reject', rejectPurchaseHandler);
  fastify.get('/pricing', getCreditPricingHandler);
  fastify.put('/pricing/:creditType', updateCreditPricingHandler);
}
