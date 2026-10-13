# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev         # Next.js dev server (Turbopack, port 3001)
npm run build       # Production build
npm run typecheck   # tsc --noEmit  ← run before/after any edit
npm run lint
npm run format      # prettier --write .
```

## Architecture

**NEVER use the word "EiFlix"** in user-facing code or string literals. Use "TBT".

### Route Groups
```
app/
  (auth)/           # Clerk-hosted sign-in/sign-up pages — DO NOT MODIFY
  (marketing)/      # Public unauthenticated pages: landing, /events, /programs
  (platform)/       # All member pages — Navbar + SubscriptionGate in layout
    community/      # Home page (default landing after login as of 2026-10)
    dashboard/      # Member dashboard
    discover/       # Content catalog (previously /tbt)
    workshops/      # Workshop list
    workshop/[id]/  # Workshop detail + flow + Q&A + live calls (monolithic page)
    learning/       # Course progress overview; /learning/badges
    learning/[courseId]/           # Course lesson list + player
    courses/        # Course catalog
    events/         # Events; /events/[id]
    programs/       # Programs; /programs/[id]
    batch-program/  # /batch-program/[day]
    live/[webinarId]# In-session webinar
    search/         # Global search
    notifications/  # Notification center
    messages/       # Chat messages (DM + group chat unified)
    Products/       # Exempt from SubscriptionGate
    Resources/      # Downloadable resources
    history/        # Watch history
    profile/        # Exempt from SubscriptionGate
  (player)/         # Full-screen video player — bare layout, no Navbar/Footer
    episode/[workshopSlug]/[episodeId]/  # Workshop episode full-screen player
    watch/[episodeId]/                   # Standalone episode watch page
  login/            # Custom LoginScreen — DO NOT MODIFY
  signup/           # Self-registration (SignupScreen) — DO NOT MODIFY
  verify/           # Phone/OTP verification step (post-signup)
  verify/course/[certId]/  # Public certificate verification — Server Component, revalidate: 3600
  loading/          # Standalone splash
```

`/eiflix` and `/tbt` (and their `:path*` variants) permanently redirect to `/discover` (see `next.config.ts`).

### Auth (custom JWT cookies)
- `POST /api/user-auth/login` → phone + password → OTP (WhatsApp) → `POST /api/user-auth/verify-otp` → issues `tbt_access` (15 min) + `tbt_refresh` (30 day) HttpOnly cookies
- Axios instance uses `withCredentials: true` — cookies sent automatically
- 401 interceptor calls `/api/user-auth/refresh` and retries (skipped for `/api/user-auth/` paths)
- `initApiClient()` in `lib/api/client.ts` is a **no-op stub** — do not add bearer token logic
- `@clerk/nextjs` is only used for the `(auth)/` route group and middleware auth-state detection; all actual login uses cookies
- **No auto-logout** — never add "redirect to /login on 401/403" logic to interceptors. Sessions persist until manual sign-out.

**Critical Clerk env vars** (wrong values silently redirect logins to the wrong page):
```
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/community
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/community
```

### API Client (`lib/api/client.ts`)
- Axios instance → `NEXT_PUBLIC_API_URL`, `withCredentials: true`
- Response interceptor unwraps `response.data` — hooks receive `{ success, data, meta, error }` directly
- `getServerNow()` — use instead of `Date.now()` for countdowns (avoids client clock skew)
- `tbt_device_id` generated in `localStorage` on first load (multi-device security detection)

### `SiteConfigProvider` (`lib/context/SiteConfigContext.tsx`)
Fetches 3 unauthenticated endpoints in parallel on app load:
- `GET /api/pub/config/site` → `SiteConfig` (theme, logos, splash)
- `GET /api/pub/config/nav` → `NavItem[]` + `RightIcons` flags + `hiddenMenuKeys: string[]`
- `GET /api/pub/config/ui-strings` → `UiStrings`

Injects theme as CSS custom properties on `document.documentElement`.

**CRITICAL**: Every user-visible string must come from `uiStrings` (or `config`). Zero hardcoded label strings in `(platform)` pages.

### CSS Theme Tokens
Supports **light and dark themes**. `globals.css` defines `:root` (light defaults) and `.dark` (dark overrides). `SiteConfigProvider` injects accent/alert/success in both modes.

Runtime-injected — never hardcode:
```
--color-accent        # primary CTA / brand
--color-alert         # warning
--color-success       # success
--color-bg-primary    # page background
--color-bg-surface    # card / surface
```
Use `style={{ background: "var(--color-accent)" }}` or `color-mix(in srgb, var(--color-accent) 30%, transparent)` for tints.

Additional semantic tokens from `globals.css` (safe to use directly):
```
--color-text-normal / --color-text-secondary / --color-text-subtle
--color-surface-overlay / -xs / -md / -lg
--color-navbar-bg / --color-modal-bg / --color-notif-bg
```

**Overlay text rule:** Text on dark image/video/banner gradients must always be white. Use `overlay-text` (headings) and `overlay-meta` (sub-text) CSS utility classes from `globals.css` — they force `color: #ffffff` with drop-shadow regardless of theme. Never use `text-foreground` or `color-text-normal` on dark gradients.

