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
import { notifyMember } from '../../lib/memberNotifications.js';
import { getActingAdmin, canManageHelpdeskSettings } from '../../lib/adminRole.js';
import { logTicketActivity, listTicketActivity, toMemberSafeActivity } from '../../lib/helpdeskActivityLog.js';
import { canAcknowledge, isValidStatusTransition, type TicketStatus } from '../../lib/helpdeskTicketRules.js';
import {
  createCategorySchema,
  updateCategorySchema,
  createFaqSchema,
  updateFaqSchema,
  updateSettingsSchema,
  submitTicketSchema,
  updateTicketStatusSchema,
  updateTicketPrioritySchema,
  assignTicketSchema,
  replyTicketSchema,
  memberReplySchema,
  submitFeedbackSchema,
  updateFeedbackStatusSchema,
} from './schema.js';

const TICKET_STATUS_LABELS: Record<string, string> = {
  new: 'New',
  acknowledged: 'Acknowledged',
  in_progress: 'In Progress',
  waiting_for_user: 'Waiting for Your Reply',
  resolved: 'Resolved',
  closed: 'Closed',
};

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
  if (
    (parsed.data.alarmRepeatIntervalSeconds !== undefined || parsed.data.escalationMinutes !== undefined)
  ) {
    const actingAdmin = await getActingAdmin(req);
    if (!canManageHelpdeskSettings(actingAdmin?.role)) {
      return fail(reply, 403, 'forbidden', 'Alarm settings are restricted to Admin/Super Admin.');
    }
  }
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
  acknowledgedByAdmin: { select: { id: true, fullName: true } },
  assignedToAdmin: { select: { id: true, fullName: true } },
  replies: {
    orderBy: { createdAt: 'asc' as const },
    select: {
      id: true,
      body: true,
      isFromAdmin: true,
      isInternal: true,
      authorName: true,
      createdAt: true,
    },
  },
};

