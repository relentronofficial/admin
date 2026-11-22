import { FastifyInstance } from 'fastify';
import { getPresignedUrlHandler, createBunnyVideoHandler, deleteBunnyVideoHandler, uploadImageHandler } from './controller.js';

const IMAGE_LIMIT = 50 * 1024 * 1024;   // 50 MB (sharp converts to WebP before storage)
const VIDEO_LIMIT = 500 * 1024 * 1024;  // 500 MB

export async function uploadRoutes(fastify: FastifyInstance) {
  // Parse specific types first, then fall back to catch-all for PDFs, docs, etc.
  fastify.addContentTypeParser(/^image\//, { parseAs: 'buffer', bodyLimit: IMAGE_LIMIT }, (_req, body, done) => done(null, body));
  fastify.addContentTypeParser(/^video\//, { parseAs: 'buffer', bodyLimit: VIDEO_LIMIT }, (_req, body, done) => done(null, body));
  fastify.addContentTypeParser('application/octet-stream', { parseAs: 'buffer', bodyLimit: VIDEO_LIMIT }, (_req, body, done) => done(null, body));
  // Catch-all: PDFs, Office docs, archives, audio, and any other file type
  fastify.addContentTypeParser('*', { parseAs: 'buffer', bodyLimit: VIDEO_LIMIT }, (_req, body, done) => done(null, body));

  // Uploads are shared by the admin panel (Clerk) and members (web cookie /
  // app Bearer JWT), so they accept either login — but never no login.
  // Deleting a Bunny video is admin-only.
  const either = { preHandler: fastify.authenticateAdminOrMember };
  fastify.post('/presigned-url', either, getPresignedUrlHandler);
  fastify.post('/bunny-video-create', either, createBunnyVideoHandler);
  fastify.delete('/bunny-video/:videoId', { preHandler: fastify.authenticate }, deleteBunnyVideoHandler);
  fastify.post('/image', { ...either, bodyLimit: VIDEO_LIMIT }, uploadImageHandler);
}
