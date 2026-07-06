import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { sendPushNotification } from '../../lib/firebase.js';
import { createAdminNotification } from '../../lib/adminNotifications.js';

async function sendBatchNotif(
  server: { prisma: any; io: any },
  memberId: string,
  title: string,
  message: string,
  type: string,
  pushData?: Record<string, string>,
): Promise<void> {
  await server.prisma.appNotification.create({
    data: {
      title,
      message,
      type,
      actionUrl: '/batch-program',
      recipients: { create: [{ memberId }] },
    },
  });
  server.io.to(`user:${memberId}`).emit('notification', { title, body: message, type });
  const member = await server.prisma.member.findUnique({
    where: { id: memberId },
    select: { pushToken: true },
  }).catch(() => null);
  if (member?.pushToken) {
    await sendPushNotification(member.pushToken, title, message, pushData);
  }
}

const saveDraftSchema = z.object({
  journalEntry: z.string().optional(),
  journalFileUrl: z.string().optional(),
  completedTaskIds: z.array(z.string()).optional(),
  // Legacy JSON-blob proof map (kept for backward compat reads)
  taskProofs: z.record(z.string()).optional(),
  // Unified per-task proof objects: { [taskId]: { value?, url?, type } }
  taskSubmissions: z.record(z.object({
    value: z.string().optional(),
    url: z.string().optional(),
    type: z.string().optional(),
  })).optional(),
});

const rejectSchema = z.object({
  reviewNote: z.string().min(1, 'Review note is required'),
});

// GET /api/user-batch — member's batch + day content + their progress + attendance + breaks
export async function getMyBatchHandler(req: FastifyRequest, reply: FastifyReply) {
  const memberId = req.memberId!;

  const member = await req.server.prisma.member.findUnique({
    where: { id: memberId },
    select: { batchId: true },
  });

  if (!member?.batchId) {
    return reply.send({ success: true, data: null, error: null });
  }

  const [batch, days, progress, attendance, breaks, settings, mySubmissions] = await Promise.all([
    req.server.prisma.batch.findUnique({
      where: { id: member.batchId },
      select: {
        id: true, name: true, description: true,
        programId: true, snapshotDays: true,
        startsAt: true, endsAt: true, isActive: true,
        program: { select: { name: true, durationDays: true } },
      },
    }),
    req.server.prisma.batchDay.findMany({
      where: { batchId: member.batchId },
      orderBy: { dayNumber: 'asc' },
    }),
    req.server.prisma.memberDayProgress.findMany({
      where: { batchId: member.batchId, memberId },
      orderBy: { dayNumber: 'asc' },
    }),
    req.server.prisma.$queryRawUnsafe<any[]>(
      `SELECT day_number, status, notes, marked_at FROM member_attendance WHERE batch_id=$1::uuid AND member_id=$2::uuid ORDER BY day_number ASC`,
      member.batchId, memberId,
    ),
    req.server.prisma.$queryRawUnsafe<any[]>(
      `SELECT id, start_day, end_day, reason, status, admin_note, created_at FROM batch_break_requests WHERE batch_id=$1::uuid AND member_id=$2::uuid ORDER BY created_at DESC`,
      member.batchId, memberId,
    ),
    req.server.prisma.$queryRawUnsafe<any[]>(
      `SELECT extended_days FROM member_batch_settings WHERE batch_id=$1::uuid AND member_id=$2::uuid LIMIT 1`,
      member.batchId, memberId,
    ),
    req.server.prisma.$queryRawUnsafe<any[]>(
      `SELECT task_id as "taskId", response_value as "responseValue", proof_url as "proofUrl",
              proof_type as "proofType", status, day_number as "dayNumber"
       FROM task_submissions WHERE batch_id=$1::uuid AND member_id=$2::uuid`,
      member.batchId, memberId,
    ),
  ]);

  const baseDays = (batch as any)?.snapshotDays ?? (batch as any)?.program?.durationDays ?? 90;
  const extendedDays = (settings[0] as any)?.extended_days ?? 0;
  const totalDays = baseDays + extendedDays;

  const programTasks = (batch as any)?.programId
    ? await req.server.prisma.task.findMany({
        where: { programId: (batch as any).programId },
        orderBy: [{ dayNumber: 'asc' }, { sortOrder: 'asc' }],
        select: {
          id: true,
          dayNumber: true,
          title: true,
          description: true,
          deliverables: true,
          contentUrl: true,
          basePoints: true,
          bonusPoints: true,
          proofType: true,
          estimatedMinutes: true,
          isMilestone: true,
          milestoneLabel: true,
          sortOrder: true,
        },
      })
    : [];

  return reply.send({
    success: true,
    data: {
      batch,
      programName: (batch as any)?.program?.name ?? null,
      totalDays,
      days,
      progress,
      attendance,
      breaks,
      programTasks,
      mySubmissions,
    },
    error: null,
  });
}

