import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import fp from 'fastify-plugin';
import { PrismaClient } from '@prisma/client';

async function prismaPlugin(fastify: FastifyInstance, opts: FastifyPluginOptions) {
  const prisma = new PrismaClient();

  try {
    await prisma.$connect();
    fastify.log.info('✅ Database connected');
  } catch (err) {
    fastify.log.error('❌ Database connection failed:', err as any);
  }

  fastify.decorate('prisma', prisma);

  fastify.addHook('onClose', async (instance) => {
    await instance.prisma.$disconnect();
  });
}

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

export default fp(prismaPlugin);
