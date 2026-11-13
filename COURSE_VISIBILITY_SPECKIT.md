# COURSE_VISIBILITY_SPECKIT.md

**Status**: Ready for implementation
**Feature**: Admin-controlled category-based course visibility
**Scope**: Backend (Fastify) + Admin Panel (Next.js) + no user-web changes required
**Prefix**: CV-01 – CV-12
**Related speckits**: `COURSE_BUSINESS_TYPE_SPECKIT.md` (BT-xx), `COURSE_MODULES_SPECKIT.md`, `COURSES_PAGE_PERSONALIZATION_SPECKIT.md`

---

## Goal

Make course catalog visibility admin-controlled instead of fully open. Today, every active member sees every published course. After this change, courses are visible only to members whose admin-assigned business categories match the course's target audience. General Content courses remain visible to all.

---

## What Already Exists (do not re-implement)

| Piece | Location | Notes |
|---|---|---|
| `courses.applicable_business_types TEXT[]` | DB column (startup ALTER) | Already stores `["Product","Service","Coaching"]` but is only used today for module-tab filtering, NOT catalog filtering |
| `courses.module VARCHAR` | DB column | Single value `Product / Service / Coaching / null` — drives module tabs on `/courses`. UNRELATED to visibility. Do not conflate. |
| `members.business_type TEXT` | DB column | Single, member-self-selected track (BT-02 system). Drives the module-tab filter banner on `/courses`. KEEP as-is — this spec adds a separate admin-assigned multi-category column. |
| `applicable_business_types` filter in `listCourseModuleTabsHandler` | `user/controller.ts:543` | Filters which module tabs appear for a member. Pattern to reuse in the catalog handler. |
| `CourseAccess` Prisma model | Backend | Per-member explicit access grant. This spec does NOT change it. Members with `CourseAccess` records are already handled by the "My Courses" / enrolled sections — no visibility override needed in the catalog. |

---

## Two Separate Systems — Do Not Conflate

| System | Column | Who sets it | Semantics |
|---|---|---|---|
| **BT-02 (existing)** | `members.business_type TEXT` | Member self-selects on `/courses` page | Single track; drives module tab banner; can be reset to "Show all" |
| **This spec (new)** | `members.business_categories JSONB` | Admin assigns in member edit form | Multi-value; drives mandatory catalog visibility filter; member cannot override |
| **Module tab (existing)** | `courses.module VARCHAR` | Admin sets per course | Content categorization for `/courses` tab UI. Not a visibility gate. |
| **Visibility gate (this spec)** | `courses.applicable_business_types TEXT[]` | Admin sets per course (extend existing column with "General" semantics + UI) | Who can SEE the course in catalog |

---

## Business Category Keys

| Key (stored in DB) | Display Name |
|---|---|
| `"Product"` | Product-Based Business |
| `"Service"` | Service-Based Business |
| `"Coaching"` | Coaching Business |
| *(null / empty array)* | General Content — visible to all members |

"General Content" is NOT stored as a string value. Null / empty `applicable_business_types` IS the "General Content" signal. In the admin UI, a "General Content" checkbox simply clears all other selections.

---

## Visibility Rule (applied server-side on every catalog/detail request)

```
isCourseVisible(course, member) =>
  course.applicable_business_types is null OR empty          → true (General Content)
  OR member.business_categories is null OR empty             → true (member not yet categorised — backward compat)
  OR course.applicable_business_types intersects member.business_categories  → true
  OR member.batchId is in course.batch_visibility_ids        → true (batch override)
  → otherwise false
```

**Backward-compat guarantee**: existing members have `business_categories = []` until an admin assigns them → they see ALL courses as before. Existing courses have `applicable_business_types = {}` → they are General Content and visible to everyone. No regression on deploy.

---

## Data Model Changes

### New raw SQL columns (startup ALTER in `prisma.ts`)

```sql
-- Admin-assigned member business categories (multi-value)
ALTER TABLE members ADD COLUMN IF NOT EXISTS business_categories JSONB DEFAULT '[]';

-- Batch-level visibility override on courses
ALTER TABLE courses ADD COLUMN IF NOT EXISTS batch_visibility_ids JSONB DEFAULT '[]';
```

