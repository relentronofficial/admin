import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { env } from './config/env.js';

// Plugins
import sentryPlugin from './plugins/sentry.js';
import prismaPlugin from './plugins/prisma.js';
import redisPlugin from './plugins/redis.js';
import clerkPlugin from './plugins/clerk.js';
import jwtPlugin from './plugins/jwt.js';
import socketPlugin from './plugins/socket.js';
import supabasePlugin from './plugins/supabase.js';

// Routes
import { authRoutes } from './modules/auth/routes.js';
import { adminRoutes } from './modules/admins/routes.js';
import { memberRoutes } from './modules/members/routes.js';
import { courseRoutes } from './modules/courses/routes.js';
import { taskRoutes } from './modules/tasks/routes.js';
import { communityRoutes } from './modules/community/routes.js';
import { webinarRoutes } from './modules/webinar/routes.js';
import { dashboardRoutes } from './modules/dashboard/routes.js';
import { notificationRoutes } from './modules/notifications/routes.js';
import { uploadRoutes } from './modules/upload/routes.js';
import { locationRoutes } from './modules/location/routes.js';
import { userRoutes } from './modules/user/routes.js';
import { workshopRoutes } from './modules/workshops/routes.js';
import { heroRoutes } from './modules/hero/routes.js';
import { contentSectionRoutes } from './modules/content-sections/routes.js';
import { tierRoutes } from './modules/tiers/routes.js';
import { displayBadgeRoutes } from './modules/display-badges/routes.js';
import { productRoutes } from './modules/products/routes.js';
import { appResourceRoutes } from './modules/app-resources/routes.js';
import { appNotificationRoutes } from './modules/app-notifications/routes.js';
import { configRoutes } from './modules/config/routes.js';
import { batchRoutes } from './modules/batches/routes.js';
import { pubRoutes } from './modules/pub/routes.js';
import { messagesRoutes } from './modules/messages/routes.js';
import { conversationsRoutes } from './modules/conversations/routes.js';
import { securityRoutes } from './modules/security/routes.js';
import { userAuthRoutes } from './modules/user-auth/routes.js';
import { fetchBunnyDuration } from './modules/workshops/controller.js';

