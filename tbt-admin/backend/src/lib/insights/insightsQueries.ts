/**
 * Admin Insights — database reads. Every query here is read-only. Shapes and
 * maths live in insightsLogic.ts (pure, unit-tested); this file only fetches.
 *
 * Revenue = completed course payments + paid coin orders + approved credit
 * purchases. Bundle / All Packages purchases are one course_payments row on the
 * course that was bought, so per-course revenue sits on that course.
 * Dates are IST (ACTIVITY_TIMEZONE). Section usage is web-only and starts when
 * the heartbeat began sending page paths (see trackingSince fields).
 */
import { ACTIVITY_TIMEZONE } from '../memberActivity.js';
import { istWeekStart } from '../weeklyReportGate.js';
import {
  addDays,
  buildCohortGrid,
  buildFunnel,
  daysBetween,
  fillSeries,
  istDate,
  median,
  pctChange,
  riskScore,
  round1,
  USAGE_SECTIONS,
  type CohortRowInput,
  type DateRange,
  type RiskResult,
} from './insightsLogic.js';

type Db = {
  $queryRawUnsafe<T = unknown>(sql: string, ...params: unknown[]): Promise<T>;
};

const TZ = ACTIVITY_TIMEZONE;
const n = (v: unknown): number => (v == null ? 0 : Number(v));
const istDay = (col: string) => `(${col} AT TIME ZONE '${TZ}')::date`;
/** Bucket start (YYYY-MM-DD) of a date expression: day, or 7-day buckets from range.from. */
const bucketOf = (dateExpr: string, fromParam: string, stepParam: string) =>
  `to_char(${fromParam}::date + ((${dateExpr} - ${fromParam}::date) / ${stepParam}::int) * ${stepParam}::int, 'YYYY-MM-DD')`;

/** All revenue events: course payments, coin orders, credit purchases. */
const REVENUE_CTE = `
  rev AS (
    SELECT COALESCE(paid_at, created_at) AS at, amount::numeric AS amount, member_id, 'courses'::text AS source, method::text AS method, course_id
      FROM course_payments WHERE status = 'completed'
    UNION ALL
    SELECT COALESCE(paid_at, created_at), amount_paise / 100.0, member_id, 'coins', 'razorpay', NULL::uuid
      FROM coin_orders WHERE status = 'paid'
    UNION ALL
    SELECT COALESCE(reviewed_at, created_at), amount_inr::numeric, member_id, 'credits', 'manual', NULL::uuid
      FROM credit_purchases WHERE status = 'approved'
  )`;

async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch (err) {
    console.warn('[insights] query failed:', err instanceof Error ? err.message : err);
    return fallback;
  }
}

export async function getActivityTrackingStart(db: Db): Promise<string | null> {
  const r = await safe(db.$queryRawUnsafe<{ d: string | null }[]>(
    `SELECT to_char(MIN(activity_date), 'YYYY-MM-DD') AS d FROM member_daily_activity`), []);
  return r[0]?.d ?? null;
}

async function getSectionTrackingStart(db: Db): Promise<string | null> {
  const r = await safe(db.$queryRawUnsafe<{ d: string | null }[]>(
    `SELECT to_char(MIN(activity_date), 'YYYY-MM-DD') AS d FROM member_section_minutes`), []);
  return r[0]?.d ?? null;
}

// ── 1. Executive overview ────────────────────────────────────────────────────

interface PeriodTotals {
  revenue: number;
  payingMembers: number;
  newMembers: number;
  activeMembers: number;
  avgDailyActive: number;
  lessonsCompleted: number;
  coursesCompleted: number;
  enrollments: number;
  tasksSubmitted: number;
  ticketsCreated: number;
}

async function periodTotals(db: Db, start: Date, end: Date, fromDate: string, toDate: string, days: number): Promise<PeriodTotals> {
  const [row] = await db.$queryRawUnsafe<any[]>(`
    WITH ${REVENUE_CTE}
    SELECT
      (SELECT COALESCE(SUM(amount), 0) FROM rev WHERE at >= $1 AND at < $2) AS revenue,
      (SELECT COUNT(DISTINCT member_id) FROM rev WHERE at >= $1 AND at < $2 AND amount > 0)::int AS paying,
      (SELECT COUNT(*) FROM members WHERE deleted_at IS NULL AND created_at >= $1 AND created_at < $2)::int AS new_members,
      (SELECT COUNT(DISTINCT member_id) FROM member_daily_activity WHERE activity_date BETWEEN $3::date AND $4::date)::int AS active,
      (SELECT COUNT(*) FROM member_daily_activity WHERE activity_date BETWEEN $3::date AND $4::date)::int AS member_days,
      (SELECT COUNT(*) FROM course_episode_progress WHERE completed AND completed_at >= $1 AND completed_at < $2)::int AS lessons,
      (SELECT COUNT(*) FROM course_enrollments WHERE completed_at >= $1 AND completed_at < $2)::int AS courses_completed,
      (SELECT COUNT(*) FROM course_enrollments WHERE enrolled_at >= $1 AND enrolled_at < $2)::int AS enrollments,
      (SELECT COUNT(*) FROM task_submissions WHERE created_at >= $1 AND created_at < $2)::int AS tasks,
      (SELECT COUNT(*) FROM helpdesk_tickets WHERE created_at >= $1 AND created_at < $2)::int AS tickets`,
    start, end, fromDate, toDate);
  return {
    revenue: n(row?.revenue),
    payingMembers: n(row?.paying),
    newMembers: n(row?.new_members),
    activeMembers: n(row?.active),
    avgDailyActive: round1(n(row?.member_days) / Math.max(1, days)),
    lessonsCompleted: n(row?.lessons),
    coursesCompleted: n(row?.courses_completed),
    enrollments: n(row?.enrollments),
    tasksSubmitted: n(row?.tasks),
    ticketsCreated: n(row?.tickets),
  };
}

/** Weekly report compliance for the weeks starting on each Monday given. */
async function weeklyCompliance(db: Db, weekStarts: Date[]): Promise<Array<{ weekStart: string; required: number; submitted: number; percent: number | null }>> {
  if (weekStarts.length === 0) return [];
  const rows = await db.$queryRawUnsafe<any[]>(`
    SELECT to_char((ws AT TIME ZONE '${TZ}')::date, 'YYYY-MM-DD') AS week_start,
           (SELECT COUNT(DISTINCT ce.member_id) FROM course_enrollments ce
              JOIN members m ON m.id = ce.member_id
             WHERE m.deleted_at IS NULL AND m.status = 'active' AND ce.enrolled_at < ws + interval '7 days')::int AS required,
           (SELECT COUNT(DISTINCT f.member_id) FROM course_weekly_feedback f
              JOIN members m ON m.id = f.member_id
             WHERE m.deleted_at IS NULL AND m.status = 'active'
               AND f.submitted_at >= ws AND f.submitted_at < ws + interval '7 days')::int AS submitted
      FROM unnest($1::text[]::timestamptz[]) AS ws
     ORDER BY ws`, weekStarts.map((d) => d.toISOString()));
  return rows.map((r) => ({
    weekStart: r.week_start,
    required: n(r.required),
    submitted: n(r.submitted),
    percent: n(r.required) > 0 ? round1((Math.min(n(r.submitted), n(r.required)) / n(r.required)) * 100) : null,
  }));
}

