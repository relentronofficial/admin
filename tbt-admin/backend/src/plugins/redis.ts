import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import fp from 'fastify-plugin';
import { Redis as UpstashRedis } from '@upstash/redis';
import type { RedisLike } from '../lib/cache.js';
import { env } from '../config/env.js';

class UpstashAdapter implements RedisLike {
  constructor(private client: UpstashRedis) {}

  async get(key: string): Promise<string | null> {
    return (await this.client.get<string>(key)) ?? null;
  }

  async set(key: string, value: string, ...args: unknown[]): Promise<string | null> {
    const opts: { ex?: number; nx?: boolean } = {};
    for (let i = 0; i < args.length; i++) {
      if (args[i] === 'EX') { opts.ex = args[++i] as number; }
      else if (args[i] === 'NX') { opts.nx = true; }
    }
    return (await this.client.set(key, value, opts as Parameters<UpstashRedis['set']>[2])) ?? null;
  }

  async del(key: string): Promise<number> {
    return this.client.del(key);
  }

  async keys(pattern: string): Promise<string[]> {
    return this.client.keys(pattern);
  }

  // Used by @fastify/rate-limit when redis store is configured
  async incr(key: string): Promise<number> { return this.client.incr(key); }
  async expire(key: string, seconds: number): Promise<number> { return this.client.expire(key, seconds); }
  quit(): Promise<void> { return Promise.resolve(); }
}

async function redisPlugin(fastify: FastifyInstance, _opts: FastifyPluginOptions) {
  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    fastify.log.warn('⚠️ Upstash Redis REST credentials missing — caching disabled, using in-process fallback');
    return;
  }

  const adapter = new UpstashAdapter(new UpstashRedis({ url, token }));
  fastify.decorate('redis', adapter);
  fastify.log.info('✅ Upstash Redis connected (REST)');
}

declare module 'fastify' {
  interface FastifyInstance {
    redis: RedisLike;
  }
}

export default fp(redisPlugin);
