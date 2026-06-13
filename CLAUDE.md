# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Tamil Business Tribe (TBT) — monorepo with three workspaces:

```
tbt-admin/
  admin-panel/   # Next.js 14 (App Router) admin frontend (port 3000)
  backend/       # Fastify API server (port 8000)
  package.json   # npm workspaces root

tbt-user-web/    # Next.js 15 (App Router) member-facing frontend (port 3001)
```

**NEVER use the word "EiFlix" in user-facing code or string literals. Use "TBT" instead.**

## Commands

### Admin + Backend (from `tbt-admin/`)

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

### User Web (from `tbt-user-web/`)

```bash
npm run dev         # Next.js dev (Turbopack, port 3001 if 3000 taken)
npm run build
npm run typecheck   # tsc --noEmit
npm run lint
npm run format      # prettier --write .
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
- **TBT hooks:** `admin-panel/lib/hooks/useTbt.ts` — all TanStack Query hooks (~600+ lines). Add new hooks to the bottom of this file.
- **Admin hooks:** `admin-panel/lib/hooks/useAdmin.ts` — admins, `useGetPresignedUrl` (R2 presigned uploads), `useUploadImage` (direct buffer upload for images/videos ≤100 MB)
- **Members hooks:** `admin-panel/lib/hooks/useMembers.ts` — `useGetMember`, `useListMembers` (accepts `status` filter param), `useCreateMember`, `useApproveMember` (`POST /api/members/:id/approve`), and related mutations
- **Tasks hooks:** `admin-panel/lib/hooks/useTasks.ts` — `useCreateTaskInitiative`, `useListTasks`, and related task/initiative mutations
- **State:** TanStack Query for server state; Zustand for client state
- **Layout:** `DashboardLayout` wraps authenticated pages with `Sidebar` + `Topbar`; fixed sidebar 220px
- **Validation:** Zod in `lib/validators/`; React Hook Form + `@hookform/resolvers/zod`
- **Notifications:** `react-hot-toast`, configured in `Providers.tsx`

---

## tbt-user-web Architecture

### Route Groups
```
app/
  (auth)/           # Clerk-hosted sign-in/sign-up pages — DO NOT MODIFY
  (marketing)/      # Public landing page (unauthenticated)
  (platform)/       # All member pages — wrapped by Navbar + SubscriptionGate
  (player)/         # Full-screen video player — bare layout (no Navbar/Footer)
  login/            # Custom LoginScreen — DO NOT MODIFY
  signup/           # Self-registration form (SignupScreen) — DO NOT MODIFY
  loading/          # Standalone loading page
```
`(platform)/layout.tsx` renders `<Navbar>`, `<SubscriptionGate>`, and `<Footer>`. All platform pages sit inside `max-w-7xl mx-auto`.

`/eiflix` and `/eiflix/:path*` permanently redirect to `/tbt` and `/tbt/:path*` (see `next.config.ts`).

### API Client (`lib/api/client.ts`)
- Axios instance pointing to `NEXT_PUBLIC_API_URL` (default `http://localhost:8000`)
- Response interceptor **unwraps** `response.data` — hooks receive `{ success, data, meta, error }` directly, not doubly-nested
- Response interceptor **also** captures the HTTP `Date` header to sync `_serverTimeOffset` (never set this directly)
- `initApiClient(getToken)` must be called once inside a client component (done in `Providers`) to attach Clerk bearer tokens. Hooks must NOT call `getToken` themselves
- `getCachedToken()` polls up to 600 ms for `initApiClient` to be called — handles the race between `SubscriptionGate`'s first query and `AuthInterceptor`'s `useEffect`
- `getServerNow()` — exported helper; use instead of `Date.now()` for any countdown or time-sensitive display to avoid client clock skew
- A stable `tbt_device_id` is generated in `localStorage` on first load (used for multi-device detection in security logs)

### Authentication (`Providers.tsx`)
`ClerkProvider` wraps root; inside it, a component calls `initApiClient(useAuth().getToken)` once. Clerk's `<UserButton>` is rendered directly in `Navbar`.

### `SiteConfigProvider` (`lib/context/SiteConfigContext.tsx`)
**Bootstrap-phase context** — fetches 3 endpoints on app load (parallel, unauthenticated):
- `GET /api/pub/config/site` → `SiteConfig` (theme, logos, splash)
- `GET /api/pub/config/nav` → `NavItem[]` + `RightIcons` flags
- `GET /api/pub/config/ui-strings` → `UiStrings`

Injects theme as CSS custom properties on `document.documentElement`. Manages the splash screen timer.

**CRITICAL**: Every user-visible string must come from `uiStrings` (or `config`). Zero hardcoded label strings in `(platform)` pages.

### CSS Custom Properties (theme tokens)
These are injected at runtime by `SiteConfigProvider`. **Never use hardcoded color values for these; always use the CSS var:**
```
--color-accent       # primary CTA / brand color
--color-alert        # warning/alert
--color-success      # success state
--color-bg-primary   # page background
--color-bg-surface   # card / surface background
```
Use `style={{ background: "var(--color-accent)" }}` or `color-mix(in srgb, var(--color-accent) 30%, transparent)` for tints.

`--color-locked: #4a4a4a` is the only static design token (gating indicator, not from API).

### Hook Files
- `lib/hooks/useConfig.ts` — content hooks: `useHomeHero`, `useHomeSections`, `useMyWorkshops`, `useWorkshopDetail`, `useWorkshopFlow`, `useWorkshopQa` (polls at 15s), `useWorkshopAssignments`, `useEpisodePlayback`, `usePostEpisodeProgress`, `useUserProducts`, `useUserResources`
- `lib/hooks/useDashboard.ts` — `useDashboardStats`, `useContinueLearning`, `useWatchHistory`, `useNotifications`, `useMarkNotificationRead`, `useMarkAllNotificationsRead`, `useMessages`, `useMarkMessageRead`, `useMarkAllMessagesRead`
- `lib/hooks/useUser.ts` — `useMe`, `useUpdateProfile`
- `lib/hooks/useCourses.ts`, `lib/hooks/useEvents.ts` — supplementary hooks
- All hooks are `"use client"` and use TanStack Query v5

