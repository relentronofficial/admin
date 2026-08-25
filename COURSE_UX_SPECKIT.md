# COURSE_UX_SPECKIT.md

Course UX & wiring fix plan — based on a full-stack audit of `/courses`, `/learning`, and
`/learning/[courseId]` conducted 2026-08-25.

Items are grouped into four sprints by priority. Each item names the exact files and lines
to touch so there is no ambiguity during implementation.

---

## Status key
- [ ] Not started
- [x] Done

---

## Sprint 1 — P0 Bugs (must fix before next release)

### C-01 Heartbeat ticks while paused — inflates `watchedSeconds`

**Problem.** The 30-second heartbeat in `learning/[courseId]/page.tsx` (lines 1513–1528)
computes elapsed using wall-clock time (`Date.now() - startRef.current`) with no
`isPlayingRef.current` guard. If the user pauses the video for 5 minutes, the interval still
fires 10 times and credits 300 additional watched-seconds to the DB. This inflates the
stored progress counter and can trigger the 85% threshold (and therefore "lesson done")
without the user actually finishing the video.

**Files:**
- `tbt-user-web/app/(platform)/learning/[courseId]/page.tsx`

**Change — line 1513 heartbeat callback:**
```typescript
// BEFORE
const hb = setInterval(() => {
  const lesson = selectedLessonRef.current;
  if (!lesson || markCalledRef.current) return;
  const elapsed = Math.floor((Date.now() - startRef.current) / 1000);
  ...
}, 30_000);

// AFTER — add isPlayingRef guard so paused time never counts
const hb = setInterval(() => {
  const lesson = selectedLessonRef.current;
  if (!lesson || markCalledRef.current || !isPlayingRef.current) return;
  const elapsed = Math.floor((Date.now() - startRef.current) / 1000);
  ...
}, 30_000);
```

The `isPlayingRef` is already tracked reliably for both HLS (`onPlay`/`onPause`) and
Bunny iframe (`postMessage` events) — adding the guard is safe for both player types.

- [x] Fix applied

---

### C-02 Lesson selection is not reflected in the URL

**Problem.** `searchParams.get("lesson")` is already read on load (line 870) and used to
pre-select a lesson (lines 999–1020) — deep-link *into* the page is already implemented.
However, `handleSelectLesson` (line 1575) never calls `router.replace`, so:
1. If the user refreshes mid-session, the page resets to the first lesson regardless of which
   lesson they were watching.
2. Users cannot share or bookmark a direct link to a specific lesson.

**Files:**
- `tbt-user-web/app/(platform)/learning/[courseId]/page.tsx`

**Change — inside `handleSelectLesson`, after setting `selectedLesson`:**
```typescript
const handleSelectLesson = (lesson: any) => {
  if (!lesson.videoUrl) return;
  setVideoKey(0);
  // ... existing state-setting code unchanged ...
  setSelectedLesson({ ... });

  // ADD: sync lesson to URL without pushing to history stack
  router.replace(`/learning/${courseId}?lesson=${lesson.id}`, { scroll: false });
};
```

`courseId` is already in scope from `use(params)`. `router` is already imported and used.
No new imports needed.

- [x] Fix applied

---

## Sprint 2 — P1 UX Gaps

### C-03 Practice Arena includes questions from lessons the user hasn't seen yet

**Problem.** `PracticeArenaModal` (lines 92–107) collects quiz questions from
`course?.lessons ?? []` with no completion filter. A user on lesson 3 of 20 will receive
questions from lessons 15–20 they have never watched, which both spoils content and
frustrates them with unrecognised questions.

**Files:**
- `tbt-user-web/app/(platform)/learning/[courseId]/page.tsx`

**Change — `PracticeArenaModal` `questions` useMemo (line 92):**
```typescript
// PracticeArenaModal now receives completedIds as a prop
function PracticeArenaModal({
  course,
  completedIds,
  onClose,
}: { course: any; completedIds: Set<string>; onClose: () => void }) {
  const questions = useMemo(() => {
    const qs: Array<{ q: any; lessonTitle: string }> = [];
    for (const lesson of course?.lessons ?? []) {
      // Only pull questions from lessons the member has already completed
      if (!completedIds.has(lesson.id)) continue;
      const qd = (lesson as any).quizData;
      if (!qd?.questions?.length) continue;
      for (const q of qd.questions) {
        qs.push({ q, lessonTitle: lesson.title });
      }
    }
    // shuffle ...
  }, [course, completedIds]);
```

