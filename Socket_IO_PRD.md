# Socket.IO Implementation — PRD Spec Kit

> Full end-to-end specification for wiring real-time communication across the TBT platform.
> Backend: Fastify + Socket.IO v4.7.5 (already installed).
> Frontend: tbt-user-web (Next.js 15) + tbt-admin/admin-panel (Next.js 14).
> Auth: Clerk JWT — same `verifyToken` logic already used in HTTP routes.

---

## Current State (Baseline)

| Item | Status |
|---|---|
| `socket.io` on backend | ✅ Installed v4.7.5, plugin registered in `server.ts` |
| `fastify.io` decorator | ✅ Available globally in all route handlers |
| Socket plugin events | ❌ Only `connection` / `disconnect` logs — no business events |
| Socket auth | ❌ No token verification on handshake |
| `socket.io-client` in tbt-user-web | ❌ Not installed |
| `socket.io-client` in admin-panel | ❌ Not installed |
| Notification emit | ✅ `io.to(userId).emit('notification', ...)` exists but no client listens |
| Q&A real-time | ⚠️ Polling workaround — `refetchInterval: 15 * 1000` |

---

## Section 1 — Installation

### 1.1 tbt-user-web

```bash
# from F:\admin\tbt-user-web\
npm install socket.io-client
```

### 1.2 tbt-admin/admin-panel

```bash
# from F:\admin\tbt-admin\
npm install socket.io-client -w admin-panel
```

No backend install needed — `socket.io` already present.

---

## Section 2 — Backend: Rebuild the Socket Plugin

**File:** `tbt-admin/backend/src/plugins/socket.ts`

Complete replacement of the current empty plugin.

### 2.1 Authentication on Handshake

The socket handshake must verify the Clerk JWT sent as `auth.token`. Use the same `verifyToken` function used by HTTP routes. On success, attach `memberId` (for user-web clients) or `adminId` (for admin-panel clients) to the socket.

```typescript
// Pseudocode — exact implementation in Section 5
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Unauthorized'));

  const verified = await verifyToken(token, { secretKey: env.CLERK_SECRET_KEY });
  if (!verified?.sub) return next(new Error('Unauthorized'));

  // Determine if this is a member or admin by looking up DB
  const member = await prisma.member.findFirst({ where: { clerkId: verified.sub } });
  if (member) {
    socket.data.memberId = member.id;
    socket.data.role = 'member';
  } else {
    const admin = await prisma.admin.findFirst({ where: { clerkId: verified.sub } });
    if (admin) {
      socket.data.adminId = admin.id;
      socket.data.role = 'admin';
    } else {
      return next(new Error('Unauthorized: No account found'));
    }
  }
  next();
});
```

### 2.2 Room Architecture

| Room Name | Who joins | Purpose |
|---|---|---|
| `user:{memberId}` | Member on connection | Personal delivery — notifications, messages, enrollment updates |
| `workshop:{slug}` | Member on workshop detail page | Q&A live updates for that workshop |
| `live:{webinarId}` | Member on live page | Webinar status, attendee count |
| `admin` | Admin on connection | Admin dashboard live activity feed |

### 2.3 Connection Lifecycle

```typescript
io.on('connection', (socket) => {
  // Auto-join personal room on connect
  if (socket.data.role === 'member') {
    socket.join(`user:${socket.data.memberId}`);
  }
  if (socket.data.role === 'admin') {
    socket.join('admin');
  }

  // Client requests to join a workshop room
  socket.on('join:workshop', (slug: string) => {
    socket.join(`workshop:${slug}`);
  });

  // Client requests to leave a workshop room
  socket.on('leave:workshop', (slug: string) => {
    socket.leave(`workshop:${slug}`);
  });

  // Client requests to join a live room
  socket.on('join:live', (webinarId: string) => {
    socket.join(`live:${webinarId}`);
    // Emit updated attendee count to the room
    const count = io.sockets.adapter.rooms.get(`live:${webinarId}`)?.size ?? 0;
    io.to(`live:${webinarId}`).emit('live:attendee_count', { count });
  });

  // Client leaves live room
  socket.on('leave:live', (webinarId: string) => {
    socket.leave(`live:${webinarId}`);
    const count = io.sockets.adapter.rooms.get(`live:${webinarId}`)?.size ?? 0;
    io.to(`live:${webinarId}`).emit('live:attendee_count', { count });
  });

  socket.on('disconnect', () => {
    // Attendee count auto-updates via room departure
  });
});
```

### 2.4 CORS