export async function loadOverview(db: Db, range: DateRange, now: Date) {
  const step = range.bucket === 'week' ? 7 : 1;
  const cur = periodTotals(db, range.start, range.end, range.from, range.to, range.days);
  const prev = periodTotals(db, range.prevStart, range.prevEnd, range.prevFrom, range.prevTo, range.days);
  const mau30From = addDays(range.to, -29);
  const stickiness = db.$queryRawUnsafe<any[]>(`
    SELECT COUNT(DISTINCT member_id)::int AS mau, COUNT(*)::int AS member_days
      FROM member_daily_activity WHERE activity_date BETWEEN $1::date AND $2::date`, mau30From, range.to);

  const thisWeek = istWeekStart(now);
  const weeks = Array.from({ length: 8 }, (_, i) => new Date(thisWeek.getTime() - (7 - i) * 7 * 86_400_000));
  weeks.push(thisWeek);

  const series = Promise.all([
    db.$queryRawUnsafe<any[]>(`
      WITH ${REVENUE_CTE}
      SELECT ${bucketOf(istDay('at'), '$3', '$4')} AS bucket, SUM(amount) AS revenue
        FROM rev WHERE at >= $1 AND at < $2 GROUP BY 1`, range.start, range.end, range.from, step),
    db.$queryRawUnsafe<any[]>(`
      SELECT ${bucketOf(istDay('created_at'), '$3', '$4')} AS bucket, COUNT(*)::int AS "newMembers"
        FROM members WHERE deleted_at IS NULL AND created_at >= $1 AND created_at < $2 GROUP BY 1`, range.start, range.end, range.from, step),
    db.$queryRawUnsafe<any[]>(`
      SELECT ${bucketOf('activity_date', '$1', '$3')} AS bucket, COUNT(DISTINCT member_id)::int AS "activeMembers"
        FROM member_daily_activity WHERE activity_date BETWEEN $1::date AND $2::date GROUP BY 1`, range.from, range.to, step),
    db.$queryRawUnsafe<any[]>(`
      SELECT ${bucketOf(istDay('completed_at'), '$3', '$4')} AS bucket, COUNT(*)::int AS lessons
        FROM course_episode_progress WHERE completed AND completed_at >= $1 AND completed_at < $2 GROUP BY 1`, range.start, range.end, range.from, step),
  ]);

  const [c, p, st, s, compliance, trackingSince] = await Promise.all([
    cur, prev, safe(stickiness, [] as any[]), series, safe(weeklyCompliance(db, weeks), []), getActivityTrackingStart(db),
  ]);
  const merged = new Map<string, Record<string, number>>();
  for (const rows of s) for (const r of rows) merged.set(r.bucket, { ...(merged.get(r.bucket) ?? {}), ...Object.fromEntries(Object.entries(r).filter(([k]) => k !== 'bucket').map(([k, v]) => [k, n(v)])) });

  const kpis = (Object.keys(c) as Array<keyof PeriodTotals>).map((key) => ({
    key, value: c[key], previous: p[key], change: pctChange(c[key], p[key]),
  }));
  const arppu = c.payingMembers ? round1(c.revenue / c.payingMembers) : 0;
  const arppuPrev = p.payingMembers ? round1(p.revenue / p.payingMembers) : 0;
  kpis.push({ key: 'revenuePerPayingMember' as any, value: arppu, previous: arppuPrev, change: pctChange(arppu, arppuPrev) });

  const mau = n(st[0]?.mau);
  const dau30 = n(st[0]?.member_days) / 30;
  return {
    range: { key: range.key, from: range.from, to: range.to, prevFrom: range.prevFrom, prevTo: range.prevTo, bucket: range.bucket },
    kpis,
    stickiness: { mau, avgDailyActive: round1(dau30), percent: mau ? round1((dau30 / mau) * 100) : null },
    series: fillSeries(range, [...merged.entries()].map(([bucket, v]) => ({ bucket, ...v })), ['revenue', 'newMembers', 'activeMembers', 'lessons']),
    weeklyReportCompliance: compliance,
    trackingSince,
  };
}

// ── 2. Funnels ───────────────────────────────────────────────────────────────

export type FunnelKind = 'onboarding' | 'purchase';

/** Per-member step conditions (SQL booleans over alias m + CTE columns). */
const ONBOARDING_STEPS = [
  { key: 'signedUp', label: 'Signed up', cond: 'TRUE' },
  { key: 'submitted', label: 'Submitted onboarding', cond: `(m.onboarding_submitted_at IS NOT NULL OR m.verification_status::text <> 'awaiting_kyc')` },
  { key: 'approved', label: 'Approved', cond: `(m.verification_status::text = 'verified' OR m.onboarding_completed)` },
  { key: 'startedLearning', label: 'Started a lesson', cond: `EXISTS (SELECT 1 FROM course_episode_progress p WHERE p.member_id = m.id)` },
  { key: 'completedLesson', label: 'Completed a lesson', cond: `EXISTS (SELECT 1 FROM course_episode_progress p WHERE p.member_id = m.id AND p.completed)` },
];

const PURCHASE_STEPS = [
  { key: 'viewedCourse', label: 'Viewed a course page', cond: 'b.viewed' },
  { key: 'startedCheckout', label: 'Started checkout', cond: 'b.checkout' },
  { key: 'paid', label: 'Paid', cond: 'b.paid' },
  { key: 'startedCourse', label: 'Started the course', cond: 'b.started' },
  { key: 'completedCourse', label: 'Completed the course', cond: 'b.completed' },
];

/** Step keys whose "stuck" list can be opened (every step but the first). */
export const FUNNEL_STUCK_STEPS: Record<FunnelKind, string[]> = {
  onboarding: ONBOARDING_STEPS.slice(1).map((s) => s.key),
  purchase: PURCHASE_STEPS.slice(1).map((s) => s.key),
};