`applicable_business_types TEXT[]` already exists — no new column needed for course categories.

### TypeScript types (backend — `backend/src/lib/courseVisibility.ts`)

```typescript
export type BizCategoryKey = "Product" | "Service" | "Coaching";

export interface CourseVisCourse {
  id: string;
  applicableBusinessTypes: string[] | null;
  batchVisibilityIds: string[];
}

export interface CourseVisMember {
  businessCategories: string[];
  batchId: string | null;
}
```

---

## Items

---

### CV-01 — DB: Add `members.business_categories` column

**File**: `tbt-admin/backend/src/plugins/prisma.ts` — startup ALTER block

```typescript
await prisma.$executeRawUnsafe(
  `ALTER TABLE members ADD COLUMN IF NOT EXISTS business_categories JSONB DEFAULT '[]'`
);
```

Idempotent. Default `'[]'` = member not yet categorised = backward compat (sees all courses).

No Prisma model update. Read/write via raw SQL.

---

### CV-02 — DB: Add `courses.batch_visibility_ids` column

**File**: `tbt-admin/backend/src/plugins/prisma.ts` — startup ALTER block

```typescript
await prisma.$executeRawUnsafe(
  `ALTER TABLE courses ADD COLUMN IF NOT EXISTS batch_visibility_ids JSONB DEFAULT '[]'`
);
```

Idempotent. Empty array = no batch overrides.

---

### CV-03 — Backend: Pure visibility function + Vitest tests

**New file**: `tbt-admin/backend/src/lib/courseVisibility.ts`

```typescript
import type { CourseVisCourse, CourseVisMember } from './courseVisibility.types.js';

export function isCourseVisible(course: CourseVisCourse, member: CourseVisMember): boolean {
  // General Content: no target audience restriction
  const types = course.applicableBusinessTypes ?? [];
  if (types.length === 0) return true;

  // Member not yet categorised by admin: backward compat, see everything
  const cats = member.businessCategories ?? [];
  if (cats.length === 0) return true;

  // Batch-level override
  if (member.batchId && course.batchVisibilityIds.includes(member.batchId)) return true;

  // Category intersection
  return types.some(t => cats.includes(t));
}

export function filterVisibleCourses<T extends CourseVisCourse>(
  courses: T[],
  member: CourseVisMember,
): T[] {
  return courses.filter(c => isCourseVisible(c, member));
}
```

**New test file**: `tbt-admin/backend/src/lib/courseVisibility.test.ts`

Cover at minimum:
- General course (empty `applicableBusinessTypes`) → always visible
- Uncategorised member (empty `businessCategories`) → always visible
- Category match (Product member + Product course) → visible
- Category mismatch (Service member + Product course) → hidden
- Multi-category member with partial match → visible
- Multi-category course with partial match → visible
- Batch override (member.batchId in `batchVisibilityIds`) → visible even if category mismatches
- Null-safe: `null` fields treated as empty arrays

**Add to `vitest.config.ts`**:

```typescript
// in backend/vitest.config.ts#include array
"src/lib/courseVisibility.test.ts",
```

Without this line the test is silently skipped (see CLAUDE.md pitfall note on vitest.config.ts).

---

### CV-04 — Backend: Filter `listUserCoursesHandler` by member visibility

**File**: `tbt-admin/backend/src/modules/user/controller.ts`

The handler at line ~586 (`listUserCoursesHandler`) currently caches with key `courses:catalog:v3:...`. Changes:

1. **Fetch member context before cache lookup**:

```typescript
// After extracting page/limit/search etc. from request.query:
const memberCtxRows = await request.server.prisma.$queryRawUnsafe<{
  business_categories: string[] | null;
  batch_id: string | null;
}[]>(
  `SELECT business_categories, batch_id FROM members WHERE id = $1::uuid`,
  request.memberId!,
).catch(() => []);

const memberCtx: CourseVisMember = {
  businessCategories: (memberCtxRows[0]?.business_categories as string[] | null) ?? [],
  batchId: memberCtxRows[0]?.batch_id ?? null,
};

// Normalise for cache key: sorted, joined
const catKey = [...memberCtx.businessCategories].sort().join(',');
```

2. **Bump cache key version v3 → v4** and append member category signature:

```typescript
const catalogKey = canCache
  ? `courses:catalog:v4:${page}:${limit}:${sort ?? ''}:${category ?? ''}:${level ?? ''}:${moduleTitle ?? ''}:${moduleArr ? moduleArr.slice().sort().join(',') : ''}:cats:${catKey}:batch:${memberCtx.batchId ?? ''}`
  : null;
```

3. **Add visibility columns to the SQL projection** (already fetching `applicable_business_types`; add `batch_visibility_ids`):

In the existing raw SQL `SELECT`, add:
```sql
c.applicable_business_types, c.batch_visibility_ids
```

4. **Apply `filterVisibleCourses` before caching / returning**:

After building `entries` from the query result, before `return ok(reply, ...)`:

```typescript
import { filterVisibleCourses } from '../../lib/courseVisibility.js';

const visibleEntries = filterVisibleCourses(
  entries.map(e => ({
    ...e,
    applicableBusinessTypes: (e.applicable_business_types as string[] | null) ?? [],
    batchVisibilityIds: (e.batch_visibility_ids as string[] | null) ?? [],
  })),
  memberCtx,
);
// Use visibleEntries (and its .length for total) in the cached payload and response
```

5. **Do NOT expose `applicableBusinessTypes` or `batchVisibilityIds` in the response** — strip them before sending to the client. These are internal filter inputs only; the client just receives the filtered list.

**Performance note**: The `memberCtxRows` lookup is one indexed query per request. When the member's `business_categories = []` (uncategorised), `catKey = ''` and `filterVisibleCourses` returns all courses (no-op). The cache is shared across all uncategorised members, preserving the existing cache hit rate.

---

### CV-05 — Backend: Gate `getCourseDetailHandler` by visibility

**File**: `tbt-admin/backend/src/modules/user/controller.ts`

In `getCourseDetailHandler` (around line 969 where `isCourseInMemberModules` is already checked):

After loading the course and the existing module check, add a visibility check:

```typescript
import { isCourseVisible } from '../../lib/courseVisibility.js';

// Load member visibility context (can be a shared helper to avoid duplication with CV-04)
const memberCtxRows = await request.server.prisma.$queryRawUnsafe<{
  business_categories: string[] | null;
  batch_id: string | null;
}[]>(
  `SELECT business_categories, batch_id FROM members WHERE id = $1::uuid`,
  request.memberId!,
).catch(() => []);

const memberCtx: CourseVisMember = {
  businessCategories: (memberCtxRows[0]?.business_categories as string[] | null) ?? [],
  batchId: memberCtxRows[0]?.batch_id ?? null,
};

const rawVis = await request.server.prisma.$queryRawUnsafe<{
  applicable_business_types: string[] | null;
  batch_visibility_ids: string[] | null;
}[]>(
  `SELECT applicable_business_types, batch_visibility_ids FROM courses WHERE id = $1::uuid`, id,
).catch(() => []);

const courseVis: CourseVisCourse = {
  id,
  applicableBusinessTypes: (rawVis[0]?.applicable_business_types ?? []) as string[],
  batchVisibilityIds: (rawVis[0]?.batch_visibility_ids ?? []) as string[],
};

if (!isCourseVisible(courseVis, memberCtx)) {
  return reply.status(403).send({ success: false, error: 'Course not available for your account', data: null });
}
```

Place this check AFTER the `isPublished` / `isActive` checks (around line 980) and BEFORE (or together with) the existing `isCourseInMemberModules` check. Order: published → active → visibility → module access.

**Note**: The same 403 guard should also be applied to the other deep-read handlers that are protected by `isCourseInMemberModules` (enrollment, quiz, progress, playback, episode resources, episode tasks) — but only the catalog list and course detail need the visibility check; the deeper routes already require `CourseAccess` which implies explicit assignment. Add the guard only to CV-05's specific handler for now; defer to the team if other routes need it.

---

### CV-06 — Backend: Accept `businessCategories` in member update endpoint

**File**: `tbt-admin/backend/src/modules/members/schema.ts`

Add to `updateMemberSchema` (the schema used by admin-side member update — NOT `onboardingUpdateSchema`):

```typescript
businessCategories: z.array(z.enum(["Product", "Service", "Coaching"])).optional(),
```