Replace `origin: '*'` with explicit origins from env:

```typescript
const io = new Server(fastify.server, {
  cors: {
    origin: [
      env.USER_WEB_URL,    // e.g. http://localhost:3001
      env.ADMIN_WEB_URL,  // e.g. http://localhost:3000
    ],
    credentials: true,
  },
});
```

Add `USER_WEB_URL` and `ADMIN_WEB_URL` to `backend/.env` and `backend/src/config/env.ts`.

---

## Section 3 — Backend: Emit Points

For each feature, the backend controller must call `fastify.io` at the right moment. These are the exact locations to add socket emits.

### 3.1 Notifications (already partially done — fix + complete)

**File:** `tbt-admin/backend/src/modules/notifications/controller.ts`

**Current issue:** Uses `body.userId` but the Prisma `Notification` model uses `memberId`. Verify the field name in schema before using.

```typescript
// sendNotificationHandler — after DB create
const room = `user:${notification.memberId}`;
request.server.io.to(room).emit('notification', {
  id: notification.id,
  title: notification.title,
  body: notification.body,
  type: notification.type,
  isRead: false,
  createdAt: notification.sentAt,
});

// broadcastNotificationHandler — after createMany
request.server.io.emit('notification:broadcast', {
  title: body.title,
  body: body.body,
  type: body.type,
});
```

### 3.2 Q&A — New Question

**File:** `tbt-admin/backend/src/modules/user/controller.ts` — `postWorkshopQaHandler`

```typescript
// After DB create of the QA post
request.server.io.to(`workshop:${slug}`).emit('qa:new_question', {
  id: post.id,
  questionText: post.questionText,
  memberName: post.memberName,
  createdAt: post.createdAt,
  replies: [],
});
```

### 3.3 Q&A — New Reply

**File:** `tbt-admin/backend/src/modules/user/controller.ts` — `postQaReplyHandler`

```typescript
// After DB create of the reply
// Need the workshop slug — look up via post.workshopId relation
request.server.io.to(`workshop:${workshopSlug}`).emit('qa:new_reply', {
  postId,
  reply: {
    id: reply.id,
    replyText: reply.replyText,
    createdAt: reply.createdAt,
  },
});
```

### 3.4 Webinar Status Change

**File:** `tbt-admin/backend/src/modules/webinar/controller.ts` (wherever start/end is handled)

```typescript
// When admin starts a webinar
request.server.io.to(`live:${webinarId}`).emit('live:started', {
  webinarId,
  streamUrl: webinar.streamUrl,
  startedAt: new Date().toISOString(),
});

// When admin ends a webinar
request.server.io.to(`live:${webinarId}`).emit('live:ended', {
  webinarId,
  recordingUrl: webinar.recordingUrl ?? null,
});

// Also notify personal rooms of enrolled members
enrolledMemberIds.forEach((memberId) => {
  request.server.io.to(`user:${memberId}`).emit('live:reminder', {
    webinarId,
    title: webinar.title,
  });
});
```

### 3.5 Workshop Enrollment Change

**File:** `tbt-admin/backend/src/modules/workshops/controller.ts` — enroll/remove handlers

```typescript
// After enrolling a member
request.server.io.to(`user:${memberId}`).emit('workshop:enrolled', {
  workshopId,
  workshopTitle,
});

// After removing a member
request.server.io.to(`user:${memberId}`).emit('workshop:removed', {
  workshopId,
});
```

### 3.6 Admin Dashboard Activity

**File:** `tbt-admin/backend/src/modules/members/controller.ts` — member create

```typescript
// After new member is created
request.server.io.to('admin').emit('admin:member_joined', {
  memberId: member.id,
  fullName: member.firstName + ' ' + (member.lastName ?? ''),
  createdAt: member.createdAt,
});
```

---

## Section 4 — Frontend: tbt-user-web

### 4.1 Socket Client Singleton

**New file:** `tbt-user-web/lib/socket/client.ts`

```typescript
import { io, Socket } from 'socket.io-client';

let _socket: Socket | null = null;
let _getToken: (() => Promise<string | null>) | null = null;

export function initSocket(getToken: () => Promise<string | null>) {
  _getToken = getToken;
}

export async function getSocket(): Promise<Socket> {
  if (_socket?.connected) return _socket;

  const token = _getToken ? await _getToken() : null;

  _socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000', {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
  });

  return _socket;
}

export function disconnectSocket() {
  if (_socket) {
    _socket.disconnect();
    _socket = null;
  }
}
```

