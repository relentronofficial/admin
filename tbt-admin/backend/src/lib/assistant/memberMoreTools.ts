/**
 * Member assistant tools, part 3: the weekly graph, points and rank, lifelines,
 * workshops and webinars, notifications, the weekly report, where to resume,
 * a lesson's notes, the week ahead — and four more things to prepare for the
 * member to confirm (revenue figures, a task draft, a lesson rating, a memory
 * note). As everywhere, the member comes from the session (ctx), never the model.
 */
import { loadCoinBalance } from '../supportCallData.js';
import { computeStreakPointsSummary, type StreakPointsRow } from '../streakPointsLogic.js';
import { loadMemberWeeklyGraph } from '../memberWeeklyGraph.js';
import { loadWeeklyReportStatus } from '../weeklyReportAccess.js';
import { isTaskVisibleToMember } from '../weeklyGraphLogic.js';
import { MAX_ACTIONS, type HelpBotAction } from '../helpBot/actions.js';
import { buildNudges, isoWeekIst, type NudgeInput } from '../helpBot/extras.js';
import { batchDay } from './adminTools.js';
import { myCourses, pickOne } from './memberActionTools.js';
import type { MemberToolCtx } from './memberTools.js';
import { ToolError, ist, listed, type AssistantTool } from './registry.js';

