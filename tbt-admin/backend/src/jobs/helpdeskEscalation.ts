import { Queue, Worker } from 'bullmq';
import { Redis as IORedis } from 'ioredis';
import type { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';
import { createAdminNotification } from '../lib/adminNotifications.js';
import { logTicketActivity } from '../lib/helpdeskActivityLog.js';

const QUEUE_NAME = 'tbt-helpdesk-escalation';
const JOB_ID = 'helpdesk-escalation-sweep';
// Every 2 minutes — intentionally more frequent than every other job in this
// codebase (which all run hourly-or-slower data-retention sweeps). This one
// is SLA/health-driven: an unacknowledged support ticket sitting for the
// full `escalationMinutes` window before anyone notices is the failure mode
// this whole feature exists to prevent.
const CRON_PATTERN = '*/2 * * * *';

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

async function runEscalationSweep(
  prisma: PrismaClient,
  io: { to: (room: string) => { emit: (event: string, data: unknown) => void } } | null,
  log: { info: (msg: string) => void },
): Promise<void> {
  const settings = await prisma.helpdeskSettings.findFirst({ select: { escalationMinutes: true } });
  const escalationMinutes = settings?.escalationMinutes ?? 10;

  // Tickets still 'new' (unacknowledged — the alarm is still active),
  // past the escalation threshold, not yet escalated. escalated_at guards
  // against re-notifying on every 2-minute sweep for the same ticket.
  const due = await prisma.$queryRawUnsafe<Array<{ id: string; subject: string; name: string; display_number: number | null }>>(
    `SELECT id, subject, name, display_number
       FROM helpdesk_tickets
      WHERE status = 'new'
        AND escalated_at IS NULL
        AND created_at < NOW() - ($1 || ' minutes')::interval`,
    escalationMinutes,
  );

  if (due.length === 0) return;

  const ids = due.map((r) => r.id);
  await prisma.$executeRawUnsafe(
    `UPDATE helpdesk_tickets SET escalated_at = NOW() WHERE id = ANY($1::uuid[])`,
    ids,
  );

  for (const ticket of due) {
    void logTicketActivity(prisma, {
      ticketId: ticket.id,
      actorType: 'system',
      action: 'escalated',
    });
    io?.to('admin').emit('admin:helpdesk_ticket_escalated', {
      ticketId: ticket.id,
      subject: ticket.subject,
      submitterName: ticket.name,
    });
    void createAdminNotification(prisma, {
      title: `⚠️ ESCALATED — Unacknowledged Ticket #TBT-${ticket.display_number ?? ''}`,
      body: `${ticket.name}: ${ticket.subject} has been unacknowledged for ${escalationMinutes}+ minutes.`,
      type: 'helpdesk_ticket_escalated',
      metadata: { ticketId: ticket.id },
    });
  }

  log.info(`[helpdesk-escalation] Escalated ${ids.length} unacknowledged ticket(s)`);
}

export async function startHelpdeskEscalationJob(
  prisma: PrismaClient,
  io: { to: (room: string) => { emit: (event: string, data: unknown) => void } } | null,
  log: { info: (msg: string) => void; warn: (msg: string) => void; error: (obj: unknown, msg: string) => void },
): Promise<void> {
  const redisUrl = env.UPSTASH_REDIS_URL;
  if (!redisUrl) {
    log.warn('[helpdesk-escalation] UPSTASH_REDIS_URL not configured — job not started.');
    return;
  }

  const reachable = await probeRedis(redisUrl);
  if (!reachable) {
    log.warn('[helpdesk-escalation] Upstash TCP unreachable — BullMQ scheduler disabled.');
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
      await runEscalationSweep(prisma, io, log);
    },
    { connection },
  );

  const loggedFor = new Set<string>();
  const errorHandler = (source: string) => (err: unknown) => {
    if (loggedFor.has(source)) return;
    loggedFor.add(source);
    const msg = err instanceof Error ? err.message : String(err);
    log.warn(`[helpdesk-escalation] Redis ${source} error — ${msg}.`);
  };
  queue.on('error', errorHandler('queue'));
  worker.on('error', errorHandler('worker'));

  try {
    await queue.upsertJobScheduler(JOB_ID, { pattern: CRON_PATTERN });
    log.info(`[helpdesk-escalation] Sweep scheduled every 2 minutes (${CRON_PATTERN} UTC)`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn(`[helpdesk-escalation] Could not schedule BullMQ cron — ${msg}.`);
  }
}
