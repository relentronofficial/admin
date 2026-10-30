import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  dedupeIds,
  deriveAnswerKey,
  sampleMatrixCell,
  validateAccessCodeBody,
  validateMatrixCellBody,
  validateQuestionBody,
  validateQuestionSetBody,
  validateQuestionTypeBody,
  type OptionInput,
} from '../../lib/psychometric/contentRules.js';
import { accessCodeOut, matrixCellOut, optionOut, questionOut, questionSetOut, questionTypeOut } from '../../lib/psychometric/rows.js';
import { actingAdmin, fail, isUniqueViolation, jsonParam, pgCode, rows, type Db } from './db.js';

// Psychometric content admin (access codes, question types, questions + answer
// options, question sets, business matrix, settings). Ported from the standalone
// platform's adminCRUD / adminQuestionSets / adminBusinessMatrix controllers;
// request/response shapes are unchanged so the ported admin pages work as-is.

// Bodies are validated by hand (same messages as the old express-validator rules).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Body = Record<string, any>;
type Req = FastifyRequest<{ Params: { id: string }; Querystring: Record<string, string | undefined>; Body: Body }>;
const db = (req: FastifyRequest): Db => req.server.prisma as unknown as Db;

// ── Access codes (Mongo: SharedUserID) ─────────────────────────────────────

const ACCESS_CODE_SELECT = `
  SELECT c.*, s.name AS set_name, s.duration_minutes AS set_duration
  FROM psy_access_codes c LEFT JOIN psy_question_sets s ON s.id = c.question_set_id`;

async function questionSetExists(d: Db, id: unknown) {
  if (id === undefined || id === null || id === '') return true;
  return (await rows(d, `SELECT 1 FROM psy_question_sets WHERE id = $1`, String(id))).length > 0;
}

export async function listAccessCodes(req: Req, reply: FastifyReply) {
  const search = req.query.search?.trim();
  const data = search
    ? await rows(db(req), `${ACCESS_CODE_SELECT} WHERE c.code ILIKE $1 OR c.label ILIKE $1 ORDER BY c.created_at DESC`, `%${search.replace(/[%_\\]/g, '\\$&')}%`)
    : await rows(db(req), `${ACCESS_CODE_SELECT} ORDER BY c.created_at DESC`);
  return reply.send({ success: true, data: data.map((r) => accessCodeOut(r, { populate: true })), total: data.length });
}

