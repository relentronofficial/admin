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
    dashboard/      # Member home
    tbt/            # Content catalog
    workshops/      # Workshop list
    workshop/[id]/  # Workshop detail + flow + Q&A + live calls (monolithic page)
    learning/       # Course progress overview; /learning/badges
    learning/[courseId]/           # Course lesson list + player
    learning/[courseId]/[lessonId] # (unused — lesson player is inline in [courseId])
    courses/        # Course catalog
    events/         # Events; /events/[id]
    programs/       # Programs; /programs/[id]
    batch-program/  # /batch-program/[day]
    live/[webinarId]# In-session webinar
    search/         # Global search
    notifications/  # Notification center
    messages/       # Chat messages
    Products/       # Exempt from SubscriptionGate
    Resources/      # Downloadable resources
    history/        # Watch history
    profile/        # Exempt from SubscriptionGate
  (player)/         # Full-screen video player — bare layout, no Navbar/Footer
  login/            # Custom LoginScreen — DO NOT MODIFY
  signup/           # Self-registration (SignupScreen) — DO NOT MODIFY
  verify/           # Phone/OTP verification step
  loading/          # Standalone splash
```

`/eiflix` and `/eiflix/:path*` permanently redirect to `/tbt` and `/tbt/:path*` (see `next.config.ts`).

### Auth (custom JWT cookies)
- `POST /api/user-auth/login` → phone + password → OTP (WhatsApp) → `POST /api/user-auth/verify-otp` → issues `tbt_access` (15 min) + `tbt_refresh` (30 day) HttpOnly cookies
- Axios instance uses `withCredentials: true` — cookies sent automatically
- 401 interceptor calls `/api/user-auth/refresh` and retries (skipped for `/api/user-auth/` paths)
- `initApiClient()` in `lib/api/client.ts` is a **no-op stub** — do not add bearer token logic
- `@clerk/nextjs` is only used for the `(auth)/` route group and middleware auth-state detection; all actual login uses cookies

**Critical Clerk env vars** (wrong values silently redirect logins to the wrong page):
```
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/tbt
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/tbt
```

### API Client (`lib/api/client.ts`)
- Axios instance → `NEXT_PUBLIC_API_URL`, `withCredentials: true`
- Response interceptor unwraps `response.data` — hooks receive `{ success, data, meta, error }` directly
- `getServerNow()` — use instead of `Date.now()` for countdowns (avoids client clock skew)
- `tbt_device_id` generated in `localStorage` on first load (multi-device security detection)

### `SiteConfigProvider` (`lib/context/SiteConfigContext.tsx`)
Fetches 3 unauthenticated endpoints in parallel on app load:
- `GET /api/pub/config/site` → `SiteConfig` (theme, logos, splash)
- `GET /api/pub/config/nav` → `NavItem[]` + `RightIcons` flags
- `GET /api/pub/config/ui-strings` → `UiStrings`

Injects theme as CSS custom properties on `document.documentElement`.

**CRITICAL**: Every user-visible string must come from `uiStrings` (or `config`). Zero hardcoded label strings in `(platform)` pages.

### CSS Theme Tokens (injected at runtime — never hardcode)
```
--color-accent        # primary CTA / brand
--color-alert         # warning
--color-success       # success
--color-bg-primary    # page background
--color-bg-surface    # card / surface
```
Use `style={{ background: "var(--color-accent)" }}` or `color-mix(in srgb, var(--color-accent) 30%, transparent)` for tints. `--color-locked: #4a4a4a` is the only static token.

### `SubscriptionGate` (`app/(platform)/SubscriptionGate.tsx`)
Reads `useMe()`:
1. `me.status === 'pending'` → `PendingInterceptor` overlay (click-blocker, sign-out only)
2. No active subscription AND `membershipPlan === 'free'` → `FreeInterceptor` overlay (upgrade prompt)
3. Paid `membershipPlan` (admin-assigned) bypasses interceptors even without a `Subscription` DB row

Paths `["/Products", "/profile"]` are exempt.

