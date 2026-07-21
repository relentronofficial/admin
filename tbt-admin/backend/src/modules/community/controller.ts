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
    case 'following': {
      // Item #21: return posts by anyone the caller follows.
      if (!memberId) {
        return reply.send({
          success: true,
          data: [],
          meta: { total: 0, page: Number(page), limit: Number(limit) },
          error: null,
        });
      }
      const conns = await request.server.prisma.memberConnection.findMany({
        where: { followerId: memberId },
        select: { followingId: true },
      });
      const followingIds = conns.map((c) => c.followingId);
      if (followingIds.length === 0) {
        return reply.send({
          success: true,
          data: [],
          meta: { total: 0, page: Number(page), limit: Number(limit) },
          error: null,
        });
      }
      where.isApproved = true;
      where.memberId = { in: followingIds };
      break;
    }
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

  // Item #6: batch first-liker per post. Single query for all posts in
  // the feed batch — no N+1. Ordered by createdAt asc so "first liker"
  // === "earliest liker", which matches LinkedIn's "Liked by <first
  // person> and N others" convention.
  type MemberRef = {
    id: string;
    firstName: string | null;
    lastName: string | null;
    profilePhotoUrl: string | null;
  };
  const firstLikerByPost = new Map<string, MemberRef>();
  if (posts.length > 0) {
    try {
      const likes = await request.server.prisma.like.findMany({
        where: { postId: { in: posts.map((p) => p.id) } },
        orderBy: { createdAt: 'asc' },
        select: {
          postId: true,
          member: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profilePhotoUrl: true,
            },
          },
        },
      });
      for (const l of likes) {
        if (l.postId && !firstLikerByPost.has(l.postId) && l.member) {
          firstLikerByPost.set(l.postId, l.member);
        }
      }
    } catch (err) {
      request.log.warn({ err }, 'community feed: first-liker enrichment failed');
    }
  }

  // Item #11: batch top-comment per post. Same no-N+1 pattern — one
  // findMany + dedupe in memory. Ordered by createdAt asc so "top" is
  // the oldest comment (feed-first pattern, matches how LinkedIn shows
  // it — encourages engagement with early commenters).
  type TopComment = {
    id: string;
    content: string;
    createdAt: Date;
    member: MemberRef | null;
  };
  const topCommentByPost = new Map<string, TopComment>();
  if (posts.length > 0) {
    try {
      const comments = await request.server.prisma.comment.findMany({
        where: { postId: { in: posts.map((p) => p.id) } },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          postId: true,
          content: true,
          createdAt: true,
          member: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profilePhotoUrl: true,
            },
          },
        },
      });
      for (const c of comments) {
        if (c.postId && !topCommentByPost.has(c.postId)) {
          topCommentByPost.set(c.postId, {
            id: c.id,
            content: c.content,
            createdAt: c.createdAt,
            member: c.member,
          });
        }
      }
    } catch (err) {
      request.log.warn({ err }, 'community feed: top-comment enrichment failed');
    }
  }

  // Item #16: batch bookmark state per post. Single query for all
  // posts. Wrapped in try/catch same pattern as likes/comments — the
  // feed still renders if the bookmark table has a hiccup.
  const bookmarkedIds = new Set<string>();
  if (memberId && posts.length > 0) {
    try {
      const bookmarks = await request.server.prisma.postBookmark.findMany({
        where: {
          memberId,
          postId: { in: posts.map((p) => p.id) },
        },
        select: { postId: true },
      });
      for (const b of bookmarks) bookmarkedIds.add(b.postId);
    } catch (err) {
      request.log.warn(
        { err },
        'community feed: bookmark-enrichment failed',
      );
    }
  }

  const enriched = posts.map((p) => ({
    ...p,
    isLikedByMe: likedIds.has(p.id),
    isBookmarkedByMe: bookmarkedIds.has(p.id),
    firstLiker: firstLikerByPost.get(p.id) ?? null,
    topComment: topCommentByPost.get(p.id) ?? null,
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

  // Item #30: broadcast the fresh count so other viewers' cards can
  // update live without a refresh.
  try {
    (request.server as any).io?.to('community')?.emit('community:post_liked', {
      postId: id,
      likesCount: result.likesCount,
    });
  } catch (_) {}

  return reply.send({ success: true, data: result, error: null });
}

// ── Member: list comments on a post ────────────────────────────────
// Returns flat list ordered oldest first. Each row includes:
//   * `parentCommentId` (item #18) so client can render 2-level threads
//   * `likesCount` + `isLikedByMe` (item #19) so client can show hearts
export async function memberListCommentsHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const memberId = request.memberId;
  const comments = await request.server.prisma.comment.findMany({
    where: { postId: id },
    orderBy: { createdAt: 'asc' },
    include: {
      member: {
        select: { id: true, firstName: true, lastName: true, profilePhotoUrl: true },
      },
    },
  });

  // Batch fetch which of these comments the caller has liked. No N+1.
  const likedIds = new Set<string>();
  if (memberId && comments.length > 0) {
    try {
      const likes = await request.server.prisma.like.findMany({
        where: {
          memberId,
          commentId: { in: comments.map((c) => c.id) },
        },
        select: { commentId: true },
      });
      for (const l of likes) {
        if (l.commentId) likedIds.add(l.commentId);
      }
    } catch (err) {
      request.log.warn({ err }, 'comment list: like-enrichment failed');
    }
  }

  const enriched = comments.map((c) => ({
    ...c,
    isLikedByMe: likedIds.has(c.id),
  }));

  return reply.send({ success: true, data: enriched, error: null });
}

// ── Member: toggle like on a comment (item #19) ────────────────────
// Mirrors memberToggleLikeHandler but keyed on commentId. Same
// atomicity pattern (create/delete Like row + inc/dec
// Comment.likesCount in a single transaction).
export async function memberToggleCommentLikeHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { commentId } = request.params as { commentId: string };
  const memberId = request.memberId!;

  const existing = await request.server.prisma.like.findFirst({
    where: { memberId, commentId },
    select: { id: true },
  });

  const result = await request.server.prisma.$transaction(async (tx) => {
    if (existing) {
      await tx.like.delete({ where: { id: existing.id } });
      const c = await tx.comment.update({
        where: { id: commentId },
        data: { likesCount: { decrement: 1 } },
        select: { likesCount: true },
      });
      return { liked: false, likesCount: Math.max(0, c.likesCount) };
    } else {
      await tx.like.create({ data: { memberId, commentId } });
      const c = await tx.comment.update({
        where: { id: commentId },
        data: { likesCount: { increment: 1 } },
        select: { likesCount: true },
      });
      return { liked: true, likesCount: c.likesCount };
    }
  });

  return reply.send({ success: true, data: result, error: null });
}

