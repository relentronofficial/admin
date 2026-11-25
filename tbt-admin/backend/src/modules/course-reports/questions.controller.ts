// Admin-written weekly report questions (weeks 1–18) and members' answers.
// Raw-SQL tables weekly_report_forms / weekly_report_answers; rules in lib/weeklyReportForm.ts.
import type { FastifyReply, FastifyRequest } from 'fastify';
import { deliverMemberFeedbackToAdmin } from '../../lib/courseReports.js';
import {
  TOTAL_WEEKS, answersAsText, batchWeek, prefill, readAnswers, saveQuestionsSchema, submitAnswersSchema,
  type StoredAnswer, type WeeklyQuestion,
} from '../../lib/weeklyReportForm.js';

const ok = (reply: FastifyReply, data: unknown) => reply.send({ success: true, data, error: null });
const fail = (reply: FastifyReply, status: number, code: string, message: string) =>
  reply.status(status).send({ success: false, data: null, error: { code, message } });

interface CurrentForm { week: number; batchId: string; version: number; questions: WeeklyQuestion[] }

/** The member's questions for this batch week, or null (no batch, not started, finished, nothing set). */
export async function loadCurrentForm(prisma: any, memberId: string, now = new Date()): Promise<CurrentForm | null> {
  const [b] = await prisma.$queryRawUnsafe(
    `SELECT b.id, b.starts_at FROM members m JOIN batches b ON b.id = m.batch_id WHERE m.id = $1::uuid`, memberId);
  if (!b) return null;
  const week = batchWeek(new Date(b.starts_at), now);
  if (week < 1 || week > TOTAL_WEEKS) return null;
  const [f] = await prisma.$queryRawUnsafe(`SELECT version, questions FROM weekly_report_forms WHERE week_number = $1`, week);
  return f?.questions?.length ? { week, batchId: b.id, version: f.version, questions: f.questions } : null;
}

// GET /weekly-form — null means the member writes a free-text report as before.
export async function getWeeklyFormHandler(req: FastifyRequest, reply: FastifyReply) {
  const prisma = req.server.prisma as any;
  const form = await loadCurrentForm(prisma, req.memberId!);
  if (!form) return ok(reply, null);
  const [mine] = await prisma.$queryRawUnsafe(
    `SELECT answers FROM weekly_report_answers WHERE member_id = $1::uuid AND batch_id = $2::uuid AND week_number = $3`,
    req.memberId!, form.batchId, form.week);
  const stored = (mine?.answers as StoredAnswer[]) ?? null;
  return ok(reply, {
    week: form.week, totalWeeks: TOTAL_WEEKS, version: form.version, questions: form.questions,
    submitted: !!stored, answers: prefill(form.questions, stored),
  });
}

// POST /weekly-answers — saves the answers and files the weekly report (which unlocks videos).
export async function submitWeeklyAnswersHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = submitAnswersSchema.safeParse(req.body);
  if (!parsed.success) return fail(reply, 400, 'invalid_input', 'Please check your answers and try again.');
  const { courseId, week, version, answers: raw } = parsed.data;
  const prisma = req.server.prisma as any;
  const memberId = req.memberId!;

  const [form, course, enrollment] = await Promise.all([
    loadCurrentForm(prisma, memberId),
    prisma.course.findUnique({ where: { id: courseId }, select: { isPublished: true } }),
    prisma.courseEnrollment.findUnique({ where: { memberId_courseId: { memberId, courseId } }, select: { id: true } }),
  ]);
  if (!course || (!course.isPublished && !enrollment)) return fail(reply, 404, 'not_found', 'Course not found.');
  if (!form || form.week !== week || form.version !== version) {
    return fail(reply, 409, 'form_changed', 'The questions were updated. Please check your answers and submit again.');
  }

  let answers: StoredAnswer[];
  try {
    answers = readAnswers(form.questions, raw);
  } catch (e) {
    return fail(reply, 400, 'invalid_answer', (e as Error).message);
  }

  // Answers first: the report row is what marks the week done and unlocks videos.
  await prisma.$executeRawUnsafe(
    `INSERT INTO weekly_report_answers (member_id, batch_id, week_number, course_id, answers)
     VALUES ($1::uuid, $2::uuid, $3::int, $4::uuid, $5::jsonb)
     ON CONFLICT (member_id, batch_id, week_number)
     DO UPDATE SET course_id = EXCLUDED.course_id, answers = EXCLUDED.answers, submitted_at = NOW()`,
    memberId, form.batchId, week, courseId, JSON.stringify(answers));
  const result = await deliverMemberFeedbackToAdmin(prisma, memberId, courseId, { feedback: answersAsText(answers), batchWeek: week });

  const member = await prisma.member.findUnique({ where: { id: memberId }, select: { firstName: true } });
  req.server.io.to('admin').emit('admin:course_weekly_feedback', { feedbackId: result.feedbackId, memberName: member?.firstName, courseId });
  return ok(reply, result);
}

// ── Admin ──────────────────────────────────────────────────────────

// GET /admin/questions — all 18 weeks, and where each running batch is.
export async function adminGetQuestionsHandler(req: FastifyRequest, reply: FastifyReply) {
  const prisma = req.server.prisma as any;
  const [forms, batches] = await Promise.all([
    prisma.$queryRawUnsafe(`SELECT week_number, version, questions FROM weekly_report_forms`),
    prisma.$queryRawUnsafe(
      `SELECT b.id, b.name, b.starts_at, (SELECT COUNT(*)::int FROM members m WHERE m.batch_id = b.id AND m.status = 'active') AS members
       FROM batches b WHERE b.is_active ORDER BY b.starts_at DESC`),
  ]);
  const now = new Date();
  return ok(reply, {
    weeks: Array.from({ length: TOTAL_WEEKS }, (_, i) => {
      const f = forms.find((x: any) => x.week_number === i + 1);
      return { week: i + 1, version: f?.version ?? 0, questions: f?.questions ?? [] };
    }),
    batches: batches.map((b: any) => ({ id: b.id, name: b.name, startsAt: b.starts_at, members: b.members, week: batchWeek(new Date(b.starts_at), now) })),
  });
}

// PUT /admin/questions/:week — replaces the week's questions. `version` stops two admins overwriting each other.
export async function adminSaveQuestionsHandler(req: FastifyRequest, reply: FastifyReply) {
  const week = Number((req.params as { week: string }).week);
  if (!Number.isInteger(week) || week < 1 || week > TOTAL_WEEKS) return fail(reply, 400, 'invalid_input', 'Week must be 1 to 18.');
  const parsed = saveQuestionsSchema.safeParse(req.body);
  if (!parsed.success) return fail(reply, 400, 'invalid_input', parsed.error.issues[0]?.message ?? 'Please check the questions.');
  const [row] = await (req.server.prisma as any).$queryRawUnsafe(
    `INSERT INTO weekly_report_forms (week_number, questions) VALUES ($1::int, $2::jsonb)
     ON CONFLICT (week_number) DO UPDATE SET questions = EXCLUDED.questions, version = weekly_report_forms.version + 1, updated_at = NOW()
       WHERE weekly_report_forms.version = $3::int
     RETURNING version`,
    week, JSON.stringify(parsed.data.questions), parsed.data.version);
  if (!row) return fail(reply, 409, 'changed', 'Another admin changed this week. Reload the page to see their questions.');
  return ok(reply, { week, version: row.version, questions: parsed.data.questions });
}
