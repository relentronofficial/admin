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

`tbt-admin-safe/` is a backup snapshot directory — not a workspace, not a source of truth. Ignore it entirely.

**Surgical updates over large rewrites** — prefer targeted data sanitation (handling nulls/empty strings, guarding one field) over refactoring entire controllers or modules. Minimal, non-breaking fixes only.

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
npm run seed:gamified -w backend   # Seed XP/gamification data
npm run seed:tasks -w backend      # Seed task/initiative sample data
npm run seed:batches -w backend    # Seed batch sample data

# TypeScript check (targeted — Bash syntax; use before/after any edit)
cd tbt-admin && npx tsc --noEmit -p admin-panel/tsconfig.json 2>&1 | grep <filename>
# PowerShell equivalent:
# npx tsc --noEmit -p admin-panel/tsconfig.json 2>&1 | Select-String <filename>

# Clean build after auth/routing changes (required to avoid stale .next cache)
rmdir /s /q .next && npm run dev   # Windows PowerShell
# rm -rf .next && npm run dev      # Mac/Linux

# Database
npm run prisma:generate -w backend   # Regenerate Prisma client after schema changes
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

### Authentication — Two Completely Different Systems

**Admin panel auth (Clerk):**
- `clerkPlugin` (`backend/src/plugins/clerk.ts`) decorates Fastify with `fastify.authenticate` — verifies Clerk JWTs, used as `preHandler` on all admin-protected routes
- `ClerkProvider` wraps root layout. `AuthInterceptor` in `admin-panel/components/Providers.tsx` registers an Axios request interceptor that calls `getToken()` (with 52-second in-memory cache) and attaches `Authorization: Bearer <token>` to every `apiClient` call
- Admin socket authenticates via Clerk token in `socket.handshake.auth.token`

**User web auth (custom JWT cookies):**
- `@clerk/nextjs` IS installed in user-web, but only for: the `app/(auth)/` Clerk-hosted route group and middleware auth-state detection. The main `/login` page and all backend API calls use custom JWT cookies — never Clerk JWTs or bearer tokens.
- `POST /api/user-auth/login` → phone + password → bcrypt check → OTP sent via WhatsApp → `POST /api/user-auth/verify-otp` → issues `tbt_access` (15 min) + `tbt_refresh` (30 day) HttpOnly cookies
- Axios client has `withCredentials: true`; cookies are sent automatically on every request
- Auto-refresh: interceptor catches 401, calls `/api/user-auth/refresh`, retries original request (skipped for `/api/user-auth/` paths)
- `initApiClient()` in `tbt-user-web/lib/api/client.ts` is a **no-op stub** — user web never attaches bearer tokens; auth is entirely cookie-based
- `jwtPlugin` (`backend/src/plugins/jwt.ts`) provides `fastify.authenticateUser` for user-web routes — reads `tbt_access` cookie, verifies JWT locally, checks member status
- Member socket authenticates via the session cookie

### Backend Structure
- **Entry:** `backend/src/server.ts` — registers plugins then route modules
- **Plugins:** `backend/src/plugins/` — `prisma`, `redis`, `clerk`, `jwt`, `socket`, `supabase`, `sentry`; each decorates the Fastify instance. Optional plugins skip gracefully if env vars are missing.
- **Modules:** `backend/src/modules/<name>/routes.ts` + `controller.ts` + `schema.ts` pattern
- **Config:** `backend/src/config/env.ts` — Zod-validated env schema; app exits on missing required vars
- **Route prefix convention:** `/api/<module>` (e.g. `/api/courses`, `/api/members`)
- Backend uses ESM (`"type": "module"`), TypeScript compiled with `tsx` in dev and `tsc` for prod
- **Two auth middlewares:** `fastify.authenticate` (Clerk — admin routes) vs `fastify.authenticateUser` (JWT cookie — user-web routes)
- **Backend modules present:** `admin-notifications`, `admins`, `app-notifications`, `app-resources`, `auth`, `batches`, `community`, `config`, `content-sections`, `conversations`, `courses`, `dashboard`, `display-badges`, `hero`, `location`, `members`, `messages`, `notifications`, `products`, `pub`, `security`, `tasks`, `tiers`, `upload`, `user`, `user-auth`, `user-batch`, `webinar`, `workshops`
- **Cache invalidation:** `backend/src/lib/cache.ts` exports `invalidateCache(redis, key)` — call after mutations that affect `useMe()` (e.g. member approve, plan change): `void invalidateCache(request.server.redis ?? null, \`me:${memberId}\`)`
- **Cron endpoints** — `/api/workshops/cron/generate-recurring` and `/api/cron/course-expiry-reminder` bypass Clerk/JWT auth and instead require `x-cron-secret: <CRON_SECRET>` header. All other backend routes use standard auth middleware.