async function bootstrap() {
  const fastify = Fastify({
    trustProxy: true,   // read real client IP from X-Forwarded-For (GCP load balancer)
    logger: {
      level: 'info',
      transport: env.NODE_ENV === 'development' ? {
        target: 'pino-pretty',
        options: { translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' }
      } : undefined
    }
  });

  try {
    // Allow empty JSON bodies on DELETE/GET — Axios always sends Content-Type: application/json
    fastify.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
      if (!body || (body as string).trim() === '') { done(null, {}); return; }
      try { done(null, JSON.parse(body as string)); }
      catch (err: any) { done(err, undefined); }
    });

    // Register Plugins
    await fastify.register(sentryPlugin);
    await fastify.register(prismaPlugin);
    await fastify.register(redisPlugin);
    await fastify.register(clerkPlugin);
    await fastify.register(jwtPlugin);
    await fastify.register(supabasePlugin);
    await fastify.register(socketPlugin);

    // Strip trailing slashes — browsers send origins without them but env vars often include one
    const normalizeOrigin = (u: string) => u.replace(/\/+$/, '');
    const allowedOrigins = new Set([
      normalizeOrigin(env.USER_WEB_URL),
      normalizeOrigin(env.ADMIN_WEB_URL),
      ...(env.CORS_EXTRA_ORIGINS
        ? env.CORS_EXTRA_ORIGINS.split(',').map((o) => normalizeOrigin(o.trim())).filter(Boolean)
        : []),
    ]);
    await fastify.register(cors, {
      origin: (origin, cb) => {
        const allowed = !origin || allowedOrigins.has(origin);
        fastify.log.debug({ origin, allowed }, 'CORS check');
        cb(null, allowed);
      },
      credentials: true,
    });
    await fastify.register(helmet);
    await fastify.register(rateLimit, {
      max: 100000,
      timeWindow: '1 minute',
      allowList: ['127.0.0.1', '::1', '106.51.170.95'],
      // @fastify/rate-limit uses ioredis-specific defineCommand (LUA scripts);
      // incompatible with @upstash/redis REST adapter — per-instance limiting only.
    });

    // Register Routes
    console.log('📦 Registering routes...');
    await fastify.register(authRoutes, { prefix: '/api/auth' });
    await fastify.register(adminRoutes, { prefix: '/api/admins' });
    await fastify.register(memberRoutes, { prefix: '/api/members' });
    await fastify.register(courseRoutes, { prefix: '/api/courses' });
    await fastify.register(taskRoutes, { prefix: '/api/tasks' });
    await fastify.register(communityRoutes, { prefix: '/api/community' });
    await fastify.register(webinarRoutes, { prefix: '/api/webinars' });
    await fastify.register(dashboardRoutes, { prefix: '/api/dashboard' });
    await fastify.register(notificationRoutes, { prefix: '/api/notifications' });
    await fastify.register(uploadRoutes, { prefix: '/api/upload' });
    await fastify.register(locationRoutes, { prefix: '/api/location' });
    await fastify.register(userRoutes, { prefix: '/api/user' });
    await fastify.register(workshopRoutes, { prefix: '/api/workshops' });
    await fastify.register(heroRoutes, { prefix: '/api/hero-slides' });
    await fastify.register(contentSectionRoutes, { prefix: '/api/content-sections' });
    await fastify.register(tierRoutes, { prefix: '/api/tiers' });
    await fastify.register(displayBadgeRoutes, { prefix: '/api/display-badges' });
    await fastify.register(productRoutes, { prefix: '/api/products' });
    await fastify.register(appResourceRoutes, { prefix: '/api/app-resources' });
    await fastify.register(appNotificationRoutes, { prefix: '/api/app-notifications' });
    await fastify.register(configRoutes, { prefix: '/api/config' });
    await fastify.register(batchRoutes, { prefix: '/api/batches' });
    await fastify.register(pubRoutes, { prefix: '/api/pub' });
    await fastify.register(messagesRoutes, { prefix: '/api/messages' });
    await fastify.register(conversationsRoutes, { prefix: '/api/conversations' });
    await fastify.register(securityRoutes, { prefix: '/api/security-logs' });
    await fastify.register(userAuthRoutes, { prefix: '/api/user-auth' });

    // Root + Health Check
    fastify.get('/', async () => ({ name: 'TBT Admin API', status: 'ok' }));
    fastify.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

    const port = env.PORT;
    const host = '0.0.0.0';

    await fastify.listen({ port, host });
    console.log(`🚀 Server ready at http://localhost:${port}`);

    // Background: sync durationSeconds from Bunny for all existing episodes.
    // Runs once per startup, non-blocking, fixes episodes with wrong manually-typed durations.
    setImmediate(async () => {
      try {
        // Phase 1: all episodes with bunnyVideoId — always overwrite with Bunny's authoritative value
        const episodes = await fastify.prisma.workshopEpisode.findMany({
          where: { bunnyVideoId: { not: null } },
          select: { id: true, bunnyVideoId: true, durationSeconds: true },
        });
        fastify.log.info(`[bunny-sync] Syncing duration for ${episodes.length} episodes`);
        for (const ep of episodes) {
          const real = await fetchBunnyDuration(ep.bunnyVideoId!);
          if (real !== null) {
            await fastify.prisma.workshopEpisode.update({ where: { id: ep.id }, data: { durationSeconds: real } });
            fastify.log.info(`[bunny-sync] ${ep.id}: ${ep.durationSeconds}s → ${real}s`);
          }
        }

        // Phase 2: episodes with bunnyVideoId=null but a Bunny embed/player URL in videoUrl
        // Extracts the video ID from the URL, fetches real duration, and backfills bunnyVideoId.
        // Matches: iframe embed, player, or CDN pull zone URL (vz-*.b-cdn.net/{videoId}/...)
        const BUNNY_VIDEO_ID_RE = /(?:iframe\.mediadelivery\.net\/embed|player\.mediadelivery\.net\/play)\/\d+\/([\w-]+)|(?:vz-[^.]+\.b-cdn\.net)\/([\w-]{8,})\//;
        const urlEpisodes = await fastify.prisma.workshopEpisode.findMany({
          where: { bunnyVideoId: null, videoUrl: { not: null } },
          select: { id: true, videoUrl: true, durationSeconds: true },
        });
        fastify.log.info(`[bunny-sync] Checking ${urlEpisodes.length} URL-only episodes`);
        for (const ep of urlEpisodes) {
          fastify.log.info(`[bunny-sync] URL-ep ${ep.id}: checking videoUrl=${ep.videoUrl}`);
          const match = ep.videoUrl!.match(BUNNY_VIDEO_ID_RE);
          if (!match) {
            fastify.log.warn(`[bunny-sync] URL-ep ${ep.id}: no regex match — skipped`);
            continue;
          }
          const videoId = match[1] ?? match[2]; // group 1 = embed URL, group 2 = CDN pull zone URL
          const real = await fetchBunnyDuration(videoId);
          if (real !== null) {
            await fastify.prisma.workshopEpisode.update({
              where: { id: ep.id },
              data: { bunnyVideoId: videoId, durationSeconds: real },
            });
            fastify.log.info(`[bunny-sync] URL-ep ${ep.id}: backfilled bunnyVideoId=${videoId}, ${ep.durationSeconds}s → ${real}s`);
          }
        }

        fastify.log.info('[bunny-sync] Done');
      } catch (err) {
        fastify.log.warn({ err }, '[bunny-sync] Failed — will retry on next startup');
      }
    });

    // Graceful Shutdown
    for (const signal of ['SIGINT', 'SIGTERM']) {
      process.on(signal, async () => {
        fastify.log.info(`Received ${signal}, shutting down...`);
        await fastify.close();
        process.exit(0);
      });
    }

  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

bootstrap();
