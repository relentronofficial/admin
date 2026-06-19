# Mobile Lighthouse Performance — Implementation Spec Kit

**Target:** 95+ on Lighthouse Mobile (throttled Moto G4 / slow-4G)  
**Current state:** Desktop scores well; mobile scores low  
**Scope:** `tbt-user-web/` only — no backend or admin changes  

---

## Implementation Order

Dependencies flow top-to-bottom. Items with no dependency on each other can be
done in parallel. All 13 tickets are independent changes — none breaks any other.

```
[PERF-01] Remove Geist Mono font            ← trivial, do first
[PERF-02] Delete no-op middleware           ← trivial, do second
[PERF-03] Add CDN preconnects              ← low-risk, layout.tsx only
[PERF-04] backdrop-filter mobile fix       ← CSS only, Navbar + drawer
[PERF-05] Hero video — mobile skip         ← TbtClient.tsx only
[PERF-06] Hero video — poster + preload    ← TbtClient.tsx only (same file as PERF-05, do together)
[PERF-07] Defer socket.io connection       ← Navbar.tsx only
[PERF-08] Increase unread-count staleTime  ← useDashboard.ts only
[PERF-09] Logo/avatar dimensions           ← Navbar.tsx (same session as PERF-07)
[PERF-10] Dashboard raw <img> fix          ← dashboard/page.tsx only
[PERF-11] scroll-behavior reduced-motion   ← globals.css only
[PERF-12] drop-shadow on hero <h2>         ← TbtClient.tsx (same file as PERF-05/06)
[PERF-13] ResizeObserver for scroll rows   ← TbtClient.tsx (same file, do last in this file)
```

Suggested grouping for PRs:
- **PR-A (trivial):** PERF-01, PERF-02, PERF-11  
- **PR-B (layout.tsx):** PERF-03  
- **PR-C (Navbar.tsx):** PERF-04, PERF-07, PERF-09  
- **PR-D (TbtClient.tsx):** PERF-05, PERF-06, PERF-12, PERF-13  
- **PR-E (hooks + dashboard):** PERF-08, PERF-10  

---

---

## PERF-01 — Remove unused Geist Mono font

| Field | Value |
|---|---|
| **File** | `app/layout.tsx` |
| **Lines** | 2, 15–18, 75 |
| **Metrics** | FCP ↓ (eliminates one fonts.gstatic.com request) |
| **Risk** | None — confirmed unused across all component files |

### BEFORE

```tsx
// Line 2
import { Inter, Geist_Mono } from "next/font/google";

// Lines 15–18
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Line 75
className={`${inter.variable} ${geistMono.variable} antialiased min-h-screen bg-background`}
```

### AFTER

```tsx
// Line 2
import { Inter } from "next/font/google";

// Lines 15–18 — DELETE ENTIRELY

// Line 75
className={`${inter.variable} antialiased min-h-screen bg-background`}
```

### Gotchas
- Grep for `geist-mono`, `font-mono`, `var(--font-geist-mono)` across `app/` and `components/` before
  deleting to confirm no usage was added since this analysis.
- `tailwind.config.ts` has `mono: ["var(--font-geist-mono)", "monospace"]` in `fontFamily` — that
  entry can stay harmlessly (it falls back to `monospace`) or be cleaned up at the same time.

### Acceptance Criteria
- [ ] Build passes with no TypeScript errors
- [ ] No Lighthouse request to `fonts.gstatic.com` for a Geist Mono file
- [ ] Visual diff: zero change to any page appearance

---

---

## PERF-02 — Delete no-op middleware

| Field | Value |
|---|---|
| **File** | `middleware.ts` (entire file) |
| **Lines** | 1–15 (whole file) |
| **Metrics** | TTFB ↓ (eliminates edge function invocation on every request) |
| **Risk** | None — the comment inside the file explicitly explains it is intentionally a no-op |

### BEFORE (entire file)

```ts
import { NextResponse, NextRequest } from "next/server";

export function middleware(_req: NextRequest) {
  // Auth is enforced client-side by SubscriptionGate.
  // The tbt_access cookie is HttpOnly and set by the backend (run.app domain),
  // so it is never visible here at the vercel.app domain — checking it would
  // always redirect authenticated users back to /login.
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
  ],
};
```

### AFTER

**Delete the file entirely.** No replacement.

### Gotchas
- Confirm no future middleware feature is planned before deleting. If auth middleware is ever
  added (e.g., to redirect `/` to `/login`), a new file will need to be created at that time.
