/**
 * Admin-scheduled group-chat messages — `/api/chat-groups/admin/:id/scheduled-messages`.
 *
 * An admin schedules a text message for a group, either once (a date + time)
 * or daily (a time every day from a start date, optionally until an end
 * date). Times are IST. jobs/chatScheduledMessages.ts posts them when due;
 * the rules live in lib/chatScheduleLogic.ts.
 *
 * Table `chat_group_scheduled_messages` (raw SQL, created in plugins/prisma.ts).
 * status: active | paused | completed | missed | cancelled
 */

import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  istDateOf,
  istTimeOf,
  resumeNextRun,
  validateScheduleInput,
  type ScheduleInput,
  type ScheduleType,
} from '../../lib/chatScheduleLogic.js';

export interface ScheduledRow {
  id: string;
  group_id: string;
  body: string;
  schedule_type: ScheduleType;
  send_at: Date | null;
  start_date: string | null;
  time_of_day: string | null;
  end_date: string | null;
  next_run_at: Date | null;
  status: string;
  created_by_admin_id: string | null;
  created_by_name?: string | null;
  sent_count: number;
  last_sent_at: Date | null;
  last_error: string | null;
  created_at: Date;
  updated_at: Date;
}

export const SCHEDULED_COLUMNS = `
  s.id, s.group_id, s.body, s.schedule_type, s.send_at,
  to_char(s.start_date, 'YYYY-MM-DD') AS start_date,
  s.time_of_day,
  to_char(s.end_date, 'YYYY-MM-DD') AS end_date,
  s.next_run_at, s.status, s.created_by_admin_id, s.sent_count,
  s.last_sent_at, s.last_error, s.created_at, s.updated_at`;

function ok<T>(reply: FastifyReply, data: T) {
  return reply.send({ success: true, data, error: null });
}

function fail(reply: FastifyReply, status: number, code: string, message: string) {
  return reply.status(status).send({ success: false, data: null, error: { code, message } });
}

