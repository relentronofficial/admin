# COURSE_BUSINESS_TYPE_SPECKIT.md

## Goal
Replace the current "Browse by Module" card/tab system on `/courses` with a member-profile-driven automatic course filter. Members are classified as **Product / Service / Coaching** entrepreneurs; the courses page auto-shows only courses tagged to their track. The old `/courses/[module]` sub-routes are removed entirely.

**No performance regression.** All filtering is server-side (the backend already caches by `moduleTitle`). No extra DB round-trips: `useMe` is globally cached; `useCourses` uses its own 60 s stale-time keyed by params.

---

## Background — What Already Exists

| Piece | State |
|---|---|
| `courses.module` (VARCHAR) | Stores `"Product"`, `"Service"`, `"Coach"` per course |
| `members.business_type` (VARCHAR?) | Stores free-text business type, linked to `business_types` master table |
| `GET /api/user/me` | Already returns `businessType` in the response |
| `PATCH /api/user/me` | Already accepts and saves `businessType` (user controller line 413) |
| `GET /api/user/courses?moduleTitle=X` | Already filters by module + caches per-module at `courses:catalog:v2:...:X` |
| `courses.service.ts ListCoursesParams` | Already has `moduleTitle?: string` |
| `types/index.ts` Me type | Already has `businessType?: string | null` at line 912 |
| `onboarding/schema.ts onboardingUpdateSchema` | Already whitelists `businessType` |
| Admin `courses/page.tsx` module dropdown | `Product`, `Service`, `CoachX` (value `"Coach"`) |
| Admin `members/page.tsx` edit form | `businessType` is set from `editingMember.businessType` but rendered as free-text (no structured select) |

---

## Items

### BT-01 — Rename course module "Coach" → "Coaching"

**Why:** User-facing label is "CoachX" in admin, the value in DB is `"Coach"`. Aligning to `"Coaching"` makes the value match the member's businessType options.

**Backend — `tbt-admin/backend/src/plugins/prisma.ts` startup block:**
```typescript
// Idempotent — WHERE module = 'Coach' matches 0 rows after first run
await prisma.$executeRawUnsafe("UPDATE courses SET module = 'Coaching' WHERE module = 'Coach'");
```
Add after the existing `ALTER TABLE` statements. This runs on every cold start but is a no-op after the first execution.

**Admin — `tbt-admin/admin-panel/app/courses/page.tsx` module dropdown (line ~439):**
```tsx
// Before:
<option value="Coach">CoachX</option>
// After:
<option value="Coaching">Coaching</option>
```

**Cache impact:** Existing cache keys with `Coach` in them naturally expire within 60 s. No explicit flush needed.

---

### BT-02 — Member businessType — structured dropdown in admin

**Why:** `businessType` is currently a free-text field fed to the `business_types` master table. It must now be constrained to exactly `Product | Service | Coaching` to match course module values.

**Admin — `tbt-admin/admin-panel/app/members/page.tsx` edit form:**

Locate the current `businessType` field in the edit form state (line 314: `businessType: editingMember.businessType || ""`). Find the input that renders it and replace with a structured select. Add it near the existing `productServiceType` dropdown.

```tsx
<div>
  <label className="block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-2 font-rajdhani">
    Course Track
  </label>
  <select
    value={editForm.businessType}
    onChange={(e) => setEditField("businessType", e.target.value)}
    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm appearance-none"
  >
    <option value="">— Not set —</option>
    <option value="Product">Product</option>
    <option value="Service">Service</option>
    <option value="Coaching">Coaching</option>
  </select>
</div>
```

The Zod schema already has `businessType: z.string().optional().or(z.literal(""))` — this stays as-is; the select just constrains user choices.

**Admin member VIEW panel:** Add an info row:
```tsx
<InfoItem label="Course Track" value={viewingMember.businessType || 'Not set'} />
```

**Admin member CREATE form:** If the create form collects basic fields (phone/name), businessType can be left for post-creation editing. If the create form is the same component as the edit form, the select appears automatically.

**Backend:** No change. `members/controller.ts` already calls `ensureMasterEntry(prisma, 'businessType', value)` on save, which upserts into the `business_types` master table. With constrained values, only `Product`, `Service`, `Coaching` will ever be inserted there.

---

### BT-03 — Add businessType to user.service.ts updateProfile

**File:** `tbt-user-web/lib/api/services/user.service.ts`

