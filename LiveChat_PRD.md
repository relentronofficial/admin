# Live Chat PRD Spec Kit

> Bidirectional real-time messaging between TBT members and admins.
> Builds on the existing `DirectMessage` + Socket.IO infrastructure.
> Covers: threaded conversation model, member reply, typing indicators,
> two-pane chat UI for both member web and admin panel.

---

## Current State (Baseline)

| Item | Status |
|---|---|
| `DirectMessage` Prisma model | ✅ Exists — one-way, no `conversationId` |
| `SenderType` enum (`admin` \| `member`) | ✅ Exists |
| `POST /api/messages/send` — admin sends one-way message | ✅ Exists |
| `GET /api/user/messages` — member reads inbox | ✅ Exists |
| Socket plugin — members join `user:{memberId}`, admins join `admin` | ✅ Exists |
| `socket.data.memberId` / `socket.data.adminId` / `socket.data.role` | ✅ Set on handshake |
| `chat:join` / `chat:leave` / `chat:typing` socket events | ❌ Missing |
| `Conversation` Prisma model | ❌ Missing |
| Member reply endpoint | ❌ Missing |
| Admin conversation list/reply endpoints | ❌ Missing |
| Two-pane chat UI — member web | ❌ Missing (current UI is read-only inbox) |
| Two-pane chat UI — admin panel | ❌ Missing (current UI is one-way compose form) |

---

## Section 1 — Data Model

### 1.1 New `Conversation` Model

Insert after the `DirectMessage` model in `schema.prisma`:

```prisma
enum ConversationStatus {
  open
  closed
}

model Conversation {
  id                String             @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  memberId          String             @map("member_id") @db.Uuid
  subject           String
  status            ConversationStatus @default(open)
  memberUnreadCount Int                @default(0) @map("member_unread_count")
  adminUnreadCount  Int                @default(0) @map("admin_unread_count")
  lastMessageAt     DateTime           @default(now()) @map("last_message_at") @db.Timestamptz(6)
  createdAt         DateTime           @default(now()) @map("created_at") @db.Timestamptz(6)

  member            Member             @relation(fields: [memberId], references: [id], onDelete: Cascade)
  messages          DirectMessage[]

  @@map("conversations")
}
```

- `memberUnreadCount` — incremented when admin sends, reset to 0 when member views the conversation.
- `adminUnreadCount` — incremented when member sends, reset to 0 when admin views the conversation.
- `lastMessageAt` — used to sort conversation lists by most recent activity.

### 1.2 Extend `DirectMessage`

Two changes to the existing model:

```prisma
model DirectMessage {
  id             String          @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  conversationId String?         @map("conversation_id") @db.Uuid   // NEW — nullable for legacy records
  memberId       String          @map("member_id") @db.Uuid
  senderId       String          @map("sender_id") @db.Uuid
  senderType     SenderType      @map("sender_type")
  subject        String?                                              // CHANGED — nullable (subject lives on Conversation now)
  body           String
  isRead         Boolean         @default(false) @map("is_read")
  readAt         DateTime?       @map("read_at") @db.Timestamptz(6)
  createdAt      DateTime        @default(now()) @map("created_at") @db.Timestamptz(6)

  conversation   Conversation?   @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  member         Member          @relation(fields: [memberId], references: [id], onDelete: Cascade)

  @@map("direct_messages")
}
```

> Both changes are backward-safe: existing rows keep their `subject` values and get `conversationId = NULL`.

### 1.3 Add Relation to `Member` Model

In the `Member` model's relations block, add:

```prisma
conversations Conversation[]
```

### 1.4 Add UiStrings Chat Fields

In the `UiStrings` model, add before `createdAt`:

```prisma
chatPageTitle       String @default("Chat")                                       @map("chat_page_title")
chatNewLabel        String @default("New Conversation")                           @map("chat_new_label")
chatSubjectLabel    String @default("Subject")                                    @map("chat_subject_label")
chatTypingText      String @default("is typing...")                               @map("chat_typing_text")
chatClosedLabel     String @default("This conversation has been closed.")         @map("chat_closed_label")
chatEmptyTitle      String @default("No conversations yet")                       @map("chat_empty_title")
chatEmptyDesc       String @default("Start a conversation with the TBT team.")    @map("chat_empty_desc")
chatSelectPrompt    String @default("Select a conversation or start a new one.")  @map("chat_select_prompt")
```

### 1.5 Run Migration

```bash
# from tbt-admin/
npx prisma db push --schema=backend/prisma/schema.prisma
npm run prepare
```

---

## Section 2 — Backend: Member Conversation Endpoints

Add these handlers to `backend/src/modules/user/controller.ts` and register them in `backend/src/modules/user/routes.ts`.

### 2.1 Zod Schemas (add to `user/schema.ts` or inline in controller)

```typescript
export const startConversationSchema = z.object({
  subject: z.string().min(1).max(200),
  body:    z.string().min(1).max(5000),
});

export const sendChatMessageSchema = z.object({
  body: z.string().min(1).max(5000),
});
```

