// Admin analytics — member activity table. Pure: parses the query string into safe filters and
// builds the SQL + parameters (no Prisma, no env), so the filter/sort rules are unit-tested
// (memberAnalyticsQuery.test.ts). Data sources:
//   - last active:     members.last_active_at (written on every recorded activity minute)
//   - active days / minutes / video minutes: member_daily_activity (server-clock minutes)
//   - lessons / watch time: course_episode_progress + member_episode_progress (workshops)
//   - tasks: task_submissions; weekly report: course_weekly_feedback

export const ACTIVITY_FILTERS = ['any', 'active_today', 'active_7d', 'active_30d', 'inactive_7d', 'inactive_30d', 'never'] as const;
export type ActivityFilter = (typeof ACTIVITY_FILTERS)[number];

export const SORT_KEYS = ['last_active', 'active_minutes', 'video_minutes', 'active_days', 'lessons', 'watch_time', 'tasks', 'joined', 'name'] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export const RANGE_DAYS = [7, 30, 90] as const;
const STATUSES = ['active', 'inactive', 'paused', 'suspended', 'pending'];
const PLAN_RE = /^[a-z_]{1,40}$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface MemberAnalyticsFilters {
  search: string;
  status: string | null;
  plan: string | null;
  batchId: string | null;
  courseId: string | null;
  activity: ActivityFilter;
  weeklyReport: 'any' | 'submitted' | 'missing';
  rangeDays: number;
  sort: SortKey;
  order: 'asc' | 'desc';
  page: number;
  limit: number;
}

const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;

export function parseMemberAnalyticsFilters(q: Record<string, unknown>, maxLimit = 5000): MemberAnalyticsFilters {
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const rangeDays = Number(q.rangeDays);
  const page = Math.max(1, Math.floor(Number(q.page) || 1));
  const limit = Math.min(maxLimit, Math.max(1, Math.floor(Number(q.limit) || 25)));
  const status = str(q.status);
  const plan = str(q.plan);
  const batchId = str(q.batchId);
  const courseId = str(q.courseId);
  return {
    search: str(q.search).slice(0, 100),
    status: STATUSES.includes(status) ? status : null,
    plan: plan && PLAN_RE.test(plan) ? plan : null,
    batchId: UUID_RE.test(batchId) ? batchId : null,
    courseId: UUID_RE.test(courseId) ? courseId : null,
    activity: pick(q.activity, ACTIVITY_FILTERS, 'any'),
    weeklyReport: pick(q.weeklyReport, ['any', 'submitted', 'missing'] as const, 'any'),
    rangeDays: (RANGE_DAYS as readonly number[]).includes(rangeDays) ? rangeDays : 30,
    sort: pick(q.sort, SORT_KEYS, 'last_active'),
    order: q.order === 'asc' ? 'asc' : 'desc',
    page,
    limit,
  };
}

const SORT_SQL: Record<SortKey, string> = {
  last_active: 'last_active_at',
  active_minutes: 'active_minutes',
  video_minutes: 'video_minutes',
  active_days: 'active_days',
  lessons: 'lessons_range',
  watch_time: 'watch_secs',
  tasks: 'tasks_range',
  joined: 'created_at',
  name: "lower(first_name || ' ' || coalesce(last_name, ''))",
};

/**
 * @param timeZone a validated IANA zone (resolveProgramTimezone) — embedded in the SQL.
 * @param weekStart Monday 00:00 of the current weekly-report week.
 */
