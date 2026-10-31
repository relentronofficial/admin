// I/O for the admin-configurable Weekly Activity Graph (pure rules: weeklyGraphConfig.ts).
// Raw SQL only — graph_weeks / graph_milestones / member_graph_milestone_records
// have no Prisma models (created by the startup DDL in plugins/prisma.ts).

import {
  DEFAULT_GRAPH_MILESTONES,
  defaultWeeks,
  resolveGraphConfig,
  type GraphConfig,
  type GraphMilestoneRow,
  type GraphWeekRow,
} from './weeklyGraphConfig.js';
import type { GraphRecordInput } from './weeklyGraphLogic.js';
import type { RevenueWeekRow } from './weeklyGraphRevenue.js';

type Prisma = any;

export async function loadProgramGraphRows(prisma: Prisma, programId: string): Promise<{ weeks: GraphWeekRow[]; milestones: GraphMilestoneRow[] }> {
  const [weeks, milestones] = await Promise.all([
    prisma.$queryRawUnsafe(
      `SELECT id::text, label, start_day AS "startDay", end_day AS "endDay", sort_order AS "sortOrder", is_active AS "isActive"
       FROM graph_weeks WHERE program_id = $1::uuid ORDER BY sort_order, label`,
      programId,
    ).catch(() => []),
    prisma.$queryRawUnsafe(
      `SELECT id::text, label, kind, sort_order AS "sortOrder", is_active AS "isActive",
              threshold_amount::float8 AS "threshold"
       FROM graph_milestones WHERE program_id = $1::uuid ORDER BY sort_order, label`,
      programId,
    ).catch(() => []),
  ]);
  return { weeks: weeks as GraphWeekRow[], milestones: milestones as GraphMilestoneRow[] };
}

/** The graph config for a program; no program (or no rows) → built-in defaults. */
export async function loadGraphConfig(prisma: Prisma, programId: string | null): Promise<GraphConfig> {
  if (!programId) return resolveGraphConfig({ weeks: [], milestones: [] });
  return resolveGraphConfig(await loadProgramGraphRows(prisma, programId));
}

/** This member's admin-recorded achievements (always scoped to the one member). */
export async function loadMemberGraphRecords(prisma: Prisma, memberId: string): Promise<GraphRecordInput[]> {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT milestone_id::text AS "milestoneId", week_id::text AS "weekId"
     FROM member_graph_milestone_records WHERE member_id = $1::uuid`,
    memberId,
  ).catch(() => []);
  return rows as GraphRecordInput[];
}

/**
 * This member's reported weekly revenue (member_revenue_reports — the figure
 * "Your Revenue Stats" shows). Always scoped to the one member; a failed read
 * yields no revenue data rather than an error, so the graph still renders.
 */
export async function loadMemberRevenueRows(prisma: Prisma, memberId: string): Promise<RevenueWeekRow[]> {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT year AS "isoYear", week_number AS "isoWeek", revenue_generated::float8 AS revenue
     FROM member_revenue_reports WHERE member_id = $1::uuid`,
    memberId,
  ).catch(() => []);
  return (rows as any[]).map((r) => ({
    isoYear: Number(r.isoYear),
    isoWeek: Number(r.isoWeek),
    revenue: r.revenue === null || r.revenue === undefined ? null : Number(r.revenue),
  }));
}

/**
 * Backfills default milestones that were added after a program was first
 * initialized. Safe to call on read paths (only writes when rows are missing).
 * Idempotent: each step guards with NOT EXISTS so repeated calls are no-ops.
 *
 * Currently handles: '5 Lakhs' revenue milestone (added Oct 2026).
 */
