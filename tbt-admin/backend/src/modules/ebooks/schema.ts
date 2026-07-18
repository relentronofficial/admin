import { z } from 'zod';

const slugSchema = z
  .string()
  .min(1)
  .max(255)
  .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase, digits, or hyphens only');

const statusSchema = z.enum(['active', 'inactive', 'draft']);

export const createCategorySchema = z.object({
  name: z.string().min(1).max(255),
  slug: slugSchema,
  status: statusSchema.optional(),
  sortOrder: z.number().int().optional(),
});
export const updateCategorySchema = createCategorySchema.partial();

export const createBookSchema = z.object({
  title: z.string().min(1).max(255),
  slug: slugSchema,
  description: z.string().optional().nullable(),
  author: z.string().max(255).optional().nullable(),
  categoryId: z.string().uuid().optional().nullable(),
  coverImage: z.string().url().optional().nullable(),
  pdfUrl: z.string().url().optional().nullable(),
  contentUrl: z.string().url().optional().nullable(),
  totalPages: z.number().int().min(0).default(0),
  readingTime: z.string().max(50).optional().nullable(),
  isFeatured: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  publishDate: z.string().datetime().optional(),
  status: statusSchema.optional(),
});
export const updateBookSchema = createBookSchema.partial();

export const createBannerSchema = z.object({
  title: z.string().min(1).max(255),
  subtitle: z.string().optional().nullable(),
  backgroundImage: z.string().url().optional().nullable(),
  buttonText: z.string().max(100).optional().nullable(),
  buttonLink: z.string().url().optional().nullable(),
  status: statusSchema.optional(),
  sortOrder: z.number().int().optional(),
});
export const updateBannerSchema = createBannerSchema.partial();

export const bookmarkSchema = z.object({
  bookId: z.string().uuid(),
  pageNumber: z.number().int().min(1).optional(),
});

export const progressSchema = z.object({
  bookId: z.string().uuid(),
  currentPage: z.number().int().min(0),
  totalPages: z.number().int().min(0),
  completed: z.boolean().optional(),
});
