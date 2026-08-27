# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Tamil Business Tribe (TBT) — monorepo with four active workspaces:

```
tbt-admin/
  admin-panel/   # Next.js 14 (App Router) admin frontend (port 3000)
  backend/       # Fastify API server (port 8000)
  package.json   # npm workspaces root

tbt-user-web/    # Next.js 15 (App Router) member-facing frontend (port 3001)

tbt_app/         # Flutter mobile app (Android + iOS) — Riverpod + go_router + Dio.
                 # Talks to the same Fastify backend as tbt-user-web (JWT cookie auth).
```

**Non-TBT directories at repo root (ignore for TBT work):**
- `form/` — standalone Next.js 16 app (port 3007) for an Office Assistant job application form. Separate Prisma schema, separate Vercel Blob storage. Not part of the TBT monorepo.
- `co-worker/` — separate Flutter mobile app. Not part of the TBT monorepo.

**NEVER use the word "EiFlix" in user-facing code or string literals. Use "TBT" instead.**

`tbt-admin-safe/` is a backup snapshot directory — not a workspace, not a source of truth. Ignore it entirely.

**Repo-root screenshots & audit scripts are throwaway artifacts.** The repo root contains hundreds of `.png`/`.jpeg` screenshots and one-off `.mjs` audit/test scripts (`admin-full-audit.mjs`, `test-*.mjs`, `*-audit.mjs`, etc.) from prior manual QA runs. Do not commit them, do not treat them as canonical tests, and do not delete them without asking — they're the user's local debugging trail.

**Additional spec docs** — always read the relevant speckit before touching its module to avoid re-litigating decisions:

| Speckit | Location | Scope / Status |
|---|---|---|
| `SPECKIT.md` | `tbt-admin/` | Workflow-audit P0–P3 fix list for Members · Batches · Tasks |
| `SELF_ONBOARDING_SPECKIT.md` | repo root | Self-onboarding KYC wizard — **in progress 2026-08-18**; covers `onboarding`/`onboarding-meetings` modules, `verificationStatus`, `onboardingCompleted` |
| `WEEKLY_CHECKLIST_SPECKIT.md` | repo root | Weekly rollup layer on top of batch program (required/optional tasks, per-week analytics, FCM push registration) — **implemented and committed** |
| `TBT_ADS_SPECKIT.md` | repo root | Ad campaign system spec for Flutter mobile client — check before adding mobile ad features |
| `COURSE_UX_SPECKIT.md` | repo root | Course UX & wiring fixes C-01–C-12 (heartbeat bug, URL sync, Practice Arena, catalog filters, reflections backend, etc.) — **complete 2026-08-25** |
| `ONBOARDING_SPECKIT.md` | `tbt_app/` | 14 Flutter-side onboarding fixes (Sprint 1 in progress) |
| `CHAT_GROUP_SPECKIT.md` | `tbt_app/` | Flutter chat group WhatsApp-parity roadmap F-01–F-22 — Sprints 1+2 committed, Sprint 3 in progress (F-05/06/11/12/15), Sprint 6 done uncommitted (F-17/18/19/21) |
| `HOME_PAGE_SPECKIT.md` | `tbt_app/` | Flutter home page port from co-worker app |
| `WINS_SPECKIT.md` | `tbt_app/` | Flutter WINS leaderboard / gamification screen |
| `PODCAST_SPECKIT.md` | `tbt_app/` | Flutter podcast feature port |
| `COMMUNITY_SPECKIT.md` | `tbt_app/` | Flutter community feed v1 |
| `COMMUNITY_FEED_V2_SPECKIT.md` | `tbt_app/` | Social-media-grade community overhaul (30 items, ~5–7 dev days) |
| `EBOOK_SPECKIT.md` | `tbt_app/` | Ebook feature gap-fix plan (2026-08-01 audit findings) |
| `PERF_SPECKIT.md` | `tbt_app/` | Flutter app performance root-cause plan |

**`WORKSHOP_BUG_REPORT.md` (repo root)** — 6 bugs found in a 2026-08-21 static audit of the workshop module (BUG-WS-001 through BUG-WS-006); all 6 resolved in commit `cccdf538`. Read before touching workshop-related code.

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

# Tests (Vitest — narrowly scoped to two pure modules; no DB/network)
npm test                           # Runs src/modules/ads/**/*.test.ts + src/lib/batchReportLogic.test.ts
# DO NOT add *.test.ts elsewhere without updating tbt-admin/backend/vitest.config.ts#include

# Run a single test file (from tbt-admin/)
npx vitest run --reporter=verbose -w backend src/lib/batchReportLogic.test.ts

# TypeScript check (targeted — PowerShell; run from tbt-admin/)
npx tsc --noEmit -p admin-panel/tsconfig.json 2>&1 | Select-String <filename>   # admin panel
npx tsc --noEmit -p backend/tsconfig.json 2>&1 | Select-String <filename>       # backend

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

### Flutter App (from `tbt_app/`)

```bash
flutter pub get               # Install dependencies
flutter run                   # Run on connected device / emulator
flutter build apk             # Android build
flutter build ios             # iOS build (macOS host)
flutter test                                    # All unit + widget tests
flutter test test/features/<path>_test.dart   # Single test file
flutter analyze               # Static analysis (analysis_options.yaml)
```

Stack: Flutter SDK ^3.7.2, Riverpod state, go_router navigation, Dio HTTP client, Hive local storage, `flutter_secure_storage` for JWT tokens. Reuses the same Fastify `/api/user-auth/*` endpoints as `tbt-user-web` — cookie/token auth patterns mirror the web client.

### Visual Regression (Percy + Playwright — from repo root)

`playwright.config.ts` at the repo root is a **Percy visual-regression setup**, not an e2e suite. It runs snapshot specs in `percy/` (`debug-screenshots.spec.ts`, `player-visual.spec.ts`) against `PERCY_BASE_URL` (defaults to production `https://app.tamilbusinesstribe.com`). Single-worker chromium project only; not part of CI gating.

```powershell
# Run Percy snapshots (from repo root)
.\run-percy.ps1                       # Wrapper script
npx playwright test --config=playwright.config.ts    # Direct invocation
```

## Architecture

### Authentication — Two Completely Different Systems

**Admin panel auth (Clerk):**
- `clerkPlugin` (`backend/src/plugins/clerk.ts`) decorates Fastify with `fastify.authenticate` — verifies Clerk JWTs, used as `preHandler` on all admin-protected routes. It sets **`request.user = verified.sub`** (the Clerk subject string, e.g. `"user_2abc..."`). There is NO `request.admin` object — it is never set. Admin controllers that need to attribute an action to an admin's DB record must look up by Clerk ID: `const admin = await req.server.prisma.admin.findFirst({ where: { clerkId: req.user } })`.
- `ClerkProvider` wraps root layout. `AuthInterceptor` in `admin-panel/components/Providers.tsx` registers an Axios request interceptor that calls `getToken()` (token cached until 8 s before its `exp` claim; falls back to 52 s if `exp` is unreadable) and attaches `Authorization: Bearer <token>` to every `apiClient` call
- Admin socket authenticates via Clerk token in `socket.handshake.auth.token`

