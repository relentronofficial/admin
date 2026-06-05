import { FastifyInstance } from 'fastify';
import { getCountriesHandler, getStatesHandler, getDistrictsHandler, getCitiesHandler } from './controller.js';

export async function locationRoutes(fastify: FastifyInstance) {
  fastify.get('/countries', getCountriesHandler);
  fastify.get('/states', getStatesHandler);
  fastify.get('/districts', getDistrictsHandler);
  fastify.get('/cities', getCitiesHandler);
}
