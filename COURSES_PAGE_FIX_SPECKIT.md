# COURSES_PAGE_FIX_SPECKIT.md

**File:** `tbt-user-web/app/(platform)/courses/page.tsx`  
**Audit date:** 2026-10-07  
**Commit audited:** `44fbac0b`  
**Total issues:** 10 (5 functional · 3 missing UI · 2 data/wiring)

---

## Issue index

| ID | Category | Title | Priority |
|---|---|---|---|
| CF-01 | Functional | `enrollLoading` dropped — no skeleton during enrollment fetch | High |
| CF-02 | Functional | Lock overlay text is wrong for paid courses | High |
| CF-03 | Functional | `showAll` never resets on filter change | Medium |
| CF-04 | Functional | "FAQs" button links to wrong route | Medium |
| CF-05 | Functional | Lock triggers for all unenrolled courses during load | Low |
| CM-01 | Missing UI | Course count label removed | Medium |
| CM-02 | Missing UI | "My Badges" link removed | Medium |
| CM-03 | Missing UI | Price not shown on paid locked courses | High |
| CD-01 | Data/Wiring | `SavedVideoCard` href uses wrong field for episode link | High |
| CD-02 | Data/Wiring | `SavedVideoCard` title uses wrong field | Medium |

---

## CF-01 — `enrollLoading` dropped — no skeleton during enrollment fetch

### Problem
`useMyEnrollments()` is called with only `data` destructured:
```typescript
// current — line 382
const { data: enrollments } = useMyEnrollments();
```
The original tracked `isLoading: enrollLoading`. While enrollments are still loading:
- `enrolledMap` is empty (all courses have `enrollment = undefined`)
- Every card's status circle shows "!" (not started)
- Every card's progress bar stays at 0%
- All paid courses where `hasAccess=false` immediately show the lock overlay

The module grid has no guard for this loading state.

### Fix
Destructure `isLoading` from the hook and use it to hold the grid rendering until enrollments resolve:

```typescript
// line 382 — change to:
const { data: enrollments, isLoading: enrollLoading } = useMyEnrollments();
```

In the module grid block, add a combined loading condition:

```typescript
// line 602 — change condition from:
{catalogLoading ? (
// to:
{catalogLoading || enrollLoading ? (
```

This ensures the skeleton grid is shown while either courses or enrollments are loading.

---

## CF-02 — Lock overlay text wrong for paid courses

### Problem
The lock overlay at lines 206–224 renders for any course where `isLocked = !hasAccess && !enrollment`. The overlay text is:

```
"Complete previous module to unlock"
```

This text describes **sequential course gating** (complete module N to unlock module N+1). It is wrong for **payment-gated** courses — a member who hasn't purchased the course sees misleading guidance that implies completing something else will unlock it, when they actually need to buy or request access.

### Fix
The text must vary by why the course is locked. Two scenarios:

1. **`course.price > 0` (paid course)** — text: `"Purchase this module to unlock"` with the price shown below.
2. **`course.price == 0` or `price == null` (free/access-controlled)** — text: `"Request access to unlock"`.

Replace the lock overlay text block (lines 211–222):

```typescript
// Was:
<div style={{ fontSize: 24 }}>🔒</div>
<div style={{ color: "#a0a0a0", fontSize: 11, textAlign: "center", padding: "0 20px", lineHeight: 1.4 }}>
  Complete previous module to unlock
</div>

// Replace with:
<div style={{ fontSize: 24 }}>🔒</div>
<div style={{ color: "#a0a0a0", fontSize: 11, textAlign: "center", padding: "0 20px", lineHeight: 1.4 }}>
  {course.price > 0 ? "Purchase this module to unlock" : "Request access to unlock"}
</div>
{course.price > 0 && (
  <div style={{ marginTop: 4, color: "#ffe000", fontSize: 13, fontWeight: 700 }}>
    ₹{(course.price as number).toLocaleString("en-IN")}
  </div>
)}
```

---

## CF-03 — `showAll` never resets on filter change

### Problem
`showAll` is a `useState(false)` (line 366) that is only ever set to `true` (line 659). When the user:
1. Clicks "Load more" → `showAll = true`, all 24 courses visible
2. Changes search/category/level filter → `showAll` stays `true`

After step 2, `visibleCourses = catalogCourses` (all filtered results). The "Load more" button condition is `!showAll && catalogCourses.length > 6`, which never fires again for the session. Any subsequent filter that returns ≤6 results is fine, but any filter returning >6 results will show them all without pagination.

More importantly, when the user clears the search and 24 courses return, they all appear at once with no "Load more" — the paging is permanently broken.