### 2.2 Controller Functions

```typescript
// ── POST /api/user/conversations ─────────────────────────────────────────────
export async function startConversationHandler(request: FastifyRequest, reply: FastifyReply) {
  const { subject, body } = request.body as { subject: string; body: string };
  const memberId = request.memberId!;

  const conversation = await request.server.prisma.$transaction(async (tx) => {
    const convo = await tx.conversation.create({
      data: { memberId, subject, adminUnreadCount: 1, lastMessageAt: new Date() },
    });
    await tx.directMessage.create({
      data: { conversationId: convo.id, memberId, senderId: memberId, senderType: 'member', body },
    });
    return convo;
  });

  // Notify all connected admins of the new conversation
  const member = await request.server.prisma.member.findUnique({
    where: { id: memberId },
    select: { firstName: true, lastName: true },
  });
  const memberName = `${member?.firstName ?? ''} ${member?.lastName ?? ''}`.trim() || 'A member';

  request.server.io.to('admin').emit('chat:conversation_new', {
    conversationId: conversation.id,
    memberName,
    subject,
  });

  return reply.status(201).send({ success: true, data: { id: conversation.id }, error: null });
}

// ── GET /api/user/conversations ──────────────────────────────────────────────
export async function listMemberConversationsHandler(request: FastifyRequest, reply: FastifyReply) {
  const memberId = request.memberId!;

  const conversations = await request.server.prisma.conversation.findMany({
    where: { memberId },
    orderBy: { lastMessageAt: 'desc' },
    include: {
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { body: true, senderType: true, createdAt: true },
      },
    },
  });

  return ok(reply, conversations.map((c) => ({
    id:               c.id,
    subject:          c.subject,
    status:           c.status,
    memberUnreadCount: c.memberUnreadCount,
    lastMessageAt:    c.lastMessageAt,
    lastMessage:      c.messages[0] ?? null,
  })));
}

// ── GET /api/user/conversations/:id/messages ─────────────────────────────────
export async function getMemberConversationMessagesHandler(request: FastifyRequest, reply: FastifyReply) {
  const memberId = request.memberId!;
  const { id } = request.params as { id: string };

  const convo = await request.server.prisma.conversation.findFirst({ where: { id, memberId } });
  if (!convo) return reply.status(404).send({ success: false, data: null, error: 'Conversation not found' });

  // Reset member unread count when they open the conversation
  await request.server.prisma.conversation.update({ where: { id }, data: { memberUnreadCount: 0 } });

  const messages = await request.server.prisma.directMessage.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: 'asc' },
  });

  // Batch-resolve admin senders
  const adminIds = [...new Set(messages.filter((m) => m.senderType === 'admin').map((m) => m.senderId))];
  const admins = adminIds.length > 0
    ? await request.server.prisma.admin.findMany({
        where: { id: { in: adminIds } },
        select: { id: true, fullName: true, profilePhotoUrl: true },
      })
    : [];
  const adminMap = Object.fromEntries(admins.map((a) => [a.id, a]));

  const data = messages.map((m) => {
    const sender = m.senderType === 'admin' ? adminMap[m.senderId] : null;
    return {
      id:              m.id,
      senderType:      m.senderType,
      senderId:        m.senderId,
      senderName:      m.senderType === 'member' ? 'You' : (sender?.fullName ?? 'TBT Team'),
      senderAvatarUrl: sender?.profilePhotoUrl ?? null,
      body:            m.body,
      createdAt:       m.createdAt,
    };
  });

  return ok(reply, data, { conversationId: id, status: convo.status, subject: convo.subject });
}

// ── POST /api/user/conversations/:id/messages ─────────────────────────────────
export async function sendMemberChatMessageHandler(request: FastifyRequest, reply: FastifyReply) {
  const memberId = request.memberId!;
  const { id } = request.params as { id: string };
  const { body } = request.body as { body: string };

  const convo = await request.server.prisma.conversation.findFirst({
    where: { id, memberId, status: 'open' },
  });
  if (!convo) return reply.status(404).send({ success: false, data: null, error: 'Conversation not found or closed' });

  const message = await request.server.prisma.$transaction(async (tx) => {
    const msg = await tx.directMessage.create({
      data: { conversationId: id, memberId, senderId: memberId, senderType: 'member', body },
    });
    await tx.conversation.update({
      where: { id },
      data: { lastMessageAt: new Date(), adminUnreadCount: { increment: 1 } },
    });
    return msg;
  });

  request.server.io.to(`conversation:${id}`).emit('chat:message', {
    conversationId: id,
    message: {
      id:         message.id,
      senderId:   memberId,
      senderType: 'member',
      senderName: 'Member',
      body,
      createdAt:  message.createdAt,
    },
  });

  // Ping admin room so badge updates even if no admin is in the conversation view
  request.server.io.to('admin').emit('chat:unread_ping', { conversationId: id });

  return reply.status(201).send({ success: true, data: { id: message.id }, error: null });
}
```

### 2.3 Register in `user/routes.ts`

Add alongside the existing message routes:

