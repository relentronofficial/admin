/**
 * Helpdesk / Support Center module — admin CRUD + member submission.
 *
 * Ported from co-worker's Express admin-app support routes. Same dual-
 * auth pattern as podcasts/ebooks (Clerk admin + JWT cookie member).
 *
 * Ticket + feedback submission auto-links the member row when the
 * caller is authenticated (member_id gets populated); we still accept
 * name/email/phone/rating in the body so a future public help-center
 * page can submit anonymously without schema changes.
 */

import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  createCategorySchema,
  updateCategorySchema,
  createFaqSchema,
  updateFaqSchema,
  updateSettingsSchema,
  submitTicketSchema,
  updateTicketStatusSchema,
  submitFeedbackSchema,
  updateFeedbackStatusSchema,
} from './schema.js';

function ok(reply: FastifyReply, data: any, extra?: any) {
  return reply.send({ success: true, data, error: null, ...extra });
}
function fail(reply: FastifyReply, status: number, code: string, message: string) {
  return reply.status(status).send({ success: false, data: null, error: { code, message } });
}

// ── Helper: null-out empty strings so Zod URL/email fields don't reject
// legitimate "clear this field" edits.
function nullifyEmpty<T extends Record<string, any>>(obj: T): T {
  const out: any = { ...obj };
  for (const [k, v] of Object.entries(out)) {
    if (v === '') out[k] = null;
  }
  return out as T;
}

// ────────────────────────────────────────────────────────────────
// CATEGORIES — admin
// ────────────────────────────────────────────────────────────────
export async function adminListCategoriesHandler(req: FastifyRequest, reply: FastifyReply) {
  const rows = await req.server.prisma.helpdeskCategory.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
  return ok(reply, rows);
}

export async function adminCreateCategoryHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = createCategorySchema.safeParse(req.body);
  if (!parsed.success) return fail(reply, 400, 'invalid_input', parsed.error.message);
  try {
    const created = await req.server.prisma.helpdeskCategory.create({ data: parsed.data });
    return reply.status(201).send({ success: true, data: created, error: null });
  } catch (err: any) {
    if (err?.code === 'P2002') return fail(reply, 409, 'duplicate_slug', 'Slug already in use.');
    throw err;
  }
}

export async function adminUpdateCategoryHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const parsed = updateCategorySchema.safeParse(req.body);
  if (!parsed.success) return fail(reply, 400, 'invalid_input', parsed.error.message);
  try {
    const updated = await req.server.prisma.helpdeskCategory.update({
      where: { id },
      data: parsed.data,
    });
    return ok(reply, updated);
  } catch (err: any) {
    if (err?.code === 'P2025') return fail(reply, 404, 'not_found', 'Category not found.');
    if (err?.code === 'P2002') return fail(reply, 409, 'duplicate_slug', 'Slug already in use.');
    throw err;
  }
}

export async function adminDeleteCategoryHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  try {
    await req.server.prisma.helpdeskCategory.delete({ where: { id } });
    return ok(reply, null);
  } catch (err: any) {
    if (err?.code === 'P2025') return fail(reply, 404, 'not_found', 'Category not found.');
    throw err;
  }
}

// ────────────────────────────────────────────────────────────────
// FAQs — admin
// ────────────────────────────────────────────────────────────────
const faqInclude = {
  category: { select: { id: true, name: true, slug: true } },
};

export async function adminListFaqsHandler(req: FastifyRequest, reply: FastifyReply) {
  const rows = await req.server.prisma.helpdeskFaq.findMany({
    include: faqInclude,
    orderBy: [{ sortOrder: 'asc' }, { question: 'asc' }],
  });
  return ok(reply, rows);
}

export async function adminCreateFaqHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = createFaqSchema.safeParse(req.body);
  if (!parsed.success) return fail(reply, 400, 'invalid_input', parsed.error.message);
  const created = await req.server.prisma.helpdeskFaq.create({
    data: parsed.data,
    include: faqInclude,
  });
  return reply.status(201).send({ success: true, data: created, error: null });
}

export async function adminUpdateFaqHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const parsed = updateFaqSchema.safeParse(req.body);
  if (!parsed.success) return fail(reply, 400, 'invalid_input', parsed.error.message);
  try {
    const updated = await req.server.prisma.helpdeskFaq.update({
      where: { id },
      data: parsed.data,
      include: faqInclude,
    });
    return ok(reply, updated);
  } catch (err: any) {
    if (err?.code === 'P2025') return fail(reply, 404, 'not_found', 'FAQ not found.');
    throw err;
  }
}

export async function adminDeleteFaqHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  try {
    await req.server.prisma.helpdeskFaq.delete({ where: { id } });
    return ok(reply, null);
  } catch (err: any) {
    if (err?.code === 'P2025') return fail(reply, 404, 'not_found', 'FAQ not found.');
    throw err;
  }
}

