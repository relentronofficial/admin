/**
 * Admin-scheduled group-chat messages — `/api/chat-groups/admin/:id/scheduled-messages`.
 *
 * An admin schedules a text message for a group, either once (a date + time)
 * or repeating daily / weekly / monthly (at a time, from a start date,
 * optionally until an end date). Times are IST. jobs/chatScheduledMessages.ts posts them when due;
 * the rules live in lib/chatScheduleLogic.ts.
 *
 * Table `chat_group_scheduled_messages` (raw SQL, created in plugins/prisma.ts).
 * status: active | paused | completed | missed | cancelled
 */

import type { FastifyReply, FastifyRequest } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import {
  RELATIVE_BULK_MAX,
  istDateOf,
  istDateStartMs,
  istTimeOf,
  relativeRunAt,
  resumeNextRun,
  ruleFromRow,
  syncRelative,
  validateScheduleInput,
  type ScheduleInput,
  type ScheduleType,
  type ValidSchedule,
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
  day_number: number | null;
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
  s.day_number, s.next_run_at, s.status, s.created_by_admin_id, s.sent_count,
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
    /** IST date: the send date (once) or the start date (repeating). */
    date: once ? (r.send_at ? istDateOf(new Date(r.send_at)) : null) : r.start_date,
    /** IST time HH:MM. */
    time: once ? (r.send_at ? istTimeOf(new Date(r.send_at)) : null) : r.time_of_day,
    endDate: once ? null : r.end_date,
    /** relative only: day counted from the group's start date (1 = that date, -1 = the day before). */
    day: r.schedule_type === 'relative' ? r.day_number : null,
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

interface StartRow {
  batch_id: string | null;
  custom_date: string | null;
  batch_name: string | null;
  batch_starts_at: Date | null;
}

const START_COLUMNS = `
  g.schedule_batch_id AS batch_id, to_char(g.schedule_start_date, 'YYYY-MM-DD') AS custom_date,
  b.name AS batch_name, b.starts_at AS batch_starts_at`;

/** The IST date Day 1 falls on: the linked batch's start date, else the custom date. */
function effectiveStart(r: StartRow): string | null {
  if (r.batch_id) return r.batch_starts_at ? istDateOf(new Date(r.batch_starts_at)) : null;
  return r.custom_date;
}

async function loadGroupStart(req: FastifyRequest, groupId: string) {
  const rows = await req.server.prisma.$queryRawUnsafe<StartRow[]>(
    `SELECT ${START_COLUMNS}
     FROM chat_groups g LEFT JOIN batches b ON b.id = g.schedule_batch_id
     WHERE g.id = $1::uuid AND g.is_deleted = false`,
    groupId,
  );
  const r = rows[0];
  if (!r) return null;
  return {
    batchId: r.batch_id,
    batchName: r.batch_name,
    /** The linked batch no longer exists. */
    batchMissing: !!r.batch_id && !r.batch_starts_at,
    customDate: r.custom_date,
    startDate: effectiveStart(r),
  };
}

/**
 * Re-time unsent relative messages from their group's current start date.
 * Runs at the start of every sweep (so a batch whose start date moved is
 * always picked up before anything is sent) and whenever an admin opens the
 * list or changes the group's start date.
 */
export async function syncRelativeSchedules(prisma: PrismaClient, now: Date, groupId: string | null = null): Promise<void> {
  const rows = await prisma.$queryRawUnsafe<Array<StartRow & {
    id: string; status: string; day_number: number | null; time_of_day: string | null; next_run_at: Date | null;
  }>>(
    `SELECT s.id, s.status, s.day_number, s.time_of_day, s.next_run_at, ${START_COLUMNS}
     FROM chat_group_scheduled_messages s
     JOIN chat_groups g ON g.id = s.group_id AND g.is_deleted = false
     LEFT JOIN batches b ON b.id = g.schedule_batch_id
     WHERE s.schedule_type = 'relative' AND s.status IN ('active', 'paused', 'missed')
       AND ($1::uuid IS NULL OR s.group_id = $1::uuid)`,
    groupId,
  );
  for (const r of rows) {
    const change = syncRelative(
      {
        status: r.status,
        nextRunAt: r.next_run_at ? new Date(r.next_run_at) : null,
        runAt: relativeRunAt(effectiveStart(r), r.day_number, r.time_of_day),
      },
      now,
    );
    if (!change) continue;
    // Conditional on what was read, so a concurrent send or edit always wins.
    await prisma.$executeRawUnsafe(
      `UPDATE chat_group_scheduled_messages
       SET status = $2, next_run_at = $3::timestamptz, last_error = $4, updated_at = NOW()
       WHERE id = $1::uuid AND status = $5 AND next_run_at IS NOT DISTINCT FROM $6::timestamptz
         AND day_number = $7::int AND time_of_day = $8`,
      r.id, change.status, change.nextRunAt, change.error,
      r.status, r.next_run_at, r.day_number, r.time_of_day,
    );
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function adminGetScheduleStartHandler(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const start = await loadGroupStart(req, req.params.id);
  if (!start) return fail(reply, 404, 'NOT_FOUND', 'Group not found.');
  return ok(reply, start);
}

/** Set the group's start date: { batchId } or { startDate }, or neither to clear it. */
export async function adminSetScheduleStartHandler(
  req: FastifyRequest<{ Params: { id: string }; Body: { batchId?: string | null; startDate?: string | null } }>,
  reply: FastifyReply,
) {
  const groupId = req.params.id;
  const batchId = req.body?.batchId || null;
  const startDate = batchId ? null : req.body?.startDate || null;
  if (batchId) {
    const batch = UUID_RE.test(String(batchId))
      ? await req.server.prisma.batch.findUnique({ where: { id: batchId }, select: { id: true } })
      : null;
    if (!batch) return fail(reply, 400, 'BAD_REQUEST', 'Batch not found.');
  }
  if (startDate && istDateStartMs(String(startDate)) == null) return fail(reply, 400, 'BAD_REQUEST', 'Pick a valid start date.');
  const n = await req.server.prisma.$executeRawUnsafe(
    `UPDATE chat_groups SET schedule_batch_id = $2::uuid, schedule_start_date = $3::date
     WHERE id = $1::uuid AND is_deleted = false`,
    groupId,
    batchId,
    startDate,
  );
  if (!n) return fail(reply, 404, 'NOT_FOUND', 'Group not found.');
  await syncRelativeSchedules(req.server.prisma, new Date(), groupId);
  return ok(reply, await loadGroupStart(req, groupId));
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
  await syncRelativeSchedules(req.server.prisma, new Date(), req.params.id);
  const rows = await req.server.prisma.$queryRawUnsafe<ScheduledRow[]>(
    `SELECT ${SCHEDULED_COLUMNS}, a.full_name AS created_by_name
     FROM chat_group_scheduled_messages s
     LEFT JOIN admins a ON a.id = s.created_by_admin_id
     WHERE s.group_id = $1::uuid
     -- Upcoming first, soonest on top; then finished ones, latest on top. Never by creation
     -- time: an edited message has to move to its new time.
     ORDER BY (s.status IN ('active', 'paused')) DESC,
              CASE WHEN s.status IN ('active', 'paused') THEN s.next_run_at END ASC NULLS LAST,
              COALESCE(CASE WHEN s.status = 'completed' THEN s.last_sent_at END, s.send_at, s.updated_at) DESC,
              s.created_at DESC`,
    req.params.id,
  );
  return ok(reply, rows.map(toJson));
}

const INSERT_SQL = `
  INSERT INTO chat_group_scheduled_messages
    (group_id, body, schedule_type, send_at, start_date, time_of_day, end_date, next_run_at, status, created_by_admin_id, day_number)
  VALUES ($1::uuid, $2, $3, $4::timestamptz, $5::date, $6, $7::date, $8::timestamptz, 'active', $9::uuid, $10::int)
  RETURNING id`;

function insertParams(groupId: string, s: ValidSchedule, adminId: string | null): unknown[] {
  return [
    groupId,
    s.body,
    s.scheduleType,
    s.sendAt,
    s.recurring?.startDate ?? null,
    s.recurring?.timeOfDay ?? s.relative?.timeOfDay ?? null,
    s.recurring?.endDate ?? null,
    s.nextRunAt,
    adminId,
    s.relative?.day ?? null,
  ];
}

async function actingAdminId(req: FastifyRequest): Promise<string | null> {
  const admin = await req.server.prisma.admin.findFirst({
    where: { clerkId: (req as any).user as string },
    select: { id: true },
  });
  return admin?.id ?? null;
}

export async function adminCreateScheduledHandler(
  req: FastifyRequest<{ Params: { id: string }; Body: ScheduleInput }>,
  reply: FastifyReply,
) {
  const groupId = req.params.id;
  if (!(await groupIsLive(req, groupId))) return fail(reply, 404, 'NOT_FOUND', 'Group not found.');
  const start = await loadGroupStart(req, groupId);
  const v = validateScheduleInput(req.body ?? {}, new Date(), start?.startDate ?? null);
  if (!v.ok) return fail(reply, 400, 'BAD_REQUEST', v.error);

  const inserted = await req.server.prisma.$queryRawUnsafe<Array<{ id: string }>>(
    INSERT_SQL,
    ...insertParams(groupId, v.value, await actingAdminId(req)),
  );
  const row = await loadOne(req, groupId, inserted[0].id);
  return ok(reply, row ? toJson(row) : null);
}

/** Pre-feed several relative-day messages at once — all are added, or none. */
export async function adminBulkCreateRelativeHandler(
  req: FastifyRequest<{ Params: { id: string }; Body: { items?: ScheduleInput[] } }>,
  reply: FastifyReply,
) {
  const groupId = req.params.id;
  const start = await loadGroupStart(req, groupId);
  if (!start) return fail(reply, 404, 'NOT_FOUND', 'Group not found.');
  const items = req.body?.items;
  if (!Array.isArray(items) || items.length === 0) return fail(reply, 400, 'BAD_REQUEST', 'Add at least one message.');
  if (items.length > RELATIVE_BULK_MAX) return fail(reply, 400, 'BAD_REQUEST', `Add at most ${RELATIVE_BULK_MAX} messages at a time.`);

  const now = new Date();
  const valid: ValidSchedule[] = [];
  for (const [i, item] of items.entries()) {
    const v = validateScheduleInput({ ...(item ?? {}), scheduleType: 'relative' }, now, start.startDate);
    if (!v.ok) return fail(reply, 400, 'BAD_REQUEST', items.length > 1 ? `Message ${i + 1}: ${v.error}` : v.error);
    valid.push(v.value);
  }
  const adminId = await actingAdminId(req);
  await req.server.prisma.$transaction(
    valid.map((s) => req.server.prisma.$executeRawUnsafe(INSERT_SQL, ...insertParams(groupId, s, adminId))),
  );
  return ok(reply, { created: valid.length });
}

export async function adminUpdateScheduledHandler(
  req: FastifyRequest<{ Params: { id: string; scheduleId: string }; Body: ScheduleInput }>,
  reply: FastifyReply,
) {
  const { id: groupId, scheduleId } = req.params;
  const existing = await loadOne(req, groupId, scheduleId);
  if (!existing) return fail(reply, 404, 'NOT_FOUND', 'Scheduled message not found.');
  if (existing.status === 'cancelled') return fail(reply, 409, 'CANCELLED', 'This schedule was cancelled because its group was deleted.');
  const start = await loadGroupStart(req, groupId);
  const v = validateScheduleInput(req.body ?? {}, new Date(), start?.startDate ?? null);
  if (!v.ok) return fail(reply, 400, 'BAD_REQUEST', v.error);

  // Editing keeps a paused schedule paused; anything else (active, or a
  // finished/missed one being given a new time) becomes active again.
  const status = existing.status === 'paused' ? 'paused' : 'active';
  const s = v.value;
  await req.server.prisma.$executeRawUnsafe(
    `UPDATE chat_group_scheduled_messages
     SET body = $3, schedule_type = $4, send_at = $5::timestamptz, start_date = $6::date,
         time_of_day = $7, end_date = $8::date, next_run_at = $9::timestamptz,
         status = $10, day_number = $11::int, last_error = NULL, updated_at = NOW()
     WHERE id = $1::uuid AND group_id = $2::uuid`,
    scheduleId,
    groupId,
    s.body,
    s.scheduleType,
    s.sendAt,
    s.recurring?.startDate ?? null,
    s.recurring?.timeOfDay ?? s.relative?.timeOfDay ?? null,
    s.recurring?.endDate ?? null,
    s.nextRunAt,
    status,
    s.relative?.day ?? null,
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
    const relative = existing.schedule_type === 'relative';
    if (existing.status !== 'paused') return fail(reply, 409, 'NOT_PAUSED', 'Only a paused schedule can be resumed.');
    const next = resumeNextRun(
      {
        scheduleType: existing.schedule_type,
        sendAt: relative
          ? relativeRunAt((await loadGroupStart(req, groupId))?.startDate ?? null, existing.day_number, existing.time_of_day)
          : existing.send_at ? new Date(existing.send_at) : null,
        recurring: ruleFromRow(existing.schedule_type, existing.start_date, existing.time_of_day, existing.end_date),
      },
      new Date(),
    );
    if (!next) {
      return fail(reply, 409, 'NO_FUTURE_RUN', relative
        ? 'Its day has passed, or the group has no start date — edit it or set the start date.'
        : existing.schedule_type === 'once'
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
