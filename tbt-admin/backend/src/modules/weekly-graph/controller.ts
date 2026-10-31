// Admin API for the configurable Weekly Activity Graph (Clerk-protected; see routes.ts).
// Pure rules + validation: lib/weeklyGraphConfig.ts. Data access: lib/weeklyGraphConfigData.ts.

import type { FastifyReply, FastifyRequest } from 'fastify';
import { getActingAdmin } from '../../lib/adminRole.js';
import {
  DEFAULT_GRAPH_MILESTONES,
  canEditGraphConfig,
  canRecordGraphProgress,
  defaultWeeks,
  findOverlappingWeek,
  hasDuplicateLabel,
  validateActivityInput,
  validateMilestoneInput,
  validateReorder,
  validateWeekInput,
  type GraphMilestoneRow,
  type GraphWeekRow,
} from '../../lib/weeklyGraphConfig.js';
import { ensureProgramGraphConfig, loadProgramGraphRows } from '../../lib/weeklyGraphConfigData.js';
import { notifyWeeklyGraphChanged } from '../../lib/weeklyGraphNotify.js';

type P = { programId: string };
type PI = P & { id: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ok = (reply: FastifyReply, data: unknown) => reply.send({ success: true, data, error: null });
const fail = (reply: FastifyReply, status: number, error: string) => reply.status(status).send({ success: false, data: null, error });

async function requireRole(req: FastifyRequest, reply: FastifyReply, allowed: (role: string) => boolean, message: string) {
  const acting = await getActingAdmin(req).catch(() => null);
  if (!acting) { fail(reply, 403, 'Admin account not found'); return null; }
  if (!allowed(acting.role as string)) { fail(reply, 403, message); return null; }
  return acting;
}
const requireEditor = (req: FastifyRequest, reply: FastifyReply) =>
  requireRole(req, reply, canEditGraphConfig, 'Only Admin and Super Admin can change the weekly graph configuration.');
const requireRecorder = (req: FastifyRequest, reply: FastifyReply) =>
  requireRole(req, reply, canRecordGraphProgress, 'Only Admin, Super Admin and Mentor can record member milestones.');
const requireViewer = (req: FastifyRequest, reply: FastifyReply) =>
  requireRole(req, reply, () => true, '');

/** 404s unknown / malformed program ids. */
async function loadProgram(req: FastifyRequest<{ Params: P }>, reply: FastifyReply) {
  const { programId } = req.params;
  if (!UUID.test(programId)) { fail(reply, 400, 'Invalid program id'); return null; }
  const rows = await req.server.prisma.$queryRawUnsafe<any[]>(
    `SELECT id::text, name, duration_days AS "durationDays" FROM programs WHERE id = $1::uuid`, programId,
  );
  if (!rows.length) { fail(reply, 404, 'Program not found'); return null; }
  return rows[0] as { id: string; name: string; durationDays: number };
}

const changed = (req: FastifyRequest, programId: string, reason: string) =>
  void notifyWeeklyGraphChanged(req.server, { programIds: [programId] }, reason);

async function listActivities(prisma: any, programId: string) {
  return prisma.$queryRawUnsafe(
    `SELECT id::text, title, day_number AS "dayNumber", sort_order AS "sortOrder", is_required AS "isRequired",
            is_active AS "isActive", member_id::text AS "memberId", graph_week_id::text AS "weekId",
            graph_milestone_id::text AS "milestoneId", is_milestone AS "isMilestone", milestone_label AS "milestoneLabel"
     FROM tasks WHERE program_id = $1::uuid AND batch_id IS NULL AND deleted_at IS NULL
     ORDER BY day_number, sort_order, title`,
    programId,
  );
}

// GET /api/weekly-graph/admin/programs/:programId/config
export async function getConfigHandler(req: FastifyRequest<{ Params: P }>, reply: FastifyReply) {
  if (!(await requireViewer(req, reply))) return;
  const program = await loadProgram(req, reply);
  if (!program) return;
  const prisma = req.server.prisma;
  // Backfill any default milestones added after this program was first initialized.
  await ensureProgramGraphConfig(prisma, program.id).catch(() => {});
  const [rows, activities] = await Promise.all([loadProgramGraphRows(prisma, program.id), listActivities(prisma, program.id)]);
  const saved = rows.weeks.length > 0 || rows.milestones.length > 0;
  return ok(reply, {
    program,
    saved,
    // Until the first edit, show what members currently see (built-in defaults, no ids yet).
    weeks: rows.weeks.length ? rows.weeks : defaultWeeks(program.durationDays).map((w, i) => ({ id: null, ...w, sortOrder: i, isActive: true })),
    milestones: rows.milestones.length ? rows.milestones : DEFAULT_GRAPH_MILESTONES.map((m, i) => ({ id: null, ...m, sortOrder: i, isActive: true })),
    activities,
  });
}

// POST /api/weekly-graph/admin/programs/:programId/initialize — save the defaults as editable rows
export async function initializeHandler(req: FastifyRequest<{ Params: P }>, reply: FastifyReply) {
  if (!(await requireEditor(req, reply))) return;
  const program = await loadProgram(req, reply);
  if (!program) return;
  await ensureProgramGraphConfig(req.server.prisma, program.id);
  changed(req, program.id, 'graph_config_initialized');
  return ok(reply, await loadProgramGraphRows(req.server.prisma, program.id));
}

// ── Weeks ────────────────────────────────────────────────────────────────────

async function weekRows(prisma: any, programId: string): Promise<GraphWeekRow[]> {
  return (await loadProgramGraphRows(prisma, programId)).weeks;
}

export async function createWeekHandler(req: FastifyRequest<{ Params: P }>, reply: FastifyReply) {
  if (!(await requireEditor(req, reply))) return;
  const program = await loadProgram(req, reply);
  if (!program) return;
  const v = validateWeekInput(req.body);
  if (!v.ok) return fail(reply, 400, v.error);
  const prisma = req.server.prisma;
  await ensureProgramGraphConfig(prisma, program.id);
  const weeks = await weekRows(prisma, program.id);
  if (hasDuplicateLabel(weeks, v.value.label)) return fail(reply, 409, `A week named "${v.value.label}" already exists`);
  const clash = findOverlappingWeek(weeks, v.value);
  if (clash) return fail(reply, 409, `Days ${v.value.startDay}–${v.value.endDay} overlap "${clash.label}"`);
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `INSERT INTO graph_weeks (program_id, label, start_day, end_day, sort_order, is_active)
     VALUES ($1::uuid, $2, $3, $4, (SELECT COALESCE(MAX(sort_order) + 1, 0) FROM graph_weeks WHERE program_id = $1::uuid), $5)
     RETURNING id::text, label, start_day AS "startDay", end_day AS "endDay", sort_order AS "sortOrder", is_active AS "isActive"`,
    program.id, v.value.label, v.value.startDay, v.value.endDay, v.value.isActive,
  );
  changed(req, program.id, 'graph_week_created');
  return ok(reply, rows[0]);
}

