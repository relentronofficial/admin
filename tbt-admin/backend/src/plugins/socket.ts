import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import fp from 'fastify-plugin';
import { Server } from 'socket.io';
import { verifyToken } from '@clerk/backend';
import { env } from '../config/env.js';

declare module 'fastify' {
  interface FastifyInstance {
    io: Server;
  }
}

function parseCookies(header?: string): Record<string, string> {
  if (!header) return {};
  return Object.fromEntries(
    header.split(';').map((c) => {
      const idx = c.indexOf('=');
      if (idx === -1) return [c.trim(), ''];
      return [c.slice(0, idx).trim(), c.slice(idx + 1).trim()];
    }),
  );
}

async function socketPlugin(fastify: FastifyInstance, _opts: FastifyPluginOptions) {
  const io = new Server(fastify.server, {
    cors: {
      origin: [env.USER_WEB_URL, env.ADMIN_WEB_URL],
      credentials: true,
    },
  });

  // ── Handshake auth ─────────────────────────────────────────────────────────
  io.use(async (socket, next) => {
    // Member auth: JWT from HttpOnly cookie
    const cookies = parseCookies(socket.handshake.headers.cookie as string | undefined);
    const jwtToken = cookies['tbt_access'];

    if (jwtToken) {
      try {
        const decoded = await (fastify as any).jwt.verify(jwtToken) as { memberId: string };
        if (decoded?.memberId) {
          const member = await fastify.prisma.member.findUnique({
            where: { id: decoded.memberId },
            select: { id: true },
          });
          if (member) {
            socket.data.memberId = member.id;
            socket.data.role = 'member';
            return next();
          }
        }
      } catch { /* fall through to Clerk auth */ }
    }

    // Admin auth: Clerk token from auth.token
    const clerkToken = socket.handshake.auth?.token as string | undefined;
    if (clerkToken) {
      try {
        const verified = await verifyToken(clerkToken, {
          secretKey: env.CLERK_SECRET_KEY,
          jwtKey: env.CLERK_JWT_PUBLIC_KEY || undefined,
        });
        if (verified?.sub) {
          const admin = await fastify.prisma.admin.findFirst({
            where: { clerkId: verified.sub } as any,
            select: { id: true },
          });
          if (admin) {
            socket.data.adminId = admin.id;
            socket.data.role = 'admin';
            return next();
          }
        }
      } catch { /* fall through */ }
    }

    return next(new Error('Unauthorized'));
  });

  // ── Connection lifecycle ───────────────────────────────────────────────────
  io.on('connection', (socket) => {
    if (socket.data.role === 'member') {
      socket.join(`user:${socket.data.memberId}`);
      fastify.log.info(`Member ${socket.data.memberId} connected (${socket.id})`);
    }
    if (socket.data.role === 'admin') {
      socket.join('admin');
      fastify.log.info(`Admin ${socket.data.adminId} connected (${socket.id})`);
    }

    socket.on('join:workshop', (slug: string) => socket.join(`workshop:${slug}`));
    socket.on('leave:workshop', (slug: string) => socket.leave(`workshop:${slug}`));

    socket.on('join:live', (webinarId: string) => {
      socket.join(`live:${webinarId}`);
      const count = io.sockets.adapter.rooms.get(`live:${webinarId}`)?.size ?? 0;
      io.to(`live:${webinarId}`).emit('live:attendee_count', { count });
    });

    socket.on('leave:live', (webinarId: string) => {
      socket.leave(`live:${webinarId}`);
      const count = io.sockets.adapter.rooms.get(`live:${webinarId}`)?.size ?? 0;
      io.to(`live:${webinarId}`).emit('live:attendee_count', { count });
    });

    socket.on('chat:join', ({ conversationId }: { conversationId: string }) => {
      socket.join(`conversation:${conversationId}`);
    });

    socket.on('chat:leave', ({ conversationId }: { conversationId: string }) => {
      socket.leave(`conversation:${conversationId}`);
    });

    socket.on('chat:typing', ({ conversationId, isTyping }: { conversationId: string; isTyping: boolean }) => {
      socket.to(`conversation:${conversationId}`).emit('chat:typing', {
        conversationId,
        senderType: socket.data.role,
        isTyping,
      });
    });

    socket.on('disconnect', () => {
      fastify.log.info(`Socket disconnected: ${socket.id}`);
    });
  });

  fastify.decorate('io', io);

  fastify.addHook('onClose', (instance, done) => {
    instance.io.close();
    done();
  });
}

export default fp(socketPlugin);
