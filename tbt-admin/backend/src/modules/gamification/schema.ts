import { z } from 'zod';

// ── Levels ──────────────────────────────────────────────────────
export const createLevelSchema = z.object({
  levelNumber: z.number().int().min(1),
  name: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
  requiredPoints: z.number().int().min(0),
  reward: z.string().max(255).optional().nullable(),
  sortOrder: z.number().int().optional(),
});
export const updateLevelSchema = createLevelSchema.partial();

// ── Tasks ───────────────────────────────────────────────────────
export const createTaskSchema = z.object({
  taskOrder: z.number().int().min(1),
  title: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
  requiredAction: z.string().max(255).optional().nullable(),
  rewardPoints: z.number().int().min(0).default(0),
  status: z.enum(['active', 'inactive']).optional(),
  sortOrder: z.number().int().optional(),
});
export const updateTaskSchema = createTaskSchema.partial();

// ── Activity log inserts (admin manual grant) ───────────────────
export const grantPointsSchema = z.object({
  memberId: z.string().uuid(),
  points: z.number().int(),  // allow negative for corrections
  source: z.string().max(50).default('manual_grant'),
});