`--color-locked: #4a4a4a` is the only static token.

### `SubscriptionGate` (`app/(platform)/SubscriptionGate.tsx`)
Reads `useMe()`:
1. `me.status === 'pending'` → `PendingInterceptor` overlay (click-blocker, sign-out only)
2. No active subscription AND `membershipPlan === 'free'` → `FreeInterceptor` overlay (upgrade prompt)
3. Paid `membershipPlan` (admin-assigned) bypasses interceptors even without a `Subscription` DB row

Paths `["/Products", "/profile"]` are exempt.

### Hook Files

New hooks belong in a `lib/api/services/*.service.ts` file; hooks call the service, not `apiClient` directly.

- **`lib/hooks/useConfig.ts`** — `useHomeHero`, `useHomeSections`, `useMyWorkshops`, `useWorkshopDetail`, `useWorkshopFlow`, `useWorkshopQa` (polls at 15s), `useWorkshopAssignments`, `useEpisodePlayback`, `usePostEpisodeProgress`, `useUserProducts`, `useUserResources`

- **`lib/hooks/useDashboard.ts`** — `useDashboardStats`, `useContinueLearning`, `useWatchHistory` (accepts `{ page?, limit?, filter?: 'all'|'in_progress'|'completed' }`), `useNotifications`, `useMarkNotificationRead`, `useMarkAllNotificationsRead`, `useMessages`, `useMarkMessageRead`, `useMarkAllMessagesRead`

- **`lib/hooks/useUser.ts`** — `useMe` (returns `{ id, name, firstName, lastName, batchId, membershipPlan, status, ... }`), `useUpdateProfile`, `useUserSupportQuota` (GET `/api/user/support-quota` — returns `{ techSupport, adSupport, groupCall, callCredits, oneToOne }` each with `allocated/used/remaining`), `useCreditPricing` (GET `/api/user/credits/pricing`), `usePurchaseCredit` (POST `/api/user/credits/purchase`), `useMyCreditPurchases` (GET `/api/user/credits/purchases`)

- **`lib/hooks/useBatchProgram.ts`** — `useMyBatchProgram` (GET `/api/user-batch` — returns batch + days + progress + `totalDays` + `attendance[]` + `breaks[]` + `lifelinesTotal/Used/Remaining`), `useSaveBatchDraft`, `useSubmitBatchDay`, `useMarkAttendance`, `useRequestBreak`, `useSpendCoins` (coin-based lifeline purchase — invalidates `["user","me"]`), `useUseProgramLifeline` (POST `/api/user-batch/lifeline/use`), `useDownloadBatchCertificate`

- **`lib/hooks/useCourses.ts`** — `useCourses`, `useCourse`, `useMyEnrollments`, `useEnrollCourse`, `useLessonProgress`, `useMarkLessonComplete` (optimistic `onMutate`), `useSubmitCourseQuiz`, `useCourseXp`, `useCourseLeaderboard`, `useUserBadges`, `useCertificateEligibility`, `useRequestCourseAccess`, `useCourseCategories`, `useCourseModuleTabs` (GET `/api/user/courses/module-tabs` → `[{ title }]`), `useReflections(courseId)`, `useSaveReflection(courseId)`, `useLessonFeedback(courseId)`, `useSaveLessonFeedback(courseId)`, `useGetMyStreakPoints` (GET `/api/user/streak-points` → `{ total, videoTotal, taskTotal, history }`)

- **`lib/hooks/useEvents.ts`** — events hooks

- **`lib/hooks/useAds.ts`** — `useAdEngine` (fetches eligible ad, tracks impression/click/skip/close/complete). Triggers: `app_launch` (1,200 ms delay on mount), `route_enter` (600 ms debounce on path change), `timed_interval` (every 30 s).

- **`lib/hooks/useRituals.ts`** — `useRitualHabits`, `useRitualsButtonsConfig`

- **`lib/hooks/useEbooks.ts`** — library, series, reader, bookmarks, highlights, progress, reviews, streak, author, bulk reading operations

- **`lib/hooks/usePodcasts.ts`** — categories, episodes, series, continue-listening, progress

- **`lib/hooks/useCommunity.ts`** — community feed hooks (posts, comments, follow)

- **`lib/hooks/useChatGroups.ts`** — `useMyChatGroups`, `useChatGroup`, `useChatGroupMessages`, `useSendChatGroupMessage`, `useEditChatGroupMessage`, `useDeleteChatGroupMessage`; exports `chatGroupKeys`, `isLocallyMuted`, `getLocalMuteState`, `setLocalMuteState`

- **`lib/hooks/useSupport.ts`** — helpdesk ticket hooks

- **`lib/hooks/useOnboarding.ts`** — `useOnboardingState`, `useOnboardingContent`, `useSaveOnboardingProgress`, `usePresignOnboardingDocument`, `useRegisterOnboardingDocument`, `useDeleteOnboardingDocument`, `usePresignProfilePhoto`, `useSubmitOnboarding`