const PURCHASE_BASE = `
  base AS (
    SELECT m.id,
      EXISTS (SELECT 1 FROM member_section_minutes v WHERE v.member_id = m.id AND v.section = 'course-page'
               AND v.activity_date BETWEEN $3::date AND $4::date) AS viewed,
      EXISTS (SELECT 1 FROM course_payments cp WHERE cp.member_id = m.id AND cp.created_at >= $1 AND cp.created_at < $2) AS checkout,
      EXISTS (SELECT 1 FROM course_payments cp WHERE cp.member_id = m.id AND cp.status = 'completed' AND cp.amount > 0
               AND cp.created_at >= $1 AND cp.created_at < $2) AS paid,
      EXISTS (SELECT 1 FROM course_payments cp
                JOIN course_episodes e ON e.course_id = cp.course_id
                JOIN course_episode_progress p ON p.episode_id = e.id AND p.member_id = m.id
               WHERE cp.member_id = m.id AND cp.status = 'completed' AND cp.amount > 0
                 AND cp.created_at >= $1 AND cp.created_at < $2) AS started,
      EXISTS (SELECT 1 FROM course_payments cp
                JOIN course_enrollments ce ON ce.course_id = cp.course_id AND ce.member_id = m.id AND ce.completed_at IS NOT NULL
               WHERE cp.member_id = m.id AND cp.status = 'completed' AND cp.amount > 0
                 AND cp.created_at >= $1 AND cp.created_at < $2) AS completed
      FROM members m
     WHERE m.deleted_at IS NULL
       AND (EXISTS (SELECT 1 FROM member_section_minutes v WHERE v.member_id = m.id AND v.section = 'course-page'
                     AND v.activity_date BETWEEN $3::date AND $4::date)
         OR EXISTS (SELECT 1 FROM course_payments cp WHERE cp.member_id = m.id AND cp.created_at >= $1 AND cp.created_at < $2))
  )`;

export async function loadFunnels(db: Db, range: DateRange) {
  const ob = ONBOARDING_STEPS.map((s, i) => `COUNT(*) FILTER (WHERE ${s.cond})::int AS s${i}`).join(', ');
  const pu = PURCHASE_STEPS.map((s, i) => `COUNT(*) FILTER (WHERE ${s.cond})::int AS s${i}`).join(', ');
  const [onb, pur, approvalDays, sectionSince] = await Promise.all([
    db.$queryRawUnsafe<any[]>(`SELECT ${ob} FROM members m WHERE m.deleted_at IS NULL AND m.created_at >= $1 AND m.created_at < $2`, range.start, range.end),
    db.$queryRawUnsafe<any[]>(`WITH ${PURCHASE_BASE} SELECT ${pu} FROM base b`, range.start, range.end, range.from, range.to),
    db.$queryRawUnsafe<any[]>(`
      SELECT EXTRACT(EPOCH FROM (onboarding_reviewed_at - created_at)) / 86400 AS d FROM members
       WHERE deleted_at IS NULL AND created_at >= $1 AND created_at < $2
         AND verification_status::text = 'verified' AND onboarding_reviewed_at IS NOT NULL`, range.start, range.end),
    getSectionTrackingStart(db),
  ]);
  const med = median(approvalDays.map((r) => n(r.d)));
  return {
    onboarding: {
      steps: buildFunnel(ONBOARDING_STEPS.map((s, i) => ({ key: s.key, label: s.label, count: n(onb[0]?.[`s${i}`]) }))),
      medianDaysToApproval: med == null ? null : round1(med),
      note: 'Members who signed up in this period.',
    },
    purchase: {
      steps: buildFunnel(PURCHASE_STEPS.map((s, i) => ({ key: s.key, label: s.label, count: n(pur[0]?.[`s${i}`]) }))),
      note: 'Members who viewed a course page or started checkout in this period. Course-page views are counted on the web app only.',
      pageTrackingSince: sectionSince,
    },
  };
}

/** Members who reached the step before `step` but not `step` itself. */
export async function loadFunnelStuck(db: Db, range: DateRange, kind: FunnelKind, step: string) {
  const steps = kind === 'onboarding' ? ONBOARDING_STEPS : PURCHASE_STEPS;
  const idx = steps.findIndex((s) => s.key === step);
  if (idx <= 0) return null;
  const reached = steps[idx - 1].cond;
  const notYet = steps[idx].cond;
  const cols = `m.id, m.first_name AS "firstName", m.last_name AS "lastName", m.phone, m.email,
                m.created_at AS "joinedAt", m.last_active_at AS "lastActiveAt",
                m.verification_status::text AS "verificationStatus", m.membership_plan::text AS "plan"`;
  if (kind === 'onboarding') {
    return db.$queryRawUnsafe<any[]>(`
      SELECT ${cols} FROM members m
       WHERE m.deleted_at IS NULL AND m.created_at >= $1 AND m.created_at < $2
         AND ${reached} AND NOT ${notYet}
       ORDER BY m.created_at DESC LIMIT 200`, range.start, range.end);
  }
  return db.$queryRawUnsafe<any[]>(`
    WITH ${PURCHASE_BASE}
    SELECT ${cols} FROM base b JOIN members m ON m.id = b.id
     WHERE ${reached} AND NOT ${notYet}
     ORDER BY m.last_active_at DESC NULLS LAST LIMIT 200`, range.start, range.end, range.from, range.to);
}

// ── 3. Cohort retention ──────────────────────────────────────────────────────

export async function loadCohorts(db: Db, months: number, now: Date) {
  const WEEKS = 12;
  const today = istDate(now);
  const firstMonth = `${today.slice(0, 7)}-01`;
  const startDate = (() => {
    const [y, m] = firstMonth.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 - (months - 1), 1));
    return d.toISOString().slice(0, 10);
  })();
  const [sizes, active, trackingStart] = await Promise.all([
    db.$queryRawUnsafe<any[]>(`
      SELECT to_char(${istDay('created_at')}, 'YYYY-MM') AS cohort, COUNT(*)::int AS size,
             to_char(MIN(${istDay('created_at')}), 'YYYY-MM-DD') AS first, to_char(MAX(${istDay('created_at')}), 'YYYY-MM-DD') AS last
        FROM members WHERE deleted_at IS NULL AND ${istDay('created_at')} >= $1::date
       GROUP BY 1 ORDER BY 1`, startDate),
    db.$queryRawUnsafe<any[]>(`
      WITH m AS (
        SELECT id, to_char(${istDay('created_at')}, 'YYYY-MM') AS cohort, ${istDay('created_at')} AS sd
          FROM members WHERE deleted_at IS NULL AND ${istDay('created_at')} >= $1::date
      )
      SELECT m.cohort, ((d.activity_date - m.sd) / 7)::int AS wk, COUNT(DISTINCT m.id)::int AS active
        FROM m JOIN member_daily_activity d ON d.member_id = m.id
         AND d.activity_date >= m.sd AND d.activity_date < m.sd + ${7 * (WEEKS + 1)}
       GROUP BY 1, 2`, startDate),
    getActivityTrackingStart(db),
  ]);
  const byCohort = new Map<string, Record<number, number>>();
  for (const r of active) {
    const map = byCohort.get(r.cohort) ?? {};
    map[n(r.wk)] = n(r.active);
    byCohort.set(r.cohort, map);
  }
  const inputs: CohortRowInput[] = sizes.map((s) => ({
    cohort: s.cohort, size: n(s.size), firstSignup: s.first, lastSignup: s.last, activeByWeek: byCohort.get(s.cohort) ?? {},
  }));
  return { weeks: WEEKS, trackingSince: trackingStart, rows: buildCohortGrid(inputs, WEEKS, today, trackingStart) };
}

// ── 4. Course and lesson insights ────────────────────────────────────────────