export async function createAccessCode(req: Req, reply: FastifyReply) {
  const err = validateAccessCodeBody(req.body);
  if (err) return fail(reply, 400, err);
  const code = String(req.body.code).toUpperCase();
  const d = db(req);
  if ((await rows(d, `SELECT 1 FROM psy_access_codes WHERE code = $1`, code)).length) return fail(reply, 409, 'Code already exists.');
  if (!(await questionSetExists(d, req.body.questionSetId))) return fail(reply, 400, 'Assigned question set does not exist.');
  const admin = actingAdmin(req);
  const [row] = await rows(d,
    `INSERT INTO psy_access_codes (code, label, created_by, created_by_email, question_set_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    code, String(req.body.label).trim(), admin.id, admin.email, req.body.questionSetId || null);
  return reply.code(201).send({ success: true, data: accessCodeOut(row) });
}

export async function updateAccessCode(req: Req, reply: FastifyReply) {
  const b = req.body ?? {};
  const d = db(req);
  if (!(await questionSetExists(d, b.questionSetId))) return fail(reply, 400, 'Assigned question set does not exist.');
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (b.label !== undefined) { vals.push(String(b.label).trim()); sets.push(`label = $${vals.length}`); }
  if (b.isActive !== undefined) { vals.push(!!b.isActive); sets.push(`is_active = $${vals.length}`); }
  if (b.questionSetId !== undefined) { vals.push(b.questionSetId || null); sets.push(`question_set_id = $${vals.length}`); }
  vals.push(req.params.id);
  const [row] = await rows(d,
    `UPDATE psy_access_codes SET ${[...sets, 'updated_at = NOW()'].join(', ')} WHERE id = $${vals.length} RETURNING *`, ...vals);
  if (!row) return fail(reply, 404, 'Not found.');
  return reply.send({ success: true, data: accessCodeOut(row) });
}

export async function deleteAccessCode(req: Req, reply: FastifyReply) {
  await rows(db(req), `UPDATE psy_access_codes SET is_active = FALSE, updated_at = NOW() WHERE id = $1 RETURNING id`, req.params.id);
  return reply.send({ success: true });
}

export async function accessCodeStats(req: Req, reply: FastifyReply) {
  const d = db(req);
  const [code] = await rows(d, `SELECT usage_count FROM psy_access_codes WHERE id = $1`, req.params.id);
  if (!code) return fail(reply, 404, 'Not found.');
  const users = await rows(d, `SELECT id, name, email, created_at FROM psy_candidates WHERE access_code_id = $1 ORDER BY created_at`, req.params.id);
  return reply.send({
    success: true,
    usageCount: code.usage_count,
    users: users.map((u) => ({ _id: u.id, name: u.name, email: u.email, createdAt: u.created_at })),
  });
}

// ── Question types ─────────────────────────────────────────────────────────

export async function listQuestionTypes(req: Req, reply: FastifyReply) {
  const data = await rows(db(req), `SELECT * FROM psy_question_types ORDER BY sort_order`);
  return reply.send({ success: true, data: data.map(questionTypeOut) });
}

export async function createQuestionType(req: Req, reply: FastifyReply) {
  const err = validateQuestionTypeBody(req.body);
  if (err) return fail(reply, 400, err);
  const b = req.body;
  try {
    const [row] = await rows(db(req),
      `INSERT INTO psy_question_types (name, description, icon, color, sort_order, is_active)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      String(b.name).trim(), String(b.description), b.icon ?? '', b.color ?? '#2563EB', Number(b.order), b.isActive ?? true);
    return reply.code(201).send({ success: true, data: questionTypeOut(row) });
  } catch (e) {
    if (isUniqueViolation(e)) return fail(reply, 409, 'That name or display order is already in use.');
    throw e;
  }
}

export async function updateQuestionType(req: Req, reply: FastifyReply) {
  const b = req.body ?? {};
  const id = req.params.id;
  try {
    const row = await (req.server.prisma as any).$transaction(async (tx: Db) => {
      const [current] = await rows(tx, `SELECT * FROM psy_question_types WHERE id = $1 FOR UPDATE`, id);
      if (!current) return null;
      if (b.order !== undefined && Number(b.order) !== current.sort_order) {
        const [clash] = await rows(tx, `SELECT id FROM psy_question_types WHERE sort_order = $1 AND id <> $2`, Number(b.order), id);
        if (clash) {
          // Swap via an out-of-range sentinel so the unique order is never violated mid-swap.
          await tx.$executeRawUnsafe(`UPDATE psy_question_types SET sort_order = 0 WHERE id = $1`, clash.id);
          await tx.$executeRawUnsafe(`UPDATE psy_question_types SET sort_order = $1 WHERE id = $2`, Number(b.order), id);
          await tx.$executeRawUnsafe(`UPDATE psy_question_types SET sort_order = $1 WHERE id = $2`, current.sort_order, clash.id);
        }
      }
      const sets: string[] = [];
      const vals: unknown[] = [];
      const add = (col: string, v: unknown) => { vals.push(v); sets.push(`${col} = $${vals.length}`); };
      if (b.name !== undefined) add('name', String(b.name).trim());
      if (b.description !== undefined) add('description', String(b.description));
      if (b.icon !== undefined) add('icon', String(b.icon));
      if (b.color !== undefined) add('color', String(b.color));
      if (b.order !== undefined) add('sort_order', Number(b.order));
      if (b.isActive !== undefined) add('is_active', !!b.isActive);
      vals.push(id);
      const [updated] = await rows(tx,
        `UPDATE psy_question_types SET ${[...sets, 'updated_at = NOW()'].join(', ')} WHERE id = $${vals.length} RETURNING *`, ...vals);
      return updated;
    });
    if (!row) return fail(reply, 404, 'Not found.');
    return reply.send({ success: true, data: questionTypeOut(row) });
  } catch (e) {
    if (isUniqueViolation(e)) return fail(reply, 409, 'That name or display order is already in use.');
    throw e;
  }
}

