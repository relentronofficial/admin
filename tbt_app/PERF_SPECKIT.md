# Mobile App Performance Speckit

Root-cause plan for the "app feels slow while using it" report. Findings from the 2026-07-31 audit against `tbt_app/`. Fix ordering is deliberate — item 1 kills a whole class of bugs at once and should be shipped first.

---

## 1. Root Cause Summary

**Primary**: Riverpod providers are bypassed by direct `dio.get(...)` calls and by ad-hoc `initState` fetches. The single-source-of-truth providers (`meNotifierProvider` in particular) exist but are ignored, so every screen refetches the same data.

**Evidence** — one profile screen open produces this HTTP trace:

```
GET /api/user/me                (×7)
GET /api/tbt/leaderboard        (×2)
GET /api/user/me/connections
GET /api/user/me/posts
GET /api/user/notifications/preferences
GET /api/user/my-devices
GET /api/tbt/path
```

**Secondary — backend amplification**: `getMeHandler` triggers `recalculateMemberStats` → `computeMemberStats` (`backend/src/lib/tbtStats.ts`) → 4 backfill INSERTs. The 60-second Redis throttle is a race — 7 concurrent requests all pass `SET NX` before the key materialises, resulting in **28 INSERTs on a single profile visit**.

**Tertiary**:
- Dashboard hydrates sections serially instead of in parallel.
- Startup pre-fetch omits `meNotifierProvider`; first paint waits on it.
- Bare `CachedNetworkImage` calls without `memCacheWidth`/`memCacheHeight` in several list/carousel contexts.
- Non-`.builder` `ListView` with dynamic children in three screens renders all items upfront.

---

## 2. Fix List

### P0-1 — Dio in-flight request dedup interceptor
**Kills the whole class of duplicate-fetch bugs at the transport layer. Ship this first.**

**File**: `tbt_app/lib/shared/api/dio_client.dart` (new interceptor + registration)

**Behaviour**:
- Interceptor keeps `Map<String, Future<Response>>` keyed by `method + URL + serialised query`.
- On `onRequest` for `GET`: if the key exists, resolve with the pending response (via `handler.resolve` after `await`); else register the future, proceed, and clear the map entry in `onResponse` / `onError`.
- Only GET; skip when a request-scoped `noDedup: true` extra flag is set (for future edge cases).

**Acceptance**:
- Fire 5 simultaneous `dioProvider.get('/api/user/me')` calls → exactly one network request in the logs, all 5 futures resolve with the same body.
- No behavioural change on POST/PUT/PATCH/DELETE.
- Post-fix log for a profile visit shows `/api/user/me` **once** (not seven times).

**Estimated impact**: eliminates 6 of the 7 duplicate `/me` calls and both duplicate `/tbt/leaderboard` calls without touching any consumer.

**Risk**: low. Read-only. Interceptor sits before AuthInterceptor so refresh flow is unaffected.

---

### P0-2 — Route stats/raw-profile through `meNotifierProvider`
**Even with dedup, the consumers should share the cached provider so `getMe()` isn't re-fetched on every profile section mount.**

**Files**:
- `tbt_app/lib/features/profile/data/profile_extras_service.dart:127` — `profileStatsProvider`
- `tbt_app/lib/features/profile/providers/profile_provider.dart:39` — `fetchRawProfile`

**Change**:
1. Extend `authServiceProvider.getMe()` (or add a sibling `getRawMe()`) that returns the raw JSON map plus the typed `Member` — the extra fields (`currentStreak`, `totalPoints`, `businessName`, etc.) are already in the wire response and are just dropped by `Member.fromJson`.
2. Change `meNotifierProvider` to keep both — expose `raw` alongside `Member`.
3. `fetchRawProfile(ref)` becomes `ref.read(meNotifierProvider.future).then((m) => m.raw)`.
4. `profileStatsProvider` reads `currentStreak` + `totalPoints` from the cached raw payload and only fires `myConnectionsProvider` for the count.

**Acceptance**:
- Pull-to-refresh on Profile invalidates `meNotifierProvider` and both `profileStatsProvider` + all `fetchRawProfile` consumers get the new data.
- HTTP log for profile open (with P0-1 also applied) shows: 1× `/me`, 1× `/me/connections`, 1× `/me/posts`, 1× `/my-devices`, 1× `/notifications/preferences`, 1× `/tbt/path` — **no duplicates**.

**Risk**: medium. Touching `MeNotifier`'s return shape ripples to all `meNotifierProvider` consumers. Mitigate by keeping `Member` as the primary shape and attaching raw as a lazy field.

---

### P0-3 — Parallel dashboard hydration + startup prefetch
**Removes the first-paint waterfall.**

**Files**:
- `tbt_app/lib/main.dart:62-76` — startup Future.wait
- `tbt_app/lib/features/dashboard/presentation/dashboard_screen.dart:28-31`

**Change**:
1. Add `ref.read(meNotifierProvider.future)` into the startup `Future.wait([...])` that already blocks on config/nav/uiStrings. First paint of any authenticated screen finds the member cached.
2. In `DashboardScreen.initState`, kick off `Future.wait([dashboardStatsProvider.future, continueLearningProvider.future, homeHeroProvider.future])` so the three sections start fetching in parallel instead of on-mount serially.
3. Keep `ref.watch(...)` on each provider in `build` for reactivity — the pre-warm just seeds the cache.

**Acceptance**:
- Cold app → login → time from route change to dashboard first paint measurably drops (target: -500 ms on a fast network, more on slow).
- Dashboard sections light up ~simultaneously instead of top-down.
- Pull-to-refresh on dashboard invalidates all four (`me`, `dashboardStats`, `continueLearning`, `homeHero`).