```typescript
updateProfile: (data: {
  firstName?: string;
  lastName?: string;
  phone?: string;
  dob?: string | null;
  city?: string | null;
  state?: string | null;
  businessName?: string | null;
  businessType?: string | null;   // ← add this
}) =>
  apiClient.patch<never, ApiResponse<Partial<MemberProfile>>>("/api/user/me", data),
```

Backend `PATCH /api/user/me` already handles this field — no backend change needed.

---

### BT-04 — Remove "Browse by Module" section from /courses

**File:** `tbt-user-web/app/(platform)/courses/page.tsx`

Delete:
- `MODULE_TABS` constant (line 27)
- `MODULE_CONFIG` constant (lines 29-33)
- The entire "Browse by Module" `<div>` section (lines 622-677 — the `space-y-3` block with the 3 clickable cards)
- Unused imports: `ShoppingBag`, `Briefcase`, `Users` from `lucide-react`

Keep everything else intact (Continue Learning, Enrolled courses, Browse All grid, search/level/sort/category filters).

---

### BT-05 — Delete /courses/[module] sub-route

**Delete:**
```
tbt-user-web/app/(platform)/courses/[module]/page.tsx
tbt-user-web/app/(platform)/courses/[module]/          ← remove directory
```

Also remove `useCourseCategories` dynamic module-tabs hook from `useTbt.ts` if it was only used by this sub-route (check for other callers first — `courses/page.tsx` uses `useCourseCategories` for category filter, not module tabs, so keep that hook).

---

### BT-06 — Auto-filter courses page by member's businessType

**File:** `tbt-user-web/app/(platform)/courses/page.tsx`

**Changes to the main `CoursesPage` component:**

1. **Import `useMe`:**
```typescript
import { useMe } from "@/lib/hooks/useUser";
```

2. **Read member's track:**
```typescript
const { data: me } = useMe();
const memberTrack = me?.businessType ?? null; // "Product" | "Service" | "Coaching" | null
```

3. **Wire into `useCourses`:**
```typescript
const { data: catalogData, isLoading: catalogLoading } = useCourses({
  search: search || undefined,
  level: level !== "all" ? level : undefined,
  sort,
  category: category !== "all" ? category : undefined,
  moduleTitle: memberTrack ?? undefined,  // ← add this line
  limit: 24,
});
```

This passes `moduleTitle` to the backend only when `memberTrack` is set; when null the full catalog is returned. The backend cache key includes `moduleTitle`, so each track's list is cached independently.

4. **Track selector / banner (shown only when `memberTrack` is null):**

Add this just above the "Browse All" section heading, rendered only when `me` has loaded and `memberTrack` is null:

```tsx
{me && !memberTrack && (
  <div
    className="flex flex-col sm:flex-row sm:items-center gap-4 px-5 py-4 rounded-2xl"
    style={{
      background: "color-mix(in srgb, var(--color-accent) 8%, var(--color-bg-surface))",
      border: "1px solid color-mix(in srgb, var(--color-accent) 25%, transparent)",
    }}
  >
    <div className="flex-1">
      <p className="text-[13px] font-semibold" style={{ color: "var(--color-text-normal)" }}>
        Select your business track
      </p>
      <p className="text-[11px] mt-0.5" style={{ color: "var(--color-text-secondary)" }}>
        We'll show you the most relevant courses for your business.
      </p>
    </div>
    <div className="flex gap-2">
      {(["Product", "Service", "Coaching"] as const).map((track) => (
        <button
          key={track}
          onClick={() => updateProfile.mutate({ businessType: track })}
          disabled={updateProfile.isPending}
          className="px-4 py-2 rounded-xl text-[12px] font-semibold transition-all duration-150"
          style={{
            background: "var(--color-surface-overlay)",
            border: "1px solid var(--color-border-subtle)",
            color: "var(--color-text-secondary)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "var(--color-accent)";
            (e.currentTarget as HTMLElement).style.color = "#fff";
            (e.currentTarget as HTMLElement).style.borderColor = "transparent";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "var(--color-surface-overlay)";
            (e.currentTarget as HTMLElement).style.color = "var(--color-text-secondary)";
            (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border-subtle)";
          }}
        >
          {track}
        </button>
      ))}
    </div>
  </div>
)}
```

5. **Track badge + "Change" link (shown when `memberTrack` is set):**

Add just below the "Browse All" `<h2>` heading:

