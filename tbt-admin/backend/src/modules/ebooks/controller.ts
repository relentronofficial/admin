/**
 * E-books module — admin CRUD + member library/bookmark/progress.
 *
 * Ported from co-worker's Express admin-app. Same dual-auth pattern
 * as podcasts (Clerk for admin, JWT cookie for members).
 */

import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  createCategorySchema,
  updateCategorySchema,
  createBookSchema,
  updateBookSchema,
  createBannerSchema,
  updateBannerSchema,
  bookmarkSchema,
  progressSchema,
  submitReviewSchema,
  reviewStatusSchema,
} from './schema.js';

function ok(reply: FastifyReply, data: any, extra?: any) {
  return reply.send({ success: true, data, error: null, ...extra });
}
function fail(reply: FastifyReply, status: number, code: string, message: string) {
  return reply.status(status).send({ success: false, data: null, error: { code, message } });
}

const bookInclude = {
  category: { select: { id: true, name: true, slug: true } },
};

// ────────────────────────────────────────────────────────────────
// CATEGORIES — admin
// ────────────────────────────────────────────────────────────────
export async function adminListCategoriesHandler(req: FastifyRequest, reply: FastifyReply) {
  const rows = await req.server.prisma.ebookCategory.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
  return ok(reply, rows);
}

export async function adminCreateCategoryHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = createCategorySchema.safeParse(req.body);
  if (!parsed.success) return fail(reply, 400, 'invalid_input', parsed.error.message);
  try {
    const created = await req.server.prisma.ebookCategory.create({ data: parsed.data });
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
    const updated = await req.server.prisma.ebookCategory.update({
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
    await req.server.prisma.ebookCategory.delete({ where: { id } });
    return ok(reply, null);
  } catch (err: any) {
    if (err?.code === 'P2025') return fail(reply, 404, 'not_found', 'Category not found.');
    throw err;
  }
}

// ────────────────────────────────────────────────────────────────
// BOOKS — admin
// ────────────────────────────────────────────────────────────────
export async function adminListBooksHandler(req: FastifyRequest, reply: FastifyReply) {
  const { page = '1', limit = '50', search = '', categoryId, status } =
    req.query as Record<string, string>;
  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(100, Math.max(1, Number(limit) || 50));

  const where: any = {};
  if (search.trim()) where.title = { contains: search.trim(), mode: 'insensitive' };
  if (categoryId) where.categoryId = categoryId;
  if (status) where.status = status;

  const [rows, total] = await Promise.all([
    req.server.prisma.ebook.findMany({
      where,
      include: bookInclude,
      orderBy: [{ sortOrder: 'asc' }, { publishDate: 'desc' }],
      skip: (p - 1) * l,
      take: l,
    }),
    req.server.prisma.ebook.count({ where }),
  ]);
  return reply.send({
    success: true,
    data: rows,
    meta: { total, page: p, limit: l },
    error: null,
  });
}

export async function adminCreateBookHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = createBookSchema.safeParse(req.body);
  if (!parsed.success) return fail(reply, 400, 'invalid_input', parsed.error.message);
  const { publishDate, batchIds, ...rest } = parsed.data;
  try {
    const created = await req.server.prisma.ebook.create({
      data: {
        ...rest,
        ...(publishDate ? { publishDate: new Date(publishDate) } : {}),
        // Empty array is treated as "no restriction" — persist as null
        // so downstream comparisons stay simple (matches workshop pattern).
        batchIds: batchIds && batchIds.length > 0 ? (batchIds as any) : null,
      },
      include: bookInclude,
    });
    return reply.status(201).send({ success: true, data: created, error: null });
  } catch (err: any) {
    if (err?.code === 'P2002') return fail(reply, 409, 'duplicate_slug', 'Slug already in use.');
    throw err;
  }
}