export async function adminListTicketsHandler(req: FastifyRequest, reply: FastifyReply) {
  const { page = '1', limit = '25', status, categoryId, search, priority, assignedTo, dateFrom, dateTo } =
    req.query as Record<string, string>;
  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(100, Math.max(1, Number(limit) || 25));

  const where: any = {};
  if (status && status !== 'all') where.status = status;
  if (categoryId) where.categoryId = categoryId;
  if (priority && priority !== 'all') where.priority = priority;
  if (assignedTo && assignedTo !== 'all') where.assignedTo = assignedTo === 'unassigned' ? null : assignedTo;
  if (dateFrom || dateTo) {
    where.createdAt = {
      ...(dateFrom && { gte: new Date(dateFrom) }),
      ...(dateTo && { lte: new Date(dateTo) }),
    };
  }
  if (search && search.trim()) {
    const trimmed = search.trim();
    // Accept the ticket's own display format ("#TBT-1024", "TBT-1024") as
    // well as the bare number ("1024") when searching by ticket id.
    const numericPart = trimmed.replace(/^#?\s*TBT-?/i, '').trim();
    const displayNumber = numericPart && !Number.isNaN(Number(numericPart)) ? Number(numericPart) : undefined;
    where.OR = [
      { subject: { contains: trimmed, mode: 'insensitive' } },
      { email: { contains: trimmed, mode: 'insensitive' } },
      { name: { contains: trimmed, mode: 'insensitive' } },
      ...(displayNumber !== undefined ? [{ displayNumber }] : []),
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

/**
 * Enriches a "raised from a group-chat message" ticket with human-readable
 * group/sender names for the admin detail view. Chat-group tables are raw
 * SQL (not Prisma models — see chat-groups/controller.ts), so this is a
 * couple of small targeted lookups rather than a Prisma include. Returns
 * null for ordinary (non-chat) tickets so the frontend can skip the section.
 */
async function loadChatContext(
  req: FastifyRequest,
  ticket: { chatGroupId: string | null; chatMessageId: string | null; chatMessageSenderId: string | null },
) {
  if (!ticket.chatGroupId && !ticket.chatMessageId) return null;

  const [groupRows, senderRow] = await Promise.all([
    ticket.chatGroupId
      ? req.server.prisma.$queryRawUnsafe<Array<{ id: string; name: string }>>(
          `SELECT id, name FROM chat_groups WHERE id = $1::uuid`,
          ticket.chatGroupId,
        )
      : Promise.resolve([]),
    ticket.chatMessageSenderId
      ? req.server.prisma.member.findUnique({
          where: { id: ticket.chatMessageSenderId },
          select: { id: true, firstName: true, lastName: true },
        })
      : Promise.resolve(null),
  ]);

  return {
    groupId: ticket.chatGroupId,
    groupName: groupRows[0]?.name ?? null,
    messageId: ticket.chatMessageId,
    senderMemberId: ticket.chatMessageSenderId,
    senderName: senderRow
      ? [senderRow.firstName, senderRow.lastName].filter(Boolean).join(' ') || 'Member'
      : ticket.chatMessageSenderId
        ? 'Deleted member'
        : null,
  };
}

export async function adminGetTicketHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const row = await req.server.prisma.helpdeskTicket.findUnique({
    where: { id },
    include: ticketInclude,
  });
  if (!row) return fail(reply, 404, 'not_found', 'Ticket not found.');
  const [chatContext, activityLog] = await Promise.all([
    loadChatContext(req, row),
    listTicketActivity(req.server.prisma, id),
  ]);
  return ok(reply, { ...row, chatContext, activityLog });
}

/** Member-visible copy per status, used by both the status-update and
 *  acknowledge/assign/priority handlers below. */
const MEMBER_STATUS_MESSAGES: Partial<Record<TicketStatus, string>> = {
  acknowledged: 'Our support team has seen your ticket and will get back to you shortly.',
  waiting_for_user: 'We need more information from you to continue — please reply on your ticket.',
  resolved: 'Your support ticket has been marked resolved.',
  closed: 'Your support ticket has been closed.',
};

export async function adminUpdateTicketStatusHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const parsed = updateTicketStatusSchema.safeParse(req.body);
  if (!parsed.success) return fail(reply, 400, 'invalid_input', parsed.error.message);

  const before = await req.server.prisma.helpdeskTicket.findUnique({
    where: { id },
    select: { status: true, memberId: true, subject: true, resolvedAt: true, closedAt: true },
  });
  if (!before) return fail(reply, 404, 'not_found', 'Ticket not found.');

  const nextStatus = parsed.data.status;
  if (!isValidStatusTransition(before.status as TicketStatus, nextStatus as TicketStatus)) {
    return fail(
      reply,
      400,
      'invalid_transition',
      before.status === 'new'
        ? 'A new ticket must be acknowledged before its status can change.'
        : `Cannot move a ticket from ${before.status} to ${nextStatus}.`,
    );
  }

  const actingAdmin = await getActingAdmin(req);
  const now = new Date();
  try {
    const updated = await req.server.prisma.helpdeskTicket.update({
      where: { id },
      data: {
        status: nextStatus,
        ...(parsed.data.adminNotes !== undefined && { adminNotes: parsed.data.adminNotes }),
        ...(nextStatus === 'resolved' && !before.resolvedAt && { resolvedAt: now }),
        ...(nextStatus === 'closed' && !before.closedAt && { closedAt: now }),
      },
      include: ticketInclude,
    });

    void logTicketActivity(req.server.prisma, {
      ticketId: id,
      actorType: 'admin',
      actorId: actingAdmin?.id ?? null,
      action: 'status_changed',
      previousValue: before.status,
      newValue: nextStatus,
    });

    const memberMessage = MEMBER_STATUS_MESSAGES[nextStatus as TicketStatus];
    if (before.memberId && memberMessage) {
      void notifyMember(req.server.prisma, req.server.io, req.server.redis ?? null, {
        memberId: before.memberId,
        title: `Ticket ${TICKET_STATUS_LABELS[nextStatus] ?? nextStatus}`,
        message: memberMessage,
        type: 'helpdesk_status',
        actionUrl: `/support/tickets/${id}`,
      });
    }
    req.server.io.to('admin').emit('admin:helpdesk_ticket_updated', { ticketId: id, status: nextStatus });

    return ok(reply, updated);
  } catch (err: any) {
    if (err?.code === 'P2025') return fail(reply, 404, 'not_found', 'Ticket not found.');
    throw err;
  }
}

/**
 * Dedicated "ACKNOWLEDGE & STOP ALARM" action — the only path (besides
 * replying to a new ticket, below) that may move a ticket out of 'new'.
 * Broadcasts admin:helpdesk_ticket_acknowledged so every connected Account
 * Team client stops *this ticket's* alarm immediately, independent of any
 * other unacknowledged ticket.
 */
export async function acknowledgeTicketHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const before = await req.server.prisma.helpdeskTicket.findUnique({
    where: { id },
    select: { status: true, memberId: true },
  });
  if (!before) return fail(reply, 404, 'not_found', 'Ticket not found.');
  if (!canAcknowledge(before.status as TicketStatus)) {
    return fail(reply, 400, 'invalid_transition', 'Ticket has already been acknowledged.');
  }

  const actingAdmin = await getActingAdmin(req);
  const now = new Date();
  const updated = await req.server.prisma.helpdeskTicket.update({
    where: { id },
    data: { status: 'acknowledged', acknowledgedAt: now, acknowledgedBy: actingAdmin?.id ?? null },
    include: ticketInclude,
  });

  void logTicketActivity(req.server.prisma, {
    ticketId: id,
    actorType: 'admin',
    actorId: actingAdmin?.id ?? null,
    action: 'acknowledged',
    previousValue: 'new',
    newValue: 'acknowledged',
  });

  req.server.io.to('admin').emit('admin:helpdesk_ticket_acknowledged', {
    ticketId: id,
    acknowledgedBy: actingAdmin?.id ?? null,
    acknowledgedByName: actingAdmin?.fullName ?? null,
    acknowledgedAt: now,
  });

  if (before.memberId) {
    void notifyMember(req.server.prisma, req.server.io, req.server.redis ?? null, {
      memberId: before.memberId,
      title: 'Ticket Acknowledged',
      message: MEMBER_STATUS_MESSAGES.acknowledged!,
      type: 'helpdesk_status',
      actionUrl: `/support/tickets/${id}`,
    });
  }

  return ok(reply, updated);
}

export async function assignTicketHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const parsed = assignTicketSchema.safeParse(req.body);
  if (!parsed.success) return fail(reply, 400, 'invalid_input', parsed.error.message);

  const before = await req.server.prisma.helpdeskTicket.findUnique({
    where: { id },
    select: { memberId: true, assignedTo: true },
  });
  if (!before) return fail(reply, 404, 'not_found', 'Ticket not found.');

  const actingAdmin = await getActingAdmin(req);
  const updated = await req.server.prisma.helpdeskTicket.update({
    where: { id },
    data: { assignedTo: parsed.data.assignedTo },
    include: ticketInclude,
  });

  void logTicketActivity(req.server.prisma, {
    ticketId: id,
    actorType: 'admin',
    actorId: actingAdmin?.id ?? null,
    action: 'assigned',
    previousValue: before.assignedTo,
    newValue: parsed.data.assignedTo,
  });
  req.server.io.to('admin').emit('admin:helpdesk_ticket_updated', { ticketId: id, assignedTo: parsed.data.assignedTo });

  if (before.memberId && parsed.data.assignedTo) {
    void notifyMember(req.server.prisma, req.server.io, req.server.redis ?? null, {
      memberId: before.memberId,
      title: 'Ticket Assigned',
      message: 'Your support ticket has been assigned to a team member.',
      type: 'helpdesk_status',
      actionUrl: `/support/tickets/${id}`,
    });
  }

  return ok(reply, updated);
}