export async function updateWeekHandler(req: FastifyRequest<{ Params: PI }>, reply: FastifyReply) {
  if (!(await requireEditor(req, reply))) return;
  const program = await loadProgram(req, reply);
  if (!program) return;
  const prisma = req.server.prisma;
  const weeks = await weekRows(prisma, program.id);
  const current = weeks.find((w) => w.id === req.params.id);
  if (!current) return fail(reply, 404, 'Week not found in this program');
  const v = validateWeekInput(req.body, current);
  if (!v.ok) return fail(reply, 400, v.error);
  if (hasDuplicateLabel(weeks, v.value.label, current.id)) return fail(reply, 409, `A week named "${v.value.label}" already exists`);
  const clash = findOverlappingWeek(weeks, v.value, current.id);
  if (clash) return fail(reply, 409, `Days ${v.value.startDay}–${v.value.endDay} overlap "${clash.label}"`);
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `UPDATE graph_weeks SET label = $3, start_day = $4, end_day = $5, is_active = $6, updated_at = NOW()
     WHERE id = $2::uuid AND program_id = $1::uuid
     RETURNING id::text, label, start_day AS "startDay", end_day AS "endDay", sort_order AS "sortOrder", is_active AS "isActive"`,
    program.id, current.id, v.value.label, v.value.startDay, v.value.endDay, v.value.isActive,
  );
  changed(req, program.id, 'graph_week_updated');
  return ok(reply, rows[0]);
}