**File**: `tbt-admin/backend/src/modules/members/controller.ts`

In the update handler, destructure `businessCategories` before spreading into Prisma (same pattern as `batches.xp_per_day`):

```typescript
const { businessCategories, ...restBody } = body;

// After prisma.member.update(...restBody...):
if (businessCategories !== undefined) {
  await req.server.prisma.$executeRawUnsafe(
    `UPDATE members SET business_categories = $1::jsonb WHERE id = $2::uuid`,
    JSON.stringify(businessCategories),
    memberId,
  );
}
```

**Reading it back**: Add `business_categories` to the SELECT projection in the member detail/list queries via supplementary raw SQL, same pattern as `batches.xp_per_day`. Include `businessCategories` in the response as `string[]`.

**Do NOT add to `onboardingUpdateSchema`** — members cannot self-assign business categories; this is admin-only.

---

### CV-07 — Backend: Accept `applicableBusinessTypes` + `batchVisibilityIds` in course write endpoints

**File**: `tbt-admin/backend/src/modules/courses/schema.ts`

Add to both `createCourseSchema` and `updateCourseSchema`:

```typescript
applicableBusinessTypes: z.array(z.enum(["Product", "Service", "Coaching"])).optional(),
batchVisibilityIds: z.array(z.string().uuid()).optional(),
```

**File**: `tbt-admin/backend/src/modules/courses/controller.ts`

`applicable_business_types` is already a raw SQL column persisted via `rawSets` / `rawVals` pattern (see line ~94 and ~159). Add `batch_visibility_ids` to the same update pattern:

```typescript
// Destructure (applicable_business_types is already handled; add batch_visibility_ids)
const { batchVisibilityIds, ...prismaBody } = body;

// In the rawSets block (after the existing applicable_business_types handling):
if ('batchVisibilityIds' in body) {
  rawSets.push(`batch_visibility_ids = $${rawVals.length + 1}::jsonb`);
  rawVals.push(JSON.stringify(batchVisibilityIds ?? []));
}
```

For `applicableBusinessTypes`: the existing handler already accepts and persists `applicableBusinessTypes` via `applicable_business_types`. Verify the Zod schema now correctly constrains values to `["Product", "Service", "Coaching"]` (currently the schema may accept any string — tighten it).

---

### CV-08 — Backend: Include visibility fields in admin course list/detail responses

**File**: `tbt-admin/backend/src/modules/courses/controller.ts`

The admin routes at `GET /api/courses` and `GET /api/courses/:id` must return `batchVisibilityIds` alongside the already-returned `applicableBusinessTypes`. The admin sees ALL courses regardless of visibility — no filter is applied to admin routes.

In the supplementary raw SQL projection (lines ~46-54 and ~116-128):

```typescript
// Add batch_visibility_ids to the SELECT
`SELECT id, module, applicable_business_types, batch_visibility_ids FROM courses WHERE id = ANY($1::uuid[])`, ids,

// Map it in the result
batchVisibilityIds: (r.batch_visibility_ids as string[] | null) ?? [],
```

---

### CV-09 — Admin Panel: Member Edit Form — Business Categories

**File**: `tbt-admin/admin-panel/app/members/page.tsx`

In the member edit form (the edit modal / slide-out panel), add a new section **"Assigned Business Categories"** with three checkboxes. This is SEPARATE from the existing "Course Track" single-select (BT-02). Label it differently to avoid confusion.

```tsx
{/* Assigned Business Categories (admin-controlled visibility) */}
<div>
  <label className="block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-2 font-rajdhani">
    Assigned Business Categories
  </label>
  <p className="text-[11px] text-[#606060] mb-3">
    Controls which courses are visible to this member. Leave all unchecked to show all courses.
  </p>
  {(["Product", "Service", "Coaching"] as const).map((cat) => (
    <label key={cat} className="flex items-center gap-2 mb-2 cursor-pointer">
      <input
        type="checkbox"
        checked={(editForm.businessCategories ?? []).includes(cat)}
        onChange={(e) => {
          const current = editForm.businessCategories ?? [];
          setEditField(
            "businessCategories",
            e.target.checked ? [...current, cat] : current.filter((c) => c !== cat),
          );
        }}
        className="accent-[#dc2626] w-4 h-4"
      />
      <span className="text-sm text-[#f0f0f0]">
        {cat === "Product" ? "Product-Based Business" : cat === "Service" ? "Service-Based Business" : "Coaching Business"}
      </span>
    </label>
  ))}
</div>
```