function toJson(r: ScheduledRow) {
  const once = r.schedule_type === 'once';
  return {
    id: r.id,
    groupId: r.group_id,
    body: r.body,
    scheduleType: r.schedule_type,
    /** IST date: the send date (once) or the start date (daily). */
    date: once ? (r.send_at ? istDateOf(new Date(r.send_at)) : null) : r.start_date,
    /** IST time HH:MM. */
    time: once ? (r.send_at ? istTimeOf(new Date(r.send_at)) : null) : r.time_of_day,
    endDate: once ? null : r.end_date,
    sendAt: r.send_at,
    nextRunAt: r.status === 'active' || r.status === 'paused' ? r.next_run_at : null,
    status: r.status,
    sentCount: Number(r.sent_count) || 0,
    lastSentAt: r.last_sent_at,
    lastError: r.last_error,
    createdBy: r.created_by_name ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

async function loadOne(req: FastifyRequest, groupId: string, scheduleId: string): Promise<ScheduledRow | null> {
  const rows = await req.server.prisma.$queryRawUnsafe<ScheduledRow[]>(
    `SELECT ${SCHEDULED_COLUMNS}, a.full_name AS created_by_name
     FROM chat_group_scheduled_messages s
     LEFT JOIN admins a ON a.id = s.created_by_admin_id
     WHERE s.id = $1::uuid AND s.group_id = $2::uuid`,
    scheduleId,
    groupId,
  );
  return rows[0] ?? null;
}

async function groupIsLive(req: FastifyRequest, groupId: string): Promise<boolean> {
  const rows = await req.server.prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT id FROM chat_groups WHERE id = $1::uuid AND is_deleted = false`,
    groupId,
  );
  return rows.length > 0;
}

export async function adminListScheduledHandler(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const rows = await req.server.prisma.$queryRawUnsafe<ScheduledRow[]>(
    `SELECT ${SCHEDULED_COLUMNS}, a.full_name AS created_by_name
     FROM chat_group_scheduled_messages s
     LEFT JOIN admins a ON a.id = s.created_by_admin_id
     WHERE s.group_id = $1::uuid
     ORDER BY (s.status = 'active') DESC, (s.status = 'paused') DESC,
              s.next_run_at ASC NULLS LAST, s.created_at DESC`,
    req.params.id,
  );
  return ok(reply, rows.map(toJson));
}

export async function adminCreateScheduledHandler(
  req: FastifyRequest<{ Params: { id: string }; Body: ScheduleInput }>,
  reply: FastifyReply,
) {
  const groupId = req.params.id;
  if (!(await groupIsLive(req, groupId))) return fail(reply, 404, 'NOT_FOUND', 'Group not found.');
  const v = validateScheduleInput(req.body ?? {}, new Date());
  if (!v.ok) return fail(reply, 400, 'BAD_REQUEST', v.error);

  const admin = await req.server.prisma.admin.findFirst({
    where: { clerkId: (req as any).user as string },
    select: { id: true },
  });
  const s = v.value;
  const inserted = await req.server.prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `INSERT INTO chat_group_scheduled_messages
       (group_id, body, schedule_type, send_at, start_date, time_of_day, end_date, next_run_at, status, created_by_admin_id)
     VALUES ($1::uuid, $2, $3, $4::timestamptz, $5::date, $6, $7::date, $8::timestamptz, 'active', $9::uuid)
     RETURNING id`,
    groupId,
    s.body,
    s.scheduleType,
    s.sendAt,
    s.daily?.startDate ?? null,
    s.daily?.timeOfDay ?? null,
    s.daily?.endDate ?? null,
    s.nextRunAt,
    admin?.id ?? null,
  );
  const row = await loadOne(req, groupId, inserted[0].id);
  return ok(reply, row ? toJson(row) : null);
}

export async function adminUpdateScheduledHandler(
  req: FastifyRequest<{ Params: { id: string; scheduleId: string }; Body: ScheduleInput }>,
  reply: FastifyReply,
) {
  const { id: groupId, scheduleId } = req.params;
  const existing = await loadOne(req, groupId, scheduleId);
  if (!existing) return fail(reply, 404, 'NOT_FOUND', 'Scheduled message not found.');
  if (existing.status === 'cancelled') return fail(reply, 409, 'CANCELLED', 'This schedule was cancelled because its group was deleted.');
  const v = validateScheduleInput(req.body ?? {}, new Date());
  if (!v.ok) return fail(reply, 400, 'BAD_REQUEST', v.error);

  // Editing keeps a paused schedule paused; anything else (active, or a
  // finished/missed one being given a new time) becomes active again.
  const status = existing.status === 'paused' ? 'paused' : 'active';
  const s = v.value;
  await req.server.prisma.$executeRawUnsafe(
    `UPDATE chat_group_scheduled_messages
     SET body = $3, schedule_type = $4, send_at = $5::timestamptz, start_date = $6::date,
         time_of_day = $7, end_date = $8::date, next_run_at = $9::timestamptz,
         status = $10, last_error = NULL, updated_at = NOW()
     WHERE id = $1::uuid AND group_id = $2::uuid`,
    scheduleId,
    groupId,
    s.body,
    s.scheduleType,
    s.sendAt,
    s.daily?.startDate ?? null,
    s.daily?.timeOfDay ?? null,
    s.daily?.endDate ?? null,
    s.nextRunAt,
    status,
  );
  const row = await loadOne(req, groupId, scheduleId);
  return ok(reply, row ? toJson(row) : null);
}

export async function adminSetScheduledStatusHandler(
  req: FastifyRequest<{ Params: { id: string; scheduleId: string }; Body: { status?: string } }>,
  reply: FastifyReply,
) {
  const { id: groupId, scheduleId } = req.params;
  const target = req.body?.status;
  if (target !== 'active' && target !== 'paused') return fail(reply, 400, 'BAD_REQUEST', 'status must be "active" or "paused".');
  const existing = await loadOne(req, groupId, scheduleId);
  if (!existing) return fail(reply, 404, 'NOT_FOUND', 'Scheduled message not found.');

  if (target === 'paused') {
    if (existing.status !== 'active') return fail(reply, 409, 'NOT_ACTIVE', 'Only an active schedule can be paused.');
    await req.server.prisma.$executeRawUnsafe(
      `UPDATE chat_group_scheduled_messages SET status = 'paused', updated_at = NOW() WHERE id = $1::uuid`,
      scheduleId,
    );
  } else {
    if (existing.status !== 'paused') return fail(reply, 409, 'NOT_PAUSED', 'Only a paused schedule can be resumed.');
    const next = resumeNextRun(
      {
        scheduleType: existing.schedule_type,
        sendAt: existing.send_at ? new Date(existing.send_at) : null,
        daily: existing.schedule_type === 'daily' && existing.start_date && existing.time_of_day
          ? { startDate: existing.start_date, timeOfDay: existing.time_of_day, endDate: existing.end_date }
          : null,
      },
      new Date(),
    );
    if (!next) {
      return fail(reply, 409, 'NO_FUTURE_RUN', existing.schedule_type === 'once'
        ? 'Its send time has passed — edit it to pick a new date and time.'
        : 'Its end date has passed — edit it to extend the end date.');
    }
    await req.server.prisma.$executeRawUnsafe(
      `UPDATE chat_group_scheduled_messages
       SET status = 'active', next_run_at = $2::timestamptz, last_error = NULL, updated_at = NOW()
       WHERE id = $1::uuid`,
      scheduleId,
      next,
    );
  }
  const row = await loadOne(req, groupId, scheduleId);
  return ok(reply, row ? toJson(row) : null);
}

export async function adminDeleteScheduledHandler(
  req: FastifyRequest<{ Params: { id: string; scheduleId: string } }>,
  reply: FastifyReply,
) {
  const n = await req.server.prisma.$executeRawUnsafe(
    `DELETE FROM chat_group_scheduled_messages WHERE id = $1::uuid AND group_id = $2::uuid`,
    req.params.scheduleId,
    req.params.id,
  );
  if (!n) return fail(reply, 404, 'NOT_FOUND', 'Scheduled message not found.');
  return ok(reply, { deleted: true });
}
