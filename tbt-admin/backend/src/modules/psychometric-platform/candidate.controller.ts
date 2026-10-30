import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  SUBMIT_GRACE_MS,
  buildAnswerRows,
  buildSections,
  orderByIds,
  publicAudio,
  shuffled,
  type AttemptQuestion,
  type SubmittedAnswer,
} from '../../lib/psychometric/assessmentRules.js';
import { candidateRef } from '../../lib/psychometric/candidateRef.js';
import { calculateResult, computeQuestionMaxes, type ScoringOption } from '../../lib/psychometric/scoring.js';
import { resultOut, retestOut } from '../../lib/psychometric/rows.js';
import { explanationSpeechText, textHash } from '../../lib/psychometric/voice.js';
import { MEMBERS_ACCESS_CODE_KEY } from './content.controller.js';
import { fail, jsonParam, rows, type Db } from './db.js';

// The member side of Psychometric: TBT members take the assessment with their
// TBT login (JWT cookie). Ported from the standalone assessmentController; the
// old per-login access-code step is replaced by the admin's "TBT members take"
// setting (psy_settings.members_access_code_id). A member becomes a candidate
// (psy_candidates.member_id) the first time they start.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Body = Record<string, any>;
type Req = FastifyRequest<{ Params: { id: string }; Body: Body }>;
const db = (req: FastifyRequest): Db => req.server.prisma as unknown as Db;
const tx = <T>(req: FastifyRequest, fn: (t: Db) => Promise<T>): Promise<T> => (req.server.prisma as any).$transaction(fn);

const NOT_AVAILABLE = 'The assessment is not available yet. Please check back later.';

async function findCandidate(d: Db, memberId: string) {
  const [c] = await rows(d, `SELECT * FROM psy_candidates WHERE member_id = $1::uuid`, memberId);
  return c ?? null;
}

/** The member's candidate record, created on first use from their member profile. */
async function ensureCandidate(t: Db, req: FastifyRequest, memberId: string) {
  const existing = await findCandidate(t, memberId);
  if (existing) return existing;
  const m = await req.server.prisma.member.findUnique({
    where: { id: memberId },
    select: { memberId: true, firstName: true, lastName: true, email: true, phone: true },
  });
  if (!m) return null;
  const name = [m.firstName, m.lastName].filter(Boolean).join(' ').trim() || 'TBT Member';
  // ON CONFLICT DO NOTHING covers a concurrent first start and an (unlikely) candidate-code clash.
  await t.$executeRawUnsafe(
    `INSERT INTO psy_candidates (member_id, source, name, email, phone, candidate_code, batch)
     VALUES ($1::uuid, 'tbt', $2, $3, $4, $5, 'TBT Members') ON CONFLICT DO NOTHING`,
    memberId, name, m.email, m.phone, `TBT-M-${m.memberId}`);
  return (await findCandidate(t, memberId))
    ?? (await rows(t,
      `INSERT INTO psy_candidates (member_id, source, name, email, phone, batch) VALUES ($1::uuid, 'tbt', $2, $3, $4, 'TBT Members') RETURNING *`,
      memberId, name, m.email, m.phone))[0];
}

/** The members' assessment: setting → access code → active question set → its active question ids in set order. */
async function resolveMembersSet(d: Db) {
  const [s] = await rows(d, `SELECT value FROM psy_settings WHERE key = $1`, MEMBERS_ACCESS_CODE_KEY);
  const codeId = s?.value;
  if (!codeId) return { error: NOT_AVAILABLE };
  const [code] = await rows(d, `SELECT * FROM psy_access_codes WHERE id = $1`, String(codeId));
  if (!code || !code.is_active || !code.question_set_id) return { error: NOT_AVAILABLE };
  const [set] = await rows(d, `SELECT * FROM psy_question_sets WHERE id = $1`, code.question_set_id);
  if (!set || !set.is_active) return { error: 'The assessment is not available right now. Please try again later.' };
  const ids: string[] = set.question_ids ?? [];
  const active = new Set((await rows(d, `SELECT id FROM psy_questions WHERE id = ANY($1::text[]) AND is_active`, ids)).map((r) => r.id));
  const orderedIds = ids.filter((id) => active.has(id));
  if (!orderedIds.length) return { error: 'The assessment has no questions yet. Please try again later.' };
  return { code, set, orderedIds };
}