export async function loadCourses(db: Db, range: DateRange) {
  const rows = await db.$queryRawUnsafe<any[]>(`
    WITH enr AS (
      SELECT course_id, COUNT(*)::int AS enrolled, COUNT(completed_at)::int AS completed,
             percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (completed_at - enrolled_at)) / 86400)
               FILTER (WHERE completed_at IS NOT NULL) AS median_days,
             COUNT(*) FILTER (WHERE enrolled_at >= $1 AND enrolled_at < $2)::int AS enrolled_in_range
        FROM course_enrollments GROUP BY course_id
    ),
    act AS (
      SELECT e.course_id, COUNT(DISTINCT p.member_id)::int AS active_learners,
             COUNT(*) FILTER (WHERE p.completed AND p.completed_at >= $1 AND p.completed_at < $2)::int AS lessons_completed
        FROM course_episode_progress p JOIN course_episodes e ON e.id = p.episode_id
       WHERE p.updated_at >= $1 AND p.updated_at < $2 GROUP BY e.course_id
    ),
    pay AS (
      SELECT course_id, SUM(amount) AS revenue_all, COUNT(DISTINCT member_id)::int AS buyers,
             SUM(amount) FILTER (WHERE COALESCE(paid_at, created_at) >= $1 AND COALESCE(paid_at, created_at) < $2) AS revenue_range
        FROM course_payments WHERE status = 'completed' GROUP BY course_id
    ),
    rat AS (
      SELECT course_id, AVG(rating) AS avg_rating, COUNT(*)::int AS ratings FROM lesson_feedback GROUP BY course_id
    ),
    eps AS (
      SELECT course_id, COUNT(*)::int AS lessons FROM course_episodes WHERE is_visible GROUP BY course_id
    )
    SELECT c.id, c.title, c.course_type AS "courseType", c.module, c.is_published AS "isPublished",
           COALESCE(eps.lessons, 0) AS lessons,
           COALESCE(enr.enrolled, 0) AS enrolled, COALESCE(enr.completed, 0) AS completed,
           enr.median_days AS "medianDaysToComplete", COALESCE(enr.enrolled_in_range, 0) AS "enrolledInRange",
           COALESCE(act.active_learners, 0) AS "activeLearners", COALESCE(act.lessons_completed, 0) AS "lessonsCompleted",
           COALESCE(pay.revenue_all, 0) AS "revenueAll", COALESCE(pay.revenue_range, 0) AS "revenueInRange", COALESCE(pay.buyers, 0) AS buyers,
           rat.avg_rating AS "avgRating", COALESCE(rat.ratings, 0) AS ratings
      FROM courses c
      LEFT JOIN enr ON enr.course_id = c.id
      LEFT JOIN act ON act.course_id = c.id
      LEFT JOIN pay ON pay.course_id = c.id
      LEFT JOIN rat ON rat.course_id = c.id::text
      LEFT JOIN eps ON eps.course_id = c.id
     WHERE c.deleted_at IS NULL AND (c.is_published OR COALESCE(enr.enrolled, 0) > 0)
     ORDER BY COALESCE(enr.enrolled, 0) DESC, c.title`, range.start, range.end);
  return rows.map((r) => ({
    id: r.id, title: r.title, courseType: r.courseType, module: r.module, isPublished: r.isPublished,
    lessons: n(r.lessons), enrolled: n(r.enrolled), completed: n(r.completed),
    completionRate: n(r.enrolled) ? round1((n(r.completed) / n(r.enrolled)) * 100) : null,
    medianDaysToComplete: r.medianDaysToComplete == null ? null : round1(n(r.medianDaysToComplete)),
    enrolledInRange: n(r.enrolledInRange), activeLearners: n(r.activeLearners), lessonsCompleted: n(r.lessonsCompleted),
    revenueAll: n(r.revenueAll), revenueInRange: n(r.revenueInRange), buyers: n(r.buyers),
    avgRating: r.avgRating == null ? null : round1(n(r.avgRating)), ratings: n(r.ratings),
  }));
}

export async function loadCourseLessons(db: Db, courseId: string) {
  const [course] = await db.$queryRawUnsafe<any[]>(
    `SELECT id, title FROM courses WHERE id = $1::uuid AND deleted_at IS NULL`, courseId);
  if (!course) return null;
  const [lessons, low] = await Promise.all([
    db.$queryRawUnsafe<any[]>(`
      SELECT e.id, e.title, e."order", e.duration_seconds AS "durationSeconds",
             COUNT(p.id)::int AS started,
             COUNT(p.id) FILTER (WHERE p.completed)::int AS completed,
             AVG(LEAST(p.actual_watched_secs::numeric / NULLIF(e.duration_seconds, 0), 1)) AS watch_ratio,
             (SELECT AVG(f.rating) FROM lesson_feedback f WHERE f.course_id = $1 AND f.lesson_id = e.id::text) AS avg_rating,
             (SELECT COUNT(*) FROM lesson_feedback f WHERE f.course_id = $1 AND f.lesson_id = e.id::text)::int AS ratings
        FROM course_episodes e
        LEFT JOIN course_episode_progress p ON p.episode_id = e.id
       WHERE e.course_id = $1::uuid AND e.is_visible
       GROUP BY e.id ORDER BY e."order", e.created_at`, courseId),
    db.$queryRawUnsafe<any[]>(`
      SELECT f.lesson_id AS "lessonId", f.rating, f.feedback_text AS text, f.updated_at AS "at"
        FROM lesson_feedback f
       WHERE f.course_id = $1 AND f.rating <= 4 AND COALESCE(f.feedback_text, '') <> ''
       ORDER BY f.updated_at DESC LIMIT 60`, courseId),
  ]);
  const lowBy = new Map<string, any[]>();
  for (const l of low) {
    const arr = lowBy.get(l.lessonId) ?? [];
    if (arr.length < 5) arr.push({ rating: n(l.rating), text: String(l.text).slice(0, 500), at: l.at });
    lowBy.set(l.lessonId, arr);
  }
  let prevCompleted: number | null = null;
  const out = lessons.map((l, i) => {
    const completed = n(l.completed);
    const row = {
      id: l.id, position: i + 1, title: l.title, durationSeconds: n(l.durationSeconds),
      started: n(l.started), completed,
      completionOfStarted: n(l.started) ? round1((completed / n(l.started)) * 100) : null,
      dropFromPrevious: prevCompleted && prevCompleted > 0 ? round1(((prevCompleted - completed) / prevCompleted) * 100) : null,
      avgWatchedPercent: l.watch_ratio == null ? null : round1(n(l.watch_ratio) * 100),
      avgRating: l.avg_rating == null ? null : round1(n(l.avg_rating)),
      ratings: n(l.ratings),
      lowRatedFeedback: lowBy.get(l.id) ?? [],
    };
    prevCompleted = completed;
    return row;
  });
  return { course: { id: course.id, title: course.title }, lessons: out };
}

// ── 5. Mentorship impact ─────────────────────────────────────────────────────

/** Monday of an ISO year/week, as an IST date. */
const ISO_WEEK_DATE = `to_date(r.year::text || '-' || lpad(r.week_number::text, 2, '0') || '-1', 'IYYY-IW-ID')`;