Pass `completedIds` at the call site (search for `<PracticeArenaModal`):
```tsx
{practiceOpen && (
  <PracticeArenaModal
    course={course}
    completedIds={completedIds}   // ADD
    onClose={() => setPracticeOpen(false)}
  />
)}
```

If no completed lessons have quiz questions, the modal already handles `questions.length === 0`
gracefully (shows "No practice questions yet").

- [x] Fix applied

---

### C-04 Catalog — enrolled/completed scroll rows render visibly empty for new users

**Already implemented.** `courses/page.tsx` line 359 uses `enrollLoading || activeEnrollments.length > 0`
and line 382 uses `completedEnrollments.length > 0` — both rows already hide when empty.

- [x] Already done (no change needed)

---

### C-05 My Learning — flat grid with no In Progress / Completed grouping

**Problem.** `learning/page.tsx` shows all enrolled courses in a single flat grid.
A user with 10 courses cannot quickly distinguish what is active from what is done.
The `isCompleted` field is already computed on `EnrolledCourseCard` (line 12) so no
additional data is needed.

**Files:**
- `tbt-user-web/app/(platform)/learning/page.tsx`

**Change — split enrollments into two sections:**
```typescript
export default function LearningPage() {
  const { data: enrollments, isLoading } = useMyEnrollments();
  const list = (enrollments ?? []) as any[];
  const inProgress = list.filter((e) => (e.progressPercent ?? 0) < 100);
  const done       = list.filter((e) => (e.progressPercent ?? 0) >= 100);

  return (
    <div className="space-y-10">
      {/* header + My Badges link unchanged */}

      {inProgress.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-base font-semibold" style={{ color: "var(--color-text-normal)" }}>
            In Progress ({inProgress.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {inProgress.map((e: any) => <EnrolledCourseCard key={e.id} enrollment={e} />)}
          </div>
        </section>
      )}

      {done.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-base font-semibold" style={{ color: "var(--color-text-normal)" }}>
            Completed ({done.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {done.map((e: any) => <EnrolledCourseCard key={e.id} enrollment={e} />)}
          </div>
        </section>
      )}

      {list.length === 0 && !isLoading && <EmptyState ... />}
    </div>
  );
}
```

- [x] Fix applied

---

### C-06 Catalog — no category filter or sort control

**Problem.** The catalog offers only free-text search and a level filter. With many courses,
users cannot browse by category. The `Course` model has a `categoryId` FK and a `category`
relation (Prisma schema line 451) so the data already exists.

**Backend changes:**
- `tbt-admin/backend/src/modules/user/controller.ts` — the `listUserCoursesHandler` (or
  equivalent) should accept `?category=<categoryId>` and `?sort=newest|popular` query params
  and pass them into the Prisma `where` / `orderBy` clauses.
- `tbt-admin/backend/src/modules/user/routes.ts` — extend the route schema to allow
  `category` and `sort` query params (currently only `search`, `level`, `page`, `limit`).

**Frontend changes:**
- `tbt-user-web/lib/api/services/courses.service.ts` — add `category?: string` and
  `sort?: "newest" | "popular"` to `ListCoursesParams`.
- `tbt-user-web/app/(platform)/courses/page.tsx` — add a category dropdown (populated
  from `GET /api/pub/categories` or the existing masters endpoint) and a sort dropdown
  alongside the existing level filter. Pass selected values to `useCourses(params)`.
- `tbt-user-web/lib/hooks/useCourses.ts` — `useCourses` already spreads `params` into the
  query key and Axios call, so no hook changes are needed beyond the service type update.

**Backend Prisma `where` addition (pseudo-code):**
```typescript
where: {
  isPublished: true,
  isActive: true,
  ...(search ? { title: { contains: search, mode: 'insensitive' } } : {}),
  ...(level  ? { level } : {}),
  ...(category ? { categoryId: category } : {}),   // ADD
}
orderBy: sort === 'popular'
  ? { enrollments: { _count: 'desc' } }
  : { createdAt: 'desc' }                          // default newest
```