async function inProgressSession(d: Db, candidateId: string) {
  const [s] = await rows(d, `SELECT * FROM psy_sessions WHERE candidate_id = $1 AND status = 'in-progress' ORDER BY started_at DESC LIMIT 1`, candidateId);
  return s ?? null;
}

async function ttsEnabled(d: Db) {
  const [r] = await rows(d, `SELECT value FROM psy_settings WHERE key = 'tts_config'`);
  return !(r && r.value && r.value.enabled === false);
}

// ── GET /questions ─────────────────────────────────────────────────────────

export async function getQuestions(req: Req, reply: FastifyReply) {
  const d = db(req);
  const cand = await findCandidate(d, req.memberId!);
  const session = cand ? await inProgressSession(d, cand.id) : null;
  let orderedIds: string[];
  let remainingSeconds: number;
  if (session) {
    orderedIds = session.question_ids ?? [];
    remainingSeconds = Math.max(0, Math.ceil((new Date(session.expires_at).getTime() - Date.now()) / 1000));
  } else {
    const resolved = await resolveMembersSet(d);
    if ('error' in resolved) return fail(reply, 403, resolved.error as string);
    orderedIds = resolved.orderedIds;
    remainingSeconds = resolved.set.duration_minutes * 60;
  }

  const [types, qRows, oRows, audio] = await Promise.all([
    rows(d, `SELECT id, name, icon, color FROM psy_question_types WHERE is_active ORDER BY sort_order`),
    rows(d, `SELECT * FROM psy_questions WHERE id = ANY($1::text[])`, orderedIds),
    // Scoring secrets (score / is_correct / dimension_scores) never reach the candidate.
    rows(d, `SELECT id, question_id, option_text, option_image_url, sort_order FROM psy_answer_options WHERE question_id = ANY($1::text[]) ORDER BY sort_order`, orderedIds),
    (await ttsEnabled(d)) ? rows(d, `SELECT question_id, kind, text_hash FROM psy_question_audio WHERE question_id = ANY($1::text[])`, orderedIds) : Promise.resolve([]),
  ]);
  const questions = orderByIds(qRows, orderedIds);
  const optionsByQ: Record<string, { _id: string; optionText: string; optionImageUrl: string; order: number }[]> = {};
  for (const o of oRows) (optionsByQ[o.question_id] ||= []).push({ _id: o.id, optionText: o.option_text, optionImageUrl: o.option_image_url, order: o.sort_order });
  const hash = new Map(audio.map((a: any) => [`${a.kind}:${a.question_id}`, a.text_hash]));

  const publicQuestions = questions.map((q) => {
    const a = publicAudio({ hasAudio: q.has_audio, audioUrl: q.audio_url });
    const speech = explanationSpeechText({ explanationAudioText: q.explanation_audio_text, explanationIsTanglish: q.explanation_is_tanglish });
    return {
      _id: q.id,
      typeId: q.type_id,
      text: q.text,
      order: q.sort_order,
      language: q.language === 'ta' ? 'ta' : 'en',
      questionType: q.question_type,
      dimension: q.dimension,
      difficulty: q.difficulty,
      timeLimitSeconds: q.time_limit_seconds,
      imageUrl: q.image_url,
      instructionText: q.instruction_text,
      explanationAudioText: q.explanation_audio_text || '',
      explanationIsTanglish: !!q.explanation_is_tanglish,
      neuralExplanationAudio: hash.get(`explanation:${q.id}`) === textHash(speech),
      hasAudio: a.hasAudio,
      audioUrl: a.audioUrl,
      neuralAudio: hash.get(`question:${q.id}`) === textHash(q.text),
      options: q.question_type === 'RANKING' ? shuffled(optionsByQ[q.id] || []) : optionsByQ[q.id] || [],
    };
  });
  const sections = buildSections(types, publicQuestions, orderedIds).map((s) => ({
    ...s,
    questions: s.questions.map(({ typeId: _t, ...q }) => q),
  }));
  return reply.send({ success: true, data: sections, remainingSeconds });
}

