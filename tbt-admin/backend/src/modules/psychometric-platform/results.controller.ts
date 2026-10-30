import type { FastifyReply, FastifyRequest } from 'fastify';
import { buildCsv, dashboardFigures, type ExportResult } from '../../lib/psychometric/resultExport.js';
import { candidateOut, notificationOut, resultOut, retestOut } from '../../lib/psychometric/rows.js';
import { actingAdmin, fail, rows, type Db } from './db.js';

// Psychometric results side: dashboard, candidates ("Users"), results +
// exports, retest requests, notifications. Ported from the standalone
// adminDashboard / adminCRUD (users) / adminNotifications controllers with the
// same response shapes. Candidates are TBT members (or migrated candidates).

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Body = Record<string, any>;
type Req = FastifyRequest<{ Params: { id: string; userId: string }; Querystring: Record<string, string | undefined>; Body: Body }>;
const db = (req: FastifyRequest): Db => req.server.prisma as unknown as Db;
const like = (s: string) => `%${s.replace(/[%_\\]/g, '\\$&')}%`;

const RESULT_SELECT = `
  SELECT r.*, c.name AS cand_name, c.email AS cand_email, c.access_code AS cand_code
  FROM psy_results r LEFT JOIN psy_candidates c ON c.id = r.candidate_id`;

const SORTS: Record<string, string> = {
  'date-desc': 'r.created_at DESC',
  'date-asc': 'r.created_at ASC',
  'score-desc': 'r.total_marks DESC',
  'score-asc': 'r.total_marks ASC',
};