- After deleting, Vercel's Edge Network handles routing with no middleware overhead.

### Acceptance Criteria
- [ ] `middleware.ts` file no longer exists
- [ ] All pages still load (auth still enforced by `SubscriptionGate` client-side)
- [ ] Lighthouse TTFB metric visibly improves

---

---

## PERF-03 — Add CDN preconnects in root layout

| Field | Value |
|---|---|
| **File** | `app/layout.tsx` |
| **Lines** | 67–73 (`<head>` block) |
| **Metrics** | LCP ↓ (images from BunnyCDN/R2 connect 200–500ms earlier on mobile) |
| **Risk** | None — pure HTML hint, ignored if origin unreachable |

### BEFORE

```tsx
<head>
  {themeCSS && <style dangerouslySetInnerHTML={{ __html: themeCSS }} />}
  {initialConfig?.faviconUrl && (
    <link rel="icon" href={initialConfig.faviconUrl} />
  )}
  <link rel="preconnect" href={API_BASE} />
</head>
```

### AFTER

```tsx
<head>
  {themeCSS && <style dangerouslySetInnerHTML={{ __html: themeCSS }} />}
  {initialConfig?.faviconUrl && (
    <link rel="icon" href={initialConfig.faviconUrl} />
  )}
  <link rel="preconnect" href={API_BASE} />
  {/* CDN origins for images and videos — allows browser to start TCP+TLS handshake early */}
  <link rel="preconnect" href="https://YOUR_BUNNYCDN_SUBDOMAIN.b-cdn.net" crossOrigin="" />
  <link rel="dns-prefetch" href="https://YOUR_BUNNYCDN_SUBDOMAIN.b-cdn.net" />
  <link rel="dns-prefetch" href="https://YOUR_R2_ACCOUNT_ID.r2.cloudflarestorage.com" />
</head>
```

### Implementation Notes
- Replace `YOUR_BUNNYCDN_SUBDOMAIN` with the actual CDN hostname used in the app. This is
  the hostname that appears in `thumbnailUrl` and `bgVideoUrl` values from the API.
- Replace `YOUR_R2_ACCOUNT_ID` with the R2 public bucket hostname from `CLOUDFLARE_R2_*` env.
- Use `<link rel="preconnect">` (full TCP+TLS) only for the domain that serves the
  **first** image users see (BunnyCDN for hero images/videos).
- Use `<link rel="dns-prefetch">` (DNS only, lightweight) for R2 since it is a secondary origin.
- `crossOrigin=""` is required on preconnect for CORS-enabled CDNs, otherwise the browser
  opens a second connection anyway.

### Acceptance Criteria
- [ ] Lighthouse shows the CDN origin connection starting before the first image request
- [ ] Network tab in DevTools: CDN domain shows "DNS Lookup" completing before first image
- [ ] No CORS errors in console

---

---

## PERF-04 — Remove backdrop-filter blur on mobile Navbar and drawer

| Field | Value |
|---|---|
| **File** | `components/layout/Navbar.tsx` |
| **Lines** | 448–458 (floating header), 389–395 (mobile drawer) |
| **Metrics** | LCP ↓, INP ↓ (removes continuous GPU compositing cost on every platform page) |
| **Risk** | Low — visual change on mobile only; desktop unchanged |

### BEFORE — Floating header (lines 447–458)

```tsx
<header
  className="fixed top-3 left-4 right-4 z-40 h-14 flex items-center px-3 gap-3 rounded-2xl"
  style={{
    background: "rgba(10, 10, 10, 0.72)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    border: "1px solid rgba(255,255,255,0.07)",
    boxShadow: [
      "0 4px 24px rgba(0,0,0,0.55)",
      "0 1px 0 rgba(255,255,255,0.04) inset",
      "0 0 60px color-mix(in srgb, #dc2626 5%, transparent)",
    ].join(", "),
  }}
>
```

### AFTER — Floating header

```tsx
<header
  className="fixed top-3 left-4 right-4 z-40 h-14 flex items-center px-3 gap-3 rounded-2xl supports-[backdrop-filter]:md:backdrop-blur-xl"
  style={{
    // Mobile: solid background (no blur — GPU-expensive on mobile)
    // Desktop (md+): blur re-enabled via Tailwind supports- + md: prefix above
    background: "rgba(10, 10, 10, 0.93)",
    border: "1px solid rgba(255,255,255,0.07)",
    boxShadow: [
      "0 4px 24px rgba(0,0,0,0.55)",
      "0 1px 0 rgba(255,255,255,0.04) inset",
      "0 0 60px color-mix(in srgb, #dc2626 5%, transparent)",
    ].join(", "),
  }}
>
```