// PUT /api/user-batch/:dayNumber — save draft
export async function saveDraftHandler(
  req: FastifyRequest<{ Params: { dayNumber: string } }>,
  reply: FastifyReply,
) {
  const memberId = req.memberId!;
  const dayNum = parseInt(req.params.dayNumber, 10);
  if (dayNum < 1) {
    return reply.status(400).send({ success: false, data: null, error: 'Day number must be at least 1' });
  }

  const parsed = saveDraftSchema.safeParse(req.body);
  if (!parsed.success) return reply.status(400).send({ success: false, data: null, error: parsed.error.issues[0]?.message });

  const member = await req.server.prisma.member.findUnique({
    where: { id: memberId },
    select: { batchId: true },
  });
  if (!member?.batchId) return reply.status(400).send({ success: false, data: null, error: 'You are not in a batch' });

  const batchMeta = await req.server.prisma.batch.findUnique({
    where: { id: member.batchId },
    select: { startsAt: true },
  });
  const daysElapsedDraft = Math.floor((Date.now() - new Date((batchMeta as any)!.startsAt).getTime()) / 86_400_000);
  if (dayNum > daysElapsedDraft + 1) {
    return reply.status(400).send({ success: false, data: null, error: `Day ${dayNum} is not available yet` });
  }

  // Don't allow editing approved records
  const existing = await req.server.prisma.memberDayProgress.findUnique({
    where: { batchId_memberId_dayNumber: { batchId: member.batchId, memberId, dayNumber: dayNum } },
  });
  if (existing?.status === 'approved') {
    return reply.status(400).send({ success: false, data: null, error: 'This day has already been approved' });
  }

  const { taskProofs, taskSubmissions: taskSubmissionsInput, ...prismaData } = parsed.data;

  const record = await req.server.prisma.memberDayProgress.upsert({
    where: { batchId_memberId_dayNumber: { batchId: member.batchId, memberId, dayNumber: dayNum } },
    create: {
      batchId: member.batchId,
      memberId,
      dayNumber: dayNum,
      status: 'in_progress',
      ...prismaData,
    },
    update: {
      // Advance not_started → in_progress on first draft; preserve all other statuses
      status: existing?.status === 'not_started' ? 'in_progress' : (existing?.status ?? 'in_progress'),
      ...prismaData,
    },
  });

  // Legacy JSONB proof map (backward compat)
  if (taskProofs !== undefined) {
    await req.server.prisma.memberDayProgress.update({
      where: { id: record.id },
      data: { taskProofs },
    });
  }

  // Unified task submissions — upsert one row per task
  if (taskSubmissionsInput && Object.keys(taskSubmissionsInput).length > 0) {
    for (const [taskId, proof] of Object.entries(taskSubmissionsInput)) {
      await req.server.prisma.$executeRawUnsafe(
        `INSERT INTO task_submissions
           (id, member_id, task_id, batch_id, day_progress_id, day_number,
            response_value, proof_url, proof_type, status, created_at, updated_at)
         VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6, $7, $8, 'pending', NOW(), NOW())
         ON CONFLICT (member_id, task_id, batch_id, day_number)
         WHERE batch_id IS NOT NULL AND day_number IS NOT NULL
         DO UPDATE SET
           response_value = EXCLUDED.response_value,
           proof_url = EXCLUDED.proof_url,
           proof_type = EXCLUDED.proof_type,
           day_progress_id = EXCLUDED.day_progress_id,
           updated_at = NOW()`,
        memberId, taskId, member.batchId, record.id, dayNum,
        proof.value ?? null, proof.url ?? null, proof.type ?? null,
      );
    }
  }

  // Auto-mark attendance as present on draft save (DO NOTHING to preserve admin-set records)
  const onBreakDraft = await req.server.prisma.$queryRawUnsafe<any[]>(
    `SELECT id FROM batch_break_requests WHERE batch_id=$1::uuid AND member_id=$2::uuid AND status='approved' AND start_day<=$3 AND end_day>=$3 LIMIT 1`,
    member.batchId, memberId, dayNum,
  );
  await req.server.prisma.$executeRawUnsafe(
    `INSERT INTO member_attendance (member_id, batch_id, day_number, status, marked_at, updated_at)
     VALUES ($1::uuid,$2::uuid,$3,$4,NOW(),NOW())
     ON CONFLICT (member_id, batch_id, day_number) DO NOTHING`,
    memberId, member.batchId, dayNum, onBreakDraft.length > 0 ? 'break' : 'present',
  );

  return reply.send({ success: true, data: { ...record, taskProofs: taskProofs ?? null }, error: null });
}