**User web auth (custom JWT cookies):**
- `@clerk/nextjs` IS installed in user-web, but only for: the `app/(auth)/` Clerk-hosted route group and middleware auth-state detection. The main `/login` page and all backend API calls use custom JWT cookies — never Clerk JWTs or bearer tokens.
- `POST /api/user-auth/login` → phone + password → bcrypt check → OTP sent via WhatsApp (WABA) or SMS (MSG91) → `POST /api/user-auth/verify-otp` → issues `tbt_access` (15 min) + `tbt_refresh` (30 day) HttpOnly cookies
- Full user-auth route list: `POST /signup`, `POST /login`, `POST /forgot-password`, `POST /verify-otp`, `POST /set-password`, `POST /resend-otp`, `POST /refresh`, `POST /logout`, `DELETE /sessions` (revoke all sessions, requires `authenticateUser`), `GET /me` (requires `authenticateUser`), `GET /whatsapp-diagnostic` (CRON_SECRET header — support engineers only, no Clerk/member auth). Dev-only: `GET /dev-otp/:phone`.
- **OTP rate limits** — 60-second cooldown between sends to the same phone; 5 OTPs/hour cap per phone (both enforced in `backend/src/lib/otp.ts`). **Fails open on Redis errors** — a wedged Upstash must not lock users out. OTPs are also mirrored to an in-process `Map` as a resilience fallback (Upstash has intermittent ETIMEDOUT spikes in Cloud Run). The same Cloud Run instance that stored the OTP is likely to serve verify-otp (30-60 s later); if a cold-start routes the request to a new instance, the user taps Resend.
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
- **Route prefix convention:** `/api/<module>` — see `backend/src/server.ts:157–193` for the full ordered list. Non-obvious prefixes:
  - `hero` → `/api/hero-slides`
  - `security` → `/api/security-logs`
  - **`gamification` → `/api/tbt`** (not `/api/gamification`) — leaderboards, points, level/tier/badge reads
  - `webinar` → `/api/webinars`
  - `messages` (DM) is separate from `chat-groups` (group chat)
- **`user` module** (`backend/src/modules/user/`) — monolithic handler for ALL user-facing authenticated API routes at `/api/user/*`. Covers courses (user-facing), events, webinars, workshops, notifications, messages, dashboard, products, resources, conversations, search, programs, and profile. When adding new user-web backend routes, handlers go in `user/controller.ts` and the route in `user/routes.ts`.
- Backend uses ESM (`"type": "module"`), TypeScript compiled with `tsx` in dev and `tsc` for prod
- **Two auth middlewares:** `fastify.authenticate` (Clerk — admin routes) vs `fastify.authenticateUser` (JWT cookie — user-web routes)
- **Backend modules present:** `admin-notifications`, `admins`, `ads`, `ai`, `app-notifications`, `app-resources`, `auth`, `batches`, `chat-groups`, `community`, `config`, `content-sections`, `conversations`, `courses`, `dashboard`, `display-badges`, `ebooks`, `gamification`, `helpdesk`, `hero`, `location`, `masters`, `members`, `messages`, `notifications`, `onboarding`, `onboarding-meetings`, `podcasts`, `products`, `pub`, `rituals`, `security`, `tasks`, `tiers`, `upload`, `user`, `user-auth`, `user-batch`, `webinar`, `workshops`
- **Cache invalidation:** `backend/src/lib/cache.ts` exports `invalidateCache(redis, key)` — call after mutations that affect `useMe()` (e.g. member approve, plan change): `void invalidateCache(request.server.redis ?? null, \`me:${memberId}\`)`
- **Cron endpoints** — `/api/workshops/cron/generate-recurring`, `/api/cron/course-expiry-reminder`, `/api/cron/weekly-report`, and `/api/cron/monthly-report` bypass Clerk/JWT auth and instead require `x-cron-secret: <CRON_SECRET>` header. All other backend routes use standard auth middleware.
- **Public certificate verification** — `GET /api/pub/certificates/course/:certId` is unauthenticated; returns `{ memberName, courseTitle, completedAt }`. Served by the `pub` module and consumed by `app/verify/course/[certId]/page.tsx` (Server Component, `revalidate: 3600`).

### Frontend Structure (Admin Panel)
- **API client:** `admin-panel/lib/api/apiClient.ts` — Axios pointing to `NEXT_PUBLIC_API_URL`. Response interceptor unwraps `response.data`, so hooks receive `{ success, data, meta, error }` directly. Access lists as `data?.data || []`, total as `data?.meta?.total`.
- **TBT hooks:** `admin-panel/lib/hooks/useTbt.ts` — all TanStack Query hooks (202+ exports). Add new hooks to the bottom. Includes analytics hooks: `useAnalyticsOverview`, `useAtRiskMembers`, `useMemberWatchAnalytics` (used by `/analytics` page), live-call hooks (`useLiveCallAnalytics`, `useGetBreakoutRooms`, etc.), community/batch/tier/badge/notification/product/resource hooks, and 21 course-platform hooks (see Course Platform section below). Batch admin hooks: `useGetBatch`, `useListBatchDays`, `useUpsertBatchDay`, `useGetBatchProgress`, `useGetMemberProgress`, `useUpsertMemberProgress`, `useApproveBatchDay`, `useRejectBatchDay`, `useBulkApproveBatchDays`, `useGetBatchPending`, `useGetBatchBreaks`, `useApproveBreak`, `useRejectBreak`, `useGetBatchMemberAttendance`, `useUpsertBatchAttendance`, `useUpsertMemberBatchSettings`, `useBatchDayAnalytics`. Ads admin hooks: `useListAdCampaigns`, `useGetAdCampaign`, `useCreateAdCampaign`, `useUpdateAdCampaign`, `useUpdateAdCampaignStatus`, `useDuplicateAdCampaign`, `useDeleteAdCampaign`, `useAdCampaignAnalytics`, `useAdAnalyticsOverview`.
- **Admin hooks:** `admin-panel/lib/hooks/useAdmin.ts` — admins, `useGetPresignedUrl` (R2 presigned uploads), `useUploadImage` (direct buffer upload ≤100 MB), `useCreateBunnyVideo` (`POST /api/upload/bunny-video-create`), `useDeleteBunnyVideo` (`DELETE /api/upload/bunny-video/:videoId`)
- **Members hooks:** `admin-panel/lib/hooks/useMembers.ts` — `useGetMember`, `useListMembers` (accepts `status` filter), `useCreateMember`, `useApproveMember` (`POST /api/members/:id/approve`)
- **Tasks hooks:** `admin-panel/lib/hooks/useTasks.ts` — `useCreateTaskInitiative`, `useListTasks`, `useUpdateTask`, `useDeleteTask`, `useListBatchTasks`, `useCreateBatchTask`, `useUpdateBatchTask`, `useDeleteBatchTask`, `useReorderBatchTasks`, `useMigrateJsonTasks`, `useGetBatchSubmissions`, `useReviewTaskSubmission`, `useGetAllBatchTasks` (`GET /api/batches/:id/all-tasks` — program tasks + batch-inline tasks combined)
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
    episode/[workshopSlug]/[episodeId]/  # Workshop episode full-screen player
    watch/[episodeId]/                   # Standalone episode watch page
  login/            # Custom LoginScreen — DO NOT MODIFY
  signup/           # Self-registration form (SignupScreen) — DO NOT MODIFY
  verify/           # Phone/OTP verification step (post-signup)
  verify/course/[certId]/  # Public certificate verification page (Server Component, revalidate: 3600)
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
- `GET /api/pub/config/nav` → `NavItem[]` + `RightIcons` flags + `hiddenMenuKeys: string[]`
- `GET /api/pub/config/ui-strings` → `UiStrings`

