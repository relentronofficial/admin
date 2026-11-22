// Saturday 18:00 IST reminder: every active member who has a course enrollment and hasn't
// submitted this week's Weekly Report gets an in-app notification + push (notifyMembers)
// and a WhatsApp message. Run by the BullMQ scheduler in jobs/courseReports.ts, with
// POST /api/cron/weekly-report-reminder as the HTTP fallback.
import type { FastifyInstance } from 'fastify';
import { notifyMembers } from './notifications.js';
import { sendWhatsappMessage } from './whatsapp.js';
import { cacheNxSet } from './cache.js';
import { istWeekStart } from './weeklyReportGate.js';

const ACTION_URL = '/learning?weeklyReport=1';
const TITLE = 'Weekly report due';
const BODY = 'Please submit your weekly report. Course videos stay locked from Saturday 6:00 PM until it is submitted.';

export interface WeeklyReminderResult {
  skipped?: 'already_sent';
  members: number;
  whatsappSent: number;
  whatsappFailed: number;
}

export interface DueMember {
  id: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  batch: string | null;
  /** last reminder sent this week (manual or automatic), ISO; null = none */
  remindedAt: string | null;
}

/** Same rule the reminder uses: active, enrolled in a course, no report since `weekStart`. */
export async function listMembersDueWeeklyReport(fastify: FastifyInstance, weekStart: Date): Promise<DueMember[]> {
  const rows = await fastify.prisma.$queryRawUnsafe<any[]>(
    `SELECT m.id, m.first_name, m.last_name, m.phone, b.name AS batch,
            (SELECT s.sent_at FROM weekly_report_reminder_sends s
              WHERE s.member_id = m.id AND s.week_start = $1::date) AS reminded_at
       FROM members m
       LEFT JOIN batches b ON b.id = m.batch_id
      WHERE m.status = 'active' AND m.deleted_at IS NULL
        AND EXISTS (SELECT 1 FROM course_enrollments e WHERE e.member_id = m.id)
        AND NOT EXISTS (SELECT 1 FROM course_weekly_feedback f
                         WHERE f.member_id = m.id AND f.submitted_at >= $2)
      ORDER BY b.name NULLS LAST, m.first_name`,
    istDateOf(weekStart), weekStart,
  );
  return rows.map((r) => ({
    id: r.id, firstName: r.first_name, lastName: r.last_name, phone: r.phone, batch: r.batch,
    remindedAt: r.reminded_at ? new Date(r.reminded_at).toISOString() : null,
  }));
}

/** IST calendar date (YYYY-MM-DD) of an instant. */
function istDateOf(d: Date): string {
  return new Date(d.getTime() + 330 * 60_000).toISOString().slice(0, 10);
}

export function weeklyReminderWhatsappText(firstName: string | null): string {
  const name = firstName?.trim() || 'there';
  return `Hi ${name}, this is a reminder from Tamil Business Tribe to submit your weekly report. ` +
    'Course videos stay locked from Saturday 6:00 PM until your report is submitted. ' +
    'Open the app → Learning → Weekly Report to submit it.';
}

/** A member is reminded at most once per this many hours (double clicks, two admins, cron + manual). */
const RESEND_AFTER_HOURS = 20;

/**
 * Remind every member still due this week: in-app + push + WhatsApp. Each member is claimed in
 * weekly_report_reminder_sends first, so nobody gets two reminders within RESEND_AFTER_HOURS.
 */
export async function sendWeeklyReportReminders(fastify: FastifyInstance, now: Date = new Date()): Promise<WeeklyReminderResult & { skippedRecent: number; noPhone: number }> {
  const weekStart = istWeekStart(now);
  const due = await listMembersDueWeeklyReport(fastify, weekStart);
  if (due.length === 0) return { members: 0, whatsappSent: 0, whatsappFailed: 0, skippedRecent: 0, noPhone: 0 };

  const claimed = await fastify.prisma.$queryRawUnsafe<{ member_id: string }[]>(
    `INSERT INTO weekly_report_reminder_sends (member_id, week_start, sent_at)
     SELECT unnest($1::uuid[]), $2::date, now()
     ON CONFLICT (member_id, week_start) DO UPDATE SET sent_at = now()
       WHERE weekly_report_reminder_sends.sent_at < now() - interval '${RESEND_AFTER_HOURS} hours'
     RETURNING member_id`,
    due.map((m) => m.id), istDateOf(weekStart),
  );
  const ids = new Set(claimed.map((c) => c.member_id));
  const members = due.filter((m) => ids.has(m.id));
  const skippedRecent = due.length - members.length;
  if (members.length === 0) return { members: 0, whatsappSent: 0, whatsappFailed: 0, skippedRecent, noPhone: 0 };

  // In-app + socket + push, in chunks so one AppNotification row never gets thousands of recipients.
  for (let i = 0; i < members.length; i += 200) {
    await notifyMembers(fastify, {
      memberIds: members.slice(i, i + 200).map((m) => m.id),
      title: TITLE,
      body: BODY,
      type: 'weekly_report_reminder',
      actionUrl: ACTION_URL,
    });
  }

  let whatsappSent = 0;
  let whatsappFailed = 0;
  let noPhone = 0;
  for (const m of members) {
    if (!m.phone) { noPhone++; continue; }
    const ok = await sendWhatsappMessage(m.phone, weeklyReminderWhatsappText(m.firstName)).catch(() => false);
    if (ok) whatsappSent++; else whatsappFailed++;
  }
  fastify.log.info(`[weekly-report-reminder] members=${members.length} whatsappSent=${whatsappSent} whatsappFailed=${whatsappFailed} skippedRecent=${skippedRecent}`);
  return { members: members.length, whatsappSent, whatsappFailed, skippedRecent, noPhone };
}

/** Saturday automatic run (scheduler / cron fallback): once per week across instances. */
export async function runWeeklyReportReminders(fastify: FastifyInstance, now: Date = new Date()): Promise<WeeklyReminderResult> {
  const weekStart = istWeekStart(now);
  const fresh = await cacheNxSet((fastify as any).redis ?? null, `weekly-report-reminder:${weekStart.toISOString()}`, 24 * 3600);
  if (!fresh) return { skipped: 'already_sent', members: 0, whatsappSent: 0, whatsappFailed: 0 };
  const r = await sendWeeklyReportReminders(fastify, now);
  return { members: r.members, whatsappSent: r.whatsappSent, whatsappFailed: r.whatsappFailed };
}
