import { FastifyInstance } from 'fastify';
import {
  listPostsHandler,
  createPostHandler,
  getPostHandler,
  deletePostHandler,
  pinPostHandler,
  getCommentsHandler
} from './controller.js';

export async function communityRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/posts', listPostsHandler);
  fastify.post('/posts', createPostHandler);
  fastify.get('/posts/:id', getPostHandler);
  fastify.delete('/posts/:id', deletePostHandler);
  fastify.put('/posts/:id/pin', pinPostHandler);
  fastify.get('/posts/:id/comments', getCommentsHandler);
}
