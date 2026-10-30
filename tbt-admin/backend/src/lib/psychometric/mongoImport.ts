/**
 * One-time import of the former standalone Psychometric platform (MongoDB) into
 * the psy_* tables (scripts/psychometric-import.ts does the I/O). Everything
 * here is pure: it takes the collections as read (normalised: ObjectId → hex
 * string, Binary → Buffer) and returns the rows to upsert plus every record
 * that can't be carried over. Mongo ids are kept as the row ids, so a re-run
 * updates the same rows instead of duplicating them.
 *
 * First-generation records (before the old platform's multi-type scoring) are
 * converted the way that platform scored them: an answer's `marks` (Likert 1–5)
 * is its score out of 5, under its question's dimension, and a result's maximum
 * is 200 (its percentage was totalMarks / 200).
 *
 * Not carried over: the old admin accounts (TBT admins replace them; their
 * emails are kept on what they created/decided) and candidates' passwords, OTPs
 * and login tokens (standalone candidates don't log in to TBT).
 */

export type Doc = Record<string, any>;
export type Row = Record<string, unknown>;
export type PgType = 'text' | 'int' | 'float8' | 'bool' | 'jsonb' | 'timestamptz' | 'bytea' | 'uuid';

/** Mongo collection (mongoose's pluralised model name) per source model. */
export const MONGO_COLLECTIONS = {
  admins: 'admins',
  questionTypes: 'questiontypes',
  questions: 'questions',
  answerOptions: 'answeroptions',
  questionSets: 'questionsets',
  accessCodes: 'shareduserids',
  settings: 'settings',
  // mongoose's pluraliser turns BusinessMatrixCell into this (its "matrix → matrices" rule isn't end-anchored)
  matrix: 'businessmatricescell',
  questionAudio: 'questionaudios',
  explanationAudio: 'explanationaudios',
  users: 'users',
  sessions: 'assessmentsessions',
  answers: 'useranswers',
  results: 'results',
  retests: 'retestrequests',
  notifications: 'notifications',
} as const;
export type SourceName = keyof typeof MONGO_COLLECTIONS;
export type Snapshot = Record<SourceName, Doc[]>;

/** Fields never read from Mongo (the runner passes these as projections). */
export const MONGO_PROJECTIONS: Partial<Record<SourceName, Record<string, 0 | 1>>> = {
  admins: { email: 1 },
  users: { passwordHash: 0, otpCode: 0, otpExpiry: 0, activeToken: 0 },
};

export interface TableSpec {
  table: string;
  /** Content is admin-authored; `--results-only` re-runs leave it alone. */
  content: boolean;
  /** ON CONFLICT target. */
  key: string[];
  cols: [string, PgType][];
  /** Unique constraints other than the key, checked against the target before writing. */
  unique?: string[][];
}

const TS: [string, PgType][] = [['created_at', 'timestamptz'], ['updated_at', 'timestamptz']];