### BEFORE — Mobile drawer (lines 384–395)

```tsx
<div
  className={cn(
    "fixed top-0 left-0 h-full w-72 z-50 flex flex-col border-r transition-transform duration-300 ease-out lg:hidden",
    sidebarOpen ? "translate-x-0" : "-translate-x-full"
  )}
  style={{
    background: "rgba(8, 8, 8, 0.94)",
    backdropFilter: "blur(24px)",
    WebkitBackdropFilter: "blur(24px)",
    borderColor: "rgba(255,255,255,0.07)",
    boxShadow: "4px 0 40px rgba(0,0,0,0.7)",
  }}
>
```

### AFTER — Mobile drawer

```tsx
<div
  className={cn(
    "fixed top-0 left-0 h-full w-72 z-50 flex flex-col border-r transition-transform duration-300 ease-out lg:hidden",
    sidebarOpen ? "translate-x-0" : "-translate-x-full"
  )}
  style={{
    // Solid background on mobile — the drawer slides in from off-screen so blur
    // offers no readability benefit and is expensive on mobile GPUs
    background: "rgba(8, 8, 8, 0.98)",
    borderColor: "rgba(255,255,255,0.07)",
    boxShadow: "4px 0 40px rgba(0,0,0,0.7)",
  }}
>
```

### Gotchas
- The Tailwind class `supports-[backdrop-filter]:md:backdrop-blur-xl` requires Tailwind v3.2+
  which is already in use. Verify by checking `tailwind.config.ts` version.
- Alternatively, use an inline CSS media query string if Tailwind approach feels awkward:
  apply `backdrop-filter` only via a CSS class in `globals.css` scoped to `@media (min-width: 768px)`.
- The `WebkitBackdropFilter` (Safari prefix) line must also be removed from the inline style
  on mobile, since both the prefixed and unprefixed properties trigger the compositing cost.
- The `NotifDropdown` component (lines 62–174) also uses `backdropFilter: "blur(24px)"` — this
  is conditional (only when the dropdown is open), so it is lower priority, but can be given
  a solid background (`rgba(10,10,10,0.98)`) as well.

### Acceptance Criteria
- [ ] Mobile Navbar renders with solid `rgba(10,10,10,0.93)` background (no blur)
- [ ] Desktop Navbar (≥768px) retains the blur effect
- [ ] No visual regression on desktop
- [ ] Chrome DevTools Rendering tab: "Paint Flashing" should NOT fire continuously on the
  Navbar area when scrolling on mobile

---

---

## PERF-05 — Skip hero background video on mobile

| Field | Value |
|---|---|
| **File** | `app/(platform)/tbt/TbtClient.tsx` |
| **Lines** | 78–88 (video element inside HeroCarousel) |
| **Metrics** | LCP ↓, TBT ↓ (no video download competing with JS/image loading on mobile) |
| **Risk** | Low — visual degradation is intentional and acceptable on mobile |

### Problem
On mobile, the `<video autoPlay>` element immediately starts buffering the full video file over
the already-constrained mobile connection. This competes directly with fonts, JS bundles, and the
hero image, delaying LCP by hundreds of milliseconds.

### BEFORE (lines 78–88)

```tsx
{slide.bgVideoUrl ? (
  <video
    ref={videoRef}
    key={slide.bgVideoUrl}
    src={slide.bgVideoUrl}
    autoPlay
    loop
    muted={muted}
    playsInline
    className="absolute inset-0 w-full h-full object-cover"
  />
) : slide.bgImageUrl ? (
```

### AFTER

```tsx
{slide.bgVideoUrl && !isMobileViewport() ? (
  <video
    ref={videoRef}
    key={slide.bgVideoUrl}
    src={slide.bgVideoUrl}
    autoPlay
    loop
    muted={muted}
    playsInline
    poster={slide.bgImageUrl ?? undefined}
    className="absolute inset-0 w-full h-full object-cover"
  />
) : slide.bgImageUrl ? (
```

### New helper to add at the top of TbtClient.tsx (after imports)

```tsx
// Returns true if window width is < 768px (Tailwind's md breakpoint).
// Called once per render — safe because HeroCarousel re-renders on slide change anyway.
function isMobileViewport(): boolean {
  if (typeof window === "undefined") return false; // SSR — default to desktop (video rendered)
  return window.innerWidth < 768;
}
```

