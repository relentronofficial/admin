import { describe, expect, it } from 'vitest';
import {
  MONGO_COLLECTIONS, TABLES, buildImportPlan, normalize, objectIdTime, summarizeIssues, uniqueCollisions, upsertStatements,
  type Doc, type Snapshot,
} from './mongoImport.js';

// 24-hex ids like Mongo's; the first 8 hex digits are a unix time.
const oid = (n: number) => `65f0000000000000000000${n.toString(16).padStart(2, '0')}`;
const T = new Date('2026-01-02T03:04:05Z');
const spec = (table: string) => TABLES.find((t) => t.table === table)!;

function snapshot(over: Partial<Snapshot> = {}): Snapshot {
  const empty = Object.fromEntries(Object.keys(MONGO_COLLECTIONS).map((k) => [k, []])) as unknown as Snapshot;
  return {
    ...empty,
    admins: [{ _id: oid(1), email: 'owner@example.com' }],
    questionTypes: [{ _id: oid(2), name: 'Leadership', description: 'd', order: 1, createdAt: T, updatedAt: T }],
    questions: [{ _id: oid(3), typeId: oid(2), text: 'Q1', order: 1, dimension: 'Leadership', questionType: 'RANKING', idealOrder: [oid(5), oid(4)], createdAt: T }],
    answerOptions: [
      { _id: oid(4), questionId: oid(3), optionText: 'A', score: 1, order: 1 },
      { _id: oid(5), questionId: oid(3), optionText: 'B', score: 2, order: 2, dimensionScores: { Leadership: 2 } },
    ],
    questionSets: [{ _id: oid(6), name: 'Main', durationMinutes: 30, questionIds: [oid(3), oid(99)], createdBy: oid(1) }],
    accessCodes: [{ _id: oid(7), code: 'tbt2026', label: 'TBT', createdBy: oid(1), questionSetId: oid(6), usageCount: 4 }],
    settings: [{ _id: oid(8), key: 'assessment_duration_minutes', value: 30 }],
    users: [{ _id: oid(10), name: ' Ravi ', email: 'r@example.com', sharedUserID: oid(7), sharedCode: 'TBT2026', hasCompletedAssessment: true, candidateId: 'C-1' }],
    sessions: [{ _id: oid(11), userId: oid(10), startedAt: T, expiresAt: T, status: 'submitted', attemptNumber: 1, questionIds: [oid(3)], durationMinutes: 30 }],
    answers: [{ _id: oid(12), sessionId: oid(11), userId: oid(10), questionId: oid(3), rankingOrder: [oid(5), oid(4)], score: 2, maxScore: 2, dimension: 'Leadership', questionOrder: 1, answeredAt: T }],
    results: [{
      _id: oid(13), userId: oid(10), sessionId: oid(11), totalMarks: 2, maxScore: 2, percentage: 100, level: 'Excellent',
      categoryScores: { Leadership: 2 }, categoryPercentages: { Leadership: 100 }, highestCategory: ['Leadership'], recommendedBusiness: ['Agency'],
      explanation: 'x', improvementAreas: [{ _id: oid(40), category: 'C', score: 1, suggestion: 's' }], recommendations: [{ _id: oid(41), business: 'Agency', explanation: 'e' }],
      createdAt: T, updatedAt: T,
    }],
    retests: [{ _id: oid(14), userId: oid(10), status: 'approved', decidedBy: oid(1), decidedAt: T }],
    notifications: [{ _id: oid(15), type: 'ASSESSMENT_SUBMITTED', title: 't', message: 'm', entityType: 'RESULT', entityId: oid(13), userId: oid(10), metadata: { score: 100 } }],
    ...over,
  };
}

describe('normalize', () => {
  it('turns driver values into plain ones, recursively', () => {
    const objectId = { _bsontype: 'ObjectId', toHexString: () => oid(1) };
    const bin = { _bsontype: 'Binary', buffer: new Uint8Array([1, 2, 3, 0, 0]), position: 3 };
    expect(normalize({ _id: objectId, list: [objectId], nested: { audio: bin, n: { _bsontype: 'Decimal128', toString: () => '1.5' } }, d: T })).toEqual({
      _id: oid(1), list: [oid(1)], nested: { audio: Buffer.from([1, 2, 3]), n: 1.5 }, d: T,
    });
  });

  it('reads the creation time out of an ObjectId', () => {
    expect(objectIdTime('65f000000000000000000000')!.toISOString()).toBe(new Date(0x65f00000 * 1000).toISOString());
    expect(objectIdTime('not-an-id')).toBeNull();
  });
});

