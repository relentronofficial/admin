// My Workspace → Member Activity. Only ever the logged-in admin's own assigned members
// (members.account_manager_id), whatever their role. SQL: lib/memberActivityFeed.ts.
import type { FastifyReply, FastifyRequest } from 'fastify';
import { getActingAdmin } from '../../lib/adminRole.js';
import { ACTIVITY_GROUPS, FEED_LIMIT, feedSql, isActionKind, unreadSql, type ActivityGroup } from '../../lib/memberActivityFeed.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const deny = (reply: FastifyReply) => reply.status(403).send({ success: false, data: null, error: 'Admin account not found' });

/** When this admin last opened the log; the last 24 hours for a first visit. */
async function seenAt(req: FastifyRequest, adminId: string): Promise<Date> {
  const [row] = await req.server.prisma.$queryRawUnsafe<Array<{ seen_at: Date }>>(
    `SELECT seen_at FROM admin_activity_seen WHERE admin_id = $1::uuid`, adminId);
  return row?.seen_at ?? new Date(Date.now() - 86_400_000);
}

// GET /activity?group=&memberId=&before=<iso>
export async function activityHandler(req: FastifyRequest, reply: FastifyReply) {
  const admin = await getActingAdmin(req);
  if (!admin) return deny(reply);
  const q = req.query as Record<string, string | undefined>;
  const group = ACTIVITY_GROUPS.includes(q.group as ActivityGroup) ? (q.group as ActivityGroup) : null;
  const before = q.before && !Number.isNaN(Date.parse(q.before)) ? new Date(q.before) : null;
  const memberId = q.memberId && UUID_RE.test(q.memberId) ? q.memberId : null;
  const asOf = new Date();
  const [rows, seen] = await Promise.all([
    req.server.prisma.$queryRawUnsafe<any[]>(feedSql(group), admin.id, before, memberId),
    seenAt(req, admin.id),
  ]);
  return reply.send({
    success: true,
    data: rows.map((r) => ({
      kind: r.kind, at: r.at, ref: r.ref, title: r.title, detail: r.detail,
      memberId: r.member_id, memberName: r.member_name, photoUrl: r.profile_photo_url, batchName: r.batch_name,
      isNew: isActionKind(r.kind) && new Date(r.at) > seen,
    })),
    meta: { asOf, nextBefore: rows.length >= FEED_LIMIT ? rows[rows.length - 1].at : null },
  });
}

// GET /activity/unread
export async function activityUnreadHandler(req: FastifyRequest, reply: FastifyReply) {
  const admin = await getActingAdmin(req);
  if (!admin) return deny(reply);
  const [row] = await req.server.prisma.$queryRawUnsafe<Array<{ n: number }>>(unreadSql(), admin.id, await seenAt(req, admin.id));
  return reply.send({ success: true, data: { count: row?.n ?? 0 } });
}

// POST /activity/seen { upTo } — never moves backwards, never into the future.
export async function activitySeenHandler(req: FastifyRequest, reply: FastifyReply) {
  const admin = await getActingAdmin(req);
  if (!admin) return deny(reply);
  const ms = Date.parse(String((req.body as any)?.upTo ?? ''));
  const upTo = new Date(Number.isNaN(ms) ? Date.now() : Math.min(ms, Date.now()));
  await req.server.prisma.$executeRawUnsafe(
    `INSERT INTO admin_activity_seen (admin_id, seen_at) VALUES ($1::uuid, $2::timestamptz)
     ON CONFLICT (admin_id) DO UPDATE SET seen_at = GREATEST(admin_activity_seen.seen_at, EXCLUDED.seen_at)`,
    admin.id, upTo);
  return reply.send({ success: true, data: null });
}