Injects theme as CSS custom properties on `document.documentElement`. Exposes `hiddenMenuKeys: string[]` from context — `Navbar.tsx` checks this before rendering Community, Ebooks, Podcasts, Support, and top-bar icons. Admin settings page (`/settings/navigation` → "Header Menu Visibility" panel) persists toggles via `hidden_menu_keys JSONB` on `site_configs` and invalidates both `pub:site-config` and `pub:nav` Redis cache keys immediately on save.

**CRITICAL**: Every user-visible string must come from `uiStrings` (or `config`). Zero hardcoded label strings in `(platform)` pages.

### CSS Custom Properties (theme tokens)
User-web supports **light and dark themes**. `globals.css` defines `:root` (light defaults) and `.dark` (dark overrides). The `html` element toggles the `.dark` class based on user/system preference.

Runtime-injected by `SiteConfigProvider` — never hardcode these:
```
--color-accent       # primary CTA / brand color
--color-alert        # warning/alert
--color-success      # success state
--color-bg-primary   # page background (injected in dark; CSS fallback in light)
--color-bg-surface   # card / surface background (same)
```
Use `style={{ background: "var(--color-accent)" }}` or `color-mix(in srgb, var(--color-accent) 30%, transparent)` for tints.

Additional semantic tokens from `globals.css` (not API-injected — safe to use directly in CSS):
```
--color-text-normal / --color-text-secondary / --color-text-subtle  # text hierarchy
--color-surface-overlay / -xs / -md / -lg                           # overlay tints
--color-navbar-bg / --color-modal-bg / --color-notif-bg             # surface backgrounds
```

**Overlay text rule:** Text sitting on dark image/video/banner gradients must always be white. Use the `overlay-text` (headings) and `overlay-meta` (sub-text) CSS classes defined in `globals.css` — these force `color: #ffffff` with drop-shadow regardless of the active theme. Never use `text-foreground` or `color-text-normal` on dark overlay backgrounds.

`--color-locked: #4a4a4a` is the only static token (not from API).

### Real-time (User Web)
`lib/socket/client.ts` exports `getSocket(): Promise<Socket>` (lazy-connects, passes Clerk token from `localStorage`). `lib/socket/useSocket.ts` exports `useSocket()` → `{ socket, connected }`. Call `socket.on()` inside `useEffect`; clean up with `socket.off()`.

### Hook Files
- `lib/hooks/useConfig.ts` — `useHomeHero`, `useHomeSections`, `useMyWorkshops`, `useWorkshopDetail`, `useWorkshopFlow`, `useWorkshopQa` (polls at 15s), `useWorkshopAssignments`, `useEpisodePlayback`, `usePostEpisodeProgress`, `useUserProducts`, `useUserResources`
- `lib/hooks/useDashboard.ts` — `useDashboardStats`, `useContinueLearning`, `useWatchHistory` (accepts `{ page?, limit?, filter?: 'all'|'in_progress'|'completed' }`), `useNotifications`, `useMarkNotificationRead`, `useMarkAllNotificationsRead`, `useMessages`, `useMarkMessageRead`, `useMarkAllMessagesRead`
- `lib/hooks/useUser.ts` — `useMe` (returns `{ id, name, firstName, lastName, batchId, membershipPlan, status, ... }`), `useUpdateProfile`
- `lib/hooks/useBatchProgram.ts` — `useMyBatchProgram` (GET `/api/user-batch` — batch + days + progress + attendance + breaks), `useSaveBatchDraft` (PUT `/api/user-batch/:dayNumber`), `useSubmitBatchDay` (POST `/api/user-batch/:dayNumber/submit`), `useMarkAttendance` (POST `/api/user-batch/attendance` — `{ dayNumber, notes? }`), `useRequestBreak` (POST `/api/user-batch/break`), `useSpendCoins` (POST `/api/user-batch/spend-coins` — lifeline purchases; invalidates `["user","me"]` query key), `useDownloadBatchCertificate` (GET `/api/user-batch/certificate` — returns PDF blob, triggers browser download)
- `lib/hooks/useCourses.ts` — course platform hooks (user-facing): `useCourses`, `useCourse`, `useMyEnrollments`, `useEnrollCourse`, `useLessonProgress`, `useMarkLessonComplete` (has optimistic `onMutate`), `useSubmitCourseQuiz`, `useCourseXp`, `useCourseLeaderboard`, `useUserBadges`, `useCertificateEligibility`, `useRequestCourseAccess`, `useCourseCategories` (GET `/api/user/courses/categories`), `useReflections(courseId)` (GET reflections from backend), `useSaveReflection(courseId)` (POST reflection to backend — backs the `ReflectionModal`); backed by `lib/api/services/courses.service.ts`
- `lib/hooks/useEvents.ts` — events hooks; backed by `lib/api/services/events.service.ts`
- `lib/hooks/useAds.ts` — ad display logic: `useAdEngine` (fetches eligible ad, tracks impression/click/skip/close/complete). Backed by `lib/api/services/ads.service.ts`. Ad triggers live in `lib/ads/adTriggers.ts`; media pre-loading in `lib/ads/mediaRegistry.ts`; per-session frequency cap in `lib/ads/session.ts`; event batching in `lib/ads/trackingQueue.ts`.
- `lib/hooks/useRituals.ts` — `useRitualHabits` (GET `/api/rituals/habits`), `useRitualsButtonsConfig` (GET `/api/rituals/buttons`); backed by `lib/api/services/rituals.service.ts`
- `lib/hooks/useEbooks.ts` — `useEbookCategories`, `useFeaturedEbooks`, `useEbookBanners`, `useTrendingEbooks`, `useEbookLibrary`, `useEbook`, `useBookmarks`, `useToggleBookmark`, `useEbookProgress`, `useSubmitProgress`, `useContinueReading`, `useEbookReviews`, `useSubmitReview`, `useReadingStreak`, `useEbookAuthor`, `useHighlightsForBook`, `useAllHighlights`, `useCreateHighlight`, `useUpdateHighlight`, `useDeleteHighlight`
- `lib/hooks/usePodcasts.ts` — `usePodcastCategories`, `usePodcastEpisodes`, `usePodcastEpisode`, `useFeaturedPodcastSeries`, `usePodcastSeries`, `useContinueListening`, `useSubmitPodcastProgress`, `useMarkPodcastCompleted`
- `lib/hooks/useCommunity.ts` — community feed hooks (posts, comments, follow)
- `lib/hooks/useChatGroups.ts` — `useMyChatGroups`, `useChatGroup`, `useChatGroupMessages`, `useSendChatGroupMessage`, `useEditChatGroupMessage`, `useDeleteChatGroupMessage`; also exports `chatGroupKeys`, `isLocallyMuted`, `getLocalMuteState`, `setLocalMuteState`
- `lib/hooks/useSupport.ts` — helpdesk ticket hooks
- `lib/hooks/useOnboarding.ts` — `useOnboardingState`, `useOnboardingContent`, `useSaveOnboardingProgress`, `usePresignOnboardingDocument`, `useRegisterOnboardingDocument`, `useDeleteOnboardingDocument`, `usePresignProfilePhoto` (circular photo picker — presign → PUT to R2 → store `profilePhotoUrl`), `useSubmitOnboarding`
- `lib/hooks/useOnboardingMeetings.ts` — LiveKit verification meeting hooks for onboarding
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