/** Write order: referenced tables first. */
export const TABLES: TableSpec[] = [
  { table: 'psy_question_types', content: true, key: ['id'], unique: [['name'], ['sort_order']], cols: [
    ['id', 'text'], ['name', 'text'], ['description', 'text'], ['icon', 'text'], ['color', 'text'], ['sort_order', 'int'], ['is_active', 'bool'], ...TS] },
  { table: 'psy_questions', content: true, key: ['id'], unique: [['sort_order']], cols: [
    ['id', 'text'], ['type_id', 'text'], ['text', 'text'], ['sort_order', 'int'], ['is_active', 'bool'], ['question_type', 'text'], ['language', 'text'],
    ['dimension', 'text'], ['sub_dimension', 'text'], ['difficulty', 'text'], ['marks', 'float8'], ['time_limit_seconds', 'int'], ['has_audio', 'bool'],
    ['audio_url', 'text'], ['image_url', 'text'], ['instruction_text', 'text'], ['is_reverse_scored', 'bool'], ['explanation_audio_text', 'text'],
    ['explanation_is_tanglish', 'bool'], ['correct_option_id', 'text'], ['explanation', 'text'], ['ideal_order', 'jsonb'], ['correct_option_ids', 'jsonb'],
    ['scoring_mode', 'text'], ...TS] },
  { table: 'psy_answer_options', content: true, key: ['id'], cols: [
    ['id', 'text'], ['question_id', 'text'], ['option_text', 'text'], ['option_image_url', 'text'], ['score', 'float8'], ['is_correct', 'bool'],
    ['dimension_scores', 'jsonb'], ['sort_order', 'int'], ['created_at', 'timestamptz']] },
  { table: 'psy_question_sets', content: true, key: ['id'], unique: [['name']], cols: [
    ['id', 'text'], ['name', 'text'], ['description', 'text'], ['duration_minutes', 'int'], ['question_ids', 'jsonb'], ['is_active', 'bool'],
    ['created_by', 'text'], ['created_by_email', 'text'], ...TS] },
  { table: 'psy_access_codes', content: true, key: ['id'], unique: [['code']], cols: [
    ['id', 'text'], ['code', 'text'], ['label', 'text'], ['is_active', 'bool'], ['created_by', 'text'], ['created_by_email', 'text'], ['usage_count', 'int'],
    ['question_set_id', 'text'], ...TS] },
  { table: 'psy_settings', content: true, key: ['key'], cols: [['key', 'text'], ['value', 'jsonb'], ...TS] },
  { table: 'psy_business_matrix', content: true, key: ['id'], unique: [['row_type_id', 'col_type_id']], cols: [
    ['id', 'text'], ['row_type_id', 'text'], ['col_type_id', 'text'], ['business_name', 'text'], ['rating', 'int'], ['is_active', 'bool'], ...TS] },
  { table: 'psy_question_audio', content: true, key: ['question_id', 'kind'], cols: [
    ['id', 'text'], ['question_id', 'text'], ['kind', 'text'], ['text_hash', 'text'], ['voice', 'text'], ['lang', 'text'], ['content_type', 'text'],
    ['audio', 'bytea'], ...TS] },
  { table: 'psy_candidates', content: false, key: ['id'], unique: [['candidate_code']], cols: [
    ['id', 'text'], ['member_id', 'uuid'], ['source', 'text'], ['name', 'text'], ['email', 'text'], ['phone', 'text'], ['candidate_code', 'text'],
    ['batch', 'text'], ['access_code_id', 'text'], ['access_code', 'text'], ['has_completed', 'bool'], ['is_verified', 'bool'],
    ['access_expiry', 'timestamptz'], ['restricted_access', 'bool'], ...TS] },
  { table: 'psy_sessions', content: false, key: ['id'], cols: [
    ['id', 'text'], ['candidate_id', 'text'], ['started_at', 'timestamptz'], ['submitted_at', 'timestamptz'], ['expires_at', 'timestamptz'],
    ['status', 'text'], ['auto_submitted', 'bool'], ['attempt_number', 'int'], ['total_answered', 'int'], ['ip_address', 'text'],
    ['question_set_id', 'text'], ['question_ids', 'jsonb'], ['duration_minutes', 'int'], ['created_at', 'timestamptz']] },
  { table: 'psy_answers', content: false, key: ['id'], cols: [
    ['id', 'text'], ['session_id', 'text'], ['candidate_id', 'text'], ['question_id', 'text'], ['answer_option_id', 'text'],
    ['selected_option_ids', 'jsonb'], ['ranking_order', 'jsonb'], ['score', 'float8'], ['max_score', 'float8'], ['is_correct', 'bool'],
    ['dimension', 'text'], ['dimension_scores', 'jsonb'], ['question_order', 'int'], ['answered_at', 'timestamptz'], ['time_taken_seconds', 'float8'],
    ['status', 'text']] },
  { table: 'psy_results', content: false, key: ['id'], unique: [['session_id']], cols: [
    ['id', 'text'], ['candidate_id', 'text'], ['session_id', 'text'], ['attempt_number', 'int'], ['total_marks', 'float8'], ['max_score', 'float8'],
    ['percentage', 'float8'], ['level', 'text'], ['category_scores', 'jsonb'], ['category_percentages', 'jsonb'], ['highest_category', 'jsonb'],
    ['recommended_business', 'jsonb'], ['explanation', 'text'], ['improvement_areas', 'jsonb'], ['dimension_scores', 'jsonb'],
    ['dimension_percentages', 'jsonb'], ['correct_count', 'int'], ['wrong_count', 'int'], ['skipped_count', 'int'],
    ['business_readiness_percent', 'float8'], ['recommendations', 'jsonb'], ['strong_dimensions', 'jsonb'], ['weak_dimensions', 'jsonb'],
    ['aptitude_score', 'float8'], ['personality_score', 'float8'], ['business_mindset_score', 'float8'], ['financial_awareness_score', 'float8'], ...TS] },
  { table: 'psy_retest_requests', content: false, key: ['id'], cols: [
    ['id', 'text'], ['candidate_id', 'text'], ['user_name', 'text'], ['user_email', 'text'], ['shared_code', 'text'], ['question_set_id', 'text'],
    ['attempt_number', 'int'], ['current_result_id', 'text'], ['current_percentage', 'float8'], ['current_level', 'text'], ['status', 'text'],
    ['reason', 'text'], ['rejection_note', 'text'], ['requested_by_user', 'bool'], ['ip_address', 'text'], ['user_agent', 'text'],
    ['decided_by', 'text'], ['decided_by_email', 'text'], ['decided_at', 'timestamptz'], ['used_at', 'timestamptz'], ...TS] },
  { table: 'psy_notifications', content: false, key: ['id'], unique: [['type', 'entity_id']], cols: [
    ['id', 'text'], ['recipient_admin_id', 'text'], ['type', 'text'], ['title', 'text'], ['message', 'text'], ['entity_type', 'text'],
    ['entity_id', 'text'], ['candidate_id', 'text'], ['metadata', 'jsonb'], ['is_read', 'bool'], ['read_at', 'timestamptz'], ...TS] },
];