// POST /api/user-batch/:dayNumber/submit — submit for approval
export async function submitDayHandler(
  req: FastifyRequest<{ Params: { dayNumber: string } }>,
  reply: FastifyReply,
) {
  const memberId = req.memberId!;
  const dayNum = parseInt(req.params.dayNumber, 10);

  const member = await req.server.prisma.member.findUnique({
    where: { id: memberId },
    select: { batchId: true, firstName: true, lastName: true, memberId: true },
  });
  if (!member?.batchId) return reply.status(400).send({ success: false, data: null, error: 'You are not in a batch' });

  const batchMetaSubmit = await req.server.prisma.batch.findUnique({
    where: { id: member.batchId },
    select: { startsAt: true },
  });
  const daysElapsedSubmit = Math.floor((Date.now() - new Date((batchMetaSubmit as any)!.startsAt).getTime()) / 86_400_000);
  if (dayNum > daysElapsedSubmit + 1) {
    return reply.status(400).send({ success: false, data: null, error: `Day ${dayNum} is not available yet` });
  }

  const existing = await req.server.prisma.memberDayProgress.findUnique({
    where: { batchId_memberId_dayNumber: { batchId: member.batchId, memberId, dayNumber: dayNum } },
  });
  if (existing?.status === 'approved') {
    return reply.status(400).send({ success: false, data: null, error: 'This day has already been approved' });
  }
  if (existing?.status === 'pending_approval') {
    return reply.status(400).send({ success: false, data: null, error: 'Already submitted for review' });
  }

  const record = await req.server.prisma.memberDayProgress.upsert({
    where: { batchId_memberId_dayNumber: { batchId: member.batchId, memberId, dayNumber: dayNum } },
    create: {
      batchId: member.batchId,
      memberId,
      dayNumber: dayNum,
      status: 'pending_approval',
      submittedAt: new Date(),
    },
    update: {
      status: 'pending_approval',
      submittedAt: new Date(),
      reviewNote: null,
    },
  });

  // Auto-mark attendance as present on submit (if not already recorded)
  const onBreak = await req.server.prisma.$queryRawUnsafe<any[]>(
    `SELECT id FROM batch_break_requests WHERE batch_id=$1::uuid AND member_id=$2::uuid AND status='approved' AND start_day<=$3 AND end_day>=$3 LIMIT 1`,
    member.batchId, memberId, dayNum,
  );
  await req.server.prisma.$executeRawUnsafe(
    `INSERT INTO member_attendance (member_id, batch_id, day_number, status, marked_at, updated_at)
     VALUES ($1::uuid,$2::uuid,$3,$4,NOW(),NOW())
     ON CONFLICT (member_id, batch_id, day_number) DO NOTHING`,
    memberId, member.batchId, dayNum, onBreak.length > 0 ? 'break' : 'present',
  );

  const memberName = `${member.firstName} ${member.lastName ?? ''}`.trim();

  // Notify admin room so they can review without polling
  req.server.io.to('admin').emit('admin:day_submitted', {
    memberId,
    memberName,
    memberCode: member.memberId,
    batchId: member.batchId,
    dayNumber: dayNum,
  });

  // Persist notification to admin bell
  void createAdminNotification(req.server.prisma, {
    title: 'Batch Day Submitted',
    body: `${memberName} submitted Day ${dayNum}.`,
    type: 'day_submitted',
    metadata: { memberId, batchId: member.batchId, dayNumber: dayNum, memberName },
  });

  return reply.send({ success: true, data: record, error: null });
}

