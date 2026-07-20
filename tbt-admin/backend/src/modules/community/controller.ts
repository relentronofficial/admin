import type { FastifyReply, FastifyRequest } from 'fastify';
import { createPostSchema, updatePostPinSchema, submitPostSchema, approvePostSchema } from './schema.js';

// ── Member-facing: submit + list approved feed (Module 9A) ─────────
export async function memberListFeedHandler(request: FastifyRequest, reply: FastifyReply) {
  const { page = 1, limit = 20 } = request.query as any;
  const where = { isApproved: true, status: 'active' };
  const [posts, total] = await Promise.all([
    request.server.prisma.post.findMany({
      where,
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
      orderBy: [{ isPinned: 'desc' }, { isMentor: 'desc' }, { createdAt: 'desc' }],
      include: {
        member: {
          select: { id: true, firstName: true, lastName: true, profilePhotoUrl: true },
        },
      },
    }),
    request.server.prisma.post.count({ where }),
  ]);
  return reply.send({
    success: true,
    data: posts,
    meta: { total, page: Number(page), limit: Number(limit) },
    error: null,
  });
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