export async function loadMentorship(db: Db, range: DateRange) {
  const [weekly, batches, improvers, buckets, totals] = await Promise.all([
    db.$queryRawUnsafe<any[]>(`
      SELECT to_char(${ISO_WEEK_DATE}, 'YYYY-MM-DD') AS week, SUM(r.revenue_generated) AS revenue,
             COUNT(DISTINCT r.member_id)::int AS members,
             percentile_cont(0.5) WITHIN GROUP (ORDER BY r.revenue_generated) AS median
        FROM member_revenue_reports r
       WHERE r.revenue_generated IS NOT NULL AND ${ISO_WEEK_DATE} BETWEEN $1::date AND $2::date
       GROUP BY 1 ORDER BY 1`, range.from, range.to),
    db.$queryRawUnsafe<any[]>(`
      SELECT COALESCE(b.name, 'No batch') AS batch,
             COUNT(DISTINCT r.member_id) FILTER (WHERE ${ISO_WEEK_DATE} BETWEEN $1::date AND $2::date)::int AS members,
             COALESCE(SUM(r.revenue_generated) FILTER (WHERE ${ISO_WEEK_DATE} BETWEEN $1::date AND $2::date), 0) AS revenue,
             COALESCE(SUM(r.revenue_generated) FILTER (WHERE ${ISO_WEEK_DATE} BETWEEN $3::date AND $4::date), 0) AS revenue_prev
        FROM member_revenue_reports r
        JOIN members m ON m.id = r.member_id AND m.deleted_at IS NULL
        LEFT JOIN batches b ON b.id = m.batch_id
       WHERE r.revenue_generated IS NOT NULL
       GROUP BY 1 HAVING COUNT(DISTINCT r.member_id) FILTER (WHERE ${ISO_WEEK_DATE} BETWEEN $3::date AND $2::date) > 0
       ORDER BY 3 DESC`, range.from, range.to, range.prevFrom, range.prevTo),
    db.$queryRawUnsafe<any[]>(`
      WITH per AS (
        SELECT r.member_id,
               AVG(r.revenue_generated) FILTER (WHERE ${ISO_WEEK_DATE} BETWEEN $1::date AND $2::date) AS cur,
               AVG(r.revenue_generated) FILTER (WHERE ${ISO_WEEK_DATE} BETWEEN $3::date AND $4::date) AS prev
          FROM member_revenue_reports r WHERE r.revenue_generated IS NOT NULL GROUP BY r.member_id
      )
      SELECT m.id, m.first_name AS "firstName", m.last_name AS "lastName", b.name AS batch,
             per.cur AS current, per.prev AS previous, (per.cur - per.prev) AS gain
        FROM per JOIN members m ON m.id = per.member_id AND m.deleted_at IS NULL
        LEFT JOIN batches b ON b.id = m.batch_id
       WHERE per.cur IS NOT NULL AND per.prev IS NOT NULL
       ORDER BY gain DESC LIMIT 10`, range.from, range.to, range.prevFrom, range.prevTo),
    db.$queryRawUnsafe<any[]>(`
      WITH tot AS (
        SELECT member_id, SUM(revenue_generated) AS total FROM member_revenue_reports
         WHERE revenue_generated IS NOT NULL GROUP BY member_id
      )
      SELECT COUNT(*) FILTER (WHERE total < 100000)::int AS under1l,
             COUNT(*) FILTER (WHERE total >= 100000 AND total < 500000)::int AS l1to5,
             COUNT(*) FILTER (WHERE total >= 500000 AND total < 1000000)::int AS l5to10,
             COUNT(*) FILTER (WHERE total >= 1000000)::int AS over10l,
             COUNT(*)::int AS reporting
        FROM tot`),
    db.$queryRawUnsafe<any[]>(`
      SELECT COALESCE(SUM(r.revenue_generated) FILTER (WHERE ${ISO_WEEK_DATE} BETWEEN $1::date AND $2::date), 0) AS cur,
             COALESCE(SUM(r.revenue_generated) FILTER (WHERE ${ISO_WEEK_DATE} BETWEEN $3::date AND $4::date), 0) AS prev,
             COUNT(DISTINCT r.member_id) FILTER (WHERE ${ISO_WEEK_DATE} BETWEEN $1::date AND $2::date)::int AS members_cur,
             COUNT(DISTINCT r.member_id) FILTER (WHERE ${ISO_WEEK_DATE} BETWEEN $3::date AND $4::date)::int AS members_prev
        FROM member_revenue_reports r WHERE r.revenue_generated IS NOT NULL`, range.from, range.to, range.prevFrom, range.prevTo),
  ]);
  const t = totals[0] ?? {};
  const b = buckets[0] ?? {};
  return {
    summary: {
      revenue: n(t.cur), revenuePrev: n(t.prev), change: pctChange(n(t.cur), n(t.prev)),
      reportingMembers: n(t.members_cur), reportingMembersPrev: n(t.members_prev),
    },
    weekly: weekly.map((w) => ({ week: w.week, revenue: n(w.revenue), members: n(w.members), median: round1(n(w.median)) })),
    byBatch: batches.map((x) => ({ batch: x.batch, members: n(x.members), revenue: n(x.revenue), revenuePrev: n(x.revenue_prev), change: pctChange(n(x.revenue), n(x.revenue_prev)) })),
    topImprovers: improvers.map((x) => ({
      id: x.id, name: `${x.firstName ?? ''} ${x.lastName ?? ''}`.trim(), batch: x.batch,
      avgWeeklyNow: round1(n(x.current)), avgWeeklyBefore: round1(n(x.previous)), gain: round1(n(x.gain)),
    })),
    totalRevenueBuckets: [
      { label: 'Under ₹1L', members: n(b.under1l) },
      { label: '₹1L–5L', members: n(b.l1to5) },
      { label: '₹5L–10L', members: n(b.l5to10) },
      { label: '₹10L+', members: n(b.over10l) },
    ],
    reportingMembersAllTime: n(b.reporting),
  };
}

// ── 6. Support load ──────────────────────────────────────────────────────────

