import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { canUsePsychometric } from '../../lib/psychometric/access.js';
import * as content from './content.controller.js';

const DENIED = 'Psychometric Admin is available to Admin and Super Admin only.';

/** Clerk-verified TBT admin with role Admin / Super Admin; sets req.psyAdmin. */
async function requirePsychometricAdmin(req: FastifyRequest, reply: FastifyReply) {
  const admin = await req.server.prisma.admin.findUnique({
    where: { clerkId: req.user as string },
    select: { id: true, fullName: true, email: true, role: true },
  });
  if (!admin || !canUsePsychometric(admin.role)) return reply.code(403).send({ success: false, message: DENIED });
  (req as FastifyRequest & { psyAdmin: unknown }).psyAdmin = admin;
}

// Psychometric Admin — the former standalone platform's admin API, served by
// TBT. Paths after the prefix match the old API (/admin/...), so the admin
// panel's /psychometric pages call them unchanged.
export async function psychometricPlatformAdminRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);
  fastify.addHook('preHandler', requirePsychometricAdmin);

  fastify.get('/access', async (_req, reply) => reply.send({ success: true, data: { allowed: true, configured: true } }));

  fastify.get('/admin/shared-ids', content.listAccessCodes);
  fastify.post('/admin/shared-ids', content.createAccessCode);
  fastify.put('/admin/shared-ids/:id', content.updateAccessCode);
  fastify.delete('/admin/shared-ids/:id', content.deleteAccessCode);
  fastify.get('/admin/shared-ids/:id/stats', content.accessCodeStats);

  fastify.get('/admin/question-types', content.listQuestionTypes);
  fastify.post('/admin/question-types', content.createQuestionType);
  fastify.put('/admin/question-types/:id', content.updateQuestionType);
  fastify.delete('/admin/question-types/:id', content.deleteQuestionType);

  // Question audio is a base64 data URI (capped at ~4 MB client-side).
  const big = { bodyLimit: 8 * 1024 * 1024 };
  fastify.get('/admin/questions', content.listQuestions);
  fastify.post('/admin/questions/reorder', content.reorderQuestions);
  fastify.get('/admin/questions/:id', content.getQuestion);
  fastify.post('/admin/questions', big, content.createQuestion);
  fastify.put('/admin/questions/:id', big, content.updateQuestion);
  fastify.delete('/admin/questions/:id', content.deleteQuestion);

  fastify.get('/admin/answer-options', content.listAnswerOptions);
  fastify.post('/admin/answer-options', content.createAnswerOption);
  fastify.put('/admin/answer-options/:id', content.updateAnswerOption);
  fastify.delete('/admin/answer-options/:id', content.deleteAnswerOption);

  fastify.get('/admin/question-sets', content.listQuestionSets);
  fastify.get('/admin/question-sets/:id', content.getQuestionSet);
  fastify.post('/admin/question-sets', content.createQuestionSet);
  fastify.put('/admin/question-sets/:id', content.updateQuestionSet);
  fastify.delete('/admin/question-sets/:id', content.deleteQuestionSet);

  fastify.get('/admin/business-matrix', content.getMatrix);
  fastify.post('/admin/business-matrix/seed-sample', content.seedSampleMatrix);
  fastify.post('/admin/business-matrix', content.createMatrixCell);
  fastify.put('/admin/business-matrix/:id', content.updateMatrixCell);
  fastify.delete('/admin/business-matrix/:id', content.deleteMatrixCell);

  fastify.get('/admin/settings', content.getSettings);
  fastify.post('/admin/settings', content.updateSettings);
}
