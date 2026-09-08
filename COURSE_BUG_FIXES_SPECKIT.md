# COURSE_BUG_FIXES_SPECKIT.md

Fix plan for 15 confirmed bugs across web (`tbt-user-web`) and mobile (`tbt_app`) course features.
Discovered 2026-09-01 via static audit. No bug pre-dates the COURSE_UX_SPECKIT (C-01–C-12).

---

## Priority order for implementation

| ID | Area | Sev | Title |
|---|---|---|---|
| C-F-10 | MOBILE | Critical | Lesson completion never refreshes providers |
| C-F-1 | WEB | High | Heartbeat posts inflated watchedSeconds |
| C-F-2 | BACKEND | High | Episode description always null in user API |
| C-F-8 | MOBILE | High | Practice Arena shows questions from unfinished lessons |
| C-F-5 | WEB | Medium | `useMarkLessonComplete` misses `enrollments` invalidation |
| C-F-7 | WEB | Medium | Reflections viewer button dead tap on localStorage-only data |
| C-F-9 | MOBILE | Medium | Cue quizzes missed on seek-forward |
| C-F-12 | MOBILE | Medium | Reflections are local-only on mobile |
| C-F-3 | WEB | Low | QuizQuestions extracts via accidental double-nesting |
| C-F-4 | WEB | Low | Section accordion starts all expanded |
| C-F-6 | WEB | Low | End-of-video quiz can double-trigger on fast videos |
| C-F-11 | MOBILE | Low | `getCourseSections()` makes redundant network call |
| C-F-13 | MOBILE | Low | Progress timer fires while paused |
| C-F-14 | WEB | Low | PaywallView uses `undefined` as initial sectionId |
| C-F-15 | WEB | Low | `startRef` set at select-time inflates elapsed fallback |

---

## C-F-10 — [MOBILE] Lesson completion never refreshes providers

**Severity:** Critical  
**File:** `tbt_app/lib/features/courses/presentation/lesson_player_screen.dart` ~L386

**Problem:**  
`_onVideoEnded()` calls `markLessonComplete(..., isCompleted: true)` but never invalidates any
Riverpod providers. When the user pops back to `CourseDetailScreen`, the lesson list still shows
the lesson as incomplete, the progress bar shows old `completedCount`, and the certificate
eligibility badge is stale — until they kill and re-enter the course. The issue also affects the
`_checkCompletion` 85% threshold path since it also calls `_onVideoEnded()`.

**Fix:**

In `_onVideoEnded()`, after the `markLessonComplete` fire-and-forget, invalidate the relevant
providers so the detail screen refreshes when it regains focus:

```dart
void _onVideoEnded() {
  if (_completionFired) return;
  _completionFired = true;
  ref
      .read(coursesServiceProvider)
      .markLessonComplete(
        widget.courseId,
        widget.lessonId,
        watchedSeconds: _currentTime.toInt(),
        isCompleted: true,
      )
      .then((_) {
        // Refresh all affected providers so CourseDetailScreen is up-to-date
        // when the user navigates back.
        ref.invalidate(lessonProgressProvider(widget.courseId));
        ref.invalidate(courseDetailProvider(widget.courseId));
        ref.invalidate(certEligibilityProvider(widget.courseId));
        ref.invalidate(myEnrollmentsProvider);
        ref.invalidate(learningCoursesProvider);
      })
      .catchError((_) {});
  _maybeShowReflection();
  _maybeShowFeedback();
}
```

**Imports needed:** `courses_provider.dart` is already imported. No new imports required.

---

## C-F-1 — [WEB] Heartbeat posts inflated `watchedSeconds`

**Severity:** High  
**File:** `tbt-user-web/app/(platform)/learning/[courseId]/page.tsx` ~L1661–1667

**Problem:**  
The 30-second heartbeat computes:
```ts
const elapsed = Math.floor((Date.now() - startRef.current) / 1000);
markComplete.mutate({
  watchedSeconds: Math.floor((lesson.resumeAtSeconds ?? 0) + elapsed),
```
`startRef.current` is set at lesson-selection time (L1297), not at first-play time. Pausing for
5 minutes then watching 30 more seconds causes `elapsed ≈ 330s`, wildly inflating
`watchedSeconds` and falsely triggering the 85% completion threshold.