### Behavior After Change
- **Mobile (< 768px):** Falls through to `slide.bgImageUrl` branch → renders `<Image>` with
  `priority`. No video download at all.
- **Desktop (≥ 768px):** Same as today — autoplay video with `poster` image shown while buffering.
- **SSR:** `isMobileViewport()` returns `false` → video element is in server HTML → no hydration
  mismatch because React will reconcile correctly once JS runs and the condition is re-evaluated.

### Gotchas
- The `muted` state toggle button (lines 154–167) only renders when `slide.bgVideoUrl` is set.
  After this change, it will correctly not render on mobile since the video is not rendered.
  No extra conditionals needed.
- The `videoRef` is only used within the video element. It becomes a no-op ref on mobile.
  No change needed to ref handling.
- `poster={slide.bgImageUrl ?? undefined}` is also added to the desktop video so users see
  the image immediately while the video buffers. This is PERF-06 bundled in.

---

---

## PERF-06 — Add poster and preload hint to hero video (desktop)

| Field | Value |
|---|---|
| **File** | `app/(platform)/tbt/TbtClient.tsx` |
| **Lines** | 79–88 (video element) |
| **Metrics** | LCP ↓ on desktop (image shows immediately while video buffers) |
| **Risk** | None |

**This is bundled into PERF-05** — the `poster={slide.bgImageUrl ?? undefined}` attribute is added
at the same time as the mobile video skip. No separate implementation needed.

If implemented separately, the only change is adding `poster` to the existing `<video>` tag:

```tsx
<video
  ref={videoRef}
  key={slide.bgVideoUrl}
  src={slide.bgVideoUrl}
  autoPlay
  loop
  muted={muted}
  playsInline
  poster={slide.bgImageUrl ?? undefined}   // ← ADD THIS
  className="absolute inset-0 w-full h-full object-cover"
/>
```

### Acceptance Criteria (covers both PERF-05 and PERF-06)
- [ ] Mobile DevTools Network tab: no video file download on the `/tbt` page
- [ ] Mobile: hero shows a static background image correctly
- [ ] Desktop: hero still plays video; image appears instantly as poster before first frame loads
- [ ] Mute toggle button does not appear on mobile (no `slide.bgVideoUrl` condition is false)

---

---

## PERF-07 — Defer socket.io connection by 4 seconds

| Field | Value |
|---|---|
| **File** | `components/layout/Navbar.tsx` |
| **Lines** | 285–347 (two `useEffect` blocks for socket connections) |
| **Metrics** | TBT ↓ (socket.io-client parse + WebSocket handshake moved off critical path) |
| **Risk** | Low — notification toasts and message invalidation are delayed 4s on first load only |

### BEFORE — First socket useEffect (lines 285–347)

```tsx
useEffect(() => {
  let mounted = true;
  getSocket().then((socket) => {
    if (!mounted) return;
    // ... showNotifToast setup ...
    socket.on("notification", showNotifToast);
    socket.on("notification:broadcast", showNotifToast);
  });

  return () => {
    mounted = false;
    getSocket().then((s) => {
      s.off("notification");
      s.off("notification:broadcast");
    });
  };
}, [queryClient]);
```

### BEFORE — Second socket useEffect (lines 349–362)

```tsx
useEffect(() => {
  let mounted = true;
  getSocket().then((socket) => {
    if (!mounted) return;
    socket.on("message:new", () => {
      queryClient.invalidateQueries({ queryKey: ["user", "conversations"] });
    });
  });
  return () => {
    mounted = false;
    getSocket().then((s) => s.off("message:new"));
  };
}, [queryClient]);
```

### AFTER — Both effects with deferred start

```tsx
useEffect(() => {
  let mounted = true;
  let timer: ReturnType<typeof setTimeout>;

  // Defer socket connection — keeps socket.io-client off the critical path.
  // 4s gives the page time to render, hydrate, and paint before we open the WebSocket.
  timer = setTimeout(() => {
    getSocket().then((socket) => {
      if (!mounted) return;
      // ... showNotifToast setup (unchanged) ...
      socket.on("notification", showNotifToast);
      socket.on("notification:broadcast", showNotifToast);
    });
  }, 4000);

  return () => {
    mounted = false;
    clearTimeout(timer);
    getSocket().then((s) => {
      s.off("notification");
      s.off("notification:broadcast");
    });
  };
}, [queryClient]);

useEffect(() => {
  let mounted = true;
  let timer: ReturnType<typeof setTimeout>;

  timer = setTimeout(() => {
    getSocket().then((socket) => {
      if (!mounted) return;
      socket.on("message:new", () => {
        queryClient.invalidateQueries({ queryKey: ["user", "conversations"] });
      });
    });
  }, 4000);

  return () => {
    mounted = false;
    clearTimeout(timer);
    getSocket().then((s) => s.off("message:new"));
  };
}, [queryClient]);
```