### 4.2 Initialize in Providers

**File:** `tbt-user-web/components/Providers.tsx`

In `AuthInterceptor`, after `initApiClient`, also call `initSocket`:

```typescript
import { initSocket } from '@/lib/socket/client';

function AuthInterceptor() {
  const { getToken } = useAuth();
  initApiClient(() => getToken());
  initSocket(() => getToken());
  return null;
}
```

### 4.3 Socket Context / Hook

**New file:** `tbt-user-web/lib/socket/useSocket.ts`

```typescript
'use client';

import { useEffect, useRef, useState } from 'react';
import { type Socket } from 'socket.io-client';
import { getSocket } from './client';

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let mounted = true;

    getSocket().then((s) => {
      if (!mounted) return;
      socketRef.current = s;

      s.on('connect', () => setConnected(true));
      s.on('disconnect', () => setConnected(false));
      if (s.connected) setConnected(true);
    });

    return () => {
      mounted = false;
    };
  }, []);

  return { socket: socketRef.current, connected };
}
```

### 4.4 Feature: Notifications (Navbar + Notifications Page)

**File:** `tbt-user-web/components/layout/Navbar.tsx`

Add a socket listener that increments the unread count badge when a `notification` event arrives, without waiting for the next REST poll:

```typescript
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSocket } from '@/lib/socket/client';

// Inside Navbar component:
const queryClient = useQueryClient();

useEffect(() => {
  let mounted = true;
  getSocket().then((socket) => {
    if (!mounted) return;
    socket.on('notification', () => {
      // Invalidate both the unread count and the full notifications list
      queryClient.invalidateQueries({ queryKey: ['user', 'notifications'] });
    });
    socket.on('notification:broadcast', () => {
      queryClient.invalidateQueries({ queryKey: ['user', 'notifications'] });
    });
  });
  return () => {
    mounted = false;
    getSocket().then((s) => {
      s.off('notification');
      s.off('notification:broadcast');
    });
  };
}, [queryClient]);
```

**Effect:** Bell badge updates instantly when admin pushes a notification — no polling.

### 4.5 Feature: Q&A Real-Time Updates

**File:** `tbt-user-web/app/(platform)/workshop/[slug]/page.tsx`

Remove `refetchInterval: 15 * 1000` from `useWorkshopQa` (in `lib/hooks/useConfig.ts`) once sockets are wired.

In the workshop page, join/leave the workshop room and listen for Q&A events:

```typescript
const queryClient = useQueryClient();

useEffect(() => {
  if (!slug) return;
  let mounted = true;

  getSocket().then((socket) => {
    if (!mounted) return;

    // Join the workshop room
    socket.emit('join:workshop', slug);

    // New question from any member
    socket.on('qa:new_question', (question) => {
      queryClient.invalidateQueries({ queryKey: ['workshop-qa', slug] });
    });

    // New reply to a question
    socket.on('qa:new_reply', ({ postId }) => {
      queryClient.invalidateQueries({ queryKey: ['workshop-qa', slug] });
    });
  });

  return () => {
    mounted = false;
    getSocket().then((socket) => {
      socket.emit('leave:workshop', slug);
      socket.off('qa:new_question');
      socket.off('qa:new_reply');
    });
  };
}, [slug, queryClient]);
```

**Effect:** Q&A updates appear for all members on the same workshop page instantly. Remove the `refetchInterval: 15 * 1000` from `useWorkshopQa`.

### 4.6 Feature: Live / Webinar Page

**File:** `tbt-user-web/app/(platform)/live/[webinarId]/page.tsx`

```typescript
useEffect(() => {
  if (!webinarId) return;
  let mounted = true;

  getSocket().then((socket) => {
    if (!mounted) return;

    socket.emit('join:live', webinarId);

    socket.on('live:started', ({ streamUrl }) => {
      // Update local state — show the stream embed
      setStreamUrl(streamUrl);
      setStatus('live');
    });

    socket.on('live:ended', ({ recordingUrl }) => {
      setStatus('ended');
      setRecordingUrl(recordingUrl);
    });

    socket.on('live:attendee_count', ({ count }) => {
      setAttendeeCount(count);
    });
  });

  return () => {
    mounted = false;
    getSocket().then((socket) => {
      socket.emit('leave:live', webinarId);
      socket.off('live:started');
      socket.off('live:ended');
      socket.off('live:attendee_count');
    });
  };
}, [webinarId]);
```

### 4.7 Feature: Messages Navbar Badge

