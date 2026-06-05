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

async function socketPlugin(fastify: FastifyInstance, _opts: FastifyPluginOptions) {
  const io = new Server(fastify.server, {
    cors: {
      origin: [env.USER_WEB_URL, env.ADMIN_WEB_URL],
      credentials: true,
    },
  });

  // ── Handshake auth ─────────────────────────────────────────────────────────
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error('Unauthorized'));

    try {
      const verified = await verifyToken(token, {
        secretKey: env.CLERK_SECRET_KEY,
        jwtKey: env.CLERK_JWT_PUBLIC_KEY || undefined,
      });

      if (!verified?.sub) return next(new Error('Unauthorized'));

      const member = await fastify.prisma.member.findFirst({
        where: { clerkId: verified.sub } as any,
        select: { id: true },
      });

      if (member) {
        socket.data.memberId = member.id;
        socket.data.role = 'member';
        return next();
      }

      const admin = await fastify.prisma.admin.findFirst({
        where: { clerkId: verified.sub } as any,
        select: { id: true },
      });

      if (admin) {
        socket.data.adminId = admin.id;
        socket.data.role = 'admin';
        return next();
      }

      return next(new Error('Unauthorized: No account found'));
    } catch (err: any) {
      fastify.log.error({ message: err.message }, 'Socket auth failed');
      return next(new Error('Unauthorized'));
    }
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

    socket.on('join:workshop', (slug: string) => {
      socket.join(`workshop:${slug}`);
    });

    socket.on('leave:workshop', (slug: string) => {
      socket.leave(`workshop:${slug}`);
    });

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