The correct value to send is `lastPlayheadRef.current` (the actual video playhead), which
`handleVideoEnded` and `handleMarkComplete` already use correctly.

**Fix:**

Replace the `elapsed`-based `watchedSeconds` in the heartbeat with `lastPlayheadRef.current`:

```ts
const hb = setInterval(() => {
  const lesson = selectedLessonRef.current;
  if (!lesson || markCalledRef.current || !isPlayingRef.current) return;
  const elapsed = Math.floor((Date.now() - startRef.current) / 1000);
  const delta = Math.min(30, elapsed - lastHeartbeatWatchedRef.current);
  if (delta <= 0) return;
  lastHeartbeatWatchedRef.current = elapsed;
  // Use actual playhead position, not wall-clock elapsed from lesson-select time.
  const playhead = Math.floor(lastPlayheadRef.current > 0
    ? lastPlayheadRef.current
    : (lesson.resumeAtSeconds ?? 0) + elapsed);
  markComplete.mutate({
    lessonId: lesson.id,
    watchedSeconds: playhead,
    deltaSeconds: delta,
  });
}, 30_000);
```

The `elapsed`/`delta` pair is still used for the `deltaSeconds` field (which measures time-since-
last-heartbeat, not playhead position) — keep that logic unchanged.

---

## C-F-2 — [BACKEND] Episode `description` always null in user API

**Severity:** High  
**File:** `tbt-admin/backend/src/modules/user/controller.ts` ~L703

**Problem:**  
The `getUserCourseHandler` lesson-mapping block explicitly writes `description: null as string | null`
instead of reading the actual value from the Prisma result. Admin-authored descriptions are
silently discarded; users and the Flutter `Lesson` model always receive `null`.

**Fix:**

Change line ~703:
```ts
// Before:
description: null as string | null,

// After:
description: ep.description ?? null,
```

Also check the episode-playback handler in the same file (~L3488) for the same `description: null`
hardcode and apply the same fix.

**Verify:** After deploy, fetch `GET /api/user/courses/:id` and confirm `lessons[].description`
returns the value set in the admin panel for a lesson that has a description.

---

## C-F-8 — [MOBILE] Practice Arena shows questions from unfinished lessons

**Severity:** High  
**File:** `tbt_app/lib/features/courses/data/courses_service.dart` ~L352–381

**Problem:**  
`getPracticeQuestions(courseId)` collects quiz questions from ALL lessons regardless of whether
the member has completed them, spoiling content from lessons they haven't reached.

The web fixed this (COURSE_UX_SPECKIT C-03): `PracticeArenaModal` filters by `completedIds.has(lesson.id)`.
Mobile never got the fix.

**Fix:**

Pass `completedLessonIds` into `getPracticeQuestions` and filter:

```dart
/// Returns quiz questions only from lessons the member has completed.
Future<List<Map<String, dynamic>>> getPracticeQuestions(
  String courseId, {
  required Set<String> completedLessonIds,
}) async {
  try {
    final res = await _dio.get<Map<String, dynamic>>(
      '$kUserCourses/$courseId',
    );
    final data = res.data?['data'] as Map<String, dynamic>? ?? {};
    final lessons = (data['lessons'] as List<dynamic>? ?? [])
        .cast<Map<String, dynamic>>();
    final out = <Map<String, dynamic>>[];
    for (final lesson in lessons) {
      final lessonId = lesson['id'] as String? ?? '';
      // Only include questions from lessons the member has completed.
      if (!completedLessonIds.contains(lessonId)) continue;
      final quiz = lesson['quizData'];
      if (quiz is Map<String, dynamic>) {
        final qs = quiz['questions'];
        if (qs is List) {
          for (final q in qs) {
            if (q is Map<String, dynamic>) {
              out.add({...q, '_lessonTitle': lesson['title'] ?? ''});
            }
          }
        }
      }
    }
    return out;
  } on DioException catch (e) {
    throw mapDioError(e);
  }
}
```

