import { z } from 'zod';

const slugSchema = z
  .string()
  .min(1)
  .max(255)
  .regex(/^[a-z0-9-]+$/);

const statusSchema = z.enum(['active', 'inactive']);

const ticketStatusSchema = z.enum([
  'new',
  'acknowledged',
  'in_progress',
  'waiting_for_user',
  'resolved',
  'closed',
]);

// ── Categories ──────────────────────────────────────────────────
export const createCategorySchema = z.object({
  name: z.string().min(1).max(255),
  slug: slugSchema,
  description: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
  status: statusSchema.optional(),
  sortOrder: z.number().int().optional(),
});
export const updateCategorySchema = createCategorySchema.partial();

// ── FAQs ────────────────────────────────────────────────────────
export const createFaqSchema = z.object({
  question: z.string().min(1).max(500),
  answer: z.string().min(1),
  categoryId: z.string().uuid().optional().nullable(),
  status: statusSchema.optional(),
  sortOrder: z.number().int().optional(),
});
export const updateFaqSchema = createFaqSchema.partial();

// ── Settings ────────────────────────────────────────────────────
export const updateSettingsSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  subtitle: z.string().optional().nullable(),
  whatsappNumber: z.string().max(50).optional().nullable(),
  phoneNumber: z.string().max(50).optional().nullable(),
  email: z.string().email().max(255).optional().nullable().or(z.literal('')),
  websiteUrl: z.string().url().optional().nullable().or(z.literal('')),
  supportTiming: z.string().max(255).optional().nullable(),
  address: z.string().optional().nullable(),
  buttonText: z.string().max(100).optional(),
  bannerImage: z.string().url().optional().nullable().or(z.literal('')),
  status: statusSchema.optional(),
  alarmRepeatIntervalSeconds: z.number().int().min(5).max(600).optional(),
  escalationMinutes: z.number().int().min(1).max(1440).optional(),
});

// ── Tickets ─────────────────────────────────────────────────────
export const priorityEnum = z.enum(['low', 'medium', 'high', 'urgent']);
const preferredContactEnum = z.enum(['email', 'whatsapp', 'phone']);

export const submitTicketSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().max(255),
  phone: z.string().max(50).optional().nullable(),
  subject: z.string().min(1).max(255),
  categoryId: z.string().uuid().optional().nullable(),
  message: z.string().min(1),
  attachmentUrl: z.string().url().optional().nullable(),
  attachmentUrls: z.array(z.string().url()).max(10).optional(),
  priority: priorityEnum.optional(),
  preferredContact: preferredContactEnum.optional().nullable(),
});

export const updateTicketStatusSchema = z.object({
  status: ticketStatusSchema,
  adminNotes: z.string().optional().nullable(),
});

export const updateTicketPrioritySchema = z.object({
  priority: priorityEnum,
});

export const assignTicketSchema = z.object({
  assignedTo: z.string().uuid().nullable(),
});

// Admin posts a member-visible (or internal-only) reply. Non-empty appends a
// reply row on the ticket thread; empty string is treated as a no-op.
export const replyTicketSchema = z.object({
  reply: z.string().max(5000),
  isInternal: z.boolean().optional(),
});

// Member posts a follow-up reply on their own ticket.
export const memberReplySchema = z.object({
  body: z.string().min(1).max(5000),
});

// ── Feedback ────────────────────────────────────────────────────
export const submitFeedbackSchema = z.object({
  name: z.string().max(255).optional().nullable(),
  email: z.string().email().max(255).optional().nullable(),
  rating: z.number().int().min(1).max(5).optional().nullable(),
  message: z.string().min(1),
});

export const updateFeedbackStatusSchema = z.object({
  status: ticketStatusSchema,
});