**Risk**: low. Purely additive prefetching.

---

### P0-4 — Backend per-member recalc lock
**Stops the 28-INSERT storm even if the client still fans out.**

**Files**:
- `tbt-admin/backend/src/lib/tbtStats.ts` (or a new `lib/singleflight.ts`)
- `tbt-admin/backend/src/modules/user/controller.ts:131` (call site)

**Change**:
- Introduce a per-process `Map<string, Promise<void>>` keyed by `memberId`. `recalculateMemberStats(memberId)` first checks the map — if a promise exists, `await` it and return; otherwise set the map entry to a fresh promise, run the compute, and delete the entry in a `finally`.
- The existing Redis throttle stays (protects cross-instance and long-window); the in-memory lock closes the single-instance race window.

**Acceptance**:
- 10 concurrent `/api/user/me` requests on a cold Redis cache → exactly one `syncLegacyPointsToLedger` execution in the logs (4 INSERTs total, not 40).
- Existing throttle behaviour unchanged: subsequent calls within 60 s still short-circuit.
- No functional change to point/streak values.

**Risk**: low. In-process locks are cheap and self-clearing. Only affects the recalc path.

---

### P1-1 — Memory-bound bare `CachedNetworkImage` usages
**File**: audit `tbt_app/lib/features/community/**`, `tbt_app/lib/features/podcasts/**`, `tbt_app/lib/features/ebooks/**` for direct `CachedNetworkImage(...)` calls that don't pass `memCacheWidth`/`memCacheHeight`.

**Change**: replace each with `AppNetworkImage` (`lib/shared/widgets/app_network_image.dart`) which already sizes correctly, or add explicit `memCacheWidth: <target dp>` inline.

**Acceptance**: dev tools memory profile on a Community feed scroll drops noticeably (baseline vs. after).

---

### P1-2 — Convert non-`.builder` ListViews to `.builder`
**Files**:
- `tbt_app/lib/features/community/presentation/saved_posts_screen.dart`
- `tbt_app/lib/features/ai_content/presentation/ai_saved_content_screen.dart` (if present)
- Any `ListView(children: [...])` with a dynamic list — search with `Grep`.

**Change**: replace `ListView(children: items.map(...).toList())` with `ListView.builder(itemCount: items.length, itemBuilder: (_, i) => ...)`.

**Acceptance**: scrolling a 50-item saved list stays at 60fps on the V2319.

---

### P1-3 — Dashboard pull-to-refresh completeness
**File**: `tbt_app/lib/features/dashboard/presentation/dashboard_screen.dart:77-80`

**Change**: refresh callback should invalidate `meNotifierProvider` and `homeHeroProvider` too, not just stats + continue-learning.

**Acceptance**: pull-to-refresh after changing your name in Profile now updates the greeting on Dashboard without re-launching.

---

### P1-4 — Stop `HomeHeader` from re-watching `meNotifierProvider`
**File**: `tbt_app/lib/features/dashboard/presentation/widgets/home_header.dart:222`

**Change**: `HomeHeader` accepts a `Member` param from `DashboardScreen` instead of watching `meNotifierProvider` itself. Removes a duplicate rebuild subscription.

**Acceptance**: no behaviour change; Riverpod DevTools shows one fewer subscription to `meNotifierProvider`.

---

## 3. Out of Scope (for now)

- Refactoring `MembershipCard`'s tilt/flip animations (P2 audit item — visible only on old devices).
- Backend N+1 hunting beyond `computeMemberStats` (nothing else called from the mobile hot path shows obvious N+1).
- Migrating from Riverpod code-gen to plain providers or vice versa.
- Splitting the profile edit sheet's `fetchRawProfile` call site count (drops to 1 automatically after P0-1 or P0-2).

---

## 4. Verification Plan

Run in this order after each P0 lands:

1. **Fresh `flutter run` on V2319**, log in from a cold state.
2. **Cold profile open** — grep `flutter` output for `HTTP] --> GET /api/user/me` and confirm count matches expectation (P0-1: 1, P0-2: 1, P0-3: 1 pre-warmed + 0 mount-time).
3. **Backend Cloud Run logs** — after profile open, grep for `syncLegacyPointsToLedger` INSERT lines. Should be ≤4 per member per 60 s window (P0-4).
4. **Dashboard cold paint** — time from route change to first sections rendered. Compare against baseline (record before P0-3).
5. **Regression**: TBT Points screen (dynamic data), Profile stats tiles (Daily Streak / Connections / TBT Points), pull-to-refresh on both screens all still update correctly.

---

## 5. Fix Order & Rough Sizing

| # | Fix | Effort | Impact |
|---|-----|--------|--------|
| P0-1 | Dio dedup interceptor | 30 min | eliminates 6+ duplicate GETs per profile visit; app-wide |
| P0-2 | Route `stats` + `raw` through `meNotifierProvider` | 30 min | reinforces P0-1, correct provider hygiene |
| P0-3 | Parallel dashboard hydration + startup prefetch | 20 min | -500 ms to -2 s first paint |
| P0-4 | Backend recalc singleflight lock | 15 min | -24 INSERTs per profile-open storm |
| P1-1 | Bare `CachedNetworkImage` audit + fix | 30 min | memory pressure on lists |
| P1-2 | Convert 3 ListViews to `.builder` | 15 min | scroll fps on saved lists |
| P1-3 | Dashboard refresh callback completeness | 5 min | correctness |
| P1-4 | `HomeHeader` prop-drilling | 5 min | one fewer subscription |

Total: ~2h 30m of implementation, deployable in a single commit per fix.