### Frontend Structure (Admin Panel)
- **API client:** `admin-panel/lib/api/apiClient.ts` — Axios pointing to `NEXT_PUBLIC_API_URL`. Response interceptor unwraps `response.data`, so hooks receive `{ success, data, meta, error }` directly. Access lists as `data?.data || []`, total as `data?.meta?.total`.
- **TBT hooks:** `admin-panel/lib/hooks/useTbt.ts` — all TanStack Query hooks (202+ exports). Add new hooks to the bottom. Includes analytics hooks: `useAnalyticsOverview`, `useAtRiskMembers`, `useMemberWatchAnalytics` (used by `/analytics` page), live-call hooks (`useLiveCallAnalytics`, `useGetBreakoutRooms`, etc.), community/batch/tier/badge/notification/product/resource hooks, and 21 course-platform hooks (see Course Platform section below). Batch admin hooks: `useGetBatch`, `useListBatchDays`, `useUpsertBatchDay`, `useGetBatchProgress`, `useGetMemberProgress`, `useUpsertMemberProgress`, `useApproveBatchDay`, `useRejectBatchDay`, `useBulkApproveBatchDays`, `useGetBatchPending`, `useGetBatchBreaks`, `useApproveBreak`, `useRejectBreak`, `useGetBatchMemberAttendance`, `useUpsertBatchAttendance`, `useUpsertMemberBatchSettings`, `useBatchDayAnalytics`.
- **Admin hooks:** `admin-panel/lib/hooks/useAdmin.ts` — admins, `useGetPresignedUrl` (R2 presigned uploads), `useUploadImage` (direct buffer upload ≤100 MB), `useCreateBunnyVideo` (`POST /api/upload/bunny-video-create`), `useDeleteBunnyVideo` (`DELETE /api/upload/bunny-video/:videoId`)
- **Members hooks:** `admin-panel/lib/hooks/useMembers.ts` — `useGetMember`, `useListMembers` (accepts `status` filter), `useCreateMember`, `useApproveMember` (`POST /api/members/:id/approve`)
- **Tasks hooks:** `admin-panel/lib/hooks/useTasks.ts` — `useCreateTaskInitiative`, `useListTasks`, `useUpdateTask`, `useDeleteTask`, `useListBatchTasks`, `useCreateBatchTask`, `useUpdateBatchTask`, `useDeleteBatchTask`, `useReorderBatchTasks`, `useMigrateJsonTasks`, `useGetBatchSubmissions`, `useReviewTaskSubmission`
- **State:** TanStack Query (server state, `staleTime: 5min`), Zustand (client state)
- **Layout:** `DashboardLayout` wraps authenticated pages with `Sidebar` + `Topbar`; fixed sidebar 220px

---

## tbt-user-web Architecture

### Route Groups
```
app/
  (auth)/           # Clerk-hosted sign-in/sign-up pages — DO NOT MODIFY
  (marketing)/      # Public unauthenticated pages: landing, /events, /programs
  (platform)/       # All member pages — wrapped by Navbar + SubscriptionGate
    dashboard/      # Member home
    tbt/            # Content catalog
    workshops/      # Workshop list
    workshop/[id]/  # Workshop detail + flow + Q&A + live calls
    learning/       # Course progress; /learning/badges, /learning/[courseId]
    courses/        # Course catalog
    events/         # Events list; /events/[id]
    programs/       # Programs list; /programs/[id]
    batch-program/  # Batch program; /batch-program/[day]
    live/[webinarId]# In-session webinar page
    search/         # Global search
    notifications/  # Notification center
    messages/       # Chat messages
    Products/       # Products/upgrade page (exempt from SubscriptionGate)
    Resources/      # Downloadable resources
    history/        # Watch history
    profile/        # Member profile (exempt from SubscriptionGate)
  (player)/         # Full-screen video player — bare layout (no Navbar/Footer)
  login/            # Custom LoginScreen — DO NOT MODIFY
  signup/           # Self-registration form (SignupScreen) — DO NOT MODIFY
  verify/           # Phone/OTP verification step (post-signup)
  loading/          # Standalone loading page
```
`(platform)/layout.tsx` renders `<Navbar>`, `<SubscriptionGate>`, and `<Footer>`. All platform pages sit inside `max-w-7xl mx-auto`.

`/eiflix` and `/eiflix/:path*` permanently redirect to `/tbt` and `/tbt/:path*` (see `next.config.ts`).

### API Client (`lib/api/client.ts`)
- Axios instance pointing to `NEXT_PUBLIC_API_URL`, **`withCredentials: true`** — auth via HttpOnly cookies
- Response interceptor unwraps `response.data`; also captures HTTP `Date` header to sync `_serverTimeOffset`
- `initApiClient(getToken)` is a **no-op stub** (empty body) — user web never attaches bearer tokens; auth is entirely cookie-based
- `getServerNow()` — use instead of `Date.now()` for countdowns to avoid client clock skew
- A stable `tbt_device_id` is generated in `localStorage` on first load (multi-device security detection)

