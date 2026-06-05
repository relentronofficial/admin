# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**TBT Admin Platform** — monorepo for the Tamil Business Tribe LMS. The workspace root is `tbt-admin/`. The TBT Admin PRD (`F:\admin\TBT_Admin_PRD.md`) defines an 18-section implementation roadmap that is being built incrementally. Sessions 1–8 are complete; sessions 9–18 are pending.

```
tbt-admin/
  admin-panel/   # Next.js 14 App Router frontend (port 3000)
  backend/       # Fastify API server (port 8000)
  package.json   # npm workspaces root
```

## Commands

All commands run from `tbt-admin/` (the npm workspaces root):

```bash
# Development
npm run dev              # Both servers concurrently
npm run dev:admin        # Next.js only (port 3000)
npm run dev:backend      # Fastify only (port 8000)

# Build
npm run build:admin
npm run build:backend

# Checks
npm run typecheck        # Both workspaces
npm run lint             # Both workspaces
npm run format           # Prettier (whole repo)

# Database
npm run prepare                      # Generate Prisma client (required after schema changes)
npm run prisma:migrate -w backend    # Run migrations
npm run prisma:studio -w backend     # GUI for DB
npx prisma db seed                   # Seed super admin (run from backend/)
```

## Architecture

### Authentication Flow
Clerk is the auth provider for both frontend and backend.

- **Backend:** `clerkPlugin` (`backend/src/plugins/clerk.ts`) decorates Fastify with `fastify.authenticate`, used as `preHandler` on all protected route groups.
- **Frontend:** `ClerkProvider` wraps the root layout. `AuthInterceptor` inside `components/Providers.tsx` registers an Axios request interceptor (via `useAuth().getToken()`) that attaches `Authorization: Bearer <token>` to every `apiClient` call. The interceptor is mounted once when Clerk loads and ejected on unmount.

### Backend Structure
- **Entry:** `backend/src/server.ts` — registers plugins then route modules
- **Plugins:** `backend/src/plugins/` — `prisma`, `redis`, `clerk`, `socket`, `supabase`, `sentry`; each decorates the Fastify instance
- **Modules:** `backend/src/modules/<name>/routes.ts` + `controller.ts` pattern
- **Config:** `backend/src/config/env.ts` — Zod-validated env schema
- **Route prefix:** `/api/<module>` (e.g. `/api/courses`, `/api/workshops`)
- Backend uses ESM (`"type": "module"`), TypeScript compiled with `tsx` in dev

### Frontend Structure
- **API client:** `admin-panel/lib/api/apiClient.ts` — Axios pointing to `NEXT_PUBLIC_API_URL` (default `http://localhost:8000`). Response interceptor unwraps `response.data`.
- **TBT hooks:** `admin-panel/lib/hooks/useTbt.ts` — all TanStack Query hooks for workshops, hero, content sections, courses, config, nav, tiers, badges, notifications, products, resources, batches
- **Admin hooks:** `admin-panel/lib/hooks/useAdmin.ts` — admins, members, file uploads (`useGetPresignedUrl`)
- **Layout:** `DashboardLayout` wraps authenticated pages with `Sidebar` + `Topbar`; fixed sidebar 220px

### File Upload Pattern
```typescript
// 1. Get presigned URL
const { uploadUrl, publicUrl } = await getPresignedUrl.mutateAsync({
  filename: file.name,
  contentType: file.type,
  bucket: "bucket-name",      // e.g. "site-assets", "workshops", "courses"
  pathPrefix: "subfolder",    // e.g. "thumbnails", "videos"
});
// 2. PUT to R2
await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
// 3. Store publicUrl in form state
```
`useGetPresignedUrl` is from `@/lib/hooks/useAdmin`.

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
// "Save Order" button visible only when isDirty=true
// On click: call reorderMutation.mutateAsync(localItems.map(i => i.id))
```

### Slug Auto-Generation
```typescript
const toSlug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
// Applied on title change in create mode only; manual override supported via slugManual flag
```

### Duration Auto-Detection (video files)
```typescript
const detectDuration = (file: File): Promise<number> =>
  new Promise(resolve => {
    const video = document.createElement("video");
    video.preload = "metadata";
    const url = URL.createObjectURL(file);
    video.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(Math.round(video.duration)); };
    video.onerror = () => { URL.revokeObjectURL(url); resolve(0); };
    video.src = url;
  });
```

### Design System Constants
```
Background:  bg-[#0f0f0f] (page), bg-[#181818] (card), bg-[#1a1a1a] (input/header), bg-[#141414] (modal)
Border:      border-[#2a2a2a] (card), border-[#333] (input)
Text:        text-[#f0f0f0] (primary), text-[#a0a0a0] (secondary), text-[#606060] (muted), text-[#444] (subtle)
Accent:      #dc2626 (red — primary action), hover:bg-red-700
Font:        font-rajdhani (headings/labels, uppercase tracking-widest), system sans (body)
Label style: text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani
Input:       bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626]
```

### API Response Shape
```json
{ "success": true, "data": ..., "meta": { "total": 0, "page": 1, "limit": 20 }, "error": null }
```
Pages access: `data?.data || []` and `data?.meta?.total`

## Key Services
| Service | Purpose |
|---|---|
| Supabase (PostgreSQL) | Primary DB via Prisma ORM |
| Cloudflare R2 | File/image/video storage |
| Upstash Redis | BullMQ job queues |
| Bunny Stream | Video hosting |
| Agora.io | Live webinars |
| Clerk | Auth (admin panel + API) |
| Firebase | Push notifications |
| Resend / Twilio | Email / SMS |
| Sentry | Error tracking |

## Environment Setup

- `backend/.env.example` → `backend/.env`
- `admin-panel/.env.example` → `admin-panel/.env.local`

Required: `DATABASE_URL`, `DIRECT_URL`, Supabase keys, Clerk keys (frontend + backend), `CLOUDFLARE_R2_*` keys.

## Deployment
- **Backend → Railway** — auto-deploy on push to `main`
- **Frontend → Vercel** — auto-deploy on push to `main`

## PRD Reference
Full PRD: `F:\admin\TBT_Admin_PRD.md`
Status tracker: `F:\admin\tbt-admin\PROJECT_STATUS.md`
Pending tasks: `F:\admin\tbt-admin\PENDING_TASKS.md`
Architecture detail: `F:\admin\tbt-admin\ARCHITECTURE.md`
