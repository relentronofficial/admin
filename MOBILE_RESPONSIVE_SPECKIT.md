# MOBILE_RESPONSIVE_SPECKIT.md

## Overview

Mobile responsiveness fixes for `https://app.tamilbusinesstribe.com/` at 390px (iPhone 14 Pro).
Discovered via Playwright audit on 2026-10-22. 10 issues across Navbar, Hamburger Menu, Courses page, Charts, and Course Player. All fixes are additive (mobile-only breakpoint overrides) — desktop is unaffected.

---

## MR-01 — CRITICAL: Course Player Crashes on Mobile

**Page:** `/learning/[courseId]?lesson=...&section=...`
**Symptom:** "Something went wrong — An unexpected error occurred." error boundary shown instead of the video player.
**Root cause to investigate:** The page was recently moved from `(platform)` to `(platform-player)` route group. The error may be:
1. A `useSearchParams()` call inside a component that lacks a `<Suspense>` boundary (required in Next.js 15 when not wrapped in Suspense)
2. A hydration mismatch between the server render in the new layout and client expectations
3. The `SubscriptionGate` being imported cross-group via `@/app/(platform)/SubscriptionGate` causing an issue
4. An auth-related redirect loop in the new layout context

**Fix steps:**
1. Wrap the `<NavAccessGuard>` children in `(platform-player)/layout.tsx` with `<React.Suspense fallback={null}>` to handle any `useSearchParams()` suspense boundary requirement
2. Check if `SubscriptionGate` uses `useSearchParams` or `useRouter` — if so, ensure Suspense is present
3. Verify the error boundary — if no `error.tsx` exists in the new route group, add one
4. Test with a real authenticated user session

**Files to check:**
- `tbt-user-web/app/(platform-player)/layout.tsx`
- `tbt-user-web/app/(platform)/SubscriptionGate.tsx`
- `tbt-user-web/components/guards/NavAccessGuard.tsx`
- `tbt-user-web/app/(platform-player)/learning/[courseId]/page.tsx` — check all `useSearchParams()` usages

---

## MR-02 — HIGH: Navbar Overflow on Mobile (Avatar Clipped)

**Page:** All pages
**Symptom:** At 390px, the navbar shows 7+ items in one row: `☰ | Logo | 🔥0 | 22.9K | 11/90d | 🔔 | 💬 | Avatar`. The avatar on the far right is clipped/partially invisible. The streak `11/90d` is also tight.

**Fix:**
- On mobile (`< lg`), hide the coin balance and streak indicator from the Navbar
- These stats are visible on the courses/dashboard pages so removing from navbar doesn't lose info
- Navbar on mobile should only show: `☰ | Logo | 🔔(badge) | Avatar`
- The messages icon can optionally move into the hamburger menu

**File:** `tbt-user-web/components/layout/Navbar.tsx`
**Change:** Add `hidden lg:flex` (or `hidden lg:block`) to the coin balance and streak components in Navbar. Keep bell and avatar always visible.

---

## MR-03 — HIGH: Hamburger Menu Incomplete & No Overlay

**Page:** All pages
**Symptom:**
- Drawer only shows 5 items: Mentorship, Notifications, Messages, Community, Support
- Missing: Dashboard, Courses, Learning/Progress, Programs, Batch Program, Discover, Resources, History, Profile
- Drawer is ~70% screen width — background content bleeds through right side with no dark overlay
- No profile header at top of drawer
- Large empty space below the 5 items

**Fix:**
1. Add all missing navigation links to the mobile drawer, matching the same nav structure used on desktop. Full list: Dashboard, Mentorship (Courses), Learning Progress, Community, Messages, Batch Program, Programs, Resources, History, Notifications, Support, Profile
2. Make the drawer full-width on mobile: `w-full sm:w-72` instead of fixed partial width
3. Add a semi-transparent backdrop behind the drawer: `fixed inset-0 bg-black/60 z-[49]` that closes the drawer on tap
4. Add a mini profile card at the top: avatar + name + plan badge
5. Group nav items with section dividers (e.g. "Learn", "Community", "Account")

**File:** `tbt-user-web/components/layout/Navbar.tsx` — mobile drawer/sheet component section

---

## MR-04 — HIGH: Course Title Truncated Mid-Word

**Page:** `/courses`
**Symptom:** Hero title shows "TBT – Ecommerce Ment..." — truncated in the middle of a word
**Location:** The `titleOverride` prop passed to `MentorshipDashboard` → displayed in the hero banner area

**Fix:**
- Allow the title to wrap to 2 lines on mobile instead of hard-truncating with `truncate`
- Change `className="... truncate"` → `className="... line-clamp-2"` on the title element in the mentorship dashboard hero
- Or increase the title container width by removing horizontal padding on mobile

**File:** `tbt-user-web/components/features/mentorship/MentorshipDashboard.tsx` — hero title element

---

## MR-05 — MEDIUM: Weekly Activity Graph Y-Axis Unreadable on Mobile

**Page:** `/courses` (scroll position ~900px)
**Symptom:** The Weekly Activity Graph Y-axis labels are extremely small and cramped at 390px. The chart is squeezed horizontally and labels overlap or become illegible.

