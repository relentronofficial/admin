import { Queue, Worker } from 'bullmq';
import { Redis as IORedis } from 'ioredis';
import type { PrismaClient } from '@prisma/client';
import { sendWhatsappMessage } from '../lib/whatsapp.js';
import { env } from '../config/env.js';

const QUEUE_NAME = 'tbt-cron';
const JOB_ID = 'course-expiry-reminder';

// 08:00 IST = 02:30 UTC
const CRON_PATTERN = '30 2 * * *';

// If Upstash TCP is unreachable we don't want ioredis to keep trying
// forever. 5 quick attempts, then give up and return null from
// retryStrategy so ioredis emits `end` and the connection dies.
const MAX_RETRIES = 5;

// How long to wait for the initial probe connect before giving up.
const PROBE_TIMEOUT_MS = 5_000;

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export async function runCourseExpiryReminder(prisma: PrismaClient): Promise<void> {
  const now = new Date();
  const cutoff = addDays(now, 3);

  const expiring = await (prisma as any).courseAccess.findMany({
    where: {
      isActive: true,
      accessType: 'duration',
      expiresAt: { gte: now, lte: cutoff },
    },
    include: {
      member: { select: { phone: true, firstName: true } },
      course: { select: { title: true } },
    },
  }) as Array<{ expiresAt: Date; member: { phone: string | null; firstName: string | null }; course: { title: string } }>;

  let sent = 0;
  for (const record of expiring) {
    const { phone, firstName } = record.member;
    if (!phone) continue;
    const expiresOn = new Date(record.expiresAt).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
    const message = `Hi ${firstName ?? 'there'}, your access to "${record.course.title}" expires on ${expiresOn}. Renew now to keep learning!`;
    const ok = await sendWhatsappMessage(phone, message).catch(() => false);
    if (ok) sent++;
  }

  console.info(`[course-expiry-job] Processed ${expiring.length} records — sent ${sent} WhatsApp reminders`);
}

// Only counts as "installed" once at process level. Guards against
// stacking the same handler on hot-reload in dev.
let unhandledRejectionInstalled = false;

function installUnhandledRejectionSwallow(log: { warn: (msg: string) => void }): void {
  if (unhandledRejectionInstalled) return;
  unhandledRejectionInstalled = true;
  process.on('unhandledRejection', (reason) => {
    const err = reason as { message?: unknown; code?: unknown; stack?: unknown } | null;
    const message = typeof err?.message === 'string' ? err.message : String(reason);
    const stack = typeof err?.stack === 'string' ? err.stack : '';
    const code = typeof err?.code === 'string' ? err.code : '';
    const looksLikeIoredis =
      stack.includes('ioredis') ||
      code === 'ETIMEDOUT' ||
      code === 'ECONNREFUSED' ||
      code === 'ENOTFOUND' ||
      message.includes('connect ETIMEDOUT') ||
      message.includes('Command timed out');
    if (looksLikeIoredis) {
      // Downgrade to warn — nothing to do about a dead ioredis socket
      // that has already been abandoned; the daily HTTP cron endpoint
      // covers the same work.
      log.warn(`[course-expiry-job] Ignored stray ioredis rejection — ${message}`);
      return;
    }
    // Not ours — re-throw so the platform's real handler still sees it.
    throw reason;
  });
}

async function probeRedis(redisUrl: string): Promise<boolean> {
  const probe = new IORedis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    connectTimeout: PROBE_TIMEOUT_MS,
    retryStrategy: () => null, // one shot only
    ...(redisUrl.startsWith('rediss://') ? { tls: {} } : {}),
  });
  probe.on('error', () => { /* swallow — we care only about the connect result */ });
  try {
    await Promise.race([
      probe.connect(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('probe timeout')), PROBE_TIMEOUT_MS),
      ),
    ]);
    return true;
  } catch {
    return false;
  } finally {
    probe.disconnect();
  }
}

export async function startCourseExpiryReminderJob(
  prisma: PrismaClient,
  log: { info: (msg: string) => void; warn: (msg: string) => void; error: (obj: unknown, msg: string) => void },
): Promise<void> {
  const redisUrl = env.UPSTASH_REDIS_URL;
  if (!redisUrl) {
    log.warn('[course-expiry-job] UPSTASH_REDIS_URL not configured — job not started');
    return;
  }

  installUnhandledRejectionSwallow(log);

  // Probe Upstash TCP before we build the Queue/Worker. Once BullMQ
  // constructs a Worker it fires internal blocking commands
  // (BRPOPLPUSH etc.) that can reject asynchronously if the socket
  // dies mid-flight, and those rejections bypass our `.on('error')`
  // handlers. If we can't reach Upstash at all, don't even build
  // the objects.
  const reachable = await probeRedis(redisUrl);
  if (!reachable) {
    log.warn(
      `[course-expiry-job] Upstash TCP unreachable at startup — BullMQ scheduler disabled. Use POST /api/cron/course-expiry-reminder instead.`,
    );
    return;
  }

  const connection = {
    url: redisUrl,
    maxRetriesPerRequest: null as null, // required by BullMQ for blocking commands
    enableReadyCheck: false,
    retryStrategy: (times: number) => {
      if (times > MAX_RETRIES) return null;
      return Math.min(times * 500, 3000);
    },
    reconnectOnError: () => false,
    ...(redisUrl.startsWith('rediss://') ? { tls: {} } : {}),
  };

  const queue = new Queue(QUEUE_NAME, { connection });
  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      if (job.name === JOB_ID) {
        await runCourseExpiryReminder(prisma);
      }
    },
    { connection },
  );

  const loggedFor = new Set<string>();
  const errorHandler = (source: string) => (err: unknown) => {
    if (loggedFor.has(source)) return;
    loggedFor.add(source);
    const msg = err instanceof Error ? err.message : String(err);
    log.warn(`[course-expiry-job] Redis ${source} error — ${msg}. Falling back to HTTP cron endpoint.`);
  };
  queue.on('error', errorHandler('queue'));
  worker.on('error', errorHandler('worker'));

  try {
    await queue.upsertJobScheduler(JOB_ID, { pattern: CRON_PATTERN });
    log.info(`[course-expiry-job] Scheduled — daily 08:00 IST (${CRON_PATTERN} UTC)`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn(`[course-expiry-job] Could not schedule BullMQ cron — ${msg}. Use POST /api/cron/course-expiry-reminder instead.`);
  }
}
