import { FastifyInstance } from 'fastify';
import {
  listCoursesHandler, createCourseHandler, getCourseHandler,
  updateCourseHandler, deleteCourseHandler, publishCourseHandler,
  listEnrollmentsHandler, updateCurriculumHandler,
  listCourseEpisodesHandler, createCourseEpisodeHandler,
  updateCourseEpisodeHandler, deleteCourseEpisodeHandler, reorderCourseEpisodesHandler,
} from './controller.js';

export async function courseRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/', listCoursesHandler);
  fastify.post('/', createCourseHandler);
  fastify.get('/:id', getCourseHandler);
  fastify.put('/:id', updateCourseHandler);
  fastify.delete('/:id', deleteCourseHandler);
  fastify.post('/:id/publish', publishCourseHandler);
  fastify.get('/:id/enrollments', listEnrollmentsHandler);
  fastify.post('/:id/curriculum', updateCurriculumHandler);

  fastify.get('/:id/episodes', listCourseEpisodesHandler);
  fastify.post('/:id/episodes', createCourseEpisodeHandler);
  fastify.put('/:id/episodes/reorder', reorderCourseEpisodesHandler);
  fastify.put('/episodes/:eid', updateCourseEpisodeHandler);
  fastify.delete('/episodes/:eid', deleteCourseEpisodeHandler);
}