**Fix (choose one — Option A recommended):**
A. Make the chart container horizontally scrollable on mobile: wrap in `overflow-x-auto` with `min-w-[500px]` on the inner chart
B. On mobile (`< md`), hide Y-axis labels and show them in a tooltip on tap
C. Reduce the number of Y-axis ticks on mobile (show only 3: Start, midpoint, top)
D. Increase font size of Y-axis labels to minimum 10px and allow the chart to be taller on mobile

**File:** `tbt-user-web/components/features/batch/WeeklyActivityGraph.tsx` — Y-axis configuration / responsive breakpoint logic

---

## MR-06 — MEDIUM: Revenue/Chart Headers Clipped by Sticky Navbar

**Page:** `/courses` (scroll position ~1800px — "Weekly Revenue Trajectory" section)
**Symptom:** When scrolling to the weekly revenue trajectory chart, the section header is hidden behind the sticky navbar. The date range label is too small to read.

**Fix:**
- Add `scroll-margin-top: 80px` (navbar height) to all major section headers
- Increase date range label to minimum `text-xs` (12px)
- Use `scroll-mt-20` Tailwind utility on scrollable section anchor elements

**Files:**
- `tbt-user-web/components/features/mentorship/MentorshipDashboard.tsx`
- Any chart/graph component rendering the revenue trajectory

---

## MR-07 — MEDIUM: Stat Card Labels Wrap Badly on Small Screens

**Page:** `/courses` (Revenue Stats section)
**Symptom:** Card labels "NUMBER OF ORDERS" and "AD BUDGET SPENT" wrap onto 3 lines each because of `uppercase tracking-widest text-xs` styling in a narrow 2-column grid.

**Fix:**
- On mobile, shorten stat card labels: "NUMBER OF ORDERS" → "Orders", "AD BUDGET SPENT" → "Ad Spend", "REVENUE GENERATED" → "Revenue"
- Use responsive label: `<span className="hidden sm:inline">NUMBER OF </span>ORDERS`
- Or reduce label font from `tracking-widest uppercase` to normal case on mobile
- Reduce the large number font size by 20% on mobile (`text-3xl` → `text-2xl` at `< sm`)

**File:** `tbt-user-web/components/features/mentorship/MentorshipDashboard.tsx` — revenue stats card rendering

---

## MR-08 — MEDIUM: "Update Social Stats" Button Text Clipped

**Page:** `/courses` (Social Media Organic Growth section)
**Symptom:** The "Update social stats" button reads "Update social st..." — text is clipped

**Fix:**
- On mobile, make this button full-width: change to `w-full` at `< sm` breakpoint
- Or move button below the grid (below the 6 stat tiles) on mobile instead of inline-right

**File:** `tbt-user-web/components/features/mentorship/MentorshipDashboard.tsx` — social stats section

---

## MR-09 — MEDIUM: Floating Action Button Blocks Bottom Content

**Page:** All platform pages
**Symptom:** The red FAB button (bottom-right) overlaps with the last visible content card when reading near the bottom of the page.

**Fix:**
- Add `pb-20 lg:pb-6` to the page content container on mobile so the last content item is never hidden behind the FAB (64px height + 16px margin = 80px)

**Files:**
- `tbt-user-web/app/(platform)/layout.tsx` — add `pb-20 lg:pb-6` to inner container
- Or the FAB component itself

---

## MR-10 — LOW: Profile Page Black Skeleton (No Shimmer)

**Page:** `/profile`
**Symptom:** Below the stats row, the profile page shows solid black boxes as skeleton loaders — no animation, just pure black rectangles.

**Fix:**
- Add `animate-pulse` Tailwind class to all skeleton placeholder divs below the fold on the profile page
- Apply `bg-[#1a1a1e]` as the skeleton background color with `animate-pulse`
- Pattern: `<div className="animate-pulse rounded-xl bg-[#1a1a1e] h-24 w-full" />`

**File:** `tbt-user-web/app/(platform)/profile/page.tsx` (or profile components) — skeleton/loading state section

---

## Implementation Priority Order

1. **MR-01** (Critical) — Course player crash — investigate and fix first; affects core feature
2. **MR-02** (High) — Navbar overflow — affects every page, quick CSS fix
3. **MR-03** (High) — Hamburger menu completeness — main navigation path on mobile
4. **MR-04** (High) — Title truncation — visible on first screen load
5. **MR-07** (Medium) — Stat card labels — affects readability of key metrics
6. **MR-08** (Medium) — Button text clipped — quick fix
7. **MR-05** (Medium) — Chart Y-axis — requires chart lib changes
8. **MR-06** (Medium) — Chart header clipping — scroll-margin fix
9. **MR-09** (Medium) — FAB overlap — layout padding fix
10. **MR-10** (Low) — Profile skeleton shimmer — polish

---

## Pages Confirmed Looking Good on Mobile (No Changes Needed)

- `/community` — clean feed, tabs, composer, FAB well-placed
- `/dashboard` — morning ritual card, stats grid, welcome header all polished
- `/messages` — chat list readable and clean
- `/profile` header section — photo, name, badge, 3-col stats clean