export async function deleteQuestionType(req: Req, reply: FastifyReply) {
  const d = db(req);
  await d.$executeRawUnsafe(`UPDATE psy_questions SET is_active = FALSE, updated_at = NOW() WHERE type_id = $1 AND is_active`, req.params.id);
  await d.$executeRawUnsafe(`UPDATE psy_question_types SET is_active = FALSE, updated_at = NOW() WHERE id = $1`, req.params.id);
  return reply.send({ success: true });
}

// ── Questions + answer options ─────────────────────────────────────────────

// Every question column except audio_url (it can hold a multi-MB data URI;
// lists never ship it — the edit view loads it via GET /questions/:id).
const Q_COLS = `q.id, q.type_id, q.text, q.sort_order, q.is_active, q.question_type, q.language, q.dimension,
  q.sub_dimension, q.difficulty, q.marks, q.time_limit_seconds, q.has_audio, q.image_url, q.instruction_text,
  q.is_reverse_scored, q.explanation_audio_text, q.explanation_is_tanglish, q.correct_option_id, q.explanation,
  q.ideal_order, q.correct_option_ids, q.scoring_mode, q.created_at, q.updated_at`;

export async function listQuestions(req: Req, reply: FastifyReply) {
  const typeId = req.query.typeId;
  const sql = `SELECT ${Q_COLS}, t.name AS type_name, t.color AS type_color
    FROM psy_questions q LEFT JOIN psy_question_types t ON t.id = q.type_id
    ${typeId ? 'WHERE q.type_id = $1' : ''} ORDER BY q.sort_order`;
  const data = typeId ? await rows(db(req), sql, typeId) : await rows(db(req), sql);
  return reply.send({
    success: true,
    data: data.map((r) => questionOut(r, { typeRef: r.type_id ? { _id: r.type_id, name: r.type_name, color: r.type_color } : null })),
  });
}

async function loadOptions(d: Db, questionId: string) {
  return (await rows(d, `SELECT * FROM psy_answer_options WHERE question_id = $1 ORDER BY sort_order`, questionId)).map(optionOut);
}

export async function getQuestion(req: Req, reply: FastifyReply) {
  const d = db(req);
  const [q] = await rows(d,
    `SELECT q.*, t.name AS type_name FROM psy_questions q LEFT JOIN psy_question_types t ON t.id = q.type_id WHERE q.id = $1`, req.params.id);
  if (!q) return fail(reply, 404, 'Not found.');
  const options = await loadOptions(d, q.id);
  return reply.send({
    success: true,
    data: { ...questionOut(q, { withAudio: true, typeRef: q.type_id ? { _id: q.type_id, name: q.type_name } : null }), options },
  });
}

/** Question columns a create/update may set (the answer key is derived, never accepted). */
function questionColumns(b: any) {
  const map: [string, string, (v: any) => unknown][] = [
    ['typeId', 'type_id', String],
    ['text', 'text', String],
    ['order', 'sort_order', Number],
    ['isActive', 'is_active', Boolean],
    ['questionType', 'question_type', String],
    ['language', 'language', (v) => v || 'en'],
    ['dimension', 'dimension', String],
    ['subDimension', 'sub_dimension', (v) => String(v ?? '')],
    ['difficulty', 'difficulty', (v) => v || 'medium'],
    ['marks', 'marks', Number],
    ['timeLimitSeconds', 'time_limit_seconds', (v) => (v === null || v === '' ? null : Number(v))],
    ['hasAudio', 'has_audio', Boolean],
    ['audioUrl', 'audio_url', (v) => String(v ?? '')],
    ['imageUrl', 'image_url', (v) => String(v ?? '')],
    ['instructionText', 'instruction_text', (v) => String(v ?? '')],
    ['isReverseScored', 'is_reverse_scored', Boolean],
    ['explanationAudioText', 'explanation_audio_text', (v) => String(v ?? '')],
    ['explanationIsTanglish', 'explanation_is_tanglish', Boolean],
    ['explanation', 'explanation', (v) => String(v ?? '')],
    ['scoringMode', 'scoring_mode', (v) => (v ? String(v) : null)],
  ];
  return map.filter(([k]) => b[k] !== undefined).map(([k, col, conv]) => [col, conv(b[k])] as [string, unknown]);
}

