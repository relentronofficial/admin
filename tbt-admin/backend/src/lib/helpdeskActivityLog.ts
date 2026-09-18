import type { PrismaClient } from '@prisma/client';

export type TicketActivityActorType = 'admin' | 'member' | 'system';

export interface TicketActivityEntry {
  id: string;
  ticketId: string;
  actorType: TicketActivityActorType;
  actorId: string | null;
  action: string;
  previousValue: string | null;
  newValue: string | null;
  createdAt: Date;
}

/** Immutable audit trail — raw SQL only, no Prisma model (see prisma.ts). */
export async function logTicketActivity(
  prisma: PrismaClient,
  entry: {
    ticketId: string;
    actorType: TicketActivityActorType;
    actorId?: string | null;
    action: string;
    previousValue?: string | null;
    newValue?: string | null;
  },
): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO helpdesk_ticket_activity_log
         (ticket_id, actor_type, actor_id, action, previous_value, new_value)
       VALUES ($1::uuid, $2, $3::uuid, $4, $5, $6)`,
      entry.ticketId,
      entry.actorType,
      entry.actorId ?? null,
      entry.action,
      entry.previousValue ?? null,
      entry.newValue ?? null,
    );
  } catch (err) {
    console.warn('[helpdeskActivityLog] DB write failed:', err);
  }
}

export async function listTicketActivity(
  prisma: PrismaClient,
  ticketId: string,
): Promise<TicketActivityEntry[]> {
  const rows = await prisma.$queryRawUnsafe<
    Array<{
      id: string;
      ticket_id: string;
      actor_type: TicketActivityActorType;
      actor_id: string | null;
      action: string;
      previous_value: string | null;
      new_value: string | null;
      created_at: Date;
    }>
  >(
    `SELECT id, ticket_id, actor_type, actor_id, action, previous_value, new_value, created_at
       FROM helpdesk_ticket_activity_log
      WHERE ticket_id = $1::uuid
      ORDER BY created_at ASC`,
    ticketId,
  );
  return rows.map((r) => ({
    id: r.id,
    ticketId: r.ticket_id,
    actorType: r.actor_type,
    actorId: r.actor_id,
    action: r.action,
    previousValue: r.previous_value,
    newValue: r.new_value,
    createdAt: r.created_at,
  }));
}

/** Member-safe subset — hides actor identity and internal-only actions. */
const MEMBER_VISIBLE_ACTIONS = new Set([
  'created',
  'acknowledged',
  'assigned',
  'status_changed',
  'priority_changed',
  'replied',
  'escalated',
  'resolved',
  'closed',
]);

export function toMemberSafeActivity(entries: TicketActivityEntry[]) {
  return entries
    .filter((e) => MEMBER_VISIBLE_ACTIONS.has(e.action))
    .map((e) => ({ action: e.action, newValue: e.newValue, createdAt: e.createdAt }));
}
