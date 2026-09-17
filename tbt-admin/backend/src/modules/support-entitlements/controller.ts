import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

const updateEntitlementSchema = z.object({
  techSupportDays:  z.number().int().min(0),
  adSupportDays:    z.number().int().min(0),
  groupCallCount:   z.number().int().min(0),
  callCreditCount:  z.number().int().min(0),
  oneToOneEnabled:  z.boolean(),
});

const recordUsageSchema = z.object({
  memberId: z.string().uuid(),
  type:     z.enum(['tech_support', 'ad_support', 'group_call', 'one_to_one']),
  batchId:  z.string().uuid().optional(),
  notes:    z.string().optional(),
});

// GET /api/support-entitlements — list all plan rows
export async function listEntitlementsHandler(req: FastifyRequest, reply: FastifyReply) {
  const rows = await req.server.prisma.$queryRawUnsafe<any[]>(
    `SELECT plan, tech_support_days, ad_support_days, group_call_count, call_credit_count,
            one_to_one_enabled, updated_at
     FROM plan_entitlements ORDER BY
       CASE plan WHEN 'free' THEN 1 WHEN 'starter' THEN 2 WHEN 'premium' THEN 3
                 WHEN 'vip' THEN 4 WHEN 'enterprise' THEN 5 ELSE 9 END`
  );
  return reply.send({ success: true, data: rows, error: null });
}

// PUT /api/support-entitlements/:plan — update one plan's entitlements
export async function updateEntitlementHandler(
  req: FastifyRequest<{ Params: { plan: string } }>,
  reply: FastifyReply,
) {
  const { plan } = req.params;
  const parsed = updateEntitlementSchema.safeParse(req.body);
  if (!parsed.success) {
    return reply.status(400).send({ success: false, data: null, error: parsed.error.issues[0]?.message });
  }
  const { techSupportDays, adSupportDays, groupCallCount, callCreditCount, oneToOneEnabled } = parsed.data;

  await req.server.prisma.$executeRawUnsafe(
    `INSERT INTO plan_entitlements (plan, tech_support_days, ad_support_days, group_call_count, call_credit_count, one_to_one_enabled, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (plan) DO UPDATE SET
       tech_support_days  = EXCLUDED.tech_support_days,
       ad_support_days    = EXCLUDED.ad_support_days,
       group_call_count   = EXCLUDED.group_call_count,
       call_credit_count  = EXCLUDED.call_credit_count,
       one_to_one_enabled = EXCLUDED.one_to_one_enabled,
       updated_at         = NOW()`,
    plan, techSupportDays, adSupportDays, groupCallCount, callCreditCount, oneToOneEnabled,
  );

  return reply.send({ success: true, data: { plan }, error: null });
}