/** Diffs incoming options against the saved ones: update known ids, insert the rest, delete the missing. */
async function upsertOptions(tx: Db, questionId: string, incoming: OptionInput[]) {
  const existing = new Set((await rows(tx, `SELECT id FROM psy_answer_options WHERE question_id = $1`, questionId)).map((r) => r.id));
  const keep = new Set<string>();
  for (const [i, o] of incoming.entries()) {
    const vals = [String(o.optionText ?? ''), String(o.optionImageUrl ?? ''), Number(o.score), !!o.isCorrect, jsonParam(o.dimensionScores), Number(o.order ?? i + 1)];
    if (o._id && existing.has(o._id)) {
      await tx.$executeRawUnsafe(
        `UPDATE psy_answer_options SET option_text = $1, option_image_url = $2, score = $3, is_correct = $4, dimension_scores = $5::jsonb, sort_order = $6
         WHERE id = $7`, ...vals, o._id);
      keep.add(o._id);
    } else {
      const [r] = await rows(tx,
        `INSERT INTO psy_answer_options (option_text, option_image_url, score, is_correct, dimension_scores, sort_order, question_id)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7) RETURNING id`, ...vals, questionId);
      keep.add(r.id);
    }
  }
  const remove = [...existing].filter((id) => !keep.has(id));
  if (remove.length) await tx.$executeRawUnsafe(`DELETE FROM psy_answer_options WHERE id = ANY($1::text[])`, remove);
  return loadOptions(tx, questionId);
}

async function saveQuestion(req: Req, reply: FastifyReply, mode: 'create' | 'update') {
  const err = validateQuestionBody(req.body);
  if (err) return fail(reply, 400, err);
  const b = req.body;
  try {
    const result = await (req.server.prisma as any).$transaction(async (tx: Db) => {
      const cols = questionColumns(b);
      let q: any;
      if (mode === 'create') {
        const names = cols.map(([c]) => c);
        const [row] = await rows(tx,
          `INSERT INTO psy_questions (${names.join(', ')}) VALUES (${names.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`,
          ...cols.map(([, v]) => v));
        q = row;
      } else {
        const [row] = await rows(tx,
          `UPDATE psy_questions SET ${cols.map(([c], i) => `${c} = $${i + 1}`).join(', ')}, updated_at = NOW()
           WHERE id = $${cols.length + 1} RETURNING id`, ...cols.map(([, v]) => v), req.params.id);
        if (!row) return null;
        q = row;
      }
      const options = await upsertOptions(tx, q.id, b.options);
      const key = deriveAnswerKey(String(b.questionType), options);
      const [saved] = await rows(tx,
        `UPDATE psy_questions SET correct_option_id = $1, correct_option_ids = $2::jsonb, ideal_order = $3::jsonb WHERE id = $4 RETURNING *`,
        key.correctOptionId, jsonParam(key.correctOptionIds), jsonParam(key.idealOrder), q.id);
      return { ...questionOut(saved, { withAudio: true }), options };
    });
    if (!result) return fail(reply, 404, 'Not found.');
    return reply.code(mode === 'create' ? 201 : 200).send({ success: true, data: result });
  } catch (e) {
    if (isUniqueViolation(e)) return fail(reply, 409, 'That display order is already in use.');
    if (pgCode(e) === '23503') return fail(reply, 400, 'Category does not exist.');
    throw e;
  }
}

export const createQuestion = (req: Req, reply: FastifyReply) => saveQuestion(req, reply, 'create');
export const updateQuestion = (req: Req, reply: FastifyReply) => saveQuestion(req, reply, 'update');