At the call site in `practice_arena_modal.dart`, pass the completed lesson ID set:

```dart
// Derive completedLessonIds from lessonProgress before opening the modal.
final completedIds = lessonProgressList
    .where((p) => p.completed)
    .map((p) => p.lessonId)
    .toSet();

final questions = await coursesService.getPracticeQuestions(
  courseId,
  completedLessonIds: completedIds,
);
```

---

## C-F-5 — [WEB] `useMarkLessonComplete` misses `enrollments` invalidation

**Severity:** Medium  
**File:** `tbt-user-web/lib/hooks/useCourses.ts` ~L80–88

**Problem:**  
After marking a lesson complete, `onSuccess` invalidates progress, dashboard, XP, leaderboard,
and certificate-eligibility — but NOT `["user","enrollments"]`. The `/learning` page's
progress bar, "Completed" grouping, and filter tabs stay stale until the user manually
refreshes.

**Fix:**

Add one line in the `isCompleted` block:

```ts
onSuccess: (_data, { isCompleted }) => {
  queryClient.invalidateQueries({ queryKey: ["user", "progress", courseId] });
  if (isCompleted) {
    queryClient.invalidateQueries({ queryKey: ["user", "dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["user", "enrollments"] }); // ← ADD
    queryClient.invalidateQueries({ queryKey: ["course-xp", courseId] });
    queryClient.invalidateQueries({ queryKey: ["course-leaderboard", courseId] });
    queryClient.invalidateQueries({ queryKey: ["certificate-eligibility", courseId] });
  }
},
```

---

## C-F-7 — [WEB] Reflections viewer button dead tap on localStorage-only data

**Severity:** Medium  
**File:** `tbt-user-web/app/(platform)/learning/[courseId]/page.tsx` ~L2722

**Problem:**  
The sidebar button is shown when `reflectionCount > 0` (synced from localStorage). But the
`ReflectionsViewerModal` only renders when `savedReflections && savedReflections.length > 0`
(backend data). Users who have localStorage reflections but no backend data (e.g., written before
the backend table was deployed, or on a fallback path) see a button that does nothing on click.

**Fix:**

When `reflectionsOpen` is true but `savedReflections` is empty or null, fall back to rendering
reflections from localStorage. Add a local fallback array derived from localStorage state:

```ts
// Near where savedReflections is used — add this derived value:
const visibleReflections = (savedReflections && savedReflections.length > 0)
  ? savedReflections
  : null;  // will trigger localStorage fallback in viewer
```

And change the guard condition:

```tsx
// Before:
{reflectionsOpen && savedReflections && savedReflections.length > 0 && (

// After:
{reflectionsOpen && reflectionCount > 0 && (
```

If the `ReflectionsViewerModal` requires a non-empty `reflections` prop, also update it to
accept `null | undefined` and show a "Syncing..." empty state instead of silently not rendering.

---

## C-F-9 — [MOBILE] Cue quizzes missed on seek-forward

**Severity:** Medium  
**File:** `tbt_app/lib/features/courses/presentation/lesson_player_screen.dart` ~L456

**Problem:**  
Cue quizzes fire only within a strict 2-second window:
```dart
if (secs >= atSecs && secs < atSecs + 2) {
```
Seeking forward past a cue skips it permanently because the playhead is already beyond
`atSecs + 2` before the condition can fire. The web has no upper bound: any cue where
`s >= cue.atSeconds` fires, so seeks catch them correctly.

**Fix:**

Remove the upper-bound check. Fire the cue if the playhead has reached or passed it:

```dart
// Before:
if (secs >= atSecs && secs < atSecs + 2) {

// After:
if (secs >= atSecs) {
```

The `_firedCueIds.contains(cueId)` guard above this line already prevents re-firing, so removing
the upper bound is safe.

---

## C-F-12 — [MOBILE] Reflections saved only to SharedPreferences (never to backend)

**Severity:** Medium  
**File:** `tbt_app/lib/features/courses/presentation/lesson_player_screen.dart` ~L599–615  
**Also:** `tbt_app/lib/features/courses/data/courses_service.dart`