// ────────────────────────────────────────────────────────────────
// Settings — admin (singleton)
// ────────────────────────────────────────────────────────────────
async function ensureSettings(req: FastifyRequest) {
  let row = await req.server.prisma.helpdeskSettings.findFirst();
  if (!row) {
    row = await req.server.prisma.helpdeskSettings.create({
      data: { title: 'Support Center', buttonText: 'Contact Us', status: 'active' },
    });
  }
  return row;
}

export async function adminGetSettingsHandler(req: FastifyRequest, reply: FastifyReply) {
  const row = await ensureSettings(req);
  return ok(reply, row);
}

export async function adminUpdateSettingsHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = updateSettingsSchema.safeParse(nullifyEmpty(req.body as any));
  if (!parsed.success) return fail(reply, 400, 'invalid_input', parsed.error.message);
  const current = await ensureSettings(req);
  const updated = await req.server.prisma.helpdeskSettings.update({
    where: { id: current.id },
    data: parsed.data as any,
  });
  return ok(reply, updated);
}

// ────────────────────────────────────────────────────────────────
// Tickets — admin
// ────────────────────────────────────────────────────────────────
const ticketInclude = {
  category: { select: { id: true, name: true, slug: true } },
  member: { select: { id: true, firstName: true, lastName: true, email: true } },
};

export async function adminListTicketsHandler(req: FastifyRequest, reply: FastifyReply) {
  const { page = '1', limit = '25', status, categoryId, search } =
    req.query as Record<string, string>;
  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(100, Math.max(1, Number(limit) || 25));

  const where: any = {};
  if (status && status !== 'all') where.status = status;
  if (categoryId) where.categoryId = categoryId;
  if (search && search.trim()) {
    where.OR = [
      { subject: { contains: search.trim(), mode: 'insensitive' } },
      { email: { contains: search.trim(), mode: 'insensitive' } },
      { name: { contains: search.trim(), mode: 'insensitive' } },
    ];
  }

  const [rows, total] = await Promise.all([
    req.server.prisma.helpdeskTicket.findMany({
      where,
      include: ticketInclude,
      orderBy: { createdAt: 'desc' },
      skip: (p - 1) * l,
      take: l,
    }),
    req.server.prisma.helpdeskTicket.count({ where }),
  ]);
  return reply.send({
    success: true,
    data: rows,
    meta: { total, page: p, limit: l },
    error: null,
  });
}

export async function adminGetTicketHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const row = await req.server.prisma.helpdeskTicket.findUnique({
    where: { id },
    include: ticketInclude,
  });
  if (!row) return fail(reply, 404, 'not_found', 'Ticket not found.');
  return ok(reply, row);
}

export async function adminUpdateTicketStatusHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const parsed = updateTicketStatusSchema.safeParse(req.body);
  if (!parsed.success) return fail(reply, 400, 'invalid_input', parsed.error.message);
  try {
    const updated = await req.server.prisma.helpdeskTicket.update({
      where: { id },
      data: {
        status: parsed.data.status,
        ...(parsed.data.adminNotes !== undefined && { adminNotes: parsed.data.adminNotes }),
      },
      include: ticketInclude,
    });
    return ok(reply, updated);
  } catch (err: any) {
    if (err?.code === 'P2025') return fail(reply, 404, 'not_found', 'Ticket not found.');
    throw err;
  }
}

export async function adminDeleteTicketHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  try {
    await req.server.prisma.helpdeskTicket.delete({ where: { id } });
    return ok(reply, null);
  } catch (err: any) {
    if (err?.code === 'P2025') return fail(reply, 404, 'not_found', 'Ticket not found.');
    throw err;
  }
}

// ────────────────────────────────────────────────────────────────
// Feedback — admin
// ────────────────────────────────────────────────────────────────
const feedbackInclude = {
  member: { select: { id: true, firstName: true, lastName: true, email: true } },
};

export async function adminListFeedbackHandler(req: FastifyRequest, reply: FastifyReply) {
  const { page = '1', limit = '25', status } = req.query as Record<string, string>;
  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(100, Math.max(1, Number(limit) || 25));
  const where: any = {};
  if (status && status !== 'all') where.status = status;

  const [rows, total] = await Promise.all([
    req.server.prisma.helpdeskFeedback.findMany({
      where,
      include: feedbackInclude,
      orderBy: { createdAt: 'desc' },
      skip: (p - 1) * l,
      take: l,
    }),
    req.server.prisma.helpdeskFeedback.count({ where }),
  ]);
  return reply.send({
    success: true,
    data: rows,
    meta: { total, page: p, limit: l },
    error: null,
  });
}

export async function adminUpdateFeedbackStatusHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const parsed = updateFeedbackStatusSchema.safeParse(req.body);
  if (!parsed.success) return fail(reply, 400, 'invalid_input', parsed.error.message);
  try {
    const updated = await req.server.prisma.helpdeskFeedback.update({
      where: { id },
      data: { status: parsed.data.status },
      include: feedbackInclude,
    });
    return ok(reply, updated);
  } catch (err: any) {
    if (err?.code === 'P2025') return fail(reply, 404, 'not_found', 'Feedback not found.');
    throw err;
  }
}

export async function adminDeleteFeedbackHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  try {
    await req.server.prisma.helpdeskFeedback.delete({ where: { id } });
    return ok(reply, null);
  } catch (err: any) {
    if (err?.code === 'P2025') return fail(reply, 404, 'not_found', 'Feedback not found.');
    throw err;
  }
}

export async function adminDashboardHandler(req: FastifyRequest, reply: FastifyReply) {
  const [
    newTickets,
    inProgressTickets,
    resolvedTickets,
    closedTickets,
    totalFeedback,
    avgRatingRow,
    faqs,
    categories,
  ] = await Promise.all([
    req.server.prisma.helpdeskTicket.count({ where: { status: 'new' } }),
    req.server.prisma.helpdeskTicket.count({ where: { status: 'in_progress' } }),
    req.server.prisma.helpdeskTicket.count({ where: { status: 'resolved' } }),
    req.server.prisma.helpdeskTicket.count({ where: { status: 'closed' } }),
    req.server.prisma.helpdeskFeedback.count(),
    req.server.prisma.helpdeskFeedback.aggregate({
      _avg: { rating: true },
      where: { rating: { not: null } },
    }),
    req.server.prisma.helpdeskFaq.count(),
    req.server.prisma.helpdeskCategory.count(),
  ]);
  return ok(reply, {
    tickets: {
      new: newTickets,
      inProgress: inProgressTickets,
      resolved: resolvedTickets,
      closed: closedTickets,
      total: newTickets + inProgressTickets + resolvedTickets + closedTickets,
    },
    feedback: {
      total: totalFeedback,
      averageRating: avgRatingRow._avg.rating ?? null,
    },
    faqs,
    categories,
  });
}

// ────────────────────────────────────────────────────────────────
// MEMBER-FACING
// ────────────────────────────────────────────────────────────────
export async function getSettingsHandler(req: FastifyRequest, reply: FastifyReply) {
  const row = await req.server.prisma.helpdeskSettings.findFirst({
    where: { status: 'active' },
  });
  return ok(reply, row ?? null);
}

export async function listActiveCategoriesHandler(req: FastifyRequest, reply: FastifyReply) {
  const rows = await req.server.prisma.helpdeskCategory.findMany({
    where: { status: 'active' },
    orderBy: { sortOrder: 'asc' },
  });
  return ok(reply, rows);
}

export async function listFaqsHandler(req: FastifyRequest, reply: FastifyReply) {
  const { categoryId, search } = req.query as Record<string, string>;
  const where: any = { status: 'active' };
  if (categoryId) where.categoryId = categoryId;
  if (search && search.trim()) {
    where.OR = [
      { question: { contains: search.trim(), mode: 'insensitive' } },
      { answer: { contains: search.trim(), mode: 'insensitive' } },
    ];
  }
  const rows = await req.server.prisma.helpdeskFaq.findMany({
    where,
    include: faqInclude,
    orderBy: [{ sortOrder: 'asc' }, { question: 'asc' }],
  });
  return ok(reply, rows);
}

export async function submitTicketHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = submitTicketSchema.safeParse(req.body);
  if (!parsed.success) return fail(reply, 400, 'invalid_input', parsed.error.message);
  const created = await req.server.prisma.helpdeskTicket.create({
    data: {
      ...parsed.data,
      memberId: req.memberId ?? null,
      status: 'new',
    },
  });
  return reply.status(201).send({ success: true, data: created, error: null });
}

export async function myTicketsHandler(req: FastifyRequest, reply: FastifyReply) {
  const rows = await req.server.prisma.helpdeskTicket.findMany({
    where: { memberId: req.memberId! },
    include: { category: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return ok(reply, rows);
}

export async function submitFeedbackHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = submitFeedbackSchema.safeParse(req.body);
  if (!parsed.success) return fail(reply, 400, 'invalid_input', parsed.error.message);
  const created = await req.server.prisma.helpdeskFeedback.create({
    data: {
      ...parsed.data,
      memberId: req.memberId ?? null,
      status: 'new',
    },
  });
  return reply.status(201).send({ success: true, data: created, error: null });
}