describe('buildImportPlan', () => {
  it('maps every collection, keeping ids, and finds nothing wrong in clean data', () => {
    const plan = buildImportPlan(snapshot());
    expect(plan.issues.filter((i) => i.level !== 'info')).toEqual([]);
    const counts = Object.fromEntries(Object.entries(plan.rows).map(([k, v]) => [k, v.length]));
    expect(counts).toMatchObject({ psy_question_types: 1, psy_questions: 1, psy_answer_options: 2, psy_question_sets: 1, psy_access_codes: 1, psy_settings: 1,
      psy_candidates: 1, psy_sessions: 1, psy_answers: 1, psy_results: 1, psy_retest_requests: 1, psy_notifications: 1 });

    const q = plan.rows.psy_questions[0];
    expect(q).toMatchObject({ id: oid(3), type_id: oid(2), sort_order: 1, ideal_order: [oid(5), oid(4)], marks: 5, language: 'en', correct_option_id: null });
    expect(q.created_at).toEqual(T);
    expect(q.updated_at).toEqual(T); // falls back to createdAt

    expect(plan.rows.psy_question_sets[0]).toMatchObject({ question_ids: [oid(3), oid(99)], created_by: oid(1), created_by_email: 'owner@example.com' });
    expect(plan.rows.psy_access_codes[0]).toMatchObject({ code: 'TBT2026', question_set_id: oid(6), usage_count: 4, created_by_email: 'owner@example.com' });
    expect(plan.rows.psy_candidates[0]).toMatchObject({ id: oid(10), member_id: null, source: 'standalone', name: 'Ravi', access_code_id: oid(7), has_completed: true, is_verified: false, candidate_code: 'C-1' });
    expect(plan.rows.psy_answers[0]).toMatchObject({ ranking_order: [oid(5), oid(4)], selected_option_ids: null, answer_option_id: null, is_correct: null });
    const r = plan.rows.psy_results[0];
    expect(r.improvement_areas).toEqual([{ category: 'C', score: 1, suggestion: 's' }]);
    expect(r.recommendations).toEqual([{ business: 'Agency', explanation: 'e' }]);
    expect(r).toMatchObject({ candidate_id: oid(10), correct_count: null, dimension_scores: null });
    expect(plan.rows.psy_retest_requests[0]).toMatchObject({ decided_by: oid(1), decided_by_email: 'owner@example.com' });
    expect(plan.rows.psy_notifications[0]).toMatchObject({ recipient_admin_id: null, entity_id: oid(13), metadata: { score: 100 } });
    // the set's stale question id is reported, not dropped
    expect(plan.issues).toEqual([expect.objectContaining({ level: 'info', table: 'psy_question_sets' })]);
  });

  it('documents without timestamps get their ObjectId time', () => {
    const plan = buildImportPlan(snapshot());
    expect(plan.rows.psy_answer_options[0].created_at).toEqual(objectIdTime(oid(4)));
  });

  it('leaves orphans out and reports them; results and retests outlive their candidate', () => {
    const plan = buildImportPlan(snapshot({
      questions: [...snapshot().questions, { _id: oid(20), typeId: oid(98), text: 'orphan', order: 2, dimension: 'Leadership' }],
      answerOptions: [...snapshot().answerOptions, { _id: oid(21), questionId: oid(20), optionText: 'x', score: 1, order: 1 }],
      sessions: [...snapshot().sessions, { _id: oid(22), userId: oid(97), startedAt: T, expiresAt: T }],
      answers: [...snapshot().answers, { _id: oid(23), sessionId: oid(22), userId: oid(97), questionId: oid(3), score: 1, maxScore: 1, dimension: 'L', questionOrder: 1 }],
      results: [...snapshot().results, { ...snapshot().results[0], _id: oid(24), userId: oid(97), sessionId: oid(22) }],
      questionAudio: [{ _id: oid(25), questionId: oid(20), audio: Buffer.from([1]), textHash: 'h', voice: 'v', lang: 'en' }],
    }));
    expect(plan.skipped).toEqual({ psy_questions: 1, psy_answer_options: 1, psy_sessions: 1, psy_answers: 1, psy_question_audio: 1 });
    expect(plan.rows.psy_results.find((r) => r.id === oid(24))).toMatchObject({ candidate_id: null, session_id: oid(22) });
  });

  it('blocks on values the target would reject, and on duplicates; rounds fractional ints with a warning', () => {
    const plan = buildImportPlan(snapshot({
      questionTypes: [...snapshot().questionTypes, { _id: oid(30), name: 'Leadership', description: 'dup', order: 2 }],
      users: [{ ...snapshot().users[0], name: 'x'.repeat(201) }],
      questionSets: [{ ...snapshot().questionSets[0], durationMinutes: 12.5 }],
      results: [{ ...snapshot().results[0], percentage: undefined }],
    }));
    const msgs = plan.issues.map((i) => `${i.level} ${i.table} ${i.message}`);
    expect(msgs).toContain(`blocker psy_question_types duplicate "name" Leadership (also ${oid(2)})`);
    expect(msgs).toContain('blocker psy_candidates "name" is 201 characters (limit 200)');
    expect(msgs).toContain('blocker psy_results missing required number "percentage"');
    expect(msgs).toContain('warning psy_question_sets "durationMinutes" 12.5 rounded to 13');
  });

  it('converts first-generation answers and results the way they were scored', () => {
    const plan = buildImportPlan(snapshot({
      answers: [{ _id: oid(50), sessionId: oid(11), userId: oid(10), questionId: oid(3), answerOptionId: oid(4), marks: 4, questionOrder: 1, answeredAt: T }],
      results: [
        { _id: oid(51), userId: oid(10), sessionId: oid(11), totalMarks: 137, percentage: 68.5, level: 'Good', categoryScores: {}, categoryPercentages: {}, highestCategory: [], recommendedBusiness: [], explanation: '' },
        { _id: oid(52), userId: oid(10), sessionId: oid(53), totalMarks: 137, percentage: 50, level: 'Good', categoryScores: {}, categoryPercentages: {}, highestCategory: [], recommendedBusiness: [], explanation: '' },
      ],
    }));
    expect(plan.rows.psy_answers[0]).toMatchObject({ score: 4, max_score: 5, dimension: 'Leadership', answer_option_id: oid(4), status: 'answered' });
    expect(plan.rows.psy_results.map((r) => r.max_score)).toEqual([200, null]);
    // a result that doesn't fit the original formula is not guessed at
    expect(plan.issues.filter((i) => i.level === 'blocker')).toEqual([
      { level: 'blocker', table: 'psy_results', id: oid(52), message: 'missing required number "maxScore"' },
    ]);
  });

  it('a deleted admin or access code is reported, never fatal', () => {
    const plan = buildImportPlan(snapshot({ admins: [], accessCodes: [] }));
    expect(plan.rows.psy_question_sets[0]).toMatchObject({ created_by: oid(1), created_by_email: null });
    expect(plan.rows.psy_candidates[0]).toMatchObject({ access_code_id: null, access_code: 'TBT2026' });
    expect(plan.issues.every((i) => i.level === 'info')).toBe(true);
  });

  it('question and explanation audio become one table, keyed by question + kind', () => {
    const plan = buildImportPlan(snapshot({
      questionAudio: [{ _id: oid(31), questionId: oid(3), textHash: 'h1', voice: 'en-US-AriaNeural', lang: 'en-US', audio: Buffer.from([1, 2]) }],
      explanationAudio: [{ _id: oid(32), questionId: oid(3), textHash: 'h2', voice: 'ta-IN-PallaviNeural', lang: 'ta-IN', audio: Buffer.from([3]) }],
    }));
    expect(plan.rows.psy_question_audio.map((r) => [r.question_id, r.kind, r.content_type])).toEqual([[oid(3), 'question', 'audio/mpeg'], [oid(3), 'explanation', 'audio/mpeg']]);
  });
});