### Gotchas
- The cleanup `getSocket().then(s => s.off(...))` in the return function must still work even if
  the socket hasn't connected yet. `getSocket()` returns a Socket instance regardless of
  connection state, and `.off()` on an event with no listener is a safe no-op.
- `showNotifToast` function is defined inside the first `useEffect` — its closure captures
  `queryClient` and `routerRef`. No change to the function body is needed.
- The 4-second delay means if a notification arrives within 4s of page load, the toast won't
  show. This is acceptable — live notifications during the first 4s of page load are not
  perceivable by users who are still reading the page content.

### Acceptance Criteria
- [ ] Chrome DevTools Network tab: `socket.io` WebSocket connection appears ~4s after DOMContentLoaded
- [ ] Lighthouse TBT metric improves (socket.io-client chunk no longer in critical path)
- [ ] After 4s, notifications still arrive and toasts display correctly
- [ ] Page navigation resets the timer (unmount clears `timer`)

---

---

## PERF-08 — Increase unread-count staleTime to 5 minutes

| Field | Value |
|---|---|
| **File** | `lib/hooks/useDashboard.ts` |
| **Lines** | 46–54 (`useNotificationUnreadCount`), 136–144 (`useConversationUnreadCount`) |
| **Metrics** | TBT ↓ (removes 2 API calls from initial page load on every platform navigation) |
| **Risk** | None — counts are updated in real-time by socket events anyway |

### BEFORE — `useNotificationUnreadCount` (lines 46–54)

```ts
export const useNotificationUnreadCount = () =>
  useQuery({
    queryKey: ["user", "notifications", "unread-count"],
    queryFn: async () => {
      const res = await dashboardService.getNotificationUnreadCount();
      return res.data?.count ?? 0;
    },
    staleTime: 30 * 1000,   // ← 30 seconds — refetches on every navigation
  });
```

### AFTER

```ts
export const useNotificationUnreadCount = () =>
  useQuery({
    queryKey: ["user", "notifications", "unread-count"],
    queryFn: async () => {
      const res = await dashboardService.getNotificationUnreadCount();
      return res.data?.count ?? 0;
    },
    staleTime: 5 * 60 * 1000,   // ← 5 minutes — real-time updates come via socket events
  });
```

### BEFORE — `useConversationUnreadCount` (lines 136–144)

```ts
export const useConversationUnreadCount = () =>
  useQuery({
    queryKey: ["user", "conversations", "unread-count"],
    queryFn: async () => {
      const res = await dashboardService.getConversationUnreadCount();
      return (res as any).data?.count ?? 0;
    },
    staleTime: 30_000,   // ← 30 seconds
  });
```

### AFTER

```ts
export const useConversationUnreadCount = () =>
  useQuery({
    queryKey: ["user", "conversations", "unread-count"],
    queryFn: async () => {
      const res = await dashboardService.getConversationUnreadCount();
      return (res as any).data?.count ?? 0;
    },
    staleTime: 5 * 60 * 1000,   // ← 5 minutes
  });
```

### Why This Is Safe
The Navbar already calls `queryClient.invalidateQueries({ queryKey: ["user", "notifications"] })`
inside the `showNotifToast` socket handler (line 291). This means the count is invalidated and
refetched the moment a new notification arrives via WebSocket. The 30-second polling refetch was
redundant. Same logic applies to message counts: `message:new` socket event already triggers
`queryClient.invalidateQueries({ queryKey: ["user", "conversations"] })` (line 355).

### Acceptance Criteria
- [ ] Lighthouse: two fewer network requests in the waterfall on `/tbt` page load
- [ ] Notification badge count still updates in real-time when a notification arrives
- [ ] Navigating between platform pages does NOT trigger a re-fetch of unread counts
  (unless socket invalidation fired or 5 min has elapsed)

---

---

## PERF-09 — Add dimensions to logo and avatar `<img>` tags

