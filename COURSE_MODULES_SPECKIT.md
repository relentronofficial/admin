# COURSE_MODULES_SPECKIT.md

**Feature:** Course Module Categories (Product / Service / Coach)
**Status:** Ready to implement
**Date:** 2026-09-10

---

## Problem with Current Implementation

The existing `course_modules` system assigns modules at the **episode level** — each episode inside a course is tagged to a module (E-commerce / Service / Coaching). This is overly complex:

- Admin must assign every episode to a module individually
- A course shows up in a module tab only if its episodes are tagged — confusing
- Module names (E-commerce, Service, Coaching) don't match what the user wants
- The concept of "module" as an episode grouping within a course is different from "module" as a course category

**What the user actually wants:** A simple course-level categorisation — each course belongs to one module (Product / Service / Coach). The 3 tabs on `/courses` filter courses by that module.

---

## Desired Behaviour

### User Web — `/courses` page

```
[ All ]  [ Product ]  [ Service ]  [ Coach ]

When "All" selected:     show all courses
When "Product" clicked:  show only courses in the Product module
When "Service" clicked:  show only courses in the Service module
When "Coach" clicked:    show only courses in the Coach module
```

- Only show tabs for modules that have at least one published course
- "All" tab always visible
- Selected tab highlighted with accent colour
- Course cards show a small module chip (e.g. "Product")

### Admin Panel — Course Form

- Add a **Module** dropdown field on the course create/edit form
- Options: Product, Service, Coach (or blank = unassigned)
- Displayed in the course list row as a badge

---

## Scope Decision: Replace Episode-Level Modules

The existing `course_modules` and `course_episode_modules` tables are **retired** for the course-category use case. Instead:

- Add a `module VARCHAR(100)` column directly to the `courses` table
- Valid values: `'Product'`, `'Service'`, `'Coach'`, `NULL` (unassigned)
- The old `course_modules` / `course_episode_modules` tables and their admin CRUD endpoints are **hidden from the admin UI** (left in DB to avoid breaking anything, but no longer surfaced in the course form)

This is the simplest model: one field, three values, no junction tables needed.

---

## Implementation Plan

### CM-01 — Backend: Add `module` column to `courses`

**File:** `tbt-admin/backend/src/plugins/prisma.ts`

Add to the startup ALTER TABLE block (idempotent):
```sql
ALTER TABLE courses ADD COLUMN IF NOT EXISTS module VARCHAR(100);
```

No data migration needed — existing courses will have `module = NULL` (shows under "All" only until admin assigns them).

---

### CM-02 — Backend: Update course create/update schema

**File:** `tbt-admin/backend/src/modules/courses/schema.ts`

Add `module` to the course create and update Zod schemas:
```typescript
module: z.enum(['Product', 'Service', 'Coach']).nullable().optional()
```

---

### CM-03 — Backend: Update course create/update controller

**File:** `tbt-admin/backend/src/modules/courses/controller.ts`

- On `createCourse`: destructure `module` from body, persist via raw SQL after Prisma create:
  ```sql
  UPDATE courses SET module = $1 WHERE id = $2
  ```
- On `updateCourse`: same pattern — destructure `module`, update via raw SQL

- On `getCourse` / `listCourses` admin responses: include `module` field (via supplementary `$queryRawUnsafe` SELECT or add to the existing raw SQL reads)

---

### CM-04 — Backend: Update user-facing course list endpoint

**File:** `tbt-admin/backend/src/modules/user/controller.ts`

**`listCourseModuleTabsHandler`** — replace the current episode-join query with:
```sql
SELECT DISTINCT module, MIN(sort_order) as so
FROM courses
WHERE module IS NOT NULL AND is_published = true
GROUP BY module
ORDER BY MIN(sort_order), module
```
Returns `[{ title: 'Product' }, { title: 'Service' }, { title: 'Coach' }]` (only modules with published courses).

> **Note:** `sort_order` is already a column on `courses`. Use it as the secondary sort so tab order is consistent.

**`listUserCoursesHandler`** — replace the current episode-join filter with a direct column filter:
```sql
-- when moduleTitle is provided:
WHERE c.module = $1 AND c.is_published = true AND (access check)
```
Remove the old `course_episode_modules` join entirely from this handler.

Also add `module` to the course objects returned in the response.

---

### CM-05 — Backend: Update admin course list/get endpoints

**File:** `tbt-admin/backend/src/modules/courses/controller.ts`

Include `module` in the response for `listCourses` (admin) and `getCourse` so the admin panel can display and edit it.

---

### CM-06 — Admin Panel: Add Module field to course form

**File:** `tbt-admin/admin-panel/app/courses/page.tsx`

In the course create/edit form, add a `module` select field after the title/description fields:

```tsx
<select value={form.module ?? ''} onChange={e => setField('module', e.target.value || null)}>
  <option value="">— No module —</option>
  <option value="Product">Product</option>
  <option value="Service">Service</option>
  <option value="Coach">Coach</option>
</select>
```

Style: same as other select inputs in the form (`bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11`).

Also display `module` as a small badge in the course list row (next to the title).

---

### CM-07 — Admin Panel: Update hooks

**File:** `tbt-admin/admin-panel/lib/hooks/useTbt.ts`

- `useCreateVodCourse` — include `module` in mutation body
- `useUpdateVodCourse` — include `module` in mutation body
- `useListVodCourses` — expect `module` in returned course objects

No new hooks needed.

---

### CM-08 — User Web: Update courses page tabs

**File:** `tbt-user-web/app/(platform)/courses/page.tsx`

Current tabs already use `useCourseModuleTabs()` and `selectedModule` state — no logic change needed. The backend change (CM-04) makes the data correct. UI stays the same.

Update course card to show `course.module` chip (replace the old episode-level `course.modules[]` array with the single `course.module` string).

```tsx
{course.module && (
  <span className="text-xs px-2 py-0.5 rounded-full bg-accent/20 text-accent">
    {course.module}
  </span>
)}
```

---

### CM-09 — User Web: Update courses service + hook types

**File:** `tbt-user-web/lib/api/services/courses.service.ts`  
**File:** `tbt-user-web/types/index.ts`

- Add `module?: string | null` to the `Course` type
- `getModuleTabs()` stays the same — endpoint and response shape unchanged
- `listCourses(params)` stays the same — `moduleTitle` param unchanged

---

## What to Leave Alone

| Item | Action |
|---|---|
| `course_modules` DB table | Leave in DB — don't drop, don't expose in UI |
| `course_episode_modules` DB table | Leave in DB — don't drop, don't expose in UI |
| Admin course module CRUD endpoints (`/api/courses/:id/modules`) | Leave in backend — just hide from admin panel UI |
| `useListCourseModules`, `useCreateCourseModule` etc. hooks | Leave in `useTbt.ts` — just unused |
| Episode form module checkboxes | Remove from episode create/edit form in admin panel |

---

## Implementation Order

```
CM-01 → CM-02 → CM-03 → CM-04 → CM-05   (backend, in order)
CM-06 → CM-07                              (admin panel)
CM-08 → CM-09                              (user web)
```

Test: assign a few courses to Product/Service/Coach via admin panel → verify tabs on `/courses` filter correctly → verify module chip shows on course cards.

---

## Out of Scope

- Per-course sub-module grouping within the course player (a separate future feature if needed)
- Migration script to bulk-assign existing courses — admin will assign them manually via the course edit form
