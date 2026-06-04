# Messages Feature — PRD Spec Kit

> Full end-to-end specification for admin-to-member direct messaging in the TBT platform.
> Covers DB schema, backend module, admin panel compose UI, and Socket.IO integration.
> Frontend UI and hooks already exist — only the backend is missing.

---

## Current State (Baseline)

| Item | Status |
|---|---|
| `tbt-user-web/app/(platform)/messages/page.tsx` | ✅ Complete UI — inbox, read/unread, mark-all, pagination |
| `useMessages`, `useMarkMessageRead`, `useMarkAllMessagesRead` hooks | ✅ In `lib/hooks/useDashboard.ts` |
| `dashboardService.getMessages / markMessageRead / markAllMessagesRead` | ✅ In `lib/api/services/dashboard.service.ts` |
| `Message` interface in `tbt-user-web/types/index.ts` | ✅ Defined |
| `UiStrings` message fields in `types/index.ts` | ✅ Defined (frontend ahead of DB) |
| `SenderType` enum in Prisma schema | ✅ Exists (`member`, `admin`) |
| Socket `message:new` listener in Navbar | ✅ Wired — invalidates `['user', 'messages']` |
| `DirectMessage` Prisma model | ❌ Does not exist |
| `directMessages` relation on `Member` model | ❌ Missing |
| UiStrings message fields in Prisma schema | ❌ Missing — must be added for migration |
| Backend `messages` module | ❌ Does not exist |
| `GET /api/user/messages` endpoint | ❌ Missing |
| `PATCH /api/user/messages/:id/read` endpoint | ❌ Missing |
| `POST /api/user/messages/read-all` endpoint | ❌ Missing |
| `POST /api/admin/messages` endpoint | ❌ Missing |
| Socket `message:new` emit point | ❌ No backend emit — event never fires |
| Admin panel compose/send messages UI | ❌ Missing |

---

## Section 1 — Database (Prisma Schema)

**File:** `tbt-admin/backend/prisma/schema.prisma`

### 1.1 Add `DirectMessage` Model

Insert after the `Notification` model (line ~851):

```prisma
model DirectMessage {
  id          String     @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  memberId    String     @map("member_id") @db.Uuid
  senderId    String     @map("sender_id") @db.Uuid
  senderType  SenderType @map("sender_type")
  subject     String
  body        String
  isRead      Boolean    @default(false) @map("is_read")
  readAt      DateTime?  @map("read_at") @db.Timestamptz(6)
  createdAt   DateTime   @default(now()) @map("created_at") @db.Timestamptz(6)

  member      Member     @relation(fields: [memberId], references: [id], onDelete: Cascade)

  @@map("direct_messages")
}
```

### 1.2 Add Relation to `Member` Model

In the `Member` model's relations block, add:

```prisma
directMessages DirectMessage[]
```

### 1.3 Add UiStrings Message Fields

In the `UiStrings` model, add these five fields before `createdAt`:

```prisma
messagesPageTitle    String @default("Messages")                              @map("messages_page_title")
messagesUnreadSuffix String @default("unread")                                @map("messages_unread_suffix")
messagesMarkAllLabel String @default("Mark all read")                         @map("messages_mark_all_label")
messagesEmptyTitle   String @default("No messages yet")                       @map("messages_empty_title")
messagesEmptyDesc    String @default("Messages from your team will appear here.") @map("messages_empty_desc")
```

### 1.4 Run Migration

```bash
# from tbt-admin/
npm run prisma:migrate -w backend
# migration name: add_direct_messages
npm run prepare
```

---

## Section 2 — Backend: Messages Module

**New directory:** `tbt-admin/backend/src/modules/messages/`

### 2.1 `schema.ts`

```typescript
import { z } from 'zod';

export const getMessagesSchema = {
  querystring: z.object({
    page:   z.coerce.number().int().min(1).default(1),
    limit:  z.coerce.number().int().min(1).max(100).default(20),
    unread: z.coerce.boolean().optional(),
  }),
};

export const markReadSchema = {
  params: z.object({
    id: z.string().uuid(),
  }),
};

export const sendMessageSchema = {
  body: z.object({
    memberId: z.string().uuid(),
    subject:  z.string().min(1).max(200),
    body:     z.string().min(1).max(5000),
  }),
};
```

