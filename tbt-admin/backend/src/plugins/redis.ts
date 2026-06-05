import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import fp from 'fastify-plugin';
import { Redis } from 'ioredis';
import { env } from '../config/env.js';

async function redisPlugin(fastify: FastifyInstance, opts: FastifyPluginOptions) {
  if (!env.UPSTASH_REDIS_URL) {
    fastify.log.warn('⚠️ Redis URL missing, skipping Redis plugin');
    return;
  }

  const redis = new Redis(env.UPSTASH_REDIS_URL, {
    password: env.UPSTASH_REDIS_TOKEN,
  });

  fastify.decorate('redis', redis);

  fastify.addHook('onClose', async (instance) => {
    await instance.redis.quit();
  });
}

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis;
  }
}

export default fp(redisPlugin);