/** VARCHAR limits of the target columns; a longer value blocks the import rather than being cut. */
const MAX_LEN: Record<string, Record<string, number>> = {
  psy_question_types: { name: 60, description: 300, color: 30 },
  psy_questions: { text: 500, question_type: 30, language: 2, dimension: 60, sub_dimension: 100, difficulty: 10, instruction_text: 500,
    explanation_audio_text: 1000, explanation: 1000, scoring_mode: 10 },
  psy_answer_options: { option_text: 200 },
  psy_question_sets: { name: 100, description: 500 },
  psy_access_codes: { code: 20, label: 100 },
  psy_business_matrix: { business_name: 80 },
  psy_question_audio: { kind: 12 },
  psy_candidates: { source: 20, name: 200 },
  psy_sessions: { status: 20 },
  psy_answers: { dimension: 60, status: 10 },
  psy_results: { level: 30 },
  psy_retest_requests: { status: 10 },
  psy_notifications: { type: 40, entity_type: 20 },
};

export type IssueLevel = 'blocker' | 'warning' | 'info';
export interface Issue { level: IssueLevel; table: string; id: string; message: string }

export interface ImportPlan {
  rows: Record<string, Row[]>;
  issues: Issue[];
  /** Source records left out (orphans), per target table. */
  skipped: Record<string, number>;
}

// ── normalisation of driver values ───────────────────────────────────────────

/** ObjectId → hex, Binary → Buffer, Decimal128/Long → number; recursive. Duck-typed so no bson import is needed. */
export function normalize(v: unknown): unknown {
  if (v === null || v === undefined || typeof v !== 'object') return v;
  if (v instanceof Date || Buffer.isBuffer(v)) return v;
  if (Array.isArray(v)) return v.map(normalize);
  const o = v as any;
  switch (o._bsontype) {
    case 'ObjectId': case 'ObjectID': return o.toHexString();
    case 'Binary': { const u8: Uint8Array = o.buffer; return Buffer.from(u8.subarray(0, o.position ?? u8.length)); }
    case 'Decimal128': case 'Long': case 'Double': case 'Int32': return Number(o.toString());
  }
  const out: Doc = {};
  for (const [k, val] of Object.entries(o)) out[k] = normalize(val);
  return out;
}

/** Creation time encoded in an ObjectId (fallback when a document has no timestamps). */
export function objectIdTime(id: string): Date | null {
  return /^[0-9a-f]{24}$/i.test(id) ? new Date(parseInt(id.slice(0, 8), 16) * 1000) : null;
}

// ── transformation ───────────────────────────────────────────────────────────

const OPTIONAL = Symbol('optional');

