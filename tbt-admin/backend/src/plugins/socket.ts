import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import fp from 'fastify-plugin';
import { Server } from 'socket.io';
import { verifyToken } from '@clerk/backend';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis as IORedis } from 'ioredis';
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

  // ── Redis adapter (cross-instance broadcast) ───────────────────────────────
  // Cloud Run scales to N instances under load. Without a pub/sub adapter,
  // an emit on instance A never reaches sockets on instance B, so DM-style
  // events (`io.to('user:${id}').emit(...)`) silently drop for any client
  // that happens to be on another pod. Attach the Upstash TCP client only
  // when the env var is present; otherwise stick with the default in-memory
  // adapter (fine for local dev and single-instance runs).
  const tcpRedisUrl = env.UPSTASH_REDIS_URL;
  if (tcpRedisUrl) {
    try {
      const useTls = tcpRedisUrl.startsWith('rediss://');
      const pubClient = new IORedis(tcpRedisUrl, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: false,
        ...(useTls ? { tls: {} } : {}),
      });
      const subClient = pubClient.duplicate();
      // Swallow late errors so a transient Upstash blip doesn't crash
      // the process — the adapter itself will recover on reconnect.
      pubClient.on('error', (err: Error) => fastify.log.warn({ err }, 'socket.io pub redis error'));
      subClient.on('error', (err: Error) => fastify.log.warn({ err }, 'socket.io sub redis error'));

      io.adapter(createAdapter(pubClient, subClient));
      fastify.log.info('✅ Socket.IO Redis adapter attached (cross-instance broadcast)');

      fastify.addHook('onClose', async () => {
        await Promise.allSettled([pubClient.quit(), subClient.quit()]);
      });
    } catch (err) {
      fastify.log.warn({ err }, '⚠️ Socket.IO Redis adapter failed to attach — falling back to in-memory (events will not cross instances)');
    }
  } else {
    fastify.log.warn('⚠️ UPSTASH_REDIS_URL missing — Socket.IO using in-memory adapter (single instance only)');
  }

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
      // Item #30: every connected member joins the shared 'community'
      // room so the feed can fan-out new posts / likes / comments
      // without per-socket tracking.
      socket.join('community');
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

    // ── Group chat (WhatsApp-inspired) rooms ────────────────────────────────
    // Clients emit `join:chat_group` when opening a group chat and
    // `leave:chat_group` when closing it. Backend handlers emit to
    // `group:{id}` in the chat_group_messages controller.
    socket.on('join:chat_group', ({ groupId }: { groupId: string }) => {
      if (typeof groupId === 'string' && groupId.length > 0) {
        socket.join(`group:${groupId}`);
      }
    });

    socket.on('leave:chat_group', ({ groupId }: { groupId: string }) => {
      if (typeof groupId === 'string' && groupId.length > 0) {
        socket.leave(`group:${groupId}`);
      }
    });

    socket.on('chat_group:typing', ({ groupId, isTyping }: { groupId: string; isTyping: boolean }) => {
      if (!groupId) return;
      socket.to(`group:${groupId}`).emit('group:typing', {
        groupId,
        memberId: socket.data.memberId ?? null,
        adminId: socket.data.adminId ?? null,
        isTyping,
      });
    });

    // Hand raise queue — ephemeral, no DB
    socket.on('live_call:hand_raised', (data: { liveCallId: string; memberName: string }) => {
      io.to('admin').emit('live_call:hand_raised', {
        liveCallId: data.liveCallId,
        memberName: data.memberName || 'Member',
        memberId: socket.data.memberId ?? socket.id,
        raisedAt: new Date().toISOString(),
      });
    });

    socket.on('live_call:hand_lowered', (data: { liveCallId: string }) => {
      io.to('admin').emit('live_call:hand_lowered', {
        liveCallId: data.liveCallId,
        memberId: socket.data.memberId ?? socket.id,
      });
    });

    // Admin clears a specific member's hand
    socket.on('live_call:hand_cleared', (data: { liveCallId: string; memberId: string }) => {
      if (data.memberId) {
        io.to(`user:${data.memberId}`).emit('live_call:hand_cleared', { liveCallId: data.liveCallId });
      }
      // Remove from admin queue too
      io.to('admin').emit('live_call:hand_lowered', { liveCallId: data.liveCallId, memberId: data.memberId });
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