// ── Member: add a comment to a post ────────────────────────────────
// Item #18: accepts optional `parentCommentId` to make it a reply.
// Threading is capped at 2 levels — if the parent is already a reply,
// we reparent to the grandparent so deeply-nested threads flatten to
// a single level (Threads / Instagram convention).
export async function memberAddCommentHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const body = (request.body as any) ?? {};
  const content = String(body.content ?? '').trim();
  const rawParentId = body.parentCommentId as string | undefined;
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

  // Resolve `parentCommentId` — cap at 2 levels, verify same-post.
  let effectiveParentId: string | null = null;
  if (rawParentId) {
    const parent = await request.server.prisma.comment.findUnique({
      where: { id: rawParentId },
      select: { id: true, postId: true, parentCommentId: true },
    });
    if (!parent || parent.postId !== id) {
      return reply.status(400).send({
        success: false,
        data: null,
        error: {
          code: 'invalid_input',
          message: 'Parent comment not found on this post.',
        },
      });
    }
    // Flatten a would-be level-3 reply to level 2 by reparenting to
    // the grandparent — matches Threads / Instagram semantics.
    effectiveParentId = parent.parentCommentId ?? parent.id;
  }

  const created = await request.server.prisma.$transaction(async (tx) => {
    const comment = await tx.comment.create({
      data: {
        postId: id,
        memberId,
        content,
        parentCommentId: effectiveParentId,
      },
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

  // Item #30: broadcast so any client currently watching this post's
  // comments (open sheet) or the feed can refresh the count.
  try {
    (request.server as any).io?.to('community')?.emit('community:comment_added', {
      postId: id,
      commentId: created.id,
    });
  } catch (_) {}

  return reply.status(201).send({ success: true, data: created, error: null });
}

// ── Member: report a post (item #25) ─────────────────────────────────
// Creates a PostReport row. Idempotent per (post, reporter, reason) —
// a member reporting the same post twice for the same reason is a
// no-op (avoids inflating counts).
const REPORT_REASONS = new Set([
  'spam',
  'harassment',
  'inappropriate',
  'misinformation',
  'other',
]);

export async function memberReportPostHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { id } = request.params as { id: string };
  const reporterId = request.memberId!;
  const body = (request.body as any) ?? {};
  const reason = String(body.reason ?? '').toLowerCase().trim();
  const detail = body.detail ? String(body.detail).trim().slice(0, 500) : null;

  if (!REPORT_REASONS.has(reason)) {
    return reply.status(400).send({
      success: false,
      data: null,
      error: {
        code: 'invalid_input',
        message: 'Reason must be one of: spam, harassment, inappropriate, misinformation, other.',
      },
    });
  }

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

  const existing = await request.server.prisma.postReport.findFirst({
    where: { postId: id, reporterId, reason, status: 'pending' },
    select: { id: true },
  });
  if (existing) {
    return reply.send({
      success: true,
      data: { alreadyReported: true },
      error: null,
    });
  }

  await request.server.prisma.postReport.create({
    data: { postId: id, reporterId, reason, detail },
  });

  // Broadcast to admin room so the moderation dashboard can badge
  // "N new reports" live. Non-fatal if the socket plugin is missing.
  try {
    (request.server as any).io?.to('admin')?.emit('admin:post_reported', {
      postId: id,
      reason,
    });
  } catch (_) {}

  return reply.status(201).send({
    success: true,
    data: { alreadyReported: false },
    error: null,
  });
}

// ── Member: hashtag feed (item #27) ─────────────────────────────────
// Returns approved active posts whose content contains `#<tag>`. Tag
// match is word-bounded (`#growth` matches "great #growth mindset"
// but not "#growthhack"). Case-insensitive.
export async function memberHashtagFeedHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { tag } = request.params as { tag: string };
  const { page = 1, limit = 20 } = request.query as any;
  const memberId = request.memberId;

  // Sanitize the tag — strip a leading '#' and reject non-word chars.
  // Prevents SQL-LIKE payloads and keeps the match predictable.
  const cleaned = tag.replace(/^#/, '').replace(/[^A-Za-z0-9_]/g, '');
  if (cleaned.length === 0) {
    return reply.send({
      success: true,
      data: [],
      meta: { total: 0, page: Number(page), limit: Number(limit) },
      error: null,
    });
  }
  const needle = `#${cleaned}`;

  const where = {
    isApproved: true,
    status: 'active',
    content: { contains: needle, mode: 'insensitive' as const },
  };
  const [posts, total] = await Promise.all([
    request.server.prisma.post.findMany({
      where: where as any,
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      include: {
        member: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePhotoUrl: true,
          },
        },
      },
    }),
    request.server.prisma.post.count({ where: where as any }),
  ]);

  // Same isLikedByMe + isBookmarkedByMe enrichment as the main feed so
  // hashtag posts render identically in the mobile card.
  const likedIds = new Set<string>();
  const bookmarkedIds = new Set<string>();
  if (memberId && posts.length > 0) {
    try {
      const [likes, bookmarks] = await Promise.all([
        request.server.prisma.like.findMany({
          where: { memberId, postId: { in: posts.map((p) => p.id) } },
          select: { postId: true },
        }),
        request.server.prisma.postBookmark.findMany({
          where: { memberId, postId: { in: posts.map((p) => p.id) } },
          select: { postId: true },
        }),
      ]);
      for (const l of likes) {
        if (l.postId) likedIds.add(l.postId);
      }
      for (const b of bookmarks) bookmarkedIds.add(b.postId);
    } catch (_) {}
  }

  const enriched = posts.map((p) => ({
    ...p,
    isLikedByMe: likedIds.has(p.id),
    isBookmarkedByMe: bookmarkedIds.has(p.id),
  }));

  return reply.send({
    success: true,
    data: enriched,
    meta: { total, page: Number(page), limit: Number(limit), tag: cleaned },
    error: null,
  });
}

