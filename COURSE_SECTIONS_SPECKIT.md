# COURSE_SECTIONS_SPECKIT.md
## Course Sections (Chapters) Feature

**Status:** Complete — implemented 2026-08-29  
**Date:** 2026-08-28  
**Scope:** Admin panel · Backend · User Web · Flutter app

---

## Requirement (Plain English)

A course currently has a flat list of videos. The user wants a **two-level structure**:

```
Course
  └── Section 1: "Week 1 – Foundations"
        ├── Video 1: "Introduction to BMC"
        ├── Video 2: "Kano Model"
        └── Video 3: "Competitor Analysis"
  └── Section 2: "Week 2 – Website"
        ├── Video 1: "Landing Page Basics"
        └── Video 2: "SEO Fundamentals"
  └── Section 3: "Week 3 – Ads"
        └── Video 1: "Meta Ads Overview"
```

- The admin creates **sections** (titles/chapters) inside a course, each with a name and optional description.
- Under each section the admin adds **episodes** (videos) — same episode model as today.
- Both sections and episodes within a section can be **reordered** independently.
- **Backward compatibility:** All existing episodes that have no section yet belong to an implicit "Default" section and continue to work without breakage.
- The user/learner sees sections as **collapsible accordion groups** in the lesson sidebar. Progress is tracked per-episode exactly as today.

---

## What Already Exists (do not change)

| Thing | Location | Note |
|---|---|---|
| `CourseEpisode` Prisma model | `schema.prisma:2478` | Has `courseId`, `order`, all video/quiz fields |
| `course_episodes` table | Postgres | `order INT`, `course_id UUID FK` |
| `timer_seconds`, `quiz_data`, etc. | startup `ALTER TABLE` in `prisma.ts` | Raw SQL columns — handled outside Prisma |
| Episode CRUD admin hooks | `useTbt.ts` | `useListCourseEpisodes`, `useCreateCourseEpisode`, etc. |
| Episode CRUD admin UI | `admin-panel/app/courses/page.tsx` | Flat list inside a course drawer |
| Lesson list (user) | `learning/[courseId]/page.tsx:878` | `course.lessons.map(...)` flat render |
| Episode progress | `CourseEpisodeProgress` model | No change needed |
| Resources / Tasks / Feedback per episode | Existing modals | No change needed |

---

## Data Model

### New table: `course_sections`

Created via idempotent startup `ALTER TABLE` / `CREATE TABLE IF NOT EXISTS` in `backend/src/plugins/prisma.ts`.

```sql
CREATE TABLE IF NOT EXISTS course_sections (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  sort_order  INT  NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_course_sections_course
  ON course_sections(course_id);
```

### Modified table: `course_episodes`

Add one nullable FK column (via startup `ALTER TABLE`):

```sql
ALTER TABLE course_episodes
  ADD COLUMN IF NOT EXISTS section_id UUID REFERENCES course_sections(id) ON DELETE SET NULL;
```

- `section_id IS NULL` → episode belongs to no section (legacy / unsectioned)
- Existing rows keep `section_id = NULL`; they render in a synthetic "General" group in the UI

### No Prisma migration needed — both changes are startup `ALTER TABLE`.

---

## Backend API

### New module: `/api/courses/sections/`

All routes are **Clerk-protected (admin)** — they live inside the existing `courseRoutes` in `backend/src/modules/courses/routes.ts`.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/courses/:courseId/sections` | List all sections for a course, each with their episodes nested |
| `POST` | `/api/courses/:courseId/sections` | Create a section |
| `PUT` | `/api/courses/:courseId/sections/:sectionId` | Update section title/description |
| `DELETE` | `/api/courses/:courseId/sections/:sectionId` | Delete section (episodes go to `section_id = NULL`) |
| `PUT` | `/api/courses/:courseId/sections/reorder` | Reorder sections `{ ids: string[] }` |
| `PUT` | `/api/courses/sections/:sectionId/episodes/:episodeId/move` | Move an episode into a different section (or null) |
| `PUT` | `/api/courses/sections/:sectionId/episodes/reorder` | Reorder episodes within a section |

### Modified: existing episode list and course-detail responses

- `GET /api/courses/:id/episodes` — already used by admin panel; add `sectionId` to each episode row.
- `GET /api/user/courses/:id` — user-facing course detail (in `user/controller.ts`); change `lessons` field from a flat array to either:
  - **Option A (chosen):** Keep `lessons` flat but add `sectionId` and `sectionTitle` to each lesson object. The frontend groups by `sectionId`. This avoids breaking any existing consumer that iterates `lessons`.
  - Add a `sections: [{ id, title, description, sortOrder }]` array alongside `lessons` so the client can build the accordion without extra round-trips.

### Section delete behaviour
When a section is deleted, `UPDATE course_episodes SET section_id = NULL WHERE section_id = $1` runs before the section row is deleted, so no episodes are lost.

---

## Admin Panel Changes

### `useTbt.ts` — new hooks

```typescript
useListCourseSections(courseId)         // GET /api/courses/:id/sections
useCreateCourseSection(courseId)        // POST /api/courses/:id/sections
useUpdateCourseSection(courseId)        // PUT /api/courses/:id/sections/:sectionId
useDeleteCourseSection(courseId)        // DELETE /api/courses/:id/sections/:sectionId
useReorderCourseSections(courseId)      // PUT /api/courses/:id/sections/reorder
useMoveEpisodeToSection()               // PUT /api/courses/sections/:sectionId/episodes/:episodeId/move
useReorderEpisodesInSection(sectionId)  // PUT /api/courses/sections/:sectionId/episodes/reorder
```

### `admin-panel/app/courses/page.tsx` — episode panel

Replace the current flat episode drag-list inside the course detail drawer with a **two-level structure**:

```
[ + Add Section ]

