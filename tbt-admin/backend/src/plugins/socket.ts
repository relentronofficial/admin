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
      // Presence bookkeeping — per-member online/lastSeen tracked in
      // an in-memory Map. This IS per-instance (Cloud Run can have N
      // replicas), but we broadcast presence:update via Socket.IO's
      // Redis adapter so every replica hears the transition. The Map
      // is used for direct HTTP queries; the socket broadcasts keep
      // clients in sync across instances.
      markMemberOnline(socket.data.memberId);
      io.emit('presence:update', {
        memberId: socket.data.memberId,
        online: true,
        lastSeenAt: new Date().toISOString(),
      });
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
      if (socket.data.role === 'member' && socket.data.memberId) {
        const memberId = socket.data.memberId;
        markMemberOffline(memberId).then((isFullyOffline) => {
          if (isFullyOffline) {
            io.emit('presence:update', {
              memberId,
              online: false,
              lastSeenAt: new Date().toISOString(),
            });
            // Persist last_seen so it survives backend restarts /
            // Cloud Run cold starts. Best-effort — a failed write just
            // means the info-sheet falls back to the in-memory value
            // (or null if the pod scaled to zero).
            fastify.prisma.member
              .update({
                where: { id: memberId },
                data: { lastSeenAt: new Date() },
              })
              .catch((err: unknown) => {
                fastify.log.warn({ err, memberId }, 'presence: last_seen persist failed');
              });
          }
        });
      }
    });
  });

  fastify.decorate('io', io);

  fastify.addHook('onClose', (instance, done) => {
    instance.io.close();
    done();
  });
}

// ── Presence store ──────────────────────────────────────────────────────────
// In-memory map: memberId → { socketCount, lastSeenAt }. Multiple sockets
// per member are tracked so opening a second tab doesn't flip presence
// off when the first tab disconnects. Cross-instance sync is via the
// Socket.IO Redis adapter — every replica sees presence:update events.
// Query via `getPresence(memberId)` from other modules.
interface PresenceEntry {
  socketCount: number;
  lastSeenAt: Date;
}
const _presence = new Map<string, PresenceEntry>();

function markMemberOnline(memberId: string) {
  const cur = _presence.get(memberId);
  const socketCount = (cur?.socketCount ?? 0) + 1;
  _presence.set(memberId, { socketCount, lastSeenAt: new Date() });
}

/** Returns true when the member had exactly ONE socket and it just closed
 *  (so we should broadcast an offline transition). If they have another
 *  tab open we keep them online and skip the broadcast. */
async function markMemberOffline(memberId: string): Promise<boolean> {
  const cur = _presence.get(memberId);
  if (!cur) return false;
  const next = cur.socketCount - 1;
  if (next <= 0) {
    _presence.set(memberId, { socketCount: 0, lastSeenAt: new Date() });
    return true;
  }
  _presence.set(memberId, { socketCount: next, lastSeenAt: new Date() });
  return false;
}

export function getPresence(memberId: string): { online: boolean; lastSeenAt: string | null } {
  const p = _presence.get(memberId);
  if (!p) return { online: false, lastSeenAt: null };
  return {
    online: p.socketCount > 0,
    lastSeenAt: p.lastSeenAt.toISOString(),
  };
}

export function getPresenceBulk(memberIds: string[]): Array<{
  memberId: string;
  online: boolean;
  lastSeenAt: string | null;
}> {
  return memberIds.map((id) => ({ memberId: id, ...getPresence(id) }));
}

/**
 * Bulk presence merged with DB last_seen_at. Any member without an
 * in-memory entry (e.g. after a Cloud Run cold start) gets its
 * `lastSeenAt` filled from the members.last_seen_at column. This is
 * async and hits the DB — use it from HTTP handlers where a single
 * extra round trip is acceptable; use `getPresenceBulk` (sync) from
 * socket paths that need to reply within the same tick.
 */
export async function getPresenceBulkWithDb(
  prisma: { member: { findMany: (...args: any[]) => Promise<Array<{ id: string; lastSeenAt: Date | null }>> } },
  memberIds: string[],
): Promise<Array<{ memberId: string; online: boolean; lastSeenAt: string | null }>> {
  const memory = getPresenceBulk(memberIds);
  const missingIds = memory.filter((p) => !p.online && !p.lastSeenAt).map((p) => p.memberId);
  if (missingIds.length === 0) return memory;
  try {
    const rows = await prisma.member.findMany({
      where: { id: { in: missingIds } },
      select: { id: true, lastSeenAt: true },
    });
    const byId = new Map(rows.map((r) => [r.id, r.lastSeenAt]));
    return memory.map((p) => {
      if (p.online || p.lastSeenAt) return p;
      const dbSeen = byId.get(p.memberId);
      return { ...p, lastSeenAt: dbSeen ? dbSeen.toISOString() : null };
    });
  } catch {
    return memory;
  }
}

export default fp(socketPlugin);