export async function deleteWeekHandler(req: FastifyRequest<{ Params: PI }>, reply: FastifyReply) {
  if (!(await requireEditor(req, reply))) return;
  const program = await loadProgram(req, reply);
  if (!program) return;
  const prisma = req.server.prisma;
  const week = (await weekRows(prisma, program.id)).find((w) => w.id === req.params.id);
  if (!week) return fail(reply, 404, 'Week not found in this program');
  // Never orphan history: graph_week_id / week_id are ON DELETE SET NULL, so a plain
  // delete would drop the week's activities (whose days no other week covers) and its
  // member records off the graph. A week in use is only deleted together with an
  // explicit target week (?moveTo=<weekId>) that takes over its activities and records.
  const [use] = await prisma.$queryRawUnsafe<any[]>(
    `SELECT
       (SELECT COUNT(*)::int FROM tasks WHERE graph_week_id = $2::uuid) AS linked,
       (SELECT COUNT(*)::int FROM tasks WHERE program_id = $1::uuid AND batch_id IS NULL AND graph_week_id IS NULL
          AND day_number BETWEEN $3 AND $4) AS by_day,
       (SELECT COUNT(*)::int FROM member_graph_milestone_records WHERE week_id = $2::uuid) AS records`,
    program.id, week.id, week.startDay, week.endDay,
  );
  const activities = use.linked + use.by_day;
  const moveTo = (req.query as any)?.moveTo;
  if (activities + use.records > 0 && !moveTo) {
    // The destinations come from the server (this program's saved weeks, fresh from
    // the database) so the admin's choice never depends on a stale page copy.
    const targets = (await weekRows(prisma, program.id))
      .filter((w) => w.id !== week.id)
      .map((w) => ({ id: w.id, label: w.label, startDay: w.startDay, endDay: w.endDay, isActive: w.isActive }));
    return reply.status(409).send({
      success: false,
      data: { activities, records: use.records, targets },
      error: `"${week.label}" has ${activities} activities and ${use.records} member records. Choose a week to move them to before deleting.`,
    });
  }
  if (activities + use.records > 0) {
    const target = (await weekRows(prisma, program.id)).find((w) => w.id === moveTo);
    if (!target || target.id === week.id) return fail(reply, 400, 'Choose another week of this program to move the activities and member records to');
    // One transaction: the activities and records get the target week (their days are
    // unchanged, so members' checklists are untouched), then the now-unused week goes.
    await prisma.$transaction(async (tx: any) => {
      await tx.$executeRawUnsafe(
        `UPDATE tasks SET graph_week_id = $3::uuid
         WHERE graph_week_id = $2::uuid
            OR (program_id = $1::uuid AND batch_id IS NULL AND graph_week_id IS NULL AND day_number BETWEEN $4 AND $5)`,
        program.id, week.id, target.id, week.startDay, week.endDay,
      );
      await tx.$executeRawUnsafe(
        `UPDATE member_graph_milestone_records SET week_id = $2::uuid WHERE week_id = $1::uuid`,
        week.id, target.id,
      );
      await tx.$executeRawUnsafe(`DELETE FROM graph_weeks WHERE id = $2::uuid AND program_id = $1::uuid`, program.id, week.id);
    });
    changed(req, program.id, 'graph_week_deleted');
    return ok(reply, { deleted: week.id, movedTo: target.id, activities, records: use.records });
  }
  await prisma.$executeRawUnsafe(`DELETE FROM graph_weeks WHERE id = $2::uuid AND program_id = $1::uuid`, program.id, week.id);
  changed(req, program.id, 'graph_week_deleted');
  return ok(reply, { deleted: week.id });
}

// ── Milestones ───────────────────────────────────────────────────────────────

async function milestoneRows(prisma: any, programId: string): Promise<GraphMilestoneRow[]> {
  return (await loadProgramGraphRows(prisma, programId)).milestones;
}