```typescript
import {
  startConversationHandler,
  listMemberConversationsHandler,
  getMemberConversationMessagesHandler,
  sendMemberChatMessageHandler,
} from './controller.js';

// Inside userRoutes():
fastify.post('/conversations',                        startConversationHandler);
fastify.get('/conversations',                         listMemberConversationsHandler);
fastify.get('/conversations/:id/messages',            getMemberConversationMessagesHandler);
fastify.post('/conversations/:id/messages',           sendMemberChatMessageHandler);
```

---

## Section 3 — Backend: Admin Conversation Endpoints

New module at `backend/src/modules/conversations/`.

### 3.1 `schema.ts`

```typescript
import { z } from 'zod';

export const sendAdminMessageSchema = z.object({
  body: z.string().min(1).max(5000),
});
```

### 3.2 `controller.ts`

```typescript
import { FastifyRequest, FastifyReply } from 'fastify';

// ── GET /api/conversations ────────────────────────────────────────────────────
export async function listAdminConversationsHandler(request: FastifyRequest, reply: FastifyReply) {
  const conversations = await request.server.prisma.conversation.findMany({
    orderBy: { lastMessageAt: 'desc' },
    include: {
      member: { select: { id: true, firstName: true, lastName: true, profilePhotoUrl: true } },
      messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { body: true, senderType: true, createdAt: true } },
    },
  });

  return reply.send({
    success: true,
    data: conversations.map((c) => ({
      id:              c.id,
      subject:         c.subject,
      status:          c.status,
      adminUnreadCount: c.adminUnreadCount,
      lastMessageAt:   c.lastMessageAt,
      member: {
        id:        c.member.id,
        name:      `${c.member.firstName ?? ''} ${c.member.lastName ?? ''}`.trim(),
        avatarUrl: c.member.profilePhotoUrl ?? null,
      },
      lastMessage: c.messages[0] ?? null,
    })),
    error: null,
  });
}

// ── GET /api/conversations/:id/messages ───────────────────────────────────────
export async function getAdminConversationMessagesHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };

  const convo = await request.server.prisma.conversation.findUnique({ where: { id } });
  if (!convo) return reply.status(404).send({ success: false, data: null, error: 'Conversation not found' });

  // Reset admin unread count when admin opens the conversation
  await request.server.prisma.conversation.update({ where: { id }, data: { adminUnreadCount: 0 } });

  const messages = await request.server.prisma.directMessage.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: 'asc' },
  });

  // Batch-resolve admin senders
  const adminIds = [...new Set(messages.filter((m) => m.senderType === 'admin').map((m) => m.senderId))];
  const admins = adminIds.length > 0
    ? await request.server.prisma.admin.findMany({
        where: { id: { in: adminIds } },
        select: { id: true, fullName: true, profilePhotoUrl: true },
      })
    : [];
  const adminMap = Object.fromEntries(admins.map((a) => [a.id, a]));

  const member = await request.server.prisma.member.findUnique({
    where: { id: convo.memberId },
    select: { firstName: true, lastName: true, profilePhotoUrl: true },
  });

  const data = messages.map((m) => {
    if (m.senderType === 'admin') {
      const a = adminMap[m.senderId];
      return { id: m.id, senderType: 'admin', senderId: m.senderId, senderName: a?.fullName ?? 'TBT Team', senderAvatarUrl: a?.profilePhotoUrl ?? null, body: m.body, createdAt: m.createdAt };
    }
    return {
      id: m.id, senderType: 'member', senderId: m.senderId,
      senderName: `${member?.firstName ?? ''} ${member?.lastName ?? ''}`.trim() || 'Member',
      senderAvatarUrl: member?.profilePhotoUrl ?? null,
      body: m.body, createdAt: m.createdAt,
    };
  });

  return reply.send({ success: true, data, meta: { conversationId: id, status: convo.status, subject: convo.subject }, error: null });
}

// ── POST /api/conversations/:id/messages ──────────────────────────────────────
export async function sendAdminChatMessageHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const { body } = request.body as { body: string };

  const admin = await request.server.prisma.admin.findFirst({
    where: { clerkId: request.user },
    select: { id: true, fullName: true, profilePhotoUrl: true },
  });
  if (!admin) return reply.status(401).send({ success: false, data: null, error: 'Admin not found' });

  const convo = await request.server.prisma.conversation.findFirst({ where: { id, status: 'open' } });
  if (!convo) return reply.status(404).send({ success: false, data: null, error: 'Conversation not found or closed' });

  const message = await request.server.prisma.$transaction(async (tx) => {
    const msg = await tx.directMessage.create({
      data: { conversationId: id, memberId: convo.memberId, senderId: admin.id, senderType: 'admin', body },
    });
    await tx.conversation.update({
      where: { id },
      data: { lastMessageAt: new Date(), memberUnreadCount: { increment: 1 } },
    });
    return msg;
  });

  const payload = {
    conversationId: id,
    message: {
      id:             message.id,
      senderType:     'admin',
      senderId:       admin.id,
      senderName:     admin.fullName,
      senderAvatarUrl: admin.profilePhotoUrl ?? null,
      body,
      createdAt:      message.createdAt,
    },
  };

  // Real-time delivery to anyone in the conversation room
  request.server.io.to(`conversation:${id}`).emit('chat:message', payload);
  // Notify member even if they haven't joined the conversation room (e.g. on another page)
  request.server.io.to(`user:${convo.memberId}`).emit('message:new', { messageId: message.id });

  return reply.status(201).send({ success: true, data: { id: message.id }, error: null });
}

// ── PATCH /api/conversations/:id/close ────────────────────────────────────────
export async function closeConversationHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };

  const convo = await request.server.prisma.conversation.update({
    where: { id },
    data: { status: 'closed' },
  });

  request.server.io.to(`conversation:${id}`).emit('chat:conversation_closed', { conversationId: id });
  request.server.io.to(`user:${convo.memberId}`).emit('chat:conversation_closed', { conversationId: id });

  return reply.send({ success: true, data: { id, status: 'closed' }, error: null });
}
```