// Two passes so the unique order is never violated: park every affected
// question at a high temporary order, then assign the targets.
const REORDER_TEMP_BASE = 1_000_000_000;
export async function reorderQuestions(req: Req, reply: FastifyReply) {
  const orders: { id: string; order: number }[] = req.body?.orders;
  if (!Array.isArray(orders) || orders.length < 1) return fail(reply, 400, 'orders must be a non-empty array.');
  const data = await (req.server.prisma as any).$transaction(async (tx: Db) => {
    for (const [i, o] of orders.entries()) await tx.$executeRawUnsafe(`UPDATE psy_questions SET sort_order = $1 WHERE id = $2`, REORDER_TEMP_BASE + i, String(o.id));
    for (const o of orders) await tx.$executeRawUnsafe(`UPDATE psy_questions SET sort_order = $1, updated_at = NOW() WHERE id = $2`, Number(o.order), String(o.id));
    return rows(tx, `SELECT ${Q_COLS} FROM psy_questions q WHERE q.id = ANY($1::text[]) ORDER BY q.sort_order`, orders.map((o) => String(o.id)));
  });
  return reply.send({ success: true, data: data.map((r: any) => questionOut(r)) });
}

export async function deleteQuestion(req: Req, reply: FastifyReply) {
  await (req.server.prisma as any).$transaction(async (tx: Db) => {
    // The order is globally unique, so a soft-deleted question vacates its slot
    // with the next free negative sentinel (never collides, sorts first).
    await tx.$executeRawUnsafe(
      `UPDATE psy_questions SET is_active = FALSE, updated_at = NOW(),
         sort_order = (SELECT LEAST(COALESCE(MIN(sort_order), 0), 0) - 1 FROM psy_questions)
       WHERE id = $1 AND sort_order > 0`, req.params.id);
    await tx.$executeRawUnsafe(`UPDATE psy_answer_options SET sort_order = 0 WHERE question_id = $1`, req.params.id);
  });
  return reply.send({ success: true });
}

export async function listAnswerOptions(req: Req, reply: FastifyReply) {
  if (!req.query.questionId) return fail(reply, 400, 'Invalid value');
  return reply.send({ success: true, data: await loadOptions(db(req), req.query.questionId) });
}

export async function createAnswerOption(req: Req, reply: FastifyReply) {
  const b = req.body ?? {};
  if (!b.questionId) return fail(reply, 400, 'Question is required.');
  if (!b.optionText) return fail(reply, 400, 'Option text is required.');
  if (!Number.isFinite(Number(b.score))) return fail(reply, 400, 'Score must be a number.');
  if (!(Number.isInteger(Number(b.order)) && Number(b.order) >= 1)) return fail(reply, 400, 'Order must be a positive number.');
  const [row] = await rows(db(req),
    `INSERT INTO psy_answer_options (question_id, option_text, option_image_url, score, is_correct, dimension_scores, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7) RETURNING *`,
    String(b.questionId), String(b.optionText), String(b.optionImageUrl ?? ''), Number(b.score), !!b.isCorrect, jsonParam(b.dimensionScores), Number(b.order));
  return reply.code(201).send({ success: true, data: optionOut(row) });
}

export async function updateAnswerOption(req: Req, reply: FastifyReply) {
  const b = req.body ?? {};
  const sets: string[] = [];
  const vals: unknown[] = [];
  const add = (col: string, v: unknown, cast = '') => { vals.push(v); sets.push(`${col} = $${vals.length}${cast}`); };
  if (b.optionText !== undefined) add('option_text', String(b.optionText));
  if (b.optionImageUrl !== undefined) add('option_image_url', String(b.optionImageUrl));
  if (b.score !== undefined) add('score', Number(b.score));
  if (b.isCorrect !== undefined) add('is_correct', !!b.isCorrect);
  if (b.dimensionScores !== undefined) add('dimension_scores', jsonParam(b.dimensionScores), '::jsonb');
  if (b.order !== undefined) add('sort_order', Number(b.order));
  if (!sets.length) {
    const [row] = await rows(db(req), `SELECT * FROM psy_answer_options WHERE id = $1`, req.params.id);
    return row ? reply.send({ success: true, data: optionOut(row) }) : fail(reply, 404, 'Not found.');
  }
  vals.push(req.params.id);
  const [row] = await rows(db(req), `UPDATE psy_answer_options SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING *`, ...vals);
  if (!row) return fail(reply, 404, 'Not found.');
  return reply.send({ success: true, data: optionOut(row) });
}