describe('SQL', () => {
  it('chunked multi-row upserts with typed parameters', () => {
    const rows = buildImportPlan(snapshot()).rows.psy_answer_options;
    const [one, two] = upsertStatements(spec('psy_answer_options'), rows, 1);
    expect(one.sql).toMatch(/^INSERT INTO psy_answer_options \(id, question_id, option_text, .*\) VALUES \(\$1::text, \$2::text, \$3::text, \$4::text, \$5::double precision, \$6::bool, \$7::jsonb, \$8::int, \$9::timestamptz\) ON CONFLICT \(id\) DO UPDATE SET question_id = EXCLUDED.question_id/);
    expect(one.sql).not.toMatch(/created_at = EXCLUDED/);
    expect(two.params[6]).toBe('{"Leadership":2}');
    expect(typeof two.params[8]).toBe('string');
    expect(upsertStatements(spec('psy_answer_options'), rows).length).toBe(1);
    expect(upsertStatements(spec('psy_answer_options'), rows, 200, 'nothing')[0].sql).toMatch(/ON CONFLICT \(id\) DO NOTHING$/);
  });

  it('audio upserts on (question_id, kind) and keeps the existing row id', () => {
    const [s] = upsertStatements(spec('psy_question_audio'), [{ id: 'a', question_id: 'q', kind: 'question', text_hash: 'h', voice: 'v', lang: 'l', content_type: 'c', audio: Buffer.from([1]), created_at: T, updated_at: T }]);
    expect(s.sql).toMatch(/ON CONFLICT \(question_id, kind\) DO UPDATE SET text_hash = EXCLUDED.text_hash/);
    expect(s.sql).not.toMatch(/ id = EXCLUDED/);
    expect(Buffer.isBuffer(s.params[7])).toBe(true);
  });

  it('settings upsert by key', () => {
    const [s] = upsertStatements(spec('psy_settings'), buildImportPlan(snapshot()).rows.psy_settings);
    expect(s.sql).toMatch(/ON CONFLICT \(key\) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at$/);
    expect(s.params[1]).toBe('30');
  });

  it('every table spec matches a column list with no duplicates', () => {
    for (const t of TABLES) {
      const cols = t.cols.map(([c]) => c);
      expect(new Set(cols).size).toBe(cols.length);
      for (const k of [...t.key, ...(t.unique ?? []).flat()]) expect(cols).toContain(k);
    }
  });
});

