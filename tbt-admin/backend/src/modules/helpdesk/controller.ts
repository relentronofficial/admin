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
import { createAdminNotification } from '../../lib/adminNotifications.js';
import {
  createCategorySchema,
  updateCategorySchema,
  createFaqSchema,
  updateFaqSchema,
  updateSettingsSchema,
  submitTicketSchema,
  updateTicketStatusSchema,
  replyTicketSchema,
  memberReplySchema,
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
  replies: {
    orderBy: { createdAt: 'asc' as const },
    select: {
      id: true,
      body: true,
      isFromAdmin: true,
      authorName: true,
      createdAt: true,
    },
  },
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

/**
 * Admin posts a member-visible reply to a ticket. Each non-empty reply
 * appends a new row to helpdesk_ticket_replies so the member sees a
 * chat-style thread on My Tickets → Detail. We also keep the legacy
 * `admin_reply` / `admin_replied_at` scalar columns updated (they mirror
 * the most recent admin reply) for older clients that predate the
 * thread rollout. Empty body is a no-op — clearing must be done via
 * ticket delete or a future dedicated endpoint.
 */
export async function adminReplyTicketHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const parsed = replyTicketSchema.safeParse(req.body);
  if (!parsed.success) return fail(reply, 400, 'invalid_input', parsed.error.message);
  const trimmedReply = parsed.data.reply.trim();
  if (trimmedReply.length === 0) {
    return fail(reply, 400, 'invalid_input', 'Reply body is required.');
  }
  try {
    const before = await req.server.prisma.helpdeskTicket.findUnique({
      where: { id },
      select: { status: true, memberId: true, subject: true },
    });
    if (!before) return fail(reply, 404, 'not_found', 'Ticket not found.');

    // Resolve author display name from the Clerk-authed admin, so the
    // thread bubble can label who replied. Falls back to "Support" if
    // the admin isn't found in the mirrored Admin table.
    let authorName = 'Support';
    const clerkId = req.user as string | undefined;
    if (clerkId) {
      const admin = await req.server.prisma.admin.findUnique({
        where: { clerkId },
        select: { fullName: true, email: true },
      });
      authorName = admin?.fullName || admin?.email || 'Support';
    }

    // Append the thread row, then update the ticket's mirrored scalars
    // and status in a single transaction so nothing else races between.
    const [updated] = await req.server.prisma.$transaction([
      req.server.prisma.helpdeskTicket.update({
        where: { id },
        data: {
          adminReply: trimmedReply,
          adminRepliedAt: new Date(),
          ...(before.status === 'new' ? { status: 'in_progress' } : {}),
        },
        include: ticketInclude,
      }),
      req.server.prisma.helpdeskTicketReply.create({
        data: {
          ticketId: id,
          body: trimmedReply,
          isFromAdmin: true,
          authorName,
        },
      }),
    ]);

    // Notify the member (if this ticket is linked to a member row)
    // — mirrors the admin_notifications pattern but on the member side.
    if (before.memberId) {
      req.server.io.to(`user:${before.memberId}`).emit('notification', {
        type: 'helpdesk_reply',
        title: 'Support replied to your ticket',
        body: before.subject,
        metadata: { ticketId: id },
      });
      try {
        await req.server.prisma.notification.create({
          data: {
            memberId: before.memberId,
            // NotificationType enum has no helpdesk-specific value; use
            // `system` and carry the semantic subtype in `data`.
            type: 'system',
            title: 'Support replied to your ticket',
            body: before.subject,
            data: { kind: 'helpdesk_reply', ticketId: id } as any,
          },
        });
      } catch (err) {
        req.server.log.warn({ err, ticketId: id }, 'Failed to persist helpdesk_reply notification');
      }
    }
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

/** Single-FAQ fetch by id — powers notification / deep-link handling on
 *  the member side. 404s inactive FAQs so a notification pointing to a
 *  deprecated FAQ doesn't render stale content. */
export async function getFaqByIdHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const row = await req.server.prisma.helpdeskFaq.findFirst({
    where: { id, status: 'active' },
    include: faqInclude,
  });
  if (!row) return fail(reply, 404, 'not_found', 'FAQ not found.');
  return ok(reply, row);
}

export async function submitTicketHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = submitTicketSchema.safeParse(req.body);
  if (!parsed.success) return fail(reply, 400, 'invalid_input', parsed.error.message);

  // Merge legacy single attachment + new multi array into one canonical
  // list. Older clients (pre-multi-attach rollout) send `attachmentUrl`;
  // newer clients send `attachmentUrls`. Store both so both clients can
  // read whatever they expect.
  const attachmentUrls = [
    ...(parsed.data.attachmentUrls ?? []),
    ...(parsed.data.attachmentUrl ? [parsed.data.attachmentUrl] : []),
  ];
  const legacyAttachmentUrl = attachmentUrls[0] ?? null;

  const created = await req.server.prisma.helpdeskTicket.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      subject: parsed.data.subject,
      categoryId: parsed.data.categoryId,
      message: parsed.data.message,
      attachmentUrl: legacyAttachmentUrl,
      attachmentUrls: attachmentUrls.length > 0 ? (attachmentUrls as any) : undefined,
      priority: parsed.data.priority ?? 'medium',
      preferredContact: parsed.data.preferredContact ?? null,
      memberId: req.memberId ?? null,
      status: 'new',
    },
  });
  // Notify admins in real time — DB row for the notification bell +
  // socket event for any admin currently viewing /support.
  req.server.io.to('admin').emit('admin:helpdesk_ticket', {
    ticketId: created.id,
    subject: created.subject,
    submitterName: created.name,
    createdAt: created.createdAt,
  });
  void createAdminNotification(req.server.prisma, {
    title: 'New Support Ticket',
    body: `${created.name}: ${created.subject}`,
    type: 'helpdesk_ticket',
    metadata: { ticketId: created.id },
  });
  return reply.status(201).send({ success: true, data: created, error: null });
}