// Admin: PUT /api/batches/:id/progress/:memberId/:dayNumber/approve
export async function approveDayHandler(
  req: FastifyRequest<{ Params: { id: string; memberId: string; dayNumber: string } }>,
  reply: FastifyReply,
) {
  const adminId = (req as any).auth?.sub ?? null;
  const dayNum = parseInt(req.params.dayNumber, 10);

  const record = await req.server.prisma.memberDayProgress.upsert({
    where: {
      batchId_memberId_dayNumber: {
        batchId: req.params.id,
        memberId: req.params.memberId,
        dayNumber: dayNum,
      },
    },
    create: {
      batchId: req.params.id,
      memberId: req.params.memberId,
      dayNumber: dayNum,
      status: 'approved',
      isCompleted: true,
      completedAt: new Date(),
      reviewedAt: new Date(),
      reviewedBy: adminId,
    },
    update: {
      status: 'approved',
      isCompleted: true,
      completedAt: new Date(),
      reviewedAt: new Date(),
      reviewedBy: adminId,
      reviewNote: null,
    },
  });

  const batchXp = await req.server.prisma.batch.findUnique({ where: { id: req.params.id }, select: { xpPerDay: true } });
  const xpPerDay = batchXp?.xpPerDay ?? 50;

  // Award day-level XP bonus (non-blocking)
  req.server.prisma.pointsLedger.create({
    data: {
      memberId: req.params.memberId,
      points: xpPerDay,
      reason: `Batch day ${dayNum} approved`,
      referenceType: 'batch_day',
      referenceId: record.id,
    },
  }).catch(() => {});

  // Award per-task basePoints + handle milestones (non-blocking)
  void (async () => {
    const submissions = await req.server.prisma.$queryRawUnsafe<any[]>(
      `SELECT ts.id, ts.task_id as "taskId", t.base_points as "basePoints",
              t.bonus_points as "bonusPoints", t.is_milestone as "isMilestone",
              t.milestone_label as "milestoneLabel"
       FROM task_submissions ts
       JOIN tasks t ON t.id = ts.task_id
       WHERE ts.day_progress_id = $1::uuid AND ts.status = 'pending'`,
      record.id,
    );

    for (const sub of submissions) {
      // Mark submission approved
      await req.server.prisma.$executeRawUnsafe(
        `UPDATE task_submissions SET status='approved', reviewed_by=$1, reviewed_at=NOW(), updated_at=NOW() WHERE id=$2::uuid`,
        adminId, sub.id,
      );
      // Award task base points
      if (sub.basePoints > 0) {
        await req.server.prisma.pointsLedger.create({
          data: {
            memberId: req.params.memberId,
            points: sub.basePoints,
            reason: `Task completed — day ${dayNum}`,
            referenceType: 'task_submission',
            referenceId: sub.id,
          },
        }).catch(() => {});
      }
      // Handle milestone
      if (sub.isMilestone) {
        await req.server.prisma.$executeRawUnsafe(
          `INSERT INTO member_milestones (id, member_id, milestone_id, achieved_at)
           SELECT gen_random_uuid(), $1::uuid, m.id, NOW()
           FROM milestones m
           WHERE m.program_id = (SELECT program_id FROM tasks WHERE id=$2::uuid) LIMIT 1
           ON CONFLICT DO NOTHING`,
          req.params.memberId, sub.taskId,
        ).catch(() => {});
        if (sub.bonusPoints > 0) {
          await req.server.prisma.pointsLedger.create({
            data: {
              memberId: req.params.memberId,
              points: sub.bonusPoints,
              reason: sub.milestoneLabel ? `Milestone: ${sub.milestoneLabel}` : `Milestone bonus — day ${dayNum}`,
              referenceType: 'milestone',
              referenceId: sub.taskId,
            },
          }).catch(() => {});
        }
      }
    }

    // Update streak
    await req.server.prisma.$executeRawUnsafe(
      `INSERT INTO streaks (id, member_id, current_streak, longest_streak, last_activity_date, created_at, updated_at)
       VALUES (gen_random_uuid(), $1::uuid, 1, 1, CURRENT_DATE, NOW(), NOW())
       ON CONFLICT (member_id) DO UPDATE SET
         current_streak = CASE
           WHEN streaks.last_activity_date = CURRENT_DATE - INTERVAL '1 day' THEN streaks.current_streak + 1
           WHEN streaks.last_activity_date = CURRENT_DATE THEN streaks.current_streak
           ELSE 1
         END,
         longest_streak = GREATEST(streaks.longest_streak,
           CASE
             WHEN streaks.last_activity_date = CURRENT_DATE - INTERVAL '1 day' THEN streaks.current_streak + 1
             ELSE 1
           END
         ),
         last_activity_date = CURRENT_DATE,
         updated_at = NOW()`,
      req.params.memberId,
    ).catch(() => {});
  })().catch(() => {});

  // Notify member in real-time
  req.server.io.to(`user:${req.params.memberId}`).emit('batch:day_approved', {
    dayNumber: dayNum,
    batchId: req.params.id,
    xpAwarded: xpPerDay,
  });

  // In-app + push notification (non-blocking)
  void sendBatchNotif(
    req.server,
    req.params.memberId,
    `Day ${dayNum} Approved! 🎉`,
    `You earned +${xpPerDay} XP. Keep going!`,
    'batch_day_approved',
    { batchId: req.params.id, dayNumber: String(dayNum) },
  ).catch(() => {});

  // Check batch completion (non-blocking)
  void (async () => {
    const [approvedCount, batchWithProgram, settings] = await Promise.all([
      req.server.prisma.memberDayProgress.count({
        where: { batchId: req.params.id, memberId: req.params.memberId, status: 'approved' },
      }),
      req.server.prisma.batch.findUnique({
        where: { id: req.params.id },
        select: { snapshotDays: true, program: { select: { durationDays: true } } },
      }),
      req.server.prisma.$queryRawUnsafe<any[]>(
        `SELECT extended_days FROM member_batch_settings WHERE batch_id=$1::uuid AND member_id=$2::uuid LIMIT 1`,
        req.params.id, req.params.memberId,
      ),
    ]);
    const baseDaysApprove = (batchWithProgram as any)?.snapshotDays ?? (batchWithProgram as any)?.program?.durationDays ?? 90;
    const totalDays = baseDaysApprove + ((settings[0] as any)?.extended_days ?? 0);
    if (approvedCount >= totalDays) {
      req.server.io.to(`user:${req.params.memberId}`).emit('batch:completed', {
        batchId: req.params.id,
        totalDays,
      });
      req.server.prisma.pointsLedger.create({
        data: {
          memberId: req.params.memberId,
          points: 500,
          reason: 'Batch completion bonus',
          referenceType: 'batch',
          referenceId: req.params.id,
        },
      }).catch(() => {});
      void sendBatchNotif(
        req.server,
        req.params.memberId,
        'Batch Complete! 🏆',
        `You completed all ${totalDays} days. Your certificate is ready.`,
        'batch_completed',
        { batchId: req.params.id },
      ).catch(() => {});
    }
  })().catch(() => {});

  return reply.send({ success: true, data: record, error: null });
}