| Field | Value |
|---|---|
| **File** | `components/layout/Navbar.tsx` |
| **Lines** | 407 (drawer logo), 473 (header logo), 229–231 (profile avatar) |
| **Metrics** | CLS ↓ (browser pre-allocates space; no layout shift when images load) |
| **Risk** | None — width/height attributes are hints, not constraints |

### BEFORE — Drawer logo (line 407)

```tsx
<img src={logoUrl || "/tbt_logo.png"} alt={siteName} className="h-7 w-auto object-contain" />
```

### AFTER — Drawer logo

```tsx
<img
  src={logoUrl || "/tbt_logo.png"}
  alt={siteName}
  width={120}
  height={28}
  className="h-7 w-auto object-contain"
/>
```

### BEFORE — Header logo (line 473)

```tsx
<img src={logoUrl || "/tbt_logo.png"} alt={siteName} className="h-7 w-auto object-contain" />
```

### AFTER — Header logo

```tsx
<img
  src={logoUrl || "/tbt_logo.png"}
  alt={siteName}
  width={120}
  height={28}
  className="h-7 w-auto object-contain"
  fetchPriority="high"
/>
```

`fetchPriority="high"` is added only to the **header logo** (always visible on page load), not
the drawer logo (hidden until menu opens).

### BEFORE — Profile avatar (lines 229–231)

```tsx
<img src={(me as any).profilePhotoUrl} alt="" className="w-full h-full object-cover" />
```

### AFTER — Profile avatar

```tsx
<img
  src={(me as any).profilePhotoUrl}
  alt=""
  width={28}
  height={28}
  className="w-full h-full object-cover"
/>
```

### Gotchas
- `width={120}` for the logo is an approximate hint — the actual rendered width is controlled
  by `className="h-7 w-auto"` (CSS governs the visual size). The HTML `width` attribute only
  tells the browser the intrinsic size for aspect-ratio calculation to prevent CLS.
- `fetchPriority="high"` is a browser hint, not a Next.js attribute. TypeScript may flag it
  on `<img>`. Add `// @ts-ignore` above the line or add `fetchPriority` to the global JSX
  intrinsic elements if needed: this is a known limitation of older `@types/react` versions.

### Acceptance Criteria
- [ ] Lighthouse CLS score: 0 or near-0
- [ ] DevTools Layout Shift regions overlay: no shift on the Navbar during load
- [ ] Logo appears immediately with correct space reserved
- [ ] `fetchPriority` visible in the request headers for the logo image

---

---

## PERF-10 — Replace raw `<img>` in Dashboard continue-learning cards

| Field | Value |
|---|---|
| **File** | `app/(platform)/dashboard/page.tsx` |
| **Lines** | 83–88 (thumbnail img inside continue learning map) |
| **Metrics** | LCP ↓, CLS ↓ (Next.js Image optimization: WebP format, correct sizing, lazy load) |
| **Risk** | None |

### BEFORE (lines 83–88)

```tsx
// eslint-disable-next-line @next/next/no-img-element
<img
  src={item.thumbnailUrl}
  alt={item.title}
  className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity"
/>
```

### AFTER

```tsx
import Image from "next/image";

// Replace raw <img> with:
<Image
  src={item.thumbnailUrl}
  alt={item.title}
  fill
  className="object-cover opacity-60 group-hover:opacity-80 transition-opacity"
  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
/>
```

### Parent container change required
The parent `<div>` wrapping the image must have `position: relative` for `fill` to work.
The existing class `aspect-video w-full relative bg-black/50 overflow-hidden` already includes
`relative`, so no change to the parent is needed.

### Gotchas
- The `eslint-disable-next-line @next/next/no-img-element` comment must be removed.
- `DashboardPage` is a `"use client"` component — `next/image` works fine in client components.
- Confirm `item.thumbnailUrl` domain is in `next.config.ts` `remotePatterns`. If it's from
  BunnyCDN or R2, it already is (see existing patterns for `**.b-cdn.net` and `**.r2.cloudflarestorage.com`).

### Acceptance Criteria
- [ ] Network tab: thumbnail requests return `image/webp` format (Next.js image optimization)
- [ ] No `@next/next/no-img-element` ESLint warnings in this file
- [ ] Cards render correctly with proper aspect-video dimensions maintained
- [ ] Images are lazy-loaded (not visible in Network tab until card is in viewport)

---

---

## PERF-11 — Guard `scroll-behavior: smooth` with prefers-reduced-motion

| Field | Value |
|---|---|
| **File** | `app/globals.css` |
| **Lines** | 75–78 |
| **Metrics** | Accessibility score ↑ (Lighthouse flags unguarded scroll-behavior) |
| **Risk** | None — purely additive CSS |