### 2.2 `controller.ts`

```typescript
import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getMessagesSchema, markReadSchema, sendMessageSchema } from './schema.js';

type GetMessagesQuery  = z.infer<typeof getMessagesSchema.querystring>;
type MarkReadParams    = z.infer<typeof markReadSchema.params>;
type SendMessageBody   = z.infer<typeof sendMessageSchema.body>;

// ── GET /api/user/messages ─────────────────────────────────────────────────
export async function getMessagesHandler(
  request: FastifyRequest<{ Querystring: GetMessagesQuery }>,
  reply: FastifyReply
) {
  const memberId = request.memberId!; // set by Clerk member-auth middleware
  const { page, limit, unread } = request.query;
  const skip = (page - 1) * limit;

  const where = {
    memberId,
    ...(unread ? { isRead: false } : {}),
  };

  const [messages, total] = await Promise.all([
    request.server.prisma.directMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    request.server.prisma.directMessage.count({ where }),
  ]);

  // Batch-resolve admin senders (avoids N+1)
  const adminIds = [...new Set(
    messages
      .filter(m => m.senderType === 'admin')
      .map(m => m.senderId)
  )];

  const admins = adminIds.length > 0
    ? await request.server.prisma.admin.findMany({
        where: { id: { in: adminIds } },
        select: { id: true, fullName: true, profilePhotoUrl: true },
      })
    : [];

  const adminMap = Object.fromEntries(admins.map(a => [a.id, a]));

  const data = messages.map(m => {
    const sender = m.senderType === 'admin' ? adminMap[m.senderId] : null;
    return {
      id:              m.id,
      subject:         m.subject,
      body:            m.body,
      senderName:      sender?.fullName ?? 'TBT Team',
      senderAvatarUrl: sender?.profilePhotoUrl ?? null,
      isRead:          m.isRead,
      createdAt:       m.createdAt,
    };
  });

  return reply.send({
    success: true,
    data,
    meta: { total, page, limit },
  });
}

// ── PATCH /api/user/messages/:id/read ─────────────────────────────────────
export async function markMessageReadHandler(
  request: FastifyRequest<{ Params: MarkReadParams }>,
  reply: FastifyReply
) {
  const memberId = request.memberId!;
  const { id } = request.params;

  await request.server.prisma.directMessage.updateMany({
    where: { id, memberId },
    data:  { isRead: true, readAt: new Date() },
  });

  return reply.send({ success: true });
}

// ── POST /api/user/messages/read-all ──────────────────────────────────────
export async function markAllMessagesReadHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const memberId = request.memberId!;

  const { count } = await request.server.prisma.directMessage.updateMany({
    where: { memberId, isRead: false },
    data:  { isRead: true, readAt: new Date() },
  });

  return reply.send({ success: true, data: { updated: count } });
}

// ── POST /api/admin/messages ───────────────────────────────────────────────
export async function sendMessageHandler(
  request: FastifyRequest<{ Body: SendMessageBody }>,
  reply: FastifyReply
) {
  const adminId = request.adminId!; // set by Clerk admin-auth middleware
  const { memberId, subject, body } = request.body;

  // Verify member exists
  const member = await request.server.prisma.member.findUnique({
    where: { id: memberId },
    select: { id: true },
  });
  if (!member) {
    return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Member not found' } });
  }

  const message = await request.server.prisma.directMessage.create({
    data: {
      memberId,
      senderId:   adminId,
      senderType: 'admin',
      subject,
      body,
    },
  });

  // Emit real-time event to member
  request.server.io.to(`user:${memberId}`).emit('message:new', {
    messageId: message.id,
  });

  return reply.status(201).send({ success: true, data: { id: message.id } });
}
```

> **Note on `request.memberId` / `request.adminId`:** These must be decorated on the Fastify request object by the Clerk auth middleware. Check `backend/src/plugins/clerk.ts` for the exact pattern and follow it. If the existing middleware uses a different property name (e.g., `request.auth.memberId`), align to that.

### 2.3 `routes.ts`