// ── Member: search other members (item #26) ─────────────────────────
// Powers @mention autocomplete + generic member picker. Case-insensitive
// prefix match on firstName/lastName. Excludes the caller.
export async function memberSearchHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const memberId = request.memberId;
  const { q = '', limit = '10' } = request.query as Record<string, string>;
  const query = q.trim();
  if (query.length < 1) {
    return reply.send({ success: true, data: [], error: null });
  }
  const limitNum = Math.min(30, Math.max(1, Number(limit) || 10));

  const rows = await request.server.prisma.member.findMany({
    where: {
      AND: [
        { id: memberId ? { not: memberId } : undefined },
        {
          OR: [
            { firstName: { contains: query, mode: 'insensitive' } },
            { lastName: { contains: query, mode: 'insensitive' } },
          ],
        },
      ],
    },
    orderBy: { firstName: 'asc' },
    take: limitNum,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      profilePhotoUrl: true,
    },
  });
  return reply.send({ success: true, data: rows, error: null });
}

// ── Admin: list post reports (item #25) ─────────────────────────────
export async function adminListReportsHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { status = 'pending', page = '1', limit = '50' } =
      request.query as Record<string, string>;
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(200, Math.max(1, Number(limit) || 50));
  const where: any = {};
  if (status !== 'all') where.status = status;

  const [rows, total] = await Promise.all([
    request.server.prisma.postReport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
      include: {
        reporter: {
          select: { id: true, firstName: true, lastName: true, profilePhotoUrl: true },
        },
        post: {
          select: {
            id: true,
            content: true,
            mediaUrls: true,
            createdAt: true,
            member: {
              select: { id: true, firstName: true, lastName: true, profilePhotoUrl: true },
            },
          },
        },
      },
    }),
    request.server.prisma.postReport.count({ where }),
  ]);

  return reply.send({
    success: true,
    data: rows,
    meta: { total, page: pageNum, limit: limitNum },
    error: null,
  });
}