export async function adminUpdateBookHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const parsed = updateBookSchema.safeParse(req.body);
  if (!parsed.success) return fail(reply, 400, 'invalid_input', parsed.error.message);
  const { publishDate, batchIds, ...rest } = parsed.data;
  try {
    const updated = await req.server.prisma.ebook.update({
      where: { id },
      data: {
        ...rest,
        ...(publishDate ? { publishDate: new Date(publishDate) } : {}),
        // Only touch batchIds when the caller sent the key at all,
        // so a partial PATCH that omits batchIds doesn't clobber it.
        ...(batchIds !== undefined
          ? { batchIds: batchIds && batchIds.length > 0 ? (batchIds as any) : null }
          : {}),
      },
      include: bookInclude,
    });
    return ok(reply, updated);
  } catch (err: any) {
    if (err?.code === 'P2025') return fail(reply, 404, 'not_found', 'Book not found.');
    if (err?.code === 'P2002') return fail(reply, 409, 'duplicate_slug', 'Slug already in use.');
    throw err;
  }
}

export async function adminToggleBookStatusHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const current = await req.server.prisma.ebook.findUnique({ where: { id } });
  if (!current) return fail(reply, 404, 'not_found', 'Book not found.');
  const next = current.status === 'active' ? 'inactive' : 'active';
  const updated = await req.server.prisma.ebook.update({
    where: { id },
    data: { status: next },
    include: bookInclude,
  });
  return ok(reply, updated);
}

export async function adminDeleteBookHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  try {
    await req.server.prisma.ebook.delete({ where: { id } });
    return ok(reply, null);
  } catch (err: any) {
    if (err?.code === 'P2025') return fail(reply, 404, 'not_found', 'Book not found.');
    throw err;
  }
}

// ────────────────────────────────────────────────────────────────
// BANNERS — admin
// ────────────────────────────────────────────────────────────────
export async function adminListBannersHandler(req: FastifyRequest, reply: FastifyReply) {
  const rows = await req.server.prisma.ebookBanner.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  });
  return ok(reply, rows);
}

export async function adminCreateBannerHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = createBannerSchema.safeParse(req.body);
  if (!parsed.success) return fail(reply, 400, 'invalid_input', parsed.error.message);
  const created = await req.server.prisma.ebookBanner.create({ data: parsed.data });
  return reply.status(201).send({ success: true, data: created, error: null });
}

export async function adminUpdateBannerHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const parsed = updateBannerSchema.safeParse(req.body);
  if (!parsed.success) return fail(reply, 400, 'invalid_input', parsed.error.message);
  try {
    const updated = await req.server.prisma.ebookBanner.update({
      where: { id },
      data: parsed.data,
    });
    return ok(reply, updated);
  } catch (err: any) {
    if (err?.code === 'P2025') return fail(reply, 404, 'not_found', 'Banner not found.');
    throw err;
  }
}

export async function adminDeleteBannerHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  try {
    await req.server.prisma.ebookBanner.delete({ where: { id } });
    return ok(reply, null);
  } catch (err: any) {
    if (err?.code === 'P2025') return fail(reply, 404, 'not_found', 'Banner not found.');
    throw err;
  }
}

export async function adminDashboardHandler(req: FastifyRequest, reply: FastifyReply) {
  const [totalBooks, activeBooks, categories, banners, bookmarks, activeReaders] = await Promise.all([
    req.server.prisma.ebook.count(),
    req.server.prisma.ebook.count({ where: { status: 'active' } }),
    req.server.prisma.ebookCategory.count(),
    req.server.prisma.ebookBanner.count(),
    req.server.prisma.ebookBookmark.count(),
    req.server.prisma.ebookProgress.findMany({
      distinct: ['memberId'],
      select: { memberId: true },
    }),
  ]);
  return ok(reply, {
    totalBooks,
    activeBooks,
    inactiveBooks: totalBooks - activeBooks,
    categories,
    banners,
    bookmarks,
    activeReaders: activeReaders.length,
  });
}

