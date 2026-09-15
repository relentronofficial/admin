// DB + WhatsApp orchestration for the Weekly Course Report + Feedback
// feature. Pure calculation (week math, stats, message copy, eligibility)
// lives in courseReportLogic.ts and is unit-tested there; this file wires
// that logic to Prisma and the existing WhatsApp sender (backend/src/lib/whatsapp.ts).
// Mirrors the equivalent split in batchReportLogic.ts / batchReports.ts for
// the separate Batch Program report feature — same idempotency-by-unique-key
// and "never lose the report on WhatsApp failure" guarantees.

import { sendWhatsappMessage } from './whatsapp.js';
import { createAdminNotification } from './adminNotifications.js';
import { env } from '../config/env.js';
import {
  buildCourseReportMessage,
  buildFeedbackMessage,
  computeCourseStats,
  computeWeekNumberForDate,
  isEligibleEnrollment,
  type CourseReportStats,
} from './courseReportLogic.js';

export interface GeneratedCourseReport {
  eligible: boolean;
  reason?: string;
  member?: { id: string; firstName: string; phone: string | null };
  course?: { id: string; title: string };
  weekNumber?: number;
  stats?: CourseReportStats;
  completedTitles?: string[];
  pendingTitles?: string[];
  message?: string;
}

/** Computes (but does not send or log) a report for one member+course. Safe
 * to use for an admin preview — no side effects. */
export async function generateMemberCourseReport(
  prisma: any,
  memberId: string,
  courseId: string,
  now: Date = new Date(),
): Promise<GeneratedCourseReport> {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: { id: true, firstName: true, phone: true, status: true },
  });
  if (!member) return { eligible: false, reason: 'Member not found' };

  const enrollment = await prisma.courseEnrollment.findUnique({
    where: { memberId_courseId: { memberId, courseId } },
    select: { enrolledAt: true, completedAt: true },
  });
  if (!enrollment) return { eligible: false, reason: 'Member is not enrolled in this course' };

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, title: true, isActive: true },
  });
  if (!course) return { eligible: false, reason: 'Course not found' };
  if (!course.isActive) return { eligible: false, reason: 'Course is not active' };

  if (!isEligibleEnrollment(member, enrollment)) {
    return {
      eligible: false,
      reason: enrollment.completedAt
        ? 'Course already completed — weekly cycle has stopped for this member'
        : 'Member/enrollment not eligible (inactive status or missing phone)',
    };
  }

  const weekNumber = computeWeekNumberForDate(now, enrollment.enrolledAt);

  const episodes: { id: string; title: string; order: number }[] = await prisma.courseEpisode.findMany({
    where: { courseId, isVisible: true },
    select: { id: true, title: true, order: true },
    orderBy: { order: 'asc' },
  });
  const completedRows: { episodeId: string }[] = await prisma.courseEpisodeProgress.findMany({
    where: { memberId, completed: true, episode: { courseId } },
    select: { episodeId: true },
  });
  const completedIds = new Set(completedRows.map((r) => r.episodeId));

  const completedTitles = episodes.filter((e) => completedIds.has(e.id)).map((e) => e.title);
  const pendingTitles = episodes.filter((e) => !completedIds.has(e.id)).map((e) => e.title);

  const stats = computeCourseStats({ totalLessons: episodes.length, completedLessons: completedTitles.length });

  return {
    eligible: true,
    member: { id: member.id, firstName: member.firstName, phone: member.phone },
    course: { id: course.id, title: course.title },
    weekNumber,
    stats,
    completedTitles,
    pendingTitles,
  };
}

export interface DeliverCourseReportResult {
  status: 'sent' | 'failed' | 'skipped';
  reason?: string;
  reportId?: string;
}

/** Generates, upserts, sends and logs a weekly report for one member+course.
 * This is the single delivery path used by both the scheduled weekly cron
 * and the admin manual "create/send" trigger, so both stay consistent —
 * mirrors deliverMemberReport in batchReports.ts. */