- [x] Backend params extended (`sort`, `category` in `listUserCoursesHandler`)
- [x] Service type updated (`sort?: "newest" | "popular"`, `category?: string`)
- [x] UI controls added (sort dropdown; category dropdown deferred — no public endpoint exists yet)
- Note: category filter UI skipped until a `GET /api/pub/courses/categories` endpoint is added

---

## Sprint 3 — P2 Quality-of-Life

### C-07 Focus mode dialog repeats on every lesson click — no returning-user opt-out

**Problem.** Every time a user clicks a lesson that hasn't had its timer started yet,
`handleSelectLessonWithFocus` (line 1620) shows the full focus-mode dialog — even for a
user who is on their 50th lesson and knows the system well. There is no way to skip this
dialog permanently.

**Files:**
- `tbt-user-web/app/(platform)/learning/[courseId]/page.tsx`

**Change — add a course-scoped localStorage acknowledgement flag:**
```typescript
// Near the focus-mode state declarations (line ~924):
const [focusAcknowledged, setFocusAcknowledged] = useState(() => {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem(`tbt_focus_ack_${courseId}`);
});

// In the dialog UI (lines 1712–1730), add a "Don't show again" checkbox:
<label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: "var(--color-text-secondary)" }}>
  <input
    type="checkbox"
    checked={focusAcknowledged}
    onChange={(e) => {
      setFocusAcknowledged(e.target.checked);
      if (e.target.checked) localStorage.setItem(`tbt_focus_ack_${courseId}`, "1");
      else localStorage.removeItem(`tbt_focus_ack_${courseId}`);
    }}
    className="rounded"
  />
  Don't show this again for this course
</label>
```

Then in `handleSelectLessonWithFocus` (line 1620), skip the dialog when acknowledged:
```typescript
const handleSelectLessonWithFocus = (lesson: any) => {
  if (!lesson.videoUrl) return;
  const isFocusLocked = focusLockedIds.has(lesson.id) && !completedIds.has(lesson.id);
  if (isFocusLocked) return;
  const timerStarted = lessonTimers[lesson.id] !== undefined;
  if (timerStarted || completedIds.has(lesson.id) || lesson.isCompleted) {
    handleSelectLesson(lesson);
    return;
  }
  const duration = getLessonTimerDuration(lesson);
  if (!duration) { handleSelectLesson(lesson); return; }

  if (focusAcknowledged) {
    // Skip dialog — start timer immediately
    handleSelectLesson(lesson);
    startLessonTimer(lesson.id, duration);
  } else {
    setFocusDialog({ lesson, duration });
  }
};
```

- [x] Fix applied

---

### C-08 Quiz existence not signalled in lesson sidebar

**Problem.** When browsing the lesson list, there is no visual indicator that a lesson
contains a quiz. A user only discovers this after watching 80%+ of the video and the quiz
section appears. Showing a small badge prevents surprise and sets expectations.

**Files:**
- `tbt-user-web/app/(platform)/learning/[courseId]/page.tsx`

**Change — add quiz badge inside the lesson row (around line 2079 sidebar button):**
```tsx
{/* Below the lesson title and duration already rendered there */}
{(lesson as any).hasQuiz && (
  <span
    className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
    style={{
      background: "color-mix(in srgb, var(--color-accent) 15%, transparent)",
      color: "var(--color-accent)",
    }}
  >
    <Zap size={8} /> Quiz
  </span>
)}
```

`lesson.hasQuiz` is already set by the backend on each episode object — no API change needed.

- [x] Fix applied (quiz badge already present at sidebar lines ~2206–2215)

---

### C-09 Up-next auto-advance is not user-controllable

**Problem.** When a lesson completes, a 5-second countdown auto-advances to the next lesson.
There is no way to disable this permanently. Power users who rewatch content will be
interrupted repeatedly.

**Files:**
- `tbt-user-web/app/(platform)/learning/[courseId]/page.tsx`

**Change — add a per-user toggle persisted to `localStorage["tbt_autoadvance"]`:**

```typescript
// Near other state declarations:
const [autoAdvance, setAutoAdvance] = useState(() => {
  if (typeof window === "undefined") return true;
  const stored = localStorage.getItem("tbt_autoadvance");
  return stored === null ? true : stored === "1"; // default on
});

const toggleAutoAdvance = () => {
  const next = !autoAdvance;
  setAutoAdvance(next);
  localStorage.setItem("tbt_autoadvance", next ? "1" : "0");
};
```

