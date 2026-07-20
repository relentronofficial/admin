/**
 * Morning Ritual — habits + buttons_config admin CRUD + member reads.
 *
 * Ported from co-worker's admin-app + PostPopupScreen home page.
 * Global (no member FK) — same questions everyone sees, admins edit,
 * mobile fetches on home load. Daily yes/no answers stay client-side.
 */

import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

function ok(reply: FastifyReply, data: any) {
  return reply.send({ success: true, data, error: null });
}
function fail(reply: FastifyReply, status: number, code: string, message: string) {
  return reply.status(status).send({ success: false, data: null, error: { code, message } });
}

// ── Zod schemas ─────────────────────────────────────────────────
const createHabitSchema = z.object({
  icon: z.string().max(100).optional(),
  rawQuestion: z.string().min(1),
  highlightWord: z.string().max(255).optional(),
  subtitle: z.string().max(255).optional(),
  sortOrder: z.number().int().optional(),
  status: z.enum(['active', 'inactive']).optional(),
});
const updateHabitSchema = createHabitSchema.partial();

const updateButtonsConfigSchema = z.object({
  yesLabel: z.string().max(100).min(1),
  notYetLabel: z.string().max(100).min(1),
});

// ── Habits — admin ──────────────────────────────────────────────
export async function adminListHabitsHandler(req: FastifyRequest, reply: FastifyReply) {
  const rows = await req.server.prisma.habit.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  return ok(reply, rows);
}

export async function adminCreateHabitHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = createHabitSchema.safeParse(req.body);
  if (!parsed.success) return fail(reply, 400, 'invalid_input', parsed.error.message);
  const created = await req.server.prisma.habit.create({ data: parsed.data });
  return reply.status(201).send({ success: true, data: created, error: null });
}

export async function adminUpdateHabitHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const parsed = updateHabitSchema.safeParse(req.body);
  if (!parsed.success) return fail(reply, 400, 'invalid_input', parsed.error.message);
  try {
    const updated = await req.server.prisma.habit.update({
      where: { id },
      data: parsed.data,
    });
    return ok(reply, updated);
  } catch (err: any) {
    if (err?.code === 'P2025') return fail(reply, 404, 'not_found', 'Habit not found.');
    throw err;
  }
}

export async function adminDeleteHabitHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  try {
    await req.server.prisma.habit.delete({ where: { id } });
    return ok(reply, null);
  } catch (err: any) {
    if (err?.code === 'P2025') return fail(reply, 404, 'not_found', 'Habit not found.');
    throw err;
  }
}

// ── Buttons config — admin (singleton) ──────────────────────────
async function ensureButtonsConfig(req: FastifyRequest) {
  let row = await req.server.prisma.buttonsConfig.findFirst({
    where: { id: 'default' },
  });
  if (!row) {
    row = await req.server.prisma.buttonsConfig.create({
      data: { id: 'default', yesLabel: 'Yes', notYetLabel: 'Not Yet' },
    });
  }
  return row;
}

export async function adminGetButtonsConfigHandler(req: FastifyRequest, reply: FastifyReply) {
  const row = await ensureButtonsConfig(req);
  return ok(reply, row);
}

export async function adminUpdateButtonsConfigHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = updateButtonsConfigSchema.safeParse(req.body);
  if (!parsed.success) return fail(reply, 400, 'invalid_input', parsed.error.message);
  await ensureButtonsConfig(req);
  const updated = await req.server.prisma.buttonsConfig.update({
    where: { id: 'default' },
    data: parsed.data,
  });
  return ok(reply, updated);
}

// ── Member-facing ────────────────────────────────────────────────
export async function listActiveHabitsHandler(req: FastifyRequest, reply: FastifyReply) {
  const rows = await req.server.prisma.habit.findMany({
    where: { status: 'active' },
    orderBy: { sortOrder: 'asc' },
  });
  return ok(reply, rows);
}

export async function getButtonsConfigHandler(req: FastifyRequest, reply: FastifyReply) {
  const row = await ensureButtonsConfig(req);
  return ok(reply, row);
}
