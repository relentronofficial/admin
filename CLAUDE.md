# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TBT Admin Platform — a monorepo for the Tamil Business Tribe LMS admin panel and API. The repo root (`F:\admin`) contains a `tbt-admin/` subdirectory which is the actual workspace root.

```
tbt-admin/
  admin-panel/   # Next.js 14 (App Router) frontend (port 3000)
  backend/       # Fastify API server (port 8000)
  package.json   # npm workspaces root (run all commands from here)
```

## Commands

All commands run from `tbt-admin/`:

```bash
# Development
npm run dev              # Both servers concurrently
npm run dev:admin        # Next.js only
npm run dev:backend      # Fastify only

# Build
npm run build:admin
npm run build:backend

# Checks
npm run typecheck        # Both workspaces
npm run lint
npm run format

# TypeScript check (targeted — use before/after any edit)
cd tbt-admin && npx tsc --noEmit -p admin-panel/tsconfig.json 2>&1 | grep <filename>

# Database
npm run prepare                      # Regenerate Prisma client after schema changes
npm run prisma:migrate -w backend
npm run prisma:studio -w backend
npx prisma db seed                   # Run from backend/ — creates super admin
```

## Architecture

### Authentication Flow
Clerk is the auth provider for both frontend and backend.

- **Backend:** `clerkPlugin` (`backend/src/plugins/clerk.ts`) decorates Fastify with `fastify.authenticate`, used as `preHandler` on all protected route groups.
- **Frontend:** `ClerkProvider` wraps the root layout. `AuthInterceptor` inside `components/Providers.tsx` registers an Axios request interceptor (via `useAuth().getToken()`) that attaches `Authorization: Bearer <token>` to every `apiClient` call. The interceptor is mounted once when Clerk loads and ejected on unmount — **not** per-hook.

### Backend Structure
- **Entry:** `backend/src/server.ts` — registers plugins then route modules
- **Plugins:** `backend/src/plugins/` — `prisma`, `redis`, `clerk`, `socket`, `supabase`, `sentry`; each decorates the Fastify instance. Optional plugins (redis, supabase, etc.) skip gracefully if their env vars are missing.
- **Modules:** `backend/src/modules/<name>/routes.ts` + `controller.ts` + `schema.ts` pattern
- **Config:** `backend/src/config/env.ts` — Zod-validated env schema; app exits on missing required vars
- **Route prefix convention:** `/api/<module>` (e.g. `/api/courses`, `/api/members`)
- Backend uses ESM (`"type": "module"`), TypeScript compiled with `tsx` in dev and `tsc` for prod

### Frontend Structure
- **API client:** `admin-panel/lib/api/apiClient.ts` — Axios instance pointing to `NEXT_PUBLIC_API_URL` (default `http://localhost:8000`). The response interceptor unwraps `response.data`, so hooks receive the server payload directly (`{ success, data, meta, error }`). Access lists as `data?.data || []` and total as `data?.meta?.total`.
- **EiFlix hooks:** `admin-panel/lib/hooks/useTbt.ts` — all TanStack Query hooks (~600+ lines). Add new EiFlix hooks to the bottom of this file.
- **Admin hooks:** `admin-panel/lib/hooks/useAdmin.ts` — admins, members, `useGetPresignedUrl` (R2 uploads)
- **State:** TanStack Query for server state; Zustand for client state
- **Layout:** `DashboardLayout` wraps authenticated pages with `Sidebar` + `Topbar`; fixed sidebar 220px
- **Validation:** Zod in `lib/validators/`; React Hook Form + `@hookform/resolvers/zod`
- **Notifications:** `react-hot-toast`, configured in `Providers.tsx`

### File Upload Pattern (R2 via presigned URL — used everywhere)
```typescript
const { uploadUrl, publicUrl } = await getPresignedUrl.mutateAsync({
  filename: file.name,
  contentType: file.type,
  bucket: "bucket-name",     // e.g. "site-assets", "workshops", "resources"
  pathPrefix: "subfolder",   // e.g. "thumbnails", "files"
});
await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
// store publicUrl in form state
```
`useGetPresignedUrl` is from `@/lib/hooks/useAdmin` — never from `useTbt`.