In `triggerUpNextRef.current` (line 1093), guard the start of the countdown:
```typescript
triggerUpNextRef.current = useCallback(() => {
  clearInterval(upNextTimerRef.current);
  const lessons = courseRef.current?.lessons ?? [];
  const nextIdx = lessons.findIndex((l: any) => l.id === selectedLessonRef.current?.id) + 1;
  const next = lessons[nextIdx];
  if (!next || !next.videoUrl) return;
  if (!autoAdvanceRef.current) return; // ADD: respect preference
  // ... rest of countdown unchanged
}, [...]);
```

Use a `autoAdvanceRef` (kept in sync with `autoAdvance` state) to avoid stale-closure issues.

In the up-next banner UI (around line 1914), add a toggle button:
```tsx
{upNextCountdown !== null && nextLesson && (
  <div className="flex items-center justify-between ...">
    {/* existing countdown text */}
    <div className="flex items-center gap-2 shrink-0">
      <button
        onClick={toggleAutoAdvance}
        title="Toggle auto-advance"
        className="text-[10px] px-2 py-1 rounded border text-muted-foreground hover:opacity-80"
      >
        Auto: {autoAdvance ? "On" : "Off"}
      </button>
      {/* existing Cancel button */}
    </div>
  </div>
)}
```

- [x] Fix applied

---

### C-10 Reflections are localStorage-only — lost on device switch

**Problem.** `ReflectionModal` saves to `localStorage["tbt_reflections"]` (line ~1548).
A member who writes a reflection on desktop, then opens the course on mobile, will find
no reflections. They are also silently deleted when the user clears browser storage.

**Backend changes:**
- `tbt-admin/backend/src/plugins/prisma.ts` — add to the startup `Promise.all`:
  ```typescript
  prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS course_reflections (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      course_id TEXT NOT NULL,
      lesson_id TEXT NOT NULL,
      text TEXT NOT NULL,
      saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(member_id, course_id, lesson_id)
    )
  `),
  prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_course_reflections_member_course
      ON course_reflections(member_id, course_id)
  `),
  ```
- `tbt-admin/backend/src/modules/user/routes.ts` — add two routes under `fastify.authenticateUser`:
  ```
  PUT  /api/user/courses/:courseId/reflections/:lessonId   → upsertReflectionHandler
  GET  /api/user/courses/:courseId/reflections             → listReflectionsHandler
  ```
- `tbt-admin/backend/src/modules/user/controller.ts` — implement:
  - `upsertReflectionHandler`: `INSERT ... ON CONFLICT (member_id, course_id, lesson_id) DO UPDATE SET text=$4, saved_at=NOW()`
  - `listReflectionsHandler`: `SELECT lesson_id, text, saved_at FROM course_reflections WHERE member_id=$1 AND course_id=$2`

**Frontend changes:**
- `tbt-user-web/lib/api/services/courses.service.ts` — add:
  ```typescript
  saveReflection: (courseId: string, lessonId: string, text: string) =>
    apiClient.put(`/api/user/courses/${courseId}/reflections/${lessonId}`, { text }),
  getReflections: (courseId: string) =>
    apiClient.get(`/api/user/courses/${courseId}/reflections`),
  ```
- `tbt-user-web/lib/hooks/useCourses.ts` — add:
  ```typescript
  export const useSaveReflection = (courseId: string) =>
    useMutation({ mutationFn: ({ lessonId, text }: { lessonId: string; text: string }) =>
      coursesService.saveReflection(courseId, lessonId, text) });

  export const useReflections = (courseId: string) =>
    useQuery({
      queryKey: ["reflections", courseId],
      queryFn: () => coursesService.getReflections(courseId),
      staleTime: 5 * 60 * 1000,
    });
  ```
- `tbt-user-web/app/(platform)/learning/[courseId]/page.tsx` — in `ReflectionModal`, call
  `useSaveReflection` mutation on save. On load, seed initial reflection state from
  `useReflections(courseId)` instead of (or in addition to) reading from localStorage.
  Keep the localStorage write as a fallback for offline/transient use.