export async function deleteAnswerOption(req: Req, reply: FastifyReply) {
  const d = db(req);
  if (!(await rows(d, `SELECT 1 FROM psy_answer_options WHERE id = $1`, req.params.id)).length) return fail(reply, 404, 'Not found.');
  // Same (deliberately broad) guard as the standalone platform.
  if ((await rows(d, `SELECT 1 FROM psy_sessions WHERE status IN ('in-progress', 'submitted') LIMIT 1`)).length) {
    return fail(reply, 400, 'Cannot delete: options have been used in sessions.');
  }
  await d.$executeRawUnsafe(`DELETE FROM psy_answer_options WHERE id = $1`, req.params.id);
  return reply.send({ success: true });
}

// ── Question sets ──────────────────────────────────────────────────────────

export async function listQuestionSets(req: Req, reply: FastifyReply) {
  const data = await rows(db(req),
    `SELECT s.*, (SELECT COUNT(*)::int FROM psy_access_codes c WHERE c.question_set_id = s.id) AS assigned_code_count
     FROM psy_question_sets s ORDER BY s.created_at DESC`);
  const out = data.map((r) => ({ ...questionSetOut(r), questionCount: (r.question_ids ?? []).length, assignedCodeCount: r.assigned_code_count }));
  return reply.send({ success: true, data: out, total: out.length });
}

export async function getQuestionSet(req: Req, reply: FastifyReply) {
  const d = db(req);
  const [set] = await rows(d, `SELECT * FROM psy_question_sets WHERE id = $1`, req.params.id);
  if (!set) return fail(reply, 404, 'Question set not found.');
  const ids: string[] = set.question_ids ?? [];
  const qs = ids.length
    ? await rows(d, `SELECT id, text, sort_order, type_id, dimension, question_type, marks FROM psy_questions WHERE id = ANY($1::text[])`, ids)
    : [];
  const byId = new Map(qs.map((q) => [q.id, q]));
  // Populated in the set's own order (missing questions dropped), like Mongo populate.
  const questionIds = ids.filter((id) => byId.has(id)).map((id) => {
    const q = byId.get(id)!;
    return { _id: q.id, text: q.text, order: q.sort_order, typeId: q.type_id, dimension: q.dimension, questionType: q.question_type, marks: q.marks };
  });
  return reply.send({ success: true, data: { ...questionSetOut(set), questionIds } });
}

async function saveQuestionSet(req: Req, reply: FastifyReply, mode: 'create' | 'update') {
  const err = validateQuestionSetBody(req.body);
  if (err) return fail(reply, 400, err);
  const b = req.body;
  const d = db(req);
  const ids = dedupeIds(b.questionIds);
  const found = await rows(d, `SELECT COUNT(*)::int AS n FROM psy_questions WHERE id = ANY($1::text[])`, ids);
  if (found[0].n !== ids.length) return fail(reply, 400, 'One or more selected questions do not exist.');
  try {
    if (mode === 'create') {
      const admin = actingAdmin(req);
      const [row] = await rows(d,
        `INSERT INTO psy_question_sets (name, description, duration_minutes, question_ids, created_by, created_by_email)
         VALUES ($1, $2, $3, $4::jsonb, $5, $6) RETURNING *`,
        String(b.name).trim(), String(b.description ?? ''), Number(b.durationMinutes), JSON.stringify(ids), admin.id, admin.email);
      return reply.code(201).send({ success: true, data: questionSetOut(row) });
    }
    const vals: unknown[] = [String(b.name).trim(), Number(b.durationMinutes), JSON.stringify(ids)];
    const sets = ['name = $1', 'duration_minutes = $2', 'question_ids = $3::jsonb'];
    if (b.description !== undefined) { vals.push(String(b.description)); sets.push(`description = $${vals.length}`); }
    if (b.isActive !== undefined) { vals.push(!!b.isActive); sets.push(`is_active = $${vals.length}`); }
    vals.push(req.params.id);
    const [row] = await rows(d, `UPDATE psy_question_sets SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${vals.length} RETURNING *`, ...vals);
    if (!row) return fail(reply, 404, 'Question set not found.');
    return reply.send({ success: true, data: questionSetOut(row) });
  } catch (e) {
    if (isUniqueViolation(e)) return fail(reply, 409, 'A question set with that name already exists.');
    throw e;
  }
}

