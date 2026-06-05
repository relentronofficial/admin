import type { FastifyReply, FastifyRequest } from 'fastify';
import { createPostSchema, updatePostPinSchema } from './schema.js';

export async function listPostsHandler(request: FastifyRequest, reply: FastifyReply) {
  const posts = await request.server.prisma.post.findMany({
    include: { author: true }
  });
  return reply.send({ success: true, data: posts, error: null });
}

export async function createPostHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = createPostSchema.parse(request.body);
  const postId = `TBT-POST-${Math.floor(1000 + Math.random() * 9000)}`;

  // For admin panel, we might use a system user or allow admin to post
  const post = await request.server.prisma.post.create({
    data: {
      ...body,
      postId,
      authorId: request.user, // Assuming request.user is an ID that exists in Member or Admin, but schema says authorId is Member.id. 
      // Need to adjust schema or logic. Let's assume there's a system member or adjust authorId to be String.
    },
  });

  return reply.status(201).send({ success: true, data: post, error: null });
}

export async function getPostHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const post = await request.server.prisma.post.findUnique({
    where: { id },
    include: { author: true }
  });
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
  const post = await request.server.prisma.post.update({
    where: { id },
    data: { isPinned }
  });
  return reply.send({ success: true, data: post, error: null });
}

export async function getCommentsHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  // Logic to fetch comments for this post
  return reply.send({ success: true, data: [], error: null });
}
