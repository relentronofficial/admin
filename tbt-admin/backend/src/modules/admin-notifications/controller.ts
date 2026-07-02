import type { FastifyRequest, FastifyReply } from 'fastify';

interface AdminNotifRow {
  id: string;
  title: string;
  body: string;
  type: string;
  metadata: unknown;
  is_read: boolean;
  created_at: Date;
}

export async function listAdminNotificationsHandler(req: FastifyRequest, reply: FastifyReply) {
  const { page = 1, limit = 30 } = req.query as { page?: number; limit?: number };
  const offset = (Number(page) - 1) * Number(limit);

  const [rows, countRows] = await Promise.all([
    req.server.prisma.$queryRawUnsafe<AdminNotifRow[]>(
      `SELECT id, title, body, type, metadata, is_read, created_at
       FROM admin_notifications
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      Number(limit),
      offset,
    ),
    req.server.prisma.$queryRawUnsafe<[{ count: bigint }]>(
      `SELECT COUNT(*) as count FROM admin_notifications`,
    ),
  ]);

  const total = Number(countRows[0]?.count ?? 0);
  const notifications = rows.map(r => ({
    id: r.id,
    title: r.title,
    body: r.body,
    type: r.type,
    metadata: r.metadata,
    isRead: r.is_read,
    createdAt: r.created_at,
  }));

  return reply.send({ success: true, data: notifications, meta: { total, page: Number(page), limit: Number(limit) }, error: null });
}

export async function getAdminUnreadCountHandler(req: FastifyRequest, reply: FastifyReply) {
  const rows = await req.server.prisma.$queryRawUnsafe<[{ count: bigint }]>(
    `SELECT COUNT(*) as count FROM admin_notifications WHERE is_read = false`,
  );
  return reply.send({ success: true, data: { count: Number(rows[0]?.count ?? 0) }, error: null });
}

export async function markAdminNotificationReadHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  await req.server.prisma.$executeRawUnsafe(
    `UPDATE admin_notifications SET is_read = true WHERE id = $1`,
    id,
  );
  return reply.send({ success: true, data: null, error: null });
}

export async function markAllAdminNotificationsReadHandler(req: FastifyRequest, reply: FastifyReply) {
  await req.server.prisma.$executeRawUnsafe(
    `UPDATE admin_notifications SET is_read = true WHERE is_read = false`,
  );
  return reply.send({ success: true, data: null, error: null });
}
