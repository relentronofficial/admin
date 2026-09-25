import { FastifyRequest, FastifyReply } from 'fastify';

function ok(reply: FastifyReply, data: unknown, meta?: unknown) {
  return reply.send({ success: true, data, ...(meta ? { meta } : {}) });
}
function err(reply: FastifyReply, status: number, message: string) {
  return reply.status(status).send({ success: false, data: null, error: { message } });
}

// ── Admin: list questions ─────────────────────────────────────────────────────

export async function adminListQuestionsHandler(req: FastifyRequest, reply: FastifyReply) {
  const rows = await req.server.prisma.$queryRawUnsafe<any[]>(
    `SELECT id, question_text, category, options, sort_order, is_active, created_at
     FROM psychometric_questions
     ORDER BY sort_order ASC, created_at ASC`
  );
  return ok(reply, rows.map((r) => ({
    id: r.id,
    questionText: r.question_text,
    category: r.category,
    options: r.options,
    sortOrder: r.sort_order,
    isActive: r.is_active,
    createdAt: r.created_at,
  })));
}

// ── Admin: create question ────────────────────────────────────────────────────

export async function adminCreateQuestionHandler(req: FastifyRequest, reply: FastifyReply) {
  const body = req.body as any;
  const { questionText, category, options, sortOrder = 0, isActive = true } = body;
  if (!questionText || !category || !Array.isArray(options) || options.length < 2) {
    return err(reply, 400, 'questionText, category, and at least 2 options are required.');
  }
  const [row] = await req.server.prisma.$queryRawUnsafe<any[]>(
    `INSERT INTO psychometric_questions (question_text, category, options, sort_order, is_active)
     VALUES ($1, $2, $3::jsonb, $4, $5)
     RETURNING id, question_text, category, options, sort_order, is_active, created_at`,
    questionText, category, JSON.stringify(options), sortOrder, isActive
  );
  return reply.status(201).send({ success: true, data: {
    id: row.id,
    questionText: row.question_text,
    category: row.category,
    options: row.options,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    createdAt: row.created_at,
  }});
}

// ── Admin: update question ────────────────────────────────────────────────────

export async function adminUpdateQuestionHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const body = req.body as any;
  const updates: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (body.questionText !== undefined) { updates.push(`question_text = $${idx++}`); values.push(body.questionText); }
  if (body.category    !== undefined) { updates.push(`category = $${idx++}`);       values.push(body.category); }
  if (body.options     !== undefined) { updates.push(`options = $${idx++}::jsonb`); values.push(JSON.stringify(body.options)); }
  if (body.sortOrder   !== undefined) { updates.push(`sort_order = $${idx++}`);     values.push(body.sortOrder); }
  if (body.isActive    !== undefined) { updates.push(`is_active = $${idx++}`);      values.push(body.isActive); }

  if (updates.length === 0) return err(reply, 400, 'No fields to update.');

  values.push(id);
  const rows = await req.server.prisma.$queryRawUnsafe<any[]>(
    `UPDATE psychometric_questions SET ${updates.join(', ')} WHERE id = $${idx}::uuid
     RETURNING id, question_text, category, options, sort_order, is_active`,
    ...values
  );
  if (!rows.length) return err(reply, 404, 'Question not found.');
  const r = rows[0];
  return ok(reply, { id: r.id, questionText: r.question_text, category: r.category, options: r.options, sortOrder: r.sort_order, isActive: r.is_active });
}

// ── Admin: delete question ────────────────────────────────────────────────────

export async function adminDeleteQuestionHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  await req.server.prisma.$executeRawUnsafe(
    `DELETE FROM psychometric_questions WHERE id = $1::uuid`, id
  );
  return ok(reply, null);
}

// ── Admin: reorder questions ──────────────────────────────────────────────────

export async function adminReorderQuestionsHandler(req: FastifyRequest, reply: FastifyReply) {
  const { ids } = req.body as { ids: string[] };
  if (!Array.isArray(ids)) return err(reply, 400, 'ids array required.');
  await Promise.all(ids.map((id, i) =>
    req.server.prisma.$executeRawUnsafe(
      `UPDATE psychometric_questions SET sort_order = $1 WHERE id = $2::uuid`, i, id
    )
  ));
  return ok(reply, null);
}

// ── Admin: list member responses (with pagination) ────────────────────────────

export async function adminListResponsesHandler(req: FastifyRequest, reply: FastifyReply) {
  const { page = 1, limit = 20, memberId } = req.query as { page?: number; limit?: number; memberId?: string };
  const offset = (Number(page) - 1) * Number(limit);

  let whereClause = '';
  const values: any[] = [Number(limit), offset];
  if (memberId) { whereClause = 'WHERE r.member_id = $3::uuid'; values.push(memberId); }

  const rows = await req.server.prisma.$queryRawUnsafe<any[]>(
    `SELECT r.id, r.member_id, r.results, r.created_at,
            m.first_name, m.last_name, m.email
     FROM psychometric_responses r
     JOIN members m ON m.id = r.member_id
     ${whereClause}
     ORDER BY r.created_at DESC
     LIMIT $1 OFFSET $2`,
    ...values
  );

  const [totalRow] = await req.server.prisma.$queryRawUnsafe<any[]>(
    `SELECT COUNT(*)::int AS cnt FROM psychometric_responses r ${whereClause}`,
    ...(memberId ? [memberId] : [])
  );

  return ok(reply, rows.map((r) => ({
    id: r.id,
    memberId: r.member_id,
    memberName: `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim(),
    memberEmail: r.email,
    results: r.results,
    createdAt: r.created_at,
  })), { total: totalRow?.cnt ?? 0, page: Number(page), limit: Number(limit) });
}
