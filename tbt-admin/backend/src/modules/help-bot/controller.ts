/**
 * TBT help bot — member-facing in-app assistant (`/api/help-bot`).
 *
 * POST /chat streams the answer as Server-Sent Events:
 *   data: {"t":"delta","text":"…"}   — append text
 *   data: {"t":"reset"}              — discard what was shown (model fallback restarted the answer)
 *   data: {"t":"done"}               — finished
 *   data: {"t":"error","message":"…"}
 *
 * Accuracy comes from three system blocks: the static guide + rules
 * (knowledge.ts), a live reference (menu, published courses, FAQs — shared
 * by every member, prompt-cached), and the asking member's own facts.
 * Hidden when ANTHROPIC_API_KEY is not set (GET /status → enabled:false).
 */
import type { FastifyReply, FastifyRequest } from 'fastify';
import type Anthropic from '@anthropic-ai/sdk';
import { env } from '../../config/env.js';
import { APP_GUIDE, HELP_BOT_INSTRUCTIONS } from '../../lib/helpBot/knowledge.js';
import {
  buildMemberContext,
  buildReferenceBlock,
  cleanHistory,
  type CatalogCourse,
  type FaqItem,
} from '../../lib/helpBot/helpBotLogic.js';

const MODEL = 'claude-opus-5-5';
const FALLBACK_MODEL = 'claude-opus-5';
const MAX_TOKENS = 1200;
const REFERENCE_TTL_MS = 5 * 60_000;

// Per-member limits: a burst window and a daily cap.
const BURST_LIMIT = 20;
const BURST_WINDOW_S = 10 * 60;
const DAILY_LIMIT = 100;

export function helpBotEnabled(): boolean {
  return !!env.ANTHROPIC_API_KEY;
}

let client: Anthropic | null = null;
async function getClient(): Promise<Anthropic> {
  if (!client) {
    const Sdk = (await import('@anthropic-ai/sdk')).default;
    client = new Sdk({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 2, timeout: 60_000 });
  }
  return client;
}

// ── Rate limit (Redis, in-memory fallback) ───────────────────────────────────

type Counter = { incr(k: string): Promise<number>; expire(k: string, s: number): Promise<number> };
const memCounters = new Map<string, { n: number; exp: number }>();

async function bump(req: FastifyRequest, key: string, windowS: number): Promise<number> {
  const redis = (req.server as unknown as { redis?: Partial<Counter> }).redis;
  if (redis?.incr && redis.expire) {
    try {
      const n = await redis.incr(key);
      if (n === 1) await redis.expire(key, windowS);
      return n;
    } catch { /* fall through to memory */ }
  }
  const now = Date.now();
  const cur = memCounters.get(key);
  if (!cur || cur.exp < now) {
    memCounters.set(key, { n: 1, exp: now + windowS * 1000 });
    if (memCounters.size > 5000) for (const [k, v] of memCounters) if (v.exp < now) memCounters.delete(k);
    return 1;
  }
  cur.n += 1;
  return cur.n;
}

async function overLimit(req: FastifyRequest, memberId: string): Promise<string | null> {
  const day = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10); // IST date
  const [burst, daily] = await Promise.all([
    bump(req, `helpbot:b:${memberId}`, BURST_WINDOW_S),
    bump(req, `helpbot:d:${memberId}:${day}`, 26 * 3600),
  ]);
  if (daily > DAILY_LIMIT) return "You've reached today's question limit. Please try again tomorrow, or raise a ticket in Support.";
  if (burst > BURST_LIMIT) return "You're asking very quickly — please wait a few minutes and try again.";
  return null;
}

// ── Live reference (shared, memoised) ────────────────────────────────────────

const MENU_KEY_PATHS: Record<string, string> = {
  community: '/community', ebooks: '/ebooks', podcasts: '/podcasts', support: '/support',
};

let referenceCache: { text: string; at: number } | null = null;
let referenceInflight: Promise<string> | null = null;