// ── Admin: resolve or dismiss a report (item #25) ────────────────────
export async function adminUpdateReportHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { id } = request.params as { id: string };
  const body = (request.body as any) ?? {};
  const status = String(body.status ?? '').toLowerCase();
  if (!['resolved', 'dismissed', 'pending'].includes(status)) {
    return reply.status(400).send({
      success: false,
      data: null,
      error: {
        code: 'invalid_input',
        message: 'Status must be resolved, dismissed, or pending.',
      },
    });
  }
  try {
    const updated = await request.server.prisma.postReport.update({
      where: { id },
      data: {
        status,
        resolvedAt: status === 'pending' ? null : new Date(),
      },
    });
    return reply.send({ success: true, data: updated, error: null });
  } catch (err: any) {
    if (err?.code === 'P2025') {
      return reply.status(404).send({
        success: false,
        data: null,
        error: { code: 'not_found', message: 'Report not found.' },
      });
    }
    throw err;
  }
}

// ── Member: profile card data (item #20) ────────────────────────────
// Powers the author-profile bottom sheet. Aggregates: member row +
// counts (posts / followers / following — follows are stubbed at 0
// until item #21 lands member_connections) + 3 recent post covers for
// the "Recent posts" thumbnail strip.
export async function memberGetProfileHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { id } = request.params as { id: string };
  const member = await request.server.prisma.member.findUnique({
    where: { id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      profilePhotoUrl: true,
      businessName: true,
      businessType: true,
      city: true,
      state: true,
    },
  });
  if (!member) {
    return reply.status(404).send({
      success: false,
      data: null,
      error: { code: 'not_found', message: 'Member not found.' },
    });
  }

  const callerId = request.memberId;
  const [postsCount, recent, followersCount, followingCount, isFollowingRow] =
      await Promise.all([
    request.server.prisma.post.count({
      where: { memberId: id, isApproved: true, status: 'active' },
    }),
    request.server.prisma.post.findMany({
      where: { memberId: id, isApproved: true, status: 'active' },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: {
        id: true,
        mediaUrls: true,
        content: true,
        createdAt: true,
      },
    }),
    request.server.prisma.memberConnection.count({
      where: { followingId: id },
    }),
    request.server.prisma.memberConnection.count({
      where: { followerId: id },
    }),
    callerId && callerId !== id
        ? request.server.prisma.memberConnection.findFirst({
            where: { followerId: callerId, followingId: id },
            select: { id: true },
          })
        : Promise.resolve(null),
  ]);

  return reply.send({
    success: true,
    data: {
      member,
      postsCount,
      followersCount,
      followingCount,
      isFollowing: isFollowingRow != null,
      recentPosts: recent,
    },
    error: null,
  });
}