▼ Section: "Week 1 – Foundations"   [Rename] [Delete] [⠿ drag]
    ┌─ [⠿] Episode: "Introduction to BMC"       [Resources] [Tasks] [Feedback] [Edit] [Delete]
    ├─ [⠿] Episode: "Kano Model"
    └─ [ + Add episode to this section ]

▼ Section: "Week 2 – Website"        [Rename] [Delete] [⠿ drag]
    └─ [ + Add episode to this section ]

▷ Unsectioned (legacy)               [no rename/delete]
    └─ [⠿] Episode: "Old episode"
           [ Assign to section ▾ ]    ← dropdown to move it into a section
```

**Reorder:**
- Drag sections vertically → `useReorderCourseSections`
- Drag episodes within a section → `useReorderEpisodesInSection`
- Drag episode between sections → `useMoveEpisodeToSection` (drop on section header)

**Add episode:** clicking "+ Add episode to this section" pre-fills `sectionId` in the create form and posts to the existing `POST /api/courses/:id/episodes` with the new `sectionId` body field.

---

## User Web Changes (`tbt-user-web`)

### `lib/hooks/useCourses.ts`

No new hook needed — `useCourse` already returns course detail. The `lessons` array will now carry `sectionId` and `sectionTitle` per lesson. The hook shape doesn't change; only the data shape is enriched.

### `types/index.ts`

Add to `Lesson` type (or extend it where used):
```typescript
sectionId?: string;
sectionTitle?: string;
sectionOrder?: number;
```

Add alongside course detail:
```typescript
sections?: { id: string; title: string; description?: string; sortOrder: number }[];
```

### `app/(platform)/learning/[courseId]/page.tsx`

**Lesson list panel** (currently at line ~878, `lessons.map((lesson: any, idx) => ...)`):

Replace the flat map with an **accordion grouped by section**:

```
▼ Week 1 – Foundations              3/3 complete  [chevron]
  ✓ 1. Introduction to BMC          4:32
  ✓ 2. Kano Model                   6:10
  ▶ 3. Competitor Analysis          8:00  ← currently playing

▷ Week 2 – Website                  0/2 complete  [chevron]
  🔒 4. Landing Page Basics
  🔒 5. SEO Fundamentals

▷ Unsectioned                       (if any)
  ...
```

- Sections **start collapsed** except the one containing the current lesson (auto-expanded).
- Click section header → toggle collapse.
- Episode numbering is **global** (1, 2, 3… across all sections) to keep progress % and completion intuitive.
- Section header shows `completed/total` mini badge.
- No layout change to the video player, quizzes, or any other panel — only the lesson list accordion changes.

### `app/(platform)/courses/page.tsx` (catalog preview)

The catalog card currently shows `X Lessons`. No change needed — total lesson count stays.

The course detail preview pane (before enrollment) shows the flat lesson list preview. **Change:** show sections accordion in the preview too (same collapsible pattern, no playback allowed before enrollment).

---

## Flutter App Changes (`tbt_app`)

### `lib/shared/models/lesson.dart`

Add two nullable fields to `Lesson`:
```dart
final String? sectionId;
final String? sectionTitle;
```

### `lib/features/courses/presentation/course_detail_screen.dart` (or equivalent lesson list widget)

Replace the current `ListView.builder` of lessons with a **`ExpansionTile`-based accordion** grouped by section. Same completion indicators, lock icons, and tap-to-play behaviour; just wrapped in collapsible section headers.

---

## Backward Compatibility Rules

1. Episodes with `section_id = NULL` → rendered in a synthetic **"General"** section at the bottom (or top if all are unsectioned — acts as if no sections exist, flat list as today).
2. If a course has **zero sections**, the UI reverts to the flat list (no accordion headers shown). This preserves the look for courses that never get sections added.
3. `CourseEpisodeProgress`, XP, quiz, resources, tasks, feedback — all keyed by `episode_id` and untouched.
4. The existing `PUT /api/courses/episodes/reorder` endpoint is deprecated in favour of per-section reorder but is kept alive for at least one release so any cached admin-panel build doesn't break.

---

## Implementation Order

| # | Layer | Task |
|---|---|---|
| 1 | DB | Add `course_sections` table + `section_id` FK on `course_episodes` in `prisma.ts` startup |
| 2 | Backend | Section CRUD + reorder handlers in `courses/controller.ts` + `courses/routes.ts` |
| 3 | Backend | Add `sectionId`/`sectionTitle` to episode list response; add `sections[]` to user course-detail response |
| 4 | Admin hooks | 7 new hooks in `useTbt.ts` |
| 5 | Admin UI | Two-level section/episode panel in `courses/page.tsx` |
| 6 | User web | Group lesson list by section in `learning/[courseId]/page.tsx` |
| 7 | User web | Section accordion in courses catalog preview pane |
| 8 | Flutter | Extend `Lesson` model + `ExpansionTile` accordion in lesson list |

---

## Out of Scope

- Section-level completion gating (unlock next section only after finishing current) — not requested; can be added later.
- Section-level XP or badges — not requested.
- Workshop episodes — workshops have a different flow structure; this spec covers VOD courses only.
