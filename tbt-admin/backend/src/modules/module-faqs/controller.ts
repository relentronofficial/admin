// Admin API for the Modules page FAQ (Clerk-protected; see routes.ts).
// Pure rules + sanitising: lib/moduleFaqLogic.ts. Members read published FAQs
// through the public GET /api/pub/module-faqs (pub module).

import type { FastifyReply, FastifyRequest } from 'fastify';
import { getActingAdmin } from '../../lib/adminRole.js';
import {
  adminFaqDto,
  canManageModuleFaqs,
  validateFaqInput,
  validateFaqReorder,
  type FaqRow,
} from '../../lib/moduleFaqLogic.js';

type PI = { id: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COLUMNS = `id::text AS id, question, answer, is_published, sort_order, updated_at`;

const ok = (reply: FastifyReply, data: unknown, status = 200) => reply.status(status).send({ success: true, data, error: null });
const fail = (reply: FastifyReply, status: number, error: string) => reply.status(status).send({ success: false, data: null, error });

async function requireAdmin(req: FastifyRequest, reply: FastifyReply, needsEdit: boolean) {
  const acting = await getActingAdmin(req).catch(() => null);
  if (!acting) { fail(reply, 403, 'Admin account not found'); return null; }
  if (needsEdit && !canManageModuleFaqs(acting.role as string)) {
    fail(reply, 403, 'Only Admin and Super Admin can change the Modules FAQ.');
    return null;
  }
  return acting;
}

async function loadFaq(req: FastifyRequest<{ Params: PI }>, reply: FastifyReply): Promise<FaqRow | null> {
  const { id } = req.params;
  if (!UUID.test(id)) { fail(reply, 404, 'FAQ not found'); return null; }
  const rows = await req.server.prisma.$queryRawUnsafe<FaqRow[]>(`SELECT ${COLUMNS} FROM module_faqs WHERE id = $1::uuid`, id);
  if (!rows[0]) { fail(reply, 404, 'FAQ not found'); return null; }
  return rows[0];
}

// GET /api/module-faqs/admin — every FAQ (published or not) in display order
export async function listFaqsAdminHandler(req: FastifyRequest, reply: FastifyReply) {
  if (!(await requireAdmin(req, reply, false))) return;
  const rows = await req.server.prisma.$queryRawUnsafe<FaqRow[]>(
    `SELECT ${COLUMNS} FROM module_faqs ORDER BY sort_order ASC, created_at ASC`,
  );
  return ok(reply, rows.map(adminFaqDto));
}

// POST /api/module-faqs/admin — { question, answer, isPublished? }; new FAQs go to the end
export async function createFaqHandler(req: FastifyRequest, reply: FastifyReply) {
  const acting = await requireAdmin(req, reply, true);
  if (!acting) return;
  const v = validateFaqInput(req.body);
  if (!v.ok) return fail(reply, 400, v.error);
  const rows = await req.server.prisma.$queryRawUnsafe<FaqRow[]>(
    `INSERT INTO module_faqs (question, answer, is_published, sort_order, created_by, updated_by)
     VALUES ($1, $2, $3, (SELECT COALESCE(MAX(sort_order) + 1, 0) FROM module_faqs), $4, $4)
     RETURNING ${COLUMNS}`,
    v.value.question, v.value.answer, v.value.isPublished, acting.id,
  );
  return ok(reply, adminFaqDto(rows[0]!), 201);
}

// PUT /api/module-faqs/admin/:id — { question?, answer?, isPublished? }
export async function updateFaqHandler(req: FastifyRequest<{ Params: PI }>, reply: FastifyReply) {
  const acting = await requireAdmin(req, reply, true);
  if (!acting) return;
  const current = await loadFaq(req, reply);
  if (!current) return;
  const v = validateFaqInput(req.body, { question: current.question, answer: current.answer, isPublished: !!current.is_published });
  if (!v.ok) return fail(reply, 400, v.error);
  const rows = await req.server.prisma.$queryRawUnsafe<FaqRow[]>(
    `UPDATE module_faqs SET question = $2, answer = $3, is_published = $4, updated_by = $5, updated_at = NOW()
     WHERE id = $1::uuid RETURNING ${COLUMNS}`,
    current.id, v.value.question, v.value.answer, v.value.isPublished, acting.id,
  );
  if (!rows[0]) return fail(reply, 404, 'FAQ not found');
  return ok(reply, adminFaqDto(rows[0]));
}

// PATCH /api/module-faqs/admin/:id/publish — { isPublished: boolean }
export async function setFaqPublishedHandler(req: FastifyRequest<{ Params: PI }>, reply: FastifyReply) {
  const acting = await requireAdmin(req, reply, true);
  if (!acting) return;
  const { isPublished } = (req.body ?? {}) as { isPublished?: unknown };
  if (typeof isPublished !== 'boolean') return fail(reply, 400, 'isPublished must be true or false');
  const current = await loadFaq(req, reply);
  if (!current) return;
  const rows = await req.server.prisma.$queryRawUnsafe<FaqRow[]>(
    `UPDATE module_faqs SET is_published = $2, updated_by = $3, updated_at = NOW() WHERE id = $1::uuid RETURNING ${COLUMNS}`,
    current.id, isPublished, acting.id,
  );
  if (!rows[0]) return fail(reply, 404, 'FAQ not found');
  return ok(reply, adminFaqDto(rows[0]));
}

// PUT /api/module-faqs/admin/reorder — { ids: string[] } with every FAQ exactly once
export async function reorderFaqsHandler(req: FastifyRequest, reply: FastifyReply) {
  const acting = await requireAdmin(req, reply, true);
  if (!acting) return;
  const prisma = req.server.prisma;
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.$queryRawUnsafe<Array<{ id: string }>>(`SELECT id::text AS id FROM module_faqs FOR UPDATE`);
    const v = validateFaqReorder(existing.map((r) => r.id), ((req.body ?? {}) as { ids?: unknown }).ids);
    if (!v.ok) return v;
    for (let i = 0; i < v.value.length; i++) {
      await tx.$executeRawUnsafe(
        `UPDATE module_faqs SET sort_order = $2, updated_by = $3, updated_at = NOW() WHERE id = $1::uuid`,
        v.value[i], i, acting.id,
      );
    }
    return v;
  });
  if (!result.ok) return fail(reply, 400, result.error);
  const rows = await prisma.$queryRawUnsafe<FaqRow[]>(`SELECT ${COLUMNS} FROM module_faqs ORDER BY sort_order ASC, created_at ASC`);
  return ok(reply, rows.map(adminFaqDto));
}

// DELETE /api/module-faqs/admin/:id
export async function deleteFaqHandler(req: FastifyRequest<{ Params: PI }>, reply: FastifyReply) {
  if (!(await requireAdmin(req, reply, true))) return;
  const { id } = req.params;
  if (!UUID.test(id)) return fail(reply, 404, 'FAQ not found');
  const n = await req.server.prisma.$executeRawUnsafe(`DELETE FROM module_faqs WHERE id = $1::uuid`, id);
  if (!n) return fail(reply, 404, 'FAQ not found');
  return ok(reply, { id });
}