// Per-book analytics — one row per admin call. Small enough to
// compute inline (5-6 aggregates); no worker/cron needed. viewCount
// is returned from the Ebook.viewCount column added by P1-6; until
// that lands, it stays at 0 for every book.
export async function adminBookAnalyticsHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };

  const book = await req.server.prisma.ebook.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!book) return fail(reply, 404, 'not_found', 'Book not found.');

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [totalOpens, completedCount, totalBookmarks, activeReaders30d, pageAgg] =
    await Promise.all([
      req.server.prisma.ebookProgress.count({ where: { bookId: id } }),
      req.server.prisma.ebookProgress.count({
        where: { bookId: id, completed: true },
      }),
      req.server.prisma.ebookBookmark.count({ where: { bookId: id } }),
      req.server.prisma.ebookProgress.findMany({
        where: { bookId: id, updatedAt: { gte: thirtyDaysAgo } },
        distinct: ['memberId'],
        select: { memberId: true },
      }),
      req.server.prisma.ebookProgress.aggregate({
        where: { bookId: id },
        _avg: { currentPage: true },
      }),
    ]);

  const avgPageReached = pageAgg._avg.currentPage
    ? Math.round(pageAgg._avg.currentPage)
    : 0;
  const completionRate =
    totalOpens > 0 ? completedCount / totalOpens : 0;

  return ok(reply, {
    totalOpens,
    completedCount,
    completionRate,
    avgPageReached,
    totalBookmarks,
    activeReaders30d: activeReaders30d.length,
    viewCount: 0,
  });
}

// ────────────────────────────────────────────────────────────────
// MEMBER-FACING
// ────────────────────────────────────────────────────────────────
export async function listActiveCategoriesHandler(req: FastifyRequest, reply: FastifyReply) {
  const rows = await req.server.prisma.ebookCategory.findMany({
    where: { status: 'active' },
    orderBy: { sortOrder: 'asc' },
  });
  return ok(reply, rows);
}

// Member-facing publish gate: books with publishDate in the future
// stay hidden until that date. Rows without a publishDate (legacy /
// unscheduled) pass through unchanged.
function publishedFilter(): any {
  return {
    OR: [
      { publishDate: null },
      { publishDate: { lte: new Date() } },
    ],
  };
}

// Per-batch access: null → unrestricted, [] → hidden, [id, ...] →
// only members whose batchId is in the array can open. Never removes
// the row from the list — matches how workshops render locked cards.
function isBookLocked(bookBatchIds: unknown, memberBatchId: string | null): boolean {
  const list = Array.isArray(bookBatchIds) ? (bookBatchIds as string[]) : null;
  if (!list || list.length === 0) return false;
  if (!memberBatchId) return true;
  return !list.includes(memberBatchId);
}

async function getMemberBatchId(req: FastifyRequest): Promise<string | null> {
  if (!req.memberId) return null;
  const m = await req.server.prisma.member.findUnique({
    where: { id: req.memberId },
    select: { batchId: true },
  });
  return m?.batchId ?? null;
}

export async function listFeaturedBooksHandler(req: FastifyRequest, reply: FastifyReply) {
  const memberBatchId = await getMemberBatchId(req);
  const rows = await req.server.prisma.ebook.findMany({
    where: { status: 'active', isFeatured: true, AND: [publishedFilter()] },
    include: bookInclude,
    orderBy: [{ sortOrder: 'asc' }, { publishDate: 'desc' }],
    take: 12,
  });
  const decorated = rows.map((r) => ({
    ...r,
    locked: isBookLocked((r as any).batchIds, memberBatchId),
  }));
  return ok(reply, decorated);
}

export async function listBannersHandler(req: FastifyRequest, reply: FastifyReply) {
  const rows = await req.server.prisma.ebookBanner.findMany({
    where: { status: 'active' },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  });
  return ok(reply, rows);
}

export async function listLibraryHandler(req: FastifyRequest, reply: FastifyReply) {
  const { page = '1', limit = '20', category, search, featured } =
    req.query as Record<string, string>;
  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(100, Math.max(1, Number(limit) || 20));

  const where: any = { status: 'active', AND: [publishedFilter()] };
  if (category && category !== 'all' && category !== 'All') {
    const cat = await req.server.prisma.ebookCategory.findUnique({
      where: { slug: category },
    });
    if (!cat) {
      return reply.send({
        success: true,
        data: [],
        meta: { total: 0, page: p, limit: l },
        error: null,
      });
    }
    where.categoryId = cat.id;
  }
  if (search && search.trim()) {
    // Separate top-level OR for search — Prisma composes top-level AND
    // and OR with an implicit outer AND, so `status AND published-or-null
    // AND (title match OR author match)` is what actually runs.
    where.OR = [
      { title: { contains: search.trim(), mode: 'insensitive' } },
      { author: { contains: search.trim(), mode: 'insensitive' } },
    ];
  }
  if (featured === 'true') where.isFeatured = true;

  const memberBatchId = await getMemberBatchId(req);
  const [rows, total] = await Promise.all([
    req.server.prisma.ebook.findMany({
      where,
      include: bookInclude,
      orderBy: [{ sortOrder: 'asc' }, { publishDate: 'desc' }],
      skip: (p - 1) * l,
      take: l,
    }),
    req.server.prisma.ebook.count({ where }),
  ]);
  const decorated = rows.map((r) => ({
    ...r,
    locked: isBookLocked((r as any).batchIds, memberBatchId),
  }));
  return reply.send({
    success: true,
    data: decorated,
    meta: { total, page: p, limit: l },
    error: null,
  });
}