// Admin: PUT /api/batches/:id/progress/:memberId/:dayNumber/reject
export async function rejectDayHandler(
  req: FastifyRequest<{ Params: { id: string; memberId: string; dayNumber: string } }>,
  reply: FastifyReply,
) {
  const parsed = rejectSchema.safeParse(req.body);
  if (!parsed.success) return reply.status(400).send({ success: false, data: null, error: parsed.error.issues[0]?.message });

  const adminId = (req as any).auth?.sub ?? null;
  const dayNum = parseInt(req.params.dayNumber, 10);

  const record = await req.server.prisma.memberDayProgress.upsert({
    where: {
      batchId_memberId_dayNumber: {
        batchId: req.params.id,
        memberId: req.params.memberId,
        dayNumber: dayNum,
      },
    },
    create: {
      batchId: req.params.id,
      memberId: req.params.memberId,
      dayNumber: dayNum,
      status: 'rejected',
      reviewNote: parsed.data.reviewNote,
      reviewedAt: new Date(),
      reviewedBy: adminId,
    },
    update: {
      status: 'rejected',
      isCompleted: false,
      completedAt: null,
      reviewNote: parsed.data.reviewNote,
      reviewedAt: new Date(),
      reviewedBy: adminId,
    },
  });

  // Notify member in real-time
  req.server.io.to(`user:${req.params.memberId}`).emit('batch:day_rejected', {
    dayNumber: dayNum,
    batchId: req.params.id,
    reviewNote: parsed.data.reviewNote,
  });

  // In-app + push notification (non-blocking)
  void sendBatchNotif(
    req.server,
    req.params.memberId,
    `Day ${dayNum} Needs Revision`,
    parsed.data.reviewNote.slice(0, 100),
    'batch_day_rejected',
    { batchId: req.params.id, dayNumber: String(dayNum) },
  ).catch(() => {});

  return reply.send({ success: true, data: record, error: null });
}