// ── POST /start ────────────────────────────────────────────────────────────

export async function startSession(req: Req, reply: FastifyReply) {
  const memberId = req.memberId!;
  const out = await tx(req, async (t) => {
    // One start at a time per member (no duplicate in-progress sessions).
    await t.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtext($1))`, `psy-start:${memberId}`);
    const cand = await ensureCandidate(t, req, memberId);
    if (!cand) return { status: 404, body: { success: false, message: 'Member not found.' } };

    // A completed candidate starts again only with an admin-approved retest (consumed below).
    let approvedRetest: any = null;
    if (cand.has_completed) {
      [approvedRetest] = await rows(t, `SELECT id FROM psy_retest_requests WHERE candidate_id = $1 AND status = 'approved' ORDER BY created_at DESC LIMIT 1`, cand.id);
      if (!approvedRetest) return { status: 403, body: { success: false, message: 'You have already completed this assessment.' } };
    }

    // Resume a live attempt (unless starting an approved retest); retire dead ones.
    const live = await inProgressSession(t, cand.id);
    if (live) {
      const dead = Date.now() > new Date(live.expires_at).getTime() + SUBMIT_GRACE_MS;
      if (!dead && !approvedRetest) {
        return { status: 409, body: { success: false, sessionId: live.id, expiresAt: live.expires_at, message: 'Assessment already in progress.' } };
      }
      await t.$executeRawUnsafe(`UPDATE psy_sessions SET status = 'expired' WHERE id = $1`, live.id);
    }

    const resolved = await resolveMembersSet(t);
    if ('error' in resolved) return { status: 403, body: { success: false, message: resolved.error } };
    const { code, set, orderedIds } = resolved;

    const [{ n }] = await rows(t, `SELECT COUNT(*)::int AS n FROM psy_results WHERE candidate_id = $1`, cand.id);
    const attemptNumber = n + 1;
    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + set.duration_minutes * 60 * 1000);
    // The session freezes WHICH questions (and in what order) this attempt is scored against.
    const [s] = await rows(t,
      `INSERT INTO psy_sessions (candidate_id, started_at, expires_at, ip_address, question_set_id, question_ids, duration_minutes, attempt_number)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8) RETURNING id`,
      cand.id, startedAt, expiresAt, req.ip ?? null, set.id, JSON.stringify(orderedIds), set.duration_minutes, attemptNumber);
    if (approvedRetest) {
      await t.$executeRawUnsafe(`UPDATE psy_retest_requests SET status = 'used', used_at = NOW(), updated_at = NOW() WHERE id = $1`, approvedRetest.id);
    }
    // Record which cohort the member took (shown on the admin candidate list / results).
    await t.$executeRawUnsafe(
      `UPDATE psy_candidates SET access_code_id = $1, access_code = $2, updated_at = NOW() WHERE id = $3`, code.id, code.code, cand.id);
    return { status: 201, body: { success: true, sessionId: s.id, startedAt, expiresAt, attemptNumber } };
  });
  return reply.code(out.status).send(out.body);
}

// ── POST /submit ───────────────────────────────────────────────────────────

async function notify(d: Db, n: { type: string; title: string; message: string; entityType: string; entityId: string; candidateId: string; metadata: Record<string, unknown> }) {
  // Best effort and idempotent on (type, entity): never breaks the primary flow.
  try {
    await d.$executeRawUnsafe(
      `INSERT INTO psy_notifications (type, title, message, entity_type, entity_id, candidate_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb) ON CONFLICT DO NOTHING`,
      n.type, n.title, n.message, n.entityType, n.entityId, n.candidateId, JSON.stringify(n.metadata));
  } catch {
    /* notifications are secondary */
  }
}

export async function submitAssessment(req: Req, reply: FastifyReply) {
  const { sessionId, answers } = req.body ?? {};
  const d = db(req);
  const cand = await findCandidate(d, req.memberId!);
  const [session] = sessionId ? await rows(d, `SELECT * FROM psy_sessions WHERE id = $1`, String(sessionId)) : [];
  if (!cand || !session || session.candidate_id !== cand.id) return fail(reply, 403, 'Session not found or not yours.');
  if (session.status !== 'in-progress') return fail(reply, 400, 'Session already submitted or expired.');

  // Timing is server-authoritative.
  const expiresAt = new Date(session.expires_at).getTime();
  const now = Date.now();
  if (now > expiresAt + SUBMIT_GRACE_MS) return fail(reply, 400, 'Assessment time has expired.');
  const autoSubmitted = now > expiresAt;

  const ids: string[] = session.question_ids ?? [];
  const [qRows, oRows, typeRows] = await Promise.all([
    rows(d, `SELECT * FROM psy_questions WHERE id = ANY($1::text[])`, ids),
    rows(d, `SELECT id, question_id, score, dimension_scores FROM psy_answer_options WHERE question_id = ANY($1::text[])`, ids),
    rows(d, `SELECT id, name FROM psy_question_types`),
  ]);
  const questions: AttemptQuestion[] = orderByIds(qRows, ids).map((q) => ({
    id: q.id, typeId: q.type_id, questionType: q.question_type, dimension: q.dimension, marks: q.marks, order: q.sort_order,
    correctOptionId: q.correct_option_id, correctOptionIds: q.correct_option_ids, idealOrder: q.ideal_order, scoringMode: q.scoring_mode,
  }));
  const optionsByQ: Record<string, ScoringOption[]> = {};
  for (const o of oRows) (optionsByQ[o.question_id] ||= []).push({ id: o.id, score: o.score, dimensionScores: o.dimension_scores });

  const built = buildAnswerRows(questions, Array.isArray(answers) ? (answers as SubmittedAnswer[]) : [], optionsByQ, autoSubmitted);
  if ('error' in built) return fail(reply, 400, built.error);

  const typeName = Object.fromEntries(typeRows.map((t) => [t.id, t.name]));
  const situational = Object.fromEntries(questions.filter((q) => q.questionType === 'SITUATIONAL').map((q) => [q.id, optionsByQ[q.id] || []]));
  const { categoryQuestionMax, dimensionQuestionMax } = computeQuestionMaxes(questions, typeName, situational);
  const scored = calculateResult(built.rows, Object.fromEntries(questions.map((q) => [q.id, typeName[q.typeId]])), categoryQuestionMax, dimensionQuestionMax, questions.length);

  const out = await tx(req, async (t) => {
    // Claim the session atomically so two concurrent submits can't both score.
    const [claimed] = await rows(t,
      `UPDATE psy_sessions SET status = 'submitted', submitted_at = NOW(), auto_submitted = $1, total_answered = $2
       WHERE id = $3 AND status = 'in-progress' RETURNING attempt_number`,
      autoSubmitted, built.rows.filter((r) => r.status === 'answered').length, session.id);
    if (!claimed) return null;
    for (const r of built.rows) {
      await t.$executeRawUnsafe(
        `INSERT INTO psy_answers (session_id, candidate_id, question_id, answer_option_id, selected_option_ids, ranking_order, score, max_score,
           is_correct, dimension, dimension_scores, question_order, answered_at, time_taken_seconds, status)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9, $10, $11::jsonb, $12, NOW(), $13, $14)`,
        session.id, cand.id, r.questionId, r.answerOptionId, jsonParam(r.selectedOptionIds), jsonParam(r.rankingOrder), r.score, r.maxScore,
        r.isCorrect, r.dimension, JSON.stringify(r.dimensionScores), r.questionOrder, r.timeTakenSeconds, r.status);
    }
    const [res] = await rows(t,
      `INSERT INTO psy_results (candidate_id, session_id, attempt_number, total_marks, max_score, percentage, level, category_scores,
         category_percentages, highest_category, recommended_business, explanation, improvement_areas, dimension_scores, dimension_percentages,
         correct_count, wrong_count, skipped_count, business_readiness_percent, recommendations, strong_dimensions, weak_dimensions,
         aptitude_score, personality_score, business_mindset_score, financial_awareness_score)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb, $12, $13::jsonb, $14::jsonb, $15::jsonb,
         $16, $17, $18, $19, $20::jsonb, $21::jsonb, $22::jsonb, $23, $24, $25, $26) RETURNING id`,
      cand.id, session.id, claimed.attempt_number || 1, scored.totalMarks, scored.maxScore, scored.percentage, scored.level,
      JSON.stringify(scored.categoryScores), JSON.stringify(scored.categoryPercentages), JSON.stringify(scored.highestCategory),
      JSON.stringify(scored.recommendedBusiness), scored.explanation, JSON.stringify(scored.improvementAreas), JSON.stringify(scored.dimensionScores),
      JSON.stringify(scored.dimensionPercentages), scored.correctCount, scored.wrongCount, scored.skippedCount, scored.businessReadinessPercent,
      JSON.stringify(scored.recommendations), JSON.stringify(scored.strongDimensions), JSON.stringify(scored.weakDimensions),
      scored.aptitudeScore, scored.personalityScore, scored.businessMindsetScore, scored.financialAwarenessScore);
    await t.$executeRawUnsafe(`UPDATE psy_candidates SET has_completed = TRUE, updated_at = NOW() WHERE id = $1`, cand.id);
    return res.id as string;
  });
  if (!out) return fail(reply, 409, 'Submission already in progress or completed.');

  await notify(d, {
    type: 'ASSESSMENT_SUBMITTED',
    title: 'Assessment submitted',
    message: `${cand.name || 'A candidate'} completed the assessment with a score of ${Math.round(scored.percentage)}%.`,
    entityType: 'RESULT',
    entityId: out,
    candidateId: cand.id,
    metadata: {
      userName: cand.name, userEmail: cand.email, score: Math.round(scored.percentage), accessCode: cand.access_code,
      recommendedBusiness: scored.recommendedBusiness[0], level: scored.level,
    },
  });
  return reply.send({ success: true, resultId: out });
}

// ── Results + retests ──────────────────────────────────────────────────────

async function retestState(d: Db, cand: any) {
  if (!cand) return { status: 'none', rejectionNote: undefined, canRequest: false };
  const [latest] = await rows(d, `SELECT status, rejection_note FROM psy_retest_requests WHERE candidate_id = $1 ORDER BY created_at DESC LIMIT 1`, cand.id);
  const [active] = await rows(d, `SELECT 1 FROM psy_retest_requests WHERE candidate_id = $1 AND status IN ('pending', 'approved') LIMIT 1`, cand.id);
  return { status: latest ? latest.status : 'none', rejectionNote: latest?.rejection_note ?? undefined, canRequest: !!cand.has_completed && !active };
}

export async function getResult(req: Req, reply: FastifyReply) {
  const d = db(req);
  const cand = await findCandidate(d, req.memberId!);
  const [r] = cand ? await rows(d, `SELECT * FROM psy_results WHERE candidate_id = $1 ORDER BY created_at DESC LIMIT 1`, cand.id) : [];
  if (!r) return fail(reply, 404, 'No result found.');
  const [code] = cand.access_code_id ? await rows(d, `SELECT id, label FROM psy_access_codes WHERE id = $1`, cand.access_code_id) : [];
  const history = await rows(d,
    `SELECT id, attempt_number, percentage, level, total_marks, max_score, created_at FROM psy_results WHERE candidate_id = $1 ORDER BY created_at DESC`, cand.id);
  return reply.send({
    success: true,
    data: { ...resultOut(r), userId: candidateRef(cand, code) },
    attemptNumber: r.attempt_number || 1,
    history: history.map((h) => ({ _id: h.id, attemptNumber: h.attempt_number, percentage: h.percentage, level: h.level, totalMarks: h.total_marks, maxScore: h.max_score, createdAt: h.created_at })),
    retest: await retestState(d, cand),
  });
}

export async function getMyRetest(req: Req, reply: FastifyReply) {
  const d = db(req);
  const cand = await findCandidate(d, req.memberId!);
  const [latest] = cand ? await rows(d, `SELECT * FROM psy_retest_requests WHERE candidate_id = $1 ORDER BY created_at DESC LIMIT 1`, cand.id) : [];
  return reply.send({ success: true, data: latest ? retestOut(latest) : null, retest: await retestState(d, cand) });
}

export async function requestRetest(req: Req, reply: FastifyReply) {
  const memberId = req.memberId!;
  const out = await tx(req, async (t) => {
    await t.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtext($1))`, `psy-retest:${memberId}`);
    const cand = await findCandidate(t, memberId);
    if (!cand?.has_completed) return { status: 400, body: { success: false, message: 'You can request a retest only after completing your assessment.' } };
    const [active] = await rows(t, `SELECT 1 FROM psy_retest_requests WHERE candidate_id = $1 AND status IN ('pending', 'approved') LIMIT 1`, cand.id);
    if (active) return { status: 409, body: { success: false, message: 'Retest request already submitted.' } };
    const [latest] = await rows(t, `SELECT id, percentage, level FROM psy_results WHERE candidate_id = $1 ORDER BY created_at DESC LIMIT 1`, cand.id);
    const [{ n }] = await rows(t, `SELECT COUNT(*)::int AS n FROM psy_results WHERE candidate_id = $1`, cand.id);
    const [code] = cand.access_code_id ? await rows(t, `SELECT question_set_id FROM psy_access_codes WHERE id = $1`, cand.access_code_id) : [];
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.slice(0, 500) : null;
    const [rr] = await rows(t,
      `INSERT INTO psy_retest_requests (candidate_id, user_name, user_email, shared_code, question_set_id, attempt_number, current_result_id,
         current_percentage, current_level, reason, requested_by_user, ip_address, user_agent, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE, $11, $12, 'pending') RETURNING id`,
      cand.id, cand.name, cand.email, cand.access_code, code?.question_set_id ?? null, n + 1, latest?.id ?? null, latest?.percentage ?? null,
      latest?.level ?? null, reason, req.ip ?? null, String(req.headers['user-agent'] ?? '').slice(0, 500) || null);
    return { status: 200, body: { success: true, message: 'Retest request sent to the administrator for approval.' }, cand, retestId: rr.id as string, attempt: n + 1 };
  });
  if (out.status === 200 && out.cand && out.retestId) {
    await notify(db(req), {
      type: 'RETEST_REQUEST_CREATED',
      title: 'New retest request',
      message: `${out.cand.name || 'A candidate'} requested permission to retake the assessment.`,
      entityType: 'RETEST_REQUEST',
      entityId: out.retestId,
      candidateId: out.cand.id,
      metadata: { userName: out.cand.name, userEmail: out.cand.email, accessCode: out.cand.access_code, status: 'pending', attemptNumber: out.attempt },
    });
  }
  return reply.code(out.status).send(out.body);
}

