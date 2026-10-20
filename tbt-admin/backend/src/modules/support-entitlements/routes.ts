import { FastifyInstance } from 'fastify';
import {
  listEntitlementsHandler,
  updateEntitlementHandler,
  listUsageHandler,
  recordUsageHandler,
  deleteUsageHandler,
  getMemberSupportQuotaHandler,
  listSupportSessionsHandler,
  createSupportSessionHandler,
  updateSupportSessionHandler,
  cancelSupportSessionHandler,
  listSupportSessionBookingsHandler,
  markSupportBookingHandler,
  listCallCoinPricingHandler,
  updateCallCoinPricingHandler,
} from './controller.js';

export async function supportEntitlementsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/', listEntitlementsHandler);
  fastify.put('/:plan', updateEntitlementHandler);
  fastify.get('/usage', listUsageHandler);
  fastify.post('/usage', recordUsageHandler);
  fastify.delete('/usage/:id', deleteUsageHandler);
  fastify.get('/member/:memberId', getMemberSupportQuotaHandler);

  // Coin price per extra call once a member's included calls are used.
  fastify.get('/coin-pricing', listCallCoinPricingHandler);
  fastify.put('/coin-pricing/:category', updateCallCoinPricingHandler);

  // Expert Support Call sessions — role-gated in the handlers (admin/super_admin all, mentor own).
  fastify.get('/sessions', listSupportSessionsHandler);
  fastify.post('/sessions', createSupportSessionHandler);
  fastify.put('/sessions/:id', updateSupportSessionHandler);
  fastify.post('/sessions/:id/cancel', cancelSupportSessionHandler);
  fastify.get('/sessions/:id/bookings', listSupportSessionBookingsHandler);
  fastify.put('/bookings/:id/status', markSupportBookingHandler);
}