async function loadReference(req: FastifyRequest): Promise<string> {
  const prisma = req.server.prisma;
  const safe = <T>(p: Promise<T[]>): Promise<T[]> => p.catch((err) => {
    req.log.warn({ err }, '[help-bot] reference query failed');
    return [] as T[];
  });

  const [navItems, keyRows, courses, supportFaqs, courseFaqs, moduleFaqs] = await Promise.all([
    safe(prisma.navItem.findMany({ orderBy: { order: 'asc' } })),
    safe(prisma.$queryRawUnsafe<Array<{ hidden_menu_keys: unknown }>>(
      'SELECT hidden_menu_keys FROM site_configs ORDER BY created_at ASC LIMIT 1')),
    safe(prisma.$queryRawUnsafe<Array<{ title: string; course_type: string | null; module: string | null; price: unknown; access_duration_days: number | null }>>(
      `SELECT title, course_type, module, price, access_duration_days FROM courses
        WHERE is_published = true AND deleted_at IS NULL ORDER BY title ASC LIMIT 150`)),
    safe(prisma.$queryRawUnsafe<Array<{ question: string; answer: string; topic: string | null }>>(
      `SELECT f.question, f.answer, c.name AS topic FROM helpdesk_faqs f
         LEFT JOIN helpdesk_categories c ON c.id = f.category_id
        WHERE f.status = 'active' ORDER BY c.sort_order NULLS LAST, f.sort_order, f.question LIMIT 80`)),
    safe(prisma.$queryRawUnsafe<Array<{ question: string; answer: string }>>(
      `SELECT question, answer_text AS answer FROM course_page_faqs
        WHERE is_active = true AND answer_type = 'text' AND answer_text IS NOT NULL
        ORDER BY sort_order, question LIMIT 40`)),
    safe(prisma.$queryRawUnsafe<Array<{ question: string; answer: string }>>(
      `SELECT question, answer FROM module_faqs WHERE is_published = true ORDER BY sort_order, question LIMIT 40`)),
  ]);

  const hiddenKeys = Array.isArray(keyRows[0]?.hidden_menu_keys) ? (keyRows[0].hidden_menu_keys as string[]) : [];
  const hiddenPaths = new Set<string>(navItems.filter((n) => !n.isVisible).map((n) => n.href));
  for (const k of hiddenKeys) if (MENU_KEY_PATHS[k]) hiddenPaths.add(MENU_KEY_PATHS[k]);
  const visibleMenu = navItems
    .filter((n) => n.isVisible && !hiddenPaths.has(n.href))
    .map((n) => ({ label: n.label, href: n.href }));
  for (const [k, path] of Object.entries(MENU_KEY_PATHS)) {
    if (!hiddenKeys.includes(k) && !visibleMenu.some((m) => m.href === path)) {
      visibleMenu.push({ label: k[0].toUpperCase() + k.slice(1), href: path });
    }
  }

  const catalog: CatalogCourse[] = courses.map((c) => ({
    title: c.title,
    courseType: c.course_type,
    module: c.module,
    price: c.price == null ? null : Number(c.price),
    accessDurationDays: c.access_duration_days,
  }));
  const faqs = (rows: Array<{ question: string; answer: string; topic?: string | null }>): FaqItem[] =>
    rows.filter((r) => r.question && r.answer).map((r) => ({ question: r.question, answer: r.answer, topic: r.topic ?? null }));

  return buildReferenceBlock({
    visibleMenu,
    hiddenPaths: [...hiddenPaths].sort(),
    courses: catalog,
    supportFaqs: faqs(supportFaqs),
    courseFaqs: faqs(courseFaqs),
    moduleFaqs: faqs(moduleFaqs),
  });
}

async function getReference(req: FastifyRequest): Promise<string> {
  if (referenceCache && Date.now() - referenceCache.at < REFERENCE_TTL_MS) return referenceCache.text;
  if (!referenceInflight) {
    referenceInflight = loadReference(req)
      .then((text) => { referenceCache = { text, at: Date.now() }; return text; })
      .finally(() => { referenceInflight = null; });
  }
  try {
    return await referenceInflight;
  } catch {
    return referenceCache?.text ?? '# LIVE REFERENCE\n(unavailable right now — rely on the guide)';
  }
}

// ── Member context ───────────────────────────────────────────────────────────