export const createQuestionSet = (req: Req, reply: FastifyReply) => saveQuestionSet(req, reply, 'create');
export const updateQuestionSet = (req: Req, reply: FastifyReply) => saveQuestionSet(req, reply, 'update');

export async function deleteQuestionSet(req: Req, reply: FastifyReply) {
  const d = db(req);
  const assigned = await rows(d, `SELECT code FROM psy_access_codes WHERE question_set_id = $1`, req.params.id);
  if (assigned.length) {
    return fail(reply, 409, `Cannot delete: this set is still assigned to ${assigned.length} access code(s). Reassign them first.`, {
      codes: assigned.map((c) => c.code),
    });
  }
  const del = await d.$executeRawUnsafe(`DELETE FROM psy_question_sets WHERE id = $1`, req.params.id);
  if (!del) return fail(reply, 404, 'Question set not found.');
  return reply.send({ success: true });
}

// ── Business matrix ────────────────────────────────────────────────────────

export async function getMatrix(req: Req, reply: FastifyReply) {
  const d = db(req);
  const [types, cells] = await Promise.all([
    rows(d, `SELECT * FROM psy_question_types WHERE is_active ORDER BY sort_order`),
    rows(d, `SELECT * FROM psy_business_matrix`),
  ]);
  return reply.send({
    success: true,
    types: types.map(questionTypeOut),
    cells: cells.map(matrixCellOut),
    completion: { configured: cells.filter((c) => c.is_active).length, total: types.length * types.length },
  });
}

export async function seedSampleMatrix(req: Req, reply: FastifyReply) {
  const result = await (req.server.prisma as any).$transaction(async (tx: Db) => {
    const types = await rows(tx, `SELECT id, name FROM psy_question_types WHERE is_active ORDER BY sort_order`);
    if (types.length < 2) return null;
    const cleared = await tx.$executeRawUnsafe(`DELETE FROM psy_business_matrix`);
    let created = 0;
    for (const row of types) {
      for (const col of types) {
        const [name, rating] = sampleMatrixCell(row.name, col.name);
        await tx.$executeRawUnsafe(
          `INSERT INTO psy_business_matrix (row_type_id, col_type_id, business_name, rating, is_active) VALUES ($1, $2, $3, $4, TRUE)`,
          row.id, col.id, name.slice(0, 80), rating);
        created++;
      }
    }
    return { created, cleared };
  });
  if (!result) return fail(reply, 400, 'Need at least 2 active question types to build the matrix. Seed the question types first.');
  return reply.send({ success: true, ...result });
}

export async function createMatrixCell(req: Req, reply: FastifyReply) {
  const err = validateMatrixCellBody(req.body);
  if (err) return fail(reply, 400, err);
  const { rowTypeId, colTypeId, businessName, rating } = req.body;
  const d = db(req);
  if ((await rows(d, `SELECT 1 FROM psy_business_matrix WHERE row_type_id = $1 AND col_type_id = $2`, rowTypeId, colTypeId)).length) {
    return fail(reply, 409, 'This cell is already configured. Edit it instead.');
  }
  const [row] = await rows(d,
    `INSERT INTO psy_business_matrix (row_type_id, col_type_id, business_name, rating) VALUES ($1, $2, $3, $4) RETURNING *`,
    String(rowTypeId), String(colTypeId), String(businessName).trim(), Number(rating));
  return reply.code(201).send({ success: true, data: matrixCellOut(row) });
}

