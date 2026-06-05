import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import fp from 'fastify-plugin';
import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { env } from '../config/env.js';

async function sentryPlugin(fastify: FastifyInstance, opts: FastifyPluginOptions) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    integrations: [
      nodeProfilingIntegration(),
    ],
    tracesSampleRate: 1.0,
    profilesSampleRate: 1.0,
    environment: env.NODE_ENV,
  });

  fastify.addHook('onError', (request, reply, error, done) => {
    Sentry.captureException(error);
    done();
  });
}

export default fp(sentryPlugin);