async function loadMemberContext(req: FastifyRequest, memberId: string, page: unknown): Promise<string | null> {
  const prisma = req.server.prisma;
  const [member, enrollments, accesses] = await Promise.all([
    prisma.member.findUnique({
      where: { id: memberId },
      select: { firstName: true, membershipPlan: true, status: true, verificationStatus: true },
    }),
    prisma.courseEnrollment.findMany({
      where: { memberId },
      select: { courseId: true, progressPercentage: true, completedAt: true, course: { select: { title: true } } },
      take: 40,
    }).catch(() => []),
    prisma.courseAccess.findMany({
      where: { memberId, isActive: true },
      select: { courseId: true, accessType: true, expiresAt: true, course: { select: { title: true } } },
      take: 60,
    }).catch(() => []),
  ]);
  if (!member) return null;

  const byCourse = new Map<string, { title: string; progressPercentage: number; completed: boolean; accessType: string | null; expiresAt: Date | null }>();
  for (const e of enrollments) {
    byCourse.set(e.courseId, {
      title: e.course?.title ?? 'Course',
      progressPercentage: e.progressPercentage ?? 0,
      completed: !!e.completedAt,
      accessType: null,
      expiresAt: null,
    });
  }
  for (const a of accesses) {
    const cur = byCourse.get(a.courseId) ?? {
      title: a.course?.title ?? 'Course', progressPercentage: 0, completed: false, accessType: null, expiresAt: null,
    };
    cur.accessType = String(a.accessType);
    cur.expiresAt = a.expiresAt;
    byCourse.set(a.courseId, cur);
  }

  return buildMemberContext({
    firstName: member.firstName ?? '',
    membershipPlan: String(member.membershipPlan ?? 'free'),
    status: String(member.status),
    verificationStatus: member.verificationStatus ? String(member.verificationStatus) : null,
    courses: [...byCourse.values()].sort((a, b) => a.title.localeCompare(b.title)),
    currentPath: typeof page === 'string' ? page : null,
    now: new Date(),
  });
}

// ── Handlers ─────────────────────────────────────────────────────────────────

export async function helpBotStatusHandler(_req: FastifyRequest, reply: FastifyReply) {
  return reply.send({ success: true, data: { enabled: helpBotEnabled() }, error: null });
}

export async function helpBotChatHandler(
  req: FastifyRequest<{ Body: { messages?: unknown; page?: unknown } }>,
  reply: FastifyReply,
) {
  if (!helpBotEnabled()) {
    return reply.code(503).send({ success: false, data: null, error: 'The assistant is not available right now.' });
  }
  const memberId = req.memberId!;
  const cleaned = cleanHistory(req.body?.messages);
  if (!cleaned.ok) return reply.code(400).send({ success: false, data: null, error: cleaned.error });

  const limited = await overLimit(req, memberId);
  if (limited) return reply.code(429).send({ success: false, data: null, error: limited });

  const [reference, memberCtx, anthropic] = await Promise.all([
    getReference(req),
    loadMemberContext(req, memberId, req.body?.page),
    getClient(),
  ]);
  if (!memberCtx) return reply.code(404).send({ success: false, data: null, error: 'Member not found.' });

  // Stream SSE from here on. Keep CORS headers that hooks already set.
  reply.hijack();
  reply.raw.writeHead(200, {
    ...(reply.getHeaders() as Record<string, string>),
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  const send = (ev: Record<string, unknown>) => {
    if (!reply.raw.writableEnded) reply.raw.write(`data: ${JSON.stringify(ev)}\n\n`);
  };

  const abort = new AbortController();
  reply.raw.on('close', () => abort.abort());

  try {
    const stream = anthropic.beta.messages.stream(
      {
        model: MODEL,
        max_tokens: MAX_TOKENS,
        betas: ['server-side-fallback-2026-06-01'],
        fallbacks: [{ model: FALLBACK_MODEL }],
        output_config: { effort: 'low' },
        system: [
          { type: 'text', text: `${HELP_BOT_INSTRUCTIONS}\n\n${APP_GUIDE}` },
          { type: 'text', text: reference, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: memberCtx },
        ],
        messages: cleaned.messages,
        metadata: { user_id: memberId },
      },
      { signal: abort.signal },
    );

    for await (const event of stream) {
      if (event.type === 'content_block_start' && (event.content_block as { type: string }).type === 'fallback') {
        send({ t: 'reset' });
      } else if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        send({ t: 'delta', text: event.delta.text });
      }
    }
    const final = await stream.finalMessage();
    if (final.stop_reason === 'refusal') {
      send({ t: 'reset' });
      send({ t: 'delta', text: "Sorry, I can't help with that. I can answer questions about using the TBT app — or raise a ticket in [Support](/support/new)." });
    } else if (final.stop_reason === 'max_tokens') {
      send({ t: 'delta', text: '…' });
    }
    send({ t: 'done' });
  } catch (err) {
    if (!abort.signal.aborted) {
      req.log.error({ err }, '[help-bot] chat failed');
      send({ t: 'error', message: 'Sorry, I could not answer just now. Please try again in a moment.' });
    }
  } finally {
    if (!reply.raw.writableEnded) reply.raw.end();
  }
}