export async function updateTicketPriorityHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const parsed = updateTicketPrioritySchema.safeParse(req.body);
  if (!parsed.success) return fail(reply, 400, 'invalid_input', parsed.error.message);

  const before = await req.server.prisma.helpdeskTicket.findUnique({ where: { id }, select: { priority: true } });
  if (!before) return fail(reply, 404, 'not_found', 'Ticket not found.');

  const actingAdmin = await getActingAdmin(req);
  const updated = await req.server.prisma.helpdeskTicket.update({
    where: { id },
    data: { priority: parsed.data.priority },
    include: ticketInclude,
  });

  void logTicketActivity(req.server.prisma, {
    ticketId: id,
    actorType: 'admin',
    actorId: actingAdmin?.id ?? null,
    action: 'priority_changed',
    previousValue: before.priority,
    newValue: parsed.data.priority,
  });
  req.server.io.to('admin').emit('admin:helpdesk_ticket_updated', { ticketId: id, priority: parsed.data.priority });

  return ok(reply, updated);
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
  const isInternal = parsed.data.isInternal === true;
  try {
    const before = await req.server.prisma.helpdeskTicket.findUnique({
      where: { id },
      select: { status: true, memberId: true, subject: true },
    });
    if (!before) return fail(reply, 404, 'not_found', 'Ticket not found.');

    // Resolve author display name from the Clerk-authed admin, so the
    // thread bubble can label who replied. Falls back to "Support" if
    // the admin isn't found in the mirrored Admin table.
    const actingAdmin = await req.server.prisma.admin.findUnique({
      where: { clerkId: req.user },
      select: { id: true, fullName: true, email: true },
    });
    const authorName = actingAdmin?.fullName || actingAdmin?.email || 'Support';

    // A reply to a still-new ticket counts as engaging with it — this is
    // the one other path (besides the dedicated Acknowledge button) that
    // may leave 'new' (see helpdeskTicketRules.ts). Internal notes never
    // touch status/alarm — they're not member-visible engagement.
    const implicitlyAcknowledges = !isInternal && before.status === 'new';

    // Append the thread row, then update the ticket's mirrored scalars
    // and status in a single transaction so nothing else races between.
    const [updated] = await req.server.prisma.$transaction([
      req.server.prisma.helpdeskTicket.update({
        where: { id },
        data: {
          ...(!isInternal && { adminReply: trimmedReply, adminRepliedAt: new Date() }),
          ...(implicitlyAcknowledges && {
            status: 'acknowledged',
            acknowledgedAt: new Date(),
            acknowledgedBy: actingAdmin?.id ?? null,
          }),
        },
        include: ticketInclude,
      }),
      req.server.prisma.helpdeskTicketReply.create({
        data: {
          ticketId: id,
          body: trimmedReply,
          isFromAdmin: true,
          isInternal,
          authorName,
        },
      }),
    ]);

    if (implicitlyAcknowledges) {
      void logTicketActivity(req.server.prisma, {
        ticketId: id,
        actorType: 'admin',
        actorId: actingAdmin?.id ?? null,
        action: 'acknowledged',
        previousValue: 'new',
        newValue: 'acknowledged',
      });
      req.server.io.to('admin').emit('admin:helpdesk_ticket_acknowledged', {
        ticketId: id,
        acknowledgedBy: actingAdmin?.id ?? null,
        acknowledgedByName: actingAdmin?.fullName ?? null,
        acknowledgedAt: new Date(),
      });
    }
    void logTicketActivity(req.server.prisma, {
      ticketId: id,
      actorType: 'admin',
      actorId: actingAdmin?.id ?? null,
      action: isInternal ? 'internal_note_added' : 'replied',
    });

    // Notify the member — skipped entirely for internal notes, which are
    // never member-visible. Uses the notifyMember helper (AppNotification +
    // socket), not the dead `prisma.notification.create` table the member
    // notification center never reads.
    if (before.memberId && !isInternal) {
      void notifyMember(req.server.prisma, req.server.io, req.server.redis ?? null, {
        memberId: before.memberId,
        title: 'Support replied to your ticket',
        message: before.subject,
        type: 'helpdesk_reply',
        actionUrl: `/support/tickets/${id}`,
      });
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
    acknowledgedTickets,
    inProgressTickets,
    waitingForUserTickets,
    resolvedTickets,
    closedTickets,
    totalFeedback,
    avgRatingRow,
    faqs,
    categories,
  ] = await Promise.all([
    req.server.prisma.helpdeskTicket.count({ where: { status: 'new' } }),
    req.server.prisma.helpdeskTicket.count({ where: { status: 'acknowledged' } }),
    req.server.prisma.helpdeskTicket.count({ where: { status: 'in_progress' } }),
    req.server.prisma.helpdeskTicket.count({ where: { status: 'waiting_for_user' } }),
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
      acknowledged: acknowledgedTickets,
      inProgress: inProgressTickets,
      waitingForUser: waitingForUserTickets,
      resolved: resolvedTickets,
      closed: closedTickets,
      total:
        newTickets +
        acknowledgedTickets +
        inProgressTickets +
        waitingForUserTickets +
        resolvedTickets +
        closedTickets,
    },
    feedback: {
      total: totalFeedback,
      averageRating: avgRatingRow._avg.rating ?? null,
    },
    faqs,
    categories,
  });
}

