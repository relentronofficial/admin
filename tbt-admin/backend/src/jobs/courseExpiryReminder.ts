import { Queue, Worker } from 'bullmq';
import type { PrismaClient } from '@prisma/client';
import { sendWhatsappMessage } from '../lib/whatsapp.js';
import { env } from '../config/env.js';

const QUEUE_NAME = 'tbt-cron';
const JOB_ID = 'course-expiry-reminder';

// 08:00 IST = 02:30 UTC
const CRON_PATTERN = '30 2 * * *';

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

export function startCourseExpiryReminderJob(prisma: PrismaClient, log: { info: (msg: string) => void; warn: (msg: string) => void; error: (obj: unknown, msg: string) => void }): void {
  const redisUrl = env.UPSTASH_REDIS_URL;
  if (!redisUrl) {
    log.warn('[course-expiry-job] UPSTASH_REDIS_URL not configured — job not started');
    return;
  }

  // Cap reconnect attempts. Upstash's TCP endpoint is regularly
  // unreachable from Cloud Run asia-south1 (ETIMEDOUT). Without a
  // cap, ioredis retries forever on a ~30s cadence and spams logs.
  // After MAX_RETRIES failed attempts we return null → ioredis
  // stops trying and emits a single `end` event. The daily cron
  // won't fire from this instance, but the identical work is
  // reachable via POST /api/cron/course-expiry-reminder (Cloud
  // Scheduler / external trigger), so nothing is silently lost.
  const MAX_RETRIES = 5;
  const connection = {
    url: redisUrl,
    maxRetriesPerRequest: null as null, // required by BullMQ for blocking commands
    enableReadyCheck: false,
    retryStrategy: (times: number) => {
      if (times > MAX_RETRIES) return null; // give up
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

  // Attach error listeners so ioredis errors don't become unhandled
  // stderr writes (which Cloud Run would bucket as ERROR severity).
  // Log at most once per source; further errors during the retry
  // window are silent, and after the retry cap the connection ends
  // altogether.
  const loggedFor = new Set<string>();
  const errorHandler = (source: string) => (err: unknown) => {
    if (loggedFor.has(source)) return;
    loggedFor.add(source);
    const msg = err instanceof Error ? err.message : String(err);
    log.warn(`[course-expiry-job] Redis ${source} unreachable — ${msg}. Falling back to HTTP cron endpoint.`);
  };
  queue.on('error', errorHandler('queue'));
  worker.on('error', errorHandler('worker'));

  // upsertJobScheduler is idempotent — safe to call on every startup.
  // Wrapped so a Redis outage during startup doesn't crash the server.
  queue.upsertJobScheduler(JOB_ID, { pattern: CRON_PATTERN }).then(() => {
    log.info(`[course-expiry-job] Scheduled — daily 08:00 IST (${CRON_PATTERN} UTC)`);
  }).catch((err: any) => {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn(`[course-expiry-job] Could not schedule BullMQ cron — ${msg}. Use POST /api/cron/course-expiry-reminder instead.`);
  });
}
