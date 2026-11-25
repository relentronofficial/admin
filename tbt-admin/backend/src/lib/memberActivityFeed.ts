// My Workspace → Member Activity: one feed of what an admin's assigned members did, read
// straight from the tables each action is already saved in (so nothing can be missed and
// earlier activity is included). Pure SQL building — see memberActivityFeed.test.ts.

export const ACTIVITY_GROUPS = ['tasks', 'learning', 'reports', 'support', 'payments', 'community', 'notices'] as const;
export type ActivityGroup = (typeof ACTIVITY_GROUPS)[number];

/** Rows per page. */
export const FEED_LIMIT = 50;

interface Source {
  kind: string;
  group: ActivityGroup;
  /** Columns: ref (text), title (text), detail (text or NULL). */
  select: string;
  from: string;
  member: string;
  at: string;
  where?: string;
}

const SOURCES: Source[] = [
  {
    kind: 'task_submitted', group: 'tasks', member: 's.member_id',
    // Reviewing a submission also touches updated_at; only the member's own (re)submission counts.
    at: 'CASE WHEN s.reviewed_at IS NULL OR s.reviewed_by IS NULL THEN s.updated_at ELSE s.created_at END',
    select: `s.id::text, t.title, s.status::text`,
    from: 'task_submissions s JOIN tasks t ON t.id = s.task_id', where: 's.batch_id IS NULL',
  },
  {
    kind: 'day_submitted', group: 'tasks', member: 'd.member_id', at: 'd.submitted_at',
    select: `d.id::text, 'Day ' || d.day_number,
      COALESCE((SELECT string_agg(t.title, ', ' ORDER BY t.title) FROM task_submissions s JOIN tasks t ON t.id = s.task_id WHERE s.day_progress_id = d.id), d.status)`,
    from: 'member_day_progress d', where: 'd.submitted_at IS NOT NULL',
  },
  {
    kind: 'assignment_submitted', group: 'tasks', member: 's.member_id', at: 's.submitted_at',
    select: 's.id::text, a.title, NULL::text', from: 'assignment_submissions s JOIN assignments a ON a.id = s.assignment_id',
  },
  {
    kind: 'form_submitted', group: 'tasks', member: 'f.member_id', at: 'f.submitted_at',
    select: 'f.id::text, e.title, NULL::text', from: 'episode_form_submissions f JOIN course_episodes e ON e.id = f.episode_id',
  },
  {
    kind: 'break_requested', group: 'tasks', member: 'b.member_id', at: 'b.created_at',
    select: `b.id::text, 'Day ' || b.start_day || '–' || b.end_day, b.reason`, from: 'batch_break_requests b',
  },
  {
    kind: 'lesson_completed', group: 'learning', member: 'p.member_id', at: 'p.completed_at',
    select: 'p.id::text, e.title, c.title', where: 'p.completed AND p.completed_at IS NOT NULL',
    from: 'course_episode_progress p JOIN course_episodes e ON e.id = p.episode_id JOIN courses c ON c.id = e.course_id',
  },
  {
    kind: 'quiz_attempted', group: 'learning', member: 'q.member_id', at: 'q.attempted_at',
    select: `q.id::text, e.title, 'Score ' || q.score || '%' || CASE WHEN q.passed THEN ' · passed' ELSE ' · not passed' END`,
    from: 'course_quiz_attempts q JOIN course_episodes e ON e.id = q.episode_id',
  },
  {
    kind: 'weekly_report', group: 'reports', member: 'f.member_id', at: 'f.submitted_at',
    // Question reports are stored as 100 + batch week (weeklyReportForm.ts storedWeek).
    select: `f.id::text, 'Week ' || CASE WHEN f.week_number > 100 THEN f.week_number - 100 ELSE f.week_number END || ' · ' || c.title, f.feedback`,
    from: 'course_weekly_feedback f JOIN courses c ON c.id = f.course_id',
  },
  {
    kind: 'video_feedback', group: 'reports', member: 'f.member_id', at: 'f.submitted_at',
    select: `f.id::text, e.title, CONCAT_WS(' · ', f.rating || '/10', NULLIF(f.feedback, ''))`,
    from: 'course_episode_feedback f JOIN course_episodes e ON e.id = f.episode_id',
  },
  {
    kind: 'video_feedback', group: 'reports', member: 'f.member_id', at: 'f.updated_at',
    select: `f.id::text, e.title, CONCAT_WS(' · ', f.rating || '/10', NULLIF(f.feedback_text, ''))`,
    from: 'lesson_feedback f JOIN course_episodes e ON e.id::text = f.lesson_id',
    where: 'NOT EXISTS (SELECT 1 FROM course_episode_feedback x WHERE x.member_id = f.member_id AND x.episode_id = e.id)',
  },
  {
    kind: 'revenue_updated', group: 'reports', member: 'r.member_id', at: 'r.updated_at',
    select: `r.id::text, 'Week ' || r.week_number || ', ' || r.year, '₹' || r.revenue_generated`, from: 'member_revenue_reports r',
  },
  {
    kind: 'onboarding_submitted', group: 'reports', member: 'o.id', at: 'o.onboarding_submitted_at',
    select: `o.id::text, 'Onboarding form', NULL::text`, from: 'members o', where: 'o.onboarding_submitted_at IS NOT NULL',
  },
  {
    kind: 'ticket_raised', group: 'support', member: 't.member_id', at: 't.created_at',
    select: 't.id::text, t.subject, t.message', from: 'helpdesk_tickets t', where: 't.raised_by_admin_id IS NULL',
  },
  {
    kind: 'ticket_reply', group: 'support', member: 't.member_id', at: 'r.created_at',
    select: 't.id::text, t.subject, r.body', from: 'helpdesk_ticket_replies r JOIN helpdesk_tickets t ON t.id = r.ticket_id',
    where: 'NOT r.is_from_admin',
  },
  {
    kind: 'call_booked', group: 'support', member: 'b.member_id', at: 'b.booked_at',
    select: 'b.id::text, s.title, s.category', from: 'support_call_bookings b JOIN support_call_sessions s ON s.id = b.session_id',
  },
  {
    kind: 'call_cancelled', group: 'support', member: 'b.member_id', at: 'b.cancelled_at',
    select: 'b.id::text, s.title, s.category', from: 'support_call_bookings b JOIN support_call_sessions s ON s.id = b.session_id',
    where: 'b.cancelled_at IS NOT NULL',
  },
  {
    kind: 'course_payment', group: 'payments', member: 'p.member_id', at: 'COALESCE(p.paid_at, p.created_at)',
    select: `p.id::text, c.title, '₹' || p.amount || ' · ' || p.status::text`, from: 'course_payments p JOIN courses c ON c.id = p.course_id',
  },
  {
    kind: 'credit_requested', group: 'payments', member: 'p.member_id', at: 'p.created_at',
    select: `p.id::text, p.quantity || ' × ' || REPLACE(p.credit_type, '_', ' '), '₹' || p.amount_inr || ' · ' || p.status`, from: 'credit_purchases p',
  },
  {
    kind: 'product_inquiry', group: 'payments', member: 'i.member_id', at: 'i.created_at',
    select: 'i.id::text, p.title, i.message', from: 'product_inquiries i JOIN products p ON p.id = i.product_id',
  },
  {
    kind: 'community_post', group: 'community', member: 'p.member_id', at: 'p.created_at',
    select: `p.id::text, 'Community post', p.content`, from: 'community_posts p',
  },
  {
    kind: 'community_comment', group: 'community', member: 'c.member_id', at: 'c.created_at',
    select: `c.id::text, 'Community comment', c.content`, from: 'community_comments c',
  },
  {
    kind: 'notification_sent', group: 'notices', member: 'n.member_id', at: 'n.sent_at',
    select: 'n.id::text, n.title, n.body', from: 'notifications n',
  },
];

