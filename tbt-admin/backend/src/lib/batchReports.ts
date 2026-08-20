// DB + WhatsApp orchestration for the Batch Program ("90-Day Task") weekly /
// monthly report feature. Pure calculation (period math, stats, message
// copy, eligibility) lives in batchReportLogic.ts and is unit-tested there;
// this file wires that logic to Prisma and the existing WhatsApp sender.

import { sendWhatsappMessage, sendWhatsappTemplateMessage } from './whatsapp.js';
import { sendPushToMember } from './pushNotifications.js';
import { env } from '../config/env.js';
import {
  buildTanglishMessage,
  buildReportVariables,
  computeDayNumberForDate,
  computeMemberStats,
  getMonthlyPeriod,
  getWeeklyPeriod,
  isEligibleMember,
  isLastDayOfMonth,
  type BatchReportPeriod,
  type MemberReportStats,
} from './batchReportLogic.js';

export interface GeneratedReport {
  eligible: boolean;
  reason?: string;
  member?: { id: string; firstName: string; phone: string | null };
  period?: BatchReportPeriod;
  stats?: MemberReportStats;
  message?: string;
  variables?: string[];
}

/** Computes (but does not send or log) a report for one member. Safe to use
 * for the admin preview endpoint — no side effects. */
export async function generateMemberReport(
  prisma: any,
  memberId: string,
  reportType: 'weekly' | 'monthly',
  now: Date = new Date(),
): Promise<GeneratedReport> {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: { id: true, firstName: true, phone: true, status: true, batchId: true },
  });
  if (!member) return { eligible: false, reason: 'Member not found' };
  if (!member.batchId) return { eligible: false, reason: 'Member has no batch assigned' };

  const batch = await prisma.batch.findUnique({
    where: { id: member.batchId },
    select: {
      id: true, startsAt: true, isActive: true, snapshotDays: true,
      program: { select: { durationDays: true } },
    },
  });
  if (!batch) return { eligible: false, reason: 'Batch not found' };
  if (!isEligibleMember(member, batch)) {
    return { eligible: false, reason: 'Member/batch not eligible (inactive status, inactive batch, or missing phone)' };
  }

  const period = reportType === 'weekly' ? getWeeklyPeriod(now) : getMonthlyPeriod(now);

  const settingsRows: any[] = await prisma.$queryRawUnsafe(
    `SELECT extended_days FROM member_batch_settings WHERE batch_id=$1::uuid AND member_id=$2::uuid LIMIT 1`,
    batch.id, member.id,
  );
  const totalDays = (batch.snapshotDays ?? batch.program?.durationDays ?? 90) + (settingsRows[0]?.extended_days ?? 0);
  const currentDay = Math.min(computeDayNumberForDate(now, new Date(batch.startsAt)), totalDays);
  if (currentDay < 1) return { eligible: false, reason: 'Batch has not started yet' };

  const periodDayStart = Math.max(1, computeDayNumberForDate(period.rangeStart, new Date(batch.startsAt)));
  const periodDayEnd = Math.min(totalDays, computeDayNumberForDate(period.rangeEnd, new Date(batch.startsAt)), currentDay);
  if (periodDayEnd < periodDayStart) {
    return { eligible: false, reason: 'No batch days fall within this reporting period yet' };
  }

  const progress = await prisma.memberDayProgress.findMany({
    where: { batchId: batch.id, memberId: member.id, dayNumber: { gte: 1, lte: currentDay } },
    select: { dayNumber: true, status: true },
  });

  const stats = computeMemberStats({ progress, periodDayStart, periodDayEnd, currentDay, totalDays });
  if (stats.totalAssigned === 0) return { eligible: false, reason: 'No tasks scheduled in this period' };

  const msgParams = {
    firstName: member.firstName ?? 'there',
    reportType,
    periodLabel: period.label,
    stats,
  };
  const message = buildTanglishMessage(msgParams);
  const variables = buildReportVariables(msgParams);

  return {
    eligible: true,
    member: { id: member.id, firstName: member.firstName, phone: member.phone },
    period,
    stats,
    message,
    variables,
  };
}

export interface DeliverResult {
  status: 'sent' | 'failed' | 'skipped';
  reason?: string;
}

/** Generates, dedupes, sends and logs a report for one member. This is the
 * single delivery path used by both the scheduled batch run and the admin
 * manual "send test" trigger, so both stay consistent. */
