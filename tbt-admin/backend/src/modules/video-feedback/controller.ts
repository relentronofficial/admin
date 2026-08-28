import type { FastifyRequest, FastifyReply } from 'fastify';

// ── Admin handlers ─────────────────────────────────────────────────────

export async function adminListQuestionsHandler(req: FastifyRequest<{ Params: { episodeId: string }; Querystring: { episodeType?: string } }>, reply: FastifyReply) {
  const { episodeId } = req.params;
  const episodeType = req.query.episodeType ?? 'course';
  const prisma = req.server.prisma;

  const questions = await prisma.$queryRawUnsafe<any[]>(
    `SELECT q.*,
       COUNT(r.id) AS response_count,
       ROUND(AVG(CASE WHEN q.question_type = 'rating' THEN r.rating_value END), 2) AS avg_rating,
       COUNT(CASE WHEN r.yes_no_value = true THEN 1 END) AS yes_count,
       COUNT(CASE WHEN r.yes_no_value = false THEN 1 END) AS no_count
     FROM video_feedback_questions q
     LEFT JOIN video_feedback_responses r ON r.question_id = q.id
     WHERE q.episode_id = $1 AND q.episode_type = $2
     GROUP BY q.id
     ORDER BY q.sort_order ASC, q.created_at ASC`,
    episodeId, episodeType,
  );

  return reply.send({ success: true, data: questions.map(q => ({
    id: q.id,
    episodeId: q.episode_id,
    episodeType: q.episode_type,
    questionText: q.question_text,
    questionType: q.question_type,
    sortOrder: Number(q.sort_order),
    isActive: q.is_active,
    createdAt: q.created_at,
    responseCount: Number(q.response_count ?? 0),
    avgRating: q.avg_rating ? Number(q.avg_rating) : null,
    yesCount: Number(q.yes_count ?? 0),
    noCount: Number(q.no_count ?? 0),
  })) });
}