/** Notifications the app sent the member are listed but are not member actions, so never "new". */
const isAction = (s: Source) => s.group !== 'notices';

const pick = (group: ActivityGroup | null, actionsOnly: boolean) =>
  SOURCES.filter((s) => (group ? s.group === group : true) && (!actionsOnly || isAction(s)));

// $1 = the admin's id. Every query goes through this: only members assigned to that admin.
const MINE = `WITH mine AS (SELECT id FROM members WHERE account_manager_id = $1::uuid AND deleted_at IS NULL)`;
const scoped = (s: Source) =>
  `FROM ${s.from} WHERE ${s.member} IN (SELECT id FROM mine)${s.where ? ` AND ${s.where}` : ''}`;

/** $1 admin, $2 before (or null), $3 member (or null). Newest first. */
export function feedSql(group: ActivityGroup | null): string {
  const arms = pick(group, false).map((s) =>
    `(SELECT '${s.kind}' AS kind, ${s.member} AS member_id, date_trunc('milliseconds', ${s.at}) AS at, x.ref, x.title, LEFT(x.detail, 300) AS detail
      FROM ${s.from} CROSS JOIN LATERAL (SELECT ${s.select}) AS x(ref, title, detail)
      WHERE ${s.member} IN (SELECT id FROM mine)${s.where ? ` AND ${s.where}` : ''}
        AND ($2::timestamptz IS NULL OR date_trunc('milliseconds', ${s.at}) < $2::timestamptz)
        AND ($3::uuid IS NULL OR ${s.member} = $3::uuid)
      ORDER BY at DESC FETCH FIRST ${FEED_LIMIT} ROWS WITH TIES)`);
  // WITH TIES: the next page starts strictly before the last time shown, so rows sharing it must stay together.
  return `${MINE}
    SELECT f.kind, f.at, f.ref, f.title, f.detail, f.member_id,
           TRIM(CONCAT(m.first_name, ' ', COALESCE(m.last_name, ''))) AS member_name, m.profile_photo_url, b.name AS batch_name
    FROM (${arms.join('\nUNION ALL\n')}) f
    JOIN members m ON m.id = f.member_id LEFT JOIN batches b ON b.id = m.batch_id
    ORDER BY f.at DESC FETCH FIRST ${FEED_LIMIT} ROWS WITH TIES`;
}

/** $1 admin, $2 since. Counts member actions only. */
export function unreadSql(): string {
  const arms = pick(null, true).map((s) => `SELECT 1 AS n ${scoped(s)} AND ${s.at} > $2::timestamptz`);
  return `${MINE} SELECT COUNT(*)::int AS n FROM (${arms.join('\nUNION ALL\n')}) u`;
}

export const ACTIVITY_KINDS = Array.from(new Set(SOURCES.map((s) => s.kind)));
export const isActionKind = (kind: string) => SOURCES.some((s) => s.kind === kind && isAction(s));