**Problem:**  
`_saveReflection(text)` writes to `SharedPreferences` only. The web calls
`PUT /api/user/courses/:courseId/reflections/:lessonId` (COURSE_UX_SPECKIT C-11).
The Flutter `CoursesService` has no `saveReflection()` method at all.
Reflections are lost on reinstall or device change.

**Fix — Step 1:** Add `saveReflection()` to `CoursesService`:

```dart
Future<void> saveReflection(String courseId, String lessonId, String text) async {
  try {
    await _dio.put<void>(
      '$kUserCourses/$courseId/reflections/$lessonId',
      data: {'text': text},
    );
  } on DioException catch (e) {
    throw mapDioError(e);
  }
}
```

**Fix — Step 2:** Update `_saveReflection()` in `LessonPlayerScreen` to also call the backend:

```dart
Future<void> _saveReflection(String text) async {
  // Persist to SharedPreferences for offline / instant read-back.
  final prefs = await SharedPreferences.getInstance();
  final raw = prefs.getString(kPrefReflections) ?? '{}';
  final Map<String, dynamic> map;
  try {
    map = json.decode(raw) as Map<String, dynamic>;
  } catch (_) {
    return;
  }
  final key = '${widget.courseId}:${widget.lessonId}';
  map[key] = {
    'text': text,
    'savedAt': DateTime.now().toIso8601String(),
    'lessonTitle': _playback?.title ?? '',
  };
  await prefs.setString(kPrefReflections, json.encode(map));

  // Persist to backend (fire-and-forget; local copy already saved above).
  ref
      .read(coursesServiceProvider)
      .saveReflection(widget.courseId, widget.lessonId, text)
      .catchError((_) {});
}
```

---

## C-F-3 — [WEB] QuizQuestions extracts via accidental double-nesting

**Severity:** Low  
**File:** `tbt-user-web/app/(platform)/learning/[courseId]/page.tsx` ~L2831–2834

**Problem:**  
`setQuizModal` passes the full lesson object as `quizData`. The extraction path
`quizData?.quizData?.questions` works only because `lesson.quizData.questions` accidentally
matches `quizModal.quizData.quizData.questions`. The fallback path `quizData?.lessons?.find(...)`
is permanently dead code (a lesson object has no `.lessons` array).

**Fix:**

Pass the actual questions array when setting the modal, eliminating the double-nesting:

```ts
// Find the place in the code where quizModal is set for end-of-video quiz.
// Replace the lesson-object payload with just the questions:
setQuizModal({
  episodeId: selectedLesson.id,
  questions: (lesson as any).quizData?.questions ?? [],
});
```

Update `QuizQuestions` to receive `questions: any[]` directly instead of `quizData: any`,
and remove the two-path extraction logic.

---

## C-F-4 — [WEB] Section accordion starts all expanded

**Severity:** Low  
**File:** `tbt-user-web/app/(platform)/learning/[courseId]/page.tsx`

**Problem:**  
`collapsedSections` is initialized to `new Set()` (all expanded). Per spec, sections should start
collapsed except for the one containing the currently active lesson.

**Fix:**

When `courseSections` and `selectedLesson` are first available (inside the lesson-selection
effect or in the `collapsedSections` initialization), seed the set with all section IDs that
do NOT contain the active lesson:

```ts
// When lesson or sections change, collapse all non-active sections.
useEffect(() => {
  if (courseSections.length === 0) return;
  const activeSectionId = (selectedLesson as any)?.sectionId ?? "__unsectioned__";
  const toCollapse = new Set<string>(
    courseSections
      .map((s: any) => s.id)
      .filter((id: string) => id !== activeSectionId)
  );
  setCollapsedSections(toCollapse);
}, [courseSections, selectedLesson?.id]); // eslint-disable-line react-hooks/exhaustive-deps
```

Place this effect after the existing lesson-change effect. The accordion toggle handlers should
remain unchanged — they add/remove from `collapsedSections` normally.

---

## C-F-6 — [WEB] End-of-video quiz can double-trigger on fast videos