/** WHERE clause for the results list / exports (level, business, date range, search, ids). */
function resultFilter(q: Record<string, string | undefined>) {
  const where: string[] = [];
  const params: unknown[] = [];
  const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
  if (q.ids) where.push(`r.id = ANY(${p(q.ids.split(',').map((s) => s.trim()).filter(Boolean))}::text[])`);
  if (q.level) where.push(`r.level = ${p(q.level)}`);
  if (q.business) where.push(`EXISTS (SELECT 1 FROM jsonb_array_elements_text(r.recommended_business) b WHERE b ILIKE ${p(like(q.business))})`);
  if (q.dateFrom) where.push(`r.created_at >= ${p(new Date(q.dateFrom))}`);
  if (q.dateTo) { const to = new Date(q.dateTo); to.setHours(23, 59, 59, 999); where.push(`r.created_at <= ${p(to)}`); }
  if (q.search) {
    const s = p(like(q.search));
    where.push(`(c.name ILIKE ${s} OR c.email ILIKE ${s} OR c.access_code ILIKE ${s})`);
  }
  return { where: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

// ── Dashboard ──────────────────────────────────────────────────────────────

export async function getDashboard(req: Req, reply: FastifyReply) {
  const d = db(req);
  const [[counts], all, recent] = await Promise.all([
    rows(d, `SELECT
        (SELECT COUNT(*)::int FROM psy_candidates WHERE is_verified) AS users,
        (SELECT COUNT(*)::int FROM psy_sessions WHERE status = 'submitted') AS completed,
        (SELECT COUNT(*)::int FROM psy_sessions WHERE status = 'in-progress') AS in_progress,
        (SELECT COUNT(*)::int FROM psy_access_codes WHERE is_active) AS active_codes`),
    rows(d, `SELECT percentage, created_at, recommended_business FROM psy_results`),
    rows(d, `${RESULT_SELECT} ORDER BY r.created_at DESC LIMIT 10`),
  ]);
  const f = dashboardFigures(all.map((r) => ({ percentage: r.percentage, createdAt: r.created_at, recommendedBusiness: r.recommended_business })));
  return reply.send({
    success: true,
    cards: {
      totalUsersRegistered: counts.users,
      totalAssessmentsCompleted: counts.completed,
      totalAssessmentsInProgress: counts.in_progress,
      averageScore: f.averageScore,
      highestScore: f.highestScore,
      lowestScore: f.lowestScore,
      activeSharedCodes: counts.active_codes,
    },
    barChart: f.barChart,
    pieChart: f.pieChart,
    recentResults: recent.map((r) => resultOut(r, { populateUser: true })),
  });
}

// ── Candidates (the "Users" page) ──────────────────────────────────────────

export async function listCandidates(req: Req, reply: FastifyReply) {
  const { search, status, batch } = req.query;
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.max(Number(req.query.limit) || 10, 1);
  const where: string[] = [];
  const params: unknown[] = [];
  const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
  if (search) { const s = p(like(search)); where.push(`(name ILIKE ${s} OR email ILIKE ${s} OR access_code ILIKE ${s})`); }
  if (status === 'verified') where.push('is_verified');
  if (status === 'unverified') where.push('NOT is_verified');
  if (status === 'completed') where.push('has_completed');
  if (status === 'not-completed') where.push('NOT has_completed');
  if (batch) where.push(`batch = ${p(batch)}`);
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const d = db(req);
  const [[total], [stats], data, batches] = await Promise.all([
    rows(d, `SELECT COUNT(*)::int AS n FROM psy_candidates ${w}`, ...params),
    rows(d, `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE is_verified)::int AS verified,
               COUNT(*) FILTER (WHERE has_completed)::int AS completed FROM psy_candidates`),
    rows(d, `SELECT * FROM psy_candidates ${w} ORDER BY created_at DESC LIMIT ${p(limit)} OFFSET ${p((page - 1) * limit)}`, ...params),
    rows(d, `SELECT DISTINCT batch FROM psy_candidates WHERE batch IS NOT NULL AND batch <> '' ORDER BY batch`),
  ]);
  return reply.send({
    success: true,
    data: data.map(candidateOut),
    total: total.n,
    page,
    pages: Math.ceil(total.n / limit),
    stats: { totalUsers: stats.total, verifiedUsers: stats.verified, completedUsers: stats.completed, pendingUsers: stats.total - stats.verified },
    batches: batches.map((b) => b.batch),
  });
}

/** Removes the candidate and their sessions/answers; results and retest requests stay for audit (candidate cleared). */
export async function deleteCandidate(req: Req, reply: FastifyReply) {
  const del = await db(req).$executeRawUnsafe(`DELETE FROM psy_candidates WHERE id = $1`, req.params.id);
  if (!del) return fail(reply, 404, 'Not found.');
  return reply.send({ success: true });
}

// ── Results ────────────────────────────────────────────────────────────────

export async function listResults(req: Req, reply: FastifyReply) {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.max(Number(req.query.limit) || 25, 1);
  const { where, params } = resultFilter({ ...req.query, ids: undefined });
  const order = SORTS[req.query.sortBy ?? ''] ?? SORTS['date-desc'];
  const d = db(req);
  const [[total], data] = await Promise.all([
    rows(d, `SELECT COUNT(*)::int AS n FROM psy_results r LEFT JOIN psy_candidates c ON c.id = r.candidate_id ${where}`, ...params),
    rows(d, `${RESULT_SELECT} ${where} ORDER BY ${order} LIMIT ${limit} OFFSET ${(page - 1) * limit}`, ...params),
  ]);
  return reply.send({ success: true, data: data.map((r) => resultOut(r, { populateUser: true })), total: total.n, page, pages: Math.ceil(total.n / limit) });
}

export async function getResult(req: Req, reply: FastifyReply) {
  const [r] = await rows(db(req), `${RESULT_SELECT} WHERE r.id = $1`, req.params.id);
  if (!r) return fail(reply, 404, 'Not found.');
  return reply.send({ success: true, data: resultOut(r, { populateUser: true }) });
}

export async function resultsByCandidate(req: Req, reply: FastifyReply) {
  const data = await rows(db(req), `${RESULT_SELECT} WHERE r.candidate_id = $1 ORDER BY r.created_at DESC`, req.params.userId);
  return reply.send({ success: true, data: data.map((r) => resultOut(r, { populateUser: true })), total: data.length });
}

export async function deleteResult(req: Req, reply: FastifyReply) {
  const del = await db(req).$executeRawUnsafe(`DELETE FROM psy_results WHERE id = $1`, req.params.id);
  if (!del) return fail(reply, 404, 'Not found.');
  return reply.send({ success: true });
}

async function exportRows(req: Req): Promise<ExportResult[]> {
  const { where, params } = resultFilter({ ...req.query, search: undefined });
  const data = await rows(db(req), `${RESULT_SELECT} ${where} ORDER BY r.created_at DESC`, ...params);
  return data.map((r) => resultOut(r, { populateUser: true }) as unknown as ExportResult);
}

const today = () => new Date().toISOString().split('T')[0];

export async function exportCsv(req: Req, reply: FastifyReply) {
  const csv = buildCsv(await exportRows(req));
  return reply
    .header('Content-Type', 'text/csv; charset=utf-8')
    .header('Content-Disposition', `attachment; filename="tbt_results_${today()}.csv"`)
    .send(csv);
}

export async function exportPdf(req: Req, reply: FastifyReply) {
  const results = await exportRows(req);
  const { default: PDFDocument } = await import('pdfkit');
  const pdf = await new Promise<Buffer>((resolve, reject) => {
    const brand = 'Tamil Business Tribe';
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 40, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.rect(0, 0, doc.page.width, 70).fill('#1B3A6B');
    doc.fillColor('#ffffff').fontSize(18).font('Helvetica-Bold').text(`${brand} — Psychometric Assessment Results`, 40, 20);
    doc.fontSize(11).font('Helvetica').text(`Generated: ${new Date().toLocaleString()}`, 40, 46);
    doc.moveDown(3);

    const cols = { name: 40, email: 150, code: 270, score: 330, pct: 375, level: 415, cws: 505, business: 590, date: 720 };
    doc.fillColor('#1B3A6B').fontSize(9).font('Helvetica-Bold');
    const headY = doc.y;
    ([['Name', cols.name], ['Email', cols.email], ['Code', cols.code], ['Score', cols.score], ['%', cols.pct], ['Level', cols.level],
      ['C/W/S', cols.cws], ['Top Recommendation', cols.business], ['Date', cols.date]] as [string, number][])
      .forEach(([t, x]) => doc.text(t, x, headY));
    doc.moveDown(0.4);
    doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).stroke('#1B3A6B');
    doc.moveDown(0.3);

    for (const r of results) {
      if (doc.y > doc.page.height - 80) doc.addPage();
      doc.fillColor('#1e293b').fontSize(8).font('Helvetica');
      const y = doc.y;
      const top = r.recommendations?.[0]?.business || r.recommendedBusiness?.[0] || '';
      const cws = r.correctCount != null ? `${r.correctCount}/${r.wrongCount}/${r.skippedCount}` : '';
      doc.text(r.userId?.name || '', cols.name, y, { width: 100 });
      doc.text(r.userId?.email || '', cols.email, y, { width: 115 });
      doc.text(r.userId?.sharedCode || '', cols.code, y, { width: 55 });
      doc.text(`${r.totalMarks}/${r.maxScore}`, cols.score, y, { width: 40 });
      doc.text(`${r.percentage}%`, cols.pct, y, { width: 35 });
      doc.text(r.level || '', cols.level, y, { width: 85 });
      doc.text(cws, cols.cws, y, { width: 55 });
      doc.text(top, cols.business, y, { width: 125 });
      doc.text(r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '', cols.date, y, { width: 80 });
      doc.moveDown(0.9);
    }

    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.fillColor('#94a3b8').fontSize(8).text(`Page ${i + 1} of ${range.count}  |  ${brand} — Confidential`, 40, doc.page.height - 30, { align: 'center' });
    }
    doc.end();
  });
  return reply
    .header('Content-Type', 'application/pdf')
    .header('Content-Disposition', `attachment; filename="tbt_results_${today()}.pdf"`)
    .send(pdf);
}

