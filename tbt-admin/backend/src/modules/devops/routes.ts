import { FastifyInstance } from 'fastify';
import { env } from '../../config/env.js';
import { whatsappIntakeHandler, whatsappIntakeVerifyHandler } from './controller.js';

// Verify the ?secret= query param matches CRON_SECRET.
// The webhook URL is registered at the BSP with the secret embedded,
// so this acts as a shared URL secret without requiring a new env var.
function checkSecret(req: any): boolean {
  if (!env.CRON_SECRET) return true; // no secret configured — allow (dev/test)
  return (req.query as any)?.secret === env.CRON_SECRET;
}

export async function devopsRoutes(fastify: FastifyInstance) {
  // POST — incoming WhatsApp messages from @zacx BSP
  fastify.post('/whatsapp-intake', async (req, reply) => {
    if (!checkSecret(req)) {
      return reply.status(401).send({ error: 'invalid secret' });
    }
    return whatsappIntakeHandler(fastify, req, reply);
  });

  // GET — Meta-style webhook verification handshake (some BSPs use this)
  fastify.get('/whatsapp-intake', async (req, reply) => {
    if (!checkSecret(req)) {
      return reply.status(401).send({ error: 'invalid secret' });
    }
    return whatsappIntakeVerifyHandler(fastify, req, reply);
  });
}