export async function deliverMemberCourseReport(
  prisma: any,
  memberId: string,
  courseId: string,
  opts: { remarks?: string | null; force?: boolean; now?: Date } = {},
): Promise<DeliverCourseReportResult> {
  const now = opts.now ?? new Date();
  const report = await generateMemberCourseReport(prisma, memberId, courseId, now);
  if (!report.eligible || !report.member || !report.course || !report.weekNumber || !report.stats) {
    return { status: 'skipped', reason: report.reason };
  }

  const existing = await prisma.courseWeeklyReport.findUnique({
    where: { memberId_courseId_weekNumber: { memberId, courseId, weekNumber: report.weekNumber } },
    select: { id: true, whatsappStatus: true, remarks: true },
  });

  // Admin-provided remarks win; otherwise preserve whatever was already
  // saved on the row (lets admin set remarks ahead of the cron run).
  const remarks = opts.remarks !== undefined ? opts.remarks : existing?.remarks ?? null;

  const row = await prisma.courseWeeklyReport.upsert({
    where: { memberId_courseId_weekNumber: { memberId, courseId, weekNumber: report.weekNumber } },
    create: {
      memberId,
      courseId,
      weekNumber: report.weekNumber,
      progressPercentage: report.stats.progressPercentage,
      completedLessons: report.stats.completedLessons,
      totalLessons: report.stats.totalLessons,
      completedTitles: report.completedTitles,
      pendingTitles: report.pendingTitles,
      remarks,
    },
    update: {
      progressPercentage: report.stats.progressPercentage,
      completedLessons: report.stats.completedLessons,
      totalLessons: report.stats.totalLessons,
      completedTitles: report.completedTitles,
      pendingTitles: report.pendingTitles,
      remarks,
    },
  });

  if (existing?.whatsappStatus === 'sent' && !opts.force) {
    return { status: 'skipped', reason: 'Already sent for this week', reportId: row.id };
  }

  if (!report.member.phone) {
    await prisma.courseWeeklyReport.update({
      where: { id: row.id },
      data: { status: 'failed', whatsappStatus: 'failed', whatsappFailureReason: 'No phone number on file' },
    });
    return { status: 'skipped', reason: 'No phone number on file', reportId: row.id };
  }

  const message = buildCourseReportMessage({
    userName: report.member.firstName,
    courseName: report.course.title,
    weekNumber: report.weekNumber,
    stats: report.stats,
    completedTitles: report.completedTitles ?? [],
    pendingTitles: report.pendingTitles ?? [],
    remarks,
  });

  let ok = false;
  let errMsg: string | null = null;
  try {
    ok = await sendWhatsappMessage(report.member.phone, message);
    if (!ok) errMsg = 'WABA send returned false';
  } catch (err) {
    errMsg = err instanceof Error ? err.message : String(err);
  }

  await prisma.courseWeeklyReport.update({
    where: { id: row.id },
    data: {
      status: ok ? 'sent' : 'failed',
      whatsappStatus: ok ? 'sent' : 'failed',
      whatsappSentAt: ok ? new Date() : undefined,
      whatsappFailureReason: ok ? null : errMsg,
    },
  }).catch(() => { /* logging must never fault the delivery loop */ });

  return ok ? { status: 'sent', reportId: row.id } : { status: 'failed', reason: errMsg ?? undefined, reportId: row.id };
}

export interface RunCourseReportsResult {
  sent: number;
  failed: number;
  skipped: number;
  total: number;
}

/** Weekly cron entry point: delivers a report for every active, incomplete
 * course enrollment. One member's failure never aborts the run for anyone
 * else. Enrollments with completedAt already set are excluded by the query
 * itself — that's what stops the weekly cycle at course completion. */