### 3.3 `routes.ts`

```typescript
import { FastifyInstance } from 'fastify';
import {
  listAdminConversationsHandler,
  getAdminConversationMessagesHandler,
  sendAdminChatMessageHandler,
  closeConversationHandler,
} from './controller.js';
import { sendAdminMessageSchema } from './schema.js';

export async function conversationsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/',                          listAdminConversationsHandler);
  fastify.get('/:id/messages',              getAdminConversationMessagesHandler);
  fastify.post('/:id/messages', { schema: { body: sendAdminMessageSchema } }, sendAdminChatMessageHandler);
  fastify.patch('/:id/close',              closeConversationHandler);
}
```

### 3.4 Register in `server.ts`

```typescript
import { conversationsRoutes } from './modules/conversations/routes.js';

// alongside other route registrations:
await fastify.register(conversationsRoutes, { prefix: '/api/conversations' });
```

Mirror to `dist/server.js`.

---

## Section 4 — Socket.IO: Live Chat Layer

### 4.1 New Client→Server Events

| Event | Payload | Action |
|---|---|---|
| `chat:join` | `{ conversationId: string }` | Socket joins `conversation:{id}` room |
| `chat:leave` | `{ conversationId: string }` | Socket leaves `conversation:{id}` room |
| `chat:typing` | `{ conversationId: string; isTyping: boolean }` | Broadcast to others in room |

### 4.2 New Server→Client Events

| Event | Payload | Emitted to |
|---|---|---|
| `chat:message` | `{ conversationId, message: { id, senderType, senderId, senderName, senderAvatarUrl, body, createdAt } }` | `conversation:{id}` room |
| `chat:typing` | `{ conversationId, senderType, isTyping }` | `conversation:{id}` room (excluding sender) |
| `chat:conversation_new` | `{ conversationId, memberName, subject }` | `admin` room |
| `chat:conversation_closed` | `{ conversationId }` | `conversation:{id}` room + `user:{memberId}` |
| `chat:unread_ping` | `{ conversationId }` | `admin` room |

### 4.3 Socket Plugin Changes

**File:** `backend/src/plugins/socket.ts`

Add inside the `io.on('connection', ...)` handler, after the existing `join:live` block:

```typescript
socket.on('chat:join', ({ conversationId }: { conversationId: string }) => {
  socket.join(`conversation:${conversationId}`);
});

socket.on('chat:leave', ({ conversationId }: { conversationId: string }) => {
  socket.leave(`conversation:${conversationId}`);
});

socket.on('chat:typing', ({ conversationId, isTyping }: { conversationId: string; isTyping: boolean }) => {
  socket.to(`conversation:${conversationId}`).emit('chat:typing', {
    conversationId,
    senderType: socket.data.role,   // 'member' or 'admin'
    isTyping,
  });
});
```

Mirror to `dist/plugins/socket.js`.

---

## Section 5 — Frontend: tbt-user-web

### 5.1 New Service Methods

**File:** `lib/api/services/dashboard.service.ts`

```typescript
getConversations:            ()                                       => apiClient.get('/api/user/conversations'),
getConversationMessages:     (id: string)                            => apiClient.get(`/api/user/conversations/${id}/messages`),
startConversation:           (data: { subject: string; body: string }) => apiClient.post('/api/user/conversations', data),
sendChatMessage:             (id: string, body: string)              => apiClient.post(`/api/user/conversations/${id}/messages`, { body }),
```

### 5.2 New Hooks

**File:** `lib/hooks/useDashboard.ts` — add at the bottom:

```typescript
export const useConversations = () => {
  return useQuery({
    queryKey: ['user', 'conversations'],
    queryFn: () => dashboardService.getConversations(),
  });
};

export const useConversationMessages = (id: string | null) => {
  return useQuery({
    queryKey: ['user', 'conversations', id, 'messages'],
    queryFn: () => dashboardService.getConversationMessages(id!),
    enabled: !!id,
  });
};

export const useStartConversation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { subject: string; body: string }) => dashboardService.startConversation(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['user', 'conversations'] }),
  });
};

export const useSendChatMessage = () => {
  return useMutation({
    mutationFn: ({ conversationId, body }: { conversationId: string; body: string }) =>
      dashboardService.sendChatMessage(conversationId, body),
  });
};
```