export function buildImportPlan(src: Snapshot): ImportPlan {
  const issues: Issue[] = [];
  const skipped: Record<string, number> = {};
  const rows: Record<string, Row[]> = Object.fromEntries(TABLES.map((t) => [t.table, []]));
  const add = (level: IssueLevel, table: string, id: unknown, message: string) => issues.push({ level, table, id: String(id ?? ''), message });
  const skip = (table: string, id: unknown, message: string) => { skipped[table] = (skipped[table] ?? 0) + 1; add('warning', table, id, message); };

  const id = (d: Doc) => String(d._id);
  const s = (v: unknown, def = '') => (v === undefined || v === null ? def : String(v));
  const sOrNull = (v: unknown) => (v === undefined || v === null || v === '' ? null : String(v));
  const b = (v: unknown, def: boolean) => (typeof v === 'boolean' ? v : def);
  const dateOrNull = (v: unknown) => (v instanceof Date && !isNaN(v.getTime()) ? v : null);
  const created = (d: Doc) => dateOrNull(d.createdAt) ?? objectIdTime(id(d)) ?? new Date(0);
  const updated = (d: Doc) => dateOrNull(d.updatedAt) ?? created(d);
  const strArr = (v: unknown) => (Array.isArray(v) ? v.map(String) : null);
  const stripIds = (v: unknown) => (Array.isArray(v) ? v.map((x) => { if (!x || typeof x !== 'object') return x; const { _id, ...rest } = x as Doc; return rest; }) : null);

  /** A number for a NOT NULL / nullable float column; missing required → blocker. */
  const num = (table: string, d: Doc, field: string, def: number | typeof OPTIONAL | undefined = undefined): number | null => {
    const v = d[field];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (def === OPTIONAL) return null;
    if (def !== undefined) return def;
    add('blocker', table, id(d), `missing required number "${field}"`);
    return null;
  };
  /** Same for an INT column; a fractional value is rounded and reported. */
  const int = (table: string, d: Doc, field: string, def: number | typeof OPTIONAL | undefined = undefined): number | null => {
    const n = num(table, d, field, def);
    if (n === null || Number.isInteger(n)) return n;
    add('warning', table, id(d), `"${field}" ${n} rounded to ${Math.round(n)}`);
    return Math.round(n);
  };
  const required = (table: string, d: Doc, field: string, v: unknown) => {
    if (v === null || v === undefined || v === '') add('blocker', table, id(d), `missing required "${field}"`);
  };
  const push = (table: string, row: Row) => {
    for (const [col, max] of Object.entries(MAX_LEN[table] ?? {})) {
      const v = row[col];
      if (typeof v === 'string' && v.length > max) add('blocker', table, String(row.id ?? row.key ?? ''), `"${col}" is ${v.length} characters (limit ${max})`);
    }
    rows[table].push(row);
  };
  const dupCheck = (table: string, list: Doc[], field: string) => {
    const seen = new Map<string, string>();
    for (const d of list) {
      const v = d[field];
      if (v === undefined || v === null || v === '') continue;
      const k = String(v);
      if (seen.has(k)) add('blocker', table, id(d), `duplicate "${field}" ${k} (also ${seen.get(k)})`);
      else seen.set(k, id(d));
    }
  };

  const adminEmail = new Map(src.admins.map((a) => [id(a), sOrNull(a.email)]));
  const emailOf = (table: string, d: Doc, field: string) => {
    const adminId = sOrNull(d[field]);
    if (!adminId) return { adminId: null, email: null };
    const email = adminEmail.get(adminId) ?? null;
    if (!email) add('info', table, id(d), `"${field}" admin ${adminId} no longer exists; kept without an email`);
    return { adminId, email };
  };

  // Question types
  const typeIds = new Set<string>();
  dupCheck('psy_question_types', src.questionTypes, 'name');
  dupCheck('psy_question_types', src.questionTypes, 'order');
  for (const d of src.questionTypes) {
    required('psy_question_types', d, 'name', d.name);
    typeIds.add(id(d));
    push('psy_question_types', {
      id: id(d), name: s(d.name), description: s(d.description), icon: s(d.icon), color: s(d.color, '#2563EB'),
      sort_order: int('psy_question_types', d, 'order'), is_active: b(d.isActive, true), created_at: created(d), updated_at: updated(d),
    });
  }

  // Questions
  const questionIds = new Set<string>();
  dupCheck('psy_questions', src.questions, 'order');
  for (const d of src.questions) {
    const typeId = sOrNull(d.typeId);
    if (!typeId || !typeIds.has(typeId)) { skip('psy_questions', id(d), `question type ${typeId} does not exist; question left out`); continue; }
    required('psy_questions', d, 'text', d.text);
    required('psy_questions', d, 'dimension', d.dimension);
    questionIds.add(id(d));
    push('psy_questions', {
      id: id(d), type_id: typeId, text: s(d.text), sort_order: int('psy_questions', d, 'order'), is_active: b(d.isActive, true),
      question_type: s(d.questionType, 'LIKERT_SCALE'), language: s(d.language, 'en'), dimension: s(d.dimension), sub_dimension: s(d.subDimension),
      difficulty: s(d.difficulty, 'medium'), marks: num('psy_questions', d, 'marks', 5), time_limit_seconds: int('psy_questions', d, 'timeLimitSeconds', OPTIONAL),
      has_audio: b(d.hasAudio, false), audio_url: s(d.audioUrl), image_url: s(d.imageUrl), instruction_text: s(d.instructionText),
      is_reverse_scored: b(d.isReverseScored, false), explanation_audio_text: s(d.explanationAudioText), explanation_is_tanglish: b(d.explanationIsTanglish, false),
      correct_option_id: sOrNull(d.correctOptionId), explanation: s(d.explanation), ideal_order: strArr(d.idealOrder), correct_option_ids: strArr(d.correctOptionIds),
      scoring_mode: sOrNull(d.scoringMode), created_at: created(d), updated_at: updated(d),
    });
  }

  for (const d of src.answerOptions) {
    const qid = sOrNull(d.questionId);
    if (!qid || !questionIds.has(qid)) { skip('psy_answer_options', id(d), `question ${qid} does not exist; option left out`); continue; }
    required('psy_answer_options', d, 'optionText', d.optionText);
    push('psy_answer_options', {
      id: id(d), question_id: qid, option_text: s(d.optionText), option_image_url: s(d.optionImageUrl), score: num('psy_answer_options', d, 'score'),
      is_correct: b(d.isCorrect, false), dimension_scores: d.dimensionScores ?? null, sort_order: int('psy_answer_options', d, 'order'), created_at: created(d),
    });
  }

  // Question sets (missing question ids are kept: the engine only serves ids that exist and are active)
  const setIds = new Set<string>();
  dupCheck('psy_question_sets', src.questionSets, 'name');
  for (const d of src.questionSets) {
    const qids = strArr(d.questionIds) ?? [];
    const missing = qids.filter((q) => !questionIds.has(q)).length;
    if (missing) add('info', 'psy_question_sets', id(d), `${missing} of ${qids.length} question ids no longer exist (ignored at runtime, as before)`);
    const { adminId, email } = emailOf('psy_question_sets', d, 'createdBy');
    setIds.add(id(d));
    push('psy_question_sets', {
      id: id(d), name: s(d.name), description: s(d.description), duration_minutes: int('psy_question_sets', d, 'durationMinutes'), question_ids: qids,
      is_active: b(d.isActive, true), created_by: adminId, created_by_email: email, created_at: created(d), updated_at: updated(d),
    });
  }

  const codeIds = new Set<string>();
  dupCheck('psy_access_codes', src.accessCodes, 'code');
  for (const d of src.accessCodes) {
    let setId = sOrNull(d.questionSetId);
    if (setId && !setIds.has(setId)) { add('warning', 'psy_access_codes', id(d), `question set ${setId} does not exist; code imported without a set`); setId = null; }
    const { adminId, email } = emailOf('psy_access_codes', d, 'createdBy');
    codeIds.add(id(d));
    push('psy_access_codes', {
      id: id(d), code: s(d.code).toUpperCase(), label: s(d.label), is_active: b(d.isActive, true), created_by: adminId, created_by_email: email,
      usage_count: int('psy_access_codes', d, 'usageCount', 0), question_set_id: setId, created_at: created(d), updated_at: updated(d),
    });
  }

  for (const d of src.settings) {
    if (!d.key || d.value === undefined) { skip('psy_settings', id(d), 'setting without a key or value left out'); continue; }
    push('psy_settings', { key: String(d.key), value: d.value, created_at: created(d), updated_at: updated(d) });
  }

  for (const d of src.matrix) {
    const r = sOrNull(d.rowTypeId), c = sOrNull(d.colTypeId);
    if (!r || !c || !typeIds.has(r) || !typeIds.has(c)) { skip('psy_business_matrix', id(d), 'refers to a question type that does not exist; cell left out'); continue; }
    push('psy_business_matrix', {
      id: id(d), row_type_id: r, col_type_id: c, business_name: s(d.businessName), rating: int('psy_business_matrix', d, 'rating', 3),
      is_active: b(d.isActive, true), created_at: created(d), updated_at: updated(d),
    });
  }

  for (const [list, kind] of [[src.questionAudio, 'question'], [src.explanationAudio, 'explanation']] as const) {
    for (const d of list) {
      const qid = sOrNull(d.questionId);
      if (!qid || !questionIds.has(qid)) { skip('psy_question_audio', id(d), `${kind} audio for question ${qid}, which does not exist; left out`); continue; }
      if (!Buffer.isBuffer(d.audio) || !d.audio.length) { skip('psy_question_audio', id(d), `${kind} audio has no data; left out`); continue; }
      push('psy_question_audio', {
        id: id(d), question_id: qid, kind, text_hash: s(d.textHash), voice: s(d.voice), lang: s(d.lang), content_type: s(d.contentType, 'audio/mpeg'),
        audio: d.audio, created_at: created(d), updated_at: updated(d),
      });
    }
  }

  // Candidates (every old user, as a standalone candidate)
  const candidateIds = new Set<string>();
  dupCheck('psy_candidates', src.users, 'candidateId');
  for (const d of src.users) {
    required('psy_candidates', d, 'name', d.name);
    let codeId = sOrNull(d.sharedUserID);
    if (codeId && !codeIds.has(codeId)) { add('info', 'psy_candidates', id(d), `access code ${codeId} no longer exists; candidate kept with its code text only`); codeId = null; }
    candidateIds.add(id(d));
    push('psy_candidates', {
      id: id(d), member_id: null, source: 'standalone', name: s(d.name).trim(), email: sOrNull(d.email), phone: sOrNull(d.phone),
      candidate_code: sOrNull(d.candidateId), batch: sOrNull(d.batch), access_code_id: codeId, access_code: sOrNull(d.sharedCode),
      has_completed: b(d.hasCompletedAssessment, false), is_verified: b(d.isVerified, false), access_expiry: dateOrNull(d.accessExpiry),
      restricted_access: b(d.restrictedAccess, false), created_at: created(d), updated_at: updated(d),
    });
  }

  const sessionIds = new Set<string>();
  for (const d of src.sessions) {
    const cid = sOrNull(d.userId);
    if (!cid || !candidateIds.has(cid)) { skip('psy_sessions', id(d), `candidate ${cid} no longer exists; attempt left out`); continue; }
    const startedAt = dateOrNull(d.startedAt);
    const expiresAt = dateOrNull(d.expiresAt);
    if (!startedAt) add('blocker', 'psy_sessions', id(d), 'missing required "startedAt"');
    if (!expiresAt) add('blocker', 'psy_sessions', id(d), 'missing required "expiresAt"');
    sessionIds.add(id(d));
    push('psy_sessions', {
      id: id(d), candidate_id: cid, started_at: startedAt, submitted_at: dateOrNull(d.submittedAt), expires_at: expiresAt,
      status: s(d.status, 'in-progress'), auto_submitted: b(d.autoSubmitted, false), attempt_number: int('psy_sessions', d, 'attemptNumber', 1),
      total_answered: int('psy_sessions', d, 'totalAnswered', 0), ip_address: sOrNull(d.ipAddress), question_set_id: sOrNull(d.questionSetId),
      question_ids: strArr(d.questionIds) ?? [], duration_minutes: int('psy_sessions', d, 'durationMinutes', OPTIONAL), created_at: created(d),
    });
  }

  const questionDimension = new Map(src.questions.map((q) => [id(q), sOrNull(q.dimension)]));
  for (const raw of src.answers) {
    const sid = sOrNull(raw.sessionId);
    if (!sid || !sessionIds.has(sid)) { skip('psy_answers', id(raw), `attempt ${sid} was not imported; answer left out`); continue; }
    let d = raw;
    if (raw.score === undefined && typeof raw.marks === 'number') {
      const dimension = questionDimension.get(s(raw.questionId)) ?? null;
      d = { ...raw, score: raw.marks, maxScore: 5, dimension };
      add('info', 'psy_answers', id(raw), 'first-generation answer: marks taken as a score out of 5');
    }
    required('psy_answers', d, 'questionId', d.questionId);
    required('psy_answers', d, 'dimension', d.dimension);
    push('psy_answers', {
      id: id(d), session_id: sid, candidate_id: s(d.userId), question_id: s(d.questionId), answer_option_id: sOrNull(d.answerOptionId),
      selected_option_ids: strArr(d.selectedOptionIds), ranking_order: strArr(d.rankingOrder), score: num('psy_answers', d, 'score'),
      max_score: num('psy_answers', d, 'maxScore'), is_correct: typeof d.isCorrect === 'boolean' ? d.isCorrect : null, dimension: s(d.dimension),
      dimension_scores: d.dimensionScores ?? null, question_order: int('psy_answers', d, 'questionOrder'),
      answered_at: dateOrNull(d.answeredAt) ?? objectIdTime(id(d)), time_taken_seconds: num('psy_answers', d, 'timeTakenSeconds', OPTIONAL),
      status: s(d.status, 'answered'),
    });
  }

  // Results are kept even when their candidate is gone (candidate NULL), as on the old platform.
  dupCheck('psy_results', src.results, 'sessionId');
  for (const raw of src.results) {
    let d = raw;
    if (raw.maxScore === undefined && typeof raw.totalMarks === 'number' && typeof raw.percentage === 'number'
      && parseFloat(((raw.totalMarks / 200) * 100).toFixed(1)) === raw.percentage) {
      d = { ...raw, maxScore: 200 };
      add('info', 'psy_results', id(raw), 'first-generation result: maximum score 200, as it was scored');
    }
    let cid = sOrNull(d.userId);
    if (cid && !candidateIds.has(cid)) { add('info', 'psy_results', id(d), `candidate ${cid} no longer exists; result kept without a candidate`); cid = null; }
    required('psy_results', d, 'sessionId', d.sessionId);
    required('psy_results', d, 'level', d.level);
    push('psy_results', {
      id: id(d), candidate_id: cid, session_id: s(d.sessionId), attempt_number: int('psy_results', d, 'attemptNumber', 1),
      total_marks: num('psy_results', d, 'totalMarks'), max_score: num('psy_results', d, 'maxScore'), percentage: num('psy_results', d, 'percentage'),
      level: s(d.level), category_scores: d.categoryScores ?? {}, category_percentages: d.categoryPercentages ?? {},
      highest_category: strArr(d.highestCategory) ?? [], recommended_business: strArr(d.recommendedBusiness) ?? [], explanation: s(d.explanation),
      improvement_areas: stripIds(d.improvementAreas) ?? [], dimension_scores: d.dimensionScores ?? null, dimension_percentages: d.dimensionPercentages ?? null,
      correct_count: int('psy_results', d, 'correctCount', OPTIONAL), wrong_count: int('psy_results', d, 'wrongCount', OPTIONAL),
      skipped_count: int('psy_results', d, 'skippedCount', OPTIONAL), business_readiness_percent: num('psy_results', d, 'businessReadinessPercent', OPTIONAL),
      recommendations: stripIds(d.recommendations), strong_dimensions: strArr(d.strongDimensions), weak_dimensions: strArr(d.weakDimensions),
      aptitude_score: num('psy_results', d, 'aptitudeScore', OPTIONAL), personality_score: num('psy_results', d, 'personalityScore', OPTIONAL),
      business_mindset_score: num('psy_results', d, 'businessMindsetScore', OPTIONAL),
      financial_awareness_score: num('psy_results', d, 'financialAwarenessScore', OPTIONAL), created_at: created(d), updated_at: updated(d),
    });
  }

  for (const d of src.retests) {
    let cid = sOrNull(d.userId);
    if (cid && !candidateIds.has(cid)) { add('info', 'psy_retest_requests', id(d), `candidate ${cid} no longer exists; request kept without a candidate`); cid = null; }
    const { adminId, email } = emailOf('psy_retest_requests', d, 'decidedBy');
    push('psy_retest_requests', {
      id: id(d), candidate_id: cid, user_name: sOrNull(d.userName), user_email: sOrNull(d.userEmail), shared_code: sOrNull(d.sharedCode),
      question_set_id: sOrNull(d.questionSetId), attempt_number: int('psy_retest_requests', d, 'attemptNumber', OPTIONAL),
      current_result_id: sOrNull(d.currentResultId), current_percentage: num('psy_retest_requests', d, 'currentPercentage', OPTIONAL),
      current_level: sOrNull(d.currentLevel), status: s(d.status, 'pending'), reason: sOrNull(d.reason), rejection_note: sOrNull(d.rejectionNote),
      requested_by_user: b(d.requestedByUser, true), ip_address: sOrNull(d.ipAddress), user_agent: sOrNull(d.userAgent), decided_by: adminId,
      decided_by_email: email, decided_at: dateOrNull(d.decidedAt), used_at: dateOrNull(d.usedAt), created_at: created(d), updated_at: updated(d),
    });
  }

  // Old notifications were a shared admin feed; they stay one (no recipient).
  for (const d of src.notifications) {
    required('psy_notifications', d, 'entityId', d.entityId);
    push('psy_notifications', {
      id: id(d), recipient_admin_id: null, type: s(d.type), title: s(d.title), message: s(d.message), entity_type: s(d.entityType),
      entity_id: s(d.entityId), candidate_id: sOrNull(d.userId), metadata: d.metadata ?? {}, is_read: b(d.isRead, false),
      read_at: dateOrNull(d.readAt), created_at: created(d), updated_at: updated(d),
    });
  }

  return { rows, issues, skipped };
}

