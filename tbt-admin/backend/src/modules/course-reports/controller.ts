/**
 * Weekly Course Report + Feedback module — admin authoring/sending of
 * per-course weekly progress reports (WhatsApp), and member submission of
 * weekly feedback back to admin (WhatsApp). Same dual-auth pattern as
 * Helpdesk (Clerk admin sub-scope + JWT-cookie member sub-scope in one
 * routes.ts file — see routes.ts for the exact split).
 *
 * DB + WhatsApp orchestration (upsert, dedupe-on-resend, send) lives in
 * backend/src/lib/courseReports.ts; this file is the thin Fastify layer:
 * parse input, enforce ownership, call the lib, shape the response.
 */

import type { FastifyReply, FastifyRequest } from 'fastify';
import { deliverMemberCourseReport, deliverMemberFeedbackToAdmin } from '../../lib/courseReports.js';
import { computeWeekNumberForDate } from '../../lib/courseReportLogic.js';
import {
  createOrSendReportSchema,
  submitFeedbackSchema,
  updateFeedbackStatusSchema,
  updateRemarksSchema,
} from './schema.js';

function ok(reply: FastifyReply, data: any, extra?: any) {
  return reply.send({ success: true, data, error: null, ...extra });
}
function fail(reply: FastifyReply, status: number, code: string, message: string) {
  return reply.status(status).send({ success: false, data: null, error: { code, message } });
}

const memberSelect = { id: true, firstName: true, lastName: true, phone: true, memberId: true } as const;
const courseSelect = { id: true, title: true, slug: true } as const;

// ────────────────────────────────────────────────────────────────
// ADMIN — reports
// ────────────────────────────────────────────────────────────────

export async function adminListReportsHandler(req: FastifyRequest, reply: FastifyReply) {
  const { page = '1', limit = '25', memberId, courseId, week, status } = req.query as Record<string, string>;
  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(100, Math.max(1, Number(limit) || 25));

  const where: any = {};
  if (memberId) where.memberId = memberId;
  if (courseId) where.courseId = courseId;
  if (week) where.weekNumber = Number(week);
  if (status) where.status = status;

  const [rows, total] = await Promise.all([
    req.server.prisma.courseWeeklyReport.findMany({
      where,
      include: { member: { select: memberSelect }, course: { select: courseSelect } },
      orderBy: [{ weekNumber: 'desc' }, { createdAt: 'desc' }],
      skip: (p - 1) * l,
      take: l,
    }),
    req.server.prisma.courseWeeklyReport.count({ where }),
  ]);
  return reply.send({ success: true, data: rows, meta: { total, page: p, limit: l }, error: null });
}

export async function adminGetReportHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const row = await req.server.prisma.courseWeeklyReport.findUnique({
    where: { id },
    include: { member: { select: memberSelect }, course: { select: courseSelect } },
  });
  if (!row) return fail(reply, 404, 'not_found', 'Report not found.');
  return ok(reply, row);
}

/** Creates (if needed) and sends this week's report for a member+course —
 * the same delivery path the weekly cron uses. Admin's manual "select user,
 * select course, send" action from requirement #1. */
export async function adminCreateOrSendReportHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = createOrSendReportSchema.safeParse(req.body);
  if (!parsed.success) return fail(reply, 400, 'invalid_input', parsed.error.message);

  const result = await deliverMemberCourseReport(req.server.prisma, parsed.data.memberId, parsed.data.courseId, {
    remarks: parsed.data.remarks,
    force: parsed.data.force,
  });

  if (!result.reportId) {
    // Ineligible (not enrolled, already completed, inactive, etc.) — no row was written.
    return fail(reply, 422, 'not_eligible', result.reason ?? 'Report could not be generated for this member/course.');
  }

  const row = await req.server.prisma.courseWeeklyReport.findUnique({
    where: { id: result.reportId },
    include: { member: { select: memberSelect }, course: { select: courseSelect } },
  });
  return ok(reply, { ...result, report: row });
}

export async function adminUpdateRemarksHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const parsed = updateRemarksSchema.safeParse(req.body);
  if (!parsed.success) return fail(reply, 400, 'invalid_input', parsed.error.message);
  try {
    const updated = await req.server.prisma.courseWeeklyReport.update({
      where: { id },
      data: { remarks: parsed.data.remarks },
    });
    return ok(reply, updated);
  } catch (err: any) {
    if (err?.code === 'P2025') return fail(reply, 404, 'not_found', 'Report not found.');
    throw err;
  }
}

// ────────────────────────────────────────────────────────────────
// ADMIN — feedback
// ────────────────────────────────────────────────────────────────

