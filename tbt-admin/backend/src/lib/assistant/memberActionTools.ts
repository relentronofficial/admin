/**
 * More member tools: lessons, payments, community, library, and things to
 * prepare (tickets, call bookings, habits) which the member confirms in the app.
 * As in memberTools.ts, the member always comes from the session.
 */
import { MAX_ACTIONS, type HelpBotAction } from '../helpBot/actions.js';
import { computeLessonLockStates } from '../lessonProgression.js';
import { SESSION_COLUMNS, loadCategoryQuota, mapSession } from '../supportCallData.js';
import { SUPPORT_CALL_CATEGORIES, canBook, canCancelBooking, type SupportCallCategory } from '../supportCallLogic.js';
import type { MemberToolCtx } from './memberTools.js';
import { ToolError, ist, listed, type AssistantTool } from './registry.js';

const always = () => true;
const text = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const istDate = (d: Date) => new Date(d.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);
const PREPARED = 'Ready. The app now shows a card with a Confirm button. It is NOT done yet: tell the member to check the card and press Confirm.';

function prepare(c: MemberToolCtx, a: HelpBotAction) {
  if (!c.actions) throw new ToolError('This cannot be prepared here.');
  if (c.actions.length >= MAX_ACTIONS) throw new ToolError('Too many things at once. Ask the member to confirm these first.');
  c.actions.push(a);
  return { status: PREPARED };
}

/** The one item whose name matches; exact first, then containing it. */
export function pickOne<T>(items: T[], name: (t: T) => string, wanted: string, what: string): T {
  const w = wanted.toLowerCase();
  const exact = items.filter((i) => name(i).toLowerCase() === w);
  const found = exact.length ? exact : items.filter((i) => name(i).toLowerCase().includes(w));
  if (found.length === 1) return found[0];
  if (!found.length) throw new ToolError(`No ${what} called "${wanted}". There are: ${items.map(name).slice(0, 20).join('; ') || 'none'}.`);
  throw new ToolError(`More than one ${what} matches: ${found.map(name).slice(0, 10).join('; ')}. Ask which one.`);
}

export function bookLocked(batchIds: unknown, memberBatchId: string | null): boolean {
  if (!Array.isArray(batchIds)) return false;
  return !memberBatchId || !batchIds.includes(memberBatchId);
}

const word = { type: 'string' as const, required: true, maxLength: 60 };
const category = { type: 'string' as const, required: true, enum: SUPPORT_CALL_CATEGORIES, description: 'sales_support = Sales, tech_support = Tech, content_support = Content, ad_support = Marketing, one_to_one = Mentor 1-on-1, group_call = Group Q&A.' };

async function myCourses(c: MemberToolCtx) {
  const [access, enrolled] = await Promise.all([
    c.prisma.courseAccess.findMany({
      where: { memberId: c.memberId, isActive: true, OR: [{ accessType: 'lifetime' }, { expiresAt: { gt: c.now } }] },
      select: { course: { select: { id: true, title: true } } }, take: 100,
    }),
    c.prisma.courseEnrollment.findMany({ where: { memberId: c.memberId }, select: { course: { select: { id: true, title: true } } }, take: 100 }),
  ]);
  return [...new Map([...access, ...enrolled].map((x) => [x.course.id, x.course])).values()];
}