// Admin: POST /api/batches/:id/pending/bulk-approve
export async function bulkApproveDaysHandler(
  req: FastifyRequest<{ Params: { id: string }; Body: { items: Array<{ memberId: string; dayNumber: number }> } }>,
  reply: FastifyReply,
) {
  const adminId = (req as any).auth?.sub ?? null;
  const batchId = req.params.id;
  const { items } = req.body as any;

  if (!Array.isArray(items) || items.length === 0) {
    return reply.status(400).send({ success: false, data: null, error: 'items array is required' });
  }

  const batchXpBulk = await req.server.prisma.batch.findUnique({ where: { id: batchId }, select: { xpPerDay: true } });
  const xpPerDayBulk = batchXpBulk?.xpPerDay ?? 50;

  const results: any[] = [];
  for (const { memberId, dayNumber } of items) {
    const record = await req.server.prisma.memberDayProgress.upsert({
      where: { batchId_memberId_dayNumber: { batchId, memberId, dayNumber } },
      create: { batchId, memberId, dayNumber, status: 'approved', isCompleted: true, completedAt: new Date(), reviewedAt: new Date(), reviewedBy: adminId },
      update: { status: 'approved', isCompleted: true, completedAt: new Date(), reviewedAt: new Date(), reviewedBy: adminId, reviewNote: null },
    });

    req.server.prisma.pointsLedger.create({
      data: { memberId, points: xpPerDayBulk, reason: `Batch day ${dayNumber} approved`, referenceType: 'batch_day', referenceId: record.id },
    }).catch(() => {});

    req.server.io.to(`user:${memberId}`).emit('batch:day_approved', {
      dayNumber,
      batchId,
      xpAwarded: xpPerDayBulk,
    });

    void sendBatchNotif(
      req.server,
      memberId,
      `Day ${dayNumber} Approved! 🎉`,
      `You earned +${xpPerDayBulk} XP. Keep going!`,
      'batch_day_approved',
      { batchId, dayNumber: String(dayNumber) },
    ).catch(() => {});

    results.push(record);
  }

  return reply.send({ success: true, data: { approved: results.length }, error: null });
}

// POST /api/user-batch/attendance — mark attendance for a day
export async function markAttendanceHandler(req: FastifyRequest, reply: FastifyReply) {
  const memberId = req.memberId!;
  const { dayNumber, notes } = (req.body as any) ?? {};
  if (!dayNumber || typeof dayNumber !== 'number') {
    return reply.status(400).send({ success: false, data: null, error: 'dayNumber is required' });
  }

  const member = await req.server.prisma.member.findUnique({
    where: { id: memberId },
    select: { batchId: true },
  });
  if (!member?.batchId) return reply.status(400).send({ success: false, data: null, error: 'Not in a batch' });

  // Check if day is on approved break — mark as break
  const breaks = await req.server.prisma.$queryRawUnsafe<any[]>(
    `SELECT id FROM batch_break_requests WHERE batch_id=$1::uuid AND member_id=$2::uuid AND status='approved' AND start_day<=$3 AND end_day>=$3 LIMIT 1`,
    member.batchId, memberId, dayNumber,
  );
  const status = breaks.length > 0 ? 'break' : 'present';

  const [record] = await req.server.prisma.$queryRawUnsafe<any[]>(
    `INSERT INTO member_attendance (member_id, batch_id, day_number, status, notes, marked_at, updated_at)
     VALUES ($1::uuid,$2::uuid,$3,$4,$5,NOW(),NOW())
     ON CONFLICT (member_id, batch_id, day_number)
     DO UPDATE SET status=EXCLUDED.status, notes=EXCLUDED.notes, marked_at=NOW(), updated_at=NOW()
     RETURNING *`,
    memberId, member.batchId, dayNumber, status, notes ?? null,
  );
  return reply.send({ success: true, data: record, error: null });
}

// POST /api/user-batch/break — request a break
export async function requestBreakHandler(req: FastifyRequest, reply: FastifyReply) {
  const memberId = req.memberId!;
  const { startDay, endDay, reason } = (req.body as any) ?? {};
  if (!startDay || !endDay || startDay > endDay) {
    return reply.status(400).send({ success: false, data: null, error: 'Invalid day range' });
  }

  const member = await req.server.prisma.member.findUnique({
    where: { id: memberId },
    select: { batchId: true },
  });
  if (!member?.batchId) return reply.status(400).send({ success: false, data: null, error: 'Not in a batch' });

  const [record] = await req.server.prisma.$queryRawUnsafe<any[]>(
    `INSERT INTO batch_break_requests (member_id, batch_id, start_day, end_day, reason)
     VALUES ($1::uuid,$2::uuid,$3,$4,$5) RETURNING *`,
    memberId, member.batchId, startDay, endDay, reason ?? null,
  );
  return reply.send({ success: true, data: record, error: null });
}

