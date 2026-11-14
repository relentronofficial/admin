import type { FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { taskInitiativeSchema, updateTaskSchema } from './schema.js';
import { notifyMembers } from '../../lib/notifications.js';
import { mergeAudiences, notifyWeeklyGraphChanged, resolveTaskAudience } from '../../lib/weeklyGraphNotify.js';

export async function listTasksHandler(request: FastifyRequest, reply: FastifyReply) {
  const { programId, stepId, page = 1, limit = 500 } = request.query as any;
  const where: any = {};
  if (programId) where.programId = programId;
  if (stepId) where.stepId = stepId;
  // Archived (soft-deleted) activities stay out of admin lists; deleted_at is a raw SQL column.
  const archived = await request.server.prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT id::text AS id FROM tasks WHERE deleted_at IS NOT NULL`,
  ).catch(() => [] as Array<{ id: string }>);
  if (archived.length > 0) where.id = { notIn: archived.map((r) => r.id) };

  const [tasks, total] = await Promise.all([
    request.server.prisma.task.findMany({
      where,
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
      orderBy: [{ dayNumber: 'asc' }, { sortOrder: 'asc' }],
      include: { program: { select: { id: true, name: true } } },
    }),
    request.server.prisma.task.count({ where }),
  ]);

  // Hydrate raw SQL columns (timer_seconds, member_id) not in Prisma schema
  const taskIds = tasks.map((t) => t.id);
  let rawRows: Array<{ id: string; timer_seconds: number | null; member_id: string | null; member_name: string | null }> = [];
  if (taskIds.length > 0) {
    rawRows = await request.server.prisma.$queryRawUnsafe<any[]>(`
      SELECT t.id, t.timer_seconds, t.member_id,
             CONCAT(m.first_name, ' ', m.last_name) AS member_name
      FROM tasks t
      LEFT JOIN members m ON m.id = t.member_id
      WHERE t.id = ANY($1::uuid[])
    `, taskIds);
  }
  const rawMap = new Map(rawRows.map((r) => [r.id, r]));
  const enriched = tasks.map((t) => {
    const raw = rawMap.get(t.id);
    return { ...t, timerSeconds: raw?.timer_seconds ?? null, memberId: raw?.member_id ?? null, memberName: raw?.member_name ?? null };
  });

  return reply.send({ success: true, data: enriched, meta: { total, page: Number(page), limit: Number(limit) }, error: null });
}

export async function createTaskInitiativeHandler(request: FastifyRequest, reply: FastifyReply) {
  let body: ReturnType<typeof taskInitiativeSchema.parse>;
  try {
    body = taskInitiativeSchema.parse(request.body);
  } catch (err) {
    if (err instanceof ZodError) {
      const msg = err.errors[0]?.message ?? 'Invalid input';
      return reply.status(400).send({ success: false, data: null, error: msg });
    }
    throw err;
  }

  const program = await request.server.prisma.program.findUnique({ where: { id: body.programId } });
  if (!program) {
    return reply.status(404).send({ success: false, data: null, error: 'Program not found' });
  }

  const task = await request.server.prisma.task.create({
    data: {
      programId: body.programId,
      stepId: body.stepId || null,
      dayNumber: body.dayNumber,
      title: body.title,
      description: body.description ?? null,
      deliverables: body.deliverables ?? null,
      contentUrl: body.contentUrl ?? null,
      basePoints: body.basePoints,
      proofType: body.proofType,
      estimatedMinutes: body.estimatedMinutes,
      isMilestone: body.isMilestone,
      milestoneLabel: body.milestoneLabel ?? null,
      bonusPoints: body.bonusPoints,
      sortOrder: body.sortOrder,
    },
    include: { program: { select: { id: true, name: true } } },
  });
  const timerSecs = body.timerSeconds != null ? Number(body.timerSeconds) : null;
  const memberId = body.memberId ?? null;
  if (timerSecs !== null || memberId !== null) {
    const setClauses: string[] = [];
    const vals: unknown[] = [];
    let pi = 1;
    if (timerSecs !== null) { setClauses.push(`timer_seconds = $${pi++}`); vals.push(timerSecs); }
    if (memberId !== null)  { setClauses.push(`member_id = $${pi++}::uuid`); vals.push(memberId); }
    vals.push(task.id);
    await request.server.prisma.$executeRawUnsafe(
      `UPDATE tasks SET ${setClauses.join(', ')} WHERE id = $${pi}::uuid`,
      ...vals
    );
  }
  void resolveTaskAudience(request.server.prisma, [task.id]).then((a) =>
    notifyWeeklyGraphChanged(request.server, a, 'task_created'));
  // Fetch member name for the response
  let memberName: string | null = null;
  if (memberId) {
    const member = await request.server.prisma.member.findUnique({
      where: { id: memberId },
      select: { firstName: true, lastName: true },
    }).catch(() => null);
    if (member) memberName = `${member.firstName ?? ''} ${member.lastName ?? ''}`.trim();
  }
  return reply.status(201).send({ success: true, data: { ...task, timerSeconds: timerSecs, memberId, memberName }, error: null });
}

export async function getTaskHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const task = await request.server.prisma.task.findUnique({
    where: { id },
    include: { program: true, submissions: { take: 10, orderBy: { createdAt: 'desc' } } },
  });
  if (!task) return reply.status(404).send({ success: false, data: null, error: 'Task not found' });
  return reply.send({ success: true, data: task, error: null });
}

export async function updateTaskHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  let body: ReturnType<typeof updateTaskSchema.parse>;
  try {
    body = updateTaskSchema.parse(request.body);
  } catch (err) {
    if (err instanceof ZodError) {
      return reply.status(400).send({ success: false, data: null, error: err.errors[0]?.message ?? 'Invalid input' });
    }
    throw err;
  }
  // Strip raw SQL-only columns before passing to Prisma
  const { timerSeconds, memberId, ...prismaBody } = body as any;
  // Normalize empty-string UUID fields to null (Postgres rejects "" as invalid UUID)
  const data: any = { ...prismaBody };
  if (data.stepId === '') data.stepId = null;
  const audienceBefore = await resolveTaskAudience(request.server.prisma, [id]);
  const task = await request.server.prisma.task.update({ where: { id }, data });

  // Persist raw SQL columns that Prisma doesn't know about
  const setClauses: string[] = [];
  const vals: unknown[] = [];
  let pi = 1;
  if (timerSeconds !== undefined) { setClauses.push(`timer_seconds = $${pi++}`); vals.push(timerSeconds != null ? Number(timerSeconds) : null); }
  if (memberId !== undefined) {
    if (memberId != null) { setClauses.push(`member_id = $${pi++}::uuid`); vals.push(memberId); }
    else                  { setClauses.push('member_id = NULL'); }
  }
  if (setClauses.length) {
    vals.push(id);
    await request.server.prisma.$executeRawUnsafe(
      `UPDATE tasks SET ${setClauses.join(', ')} WHERE id = $${pi}::uuid`,
      ...vals
    );
  }

  // A changed dayNumber moves the activity to another week; refresh everyone
  // who could see it before or after the change.
  void resolveTaskAudience(request.server.prisma, [id]).then((after) =>
    notifyWeeklyGraphChanged(request.server, mergeAudiences(audienceBefore, after), 'task_updated'));
  return reply.send({ success: true, data: { ...task, timerSeconds: timerSeconds ?? null, memberId: memberId ?? null }, error: null });
}

export async function deleteTaskHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const audience = await resolveTaskAudience(request.server.prisma, [id]);
  await request.server.prisma.task.delete({ where: { id } });
  void notifyWeeklyGraphChanged(request.server, audience, 'task_deleted');
  return reply.send({ success: true, data: null, error: null });
}

// PUT /api/tasks/submissions/:subId/review — admin approves or rejects a single task submission
export async function reviewTaskSubmissionHandler(request: FastifyRequest, reply: FastifyReply) {
  const { subId } = request.params as { subId: string };
  const { action, feedback, bonusPoints } = request.body as {
    action: 'approve' | 'reject';
    feedback?: string;
    bonusPoints?: number;
  };
  const admin = await request.server.prisma.admin.findFirst({ where: { clerkId: request.user }, select: { id: true } });
  const adminId = admin?.id ?? null;

  if (action !== 'approve' && action !== 'reject') {
    return reply.status(400).send({ success: false, data: null, error: 'action must be approve or reject' });
  }

  const sub = await request.server.prisma.$queryRawUnsafe<any[]>(
    `SELECT ts.*, t.base_points as "basePoints", t.bonus_points as "bonusPoints",
            t.is_milestone as "isMilestone", t.milestone_label as "milestoneLabel"
     FROM task_submissions ts JOIN tasks t ON t.id = ts.task_id WHERE ts.id = $1`,
    subId,
  );
  if (!sub[0]) return reply.status(404).send({ success: false, data: null, error: 'Submission not found' });
  const s = sub[0];

  // Guard: if already approved and admin is trying to approve again with no bonus,
  // block the duplicate to prevent re-awarding base points.
  const alreadyApproved = s.status === 'approved';
  if (alreadyApproved && action === 'approve' && !(bonusPoints && bonusPoints > 0)) {
    return reply.status(400).send({
      success: false,
      data: null,
      error: 'Submission already approved. Provide bonusPoints to award additional points.',
    });
  }

  const newStatus = action === 'approve' ? 'approved' : 'rejected';
  await request.server.prisma.$executeRawUnsafe(
    `UPDATE task_submissions SET status=$1, reviewed_by=$2, reviewed_at=NOW(), feedback=$3, updated_at=NOW() WHERE id=$4`,
    newStatus, adminId, feedback ?? null, subId,
  );

  if (action === 'approve') {
    // Status alone isn't enough: approve → reject → approve passes the
    // alreadyApproved check again. The ledger is the record of what was paid
    // (same check as the member self-assessment path), so never pay base or
    // milestone points for the same submission/task twice.
    const [basePaid, milestonePaid] = await Promise.all([
      request.server.prisma.pointsLedger.findFirst({
        where: { memberId: s.member_id, referenceType: 'task_submission', referenceId: subId },
        select: { id: true },
      }),
      request.server.prisma.pointsLedger.findFirst({
        where: { memberId: s.member_id, referenceType: 'milestone', referenceId: s.task_id },
        select: { id: true },
      }),
    ]);

    // Base points — only award on first approval. If the day-approval path already set
    // status='approved', skip base points entirely to prevent double XP.
    if (!alreadyApproved && !basePaid && s.basePoints > 0) {
      await request.server.prisma.pointsLedger.create({
        data: {
          memberId: s.member_id,
          points: s.basePoints,
          reason: `Task approved`,
          referenceType: 'task_submission',
          referenceId: subId,
        },
      }).catch(() => {});
    }

    // Milestone bonus — only on first approval
    if (!alreadyApproved && !milestonePaid && s.isMilestone && s.bonusPoints > 0) {
      await request.server.prisma.pointsLedger.create({
        data: {
          memberId: s.member_id,
          points: s.bonusPoints,
          reason: s.milestoneLabel ? `Milestone: ${s.milestoneLabel}` : 'Milestone bonus',
          referenceType: 'milestone',
          referenceId: s.task_id,
        },
      }).catch(() => {});
    }

    // Admin-supplied bonus points — allowed at any time (first review or subsequent)
    if (bonusPoints && bonusPoints > 0) {
      await request.server.prisma.pointsLedger.create({
        data: {
          memberId: s.member_id,
          points: bonusPoints,
          reason: `Task review bonus`,
          referenceType: 'task_submission',
          referenceId: subId,
        },
      }).catch(() => {});
    }

    // Batch-inline tasks (batch_id set) deep-link to that exact day; program
    // tasks (batch_id null) fall back to the batch program's own landing —
    // still a specific, relevant page rather than the generic dashboard.
    void notifyMembers(request.server, {
      memberIds: [s.member_id],
      title: 'Task Approved ✓',
      body: 'Your task submission has been approved.',
      type: 'task_approved',
      actionUrl: s.batch_id && s.day_number != null ? `/batch-program/${s.day_number}` : '/batch-program',
    });
  } else {
    void notifyMembers(request.server, {
      memberIds: [s.member_id],
      title: 'Task Needs Revision',
      body: feedback ?? 'Your task submission needs revision.',
      type: 'task_rejected',
      actionUrl: s.batch_id && s.day_number != null ? `/batch-program/${s.day_number}` : '/batch-program',
    });
  }

  void notifyWeeklyGraphChanged(request.server, { memberIds: [s.member_id] }, 'task_reviewed');
  return reply.send({ success: true, data: { id: subId, status: newStatus }, error: null });
}

// ── Task submissions across all batches (admin Tasks → Submissions tab) ──────
// GET /api/tasks/submissions?batchId=&status=&from=YYYY-MM-DD&to=YYYY-MM-DD&dayNumber=&search=&limit=&page=&order=
// batchId: a batch uuid, or "none" for submissions with no batch at all.
// order: "batch" (default — batch name, then newest) or "recent" (newest first).
// page: 1-based; rows are offset by (page-1)*limit.
// A submission's batch is its own batch_id, falling back to the member's batch
// (program-task submissions are stored without batch_id).
// from/to are IST calendar dates, both inclusive.
const SUBMISSION_STATUSES = ['pending', 'approved', 'rejected', 'resubmission_required'];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function listAllTaskSubmissionsHandler(request: FastifyRequest, reply: FastifyReply) {
  const q = request.query as {
    batchId?: string; status?: string; from?: string; to?: string;
    dayNumber?: string; search?: string; limit?: string; page?: string; order?: string;
  };

  if (q.order && q.order !== 'batch' && q.order !== 'recent') {
    return reply.status(400).send({ success: false, data: null, error: 'order must be "batch" or "recent"' });
  }
  if (q.batchId && q.batchId !== 'none' && !UUID_RE.test(q.batchId)) {
    return reply.status(400).send({ success: false, data: null, error: 'batchId must be a batch id or "none"' });
  }
  if (q.status && !SUBMISSION_STATUSES.includes(q.status)) {
    return reply.status(400).send({ success: false, data: null, error: `status must be one of ${SUBMISSION_STATUSES.join(', ')}` });
  }
  if ((q.from && !ISO_DATE.test(q.from)) || (q.to && !ISO_DATE.test(q.to))) {
    return reply.status(400).send({ success: false, data: null, error: 'from/to must be YYYY-MM-DD' });
  }
  const dayNumber = q.dayNumber ? parseInt(q.dayNumber, 10) : null;
  if (q.dayNumber && (!Number.isFinite(dayNumber) || (dayNumber as number) < 1)) {
    return reply.status(400).send({ success: false, data: null, error: 'dayNumber must be a positive integer' });
  }
  const limit = Math.min(1000, Math.max(1, parseInt(q.limit ?? '500', 10) || 500));
  const page = Math.max(1, parseInt(q.page ?? '1', 10) || 1);
  const orderBy = q.order === 'recent'
    ? 'ts.created_at DESC, ts.id'
    : 'b.name ASC NULLS LAST, ts.created_at DESC, ts.id';
  const search = q.search?.trim() ? `%${q.search.trim()}%` : null;

  // Filters shared by the rows query and the per-status counts. Status itself is
  // applied to the rows only, so the count cards always show every status.
  const params: unknown[] = [];
  const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
  const where: string[] = [];
  if (q.batchId === 'none') where.push('COALESCE(ts.batch_id, m.batch_id) IS NULL');
  else if (q.batchId) where.push(`COALESCE(ts.batch_id, m.batch_id) = ${p(q.batchId)}::uuid`);
  if (q.from) where.push(`ts.created_at >= (${p(q.from)}::date)::timestamp AT TIME ZONE 'Asia/Kolkata'`);
  if (q.to) where.push(`ts.created_at < ((${p(q.to)}::date + 1))::timestamp AT TIME ZONE 'Asia/Kolkata'`);
  if (dayNumber) where.push(`ts.day_number = ${p(dayNumber)}::int`);
  if (search) {
    const s = p(search);
    where.push(`(m.first_name ILIKE ${s} OR m.last_name ILIKE ${s}
                 OR (m.first_name || ' ' || COALESCE(m.last_name, '')) ILIKE ${s}
                 OR m.phone ILIKE ${s} OR m.member_id ILIKE ${s} OR t.title ILIKE ${s})`);
  }
  const baseWhere = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const fromSql = `FROM task_submissions ts
     JOIN tasks t ON t.id = ts.task_id
     JOIN members m ON m.id = ts.member_id
     LEFT JOIN batches b ON b.id = COALESCE(ts.batch_id, m.batch_id)
     LEFT JOIN admins r ON r.id = ts.reviewed_by`;

  const countParams = [...params];
  const rowWhere = q.status
    ? `${baseWhere ? `${baseWhere} AND` : 'WHERE'} ts.status::text = ${p(q.status)}`
    : baseWhere;
  const limitParam = p(limit);
  const offsetParam = p((page - 1) * limit);

  const [rows, counts] = await Promise.all([
    request.server.prisma.$queryRawUnsafe<any[]>(
      `SELECT ts.id, ts.task_id AS "taskId", ts.member_id AS "memberId",
              ts.response_value AS "responseValue", ts.proof_url AS "proofUrl",
              ts.proof_type AS "proofType", ts.status::text AS status, ts.feedback,
              ts.day_number AS "dayNumber", ts.created_at AS "submittedAt",
              ts.updated_at AS "updatedAt", ts.reviewed_at AS "reviewedAt",
              r.full_name AS "reviewerName",
              ts.submitted_after_expiry AS "submittedAfterExpiry",
              ts.timer_started_at AS "timerStartedAt",
              t.title AS "taskTitle", t.base_points AS "basePoints",
              t.proof_type AS "taskProofType", t.deliverables, t.is_milestone AS "isMilestone",
              t.timer_seconds AS "timerSeconds",
              m.first_name AS "firstName", m.last_name AS "lastName", m.phone AS "memberPhone",
              m.member_id AS "memberCode", m.profile_photo_url AS "profilePhotoUrl",
              b.id AS "batchId", b.name AS "batchName"
       ${fromSql}
       ${rowWhere}
       ORDER BY ${orderBy}
       LIMIT ${limitParam}::int OFFSET ${offsetParam}::int`,
      ...params,
    ),
    request.server.prisma.$queryRawUnsafe<{ status: string; count: bigint }[]>(
      `SELECT ts.status::text AS status, COUNT(*) AS count ${fromSql} ${baseWhere} GROUP BY ts.status`,
      ...countParams,
    ),
  ]);

  const statusCounts: Record<string, number> = Object.fromEntries(SUBMISSION_STATUSES.map((s) => [s, 0]));
  for (const c of counts) statusCounts[c.status] = Number(c.count);
  const total = q.status
    ? statusCounts[q.status] ?? 0
    : Object.values(statusCounts).reduce((a, b) => a + b, 0);

  return reply.send({
    success: true,
    data: rows,
    meta: { total, returned: rows.length, limit, page, totalPages: Math.max(1, Math.ceil(total / limit)), statusCounts },
    error: null,
  });
}