const always = () => true;
const text = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const istDate = (d: Date) => new Date(d.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const PREPARED = 'Ready. The app now shows a card. It is NOT done yet: tell the member to check the card and press its button.';

function prepare(c: MemberToolCtx, a: HelpBotAction) {
  if (!c.actions) throw new ToolError('This cannot be prepared here.');
  if (c.actions.length >= MAX_ACTIONS) throw new ToolError('Too many things at once. Ask the member to confirm these first.');
  c.actions.push(a);
  return { status: PREPARED };
}

async function member(c: MemberToolCtx) {
  const m = await c.prisma.member.findFirst({ where: { id: c.memberId, deletedAt: null }, select: { id: true, batchId: true } });
  if (!m) throw new ToolError('Your account could not be found.');
  return m;
}

/** The member's batch day, or null when they are not in a started batch. */
async function currentDay(c: MemberToolCtx, batchId: string | null) {
  if (!batchId) return null;
  const b = await c.prisma.batch.findUnique({ where: { id: batchId }, select: { startsAt: true, programId: true } });
  if (!b) return null;
  const day = batchDay(b.startsAt, null, c.now);
  return day >= 1 ? { day, programId: b.programId } : null;
}

/** Tasks of one batch day this member can see, with what they submitted. */
async function dayTasks(c: MemberToolCtx, memberId: string, batchId: string, programId: string | null, day: number) {
  const [tasks, subs] = await Promise.all([
    c.prisma.task.findMany({
      where: { isActive: true, dayNumber: day, OR: [{ batchId }, ...(programId ? [{ programId, batchId: null }] : [])] },
      orderBy: { sortOrder: 'asc' }, select: { id: true, title: true, isRequired: true },
    }),
    c.prisma.taskSubmission.findMany({ where: { memberId, batchId, dayNumber: day }, select: { taskId: true, status: true } }),
  ]);
  const owners = tasks.length
    ? await c.prisma.$queryRawUnsafe<Array<{ id: string; member_id: string | null }>>(`SELECT id::text, member_id::text FROM tasks WHERE id = ANY($1::uuid[])`, tasks.map((t) => t.id))
    : [];
  const owner = new Map(owners.map((o) => [o.id, o.member_id]));
  const status = new Map(subs.map((s) => [s.taskId, s.status]));
  return tasks
    .filter((t) => owner.has(t.id) && isTaskVisibleToMember({ memberId: owner.get(t.id) ?? null }, memberId))
    .map((t) => ({ id: t.id, title: t.title, required: t.isRequired, status: status.get(t.id) ?? 'not_submitted' }));
}

/** The next lesson to watch in each of the member's courses (most recently watched course first). */
async function nextLessons(c: MemberToolCtx, max: number) {
  const courses = await myCourses(c);
  if (!courses.length) return [];
  const episodes = await c.prisma.courseEpisode.findMany({
    where: { courseId: { in: courses.map((x) => x.id) }, isVisible: true },
    orderBy: [{ courseId: 'asc' }, { order: 'asc' }], take: 2000,
    select: { id: true, title: true, courseId: true, progress: { where: { memberId: c.memberId }, select: { completed: true, updatedAt: true } } },
  });
  const out: Array<{ course: string; title: string; link: string; lastWatched: number }> = [];
  for (const course of courses) {
    const mine = episodes.filter((e) => e.courseId === course.id);
    const next = mine.find((e) => !e.progress[0]?.completed);
    if (!next) continue;
    const lastWatched = Math.max(0, ...mine.map((e) => e.progress[0]?.updatedAt?.getTime() ?? 0));
    out.push({ course: course.title, title: next.title, link: `/learning/${course.id}?lesson=${next.id}`, lastWatched });
  }
  return out.sort((a, b) => b.lastWatched - a.lastWatched).slice(0, max);
}

/** Everything the daily nudge card and the week plan start from. */
export async function loadNudgeInput(c: MemberToolCtx): Promise<NudgeInput & { lessons: Awaited<ReturnType<typeof nextLessons>> }> {
  const m = await member(c);
  const today = istDate(c.now);
  const [report, lessons, day, calls, unread, habits] = await Promise.all([
    loadWeeklyReportStatus(c.prisma as any, m.id, c.now).catch(() => null),
    nextLessons(c, 3),
    currentDay(c, m.batchId),
    c.prisma.$queryRawUnsafe<Array<{ title: string; starts_at: Date }>>(
      `SELECT s.title, s.starts_at FROM support_call_bookings b JOIN support_call_sessions s ON s.id = b.session_id
        WHERE b.member_id = $1::uuid AND b.status = 'booked' AND s.status = 'scheduled'
          AND s.starts_at + make_interval(mins => s.duration_minutes) > $2::timestamptz
          AND (s.starts_at AT TIME ZONE 'Asia/Kolkata')::date = $3::date
        ORDER BY s.starts_at LIMIT 3`, m.id, c.now, today).catch(() => []),
    c.prisma.notification.count({ where: { memberId: m.id, isRead: false } }).catch(() => 0),
    c.prisma.$queryRawUnsafe<Array<{ left: number }>>(
      `SELECT COUNT(*)::int AS left FROM habits h WHERE h.status = 'active'
          AND NOT EXISTS (SELECT 1 FROM member_habit_answers a WHERE a.habit_id = h.id AND a.member_id = $1::uuid AND a.answer_date = $2::date)`, m.id, today).catch(() => [{ left: 0 }]),
  ]);
  let pending = 0;
  let revenueDue = false;
  if (day && m.batchId) {
    pending = (await dayTasks(c, m.id, m.batchId, day.programId, day.day).catch(() => [])).filter((t) => t.status === 'not_submitted' || t.status === 'resubmission_required').length;
    const { week, year } = isoWeekIst(c.now);
    const weekday = (new Date(c.now.getTime() + 5.5 * 3600_000).getUTCDay() + 6) % 7; // Mon=0
    if (weekday >= 4) {
      const [r] = await c.prisma.$queryRawUnsafe<Array<{ n: number }>>(
        `SELECT COUNT(*)::int AS n FROM member_revenue_reports WHERE member_id = $1::uuid AND week_number = $2 AND year = $3 AND revenue_generated IS NOT NULL`, m.id, week, year).catch(() => [{ n: 1 }]);
      revenueDue = Number(r?.n ?? 1) === 0;
    }
  }
  return {
    weeklyReport: report ? { required: report.required, submittedThisWeek: report.submittedThisWeek, locked: report.locked, showReminder: report.showReminder } : null,
    nextLesson: lessons[0] ? { title: lessons[0].title, course: lessons[0].course, link: lessons[0].link } : null,
    lessons,
    pendingTasksToday: pending,
    currentDay: day?.day ?? null,
    callsToday: calls.map((x) => ({ title: x.title, starts: ist(x.starts_at)! })),
    unreadNotifications: unread,
    habitsLeft: Number(habits[0]?.left ?? 0),
    revenueDue,
  };
}

const STREAK_SQL = `SELECT pl.points, pl.reference_type, pl.created_at, NULL::text AS title
   FROM points_ledger pl
   LEFT JOIN task_submissions ts ON pl.reference_type = 'task_submission' AND ts.id = pl.reference_id
   LEFT JOIN tasks t1 ON t1.id = ts.task_id AND t1.course_episode_id IS NOT NULL
   LEFT JOIN tasks t2 ON pl.reference_type = 'milestone' AND t2.id = pl.reference_id AND t2.course_episode_id IS NOT NULL
  WHERE pl.member_id = $1::uuid
    AND (pl.reference_type = 'episode_completion'
      OR (pl.reference_type = 'task_submission' AND t1.id IS NOT NULL)
      OR (pl.reference_type = 'milestone' AND t2.id IS NOT NULL))`;

export const memberMoreTools: AssistantTool<MemberToolCtx>[] = [
  {
    name: 'getMyWeeklyGraph',
    description: 'The signed-in member\'s Weekly Activity Graph (Mentorship page): each programme week\'s tasks done, the revenue they reported per week and in total, and which milestones (including revenue milestones and their amounts) are reached.',
    params: {},
    allowed: always,
    async run(c) {
      const g = await loadMemberWeeklyGraph(c.prisma, c.memberId);
      if (!g) return { inProgram: false };
      // No active weeks: the graph has no columns, and its currentWeek is only a
      // fallback of 1. Say so plainly instead of naming a week that isn't there.
      const current = g.weeks.find((w) => w.isCurrent);
      const weeksNote = !g.weeks.length
        ? 'The team has not set up any weeks on this graph yet, so it shows no weeks. Do not name a current week.'
        : current && g.currentDay > current.endDay
          ? `Day ${g.currentDay} is after the last week set up on this graph (${current.label}, days ${current.startDay}-${current.endDay}).`
          : null;
      return {
        inProgram: true, link: '/mentorship', currentDay: g.currentDay, currentWeek: g.weeks.length ? g.currentWeek : null, totalDays: g.totalDays,
        ...(weeksNote ? { weeksNote } : {}),
        tasksDone: g.summary,
        weeks: g.weeks.filter((w) => w.weekNumber <= g.currentWeek + 1).map((w) => ({
          week: w.label, days: `${w.startDay}-${w.endDay}`, current: w.isCurrent, tasksDone: w.completed, tasks: w.total,
          requiredDone: w.requiredCompleted, required: w.requiredTotal, reportedRevenue: w.revenue, revenueSoFar: w.cumulativeRevenue,
        })),
        milestones: g.config.milestones.map((m) => ({ label: m.label, kind: m.kind, reached: m.reached, revenueAmount: m.threshold, reachedBy: m.reachedBy, reachedInWeek: m.reachedWeek })),
        reportedRevenueTotal: g.revenue.totalToDate,
      };
    },
  },
  {
    name: 'getMyStanding',
    description: 'The signed-in member\'s TBT points (all time and last 7 days) with their leaderboard rank, streak points, course XP and badges earned.',
    params: {},
    allowed: always,
    async run(c) {
      const since = new Date(c.now.getTime() - 7 * 86_400_000);
      const [pts, streakRows, xp, badges, courseBadges] = await Promise.all([
        c.prisma.$queryRawUnsafe<any[]>(
          `WITH t AS (SELECT member_id, SUM(points) AS all_time, SUM(points) FILTER (WHERE activity_date >= $2::date) AS week FROM tbt_activity_log GROUP BY member_id),
                me AS (SELECT COALESCE(all_time, 0) AS all_time, COALESCE(week, 0) AS week FROM t WHERE member_id = $1::uuid)
           SELECT (SELECT all_time FROM me)::int AS all_time, (SELECT week FROM me)::int AS week,
                  (SELECT COUNT(*) FROM t WHERE all_time > COALESCE((SELECT all_time FROM me), 0))::int + 1 AS rank_all,
                  (SELECT COUNT(*) FROM t WHERE COALESCE(week, 0) > COALESCE((SELECT week FROM me), 0))::int + 1 AS rank_week,
                  (SELECT COUNT(*) FROM t)::int AS ranked`, c.memberId, istDate(since)),
        c.prisma.$queryRawUnsafe<StreakPointsRow[]>(STREAK_SQL, c.memberId).catch(() => [] as StreakPointsRow[]),
        c.prisma.$queryRawUnsafe<Array<{ xp: number }>>(`SELECT COALESCE(SUM(amount), 0)::int AS xp FROM member_xp WHERE member_id = $1::uuid`, c.memberId),
        c.prisma.memberBadge.findMany({ where: { memberId: c.memberId }, take: 30, orderBy: { earnedAt: 'desc' }, select: { earnedAt: true, badge: { select: { name: true } } } }),
        c.prisma.memberCourseBadge.findMany({ where: { memberId: c.memberId }, take: 30, orderBy: { earnedAt: 'desc' }, select: { earnedAt: true, badge: { select: { label: true } } } }),
      ]);
      const p = pts[0] ?? {};
      const streak = computeStreakPointsSummary(streakRows);
      return {
        points: { allTime: Number(p.all_time ?? 0), last7Days: Number(p.week ?? 0) },
        leaderboardRank: { allTime: p.all_time == null ? null : Number(p.rank_all), last7Days: p.all_time == null ? null : Number(p.rank_week), membersRanked: Number(p.ranked ?? 0) },
        streakPoints: streak.total,
        courseXp: Number(xp[0]?.xp ?? 0),
        badges: [...badges.map((b) => ({ badge: b.badge.name, earned: ist(b.earnedAt) })), ...courseBadges.map((b) => ({ badge: b.badge.label, earned: ist(b.earnedAt) }))],
        leaderboardLink: '/wins',
      };
    },
  },
  {
    name: 'getMyLifelines',
    description: 'The signed-in member\'s programme lifelines (total, used, left; at most 5 held) and coin balance for buying more.',
    params: {},
    allowed: always,
    async run(c) {
      const m = await member(c);
      const [rows, coins] = await Promise.all([
        m.batchId
          ? c.prisma.$queryRawUnsafe<Array<{ lifelines_total: number; lifelines_used: number }>>(
              `SELECT lifelines_total, lifelines_used FROM member_batch_settings WHERE member_id = $1::uuid AND batch_id = $2::uuid`, m.id, m.batchId).catch(() => [])
          : Promise.resolve([]),
        loadCoinBalance(c.prisma, m.id),
      ]);
      const r = rows[0];
      const total = r ? Number(r.lifelines_total) : m.batchId ? 3 : 0;
      const used = r ? Number(r.lifelines_used) : 0;
      return { inProgram: !!m.batchId, lifelinesTotal: total, lifelinesUsed: used, lifelinesLeft: Math.max(0, total - used), mostYouCanHold: 5, coinBalance: coins, note: 'More lifelines are bought with coins when a lesson timer runs out; buying refills up to 5, never more.' };
    },
  },
  {
    name: 'getMyWorkshopsAndWebinars',
    description: 'Workshops the signed-in member is enrolled in (with links) and coming webinars, with whether they registered.',
    params: {},
    allowed: always,
    async run(c) {
      const [enrolled, webinars] = await Promise.all([
        c.prisma.workshopEnrollment.findMany({ where: { memberId: c.memberId, status: 'active' }, take: 20, orderBy: { enrolledAt: 'desc' }, select: { enrolledAt: true, workshop: { select: { title: true, slug: true, isActive: true } } } }),
        c.prisma.webinar.findMany({ where: { scheduledAt: { gte: new Date(c.now.getTime() - 2 * 3600_000) }, status: { in: ['scheduled', 'live'] as any } }, orderBy: { scheduledAt: 'asc' }, take: 10, select: { id: true, title: true, scheduledAt: true, durationMinutes: true, status: true } }),
      ]);
      const regs = webinars.length
        ? await c.prisma.webinarRegistration.findMany({ where: { memberId: c.memberId, webinarId: { in: webinars.map((w) => w.id) } }, select: { webinarId: true } })
        : [];
      const mine = new Set(regs.map((r) => r.webinarId));
      return {
        workshops: listed(enrolled.filter((e) => e.workshop.isActive).map((e) => ({ title: e.workshop.title, enrolled: ist(e.enrolledAt), link: `/workshop/${e.workshop.slug}` })), enrolled.length),
        webinars: listed(webinars.map((w) => ({ title: w.title, when: ist(w.scheduledAt), minutes: w.durationMinutes, live: String(w.status) === 'live', registered: mine.has(w.id), link: String(w.status) === 'live' ? `/live/${w.id}` : '/workshops' })), webinars.length),
      };
    },
  },
  {
    name: 'getMyNotifications',
    description: 'The signed-in member\'s latest notifications and how many are unread. The bot cannot mark them read.',
    params: { unreadOnly: { type: 'string', enum: ['yes', 'no'], description: 'Only unread ones (default no).' } },
    allowed: always,
    async run(c, a) {
      const where = { memberId: c.memberId, ...(a.unreadOnly === 'yes' ? { isRead: false } : {}) };
      const [unread, rows] = await Promise.all([
        c.prisma.notification.count({ where: { memberId: c.memberId, isRead: false } }),
        c.prisma.notification.findMany({ where, orderBy: { sentAt: 'desc' }, take: 10, select: { title: true, body: true, isRead: true, sentAt: true, type: true } }),
      ]);
      return { unread, link: '/notifications', latest: rows.map((n) => ({ title: n.title, text: text(n.body, 200), read: n.isRead, sent: ist(n.sentAt), type: n.type })) };
    },
  },
  {
    name: 'getMyWeeklyReport',
    description: 'Whether the signed-in member has submitted this week\'s mandatory weekly report, the deadline, whether course videos are locked for it, and the latest weekly progress report the team sent them.',
    params: {},
    allowed: always,
    async run(c) {
      const [status, latest] = await Promise.all([
        loadWeeklyReportStatus(c.prisma as any, c.memberId, c.now),
        c.prisma.courseWeeklyReport.findFirst({
          where: { memberId: c.memberId, status: 'sent' }, orderBy: { createdAt: 'desc' },
          select: { weekNumber: true, progressPercentage: true, completedLessons: true, totalLessons: true, pendingTitles: true, remarks: true, createdAt: true, course: { select: { title: true } } },
        }).catch(() => null),
      ]);
      return {
        mustSubmit: status.required, submittedThisWeek: status.submittedThisWeek, videosLocked: status.locked,
        deadline: ist(status.deadline), whereToSubmit: 'The weekly report popup, or "Submit weekly report" in the course player (/learning).',
        latestTeamReport: latest ? {
          course: latest.course.title, week: latest.weekNumber, progressPercent: latest.progressPercentage, lessonsDone: latest.completedLessons, lessons: latest.totalLessons,
          stillToDo: Array.isArray(latest.pendingTitles) ? (latest.pendingTitles as unknown[]).slice(0, 8) : [], teamRemarks: latest.remarks ? text(latest.remarks, 500) : null, sent: ist(latest.createdAt),
          link: '/learning',
        } : null,
      };
    },
  },
  {
    name: 'getMyResumePoint',
    description: 'Where the signed-in member stopped: the lesson they watched last, the time they stopped at, and a link that opens it.',
    params: {},
    allowed: always,
    async run(c) {
      const courses = await myCourses(c);
      const last = courses.length ? await c.prisma.courseEpisodeProgress.findFirst({
        where: { memberId: c.memberId, episode: { courseId: { in: courses.map((x) => x.id) }, isVisible: true } },
        orderBy: { updatedAt: 'desc' },
        select: { completed: true, lastWatchedSecs: true, updatedAt: true, episode: { select: { id: true, title: true, durationSeconds: true, courseId: true, course: { select: { title: true } } } } },
      }) : null;
      const next = await nextLessons(c, 3);
      if (!last) return { watchedAnything: false, nextLessons: next };
      const e = last.episode;
      return {
        watchedAnything: true,
        lastLesson: { course: e.course.title, lesson: e.title, completed: last.completed, stoppedAt: last.completed ? null : mmss(last.lastWatchedSecs), length: e.durationSeconds ? mmss(e.durationSeconds) : null, watched: ist(last.updatedAt), link: `/learning/${e.courseId}?lesson=${e.id}` },
        nextLessons: next,
        note: 'The player resumes from where they stopped.',
      };
    },
  },
  {
    name: 'getLessonNotes',
    description: 'One lesson of the member\'s own courses: its description, resources and tasks, to answer questions about what it teaches. Leave "lesson" empty for the lesson open on their screen. Lesson videos themselves cannot be read.',
    params: {
      lesson: { type: 'string', maxLength: 150, description: 'Lesson name or part of it; empty = the lesson they have open.' },
      course: { type: 'string', maxLength: 150, description: 'Course name, if the lesson name is in more than one course.' },
    },
    allowed: always,
    async run(c, a) {
      const courses = await myCourses(c);
      const ids = courses.map((x) => x.id);
      let lessonId: string;
      if (!a.lesson) {
        if (c.page?.kind !== 'lesson' || !c.page.lessonId || !ids.includes(c.page.courseId)) throw new ToolError('No lesson is open on their screen. Ask which lesson they mean.');
        lessonId = c.page.lessonId;
      } else {
        const inCourse = a.course ? [pickOne(courses, (x) => x.title, String(a.course), 'course of theirs').id] : ids;
        const found = await c.prisma.courseEpisode.findMany({ where: { courseId: { in: inCourse }, isVisible: true, title: { contains: String(a.lesson), mode: 'insensitive' } }, take: 20, select: { id: true, title: true, course: { select: { title: true } } } });
        lessonId = pickOne(found, (x) => `${x.title} (${x.course.title})`, String(a.lesson), 'lesson of theirs').id;
      }
      const e = await c.prisma.courseEpisode.findFirst({
        where: { id: lessonId, courseId: { in: ids }, isVisible: true },
        select: { id: true, title: true, description: true, durationSeconds: true, courseId: true, course: { select: { title: true } } },
      });
      if (!e) throw new ToolError('That lesson is not in their courses.');
      const [resources, tasks] = await Promise.all([
        c.prisma.appResource.findMany({ where: { courseEpisodeId: e.id }, take: 15, select: { title: true, fileType: true } }).catch(() => []),
        c.prisma.task.findMany({ where: { courseEpisodeId: e.id, isActive: true } as any, take: 10, select: { title: true, description: true } }).catch(() => []),
      ]);
      return {
        course: e.course.title, lesson: e.title, length: e.durationSeconds ? mmss(e.durationSeconds) : null, link: `/learning/${e.courseId}?lesson=${e.id}`,
        description: e.description ? text(e.description, 3000) : null,
        resources: resources.map((r) => ({ title: r.title, type: r.fileType })),
        tasks: tasks.map((t) => ({ title: t.title, about: t.description ? text(t.description, 400) : null })),
        note: 'Only the description is known, not what is said in the video. Resources open below the video in the lesson.',
      };
    },
  },
  {
    name: 'getMyWeekAhead',
    description: 'What the signed-in member has on this week: weekly report due, today\'s programme tasks, the next lesson in each course, calls in the next 7 days, habits left today. Use it to make a weekly plan.',
    params: {},
    allowed: always,
    async run(c) {
      const [n, calls] = await Promise.all([
        loadNudgeInput(c),
        c.prisma.$queryRawUnsafe<Array<{ title: string; starts_at: Date }>>(
          `SELECT s.title, s.starts_at FROM support_call_bookings b JOIN support_call_sessions s ON s.id = b.session_id
            WHERE b.member_id = $1::uuid AND b.status = 'booked' AND s.status = 'scheduled'
              AND s.starts_at > $2::timestamptz AND s.starts_at < $2::timestamptz + INTERVAL '7 days' ORDER BY s.starts_at LIMIT 10`, c.memberId, c.now),
      ]);
      return {
        today: istDate(c.now),
        weeklyReport: n.weeklyReport,
        programmeDay: n.currentDay, tasksLeftToday: n.pendingTasksToday, tasksLink: n.currentDay ? `/batch-program/${n.currentDay}` : null,
        nextLessons: n.lessons.map(({ lastWatched: _l, ...x }) => x),
        callsThisWeek: calls.map((x) => ({ title: x.title, starts: ist(x.starts_at) })),
        habitsLeftToday: n.habitsLeft, revenueStatsDue: n.revenueDue,
        nudges: buildNudges(n, 5).map((x) => x.kind),
      };
    },
  },
  {
    name: 'prepareRevenueUpdate',
    description: 'Prepare saving this week\'s revenue (and orders) in Mentorship → Your Revenue Stats, for the member to confirm. Only for figures the member gave you for THIS week; other figures they saved stay as they are.',
    params: {
      revenue: { type: 'integer', required: true, min: 0, max: 1_000_000_000, description: 'This week\'s revenue in rupees, exactly as the member said.' },
      orders: { type: 'integer', min: 0, max: 10_000_000, description: 'Number of orders this week, if they said.' },
    },
    allowed: always,
    async run(c, a) {
      const m = await member(c);
      if (!m.batchId) throw new ToolError('Revenue stats are part of the mentorship programme; this member is not in a batch. Tell them where it is: /mentorship.');
      const { week, year } = isoWeekIst(c.now);
      return prepare(c, { type: 'revenue', revenue: Number(a.revenue), orders: a.orders == null ? null : Number(a.orders), week: `Week ${week}, ${year}` });
    },
  },
  {
    name: 'prepareTaskDraft',
    description: 'Show the member a draft answer for one of their programme tasks, with Copy and Open-task buttons. It is only a draft: the member edits and submits it themselves. Write the draft from what they told you; never invent results they did not report.',
    params: {
      task: { type: 'string', required: true, maxLength: 200, description: 'The task title or part of it (from getMyTasks).' },
      day: { type: 'integer', min: 1, max: 1000, description: 'Programme day (default: today).' },
      draft: { type: 'string', required: true, maxLength: 3000, description: 'The draft answer.' },
    },
    allowed: always,
    async run(c, a) {
      const m = await member(c);
      const d = await currentDay(c, m.batchId);
      if (!d || !m.batchId) throw new ToolError('This member is not in a started programme batch.');
      const day = Number(a.day ?? d.day);
      if (day > d.day) throw new ToolError(`Day ${day} has not been reached yet.`);
      const t = pickOne(await dayTasks(c, m.id, m.batchId, d.programId, day), (x) => x.title, String(a.task), `task on day ${day}`);
      if (t.status === 'approved' || t.status === 'pending') throw new ToolError(`That task is already ${t.status === 'approved' ? 'approved' : 'submitted and waiting for review'}.`);
      return prepare(c, { type: 'task_draft', taskTitle: t.title, text: String(a.draft).slice(0, 3000), link: `/batch-program/${day}` });
    },
  },
  {
    name: 'prepareLessonRating',
    description: 'Prepare the member\'s rating (1-10) and optional feedback for one lesson they finished, for them to confirm. Only with the rating the member gave.',
    params: {
      lesson: { type: 'string', maxLength: 150, description: 'Lesson name or part of it; empty = the lesson open on their screen.' },
      rating: { type: 'integer', required: true, min: 1, max: 10, description: 'Their rating, 1-10.' },
      feedback: { type: 'string', maxLength: 1000, description: 'Their feedback in their own words, if any.' },
    },
    allowed: always,
    async run(c, a) {
      const courses = await myCourses(c);
      const ids = courses.map((x) => x.id);
      const found = a.lesson
        ? await c.prisma.courseEpisode.findMany({ where: { courseId: { in: ids }, isVisible: true, title: { contains: String(a.lesson), mode: 'insensitive' } }, take: 20, select: { id: true, title: true, courseId: true } })
        : c.page?.kind === 'lesson' && c.page.lessonId && ids.includes(c.page.courseId)
          ? await c.prisma.courseEpisode.findMany({ where: { id: c.page.lessonId, courseId: c.page.courseId }, select: { id: true, title: true, courseId: true } })
          : [];
      if (!found.length && !a.lesson) throw new ToolError('No lesson is open on their screen. Ask which lesson.');
      const e = pickOne(found, (x) => x.title, String(a.lesson ?? found[0]?.title ?? ''), 'lesson of theirs');
      const p = await c.prisma.courseEpisodeProgress.findFirst({ where: { memberId: c.memberId, episodeId: e.id }, select: { completed: true } });
      if (!p?.completed) throw new ToolError('They can rate a lesson once they have finished it.');
      return prepare(c, { type: 'lesson_rating', courseId: e.courseId, lessonId: e.id, lessonTitle: e.title, rating: Number(a.rating), feedback: a.feedback ? String(a.feedback) : null });
    },
  },
  {
    name: 'prepareMemory',
    description: 'Prepare a short note about the member\'s business or goals for you to remember in later chats (e.g. "Sells handmade soaps on Instagram; goal ₹1 lakh a month"), for them to confirm. Only when they ask you to remember something or agree to it. Never a password, phone number, OTP or bank detail.',
    params: { note: { type: 'string', required: true, maxLength: 200, description: 'One short line, in English.' } },
    allowed: always,
    async run(c, a) {
      if (/\b\d{6,}\b|otp|password|upi pin|cvv/i.test(String(a.note))) throw new ToolError('That note holds a number or secret that must not be stored.');
      return prepare(c, { type: 'memory', note: String(a.note) });
    },
  },
];