### BEFORE (lines 75–78)

```css
html {
  scroll-behavior: smooth;
}
```

### AFTER

```css
@media (prefers-reduced-motion: no-preference) {
  html {
    scroll-behavior: smooth;
  }
}
```

### Gotchas
- This change is inside `@layer base` in the original. The media query can wrap the `html` rule
  directly. The `@layer` grouping does not need to change.
- Mobile browsers with accessibility "Reduce Motion" enabled will benefit from this immediately.

### Acceptance Criteria
- [ ] Lighthouse Accessibility audit: no flag for `scroll-behavior`
- [ ] With OS "Reduce Motion" enabled: page does not use smooth scroll
- [ ] With OS "Reduce Motion" disabled: smooth scroll works as before

---

---

## PERF-12 — Replace `drop-shadow-2xl` on hero `<h2>` with CSS text-shadow

| Field | Value |
|---|---|
| **File** | `app/(platform)/tbt/TbtClient.tsx` |
| **Lines** | 123 |
| **Metrics** | LCP ↓ (CSS `filter` removed from the LCP element, reducing composite layer cost) |
| **Risk** | None — visually equivalent |

### Why `drop-shadow` Hurts
Tailwind's `drop-shadow-2xl` compiles to `filter: drop-shadow(...)`. CSS `filter` forces the
browser to create a new compositing layer and run the filter in software on the GPU. On the `<h2>`
which is the hero's **LCP text element**, this delays when the browser can declare "paint done"
for Lighthouse's LCP measurement.

`text-shadow` is implemented natively by the text rasterizer and adds zero compositing overhead.

### BEFORE (line 123)

```tsx
<h2 className="text-3xl md:text-5xl lg:text-6xl font-black text-white mb-3 leading-tight max-w-2xl lg:max-w-3xl drop-shadow-2xl">
  {slide.title}
</h2>
```

### AFTER

```tsx
<h2
  className="text-3xl md:text-5xl lg:text-6xl font-black text-white mb-3 leading-tight max-w-2xl lg:max-w-3xl"
  style={{ textShadow: "0 2px 16px rgba(0,0,0,0.9), 0 1px 4px rgba(0,0,0,0.7)" }}
>
  {slide.title}
</h2>
```

Also remove `drop-shadow` from the description paragraph (line 127):

### BEFORE (line 127)

```tsx
<p className="text-white/80 text-sm md:text-base mb-7 max-w-lg md:max-w-xl leading-relaxed drop-shadow">
```

### AFTER (line 127)

```tsx
<p
  className="text-white/80 text-sm md:text-base mb-7 max-w-lg md:max-w-xl leading-relaxed"
  style={{ textShadow: "0 1px 6px rgba(0,0,0,0.8)" }}
>
```

### Acceptance Criteria
- [ ] Hero title still has readable shadow contrast against the video/image background
- [ ] Chrome DevTools Layers panel: no extra compositing layer created for the `<h2>`
- [ ] Visual diff: indistinguishable from before

---

---

## PERF-13 — Replace `window.resize` with `ResizeObserver` in scroll rows

| Field | Value |
|---|---|
| **File** | `app/(platform)/tbt/TbtClient.tsx` |
| **Affects** | `SectionRow` (line 332), `ContinueWatchingSection` (line 546), `RecentlyWatchedSection` (line 757) |
| **Metrics** | INP ↓ (mobile keyboard open/close no longer triggers 3 synchronous DOM reads) |
| **Risk** | Low — `ResizeObserver` is supported in all browsers used by this app |

### Problem
Each of the three scroll row components attaches `window.addEventListener("resize", checkScroll)`.
On mobile, when the virtual keyboard opens or closes, the browser fires `resize`. All three fire
at the same time, each calling `el.scrollLeft`, `el.scrollWidth`, and `el.clientWidth` — which
are synchronous DOM layout reads that force the browser to flush pending style calculations
before returning. Three of these in sequence stall the main thread.

`ResizeObserver` observes only the specific scroll container element, fires only when **that
element** changes size, and batches across frames.

### Pattern to apply to ALL THREE components

Replace this pattern (shown for `SectionRow` but identical in the other two):

### BEFORE

```tsx
useEffect(() => {
  const el = scrollRef.current;
  if (!el) return;
  checkScroll();
  el.addEventListener("scroll", checkScroll, { passive: true });
  window.addEventListener("resize", checkScroll);          // ← window listener
  return () => {
    el.removeEventListener("scroll", checkScroll);
    window.removeEventListener("resize", checkScroll);
  };
}, [checkScroll, section.items.length]);
```

