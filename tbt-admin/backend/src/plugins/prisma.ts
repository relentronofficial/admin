import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import fp from 'fastify-plugin';
import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';

function buildDatasourceUrl(raw: string): string {
  try {
    const url = new URL(raw);
    if (!url.searchParams.has('connection_limit')) url.searchParams.set('connection_limit', '15');
    if (!url.searchParams.has('pool_timeout')) url.searchParams.set('pool_timeout', '30');
    return url.toString();
  } catch {
    return raw;
  }
}

async function prismaPlugin(fastify: FastifyInstance, opts: FastifyPluginOptions) {
  const prisma = new PrismaClient({
    datasources: { db: { url: buildDatasourceUrl(env.DATABASE_URL) } },
  });

  try {
    await prisma.$connect();
    fastify.log.info('✅ Database connected');
    // Idempotent enum migration — adds 'pending' to MemberStatus if not already present.
    // Safe to run on every startup; PostgreSQL ignores it when the value already exists.
    await prisma.$executeRawUnsafe(`ALTER TYPE "MemberStatus" ADD VALUE IF NOT EXISTS 'pending'`);
    // Idempotent column additions for Product e-commerce fields
    await prisma.$executeRawUnsafe(`ALTER TABLE products ADD COLUMN IF NOT EXISTS price DECIMAL(10,2)`);
    await prisma.$executeRawUnsafe(`ALTER TABLE products ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NOT NULL DEFAULT 'INR'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE products ADD COLUMN IF NOT EXISTS category VARCHAR(100)`);
    await prisma.$executeRawUnsafe(`ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_status VARCHAR(50) NOT NULL DEFAULT 'in_stock'`);
    // Watched segments bitmask column — stores JSON array of 10s segment indices actually watched
    await prisma.$executeRawUnsafe(`ALTER TABLE member_episode_progress ADD COLUMN IF NOT EXISTS watched_segments TEXT`);
    // Assignment type (qa vs image_upload) and image submission support
    await prisma.$executeRawUnsafe(`ALTER TABLE assignments ADD COLUMN IF NOT EXISTS assignment_type VARCHAR(50) NOT NULL DEFAULT 'qa'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE assignments ALTER COLUMN question_text DROP NOT NULL`);
    await prisma.$executeRawUnsafe(`ALTER TABLE assignment_submissions ALTER COLUMN answer_text DROP NOT NULL`);
    await prisma.$executeRawUnsafe(`ALTER TABLE assignment_submissions ADD COLUMN IF NOT EXISTS image_url TEXT`);
    // Product inquiries table — idempotent, safe on every startup
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS product_inquiries (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        member_id  UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        message    TEXT,
        status     VARCHAR(50) NOT NULL DEFAULT 'pending',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    // Batch program nav item — insert only if /batch-program link doesn't exist yet
    await prisma.$executeRawUnsafe(`
      INSERT INTO nav_items (id, label, href, "order", is_visible, created_at, updated_at)
      SELECT gen_random_uuid(), 'Task', '/batch-program',
             COALESCE((SELECT MAX("order") FROM nav_items), 0) + 1,
             true, NOW(), NOW()
      WHERE NOT EXISTS (SELECT 1 FROM nav_items WHERE href = '/batch-program')
    `);
  } catch (err) {
    // Non-fatal: allow instance to start and connect lazily on first query.
    // This prevents deployment deadlocks when the DB connection pool is full
    // (e.g. during rolling deployments where old instances still hold all slots).
    fastify.log.warn('⚠️ DB connect on startup failed — will retry on first query:', err as any);
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
