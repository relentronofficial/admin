import { z } from 'zod';

export const createTaskSchema = z.object({
  title: z.string(),
  description: z.string(),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']),
  assignedToId: z.string(),
  dueDate: z.string(),
});

export const updateTaskSchema = createTaskSchema.partial();

export const updateTaskStatusSchema = z.object({
  status: z.enum(['Todo', 'InProgress', 'Review', 'Done']),
});

export const assignTaskSchema = z.object({
  adminId: z.string(),
});

export const taskInitiativeSchema = z.object({
  dayNumber: z.string(),
  stepCategory: z.string(),
  taskTitle: z.string(),
  taskDescription: z.string(),
  basePoints: z.number(),
  proofType: z.string(),
  isMilestone: z.boolean(),
  milestoneLabel: z.string().optional(),
  bonusPoints: z.number().optional(),
});
