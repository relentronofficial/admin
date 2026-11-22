/**
 * Weekly Insights digest — every Monday from 09:00 IST, one summary of the
 * finished week (Mon–Sun) plus alerts and the members to contact first.
 * Delivered as an in-app admin notification (bell) and, when
 * ADMIN_WHATSAPP_NUMBER is set, a WhatsApp message.
 *
 * Exactly-once across Cloud Run instances: the week is claimed with
 * INSERT … ON CONFLICT DO NOTHING on insights_digest_runs before sending.
 */
import type { FastifyInstance } from 'fastify';
import { env } from '../config/env.js';
import { createAdminNotification } from '../lib/adminNotifications.js';
import { sendWhatsappMessage } from '../lib/whatsapp.js';
import { istWeekStart, istWeekday } from '../lib/weeklyReportGate.js';
import { loadRiskMembers } from '../lib/insights/insightsQueries.js';
import { buildDigestText, digestAlerts, istDate, round1, type DigestInput } from '../lib/insights/insightsLogic.js';

const INTERVAL_MS = 15 * 60_000;
const SEND_FROM_IST_HOUR = 9;
const WEEK_MS = 7 * 86_400_000;

type Db = FastifyInstance['prisma'];
const n = (v: unknown) => (v == null ? 0 : Number(v));

/** Numbers for the week [start, start + 7d) and the week before it. */
export async function computeDigest(db: Db, weekStart: Date, now: Date): Promise<DigestInput> {
  const end = new Date(weekStart.getTime() + WEEK_MS);
  const prevStart = new Date(weekStart.getTime() - WEEK_MS);
  const from = istDate(weekStart);
  const to = istDate(new Date(end.getTime() - 1));
  const prevFrom = istDate(prevStart);
  const prevTo = istDate(new Date(weekStart.getTime() - 1));

  const [row] = await db.$queryRawUnsafe<any[]>(`
    WITH rev AS (
      SELECT COALESCE(paid_at, created_at) AS at, amount::numeric AS amount FROM course_payments WHERE status = 'completed'
      UNION ALL SELECT COALESCE(paid_at, created_at), amount_paise / 100.0 FROM coin_orders WHERE status = 'paid'
      UNION ALL SELECT COALESCE(reviewed_at, created_at), amount_inr::numeric FROM credit_purchases WHERE status = 'approved'
    )
    SELECT
      (SELECT COALESCE(SUM(amount), 0) FROM rev WHERE at >= $1 AND at < $2) AS revenue,
      (SELECT COALESCE(SUM(amount), 0) FROM rev WHERE at >= $3 AND at < $1) AS revenue_prev,
      (SELECT COUNT(*) FROM members WHERE deleted_at IS NULL AND created_at >= $1 AND created_at < $2)::int AS new_members,
      (SELECT COUNT(*) FROM members WHERE deleted_at IS NULL AND created_at >= $3 AND created_at < $1)::int AS new_members_prev,
      (SELECT COUNT(DISTINCT member_id) FROM member_daily_activity WHERE activity_date BETWEEN $4::date AND $5::date)::int AS active,
      (SELECT COUNT(DISTINCT member_id) FROM member_daily_activity WHERE activity_date BETWEEN $6::date AND $7::date)::int AS active_prev,
      (SELECT COUNT(*) FROM course_episode_progress WHERE completed AND completed_at >= $1 AND completed_at < $2)::int AS lessons,
      (SELECT COUNT(*) FROM course_episode_progress WHERE completed AND completed_at >= $3 AND completed_at < $1)::int AS lessons_prev,
      (SELECT COUNT(DISTINCT ce.member_id) FROM course_enrollments ce JOIN members m ON m.id = ce.member_id
        WHERE m.deleted_at IS NULL AND m.status = 'active' AND ce.enrolled_at < $2)::int AS report_required,
      (SELECT COUNT(DISTINCT f.member_id) FROM course_weekly_feedback f JOIN members m ON m.id = f.member_id
        WHERE m.deleted_at IS NULL AND m.status = 'active' AND f.submitted_at >= $1 AND f.submitted_at < $2)::int AS report_submitted,
      ((SELECT COUNT(*) FROM course_payments WHERE status = 'failed' AND created_at >= $1 AND created_at < $2)
       + (SELECT COUNT(*) FROM coin_orders WHERE status = 'failed' AND created_at >= $1 AND created_at < $2))::int AS failed,
      (SELECT COUNT(*) FROM course_payments WHERE status = 'pending')::int AS pending,
      (SELECT COUNT(*) FROM helpdesk_tickets WHERE resolved_at IS NULL AND closed_at IS NULL AND status NOT IN ('resolved', 'closed'))::int AS open_tickets,
      (SELECT COUNT(*) FROM helpdesk_tickets WHERE resolved_at IS NULL AND closed_at IS NULL AND status NOT IN ('resolved', 'closed')
         AND resolve_deadline IS NOT NULL AND resolve_deadline < now())::int AS overdue_tickets`,
    weekStart, end, prevStart, from, to, prevFrom, prevTo);

  const risk = await loadRiskMembers(db as any, now, { fresh: true });
  const high = risk.filter((r) => r.level === 'high');
  const required = n(row?.report_required);
  const fmt = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return {
    weekLabel: `${fmt(from)} – ${fmt(to)} ${to.slice(0, 4)}`,
    revenue: n(row?.revenue), revenuePrev: n(row?.revenue_prev),
    newMembers: n(row?.new_members), newMembersPrev: n(row?.new_members_prev),
    activeMembers: n(row?.active), activeMembersPrev: n(row?.active_prev),
    lessonsCompleted: n(row?.lessons), lessonsCompletedPrev: n(row?.lessons_prev),
    weeklyReportCompliance: required ? round1((Math.min(n(row?.report_submitted), required) / required) * 100) : null,
    failedPayments: n(row?.failed), pendingPayments: n(row?.pending),
    openTickets: n(row?.open_tickets), overdueTickets: n(row?.overdue_tickets),
    highRiskMembers: high.length,
    topRisk: high.slice(0, 5).map((r) => ({ name: r.name, score: r.score, reasons: r.reasons })),
  };
}

