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

type Prisma = any;

export async function loadProgramGraphRows(prisma: Prisma, programId: string): Promise<{ weeks: GraphWeekRow[]; milestones: GraphMilestoneRow[] }> {
  const [weeks, milestones] = await Promise.all([
    prisma.$queryRawUnsafe(
      `SELECT id::text, label, start_day AS "startDay", end_day AS "endDay", sort_order AS "sortOrder", is_active AS "isActive"
       FROM graph_weeks WHERE program_id = $1::uuid ORDER BY sort_order, label`,
      programId,
    ).catch(() => []),
    prisma.$queryRawUnsafe(
      `SELECT id::text, label, kind, sort_order AS "sortOrder", is_active AS "isActive"
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
 * Before the first admin edit of a program, write its current defaults as real
 * rows so every item gets a stable id: the five default milestones and one
 * 7-day week per program week. Idempotent (each set is only inserted while the
 * program has none). Existing milestone activities are then linked to the new
 * milestone ids by their label, so renaming a milestone later keeps them linked.
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
