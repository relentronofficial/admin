# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**TBT Admin Platform** — monorepo for the Tamil Business Tribe LMS. The workspace root is `tbt-admin/`. All 18 PRD sections are complete.

```
tbt-admin/
  admin-panel/   # Next.js 14 App Router frontend (port 3000)
  backend/       # Fastify API server (port 8000)
  package.json   # npm workspaces root
```

**NEVER use the word "EiFlix"** in user-facing code or string literals. Use "TBT".

## Commands

All commands run from `tbt-admin/` (the npm workspaces root):

```bash
# Development
npm run dev              # Both servers concurrently
npm run dev:admin        # Next.js only (port 3000)
npm run dev:backend      # Fastify only (port 8000)

# Checks
npm run typecheck        # Both workspaces
npm run lint
npm run format           # Prettier (whole repo)
npm test                 # Vitest — scoped to src/modules/ads/**/*.test.ts only (pure unit, no DB/network)

# TypeScript check (targeted)
npx tsc --noEmit -p admin-panel/tsconfig.json 2>&1 | Select-String <filename>

# Database
npm run prisma:generate -w backend   # Regenerate Prisma client after schema changes
npm run prisma:migrate -w backend
npm run prisma:studio -w backend
npx prisma db seed                   # Seed super admin (run from backend/)
npm run seed:gamified                # Seed XP/gamification data
```

## Architecture

### Two Auth Systems (Critical)

The backend supports two completely different auth middlewares coexisting:

- **`fastify.authenticate`** (Clerk) — `clerkPlugin` (`backend/src/plugins/clerk.ts`). Used as `preHandler` on all admin routes. Reads `Authorization: Bearer <clerk-jwt>` header set by the admin panel's Axios interceptor.
- **`fastify.authenticateUser`** (JWT cookie) — `jwtPlugin` (`backend/src/plugins/jwt.ts`). Used as `preHandler` on user-web-facing routes. Reads `tbt_access` HttpOnly cookie, verifies JWT locally, sets `request.memberId: string`. There is NO `request.member` object — never write `(req as any).member.id`.

Admin panel auth flow: `ClerkProvider` wraps root layout → `AuthInterceptor` in `components/Providers.tsx` attaches `Authorization: Bearer <token>` to every `apiClient` call. Token is cached and refreshed 8 s before its `exp` claim.

### Backend Structure
- **Entry:** `backend/src/server.ts` — registers plugins then route modules
- **Plugins:** `backend/src/plugins/` — `prisma`, `redis`, `clerk`, `jwt`, `socket`, `supabase`, `sentry`
- **Modules:** `backend/src/modules/<name>/routes.ts` + `controller.ts` pattern
- **Config:** `backend/src/config/env.ts` — Zod-validated env schema; app exits on missing required vars
- **Route prefix convention:** `/api/<module>`. Two exceptions: `hero` module → `/api/hero-slides`; `security` module → `/api/security-logs`
- **`user` module** (`backend/src/modules/user/`) — monolithic handler for ALL user-facing authenticated routes at `/api/user/*` (courses, events, workshops, notifications, dashboard, etc.). Not just profile.
- Backend uses ESM (`"type": "module"`), TypeScript compiled with `tsx` in dev