/** Send the digest for the week before `now`'s week. Returns false when already sent. */
export async function sendWeeklyDigest(fastify: FastifyInstance, now = new Date(), opts: { force?: boolean } = {}): Promise<{ sent: boolean; text: string }> {
  const db = fastify.prisma;
  const weekStart = new Date(istWeekStart(now).getTime() - WEEK_MS);
  const digest = await computeDigest(db, weekStart, now);
  const text = buildDigestText(digest);

  if (!opts.force) {
    const claimed = await db.$queryRawUnsafe<any[]>(
      `INSERT INTO insights_digest_runs (week_start, summary) VALUES ($1::date, $2)
       ON CONFLICT (week_start) DO NOTHING RETURNING week_start`, istDate(weekStart), text);
    if (claimed.length === 0) return { sent: false, text };
  }

  const alerts = digestAlerts(digest);
  await createAdminNotification(db as any, {
    title: `Weekly summary · ${digest.weekLabel}${alerts.length ? ` · ${alerts.length} alert${alerts.length === 1 ? '' : 's'}` : ''}`,
    body: text,
    type: 'insights_digest',
    metadata: { weekStart: istDate(weekStart), alerts: alerts.length },
  });
  try {
    fastify.io?.to('admin').emit('admin:insights_digest', { weekStart: istDate(weekStart), alerts: alerts.length });
  } catch { /* socket optional */ }
  if (env.ADMIN_WHATSAPP_NUMBER) {
    await sendWhatsappMessage(env.ADMIN_WHATSAPP_NUMBER, text).catch((err: unknown) =>
      fastify.log.warn({ err }, '[insights-digest] WhatsApp send failed'));
  }
  return { sent: true, text };
}

export function startInsightsDigestJob(fastify: FastifyInstance): void {
  let running = false;
  const tick = async () => {
    if (running) return;
    const now = new Date();
    const istHour = new Date(now.getTime() + 330 * 60_000).getUTCHours();
    if (istWeekday(now) !== 1 || istHour < SEND_FROM_IST_HOUR) return; // Mondays from 09:00 IST
    running = true;
    try {
      const r = await sendWeeklyDigest(fastify, now);
      if (r.sent) fastify.log.info('[insights-digest] weekly summary sent');
    } catch (err) {
      fastify.log.warn({ err }, '[insights-digest] failed');
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => void tick(), INTERVAL_MS);
  timer.unref?.();
  setTimeout(() => void tick(), 30_000).unref?.();
  fastify.log.info('[insights-digest] checks every 15 min (sends Mondays from 09:00 IST)');
}