### Hook Files
- `lib/hooks/useConfig.ts` — `useHomeHero`, `useHomeSections`, `useMyWorkshops`, `useWorkshopDetail`, `useWorkshopFlow`, `useWorkshopQa` (polls at 15s), `useWorkshopAssignments`, `useEpisodePlayback`, `usePostEpisodeProgress`, `useUserProducts`, `useUserResources`
- `lib/hooks/useDashboard.ts` — `useDashboardStats`, `useContinueLearning`, `useWatchHistory` (accepts `{ page?, limit?, filter?: 'all'|'in_progress'|'completed' }`), `useNotifications`, `useMarkNotificationRead`, `useMarkAllNotificationsRead`, `useMessages`, `useMarkMessageRead`, `useMarkAllMessagesRead`
- `lib/hooks/useUser.ts` — `useMe`, `useUpdateProfile`
- `lib/hooks/useBatchProgram.ts` — `useMyBatchProgram` (GET `/api/user-batch`), `useSaveBatchDraft` (PUT `/api/user-batch/:dayNumber`), `useSubmitBatchDay` (POST `/api/user-batch/:dayNumber/submit`)
- `lib/hooks/useCourses.ts` — `useCourses`, `useCourse`, `useMyEnrollments`, `useEnrollCourse`, `useLessonProgress`, `useMarkLessonComplete` (optimistic `onMutate`), `useSubmitCourseQuiz`, `useCourseXp`, `useCourseLeaderboard`, `useUserBadges`, `useCertificateEligibility`, `useRequestCourseAccess`
- `lib/hooks/useEvents.ts` — events hooks

New hooks: create or extend a `lib/api/services/*.service.ts` file rather than calling `apiClient` directly from the hook.

### Zustand Stores (`lib/stores/`)
- `useAuthStore` — login state, OTP flow step
- `usePlayerStore` — episode playback state
- `useUIStore` — global UI toggles

### Video Player (HLS-first, iframe fallback)
Both workshop (`workshop/[slug]/page.tsx`) and course (`learning/[courseId]/page.tsx`) use:
- **`PlyrPlayer`** (`components/features/video/PlyrPlayer.tsx`) when `episode.hlsUrl` is set and HLS hasn't errored. Ref type: `PlyrPlayerHandle` (`{ currentTime: number; duration: number }`). Props: `hlsUrl`, `startAt`, `speed`, `autoplay`, `onReady(duration)`, `onTimeUpdate(currentTime)`, `onPlay`, `onPause`, `onEnded`, `onSpeedChange`, `onError`. Set `hlsFailed=true` in `onError` to fall through to iframe.
- **Bunny iframe fallback** when `hlsUrl` is null or HLS failed. `timeupdate`, `pause`, `ended` fire automatically without subscribing. `play` does NOT fire on autoplay — detect via `getCurrentTime`/`isPaused` after `ready`. `value.seconds` = playhead; `value.duration` = real duration (use on first message).

Backend sets `videoType: 'hls' | 'iframe'` alongside `hlsUrl` to indicate the expected player.

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
9. **`req.memberId` not `req.member`** — `fastify.authenticateUser` sets `request.memberId: string`; there is NO `request.member` object
10. **`WatchHistoryItem` and `ContinueLearningItem` are unified** — both carry `type: "workshop" | "course"` as a discriminator. Don't fork the hook calls or filter by content type.
11. **`lessonAlreadyDone` uses exactly 3 signals** — `completedIds.has(lessonId)`, `!!isCompleted`, `actualWatchedSecs >= durationSeconds * 0.85`. No position proximity heuristic. If it returns `true`, `markCalledRef.current` is pre-set, silently blocking all completion POSTs for the session.
12. **`BUNNY_CDN_URL` env var lacks `https://`** — normalize with `` `${(env.BUNNY_CDN_URL.startsWith('http') ? env.BUNNY_CDN_URL : `https://${env.BUNNY_CDN_URL}`).replace(/\/$/, '')}/${bunnyId}/playlist.m3u8` ``
13. **Course `quizData` has two layers** — end-of-video quiz: `{ questions: [...] }` (gated by `quizUnlockPercent`); mid-video cues: `{ questions: [...], cues: [{ id, atSeconds, questions: [...] }] }`. `hasQuiz` is `true` only when `questions.length > 0`; cues alone do not set it. `Lesson` type in `types/index.ts` does NOT include `quizData` — access as `(lesson as any).quizData`.
14. **Course player gamification is localStorage-only** — `ReflectionModal` fires 1.2 s after completion for lessons where `hasQuiz === false` and `justCompletedInSessionRef.current === true`. `PracticeArenaModal` is entirely client-side (shuffled questions from course data, no XP/backend). Cue quizzes: `firedCuesRef` tracks fired cue IDs (reset per lesson); `cueQuizActiveRef` blocks re-triggering. LocalStorage keys: `tbt_cr_${courseId}` (completion timestamps), `tbt_reflections` (global reflections keyed `courseId:lessonId`), `tbt_speed` (playback speed).
