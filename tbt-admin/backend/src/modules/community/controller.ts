import type { FastifyReply, FastifyRequest } from 'fastify';
import { createPostSchema, updatePostPinSchema, submitPostSchema, approvePostSchema } from './schema.js';

// ── Member-facing: submit + list approved feed (Module 9A) ─────────
//
// Filters (v2, item #3):
//   * `all` (default) — approved active posts
//   * `mentors`       — approved + isMentor=true
//   * `mine`          — memberId=me (any status, including pending so the
//                        author sees their own not-yet-approved posts)
//   * `following`     — posts by members I follow; returns [] until
//                        the member_connections table lands (item #21)
export async function memberListFeedHandler(request: FastifyRequest, reply: FastifyReply) {
  const { page = 1, limit = 20, filter = 'all' } = request.query as any;
  const memberId = request.memberId;

  const where: Record<string, unknown> = { status: 'active' };
  switch (filter) {
    case 'mentors':
      where.isApproved = true;
      where.isMentor = true;
      break;
    case 'mine':
      // Author sees their own posts including pending — no isApproved
      // filter here.
      where.memberId = memberId;
      break;
    case 'following':
      // Not yet wired — return an empty page.
      return reply.send({
        success: true,
        data: [],
        meta: { total: 0, page: Number(page), limit: Number(limit) },
        error: null,
      });
    case 'all':
    default:
      where.isApproved = true;
      break;
  }

  const [posts, total] = await Promise.all([
    request.server.prisma.post.findMany({
      where: where as any,
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
      orderBy: [{ isPinned: 'desc' }, { isMentor: 'desc' }, { createdAt: 'desc' }],
      include: {
        member: {
          select: { id: true, firstName: true, lastName: true, profilePhotoUrl: true },
        },
      },
    }),
    request.server.prisma.post.count({ where: where as any }),
  ]);

  // Attach `isLikedByMe` per post — a single query joined in memory
  // avoids N+1. Wrapped in try/catch so any Prisma-side hiccup on the
  // Like table degrades gracefully to `isLikedByMe: false` instead of
  // taking down the whole feed.
  const likedIds = new Set<string>();
  if (memberId && posts.length > 0) {
    try {
      const likes = await request.server.prisma.like.findMany({
        where: {
          memberId,
          postId: { in: posts.map((p) => p.id) },
        },
        select: { postId: true },
      });
      for (const l of likes) {
        if (l.postId) likedIds.add(l.postId);
      }
    } catch (err) {
      request.log.warn({ err }, 'community feed: like-enrichment failed');
    }
  }
  const enriched = posts.map((p) => ({
    ...p,
    isLikedByMe: likedIds.has(p.id),
  }));

  return reply.send({
    success: true,
    data: enriched,
    meta: { total, page: Number(page), limit: Number(limit) },
    error: null,
  });
}

// ── Member: toggle like on a post ──────────────────────────────────
// Idempotent from the user's PoV: if already liked → unlike; else like.
// Keeps `likesCount` in sync via a transaction so no race conditions.
export async function memberToggleLikeHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const memberId = request.memberId!;

  const existing = await request.server.prisma.like.findFirst({
    where: { memberId, postId: id },
    select: { id: true },
  });

  const result = await request.server.prisma.$transaction(async (tx) => {
    if (existing) {
      await tx.like.delete({ where: { id: existing.id } });
      const post = await tx.post.update({
        where: { id },
        data: { likesCount: { decrement: 1 } },
        select: { likesCount: true },
      });
      return { liked: false, likesCount: Math.max(0, post.likesCount) };
    } else {
      await tx.like.create({ data: { memberId, postId: id } });
      const post = await tx.post.update({
        where: { id },
        data: { likesCount: { increment: 1 } },
        select: { likesCount: true },
      });
      return { liked: true, likesCount: post.likesCount };
    }
  });

  return reply.send({ success: true, data: result, error: null });
}

// ── Member: list comments on a post ────────────────────────────────
// Returns flat list ordered oldest first (thread-friendly for scroll).
export async function memberListCommentsHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const comments = await request.server.prisma.comment.findMany({
    where: { postId: id },
    orderBy: { createdAt: 'asc' },
    include: {
      member: {
        select: { id: true, firstName: true, lastName: true, profilePhotoUrl: true },
      },
    },
  });
  return reply.send({ success: true, data: comments, error: null });
}