export async function adminListFeedbackHandler(req: FastifyRequest, reply: FastifyReply) {
  const { page = '1', limit = '25', memberId, courseId, week, status } = req.query as Record<string, string>;
  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(100, Math.max(1, Number(limit) || 25));

  const where: any = {};
  if (memberId) where.memberId = memberId;
  if (courseId) where.courseId = courseId;
  if (week) where.weekNumber = Number(week);
  if (status) where.status = status;

  const [rows, total] = await Promise.all([
    req.server.prisma.courseWeeklyFeedback.findMany({
      where,
      include: { member: { select: memberSelect }, course: { select: courseSelect } },
      orderBy: [{ weekNumber: 'desc' }, { submittedAt: 'desc' }],
      skip: (p - 1) * l,
      take: l,
    }),
    req.server.prisma.courseWeeklyFeedback.count({ where }),
  ]);
  return reply.send({ success: true, data: rows, meta: { total, page: p, limit: l }, error: null });
}

export async function adminGetFeedbackHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const row = await req.server.prisma.courseWeeklyFeedback.findUnique({
    where: { id },
    include: { member: { select: memberSelect }, course: { select: courseSelect } },
  });
  if (!row) return fail(reply, 404, 'not_found', 'Feedback not found.');
  return ok(reply, row);
}

export async function adminUpdateFeedbackStatusHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const parsed = updateFeedbackStatusSchema.safeParse(req.body);
  if (!parsed.success) return fail(reply, 400, 'invalid_input', parsed.error.message);
  try {
    const updated = await req.server.prisma.courseWeeklyFeedback.update({
      where: { id },
      data: { status: parsed.data.status },
    });
    return ok(reply, updated);
  } catch (err: any) {
    if (err?.code === 'P2025') return fail(reply, 404, 'not_found', 'Feedback not found.');
    throw err;
  }
}

// ────────────────────────────────────────────────────────────────
// MEMBER — own reports (read-only)
// ────────────────────────────────────────────────────────────────

/** The current week's report for one course, scoped to the caller. 404s if
 * the cron/admin hasn't generated this week's row yet — that's an expected,
 * not exceptional, state (the report generates at the end of the week). */
export async function getMyCurrentReportHandler(req: FastifyRequest, reply: FastifyReply) {
  const { courseId } = req.query as { courseId?: string };
  if (!courseId) return fail(reply, 400, 'invalid_input', 'courseId query param is required.');

  const enrollment = await req.server.prisma.courseEnrollment.findUnique({
    where: { memberId_courseId: { memberId: req.memberId!, courseId } },
    select: { enrolledAt: true },
  });
  if (!enrollment) return fail(reply, 404, 'not_found', 'You are not enrolled in this course.');

  const weekNumber = computeWeekNumberForDate(new Date(), enrollment.enrolledAt);

  const row = await req.server.prisma.courseWeeklyReport.findUnique({
    where: { memberId_courseId_weekNumber: { memberId: req.memberId!, courseId, weekNumber } },
    include: { course: { select: courseSelect } },
  });
  if (!row) return fail(reply, 404, 'not_found', "This week's report hasn't been generated yet.");
  return ok(reply, row);
}

export async function getMyReportHistoryHandler(req: FastifyRequest, reply: FastifyReply) {
  const { courseId } = req.query as { courseId?: string };
  if (!courseId) return fail(reply, 400, 'invalid_input', 'courseId query param is required.');
  const rows = await req.server.prisma.courseWeeklyReport.findMany({
    where: { memberId: req.memberId!, courseId },
    include: { course: { select: courseSelect } },
    orderBy: { weekNumber: 'desc' },
  });
  return ok(reply, rows);
}

// ────────────────────────────────────────────────────────────────
// MEMBER — feedback
// ────────────────────────────────────────────────────────────────

/** Member submits (or edits — upsert by member+course+week) this week's
 * feedback. Ownership is structural: memberId always comes from the JWT,
 * never the request body. */
export async function submitFeedbackHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = submitFeedbackSchema.safeParse(req.body);
  if (!parsed.success) return fail(reply, 400, 'invalid_input', parsed.error.message);

  const enrollment = await req.server.prisma.courseEnrollment.findUnique({
    where: { memberId_courseId: { memberId: req.memberId!, courseId: parsed.data.courseId } },
    select: { id: true },
  });
  if (!enrollment) return fail(reply, 404, 'not_found', 'You are not enrolled in this course.');

  const result = await deliverMemberFeedbackToAdmin(req.server.prisma, req.memberId!, parsed.data.courseId, {
    feedback: parsed.data.feedback,
    remarks: parsed.data.remarks,
  });

  const member = await req.server.prisma.member.findUnique({ where: { id: req.memberId! }, select: { firstName: true } });
  req.server.io.to('admin').emit('admin:course_weekly_feedback', {
    feedbackId: result.feedbackId,
    memberName: member?.firstName,
    courseId: parsed.data.courseId,
  });

  return ok(reply, result);
}

export async function getMyFeedbackHistoryHandler(req: FastifyRequest, reply: FastifyReply) {
  const { courseId } = req.query as { courseId?: string };
  if (!courseId) return fail(reply, 400, 'invalid_input', 'courseId query param is required.');
  const rows = await req.server.prisma.courseWeeklyFeedback.findMany({
    where: { memberId: req.memberId!, courseId },
    include: { course: { select: courseSelect } },
    orderBy: { weekNumber: 'desc' },
  });
  return ok(reply, rows);
}