**Critical env vars for user-web Clerk** (values override `ClerkProvider` props — wrong values silently redirect logins to the wrong page):
```
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/tbt
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/tbt
```

### `SiteConfigProvider` (`lib/context/SiteConfigContext.tsx`)
Fetches 3 unauthenticated endpoints in parallel on app load:
- `GET /api/pub/config/site` → `SiteConfig` (theme, logos, splash)
- `GET /api/pub/config/nav` → `NavItem[]` + `RightIcons` flags
- `GET /api/pub/config/ui-strings` → `UiStrings`

Injects theme as CSS custom properties on `document.documentElement`.

**CRITICAL**: Every user-visible string must come from `uiStrings` (or `config`). Zero hardcoded label strings in `(platform)` pages.

### CSS Custom Properties (theme tokens)
Injected at runtime — never hardcode these:
```
--color-accent       # primary CTA / brand color
--color-alert        # warning/alert
--color-success      # success state
--color-bg-primary   # page background
--color-bg-surface   # card / surface background
```
Use `style={{ background: "var(--color-accent)" }}` or `color-mix(in srgb, var(--color-accent) 30%, transparent)` for tints.

`--color-locked: #4a4a4a` is the only static token (not from API).

### Real-time (User Web)
`lib/socket/client.ts` exports `getSocket(): Promise<Socket>` (lazy-connects, passes Clerk token from `localStorage`). `lib/socket/useSocket.ts` exports `useSocket()` → `{ socket, connected }`. Call `socket.on()` inside `useEffect`; clean up with `socket.off()`.

### Hook Files
- `lib/hooks/useConfig.ts` — `useHomeHero`, `useHomeSections`, `useMyWorkshops`, `useWorkshopDetail`, `useWorkshopFlow`, `useWorkshopQa` (polls at 15s), `useWorkshopAssignments`, `useEpisodePlayback`, `usePostEpisodeProgress`, `useUserProducts`, `useUserResources`
- `lib/hooks/useDashboard.ts` — `useDashboardStats`, `useContinueLearning`, `useWatchHistory` (accepts `{ page?, limit?, filter?: 'all'|'in_progress'|'completed' }`), `useNotifications`, `useMarkNotificationRead`, `useMarkAllNotificationsRead`, `useMessages`, `useMarkMessageRead`, `useMarkAllMessagesRead`
- `lib/hooks/useUser.ts` — `useMe`, `useUpdateProfile`
- `lib/hooks/useBatchProgram.ts` — `useMyBatchProgram` (GET `/api/user-batch` — batch + days + progress + attendance + breaks), `useSaveBatchDraft` (PUT `/api/user-batch/:dayNumber`), `useSubmitBatchDay` (POST `/api/user-batch/:dayNumber/submit`), `useMarkAttendance` (POST `/api/user-batch/attendance` — `{ dayNumber, notes? }`)
- `lib/hooks/useCourses.ts` — course platform hooks (user-facing): `useCourses`, `useCourse`, `useMyEnrollments`, `useEnrollCourse`, `useLessonProgress`, `useMarkLessonComplete` (has optimistic `onMutate`), `useSubmitCourseQuiz`, `useCourseXp`, `useCourseLeaderboard`, `useUserBadges`, `useCertificateEligibility`, `useRequestCourseAccess`; backed by `lib/api/services/courses.service.ts`
- `lib/hooks/useEvents.ts` — events hooks; backed by `lib/api/services/events.service.ts`
- All hooks are `"use client"` and use TanStack Query v5

**Service layer:** User-web hooks delegate HTTP calls to `lib/api/services/*.service.ts` (thin wrappers over `apiClient`). When adding new user-web hooks, create or extend the relevant service file rather than calling `apiClient` directly from the hook.

### Zustand Stores (User Web)
`lib/stores/` contains three stores: `useAuthStore` (login state, OTP flow step), `usePlayerStore` (episode playback state), `useUIStore` (global UI toggles). Import from `@/lib/stores/<name>`.

### `SubscriptionGate` (`app/(platform)/SubscriptionGate.tsx`)
Reads `useMe()` and applies three tiers:
1. `me.status === 'pending'` → `PendingInterceptor` overlay (click-blocker, sign-out only)
2. No active subscription AND `membershipPlan === 'free'` → `FreeInterceptor` overlay (click-blocker, upgrade prompt)
3. Active subscription OR paid `membershipPlan` (admin-assigned, e.g. `"premium"`) → pass through

Members with a paid `membershipPlan` set by admin bypass the `FreeInterceptor` even if no `Subscription` DB row exists. Paths `["/Products", "/profile"]` are exempt from the redirect/interceptors.