// ── Retest requests ────────────────────────────────────────────────────────

const RETEST_STATUSES = ['pending', 'approved', 'rejected', 'used', 'expired'];

export async function listRetestRequests(req: Req, reply: FastifyReply) {
  const status = req.query.status;
  const d = db(req);
  const filtered = status && RETEST_STATUSES.includes(status);
  const [data, counts] = await Promise.all([
    filtered
      ? rows(d, `SELECT * FROM psy_retest_requests WHERE status = $1 ORDER BY created_at DESC LIMIT 500`, status)
      : rows(d, `SELECT * FROM psy_retest_requests ORDER BY created_at DESC LIMIT 500`),
    rows(d, `SELECT status, COUNT(*)::int AS n FROM psy_retest_requests GROUP BY status`),
  ]);
  return reply.send({
    success: true,
    data: data.map(retestOut),
    total: data.length,
    counts: Object.fromEntries(counts.map((c) => [c.status, c.n])),
  });
}

export async function getRetestRequest(req: Req, reply: FastifyReply) {
  const d = db(req);
  const [r] = await rows(d, `SELECT * FROM psy_retest_requests WHERE id = $1`, req.params.id);
  if (!r) return fail(reply, 404, 'Request not found.');
  const [current] = r.current_result_id ? await rows(d, `SELECT * FROM psy_results WHERE id = $1`, r.current_result_id) : [];
  const history = await rows(d,
    `SELECT id, attempt_number, percentage, level, total_marks, max_score, created_at FROM psy_results WHERE candidate_id = $1 ORDER BY created_at DESC`,
    r.candidate_id);
  return reply.send({
    success: true,
    data: {
      ...retestOut(r),
      currentResultId: current ? resultOut(current) : r.current_result_id,
      decidedBy: r.decided_by ? { _id: r.decided_by, email: r.decided_by_email } : null,
    },
    history: history.map((h) => ({
      _id: h.id, attemptNumber: h.attempt_number, percentage: h.percentage, level: h.level, totalMarks: h.total_marks, maxScore: h.max_score, createdAt: h.created_at,
    })),
  });
}