### `SubscriptionGate` (`app/(platform)/SubscriptionGate.tsx`)
Reads `useMe()` and:
- If `me.status === 'pending'` → renders `PendingApprovalScreen` overlay (full-screen, blocks all content, shows sign-out button)
- If subscription missing or expired → redirects to `/Products`
- Paths `["/Products", "/profile"]` are exempt from the subscription check. Runs client-side only.

### Self-Registration & Pending Approval Flow
1. **User signs up** at `/signup` (`components/auth/SignupScreen.tsx`) — `POST /api/user-auth/signup` — creates member with `status='pending'`, `membershipPlan='free'`, emits `admin:member_pending` socket event
2. **User logs in** — can log in immediately with the password they set at signup; `SubscriptionGate` shows `PendingApprovalScreen` until approved
3. **Admin notified** — socket toast in admin panel; "Pending" tab in `/members` with badge count; stat card shows pending count
4. **Admin approves** — opens edit modal for the pending member, fills any missing fields, clicks green "Approve Member" button → `POST /api/members/:id/approve` → status set to `active`

`MemberStatus` enum: `active | inactive | paused | suspended | pending`. `pending` is added at DB startup via idempotent `ALTER TYPE "MemberStatus" ADD VALUE IF NOT EXISTS 'pending'` in `backend/src/plugins/prisma.ts`.

### Login Flow (`components/auth/LoginScreen.tsx`)
- Password is **required** — no skip/blank allowed
- "New to TBT? Sign up" link always visible below the login form
- Forgot Password → `POST /api/user-auth/forgot-password` → OTP + new password screen (`reset_password` step)
- Admin-created accounts with no password set are silently routed to the `reset_password` step (backend sends OTP)
- **Off-limits: never modify** `app/login/page.tsx` or `app/(auth)/`

### Video Player Progress Pattern (30s periodic POST)
Used in any component that embeds video playback:
```typescript
const startRef = useRef<number>(Date.now());
const completedRef = useRef(false);

useEffect(() => {
  if (!playback) return;
  startRef.current = Date.now();
  completedRef.current = false;
  const id = setInterval(() => {
    if (completedRef.current) return;
    const elapsed = Math.floor((Date.now() - startRef.current) / 1000);
    postProgress.mutate({ episodeId, watchedSeconds: playback.resumeAtSeconds + elapsed, isCompleted: false });
  }, 30_000);
  return () => clearInterval(id);
}, [playback?.id]);
// When "Complete" is clicked: set completedRef.current = true before mutation
```
The full-screen player (`(player)/watch/[episodeId]`) AND the embedded `EpisodePlayer` inside the workshop page both implement this.

### User-Web Pitfalls
1. **No hardcoded strings** — every user-facing label must come from `uiStrings` or `config`
2. **No hardcoded colors for theme tokens** — use `var(--color-accent)` etc.
3. **`getServerNow()`** instead of `Date.now()` for countdowns — avoids client clock skew
4. **`initApiClient`** is called once in `Providers`; hooks must not attach tokens themselves
5. **`SubscriptionGate`** is already in the platform layout — don't duplicate the subscription check in individual pages; it also handles `pending` status
6. **Login page is permanently off-limits** — never modify `app/login/page.tsx`, `app/(auth)/`, or `app/signup/page.tsx`
7. **`useRef` requires an initial value** (React 19) — use `useRef<T | undefined>(undefined)`, never `useRef<T>()`
8. **`refetchQueries` predicate in TanStack Query v5** — use `predicate: (q) => q.state.status === 'error'`, not `{ status: 'error' }`

---

## Admin Panel Architecture

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

### Security Logs (`/api/security-logs`)
Read-only module — logs suspicious viewing behaviour, no automatic blocking. Event types stored in `SecurityLog.eventType`:
- `EXCESSIVE_SKIPPING` — user jumped forward more than expected
- `RAPID_EPISODE_SWITCHING` — many episodes opened in a short window
- `ABNORMAL_PROGRESS_SPEED` — reported delta far exceeds wall-clock elapsed
- `MULTIPLE_DEVICES` — same session active on multiple devices simultaneously

Admin hooks: `useSecurityLogs(params)` and `useSecurityLogStats()` in `useTbt.ts`.
Backend endpoints: `GET /api/security-logs` and `GET /api/security-logs/stats`.

---

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

- **Backend → Google Cloud Run** — deploy via Google Cloud Run (previously Railway)
- **Frontend → Vercel** — auto-deploy on push to `main` via GitHub Actions (`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`; root dir: `admin-panel`)
- CI runs typecheck + lint + build for both workspaces before deploying

## PRD Implementation Status

### Admin PRD (`TBT_Admin_PRD.md`) — All 18 sections ✅ Complete + Security Logs
See `tbt-admin/PROJECT_STATUS.md` for section-by-section detail.
See `tbt-admin/ARCHITECTURE.md` for full directory/route/hook/DB map.

### User Web PRD (`TBT_PRD.md` / `TBT_PRD_Dynamic.md`) — All sections ✅ Complete
Sections 1–12 implemented in `tbt-user-web/`. Includes: marketing landing, platform dashboard, TBT (content catalog), workshops (detail + flow + Q&A + assignments + live calls), products, resources, notifications, messages, profile, full-screen + embedded video player.
