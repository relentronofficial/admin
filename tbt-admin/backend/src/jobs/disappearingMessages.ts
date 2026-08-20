import { Queue, Worker } from 'bullmq';
import { Redis as IORedis } from 'ioredis';
import type { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';

const QUEUE_NAME = 'tbt-disappearing-messages';
const JOB_ID = 'disappearing-messages-sweep';
// Every hour
const CRON_PATTERN = '0 * * * *';

const MAX_RETRIES = 5;
const PROBE_TIMEOUT_MS = 5_000;

async function probeRedis(redisUrl: string): Promise<boolean> {
  const probe = new IORedis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    connectTimeout: PROBE_TIMEOUT_MS,
    retryStrategy: () => null,
    ...(redisUrl.startsWith('rediss://') ? { tls: {} } : {}),
  });
  probe.on('error', () => { /* swallow */ });
  try {
    await Promise.race([
      probe.connect(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('probe timeout')), PROBE_TIMEOUT_MS)),
    ]);
    return true;
  } catch {
    return false;
  } finally {
    probe.disconnect();
  }
}

async function runDisappearingSweep(
  prisma: PrismaClient,
  io: { to: (room: string) => { emit: (event: string, data: unknown) => void } } | null,
  log: { info: (msg: string) => void },
): Promise<void> {
  // Find messages in disappearing-enabled groups that are past their TTL
  const expired = await prisma.$queryRawUnsafe<Array<{ id: string; group_id: string }>>(
    `SELECT m.id, m.group_id
     FROM chat_group_messages m
     JOIN chat_groups g ON g.id = m.group_id
     WHERE g.disappearing_duration_seconds IS NOT NULL
       AND m.deleted_for_everyone = false
       AND m.deleted_at IS NULL
       AND m.created_at < NOW() - (g.disappearing_duration_seconds || ' seconds')::interval`,
  );

  if (expired.length === 0) return;

  const ids = expired.map((r) => r.id);
  await prisma.$executeRawUnsafe(
    `UPDATE chat_group_messages
     SET deleted_for_everyone = true, deleted_at = NOW()
     WHERE id = ANY($1::uuid[])`,
    ids,
  );

  if (io) {
    // Group by groupId so we emit one event per group with all affected ids
    const byGroup = new Map<string, string[]>();
    for (const r of expired) {
      const arr = byGroup.get(r.group_id) ?? [];
      arr.push(r.id);
      byGroup.set(r.group_id, arr);
    }
    for (const [groupId, messageIds] of byGroup) {
      for (const messageId of messageIds) {
        io.to(`group:${groupId}`).emit('group:message:deleted', { groupId, messageId, forEveryone: true });
      }
    }
  }

  log.info(`[disappearing-messages] Swept ${ids.length} expired message(s)`);
}

export async function startDisappearingMessagesJob(
  prisma: PrismaClient,
  io: { to: (room: string) => { emit: (event: string, data: unknown) => void } } | null,
  log: { info: (msg: string) => void; warn: (msg: string) => void; error: (obj: unknown, msg: string) => void },
): Promise<void> {
  const redisUrl = env.UPSTASH_REDIS_URL;
  if (!redisUrl) {
    log.warn('[disappearing-messages] UPSTASH_REDIS_URL not configured — job not started.');
    return;
  }

  const reachable = await probeRedis(redisUrl);
  if (!reachable) {
    log.warn('[disappearing-messages] Upstash TCP unreachable — BullMQ scheduler disabled.');
    return;
  }

  const connection = {
    url: redisUrl,
    maxRetriesPerRequest: null as null,
    enableReadyCheck: false,
    retryStrategy: (times: number) => {
      if (times > MAX_RETRIES) return null;
      return Math.min(times * 500, 3_000);
    },
    reconnectOnError: () => false,
    ...(redisUrl.startsWith('rediss://') ? { tls: {} } : {}),
  };

  const queue = new Queue(QUEUE_NAME, { connection });
  const worker = new Worker(
    QUEUE_NAME,
    async () => {
      await runDisappearingSweep(prisma, io, log);
    },
    { connection },
  );

  const loggedFor = new Set<string>();
  const errorHandler = (source: string) => (err: unknown) => {
    if (loggedFor.has(source)) return;
    loggedFor.add(source);
    const msg = err instanceof Error ? err.message : String(err);
    log.warn(`[disappearing-messages] Redis ${source} error — ${msg}.`);
  };
  queue.on('error', errorHandler('queue'));
  worker.on('error', errorHandler('worker'));

  try {
    await queue.upsertJobScheduler(JOB_ID, { pattern: CRON_PATTERN });
    log.info(`[disappearing-messages] Hourly sweep scheduled (${CRON_PATTERN} UTC)`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn(`[disappearing-messages] Could not schedule BullMQ cron — ${msg}.`);
  }
}
