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
  const { publishDate, ...rest } = parsed.data;
  try {
    const created = await req.server.prisma.ebook.create({
      data: {
        ...rest,
        ...(publishDate ? { publishDate: new Date(publishDate) } : {}),
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
  const { publishDate, ...rest } = parsed.data;
  try {
    const updated = await req.server.prisma.ebook.update({
      where: { id },
      data: {
        ...rest,
        ...(publishDate ? { publishDate: new Date(publishDate) } : {}),
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

export async function listFeaturedBooksHandler(req: FastifyRequest, reply: FastifyReply) {
  const rows = await req.server.prisma.ebook.findMany({
    where: { status: 'active', isFeatured: true },
    include: bookInclude,
    orderBy: [{ sortOrder: 'asc' }, { publishDate: 'desc' }],
    take: 12,
  });
  return ok(reply, rows);
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

  const where: any = { status: 'active' };
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
    where.OR = [
      { title: { contains: search.trim(), mode: 'insensitive' } },
      { author: { contains: search.trim(), mode: 'insensitive' } },
    ];
  }
  if (featured === 'true') where.isFeatured = true;

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

export async function getBookHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const book = await req.server.prisma.ebook.findFirst({
    where: { id, status: 'active' },
    include: bookInclude,
  });
  if (!book) return fail(reply, 404, 'not_found', 'Book not found.');

  const [progress, bookmark] = await Promise.all([
    req.server.prisma.ebookProgress.findUnique({
      where: { memberId_bookId: { memberId: req.memberId!, bookId: id } },
    }),
    req.server.prisma.ebookBookmark.findUnique({
      where: { memberId_bookId: { memberId: req.memberId!, bookId: id } },
    }),
  ]);
  return ok(reply, { ...book, progress: progress ?? null, bookmark: bookmark ?? null });
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
  return ok(reply, upserted);
}

export async function getProgressHandler(req: FastifyRequest, reply: FastifyReply) {
  const { bookId } = req.params as { bookId: string };
  const row = await req.server.prisma.ebookProgress.findUnique({
    where: { memberId_bookId: { memberId: req.memberId!, bookId } },
  });
  return ok(reply, row);
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