```typescript
import { FastifyInstance } from 'fastify';
import {
  getMessagesHandler,
  markMessageReadHandler,
  markAllMessagesReadHandler,
  sendMessageHandler,
} from './controller.js';
import { getMessagesSchema, markReadSchema, sendMessageSchema } from './schema.js';

export async function messagesRoutes(fastify: FastifyInstance) {
  // ── Member routes (Clerk member auth) ──────────────────────────────────
  fastify.register(async (memberApp) => {
    memberApp.addHook('preHandler', fastify.authenticateMember); // adjust to actual hook name

    memberApp.get(
      '/api/user/messages',
      { schema: { querystring: getMessagesSchema.querystring } },
      getMessagesHandler
    );

    memberApp.patch(
      '/api/user/messages/:id/read',
      { schema: { params: markReadSchema.params } },
      markMessageReadHandler
    );

    memberApp.post(
      '/api/user/messages/read-all',
      {},
      markAllMessagesReadHandler
    );
  });

  // ── Admin routes (Clerk admin auth) ────────────────────────────────────
  fastify.register(async (adminApp) => {
    adminApp.addHook('preHandler', fastify.authenticate); // existing admin auth hook

    adminApp.post(
      '/api/admin/messages',
      { schema: { body: sendMessageSchema.body } },
      sendMessageHandler
    );
  });
}
```

> **Auth hook names:** Look at existing route files (e.g., `modules/notifications/routes.ts`) to confirm the exact `preHandler` hook name used for member vs. admin authentication. The admin hook is `fastify.authenticate` per `CLAUDE.md`. For member auth, check `modules/user/routes.ts`.

### 2.4 Register in `server.ts`

**File:** `tbt-admin/backend/src/server.ts`

Add alongside existing module registrations:

```typescript
import { messagesRoutes } from './modules/messages/routes.js';

// Inside the server setup, with the other route registrations:
await fastify.register(messagesRoutes);
```

Also update `dist/server.js` to match.

---

## Section 3 — Backend: Socket Emit Point

The emit is already spec'd in `controller.ts` Section 2.2 above. After `directMessage.create` succeeds in `sendMessageHandler`:

```typescript
request.server.io.to(`user:${memberId}`).emit('message:new', {
  messageId: message.id,
});
```

**Effect:** The Navbar's existing socket listener (`socket.on('message:new', ...)`) receives the event and calls `queryClient.invalidateQueries({ queryKey: ['user', 'messages'] })`, updating the unread badge instantly.

---

## Section 4 — Frontend: tbt-user-web

### 4.1 No Changes Required

Everything is already in place:
- `Message` interface — ✅ defined in `types/index.ts`
- `UiStrings` message fields — ✅ defined in `types/index.ts`
- `messages/page.tsx` — ✅ complete UI
- `useMessages`, `useMarkMessageRead`, `useMarkAllMessagesRead` — ✅ in `useDashboard.ts`
- `dashboardService.*` methods — ✅ pointing to correct endpoints
- Socket `message:new` listener in Navbar — ✅ wired

The frontend unblocks as soon as the backend is live.

---

## Section 5 — Frontend: Admin Panel

### 5.1 New Hook — `useSendDirectMessage`

**File:** `tbt-admin/admin-panel/lib/hooks/useAdmin.ts`

Add at the bottom:

```typescript
export const useSendDirectMessage = () => {
  return useMutation({
    mutationFn: (payload: { memberId: string; subject: string; body: string }) =>
      apiClient.post('/api/admin/messages', payload),
  });
};
```

### 5.2 New Page — Admin Messages Compose

**New file:** `tbt-admin/admin-panel/app/messages/page.tsx`

This page lets admins compose and send direct messages to individual members.

**Features:**
- Compose form: member search (existing `useListMembers` pattern), subject, body
- Sent history table: list of recent outbound messages with member name, subject, sent-at
- No reply/inbox needed — admin-to-member only

**Skeleton structure:**