- [x] Backend table + routes implemented
- [x] Frontend service + hooks added
- [x] Player page wired to use backend save/load

---

## Sprint 4 — P3 Polish

### C-11 Episode descriptions not visible to the user

**Problem.** The `CourseEpisode` model has a `description` field. In the lesson sidebar and
in the player area, only the episode title and duration are shown. A user selecting their
next lesson has no way to know what it covers without watching it.

**Files:**
- `tbt-user-web/app/(platform)/learning/[courseId]/page.tsx`

**Change 1 — sidebar lesson row (around line 2079):**
```tsx
<div className="flex-1 min-w-0">
  <p className="text-sm font-medium leading-snug" ...>{lesson.title}</p>
  {/* ADD: description truncated to 1 line, shown only when not active */}
  {!isActive && lesson.description && (
    <p className="text-xs mt-0.5 line-clamp-1" style={{ color: "var(--color-text-subtle)" }}>
      {lesson.description}
    </p>
  )}
  {/* existing duration row unchanged */}
</div>
```

**Change 2 — player area below the lesson title (around line 1800 where the course header is):**
```tsx
{selectedLesson && (
  <div>
    <h2 className="text-lg font-bold">{selectedLesson.title}</h2>
    {/* ADD */}
    {(course?.lessons?.find((l: any) => l.id === selectedLesson.id) as any)?.description && (
      <p className="text-sm mt-1" style={{ color: "var(--color-text-secondary)" }}>
        {(course.lessons.find((l: any) => l.id === selectedLesson.id) as any).description}
      </p>
    )}
  </div>
)}
```

- [x] Sidebar descriptions added
- [x] Player area description added

---

### C-12 Progress bars show percentage only — no lesson count

**Problem.** Both `EnrolledCourseCard` in `learning/page.tsx` and the enrolled horizontal
scroll row in `courses/page.tsx` show `"3% complete"` with no concrete indicator of how
many lessons have been finished. `enrollment.completedLessons` and `enrollment.totalLessons`
should be returned by `GET /api/user/enrollments`.

**Backend change (if not already returned):**
- `tbt-admin/backend/src/modules/user/controller.ts` — in `listUserEnrollmentsHandler`,
  add to the response for each enrollment:
  ```typescript
  completedLessons: enrollment._count?.completedEpisodes ?? 0,
  totalLessons: enrollment.course.totalLessons ?? 0,
  ```
  (The `totalLessons` column already exists on the `courses` table — line 424 of schema.prisma.)

**Frontend change:**
- In `EnrolledCourseCard` (`learning/page.tsx` line 47), replace the single % line:
  ```tsx
  <div className="flex items-center justify-between text-xs text-muted-foreground">
    <span>{progress}% complete</span>
    // ADD
    {enrollment.totalLessons > 0 && (
      <span>{enrollment.completedLessons ?? 0} / {enrollment.totalLessons} lessons</span>
    )}
  </div>
  ```
- Apply the same change to the enrolled card in `courses/page.tsx`.

- [x] Backend returns `completedLessons` + `totalLessons`
- [x] Learning page card updated
- [x] Courses page card updated

---

## Implementation notes

1. **Start with C-01 and C-02** — both are single-file, one-line changes with zero risk.
   C-01 prevents DB data corruption; C-02 fixes a navigation regression.

2. **C-03 breaks a scientific rationale comment** (spaced repetition across all lessons).
   If the intent was to include unseen lessons deliberately, update the comment and keep
   the filter to lessons within the first 2× the user's current position — a middle ground
   between pure spaced repetition and not spoiling future content.

3. **C-10 (reflections backend)** adds a new table via startup SQL only — no migration file
   needed. Follow the same idempotent `CREATE TABLE IF NOT EXISTS` pattern used throughout
   `prisma.ts`. The unique constraint handles concurrent upserts safely.

4. **C-06 (category filter)** requires checking whether `GET /api/pub/categories` (or
   `/api/masters/categories`) already returns the category list used by courses. If yes,
   reuse it. If no category data exists in production, the filter is a no-op until content
   is categorised.

5. **Do not touch** `app/login/page.tsx`, `app/(auth)/`, or `app/signup/page.tsx`.
   Do not introduce auto-logout on 401 anywhere (see commit `524c003e`).