/**
 * Analytics — restricted to admin/super_admin (see canManageHelpdeskSettings).
 * Read-only raw-SQL aggregation; no side effects.
 */
export async function adminAnalyticsHandler(req: FastifyRequest, reply: FastifyReply) {
  const actingAdmin = await getActingAdmin(req);
  if (!canManageHelpdeskSettings(actingAdmin?.role)) {
    return fail(reply, 403, 'forbidden', 'Analytics is restricted to Admin/Super Admin.');
  }

  const prisma = req.server.prisma;
  const [
    byStatus,
    byPriority,
    byCategory,
    avgTimes,
    byAssignee,
  ] = await Promise.all([
    prisma.helpdeskTicket.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.helpdeskTicket.groupBy({ by: ['priority'], _count: { _all: true } }),
    prisma.$queryRawUnsafe<Array<{ category_name: string | null; count: bigint }>>(`
      SELECT c.name AS category_name, COUNT(t.id) AS count
        FROM helpdesk_tickets t
        LEFT JOIN helpdesk_categories c ON c.id = t.category_id
       GROUP BY c.name
    `),
    prisma.$queryRawUnsafe<Array<{ avg_ack_seconds: number | null; avg_resolution_seconds: number | null }>>(`
      SELECT
        AVG(EXTRACT(EPOCH FROM (acknowledged_at - created_at))) FILTER (WHERE acknowledged_at IS NOT NULL) AS avg_ack_seconds,
        AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))) FILTER (WHERE resolved_at IS NOT NULL) AS avg_resolution_seconds
      FROM helpdesk_tickets
    `),
    prisma.$queryRawUnsafe<Array<{ admin_id: string; admin_name: string; ticket_count: bigint; avg_resolution_seconds: number | null }>>(`
      SELECT a.id AS admin_id, a.full_name AS admin_name, COUNT(t.id) AS ticket_count,
             AVG(EXTRACT(EPOCH FROM (t.resolved_at - t.created_at))) FILTER (WHERE t.resolved_at IS NOT NULL) AS avg_resolution_seconds
        FROM helpdesk_tickets t
        JOIN admins a ON a.id = t.assigned_to
       GROUP BY a.id, a.full_name
       ORDER BY ticket_count DESC
    `),
  ]);

  const totalTickets = byStatus.reduce((sum, r) => sum + r._count._all, 0);

  return ok(reply, {
    totalTickets,
    byStatus: byStatus.map((r) => ({ status: r.status, count: r._count._all })),
    byPriority: byPriority.map((r) => ({ priority: r.priority, count: r._count._all })),
    byCategory: byCategory.map((r) => ({ category: r.category_name ?? 'Uncategorized', count: Number(r.count) })),
    avgAcknowledgeSeconds: avgTimes[0]?.avg_ack_seconds ?? null,
    avgResolutionSeconds: avgTimes[0]?.avg_resolution_seconds ?? null,
    teamPerformance: byAssignee.map((r) => ({
      adminId: r.admin_id,
      adminName: r.admin_name,
      ticketCount: Number(r.ticket_count),
      avgResolutionSeconds: r.avg_resolution_seconds,
    })),
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
  void logTicketActivity(req.server.prisma, {
    ticketId: created.id,
    actorType: req.memberId ? 'member' : 'system',
    actorId: req.memberId ?? null,
    action: 'created',
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
      // Internal (Account-Team-only) notes must never reach the member.
      replies: {
        where: { isInternal: false },
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
  const activityLog = toMemberSafeActivity(await listTicketActivity(req.server.prisma, id));
  return ok(reply, { ...row, activityLog });
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
  void logTicketActivity(req.server.prisma, {
    ticketId: id,
    actorType: 'member',
    actorId: req.memberId ?? null,
    action: 'replied',
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