// Admin: GET /api/batches/:id/pending — all pending approval records with task submissions
export async function getPendingApprovalsHandler(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const records = await req.server.prisma.memberDayProgress.findMany({
    where: { batchId: req.params.id, status: 'pending_approval' },
    include: {
      member: {
        select: { id: true, firstName: true, lastName: true, profilePhotoUrl: true, memberId: true },
      },
    },
    orderBy: [{ submittedAt: 'asc' }, { dayNumber: 'asc' }],
  });

  // Attach task submissions for each pending record
  const enriched = await Promise.all(records.map(async (rec) => {
    const submissions = await req.server.prisma.$queryRawUnsafe<any[]>(
      `SELECT ts.id, ts.task_id as "taskId", ts.response_value as "responseValue",
              ts.proof_url as "proofUrl", ts.proof_type as "proofType", ts.status,
              t.title, t.base_points as "basePoints", t.proof_type as "taskProofType",
              t.deliverables, t.is_milestone as "isMilestone"
       FROM task_submissions ts
       JOIN tasks t ON t.id = ts.task_id
       WHERE ts.day_progress_id = $1::uuid
       ORDER BY t.sort_order ASC, t.day_number ASC`,
      rec.id,
    );
    return { ...rec, taskSubmissions: submissions };
  }));

  return reply.send({ success: true, data: enriched, error: null });
}

// GET /api/user-batch/submissions — member's own task submissions for current batch
export async function getMySubmissionsHandler(req: FastifyRequest, reply: FastifyReply) {
  const memberId = req.memberId!;
  const member = await req.server.prisma.member.findUnique({
    where: { id: memberId },
    select: { batchId: true },
  });
  if (!member?.batchId) return reply.send({ success: true, data: [], error: null });

  const submissions = await req.server.prisma.$queryRawUnsafe<any[]>(
    `SELECT ts.id, ts.task_id as "taskId", ts.response_value as "responseValue",
            ts.proof_url as "proofUrl", ts.proof_type as "proofType", ts.status,
            ts.day_number as "dayNumber", ts.feedback,
            t.title, t.base_points as "basePoints"
     FROM task_submissions ts
     JOIN tasks t ON t.id = ts.task_id
     WHERE ts.batch_id=$1::uuid AND ts.member_id=$2::uuid
     ORDER BY ts.day_number ASC, t.sort_order ASC`,
    member.batchId, memberId,
  );
  return reply.send({ success: true, data: submissions, error: null });
}

// POST /api/user-batch/cron/batch-reminder — daily reminder for members who haven't submitted today
export async function batchReminderCronHandler(req: FastifyRequest, reply: FastifyReply) {
  const { env } = await import('../../config/env.js');
  const secret = (req.headers['x-cron-secret'] as string) || '';
  if (!env.CRON_SECRET || secret !== env.CRON_SECRET) {
    return reply.status(401).send({ success: false, data: null, error: 'Unauthorized' });
  }

  const today = new Date();
  const activeBatches = await req.server.prisma.batch.findMany({
    where: { isActive: true },
    select: {
      id: true,
      startsAt: true,
      members: { select: { id: true, firstName: true } },
    },
  });

  let notified = 0;
  for (const batch of activeBatches) {
    const currentDay = Math.floor((today.getTime() - new Date(batch.startsAt).getTime()) / 86_400_000) + 1;
    if (currentDay < 1) continue;

    for (const member of batch.members) {
      const progress = await req.server.prisma.memberDayProgress.findUnique({
        where: {
          batchId_memberId_dayNumber: { batchId: batch.id, memberId: member.id, dayNumber: currentDay },
        },
        select: { status: true },
      });

      const needsReminder = !progress || ['not_started', 'in_progress'].includes(progress.status ?? 'not_started');
      if (needsReminder) {
        notified++;
        void sendBatchNotif(
          req.server,
          member.id,
          `Day ${currentDay} reminder 📋`,
          `${member.firstName ?? 'Hey'}, don't forget to submit Day ${currentDay} of your batch program!`,
          'batch_day_reminder',
          { batchId: batch.id, dayNumber: String(currentDay) },
        ).catch(() => {});
      }
    }
  }

  return reply.send({ success: true, data: { notified }, error: null });
}