async function decideRetest(req: Req, reply: FastifyReply, decision: 'approved' | 'rejected') {
  const d = db(req);
  const [r] = await rows(d, `SELECT status FROM psy_retest_requests WHERE id = $1`, req.params.id);
  if (!r) return fail(reply, 404, 'Request not found.');
  const verb = decision === 'approved' ? 'approve' : 'reject';
  if (r.status !== 'pending') return fail(reply, 400, `Cannot ${verb} a request that is '${r.status}'.`);
  const admin = actingAdmin(req);
  const note = decision === 'rejected' && typeof req.body?.note === 'string' ? req.body.note.slice(0, 500) : null;
  // Conditional on still-pending, so two admins deciding at once can't both win.
  const [updated] = await rows(d,
    `UPDATE psy_retest_requests SET status = $1, decided_by = $2, decided_by_email = $3, decided_at = NOW(), rejection_note = $4, updated_at = NOW()
     WHERE id = $5 AND status = 'pending' RETURNING id`,
    decision, admin.id, admin.email, note, req.params.id);
  if (!updated) return fail(reply, 400, `Cannot ${verb} a request that is no longer pending.`);
  return reply.send({
    success: true,
    message: decision === 'approved' ? 'Retest approved. The candidate can now retake the assessment once.' : 'Retest request rejected.',
  });
}

export const approveRetest = (req: Req, reply: FastifyReply) => decideRetest(req, reply, 'approved');
export const rejectRetest = (req: Req, reply: FastifyReply) => decideRetest(req, reply, 'rejected');

// ── Notifications (shared admin feed) ──────────────────────────────────────

const unread = async (d: Db) => (await rows(d, `SELECT COUNT(*)::int AS n FROM psy_notifications WHERE NOT is_read`))[0].n;

export async function listNotifications(req: Req, reply: FastifyReply) {
  const limit = Math.min(parseInt(req.query.limit ?? '', 10) || 20, 50);
  const page = Math.max(parseInt(req.query.page ?? '', 10) || 1, 1);
  const onlyUnread = req.query.unread === 'true';
  const d = db(req);
  const w = onlyUnread ? 'WHERE NOT is_read' : '';
  const [data, [total], unreadCount] = await Promise.all([
    rows(d, `SELECT * FROM psy_notifications ${w} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${(page - 1) * limit}`),
    rows(d, `SELECT COUNT(*)::int AS n FROM psy_notifications ${w}`),
    unread(d),
  ]);
  return reply.send({ success: true, data: data.map(notificationOut), total: total.n, page, pages: Math.ceil(total.n / limit), unreadCount });
}

export async function unreadNotificationCount(req: Req, reply: FastifyReply) {
  return reply.send({ success: true, unreadCount: await unread(db(req)) });
}

export async function markNotificationRead(req: Req, reply: FastifyReply) {
  const d = db(req);
  const [n] = await rows(d, `UPDATE psy_notifications SET is_read = TRUE, read_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *`, req.params.id);
  if (!n) return fail(reply, 404, 'Notification not found.');
  return reply.send({ success: true, data: notificationOut(n), unreadCount: await unread(d) });
}

export async function markAllNotificationsRead(req: Req, reply: FastifyReply) {
  await db(req).$executeRawUnsafe(`UPDATE psy_notifications SET is_read = TRUE, read_at = NOW(), updated_at = NOW() WHERE NOT is_read`);
  return reply.send({ success: true, unreadCount: 0 });
}
