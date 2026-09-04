import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../shared/models/course.dart';
import '../../../shared/models/lesson.dart';
import '../../../shared/providers/socket_provider.dart';
import '../../../shared/socket/socket_events.dart';
import '../data/courses_service.dart';

part 'courses_provider.g.dart';

// ── Course catalog (auto-dispose) ─────────────────────────────────────────────

@riverpod
Future<List<Course>> courses(Ref ref) =>
    ref.read(coursesServiceProvider).listCourses();

// ── Course detail — family, auto-dispose ──────────────────────────────────────
// Hold a ProviderSubscription in the player screen to prevent disposal while
// the player is open.

@riverpod
Future<CourseDetail> courseDetail(Ref ref, String courseId) =>
    ref.read(coursesServiceProvider).getCourseDetail(courseId);

// ── Lesson progress — family, auto-dispose ────────────────────────────────────

@riverpod
Future<List<LessonProgress>> lessonProgress(Ref ref, String courseId) =>
    ref.read(coursesServiceProvider).getLessonProgress(courseId);

// ── My enrollments — keepAlive (accessed from multiple screens) ───────────────

@Riverpod(keepAlive: true)
Future<List<CourseEnrollment>> myEnrollments(Ref ref) =>
    ref.read(coursesServiceProvider).getEnrollments();

// ── Leaderboard — family, auto-dispose ───────────────────────────────────────

@riverpod
Future<CourseLeaderboard> courseLeaderboard(Ref ref, String courseId) =>
    ref.read(coursesServiceProvider).getLeaderboard(courseId);

// ── Badges — keepAlive (shown on learning overview + badges screen) ───────────

@Riverpod(keepAlive: true)
Future<List<EarnedBadge>> earnedBadges(Ref ref) =>
    ref.read(coursesServiceProvider).getBadges();

// ── Certificate eligibility — family, auto-dispose ────────────────────────────

@riverpod
Future<CertEligibility> certEligibility(Ref ref, String courseId) =>
    ref.read(coursesServiceProvider).getCertificateEligibility(courseId);

// ── Course XP — family, auto-dispose ──────────────────────────────────────────
// Plain FutureProvider.family: pubspec is pinned to Dart 3.7.2 but bundled
// Flutter ships 3.7.0, so build_runner can't regenerate. Adding new codegen
// providers here would require a Flutter upgrade or SDK-pin relax.
final courseXpProvider =
    FutureProvider.autoDispose.family<CourseXp, String>((ref, courseId) {
  return ref.read(coursesServiceProvider).getCourseXp(courseId);
});

// ── Course sections — companion to courseDetailProvider ───────────────────────
// Waits for courseDetailProvider so the raw detail cache is populated, then
// extracts sections from it — no second network request.
final courseSectionsProvider = FutureProvider.autoDispose
    .family<List<Map<String, dynamic>>, String>((ref, courseId) async {
  await ref.watch(courseDetailProvider(courseId).future);
  return ref.read(coursesServiceProvider).getCourseSectionsFromDetail(courseId);
});

// ── Pending payment for a course — companion to courseDetailProvider ──────────
// Same SDK-pin caveat as courseXpProvider — read as a separate provider so we
// don't need to regenerate freezed for CourseDetail. Callers invalidate this
// after a paywall action so the "Payment pending" banner appears in-place.
final coursePendingPaymentProvider = FutureProvider.autoDispose
    .family<CoursePendingPayment?, String>((ref, courseId) {
  return ref.read(coursesServiceProvider).getCoursePendingPayment(courseId);
});

// ── Learning overview (enrolled courses) — alias of myEnrollments ─────────────

@Riverpod(keepAlive: true)
Future<List<CourseEnrollment>> learningCourses(Ref ref) =>
    ref.read(coursesServiceProvider).getEnrollments();

// ── Course access granted event (keepAlive) ───────────────────────────────────

/// Holds the courseId from the most recent `course:access_granted` socket event.
/// Screens listen to this to show a SnackBar and the provider invalidates
/// [myEnrollmentsProvider] so the enrollments list refreshes automatically.
@Riverpod(keepAlive: true)
class CourseAccessEventNotifier extends _$CourseAccessEventNotifier {
  @override
  String? build() {
    final socket = ref.read(socketNotifierProvider.notifier);
    void handler(dynamic data) {
      try {
        final map = (data as Map<dynamic, dynamic>).cast<String, dynamic>();
        final courseId = map['courseId'] as String? ?? '';
        state = courseId;
        ref.invalidate(myEnrollmentsProvider);
        ref.invalidate(learningCoursesProvider);
      } catch (_) {
        // Malformed payload — ignore.
      }
    }
    socket.on(kSocketCourseAccessGranted, handler);
    ref.onDispose(() => socket.off(kSocketCourseAccessGranted, handler));
    return null;
  }
}