**File:** `tbt-user-web/components/layout/Navbar.tsx`

```typescript
useEffect(() => {
  let mounted = true;
  getSocket().then((socket) => {
    if (!mounted) return;
    socket.on('message:new', () => {
      queryClient.invalidateQueries({ queryKey: ['user', 'messages'] });
    });
  });
  return () => {
    mounted = false;
    getSocket().then((s) => s.off('message:new'));
  };
}, [queryClient]);
```

### 4.8 Feature: Workshop Enrollment Updates

**File:** `tbt-user-web/app/(platform)/workshops/page.tsx`

```typescript
useEffect(() => {
  let mounted = true;
  getSocket().then((socket) => {
    if (!mounted) return;
    socket.on('workshop:enrolled', () => {
      queryClient.invalidateQueries({ queryKey: ['my-workshops'] });
    });
    socket.on('workshop:removed', () => {
      queryClient.invalidateQueries({ queryKey: ['my-workshops'] });
    });
  });
  return () => {
    mounted = false;
    getSocket().then((s) => {
      s.off('workshop:enrolled');
      s.off('workshop:removed');
    });
  };
}, [queryClient]);
```

### 4.9 Disconnect on Sign-Out

**File:** `tbt-user-web/components/Providers.tsx` or a dedicated sign-out handler

```typescript
import { disconnectSocket } from '@/lib/socket/client';

// Call on Clerk sign-out event
disconnectSocket();
```

---

## Section 5 — Frontend: tbt-admin/admin-panel

### 5.1 Socket Client Singleton

**New file:** `tbt-admin/admin-panel/lib/socket/client.ts`

Same pattern as tbt-user-web, pointing to the same backend URL:

```typescript
import { io, Socket } from 'socket.io-client';

let _socket: Socket | null = null;
let _getToken: (() => Promise<string | null>) | null = null;

export function initAdminSocket(getToken: () => Promise<string | null>) {
  _getToken = getToken;
}

export async function getAdminSocket(): Promise<Socket> {
  if (_socket?.connected) return _socket;

  const token = _getToken ? await _getToken() : null;

  _socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000', {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
  });

  return _socket;
}
```

### 5.2 Initialize in Admin Providers

**File:** `tbt-admin/admin-panel/components/Providers.tsx`

```typescript
import { initAdminSocket } from '@/lib/socket/client';

function AuthInterceptor() {
  const { getToken } = useAuth();
  initApiClient(() => getToken());
  initAdminSocket(() => getToken());
  return null;
}
```

### 5.3 Feature: Admin Dashboard Live Feed

**File:** `tbt-admin/admin-panel/app/dashboard/page.tsx`

```typescript
useEffect(() => {
  let mounted = true;
  getAdminSocket().then((socket) => {
    if (!mounted) return;

    socket.on('admin:member_joined', (data) => {
      // Invalidate dashboard stats query
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'stats'] });
      // Optionally show a toast: "New member joined: {data.fullName}"
    });
  });
  return () => {
    mounted = false;
    getAdminSocket().then((s) => s.off('admin:member_joined'));
  };
}, [queryClient]);
```

### 5.4 Feature: Notification Delivery Confirmation

**File:** `tbt-admin/admin-panel/app/app-notifications/page.tsx`

When admin sends a notification, the badge for how many members received it in real-time can be shown. Listen for acknowledgement from the backend if needed (optional enhancement).

---

## Section 6 — Environment Variables

### 6.1 Backend `.env` additions

```env
USER_WEB_URL=http://localhost:3001
ADMIN_WEB_URL=http://localhost:3000
```

In production:
```env
USER_WEB_URL=https://app.tbt.com
ADMIN_WEB_URL=https://admin.tbt.com
```

### 6.2 `backend/src/config/env.ts` additions

```typescript
USER_WEB_URL: z.string().url().default('http://localhost:3001'),
ADMIN_WEB_URL: z.string().url().default('http://localhost:3000'),
```

---

## Section 7 — Complete Event Reference

