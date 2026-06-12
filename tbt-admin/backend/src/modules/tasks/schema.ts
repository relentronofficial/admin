import { z } from 'zod';

export const taskInitiativeSchema = z.object({
  programId: z.string(),
  stepId: z.string().optional(),
  dayNumber: z.number().int().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  deliverables: z.string().optional(),
  contentUrl: z.string().optional(),
  basePoints: z.number().int().default(100),
  proofType: z.string().default('text'),
  estimatedMinutes: z.number().int().default(15),
  isMilestone: z.boolean().default(false),
  milestoneLabel: z.string().optional(),
  bonusPoints: z.number().int().default(0),
  sortOrder: z.number().int().default(0),
});

export const updateTaskSchema = taskInitiativeSchema.partial().omit({ programId: true });