/**
 * Member-facing fetch of a single ticket + its full reply thread.
 * 404s tickets that aren't owned by the caller so a member can't
 * probe for other people's tickets by guessing UUIDs.
 */
export async function getMyTicketDetailHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const row = await req.server.prisma.helpdeskTicket.findFirst({
    where: { id, memberId: req.memberId! },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      replies: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          body: true,
          isFromAdmin: true,
          authorName: true,
          createdAt: true,
        },
      },
    },
  });
  if (!row) return fail(reply, 404, 'not_found', 'Ticket not found.');
  return ok(reply, row);
}

/**
 * Member posts a follow-up reply on their own ticket. If the ticket
 * was already 'resolved' or 'closed', re-opens it so the admin sees
 * the incoming message in their new-ticket queue. Emits an admin
 * notification.
 */
export async function postMemberReplyHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const parsed = memberReplySchema.safeParse(req.body);
  if (!parsed.success) return fail(reply, 400, 'invalid_input', parsed.error.message);

  const ticket = await req.server.prisma.helpdeskTicket.findFirst({
    where: { id, memberId: req.memberId! },
    select: { id: true, status: true, subject: true, name: true },
  });
  if (!ticket) return fail(reply, 404, 'not_found', 'Ticket not found.');

  const shouldReopen =
    ticket.status === 'resolved' || ticket.status === 'closed';

  const [, created] = await req.server.prisma.$transaction([
    req.server.prisma.helpdeskTicket.update({
      where: { id },
      data: shouldReopen ? { status: 'in_progress' } : {},
    }),
    req.server.prisma.helpdeskTicketReply.create({
      data: {
        ticketId: id,
        body: parsed.data.body.trim(),
        isFromAdmin: false,
        authorName: ticket.name,
        memberId: req.memberId!,
      },
    }),
  ]);

  req.server.io.to('admin').emit('admin:helpdesk_ticket', {
    ticketId: id,
    subject: ticket.subject,
    submitterName: ticket.name,
    replyId: created.id,
    kind: 'follow_up',
  });
  void createAdminNotification(req.server.prisma, {
    title: 'Member replied on a ticket',
    body: `${ticket.name}: ${ticket.subject}`,
    type: 'helpdesk_ticket',
    metadata: { ticketId: id },
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
  const displayName = created.name && created.name.length > 0 ? created.name : 'A member';
  req.server.io.to('admin').emit('admin:helpdesk_feedback', {
    feedbackId: created.id,
    rating: created.rating,
    createdAt: created.createdAt,
  });
  void createAdminNotification(req.server.prisma, {
    title: 'New Feedback Received',
    body: created.rating != null
      ? `${displayName} rated ${created.rating}/5`
      : `${displayName} submitted feedback`,
    type: 'helpdesk_feedback',
    metadata: { feedbackId: created.id },
  });
  return reply.status(201).send({ success: true, data: created, error: null });
}