export const memberActionTools: AssistantTool<MemberToolCtx>[] = [
  {
    name: 'getMyLessons',
    description: 'The lessons of one of the signed-in member\'s courses in order: completed, locked, percent watched, which lesson is holding a locked one back, the next lesson to watch and its link. Use for "where did I stop" and "why is this lesson locked". A focus timer or the weekly report can also lock videos; that is not shown here.',
    params: { course: { ...word, maxLength: 150, description: 'Course name or part of it.' } },
    allowed: always,
    async run(c, a) {
      const course = pickOne(await myCourses(c), (x) => x.title, String(a.course), 'course of theirs');
      const [cfg, episodes] = await Promise.all([
        c.prisma.course.findUnique({ where: { id: course.id }, select: { requireSequential: true, completionThresholdPercent: true } as any }) as Promise<any>,
        c.prisma.courseEpisode.findMany({
          where: { courseId: course.id, isVisible: true }, orderBy: { order: 'asc' }, take: 300,
          select: { id: true, title: true, order: true, durationSeconds: true, progress: { where: { memberId: c.memberId }, select: { completed: true, lastWatchedSecs: true, actualWatchedSecs: true } } },
        }),
      ]);
      const states = new Map(computeLessonLockStates(
        episodes.map((e) => ({ id: e.id, order: e.order ?? 0, durationSeconds: e.durationSeconds ?? null })),
        episodes.flatMap((e) => (e.progress[0] ? [{ episodeId: e.id, actualWatchedSecs: e.progress[0].actualWatchedSecs, lastWatchedSecs: e.progress[0].lastWatchedSecs, isCompleted: e.progress[0].completed }] : [])),
        { requireSequential: cfg?.requireSequential ?? true, completionThresholdPercent: cfg?.completionThresholdPercent ?? 95 },
      ).map((s) => [s.episodeId, s]));
      const title = new Map(episodes.map((e) => [e.id, e.title]));
      const next = episodes.find((e) => !states.get(e.id)!.completed);
      // The lessons around where they are, so a long course still fits.
      const at = next ? episodes.indexOf(next) : 0;
      const shown = episodes.slice(Math.max(0, at - 10), Math.max(0, at - 10) + 40);
      return {
        course: course.title, totalLessons: episodes.length, completedLessons: episodes.filter((e) => states.get(e.id)!.completed).length,
        mustWatchInOrder: cfg?.requireSequential ?? true, watchNeededPercent: cfg?.completionThresholdPercent ?? 95,
        nextLesson: next ? { title: next.title, link: `/learning/${course.id}?lesson=${next.id}` } : null,
        showing: shown.length,
        lessons: shown.map((e) => {
          const s = states.get(e.id)!;
          return { title: e.title, completed: s.completed, locked: s.locked, watchedPercent: s.watchPercent, heldBackBy: s.blockedByEpisodeId ? title.get(s.blockedByEpisodeId) ?? null : null };
        }),
      };
    },
  },
  {
    name: 'getMyPayments',
    description: 'The signed-in member\'s own course payments and extra-call purchases: what, amount, status and date. The bot cannot refund or approve a payment.',
    params: {},
    allowed: always,
    async run(c) {
      const [total, rows, credits] = await Promise.all([
        c.prisma.coursePayment.count({ where: { memberId: c.memberId } }),
        c.prisma.coursePayment.findMany({ where: { memberId: c.memberId }, orderBy: { createdAt: 'desc' }, take: 20, select: { amount: true, currency: true, method: true, status: true, paidAt: true, createdAt: true, course: { select: { title: true } } } }),
        c.prisma.$queryRawUnsafe<any[]>(`SELECT credit_type, quantity, status, created_at FROM credit_purchases WHERE member_id = $1::uuid ORDER BY created_at DESC LIMIT 10`, c.memberId),
      ]);
      return {
        coursePayments: listed(rows.map((p) => ({ course: p.course.title, amount: Number(p.amount), currency: p.currency, method: p.method, status: p.status, created: ist(p.createdAt), paid: ist(p.paidAt) })), total),
        extraCreditRequests: credits.map((r) => ({ type: r.credit_type, quantity: Number(r.quantity), status: r.status, created: ist(r.created_at) })),
      };
    },
  },
  {
    name: 'getMyTicket',
    description: 'One of the signed-in member\'s own support tickets with the latest replies and its link.',
    params: { number: { type: 'integer', required: true, min: 1, max: 10_000_000, description: 'Ticket number.' } },
    allowed: always,
    async run(c, a) {
      const t = await c.prisma.helpdeskTicket.findFirst({
        where: { memberId: c.memberId, displayNumber: Number(a.number) }, orderBy: { createdAt: 'desc' },
        select: {
          id: true, displayNumber: true, subject: true, message: true, status: true, createdAt: true, resolvedAt: true,
          replies: { where: { isInternal: false }, orderBy: { createdAt: 'desc' }, take: 6, select: { body: true, isFromAdmin: true, createdAt: true } },
        },
      });
      if (!t) throw new ToolError('That is not one of your tickets.');
      return {
        ticket: t.displayNumber, subject: t.subject, message: text(t.message, 600), status: t.status, created: ist(t.createdAt), resolved: ist(t.resolvedAt), link: `/support/tickets/${t.id}`,
        latestReplies: t.replies.map((r) => ({ from: r.isFromAdmin ? 'TBT team' : 'you', at: ist(r.createdAt), text: text(r.body, 500) })),
      };
    },
  },
  {
    name: 'searchCommunity',
    description: 'Search approved community feed posts by one keyword (English works best), newest first. Returns short extracts. Private messages and group chats cannot be searched.',
    params: { query: { ...word, description: 'One key word, e.g. "instagram".' } },
    allowed: always,
    async run(c, a) {
      const where = { status: 'active', isApproved: true, content: { contains: String(a.query), mode: 'insensitive' as const } };
      const [total, rows] = await Promise.all([
        c.prisma.post.count({ where }),
        c.prisma.post.findMany({ where, orderBy: { createdAt: 'desc' }, take: 8, select: { content: true, isMentor: true, isAnnouncement: true, likesCount: true, commentsCount: true, createdAt: true, member: { select: { firstName: true } } } }),
      ]);
      return { link: '/community', ...listed(rows.map((p) => ({ by: p.member?.firstName ?? null, mentor: p.isMentor, announcement: p.isAnnouncement, text: text(p.content, 300), likes: p.likesCount, comments: p.commentsCount, posted: ist(p.createdAt) })), total) };
    },
  },
  {
    name: 'searchLibrary',
    description: 'Search ebooks, podcast episodes and the lessons of the member\'s own courses by one keyword in the title or description. Use to find where a topic is taught. Lesson videos themselves cannot be searched.',
    params: { query: { ...word, description: 'One key word, e.g. "funnel".' } },
    allowed: always,
    async run(c, a) {
      const contains = { contains: String(a.query), mode: 'insensitive' as const };
      const match = { OR: [{ title: contains }, { description: contains }] };
      const [m, courses] = await Promise.all([
        c.prisma.member.findUnique({ where: { id: c.memberId }, select: { batchId: true } }),
        myCourses(c),
      ]);
      const [books, podcasts, lessons] = await Promise.all([
        c.prisma.ebook.findMany({ where: { ...match, status: 'active', publishDate: { lte: c.now } }, take: 30, select: { id: true, title: true, author: true, batchIds: true } }),
        c.prisma.podcastEpisode.findMany({ where: { ...match, status: 'active' }, take: 8, select: { id: true, title: true, speaker: true } }),
        c.prisma.courseEpisode.findMany({ where: { ...match, isVisible: true, courseId: { in: courses.map((x) => x.id) } }, take: 10, select: { id: true, title: true, courseId: true, course: { select: { title: true } } } }),
      ]);
      return {
        ebooks: books.filter((b) => !bookLocked(b.batchIds, m?.batchId ?? null)).slice(0, 8).map((b) => ({ title: b.title, author: b.author, link: `/ebooks/book/${b.id}` })),
        podcasts: podcasts.map((p) => ({ title: p.title, speaker: p.speaker, link: `/podcasts/episode/${p.id}` })),
        lessons: lessons.map((l) => ({ title: l.title, course: l.course.title, link: `/learning/${l.courseId}?lesson=${l.id}` })),
      };
    },
  },
  {
    name: 'getUpcomingEvents',
    description: 'Coming TBT events with date, place and whether they are online.',
    params: {},
    allowed: always,
    async run(c) {
      const where = { eventDate: { gte: c.now }, status: { not: 'cancelled' } };
      const [total, rows] = await Promise.all([
        c.prisma.event.count({ where }),
        c.prisma.event.findMany({ where, orderBy: { eventDate: 'asc' }, take: 10, select: { title: true, eventType: true, eventDate: true, location: true, isOnline: true, description: true } }),
      ]);
      return { link: '/events', ...listed(rows.map((e) => ({ title: e.title, type: e.eventType, when: ist(e.eventDate), location: e.location, online: e.isOnline, about: text(e.description, 200) })), total) };
    },
  },
  {
    name: 'getCallSlots',
    description: 'Open expert-call slots of one kind the member could book, and how many calls they have left.',
    params: { category },
    allowed: always,
    async run(c, a) {
      const cat = String(a.category) as SupportCallCategory;
      const m = await c.prisma.member.findUnique({ where: { id: c.memberId }, select: { membershipPlan: true } });
      const [quota, rows] = await Promise.all([loadCategoryQuota(c.prisma, c.memberId, String(m?.membershipPlan ?? 'free'), cat), openSlots(c, cat)]);
      return { category: cat, callsLeft: quota.remaining, includedInPlan: quota.included > 0, bookingPage: '/mentorship', ...listed(rows.slice(0, 20).map(slotView), rows.length) };
    },
  },
  {
    name: 'prepareCallBooking',
    description: 'Prepare booking one expert call for the member to confirm. Get the slot from getCallSlots first. Only books with calls left in the plan; coins are only spent on the Mentorship page.',
    params: { category, start: { type: 'string', required: true, maxLength: 30, pattern: /^\d{4}-\d{2}-\d{2} \d{2}:\d{2} IST$/, description: 'The slot\'s start exactly as getCallSlots returned it.' } },
    allowed: always,
    async run(c, a) {
      const cat = String(a.category) as SupportCallCategory;
      const m = await c.prisma.member.findUnique({ where: { id: c.memberId }, select: { membershipPlan: true, status: true } });
      const matching = (await openSlots(c, cat)).filter((r) => ist(r.session.startsAt) === a.start);
      if (!matching.length) throw new ToolError('There is no open slot at that time. Look up the slots again.');
      if (matching.length > 1) throw new ToolError('Two slots start at that time. Ask the member to choose on the Mentorship page (/mentorship).');
      const { session: s, active } = matching[0];
      const quota = await loadCategoryQuota(c.prisma, c.memberId, String(m?.membershipPlan ?? 'free'), cat);
      const ok = canBook({ session: s, now: c.now, activeBookingCount: active, alreadyBooked: false, memberStatus: m?.status, quota });
      if (!ok.ok) throw new ToolError(ok.message);
      return prepare(c, { type: 'book_call', sessionId: s.id, title: s.title, category: cat, startsAt: s.startsAt.toISOString(), minutes: s.durationMinutes, host: s.hostName });
    },
  },
  {
    name: 'prepareCallCancel',
    description: 'Prepare cancelling one of the member\'s booked calls for them to confirm. Use getMyUpcomingCalls for the start time.',
    params: { start: { type: 'string', required: true, maxLength: 30, pattern: /^\d{4}-\d{2}-\d{2} \d{2}:\d{2} IST$/, description: 'The call\'s start exactly as getMyUpcomingCalls returned it.' } },
    allowed: always,
    async run(c, a) {
      const rows = await c.prisma.$queryRawUnsafe<any[]>(
        `SELECT b.id AS booking_id, ${SESSION_COLUMNS} FROM support_call_bookings b JOIN support_call_sessions s ON s.id = b.session_id
          WHERE b.member_id = $1::uuid AND b.status = 'booked' AND s.status = 'scheduled' AND s.starts_at > $2::timestamptz`, c.memberId, c.now);
      const mine = rows.map((r) => ({ bookingId: String(r.booking_id), session: mapSession(r) })).filter((r) => ist(r.session.startsAt) === a.start);
      if (mine.length !== 1) throw new ToolError(mine.length ? 'Two calls start then. Ask the member to cancel on the Mentorship page (/mentorship).' : 'The member has no booked call at that time.');
      const ok = canCancelBooking({ bookingStatus: 'booked', session: mine[0].session, now: c.now });
      if (!ok.ok) throw new ToolError(ok.message);
      return prepare(c, { type: 'cancel_call', bookingId: mine[0].bookingId, title: mine[0].session.title, startsAt: mine[0].session.startsAt.toISOString() });
    },
  },
  {
    name: 'prepareTicket',
    description: 'Prepare a support ticket for the member to confirm: for payment or access problems, refunds, bugs, account approval, anything the app or you cannot solve, or when they ask for a person. Ask for missing details (which course, what happened, when) first unless they clearly want it sent now. Check getMyTickets first so the same problem is not raised twice.',
    params: {
      subject: { type: 'string', required: true, maxLength: 120, description: 'Short subject in English.' },
      message: { type: 'string', required: true, maxLength: 1500, description: 'What happened, from the member\'s side, only with what they said or a lookup showed. Never a password, OTP or card/bank number.' },
      priority: { type: 'string', enum: ['low', 'medium', 'high'], description: 'high only when money was taken or they cannot use what they paid for. Default medium.' },
      category: { type: 'string', maxLength: 100, description: 'Support topic name, if one clearly fits.' },
    },
    allowed: always,
    async run(c, a) {
      const cats = await c.prisma.helpdeskCategory.findMany({ where: { status: 'active' }, select: { id: true, name: true }, take: 50 });
      const cat = a.category ? pickOne(cats, (x) => x.name, String(a.category), 'support topic') : null;
      return prepare(c, {
        type: 'ticket', subject: String(a.subject), message: String(a.message), categoryId: cat?.id ?? null, categoryName: cat?.name ?? null,
        priority: (a.priority as 'low' | 'medium' | 'high' | undefined) ?? 'medium',
      });
    },
  },
  {
    name: 'getMyHabits',
    description: 'Today\'s Morning Ritual habits and what the member has answered for each.',
    params: {},
    allowed: always,
    async run(c) {
      const rows = await habitsToday(c);
      return { date: istDate(c.now), ...listed(rows.map((h) => ({ habit: h.question, done: h.done })), rows.length), note: 'done null = not answered yet today' };
    },
  },
  {
    name: 'prepareHabit',
    description: 'Prepare marking one of today\'s Morning Ritual habits done or not done, for the member to confirm. Only today can be marked.',
    params: {
      habit: { type: 'string', required: true, maxLength: 200, description: 'The habit text or part of it, from getMyHabits.' },
      done: { type: 'string', required: true, enum: ['yes', 'no'], description: 'Whether they did it.' },
    },
    allowed: always,
    async run(c, a) {
      const h = pickOne(await habitsToday(c), (x) => x.question, String(a.habit), 'habit');
      return prepare(c, { type: 'habit', habitId: h.id, question: h.question, done: a.done === 'yes' });
    },
  },
];