### 5.3 UiStrings Type Update

**File:** `tbt-user-web/types/index.ts` — add to the `UiStrings` interface:

```typescript
chatPageTitle:    string;
chatNewLabel:     string;
chatSubjectLabel: string;
chatTypingText:   string;
chatClosedLabel:  string;
chatEmptyTitle:   string;
chatEmptyDesc:    string;
chatSelectPrompt: string;
```

### 5.4 Messages Page Redesign — Two-Pane Chat UI

**File:** `tbt-user-web/app/(platform)/messages/page.tsx` — full replacement.

**Layout wireframe:**
```
┌────────────────────────────────────────────────────────┐
│  Chat                              [+ New Conversation] │
├─────────────────────┬──────────────────────────────────┤
│  Conversation list  │  [Subject: Workshop question]     │
│  ─────────────────  │  Status: Open      [─────────]    │
│  • Workshop Q [2]   ├──────────────────────────────────┤
│    You: Hi there    │  ┌─────────────────────────────┐  │
│    2m ago           │  │  TBT Team  10:03            │  │
│                     │  │  Hello, how can we help?    │  │
│  • Payment issue    │  └─────────────────────────────┘  │
│    TBT Team: ...    │       ┌──────────────────────────┐ │
│    1h ago           │       │  You  10:04             │ │
│                     │       │  I have a question...   │ │
│                     │       └──────────────────────────┘ │
│                     │  TBT Team is typing...             │
│                     ├──────────────────────────────────┤
│                     │  [Write a message...] [Send →]    │
└─────────────────────┴──────────────────────────────────┘
```

**Skeleton (complete the UI following admin design system patterns in CLAUDE.md):**