### Frontend Structure
- **API client:** `admin-panel/lib/api/apiClient.ts` — Axios pointing to `NEXT_PUBLIC_API_URL`. Response interceptor unwraps `response.data`, so hooks receive `{ success, data, meta, error }` directly. Access lists as `data?.data || []`, total as `data?.meta?.total`.
- **TBT hooks:** `admin-panel/lib/hooks/useTbt.ts` — all TanStack Query hooks (202+ exports). Add new hooks to the bottom. Includes analytics hooks, live-call hooks, community/batch/tier/badge/notification/product/resource hooks, and 21 course-platform hooks. Batch admin hooks: `useGetBatch`, `useListBatches`, `useListBatchDays`, `useUpsertBatchDay`, `useGetBatchProgress`, `useGetMemberProgress`, `useUpsertMemberProgress`, `useApproveBatchDay`, `useRejectBatchDay`, `useBulkApproveBatchDays`, `useGetBatchPending`, `useGetBatchBreaks`, `useApproveBreak`, `useRejectBreak`, `useGetBatchMemberAttendance`, `useUpsertBatchAttendance`, `useUpsertMemberBatchSettings`, `useBatchDayAnalytics`, `useGetAllBatchTasks`. Batch objects include `xpPerDay` (int, default 50) — raw SQL column, not Prisma schema.
- **Admin hooks:** `admin-panel/lib/hooks/useAdmin.ts` — admins, `useGetPresignedUrl` (R2 presigned uploads), `useUploadImage` (direct buffer ≤100 MB), `useCreateBunnyVideo`, `useDeleteBunnyVideo`
- **Members hooks:** `admin-panel/lib/hooks/useMembers.ts` — `useGetMember`, `useListMembers` (accepts `{ status }` filter), `useCreateMember`, `useApproveMember` (`POST /api/members/:id/approve`)
- **Tasks hooks:** `admin-panel/lib/hooks/useTasks.ts` — `useCreateTaskInitiative`, `useListTasks`, `useUpdateTask`, `useDeleteTask`, `useListBatchTasks`, `useCreateBatchTask`, `useUpdateBatchTask`, `useDeleteBatchTask`, `useReorderBatchTasks`, `useGetBatchSubmissions`, `useReviewTaskSubmission`, `useGetAllBatchTasks`
- **Layout:** `DashboardLayout` wraps authenticated pages with `Sidebar` + `Topbar`; fixed sidebar 220px

### Notification Routing (`admin-panel/lib/utils/notificationRouter.ts`)
`resolveNotificationRoute(notification)` maps `type` + `metadata` to the correct admin route. Used by `NotifPanel` in `Topbar` on click: mark read → close dropdown → `router.push(route)`:
- `member_pending` / `member_joined` → `/members/${memberId}`
- `workshop_access_request` → `/workshops/${workshopId}`
- `course_access_request` → `/courses?open=${courseId}` — courses page auto-opens detail panel
- `product_inquiry` → `/products?tab=inquiries` — products page auto-switches tab
- `day_submitted` → `/batches/${batchId}`
- `announcement` → `/app-notifications`

### File Upload Pattern (R2 presigned URL)
```typescript
const { uploadUrl, publicUrl } = await getPresignedUrl.mutateAsync({
  filename: file.name, contentType: file.type,
  bucket: "bucket-name", pathPrefix: "subfolder",
});
await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
// store publicUrl in form state
```
`useGetPresignedUrl` is from `@/lib/hooks/useAdmin` — never from `useTbt`. Uploaded images are auto-converted to WebP (quality 85) by the backend via `sharp`.

### DnD Reorder Pattern (HTML5 native, used everywhere)
```typescript
const dragIdx = useRef<number | null>(null);
const [dragOver, setDragOver] = useState<number | null>(null);
const [localItems, setLocalItems] = useState<any[]>([]);
const [isDirty, setIsDirty] = useState(false);

useEffect(() => { setLocalItems(serverItems); setIsDirty(false); }, [serverData]);

const onDrop = (e, dropIdx) => {
  e.preventDefault();
  const from = dragIdx.current;
  if (from === null || from === dropIdx) { setDragOver(null); return; }
  const next = [...localItems];
  const [moved] = next.splice(from, 1);
  next.splice(dropIdx, 0, moved);
  setLocalItems(next);
  setIsDirty(true);
  dragIdx.current = null;
  setDragOver(null);
};
// "Save Order" visible only when isDirty=true
// Reorder endpoints always use: PUT <prefix>/reorder { ids: string[] }
```

### Design System Constants
```
Background:  bg-[#0f0f0f] (page), bg-[#181818] (card), bg-[#1a1a1a] (input/header), bg-[#141414] (modal)
Border:      border-[#2a2a2a] (card), border-[#333] (input)
Text:        text-[#f0f0f0] (primary), text-[#a0a0a0] (secondary), text-[#606060] (muted)
Accent:      #dc2626 (red — primary CTA), hover:bg-red-700
Font:        font-rajdhani (headings/labels, uppercase tracking-widest), system sans (body)
Label style: text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani
Input:       bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626]
```