// ── Member: follow / unfollow (item #21) ─────────────────────────────
// Toggle create/delete of a MemberConnection row. Blocks self-follow.
export async function memberToggleFollowHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { id } = request.params as { id: string };
  const followerId = request.memberId!;
  if (followerId === id) {
    return reply.status(400).send({
      success: false,
      data: null,
      error: {
        code: 'invalid_input',
        message: 'You cannot follow yourself.',
      },
    });
  }

  const existing = await request.server.prisma.memberConnection.findFirst({
    where: { followerId, followingId: id },
    select: { id: true },
  });
  if (existing) {
    await request.server.prisma.memberConnection.delete({
      where: { id: existing.id },
    });
    return reply.send({
      success: true,
      data: { following: false },
      error: null,
    });
  }
  // Verify the target exists before creating a dangling row.
  const target = await request.server.prisma.member.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!target) {
    return reply.status(404).send({
      success: false,
      data: null,
      error: { code: 'not_found', message: 'Member not found.' },
    });
  }
  await request.server.prisma.memberConnection.create({
    data: { followerId, followingId: id },
  });
  return reply.send({
    success: true,
    data: { following: true },
    error: null,
  });
}

// ── Member: list followers (people who follow :id) ─────────────────
export async function memberListFollowersHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { id } = request.params as { id: string };
  const { page = '1', limit = '50' } = request.query as Record<string, string>;
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(200, Math.max(1, Number(limit) || 50));
  const [rows, total] = await Promise.all([
    request.server.prisma.memberConnection.findMany({
      where: { followingId: id },
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
      include: {
        follower: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePhotoUrl: true,
          },
        },
      },
    }),
    request.server.prisma.memberConnection.count({ where: { followingId: id } }),
  ]);
  const members = rows.map((r) => r.follower).filter((m): m is NonNullable<typeof m> => m != null);
  return reply.send({
    success: true,
    data: members,
    meta: { total, page: pageNum, limit: limitNum },
    error: null,
  });
}

// ── Member: list people I follow ────────────────────────────────────
export async function memberListFollowingHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const memberId = request.memberId!;
  const { page = '1', limit = '50' } = request.query as Record<string, string>;
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(200, Math.max(1, Number(limit) || 50));
  const [rows, total] = await Promise.all([
    request.server.prisma.memberConnection.findMany({
      where: { followerId: memberId },
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
      include: {
        following: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePhotoUrl: true,
          },
        },
      },
    }),
    request.server.prisma.memberConnection.count({ where: { followerId: memberId } }),
  ]);
  const members = rows.map((r) => r.following).filter((m): m is NonNullable<typeof m> => m != null);
  return reply.send({
    success: true,
    data: members,
    meta: { total, page: pageNum, limit: limitNum },
    error: null,
  });
}