### AFTER

```tsx
useEffect(() => {
  const el = scrollRef.current;
  if (!el) return;
  checkScroll();
  el.addEventListener("scroll", checkScroll, { passive: true });

  // ResizeObserver fires only when this specific container changes size.
  // More efficient than window.resize on mobile (avoids keyboard open/close thrash).
  const ro = new ResizeObserver(() => checkScroll());
  ro.observe(el);

  return () => {
    el.removeEventListener("scroll", checkScroll);
    ro.disconnect();
  };
}, [checkScroll, section.items.length]);
```

Apply the **exact same replacement** to:
- `ContinueWatchingSection` — `useEffect` at approx. line 541–551
- `RecentlyWatchedSection` — `useEffect` at approx. line 751–760

### Gotchas
- `ResizeObserver` is globally available in Next.js (browser environment). No polyfill needed.
- The `ro.observe(el)` call observes the scroll container's box. When the screen rotates or
  the layout changes, `el`'s width changes → `checkScroll` fires → arrow visibility updates.
  This is exactly the same behavior as `window.resize` but scoped correctly.
- Do NOT also keep `window.addEventListener("resize")` — pick one or the other.

### Acceptance Criteria
- [ ] No `window.addEventListener("resize")` calls remain in `TbtClient.tsx`
- [ ] Scroll arrow visibility still updates correctly when the page layout changes
- [ ] Chrome DevTools Performance panel on mobile: no main-thread task spike when
  virtual keyboard opens

---

---

## Testing Protocol

Run all checks against the **production Vercel URL** (`https://app.tamilbusinesstribe.com`) using
Chrome with DevTools, not localhost. Localhost skips CDN, caching, and Sentry instrumentation.

### Lighthouse Mobile Audit
1. Open Chrome DevTools → Lighthouse tab
2. Select **Mobile** device
3. Check: Performance, Accessibility, Best Practices
4. Run from an **Incognito** window to exclude extensions
5. Run 3 times and take the median score (Lighthouse scores vary ±5 points per run)

### Network Waterfall Checks (DevTools → Network, throttle to Slow 4G)
- [ ] No `socket.io` connection in first 4s of waterfall
- [ ] No `.mp4`/`.webm` request on mobile device width (set to 375px in device toolbar)
- [ ] No `geist-mono` font request
- [ ] CDN domain connection starts before first image request
- [ ] Logo image loads with `fetchpriority: high` in request headers

### Rendering Checks (DevTools → Rendering overlay)
- [ ] "Paint Flashing" off: scroll the `/tbt` page on mobile emulation — Navbar should NOT
  flash green on every scroll frame (would indicate backdrop-filter repainting)
- [ ] "Layout Shift Regions" off: page load should show no blue layout shift boxes
- [ ] "Core Web Vitals" overlay: LCP element should be identified as the hero image, not video

### Functional Regression Checks
- [ ] Navigation between platform pages works
- [ ] Mobile drawer opens/closes correctly
- [ ] Notifications arrive and toast appears (test at t+5s after page load)
- [ ] Hero carousel autoplays on desktop, shows static image on mobile
- [ ] Content section horizontal scroll works on mobile
- [ ] Profile dropdown opens/closes

---

## Expected Score Impact Per Ticket

| Ticket | Metric | Expected Delta |
|---|---|---|
| PERF-01 Geist Mono | FCP | −150–300ms |
| PERF-02 Middleware | TTFB | −10–30ms |
| PERF-03 Preconnects | LCP | −200–500ms |
| PERF-04 Backdrop blur | LCP + INP | +5–10 score pts |
| PERF-05 Hero video mobile | LCP | −300–800ms |
| PERF-06 Hero poster | LCP desktop | −100–200ms |
| PERF-07 Socket defer | TBT | −200–400ms |
| PERF-08 staleTime | TBT | −50–150ms |
| PERF-09 img dimensions | CLS | CLS → 0 |
| PERF-10 Dashboard Image | LCP + CLS | minor |
| PERF-11 scroll-behavior | Accessibility | +3–5 score pts |
| PERF-12 drop-shadow | LCP | −50–100ms |
| PERF-13 ResizeObserver | INP | minor on mobile |

Deltas are estimates based on Lighthouse scoring rubrics. Actual results depend on
backend latency, CDN cache hit rate, and test network conditions.
