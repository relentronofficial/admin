import { FastifyInstance } from 'fastify';
import { getPresignedUrlHandler, createBunnyVideoHandler, deleteBunnyVideoHandler, uploadImageHandler } from './controller.js';

const IMAGE_LIMIT = 20 * 1024 * 1024; // 20 MB

export async function uploadRoutes(fastify: FastifyInstance) {
  // Parse image/* and octet-stream bodies as raw Buffers up to 20 MB
  fastify.addContentTypeParser(/^image\//, { parseAs: 'buffer', bodyLimit: IMAGE_LIMIT }, (_req, body, done) => done(null, body));
  fastify.addContentTypeParser('application/octet-stream', { parseAs: 'buffer', bodyLimit: IMAGE_LIMIT }, (_req, body, done) => done(null, body));

  fastify.post('/presigned-url', getPresignedUrlHandler);
  fastify.post('/bunny-video-create', createBunnyVideoHandler);
  fastify.delete('/bunny-video/:videoId', deleteBunnyVideoHandler);
  fastify.post('/image', { bodyLimit: IMAGE_LIMIT }, uploadImageHandler);
}