```typescript
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageSquare, Plus, Send, Loader2, X } from 'lucide-react';
import { useSiteConfig } from '@/lib/context/SiteConfigContext';
import {
  useConversations,
  useConversationMessages,
  useStartConversation,
  useSendChatMessage,
} from '@/lib/hooks/useDashboard';
import { getSocket } from '@/lib/socket/client';
import { useQueryClient } from '@tanstack/react-query';
import { timeAgo } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import toast from 'react-hot-toast';

const TYPING_DEBOUNCE_MS = 2000;

export default function MessagesPage() {
  const { uiStrings } = useSiteConfig();
  const queryClient = useQueryClient();

  const [activeId, setActiveId]         = useState<string | null>(null);
  const [input, setInput]               = useState('');
  const [isTyping, setIsTyping]         = useState(false);   // remote is typing
  const [showNewForm, setShowNewForm]   = useState(false);
  const [newSubject, setNewSubject]     = useState('');
  const [newBody, setNewBody]           = useState('');
  const typingTimer                     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesEndRef                  = useRef<HTMLDivElement>(null);

  const { data: convoData }     = useConversations();
  const { data: msgData }       = useConversationMessages(activeId);
  const startConversation       = useStartConversation();
  const sendMessage             = useSendChatMessage();

  const conversations = (convoData as any)?.data ?? [];
  const messages      = (msgData as any)?.data ?? [];
  const activeMeta    = (msgData as any)?.meta ?? null;

  // ── Auto-scroll on new messages ───────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // ── Socket: join/leave conversation room ──────────────────────────────────
  useEffect(() => {
    if (!activeId) return;
    let socket: Awaited<ReturnType<typeof getSocket>>;

    getSocket().then((s) => {
      socket = s;
      s.emit('chat:join', { conversationId: activeId });

      s.on('chat:message', ({ conversationId, message }: any) => {
        if (conversationId !== activeId) return;
        queryClient.invalidateQueries({ queryKey: ['user', 'conversations', activeId, 'messages'] });
        queryClient.invalidateQueries({ queryKey: ['user', 'conversations'] });
      });

      s.on('chat:typing', ({ senderType, isTyping: t }: any) => {
        if (senderType === 'admin') setIsTyping(t);
      });

      s.on('chat:conversation_closed', ({ conversationId: cid }: any) => {
        if (cid === activeId) {
          queryClient.invalidateQueries({ queryKey: ['user', 'conversations'] });
          queryClient.invalidateQueries({ queryKey: ['user', 'conversations', activeId, 'messages'] });
        }
      });
    });

    return () => {
      getSocket().then((s) => {
        s.emit('chat:leave', { conversationId: activeId });
        s.off('chat:message');
        s.off('chat:typing');
        s.off('chat:conversation_closed');
      });
    };
  }, [activeId, queryClient]);

  // ── Typing indicator emit ─────────────────────────────────────────────────
  const handleInputChange = useCallback(async (value: string) => {
    setInput(value);
    if (!activeId) return;
    const s = await getSocket();
    s.emit('chat:typing', { conversationId: activeId, isTyping: true });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(async () => {
      s.emit('chat:typing', { conversationId: activeId, isTyping: false });
    }, TYPING_DEBOUNCE_MS);
  }, [activeId]);

  // ── Send message ──────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!activeId || !input.trim()) return;
    const body = input.trim();
    setInput('');
    try {
      await sendMessage.mutateAsync({ conversationId: activeId, body });
      queryClient.invalidateQueries({ queryKey: ['user', 'conversations', activeId, 'messages'] });
      queryClient.invalidateQueries({ queryKey: ['user', 'conversations'] });
    } catch {
      toast.error('Failed to send message');
    }
  };

  // ── Start conversation ────────────────────────────────────────────────────
  const handleStart = async () => {
    if (!newSubject.trim() || !newBody.trim()) return toast.error('Subject and message are required');
    try {
      const res: any = await startConversation.mutateAsync({ subject: newSubject.trim(), body: newBody.trim() });
      setNewSubject('');
      setNewBody('');
      setShowNewForm(false);
      setActiveId(res?.data?.id ?? null);
    } catch {
      toast.error('Failed to start conversation');
    }
  };

  return (
    <div className="flex h-[calc(100vh-140px)] rounded-xl border overflow-hidden"
         style={{ borderColor: 'color-mix(in srgb, var(--color-accent) 20%, transparent)' }}>

      {/* ── Left pane: conversation list ─────────────────────────────────── */}
      <div className="w-72 flex-shrink-0 border-r flex flex-col"
           style={{ borderColor: 'color-mix(in srgb, var(--color-accent) 15%, transparent)', background: 'var(--color-bg-surface)' }}>
        <div className="flex items-center justify-between px-4 py-3 border-b"
             style={{ borderColor: 'color-mix(in srgb, var(--color-accent) 15%, transparent)' }}>
          <h2 className="font-bold text-sm text-foreground">{uiStrings?.chatPageTitle}</h2>
          <button onClick={() => setShowNewForm(true)}
                  className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded"
                  style={{ color: 'var(--color-accent)' }}>
            <Plus size={12} /> {uiStrings?.chatNewLabel}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-4 text-center">
              <MessageSquare size={28} className="mx-auto mb-2 opacity-30" />
              <p className="text-xs text-muted-foreground">{uiStrings?.chatEmptyTitle}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{uiStrings?.chatEmptyDesc}</p>
            </div>
          ) : (
            conversations.map((c: any) => (
              <button key={c.id}
                      onClick={() => setActiveId(c.id)}
                      className={cn('w-full text-left px-4 py-3 border-b transition-colors',
                        activeId === c.id && 'bg-accent/10')}
                      style={{ borderColor: 'color-mix(in srgb, var(--color-accent) 10%, transparent)' }}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground truncate">{c.subject}</p>
                  {c.memberUnreadCount > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white flex-shrink-0"
                          style={{ background: 'var(--color-accent)' }}>
                      {c.memberUnreadCount}
                    </span>
                  )}
                </div>
                {c.lastMessage && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {c.lastMessage.senderType === 'member' ? 'You: ' : ''}{c.lastMessage.body}
                  </p>
                )}
                <p className="text-[10px] text-muted-foreground mt-1">{timeAgo(c.lastMessageAt)}</p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── Right pane: chat thread ───────────────────────────────────────── */}
      <div className="flex-1 flex flex-col" style={{ background: 'var(--color-bg-primary)' }}>
        {activeId && activeMeta ? (
          <>
            {/* Thread header */}
            <div className="px-5 py-3 border-b flex items-center justify-between"
                 style={{ borderColor: 'color-mix(in srgb, var(--color-accent) 15%, transparent)', background: 'var(--color-bg-surface)' }}>
              <div>
                <p className="font-semibold text-sm text-foreground">{activeMeta.subject}</p>
                <p className="text-xs text-muted-foreground capitalize">{activeMeta.status}</p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {messages.map((m: any) => {
                const isMe = m.senderType === 'member';
                return (
                  <div key={m.id} className={cn('flex gap-2.5', isMe && 'flex-row-reverse')}>
                    <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-bold text-white"
                         style={{ background: isMe ? 'var(--color-accent)' : '#444' }}>
                      {isMe ? 'Y' : (m.senderName?.[0]?.toUpperCase() ?? 'T')}
                    </div>
                    <div className={cn('max-w-[65%] rounded-2xl px-3.5 py-2', isMe ? 'rounded-tr-sm' : 'rounded-tl-sm')}
                         style={{ background: isMe ? 'color-mix(in srgb, var(--color-accent) 20%, transparent)' : 'var(--color-bg-surface)' }}>
                      <p className="text-sm text-foreground leading-relaxed">{m.body}</p>
                      <p className="text-[10px] text-muted-foreground mt-1 text-right">{timeAgo(m.createdAt)}</p>
                    </div>
                  </div>
                );
              })}
              {isTyping && (
                <p className="text-xs text-muted-foreground pl-10 italic animate-pulse">
                  TBT Team {uiStrings?.chatTypingText}
                </p>
              )}
              {activeMeta.status === 'closed' && (
                <p className="text-center text-xs text-muted-foreground py-2 italic">{uiStrings?.chatClosedLabel}</p>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            {activeMeta.status === 'open' && (
              <div className="px-4 py-3 border-t flex items-end gap-2"
                   style={{ borderColor: 'color-mix(in srgb, var(--color-accent) 15%, transparent)', background: 'var(--color-bg-surface)' }}>
                <textarea
                  value={input}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  rows={1}
                  placeholder="Write a message..."
                  className="flex-1 resize-none bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground leading-relaxed"
                />
                <button onClick={handleSend} disabled={!input.trim() || sendMessage.isPending}
                        className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center disabled:opacity-40"
                        style={{ background: 'var(--color-accent)' }}>
                  {sendMessage.isPending ? <Loader2 size={13} className="animate-spin text-white" /> : <Send size={13} className="text-white" />}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
            <MessageSquare size={36} className="mb-3 opacity-20" />
            <p className="text-sm text-muted-foreground">{uiStrings?.chatSelectPrompt}</p>
          </div>
        )}
      </div>

      {/* ── New conversation modal ────────────────────────────────────────── */}
      {showNewForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-2xl p-6 space-y-4"
               style={{ background: 'var(--color-bg-surface)' }}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-foreground">{uiStrings?.chatNewLabel}</h3>
              <button onClick={() => setShowNewForm(false)}><X size={16} /></button>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1.5">{uiStrings?.chatSubjectLabel}</label>
              <input value={newSubject} onChange={(e) => setNewSubject(e.target.value)} maxLength={200}
                     className="w-full rounded-lg px-3 h-10 text-sm outline-none border text-foreground"
                     style={{ background: 'var(--color-bg-primary)', borderColor: 'color-mix(in srgb, var(--color-accent) 30%, transparent)' }} />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Message</label>
              <textarea value={newBody} onChange={(e) => setNewBody(e.target.value)} rows={4} maxLength={5000}
                        className="w-full rounded-lg px-3 py-2.5 text-sm outline-none border text-foreground resize-none"
                        style={{ background: 'var(--color-bg-primary)', borderColor: 'color-mix(in srgb, var(--color-accent) 30%, transparent)' }} />
            </div>
            <button onClick={handleStart} disabled={startConversation.isPending}
                    className="w-full h-10 rounded-lg font-semibold text-sm text-white disabled:opacity-50 flex items-center justify-center gap-2"
                    style={{ background: 'var(--color-accent)' }}>
              {startConversation.isPending && <Loader2 size={13} className="animate-spin" />}
              Start Conversation
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## Section 6 — Frontend: Admin Panel

### 6.1 New Hooks

**File:** `admin-panel/lib/hooks/useAdmin.ts` — add at the bottom:

```typescript
export const useAdminConversations = () => {
  return useQuery({
    queryKey: ['admin', 'conversations'],
    queryFn: async () => {
      const res: any = await apiClient.get('/api/conversations');
      return res;
    },
  });
};