export async function getAssessmentSettings(req: Req, reply: FastifyReply) {
  const d = db(req);
  const resolved = await resolveMembersSet(d);
  let minutes: number;
  if (!('error' in resolved)) minutes = resolved.set.duration_minutes;
  else {
    const [s] = await rows(d, `SELECT value FROM psy_settings WHERE key = 'assessment_duration_minutes'`);
    minutes = s ? Number(s.value) : 30;
  }
  return reply.send({ success: true, data: { assessment_duration_minutes: minutes } });
}

// ── Cached neural audio for the candidate ──────────────────────────────────

async function sendAudio(req: Req, reply: FastifyReply, kind: 'question' | 'explanation') {
  const [a] = await rows(db(req), `SELECT audio, content_type, text_hash, voice FROM psy_question_audio WHERE question_id = $1 AND kind = $2`, req.params.id, kind);
  if (!a || !a.audio) return fail(reply, 404, kind === 'question' ? 'No generated audio for this question.' : 'No generated explanation audio for this question.');
  reply.header('Content-Type', a.content_type || 'audio/mpeg');
  if (kind === 'question') reply.header('Cache-Control', 'private, max-age=86400').header('ETag', `"${a.text_hash}"`);
  // Explanation voice can change for the same text, so never cache it.
  else reply.header('Cache-Control', 'no-store').header('ETag', `"${a.text_hash}-${a.voice}"`);
  return reply.send(Buffer.from(a.audio));
}

export const getQuestionAudio = (req: Req, reply: FastifyReply) => sendAudio(req, reply, 'question');
export const getExplanationAudio = (req: Req, reply: FastifyReply) => sendAudio(req, reply, 'explanation');