describe('uniqueCollisions', () => {
  const qs = spec('psy_questions');
  it('only rows the import does not overwrite can clash', () => {
    const written = [{ id: 'm1', sort_order: 1 }, { id: 'm2', sort_order: 2 }];
    // m1/m2 already there with swapped orders: overwritten, no clash. t1 is a TBT-made question on order 2: clash.
    const existing = [{ id: 'm1', sort_order: 2 }, { id: 'm2', sort_order: 1 }, { id: 't1', sort_order: 3 }];
    expect(uniqueCollisions(qs, written, existing)).toEqual([]);
    expect(uniqueCollisions(qs, written, [...existing, { id: 't2', sort_order: 2 }])).toEqual([
      { level: 'blocker', table: 'psy_questions', id: 'm2', message: 'sort_order "2" is already used by t2 in the target' },
    ]);
  });

  it('NULLs never clash (partial unique indexes)', () => {
    const c = spec('psy_candidates');
    expect(uniqueCollisions(c, [{ id: 'a', candidate_code: null }], [{ id: 'b', candidate_code: null }])).toEqual([]);
  });
});

describe('summarizeIssues', () => {
  it('groups by message with ids and numbers masked, blockers first', () => {
    const g = summarizeIssues([
      { level: 'info', table: 'psy_results', id: '1', message: `candidate ${oid(1)} no longer exists` },
      { level: 'info', table: 'psy_results', id: '2', message: `candidate ${oid(2)} no longer exists` },
      { level: 'blocker', table: 'psy_candidates', id: '3', message: '"name" is 201 characters (limit 200)' },
    ] as Doc[] as never);
    expect(g.map((x) => [x.level, x.message, x.count])).toEqual([
      ['blocker', '"name" is N characters (limit N)', 1],
      ['info', 'candidate <id> no longer exists', 2],
    ]);
  });
});