### Fix
Reset `showAll` whenever a filter or search changes. The cleanest approach is a single `useEffect`:

```typescript
// add after the existing useState declarations (after line 366):
useEffect(() => {
  setShowAll(false);
}, [search, level, sort, category]);
```

This fires whenever any filter changes, resetting the visible window back to 6 cards.

---

## CF-04 — "FAQs" button links to wrong route

### Problem
The "FAQs" button in the Modules section header (lines 408–421) links to `/learning`:

```typescript
<Link href="/learning" ...>FAQs</Link>
```

`/learning` is the **enrolled-courses / progress overview** page (`app/(platform)/learning/page.tsx`). It is not a FAQ page. A member clicking "FAQs" ends up on their course progress screen, which is confusing.

The original design had a **"My Badges"** button linking to `/learning/badges` in this position.

### Fix
Replace the "FAQs" button with the "My Badges" link that was in the original design:

```typescript
// Was:
<Link href="/learning" style={{ ... }}>FAQs</Link>

// Replace with:
<Link href="/learning/badges" style={{ ... }}>My Badges</Link>
```

This restores the lost badge navigation and puts a meaningful action in that slot.

---

## CF-05 — Lock triggers for all unenrolled courses during enrollment load

### Problem
`isLocked = !hasAccess && !enrollment` (line 37). During the window where `enrollLoading=true` and `enrollments` is `undefined`, `enrolledMap` is empty. For any paid course where `hasAccess=false` (not yet purchased), `isLocked` is `true` even though the member might actually be enrolled (enrollment just hasn't loaded yet).

This causes all paid courses to briefly flash the lock overlay on page load before enrollment data arrives.

### Fix
CF-01's fix (guarding the entire grid with `catalogLoading || enrollLoading`) eliminates this by not rendering any `ModuleCard` until both datasets are ready. No additional change needed here beyond CF-01.

**Dependency:** Resolved by CF-01.

---

## CM-01 — Course count label removed

### Problem
The original page showed the total course count next to the section heading:

```tsx
// original lines 749–751:
{!catalogLoading && catalogCourses.length > 0 && (
  <span className="text-[11px] text-muted-foreground">{catalogCourses.length} courses</span>
)}
```

The new design removes this. Members cannot see how many modules are available at a glance.

### Fix
Add the count label to the right side of the "Modules" section header, next to or below the "My Badges" button (after CM-02 fix). Add it inside the header row (lines 406–422):

```typescript
// Inside the section header div, after the title:
{!catalogLoading && catalogCourses.length > 0 && (
  <span style={{ fontSize: 11, color: "#92929b" }}>
    {catalogCourses.length} modules
  </span>
)}
```

Place this between the `<h2>` and the "My Badges" link, or as a sub-row beneath them.

---

## CM-02 — "My Badges" link removed

### Problem
The original page had a dedicated "My Badges" button in the header section:

```tsx
// original lines 553–565:
<Link href="/learning/badges" ...>
  <Award size={13} />
  <span className="hidden sm:inline">My Badges</span>
</Link>
```

This was the primary way to navigate to the badge collection from the courses page. The new design replaced it with "FAQs" → `/learning` (wrong destination).

### Fix
**Already described in CF-04** — change the "FAQs" button to "My Badges" linking to `/learning/badges`.

**Dependency:** Resolved by CF-04.

---

## CM-03 — Price not shown on paid locked courses

### Problem
When `isLocked=true` for a paid course, the lock overlay shows:
```
🔒
"Complete previous module to unlock"   ← already wrong per CF-02
```

There is **no price shown anywhere** on a locked `ModuleCard`. The original `CourseCard` showed `₹{price}` in a badge on the thumbnail and "Buy — ₹X" in the CTA row. A member has no way to know what a module costs without navigating away.

### Fix
This is addressed jointly with **CF-02**. The updated lock overlay from CF-02 already includes:

```typescript
{course.price > 0 && (
  <div style={{ marginTop: 4, color: "#ffe000", fontSize: 13, fontWeight: 700 }}>
    ₹{(course.price as number).toLocaleString("en-IN")}
  </div>
)}
```

Additionally, add a small price chip in the details area (bottom of the card) so price is visible even before the lock overlay is considered. In the details section (after the duration line, lines 159–162):

```typescript
{/* Price chip — shown only for paid courses without access */}
{!course.hasAccess && !enrollment && course.price > 0 && (
  <div style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 6, background: "rgba(255,224,0,0.1)", border: "1px solid rgba(255,224,0,0.25)" }}>
    <span style={{ color: "#ffe000", fontSize: 11, fontWeight: 700 }}>
      ₹{(course.price as number).toLocaleString("en-IN")}
    </span>
  </div>
)}
```

---

## CD-01 — `SavedVideoCard` href uses wrong fields

### Problem
`WatchHistoryItem` (defined in `tbt-user-web/types/index.ts` lines 802–824) does **not** have an `id` field or a `lessonId` field. Its relevant fields are:

| Field | Type | Notes |
|---|---|---|
| `type` | `"workshop" \| "course"` | discriminator |
| `episodeId` | `string` | the watched episode's ID |
| `courseId` | `string?` | course items only |
| `workshopSlug` | `string?` | workshop items only |

Current `SavedVideoCard` href (lines 233–237):

```typescript
const href =
  item.type === "course"
    ? `/learning/${item.id ?? item.courseId}${item.lessonId ? `?lesson=${item.lessonId}` : ""}`
    : `/workshop/${item.id ?? item.workshopSlug}`;
```

- `item.id` → always `undefined` (field does not exist) — falls through to `item.courseId` ✓ for courses
- `item.lessonId` → always `undefined` (field does not exist) — no lesson param appended
- Result for courses: `/learning/${courseId}` — navigates to course overview, **not the specific episode**
- Result for workshops: `/workshop/${item.id ?? item.workshopSlug}` → `item.id` is undefined, falls to `item.workshopSlug` ✓

The course href is missing the episode deep-link. The member lands on the course overview and has to find the episode manually.

### Fix

```typescript
// Was:
const href =
  item.type === "course"
    ? `/learning/${item.id ?? item.courseId}${item.lessonId ? `?lesson=${item.lessonId}` : ""}`
    : `/workshop/${item.id ?? item.workshopSlug}`;

// Replace with:
const href =
  item.type === "course"
    ? `/learning/${item.courseId}?lesson=${item.episodeId}`
    : `/workshop/${item.workshopSlug}`;
```

Both `item.courseId` and `item.episodeId` are always defined for their respective `type` values per the `WatchHistoryItem` interface. `item.workshopSlug` is always defined for workshop items.

---

## CD-02 — `SavedVideoCard` title uses wrong field

### Problem
`WatchHistoryItem` does **not** have a `title` field. The current title render (lines 325–326):

```typescript
{item.title ?? item.workshopTitle ?? item.courseTitle}
```

- `item.title` → `undefined` (field does not exist) — always falls through
- `item.workshopTitle` → exists for workshops ✓
- `item.courseTitle` → exists for courses ✓

This works at runtime (the fallbacks save it) but it surfaces `item.courseTitle` / `item.workshopTitle` — which is the **course/workshop name**, not the specific **episode title** that was watched. For the "Saved Videos" context, showing the episode title is more informative.

`WatchHistoryItem` has `episodeTitle: string` — the title of the specific watched episode.

### Fix

```typescript
// Was:
{item.title ?? item.workshopTitle ?? item.courseTitle}

// Replace with:
{item.episodeTitle ?? item.workshopTitle ?? item.courseTitle}
```

`item.episodeTitle` is a non-optional `string` on `WatchHistoryItem`, so the fallbacks are only safety nets for type narrowing.

---

## Implementation order

Apply in this sequence to avoid dependency issues:

1. **CF-01** — add `enrollLoading`, gate grid on `catalogLoading || enrollLoading`
2. **CF-03** — add `useEffect` to reset `showAll` on filter change
3. **CF-04 / CM-02** — replace "FAQs" → "My Badges" link → `/learning/badges`
4. **CF-02 / CM-03** — update lock overlay text + price display
5. **CM-01** — add course count label to header
6. **CD-01** — fix `SavedVideoCard` href (`courseId` + `episodeId`)
7. **CD-02** — fix `SavedVideoCard` title (`episodeTitle`)
8. **CF-05** — no additional code; resolved by CF-01

All changes are confined to `tbt-user-web/app/(platform)/courses/page.tsx`.

---

## Key invariants (do not break)

1. `course.hasAccess` is the server-authoritative field — never derive lock state from price alone.
2. `useMyEnrollments()` returns `res.data` directly (the array) — `enrollments ?? []` is the correct access pattern.
3. `WatchHistoryItem` has `episodeId` (not `id`), `episodeTitle` (not `title`), `courseId` (optional, course items), `workshopSlug` (optional, workshop items).
4. `useCourses()` returns `{ data: Course[], meta: {...} }` — items are at `catalogData?.data`.
5. `visibleCourses` drives `ModuleCard index` prop — after CF-03 this is safe since `showAll` resets with filters.
6. The `updateProfile.mutate({ businessType: null })` call for "Show all" is correct — `null` clears the track.
