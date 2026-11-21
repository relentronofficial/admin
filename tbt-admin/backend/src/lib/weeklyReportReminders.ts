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

export async function runWeeklyReportReminders(fastify: FastifyInstance, now: Date = new Date()): Promise<WeeklyReminderResult> {
  const weekStart = istWeekStart(now);
  // Once per week, across instances and the HTTP fallback (24 h is enough to cover retries).
  const fresh = await cacheNxSet((fastify as any).redis ?? null, `weekly-report-reminder:${weekStart.toISOString()}`, 24 * 3600);
  if (!fresh) return { skipped: 'already_sent', members: 0, whatsappSent: 0, whatsappFailed: 0 };

  const members = await fastify.prisma.$queryRawUnsafe<{ id: string; phone: string | null; first_name: string | null }[]>(
    `SELECT m.id, m.phone, m.first_name
       FROM members m
      WHERE m.status = 'active'
        AND EXISTS (SELECT 1 FROM course_enrollments e WHERE e.member_id = m.id)
        AND NOT EXISTS (SELECT 1 FROM course_weekly_feedback f
                         WHERE f.member_id = m.id AND f.submitted_at >= $1)`,
    weekStart,
  );
  if (members.length === 0) return { members: 0, whatsappSent: 0, whatsappFailed: 0 };

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
  for (const m of members) {
    if (!m.phone) continue;
    const name = m.first_name?.trim() || 'there';
    const ok = await sendWhatsappMessage(
      m.phone,
      `Hi ${name}, this is a reminder from Tamil Business Tribe to submit your weekly report. ` +
        'Course videos stay locked from Saturday 6:00 PM until your report is submitted. ' +
        'Open the app → Learning → Weekly Report to submit it.',
    ).catch(() => false);
    if (ok) whatsappSent++; else whatsappFailed++;
  }
  fastify.log.info(`[weekly-report-reminder] members=${members.length} whatsappSent=${whatsappSent} whatsappFailed=${whatsappFailed}`);
  return { members: members.length, whatsappSent, whatsappFailed };
}