export async function deliverMemberReport(
  prisma: any,
  memberId: string,
  reportType: 'weekly' | 'monthly',
  opts: { now?: Date; force?: boolean } = {},
): Promise<DeliverResult> {
  const now = opts.now ?? new Date();
  const report = await generateMemberReport(prisma, memberId, reportType, now);
  if (!report.eligible || !report.member || !report.period || !report.message || !report.stats) {
    return { status: 'skipped', reason: report.reason };
  }

  if (!opts.force) {
    const already = await prisma.whatsappMessage.findFirst({
      where: {
        memberId: report.member.id,
        reportType,
        reportPeriod: report.period.periodKey,
        status: 'sent',
      },
    });
    if (already) return { status: 'skipped', reason: 'Already sent for this period' };
  }

  if (!report.member.phone) return { status: 'skipped', reason: 'No phone number on file' };

  const tmplName = reportType === 'weekly'
    ? (env.WABA_WEEKLY_REPORT_TEMPLATE_NAME || '')
    : (env.WABA_MONTHLY_REPORT_TEMPLATE_NAME || '');

  let ok = false;
  let errMsg: string | null = null;
  try {
    if (tmplName && report.variables) {
      ok = await sendWhatsappTemplateMessage(report.member.phone, report.variables, tmplName);
    } else {
      ok = await sendWhatsappMessage(report.member.phone, report.message!);
    }
    if (!ok) errMsg = 'WABA send returned false';
  } catch (err) {
    errMsg = err instanceof Error ? err.message : String(err);
  }

  await prisma.whatsappMessage.create({
    data: {
      memberId: report.member.id,
      templateName: tmplName || 'text',
      messageBody: report.message,
      status: ok ? 'sent' : 'failed',
      reportType,
      reportPeriod: report.period.periodKey,
      failureReason: ok ? null : errMsg,
    },
  }).catch(() => { /* logging must never fault the delivery loop */ });

  // Weekly pending-reminder push — fires regardless of WhatsApp send success.
  if (reportType === 'weekly' && report.stats.pending > 0) {
    const pushTitle = `Weekly Checklist — ${report.stats.pending} pending`;
    const pushBody = `You have ${report.stats.pending} pending task${report.stats.pending === 1 ? '' : 's'} this week. Complete them before the week ends!`;
    await prisma.appNotification.create({
      data: {
        title: pushTitle,
        message: pushBody,
        type: 'weekly_pending_reminder',
        actionUrl: '/batch-program',
        recipients: { create: [{ memberId: report.member.id }] },
      },
    }).catch(() => {});
    await sendPushToMember(prisma, report.member.id, pushTitle, pushBody, { type: 'weekly_pending_reminder' }).catch(() => {});
  }

  return ok ? { status: 'sent' } : { status: 'failed', reason: errMsg ?? undefined };
}

export interface RunReportsResult {
  sent: number;
  failed: number;
  skipped: number;
  total: number;
}

async function runReportsForAllEligible(
  prisma: any,
  reportType: 'weekly' | 'monthly',
  now: Date,
): Promise<RunReportsResult> {
  const members = await prisma.member.findMany({
    where: { status: 'active', batchId: { not: null } },
    select: { id: true },
  });

  let sent = 0, failed = 0, skipped = 0;
  for (const m of members) {
    // One member's failure must never abort the batch for everyone else.
    const result = await deliverMemberReport(prisma, m.id, reportType, { now }).catch(
      (err): DeliverResult => ({ status: 'failed', reason: err instanceof Error ? err.message : String(err) }),
    );
    if (result.status === 'sent') sent++;
    else if (result.status === 'failed') failed++;
    else skipped++;
  }
  return { sent, failed, skipped, total: members.length };
}

export async function runWeeklyReports(prisma: any, now: Date = new Date()): Promise<RunReportsResult & { ranToday: boolean }> {
  const result = await runReportsForAllEligible(prisma, 'weekly', now);
  return { ...result, ranToday: true };
}

export async function runMonthlyReports(prisma: any, now: Date = new Date()): Promise<RunReportsResult & { ranToday: boolean }> {
  if (!isLastDayOfMonth(now)) return { sent: 0, failed: 0, skipped: 0, total: 0, ranToday: false };
  const result = await runReportsForAllEligible(prisma, 'monthly', now);
  return { ...result, ranToday: true };
}