// ── SQL ──────────────────────────────────────────────────────────────────────

/** A row value as a query parameter for its column type. */
export function param(type: PgType, v: unknown): unknown {
  if (v === undefined || v === null) return null;
  if (type === 'jsonb') return JSON.stringify(v);
  if (type === 'timestamptz') return v instanceof Date ? v.toISOString() : String(v);
  return v;
}

export interface Statement { sql: string; params: unknown[] }

/**
 * Multi-row upserts for one table, `size` rows per statement. `onConflict`:
 * 'update' makes the source the truth for these ids; 'nothing' only adds rows
 * that aren't there yet.
 */
export function upsertStatements(spec: TableSpec, rows: Row[], size = 200, onConflict: 'update' | 'nothing' = 'update'): Statement[] {
  const cols = spec.cols.map(([c]) => c);
  const updatable = spec.cols.filter(([c]) => !spec.key.includes(c) && !(c === 'id' && spec.key[0] !== 'id') && c !== 'created_at');
  const conflict = onConflict === 'nothing' || !updatable.length
    ? `ON CONFLICT (${spec.key.join(', ')}) DO NOTHING`
    : `ON CONFLICT (${spec.key.join(', ')}) DO UPDATE SET ${updatable.map(([c]) => `${c} = EXCLUDED.${c}`).join(', ')}`;
  const out: Statement[] = [];
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size);
    const params: unknown[] = [];
    const tuples = chunk.map((r) => `(${spec.cols.map(([c, t]) => { params.push(param(t, r[c])); return `$${params.length}::${t === 'float8' ? 'double precision' : t}`; }).join(', ')})`);
    out.push({ sql: `INSERT INTO ${spec.table} (${cols.join(', ')}) VALUES ${tuples.join(', ')} ${conflict}`, params });
  }
  return out;
}