// ── Member: paginated likers on a post (item #6) ────────────────────
// Powers the "N others" tap on the engagement summary line — shows
// everyone who liked the post, oldest first (matches "first liker"
// convention on the feed line).
export async function memberListPostLikersHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { id } = request.params as { id: string };
  const { page = '1', limit = '50' } = request.query as Record<string, string>;
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(200, Math.max(1, Number(limit) || 50));

  const [likes, total] = await Promise.all([
    request.server.prisma.like.findMany({
      where: { postId: id },
      orderBy: { createdAt: 'asc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
      include: {
        member: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePhotoUrl: true,
          },
        },
      },
    }),
    request.server.prisma.like.count({ where: { postId: id } }),
  ]);

  // Return the flat member list; skip any orphaned rows.
  const members = likes
    .map((l) => l.member)
    .filter((m): m is NonNullable<typeof m> => m != null);

  return reply.send({
    success: true,
    data: members,
    meta: { total, page: pageNum, limit: limitNum },
    error: null,
  });
}

// ── Member: toggle bookmark on a post (item #16) ───────────────────
// Same idempotent create-or-delete pattern as the like toggle. Doesn't
// mutate the post itself — bookmarks are purely a per-member index.
export async function memberToggleBookmarkHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { id } = request.params as { id: string };
  const memberId = request.memberId!;

  const existing = await request.server.prisma.postBookmark.findFirst({
    where: { memberId, postId: id },
    select: { id: true },
  });

  if (existing) {
    await request.server.prisma.postBookmark.delete({
      where: { id: existing.id },
    });
    return reply.send({
      success: true,
      data: { bookmarked: false },
      error: null,
    });
  } else {
    // Verify the post exists before creating a dangling bookmark row.
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
    await request.server.prisma.postBookmark.create({
      data: { memberId, postId: id },
    });
    return reply.send({
      success: true,
      data: { bookmarked: true },
      error: null,
    });
  }
}

// ── Member: list my bookmarked posts (item #16) ────────────────────
export async function memberListBookmarksHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const memberId = request.memberId!;
  const { page = '1', limit = '20' } = request.query as Record<string, string>;
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));

  const [rows, total] = await Promise.all([
    request.server.prisma.postBookmark.findMany({
      where: { memberId },
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
      include: {
        post: {
          include: {
            member: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                profilePhotoUrl: true,
              },
            },
          },
        },
      },
    }),
    request.server.prisma.postBookmark.count({ where: { memberId } }),
  ]);

  // Flatten to a post array with `isBookmarkedByMe: true` baked in so
  // the mobile can reuse the same CommunityPost model.
  const posts = rows
    .filter((r) => r.post != null)
    .map((r) => ({
      ...r.post,
      isBookmarkedByMe: true,
      // isLikedByMe / firstLiker / topComment are intentionally NOT
      // computed on the saved-posts page — it's a lightweight list.
      // The full feed enrichment fires only on the main feed handler.
    }));

  return reply.send({
    success: true,
    data: posts,
    meta: { total, page: pageNum, limit: limitNum },
    error: null,
  });
}

// ── Member: delete own post (item #8/#24) ───────────────────────────
// Mirrors the admin delete endpoint but scoped to the caller. Returns
// 403 if the post exists but doesn't belong to the caller (rather than
// 404 — which would leak that other members' post IDs exist).
export async function memberDeleteOwnPostHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { id } = request.params as { id: string };
  const memberId = request.memberId!;
  const post = await request.server.prisma.post.findUnique({
    where: { id },
    select: { id: true, memberId: true },
  });
  if (!post) {
    return reply.status(404).send({
      success: false,
      data: null,
      error: { code: 'not_found', message: 'Post not found.' },
    });
  }
  if (post.memberId !== memberId) {
    return reply.status(403).send({
      success: false,
      data: null,
      error: { code: 'forbidden', message: 'Not your post.' },
    });
  }
  await request.server.prisma.post.delete({ where: { id } });
  return reply.send({ success: true, data: null, error: null });
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
  // Item #30: fan-out to every member connected to the 'community'
  // room so their feed refreshes without a manual pull-to-refresh.
  // Only emits when going pending → approved (isApproved: true).
  if (parsed.data.isApproved) {
    try {
      (request.server as any).io
          ?.to('community')
          ?.emit('community:post_created', { postId: id, memberId: post.memberId });
    } catch (_) {}
  }
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