// GET /api/user-batch/certificate — generate + download batch completion certificate
export async function getBatchCertificateHandler(req: FastifyRequest, reply: FastifyReply) {
  const memberId = req.memberId!;

  const member = await req.server.prisma.member.findUnique({
    where: { id: memberId },
    select: { batchId: true, firstName: true, lastName: true },
  });
  if (!member?.batchId) {
    return reply.status(400).send({ success: false, data: null, error: 'You are not in a batch' });
  }

  const [batch, settings] = await Promise.all([
    req.server.prisma.batch.findUnique({
      where: { id: member.batchId },
      select: { name: true, snapshotDays: true, program: { select: { name: true, durationDays: true } } },
    }),
    req.server.prisma.$queryRawUnsafe<any[]>(
      `SELECT extended_days FROM member_batch_settings WHERE batch_id=$1::uuid AND member_id=$2::uuid LIMIT 1`,
      member.batchId, memberId,
    ),
  ]);

  const baseDaysCert = (batch as any)?.snapshotDays ?? (batch as any)?.program?.durationDays ?? 90;
  const totalDays = baseDaysCert + ((settings[0] as any)?.extended_days ?? 0);

  const approvedCount = await req.server.prisma.memberDayProgress.count({
    where: { batchId: member.batchId, memberId, status: 'approved' },
  });

  if (approvedCount < totalDays) {
    return reply.status(403).send({ success: false, data: null, error: `Certificate not earned — ${approvedCount}/${totalDays} days approved` });
  }

  const lastApproval = await req.server.prisma.memberDayProgress.findFirst({
    where: { batchId: member.batchId, memberId, status: 'approved' },
    orderBy: { reviewedAt: 'desc' },
    select: { reviewedAt: true },
  });

  const memberName = `${member.firstName}${member.lastName ? ' ' + member.lastName : ''}`;
  const batchTitle = (batch as any)?.program?.name ?? (batch as any)?.name ?? 'Batch Program';
  const completedAt = (lastApproval?.reviewedAt ?? new Date()).toISOString();
  const certId = Buffer.from(`${memberId}:${member.batchId}`).toString('base64url').slice(0, 16).toUpperCase();

  const { default: PDFDocument } = await import('pdfkit');
  const pdfBuffer: Buffer = await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 60 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width;

    doc.rect(0, 0, W, doc.page.height).fill('#0d0d0d');
    doc.rect(24, 24, W - 48, doc.page.height - 48).lineWidth(2).stroke('#dc2626');
    doc.moveTo(60, 80).lineTo(W - 60, 80).lineWidth(0.5).stroke('#444');
    doc.moveTo(60, doc.page.height - 80).lineTo(W - 60, doc.page.height - 80).lineWidth(0.5).stroke('#444');

    doc.fillColor('#dc2626').fontSize(10).font('Helvetica-Bold').text('TAMIL BUSINESS TRIBE', { align: 'center' });
    doc.fillColor('#ffffff').fontSize(32).font('Helvetica-Bold').text('CERTIFICATE OF COMPLETION', { align: 'center' });

    doc.fillColor('#333').rect(W / 2 - 40, 180, 80, 1).fill();
    doc.moveDown(0.5);
    doc.fillColor('#a0a0a0').fontSize(12).font('Helvetica').text('This certifies that', { align: 'center' });
    doc.fillColor('#ffffff').fontSize(28).font('Helvetica-Bold').text(memberName, { align: 'center' });
    doc.fillColor('#a0a0a0').fontSize(12).font('Helvetica').text('has successfully completed all', { align: 'center' });
    doc.fillColor('#dc2626').fontSize(20).font('Helvetica-Bold').text(`${batchTitle} — ${totalDays} Days`, { align: 'center' });

    doc.moveDown(0.5);
    const completedLabel = new Date(completedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    doc.fillColor('#a0a0a0').fontSize(10).font('Helvetica').text(`Completed: ${completedLabel}   ·   Certificate ID: ${certId}`, { align: 'center' });

    doc.end();
  });

  reply.header('Content-Type', 'application/pdf');
  reply.header('Content-Disposition', `attachment; filename="batch-certificate-${certId}.pdf"`);
  return reply.send(pdfBuffer);
}
