import { Queue, Worker } from 'bullmq';
import { Redis as IORedis } from 'ioredis';
import type { PrismaClient } from '@prisma/client';
import { runMonthlyReports, runWeeklyReports } from '../lib/batchReports.js';
import { env } from '../config/env.js';

// Own queue name, distinct from 'tbt-cron' (courseExpiryReminder.ts) — keeps
// this job's connection/error-handling fully independent so a problem here
// can never affect the working course-expiry job, and vice versa.
const QUEUE_NAME = 'tbt-batch-reports';
const WEEKLY_JOB_ID = 'weekly-report';
const MONTHLY_JOB_ID = 'monthly-report';

// Weekly: Sunday 21:30 IST = 16:00 UTC — end of week.
const WEEKLY_CRON_PATTERN = '0 16 * * 0';
// Monthly: cron syntax can't express "last day of month" directly, so this
// fires daily at 21:00 IST = 15:30 UTC and runMonthlyReports() itself no-ops
// on every day except the last day of the (IST) month.
const MONTHLY_CRON_PATTERN = '30 15 * * *';

// Same shape as jobs/courseExpiryReminder.ts — see that file for the
// reasoning behind the retry/probe limits.
const MAX_RETRIES = 5;
const PROBE_TIMEOUT_MS = 5_000;

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
      log.warn(`[batch-reports-job] Ignored stray ioredis rejection — ${message}`);
      return;
    }
    throw reason;
  });
}

async function probeRedis(redisUrl: string): Promise<boolean> {
  const probe = new IORedis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    connectTimeout: PROBE_TIMEOUT_MS,
    retryStrategy: () => null,
    ...(redisUrl.startsWith('rediss://') ? { tls: {} } : {}),
  });
  probe.on('error', () => { /* swallow — we care only about the connect result */ });
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

export async function startBatchReportJobs(
  prisma: PrismaClient,
  log: { info: (msg: string) => void; warn: (msg: string) => void; error: (obj: unknown, msg: string) => void },
): Promise<void> {
  const redisUrl = env.UPSTASH_REDIS_URL;
  if (!redisUrl) {
    log.warn('[batch-reports-job] UPSTASH_REDIS_URL not configured — job not started. Use POST /api/cron/weekly-report and /api/cron/monthly-report instead.');
    return;
  }

  installUnhandledRejectionSwallow(log);

  const reachable = await probeRedis(redisUrl);
  if (!reachable) {
    log.warn('[batch-reports-job] Upstash TCP unreachable at startup — BullMQ scheduler disabled. Use POST /api/cron/weekly-report and /api/cron/monthly-report instead.');
    return;
  }

  const connection = {
    url: redisUrl,
    maxRetriesPerRequest: null as null,
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
      if (job.name === WEEKLY_JOB_ID) {
        const result = await runWeeklyReports(prisma);
        log.info(`[batch-reports-job] weekly-report — sent=${result.sent} failed=${result.failed} skipped=${result.skipped} total=${result.total}`);
      } else if (job.name === MONTHLY_JOB_ID) {
        const result = await runMonthlyReports(prisma);
        if (result.ranToday) {
          log.info(`[batch-reports-job] monthly-report — sent=${result.sent} failed=${result.failed} skipped=${result.skipped} total=${result.total}`);
        }
      }
    },
    { connection },
  );

  const loggedFor = new Set<string>();
  const errorHandler = (source: string) => (err: unknown) => {
    if (loggedFor.has(source)) return;
    loggedFor.add(source);
    const msg = err instanceof Error ? err.message : String(err);
    log.warn(`[batch-reports-job] Redis ${source} error — ${msg}. Falling back to HTTP cron endpoints.`);
  };
  queue.on('error', errorHandler('queue'));
  worker.on('error', errorHandler('worker'));

  try {
    await queue.upsertJobScheduler(WEEKLY_JOB_ID, { pattern: WEEKLY_CRON_PATTERN });
    await queue.upsertJobScheduler(MONTHLY_JOB_ID, { pattern: MONTHLY_CRON_PATTERN });
    log.info(`[batch-reports-job] Scheduled — weekly Sun 21:30 IST (${WEEKLY_CRON_PATTERN} UTC), monthly daily-checked 21:00 IST (${MONTHLY_CRON_PATTERN} UTC)`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn(`[batch-reports-job] Could not schedule BullMQ cron — ${msg}. Use POST /api/cron/weekly-report and /api/cron/monthly-report instead.`);
  }
}