| Event Name | Direction | Emitted By | Received By | Room | Trigger |
|---|---|---|---|---|---|
| `notification` | Server → Client | `notifications/controller.ts` | Navbar, `/notifications` page | `user:{memberId}` | Admin sends targeted notification |
| `notification:broadcast` | Server → Client | `notifications/controller.ts` | Navbar, `/notifications` page | All sockets | Admin broadcasts to all |
| `qa:new_question` | Server → Client | `user/controller.ts` | `/workshop/[slug]` Q&A tab | `workshop:{slug}` | Member posts a question |
| `qa:new_reply` | Server → Client | `user/controller.ts` | `/workshop/[slug]` Q&A tab | `workshop:{slug}` | Member or admin replies |
| `live:started` | Server → Client | `webinar/controller.ts` | `/live/[webinarId]` | `live:{webinarId}` | Admin starts webinar |
| `live:ended` | Server → Client | `webinar/controller.ts` | `/live/[webinarId]` | `live:{webinarId}` | Admin ends webinar |
| `live:attendee_count` | Server → Client | `socket.ts` plugin | `/live/[webinarId]` | `live:{webinarId}` | Member joins/leaves live room |
| `live:reminder` | Server → Client | `webinar/controller.ts` | Navbar (toast) | `user:{memberId}` | Admin starts webinar (pushes to enrolled members) |
| `message:new` | Server → Client | Future messages controller | Navbar, `/messages` | `user:{memberId}` | Admin sends a message |
| `workshop:enrolled` | Server → Client | `workshops/controller.ts` | `/workshops` page | `user:{memberId}` | Admin enrolls a member |
| `workshop:removed` | Server → Client | `workshops/controller.ts` | `/workshops` page | `user:{memberId}` | Admin removes a member |
| `admin:member_joined` | Server → Client | `members/controller.ts` | Admin `/dashboard` | `admin` | New member is created |
| `join:workshop` | Client → Server | `/workshop/[slug]` page | `socket.ts` plugin | — | Member enters workshop page |
| `leave:workshop` | Client → Server | `/workshop/[slug]` page | `socket.ts` plugin | — | Member leaves workshop page |
| `join:live` | Client → Server | `/live/[webinarId]` page | `socket.ts` plugin | — | Member enters live page |
| `leave:live` | Client → Server | `/live/[webinarId]` page | `socket.ts` plugin | — | Member leaves live page |

---

## Section 8 — Implementation Order

Implement in this order to minimise risk and get visible results early:

| Step | What | Why First |
|---|---|---|
| 1 | Install `socket.io-client` in both frontends | Unlocks everything |
| 2 | Rebuild backend socket plugin with auth + rooms | Foundation — must be done before frontend |
| 3 | Add env vars `USER_WEB_URL`, `ADMIN_WEB_URL` | Needed for CORS |
| 4 | Create `lib/socket/client.ts` in tbt-user-web | Singleton needed by all features |
| 5 | Wire `initSocket` in `Providers.tsx` | Without this nothing connects |
| 6 | Notifications (Navbar badge + page) | Highest visibility; backend emit already exists |
| 7 | Q&A real-time + remove `refetchInterval` | Fixes existing polling hack |
| 8 | Live / Webinar status | High user impact |
| 9 | Workshop enrollment updates | Medium impact |
| 10 | Admin panel socket client + dashboard feed | Admin-side polish |
| 11 | Message badge updates | Depends on future messages backend |

---

## Section 9 — Known Constraints & Notes

1. **`refetchInterval: 15 * 1000` on `useWorkshopQa`** — remove it once Step 7 is done. Keeping both causes double updates.

2. **Notification model field name** — the existing `sendNotificationHandler` uses `body.userId` but the member route uses `memberId`. Verify which field name the `Notification` Prisma model uses before wiring socket emit.

3. **Admin socket role detection** — on connection, the plugin looks up both `member` and `admin` tables using the Clerk sub. Ensure the admin panel's Clerk users are in the `Admin` table (not `Member` table) so the role detection branches correctly.

4. **Reconnection token refresh** — Clerk tokens expire. The singleton `getSocket()` fetches the token only on first connect. On reconnect after expiry, the socket may fail auth. Fix: in the `reconnect_attempt` event, call `disconnectSocket()` then `getSocket()` fresh.

5. **Multiple browser tabs** — each tab opens a separate socket. Personal room delivery (`user:{memberId}`) sends to all sockets in the room, so all tabs update simultaneously. This is correct behaviour.

6. **Redis adapter** — if the backend is scaled to multiple Railway instances, Socket.IO needs `@socket.io/redis-adapter` with Upstash Redis (already installed) so events from one instance reach clients connected to another. Not required for single-instance deployment.

7. **Agora.io** — environment variables (`AGORA_APP_ID`, `AGORA_APP_CERT`) exist but are unused. Agora handles its own WebRTC transport for audio/video. Socket.IO is only needed for the signalling layer (started/ended status, attendee count). Do not replace Agora with Socket.IO for actual video streaming.
