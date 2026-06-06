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

### Route Groups
```
app/
  (auth)/           # Clerk-hosted sign-in/sign-up pages — DO NOT MODIFY
  (marketing)/      # Public landing page
  (platform)/       # All member pages — Navbar + SubscriptionGate in layout
  (player)/         # Full-screen video player — bare layout, no Navbar
  login/            # Custom login page (LoginScreen component)
  loading/          # Splash screen — auto-redirects to /tbt
```

`/eiflix` and `/eiflix/:path*` permanently redirect to `/tbt` and `/tbt/:path*` (see `next.config.ts`).

### Auth Flow
1. Unauthenticated users hitting protected routes → middleware redirects to `/login?redirect_url=<path>`
2. `LoginScreen` reads `?redirect_url` and navigates there after `setActive`
3. If already signed in on `/login`, auto-redirects to `redirect_url` immediately

**Critical env vars** (must match `Providers.tsx` config):
```
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/tbt
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/tbt
```
Clerk **env vars override `ClerkProvider` props** — if these are wrong, logins silently redirect to the wrong page.

### API Client (`lib/api/client.ts`)
- Axios instance pointing to `NEXT_PUBLIC_API_URL` (default `http://localhost:8000`)
- Response interceptor **unwraps** `response.data` — hooks receive `{ success, data, meta, error }` directly
- `initApiClient(getToken)` is called once in `Providers.tsx`'s `AuthInterceptor` when `isSignedIn` becomes true. Hooks must NOT call `getToken` themselves.
- `getCachedToken()` polls up to 600 ms for `initApiClient` to be called — handles the React render-cycle race between `SubscriptionGate`'s first query and `AuthInterceptor`'s `useEffect`.
- `getServerNow()` — use instead of `Date.now()` for any countdown or time display (avoids client clock skew).

### `SiteConfigProvider` (`lib/context/SiteConfigContext.tsx`)
Fetches 3 unauthenticated endpoints on app load: `/api/pub/config/site`, `/api/pub/config/nav`, `/api/pub/config/ui-strings`. Injects CSS custom properties on `document.documentElement`.

**CRITICAL**: Every user-visible string must come from `uiStrings`. Zero hardcoded label strings in `(platform)` pages.

### CSS Theme Tokens
Injected at runtime — never use hardcoded color values for these:
```
--color-accent        # primary CTA / brand
--color-alert         # warning
--color-success       # success
--color-bg-primary    # page background
--color-bg-surface    # card / surface
```
Use `style={{ background: "var(--color-accent)" }}` or `color-mix(in srgb, var(--color-accent) 30%, transparent)` for tints.

`--color-locked: #4a4a4a` is the only static token (not from API).

### `SubscriptionGate` (`app/(platform)/SubscriptionGate.tsx`)
Wraps all `(platform)` children. Reads `useMe()` and redirects to `/Products` if `me.subscription` is missing or expired. `/Products` and `/profile` are exempt.

### Hook Files
- `lib/hooks/useConfig.ts` — `useHomeHero`, `useHomeSections`, `useMyWorkshops`, `useWorkshopDetail`, `useWorkshopFlow`, `useWorkshopQa`, `useWorkshopAssignments`, `useEpisodePlayback`, `usePostEpisodeProgress`, `useUserProducts`, `useUserResources`
- `lib/hooks/useDashboard.ts` — `useDashboardStats`, `useContinueLearning`, `useNotifications`, `useMarkNotificationRead`, `useMarkAllNotificationsRead`, `useMessages`, `useMarkMessageRead`, `useMarkAllMessagesRead`
- `lib/hooks/useUser.ts` — `useMe`, `useUpdateProfile`
- `lib/hooks/useCourses.ts`, `lib/hooks/useEvents.ts` — supplementary hooks

### Video Progress Pattern
Used in any component that embeds video playback (30 s periodic POST):
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
1. **`useRef` requires an initial value** (React 19) — use `useRef<T | undefined>(undefined)`, never `useRef<T>()`
2. **`refetchQueries` in TanStack Query v5** — use `predicate: (q) => q.state.status === 'error'`, not `{ status: 'error' }`
3. **No hardcoded strings** — every user-facing label from `uiStrings`
4. **No hardcoded colors for theme tokens** — use `var(--color-accent)` etc.
5. **Login page is off-limits** — never modify `app/login/page.tsx` or `app/(auth)/`
6. **`SubscriptionGate` is already in the platform layout** — don't add subscription checks in individual pages
7. **NEVER use the word "EiFlix"** in user-facing code or strings — use "TBT"
