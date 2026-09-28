import type { FastifyRequest, FastifyReply } from 'fastify';
import { getRazorpay } from '../../lib/razorpay.js';
import { createAdminNotification } from '../../lib/adminNotifications.js';
import { invalidateCache } from '../../lib/cache.js';

// ── RZ-02-A: GET /api/payments/stats ──────────────────────────────────────────

export async function getPaymentStatsHandler(req: FastifyRequest, reply: FastifyReply) {
  const [row] = await req.server.prisma.$queryRawUnsafe<any[]>(`
    SELECT
      COALESCE(SUM(CASE WHEN status='completed' THEN amount ELSE 0 END), 0)                                       AS "totalRevenue",
      COUNT(CASE WHEN status='pending' THEN 1 END)::int                                                           AS "pendingCount",
      COALESCE(SUM(CASE WHEN status='refunded' THEN amount ELSE 0 END), 0)                                        AS "refundedTotal",
      COALESCE(SUM(CASE WHEN status='completed' AND created_at >= date_trunc('month', NOW()) THEN amount ELSE 0 END), 0) AS "thisMonthRevenue",
      COALESCE(SUM(CASE WHEN status='completed' AND method='razorpay' THEN amount ELSE 0 END), 0)                 AS "razorpayRevenue",
      COALESCE(SUM(CASE WHEN status='completed' AND method IN ('manual','bank_transfer','upi') THEN amount ELSE 0 END), 0) AS "manualRevenue",
      COUNT(CASE WHEN status='failed' THEN 1 END)::int                                                            AS "failedCount"
    FROM course_payments
  `).catch(() => [{}] as any[]);

  return reply.send({
    success: true,
    data: {
      totalRevenue: Number(row?.totalRevenue ?? 0),
      pendingCount: Number(row?.pendingCount ?? 0),
      refundedTotal: Number(row?.refundedTotal ?? 0),
      thisMonthRevenue: Number(row?.thisMonthRevenue ?? 0),
      razorpayRevenue: Number(row?.razorpayRevenue ?? 0),
      manualRevenue: Number(row?.manualRevenue ?? 0),
      failedCount: Number(row?.failedCount ?? 0),
    },
  });
}

// ── RZ-02-B: GET /api/payments/list ───────────────────────────────────────────

