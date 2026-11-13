import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { sendPushToMember } from '../../lib/pushNotifications.js';
import { getActingAdmin } from '../../lib/adminRole.js';
import { isFullAccessRole } from '../../lib/supportCallLogic.js';

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

  // Conditional on still being pending, so two admins approving at once can't
  // both pass the check above and grant a lifeline purchase twice.
  const approved = await req.server.prisma.$queryRawUnsafe<any[]>(
    `UPDATE credit_purchases SET status = 'approved', reviewed_by = $1, reviewed_at = NOW()
     WHERE id = $2::uuid AND status = 'pending' RETURNING id`,
    reviewedBy, id,
  );
  if (approved.length === 0) {
    return reply.status(409).send({ success: false, data: null, error: 'Already reviewed' });
  }

  const { credit_type, quantity, member_id } = purchase;

  if (credit_type === 'lifeline') {
    if (purchase.mbs_id) {
      await req.server.prisma.$executeRawUnsafe(
        `UPDATE member_batch_settings SET lifelines_total = lifelines_total + $1 WHERE id = $2::uuid`,
        quantity, purchase.mbs_id,
      );
    }
  }
  // Support credit types need no write here: the approved credit_purchases
  // row itself adds to the member's allocation (lib/supportQuota.ts). This
  // used to insert support_usage rows, which counted the purchase as a USED
  // call and reduced remaining quota.

  const approveTitle = 'Purchase Approved';
  const approveBody = `Your purchase of ${quantity}× ${credit_type.replace(/_/g, ' ')} has been approved!`;

  // In-app notification
  await req.server.prisma.appNotification.create({
    data: {
      title: approveTitle,
      message: approveBody,
      type: 'credit_approved',
      actionUrl: '/profile',
      recipients: { create: [{ memberId: member_id }] },
    },
  });

  // Socket notification
  const io = (req.server as any).io;
  if (io) {
    io.to(`user:${member_id}`).emit('notification', { type: 'credit_approved', title: approveTitle, message: approveBody, actionUrl: '/profile' });
    io.to(`user:${member_id}`).emit('credit_approved', { creditType: credit_type, quantity, message: approveBody });
  }

  // Push notification
  await sendPushToMember(req.server.prisma, member_id, approveTitle, approveBody, { type: 'credit_approved', creditType: credit_type });

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

  const rejectTitle = 'Purchase Not Approved';
  const rejectBody = adminNote ?? 'Your purchase request could not be approved.';

  // In-app notification
  await req.server.prisma.appNotification.create({
    data: {
      title: rejectTitle,
      message: rejectBody,
      type: 'credit_rejected',
      actionUrl: '/profile',
      recipients: { create: [{ memberId: purchase.member_id }] },
    },
  });

  // Socket notification
  const io = (req.server as any).io;
  if (io) {
    io.to(`user:${purchase.member_id}`).emit('notification', { type: 'credit_rejected', title: rejectTitle, message: rejectBody, actionUrl: '/profile' });
    io.to(`user:${purchase.member_id}`).emit('credit_rejected', { message: rejectBody });
  }

  // Push notification
  await sendPushToMember(req.server.prisma, purchase.member_id, rejectTitle, rejectBody, { type: 'credit_rejected' });

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

// ── TBT coin packages (admin) ─────────────────────────────────────────────────
// Sold via Razorpay at /api/user/coins/razorpay/create-order. Prices are fixed
// on each order when it is created, so editing a package never changes an
// order already in flight. Writes are limited to admin/super_admin.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const coinPackageSchema = z.object({
  label:     z.string().trim().min(1, 'Label is required').max(120),
  coins:     z.number().int().positive('Coins must be above 0').max(10_000_000),
  priceInr:  z.number().positive('Price must be above 0').max(10_000_000)
               .refine((v) => Math.round(v * 100) === v * 100, { message: 'Price can have at most 2 decimals' }),
  isActive:  z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

function coinPackageDto(r: any) {
  return {
    id: r.id as string,
    label: r.label as string,
    coins: Number(r.coins),
    priceInr: Number(r.price_inr),
    isActive: !!r.is_active,
    sortOrder: Number(r.sort_order ?? 0),
  };
}

async function requireCoinPackageEditor(req: FastifyRequest, reply: FastifyReply) {
  const acting = await getActingAdmin(req);
  if (!acting || !isFullAccessRole(acting.role)) {
    reply.status(403).send({ success: false, data: null, error: 'Only Admin and Super Admin accounts can manage coin packages.' });
    return null;
  }
  return acting;
}

export async function listCoinPackagesAdminHandler(req: FastifyRequest, reply: FastifyReply) {
  const rows = await req.server.prisma.$queryRawUnsafe<any[]>(
    `SELECT id, label, coins, price_inr, is_active, sort_order FROM coin_packages ORDER BY sort_order ASC, price_inr ASC`,
  );
  return ok(reply, rows.map(coinPackageDto));
}

export async function createCoinPackageHandler(req: FastifyRequest, reply: FastifyReply) {
  if (!(await requireCoinPackageEditor(req, reply))) return reply;
  const parsed = coinPackageSchema.safeParse(req.body);
  if (!parsed.success) return reply.status(400).send({ success: false, data: null, error: parsed.error.issues[0]?.message });
  const { label, coins, priceInr, isActive = true, sortOrder = 0 } = parsed.data;
  const rows = await req.server.prisma.$queryRawUnsafe<any[]>(
    `INSERT INTO coin_packages (label, coins, price_inr, is_active, sort_order)
     VALUES ($1, $2, $3, $4, $5) RETURNING id, label, coins, price_inr, is_active, sort_order`,
    label, coins, priceInr, isActive, sortOrder,
  );
  return reply.status(201).send({ success: true, data: coinPackageDto(rows[0]), error: null });
}

export async function updateCoinPackageHandler(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  if (!(await requireCoinPackageEditor(req, reply))) return reply;
  if (!UUID_RE.test(req.params.id)) return reply.status(404).send({ success: false, data: null, error: 'Package not found' });
  const parsed = coinPackageSchema.safeParse(req.body);
  if (!parsed.success) return reply.status(400).send({ success: false, data: null, error: parsed.error.issues[0]?.message });
  const { label, coins, priceInr, isActive = true, sortOrder = 0 } = parsed.data;
  const rows = await req.server.prisma.$queryRawUnsafe<any[]>(
    `UPDATE coin_packages SET label = $2, coins = $3, price_inr = $4, is_active = $5, sort_order = $6, updated_at = NOW()
     WHERE id = $1::uuid RETURNING id, label, coins, price_inr, is_active, sort_order`,
    req.params.id, label, coins, priceInr, isActive, sortOrder,
  );
  if (!rows[0]) return reply.status(404).send({ success: false, data: null, error: 'Package not found' });
  return ok(reply, coinPackageDto(rows[0]));
}

export async function deleteCoinPackageHandler(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  if (!(await requireCoinPackageEditor(req, reply))) return reply;
  if (!UUID_RE.test(req.params.id)) return reply.status(404).send({ success: false, data: null, error: 'Package not found' });
  // Past orders keep their coins/amount; their package_id is cleared by the FK.
  const n = await req.server.prisma.$executeRawUnsafe(`DELETE FROM coin_packages WHERE id = $1::uuid`, req.params.id);
  if (!n) return reply.status(404).send({ success: false, data: null, error: 'Package not found' });
  return ok(reply, { id: req.params.id });
}
