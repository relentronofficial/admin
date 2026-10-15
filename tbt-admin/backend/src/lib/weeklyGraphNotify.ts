// Tells exactly the members whose Weekly Activity Graph changed to refetch it.
// Emits `batch:graph_updated` to each affected `user:{memberId}` room only —
// never to a batch/program-wide room — so no member learns about another
// member's assignments. Fire-and-forget: never throws into the caller.

export interface GraphAudience {
  memberIds: string[];
  batchIds: string[];
  programIds: string[];
}

const emptyAudience = (): GraphAudience => ({ memberIds: [], batchIds: [], programIds: [] });

/**
 * Who can see these tasks: a member-specific task (tasks.member_id) reaches
 * only that member; otherwise the task's batch, or the program it belongs to.
 * Call this BEFORE an update/delete as well as after an update, so both the
 * old and the new audience refresh when an assignment moves.
 */
export async function resolveTaskAudience(prisma: any, taskIds: string[]): Promise<GraphAudience> {
  const audience = emptyAudience();
  const ids = taskIds.filter(Boolean);
  if (ids.length === 0) return audience;
  const rows = await prisma.$queryRawUnsafe(
    `SELECT batch_id::text AS "batchId", program_id::text AS "programId", member_id::text AS "memberId"
     FROM tasks WHERE id = ANY($1::uuid[])`,
    ids,
  ).catch(() => []) as Array<{ batchId: string | null; programId: string | null; memberId: string | null }>;
  for (const r of rows) {
    if (r.memberId) audience.memberIds.push(r.memberId);
    else if (r.batchId) audience.batchIds.push(r.batchId);
    else if (r.programId) audience.programIds.push(r.programId);
  }
  return audience;
}

export function mergeAudiences(...audiences: Partial<GraphAudience>[]): GraphAudience {
  const out = emptyAudience();
  for (const a of audiences) {
    out.memberIds.push(...(a.memberIds ?? []));
    out.batchIds.push(...(a.batchIds ?? []));
    out.programIds.push(...(a.programIds ?? []));
  }
  return out;
}

export async function notifyWeeklyGraphChanged(
  server: { prisma: any; io: any },
  audience: Partial<GraphAudience>,
  reason: string,
): Promise<void> {
  try {
    const memberIds = new Set(audience.memberIds ?? []);
    const batchIds = [...new Set(audience.batchIds ?? [])];
    const programIds = [...new Set(audience.programIds ?? [])];

    if (batchIds.length > 0) {
      const rows = await server.prisma.member.findMany({
        where: { batchId: { in: batchIds } },
        select: { id: true },
      });
      for (const r of rows) memberIds.add(r.id);
    }
    if (programIds.length > 0) {
      const rows = await server.prisma.$queryRawUnsafe(
        `SELECT m.id::text AS id FROM members m JOIN batches b ON b.id = m.batch_id
         WHERE b.program_id = ANY($1::uuid[])`,
        programIds,
      ) as Array<{ id: string }>;
      for (const r of rows) memberIds.add(r.id);
    }

    for (const id of memberIds) {
      server.io?.to(`user:${id}`).emit('batch:graph_updated', { reason });
    }
  } catch {
    // Refresh is best-effort; the member's next page load is still correct.
  }
}