export async function loadSupport(db: Db, range: DateRange) {
  const [byCategory, byHost, tickets, ticketTimes, byPlan] = await Promise.all([
    db.$queryRawUnsafe<any[]>(`
      SELECT s.category, COUNT(DISTINCT s.id)::int AS sessions,
             COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'cancelled')::int AS sessions_cancelled,
             COALESCE(SUM(s.capacity) FILTER (WHERE s.status <> 'cancelled'), 0)::int AS capacity,
             COUNT(bk.id) FILTER (WHERE bk.status <> 'cancelled')::int AS booked,
             COUNT(bk.id) FILTER (WHERE bk.status = 'attended')::int AS attended,
             COUNT(bk.id) FILTER (WHERE bk.status = 'no_show')::int AS no_show,
             COUNT(bk.id) FILTER (WHERE bk.status = 'cancelled')::int AS cancelled
        FROM support_call_sessions s
        LEFT JOIN support_call_bookings bk ON bk.session_id = s.id
       WHERE s.starts_at >= $1 AND s.starts_at < $2
       GROUP BY s.category ORDER BY 2 DESC`, range.start, range.end),
    db.$queryRawUnsafe<any[]>(`
      SELECT COALESCE(NULLIF(TRIM(a.full_name), ''), s.host_name, 'Unassigned') AS host,
             COUNT(DISTINCT s.id) FILTER (WHERE s.status <> 'cancelled')::int AS sessions,
             COUNT(bk.id) FILTER (WHERE bk.status <> 'cancelled')::int AS booked,
             COUNT(bk.id) FILTER (WHERE bk.status = 'attended')::int AS attended,
             COUNT(bk.id) FILTER (WHERE bk.status = 'no_show')::int AS no_show,
             COALESCE(SUM(s.duration_minutes) FILTER (WHERE s.status <> 'cancelled'), 0)::int AS scheduled_minutes
        FROM support_call_sessions s
        LEFT JOIN admins a ON a.id = s.host_admin_id
        LEFT JOIN support_call_bookings bk ON bk.session_id = s.id
       WHERE s.starts_at >= $1 AND s.starts_at < $2
       GROUP BY 1 ORDER BY 2 DESC`, range.start, range.end),
    db.$queryRawUnsafe<any[]>(`
      SELECT COUNT(*) FILTER (WHERE created_at >= $1 AND created_at < $2)::int AS created,
             COUNT(*) FILTER (WHERE COALESCE(resolved_at, closed_at) >= $1 AND COALESCE(resolved_at, closed_at) < $2)::int AS resolved,
             COUNT(*) FILTER (WHERE resolved_at IS NULL AND closed_at IS NULL AND status NOT IN ('resolved', 'closed'))::int AS open,
             COUNT(*) FILTER (WHERE resolved_at IS NULL AND closed_at IS NULL AND status NOT IN ('resolved', 'closed')
                                AND resolve_deadline IS NOT NULL AND resolve_deadline < now())::int AS overdue,
             COUNT(*) FILTER (WHERE resolved_at IS NULL AND closed_at IS NULL AND status NOT IN ('resolved', 'closed') AND priority IN ('high', 'urgent'))::int AS open_high
        FROM helpdesk_tickets`, range.start, range.end),
    db.$queryRawUnsafe<any[]>(`
      SELECT EXTRACT(EPOCH FROM (LEAST(t.admin_replied_at,
               (SELECT MIN(r.created_at) FROM helpdesk_ticket_replies r WHERE r.ticket_id = t.id AND r.is_from_admin)) - t.created_at)) / 3600 AS first_response_h,
             EXTRACT(EPOCH FROM (COALESCE(t.resolved_at, t.closed_at) - t.created_at)) / 3600 AS resolution_h
        FROM helpdesk_tickets t WHERE t.created_at >= $1 AND t.created_at < $2`, range.start, range.end),
    db.$queryRawUnsafe<any[]>(`
      SELECT m.membership_plan::text AS plan, u.type, COUNT(*)::int AS used, COUNT(DISTINCT u.member_id)::int AS members
        FROM support_usage u JOIN members m ON m.id = u.member_id
       WHERE u.used_at >= $1 AND u.used_at < $2
       GROUP BY 1, 2 ORDER BY 1, 3 DESC`, range.start, range.end),
  ]);
  const t = tickets[0] ?? {};
  const fr = median(ticketTimes.map((r) => r.first_response_h).filter((v) => v != null).map(Number));
  const rs = median(ticketTimes.map((r) => r.resolution_h).filter((v) => v != null).map(Number));
  return {
    calls: {
      byCategory: byCategory.map((r) => ({
        category: r.category, sessions: n(r.sessions), sessionsCancelled: n(r.sessions_cancelled), capacity: n(r.capacity),
        booked: n(r.booked), attended: n(r.attended), noShow: n(r.no_show), cancelled: n(r.cancelled),
        fillRate: n(r.capacity) ? round1((n(r.booked) / n(r.capacity)) * 100) : null,
        noShowRate: n(r.attended) + n(r.no_show) ? round1((n(r.no_show) / (n(r.attended) + n(r.no_show))) * 100) : null,
      })),
      byHost: byHost.map((r) => ({
        host: r.host, sessions: n(r.sessions), booked: n(r.booked), attended: n(r.attended), noShow: n(r.no_show),
        scheduledHours: round1(n(r.scheduled_minutes) / 60),
      })),
    },
    tickets: {
      created: n(t.created), resolved: n(t.resolved), open: n(t.open), overdue: n(t.overdue), openHighPriority: n(t.open_high),
      medianFirstResponseHours: fr == null ? null : round1(fr),
      medianResolutionHours: rs == null ? null : round1(rs),
    },
    usageByPlan: byPlan.map((r) => ({ plan: r.plan, type: r.type, used: n(r.used), members: n(r.members) })),
  };
}

// ── 7. Revenue depth ─────────────────────────────────────────────────────────