```typescript
'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Send, MessageSquare, Search, X, Loader2 } from 'lucide-react';
import { useSendDirectMessage } from '@/lib/hooks/useAdmin';
import { useListMembers } from '@/lib/hooks/useMembers';
import toast from 'react-hot-toast';

const EMPTY_FORM = { subject: '', body: '' };

export default function AdminMessagesPage() {
  const [form, setForm]               = useState(EMPTY_FORM);
  const [selectedMember, setMember]   = useState<{ id: string; name: string } | null>(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [dropOpen, setDropOpen]       = useState(false);

  const sendMessage = useSendDirectMessage();
  const { data: memberData } = useListMembers({ search: memberSearch, limit: 8 });
  const memberResults = (memberData as any)?.data ?? [];

  const handleSend = async () => {
    if (!selectedMember) return toast.error('Select a member');
    if (!form.subject)   return toast.error('Subject is required');
    if (!form.body)      return toast.error('Message body is required');

    try {
      await sendMessage.mutateAsync({
        memberId: selectedMember.id,
        subject:  form.subject,
        body:     form.body,
      });
      toast.success(`Message sent to ${selectedMember.name}`);
      setForm(EMPTY_FORM);
      setMember(null);
      setMemberSearch('');
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to send');
    }
  };

  return (
    <DashboardLayout>
      {/* Page header + compose form — follow admin design system constants from CLAUDE.md */}
    </DashboardLayout>
  );
}
```

> Build the full page following the admin design system constants in `CLAUDE.md` (bg-[#181818] cards, border-[#2a2a2a], red CTAs, font-rajdhani labels). Model the member search dropdown on the existing pattern in `app/app-notifications/page.tsx` — the `specific` recipient flow there is identical.

### 5.3 Add to Sidebar Navigation

**File:** `tbt-admin/admin-panel/components/layout/Sidebar.tsx`

Add a "Messages" nav item alongside Notifications:

```typescript
{ label: 'Messages', href: '/messages', icon: MessageSquare },
```

---

## Section 6 — Implementation Order

| Step | What | File(s) |
|---|---|---|
| 1 | Add `DirectMessage` model + `Member` relation + UiStrings fields to Prisma schema | `backend/prisma/schema.prisma` |
| 2 | Run migration + regenerate client | `npm run prisma:migrate -w backend && npm run prepare` |
| 3 | Create `backend/src/modules/messages/schema.ts` | New file |
| 4 | Create `backend/src/modules/messages/controller.ts` | New file — includes socket emit |
| 5 | Create `backend/src/modules/messages/routes.ts` | New file |
| 6 | Register `messagesRoutes` in `server.ts` | `backend/src/server.ts` + `dist/server.js` |
| 7 | Add `useSendDirectMessage` hook | `admin-panel/lib/hooks/useAdmin.ts` |
| 8 | Create admin compose page | `admin-panel/app/messages/page.tsx` |
| 9 | Add Messages to admin Sidebar | `admin-panel/components/layout/Sidebar.tsx` |
| 10 | Verify frontend — open `/messages` as a member, check inbox loads | `tbt-user-web` |

---

## Section 7 — Known Constraints & Notes

1. **Auth middleware property name** — Before writing the controller, confirm the exact property Clerk middleware attaches to `request` for the member's DB `id`. Check `backend/src/modules/user/controller.ts` for the pattern already used in member-facing endpoints (e.g., `request.memberId` or `request.auth?.memberId`).

2. **Admin-to-member only** — This spec covers one-way messaging (admin → member). Members cannot reply. If two-way chat is needed in future, a `parentId` field and reply handler should be added as a separate spec.

3. **UiStrings migration** — The five `messages_*` columns need a Prisma migration. Their `@default(...)` values ensure existing rows get sensible values without a backfill script.

4. **`dist/` parity** — After changes to `server.ts`, also update `dist/server.js` manually (or rebuild with `npm run build:backend`) to keep production in sync.

5. **Member auth hook** — User-facing routes (GET/PATCH/POST `read-all`) require member-level Clerk auth. Admin-facing routes (POST send) require admin-level Clerk auth. Verify the correct `preHandler` hooks from existing user module routes before writing `routes.ts`.

6. **`senderId` is Admin.id** — The `senderId` column stores the UUID from the `admins` table when `senderType = 'admin'`. It is NOT a foreign key constraint in the schema (to keep it flexible for future member-to-member messages). Join is done manually in `getMessagesHandler` via `adminMap`.

7. **Unread badge in Navbar** — The Navbar already shows an unread messages count. It reads from `useMessages({ unread: true, limit: 1 })` to get `meta.total`. This starts working as soon as the backend endpoint is live — no frontend change needed.