### Self-Registration & Pending Approval Flow
1. User signs up at `/signup` — `POST /api/user-auth/signup` — creates member `status='pending'`, emits `admin:member_pending` socket event
2. User can log in immediately; `SubscriptionGate` shows `PendingApprovalScreen` until approved
3. Admin approves in `/members` edit modal → `POST /api/members/:id/approve` → status `active`

`MemberStatus` enum: `active | inactive | paused | suspended | pending`. `pending` added at DB startup via idempotent `ALTER TYPE` in `backend/src/plugins/prisma.ts`.

### Login Flow (`components/auth/LoginScreen.tsx`)
- Password is **required** — no skip/blank allowed
- Forgot Password → `POST /api/user-auth/forgot-password` → OTP → new password (`reset_password` step)
- Admin-created accounts with no password are routed to `reset_password` (backend sends OTP silently)
- **Off-limits: never modify** `app/login/page.tsx`, `app/(auth)/`, or `app/signup/page.tsx`

### Video Player Progress Pattern (30s periodic POST)
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
// When "Complete" clicked: set completedRef.current = true BEFORE mutation
```

### User-Web Pitfalls
1. **No hardcoded strings** — every user-facing label from `uiStrings` or `config`
2. **No hardcoded colors for theme tokens** — use `var(--color-accent)` etc.
3. **`getServerNow()`** instead of `Date.now()` for countdowns
4. **`initApiClient` is a no-op** — do not add bearer token logic to user-web hooks
5. **`SubscriptionGate` is in platform layout** — don't add subscription/pending checks in individual pages
6. **Login page is permanently off-limits** — never modify `app/login/page.tsx`, `app/(auth)/`, or `app/signup/page.tsx`
7. **`useRef` requires an initial value** (React 19) — `useRef<T | undefined>(undefined)`, never `useRef<T>()`
8. **`refetchQueries` predicate in TanStack Query v5** — `predicate: (q) => q.state.status === 'error'`, not `{ status: 'error' }`

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
Reorder endpoints always use `PUT <prefix>/reorder { ids: string[] }`. Confirm endpoint exists in backend before adding the hook.

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

### Clerk Guards (Admin Panel)
- Always check `isLoaded` before accessing Clerk state in Client Components: `if (!isLoaded) return null`
- Only **one layer** should own a given redirect path — stacking redirects across middleware + layout + page causes infinite redirect loops
- Never use `useUser()`, `useAuth()`, or `useSession()` inside Server Components — these are Client Component-only hooks
- Middleware matcher must **never** intercept `_next/*`, `favicon.ico`, Clerk internal routes, or standard static assets — always explicitly exclude them in the matcher config
- Public routes (`/`, `/sign-in`, `/sign-up`) must always be explicitly excluded from Clerk middleware protection

### Real-time (Admin)
`lib/socket/client.ts` exports `getAdminSocket()` — call inside `useEffect`, register `.on()` listeners, clean up with `.off()` on unmount.

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
Read-only module — logs suspicious viewing behaviour, no automatic blocking. Event types: `EXCESSIVE_SKIPPING`, `RAPID_EPISODE_SWITCHING`, `ABNORMAL_PROGRESS_SPEED`, `MULTIPLE_DEVICES`.

Admin hooks: `useSecurityLogs(params)` and `useSecurityLogStats()` in `useTbt.ts`.

### Admin Notifications (`/api/admin-notifications`)
In-app notification bell for admins (separate from the member-facing `/api/notifications`). Stored in its own DB table, emitted via Socket.IO to the `'admin'` room.

Admin hooks in `useTbt.ts`: `useAdminNotifications(page, limit)`, `useAdminUnreadCount()`, `useMarkAdminNotificationRead()`, `useMarkAllAdminNotificationsRead()`. UI lives in `admin-panel/app/app-notifications/page.tsx`.

### Assignment Review (`/api/workshops/:id/assignments`)
Workshop assignment submissions (uploaded by members) are reviewed by admins in `admin-panel/app/assignments/page.tsx`.

Admin hooks in `useTbt.ts`: `useAllAssignmentSubmissions({ page?, limit?, reviewed?, workshopId? })`, `useReviewAssignment()`.

### Site Settings (`admin-panel/app/settings/`)
Admin pages for editing site-wide config served by `/api/config` (persisted to DB, read by `SiteConfigProvider` on user-web load):
- `settings/site/` — site name, logos, colours, splash screen
- `settings/navigation/` — nav links and right-icon flags
- `settings/ui-strings/` — all member-facing string overrides

---

### Batch Access Control Pattern
Workshops and resources support per-batch access restriction via a `batchIds Json?` column (null = available to all; array of batch IDs = restricted).

- **Schema:** `batchIds Json? @map("batch_ids")` on `Workshop`; `visibility Json?` on `AppResource` (stored as `{ batchIds: string[] }`)
- **Startup migration:** `prisma.$executeRawUnsafe('ALTER TABLE workshops ADD COLUMN IF NOT EXISTS batch_ids JSONB')` — idempotent, in `backend/src/plugins/prisma.ts`
- **List endpoints** — return ALL items with a `locked: boolean` computed from the member's `batchId`. Never filter the list.
- **Access endpoints** (workshop detail, resource download) — return 403 if `batchIds` is set and member's `batchId` is not in the array
- **Admin UI** — multi-select checkbox (not a dropdown). Members and notifications stay single-select (one batch per member is the business model)
- **Prisma Json cast** — `(batchIds as any)` when writing; `(record.batchIds as string[] | null)` when reading

---

## Course Platform (`TBT_Course_Platform_Spec.md` — completed 2026-06-24)

### Data Model — Key Distinctions
- **`CourseAccess`** — authorization record (who is allowed). Separate from `CourseEnrollment` (progress tracking). A member needs a valid `CourseAccess` row to access a course; `CourseEnrollment` is created automatically on first lesson view.
  - `accessType`: `"lifetime"` (valid while `isActive=true`) or `"duration"` (valid while `isActive=true` AND `expiresAt > now()`)
  - Unique constraint: `(memberId, courseId)`
- **`CoursePayment`** — payment ledger record. `method`: `"manual" | "razorpay" | "bank_transfer" | "upi" | "free"`. Approved by admin via `POST /api/courses/:id/payments/:paymentId/approve`.
- **`MemberXP`** — XP ledger. `source`: `"episode_complete" | "quiz_pass"`. Amount comes from `course.xpPerEpisode`.
- **`CourseBadge`** — manually awardable badge per course. Admin awards via `POST /api/courses/:id/badges/:badgeId/award`.

### Extended Course Fields (via startup `ALTER TABLE`)
```
courses:
  price DECIMAL(10,2)          -- null = free
  access_duration_days INT     -- null = lifetime access
  max_enrollments INT          -- null = unlimited
  xp_per_episode INT DEFAULT 10
  passing_score_percent INT DEFAULT 70
  payment_link_url TEXT        -- external payment URL (paymentMethod='external')
  upsell_course_ids TEXT[]     -- array of course IDs
  cross_sell_course_ids TEXT[]

course_episodes:
  quiz_data JSONB              -- { questions: [{ id, question, options: [{ id, text, correct }] }] }
  quiz_unlock_percent INT DEFAULT 80  -- % of episode watched before quiz unlocks
  drm_enabled BOOLEAN DEFAULT false
  bunny_drm_token TEXT
```

### Admin Hooks (`useTbt.ts`)
`useListVodCourses`, `useCreateVodCourse`, `useUpdateVodCourse`, `useDeleteVodCourse`, `useListCourseEpisodes`, `useCreateCourseEpisode`, `useUpdateCourseEpisode`, `useDeleteCourseEpisode`, `useReorderCourseEpisodes`, `useListCourseAccess`, `useGrantCourseAccess`, `useRevokeCourseAccess`, `useListCoursePayments`, `useApproveCoursePayment`, `useCourseAnalyticsAdmin`, `useCourseLeaderboardAdmin`, `useListCourseBadges`, `useCreateCourseBadge`, `useUpdateCourseBadge`, `useDeleteCourseBadge`, `useAwardCourseBadge`

The admin courses UI lives in a single monolithic `admin-panel/app/courses/page.tsx` (same pattern as workshops). Uses `useCreateBunnyVideo` from `useAdmin` for Bunny Stream video creation.

### Admin API Routes (`/api/courses` — Clerk-protected)
```
GET/POST /api/courses
GET/PUT/DELETE /api/courses/:id
POST /api/courses/:id/publish
GET /api/courses/:id/enrollments
GET /api/courses/:id/episodes
POST /api/courses/:id/episodes
PUT /api/courses/episodes/reorder
PUT /api/courses/episodes/:eid
DELETE /api/courses/episodes/:eid
GET/POST /api/courses/:id/access
DELETE /api/courses/:id/access/:accessId
GET /api/courses/payments
POST /api/courses/:id/payments/:paymentId/approve
GET /api/courses/:id/analytics
GET /api/courses/:id/leaderboard
GET/POST /api/courses/:id/badges
PUT/DELETE /api/courses/:id/badges/:badgeId
POST /api/courses/:id/badges/:badgeId/award
```

### User-Web Course Routes
- `/courses` — catalog listing
- `/learning` — enrolled courses / progress overview; `/learning/badges` — earned badges
- `/learning/[courseId]` — course detail + lesson list
- `/learning/[courseId]/[lessonId]` — lesson video player with quiz, XP, progress

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
10. **Workshop detail page is monolithic by design** — all 7 tabs in one `workshops/[id]/page.tsx`. Tab-specific hooks (`useWorkshopChallenges`, `useWorkshopFlow`, `useWorkshopLiveCalls`, `useWorkshopAssignments`, `useWorkshopQA`, `useWorkshopEnrollments`) accept a second `tabActive: boolean` param — pass `activeTab === 'tab-id'` to defer loading until the tab is clicked.
11. **Challenge `type` field** — valid values: `"watch"` | `"quiz"` | `"matching"` | `"written"` | `"flashcard"`. Each type has a distinct `quizData` shape stored as JSON:
    - `"quiz"` → `{ questions: [{ id, question, options: [{ id, text, correct }] }] }`
    - `"written"` → `{ prompt, placeholder? }`
    - `"matching"` → `{ pairs: [{ id, left, right }] }`
    - `"flashcard"` → `{ cards: [{ id, front, back }] }`
    - `"watch"` → `quizData: null`
12. **Episode `type` field** — valid values: `["video", "assignment", "offer"]` only
13. **`req.memberId` not `req.member`** — `fastify.authenticateUser` (JWT cookie middleware) sets `request.memberId: string`. There is NO `request.member` object. Writing `(req as any).member.id` will throw a TypeError at runtime in all user-batch and user-web routes. Always use `req.memberId!`.
14. **Adding DB columns without migrations** — use `prisma.$executeRawUnsafe('ALTER TABLE foo ADD COLUMN IF NOT EXISTS bar JSONB')` inside the `prisma.ts` plugin startup block. This is idempotent and avoids needing a migration file for `Json?` columns added post-initial-schema.
15. **`CourseAccess` ≠ `CourseEnrollment`** — access grants permission; enrollment tracks progress. Always check/create `CourseAccess` before allowing lesson playback. Never conflate the two.
16. **Course episode `quizData`** — lives on `course_episodes.quiz_data`. Supports two layers:
    - **End-of-video quiz** (gated by `quizUnlockPercent`): `{ questions: [{ id, question, options: [{ id, text, correct }] }] }`
    - **Mid-video cue quizzes**: `{ questions: [...], cues: [{ id, atSeconds: number, questions: [...] }] }` — the player pauses at each `atSeconds` timestamp and shows `CueQuizModal`. `hasQuiz` (computed server-side) is `true` only when `questions.length > 0`; cues alone do NOT set `hasQuiz`.
    Not the same as `quizData` on a workshop `Challenge` row.
17. **`useMarkLessonComplete` uses optimistic updates** — it updates the TanStack Query cache in `onMutate` when `isCompleted=true`. If you call it from a new context, ensure `courseId` is in scope for the correct `queryKey: ["user", "progress", courseId]`.
18. **`lessonAlreadyDone` completion signals** — The function in `learning/[courseId]/page.tsx` uses exactly 3 signals: (a) `completedIds.has(lessonId)` (authoritative DB state), (b) `!!isCompleted` from course query, (c) `actualWatchedSecs >= durationSeconds * 0.85`. There is intentionally NO position proximity heuristic — it was removed because `|resumeAtSeconds - actualWatchedSecs| < 5` caused false positives for partially-watched lessons (e.g., watched 37 of 46s → detected as done). If `lessonAlreadyDone` returns `true`, the lesson-reset effect pre-sets `markCalledRef.current = true`, silently blocking all completion POSTs for that session without any error or UI indication.
19. **Video player is HLS-first, iframe fallback** — Both the workshop player (`workshop/[slug]/page.tsx`) and course player (`learning/[courseId]/page.tsx`) use the same two-tier pattern:
    - If `episode.hlsUrl` is set (and HLS hasn't errored): render `<PlyrPlayer>` (`components/features/video/PlyrPlayer.tsx` — Plyr + hls.js, lazy-imported). Use `ref={playerRef}` (type `PlyrPlayerHandle`) to read `.currentTime` and `.duration` imperatively. Props: `hlsUrl`, `startAt`, `speed`, `autoplay`, `onReady(duration)`, `onTimeUpdate(currentTime)`, `onPlay`, `onPause`, `onEnded`, `onSpeedChange`, `onError`. Set `hlsFailed=true` in `onError` to trigger iframe fallback.
    - Otherwise: render Bunny `<iframe>` and use postMessage. `timeupdate`, `pause`, and `ended` fire **automatically** without subscribing. `play` does NOT fire on autoplay — detect via `getCurrentTime`/`isPaused` responses after `ready`. `value.seconds` = playhead; `value.duration` = real duration (use on first message).
    The backend sets `videoType: 'hls' | 'iframe'` alongside `hlsUrl` to indicate which path applies.
20. **`BUNNY_CDN_URL` env var lacks `https://`** — stored as bare hostname (e.g., `tamil-business-tribe-cdn.b-cdn.net`). The controller normalizes it, but if writing new HLS URL construction elsewhere always use: `` `${(env.BUNNY_CDN_URL.startsWith('http') ? env.BUNNY_CDN_URL : `https://${env.BUNNY_CDN_URL}`).replace(/\/$/, '')}/${bunnyId}/playlist.m3u8` ``
21. **`tsx watch` may not hot-reload** — the backend dev server (`npm run dev:backend`) uses `tsx watch` which doesn't reliably detect all file changes. After editing files in `backend/src/`, kill and restart the process if API behaviour doesn't change after saving.
22. **Course player gamification layer** (`learning/[courseId]/page.tsx`) — three client-only features, all localStorage:
    - **Cue quizzes**: `firedCuesRef` (a `Set<string>`, reset on lesson switch) tracks which `cue.id`s have fired. `cueQuizActiveRef` (boolean ref) prevents re-triggering while modal is open. Flow: `handleVideoProgress` checks `quizData.cues` sorted by `atSeconds` → calls `pausePlayerRef.current()` → calls `document.exitFullscreen()` first if in fullscreen → sets `cueQuizModal`. `handleCloseCueQuiz` clears both refs.
    - **Reflection modal** (`ReflectionModal`): fires 1.2 s after a lesson completes, but only when `!lesson.hasQuiz && justCompletedInSessionRef.current === true` (i.e., quiz-bearing lessons skip it; lessons that were already done before session load skip it). Saved to `localStorage["tbt_reflections"]` as `{ [courseId:lessonId]: { text, savedAt, lessonTitle } }`. UI strings: `reflectTitle`, `reflectPromptPrefix`, `reflectPromptSuffix`, `reflectPlaceholder`, `reflectSkipLabel`, `reflectSaveLabel`, `reflectSavedLabel`.
    - **Practice Arena modal** (`PracticeArenaModal`): pulls `(lesson as any).quizData?.questions` from all lessons in the course query, shuffles them into interleaved practice. No XP, no backend call.
    - **localStorage keys**: `tbt_cr_${courseId}` — completion timestamps `{ [lessonId]: timestampMs }`. `tbt_reflections` — global across all courses. `tbt_speed` — persisted playback speed.
    - **`Lesson` type does not include `quizData`** — the TypeScript interface in `types/index.ts` omits it; access as `(lesson as any).quizData` wherever needed.
23. **Batch program `totalDays` is dynamic** — `totalDays = batch.program.durationDays + memberBatchSettings.extendedDays`. Never hardcode 90. `useMyBatchProgram` response now includes `totalDays`, `attendance` (array of `{ dayNumber, status, notes, markedAt }`), and `breaks` (array of break requests). Day objects include a `category` string field.
24. **`WatchHistoryItem` and `ContinueLearningItem` are unified** — both types now carry `type: "workshop" | "course"` as a discriminator (in `tbt-user-web/types/index.ts`). Workshop items include `workshopSlug`/`workshopTitle`; course items include `courseId`/`courseTitle`. Dashboard "Recently Watched" and "Continue Watching" sections render both types from a single merged list — don't branch the hook calls or filter by content type.
25. **`batches.xp_per_day` is a raw SQL column** — not in Prisma schema; added via idempotent `ALTER TABLE batches ADD COLUMN IF NOT EXISTS xp_per_day INT NOT NULL DEFAULT 50` in `prisma.ts` startup. Reading: after `prisma.batch.findMany/findUnique`, run a supplementary `$queryRawUnsafe` and merge `xpPerDay` via object map. Writing (create/update): **destructure `xpPerDay` out of the body before spreading into `prisma.batch.create/update`** (Prisma throws "Unknown field" otherwise), then persist via `$executeRawUnsafe('UPDATE batches SET xp_per_day=$1 WHERE id=$2', xpPerDay, id)`. Default fallback: `xpRow?.xp_per_day ?? 50`. On approve, `approveDayHandler` / `bulkApproveDaysHandler` fetch `xp_per_day` from the DB (once, before any loop) and use it for `pointsLedger` + socket emit `batch:day_approved` + notification text.

## Socket Events

Admin panel uses `getAdminSocket()` from `admin-panel/lib/socket/client.ts` (singleton, lazy-connects).
User web uses `getSocket()` (async/lazy) from `tbt-user-web/lib/socket/client.ts` and the `useSocket()` hook.

Socket.IO rooms and the events each room receives:

| Room | Events emitted |
|---|---|
| `'admin'` | `admin:member_joined`, `admin:member_pending`, `admin:member_approved`, `admin:product_inquiry`, `chat:conversation_new`, `chat:unread_ping` |
| `user:{memberId}` | `notification`, `message:new`, `workshop:enrolled`, `workshop:removed`, `live_call:lock`, `live_call:admitted`, `live_call:poll`, `live:reminder`, `batch:day_approved` (`{ dayNumber, batchId, xpAwarded }`) |
| `workshop:{slug}` | `qa:new_question`, `qa:new_reply` |
| `live:{webinarId}` | `live:started`, `live:ended`, `live:attendee_count` |
| `conversation:{id}` | `chat:message`, `chat:typing`, `chat:conversation_closed`, `chat:conversation_reopened` |
| broadcast | `notification:broadcast` |

Client joins workshop/live rooms by emitting `join:workshop` / `leave:workshop` and `join:live` / `leave:live`.

## Key Services
| Service | Purpose |
|---|---|
| Supabase (PostgreSQL) | Primary DB via Prisma ORM |
| Upstash Redis | BullMQ job queues |
| Cloudflare R2 | File/image/video storage (presigned URL uploads) |
| Bunny Stream | Video hosting (HLS + iframe embed) |
| LiveKit | Workshop live calls (`LIVEKIT_API_KEY/SECRET/WS_URL/WEBHOOK_SECRET`) |
| Clerk | Admin panel auth (API + frontend). Also installed in user-web for `(auth)/` pages and middleware auth-state; main user login uses JWT cookies |
| Firebase | Push notifications |
| Resend / Twilio | Email / SMS |
| Anthropic Claude | AI quiz generation in workshops + live call summary generation (`claude-haiku-4-5`, requires `ANTHROPIC_API_KEY`) |
| pdfkit | Server-side PDF generation |
| Sentry | Error tracking |
| Better Stack | Log aggregation |

## Environment Setup

Copy and fill both env files before starting:
- `backend/.env.example` → `backend/.env` (required: `DATABASE_URL`, `DIRECT_URL`, Supabase keys, Clerk keys, `CLOUDFLARE_R2_*`, `JWT_ACCESS_SECRET`)
- `admin-panel/.env.example` → `admin-panel/.env.local`

Optional vars (plugins skip gracefully if absent): `UPSTASH_REDIS_*`, `BUNNY_STREAM_*`, `LIVEKIT_*`, `FIREBASE_*`, `RESEND_API_KEY`, `TWILIO_*`, `SENTRY_DSN`, `ANTHROPIC_API_KEY` (required only for AI quiz generation in workshops).

## Initial Super Admin Seed

`npx prisma db seed` (from `backend/`). Idempotent — updates Clerk user password on re-run.
- Username: `manoj_admin` | Email: `manojdatascientist08@gmail.com` | Password: `Manoj!@#8520`

## Deployment

- **Backend → Google Cloud Run** (`asia-south1`, project `tbt-lms-platform`, service `tbt-backend`)
  - Production has `--min-instances=1` to eliminate cold starts
  - CI/CD in `.github/workflows/ci-cd.yml` — deploys on push to `main` when `tbt-admin/backend/**` changes
- **Admin Frontend → Vercel** — auto-deploy on push to `main`; root dir `admin-panel`
- **User Web → Vercel** — separate project; custom domain `https://app.tamilbusinesstribe.com`
- CORS: `USER_WEB_URL` + `ADMIN_WEB_URL` + `CORS_EXTRA_ORIGINS` (comma-separated). Adding a new domain → add to `CORS_EXTRA_ORIGINS` in ci-cd.yml `--set-env-vars`.

**Recommended one-time setup for faster JWT verification:** Add `CLERK_JWT_PUBLIC_KEY` to GCP Secret Manager (`prod-CLERK_JWT_PUBLIC_KEY`) and include it in `--set-secrets` in ci-cd.yml. Without it, Clerk SDK fetches JWKS from the internet on first startup (cached after that, so it's a cold-start cost only). With it, all JWT verification is local crypto.

## PRD Implementation Status

### Admin PRD (`TBT_Admin_PRD.md`) — All 18 sections ✅ Complete + Security Logs + Course Platform
See `tbt-admin/PROJECT_STATUS.md` for section-by-section detail.
See `tbt-admin/ARCHITECTURE.md` for full directory/route/hook/DB map.

### User Web PRD (`TBT_PRD.md` / `TBT_PRD_Dynamic.md`) — All sections ✅ Complete
Sections 1–12 implemented in `tbt-user-web/`. Includes: marketing landing, platform dashboard, TBT (content catalog), workshops (detail + flow + Q&A + assignments + live calls), products, resources, notifications, messages, profile, full-screen + embedded video player.

### Course Platform (`TBT_Course_Platform_Spec.md`) — ✅ Complete (2026-06-24)
VOD course platform with pricing/access control, XP gamification, episode quizzes, DRM, badges, certificates, upsell/cross-sell, leaderboards, and analytics. See `TBT_Course_Platform_Spec.md` for the full spec.

### Batch Program Improvements (`TASK_FEATURE_SPEC.md`) — ✅ Complete (2026-06-30)
All 25 items implemented: attendance marking, break requests (admin approve/reject), per-day categories, calendar view, bulk approve, task proofs, configurable XP per batch (`xp_per_day`), extended days per member, UI-string driven labels, and socket notifications.