**Severity:** Low  
**File:** `tbt-user-web/app/(platform)/learning/[courseId]/page.tsx` ~L1119–1132

**Problem:**  
The quiz trigger effect resets `quizTriggeredForRef.current` to `null` whenever
`watchState !== 'completed'`. On fast videos, the effect can fire once with `watchState='watching'`
(resetting the ref) and immediately again with `watchState='completed'` (setting the quiz),
causing a double-trigger.

**Fix:**

Only reset the ref when the lesson itself changes, not when `watchState` changes:

```ts
useEffect(() => {
  if (!selectedLesson || watchState !== "completed") return;
  if (quizTriggeredForRef.current === selectedLesson.id) return;
  const lesson = course?.lessons?.find((l: any) => l.id === selectedLesson.id);
  if (!lesson || !(lesson as any).hasQuiz) return;
  quizTriggeredForRef.current = selectedLesson.id;
  setQuizModal({ episodeId: selectedLesson.id, quizData: lesson });
}, [watchState, selectedLesson?.id]); // eslint-disable-line react-hooks/exhaustive-deps

// Separate effect: reset the ref ONLY on lesson change.
useEffect(() => {
  quizTriggeredForRef.current = null;
}, [selectedLesson?.id]); // eslint-disable-line react-hooks/exhaustive-deps
```

---

## C-F-11 — [MOBILE] `getCourseSections()` makes redundant network call

**Severity:** Low  
**File:** `tbt_app/lib/features/courses/providers/courses_provider.dart` ~L68–71  
**Also:** `tbt_app/lib/features/courses/data/courses_service.dart` ~L128–138

**Problem:**  
`courseSectionsProvider` calls `getCourseSections(courseId)` which issues a full
`GET /api/user/courses/:courseId` request — the same endpoint already fetched by
`courseDetailProvider`. Every course detail screen makes two identical HTTP requests.

**Fix:**

`courseSectionsProvider` should read the `courseDetailProvider` result and extract sections
from it, rather than making a second network call:

```dart
// In courses_provider.dart — replace courseSectionsProvider:
final courseSectionsProvider = FutureProvider.autoDispose
    .family<List<Map<String, dynamic>>, String>((ref, courseId) async {
  // Read from the already-fetched course detail instead of a new request.
  final detail = await ref.watch(courseDetailProvider(courseId).future);
  // CourseDetail doesn't expose sections in its freezed model (build_runner
  // pin), so fall through to the raw JSON via an existing service method
  // only if detail is already cached (it always will be when sections are needed).
  return ref.read(coursesServiceProvider).getCourseSectionsFromDetail(detail);
});
```

Add `getCourseSectionsFromDetail(CourseDetail detail)` to `CoursesService` that extracts
sections from a raw JSON cache (or returns `[]` if not available). If the SDK pin makes this
difficult, the minimum fix is to ensure `courseDetailProvider` completes first and `courseSections`
waits on it (preventing the parallel race), not to eliminate the call entirely.

---

## C-F-13 — [MOBILE] Progress timer fires while video is paused

**Severity:** Low  
**File:** `tbt_app/lib/features/courses/presentation/lesson_player_screen.dart` ~L370–384

**Problem:**  
`_startProgressTimer()` fires every 30s with no play-state guard. When the video is paused,
progress is still posted (with a stale `_currentTime`). The web heartbeat explicitly guards
on `!isPlayingRef.current`.

**Fix:**

Add a play-state check at the top of the timer callback:

```dart
void _startProgressTimer() {
  _progressTimer?.cancel();
  _progressTimer = Timer.periodic(const Duration(seconds: 30), (_) {
    if (_currentTime <= 0) return;
    // Skip heartbeat while paused — mirrors the web's isPlayingRef guard.
    if (!_isMediaPlaying()) return;
    ref
        .read(coursesServiceProvider)
        .markLessonComplete(
          widget.courseId,
          widget.lessonId,
          watchedSeconds: _currentTime.toInt(),
          isCompleted: false,
        )
        .catchError((_) {});
  });
}

bool _isMediaPlaying() {
  if (_playerController != null) {
    return _playerController!.isPlaying() ?? false;
  }
  return _webViewPlaying;
}
```