`VerificationStatus` enum: `awaiting_kyc | under_review | verified | rejected | changes_requested`. Added as a second lifecycle alongside `MemberStatus` — drives the self-onboarding wizard state machine (see `SELF_ONBOARDING_SPECKIT.md`). `changes_requested` was added via `ALTER TYPE ... ADD VALUE IF NOT EXISTS` in `prisma.ts`. Two additional `Member` fields activated by this feature: `onboardingCompleted Boolean` (flips to `true` on final admin approval) and `onboardingReviewNote String?` (admin's change-request message shown to the member — separate from `notes`, which is admin-internal).

### Self-Onboarding KYC Wizard (in progress — backend partially implemented)
- **Backend** — `onboarding` module (`/api/onboarding`): member wizard CRUD (`GET/PATCH /api/onboarding`), KYC document presign + register/delete (`/api/onboarding/documents/*`), admin-authored content CRUD (`/api/onboarding/admin/content`), and `POST /api/onboarding/submit` (transitions member to `under_review`). Uses `KycDocument` Prisma model (dormant before this feature). Logic gated in `backend/src/lib/onboardingLogic.ts` (`canEditOnboarding`, `canSubmitOnboarding`, `checkOnboardingReadyToSubmit`). New `onboarding_content` table created via startup ALTER.
- **Backend** — `onboarding-meetings` module (`/api/onboarding-meetings`): LiveKit verification meetings — admin lifecycle (create/start/end/cancel/mute/remove) + member join/leave.
- **Security boundary** — `onboardingUpdateSchema` in `onboarding/schema.ts` is the whitelist of member-editable fields. Never accept `status`, `verificationStatus`, `batchId`, `membershipPlan`, or `password` from the member's own PATCH — those stay admin-only via `updateMemberSchema`.
- **KYC documents** — stored in `'kyc-documents'` R2 bucket (private, not public). The presigned URL handler already treats this bucket as private (`upload/controller.ts:136`).
- **Admin approve/reject/request-changes** — extend `POST /api/members/:id/approve`; new `POST /api/members/:id/reject` and `POST /api/members/:id/request-changes`. All three reuse the same socket + notification pattern as the existing approve handler.
- **`SubscriptionGate` exemption** — `pending + awaiting_kyc` must route to `/onboarding` (wizard), not the dead-end approval-wait screen. `pending + under_review | changes_requested` stays on the wait screen.
- **Web wizard features** — profile photo upload (circular picker, presign → R2 PUT, stores `profilePhotoUrl`); content steps are fully dynamic from DB (`onboarding_content` rows — not fixed stepKeys); `onboardingSubmittedAt` timestamp shown as relative "Submitted X days ago" in PendingReviewView; WhatsApp "Contact Support" button in RejectedView. Step navigation is index-driven from DB content count.
- **Spec docs** — `SELF_ONBOARDING_SPECKIT.md` (full backend + web + mobile spec); `tbt_app/ONBOARDING_SPECKIT.md` (14 Flutter fixes, Sprint 1 in progress).

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

### Notification Routing (`admin-panel/lib/utils/notificationRouter.ts`)
`resolveNotificationRoute(notification)` maps a notification's `type` + `metadata` to the correct admin route. Used by `NotifPanel` in `Topbar` on click: mark read → close dropdown → `router.push(route)`. Pages read the injected query param on mount and call `history.replaceState` to clear it:
- `member_pending` / `member_joined` → `/members/${memberId}` 
- `workshop_access_request` → `/workshops/${workshopId}`
- `course_access_request` → `/courses?open=${courseId}` — courses page auto-opens the detail panel
- `product_inquiry` → `/products?tab=inquiries` — products page auto-switches tab
- `day_submitted` → `/batches/${batchId}`
- `announcement` → `/app-notifications`
- (default) → `/dashboard`

`messages/page.tsx` also reads `?conversation=<id>` on mount and auto-opens that conversation (future-proofing for message-type notifications).

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

## Content Verticals Beyond Courses

Alongside courses and workshops, the platform ships four additional content verticals — each with its own admin page, user-web pages, and backend module. Common patterns (batch access via `batchIds Json?`/`visibility JSONB`, R2 upload for assets, activity-log unification) apply throughout.

### Ebooks (`/api/ebooks`)
Managed digital library. Admin page: `admin-panel/app/ebooks/`. User pages: `app/(platform)/ebooks/` (library, series, reader with bookmarks + highlights + notes) and `app/ebook/` (public preview + share). Features: series (multi-part), managed author profiles, publisher metadata (ISBN, language, publisher), ratings + reviews with admin moderation, trending row + view count, reading streak (header badge), per-book "who bookmarked" viewer, bulk CSV import, pin-at-position + pin-until scheduling, scheduled publish date enforcement, per-batch access control, per-book analytics tab.

### Podcasts (`/api/podcasts`)
Admin page: `admin-panel/app/podcasts/`. User pages: `app/(platform)/podcasts/` (home, series, player). Includes a **persistent mini-player** at the platform layout level so audio survives navigation.

### Community (`/api/community`)
Social feed inside the platform: composer, feed, comments, follow. Admin page: `admin-panel/app/community/`. User pages: `app/(platform)/community/`.

### Rituals (`/api/rituals`)
Daily habit / streak module. Admin page: `admin-panel/app/rituals/`. Backend controller + routes only (no `schema.ts`). User-web: `MorningRitualCard` component rendered on the dashboard between the welcome section and stats — collapsible, with progress bars, Yes/Not Yet habit answers, and a completion state. Hooks: `useRitualHabits` (GET `/api/rituals/habits`) and `useRitualsButtonsConfig` (GET `/api/rituals/buttons`) in `lib/hooks/useRituals.ts`.

### Group Chat — Chat Groups (`/api/chat-groups`) — WhatsApp parity
Group chat (distinct from DM `/api/messages`). Admin page: `admin-panel/app/groups/` — edit-group modal, members roster, announcement-only toggle. User pages: `app/(platform)/messages/` (unified with DM). Phase 5 features: **voice notes, forward, pin, star, mute, DM media, reply-jump, @mentions, presence, in-group search, FCM push, read receipts, media, replies**. Flutter port lives in `tbt_app/lib/features/chat/`.

**WhatsApp-parity roadmap** — `tbt_app/CHAT_GROUP_SPECKIT.md` tracks F-01 – F-22. Status: Sprints 1+2 committed (F-01/02/03/04/07/08); Sprint 3 in progress (uncommitted) — F-05/06/11/12/15; Sprint 6 done (uncommitted) — F-17/18/19/21. Remaining P1: F-09–F-14, F-16. P2 done: F-17/18/19/21. P2 remaining: F-20, F-22. New DB columns (startup ALTER): `chat_group_messages.link_preview JSONB` (F-06), `chat_group_message_reads.read_at TIMESTAMPTZ` (F-07), `chat_groups.disappearing_duration_seconds INT` (F-18). New admin backend route: `PATCH /api/chat-groups/admin/:id/disappearing` (F-18). New member-scoped routes: `POST/DELETE /api/chat-groups/:id/messages/:messageId/pin` (F-03), `GET /api/chat-groups/:id/messages/:messageId/info` (F-07), `GET /api/chat-groups/:id/media` (F-15). New BullMQ job: `tbt-disappearing-messages` (hourly sweep, `jobs/disappearingMessages.ts`). `geolocator: ^13.0.2` added to pubspec (F-21).

**Raw-SQL UUID casts required** — every raw-SQL UUID parameter in `chat-groups/controller.ts` must be cast to `::uuid` (see commit `e3a5590f`). Missing the cast produces a Postgres type error at runtime.

### Helpdesk / Support (`/api/helpdesk`)
Support ticketing. Admin page: `admin-panel/app/support/`. User pages: `app/(platform)/support/` (list tickets, submit feedback, ticket detail with chat). Tickets carry `priority` (`low | medium | high | urgent`, default `medium`), `preferredContact` (optional), and `attachmentUrls` (array — multi-attachment). Older clients sending a single `attachmentUrl` are merged server-side; do not remove the legacy field from the schema.

### Advertisement Campaigns (`/api/ads`)
Admin-managed ad campaigns served to members and guests. Admin page: `admin-panel/app/ads/`. Admin routes live at `/api/ads/admin/*` (Clerk auth); client routes at `/api/ads/*` (optional-auth — guests allowed, memberId null = anonymous). User-web: `lib/hooks/useAds.ts` + `lib/ads/` (adTriggers, mediaRegistry, session, trackingQueue). Key client calls: `GET /api/ads/eligible` → returns next ad, `POST /api/ads/:token/impression|click|complete|skip|close`. Campaign status transitions go through `useUpdateAdCampaignStatus` — the backend enforces an activation gate before going live. Socket event `ads:campaign_invalidated` is broadcast globally (no room) when a campaign is paused/archived/deleted mid-flight.

**Ad trigger timing** (`lib/ads/adTriggers.ts` — `useAdTriggers(fire)`): three trigger types fire `fire(triggerType)`:
- `app_launch` — once per component mount, 1,200 ms delay. All eligibility/display decisions are in the orchestrator, not here.
- `route_enter` — on each unique path change, 600 ms debounce (absorbs redirect chains); skipped on the very first render (handled by `app_launch`).
- `timed_interval` — every 30,000 ms; skips hidden tabs. Also fires on `visibilitychange → visible` to catch campaigns that started/ended while the tab was backgrounded.

**Eligibility engine** (`backend/src/modules/ads/eligibility.ts`) is pure (no Prisma, no `new Date()`, no I/O — `now` is passed in). Unit-tested via Vitest. Do not add I/O to this file; widen the input types in the controller instead.

### AI Content (`/api/ai`)
Admin-only AI content generation. Admin page: `admin-panel/app/ai-content/`. Backend uses `claudeService.ts` + `usageGuard.ts` (per-admin usage rate limiting). Uses `claude-haiku-4-5` via Anthropic API (requires `ANTHROPIC_API_KEY`).

### Gamification (`/api/tbt` — NOT `/api/gamification`)
Points ledger, tiers, levels, badges, leaderboards. All member points now unify around the `tbt_activity_log` ledger table (see commit `8d349739`). The DDL for `tbt_activity_log` in `prisma.ts` must be split into per-statement `$executeRawUnsafe` calls (see `91d46316` for why a single multi-statement call fails).

### Masters (`/api/masters`)
Shared lookup data (categories, tags, dropdown options). Controller + routes only.

---

## Session & Auth Persistence

**No auto-logout.** Commit `524c003e` removed ALL auto-logout code paths from user-web and mobile — sessions persist until explicit manual sign-out. The AuthInterceptor must NOT redirect to `/login` on any 401/403 mid-session (see `c742c325` — refresh cookie must not be clobbered, and `a5621083` — no auto-logout on refresh 401/403). When adding new interceptors or auth guards, verify they don't reintroduce forced sign-out.

---

## Course Platform (`TBT_Course_Platform_Spec.md` — completed 2026-06-24)

### Data Model — Key Distinctions
- **`CourseAccess`** — authorization record (who is allowed). Separate from `CourseEnrollment` (progress tracking). A member needs a valid `CourseAccess` row to access a course; `CourseEnrollment` is created automatically on first lesson view.
  - `accessType`: `"lifetime"` (valid while `isActive=true`) or `"duration"` (valid while `isActive=true` AND `expiresAt > now()`)
  - Unique constraint: `(memberId, courseId)`
- **`CoursePayment`** — payment ledger record. `method`: `"manual" | "razorpay" | "bank_transfer" | "upi" | "free" | "external"`. Approved by admin via `POST /api/courses/:id/payments/:paymentId/approve`.
- **`MemberXP`** — XP ledger. `source`: `"episode_complete" | "quiz_pass"`. Amount comes from `course.xpPerEpisode`.
- **`CourseBadge`** — manually awardable badge per course. Admin awards via `POST /api/courses/:id/badges/:badgeId/award`.

### Extended Fields (via startup `ALTER TABLE`)
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
  timer_seconds INT            -- per-lesson focus timer (null = use global taskTimerSeconds from site config)

products:
  price DECIMAL(10,2)
  currency VARCHAR(10) DEFAULT 'INR'
  category VARCHAR(100)
  stock_status VARCHAR(50) DEFAULT 'in_stock'

app_resources:
  description TEXT             -- added via startup ALTER TABLE
  visibility JSONB             -- { batchIds: string[] } for batch access restriction
  course_episode_id UUID FK    -- links resource to a specific course episode (ON DELETE CASCADE)

site_configs:
  login_bg_images JSONB        -- array of background image URLs for login page
  hidden_menu_keys JSONB       -- array of menu key strings to hide (managed via /settings/navigation)

member_episode_progress:
  watched_segments TEXT        -- serialized segment ranges for DRM tracking

tasks:
  timer_seconds INT            -- per-task focus timer (null = use global taskTimerSeconds from site config)
  course_episode_id UUID FK    -- links task to a specific course episode (ON DELETE CASCADE)
```

### Admin Hooks (`useTbt.ts`)
`useListVodCourses`, `useCreateVodCourse`, `useUpdateVodCourse`, `useDeleteVodCourse`, `useListCourseEpisodes`, `useCreateCourseEpisode`, `useUpdateCourseEpisode`, `useDeleteCourseEpisode`, `useReorderCourseEpisodes`, `useListCourseAccess`, `useGrantCourseAccess`, `useRevokeCourseAccess`, `useListCoursePayments`, `useApproveCoursePayment`, `useCourseAnalyticsAdmin`, `useCourseLeaderboardAdmin`, `useListCourseBadges`, `useCreateCourseBadge`, `useUpdateCourseBadge`, `useDeleteCourseBadge`, `useAwardCourseBadge`

Per-episode resources and tasks (added 2026-08-26): `useListEpisodeResources`, `useCreateEpisodeResource`, `useUpdateEpisodeResource`, `useDeleteEpisodeResource`, `useReorderEpisodeResources`, `useListEpisodeTasks`, `useCreateEpisodeTask`, `useUpdateEpisodeTask`, `useDeleteEpisodeTask`, `useReorderEpisodeTasks`

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
GET/POST /api/courses/episodes/:eid/resources
PUT/DELETE /api/courses/episodes/:eid/resources/:rid
PUT /api/courses/episodes/:eid/resources/reorder
GET/POST /api/courses/episodes/:eid/tasks
PUT/DELETE /api/courses/episodes/:eid/tasks/:tid
PUT /api/courses/episodes/:eid/tasks/reorder
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
19. **Video player is HLS-first, iframe fallback** — The workshop player (`workshop/[slug]/page.tsx`), course player (`learning/[courseId]/page.tsx`), and standalone episode player (`(player)/episode/[workshopSlug]/[episodeId]/page.tsx`) all use the same two-tier pattern:
    - If `episode.hlsUrl` is set (and HLS hasn't errored): render `<PlyrPlayer>` (`components/features/video/PlyrPlayer.tsx` — Plyr + hls.js, lazy-imported). Use `ref={playerRef}` (type `PlyrPlayerHandle`) to read `.currentTime` and `.duration` imperatively. Props: `hlsUrl`, `startAt`, `speed`, `autoplay`, `onReady(duration)`, `onTimeUpdate(currentTime)`, `onPlay`, `onPause`, `onEnded`, `onSpeedChange`, `onError`. Set `hlsFailed=true` in `onError` to trigger iframe fallback.
    - Otherwise: render Bunny `<iframe>` and use postMessage. `timeupdate`, `pause`, and `ended` fire **automatically** without subscribing. `play` does NOT fire on autoplay — detect via `getCurrentTime`/`isPaused` responses after `ready`. `value.seconds` = playhead; `value.duration` = real duration (use on first message).
    The backend sets `videoType: 'hls' | 'iframe'` alongside `hlsUrl` to indicate which path applies.
20. **`BUNNY_CDN_URL` env var lacks `https://`** — stored as bare hostname (e.g., `tamil-business-tribe-cdn.b-cdn.net`). The controller normalizes it, but if writing new HLS URL construction elsewhere always use: `` `${(env.BUNNY_CDN_URL.startsWith('http') ? env.BUNNY_CDN_URL : `https://${env.BUNNY_CDN_URL}`).replace(/\/$/, '')}/${bunnyId}/playlist.m3u8` ``
21. **`tsx watch` may not hot-reload** — the backend dev server (`npm run dev:backend`) uses `tsx watch` which doesn't reliably detect all file changes. After editing files in `backend/src/`, kill and restart the process if API behaviour doesn't change after saving.
22. **Course player gamification layer** (`learning/[courseId]/page.tsx`) — three client-only features, all localStorage:
    - **Cue quizzes**: `firedCuesRef` (a `Set<string>`, reset on lesson switch) tracks which `cue.id`s have fired. `cueQuizActiveRef` (boolean ref) prevents re-triggering while modal is open. Flow: `handleVideoProgress` checks `quizData.cues` sorted by `atSeconds` → calls `pausePlayerRef.current()` → calls `document.exitFullscreen()` first if in fullscreen → sets `cueQuizModal`. `handleCloseCueQuiz` clears both refs.
    - **Reflection modal** (`ReflectionModal`): fires 1.2 s after a lesson completes, but only when `!lesson.hasQuiz && justCompletedInSessionRef.current === true` (quiz-bearing lessons skip it; already-done lessons skip it). Saved to the backend via `useSaveReflection` (C-11 — no longer localStorage-only); also cached in `localStorage["tbt_reflections"]` as `{ [courseId:lessonId]: { text, savedAt, lessonTitle } }`. UI strings: `reflectTitle`, `reflectPromptPrefix`, `reflectPromptSuffix`, `reflectPlaceholder`, `reflectSkipLabel`, `reflectSaveLabel`, `reflectSavedLabel`.
    - **Practice Arena modal** (`PracticeArenaModal`): pulls `(lesson as any).quizData?.questions` from all lessons in the course query, shuffles them into interleaved practice. No XP, no backend call.
    - **XP flash** — `xpFlashedRef` (`useRef<string | null>(null)`) tracks the last lessonId that triggered the XP animation, preventing double-fires when both the completion path and the quiz-pass path run for the same lesson. Non-quiz lessons flash on `watchState === 'completed'`; quiz lessons flash on quiz pass. Reset to `null` on lesson switch.
    - **localStorage keys**: `tbt_cr_${courseId}` — completion timestamps `{ [lessonId]: timestampMs }`. `tbt_reflections` — global across all courses. `tbt_speed` — persisted playback speed.
    - **`Lesson` type does not include `quizData`** — the TypeScript interface in `types/index.ts` omits it; access as `(lesson as any).quizData` wherever needed.
23. **Batch program `totalDays` is dynamic** — `totalDays = batch.program.durationDays + memberBatchSettings.extendedDays`. Never hardcode 90. `useMyBatchProgram` response now includes `totalDays`, `attendance` (array of `{ dayNumber, status, notes, markedAt }`), and `breaks` (array of break requests). Day objects include a `category` string field.
24. **`WatchHistoryItem` and `ContinueLearningItem` are unified** — both types now carry `type: "workshop" | "course"` as a discriminator (in `tbt-user-web/types/index.ts`). Workshop items include `workshopSlug`/`workshopTitle`; course items include `courseId`/`courseTitle`. Dashboard "Recently Watched" and "Continue Watching" sections render both types from a single merged list — don't branch the hook calls or filter by content type.
25. **`batches.xp_per_day` is a raw SQL column** — not in Prisma schema; added via idempotent `ALTER TABLE batches ADD COLUMN IF NOT EXISTS xp_per_day INT NOT NULL DEFAULT 50` in `prisma.ts` startup. Reading: after `prisma.batch.findMany/findUnique`, run a supplementary `$queryRawUnsafe` and merge `xpPerDay` via object map. Writing (create/update): **destructure `xpPerDay` out of the body before spreading into `prisma.batch.create/update`** (Prisma throws "Unknown field" otherwise), then persist via `$executeRawUnsafe('UPDATE batches SET xp_per_day=$1 WHERE id=$2', xpPerDay, id)`. Default fallback: `xpRow?.xp_per_day ?? 50`. On approve, `approveDayHandler` / `bulkApproveDaysHandler` fetch `xp_per_day` from the DB (once, before any loop) and use it for `pointsLedger` + socket emit `batch:day_approved` + notification text. Similarly, `batches.status` (VARCHAR, default `'active'`) and `batches.snapshot_days` (INT, nullable) are raw SQL columns added at startup — destructure them before spreading into Prisma and persist separately.
26. **`task_steps` table does not exist in production** — do NOT include `step: true` or `steps: true` in any Prisma `task.findMany/findUnique` `include` block. The `task_steps` table has no startup `CREATE TABLE` SQL and was never migrated, so a JOIN against it causes a Postgres error → 500 on any task endpoint. The `Task` model has a `stepId` foreign-key field (nullable) but the related table is absent; treat steps as a soft reference only.
27. **Uploaded images are auto-converted to WebP** — `backend/src/modules/upload/controller.ts` uses `sharp` to convert JPEG/PNG/WebP/GIF to WebP (quality 85, animated GIF preserved) before writing to R2. The stored filename gets a `.webp` extension regardless of the original. Body limit for image endpoints is 50 MB. No client-side format guard is needed — accept `accept="image/*"` in file inputs; the backend normalises everything.
28. **Several tables exist only as raw SQL — not in Prisma schema** — `member_attendance`, `batch_break_requests`, `member_batch_settings`, `product_inquiries`, `admin_notifications` are created entirely via `$executeRawUnsafe` in `prisma.ts` startup. There are no Prisma models for them; all reads/writes must use `$queryRawUnsafe` / `$executeRawUnsafe`. Never attempt `prisma.memberAttendance.findMany()` — it will fail with "does not exist on type PrismaClient".
29. **Task unification — `tasks.batch_id` now nullable FK** — the startup SQL added `batch_id UUID REFERENCES batches(id)` to `tasks` and made `program_id` nullable. `task_submissions` gained `batch_id`, `day_progress_id`, `day_number` columns. The old global unique constraint `(member_id, task_id)` was replaced by two day-scoped partial indexes: one for batch tasks `(member_id, task_id, batch_id, day_number)` and one for program tasks `(member_id, task_id) WHERE batch_id IS NULL`. Batch-inline tasks (batch_id set, program_id null) and program tasks (program_id set, batch_id null) are differentiated by which FK is populated.
30. **Gamification route prefix is `/api/tbt`** — the `gamification` module registers under `/api/tbt`, not `/api/gamification`. Reads for leaderboards, points, tier/badge/level all live there. Do not create a parallel `/api/gamification` prefix.
31. **`chat-groups` raw SQL requires `::uuid` casts on every UUID param** — see commit `e3a5590f`. Missing the cast throws a Postgres type error at runtime. Example: `$queryRawUnsafe('SELECT ... WHERE id = $1::uuid', groupId)`.
32. **`tbt_activity_log` DDL must be split into per-statement calls** — see commit `91d46316`. A single multi-statement `$executeRawUnsafe` for this table fails; split into one call per SQL statement in the `prisma.ts` startup block.
33. **No auto-logout on 401/403** — do NOT add "redirect to `/login` on session expiry" logic to AuthInterceptors in user-web or mobile. Commit `524c003e` intentionally removed all auto-logout paths; sessions persist until manual sign-out. The refresh cookie must never be clobbered by an interceptor (see `c742c325`).
34. **Focus timer gamification** — Both batch tasks and course episodes support an optional per-item focus timer. `tasks.timer_seconds` and `course_episodes.timer_seconds` are raw SQL columns (INT, nullable) added at startup. `null` means fall back to the global `taskTimerSeconds` site config value. Behavior: a focus dialog appears on first task/lesson click showing the timer duration; a countdown badge shows during the session; the item locks when the timer expires without completion; 3 free lifelines are granted per session; additional lifelines cost 50 TBT coins via coin spend. When writing create/update handlers for tasks or episodes, destructure `timerSeconds` and persist via `$executeRawUnsafe` rather than spreading into Prisma (same pattern as `batches.xp_per_day`).
35. **`(req as any).admin` does not exist in admin controllers** — `fastify.authenticate` (Clerk) sets `request.user` (Clerk subject string), never `request.admin`. Writing `(req as any).admin?.id` will always be `undefined`. To get the admin's DB record: `const admin = await req.server.prisma.admin.findFirst({ where: { clerkId: req.user } })`.
36. **`live:*` socket rooms are webinar-only** — Members join `live:{id}` only by emitting `join:live` in the webinar player. Workshop live-call events must be emitted to individual `user:{memberId}` rooms (not `live:{liveCallId}`). Emitting to `live:*` from a workshop context drops silently because no workshop participant ever joins that room.
37. **`useSpendCoins` query key must be `["user", "me"]`** — the mutation invalidates `["user","me"]` so the coin balance in `useMe()` refreshes after a lifeline purchase. Using `['me']` (the old key) causes the balance to stay stale in the UI until the next full page load.

## Socket Events

Admin panel uses `getAdminSocket()` from `admin-panel/lib/socket/client.ts` (singleton, lazy-connects).
User web uses `getSocket()` (async/lazy) from `tbt-user-web/lib/socket/client.ts` and the `useSocket()` hook.

Socket.IO rooms and the events each room receives:

| Room | Events emitted |
|---|---|
| `'admin'` | `admin:member_joined`, `admin:member_pending`, `admin:member_approved`, `admin:product_inquiry`, `admin:workshop_access_request`, `admin:course_access_request`, `chat:conversation_new`, `chat:unread_ping`, `admin:day_submitted` (`{ memberId, batchId, dayNumber }`) |
| `user:{memberId}` | `notification`, `message:new`, `workshop:enrolled`, `workshop:removed`, `live_call:lock`, `live_call:admitted`, `live_call:poll`, `live:reminder`, `batch:day_approved` (`{ dayNumber, batchId, xpAwarded }`), `course:access_granted` (`{ courseId }`) |
| `workshop:{slug}` | `qa:new_question`, `qa:new_reply` |
| `live:{webinarId}` | `live:started`, `live:ended`, `live:attendee_count` |
| `conversation:{id}` | `chat:message`, `chat:typing`, `chat:conversation_closed`, `chat:conversation_reopened` |
| `chat-group:{groupId}` | `chat-group:message`, `chat-group:typing`, `chat-group:reaction`, `chat-group:read`, `chat-group:member_update` |
| broadcast | `notification:broadcast`, `ads:campaign_invalidated` (`{ campaignId, reason }`) |

Client joins workshop/live rooms by emitting `join:workshop` / `leave:workshop` and `join:live` / `leave:live`. Redis pub/sub adapter is attached to Socket.IO for cross-instance broadcast (commit `c5187846`).

**Presence (`presence:update`)** — emitted globally on connect/disconnect. Payload: `{ memberId, online: boolean, lastSeenAt: ISO string }`. `last_seen_at` is also persisted to the `members` table (raw SQL column added at startup) on disconnect and at cold-start bulk-load. In-memory map tracks socket count per member so a second tab opening does not flip presence to offline.

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
| MSG91 | SMS OTP fallback (`MSG91_AUTH_KEY/SENDER_ID/TEMPLATE_ID` in env; `backend/src/lib/msg91.ts`) |
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

Two separate Cloud Run services, two separate branches:

| Branch | Backend service | Notes |
|---|---|---|
| `main` | `tbt-backend-staging` | Staging backend; auto-deploy when `tbt-admin/backend/**` changes |
| `production` | `tbt-backend` | Production backend (`--min-instances=1`); auto-deploy when `tbt-admin/backend/**` changes |

- **Admin Frontend → Vercel** — auto-deploy on push to `main`; root dir `tbt-admin/admin-panel`. The Vercel project's `NEXT_PUBLIC_API_URL` points to the **production** Cloud Run service.
- **User Web → Vercel** — separate project; custom domain `https://app.tamilbusinesstribe.com`
- **To promote staging → production:** `git push origin main:production`
- **`prisma db push`** runs against `PROD_DATABASE_URL` in **both** CI jobs (staging and production) — so the production DB schema always tracks `main` even before a production backend deploy.
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

### Self-Onboarding KYC Wizard (`SELF_ONBOARDING_SPECKIT.md`) — 🔄 In Progress (started 2026-08-18)
Backend `onboarding` and `onboarding-meetings` modules merged. Frontend wizard (user-web `/onboarding/`, Flutter `onboarding_screen.dart`) and admin review UI (members page extensions) are under active implementation. Check `tbt_app/ONBOARDING_SPECKIT.md` for Flutter sprint status. `WEB_MOBILE_PARITY_2026-07-14.md` at repo root documents the overall web ↔ mobile feature gap baseline.

### Additional Verticals Shipped (2026-Q3)
- **Ebooks** — full library with series, authors, publisher metadata, ratings + moderation, reviews, reading streak, per-batch access, per-book analytics, CSV import, pin scheduling, share/public preview, highlights + notes
- **Podcasts** — home, series, player with persistent mini-player at platform layout level
- **Community feed** — feed, composer, comments, follow (ported to user-web from mobile)
- **Support/Helpdesk** — tickets, chat, feedback (`/support`)
- **Chat Groups (WhatsApp parity Phase 5)** — voice notes, forward, pin, star, mute, DM media, reply-jump, @mentions, presence, in-group search, FCM push, read receipts, media, replies. Web + Flutter parity.
- **Activity log unification** — all member points now flow through `tbt_activity_log` ledger
- **Advertisement campaign system** — admin CRUD + analytics (`/api/ads/admin/*`); client eligibility + tracking (`/api/ads/*`, optional-auth). Web + mobile clients. Campaigns broadcast `ads:campaign_invalidated` on pause/archive/delete.
- **Presence tracking** — `last_seen_at` persisted to DB on disconnect; bulk cold-start restore on server boot. Emits global `presence:update` events.
- **Helpdesk improvements** — priority field, preferred contact, member replies in ticket chat, multi-attachment support.
- **No auto-logout** — sessions persist until manual sign-out on web and mobile
- **Batch reports** — weekly/monthly WhatsApp progress reports for batch members. Backend: pure logic in `backend/src/lib/batchReportLogic.ts` (28 unit tests); orchestration in `batchReports.ts`; BullMQ cron queue `tbt-batch-reports` (weekly Sun 21:30 IST = `0 16 * * 0` UTC; monthly fires daily at `30 15 * * *` UTC and no-ops on non-last days). Admin Clerk routes: `GET /api/batches/reports/history`, `GET /api/batches/reports/preview`, `POST /api/batches/reports/send-test`. Admin hooks in `useTbt.ts`: `useReportDeliveryHistory`, `usePreviewBatchReport`, `useSendTestBatchReport`. Admin page: `admin-panel/app/batch-reports/`. Optional env vars: `WABA_WEEKLY_REPORT_TEMPLATE_NAME`, `WABA_MONTHLY_REPORT_TEMPLATE_NAME` (both optional; falls back to plain-text WhatsApp message). `WhatsappMessage` Prisma model gained four startup-ALTER columns: `reportType`, `reportPeriod`, `providerMessageId`, `failureReason`.
