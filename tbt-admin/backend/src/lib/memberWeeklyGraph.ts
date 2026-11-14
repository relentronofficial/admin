// Loads one member's Weekly Activity Graph: their batch, active tasks that are
// global or assigned to them, their own submissions/day progress, their
// program's graph config, their admin-recorded milestones and their reported
// revenue — then renders it with the pure buildWeeklyGraph.
//
// Shared by the member's own graph (GET /api/user-batch/weekly-graph) and the
// admin's read-only view of a member (GET /api/weekly-graph/admin/members/:id/graph),
// so both always show exactly the same graph. Every query is scoped to memberId.
import type { PrismaClient } from '@prisma/client';
import { getCurrentDayNumber } from './weekChecklistLogic.js';
import { buildWeeklyGraph, type WeeklyGraph } from './weeklyGraphLogic.js';
import { backfillNewDefaultMilestones, loadGraphConfig, loadMemberGraphRecords, loadMemberRevenueRows, loadProgramWeekSpanDays } from './weeklyGraphConfigData.js';
import { revenueEntriesForProgram } from './weeklyGraphRevenue.js';

/** The member's graph, or null when they are not in a batch (or the batch is gone). */
export async function loadMemberWeeklyGraph(prisma: PrismaClient, memberId: string): Promise<WeeklyGraph | null> {
  const member = await prisma.member.findUnique({ where: { id: memberId }, select: { batchId: true } });
  if (!member?.batchId) return null;
  const batchId = member.batchId;

  const batch = await prisma.batch.findUnique({
    where: { id: batchId },
    select: { programId: true, snapshotDays: true, startsAt: true, program: { select: { durationDays: true } } },
  });
  if (!batch) return null;

  const [settings, taskRows, submissions, dayProgress] = await Promise.all([
    prisma.$queryRawUnsafe<Array<{ extended_days: number | null }>>(
      `SELECT extended_days FROM member_batch_settings WHERE batch_id=$1::uuid AND member_id=$2::uuid LIMIT 1`,
      batchId, memberId,
    ),
    // Same task set as GET /api/user-batch (active, this batch's inline tasks
    // OR the program's shared tasks), filtered to global or own assignments.
    prisma.$queryRawUnsafe<Array<{
      id: string; title: string; day_number: number; sort_order: number; is_required: boolean; member_id: string | null;
      is_milestone: boolean | null; milestone_label: string | null; graph_week_id: string | null; graph_milestone_id: string | null;
    }>>(
      `SELECT id::text, title, day_number, sort_order, is_required, member_id::text, is_milestone, milestone_label,
              graph_week_id::text, graph_milestone_id::text
       FROM tasks
       WHERE is_active = true
         AND (batch_id = $1::uuid OR ($2::uuid IS NOT NULL AND program_id = $2::uuid AND batch_id IS NULL))
         AND (member_id IS NULL OR member_id = $3::uuid)`,
      batchId, batch.programId ?? null, memberId,
    ),
    prisma.$queryRawUnsafe<Array<{ taskId: string; dayNumber: number | null; status: string }>>(
      `SELECT task_id::text AS "taskId", day_number AS "dayNumber", status::text AS status
       FROM task_submissions WHERE batch_id=$1::uuid AND member_id=$2::uuid`,
      batchId, memberId,
    ),
    prisma.memberDayProgress.findMany({
      where: { batchId, memberId },
      select: { dayNumber: true, status: true, completedTaskIds: true },
    }),
  ]);

  if (batch.programId) await backfillNewDefaultMilestones(prisma, batch.programId).catch(() => {});

  const [graphConfig, graphRecords, revenueRows] = await Promise.all([
    loadGraphConfig(prisma, batch.programId ?? null),
    loadMemberGraphRecords(prisma, memberId),
    loadMemberRevenueRows(prisma, memberId),
  ]);
  // Program never configured: default weeks over the same span the admin page shows.
  const defaultSpanDays = !graphConfig.weeks && batch.programId
    ? await loadProgramWeekSpanDays(prisma, batch.programId)
    : undefined;

  const baseDays = batch.snapshotDays ?? batch.program?.durationDays ?? 90;
  const totalDays = baseDays + (settings[0]?.extended_days ?? 0);

  return buildWeeklyGraph({
    memberId,
    tasks: taskRows.map((t) => ({
      id: t.id, title: t.title, dayNumber: t.day_number, sortOrder: t.sort_order,
      isRequired: t.is_required, memberId: t.member_id,
      isMilestone: t.is_milestone ?? false, milestoneLabel: t.milestone_label,
      graphWeekId: t.graph_week_id, graphMilestoneId: t.graph_milestone_id,
    })),
    submissions,
    dayProgress: dayProgress.map((p) => ({ dayNumber: p.dayNumber, status: p.status, completedTaskIds: p.completedTaskIds ?? [] })),
    totalDays,
    currentDay: getCurrentDayNumber(new Date(batch.startsAt)),
    // Admin-configured weeks/milestones of the member's program (defaults when
    // not configured) and this member's own admin-recorded achievements.
    config: graphConfig,
    records: graphRecords,
    // This member's own reported revenue (Your Revenue Stats), for revenue milestones.
    revenue: revenueEntriesForProgram(revenueRows, new Date(batch.startsAt)),
    defaultSpanDays,
  });
}