export async function createMilestoneHandler(req: FastifyRequest<{ Params: P }>, reply: FastifyReply) {
  if (!(await requireEditor(req, reply))) return;
  const program = await loadProgram(req, reply);
  if (!program) return;
  const v = validateMilestoneInput(req.body);
  if (!v.ok) return fail(reply, 400, v.error);
  const prisma = req.server.prisma;
  await ensureProgramGraphConfig(prisma, program.id);
  if (hasDuplicateLabel(await milestoneRows(prisma, program.id), v.value.label)) {
    return fail(reply, 409, `A milestone named "${v.value.label}" already exists`);
  }
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `INSERT INTO graph_milestones (program_id, label, kind, sort_order, is_active, threshold_amount)
     VALUES ($1::uuid, $2, $3, (SELECT COALESCE(MAX(sort_order) + 1, 0) FROM graph_milestones WHERE program_id = $1::uuid), $4, $5)
     RETURNING id::text, label, kind, sort_order AS "sortOrder", is_active AS "isActive", threshold_amount::float8 AS "threshold"`,
    program.id, v.value.label, v.value.kind, v.value.isActive, v.value.threshold,
  );
  changed(req, program.id, 'graph_milestone_created');
  return ok(reply, rows[0]);
}

export async function updateMilestoneHandler(req: FastifyRequest<{ Params: PI }>, reply: FastifyReply) {
  if (!(await requireEditor(req, reply))) return;
  const program = await loadProgram(req, reply);
  if (!program) return;
  const prisma = req.server.prisma;
  const all = await milestoneRows(prisma, program.id);
  const current = all.find((m) => m.id === req.params.id);
  if (!current) return fail(reply, 404, 'Milestone not found in this program');
  const v = validateMilestoneInput(req.body, current);
  if (!v.ok) return fail(reply, 400, v.error);
  if (hasDuplicateLabel(all, v.value.label, current.id)) return fail(reply, 409, `A milestone named "${v.value.label}" already exists`);
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `UPDATE graph_milestones SET label = $3, kind = $4, is_active = $5, threshold_amount = $6, updated_at = NOW()
     WHERE id = $2::uuid AND program_id = $1::uuid
     RETURNING id::text, label, kind, sort_order AS "sortOrder", is_active AS "isActive", threshold_amount::float8 AS "threshold"`,
    program.id, current.id, v.value.label, v.value.kind, v.value.isActive, v.value.threshold,
  );
  // Keep the legacy free-text label on linked activities in step (used by milestone bonus points).
  if (v.value.label !== current.label) {
    await prisma.$executeRawUnsafe(
      `UPDATE tasks SET milestone_label = $2 WHERE graph_milestone_id = $1::uuid`, current.id, v.value.label,
    ).catch(() => {});
  }
  changed(req, program.id, 'graph_milestone_updated');
  return ok(reply, rows[0]);
}

export async function deleteMilestoneHandler(req: FastifyRequest<{ Params: PI }>, reply: FastifyReply) {
  if (!(await requireEditor(req, reply))) return;
  const program = await loadProgram(req, reply);
  if (!program) return;
  const prisma = req.server.prisma;
  const m = (await milestoneRows(prisma, program.id)).find((x) => x.id === req.params.id);
  if (!m) return fail(reply, 404, 'Milestone not found in this program');
  const [use] = await prisma.$queryRawUnsafe<any[]>(
    `SELECT (SELECT COUNT(*)::int FROM tasks WHERE graph_milestone_id = $1::uuid) AS linked,
            (SELECT COUNT(*)::int FROM member_graph_milestone_records WHERE milestone_id = $1::uuid) AS records`,
    m.id,
  );
  if (use.linked + use.records > 0) {
    return fail(reply, 409, `"${m.label}" is linked to ${use.linked} activities and ${use.records} member records. Disable it instead of deleting.`);
  }
  await prisma.$executeRawUnsafe(`DELETE FROM graph_milestones WHERE id = $2::uuid AND program_id = $1::uuid`, program.id, m.id);
  changed(req, program.id, 'graph_milestone_deleted');
  return ok(reply, { deleted: m.id });
}

// ── Reorder (PUT …/reorder { ids }) ─────────────────────────────────────────

