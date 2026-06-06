import type { FastifyReply, FastifyRequest } from 'fastify';

const EVENT_TYPE_LABELS: Record<string, string> = {
  EXCESSIVE_SKIPPING: 'Excessive Skipping',
  RAPID_EPISODE_SWITCHING: 'Rapid Episode Switching',
  ABNORMAL_PROGRESS_SPEED: 'Abnormal Progress Speed',
  MULTIPLE_DEVICES: 'Multiple Devices',
};

export async function listSecurityLogsHandler(request: FastifyRequest, reply: FastifyReply) {
  const { page = 1, limit = 25, eventType, memberId: filterMemberId, search } = request.query as {
    page?: number;
    limit?: number;
    eventType?: string;
    memberId?: string;
    search?: string;
  };

  const where: Record<string, unknown> = {};
  if (eventType) where.eventType = eventType;
  if (filterMemberId) where.memberId = filterMemberId;

  const [logs, total] = await Promise.all([
    request.server.prisma.securityLog.findMany({
      where: where as any,
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
      skip: (Number(page) - 1) * Number(limit),
    }),
    request.server.prisma.securityLog.count({ where: where as any }),
  ]);

  // Join member info in a single batch query
  const memberIds = [...new Set(logs.map((l) => l.memberId))];
  const members = memberIds.length
    ? await request.server.prisma.member.findMany({
        where: { id: { in: memberIds } },
        select: { id: true, firstName: true, lastName: true, email: true, memberId: true },
      })
    : [];
  const memberMap = new Map(members.map((m) => [m.id, m]));

  const data = logs
    .filter((l) => {
      if (!search?.trim()) return true;
      const s = search.trim().toLowerCase();
      const m = memberMap.get(l.memberId);
      return (
        l.eventType.toLowerCase().includes(s) ||
        (m?.email ?? '').toLowerCase().includes(s) ||
        (m?.firstName ?? '').toLowerCase().includes(s) ||
        (m?.memberId ?? '').toLowerCase().includes(s)
      );
    })
    .map((l) => {
      const m = memberMap.get(l.memberId);
      return {
        id: l.id,
        eventType: l.eventType,
        eventLabel: EVENT_TYPE_LABELS[l.eventType] ?? l.eventType,
        metadata: l.metadata ?? {},
        createdAt: l.createdAt.toISOString(),
        member: m
          ? {
              id: m.id,
              memberId: m.memberId,
              name: `${m.firstName}${m.lastName ? ' ' + m.lastName : ''}`,
              email: m.email,
            }
          : null,
      };
    });

  return reply.send({
    success: true,
    data,
    meta: { total, page: Number(page), limit: Number(limit) },
    error: null,
  });
}

export async function getSecurityLogStatsHandler(request: FastifyRequest, reply: FastifyReply) {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // last 7 days

  const [total, byType] = await Promise.all([
    request.server.prisma.securityLog.count({ where: { createdAt: { gt: since } } }),
    request.server.prisma.securityLog.groupBy({
      by: ['eventType'],
      _count: { eventType: true },
      where: { createdAt: { gt: since } },
      orderBy: { _count: { eventType: 'desc' } },
    }),
  ]);

  return reply.send({
    success: true,
    data: {
      totalLast7Days: total,
      byType: byType.map((b) => ({
        eventType: b.eventType,
        eventLabel: EVENT_TYPE_LABELS[b.eventType] ?? b.eventType,
        count: b._count.eventType,
      })),
    },
    error: null,
  });
}