// ── Member: add a comment to a post ────────────────────────────────
export async function memberAddCommentHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const body = (request.body as any) ?? {};
  const content = String(body.content ?? '').trim();
  if (content.length === 0 || content.length > 2000) {
    return reply.status(400).send({
      success: false,
      data: null,
      error: { code: 'invalid_input', message: 'Comment must be 1–2000 characters.' },
    });
  }
  const memberId = request.memberId!;

  const post = await request.server.prisma.post.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!post) {
    return reply.status(404).send({
      success: false,
      data: null,
      error: { code: 'not_found', message: 'Post not found.' },
    });
  }

  const created = await request.server.prisma.$transaction(async (tx) => {
    const comment = await tx.comment.create({
      data: { postId: id, memberId, content },
      include: {
        member: {
          select: { id: true, firstName: true, lastName: true, profilePhotoUrl: true },
        },
      },
    });
    await tx.post.update({
      where: { id },
      data: { commentsCount: { increment: 1 } },
    });
    return comment;
  });

  return reply.status(201).send({ success: true, data: created, error: null });
}

// ── Member: delete own comment ─────────────────────────────────────
export async function memberDeleteCommentHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id, commentId } = request.params as { id: string; commentId: string };
  const memberId = request.memberId!;

  const existing = await request.server.prisma.comment.findFirst({
    where: { id: commentId, postId: id, memberId },
    select: { id: true, postId: true },
  });
  if (!existing) {
    return reply.status(404).send({
      success: false,
      data: null,
      error: { code: 'not_found', message: 'Comment not found or not yours.' },
    });
  }

  await request.server.prisma.$transaction(async (tx) => {
    await tx.comment.delete({ where: { id: commentId } });
    await tx.post.update({
      where: { id: existing.postId },
      data: { commentsCount: { decrement: 1 } },
    });
  });

  return reply.send({ success: true, data: null, error: null });
}

export async function memberSubmitPostHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = submitPostSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply
      .status(400)
      .send({ success: false, data: null, error: { code: 'invalid_input', message: parsed.error.message } });
  }
  const post = await request.server.prisma.post.create({
    data: {
      memberId: request.memberId!,
      content: parsed.data.content,
      mediaUrls: parsed.data.mediaUrls ?? [],
      // New posts start unapproved by default when created via member
      // submission — admins moderate before they appear in the feed.
      // (Existing rows have is_approved default TRUE so pre-9A posts
      //  keep showing.)
      isApproved: false,
    },
    include: {
      member: {
        select: { id: true, firstName: true, lastName: true, profilePhotoUrl: true },
      },
    },
  });
  return reply.status(201).send({ success: true, data: post, error: null });
}

// Admin moderation — flip is_approved
export async function adminApprovePostHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const parsed = approvePostSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply
      .status(400)
      .send({ success: false, data: null, error: { code: 'invalid_input', message: parsed.error.message } });
  }
  const post = await request.server.prisma.post.update({
    where: { id },
    data: { isApproved: parsed.data.isApproved },
  });
  return reply.send({ success: true, data: post, error: null });
}

const INCLUDE = { member: { select: { id: true, firstName: true, lastName: true, profilePhotoUrl: true } } };

export async function listPostsHandler(request: FastifyRequest, reply: FastifyReply) {
  const { page = 1, limit = 20, memberId } = request.query as any;
  const where: any = memberId ? { memberId } : {};
  const [posts, total] = await Promise.all([
    request.server.prisma.post.findMany({
      where,
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      include: INCLUDE,
    }),
    request.server.prisma.post.count({ where }),
  ]);
  return reply.send({ success: true, data: posts, meta: { total, page: Number(page), limit: Number(limit) }, error: null });
}

export async function createPostHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = createPostSchema.parse(request.body);
  const post = await request.server.prisma.post.create({
    data: {
      memberId: body.memberId,
      content: body.content,
      postType: body.postType ?? 'post',
      mediaUrls: body.mediaUrls ?? [],
      isPinned: body.isPinned ?? false,
      isAnnouncement: body.isAnnouncement ?? false,
    },
    include: INCLUDE,
  });
  return reply.status(201).send({ success: true, data: post, error: null });
}

export async function getPostHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const post = await request.server.prisma.post.findUnique({ where: { id }, include: INCLUDE });
  if (!post) return reply.status(404).send({ success: false, data: null, error: 'Post not found' });
  return reply.send({ success: true, data: post, error: null });
}

export async function deletePostHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  await request.server.prisma.post.delete({ where: { id } });
  return reply.send({ success: true, data: null, error: null });
}

export async function pinPostHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const { isPinned } = updatePostPinSchema.parse(request.body);
  const post = await request.server.prisma.post.update({ where: { id }, data: { isPinned } });
  return reply.send({ success: true, data: post, error: null });
}

export async function getCommentsHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const comments = await request.server.prisma.comment.findMany({
    where: { postId: id },
    orderBy: { createdAt: 'asc' },
    include: { member: { select: { id: true, firstName: true, lastName: true, profilePhotoUrl: true } } },
  });
  return reply.send({ success: true, data: comments, error: null });
}