export async function getBookHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const book = await req.server.prisma.ebook.findFirst({
    where: { id, status: 'active', AND: [publishedFilter()] },
    include: bookInclude,
  });
  if (!book) return fail(reply, 404, 'not_found', 'Book not found.');

  // Batch access: only enforce when the book actually opts into
  // restriction. Members without a batchId get locked out of any
  // restricted book (they haven't been placed in a cohort yet).
  const memberBatchId = await getMemberBatchId(req);
  if (isBookLocked((book as any).batchIds, memberBatchId)) {
    return fail(
      reply,
      403,
      'batch_restricted',
      'This book is available only to members in specific batches.',
    );
  }

  const [progress, bookmark, ratingAgg, myReview] = await Promise.all([
    req.server.prisma.ebookProgress.findUnique({
      where: { memberId_bookId: { memberId: req.memberId!, bookId: id } },
    }),
    req.server.prisma.ebookBookmark.findUnique({
      where: { memberId_bookId: { memberId: req.memberId!, bookId: id } },
    }),
    // Only approved reviews count toward the visible average.
    req.server.prisma.ebookReview.aggregate({
      where: { bookId: id, status: 'approved' },
      _avg: { rating: true },
      _count: { rating: true },
    }),
    // The caller's own review (any status) so the detail page can
    // pre-fill the star widget with what they last submitted.
    req.server.prisma.ebookReview.findUnique({
      where: { memberId_bookId: { memberId: req.memberId!, bookId: id } },
      select: { rating: true, reviewText: true, status: true, updatedAt: true },
    }),
  ]);
  const averageRating = ratingAgg._avg.rating
    ? Number(ratingAgg._avg.rating.toFixed(2))
    : 0;
  const reviewCount = ratingAgg._count.rating;
  return ok(reply, {
    ...book,
    progress: progress ?? null,
    bookmark: bookmark ?? null,
    averageRating,
    reviewCount,
    myReview: myReview ?? null,
  });
}

// One review per (member, book). Re-submitting overwrites the previous
// rating/text and drops back to `pending` so admin has to re-moderate.
export async function memberSubmitReviewHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id: bookId } = req.params as { id: string };
  const parsed = submitReviewSchema.safeParse(req.body);
  if (!parsed.success) return fail(reply, 400, 'invalid_input', parsed.error.message);

  const book = await req.server.prisma.ebook.findFirst({
    where: { id: bookId, status: 'active' },
    select: { id: true, batchIds: true },
  });
  if (!book) return fail(reply, 404, 'not_found', 'Book not found.');

  // Enforce the same batch-restriction on write as on read — otherwise
  // a locked-out member could still poison the review queue.
  const memberBatchId = await getMemberBatchId(req);
  if (isBookLocked((book as any).batchIds, memberBatchId)) {
    return fail(
      reply,
      403,
      'batch_restricted',
      'You cannot review a book that isn\'t available to your batch.',
    );
  }

  const { rating, reviewText } = parsed.data;
  const upserted = await req.server.prisma.ebookReview.upsert({
    where: { memberId_bookId: { memberId: req.memberId!, bookId } },
    create: {
      memberId: req.memberId!,
      bookId,
      rating,
      reviewText: reviewText ?? null,
      status: 'pending',
    },
    update: {
      rating,
      reviewText: reviewText ?? null,
      status: 'pending',
    },
  });
  return ok(reply, upserted);
}

