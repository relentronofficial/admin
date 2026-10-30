import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import * as content from './content.controller.js';
import * as results from './results.controller.js';
import * as voice from './voice.controller.js';
import * as member from './candidate.controller.js';

// Opt-in and LOCAL ONLY: set PSY_PG_TEST_URL to a throwaway local database
// (e.g. `docker run --rm -e POSTGRES_PASSWORD=pg -p 55432:5432 postgres:16-alpine`
// → postgres://postgres:pg@localhost:55432/postgres). Runs the real psy_* DDL
// from plugins/prisma.ts, then the real admin handlers against it.
const RAW_URL = process.env.PSY_PG_TEST_URL ?? '';
const isLocal = (() => {
  try { return ['localhost', '127.0.0.1', '[::1]'].includes(new URL(RAW_URL).hostname); } catch { return false; }
})();
if (RAW_URL && !isLocal) throw new Error('PSY_PG_TEST_URL must point at localhost — refusing to run against a shared database.');

const suite = RAW_URL ? describe : describe.skip;
let prisma: PrismaClient;

/** Every startup statement that touches a psy_* table, in source order. */
function psyDdl(): string[] {
  const src = readFileSync(resolve(__dirname, '../../plugins/prisma.ts'), 'utf8');
  return [...src.matchAll(/\$executeRawUnsafe\(`([\s\S]*?)`\)/g)].map((m) => m[1]).filter((sql) => /\bpsy_\w+/.test(sql));
}

const ADMIN = { id: '00000000-0000-4000-8000-0000000000aa', fullName: 'Test Admin', email: 'admin@tbt.test', role: 'admin' };

async function call(handler: any, opts: { params?: any; query?: any; body?: any } = {}) {
  const sent: { status: number; body: any; headers: Record<string, string> } = { status: 200, body: undefined, headers: {} };
  const reply: any = {
    code(c: number) { sent.status = c; return reply; },
    header(k: string, v: string) { sent.headers[k.toLowerCase()] = v; return reply; },
    send(b: any) { sent.body = b; return reply; },
  };
  const req: any = { params: opts.params ?? {}, query: opts.query ?? {}, body: opts.body, server: { prisma }, psyAdmin: ADMIN, log: { error() {}, info() {} } };
  await handler(req, reply);
  return sent;
}

const likert = (n = 5) => Array.from({ length: n }, (_, i) => ({ optionText: `L${i + 1}`, score: i + 1, order: i + 1 }));