```tsx
{memberTrack && (
  <div className="flex items-center gap-2">
    <span
      className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
      style={{
        background: "color-mix(in srgb, var(--color-accent) 12%, var(--color-surface-overlay))",
        border: "1px solid color-mix(in srgb, var(--color-accent) 28%, transparent)",
        color: "var(--color-accent)",
      }}
    >
      {memberTrack} Track
    </span>
    <button
      onClick={() => updateProfile.mutate({ businessType: null })}
      className="text-[11px] underline underline-offset-2"
      style={{ color: "var(--color-text-subtle)" }}
    >
      Show all
    </button>
  </div>
)}
```

6. **Add `useUpdateProfile` import and hook:**
```typescript
import { useMe, useUpdateProfile } from "@/lib/hooks/useUser";
// inside CoursesPage:
const updateProfile = useUpdateProfile();
```

`useUpdateProfile` already invalidates `["user", "me"]` on success in `useTbt.ts` — so after saving `businessType`, `useMe` re-fetches and the `memberTrack` changes, re-triggering `useCourses` with the new `moduleTitle`.

**"Clear filters" button (already exists at line 838):** Also clear `moduleTitle` effect if needed — since the filter is derived from `me.businessType` (not local state), "Clear filters" only resets search/level/sort/category. The track filter is always derived from the member profile, not a filter-reset target.

---

### BT-07 — useUpdateProfile invalidates ["user", "me"]

**File:** `tbt-user-web/lib/hooks/useUser.ts`

Verify `useUpdateProfile` already calls:
```typescript
onSuccess: () => queryClient.invalidateQueries({ queryKey: ["user", "me"] })
```

If not, add it. This is what causes the courses page to refilter automatically after track selection.

---

### BT-08 — Self-onboarding businessType field

**File:** `tbt-user-web/` onboarding wizard component (wherever profile fields are rendered)

`businessType` is already in `onboardingUpdateSchema` — no backend change.

In the onboarding profile step, add a `businessType` select alongside existing profile fields:

```tsx
<div>
  <label>Business Track</label>
  <select value={form.businessType ?? ""} onChange={(e) => setField("businessType", e.target.value || null)}>
    <option value="">Select your track</option>
    <option value="Product">Product — Build & sell products</option>
    <option value="Service">Service — Offer your expertise</option>
    <option value="Coaching">Coaching — Coach & mentor others</option>
  </select>
</div>
```

This ensures new members who complete onboarding arrive at `/courses` with a track already set, so the selector banner never appears for them.

---

## Files Changed Summary

| File | Change |
|---|---|
| `tbt-admin/backend/src/plugins/prisma.ts` | BT-01: `UPDATE courses SET module = 'Coaching' WHERE module = 'Coach'` |
| `tbt-admin/admin-panel/app/courses/page.tsx` | BT-01: Module dropdown Coach → Coaching |
| `tbt-admin/admin-panel/app/members/page.tsx` | BT-02: Add Course Track structured select + view info item |
| `tbt-user-web/lib/api/services/user.service.ts` | BT-03: Add `businessType` to updateProfile type |
| `tbt-user-web/app/(platform)/courses/page.tsx` | BT-04 + BT-06: Remove module cards; add useMe + moduleTitle filter + track selector + track badge |
| `tbt-user-web/app/(platform)/courses/[module]/page.tsx` | BT-05: **DELETE** |
| `tbt-user-web/lib/hooks/useUser.ts` | BT-07: Confirm/add `["user","me"]` invalidation in useUpdateProfile |

No new API routes. No new DB columns. No new hooks. No schema changes.

---

## Performance Notes

- `useCourses({ moduleTitle: "Product" })` caches at key `courses:catalog:v2:1:24:newest:::Product` — separate Redis entry per track, 60 s TTL
- `useMe` is shared globally (one request, cached at `["user","me"]`) — no extra round-trip for the filter
- Track selector banner → `PATCH /api/user/me` → single fast write → `useMe` re-fetches once → page re-renders with filtered courses. Total perceived latency ≤ 200 ms on warm backend
- Removing the `/courses/[module]` sub-route eliminates a whole-page navigation that previously cost a full SSR + TanStack hydration cycle

---

## Out of Scope

- Showing courses from multiple tracks at once (e.g., "also check Service courses") — future enhancement
- Course recommendation engine — future enhancement
- The existing `productServiceType` field (Product-based / Service-based / Both / Other) remains unchanged as a separate business profiling field; it is not connected to course filtering
- Admin-side course module filtering in the admin courses list — admin sees all courses, not filtered by module