export async function memberListReviewsHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id: bookId } = req.params as { id: string };
  const { page = '1', limit = '20' } = req.query as Record<string, string>;
  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(50, Math.max(1, Number(limit) || 20));

  const [rows, total] = await Promise.all([
    req.server.prisma.ebookReview.findMany({
      where: { bookId, status: 'approved' },
      include: {
        member: {
          select: { id: true, firstName: true, lastName: true, profilePhotoUrl: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
      skip: (p - 1) * l,
      take: l,
    }),
    req.server.prisma.ebookReview.count({
      where: { bookId, status: 'approved' },
    }),
  ]);
  return reply.send({
    success: true,
    data: rows,
    meta: { total, page: p, limit: l },
    error: null,
  });
}

// Admin moderation — default filter is `pending` (the review queue).
export async function adminListReviewsHandler(req: FastifyRequest, reply: FastifyReply) {
  const { status = 'pending', page = '1', limit = '50', bookId } =
    req.query as Record<string, string>;
  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(100, Math.max(1, Number(limit) || 50));

  const where: any = {};
  if (status && status !== 'all') where.status = status;
  if (bookId) where.bookId = bookId;

  const [rows, total] = await Promise.all([
    req.server.prisma.ebookReview.findMany({
      where,
      include: {
        member: {
          select: { id: true, firstName: true, lastName: true, profilePhotoUrl: true },
        },
        book: { select: { id: true, title: true, slug: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (p - 1) * l,
      take: l,
    }),
    req.server.prisma.ebookReview.count({ where }),
  ]);
  return reply.send({
    success: true,
    data: rows,
    meta: { total, page: p, limit: l },
    error: null,
  });
}

export async function adminUpdateReviewStatusHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const parsed = reviewStatusSchema.safeParse(req.body);
  if (!parsed.success) return fail(reply, 400, 'invalid_input', parsed.error.message);
  try {
    const updated = await req.server.prisma.ebookReview.update({
      where: { id },
      data: { status: parsed.data.status },
    });
    return ok(reply, updated);
  } catch (err: any) {
    if (err?.code === 'P2025') return fail(reply, 404, 'not_found', 'Review not found.');
    throw err;
  }
}

export async function upsertBookmarkHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = bookmarkSchema.safeParse(req.body);
  if (!parsed.success) return fail(reply, 400, 'invalid_input', parsed.error.message);
  const { bookId, pageNumber } = parsed.data;

  const book = await req.server.prisma.ebook.findFirst({
    where: { id: bookId, status: 'active' },
    select: { id: true },
  });
  if (!book) return fail(reply, 404, 'not_found', 'Book not found.');

  const upserted = await req.server.prisma.ebookBookmark.upsert({
    where: { memberId_bookId: { memberId: req.memberId!, bookId } },
    create: { memberId: req.memberId!, bookId, pageNumber },
    update: { pageNumber },
  });
  return ok(reply, upserted);
}

export async function deleteBookmarkHandler(req: FastifyRequest, reply: FastifyReply) {
  const { bookId } = req.params as { bookId: string };
  try {
    await req.server.prisma.ebookBookmark.delete({
      where: { memberId_bookId: { memberId: req.memberId!, bookId } },
    });
    return ok(reply, null);
  } catch (err: any) {
    if (err?.code === 'P2025') return fail(reply, 404, 'not_found', 'Bookmark not found.');
    throw err;
  }
}

export async function listBookmarksHandler(req: FastifyRequest, reply: FastifyReply) {
  const rows = await req.server.prisma.ebookBookmark.findMany({
    where: { memberId: req.memberId! },
    include: { book: { include: bookInclude } },
    orderBy: { createdAt: 'desc' },
  });
  return ok(reply, rows);
}

// Streak accounting: today (UTC) = increment when yesterday was the
// last read day, no-op when today was, reset to 1 otherwise. UTC to
// avoid TZ drift when the same member reads across timezones.
function utcDayStart(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

async function bumpReadingStreak(prisma: any, memberId: string): Promise<void> {
  const now = new Date();
  const existing = await prisma.ebookReadingStreak.findUnique({
    where: { memberId },
    select: { currentStreak: true, longestStreak: true, lastReadAt: true },
  });

  const todayStart = utcDayStart(now);
  const lastStart = existing?.lastReadAt
    ? utcDayStart(new Date(existing.lastReadAt))
    : null;

  let nextCurrent: number;
  if (lastStart === null) {
    nextCurrent = 1;
  } else if (lastStart === todayStart) {
    // Already counted today — nothing to change beyond bumping lastReadAt.
    nextCurrent = existing!.currentStreak;
  } else if (todayStart - lastStart === 86_400_000) {
    nextCurrent = existing!.currentStreak + 1;
  } else {
    nextCurrent = 1;
  }
  const nextLongest = Math.max(existing?.longestStreak ?? 0, nextCurrent);

  await prisma.ebookReadingStreak.upsert({
    where: { memberId },
    create: {
      memberId,
      currentStreak: nextCurrent,
      longestStreak: nextLongest,
      lastReadAt: now,
    },
    update: {
      currentStreak: nextCurrent,
      longestStreak: nextLongest,
      lastReadAt: now,
    },
  });
}

export async function submitProgressHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = progressSchema.safeParse(req.body);
  if (!parsed.success) return fail(reply, 400, 'invalid_input', parsed.error.message);
  const { bookId, currentPage, totalPages, completed } = parsed.data;

  const book = await req.server.prisma.ebook.findFirst({
    where: { id: bookId, status: 'active' },
    select: { id: true },
  });
  if (!book) return fail(reply, 404, 'not_found', 'Book not found.');

  const pct = totalPages > 0 ? Math.min(100, Math.round((currentPage / totalPages) * 10000) / 100) : 0;

  const upserted = await req.server.prisma.ebookProgress.upsert({
    where: { memberId_bookId: { memberId: req.memberId!, bookId } },
    create: {
      memberId: req.memberId!,
      bookId,
      currentPage,
      totalPages,
      progressPercentage: pct,
      completed: completed ?? (pct >= 100),
    },
    update: {
      currentPage,
      totalPages,
      progressPercentage: pct,
      completed: completed ?? (pct >= 100),
    },
  });

  // Fire-and-forget: streak update shouldn't block the progress
  // response, and a failure here shouldn't lose the reader's progress.
  bumpReadingStreak(req.server.prisma, req.memberId!).catch((err) => {
    req.log.warn({ err }, 'ebook: reading-streak update failed');
  });

  return ok(reply, upserted);
}

export async function getProgressHandler(req: FastifyRequest, reply: FastifyReply) {
  const { bookId } = req.params as { bookId: string };
  const row = await req.server.prisma.ebookProgress.findUnique({
    where: { memberId_bookId: { memberId: req.memberId!, bookId } },
  });
  return ok(reply, row);
}

// Current + longest streak for the caller. Returns zeros when the
// member has never submitted a progress row.
export async function getReadingStreakHandler(req: FastifyRequest, reply: FastifyReply) {
  const row = await req.server.prisma.ebookReadingStreak.findUnique({
    where: { memberId: req.memberId! },
    select: { currentStreak: true, longestStreak: true, lastReadAt: true },
  });

  // If the last read wasn't today or yesterday, the current streak is
  // effectively broken until the next progress hit. Surface that
  // truth so a UI badge doesn't lie ("5-day streak" when it's really
  // dead).
  if (!row) {
    return ok(reply, { currentStreak: 0, longestStreak: 0, lastReadAt: null });
  }
  const todayStart = utcDayStart(new Date());
  const lastStart = row.lastReadAt ? utcDayStart(new Date(row.lastReadAt)) : null;
  const stillAlive =
    lastStart !== null &&
    (todayStart - lastStart === 0 || todayStart - lastStart === 86_400_000);
  return ok(reply, {
    currentStreak: stillAlive ? row.currentStreak : 0,
    longestStreak: row.longestStreak,
    lastReadAt: row.lastReadAt,
  });
}

export async function continueReadingHandler(req: FastifyRequest, reply: FastifyReply) {
  const rows = await req.server.prisma.ebookProgress.findMany({
    where: {
      memberId: req.memberId!,
      completed: false,
      currentPage: { gt: 0 },
      book: { status: 'active' },
    },
    include: { book: { include: bookInclude } },
    orderBy: { updatedAt: 'desc' },
    take: 20,
  });
  return ok(reply, rows);
}
