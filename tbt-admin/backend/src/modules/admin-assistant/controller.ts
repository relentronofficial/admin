/**
 * Admin Assistant — `/api/admin-assistant` (Clerk). Answers questions about
 * TBT's data with the read-only tools in lib/assistant.
 *
 * POST /chat { message, conversationId? } streams Server-Sent Events:
 *   {"t":"tool","name":"getBatchSummary"}   — a lookup started
 *   {"t":"answer","text","messageId","conversationId","title","tools"} — finished
 *   {"t":"error","message"}
 *
 * POST /transcribe { audio } turns a voice note (base64 16 kHz mono WAV) into
 * { text }; the client then asks it through /chat with voice: true. The audio
 * is not stored.
 *
 * POST /messages/:id/speech reads one of the admin's own saved answers aloud: it
 * streams 16-bit mono 24 kHz PCM, or answers with a JSON error. Not stored.
 *
 * The conversation is kept on the server and belongs to one admin; the client
 * never supplies earlier turns. Off when OPENROUTER_API_KEY is not set.
 */
import type { FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../../config/env.js';
import { adminTools, type AdminToolCtx } from '../../lib/assistant/adminTools.js';
import { calculateTool } from '../../lib/assistant/calculate.js';
import { HISTORY_TURNS, QUESTION_MAX, adminSystemPrompt, conversationTitle, runChatLoop } from '../../lib/assistant/chatLoop.js';
import { evalCases, gradeAnswer } from '../../lib/assistant/evalCases.js';
import { AssistantServiceError, HARD_MODEL, openRouterComplete, usableKey } from '../../lib/assistant/openRouter.js';
import { compileQuery, queryDataTool, runCompiled, selfTest } from '../../lib/assistant/queryData.js';
import { runTool, toolDefinitions } from '../../lib/assistant/registry.js';
import { SPEECH_SAMPLE_RATE, speechStream, spokenScript } from '../../lib/assistant/speak.js';
import { transcribeVoiceNote, validVoiceNote } from '../../lib/assistant/transcribe.js';

const BURST_LIMIT = 15; // questions per 10 minutes, per admin
const DAILY_LIMIT = 150; // per admin per IST day
const TEAM_DAILY_LIMIT = 600; // everyone together, so a runaway client cannot drain the credit
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const tools = [...adminTools, queryDataTool, calculateTool];

const apiKey = () => usableKey(env.OPENROUTER_API_KEY);

function fail(reply: FastifyReply, status: number, message: string) {
  return reply.code(status).send({ success: false, data: null, error: message });
}

async function actingAdmin(req: FastifyRequest, reply: FastifyReply) {
  const a = await req.server.prisma.admin.findUnique({
    where: { clerkId: req.user as string },
    select: { id: true, fullName: true, role: true, status: true, deletedAt: true },
  });
  if (!a || a.deletedAt || a.status !== 'active') {
    fail(reply, 403, 'Admin account not found or not active.');
    return null;
  }
  return a;
}

async function overLimit(req: FastifyRequest, adminId: string): Promise<string | null> {
  const [r] = await req.server.prisma.$queryRawUnsafe<Array<{ burst: number; mine: number; team: number }>>(
    `SELECT COUNT(*) FILTER (WHERE c.admin_id = $1::uuid AND m.created_at > NOW() - INTERVAL '10 minutes')::int AS burst,
            COUNT(*) FILTER (WHERE c.admin_id = $1::uuid)::int AS mine,
            COUNT(*)::int AS team
       FROM admin_assistant_messages m JOIN admin_assistant_conversations c ON c.id = m.conversation_id
      WHERE m.role = 'user' AND m.created_at >= (date_trunc('day', NOW() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata')`,
    adminId,
  );
  if (r.burst >= BURST_LIMIT) return 'You are asking very quickly. Please wait a few minutes.';
  if (r.mine >= DAILY_LIMIT) return "You have reached today's question limit. It resets at midnight IST.";
  if (r.team >= TEAM_DAILY_LIMIT) return "The team has reached today's question limit. It resets at midnight IST.";
  return null;
}

export async function statusHandler(req: FastifyRequest, reply: FastifyReply) {
  const admin = await actingAdmin(req, reply);
  if (!admin) return reply;
  const ctx: AdminToolCtx = { prisma: req.server.prisma as any, now: new Date(), admin };
  return reply.send({ success: true, data: { enabled: !!apiKey(), keyInvalid: !!env.OPENROUTER_API_KEY && !apiKey(), tools: toolDefinitions(tools, ctx).map((t) => t.function.name), canTest: admin.role === 'super_admin' }, error: null });
}

/** Super admin: checks that every queryData dataset still matches the database. Returns names only. */
export async function selfTestHandler(req: FastifyRequest, reply: FastifyReply) {
  const admin = await superAdmin(req, reply);
  if (!admin) return reply;
  const data = await selfTest({ prisma: req.server.prisma as any, now: new Date(), admin },
    (dataset, err) => req.log.error({ err, dataset }, '[admin-assistant] selftest failed'));
  return reply.send({ success: true, data, error: null });
}

const istToday = (now: Date) => new Date(now.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);

async function superAdmin(req: FastifyRequest, reply: FastifyReply) {
  const admin = await actingAdmin(req, reply);
  if (admin && admin.role !== 'super_admin') {
    fail(reply, 403, 'Super admins only.');
    return null;
  }
  return admin;
}

export async function evalListHandler(req: FastifyRequest, reply: FastifyReply) {
  if (!(await superAdmin(req, reply))) return reply;
  return reply.send({ success: true, data: evalCases(istToday(new Date())).map((c) => ({ id: c.id, question: c.question })), error: null });
}

const EVALS_PER_HOUR = 150; // on this instance: each one is a paid question
let evalTimes: number[] = [];

/** Asks one test question exactly as an admin would and grades it. Nothing is saved. */
export async function evalRunHandler(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const key = apiKey();
  if (!key) return fail(reply, 503, 'The assistant is not set up yet.');
  const admin = await superAdmin(req, reply);
  if (!admin) return reply;
  const now = new Date();
  const test = evalCases(istToday(now)).find((c) => c.id === req.params.id);
  if (!test) return fail(reply, 404, 'Test question not found.');
  evalTimes = evalTimes.filter((t) => now.getTime() - t < 3600_000);
  if (evalTimes.length >= EVALS_PER_HOUR) return fail(reply, 429, 'Too many tests this hour. Please try again later.');
  evalTimes.push(now.getTime());

  const abort = new AbortController();
  reply.raw.on('close', () => abort.abort());
  const ctx: AdminToolCtx = { prisma: req.server.prisma as any, now, admin };
  const log = (info: unknown) => req.log.error(info as object, '[admin-assistant] OpenRouter call failed');
  try {
    const r = await runChatLoop({
      complete: openRouterComplete(key, log),
      completeHard: openRouterComplete(key, log, HARD_MODEL),
      system: adminSystemPrompt({ adminName: admin.fullName, role: admin.role, today: istToday(now) }),
      history: [],
      question: test.question,
      tools: toolDefinitions(tools, ctx),
      runTool: (name, args) => runTool(tools, ctx, name, args, { onError: (err) => req.log.error({ err, tool: name }, '[admin-assistant] tool failed') }),
      signal: abort.signal,
    });
    const ref = test.query ? await runCompiled(ctx, compileQuery(test.query)) : { rows: [] };
    return reply.send({
      success: true, error: null,
      data: { ...gradeAnswer(test, ref.rows, r.text), answer: r.text, tools: r.toolsUsed, costUsd: r.costUsd, hard: !!r.hard, ms: Date.now() - now.getTime() },
    });
  } catch (err) {
    if (abort.signal.aborted) return reply;
    if (!(err instanceof AssistantServiceError)) req.log.error({ err }, '[admin-assistant] test failed');
    return fail(reply, 502, err instanceof AssistantServiceError ? err.message : 'The test could not be run.');
  }
}

export async function listConversationsHandler(req: FastifyRequest, reply: FastifyReply) {
  const admin = await actingAdmin(req, reply);
  if (!admin) return reply;
  const data = await req.server.prisma.$queryRawUnsafe(
    `SELECT id::text, title, updated_at AS "updatedAt" FROM admin_assistant_conversations
      WHERE admin_id = $1::uuid ORDER BY updated_at DESC LIMIT 50`, admin.id);
  return reply.send({ success: true, data, error: null });
}

export async function getConversationHandler(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const admin = await actingAdmin(req, reply);
  if (!admin) return reply;
  if (!UUID_RE.test(req.params.id)) return fail(reply, 404, 'Conversation not found.');
  const [own] = await req.server.prisma.$queryRawUnsafe<any[]>(
    `SELECT id FROM admin_assistant_conversations WHERE id = $1::uuid AND admin_id = $2::uuid`, req.params.id, admin.id);
  if (!own) return fail(reply, 404, 'Conversation not found.');
  const messages = await req.server.prisma.$queryRawUnsafe(
    `SELECT * FROM (
       SELECT id::text, role, content, tools, created_at AS "createdAt" FROM admin_assistant_messages
        WHERE conversation_id = $1::uuid ORDER BY created_at DESC LIMIT 200) m ORDER BY m."createdAt"`, req.params.id);
  return reply.send({ success: true, data: { id: req.params.id, messages }, error: null });
}

export async function deleteConversationHandler(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const admin = await actingAdmin(req, reply);
  if (!admin) return reply;
  if (!UUID_RE.test(req.params.id)) return fail(reply, 404, 'Conversation not found.');
  const n = await req.server.prisma.$executeRawUnsafe(
    `DELETE FROM admin_assistant_conversations WHERE id = $1::uuid AND admin_id = $2::uuid`, req.params.id, admin.id);
  if (!n) return fail(reply, 404, 'Conversation not found.');
  return reply.send({ success: true, data: { deleted: true }, error: null });
}

// Voice notes per admin in the last 10 minutes (this instance); /chat's own
// limits only see notes that became questions.
const voiceTimes = new Map<string, number[]>();

export async function transcribeHandler(req: FastifyRequest<{ Body: { audio?: unknown } }>, reply: FastifyReply) {
  const key = apiKey();
  if (!key) return fail(reply, 503, 'The assistant is not set up yet.');
  const admin = await actingAdmin(req, reply);
  if (!admin) return reply;
  const audio = validVoiceNote(req.body?.audio);
  if (!audio) return fail(reply, 400, 'That voice note could not be read. Please record it again (up to 60 seconds).');

  const now = Date.now();
  const recent = (voiceTimes.get(admin.id) ?? []).filter((t) => now - t < 600_000);
  if (recent.length >= BURST_LIMIT) return fail(reply, 429, 'You are sending voice notes very quickly. Please wait a few minutes.');
  const limited = await overLimit(req, admin.id);
  if (limited) return fail(reply, 429, limited);
  voiceTimes.set(admin.id, [...recent, now]);

  try {
    const text = await transcribeVoiceNote({
      apiKey: key, wavBase64: audio, max: QUESTION_MAX,
      log: (info) => req.log.error(info as object, '[admin-assistant] transcription failed'),
    });
    if (!text) return fail(reply, 422, "I couldn't hear any words. Please try again, closer to the microphone.");
    return reply.send({ success: true, data: { text }, error: null });
  } catch (err) {
    if (!(err instanceof AssistantServiceError)) req.log.error({ errorName: (err as Error)?.name }, '[admin-assistant] transcription failed');
    return fail(reply, 502, err instanceof AssistantServiceError ? err.message : 'The voice note could not be processed. Please try again.');
  }
}

const SPEECH_LIMIT = 30; // answers read aloud per admin in 10 minutes (this instance)
const speechTimes = new Map<string, number[]>();

export async function speechHandler(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const key = apiKey();
  if (!key) return fail(reply, 503, 'The assistant is not set up yet.');
  const admin = await actingAdmin(req, reply);
  if (!admin) return reply;
  const [message] = UUID_RE.test(req.params.id)
    ? await req.server.prisma.$queryRawUnsafe<Array<{ content: string }>>(
      `SELECT m.content FROM admin_assistant_messages m JOIN admin_assistant_conversations c ON c.id = m.conversation_id
        WHERE m.id = $1::uuid AND m.role = 'assistant' AND c.admin_id = $2::uuid`, req.params.id, admin.id)
    : [];
  if (!message) return fail(reply, 404, 'Answer not found.');
  const now = Date.now();
  const recent = (speechTimes.get(admin.id) ?? []).filter((t) => now - t < 600_000);
  if (recent.length >= SPEECH_LIMIT) return fail(reply, 429, 'You are playing answers very quickly. Please wait a few minutes.');
  speechTimes.set(admin.id, [...recent, now]);

  const abort = new AbortController();
  reply.raw.on('close', () => abort.abort());
  const o = { apiKey: key, signal: abort.signal, log: (info: unknown) => req.log.error(info as object, '[admin-assistant] speech failed') };
  let stream: ReadableStream<Uint8Array>;
  try {
    stream = await speechStream(await spokenScript(message.content, o), o);
  } catch (err) {
    if (abort.signal.aborted) return reply;
    if (!(err instanceof AssistantServiceError)) req.log.error({ errorName: (err as Error)?.name }, '[admin-assistant] speech failed');
    return fail(reply, 502, err instanceof AssistantServiceError ? err.message : 'The voice could not be made. Please try again.');
  }
  reply.hijack();
  reply.raw.writeHead(200, {
    ...(reply.getHeaders() as Record<string, string>),
    'Content-Type': `audio/l16; rate=${SPEECH_SAMPLE_RATE}; channels=1`,
    'Cache-Control': 'no-store, no-transform',
    'X-Accel-Buffering': 'no',
  });
  try {
    for await (const chunk of stream as unknown as AsyncIterable<Uint8Array>) {
      if (reply.raw.destroyed) break;
      reply.raw.write(chunk);
    }
    if (!reply.raw.writableEnded) reply.raw.end();
  } catch (err) {
    if (!abort.signal.aborted) req.log.error({ errorName: (err as Error)?.name }, '[admin-assistant] speech stream failed');
    // A cut connection, not a clean end: half a sentence must not look finished.
    reply.raw.destroy();
  }
  return reply;
}

export async function chatHandler(
  req: FastifyRequest<{ Body: { message?: unknown; conversationId?: unknown; voice?: unknown } }>,
  reply: FastifyReply,
) {
  const key = apiKey();
  if (!key) return fail(reply, 503, 'The assistant is not set up yet.');
  const admin = await actingAdmin(req, reply);
  if (!admin) return reply;

  const question = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  if (!question) return fail(reply, 400, 'Ask a question first.');
  if (question.length > QUESTION_MAX) return fail(reply, 400, `Please keep your question under ${QUESTION_MAX} characters.`);

  const prisma = req.server.prisma;
  let conversationId = req.body?.conversationId;
  let history: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  let title = conversationTitle(question);
  if (conversationId != null) {
    const [own] = typeof conversationId === 'string' && UUID_RE.test(conversationId)
      ? await prisma.$queryRawUnsafe<any[]>(`SELECT title FROM admin_assistant_conversations WHERE id = $1::uuid AND admin_id = $2::uuid`, conversationId, admin.id)
      : [];
    if (!own) return fail(reply, 404, 'Conversation not found.');
    title = own.title;
    history = (await prisma.$queryRawUnsafe<any[]>(
      `SELECT role, content FROM admin_assistant_messages WHERE conversation_id = $1::uuid ORDER BY created_at DESC LIMIT ${HISTORY_TURNS}`, conversationId)).reverse();
  }
  const limited = await overLimit(req, admin.id);
  if (limited) return fail(reply, 429, limited);

  if (conversationId == null) {
    const [c] = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `INSERT INTO admin_assistant_conversations (admin_id, title) VALUES ($1::uuid, $2) RETURNING id::text`, admin.id, title);
    conversationId = c.id;
  }
  // Saved first, so a question that fails still counts towards the limits.
  await prisma.$executeRawUnsafe(
    `INSERT INTO admin_assistant_messages (conversation_id, role, content) VALUES ($1::uuid, 'user', $2)`, conversationId, question);

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
  send({ t: 'start', conversationId });
  const abort = new AbortController();
  reply.raw.on('close', () => abort.abort());

  try {
    const now = new Date();
    const ctx: AdminToolCtx = { prisma: prisma as any, now, admin };
    const log = (info: unknown) => req.log.error(info as object, '[admin-assistant] OpenRouter call failed');
    const r = await runChatLoop({
      complete: openRouterComplete(key, log),
      completeHard: openRouterComplete(key, log, HARD_MODEL),
      system: adminSystemPrompt({ adminName: admin.fullName, role: admin.role, today: new Date(now.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10), voice: req.body?.voice === true }),
      history,
      question,
      tools: toolDefinitions(tools, ctx),
      runTool: (name, args) => runTool(tools, ctx, name, args, { onError: (err) => req.log.error({ err, tool: name }, '[admin-assistant] tool failed') }),
      onTool: (name) => send({ t: 'tool', name }),
      signal: abort.signal,
    });
    const [saved] = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `INSERT INTO admin_assistant_messages (conversation_id, role, content, tools, cost_usd) VALUES ($1::uuid, 'assistant', $2, $3::jsonb, $4::numeric) RETURNING id::text`,
      conversationId, r.text, JSON.stringify(r.toolsUsed), String(r.costUsd));
    await prisma.$executeRawUnsafe(`UPDATE admin_assistant_conversations SET updated_at = NOW() WHERE id = $1::uuid`, conversationId);
    send({ t: 'answer', text: r.text, messageId: saved?.id ?? null, conversationId, title, tools: r.toolsUsed });
  } catch (err) {
    if (!abort.signal.aborted) {
      if (!(err instanceof AssistantServiceError)) req.log.error({ err }, '[admin-assistant] chat failed');
      send({ t: 'error', message: err instanceof AssistantServiceError ? err.message : 'Sorry, I could not answer just now. Please try again.' });
    }
  } finally {
    if (!reply.raw.writableEnded) reply.raw.end();
  }
}