If `_isMediaPlaying()` is already defined elsewhere in the file, reuse it.

---

## C-F-14 — [WEB] PaywallView uses `undefined` as initial `lastSectionId`

**Severity:** Low  
**File:** `tbt-user-web/app/(platform)/learning/[courseId]/page.tsx` ~L880

**Problem:**  
`let lastSectionId = undefined as any` means the first unsectioned lesson (`sectionId = null`)
compares `null !== undefined` → `true`, potentially emitting a spurious "General" header.

**Fix:**

Initialize to `null`:

```ts
// Before:
let lastSectionId = undefined as any;

// After:
let lastSectionId: string | null = null;
```

---

## C-F-15 — [WEB] `startRef` set at lesson-select time inflates elapsed fallback

**Severity:** Low  
**File:** `tbt-user-web/app/(platform)/learning/[courseId]/page.tsx` ~L1297, ~L1457

**Problem:**  
`startRef.current = Date.now()` is set at lesson-selection time (L1297). The `handleMarkComplete`
"Mark Complete" button uses `lastPlayheadRef.current` first (correct), but falls back to
`(lesson.resumeAtSeconds ?? 0) + elapsed` — where `elapsed` includes idle time before the user
pressed play. On Bunny iframe videos, `lastPlayheadRef.current` can be 0 for 1–2 seconds
after iframe load, making the fallback briefly active.

**Fix:**

Reset `startRef.current` in the `onPlay` callback (when playback actually starts), not in the
lesson-change effect:

```ts
// In handlePlay / onPlay callback — add:
startRef.current = Date.now() - Math.floor((lastPlayheadRef.current ?? 0) * 1000);
// This sets startRef such that elapsed = playhead position, keeping the
// heartbeat delta calculation correct even after a reset.
```

Alternatively (simpler): in `handleMarkComplete`, never use the elapsed fallback — always
use `lastPlayheadRef.current` if it is ≥ 0, and fall back to `lesson.resumeAtSeconds ?? 0`
if the playhead has never reported:

```ts
const playhead = lastPlayheadRef.current > 0
  ? Math.floor(lastPlayheadRef.current)
  : lesson.resumeAtSeconds ?? 0;
```

---

## Implementation notes

### Order of operations
Fix in this order to avoid regressions:
1. **C-F-10** (mobile invalidation) — isolated change, no dependencies
2. **C-F-1** (heartbeat) — touches the heartbeat block only
3. **C-F-2** (backend description) — single-line backend change; deploy immediately
4. **C-F-8** (Practice Arena filter) — requires updating the call site in `practice_arena_modal.dart`
5. **C-F-5** (enrollments invalidation) — one-line hook change
6. **C-F-7, C-F-12** (reflections) — can be done together
7. Remaining Low items — batch in one commit

### Testing checklist
After each High/Medium fix:
- **C-F-10:** Complete a lesson → navigate back → confirm lesson shows as complete immediately
- **C-F-1:** Pause video for 2 minutes → resume → wait for heartbeat → confirm DB `actual_watched_secs` matches playhead, not 2+ minutes
- **C-F-2:** Open any course with a lesson that has a description → confirm it appears in the sidebar
- **C-F-8:** Open Practice Arena with only 1 lesson completed → confirm only that lesson's questions appear
- **C-F-5:** Complete a lesson → navigate to `/learning` → confirm progress bar updates without refresh
- **C-F-12:** Write a reflection on mobile → reinstall → confirm reflection appears (requires backend read on `ReflectionModal` open too — see COURSE_UX_SPECKIT C-11 for backend endpoint reference)

### Backend endpoint reference (for C-F-12)
`PUT /api/user/courses/:courseId/reflections/:lessonId` — body `{ text: string }`.  
`GET /api/user/courses/:courseId/reflections` — returns `[{ lessonId, text, savedAt }]`.  
Both endpoints are already implemented (COURSE_UX_SPECKIT C-11, confirmed committed 2026-08-25).
