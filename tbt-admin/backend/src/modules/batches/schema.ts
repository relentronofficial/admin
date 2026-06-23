import { z } from 'zod';

export const createBatchSchema = z.object({
  name: z.string().min(1, 'Batch name is required'),
  description: z.string().optional(),
  startsAt: z.string().min(1, 'Start date is required'),
  endsAt: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const updateBatchSchema = createBatchSchema.partial();

export type CreateBatchBody = z.infer<typeof createBatchSchema>;
export type UpdateBatchBody = z.infer<typeof updateBatchSchema>;