export async function updateMatrixCell(req: Req, reply: FastifyReply) {
  const b = req.body ?? {};
  if (b.rating !== undefined && !(Number.isInteger(Number(b.rating)) && b.rating >= 1 && b.rating <= 5)) return fail(reply, 400, 'Rating must be a number from 1 to 5.');
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (b.businessName !== undefined) { vals.push(String(b.businessName).trim().slice(0, 80)); sets.push(`business_name = $${vals.length}`); }
  if (b.rating !== undefined) { vals.push(Number(b.rating)); sets.push(`rating = $${vals.length}`); }
  if (b.isActive !== undefined) { vals.push(!!b.isActive); sets.push(`is_active = $${vals.length}`); }
  vals.push(req.params.id);
  const [row] = await rows(db(req),
    `UPDATE psy_business_matrix SET ${[...sets, 'updated_at = NOW()'].join(', ')} WHERE id = $${vals.length} RETURNING *`, ...vals);
  if (!row) return fail(reply, 404, 'Cell not found.');
  return reply.send({ success: true, data: matrixCellOut(row) });
}

export async function deleteMatrixCell(req: Req, reply: FastifyReply) {
  const del = await db(req).$executeRawUnsafe(`DELETE FROM psy_business_matrix WHERE id = $1`, req.params.id);
  if (!del) return fail(reply, 404, 'Cell not found.');
  return reply.send({ success: true, message: 'Cell removed.' });
}

// ── Settings ───────────────────────────────────────────────────────────────

/** Which access code (its question set) TBT members are assessed on. */
export const MEMBERS_ACCESS_CODE_KEY = 'members_access_code_id';
const DURATION_KEY = 'assessment_duration_minutes';

async function readSetting(d: Db, key: string) {
  const [r] = await rows(d, `SELECT value FROM psy_settings WHERE key = $1`, key);
  return r ? r.value : undefined;
}
async function writeSetting(d: Db, key: string, value: unknown) {
  await d.$executeRawUnsafe(
    `INSERT INTO psy_settings (key, value) VALUES ($1, $2::jsonb)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`, key, JSON.stringify(value));
}

export async function getSettings(req: Req, reply: FastifyReply) {
  const d = db(req);
  const [duration, membersCode] = await Promise.all([readSetting(d, DURATION_KEY), readSetting(d, MEMBERS_ACCESS_CODE_KEY)]);
  return reply.send({
    success: true,
    data: { assessment_duration_minutes: duration != null ? Number(duration) : 30, [MEMBERS_ACCESS_CODE_KEY]: membersCode ?? null },
  });
}

export async function updateSettings(req: Req, reply: FastifyReply) {
  const b = req.body ?? {};
  const d = db(req);
  const hasDuration = b.assessment_duration_minutes !== undefined;
  const hasMembers = b[MEMBERS_ACCESS_CODE_KEY] !== undefined;
  if (!hasMembers || hasDuration) {
    const v = Number(b.assessment_duration_minutes);
    if (b.assessment_duration_minutes == null || Number.isNaN(v) || v <= 0) return fail(reply, 400, 'Invalid assessment duration.');
  }
  if (hasMembers && b[MEMBERS_ACCESS_CODE_KEY] !== null) {
    const [code] = await rows(d, `SELECT is_active, question_set_id FROM psy_access_codes WHERE id = $1`, String(b[MEMBERS_ACCESS_CODE_KEY]));
    if (!code) return fail(reply, 400, 'That access code does not exist.');
    if (!code.is_active || !code.question_set_id) return fail(reply, 400, 'Pick an active access code that has a question set assigned.');
  }
  if (hasDuration) await writeSetting(d, DURATION_KEY, Number(b.assessment_duration_minutes));
  if (hasMembers) await writeSetting(d, MEMBERS_ACCESS_CODE_KEY, b[MEMBERS_ACCESS_CODE_KEY]);
  return reply.send({ success: true, message: 'Settings updated successfully.' });
}
