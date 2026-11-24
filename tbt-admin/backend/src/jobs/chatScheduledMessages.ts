/**
 * Sends admin-scheduled group-chat messages when they fall due.
 *
 * Every 30 s each backend instance looks for active schedules whose
 * next_run_at has come. Before posting, it claims the row with a
 * conditional UPDATE on (id, status, next_run_at): only one instance can win
 * that update, so a run is never posted twice even with several Cloud Run
 * instances. Claiming before posting means a crash mid-send loses that one
 * run rather than repeating it.
 *
 * No Redis needed. Rules (grace period, next day, end date) are in
 * lib/chatScheduleLogic.ts.
 */

import type { FastifyInstance } from 'fastify';
import { decideDueRun, ruleFromRow, type ScheduleType } from '../lib/chatScheduleLogic.js';
import { postAdminGroupMessage } from '../modules/chat-groups/controller.js';
import { SCHEDULED_COLUMNS, syncRelativeSchedules, type ScheduledRow } from '../modules/chat-groups/scheduled.controller.js';

const INTERVAL_MS = 30_000;
const BATCH = 25;

type DueRow = ScheduledRow & { group_deleted: boolean | null };

export async function runDueChatScheduledMessages(fastify: FastifyInstance, now = new Date()): Promise<number> {
  const prisma = fastify.prisma;
  // Batch start dates may have moved since the last sweep — re-time first.
  await syncRelativeSchedules(prisma, now);
  const due = await prisma.$queryRawUnsafe<DueRow[]>(
    `SELECT ${SCHEDULED_COLUMNS}, (g.id IS NULL OR g.is_deleted) AS group_deleted
     FROM chat_group_scheduled_messages s
     LEFT JOIN chat_groups g ON g.id = s.group_id
     WHERE s.status = 'active' AND s.next_run_at IS NOT NULL AND s.next_run_at <= $1::timestamptz
     ORDER BY s.next_run_at ASC
     LIMIT ${BATCH}`,
    now,
  );

  let sent = 0;
  for (const row of due) {
    const runAt = new Date(row.next_run_at!);

    if (row.group_deleted) {
      await prisma.$executeRawUnsafe(
        `UPDATE chat_group_scheduled_messages
         SET status = 'cancelled', next_run_at = NULL, last_error = 'The group was deleted.', updated_at = NOW()
         WHERE id = $1::uuid AND status = 'active'`,
        row.id,
      );
      continue;
    }

    const decision = decideDueRun(
      {
        scheduleType: row.schedule_type as ScheduleType,
        nextRunAt: runAt,
        recurring: ruleFromRow(row.schedule_type, row.start_date, row.time_of_day, row.end_date),
      },
      now,
    );
    const status = decision.nextRunAt
      ? 'active'
      : decision.send ? 'completed' : row.schedule_type === 'once' || row.schedule_type === 'relative' ? 'missed' : 'completed';

    // Claim: only the instance whose UPDATE matches the run it read posts it.
    const claimed = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `UPDATE chat_group_scheduled_messages
       SET next_run_at = $3::timestamptz, status = $4, updated_at = NOW()
       WHERE id = $1::uuid AND status = 'active' AND next_run_at = $2::timestamptz
       RETURNING id`,
      row.id,
      runAt,
      decision.nextRunAt,
      status,
    );
    if (claimed.length === 0) continue;

    if (!decision.send) {
      await prisma.$executeRawUnsafe(
        `UPDATE chat_group_scheduled_messages SET last_error = $2 WHERE id = $1::uuid`,
        row.id,
        `Skipped the run due ${runAt.toISOString()} — the server was unavailable at that time.`,
      );
      fastify.log.warn(`[chat-scheduled] skipped missed run ${row.id} due ${runAt.toISOString()}`);
      continue;
    }

    try {
      const messageId = await postAdminGroupMessage(fastify, {
        groupId: row.group_id,
        adminId: row.created_by_admin_id,
        body: row.body,
      });
      await prisma.$executeRawUnsafe(
        `UPDATE chat_group_scheduled_messages
         SET sent_count = sent_count + 1, last_sent_at = NOW(), last_message_id = $2::uuid, last_error = NULL
         WHERE id = $1::uuid`,
        row.id,
        messageId,
      );
      sent++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      fastify.log.error({ err }, `[chat-scheduled] failed to post scheduled message ${row.id}`);
      await prisma.$executeRawUnsafe(
        `UPDATE chat_group_scheduled_messages SET last_error = $2 WHERE id = $1::uuid`,
        row.id,
        `Sending failed: ${msg.slice(0, 300)}`,
      ).catch(() => {});
    }
  }
  return sent;
}

export function startChatScheduledMessagesJob(fastify: FastifyInstance): void {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const sent = await runDueChatScheduledMessages(fastify);
      if (sent > 0) fastify.log.info(`[chat-scheduled] posted ${sent} scheduled message(s)`);
    } catch (err) {
      fastify.log.warn({ err }, '[chat-scheduled] sweep failed');
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => void tick(), INTERVAL_MS);
  timer.unref?.();
  setTimeout(() => void tick(), 5_000).unref?.();
  fastify.log.info(`[chat-scheduled] sweep every ${INTERVAL_MS / 1000}s`);
}