### DnD Reorder Pattern (HTML5 native — used everywhere)
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
// On click: reorderMutation.mutateAsync(localItems.map(i => i.id))
```
Reorder endpoints always use `PUT <prefix>/reorder { ids: string[] }`. Confirm the endpoint exists in the backend before adding the hook.

### Slug Auto-Generation
```typescript
const toSlug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
// Create mode only — track with slugManual boolean. Never auto-overwrite in edit mode.
```

### Duration Auto-Detection (video files, client-side only)
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
Text:        text-[#f0f0f0] (primary), text-[#a0a0a0] (secondary), text-[#606060] (muted)
Accent:      #dc2626 (red — primary CTA), hover:bg-red-700
Font:        font-rajdhani (headings/labels, uppercase tracking-widest), system sans (body)
Label style: text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani
Input:       bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626]
```

## Common Pitfalls

1. **Delivery modes** — `["online", "offline", "hybrid"]` only; never add `"recorded"`
2. **Content types** — `["series", "standalone", "podcast"]`; not video/doc/image/link
3. **Hero CTA types** — `["internal", "external"]`; not primary/secondary/ghost
4. **Slug** — auto-generates from title in **create mode only**, never in edit mode
5. **Save Order** — visible only when `isDirty=true`, never always-visible
6. **File upload** — always R2 presigned URL → PUT; never POST file to backend
7. **`useGetPresignedUrl`** — from `useAdmin`, not `useTbt`
8. **apiClient interceptor** unwraps `response.data` — hooks already receive `{ success, data, meta }`, not doubly-nested
9. **Flow item type values** — `"custom"` (Pre-Req), `"challenge_start"`, `"live_call"` (DB strings differ from PRD labels)
10. **Workshop detail page is monolithic by design** — all 7 tabs in one `workshops/[id]/page.tsx` (~960 lines)

## Key Services
| Service | Purpose |
|---|---|
| Supabase (PostgreSQL) | Primary DB via Prisma ORM |
| Upstash Redis | BullMQ job queues |
| Cloudflare R2 | File/image/video storage (presigned URL uploads) |
| Bunny Stream | Video hosting |
| Agora.io | Live webinars |
| Clerk | Auth (admin panel + API) |
| Firebase | Push notifications |
| Resend / Twilio | Email / SMS |
| Sentry | Error tracking |
| Better Stack | Log aggregation |

## Environment Setup

Copy and fill both env files before starting:
- `backend/.env.example` → `backend/.env` (required: `DATABASE_URL`, `DIRECT_URL`, Supabase keys, Clerk keys, `CLOUDFLARE_R2_*`)
- `admin-panel/.env.example` → `admin-panel/.env.local`

Optional vars (plugins skip gracefully if absent): `UPSTASH_REDIS_*`, `BUNNY_STREAM_*`, `AGORA_*`, `FIREBASE_*`, `RESEND_API_KEY`, `TWILIO_*`, `SENTRY_DSN`.

## Initial Super Admin Seed

`npx prisma db seed` (from `backend/`). Idempotent — updates Clerk user password on re-run.
- Username: `manoj_admin` | Email: `manojdatascientist08@gmail.com` | Password: `Manoj!@#8520`

## Deployment

- **Backend → Railway** — auto-deploy on push to `main` via GitHub Actions (`RAILWAY_TOKEN` secret)
- **Frontend → Vercel** — auto-deploy on push to `main` via GitHub Actions (`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`; root dir: `admin-panel`)
- CI runs typecheck + lint + build for both workspaces before deploying

## EiFlix PRD Status

PRD source: `F:\admin\EiFlix_Admin_PRD.md`

| Section | Route | Status |
|---------|-------|--------|
| 3.1–3.14 | various | ✅ Complete |
| 3.15 Resources | `/app-resources` | ⚠️ Needs file upload + DnD |
| 3.16 Products | `/products` | ⚠️ Needs thumbnail upload + CTA management |
| 3.17 Notifications | `/app-notifications` | ⚠️ Needs recipient targeting |
| 3.18 Member Progress | `/members/:id` | ❌ Page not yet created |

Detailed continuity docs:
- `tbt-admin/CLAUDE.md` — extended patterns, design constants
- `tbt-admin/PROJECT_STATUS.md` — section-by-section completion tracker
- `tbt-admin/ARCHITECTURE.md` — full directory map, route map, hook map, DB models, env vars
- `tbt-admin/PENDING_TASKS.md` — step-by-step guide for sections 3.15–3.18
