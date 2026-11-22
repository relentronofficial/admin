import type { FastifyRequest, FastifyReply } from 'fastify';
import { getRazorpay } from '../../lib/razorpay.js';
import { createAdminNotification } from '../../lib/adminNotifications.js';
import { invalidateCache } from '../../lib/cache.js';
import { notifyCourseAccessGranted } from '../../lib/courseNotifications.js';
import { reconcileCoursePayment, type RzpPaymentLite } from '../../lib/razorpayReconcile.js';

// All dates on this page are IST; a payment counts on the day it was paid (paid_at), falling
// back to created_at only for legacy rows without paid_at.
const TZ = 'Asia/Kolkata';
const PAID_AT = `COALESCE(paid_at, created_at)`;
/** A "Razorpay" row TBT has actually confirmed with Razorpay (verify / webhook / reconcile store the payment id). */
const RZP_CONFIRMED = `(method='razorpay' AND razorpay_payment_id IS NOT NULL)`;

// ── RZ-02-A: GET /api/payments/stats ──────────────────────────────────────────

export async function getPaymentStatsHandler(req: FastifyRequest, reply: FastifyReply) {
  const [row] = await req.server.prisma.$queryRawUnsafe<any[]>(`
    SELECT
      COALESCE(SUM(CASE WHEN status='completed' THEN amount ELSE 0 END), 0)                                       AS "totalRevenue",
      COUNT(CASE WHEN status='pending' THEN 1 END)::int                                                           AS "pendingCount",
      COUNT(CASE WHEN status='pending' AND method <> 'razorpay' THEN 1 END)::int                                  AS "awaitingApprovalCount",
      COUNT(CASE WHEN status='pending' AND method = 'razorpay' THEN 1 END)::int                                   AS "unpaidCheckoutCount",
      COALESCE(SUM(CASE WHEN status='refunded' THEN COALESCE(refunded_amount, amount) ELSE 0 END), 0)             AS "refundedTotal",
      COALESCE(SUM(CASE WHEN status='completed'
        AND (${PAID_AT} AT TIME ZONE '${TZ}') >= date_trunc('month', NOW() AT TIME ZONE '${TZ}') THEN amount ELSE 0 END), 0) AS "thisMonthRevenue",
      COALESCE(SUM(CASE WHEN status='completed' AND method='razorpay' THEN amount ELSE 0 END), 0)                 AS "razorpayRevenue",
      COALESCE(SUM(CASE WHEN status='completed' AND ${RZP_CONFIRMED} THEN amount ELSE 0 END), 0)                  AS "razorpayConfirmedRevenue",
      COUNT(CASE WHEN status='completed' AND method='razorpay' AND razorpay_payment_id IS NULL THEN 1 END)::int   AS "razorpayUnconfirmedCount",
      COALESCE(SUM(CASE WHEN status='completed' AND method IN ('manual','bank_transfer','upi','external') THEN amount ELSE 0 END), 0) AS "manualRevenue",
      COUNT(CASE WHEN status='failed' THEN 1 END)::int                                                            AS "failedCount"
    FROM course_payments
  `).catch(() => [{}] as any[]);

  const razorpayRevenue = Number(row?.razorpayRevenue ?? 0);
  const razorpayConfirmedRevenue = Number(row?.razorpayConfirmedRevenue ?? 0);
  return reply.send({
    success: true,
    data: {
      totalRevenue: Number(row?.totalRevenue ?? 0),
      pendingCount: Number(row?.pendingCount ?? 0),
      awaitingApprovalCount: Number(row?.awaitingApprovalCount ?? 0),
      unpaidCheckoutCount: Number(row?.unpaidCheckoutCount ?? 0),
      refundedTotal: Number(row?.refundedTotal ?? 0),
      thisMonthRevenue: Number(row?.thisMonthRevenue ?? 0),
      razorpayRevenue,
      razorpayConfirmedRevenue,
      razorpayUnconfirmedRevenue: razorpayRevenue - razorpayConfirmedRevenue,
      razorpayUnconfirmedCount: Number(row?.razorpayUnconfirmedCount ?? 0),
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
  // Date filters are IST calendar days and inclusive: "To 22 Nov" keeps all of 22 Nov.
  if (q.dateFrom) { conditions.push(`cp.created_at >= ($${p++}::date::timestamp AT TIME ZONE '${TZ}')`); params.push(q.dateFrom); }
  if (q.dateTo) { conditions.push(`cp.created_at < (($${p++}::date + 1)::timestamp AT TIME ZONE '${TZ}')`); params.push(q.dateTo); }
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

  // Period = the last `days` IST calendar days including today; buckets by IST paid date.
  const istNow = `(NOW() AT TIME ZONE '${TZ}')`;
  const istPaid = `(COALESCE(cp.paid_at, cp.created_at) AT TIME ZONE '${TZ}')`;
  const periodStart = `(date_trunc('day', ${istNow}) - INTERVAL '${days - 1} days')`;
  const [series, prevRow] = await Promise.all([
    req.server.prisma.$queryRawUnsafe<any[]>(`
      SELECT
        TO_CHAR(gs.period, '${dateFormat}') AS date,
        COALESCE(SUM(cp.amount), 0) AS total,
        COALESCE(SUM(CASE WHEN cp.method = 'razorpay' THEN cp.amount ELSE 0 END), 0) AS razorpay,
        COALESCE(SUM(CASE WHEN cp.method IN ('manual','bank_transfer','upi','external') THEN cp.amount ELSE 0 END), 0) AS manual
      FROM generate_series(
        date_trunc('${dateTrunc}', ${periodStart}),
        date_trunc('${dateTrunc}', ${istNow}),
        INTERVAL '1 ${dateTrunc}'
      ) AS gs(period)
      LEFT JOIN course_payments cp
        ON date_trunc('${dateTrunc}', ${istPaid}) = gs.period
        AND ${istPaid} >= ${periodStart}
        AND cp.status = 'completed'
      GROUP BY gs.period
      ORDER BY gs.period
    `),
    req.server.prisma.$queryRawUnsafe<any[]>(`
      SELECT
        COALESCE(SUM(cp.amount), 0) AS revenue
      FROM course_payments cp
      WHERE cp.status='completed'
        AND ${istPaid} >= ${periodStart} - INTERVAL '${days} days'
        AND ${istPaid} < ${periodStart}
    `),
  ]).catch((err: unknown) => {
    req.log.error({ err }, '[payments] analytics query failed');
    return [[], [{ revenue: 0 }]] as any;
  });

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
    `SELECT id, status, method, amount, razorpay_payment_id, razorpay_order_id FROM course_payments WHERE id = $1::uuid`,
    paymentId,
  ).catch(() => [] as any[]);

  if (!row) return reply.status(404).send({ success: false, data: null, error: 'Payment not found' });

  if (!row.razorpay_payment_id && !row.razorpay_order_id) {
    return reply.send({ success: true, data: { synced: false, reason: 'not_razorpay' } });
  }

  let rzp: any;
  try { rzp = getRazorpay(); }
  catch {
    return reply.status(503).send({ success: false, data: null, error: 'Razorpay not configured' });
  }

  let payment: any;
  try {
    if (row.razorpay_payment_id) {
      payment = await rzp.payments.fetch(row.razorpay_payment_id);
    } else {
      // No payment id stored (e.g. approved by hand): look the order up on Razorpay instead.
      const r = reconcileCoursePayment(
        { status: row.status, amount: Number(row.amount), razorpayOrderId: row.razorpay_order_id },
        await fetchOrderPayments(rzp, row.razorpay_order_id),
      );
      if (!r.capturedPaymentId) {
        return reply.send({
          success: true,
          data: {
            synced: true, razorpayStatus: 'no captured payment', razorpayAmount: 0, razorpayMethod: null,
            razorpayCreatedAt: null, razorpayRefundStatus: 'null', dbStatus: row.status,
            mismatch: row.status === 'completed' || row.status === 'refunded', attempts: r.attempts, checkedBy: 'order',
          },
        });
      }
      payment = await rzp.payments.fetch(r.capturedPaymentId);
    }
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
  const force = (req.body as any)?.force === true;

  // Fetch razorpay ids to auto-detect method on approval
  const [rzpRow] = await req.server.prisma.$queryRawUnsafe<any[]>(
    `SELECT method, amount, razorpay_payment_id, razorpay_order_id FROM course_payments WHERE id = $1::uuid`, paymentId,
  ).catch(() => [] as any[]);
  let razorpayPaymentId: string | null = rzpRow?.razorpay_payment_id ?? null;

  // A pending Razorpay checkout is only "paid" if Razorpay captured money for its order.
  // Check first; approving an unpaid checkout would give the course away. `force` = the admin
  // confirmed the member paid another way, so the row is recorded as a manual payment.
  if (!razorpayPaymentId && rzpRow?.razorpay_order_id && !force) {
    let r: ReturnType<typeof reconcileCoursePayment> | null = null;
    try {
      r = reconcileCoursePayment(
        { status: 'pending', amount: Number(rzpRow.amount), razorpayOrderId: rzpRow.razorpay_order_id },
        await fetchOrderPayments(getRazorpay(), rzpRow.razorpay_order_id),
      );
    } catch { r = null; }
    if (r?.capturedPaymentId) {
      razorpayPaymentId = r.capturedPaymentId;
    } else {
      return reply.status(409).send({
        success: false, data: null,
        error: r ? 'Razorpay has no captured payment for this order.' : 'Could not check this order with Razorpay.',
        code: r ? 'NOT_PAID_ON_RAZORPAY' : 'RAZORPAY_CHECK_FAILED',
      });
    }
  }
  const effectiveMethod = razorpayPaymentId ? 'razorpay' : force && rzpRow?.method === 'razorpay' ? 'manual' : (rzpRow?.method ?? 'manual');

  await req.server.prisma.$executeRawUnsafe(
    `UPDATE course_payments SET status='completed', method=$1::\"CoursePaymentMethod\", paid_at=NOW(), granted_by=$2::uuid,
            razorpay_payment_id=COALESCE(razorpay_payment_id, $4), updated_at=NOW() WHERE id=$3::uuid`,
    effectiveMethod, adminId, paymentId, razorpayPaymentId,
  );

  await req.server.prisma.courseAccess.upsert({
    where: { memberId_courseId: { memberId: payment.memberId, courseId: payment.courseId } },
    create: { memberId: payment.memberId, courseId: payment.courseId, accessType: 'lifetime', isActive: true, paymentId, grantedBy: adminId },
    update: { accessType: 'lifetime', expiresAt: null, isActive: true, revokedAt: null, revokedBy: null, paymentId, grantedBy: adminId },
  });

  await req.server.prisma.courseEnrollment.upsert({
    where: { memberId_courseId: { memberId: payment.memberId, courseId: payment.courseId } },
    create: { memberId: payment.memberId, courseId: payment.courseId, progressPercentage: 0 },
    update: {},
  }).catch(() => {});

  const course = await req.server.prisma.course.findUnique({ where: { id: payment.courseId }, select: { title: true } });
  const courseTitle = course?.title ?? 'the course';

  void notifyCourseAccessGranted({
    prisma: req.server.prisma as any,
    io: req.server.io,
    memberId: payment.memberId,
    courseId: payment.courseId,
    courseTitle,
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

// ── POST /api/payments/:paymentId/mark-manual ────────────────────────────────
// Relabel a completed "Razorpay" payment that Razorpay never received (approved by hand, no
// captured payment on its order) as the way the member really paid. Re-checks Razorpay first;
// keeps the order id and appends an audit line to notes. Access and amounts are untouched.

const RELABEL_METHODS = new Set(['manual', 'bank_transfer', 'upi', 'external']);

// POST /api/payments/:paymentId/mark-duplicate — body { duplicateOf, note? }
// Voids a completed payment that records the same money as another completed
// payment (same member + course). Status becomes 'failed' so it leaves revenue;
// course access is never touched (unlike refund, which revokes it). Refused for a
// row Razorpay actually captured money on (that needs a real refund) and for the
// row the member's access points at.
export async function markPaymentDuplicateHandler(req: FastifyRequest, reply: FastifyReply) {
  const { paymentId } = req.params as { paymentId: string };
  const { duplicateOf, note } = (req.body as any) ?? {};
  const bad = (code: number, error: string) => reply.status(code).send({ success: false, data: null, error });
  if (!duplicateOf || duplicateOf === paymentId) return bad(400, 'duplicateOf must be another payment id');

  const rows = await req.server.prisma.$queryRawUnsafe<any[]>(
    `SELECT id, member_id AS "memberId", course_id AS "courseId", status, amount, razorpay_payment_id AS "rzpPaymentId"
       FROM course_payments WHERE id = ANY($1::uuid[])`,
    [paymentId, duplicateOf],
  );
  const target = rows.find((r) => r.id === paymentId);
  const kept = rows.find((r) => r.id === duplicateOf);
  if (!target || !kept) return bad(404, 'Payment not found');
  if (target.memberId !== kept.memberId || target.courseId !== kept.courseId) return bad(409, 'Payments are for different members or courses');
  if (target.status !== 'completed' || kept.status !== 'completed') return bad(409, 'Both payments must be completed');
  if (Number(target.amount) !== Number(kept.amount)) return bad(409, 'Amounts differ — not a duplicate');
  if (target.rzpPaymentId) return bad(409, 'Razorpay captured money on this payment — refund it instead');

  const access = await (req.server.prisma as any).courseAccess.findUnique({
    where: { memberId_courseId: { memberId: target.memberId, courseId: target.courseId } },
    select: { id: true, paymentId: true, accessType: true, expiresAt: true },
  });
  if (access?.paymentId === paymentId) return bad(409, "The member's course access is linked to this payment — void the other one");

  const adminId = await resolveAdminId(req);
  const audit = `[${new Date().toISOString()}] Voided as duplicate of payment ${duplicateOf}`
    + `${adminId ? ` (admin ${adminId})` : ''}${note ? ` — ${note}` : ''}`;
  const n = await req.server.prisma.$executeRawUnsafe(
    `UPDATE course_payments
        SET status = 'failed',
            notes = CASE WHEN COALESCE(notes,'') = '' THEN $1 ELSE notes || E'\\n' || $1 END,
            updated_at = NOW()
      WHERE id = $2::uuid AND status = 'completed'`,
    audit, paymentId,
  );
  if (!n) return bad(409, 'Payment changed meanwhile — reload and try again');

  // A lifetime grant never expires; clear a leftover expiry date so it can't mislead.
  let clearedExpiry = false;
  if (access && access.accessType === 'lifetime' && access.expiresAt) {
    await (req.server.prisma as any).courseAccess.update({ where: { id: access.id }, data: { expiresAt: null } });
    clearedExpiry = true;
  }
  reconcileCache = null;
  req.log.info({ paymentId, duplicateOf, adminId, clearedExpiry }, 'payment voided as duplicate');
  return reply.send({ success: true, data: { voided: true, clearedExpiry } });
}

export async function markPaymentManualHandler(req: FastifyRequest, reply: FastifyReply) {
  const { paymentId } = req.params as any;
  const body = (req.body as any) ?? {};
  const method = RELABEL_METHODS.has(body.method) ? body.method : 'manual';
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 300) : '';

  const [row] = await req.server.prisma.$queryRawUnsafe<any[]>(
    `SELECT id, status, method, amount, razorpay_payment_id, razorpay_order_id FROM course_payments WHERE id = $1::uuid`, paymentId,
  ).catch(() => [] as any[]);
  if (!row) return reply.status(404).send({ success: false, data: null, error: 'Payment not found' });
  if (row.status !== 'completed' || row.method !== 'razorpay' || row.razorpay_payment_id) {
    return reply.status(409).send({ success: false, data: null, error: 'Only a completed Razorpay payment without a Razorpay payment ID can be relabelled.' });
  }
  if (row.razorpay_order_id) {
    let r: ReturnType<typeof reconcileCoursePayment>;
    try {
      r = reconcileCoursePayment(
        { status: row.status, amount: Number(row.amount), razorpayOrderId: row.razorpay_order_id },
        await fetchOrderPayments(getRazorpay(), row.razorpay_order_id),
      );
    } catch {
      return reply.status(502).send({ success: false, data: null, error: 'Could not check this order with Razorpay.' });
    }
    if (r.capturedPaymentId) {
      return reply.status(409).send({ success: false, data: null, error: 'Razorpay did receive this payment — it should stay Razorpay.' });
    }
  }

  const adminId = await resolveAdminId(req);
  const audit = `[${new Date().toISOString()}] Relabelled razorpay → ${method}: no payment on Razorpay order ${row.razorpay_order_id ?? '(none)'}`
    + `${adminId ? ` (admin ${adminId})` : ''}${note ? ` — ${note}` : ''}`;
  await req.server.prisma.$executeRawUnsafe(
    `UPDATE course_payments
        SET method = $1::"CoursePaymentMethod",
            notes = CASE WHEN COALESCE(notes, '') = '' THEN $2 ELSE notes || E'\\n' || $2 END,
            updated_at = NOW()
      WHERE id = $3::uuid AND status = 'completed' AND method = 'razorpay' AND razorpay_payment_id IS NULL`,
    method, audit, paymentId,
  );
  reconcileCache = null;
  req.log.info({ paymentId, method, admin: (req as any).user }, '[payments] relabelled razorpay payment');
  return reply.send({ success: true, data: { relabelled: true, method } });
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

// ── RZ-02-G: GET /api/payments/revenue-by-course ──────────────────────────────

export async function getRevenueByCourseHandler(req: FastifyRequest, reply: FastifyReply) {
  const rows = await req.server.prisma.$queryRawUnsafe<any[]>(`
    SELECT
      c.id AS "courseId",
      c.title AS "courseTitle",
      COUNT(cp.id)::int AS "paymentCount",
      COALESCE(SUM(CASE WHEN cp.status='completed' THEN cp.amount ELSE 0 END), 0) AS "totalRevenue",
      COALESCE(SUM(CASE WHEN cp.status='completed' AND cp.method='razorpay' THEN cp.amount ELSE 0 END), 0) AS "razorpayRevenue",
      COALESCE(SUM(CASE WHEN cp.status='completed' AND cp.method IN ('manual','bank_transfer','upi','external') THEN cp.amount ELSE 0 END), 0) AS "manualRevenue",
      COUNT(CASE WHEN cp.status='pending' THEN 1 END)::int AS "pendingCount",
      COUNT(CASE WHEN cp.status='completed' THEN 1 END)::int AS "completedCount"
    FROM course_payments cp
    JOIN courses c ON c.id = cp.course_id
    GROUP BY c.id, c.title
    ORDER BY "totalRevenue" DESC
    LIMIT 20
  `).catch(() => [] as any[]);

  return reply.send({
    success: true,
    data: rows.map((r: any) => ({
      courseId: r.courseId,
      courseTitle: r.courseTitle,
      paymentCount: Number(r.paymentCount ?? 0),
      totalRevenue: Number(r.totalRevenue ?? 0),
      razorpayRevenue: Number(r.razorpayRevenue ?? 0),
      manualRevenue: Number(r.manualRevenue ?? 0),
      pendingCount: Number(r.pendingCount ?? 0),
      completedCount: Number(r.completedCount ?? 0),
    })),
  });
}

// ── GET /api/payments/razorpay-reconcile ──────────────────────────────────────
// Read-only: checks every course payment that has a Razorpay order against Razorpay's own
// records (orders/:id/payments) and says whether TBT and Razorpay agree. Nothing is written.

export async function fetchOrderPayments(rzp: any, orderId: string): Promise<RzpPaymentLite[]> {
  const res: any = await rzp.orders.fetchPayments(orderId);
  return (res?.items ?? []).map((p: any) => ({
    id: p.id, status: p.status, amount: Number(p.amount ?? 0), amount_refunded: Number(p.amount_refunded ?? 0),
    method: p.method ?? null, created_at: p.created_at,
  }));
}

let reconcileCache: { at: number; data: unknown } | null = null;

export async function razorpayReconcileHandler(req: FastifyRequest, reply: FastifyReply) {
  const fresh = (req.query as any)?.fresh === '1';
  if (!fresh && reconcileCache && Date.now() - reconcileCache.at < 2 * 60_000) {
    return reply.send({ success: true, data: reconcileCache.data });
  }
  let rzp: any;
  try { rzp = getRazorpay(); }
  catch { return reply.status(503).send({ success: false, data: null, error: 'Razorpay not configured' }); }

  const rows = await req.server.prisma.$queryRawUnsafe<any[]>(`
    SELECT cp.id, cp.amount, cp.status, cp.method, cp.razorpay_order_id AS "orderId", cp.razorpay_payment_id AS "paymentId",
           cp.created_at AS "createdAt", cp.paid_at AS "paidAt",
           m.id AS "memberId", m.first_name AS "firstName", m.last_name AS "lastName", m.phone,
           c.title AS "courseTitle"
      FROM course_payments cp
      JOIN members m ON m.id = cp.member_id
      JOIN courses c ON c.id = cp.course_id
     WHERE cp.razorpay_order_id IS NOT NULL OR cp.method = 'razorpay'
     ORDER BY cp.created_at DESC
     LIMIT 300`);

  const out: any[] = new Array(rows.length);
  let next = 0;
  const worker = async () => {
    while (next < rows.length) {
      const i = next++;
      const r = rows[i];
      let payments: RzpPaymentLite[] | null = null;
      let apiError: string | null = null;
      if (r.orderId) {
        try { payments = await fetchOrderPayments(rzp, r.orderId); }
        catch (e: any) { apiError = e?.error?.description ?? e?.message ?? 'Razorpay API error'; }
      }
      const res = reconcileCoursePayment({ status: r.status, amount: Number(r.amount), razorpayOrderId: r.orderId, method: r.method }, payments);
      out[i] = {
        id: r.id, memberId: r.memberId, memberName: `${r.firstName ?? ''} ${r.lastName ?? ''}`.trim(), phone: r.phone,
        courseTitle: r.courseTitle, amount: Number(r.amount), status: r.status, method: r.method,
        orderId: r.orderId, storedPaymentId: r.paymentId, createdAt: r.createdAt, paidAt: r.paidAt,
        ...res, apiError,
      };
    }
  };
  await Promise.all(Array.from({ length: Math.min(5, rows.length) }, worker));

  const sum = (pred: (x: any) => boolean, f: (x: any) => number) => out.filter(pred).reduce((s, x) => s + f(x), 0);
  const counts: Record<string, number> = {};
  for (const x of out) counts[x.verdict] = (counts[x.verdict] ?? 0) + 1;
  const data = {
    checkedAt: new Date().toISOString(),
    rows: out,
    counts,
    totals: {
      /** money Razorpay captured on TBT course orders (net of nothing — refunds shown separately) */
      capturedOnRazorpay: sum((x) => x.capturedAmount != null, (x) => x.capturedAmount),
      refundedOnRazorpay: sum((x) => x.refundedAmount != null, (x) => x.refundedAmount),
      /** what TBT counts as Razorpay revenue (completed rows with method razorpay) */
      tbtRazorpayRevenue: sum((x) => x.status === 'completed' && x.method === 'razorpay', (x) => x.amount),
      notPaidOnRazorpayAmount: sum((x) => x.verdict === 'not_paid_on_razorpay', (x) => x.amount),
      paidNotRecordedAmount: sum((x) => x.verdict === 'paid_not_recorded', (x) => x.capturedAmount ?? 0),
    },
  };
  reconcileCache = { at: Date.now(), data };
  return reply.send({ success: true, data });
}

// ── Helper ─────────────────────────────────────────────────────────────────────

async function resolveAdminId(req: FastifyRequest): Promise<string | null> {
  try {
    const admin = await req.server.prisma.admin.findFirst({ where: { clerkId: (req as any).user } });
    return admin?.id ?? null;
  } catch { return null; }
}