async function reorder(req: FastifyRequest<{ Params: P }>, reply: FastifyReply, table: 'graph_weeks' | 'graph_milestones') {
  if (!(await requireEditor(req, reply))) return;
  const program = await loadProgram(req, reply);
  if (!program) return;
  const prisma = req.server.prisma;
  const rows = await loadProgramGraphRows(prisma, program.id);
  const existing = (table === 'graph_weeks' ? rows.weeks : rows.milestones).map((r) => r.id);
  const v = validateReorder(existing, (req.body as any)?.ids);
  if (!v.ok) return fail(reply, 400, v.error);
  await prisma.$executeRawUnsafe(
    `UPDATE ${table} AS t SET sort_order = o.ord - 1, updated_at = NOW()
     FROM unnest($2::uuid[]) WITH ORDINALITY AS o(id, ord)
     WHERE t.id = o.id AND t.program_id = $1::uuid`,
    program.id, v.value,
  );
  changed(req, program.id, `${table}_reordered`);
  return ok(reply, { ids: v.value });
}
export const reorderWeeksHandler = (req: FastifyRequest<{ Params: P }>, reply: FastifyReply) => reorder(req, reply, 'graph_weeks');
export const reorderMilestonesHandler = (req: FastifyRequest<{ Params: P }>, reply: FastifyReply) => reorder(req, reply, 'graph_milestones');

// ── Activities (program-level tasks) ─────────────────────────────────────────

export async function createActivityHandler(req: FastifyRequest<{ Params: P }>, reply: FastifyReply) {
  const acting = await requireEditor(req, reply);
  if (!acting) return;
  const program = await loadProgram(req, reply);
  if (!program) return;
  const v = validateActivityInput(req.body);
  if (!v.ok) return fail(reply, 400, v.error);
  if (!v.value.weekId) return fail(reply, 400, 'Choose the week for this activity');
  const prisma = req.server.prisma;
  await ensureProgramGraphConfig(prisma, program.id);
  const rows = await loadProgramGraphRows(prisma, program.id);
  const week = rows.weeks.find((w) => w.id === v.value.weekId);
  if (!week) return fail(reply, 400, 'That week does not belong to this program');
  const milestone = v.value.milestoneId ? rows.milestones.find((m) => m.id === v.value.milestoneId) : null;
  if (v.value.milestoneId && !milestone) return fail(reply, 400, 'That milestone does not belong to this program');
  const created = await prisma.$queryRawUnsafe<any[]>(
    `INSERT INTO tasks (program_id, day_number, title, is_required, is_active, sort_order, graph_week_id,
                        graph_milestone_id, is_milestone, milestone_label, created_by)
     VALUES ($1::uuid, $2, $3, $4, $5,
             (SELECT COALESCE(MAX(sort_order) + 1, 0) FROM tasks WHERE program_id = $1::uuid AND day_number = $2),
             $6::uuid, $7::uuid, $8, $9, $10)
     RETURNING id::text`,
    program.id, week.startDay, v.value.title, v.value.isRequired, v.value.isActive,
    week.id, milestone?.id ?? null, !!milestone, milestone?.label ?? null, acting.id,
  );
  changed(req, program.id, 'graph_activity_created');
  return ok(reply, { id: created[0].id });
}