/** Identity of a row for its spec's key (settings by key, audio by question+kind). */
export const rowKey = (spec: TableSpec, r: Row) => spec.key.map((k) => String(r[k])).join('|');

/**
 * Unique-constraint clashes between the rows about to be written and rows
 * already in the target that this import does not overwrite (e.g. a question
 * created in TBT holding the same order number). Each one would fail the write.
 */
export function uniqueCollisions(spec: TableSpec, written: Row[], existing: Row[]): Issue[] {
  const writtenKeys = new Set(written.map((r) => rowKey(spec, r)));
  const others = existing.filter((r) => !writtenKeys.has(rowKey(spec, r)));
  const issues: Issue[] = [];
  for (const cols of spec.unique ?? []) {
    const val = (r: Row) => (cols.some((c) => r[c] === null || r[c] === undefined) ? null : cols.map((c) => String(r[c])).join('|'));
    const taken = new Map<string, Row>();
    for (const r of others) { const v = val(r); if (v !== null) taken.set(v, r); }
    for (const r of written) {
      const v = val(r);
      const clash = v === null ? undefined : taken.get(v);
      if (clash) issues.push({ level: 'blocker', table: spec.table, id: rowKey(spec, r), message: `${cols.join('+')} "${v}" is already used by ${rowKey(spec, clash)} in the target` });
    }
  }
  return issues;
}

/** Counts per level and message pattern, for the printed summary (ids stripped so it can be shared). */
export function summarizeIssues(issues: Issue[]) {
  const groups = new Map<string, { level: IssueLevel; table: string; message: string; count: number; ids: string[] }>();
  for (const i of issues) {
    const message = i.message.replace(/\b[0-9a-f]{24}\b/gi, '<id>').replace(/\b\d+(\.\d+)?\b/g, 'N');
    const k = `${i.level}|${i.table}|${message}`;
    const g = groups.get(k) ?? { level: i.level, table: i.table, message, count: 0, ids: [] };
    g.count++;
    if (g.ids.length < 5) g.ids.push(i.id);
    groups.set(k, g);
  }
  const order: IssueLevel[] = ['blocker', 'warning', 'info'];
  return [...groups.values()].sort((a, b) => order.indexOf(a.level) - order.indexOf(b.level) || a.table.localeCompare(b.table));
}
