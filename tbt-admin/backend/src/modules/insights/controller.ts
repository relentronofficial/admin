/**
 * Admin Insights (`/api/insights`, Clerk) — read-only analytics across
 * revenue, growth, funnels, retention, courses, mentorship, support, usage and
 * churn risk. Queries: lib/insights/insightsQueries.ts; maths:
 * lib/insights/insightsLogic.ts. Every list endpoint takes ?range=7d|30d|90d
 * or ?range=custom&from=YYYY-MM-DD&to=YYYY-MM-DD (IST, ≤ 366 days).
 */
import type { FastifyReply, FastifyRequest } from 'fastify';
import { resolveRange, type DateRange } from '../../lib/insights/insightsLogic.js';
import {
  loadCohorts,
  loadCourseLessons,
  loadCourses,
  loadFunnelStuck,
  loadFunnels,
  loadMentorship,
  loadOverview,
  loadRevenue,
  loadRiskMembers,
  loadSupport,
  loadUsage,
  FUNNEL_STUCK_STEPS,
} from '../../lib/insights/insightsQueries.js';
import { computeDigest, sendWeeklyDigest } from '../../jobs/insightsDigest.js';
import { istWeekStart } from '../../lib/weeklyReportGate.js';
import { buildDigestText, digestAlerts } from '../../lib/insights/insightsLogic.js';

type Q = Record<string, unknown>;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function bad(reply: FastifyReply, message: string) {
  return reply.status(400).send({ success: false, data: null, error: { code: 'BAD_REQUEST', message } });
}

/** Runs `fn` with the parsed range; 400 on a bad range, 500 on a query error. */
async function withRange(req: FastifyRequest, reply: FastifyReply, fn: (range: DateRange) => Promise<unknown>) {
  const r = resolveRange(req.query as Q, new Date());
  if (!r.ok) return bad(reply, r.error);
  try {
    const data = await fn(r.range);
    return reply.send({ success: true, data, error: null });
  } catch (err) {
    req.log.error({ err }, '[insights] query failed');
    return reply.status(500).send({ success: false, data: null, error: { code: 'INSIGHTS_FAILED', message: 'Could not load these analytics.' } });
  }
}

export const overviewHandler = (req: FastifyRequest, reply: FastifyReply) =>
  withRange(req, reply, (range) => loadOverview(req.server.prisma as any, range, new Date()));

export const funnelsHandler = (req: FastifyRequest, reply: FastifyReply) =>
  withRange(req, reply, (range) => loadFunnels(req.server.prisma as any, range));

export async function funnelStuckHandler(req: FastifyRequest, reply: FastifyReply) {
  const q = req.query as Q;
  const kind = q.funnel === 'purchase' ? 'purchase' : q.funnel === 'onboarding' ? 'onboarding' : null;
  if (!kind || typeof q.step !== 'string' || !FUNNEL_STUCK_STEPS[kind].includes(q.step)) {
    return bad(reply, 'A valid funnel and step are required.');
  }
  return withRange(req, reply, async (range) => (await loadFunnelStuck(req.server.prisma as any, range, kind, q.step as string)) ?? []);
}

export async function cohortsHandler(req: FastifyRequest, reply: FastifyReply) {
  const months = Math.max(2, Math.min(12, Math.floor(Number((req.query as Q).months) || 6)));
  try {
    const data = await loadCohorts(req.server.prisma as any, months, new Date());
    return reply.send({ success: true, data, error: null });
  } catch (err) {
    req.log.error({ err }, '[insights] cohorts failed');
    return reply.status(500).send({ success: false, data: null, error: { code: 'INSIGHTS_FAILED', message: 'Could not load cohorts.' } });
  }
}

export const coursesHandler = (req: FastifyRequest, reply: FastifyReply) =>
  withRange(req, reply, (range) => loadCourses(req.server.prisma as any, range));

export async function courseLessonsHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  if (!UUID_RE.test(id)) return bad(reply, 'Invalid course id.');
  const data = await loadCourseLessons(req.server.prisma as any, id);
  if (!data) return reply.status(404).send({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'Course not found' } });
  return reply.send({ success: true, data, error: null });
}

export const mentorshipHandler = (req: FastifyRequest, reply: FastifyReply) =>
  withRange(req, reply, (range) => loadMentorship(req.server.prisma as any, range));

export const supportHandler = (req: FastifyRequest, reply: FastifyReply) =>
  withRange(req, reply, (range) => loadSupport(req.server.prisma as any, range));

export const revenueHandler = (req: FastifyRequest, reply: FastifyReply) =>
  withRange(req, reply, (range) => loadRevenue(req.server.prisma as any, range));

export const usageHandler = (req: FastifyRequest, reply: FastifyReply) =>
  withRange(req, reply, (range) => loadUsage(req.server.prisma as any, range));

export async function riskHandler(req: FastifyRequest, reply: FastifyReply) {
  const q = req.query as Q;
  const level = q.level === 'high' || q.level === 'medium' || q.level === 'low' ? q.level : 'atRisk';
  const search = typeof q.search === 'string' ? q.search.trim().toLowerCase().slice(0, 100) : '';
  const limit = Math.max(1, Math.min(500, Math.floor(Number(q.limit) || 50)));
  const page = Math.max(1, Math.floor(Number(q.page) || 1));
  const all = await loadRiskMembers(req.server.prisma as any, new Date(), { fresh: q.fresh === '1' });
  const counts = { high: 0, medium: 0, low: 0 };
  for (const m of all) counts[m.level]++;
  const filtered = all.filter((m) =>
    (level === 'atRisk' ? m.level !== 'low' : m.level === level)
    && (!search || m.name.toLowerCase().includes(search) || (m.phone ?? '').includes(search) || (m.email ?? '').toLowerCase().includes(search)));
  return reply.send({
    success: true,
    data: filtered.slice((page - 1) * limit, page * limit),
    meta: { total: filtered.length, page, limit, counts },
    error: null,
  });
}

export async function digestPreviewHandler(req: FastifyRequest, reply: FastifyReply) {
  const now = new Date();
  const weekStart = new Date(istWeekStart(now).getTime() - 7 * 86_400_000);
  const digest = await computeDigest(req.server.prisma, weekStart, now);
  return reply.send({ success: true, data: { digest, alerts: digestAlerts(digest), text: buildDigestText(digest) }, error: null });
}

export async function digestSendHandler(req: FastifyRequest, reply: FastifyReply) {
  const r = await sendWeeklyDigest(req.server, new Date(), { force: true });
  return reply.send({ success: true, data: r, error: null });
}
