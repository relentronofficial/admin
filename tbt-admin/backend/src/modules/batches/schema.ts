import { z } from 'zod';

export const createBatchSchema = z.object({
  name: z.string().min(1, 'Batch name is required'),
  description: z.string().optional(),
  programId: z.string().uuid().optional().nullable(),
  startsAt: z.string().min(1, 'Start date is required'),
  endsAt: z.string().optional(),
  isActive: z.boolean().default(true),
  xpPerDay: z.number().int().min(0).max(500).default(50).optional(),
});

export const updateBatchSchema = createBatchSchema.partial();

export type CreateBatchBody = z.infer<typeof createBatchSchema>;
export type UpdateBatchBody = z.infer<typeof updateBatchSchema>;

export const upsertBatchDaySchema = z.object({
  title: z.string().optional(),
  notes: z.string().optional(),
  resourceUrl: z.string().optional(),
  category: z.string().optional(),
  tasks: z.array(z.object({
    id: z.string(),
    title: z.string(),
    order: z.number(),
  })).optional(),
});

export const upsertMemberProgressSchema = z.object({
  isCompleted: z.boolean().optional(),
  journalEntry: z.string().optional(),
  journalFileUrl: z.string().optional(),
  completedTaskIds: z.array(z.string()).optional(),
});

export type UpsertBatchDayBody = z.infer<typeof upsertBatchDaySchema>;
export type UpsertMemberProgressBody = z.infer<typeof upsertMemberProgressSchema>;

export const bulkApproveSchema = z.object({
  items: z.array(z.object({
    memberId: z.string().uuid(),
    dayNumber: z.number().int().min(1),
  })).min(1),
});

export type BulkApproveBody = z.infer<typeof bulkApproveSchema>;