suite('psychometric platform (real Postgres)', () => {
  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: RAW_URL } } });
    await prisma.$executeRawUnsafe(`DROP SCHEMA public CASCADE`);
    await prisma.$executeRawUnsafe(`CREATE SCHEMA public`);
    // psy_candidates.member_id references members(id); a stand-in with the columns the handlers read.
    await prisma.$executeRawUnsafe(`CREATE TABLE members (id UUID PRIMARY KEY, member_id TEXT, first_name TEXT, last_name TEXT, email TEXT, phone TEXT)`);
    for (const sql of psyDdl()) await prisma.$executeRawUnsafe(sql);
  }, 60_000);
  afterAll(async () => { await prisma?.$disconnect(); });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(`TRUNCATE psy_question_audio, psy_notifications, psy_retest_requests, psy_results, psy_answers, psy_sessions,
      psy_candidates, psy_business_matrix, psy_settings, psy_access_codes, psy_question_sets, psy_answer_options, psy_questions, psy_question_types, members CASCADE`);
  });

  async function makeType(name: string, order: number) {
    const r = await call(content.createQuestionType, { body: { name, description: `${name} desc`, order } });
    expect(r.status).toBe(201);
    return r.body.data;
  }
  async function makeQuestion(typeId: string, order: number, extra: any = {}) {
    const r = await call(content.createQuestion, { body: { typeId, text: `Q${order}`, order, questionType: 'LIKERT_SCALE', dimension: 'Leadership', marks: 5, options: likert(), ...extra } });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    return r.body.data;
  }

  it('creates every psy_ table', async () => {
    const t = await prisma.$queryRawUnsafe<{ n: number }[]>(`SELECT COUNT(*)::int AS n FROM information_schema.tables WHERE table_name LIKE 'psy\\_%'`);
    expect(t[0].n).toBe(14);
  });

  it('question types: create, unique order, swap order, deactivate', async () => {
    const a = await makeType('Leadership', 1);
    const b = await makeType('Communication', 2);
    expect((await call(content.createQuestionType, { body: { name: 'X', description: 'd', order: 1 } })).status).toBe(409);
    const swap = await call(content.updateQuestionType, { params: { id: a._id }, body: { order: 2 } });
    expect(swap.body.data.order).toBe(2);
    const list = await call(content.listQuestionTypes);
    expect(list.body.data.map((t: any) => [t.name, t.order])).toEqual([['Communication', 1], ['Leadership', 2]]);
    await makeQuestion(b._id, 1);
    await call(content.deleteQuestionType, { params: { id: b._id } });
    const qs = await call(content.listQuestions);
    expect(qs.body.data[0].isActive).toBe(false);
  });

  it('questions: options saved, answer key derived, options diffed on update, list hides audio', async () => {
    const t = await makeType('Numerical Ability', 1);
    const mcq = await makeQuestion(t._id, 1, {
      questionType: 'NUMERICAL_ABILITY', dimension: 'Numerical Ability', hasAudio: true, audioUrl: 'data:audio/mpeg;base64,AAAA',
      options: [{ optionText: '1', score: 0 }, { optionText: '2', score: 5, isCorrect: true }],
    });
    expect(mcq.options).toHaveLength(2);
    expect(mcq.correctOptionId).toBe(mcq.options[1]._id);
    expect(mcq.audioUrl).toBe('data:audio/mpeg;base64,AAAA');

    const keep = mcq.options[1];
    const upd = await call(content.updateQuestion, {
      params: { id: mcq._id },
      body: { typeId: t._id, text: 'Q1 edited', order: 1, questionType: 'NUMERICAL_ABILITY', dimension: 'Numerical Ability', marks: 5,
        options: [{ ...keep, optionText: '2 (kept)' }, { optionText: '3', score: 0 }] },
    });
    expect(upd.status).toBe(200);
    expect(upd.body.data.options.map((o: any) => o.optionText)).toEqual(['2 (kept)', '3']);
    expect(upd.body.data.options[0]._id).toBe(keep._id);
    expect(upd.body.data.correctOptionId).toBe(keep._id);

    const list = await call(content.listQuestions);
    expect(list.body.data[0].audioUrl).toBeUndefined();
    expect(list.body.data[0].typeId).toMatchObject({ _id: t._id, name: 'Numerical Ability' });
    const one = await call(content.getQuestion, { params: { id: mcq._id } });
    expect(one.body.data.audioUrl).toBe('data:audio/mpeg;base64,AAAA');

    const ranking = await makeQuestion(t._id, 2, { questionType: 'RANKING', options: [{ optionText: 'a', score: 1 }, { optionText: 'b', score: 1 }] });
    expect(ranking.idealOrder).toEqual(ranking.options.map((o: any) => o._id));
    const multi = await makeQuestion(t._id, 3, { questionType: 'MULTI_SELECT', scoringMode: 'partial', options: [{ optionText: 'a', score: 1, isCorrect: true }, { optionText: 'b', score: 0 }] });
    expect(multi.correctOptionIds).toEqual([multi.options[0]._id]);
    expect(multi.scoringMode).toBe('partial');

    expect((await call(content.createQuestion, { body: { ...mcq, options: likert(), questionType: 'LIKERT_SCALE', order: 1 } })).status).toBe(409);
    expect((await call(content.createQuestion, { body: { typeId: 'nope', text: 'x', order: 9, questionType: 'LIKERT_SCALE', dimension: 'Leadership', marks: 1, options: likert() } })).status).toBe(400);
  });

  it('questions: reorder in two passes, soft delete vacates the order slot', async () => {
    const t = await makeType('Leadership', 1);
    const q1 = await makeQuestion(t._id, 1);
    const q2 = await makeQuestion(t._id, 2);
    const r = await call(content.reorderQuestions, { body: { orders: [{ id: q1._id, order: 2 }, { id: q2._id, order: 1 }] } });
    expect(r.body.data.map((q: any) => [q._id, q.order])).toEqual([[q2._id, 1], [q1._id, 2]]);
    await call(content.deleteQuestion, { params: { id: q1._id } });
    await call(content.deleteQuestion, { params: { id: q2._id } });
    const list = (await call(content.listQuestions)).body.data;
    expect(list.every((q: any) => q.order < 0 && !q.isActive)).toBe(true);
    expect(new Set(list.map((q: any) => q.order)).size).toBe(2);
    await makeQuestion(t._id, 1); // the freed slot is reusable
  });

  it('question sets + access codes: counts, populate in set order, delete guarded, stats', async () => {
    const t = await makeType('Leadership', 1);
    const q1 = await makeQuestion(t._id, 1);
    const q2 = await makeQuestion(t._id, 2);
    const set = await call(content.createQuestionSet, { body: { name: 'Default', durationMinutes: 30, questionIds: [q2._id, q1._id, q2._id] } });
    expect(set.status).toBe(201);
    expect(set.body.data.questionIds).toEqual([q2._id, q1._id]);
    expect(set.body.data.createdBy).toBe(ADMIN.id);
    expect((await call(content.createQuestionSet, { body: { name: 'Default', durationMinutes: 30, questionIds: [q1._id] } })).status).toBe(409);
    expect((await call(content.createQuestionSet, { body: { name: 'Bad', durationMinutes: 30, questionIds: ['missing'] } })).status).toBe(400);

    const code = await call(content.createAccessCode, { body: { code: 'tbt2026', label: 'Members', questionSetId: set.body.data._id } });
    expect(code.status).toBe(201);
    expect(code.body.data.code).toBe('TBT2026');
    expect((await call(content.createAccessCode, { body: { code: 'TBT2026', label: 'dup' } })).status).toBe(409);
    const codes = await call(content.listAccessCodes, { query: { search: 'memb' } });
    expect(codes.body.data[0].questionSetId).toMatchObject({ name: 'Default', durationMinutes: 30 });
    expect(codes.body.data[0].createdBy).toEqual({ _id: ADMIN.id, email: ADMIN.email });

    const sets = await call(content.listQuestionSets);
    expect(sets.body.data[0]).toMatchObject({ questionCount: 2, assignedCodeCount: 1 });
    const got = await call(content.getQuestionSet, { params: { id: set.body.data._id } });
    expect(got.body.data.questionIds.map((q: any) => q.text)).toEqual(['Q2', 'Q1']);

    const del = await call(content.deleteQuestionSet, { params: { id: set.body.data._id } });
    expect(del.status).toBe(409);
    expect(del.body.codes).toEqual(['TBT2026']);
    await call(content.updateAccessCode, { params: { id: code.body.data._id }, body: { questionSetId: '' } });
    expect((await call(content.deleteQuestionSet, { params: { id: set.body.data._id } })).status).toBe(200);

    await prisma.$executeRawUnsafe(`INSERT INTO psy_candidates (name, email, access_code_id) VALUES ('Ravi', 'r@x.com', $1)`, code.body.data._id);
    const stats = await call(content.accessCodeStats, { params: { id: code.body.data._id } });
    expect(stats.body.users.map((u: any) => u.name)).toEqual(['Ravi']);
    await call(content.deleteAccessCode, { params: { id: code.body.data._id } });
    expect((await call(content.listAccessCodes)).body.data[0].isActive).toBe(false);
  });

  it('business matrix: sample seeding over all active types, create/update/delete cells', async () => {
    expect((await call(content.seedSampleMatrix)).status).toBe(400);
    const a = await makeType('Communication', 1);
    const b = await makeType('Leadership', 2);
    const seeded = await call(content.seedSampleMatrix);
    expect(seeded.body).toMatchObject({ success: true, created: 4, cleared: 0 });
    const m = await call(content.getMatrix);
    expect(m.body.completion).toEqual({ configured: 4, total: 4 });
    expect(m.body.cells.find((c: any) => c.rowTypeId === a._id && c.colTypeId === a._id).businessName).toBe('Public Relations Agency');
    expect((await call(content.createMatrixCell, { body: { rowTypeId: a._id, colTypeId: b._id, businessName: 'X', rating: 3 } })).status).toBe(409);
    const cell = m.body.cells[0];
    const upd = await call(content.updateMatrixCell, { params: { id: cell._id }, body: { rating: 5, isActive: false } });
    expect(upd.body.data).toMatchObject({ rating: 5, isActive: false });
    expect((await call(content.deleteMatrixCell, { params: { id: cell._id } })).body.message).toBe('Cell removed.');
  });

  it('settings: duration default + update, members access code must be usable', async () => {
    expect((await call(content.getSettings)).body.data).toEqual({ assessment_duration_minutes: 30, members_access_code_id: null });
    expect((await call(content.updateSettings, { body: { assessment_duration_minutes: 0 } })).status).toBe(400);
    await call(content.updateSettings, { body: { assessment_duration_minutes: 45 } });
    const noSet = await call(content.createAccessCode, { body: { code: 'NOSET', label: 'x' } });
    expect((await call(content.updateSettings, { body: { members_access_code_id: noSet.body.data._id } })).status).toBe(400);
    const t = await makeType('Leadership', 1);
    const q = await makeQuestion(t._id, 1);
    const set = await call(content.createQuestionSet, { body: { name: 'S', durationMinutes: 20, questionIds: [q._id] } });
    const ok = await call(content.createAccessCode, { body: { code: 'MEMBERS', label: 'TBT', questionSetId: set.body.data._id } });
    expect((await call(content.updateSettings, { body: { members_access_code_id: ok.body.data._id } })).status).toBe(200);
    expect((await call(content.getSettings)).body.data).toEqual({ assessment_duration_minutes: 45, members_access_code_id: ok.body.data._id });
  });

  // ── phase 2: results side, on fixture rows ──────────────────────────────
  async function fixtureResult(name: string, pct: number, opts: { level?: string; business?: string[]; at?: string } = {}) {
    const [c] = await prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO psy_candidates (name, email, access_code, batch, has_completed) VALUES ($1, $2, 'TBT1', 'B1', TRUE) RETURNING id`, name, `${name.toLowerCase()}@x.com`);
    const [s] = await prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO psy_sessions (candidate_id, started_at, expires_at, status) VALUES ($1, NOW(), NOW(), 'submitted') RETURNING id`, c.id);
    const [r] = await prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO psy_results (candidate_id, session_id, total_marks, max_score, percentage, level, recommended_business, category_scores, created_at)
       VALUES ($1, $2, $3, 100, $3, $4, $5::jsonb, '{"Leadership": 10}'::jsonb, $6) RETURNING id`,
      c.id, s.id, pct, opts.level ?? 'Good', JSON.stringify(opts.business ?? ['Consulting']), opts.at ?? new Date().toISOString());
    return { candidateId: c.id, resultId: r.id };
  }

  it('candidates list: search, status, batch, stats, delete keeps results', async () => {
    const a = await fixtureResult('Ravi', 80);
    await prisma.$executeRawUnsafe(`INSERT INTO psy_candidates (name, email, batch) VALUES ('Priya', 'p@x.com', 'B2')`);
    const all = await call(results.listCandidates, { query: {} });
    expect(all.body.stats).toEqual({ totalUsers: 2, verifiedUsers: 2, completedUsers: 1, pendingUsers: 0 });
    expect(all.body.batches).toEqual(['B1', 'B2']);
    expect((await call(results.listCandidates, { query: { status: 'not-completed' } })).body.data.map((u: any) => u.name)).toEqual(['Priya']);
    expect((await call(results.listCandidates, { query: { search: 'rav' } })).body.total).toBe(1);
    expect((await call(results.listCandidates, { query: { batch: 'B2' } })).body.data[0].name).toBe('Priya');
    await call(results.deleteCandidate, { params: { id: a.candidateId } });
    const res = await call(results.getResult, { params: { id: a.resultId } });
    expect(res.status).toBe(200);
    expect(res.body.data.userId).toBeNull();
  });

  it('results: filters, search, sort, paging, by candidate, delete', async () => {
    await fixtureResult('Ravi', 90, { level: 'Excellent', business: ['Design Studio'] });
    const b = await fixtureResult('Priya', 60, { level: 'Average', business: ['Consulting'], at: '2026-01-15T10:00:00Z' });
    const all = await call(results.listResults, { query: { sortBy: 'score-asc' } });
    expect(all.body.data.map((r: any) => r.userId.name)).toEqual(['Priya', 'Ravi']);
    expect(all.body.data[0].userId).toMatchObject({ name: 'Priya', sharedCode: 'TBT1' });
    expect((await call(results.listResults, { query: { level: 'Excellent' } })).body.total).toBe(1);
    expect((await call(results.listResults, { query: { business: 'design' } })).body.data[0].userId.name).toBe('Ravi');
    expect((await call(results.listResults, { query: { dateTo: '2026-01-31' } })).body.data[0].userId.name).toBe('Priya');
    expect((await call(results.listResults, { query: { search: 'priya@' } })).body.total).toBe(1);
    const paged = await call(results.listResults, { query: { limit: '1', page: '2' } });
    expect(paged.body).toMatchObject({ total: 2, page: 2, pages: 2 });
    expect((await call(results.resultsByCandidate, { params: { userId: b.candidateId } })).body.total).toBe(1);
    expect((await call(results.deleteResult, { params: { id: b.resultId } })).status).toBe(200);
    expect((await call(results.deleteResult, { params: { id: b.resultId } })).status).toBe(404);
  });

  it('exports: CSV and a real PDF, filtered by ids', async () => {
    const a = await fixtureResult('Ravi', 90);
    await fixtureResult('Priya', 60);
    const csv = await call(results.exportCsv, { query: { ids: a.resultId } });
    expect(csv.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect(String(csv.body).split('\n')).toHaveLength(2);
    expect(String(csv.body)).toContain('"Ravi"');
    const pdf = await call(results.exportPdf, { query: {} });
    expect(pdf.headers['content-type']).toBe('application/pdf');
    expect(Buffer.from(pdf.body).subarray(0, 4).toString()).toBe('%PDF');
  });

  it('dashboard cards and charts', async () => {
    await fixtureResult('Ravi', 90, { business: ['A', 'B'] });
    await fixtureResult('Priya', 60, { business: ['A'] });
    await prisma.$executeRawUnsafe(`INSERT INTO psy_access_codes (code, label) VALUES ('C1', 'x')`);
    const d = await call(results.getDashboard);
    expect(d.body.cards).toMatchObject({ totalUsersRegistered: 2, totalAssessmentsCompleted: 2, totalAssessmentsInProgress: 0, averageScore: 75, highestScore: 90, lowestScore: 60, activeSharedCodes: 1 });
    expect(d.body.pieChart).toEqual({ labels: ['A', 'B'], data: [2, 1] });
    expect(d.body.recentResults).toHaveLength(2);
    expect(d.body.barChart.data.at(-1)).toBe(2);
  });

  it('retest requests: list + counts, detail with history, approve/reject only when pending', async () => {
    const a = await fixtureResult('Ravi', 55);
    const ins = async (status: string) => (await prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO psy_retest_requests (candidate_id, user_name, status, current_result_id) VALUES ($1, 'Ravi', $2, $3) RETURNING id`, a.candidateId, status, a.resultId))[0].id;
    const p1 = await ins('pending');
    const p2 = await ins('pending');
    await ins('used');
    const list = await call(results.listRetestRequests, { query: { status: 'pending' } });
    expect(list.body.total).toBe(2);
    expect(list.body.counts).toEqual({ pending: 2, used: 1 });
    const detail = await call(results.getRetestRequest, { params: { id: p1 } });
    expect(detail.body.data.currentResultId.percentage).toBe(55);
    expect(detail.body.history).toHaveLength(1);
    expect((await call(results.approveRetest, { params: { id: p1 } })).body.message).toMatch(/approved/);
    expect((await call(results.approveRetest, { params: { id: p1 } })).body.message).toBe("Cannot approve a request that is 'approved'.");
    const rej = await call(results.rejectRetest, { params: { id: p2 }, body: { note: 'Too soon' } });
    expect(rej.status).toBe(200);
    const after = await call(results.getRetestRequest, { params: { id: p2 } });
    expect(after.body.data).toMatchObject({ status: 'rejected', rejectionNote: 'Too soon', decidedBy: { _id: ADMIN.id, email: ADMIN.email } });
  });

  it('notifications: list, unread count, mark one / all read, unique per event', async () => {
    const ins = (type: string, entity: string) => prisma.$executeRawUnsafe(
      `INSERT INTO psy_notifications (type, title, message, entity_type, entity_id) VALUES ($1, 't', 'm', 'RESULT', $2) ON CONFLICT DO NOTHING`, type, entity);
    await ins('ASSESSMENT_SUBMITTED', 'r1');
    await ins('ASSESSMENT_SUBMITTED', 'r1');
    await ins('RETEST_REQUEST_CREATED', 'q1');
    const list = await call(results.listNotifications, { query: {} });
    expect(list.body).toMatchObject({ total: 2, unreadCount: 2 });
    const one = await call(results.markNotificationRead, { params: { id: list.body.data[0]._id } });
    expect(one.body.unreadCount).toBe(1);
    expect((await call(results.unreadNotificationCount)).body.unreadCount).toBe(1);
    expect((await call(results.listNotifications, { query: { unread: 'true' } })).body.total).toBe(1);
    await call(results.markAllNotificationsRead);
    expect((await call(results.unreadNotificationCount)).body.unreadCount).toBe(0);
  });

  it('voice: settings defaults + patch, status none/ready/stale, cached preview, delete', async () => {
    const s = await call(voice.getVoiceSettings);
    expect(s.body.config.voiceEn).toBe('en-US-AriaNeural');
    expect(s.body.voices.ta.length).toBeGreaterThan(0);
    expect((await call(voice.updateVoiceSettings, { body: { ratePct: 80 } })).body.config.ratePct).toBe(50);

    const t = await makeType('Leadership', 1);
    const q1 = await makeQuestion(t._id, 1, { explanationAudioText: 'vanakkam', explanationIsTanglish: true });
    const q2 = await makeQuestion(t._id, 2);
    const { createHash } = await import('node:crypto');
    const hash = (x: string) => createHash('sha256').update(x).digest('hex');
    await prisma.$executeRawUnsafe(`INSERT INTO psy_question_audio (question_id, kind, text_hash, voice, lang, audio) VALUES ($1, 'question', $2, 'en-US-AriaNeural', 'en-US', $3)`,
      q1._id, hash('Q1'), Buffer.from([1, 2, 3]));
    await prisma.$executeRawUnsafe(`INSERT INTO psy_question_audio (question_id, kind, text_hash, voice, lang, audio) VALUES ($1, 'question', 'old', 'v', 'en-US', $2)`,
      q2._id, Buffer.from([9]));
    const st = (await call(voice.voiceStatus)).body.data;
    expect(st.map((x: any) => x.status)).toEqual(['ready', 'stale']);
    expect(st[0]).toMatchObject({ hasExplanation: true, explanationStatus: 'none' });
    expect(st[1].explanationStatus).toBeNull();

    const prev = await call(voice.previewQuestionAudio, { params: { id: q1._id } });
    expect(prev.headers['content-type']).toBe('audio/mpeg');
    expect([...prev.body]).toEqual([1, 2, 3]);
    expect((await call(voice.previewExplanationAudio, { params: { id: q1._id } })).status).toBe(404);
    await call(voice.deleteQuestionAudio, { params: { id: q1._id } });
    expect((await call(voice.previewQuestionAudio, { params: { id: q1._id } })).status).toBe(404);
    expect((await call(voice.generateExplanationAudio, { params: { id: q2._id } })).status).toBe(400);
  });

  // ── phase 3: members taking the assessment ──────────────────────────────
  const M1 = '11111111-1111-4111-8111-111111111111';
  const M2 = '22222222-2222-4222-8222-222222222222';

  async function callMember(handler: any, memberId: string, opts: { params?: any; body?: any } = {}) {
    const sent: { status: number; body: any; headers: Record<string, string> } = { status: 200, body: undefined, headers: {} };
    const reply: any = {
      code(c: number) { sent.status = c; return reply; },
      header(k: string, v: string) { sent.headers[k.toLowerCase()] = v; return reply; },
      send(b: any) { sent.body = b; return reply; },
    };
    const req: any = { memberId, ip: '127.0.0.1', headers: { 'user-agent': 'vitest' }, params: opts.params ?? {}, body: opts.body, server: { prisma }, log: { error() {}, info() {} } };
    await handler(req, reply);
    return sent;
  }

  /** Two Likert questions (Leadership) + one ranking question, in a set assigned to the members' code. */
  async function setUpMembersAssessment(duration = 20) {
    await prisma.$executeRawUnsafe(`INSERT INTO members (id, member_id, first_name, last_name, email, phone) VALUES
      ($1::uuid, 'TBT0001', 'Ravi', 'Kumar', 'ravi@tbt.test', '+919800000001'),
      ($2::uuid, 'TBT0002', 'Priya', NULL, 'priya@tbt.test', '+919800000002')`, M1, M2);
    const lead = await makeType('Leadership', 1);
    const comm = await makeType('Communication', 2);
    const q1 = await makeQuestion(lead._id, 1);
    const q2 = await makeQuestion(lead._id, 2);
    const q3 = await makeQuestion(comm._id, 3, { questionType: 'RANKING', dimension: 'Communication', marks: 3,
      options: [{ optionText: 'first', score: 0 }, { optionText: 'second', score: 0 }, { optionText: 'third', score: 0 }] });
    const set = await call(content.createQuestionSet, { body: { name: 'Members', durationMinutes: duration, questionIds: [q3._id, q1._id, q2._id] } });
    const code = await call(content.createAccessCode, { body: { code: 'TBTMEMBERS', label: 'TBT Members', questionSetId: set.body.data._id } });
    await call(content.updateSettings, { body: { members_access_code_id: code.body.data._id } });
    return { q1, q2, q3, codeId: code.body.data._id };
  }

  const fullAnswers = (q1: any, q2: any, q3: any, rankingCorrect = true) => [
    { questionId: q1._id, answerOptionId: q1.options[4]._id, timeTakenSeconds: 5 },
    { questionId: q2._id, answerOptionId: q2.options[2]._id },
    { questionId: q3._id, orderedOptionIds: rankingCorrect ? q3.options.map((o: any) => o._id) : [...q3.options].reverse().map((o: any) => o._id) },
  ];

  it('member flow: unavailable until configured', async () => {
    await prisma.$executeRawUnsafe(`INSERT INTO members (id) VALUES ($1::uuid)`, M1);
    expect((await callMember(member.getQuestions, M1)).body.message).toMatch(/not available/);
    expect((await callMember(member.startSession, M1)).status).toBe(403);
    expect((await callMember(member.getAssessmentSettings, M1)).body.data.assessment_duration_minutes).toBe(30);
    expect((await callMember(member.getResult, M1)).status).toBe(404);
  });

  it('member flow: questions are sectioned in set order without scoring secrets; ranking is shuffled', async () => {
    const { q3 } = await setUpMembersAssessment();
    const r = await callMember(member.getQuestions, M1);
    expect(r.status).toBe(200);
    expect(r.body.remainingSeconds).toBe(20 * 60);
    expect(r.body.data.map((s: any) => s.typeName)).toEqual(['Communication', 'Leadership']);
    const flat = JSON.stringify(r.body.data);
    for (const secret of ['"score"', 'isCorrect', 'correctOptionId', 'idealOrder', 'dimensionScores', 'scoringMode']) expect(flat).not.toContain(secret);
    const rankingOpts = r.body.data[0].questions[0].options.map((o: any) => o._id).sort();
    expect(rankingOpts).toEqual(q3.options.map((o: any) => o._id).sort());
    expect((await callMember(member.getAssessmentSettings, M1)).body.data.assessment_duration_minutes).toBe(20);
    expect(await prisma.$queryRawUnsafe(`SELECT 1 FROM psy_candidates`)).toHaveLength(0); // looking doesn't create a candidate
  });

  it('member flow: start creates the candidate, resumes the live attempt, scores the submission', async () => {
    const { q1, q2, q3, codeId } = await setUpMembersAssessment();
    const start = await callMember(member.startSession, M1);
    expect(start.status).toBe(201);
    expect(start.body.attemptNumber).toBe(1);
    const [cand] = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM psy_candidates`);
    expect(cand).toMatchObject({ member_id: M1, source: 'tbt', name: 'Ravi Kumar', email: 'ravi@tbt.test', candidate_code: 'TBT-M-TBT0001', access_code_id: codeId, access_code: 'TBTMEMBERS' });
    const again = await callMember(member.startSession, M1);
    expect(again.status).toBe(409);
    expect(again.body.sessionId).toBe(start.body.sessionId);

    const sid = start.body.sessionId;
    expect((await callMember(member.submitAssessment, M1, { body: { sessionId: sid, answers: fullAnswers(q1, q2, q3).slice(0, 2) } })).body.message)
      .toBe('All 3 questions must be answered or explicitly timed out.');
    expect((await callMember(member.submitAssessment, M2, { body: { sessionId: sid, answers: fullAnswers(q1, q2, q3) } })).status).toBe(403);

    const sub = await callMember(member.submitAssessment, M1, { body: { sessionId: sid, answers: fullAnswers(q1, q2, q3) } });
    expect(sub.status, JSON.stringify(sub.body)).toBe(200);
    const res = await callMember(member.getResult, M1);
    // Likert 5 + 3 of 10 (Leadership), ranking 3/3 (Communication): 11/13 = 84.6%.
    expect(res.body.data).toMatchObject({ totalMarks: 11, maxScore: 13, percentage: 84.6, level: 'Excellent', categoryScores: { Leadership: 8, Communication: 3 } });
    expect(res.body.data.userId).toMatchObject({ name: 'Ravi Kumar', sharedCode: 'TBTMEMBERS', sharedUserID: { label: 'TBT Members' } });
    expect(res.body.retest).toEqual({ status: 'none', canRequest: true });
    const answers = await prisma.$queryRawUnsafe<any[]>(`SELECT status, score FROM psy_answers ORDER BY question_order`);
    expect(answers.map((a) => [a.status, a.score])).toEqual([['answered', 5], ['answered', 3], ['answered', 3]]);
    expect((await callMember(member.submitAssessment, M1, { body: { sessionId: sid, answers: fullAnswers(q1, q2, q3) } })).body.message).toBe('Session already submitted or expired.');
    const notes = await prisma.$queryRawUnsafe<any[]>(`SELECT type, message FROM psy_notifications`);
    expect(notes).toEqual([{ type: 'ASSESSMENT_SUBMITTED', message: 'Ravi Kumar completed the assessment with a score of 85%.' }]);
  });

  it('member flow: concurrent starts make one session; concurrent submits score once', async () => {
    const { q1, q2, q3 } = await setUpMembersAssessment();
    const starts = await Promise.all([1, 2, 3].map(() => callMember(member.startSession, M1)));
    expect(starts.map((s) => s.status).sort()).toEqual([201, 409, 409]);
    expect(await prisma.$queryRawUnsafe(`SELECT 1 FROM psy_sessions`)).toHaveLength(1);
    expect(await prisma.$queryRawUnsafe(`SELECT 1 FROM psy_candidates`)).toHaveLength(1);
    const sid = starts.find((s) => s.status === 201)!.body.sessionId;
    const subs = await Promise.all([1, 2].map(() => callMember(member.submitAssessment, M1, { body: { sessionId: sid, answers: fullAnswers(q1, q2, q3) } })));
    expect(subs.filter((s) => s.status === 200)).toHaveLength(1);
    expect(await prisma.$queryRawUnsafe(`SELECT 1 FROM psy_results`)).toHaveLength(1);
    expect(await prisma.$queryRawUnsafe(`SELECT 1 FROM psy_answers`)).toHaveLength(3);
  });

  it('member flow: timing — late submits rejected, grace-window submits are auto and may be partial', async () => {
    const { q1, q2, q3 } = await setUpMembersAssessment();
    const sid = (await callMember(member.startSession, M1)).body.sessionId;
    await prisma.$executeRawUnsafe(`UPDATE psy_sessions SET expires_at = NOW() - INTERVAL '30 seconds'`);
    const sub = await callMember(member.submitAssessment, M1, { body: { sessionId: sid, answers: fullAnswers(q1, q2, q3).slice(0, 1) } });
    expect(sub.status).toBe(200);
    const [s] = await prisma.$queryRawUnsafe<any[]>(`SELECT auto_submitted, total_answered FROM psy_sessions`);
    expect(s).toEqual({ auto_submitted: true, total_answered: 1 });
    const [r] = await prisma.$queryRawUnsafe<any[]>(`SELECT skipped_count FROM psy_results`);
    expect(r.skipped_count).toBe(2);

    await prisma.$executeRawUnsafe(`INSERT INTO psy_retest_requests (candidate_id, status) SELECT id, 'approved' FROM psy_candidates`);
    const sid2 = (await callMember(member.startSession, M1)).body.sessionId;
    await prisma.$executeRawUnsafe(`UPDATE psy_sessions SET expires_at = NOW() - INTERVAL '2 minutes' WHERE id = $1`, sid2);
    expect((await callMember(member.submitAssessment, M1, { body: { sessionId: sid2, answers: fullAnswers(q1, q2, q3) } })).body.message).toBe('Assessment time has expired.');
  });

  it('member flow: retest — request, approve, retake as attempt 2, history', async () => {
    const { q1, q2, q3 } = await setUpMembersAssessment();
    expect((await callMember(member.requestRetest, M1, { body: {} })).status).toBe(400);
    const sid = (await callMember(member.startSession, M1)).body.sessionId;
    await callMember(member.submitAssessment, M1, { body: { sessionId: sid, answers: fullAnswers(q1, q2, q3, false) } });
    expect((await callMember(member.startSession, M1)).body.message).toBe('You have already completed this assessment.');

    const req1 = await callMember(member.requestRetest, M1, { body: { reason: 'I rushed it' } });
    expect(req1.body.message).toBe('Retest request sent to the administrator for approval.');
    expect((await callMember(member.requestRetest, M1, { body: {} })).status).toBe(409);
    const mine = await callMember(member.getMyRetest, M1);
    expect(mine.body.data).toMatchObject({ status: 'pending', reason: 'I rushed it', attemptNumber: 2, userName: 'Ravi Kumar' });
    expect(mine.body.retest).toEqual({ status: 'pending', canRequest: false });

    expect((await call(results.approveRetest, { params: { id: mine.body.data._id } })).status).toBe(200);
    const s2 = await callMember(member.startSession, M1);
    expect(s2.status).toBe(201);
    expect(s2.body.attemptNumber).toBe(2);
    expect((await callMember(member.getMyRetest, M1)).body.data.status).toBe('used');
    await callMember(member.submitAssessment, M1, { body: { sessionId: s2.body.sessionId, answers: fullAnswers(q1, q2, q3) } });
    const res = await callMember(member.getResult, M1);
    expect(res.body.attemptNumber).toBe(2);
    expect(res.body.history.map((h: any) => h.attemptNumber)).toEqual([2, 1]);
    expect(res.body.retest.canRequest).toBe(true);
    const notes = await prisma.$queryRawUnsafe<any[]>(`SELECT type FROM psy_notifications ORDER BY created_at`);
    expect(notes.map((n) => n.type)).toEqual(['ASSESSMENT_SUBMITTED', 'RETEST_REQUEST_CREATED', 'ASSESSMENT_SUBMITTED']);
  });

  it('member flow: cached audio with the old cache headers', async () => {
    const { q1 } = await setUpMembersAssessment();
    await prisma.$executeRawUnsafe(`INSERT INTO psy_question_audio (question_id, kind, text_hash, voice, lang, audio) VALUES
      ($1, 'question', 'h1', 'en-US-AriaNeural', 'en-US', $2), ($1, 'explanation', 'h2', 'ta-IN-PallaviNeural', 'ta-IN', $2)`, q1._id, Buffer.from([7, 7]));
    const a = await callMember(member.getQuestionAudio, M1, { params: { id: q1._id } });
    expect(a.headers).toMatchObject({ 'content-type': 'audio/mpeg', 'cache-control': 'private, max-age=86400', etag: '"h1"' });
    const e = await callMember(member.getExplanationAudio, M1, { params: { id: q1._id } });
    expect(e.headers).toMatchObject({ 'cache-control': 'no-store', etag: '"h2-ta-IN-PallaviNeural"' });
    expect((await callMember(member.getQuestionAudio, M1, { params: { id: 'none' } })).status).toBe(404);
  });
});
