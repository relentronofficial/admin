import { Queue, Worker } from 'bullmq';
import { Redis as IORedis } from 'ioredis';
import type { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';
import {
  creditLifelineOrder,
  liveLifelineRazorpayReader,
  type LifelineRazorpayReader,
} from '../lib/lifelineCredit.js';

// Extra Lifeline reconciliation — recovers payments Razorpay captured but no
// one credited (the member closed the browser before /verify finished, verify
// failed, and the webhook was missed or not configured).
//
// Every 15 minutes, a bounded batch of lifeline orders still 'created' and
// older than 10 minutes is CLAIMED (last_checked_at set in one UPDATE … FOR
// UPDATE SKIP LOCKED), so overlapping runs — another instance, a slow previous
// run — never check the same order, and each order is re-checked at most every
// 10 minutes. For each claimed order the payments are listed from Razorpay and
// a captured one is passed to creditLifelineOrder, which re-fetches and checks
// it and credits at most once (shared with verify and the webhook).
// Orders unpaid after 7 days with no captured/authorized payment are marked
// 'expired'; a capture that still arrives later is credited all the same.
//
// Disable with LIFELINE_RECONCILE_DISABLED=true (e.g. local/test). It also
// does not start without Razorpay keys or a reachable Upstash Redis.

const QUEUE_NAME = 'tbt-lifeline-reconcile';
const JOB_ID = 'lifeline-reconcile-sweep';
const CRON_PATTERN = '*/15 * * * *';

export const RECONCILE_MIN_AGE_MINUTES = 10;
export const RECONCILE_RECHECK_MINUTES = 10;
export const RECONCILE_EXPIRE_DAYS = 7;
export const RECONCILE_BATCH_SIZE = 25;
const DELAY_BETWEEN_ORDERS_MS = 300;

const MAX_RETRIES = 5;
const PROBE_TIMEOUT_MS = 5_000;

type Log = { info: (msg: string) => void; warn: (msg: string) => void; error: (obj: unknown, msg: string) => void };

export interface ReconcileSummary {
  claimed: number;
  credited: number;
  alreadyCredited: number;
  pending: number;
  rejected: number;
  expired: number;
  unpaid: number;
  errors: number;
  rateLimited: boolean;
}

const isRateLimited = (err: any) =>
  err?.statusCode === 429 || err?.error?.code === 'TOO_MANY_REQUESTS' || /429|too many requests|rate limit/i.test(String(err?.message ?? err?.error?.description ?? ''));

/** One reconciliation pass. Exported for tests and manual runs. */
export async function runLifelineReconciliation(
  prisma: any,
  rzp: LifelineRazorpayReader,
  log: Log,
  opts: { batchSize?: number; delayMs?: number } = {},
): Promise<ReconcileSummary> {
  const batchSize = opts.batchSize ?? RECONCILE_BATCH_SIZE;
  const delayMs = opts.delayMs ?? DELAY_BETWEEN_ORDERS_MS;
  const summary: ReconcileSummary = {
    claimed: 0, credited: 0, alreadyCredited: 0, pending: 0, rejected: 0, expired: 0, unpaid: 0, errors: 0, rateLimited: false,
  };

  // Claim a bounded batch atomically; SKIP LOCKED keeps concurrent runs on disjoint orders.
  const claimed: Array<{ orderId: string; ageDays: number }> = await prisma.$queryRawUnsafe(
    `UPDATE lifeline_razorpay_orders SET last_checked_at = NOW()
     WHERE order_id IN (
       SELECT order_id FROM lifeline_razorpay_orders
       WHERE status = 'created'
         AND created_at < NOW() - make_interval(mins => $1::int)
         AND (last_checked_at IS NULL OR last_checked_at < NOW() - make_interval(mins => $2::int))
       ORDER BY last_checked_at NULLS FIRST, created_at
       LIMIT $3::int
       FOR UPDATE SKIP LOCKED
     )
     RETURNING order_id AS "orderId", EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400 AS "ageDays"`,
    RECONCILE_MIN_AGE_MINUTES, RECONCILE_RECHECK_MINUTES, batchSize,
  );
  summary.claimed = claimed.length;

  for (let i = 0; i < claimed.length; i++) {
    if (i > 0 && delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    const { orderId } = claimed[i];
    const ageDays = Number(claimed[i].ageDays);

    let payments: any[];
    try {
      payments = await rzp.fetchOrderPayments(orderId);
    } catch (err) {
      summary.errors += 1;
      if (isRateLimited(err)) {
        // Stop this pass; the remaining claimed orders are retried after the re-check window.
        summary.rateLimited = true;
        break;
      }
      continue;
    }

    const captured = payments.filter((p) => p?.status === 'captured' && typeof p?.id === 'string');
    if (captured.length > 0) {
      if (captured.length > 1) log.warn(`[lifeline-reconcile] order has ${captured.length} captured payments — refund review needed`);
      const outcome = await creditLifelineOrder(prisma, rzp, { orderId, paymentId: captured[0].id });
      if (outcome.kind === 'credited') summary.credited += 1;
      else if (outcome.kind === 'already') summary.alreadyCredited += 1;
      else if (outcome.kind === 'pending') summary.pending += 1;
      else if (outcome.kind === 'rejected') {
        summary.rejected += 1;
        log.warn(`[lifeline-reconcile] captured payment not credited: ${outcome.code}`);
      } else summary.errors += 1;
      continue;
    }

    const inFlight = payments.some((p) => p?.status === 'authorized' || p?.status === 'created');
    if (inFlight) {
      summary.pending += 1;
      continue;
    }
    if (ageDays >= RECONCILE_EXPIRE_DAYS) {
      try {
        const n = await prisma.$executeRawUnsafe(
          `UPDATE lifeline_razorpay_orders SET status = 'expired' WHERE order_id = $1 AND status = 'created'`,
          orderId,
        );
        if (Number(n) > 0) summary.expired += 1;
      } catch {
        summary.errors += 1;
      }
      continue;
    }
    summary.unpaid += 1;
  }

  if (summary.claimed > 0) {
    log.info(
      `[lifeline-reconcile] checked ${summary.claimed}: credited ${summary.credited}, already ${summary.alreadyCredited}, ` +
      `pending ${summary.pending}, rejected ${summary.rejected}, expired ${summary.expired}, unpaid ${summary.unpaid}, ` +
      `errors ${summary.errors}${summary.rateLimited ? ' (rate limited — stopped early)' : ''}`,
    );
  }
  return summary;
}

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

export async function startLifelineReconcileJob(prisma: PrismaClient, log: Log): Promise<void> {
  if (env.LIFELINE_RECONCILE_DISABLED === 'true') {
    log.info('[lifeline-reconcile] LIFELINE_RECONCILE_DISABLED=true — job not started.');
    return;
  }
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    log.warn('[lifeline-reconcile] Razorpay not configured — job not started.');
    return;
  }
  const redisUrl = env.UPSTASH_REDIS_URL;
  if (!redisUrl) {
    log.warn('[lifeline-reconcile] UPSTASH_REDIS_URL not configured — job not started.');
    return;
  }
  if (!(await probeRedis(redisUrl))) {
    log.warn('[lifeline-reconcile] Upstash TCP unreachable — BullMQ scheduler disabled.');
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
  // concurrency 1 per instance; across instances the DB claim keeps orders disjoint.
  const worker = new Worker(
    QUEUE_NAME,
    async () => {
      try {
        await runLifelineReconciliation(prisma, liveLifelineRazorpayReader, log);
      } catch (err) {
        log.error({ err: err instanceof Error ? err.message : String(err) }, '[lifeline-reconcile] pass failed');
      }
    },
    { connection, concurrency: 1 },
  );

  const loggedFor = new Set<string>();
  const errorHandler = (source: string) => (err: unknown) => {
    if (loggedFor.has(source)) return;
    loggedFor.add(source);
    const msg = err instanceof Error ? err.message : String(err);
    log.warn(`[lifeline-reconcile] Redis ${source} error — ${msg}.`);
  };
  queue.on('error', errorHandler('queue'));
  worker.on('error', errorHandler('worker'));

  try {
    await queue.upsertJobScheduler(JOB_ID, { pattern: CRON_PATTERN });
    log.info(`[lifeline-reconcile] Sweep scheduled (${CRON_PATTERN} UTC)`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn(`[lifeline-reconcile] Could not schedule BullMQ cron — ${msg}.`);
  }
}