### Batch Access Control
Workshops and resources support per-batch access via `batchIds Json?` (null = all; array of IDs = restricted). List endpoints return all items with a `locked: boolean`. Access endpoints return 403 if the member's `batchId` is not in the array.

### Raw SQL Tables (no Prisma model)
These tables are created via `$executeRawUnsafe` in `prisma.ts` startup only — never use Prisma model accessors for them:
`member_attendance`, `batch_break_requests`, `member_batch_settings`, `product_inquiries`, `admin_notifications`

### Raw SQL Columns (not in Prisma schema)
`batches.xp_per_day` (INT, default 50), `batches.status` (VARCHAR), `batches.snapshot_days` (INT, nullable). **Always destructure these out of the request body before spreading into `prisma.batch.create/update`**, then persist via `$executeRawUnsafe`.

### Adding DB Columns Without Migrations
```typescript
// In backend/src/plugins/prisma.ts startup block — idempotent:
await prisma.$executeRawUnsafe('ALTER TABLE foo ADD COLUMN IF NOT EXISTS bar JSONB');
```

### Common Pitfalls
1. **`req.memberId` not `req.member`** — `fastify.authenticateUser` sets `request.memberId: string`; there is NO `request.member` object
2. **`hero` prefix is `/api/hero-slides`** — not `/api/hero`; `security` prefix is `/api/security-logs`
3. **`task_steps` table does not exist** — never include `step: true` or `steps: true` in Prisma task `include` blocks
4. **Slug** — auto-generates from title in create mode only; never auto-overwrite in edit mode
5. **Save Order button** — visible only when `isDirty=true`; never always-visible
6. **`useGetPresignedUrl`** — from `useAdmin`, not `useTbt`
7. **Cron endpoints** (`/api/workshops/cron/generate-recurring`, `/api/cron/course-expiry-reminder`) bypass Clerk/JWT and require `x-cron-secret` header instead
8. **`tsx watch` hot-reload** — after editing backend files, kill and restart the backend dev server if API behaviour doesn't change
9. **`CourseAccess` ≠ `CourseEnrollment`** — access grants permission; enrollment tracks progress; always check `CourseAccess` before allowing lesson playback
10. **`invalidateCache`** — call after mutations that affect `useMe()`: `void invalidateCache(request.server.redis ?? null, \`me:${memberId}\`)`

### Socket Events (Admin Room)
Admin panel uses `getAdminSocket()` from `admin-panel/lib/socket/client.ts`.

| Room | Events |
|---|---|
| `'admin'` | `admin:member_joined`, `admin:member_pending`, `admin:member_approved`, `admin:product_inquiry`, `admin:workshop_access_request`, `admin:course_access_request`, `chat:conversation_new`, `chat:unread_ping`, `admin:day_submitted` |
| `user:{memberId}` | `notification`, `message:new`, `batch:day_approved`, `course:access_granted` |

## Key Services
| Service | Purpose |
|---|---|
| Supabase (PostgreSQL) | Primary DB via Prisma ORM |
| Cloudflare R2 | File/image/video storage (presigned URL uploads) |
| Upstash Redis | BullMQ job queues + cache |
| Bunny Stream | Video hosting (HLS + iframe embed) |
| LiveKit | Workshop live calls |
| Clerk | Admin panel auth only |
| Firebase | Push notifications |
| Resend / Twilio / MSG91 | Email / SMS / OTP |
| Sentry | Error tracking |

## Environment Setup
- `backend/.env.example` → `backend/.env`
- `admin-panel/.env.example` → `admin-panel/.env.local`

Required: `DATABASE_URL`, `DIRECT_URL`, Supabase keys, Clerk keys (frontend + backend), `CLOUDFLARE_R2_*`, `JWT_ACCESS_SECRET`.

## Deployment
| Branch | Service | Notes |
|---|---|---|
| `main` | `tbt-backend-staging` | Staging backend; admin frontend → Vercel (auto-deploy) |
| `production` | `tbt-backend` | Production backend (`--min-instances=1`) |

To promote staging → production: `git push origin main:production`