export async function backfillNewDefaultMilestones(prisma: Prisma, programId: string): Promise<void> {
  // Shift milestones above '1 lakh' up by one to make room.
  await prisma.$executeRawUnsafe(
    `UPDATE graph_milestones
     SET sort_order = sort_order + 1
     WHERE program_id = $1::uuid
       AND EXISTS (SELECT 1 FROM graph_milestones WHERE program_id = $1::uuid AND label = '1 lakh' AND kind = 'revenue')
       AND NOT EXISTS (SELECT 1 FROM graph_milestones WHERE program_id = $1::uuid AND label = '5 Lakhs' AND kind = 'revenue')
       AND sort_order > (
         SELECT sort_order FROM graph_milestones
         WHERE program_id = $1::uuid AND label = '1 lakh' AND kind = 'revenue' LIMIT 1
       )`,
    programId,
  ).catch(() => {});

  // Insert '5 Lakhs' between '1 lakh' and '1 crore'.
  await prisma.$executeRawUnsafe(
    `INSERT INTO graph_milestones (program_id, label, kind, sort_order)
     SELECT $1::uuid, '5 Lakhs', 'revenue',
            (SELECT sort_order + 1 FROM graph_milestones
             WHERE program_id = $1::uuid AND label = '1 lakh' AND kind = 'revenue' LIMIT 1)
     WHERE EXISTS (SELECT 1 FROM graph_milestones WHERE program_id = $1::uuid AND label = '1 lakh' AND kind = 'revenue')
       AND NOT EXISTS (SELECT 1 FROM graph_milestones WHERE program_id = $1::uuid AND label = '5 Lakhs' AND kind = 'revenue')`,
    programId,
  ).catch(() => {});
}

/**
 * Before the first admin edit of a program, write its current defaults as real
 * rows so every item gets a stable id. Idempotent (each set is only inserted while
 * the program has none). Also backfills any new default milestones that were added
 * after a program was first initialized. Existing milestone activities are then
 * linked to the new milestone ids by their label, so renaming a milestone later
 * keeps them linked.
 */
export async function ensureProgramGraphConfig(prisma: Prisma, programId: string): Promise<void> {
  const programRows = await prisma.$queryRawUnsafe(
    `SELECT duration_days AS "durationDays" FROM programs WHERE id = $1::uuid`, programId,
  );
  const durationDays = Number((programRows as any[])[0]?.durationDays ?? 0);

  const ms = DEFAULT_GRAPH_MILESTONES;
  const msValues = ms.map((_, i) => `($${i * 3 + 2}, $${i * 3 + 3}, $${i * 3 + 4}::int)`).join(', ');
  await prisma.$executeRawUnsafe(
    `INSERT INTO graph_milestones (program_id, label, kind, sort_order)
     SELECT $1::uuid, v.label, v.kind, v.sort_order FROM (VALUES ${msValues}) AS v(label, kind, sort_order)
     WHERE NOT EXISTS (SELECT 1 FROM graph_milestones WHERE program_id = $1::uuid)`,
    programId, ...ms.flatMap((m, i) => [m.label, m.kind, i]),
  );

  // Backfill any new default milestones added after this program was first initialized.
  await backfillNewDefaultMilestones(prisma, programId);

  const weeks = defaultWeeks(durationDays);
  if (weeks.length > 0) {
    const wValues = weeks.map((_, i) => `($${i * 4 + 2}, $${i * 4 + 3}::int, $${i * 4 + 4}::int, $${i * 4 + 5}::int)`).join(', ');
    await prisma.$executeRawUnsafe(
      `INSERT INTO graph_weeks (program_id, label, start_day, end_day, sort_order)
       SELECT $1::uuid, v.label, v.start_day, v.end_day, v.sort_order FROM (VALUES ${wValues}) AS v(label, start_day, end_day, sort_order)
       WHERE NOT EXISTS (SELECT 1 FROM graph_weeks WHERE program_id = $1::uuid)`,
      programId, ...weeks.flatMap((w, i) => [w.label, w.startDay, w.endDay, i]),
    );
  }

  // Link legacy milestone activities (free-text milestone_label) to the ids.
  await prisma.$executeRawUnsafe(
    `UPDATE tasks t SET graph_milestone_id = m.id
     FROM graph_milestones m
     WHERE m.program_id = $1::uuid
       AND t.graph_milestone_id IS NULL
       AND t.is_milestone = true
       AND (t.program_id = $1::uuid OR t.batch_id IN (SELECT id FROM batches WHERE program_id = $1::uuid))
       AND regexp_replace(lower(trim(t.milestone_label)), 's$', '') = regexp_replace(lower(trim(m.label)), 's$', '')`,
    programId,
  ).catch(() => {});
}