export const useAdminConversationMessages = (id: string | null) => {
  return useQuery({
    queryKey: ['admin', 'conversations', id, 'messages'],
    queryFn: async () => {
      const res: any = await apiClient.get(`/api/conversations/${id}/messages`);
      return res;
    },
    enabled: !!id,
  });
};

export const useSendAdminChatMessage = () => {
  return useMutation({
    mutationFn: async ({ conversationId, body }: { conversationId: string; body: string }) => {
      const res: any = await apiClient.post(`/api/conversations/${conversationId}/messages`, { body });
      return res.data || res;
    },
  });
};

export const useCloseConversation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res: any = await apiClient.patch(`/api/conversations/${id}/close`);
      return res.data || res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'conversations'] });
    },
  });
};
```

### 6.2 Messages Page Redesign — Two-Pane Chat UI

**File:** `admin-panel/app/messages/page.tsx` — full replacement.

**Layout wireframe:**
```
┌────────────────────────────────────────────────────────────┐
│  DIRECT MESSAGES                                            │
├──────────────────────────┬─────────────────────────────────┤
│  [Search conversations]  │  John Doe                       │
│  ──────────────────────  │  Subject: Workshop question     │
│  John Doe          [2]   │  Status: OPEN   [Close Chat]    │
│  Workshop question       ├─────────────────────────────────┤
│  You: Hello!   2m        │  ┌──────────────────────────┐   │
│                          │  │  John Doe   10:02        │   │
│  Jane Smith        [1]   │  │  Hi, quick question...   │   │
│  Payment issue           │  └──────────────────────────┘   │
│  Jane: ...     1h        │       ┌───────────────────────┐  │
│                          │       │  You (Admin)   10:03  │  │
│                          │       │  Sure, I can help!    │  │
│                          │       └───────────────────────┘  │
│                          │  John Doe is typing...           │
│                          ├─────────────────────────────────┤
│                          │  [Type a reply...]    [Send →]   │
└──────────────────────────┴─────────────────────────────────┘
```

**Key implementation notes for the admin page:**

1. **Socket setup** — use `getAdminSocket()` from `@/lib/socket/client`. Listen for `chat:conversation_new` globally (re-fetch conversation list + toast) and `chat:message` / `chat:typing` per active conversation — same join/leave pattern as the member page.

2. **Typing indicator label** — show `"{memberName} is typing..."` when member is typing.

3. **Sent messages** — show admin messages right-aligned (`bg-[#dc2626]/20`), member messages left-aligned (`bg-[#1f1f1f]`).

4. **Close button** — `useCloseConversation` mutation in the header. Disable input + show banner when `status === 'closed'`.

5. **Conversation list** — shows all conversations (open + closed). Filter tabs ("All" / "Open" / "Closed") are optional but recommended.

6. **Unread badge** — red dot on each row when `adminUnreadCount > 0`. Clears when that conversation is opened (backend resets on `GET /:id/messages`).

7. **Search** — filter `conversations` client-side by `member.name` or `subject` (no backend search endpoint needed).

8. Follow the admin design system constants from `CLAUDE.md` exactly: `bg-[#181818]` cards, `border-[#2a2a2a]`, `#dc2626` accent, `font-rajdhani` labels.

---

## Section 7 — Implementation Order

| Step | What | File(s) |
|---|---|---|
| 1 | Add `Conversation` model + `ConversationStatus` enum + extend `DirectMessage` + UiStrings chat fields | `backend/prisma/schema.prisma` |
| 2 | Run `prisma db push` + `npm run prepare` | — |
| 3 | Add member conversation handlers to `user/controller.ts` | `backend/src/modules/user/controller.ts` |
| 4 | Register new member routes in `user/routes.ts` | `backend/src/modules/user/routes.ts` |
| 5 | Create admin `conversations` module (`schema.ts`, `controller.ts`, `routes.ts`) | `backend/src/modules/conversations/` |
| 6 | Register `conversationsRoutes` in `server.ts` + mirror `dist/server.js` | `backend/src/server.ts` |
| 7 | Add `chat:join`, `chat:leave`, `chat:typing` socket handlers to plugin | `backend/src/plugins/socket.ts` |
| 8 | Mirror all `dist/` files for steps 3–7 | `backend/dist/` |
| 9 | Add service methods to `dashboard.service.ts` | `tbt-user-web/lib/api/services/` |
| 10 | Add new hooks (`useConversations`, etc.) to `useDashboard.ts` | `tbt-user-web/lib/hooks/` |
| 11 | Update `UiStrings` interface in `types/index.ts` | `tbt-user-web/types/index.ts` |
| 12 | Redesign `messages/page.tsx` (two-pane chat UI) | `tbt-user-web/app/(platform)/messages/` |
| 13 | Add admin hooks to `useAdmin.ts` | `admin-panel/lib/hooks/useAdmin.ts` |
| 14 | Redesign admin `messages/page.tsx` (two-pane chat UI) | `admin-panel/app/messages/page.tsx` |
| 15 | Verify end-to-end: member starts conversation → admin sees it → both chat in real time | Manual |

---

## Section 8 — Known Constraints & Notes

1. **Backward compatibility** — `conversationId` is nullable on `DirectMessage`; existing one-way messages (from `POST /api/messages/send`) remain untouched and still appear in `GET /api/user/messages`. The new chat UI is separate from the old inbox.

2. **`subject` field on `DirectMessage` becomes optional** — change to `String?` in Prisma. Existing rows keep their values. New chat messages set `subject = null` (subject lives on `Conversation`).

3. **`dist/` parity** — steps 3–7 all have corresponding `dist/` files. After every source change, manually mirror to `dist/` or run `npm run build:backend`.

4. **Prisma `$transaction`** — used in `startConversationHandler` and both `sendMessage` handlers to atomically create the message and update `lastMessageAt` / `unreadCount`. If the transaction fails, neither write goes through.

5. **Admin is not assigned to a conversation** — any admin who opens a conversation can reply. There is no `assignedAdminId` field in this spec. Add it as a separate feature if routing is needed.

6. **Typing debounce** — client emits `chat:typing { isTyping: true }` on keystroke, then `chat:typing { isTyping: false }` after 2 s of no keystrokes (`TYPING_DEBOUNCE_MS = 2000`). The server broadcasts to the rest of the room. This is fire-and-forget — no ACK needed.

7. **Unread count reset race** — `GET /:id/messages` resets the unread count on the server. If the admin opens a conversation that hasn't loaded yet, the count is reset before the messages are rendered. This is acceptable UX for v1.

8. **Socket room cleanup on disconnect** — Socket.IO automatically removes a socket from all rooms on disconnect. No explicit `chat:leave` is needed on page unmount for correctness, but emitting it anyway gives cleaner room membership for the typing indicator.

9. **`Enter` to send** — the member UI sends on `Enter` (no Shift). The admin UI should match for consistency. Shift+Enter inserts a newline.

10. **No message editing or deletion** — out of scope for this spec. Messages are immutable once sent.
