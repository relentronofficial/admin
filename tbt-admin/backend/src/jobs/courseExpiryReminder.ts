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

  const connection = {
    url: redisUrl,
    maxRetriesPerRequest: null as null,
    enableReadyCheck: false,
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

  // Swallow ioredis reconnect noise. When Upstash has intermittent
  // TCP timeouts (a recurring reality — see logs), the underlying
  // ioredis clients on Queue + Worker fire unhandled `error` events
  // every ~30s. Without listeners, Node prints them to stderr and
  // Cloud Run buckets them as ERROR severity, drowning real errors.
  // We downgrade to warn so we still see them if we go looking, but
  // they don't pollute the error stream / alerts.
  //
  // Rate-limited: only log the FIRST error in a 5-minute window per
  // instance so we don't just move the noise from stderr to stdout.
  let lastLoggedAt = 0;
  const errorHandler = (source: string) => (err: unknown) => {
    const now = Date.now();
    if (now - lastLoggedAt > 5 * 60 * 1000) {
      lastLoggedAt = now;
      const msg = err instanceof Error ? err.message : String(err);
      log.warn(`[course-expiry-job] Redis ${source} reconnecting — ${msg}`);
    }
  };
  queue.on('error', errorHandler('queue'));
  worker.on('error', errorHandler('worker'));

  // upsertJobScheduler is idempotent — safe to call on every startup
  queue.upsertJobScheduler(JOB_ID, { pattern: CRON_PATTERN }).then(() => {
    log.info(`[course-expiry-job] Scheduled — daily 08:00 IST (${CRON_PATTERN} UTC)`);
  }).catch((err: any) => {
    log.error({ err }, '[course-expiry-job] Failed to schedule');
  });
}