export async function adminCreateQuestionHandler(req: FastifyRequest<{ Params: { episodeId: string }; Body: { questionText: string; questionType: string; episodeType?: string; sortOrder?: number } }>, reply: FastifyReply) {
  const { episodeId } = req.params;
  const { questionText, questionType, episodeType = 'course', sortOrder = 0 } = req.body;

  if (!questionText?.trim()) return reply.status(400).send({ success: false, error: 'questionText is required' });
  if (!['rating', 'yes_no'].includes(questionType)) return reply.status(400).send({ success: false, error: 'questionType must be rating or yes_no' });

  const [row] = await req.server.prisma.$queryRawUnsafe<any[]>(
    `INSERT INTO video_feedback_questions (episode_id, episode_type, question_text, question_type, sort_order)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    episodeId, episodeType, questionText.trim(), questionType, sortOrder,
  );

  return reply.status(201).send({ success: true, data: {
    id: row.id,
    episodeId: row.episode_id,
    episodeType: row.episode_type,
    questionText: row.question_text,
    questionType: row.question_type,
    sortOrder: Number(row.sort_order),
    isActive: row.is_active,
    createdAt: row.created_at,
  }});
}

export async function adminUpdateQuestionHandler(req: FastifyRequest<{ Params: { questionId: string }; Body: { questionText?: string; questionType?: string; sortOrder?: number; isActive?: boolean } }>, reply: FastifyReply) {
  const { questionId } = req.params;
  const { questionText, questionType, sortOrder, isActive } = req.body;

  if (questionType && !['rating', 'yes_no'].includes(questionType)) {
    return reply.status(400).send({ success: false, error: 'questionType must be rating or yes_no' });
  }

  const sets: string[] = [];
  const vals: any[] = [];
  let idx = 1;
  if (questionText !== undefined) { sets.push(`question_text = $${idx++}`); vals.push(questionText.trim()); }
  if (questionType !== undefined) { sets.push(`question_type = $${idx++}`); vals.push(questionType); }
  if (sortOrder !== undefined) { sets.push(`sort_order = $${idx++}`); vals.push(sortOrder); }
  if (isActive !== undefined) { sets.push(`is_active = $${idx++}`); vals.push(isActive); }

  if (!sets.length) return reply.status(400).send({ success: false, error: 'Nothing to update' });
  vals.push(questionId);

  const [row] = await req.server.prisma.$queryRawUnsafe<any[]>(
    `UPDATE video_feedback_questions SET ${sets.join(', ')} WHERE id = $${idx}::uuid RETURNING *`,
    ...vals,
  );
  if (!row) return reply.status(404).send({ success: false, error: 'Question not found' });

  return reply.send({ success: true, data: {
    id: row.id,
    episodeId: row.episode_id,
    episodeType: row.episode_type,
    questionText: row.question_text,
    questionType: row.question_type,
    sortOrder: Number(row.sort_order),
    isActive: row.is_active,
    createdAt: row.created_at,
  }});
}

export async function adminDeleteQuestionHandler(req: FastifyRequest<{ Params: { questionId: string } }>, reply: FastifyReply) {
  await req.server.prisma.$executeRawUnsafe(
    `DELETE FROM video_feedback_questions WHERE id = $1::uuid`,
    req.params.questionId,
  );
  return reply.send({ success: true });
}

export async function adminReorderQuestionsHandler(req: FastifyRequest<{ Params: { episodeId: string }; Body: { ids: string[] } }>, reply: FastifyReply) {
  const { ids } = req.body;
  if (!Array.isArray(ids)) return reply.status(400).send({ success: false, error: 'ids must be an array' });

  await Promise.all(
    ids.map((id, idx) =>
      req.server.prisma.$executeRawUnsafe(
        `UPDATE video_feedback_questions SET sort_order = $1 WHERE id = $2::uuid`,
        idx, id,
      ),
    ),
  );
  return reply.send({ success: true });
}

export async function adminGetResponsesHandler(req: FastifyRequest<{ Params: { episodeId: string }; Querystring: { episodeType?: string } }>, reply: FastifyReply) {
  const { episodeId } = req.params;
  const episodeType = req.query.episodeType ?? 'course';

  const rows = await req.server.prisma.$queryRawUnsafe<any[]>(
    `SELECT q.id, q.question_text, q.question_type,
       COUNT(r.id) AS response_count,
       ROUND(AVG(CASE WHEN q.question_type = 'rating' THEN r.rating_value END), 2) AS avg_rating,
       COUNT(CASE WHEN r.yes_no_value = true THEN 1 END) AS yes_count,
       COUNT(CASE WHEN r.yes_no_value = false THEN 1 END) AS no_count,
       json_agg(
         CASE WHEN q.question_type = 'rating' THEN r.rating_value::text ELSE r.yes_no_value::text END
         ORDER BY r.created_at
       ) FILTER (WHERE r.id IS NOT NULL) AS all_responses
     FROM video_feedback_questions q
     LEFT JOIN video_feedback_responses r ON r.question_id = q.id
     WHERE q.episode_id = $1 AND q.episode_type = $2 AND q.is_active = true
     GROUP BY q.id, q.question_text, q.question_type
     ORDER BY q.sort_order ASC`,
    episodeId, episodeType,
  );

  return reply.send({ success: true, data: rows.map(r => ({
    questionId: r.id,
    questionText: r.question_text,
    questionType: r.question_type,
    responseCount: Number(r.response_count ?? 0),
    avgRating: r.avg_rating ? Number(r.avg_rating) : null,
    yesCount: Number(r.yes_count ?? 0),
    noCount: Number(r.no_count ?? 0),
    allResponses: r.all_responses ?? [],
  })) });
}

// ── User handlers ──────────────────────────────────────────────────────

export async function getUserQuestionsHandler(req: FastifyRequest<{ Params: { episodeId: string }; Querystring: { episodeType?: string } }>, reply: FastifyReply) {
  const { episodeId } = req.params;
  const episodeType = req.query.episodeType ?? 'course';
  const memberId = req.memberId!;

  // Return only active questions this member hasn't answered yet
  const questions = await req.server.prisma.$queryRawUnsafe<any[]>(
    `SELECT q.id, q.question_text, q.question_type, q.sort_order
     FROM video_feedback_questions q
     WHERE q.episode_id = $1
       AND q.episode_type = $2
       AND q.is_active = true
       AND NOT EXISTS (
         SELECT 1 FROM video_feedback_responses r
         WHERE r.question_id = q.id AND r.member_id = $3::uuid
       )
     ORDER BY q.sort_order ASC`,
    episodeId, episodeType, memberId,
  );

  return reply.send({ success: true, data: questions.map(q => ({
    id: q.id,
    questionText: q.question_text,
    questionType: q.question_type,
    sortOrder: Number(q.sort_order),
  })) });
}

export async function submitFeedbackHandler(req: FastifyRequest<{ Params: { episodeId: string }; Body: { episodeType?: string; responses: Array<{ questionId: string; ratingValue?: number; yesNoValue?: boolean }> } }>, reply: FastifyReply) {
  const { episodeId } = req.params;
  const { episodeType = 'course', responses } = req.body;
  const memberId = req.memberId!;

  if (!Array.isArray(responses) || responses.length === 0) {
    return reply.status(400).send({ success: false, error: 'responses must be a non-empty array' });
  }

  await Promise.all(
    responses.map(({ questionId, ratingValue, yesNoValue }) =>
      req.server.prisma.$executeRawUnsafe(
        `INSERT INTO video_feedback_responses (member_id, question_id, episode_id, episode_type, rating_value, yes_no_value)
         VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6)
         ON CONFLICT (member_id, question_id) DO UPDATE SET
           rating_value = EXCLUDED.rating_value,
           yes_no_value = EXCLUDED.yes_no_value`,
        memberId, questionId, episodeId, episodeType,
        ratingValue ?? null,
        yesNoValue !== undefined ? yesNoValue : null,
      ),
    ),
  );

  return reply.status(201).send({ success: true });
}