**Edit form state**: Add `businessCategories: editingMember.businessCategories ?? []` to the form initialisation (alongside existing fields like `businessType`, `name`, etc.).

**View panel** (the read-only member detail view): Add an info row:
```tsx
<InfoItem
  label="Assigned Business Categories"
  value={
    viewingMember.businessCategories?.length
      ? viewingMember.businessCategories.join(", ")
      : "All courses (no restriction)"
  }
/>
```

**Hook update**: The existing `useUpdateMember` in `useMembers.ts` must pass `businessCategories` in the PATCH body. No new hook needed — just ensure the field is included in the mutation payload.

---

### CV-10 — Admin Panel: Course Form — Visibility Categories (extend `applicableBusinessTypes` UI)

**File**: `tbt-admin/admin-panel/app/courses/page.tsx`

Currently there is no admin UI for `applicable_business_types` (it's a DB column with no edit control). Add a **"Course Visibility"** section to the course create/edit form, positioned below the existing `module` dropdown:

```tsx
{/* Course Visibility */}
<div>
  <label className="block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-2 font-rajdhani">
    Course Visibility
  </label>
  <p className="text-[11px] text-[#606060] mb-3">
    Who can see this course? Leave all unchecked (General Content) to show to all members.
  </p>

  {/* General Content checkbox — clears specific selections */}
  <label className="flex items-center gap-2 mb-3 cursor-pointer">
    <input
      type="checkbox"
      checked={(courseForm.applicableBusinessTypes ?? []).length === 0}
      onChange={() => setCourseField("applicableBusinessTypes", [])}
      className="accent-[#dc2626] w-4 h-4"
    />
    <span className="text-sm text-[#f0f0f0] font-medium">General Content (visible to all members)</span>
  </label>

  <div className={`space-y-2 pl-1 ${(courseForm.applicableBusinessTypes ?? []).length === 0 ? "opacity-40 pointer-events-none" : ""}`}>
    {(["Product", "Service", "Coaching"] as const).map((cat) => (
      <label key={cat} className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={(courseForm.applicableBusinessTypes ?? []).includes(cat)}
          onChange={(e) => {
            const current = courseForm.applicableBusinessTypes ?? [];
            setCourseField(
              "applicableBusinessTypes",
              e.target.checked ? [...current, cat] : current.filter((c) => c !== cat),
            );
          }}
          className="accent-[#dc2626] w-4 h-4"
        />
        <span className="text-sm text-[#d0d0d0]">
          {cat === "Product" ? "Product-Based Business" : cat === "Service" ? "Service-Based Business" : "Coaching Business"}
        </span>
      </label>
    ))}
  </div>
</div>
```

**Behaviour**: When "General Content" is checked, the three specific checkboxes are greyed out and non-interactive. Checking any specific category automatically unchecks General Content (by making the array non-empty).

**Form state initialisation**: `applicableBusinessTypes: editingCourse.applicableBusinessTypes ?? []`

**Hooks**: `useCreateVodCourse` and `useUpdateVodCourse` in `useTbt.ts` should already pass through `applicableBusinessTypes` if the field exists in the mutation body — verify they include it. If the hooks only spread known fields, add `applicableBusinessTypes` to the payload type and spread.

---

### CV-11 — Admin Panel: Course Form — Batch Visibility

**File**: `tbt-admin/admin-panel/app/courses/page.tsx`

Add a **"Batch Access"** section to the course create/edit form, below CV-10's Visibility section:

```tsx
{/* Batch Visibility */}
<div>
  <label className="block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-2 font-rajdhani">
    Batch Visibility (Optional)
  </label>
  <p className="text-[11px] text-[#606060] mb-3">
    Members of selected batches can see this course regardless of their assigned business categories.
  </p>
  {(batches ?? []).map((batch) => (
    <label key={batch.id} className="flex items-center gap-2 mb-2 cursor-pointer">
      <input
        type="checkbox"
        checked={(courseForm.batchVisibilityIds ?? []).includes(batch.id)}
        onChange={(e) => {
          const current = courseForm.batchVisibilityIds ?? [];
          setCourseField(
            "batchVisibilityIds",
            e.target.checked ? [...current, batch.id] : current.filter((id) => id !== batch.id),
          );
        }}
        className="accent-[#dc2626] w-4 h-4"
      />
      <span className="text-sm text-[#d0d0d0]">{batch.name}</span>
    </label>
  ))}
  {!batches?.length && (
    <p className="text-[11px] text-[#606060]">No batches configured yet.</p>
  )}
</div>
```

**Batch list**: Use the existing `useListBatches` (or equivalent batch list hook already available in the admin panel) to populate `batches`. If the courses page doesn't already call this hook, add it.

**Form state initialisation**: `batchVisibilityIds: editingCourse.batchVisibilityIds ?? []`

**Note**: This grants VISIBILITY only (member can see the course in the catalog). It does not auto-grant `CourseAccess` (enrollment/playback). The admin still uses the existing "Grant Access" flow in the Access tab for that.

---

### CV-12 — Admin Panel: Course List — Visibility Badges

**File**: `tbt-admin/admin-panel/app/courses/page.tsx`

On each course card or row in the admin list, add small inline badges indicating visibility audience. Add below the existing `module` badge or alongside price/status:

```tsx
{/* Visibility badges */}
{(course.applicableBusinessTypes ?? []).length === 0 ? (
  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-[#2a2a2a] text-[#888]">
    General
  </span>
) : (
  (course.applicableBusinessTypes ?? []).map((t) => (
    <span
      key={t}
      className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold mr-1"
      style={{
        background: t === "Product" ? "#1e3a5f" : t === "Service" ? "#1a3d2b" : "#3d1a3d",
        color: t === "Product" ? "#60a5fa" : t === "Service" ? "#4ade80" : "#c084fc",
      }}
    >
      {t}
    </span>
  ))
)}
{(course.batchVisibilityIds ?? []).length > 0 && (
  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-[#3a2a1a] text-[#fb923c] ml-1">
    +{course.batchVisibilityIds.length} batch{course.batchVisibilityIds.length > 1 ? "es" : ""}
  </span>
)}
```

**Hook update**: Ensure `useListVodCourses` response type includes `applicableBusinessTypes: string[]` and `batchVisibilityIds: string[]`. These are returned by the admin course list endpoint after CV-08.

---

## API Change Summary

| Endpoint | Before | After |
|---|---|---|
| `GET /api/user/courses` | Returns all published courses | Returns only courses visible to the calling member (server-filtered) |
| `GET /api/user/courses/:id` | Returns course or 404/403 (module check) | Additional 403 if course not visible to member (visibility check before module check) |
| `PUT /api/members/:id` (admin) | No `businessCategories` field | Accepts optional `businessCategories: string[]` |
| `POST /api/courses` (admin) | No `batchVisibilityIds`; `applicableBusinessTypes` accepted but not schema-constrained | Both accepted + schema-constrained to enum values |
| `PUT /api/courses/:id` (admin) | Same as above | Same fix |
| `GET /api/courses`, `GET /api/courses/:id` (admin) | No `batchVisibilityIds` in response | Includes `applicableBusinessTypes: string[]` and `batchVisibilityIds: string[]` |

---

## Backward Compatibility Guarantees

| Entity | Default state after deploy | Runtime behaviour |
|---|---|---|
| Existing members (no `business_categories`) | `[]` (empty) | See ALL courses — identical to today |
| Existing courses (no `applicable_business_types`) | `{}` (empty TEXT[]) | Visible to ALL members — identical to today |
| Existing courses (no `batch_visibility_ids`) | `[]` (empty JSONB) | No batch overrides — identical to today |
| `CourseAccess` records | Unchanged | Enrolled members still use the My Courses / Continue Learning sections — no change |
| `courses.module` | Unchanged | Module tab filtering on `/courses` page — unaffected |
| BT-02 `business_type` self-select | Unchanged | Module tab banner on `/courses` page — unaffected |
| `isCourseInMemberModules` / `resolveModuleAccess` | Unchanged | Mentorship module ceiling — orthogonal system, not called by visibility |

---

## Pitfalls

1. **Destructure before Prisma spread** — `businessCategories` (on members) and `batchVisibilityIds` (on courses) are raw SQL columns not in the Prisma schema. Spreading the body directly into `prisma.member.update` or `prisma.course.update` WILL throw "Unknown field". Always destructure them first.

2. **`applicable_business_types` is `TEXT[]` not JSONB** — Use `$1::text[]` not `$1::jsonb` when writing it directly. In practice it was set up as a Postgres TEXT array, not JSONB. `batch_visibility_ids` is JSONB (new column) — use `$1::jsonb` for that one.

3. **Cache version bump is mandatory** — The catalog handler caches per key. If you add member-category filtering without bumping `v3` → `v4`, existing stale cache entries (without the category filter) will be returned to newly-categorised members. The version bump automatically expires all v3 entries.

4. **Member context query is per-request, not cached** — The `SELECT business_categories, batch_id FROM members WHERE id = $1` query in CV-04 runs on every catalog request. It is fast (single indexed PK lookup) but is NOT in Redis. Do not add Redis caching for this; member categories change rarely and a stale cache could show wrong courses.

5. **Admin routes must NOT filter by visibility** — `GET /api/courses` and `GET /api/courses/:id` (Clerk-protected) must return all courses to admin. Only the user-facing `/api/user/courses` routes apply the visibility filter. The check for this: if the handler uses `fastify.authenticate` (Clerk) it's admin-only; if `fastify.authenticateUser` (JWT cookie) it's member-facing.

6. **"General Content" = no value, not a stored value** — Do not store `"General"` in `applicable_business_types`. General Content is signalled by an empty array. If an admin checks "General Content" in the UI (CV-10), save `[]` not `["General"]`. The visibility function checks `types.length === 0` for the General Content path.

7. **Batch visibility grants visibility only** — `batch_visibility_ids` makes the course appear in the catalog for batch members. It does NOT grant `CourseAccess`. If you want a batch to both see AND enroll, the admin must also grant `CourseAccess` individually (existing flow). Document this in the admin UI tooltip.

8. **`isCourseInMemberModules` still runs** — The existing mentorship module gate at `getCourseDetailHandler` is NOT replaced by CV-05. CV-05 adds a visibility check BEFORE the module check. Both gates run in sequence: visibility → module access. A course can be visible (categories match) but still blocked by the mentorship module ceiling (`isCourseInMemberModules`).

9. **`filterVisibleCourses` runs in-memory after DB query** — The catalog SQL query does NOT include a `WHERE applicable_business_types && $1::text[]` clause (it can't because the cache is shared). The filtering is done in JS after fetching. This is correct and efficient for catalogs with < ~500 courses. If the catalog grows to thousands, revisit.

---

## Implementation Order

1. **CV-01, CV-02** — DB columns. Deploy first (idempotent, zero-impact).
2. **CV-03** — Pure function + tests. Independent of DB.
3. **CV-06, CV-07** — Schema + write endpoint changes. Enables admin to save data.
4. **CV-08** — Admin read response includes new fields. Enables admin UI to show them.
5. **CV-09, CV-10, CV-11, CV-12** — Admin panel UI. Admin can now assign categories + visibility.
6. **CV-04, CV-05** — Flip the visibility filter on user-facing endpoints. Do this LAST, after data is populated.

**Why order matters**: If you deploy CV-04/CV-05 before populating data (steps 3-5), all members with empty `business_categories` still see everything (backward compat), so it's safe to flip early. But populating data first and then flipping the filter gives a cleaner rollout.

---

## Out of Scope

- Showing "locked" course cards (visible but no access) — courses not matching visibility are simply absent from the catalog, not shown as locked.
- Member-self-assignment of business categories — admin-only intentionally.
- Filtering the `/courses` module tabs by visibility (only showing tabs where the member has ≥1 visible course) — the existing `listCourseModuleTabsHandler` already partially does this via `applicable_business_types`; full alignment is a follow-up.
- Mobile app changes — the Flutter app calls the same user-facing API; server-side filtering automatically applies. No Flutter changes needed.
- `CourseAccess` override in the catalog (showing enrolled courses even if category doesn't match) — enrolled courses appear in "My Courses" / "Continue Learning" sections which have no visibility gate; catalog is for discovery only.