export async function updateActivityHandler(req: FastifyRequest<{ Params: PI }>, reply: FastifyReply) {
  if (!(await requireEditor(req, reply))) return;
  const program = await loadProgram(req, reply);
  if (!program) return;
  const prisma = req.server.prisma;
  const [task] = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id::text, title, day_number AS "dayNumber", is_required AS "isRequired", is_active AS "isActive",
            graph_week_id::text AS "weekId", graph_milestone_id::text AS "milestoneId"
     FROM tasks WHERE id = $2::uuid AND program_id = $1::uuid AND batch_id IS NULL AND deleted_at IS NULL`,
    program.id, UUID.test(req.params.id) ? req.params.id : '00000000-0000-0000-0000-000000000000',
  );
  if (!task) return fail(reply, 404, 'Activity not found in this program');
  const v = validateActivityInput(req.body, task);
  if (!v.ok) return fail(reply, 400, v.error);
  const rows = await loadProgramGraphRows(prisma, program.id);
  const week = v.value.weekId ? rows.weeks.find((w) => w.id === v.value.weekId) : null;
  if (v.value.weekId && !week) return fail(reply, 400, 'That week does not belong to this program');
  const milestone = v.value.milestoneId ? rows.milestones.find((m) => m.id === v.value.milestoneId) : null;
  if (v.value.milestoneId && !milestone) return fail(reply, 400, 'That milestone does not belong to this program');
  // Moving to another week moves the activity's day to that week's first day
  // (the batch program's day pages read day_number); submissions are untouched.
  const dayNumber = week && (task.dayNumber < week.startDay || task.dayNumber > week.endDay) ? week.startDay : task.dayNumber;
  await prisma.$executeRawUnsafe(
    `UPDATE tasks SET title = $2, is_required = $3, is_active = $4, graph_week_id = $5::uuid, graph_milestone_id = $6::uuid,
            is_milestone = $7, milestone_label = $8, day_number = $9, updated_at = NOW()
     WHERE id = $1::uuid`,
    task.id, v.value.title, v.value.isRequired, v.value.isActive, week?.id ?? null, milestone?.id ?? null,
    !!milestone, milestone?.label ?? null, dayNumber,
  );
  changed(req, program.id, 'graph_activity_updated');
  return ok(reply, { id: task.id });
}

export async function deleteActivityHandler(req: FastifyRequest<{ Params: PI }>, reply: FastifyReply) {
  if (!(await requireEditor(req, reply))) return;
  const program = await loadProgram(req, reply);
  if (!program) return;
  const prisma = req.server.prisma;
  const [task] = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id::text, title FROM tasks WHERE id = $2::uuid AND program_id = $1::uuid AND batch_id IS NULL AND deleted_at IS NULL`,
    program.id, UUID.test(req.params.id) ? req.params.id : '00000000-0000-0000-0000-000000000000',
  );
  if (!task) return fail(reply, 404, 'Activity not found in this program');
  // Never lose member work: task_submissions cascade on a task delete, so only
  // an activity without submissions is really deleted. The NOT EXISTS keeps that
  // check and the delete in one statement.
  const deleted = await prisma.$queryRawUnsafe<any[]>(
    `DELETE FROM tasks t WHERE t.id = $2::uuid AND t.program_id = $1::uuid AND t.batch_id IS NULL
       AND NOT EXISTS (SELECT 1 FROM task_submissions s WHERE s.task_id = t.id)
     RETURNING t.id::text AS id`,
    program.id, task.id,
  );
  if (deleted.length > 0) {
    changed(req, program.id, 'graph_activity_deleted');
    return ok(reply, { deleted: task.id });
  }
  const [use] = await prisma.$queryRawUnsafe<any[]>(
    `SELECT COUNT(*)::int AS submissions FROM task_submissions WHERE task_id = $1::uuid`, task.id,
  );
  const submissions = use?.submissions ?? 0;
  // With submissions, deleting needs the admin's explicit confirmation (?archive=true):
  // the activity is archived — hidden from admins and members, inactive — and its
  // row and every submission, review and point are kept.
  if ((req.query as any)?.archive !== 'true') {
    return fail(reply, 409, `"${task.title}" has ${submissions} submissions. Deleting it archives the activity and keeps its submissions.`);
  }
  await prisma.$executeRawUnsafe(
    `UPDATE tasks SET deleted_at = NOW(), is_active = false, updated_at = NOW()
     WHERE id = $2::uuid AND program_id = $1::uuid AND batch_id IS NULL AND deleted_at IS NULL`,
    program.id, task.id,
  );
  changed(req, program.id, 'graph_activity_archived');
  return ok(reply, { archived: task.id, submissions });
}

// ── Member milestone records (admin-verified achievements) ───────────────────

type M = { memberId: string };

async function memberProgram(req: FastifyRequest<{ Params: M }>, reply: FastifyReply) {
  const { memberId } = req.params;
  if (!UUID.test(memberId)) { fail(reply, 400, 'Invalid member id'); return null; }
  const [m] = await req.server.prisma.$queryRawUnsafe<any[]>(
    `SELECT m.id::text, m.first_name AS "firstName", m.last_name AS "lastName", b.program_id::text AS "programId"
     FROM members m LEFT JOIN batches b ON b.id = m.batch_id WHERE m.id = $1::uuid`,
    memberId,
  );
  if (!m) { fail(reply, 404, 'Member not found'); return null; }
  return m as { id: string; firstName: string; lastName: string; programId: string | null };
}