export function buildMemberAnalyticsQuery(f: MemberAnalyticsFilters, timeZone: string, weekStart: Date): { sql: string; params: unknown[] } {
  const params: unknown[] = [];
  const p = (v: unknown) => { params.push(v); return `$${params.length}`; };

  const rangeDays = p(f.rangeDays);
  const fromDate = `((now() AT TIME ZONE '${timeZone}')::date - (${rangeDays}::int - 1))`;
  const fromTs = `(now() - make_interval(days => ${rangeDays}::int))`;
  const week = p(weekStart);

  const where: string[] = ['m.deleted_at IS NULL'];
  if (f.search) {
    const s = p(`%${f.search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
    where.push(`(m.first_name || ' ' || coalesce(m.last_name, '') ILIKE ${s} OR m.email ILIKE ${s} OR m.phone ILIKE ${s} OR m.member_id ILIKE ${s})`);
  }
  if (f.status) where.push(`m.status::text = ${p(f.status)}`);
  if (f.plan) where.push(`m.membership_plan::text = ${p(f.plan)}`);
  if (f.batchId) where.push(`m.batch_id = ${p(f.batchId)}::uuid`);
  if (f.courseId) where.push(`EXISTS (SELECT 1 FROM course_enrollments ce2 WHERE ce2.member_id = m.id AND ce2.course_id = ${p(f.courseId)}::uuid)`);
  const today = `(now() AT TIME ZONE '${timeZone}')::date`;
  switch (f.activity) {
    case 'active_today': where.push(`(m.last_active_at AT TIME ZONE '${timeZone}')::date = ${today}`); break;
    case 'active_7d': where.push(`m.last_active_at >= now() - interval '7 days'`); break;
    case 'active_30d': where.push(`m.last_active_at >= now() - interval '30 days'`); break;
    case 'inactive_7d': where.push(`(m.last_active_at IS NULL OR m.last_active_at < now() - interval '7 days')`); break;
    case 'inactive_30d': where.push(`(m.last_active_at IS NULL OR m.last_active_at < now() - interval '30 days')`); break;
    case 'never': where.push('m.last_active_at IS NULL'); break;
  }
  const hasReport = `EXISTS (SELECT 1 FROM course_weekly_feedback wf WHERE wf.member_id = m.id AND wf.submitted_at >= ${week})`;
  if (f.weeklyReport === 'submitted') where.push(hasReport);
  if (f.weeklyReport === 'missing') where.push(`NOT ${hasReport} AND EXISTS (SELECT 1 FROM course_enrollments ce3 WHERE ce3.member_id = m.id)`);

  const nulls = f.sort === 'last_active' ? (f.order === 'desc' ? ' NULLS LAST' : ' NULLS FIRST') : '';
  const orderBy = `${SORT_SQL[f.sort]} ${f.order.toUpperCase()}${nulls}, created_at DESC`;
  const limit = p(f.limit);
  const offset = p((f.page - 1) * f.limit);

  const sql = `
    SELECT * FROM (
      SELECT m.id, m.member_id, m.first_name, m.last_name, m.email, m.phone,
             m.status::text AS status, m.membership_plan::text AS plan,
             b.name AS batch_name, am.full_name AS account_manager_name, m.created_at, m.last_active_at,
             COALESCE(a.active_days, 0)::int     AS active_days,
             COALESCE(a.active_minutes, 0)::int  AS active_minutes,
             COALESCE(a.video_minutes, 0)::int   AS video_minutes,
             (COALESCE(cp.lessons_total, 0) + COALESCE(wp.lessons_total, 0))::int AS lessons_total,
             (COALESCE(cp.lessons_range, 0) + COALESCE(wp.lessons_range, 0))::int AS lessons_range,
             (COALESCE(cp.watch_secs, 0) + COALESCE(wp.watch_secs, 0))::bigint    AS watch_secs,
             COALESCE(ce.courses, 0)::int        AS courses,
             COALESCE(ts.tasks_range, 0)::int    AS tasks_range,
             ${hasReport} AS weekly_report
        FROM members m
        LEFT JOIN batches b ON b.id = m.batch_id
        LEFT JOIN admins am ON am.id = m.account_manager_id
        LEFT JOIN LATERAL (
          SELECT COUNT(*) AS active_days,
                 SUM(length(replace(d.active_bits::text, '0', ''))) AS active_minutes,
                 SUM(length(replace(d.media_bits::text, '0', '')))  AS video_minutes
            FROM member_daily_activity d
           WHERE d.member_id = m.id AND d.activity_date >= ${fromDate}
        ) a ON true
        LEFT JOIN LATERAL (
          SELECT COUNT(*) FILTER (WHERE completed) AS lessons_total,
                 COUNT(*) FILTER (WHERE completed AND completed_at >= ${fromTs}) AS lessons_range,
                 SUM(actual_watched_secs) AS watch_secs
            FROM course_episode_progress WHERE member_id = m.id
        ) cp ON true
        LEFT JOIN LATERAL (
          SELECT COUNT(*) FILTER (WHERE is_completed) AS lessons_total,
                 COUNT(*) FILTER (WHERE is_completed AND completed_at >= ${fromTs}) AS lessons_range,
                 SUM(actual_watched_secs) AS watch_secs
            FROM member_episode_progress WHERE member_id = m.id
        ) wp ON true
        LEFT JOIN LATERAL (SELECT COUNT(*) AS courses FROM course_enrollments WHERE member_id = m.id) ce ON true
        LEFT JOIN LATERAL (
          SELECT COUNT(*) AS tasks_range FROM task_submissions WHERE member_id = m.id AND created_at >= ${fromTs}
        ) ts ON true
       WHERE ${where.join(' AND ')}
    ) r
    ORDER BY ${orderBy}
    LIMIT ${limit} OFFSET ${offset}`;

  return { sql, params };
}

/** COUNT query for the same filters (reuses the WHERE by building with limit 1). */
export function buildMemberAnalyticsCountQuery(f: MemberAnalyticsFilters, timeZone: string, weekStart: Date): { sql: string; params: unknown[] } {
  const { sql, params } = buildMemberAnalyticsQuery({ ...f, page: 1 }, timeZone, weekStart);
  const inner = sql.slice(sql.indexOf('SELECT * FROM (') + 'SELECT * FROM ('.length, sql.lastIndexOf(') r'));
  return { sql: `SELECT COUNT(*)::int AS total FROM (${inner}) r`, params: params.slice(0, params.length - 2) };
}
