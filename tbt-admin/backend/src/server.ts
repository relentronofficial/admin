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

async function bootstrap() {
  const fastify = Fastify({
    logger: {
      level: 'info',
      transport: env.NODE_ENV === 'development' ? {
        target: 'pino-pretty',
        options: { translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' }
      } : undefined
    }
  });

  try {
    // Register Plugins
    await fastify.register(sentryPlugin);
    await fastify.register(prismaPlugin);
    await fastify.register(redisPlugin);
    await fastify.register(clerkPlugin);
    await fastify.register(supabasePlugin);
    await fastify.register(socketPlugin);

    await fastify.register(cors, { origin: true });
    await fastify.register(helmet);
    await fastify.register(rateLimit, { max: 100, timeWindow: '1 minute' });

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

    // Root + Health Check
    fastify.get('/', async () => ({ name: 'TBT Admin API', status: 'ok' }));
    fastify.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

    const port = env.PORT;
    const host = '0.0.0.0';

    await fastify.listen({ port, host });
    console.log(`🚀 Server ready at http://localhost:${port}`);

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