async function habitsToday(c: MemberToolCtx) {
  return c.prisma.$queryRawUnsafe<Array<{ id: string; question: string; done: boolean | null }>>(
    `SELECT h.id::text, h.raw_question AS question, a.done FROM habits h
       LEFT JOIN member_habit_answers a ON a.habit_id = h.id AND a.member_id = $1::uuid AND a.answer_date = $2::date
      WHERE h.status = 'active' ORDER BY h.sort_order`, c.memberId, istDate(c.now));
}

async function openSlots(c: MemberToolCtx, cat: SupportCallCategory) {
  const rows = await c.prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM (
       SELECT ${SESSION_COLUMNS},
              (SELECT COUNT(*)::int FROM support_call_bookings x WHERE x.session_id = s.id AND x.status <> 'cancelled') AS active_count,
              EXISTS (SELECT 1 FROM support_call_bookings y WHERE y.session_id = s.id AND y.member_id = $1::uuid AND y.status <> 'cancelled') AS mine
         FROM support_call_sessions s WHERE s.category = $2 AND s.status = 'scheduled' AND s.starts_at > $3::timestamptz
     ) q WHERE NOT q.mine AND q.active_count < q.capacity ORDER BY q.starts_at LIMIT 100`, c.memberId, cat, c.now);
  return rows.map((r) => ({ session: mapSession(r), active: Number(r.active_count) }));
}

const slotView = ({ session: s, active }: Awaited<ReturnType<typeof openSlots>>[number]) =>
  ({ start: ist(s.startsAt), minutes: s.durationMinutes, title: s.title, host: s.hostName, seatsLeft: s.capacity - active });