- **`lib/hooks/useCourseReports.ts`** — `useMyEpisodeFeedback(episodeId)`, `useSubmitEpisodeFeedback()`

### Zustand Stores (`lib/stores/`)
- `useAuthStore` — login state, OTP flow step
- `usePlayerStore` — episode playback state
- `useUIStore` — global UI toggles

### Video Player (HLS-first, iframe fallback)
Both workshop (`workshop/[slug]/page.tsx`) and course (`learning/[courseId]/page.tsx`) use:
- **`PlyrPlayer`** (`components/features/video/PlyrPlayer.tsx`) when `episode.hlsUrl` is set and HLS hasn't errored. Ref type: `PlyrPlayerHandle`. Props: `hlsUrl`, `startAt`, `speed`, `autoplay`, `onReady(duration)`, `onTimeUpdate(currentTime)`, `onPlay`, `onPause`, `onEnded`, `onSpeedChange`, `onError`. Set `hlsFailed=true` in `onError` to fall through to iframe.
- **Bunny iframe fallback** when `hlsUrl` is null or HLS failed. `timeupdate`, `pause`, `ended` fire automatically. `play` does NOT fire on autoplay — detect via `getCurrentTime`/`isPaused` after `ready`. `value.seconds` = playhead; `value.duration` = real duration (use on first message).

Backend sets `videoType: 'hls' | 'iframe'` alongside `hlsUrl`.

### Video Progress Pattern (30s periodic POST)
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
// On "Complete": set completedRef.current = true BEFORE the mutation
```

### Key Pitfalls
1. **No hardcoded strings** — every user-facing label from `uiStrings` or `config`
2. **No hardcoded colors for theme tokens** — use `var(--color-accent)` etc.
3. **`getServerNow()`** instead of `Date.now()` for countdowns
4. **`initApiClient` is a no-op** — do not add bearer token logic to user-web hooks
5. **`SubscriptionGate` is in platform layout** — don't add subscription/pending checks in individual pages
6. **Login/signup pages are permanently off-limits** — never modify `app/login/page.tsx`, `app/(auth)/`, or `app/signup/page.tsx`
7. **`useRef` requires an initial value** (React 19) — `useRef<T | undefined>(undefined)`, never `useRef<T>()`
8. **`refetchQueries` predicate in TanStack Query v5** — `predicate: (q) => q.state.status === 'error'`, not `{ status: 'error' }`
9. **`WatchHistoryItem` and `ContinueLearningItem` are unified** — both carry `type: "workshop" | "course"` discriminator. Don't fork hook calls or filter by content type.
10. **`totalDays` is dynamic** — `useMyBatchProgram` returns `totalDays` (base + extended). Never hardcode 90.
11. **Sequential lesson unlock is server-computed** — each lesson in `course.lessons[]` carries `locked: boolean` from the backend. Never gate with HTML `disabled` attribute (disabled buttons can't fire `onClick` for a locked toast). No auto-advance/auto-play after completion (removed 2026-09).
12. **`lessonAlreadyDone` uses exactly 3 signals** — `completedIds.has(lessonId)`, `!!isCompleted`, `actualWatchedSecs >= durationSeconds * 0.85`. No position proximity heuristic. If `true`, `markCalledRef.current` is pre-set, silently blocking all completion POSTs for the session.
13. **`BUNNY_CDN_URL` env var lacks `https://`** — normalize: `` `${(env.BUNNY_CDN_URL.startsWith('http') ? env.BUNNY_CDN_URL : `https://${env.BUNNY_CDN_URL}`).replace(/\/$/, '')}/${bunnyId}/playlist.m3u8` ``
14. **`quizData` has two layers** — end-of-video: `{ questions: [...] }` (gated by `quizUnlockPercent`); mid-video cues: `{ questions: [...], cues: [{ id, atSeconds, questions }] }`. `hasQuiz` is `true` only when `questions.length > 0`. `Lesson` type in `types/index.ts` does NOT include `quizData` — access as `(lesson as any).quizData`.
15. **`useSpendCoins` query key** — must invalidate `["user","me"]` (not `['me']`) so coin balance refreshes after lifeline purchase.
16. **Server-side episode timer vs MG-04 client hint** — `lesson_timer_sessions` (API: `/api/user/episodes/:id/timer/{start,session,heartbeat}`) is the enforcement layer. `member_episode_progress.timer_started_at` is only the early-completion bonus hint. Never conflate them.
17. **Per-episode lifelines vs program-wide lifelines** — per-episode: `useEpisodeLifeline` / `GET /api/user/episodes/:id/lifelines`; program-wide: `useUseProgramLifeline` / `POST /api/user-batch/lifeline/use`. Two separate systems.
18. **ReflectionModal saves to backend** (via `useSaveReflection`) — also cached in `localStorage["tbt_reflections"]`. Fires 1.2 s after completion when `!lesson.hasQuiz && justCompletedInSessionRef.current`. PracticeArena and cue quizzes are client-only.