async function listRecords(prisma: any, memberId: string) {
  return prisma.$queryRawUnsafe(
    `SELECT r.id::text, r.milestone_id::text AS "milestoneId", gm.label AS "milestoneLabel", gm.kind,
            r.week_id::text AS "weekId", gw.label AS "weekLabel", r.note, r.recorded_by AS "recordedBy", r.recorded_at AS "recordedAt"
     FROM member_graph_milestone_records r
     JOIN graph_milestones gm ON gm.id = r.milestone_id
     LEFT JOIN graph_weeks gw ON gw.id = r.week_id
     WHERE r.member_id = $1::uuid ORDER BY gm.sort_order`,
    memberId,
  );
}

// GET /api/weekly-graph/admin/members/:memberId/records
export async function listRecordsHandler(req: FastifyRequest<{ Params: M }>, reply: FastifyReply) {
  if (!(await requireViewer(req, reply))) return;
  const member = await memberProgram(req, reply);
  if (!member) return;
  return ok(reply, { member, records: await listRecords(req.server.prisma, member.id) });
}

// PUT /api/weekly-graph/admin/members/:memberId/records  { milestoneId, weekId, note? } — one record per milestone
export async function upsertRecordHandler(req: FastifyRequest<{ Params: M }>, reply: FastifyReply) {
  const acting = await requireRecorder(req, reply);
  if (!acting) return;
  const member = await memberProgram(req, reply);
  if (!member) return;
  if (!member.programId) return fail(reply, 400, 'This member is not in a program batch');
  const { milestoneId, weekId, note } = (req.body ?? {}) as { milestoneId?: unknown; weekId?: unknown; note?: unknown };
  if (typeof milestoneId !== 'string' || typeof weekId !== 'string') return fail(reply, 400, 'Choose a milestone and a week');
  if (note != null && (typeof note !== 'string' || note.length > 500)) return fail(reply, 400, 'Note must be text up to 500 characters');
  const prisma = req.server.prisma;
  await ensureProgramGraphConfig(prisma, member.programId);
  const rows = await loadProgramGraphRows(prisma, member.programId);
  if (!rows.milestones.some((m) => m.id === milestoneId)) return fail(reply, 400, "That milestone is not in this member's program");
  if (!rows.weeks.some((w) => w.id === weekId)) return fail(reply, 400, "That week is not in this member's program");
  await prisma.$executeRawUnsafe(
    `INSERT INTO member_graph_milestone_records (member_id, milestone_id, week_id, note, recorded_by)
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5)
     ON CONFLICT (member_id, milestone_id) DO UPDATE
       SET week_id = EXCLUDED.week_id, note = EXCLUDED.note, recorded_by = EXCLUDED.recorded_by, recorded_at = NOW()`,
    member.id, milestoneId, weekId, (note as string | undefined)?.trim() || null, acting.fullName ?? acting.id,
  );
  void notifyWeeklyGraphChanged(req.server, { memberIds: [member.id] }, 'graph_record_saved');
  return ok(reply, { records: await listRecords(prisma, member.id) });
}

// DELETE /api/weekly-graph/admin/members/:memberId/records/:recordId
export async function deleteRecordHandler(req: FastifyRequest<{ Params: M & { recordId: string } }>, reply: FastifyReply) {
  if (!(await requireRecorder(req, reply))) return;
  const member = await memberProgram(req, reply);
  if (!member) return;
  if (!UUID.test(req.params.recordId)) return fail(reply, 400, 'Invalid record id');
  await req.server.prisma.$executeRawUnsafe(
    `DELETE FROM member_graph_milestone_records WHERE id = $1::uuid AND member_id = $2::uuid`, req.params.recordId, member.id,
  );
  void notifyWeeklyGraphChanged(req.server, { memberIds: [member.id] }, 'graph_record_deleted');
  return ok(reply, { records: await listRecords(req.server.prisma, member.id) });
}
