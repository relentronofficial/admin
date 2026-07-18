import { z } from 'zod';

/** Slug validator — lowercase alphanumeric + hyphens, no spaces. */
const slugSchema = z
  .string()
  .min(1)
  .max(255)
  .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase, digits, or hyphens only');

/** Status values allowed on categories/series/episodes. Kept loose (VARCHAR)
 *  in the schema so future statuses don't require a migration. */
const statusSchema = z.enum(['active', 'inactive', 'draft']);

export const createCategorySchema = z.object({
  name: z.string().min(1).max(255),
  slug: slugSchema,
  status: statusSchema.optional(),
  sortOrder: z.number().int().optional(),
});
export const updateCategorySchema = createCategorySchema.partial();

export const createSeriesSchema = z.object({
  title: z.string().min(1).max(255),
  slug: slugSchema,
  description: z.string().optional().nullable(),
  coverImage: z.string().url().optional().nullable(),
  status: statusSchema.optional(),
  sortOrder: z.number().int().optional(),
});
export const updateSeriesSchema = createSeriesSchema.partial();

export const createEpisodeSchema = z.object({
  title: z.string().min(1).max(255),
  slug: slugSchema,
  description: z.string().optional().nullable(),
  categoryId: z.string().uuid().optional().nullable(),
  seriesId: z.string().uuid().optional().nullable(),
  coverImage: z.string().url().optional().nullable(),
  audioUrl: z.string().url(),
  durationSeconds: z.number().int().min(0).default(0),
  speaker: z.string().max(255).optional().nullable(),
  tags: z.array(z.string()).optional(),
  isFeatured: z.boolean().optional(),
  status: statusSchema.optional(),
  publishDate: z.string().datetime().optional(),
  sortOrder: z.number().int().optional(),
});
export const updateEpisodeSchema = createEpisodeSchema.partial();

export const submitProgressSchema = z.object({
  episodeId: z.string().uuid(),
  currentPositionSeconds: z.number().int().min(0),
  totalDurationSeconds: z.number().int().min(0),
  completed: z.boolean().optional(),
});

export const markCompletedSchema = z.object({
  episodeId: z.string().uuid(),
  totalDurationSeconds: z.number().int().min(0).optional(),
});