export async function loadRevenue(db: Db, range: DateRange) {
  const step = range.bucket === 'week' ? 7 : 1;
  const [bySource, byMethod, byCourse, repeat, refunds, failures, pending, expiring, series] = await Promise.all([
    db.$queryRawUnsafe<any[]>(`
      WITH ${REVENUE_CTE}
      SELECT source, COALESCE(SUM(amount) FILTER (WHERE at >= $1 AND at < $2), 0) AS cur,
             COALESCE(SUM(amount) FILTER (WHERE at >= $3 AND at < $4), 0) AS prev,
             COUNT(*) FILTER (WHERE at >= $1 AND at < $2)::int AS count
        FROM rev GROUP BY source`, range.start, range.end, range.prevStart, range.prevEnd),
    db.$queryRawUnsafe<any[]>(`
      SELECT method::text AS method, COUNT(*)::int AS count, COALESCE(SUM(amount), 0) AS amount
        FROM course_payments WHERE status = 'completed' AND COALESCE(paid_at, created_at) >= $1 AND COALESCE(paid_at, created_at) < $2
       GROUP BY 1 ORDER BY 3 DESC`, range.start, range.end),
    db.$queryRawUnsafe<any[]>(`
      SELECT c.id, c.title, COUNT(*)::int AS count, COALESCE(SUM(cp.amount), 0) AS amount
        FROM course_payments cp JOIN courses c ON c.id = cp.course_id
       WHERE cp.status = 'completed' AND COALESCE(cp.paid_at, cp.created_at) >= $1 AND COALESCE(cp.paid_at, cp.created_at) < $2
       GROUP BY c.id, c.title ORDER BY amount DESC LIMIT 20`, range.start, range.end),
    db.$queryRawUnsafe<any[]>(`
      WITH ${REVENUE_CTE},
      buyers AS (SELECT DISTINCT member_id FROM rev WHERE at >= $1 AND at < $2 AND amount > 0)
      SELECT (SELECT COUNT(*) FROM buyers)::int AS buyers,
             (SELECT COUNT(*) FROM buyers b WHERE EXISTS (SELECT 1 FROM rev r WHERE r.member_id = b.member_id AND r.at < $1 AND r.amount > 0))::int AS returning,
             (SELECT COUNT(*) FROM (SELECT member_id FROM rev WHERE amount > 0 GROUP BY member_id HAVING COUNT(*) >= 2) x)::int AS repeat_all_time,
             (SELECT COUNT(DISTINCT member_id) FROM rev WHERE amount > 0)::int AS buyers_all_time`, range.start, range.end),
    db.$queryRawUnsafe<any[]>(`
      SELECT COALESCE(SUM(amount) FILTER (WHERE status = 'refunded'), 0) AS refunded,
             COUNT(*) FILTER (WHERE status = 'refunded')::int AS refunded_count,
             COALESCE(SUM(amount) FILTER (WHERE status IN ('completed', 'refunded')), 0) AS gross
        FROM course_payments WHERE created_at >= $1 AND created_at < $2`, range.start, range.end),
    db.$queryRawUnsafe<any[]>(`
      SELECT (SELECT COUNT(*) FROM course_payments WHERE status = 'failed' AND created_at >= $1 AND created_at < $2)::int AS course_failed,
             (SELECT COALESCE(SUM(amount), 0) FROM course_payments WHERE status = 'failed' AND created_at >= $1 AND created_at < $2) AS course_failed_amount,
             (SELECT COUNT(*) FROM coin_orders WHERE status = 'failed' AND created_at >= $1 AND created_at < $2)::int AS coin_failed,
             (SELECT COALESCE(SUM(amount_paise), 0) / 100.0 FROM coin_orders WHERE status = 'failed' AND created_at >= $1 AND created_at < $2) AS coin_failed_amount`,
      range.start, range.end),
    db.$queryRawUnsafe<any[]>(`
      SELECT COUNT(*)::int AS count, COALESCE(SUM(amount), 0) AS amount,
             COUNT(*) FILTER (WHERE created_at < now() - interval '1 day')::int AS older_than_day
        FROM course_payments WHERE status = 'pending'`),
    db.$queryRawUnsafe<any[]>(`
      SELECT ca.id, m.id AS "memberId", m.first_name AS "firstName", m.last_name AS "lastName", m.phone, m.email,
             c.title AS course, ca.expires_at AS "expiresAt", m.last_active_at AS "lastActiveAt",
             (SELECT cp.amount FROM course_payments cp WHERE cp.id = ca.payment_id) AS "paidAmount"
        FROM course_access ca
        JOIN members m ON m.id = ca.member_id AND m.deleted_at IS NULL
        JOIN courses c ON c.id = ca.course_id
       WHERE ca.is_active AND ca.access_type::text = 'duration'
         AND ca.expires_at >= now() AND ca.expires_at < now() + interval '30 days'
       ORDER BY ca.expires_at LIMIT 300`),
    db.$queryRawUnsafe<any[]>(`
      WITH ${REVENUE_CTE}
      SELECT ${bucketOf(istDay('at'), '$3', '$4')} AS bucket,
             COALESCE(SUM(amount) FILTER (WHERE source = 'courses'), 0) AS courses,
             COALESCE(SUM(amount) FILTER (WHERE source = 'coins'), 0) AS coins,
             COALESCE(SUM(amount) FILTER (WHERE source = 'credits'), 0) AS credits
        FROM rev WHERE at >= $1 AND at < $2 GROUP BY 1`, range.start, range.end, range.from, step),
  ]);
  const [expiredRecently] = await safe(db.$queryRawUnsafe<any[]>(`
    SELECT COUNT(*)::int AS count FROM course_access
     WHERE access_type::text = 'duration' AND expires_at < now() AND expires_at >= now() - interval '30 days'`), [{ count: 0 }]);

  const r = repeat[0] ?? {};
  const rf = refunds[0] ?? {};
  const f = failures[0] ?? {};
  const pd = pending[0] ?? {};
  return {
    bySource: ['courses', 'coins', 'credits'].map((s) => {
      const row = bySource.find((x) => x.source === s) ?? {};
      return { source: s, revenue: n(row.cur), revenuePrev: n(row.prev), change: pctChange(n(row.cur), n(row.prev)), count: n(row.count) };
    }),
    byMethod: byMethod.map((x) => ({ method: x.method, count: n(x.count), amount: n(x.amount) })),
    byCourse: byCourse.map((x) => ({ id: x.id, title: x.title, count: n(x.count), amount: n(x.amount) })),
    buyers: {
      inRange: n(r.buyers), returning: n(r.returning),
      returningPercent: n(r.buyers) ? round1((n(r.returning) / n(r.buyers)) * 100) : null,
      repeatAllTime: n(r.repeat_all_time), buyersAllTime: n(r.buyers_all_time),
      repeatPercentAllTime: n(r.buyers_all_time) ? round1((n(r.repeat_all_time) / n(r.buyers_all_time)) * 100) : null,
    },
    refunds: {
      amount: n(rf.refunded), count: n(rf.refunded_count),
      ratePercent: n(rf.gross) ? round1((n(rf.refunded) / n(rf.gross)) * 100) : null,
    },
    failed: {
      coursePayments: n(f.course_failed), coursePaymentsAmount: n(f.course_failed_amount),
      coinOrders: n(f.coin_failed), coinOrdersAmount: n(f.coin_failed_amount),
    },
    pending: { count: n(pd.count), amount: n(pd.amount), olderThanADay: n(pd.older_than_day) },
    expiringSoon: expiring.map((x) => ({
      id: x.id, memberId: x.memberId, name: `${x.firstName ?? ''} ${x.lastName ?? ''}`.trim(), phone: x.phone, email: x.email,
      course: x.course, expiresAt: x.expiresAt, lastActiveAt: x.lastActiveAt, paidAmount: x.paidAmount == null ? null : n(x.paidAmount),
    })),
    expiredLast30Days: n(expiredRecently?.count),
    series: fillSeries(range, series.map((s) => ({ bucket: s.bucket, courses: n(s.courses), coins: n(s.coins), credits: n(s.credits) })), ['courses', 'coins', 'credits']),
  };
}

// ── 8. Page / feature usage ──────────────────────────────────────────────────