export async function getPaymentListHandler(req: FastifyRequest, reply: FastifyReply) {
  const q = req.query as any;
  const page = Math.max(1, parseInt(q.page) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(q.limit) || 25));
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: any[] = [];
  let p = 1;

  if (q.method) { conditions.push(`cp.method = $${p++}`); params.push(q.method); }
  if (q.status) { conditions.push(`cp.status = $${p++}`); params.push(q.status); }
  if (q.courseId) { conditions.push(`cp.course_id = $${p++}::uuid`); params.push(q.courseId); }
  if (q.memberId) { conditions.push(`cp.member_id = $${p++}::uuid`); params.push(q.memberId); }
  if (q.dateFrom) { conditions.push(`cp.created_at >= $${p++}::timestamptz`); params.push(q.dateFrom); }
  if (q.dateTo) { conditions.push(`cp.created_at <= $${p++}::timestamptz`); params.push(q.dateTo); }
  if (q.search) {
    conditions.push(`(m.first_name ILIKE $${p} OR m.last_name ILIKE $${p} OR m.email ILIKE $${p})`);
    params.push(`%${q.search}%`); p++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const baseSelect = `
    FROM course_payments cp
    JOIN members m ON m.id = cp.member_id
    JOIN courses c ON c.id = cp.course_id
    ${where}
  `;

  const [rows, countRow, revenueRow] = await Promise.all([
    req.server.prisma.$queryRawUnsafe<any[]>(`
      SELECT
        cp.id, cp.amount, cp.currency, cp.method, cp.status,
        cp.reference, cp.notes, cp.paid_at AS "paidAt",
        cp.created_at AS "createdAt", cp.updated_at AS "updatedAt",
        cp.razorpay_order_id AS "razorpayOrderId",
        cp.razorpay_payment_id AS "razorpayPaymentId",
        cp.razorpay_refund_id AS "razorpayRefundId",
        cp.refunded_amount AS "refundedAmount",
        cp.refund_note AS "refundNote",
        m.id AS "memberId", m.first_name AS "memberFirstName",
        m.last_name AS "memberLastName", m.email AS "memberEmail", m.phone AS "memberPhone",
        c.id AS "courseId", c.title AS "courseTitle"
      ${baseSelect}
      ORDER BY cp.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `, ...params),
    req.server.prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*)::int AS total ${baseSelect}`, ...params
    ),
    req.server.prisma.$queryRawUnsafe<any[]>(
      `SELECT COALESCE(SUM(cp.amount), 0) AS revenue FROM course_payments cp
       JOIN members m ON m.id = cp.member_id
       JOIN courses c ON c.id = cp.course_id
       ${where} AND cp.status='completed'`, ...params
    ).catch(() => [{ revenue: 0 }] as any[]),
  ]).catch(() => [[], [{ total: 0 }], [{ revenue: 0 }]] as any);

  const total = Number(countRow?.[0]?.total ?? 0);
  const totalRevenue = Number(revenueRow?.[0]?.revenue ?? 0);

  const data = (rows ?? []).map((r: any) => ({
    id: r.id,
    amount: Number(r.amount ?? 0),
    currency: r.currency,
    method: r.method,
    status: r.status,
    reference: r.reference,
    notes: r.notes,
    paidAt: r.paidAt,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    razorpayOrderId: r.razorpayOrderId ?? null,
    razorpayPaymentId: r.razorpayPaymentId ?? null,
    razorpayRefundId: r.razorpayRefundId ?? null,
    refundedAmount: r.refundedAmount != null ? Number(r.refundedAmount) : null,
    refundNote: r.refundNote ?? null,
    member: {
      id: r.memberId,
      firstName: r.memberFirstName,
      lastName: r.memberLastName,
      email: r.memberEmail,
      phone: r.memberPhone,
    },
    course: { id: r.courseId, title: r.courseTitle },
  }));

  return reply.send({
    success: true,
    data,
    meta: { total, page, limit, totalRevenue },
  });
}

// ── RZ-02-C: GET /api/payments/analytics ──────────────────────────────────────

export async function getPaymentAnalyticsHandler(req: FastifyRequest, reply: FastifyReply) {
  const q = req.query as any;
  const days = Math.min(365, Math.max(1, parseInt(q.days) || 30));
  const groupBy: 'day' | 'month' = q.groupBy === 'month' ? 'month' : 'day';

  const dateTrunc = groupBy === 'month' ? 'month' : 'day';
  const dateFormat = groupBy === 'month' ? 'YYYY-MM' : 'YYYY-MM-DD';

  const [series, prevRow] = await Promise.all([
    req.server.prisma.$queryRawUnsafe<any[]>(`
      SELECT
        TO_CHAR(gs.period, '${dateFormat}') AS date,
        COALESCE(SUM(cp.amount), 0) AS total,
        COALESCE(SUM(CASE WHEN cp.method = 'razorpay' THEN cp.amount ELSE 0 END), 0) AS razorpay,
        COALESCE(SUM(CASE WHEN cp.method IN ('manual','bank_transfer','upi') THEN cp.amount ELSE 0 END), 0) AS manual
      FROM generate_series(
        date_trunc('${dateTrunc}', NOW() - INTERVAL '${days} days'),
        date_trunc('${dateTrunc}', NOW()),
        INTERVAL '1 ${dateTrunc}'
      ) AS gs(period)
      LEFT JOIN course_payments cp
        ON date_trunc('${dateTrunc}', cp.created_at) = gs.period
        AND cp.status = 'completed'
      GROUP BY gs.period
      ORDER BY gs.period
    `),
    req.server.prisma.$queryRawUnsafe<any[]>(`
      SELECT
        COALESCE(SUM(amount), 0) AS revenue
      FROM course_payments
      WHERE status='completed'
        AND created_at >= NOW() - INTERVAL '${days * 2} days'
        AND created_at < NOW() - INTERVAL '${days} days'
    `),
  ]).catch(() => [[], [{ revenue: 0 }]] as any);

  const seriesData = (series ?? []).map((r: any) => ({
    date: r.date,
    total: Number(r.total ?? 0),
    razorpay: Number(r.razorpay ?? 0),
    manual: Number(r.manual ?? 0),
  }));

  const totalRevenue = seriesData.reduce((s: number, r: any) => s + r.total, 0);
  const razorpayRevenue = seriesData.reduce((s: number, r: any) => s + r.razorpay, 0);
  const manualRevenue = seriesData.reduce((s: number, r: any) => s + r.manual, 0);
  const priorRevenue = Number(prevRow?.[0]?.revenue ?? 0);
  const growthPercent = priorRevenue > 0 ? ((totalRevenue / priorRevenue) - 1) * 100 : null;

  return reply.send({
    success: true,
    data: {
      series: seriesData,
      summary: { totalRevenue, razorpayRevenue, manualRevenue, growthPercent },
    },
  });
}

// ── RZ-02-D: GET /api/payments/:paymentId/razorpay-sync ───────────────────────

export async function razorpaySyncHandler(req: FastifyRequest, reply: FastifyReply) {
  const { paymentId } = req.params as any;

  const [row] = await req.server.prisma.$queryRawUnsafe<any[]>(
    `SELECT id, status, method, razorpay_payment_id FROM course_payments WHERE id = $1::uuid`,
    paymentId,
  ).catch(() => [] as any[]);

  if (!row) return reply.status(404).send({ success: false, data: null, error: 'Payment not found' });

  if (row.method !== 'razorpay' || !row.razorpay_payment_id) {
    return reply.send({ success: true, data: { synced: false, reason: 'not_razorpay' } });
  }

  let rzp: any;
  try { rzp = getRazorpay(); }
  catch {
    return reply.status(503).send({ success: false, data: null, error: 'Razorpay not configured' });
  }

  let payment: any;
  try {
    payment = await rzp.payments.fetch(row.razorpay_payment_id);
  } catch (e: any) {
    return reply.status(502).send({ success: false, data: null, error: `Razorpay API error: ${e?.error?.description ?? e?.message ?? 'unknown'}` });
  }

  const rzpStatus: string = payment.status ?? 'unknown';
  const dbStatusMap: Record<string, string> = { completed: 'captured', refunded: 'refunded', failed: 'failed', pending: 'authorized' };
  const mismatch = dbStatusMap[row.status] !== undefined && dbStatusMap[row.status] !== rzpStatus;

  return reply.send({
    success: true,
    data: {
      synced: true,
      razorpayStatus: rzpStatus,
      razorpayAmount: payment.amount,
      razorpayMethod: payment.method ?? null,
      razorpayCreatedAt: payment.created_at ? new Date(payment.created_at * 1000).toISOString() : null,
      razorpayRefundStatus: payment.refund_status ?? 'null',
      dbStatus: row.status,
      mismatch,
    },
  });
}

// ── RZ-02-E: POST /api/payments/:paymentId/approve ────────────────────────────

export async function approvePaymentHandler(req: FastifyRequest, reply: FastifyReply) {
  const { paymentId } = req.params as any;

  const payment = await req.server.prisma.coursePayment.findUnique({
    where: { id: paymentId },
    select: { id: true, courseId: true, memberId: true, status: true },
  });
  if (!payment) return reply.status(404).send({ success: false, data: null, error: 'Payment not found' });
  if (payment.status !== 'pending') {
    return reply.status(409).send({ success: false, data: null, error: 'Payment is not pending' });
  }

  const adminId = await resolveAdminId(req);

  await req.server.prisma.coursePayment.update({
    where: { id: paymentId },
    data: { status: 'completed', paidAt: new Date(), grantedBy: adminId },
  });

  await req.server.prisma.courseAccess.upsert({
    where: { memberId_courseId: { memberId: payment.memberId, courseId: payment.courseId } },
    create: { memberId: payment.memberId, courseId: payment.courseId, accessType: 'lifetime', isActive: true, paymentId, grantedBy: adminId },
    update: { accessType: 'lifetime', isActive: true, revokedAt: null, revokedBy: null, paymentId, grantedBy: adminId },
  });

  await req.server.prisma.courseEnrollment.upsert({
    where: { memberId_courseId: { memberId: payment.memberId, courseId: payment.courseId } },
    create: { memberId: payment.memberId, courseId: payment.courseId, progressPercentage: 0 },
    update: {},
  }).catch(() => {});

  const course = await req.server.prisma.course.findUnique({ where: { id: payment.courseId }, select: { title: true } });
  const courseTitle = course?.title ?? 'the course';

  try { req.server.io?.to(`user:${payment.memberId}`).emit('course:access_granted', { courseId: payment.courseId }); } catch {}

  void req.server.prisma.appNotification.create({
    data: {
      title: 'Course Access Granted',
      message: `You now have access to "${courseTitle}". Start learning!`,
      type: 'course_access',
      actionUrl: `/learning/${payment.courseId}`,
      recipients: { create: [{ memberId: payment.memberId }] },
    },
  }).catch(() => {});

  void createAdminNotification(req.server.prisma, {
    title: 'Course Payment Approved',
    body: `Manual payment for "${courseTitle}" approved.`,
    type: 'course_access_request',
    metadata: { memberId: payment.memberId, courseId: payment.courseId, paymentId },
  }).catch(() => {});

  void invalidateCache((req.server as any).redis ?? null, `me:${payment.memberId}`);

  return reply.send({ success: true, data: { approved: true } });
}

// ── RZ-02-F: POST /api/payments/:paymentId/refund ────────────────────────────

export async function refundPaymentHandler(req: FastifyRequest, reply: FastifyReply) {
  const { paymentId } = req.params as any;
  const { amount: rawAmount, note, speed = 'normal' } = req.body as any ?? {};

  const [payment] = await req.server.prisma.$queryRawUnsafe<any[]>(
    `SELECT id, course_id, member_id, status, amount, method, razorpay_payment_id
     FROM course_payments WHERE id = $1::uuid`,
    paymentId,
  ).catch(() => [] as any[]);

  if (!payment) return reply.status(404).send({ success: false, data: null, error: 'Payment not found' });
  if (payment.status !== 'completed') {
    return reply.status(409).send({ success: false, data: null, error: 'Only completed payments can be refunded' });
  }

  const originalAmount = Number(payment.amount);
  const refundAmount = rawAmount != null ? Number(rawAmount) : originalAmount;

  if (refundAmount <= 0 || refundAmount > originalAmount) {
    return reply.status(400).send({ success: false, data: null, error: `Refund amount must be between 0.01 and ${originalAmount}` });
  }

  let razorpayRefundId: string | null = null;

  if (payment.method === 'razorpay' && payment.razorpay_payment_id) {
    let rzp: any;
    try { rzp = getRazorpay(); }
    catch {
      return reply.status(503).send({ success: false, data: null, error: 'Razorpay not configured' });
    }
    try {
      const rzpRefund: any = await rzp.payments.refund(payment.razorpay_payment_id, {
        amount: Math.round(refundAmount * 100),
        speed,
        notes: { reason: note ?? 'Admin-initiated refund', courseId: payment.course_id, paymentId },
      });
      razorpayRefundId = rzpRefund?.id ?? null;
    } catch (e: any) {
      return reply.status(502).send({ success: false, data: null, error: `Razorpay refund failed: ${e?.error?.description ?? e?.message ?? 'unknown error'}` });
    }
  }

  await req.server.prisma.$executeRawUnsafe(
    `UPDATE course_payments
     SET status='refunded', razorpay_refund_id=$1, refunded_amount=$2, refund_note=$3, updated_at=NOW()
     WHERE id=$4::uuid`,
    razorpayRefundId,
    refundAmount.toFixed(2),
    note ?? null,
    paymentId,
  );

  await (req.server.prisma as any).courseAccess.updateMany({
    where: { memberId: payment.member_id, courseId: payment.course_id },
    data: { isActive: false, revokedAt: new Date() },
  }).catch(() => {});

  return reply.send({ success: true, data: { refunded: true, razorpayRefundId, refundedAmount: refundAmount } });
}

// ── Helper ─────────────────────────────────────────────────────────────────────

async function resolveAdminId(req: FastifyRequest): Promise<string | null> {
  try {
    const admin = await req.server.prisma.admin.findFirst({ where: { clerkId: (req as any).user } });
    return admin?.id ?? null;
  } catch { return null; }
}