// GET /api/support-entitlements/usage — paginated support usage log (admin)
export async function listUsageHandler(
  req: FastifyRequest<{ Querystring: { memberId?: string; type?: string; page?: string; limit?: string } }>,
  reply: FastifyReply,
) {
  const { memberId, type, page = '1', limit = '50' } = req.query;
  const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

  const conditions: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (memberId) { conditions.push(`su.member_id = $${idx++}::uuid`); values.push(memberId); }
  if (type)     { conditions.push(`su.type = $${idx++}`);             values.push(type); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows, total] = await Promise.all([
    req.server.prisma.$queryRawUnsafe<any[]>(
      `SELECT su.id, su.member_id, su.type, su.notes, su.recorded_by, su.used_at, su.batch_id,
              m.first_name, m.last_name, m.phone
       FROM support_usage su
       JOIN members m ON m.id = su.member_id
       ${where}
       ORDER BY su.used_at DESC
       LIMIT ${parseInt(limit, 10)} OFFSET ${offset}`,
      ...values,
    ),
    req.server.prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*)::int AS count FROM support_usage su ${where}`,
      ...values,
    ),
  ]);

  return reply.send({
    success: true,
    data: rows,
    meta: { total: (total[0] as any)?.count ?? 0, page: parseInt(page, 10), limit: parseInt(limit, 10) },
    error: null,
  });
}

// POST /api/support-entitlements/usage — admin records a support session
export async function recordUsageHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = recordUsageSchema.safeParse(req.body);
  if (!parsed.success) {
    return reply.status(400).send({ success: false, data: null, error: parsed.error.issues[0]?.message });
  }
  const { memberId, type, batchId, notes } = parsed.data;
  const recordedBy = req.user as string;

  const member = await req.server.prisma.member.findUnique({
    where: { id: memberId },
    select: { id: true, membershipPlan: true },
  });
  if (!member) return reply.status(404).send({ success: false, data: null, error: 'Member not found' });

  await req.server.prisma.$executeRawUnsafe(
    `INSERT INTO support_usage (member_id, batch_id, type, notes, recorded_by)
     VALUES ($1::uuid, $2, $3, $4, $5)`,
    memberId, batchId ?? null, type, notes ?? null, recordedBy,
  );

  return reply.send({ success: true, data: { memberId, type }, error: null });
}

// DELETE /api/support-entitlements/usage/:id — admin corrects a mistaken record
export async function deleteUsageHandler(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  await req.server.prisma.$executeRawUnsafe(
    `DELETE FROM support_usage WHERE id = $1::uuid`, req.params.id,
  );
  return reply.send({ success: true, data: null, error: null });
}

// GET /api/support-entitlements/member/:memberId — admin view of a specific member's quota
export async function getMemberSupportQuotaHandler(
  req: FastifyRequest<{ Params: { memberId: string } }>,
  reply: FastifyReply,
) {
  const { memberId } = req.params;

  const member = await req.server.prisma.member.findUnique({
    where: { id: memberId },
    select: { membershipPlan: true, batchId: true },
  });
  if (!member) return reply.status(404).send({ success: false, data: null, error: 'Member not found' });

  const plan = (member.membershipPlan as string | null) ?? 'free';

  const [entRows, usageRows, lifelineRows] = await Promise.all([
    req.server.prisma.$queryRawUnsafe<any[]>(
      `SELECT tech_support_days, ad_support_days, group_call_count, call_credit_count, one_to_one_enabled
       FROM plan_entitlements WHERE plan = $1`,
      plan,
    ),
    req.server.prisma.$queryRawUnsafe<any[]>(
      `SELECT type, COUNT(*)::int AS cnt FROM support_usage WHERE member_id = $1::uuid GROUP BY type`,
      memberId,
    ),
    member.batchId
      ? req.server.prisma.$queryRawUnsafe<any[]>(
          `SELECT lifelines_total, lifelines_used FROM member_batch_settings WHERE member_id = $1::uuid AND batch_id = $2::uuid LIMIT 1`,
          memberId, member.batchId,
        )
      : Promise.resolve([]),
  ]);

  const ent = entRows[0] ?? { tech_support_days: 0, ad_support_days: 0, group_call_count: 0, call_credit_count: 0, one_to_one_enabled: false };
  const usageMap: Record<string, number> = {};
  for (const row of usageRows) usageMap[(row as any).type] = (row as any).cnt;

  const lifelinesTotal = (lifelineRows[0] as any)?.lifelines_total ?? 3;
  const lifelinesUsed  = (lifelineRows[0] as any)?.lifelines_used  ?? 0;

  return reply.send({
    success: true,
    data: {
      plan,
      techSupport:  { allocated: ent.tech_support_days, used: usageMap['tech_support']  ?? 0, remaining: Math.max(0, ent.tech_support_days  - (usageMap['tech_support']  ?? 0)) },
      adSupport:    { allocated: ent.ad_support_days,   used: usageMap['ad_support']    ?? 0, remaining: Math.max(0, ent.ad_support_days    - (usageMap['ad_support']    ?? 0)) },
      groupCall:    { allocated: ent.group_call_count,  used: usageMap['group_call']    ?? 0, remaining: Math.max(0, ent.group_call_count    - (usageMap['group_call']    ?? 0)) },
      callCredits:  { allocated: ent.call_credit_count, used: usageMap['one_to_one']    ?? 0, remaining: Math.max(0, ent.call_credit_count   - (usageMap['one_to_one']    ?? 0)) },
      oneToOne:     !!ent.one_to_one_enabled,
      lifelines:    { total: lifelinesTotal, used: lifelinesUsed, remaining: Math.max(0, lifelinesTotal - lifelinesUsed) },
    },
    error: null,
  });
}