export async function runWeeklyCourseReports(prisma: any, now: Date = new Date()): Promise<RunCourseReportsResult> {
  const enrollments: { memberId: string; courseId: string }[] = await prisma.courseEnrollment.findMany({
    where: { completedAt: null, member: { status: 'active' } },
    select: { memberId: true, courseId: true },
  });

  let sent = 0, failed = 0, skipped = 0;
  for (const e of enrollments) {
    const result = await deliverMemberCourseReport(prisma, e.memberId, e.courseId, { now }).catch(
      (err): DeliverCourseReportResult => ({ status: 'failed', reason: err instanceof Error ? err.message : String(err) }),
    );
    if (result.status === 'sent') sent++;
    else if (result.status === 'failed') failed++;
    else skipped++;
  }
  return { sent, failed, skipped, total: enrollments.length };
}

// ── Member → admin feedback ─────────────────────────────────────────────

export interface DeliverFeedbackResult {
  status: 'sent' | 'skipped' | 'failed';
  reason?: string;
  feedbackId: string;
}

/** Upserts the member's feedback for the current week and WhatsApps it to
 * ADMIN_WHATSAPP_NUMBER if configured. The DB write always happens first and
 * always succeeds independently of the WhatsApp leg — feedback is never lost
 * on send failure, and an unconfigured admin number is not an error (the
 * caller still gets an in-app admin_notifications + socket alert — see the
 * courseReportRoutes controller). */
export async function deliverMemberFeedbackToAdmin(
  prisma: any,
  memberId: string,
  courseId: string,
  input: { feedback: string; remarks?: string | null },
  now: Date = new Date(),
): Promise<DeliverFeedbackResult> {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: { firstName: true },
  });
  const enrollment = await prisma.courseEnrollment.findUnique({
    where: { memberId_courseId: { memberId, courseId } },
    select: { enrolledAt: true },
  });
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { title: true } });
  if (!member || !enrollment || !course) {
    throw new Error('Member, enrollment, or course not found');
  }

  const weekNumber = computeWeekNumberForDate(now, enrollment.enrolledAt);

  const row = await prisma.courseWeeklyFeedback.upsert({
    where: { memberId_courseId_weekNumber: { memberId, courseId, weekNumber } },
    create: { memberId, courseId, weekNumber, feedback: input.feedback, remarks: input.remarks ?? null },
    update: { feedback: input.feedback, remarks: input.remarks ?? null },
  });

  if (!env.ADMIN_WHATSAPP_NUMBER) {
    await prisma.courseWeeklyFeedback.update({
      where: { id: row.id },
      data: { whatsappStatus: 'skipped' },
    }).catch(() => {});
    return { status: 'skipped', reason: 'ADMIN_WHATSAPP_NUMBER not configured', feedbackId: row.id };
  }

  const message = buildFeedbackMessage({
    userName: member.firstName,
    courseName: course.title,
    weekNumber,
    feedback: input.feedback,
    remarks: input.remarks,
  });

  let ok = false;
  let errMsg: string | null = null;
  try {
    ok = await sendWhatsappMessage(env.ADMIN_WHATSAPP_NUMBER, message);
    if (!ok) errMsg = 'WABA send returned false';
  } catch (err) {
    errMsg = err instanceof Error ? err.message : String(err);
  }

  await prisma.courseWeeklyFeedback.update({
    where: { id: row.id },
    data: {
      whatsappStatus: ok ? 'sent' : 'failed',
      whatsappSentAt: ok ? new Date() : undefined,
      whatsappFailureReason: ok ? null : errMsg,
    },
  }).catch(() => {});

  void createAdminNotification(prisma, {
    title: 'New Weekly Course Feedback',
    body: `${member.firstName} — ${course.title} (Week ${weekNumber})`,
    type: 'course_weekly_feedback',
    metadata: { feedbackId: row.id, memberId, courseId, weekNumber },
  });

  return ok
    ? { status: 'sent', feedbackId: row.id }
    : { status: 'failed', reason: errMsg ?? undefined, feedbackId: row.id };
}
