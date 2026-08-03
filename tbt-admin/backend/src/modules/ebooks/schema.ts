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
  // Per-batch access control — omit / send null = available to all;
  // send [uuid, ...] = restrict to those batches only.
  batchIds: z.array(z.string().uuid()).optional().nullable(),
  // Pin the book to the top of the library. Send null / omit to
  // unpin. pinnedUntil auto-expires the pin visually on the client
  // (row keeps its DB position; only the badge hides).
  pinnedAt: z.string().datetime().optional().nullable(),
  pinnedUntil: z.string().datetime().optional().nullable(),
  // Multi-part series membership. seriesId links to EbookSeries;
  // seriesNumber is 1-indexed and drives sibling ordering.
  seriesId: z.string().uuid().optional().nullable(),
  seriesNumber: z.number().int().min(1).optional().nullable(),
  // Optional managed-author FK. Legacy `author` string still works
  // for un-linked rows.
  authorId: z.string().uuid().optional().nullable(),
  // Publisher metadata.
  isbn: z.string().trim().max(32).optional().nullable(),
  language: z.string().trim().max(16).optional().nullable(),
  publisherId: z.string().uuid().optional().nullable(),
});
export const updateBookSchema = createBookSchema.partial();

// Series CRUD — small model, same slug regex as categories.
export const createSeriesSchema = z.object({
  title: z.string().min(1).max(255),
  slug: slugSchema,
  description: z.string().optional().nullable(),
  coverUrl: z.string().url().optional().nullable(),
});
export const updateSeriesSchema = createSeriesSchema.partial();

// Author CRUD.
export const createAuthorSchema = z.object({
  name: z.string().min(1).max(255),
  slug: slugSchema,
  bio: z.string().optional().nullable(),
  photoUrl: z.string().url().optional().nullable(),
});
export const updateAuthorSchema = createAuthorSchema.partial();

// Publisher CRUD.
export const createPublisherSchema = z.object({
  name: z.string().min(1).max(255),
  slug: slugSchema,
  logoUrl: z.string().url().optional().nullable(),
  country: z.string().trim().max(64).optional().nullable(),
});
export const updatePublisherSchema = createPublisherSchema.partial();

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

// One row per (member, book). Re-submitting overwrites the previous
// rating/text and drops back to `pending` for admin moderation.
export const submitReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  reviewText: z.string().trim().max(4000).optional().nullable(),
});

export const reviewStatusSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']),
});

// Bulk CSV import. Client parses the CSV in the browser and sends a
// JSON array of rows — keeps this endpoint content-type simple and
// avoids adding a multipart parser to the backend.
export const bulkImportBooksSchema = z.object({
  dryRun: z.boolean().optional(),
  rows: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(255),
        author: z.string().trim().max(255).optional().nullable(),
        // Free-form: slug OR display name; matched case-insensitively
        // against EbookCategory.slug then .name. Null / empty leaves
        // the book uncategorised.
        category: z.string().trim().optional().nullable(),
        totalPages: z.number().int().min(0).optional(),
        pdfUrl: z.string().url().optional().nullable(),
        coverUrl: z.string().url().optional().nullable(),
      }),
    )
    .min(1)
    .max(500),
});