export async function loadUsage(db: Db, range: DateRange) {
  const [sections, courses, since] = await Promise.all([
    db.$queryRawUnsafe<any[]>(`
      SELECT section,
             COALESCE(SUM(minutes) FILTER (WHERE activity_date BETWEEN $1::date AND $2::date), 0)::int AS minutes,
             COUNT(DISTINCT member_id) FILTER (WHERE activity_date BETWEEN $1::date AND $2::date)::int AS members,
             COALESCE(SUM(minutes) FILTER (WHERE activity_date BETWEEN $3::date AND $4::date), 0)::int AS minutes_prev,
             COUNT(DISTINCT member_id) FILTER (WHERE activity_date BETWEEN $3::date AND $4::date)::int AS members_prev
        FROM member_section_minutes
       WHERE activity_date BETWEEN $3::date AND $2::date
       GROUP BY 1`, range.from, range.to, range.prevFrom, range.prevTo),
    db.$queryRawUnsafe<any[]>(`
      SELECT c.id, c.title,
             COUNT(DISTINCT v.member_id) FILTER (WHERE v.section = 'course-page')::int AS viewers,
             COALESCE(SUM(v.minutes) FILTER (WHERE v.section = 'course-page'), 0)::int AS page_minutes,
             COUNT(DISTINCT v.member_id) FILTER (WHERE v.section = 'learning')::int AS learners,
             COALESCE(SUM(v.minutes) FILTER (WHERE v.section = 'learning'), 0)::int AS learning_minutes
        FROM member_section_minutes v JOIN courses c ON c.id::text = v.ref_id
       WHERE v.section IN ('course-page', 'learning') AND v.activity_date BETWEEN $1::date AND $2::date
       GROUP BY c.id, c.title ORDER BY viewers DESC, learners DESC LIMIT 20`, range.from, range.to),
    getSectionTrackingStart(db),
  ]);
  const rows = sections
    .map((s) => ({
      section: s.section, label: USAGE_SECTIONS[s.section] ?? s.section,
      minutes: n(s.minutes), members: n(s.members), minutesPrev: n(s.minutes_prev), membersPrev: n(s.members_prev),
      change: pctChange(n(s.members), n(s.members_prev)),
    }))
    .filter((s) => s.minutes > 0 || s.minutesPrev > 0)
    .sort((a, b) => b.members - a.members || b.minutes - a.minutes);
  return {
    trackingSince: since,
    note: 'Active minutes on the web app, counted per page section. The mobile app is not included.',
    sections: rows,
    courses: courses.map((c) => ({
      id: c.id, title: c.title, pageViewers: n(c.viewers), pageMinutes: n(c.page_minutes),
      learners: n(c.learners), learningMinutes: n(c.learning_minutes),
    })),
  };
}

// ── 9. Predictive at-risk score ──────────────────────────────────────────────

export interface RiskMember extends RiskResult {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  plan: string;
  batch: string | null;
  lastActiveAt: string | null;
}

let riskCache: { at: number; rows: RiskMember[] } | null = null;

export async function loadRiskMembers(db: Db, now: Date, opts: { fresh?: boolean } = {}): Promise<RiskMember[]> {
  if (!opts.fresh && riskCache && now.getTime() - riskCache.at < 5 * 60_000) return riskCache.rows;
  const today = istDate(now);
  const thisWeek = istWeekStart(now);
  const w1 = new Date(thisWeek.getTime() - 7 * 86_400_000);
  const w2 = new Date(thisWeek.getTime() - 14 * 86_400_000);
  const rows = await db.$queryRawUnsafe<any[]>(`
    SELECT m.id, m.first_name AS "firstName", m.last_name AS "lastName", m.phone, m.email,
           m.membership_plan::text AS plan, b.name AS batch, m.last_active_at AS "lastActiveAt",
           CASE WHEN m.last_active_at IS NULL THEN NULL
                ELSE ($1::date - ${istDay('m.last_active_at')}) END AS days_since_active,
           (SELECT COUNT(*) FROM member_daily_activity d WHERE d.member_id = m.id AND d.activity_date > $1::date - 7)::int AS last7,
           (SELECT COUNT(*) FROM member_daily_activity d WHERE d.member_id = m.id
               AND d.activity_date > $1::date - 14 AND d.activity_date <= $1::date - 7)::int AS prev7,
           (SELECT MIN(ce.enrolled_at) FROM course_enrollments ce WHERE ce.member_id = m.id) AS first_enrolled,
           EXISTS (SELECT 1 FROM course_weekly_feedback f WHERE f.member_id = m.id AND f.submitted_at >= $2 AND f.submitted_at < $3) AS rep_w1,
           EXISTS (SELECT 1 FROM course_weekly_feedback f WHERE f.member_id = m.id AND f.submitted_at >= $4 AND f.submitted_at < $2) AS rep_w2,
           (SELECT AVG(x.rating) FROM (SELECT rating FROM lesson_feedback lf WHERE lf.member_id = m.id ORDER BY lf.updated_at DESC LIMIT 5) x) AS avg_rating,
           (SELECT MIN(ca.expires_at) FROM course_access ca WHERE ca.member_id = m.id AND ca.is_active
               AND ca.access_type::text = 'duration' AND ca.expires_at >= now()) AS access_ends,
           EXISTS (SELECT 1 FROM course_enrollments ce WHERE ce.member_id = m.id AND ce.completed_at IS NULL) AS has_open_course,
           GREATEST(
             (SELECT MAX(p.completed_at) FROM course_episode_progress p WHERE p.member_id = m.id AND p.completed),
             (SELECT MIN(ce.enrolled_at) FROM course_enrollments ce WHERE ce.member_id = m.id AND ce.completed_at IS NULL)
           ) AS last_lesson_or_enrol,
           (SELECT COUNT(*) FROM helpdesk_tickets t WHERE t.member_id = m.id AND t.resolved_at IS NULL AND t.closed_at IS NULL
               AND t.status NOT IN ('resolved', 'closed') AND t.created_at < now() - interval '3 days')::int AS stale_tickets
      FROM members m LEFT JOIN batches b ON b.id = m.batch_id
     WHERE m.deleted_at IS NULL AND m.status = 'active'`, today, w1, thisWeek, w2);

  const out: RiskMember[] = rows.map((r) => {
    const firstEnrolled: Date | null = r.first_enrolled ? new Date(r.first_enrolled) : null;
    let missed = 0;
    if (firstEnrolled) {
      if (firstEnrolled < thisWeek && !r.rep_w1) missed++;
      if (firstEnrolled < w1 && !r.rep_w2) missed++;
    }
    const lastLesson = r.last_lesson_or_enrol ? istDate(new Date(r.last_lesson_or_enrol)) : null;
    const res = riskScore({
      daysSinceActive: r.days_since_active == null ? null : n(r.days_since_active),
      activeDaysLast7: n(r.last7),
      activeDaysPrev7: n(r.prev7),
      weeklyReportRequired: !!firstEnrolled,
      missedWeeklyReports: missed,
      avgLessonRating: r.avg_rating == null ? null : n(r.avg_rating),
      accessEndsInDays: r.access_ends ? daysBetween(today, istDate(new Date(r.access_ends))) : null,
      daysSinceLastLesson: r.has_open_course && lastLesson ? daysBetween(lastLesson, today) : null,
      staleOpenTickets: n(r.stale_tickets),
    });
    return {
      id: r.id, name: `${r.firstName ?? ''} ${r.lastName ?? ''}`.trim() || 'Member', phone: r.phone ?? null, email: r.email ?? null,
      plan: r.plan, batch: r.batch ?? null, lastActiveAt: r.lastActiveAt ? new Date(r.lastActiveAt).toISOString() : null, ...res,
    };
  });
  out.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  riskCache = { at: now.getTime(), rows: out };
  return out;
}
