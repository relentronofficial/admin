import type { FastifyRequest, FastifyReply } from 'fastify';

function ok(reply: FastifyReply, data: any) {
  return reply.send({ success: true, data, error: null });
}

// ── Admin handlers ────────────────────────────────────────────────────────────

export async function listPendingPurchasesHandler(req: FastifyRequest, reply: FastifyReply) {
  const rows = await req.server.prisma.$queryRawUnsafe<any[]>(
    `SELECT cp.id, cp.member_id, cp.credit_type, cp.quantity, cp.amount_inr, cp.status,
            cp.payment_ref, cp.admin_note, cp.created_at,
            m.first_name, m.last_name, m.phone, m.member_id AS member_code
     FROM credit_purchases cp
     JOIN members m ON m.id = cp.member_id
     WHERE cp.status = 'pending'
     ORDER BY cp.created_at DESC`,
  );
  return ok(reply, rows);
}

export async function listAllPurchasesHandler(
  req: FastifyRequest<{ Querystring: { memberId?: string; status?: string; page?: string; limit?: string } }>,
  reply: FastifyReply,
) {
  const { memberId, status, page = '1', limit = '50' } = req.query;
  const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const conditions: string[] = [];
  const values: any[] = [];
  let idx = 1;
  if (memberId) { conditions.push(`cp.member_id = $${idx++}::uuid`); values.push(memberId); }
  if (status)   { conditions.push(`cp.status = $${idx++}`);          values.push(status); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows, total] = await Promise.all([
    req.server.prisma.$queryRawUnsafe<any[]>(
      `SELECT cp.id, cp.member_id, cp.credit_type, cp.quantity, cp.amount_inr, cp.status,
              cp.payment_ref, cp.admin_note, cp.reviewed_by, cp.reviewed_at, cp.created_at,
              m.first_name, m.last_name, m.phone, m.member_id AS member_code
       FROM credit_purchases cp
       JOIN members m ON m.id = cp.member_id
       ${where}
       ORDER BY cp.created_at DESC
       LIMIT ${parseInt(limit, 10)} OFFSET ${offset}`,
      ...values,
    ),
    req.server.prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*)::int AS count FROM credit_purchases cp ${where}`,
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

export async function approvePurchaseHandler(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const { id } = req.params;
  const reviewedBy = req.user as string;

  const rows = await req.server.prisma.$queryRawUnsafe<any[]>(
    `SELECT cp.id, cp.member_id, cp.credit_type, cp.quantity, cp.status,
            mbs.id AS mbs_id, mbs.batch_id, mbs.lifelines_total
     FROM credit_purchases cp
     LEFT JOIN members m ON m.id = cp.member_id
     LEFT JOIN member_batch_settings mbs ON mbs.member_id = cp.member_id
     WHERE cp.id = $1::uuid LIMIT 1`,
    id,
  );

  const purchase = rows[0];
  if (!purchase) return reply.status(404).send({ success: false, data: null, error: 'Purchase not found' });
  if (purchase.status !== 'pending') {
    return reply.status(409).send({ success: false, data: null, error: 'Already reviewed' });
  }

  await req.server.prisma.$executeRawUnsafe(
    `UPDATE credit_purchases SET status = 'approved', reviewed_by = $1, reviewed_at = NOW() WHERE id = $2::uuid`,
    reviewedBy, id,
  );

  const { credit_type, quantity, member_id } = purchase;

  if (credit_type === 'lifeline') {
    if (purchase.mbs_id) {
      await req.server.prisma.$executeRawUnsafe(
        `UPDATE member_batch_settings SET lifelines_total = lifelines_total + $1 WHERE id = $2::uuid`,
        quantity, purchase.mbs_id,
      );
    }
  } else {
    // Map credit_type to support_usage type
    const supportType =
      credit_type === 'tech_support'                       ? 'tech_support'
      : credit_type === 'ad_support'                       ? 'ad_support'
      : (credit_type === 'group_call_45' || credit_type === 'group_call_60') ? 'group_call'
      : (credit_type === 'one_to_one_45' || credit_type === 'one_to_one_60') ? 'one_to_one'
      : null;

    if (supportType) {
      for (let i = 0; i < quantity; i++) {
        await req.server.prisma.$executeRawUnsafe(
          `INSERT INTO support_usage (member_id, type, notes, recorded_by) VALUES ($1::uuid, $2, $3, $4)`,
          member_id, supportType, `Credit purchase approved (${credit_type})`, reviewedBy,
        );
      }
    }
  }

  // Emit socket notification
  const io = (req.server as any).io;
  if (io) {
    io.to(`user:${member_id}`).emit('notification', {
      type: 'credit_approved',
      creditType: credit_type,
      quantity,
      message: `Your purchase of ${quantity}× ${credit_type.replace(/_/g, ' ')} has been approved!`,
    });
  }

  return ok(reply, { id, status: 'approved' });
}

export async function rejectPurchaseHandler(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const { id } = req.params;
  const { adminNote } = req.body as any;
  const reviewedBy = req.user as string;

  const rows = await req.server.prisma.$queryRawUnsafe<any[]>(
    `SELECT id, member_id, status FROM credit_purchases WHERE id = $1::uuid LIMIT 1`, id,
  );
  const purchase = rows[0];
  if (!purchase) return reply.status(404).send({ success: false, data: null, error: 'Purchase not found' });
  if (purchase.status !== 'pending') {
    return reply.status(409).send({ success: false, data: null, error: 'Already reviewed' });
  }

  await req.server.prisma.$executeRawUnsafe(
    `UPDATE credit_purchases SET status = 'rejected', admin_note = $1, reviewed_by = $2, reviewed_at = NOW() WHERE id = $3::uuid`,
    adminNote ?? null, reviewedBy, id,
  );

  const io = (req.server as any).io;
  if (io) {
    io.to(`user:${purchase.member_id}`).emit('notification', {
      type: 'credit_rejected',
      message: adminNote ?? 'Your purchase request could not be approved.',
    });
  }

  return ok(reply, { id, status: 'rejected' });
}

export async function getCreditPricingHandler(_req: FastifyRequest, reply: FastifyReply) {
  const rows = await _req.server.prisma.$queryRawUnsafe<any[]>(
    `SELECT credit_type, price_inr, label, description, updated_at FROM credit_pricing ORDER BY credit_type`,
  );
  return ok(reply, rows);
}

export async function updateCreditPricingHandler(
  req: FastifyRequest<{ Params: { creditType: string } }>,
  reply: FastifyReply,
) {
  const { creditType } = req.params;
  const { priceInr, label, description } = req.body as any;

  await req.server.prisma.$executeRawUnsafe(
    `UPDATE credit_pricing SET price_inr = $1, label = $2, description = $3, updated_at = NOW() WHERE credit_type = $4`,
    Number(priceInr), label, description ?? null, creditType,
  );
  return ok(reply, { creditType });
}

// ── User handlers ─────────────────────────────────────────────────────────────

export async function getUserCreditPricingHandler(req: FastifyRequest, reply: FastifyReply) {
  const rows = await req.server.prisma.$queryRawUnsafe<any[]>(
    `SELECT credit_type, price_inr, label, description FROM credit_pricing ORDER BY credit_type`,
  );
  return ok(reply, rows);
}

export async function createCreditPurchaseHandler(req: FastifyRequest, reply: FastifyReply) {
  const memberId = req.memberId!;
  const { creditType, quantity = 1, paymentRef } = req.body as any;

  if (!creditType) {
    return reply.status(400).send({ success: false, data: null, error: 'creditType is required' });
  }

  const pricing = await req.server.prisma.$queryRawUnsafe<any[]>(
    `SELECT price_inr FROM credit_pricing WHERE credit_type = $1 LIMIT 1`, creditType,
  );
  if (!pricing.length) {
    return reply.status(400).send({ success: false, data: null, error: 'Unknown credit type' });
  }

  const amountInr = Number(pricing[0].price_inr) * Number(quantity);

  const rows = await req.server.prisma.$queryRawUnsafe<any[]>(
    `INSERT INTO credit_purchases (member_id, credit_type, quantity, amount_inr, payment_ref)
     VALUES ($1::uuid, $2, $3, $4, $5) RETURNING id`,
    memberId, creditType, quantity, amountInr, paymentRef ?? null,
  );

  // Notify admin room
  const io = (req.server as any).io;
  if (io) {
    io.to('admin').emit('admin:credit_purchase', {
      memberId,
      creditType,
      quantity,
      amountInr,
      purchaseId: rows[0]?.id,
    });
  }

  return reply.status(201).send({ success: true, data: { id: rows[0]?.id, status: 'pending', amountInr }, error: null });
}

export async function getMyCreditPurchasesHandler(req: FastifyRequest, reply: FastifyReply) {
  const memberId = req.memberId!;
  const rows = await req.server.prisma.$queryRawUnsafe<any[]>(
    `SELECT id, credit_type, quantity, amount_inr, status, payment_ref, admin_note, created_at, reviewed_at
     FROM credit_purchases WHERE member_id = $1::uuid ORDER BY created_at DESC`,
    memberId,
  );
  return ok(reply, rows);
}
