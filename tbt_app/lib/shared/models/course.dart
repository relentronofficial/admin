import 'package:freezed_annotation/freezed_annotation.dart';

import 'lesson.dart';

part 'course.freezed.dart';
part 'course.g.dart';

@freezed
class CourseInstructor with _$CourseInstructor {
  const factory CourseInstructor({
    required String id,
    required String fullName,
    String? profilePhotoUrl,
    String? designation,
  }) = _CourseInstructor;

  factory CourseInstructor.fromJson(Map<String, dynamic> json) =>
      _$CourseInstructorFromJson(json);
}

@freezed
class CourseCount with _$CourseCount {
  const factory CourseCount({
    @Default(0) int lessons,
    @Default(0) int enrollments,
  }) = _CourseCount;

  factory CourseCount.fromJson(Map<String, dynamic> json) =>
      _$CourseCountFromJson(json);
}

// ── Course list item (GET /api/user/courses) ───────────────────────────────────

@freezed
class Course with _$Course {
  const factory Course({
    required String id,
    required String slug,
    required String title,
    String? description,
    String? thumbnailUrl,
    String? level,
    double? durationHours,
    String? durationDisplay,
    double? price,
    @Default(true) bool isPublished,
    @Default(false) bool isFeatured,
    @Default(10) int xpPerEpisode,
    @Default(false) bool hasAccess,
    CourseInstructor? instructor,
    @JsonKey(name: '_count') CourseCount? count,
  }) = _Course;

  factory Course.fromJson(Map<String, dynamic> json) =>
      _$CourseFromJson(json);
}

// ── Course detail (GET /api/user/courses/:id) ──────────────────────────────────

// Plain (non-freezed) — a pending payment record indicates the user has
// previously started checkout but admin hasn't approved yet. The backend
// returns it as `pendingPayment: { id, paymentUrl }` inside the course
// detail payload. Not on `CourseDetail` (would require build_runner regen);
// exposed via a companion provider that reads the same endpoint.
class CoursePendingPayment {
  const CoursePendingPayment({required this.id, this.paymentUrl});
  final String id;
  final String? paymentUrl;

  static CoursePendingPayment? fromJson(Map<String, dynamic>? json) {
    if (json == null) return null;
    final id = json['id'] as String?;
    if (id == null || id.isEmpty) return null;
    return CoursePendingPayment(
      id: id,
      paymentUrl: json['paymentUrl'] as String?,
    );
  }
}

@freezed
class CourseDetail with _$CourseDetail {
  const factory CourseDetail({
    required String id,
    required String slug,
    required String title,
    String? description,
    String? thumbnailUrl,
    String? level,
    double? durationHours,
    double? price,
    @Default(true) bool isPublished,
    @Default(false) bool isFeatured,
    @Default(10) int xpPerEpisode,
    @Default(70) int passingScorePercent,
    String? paymentLinkUrl,
    @Default(false) bool hasAccess,
    String? accessType,
    String? accessExpiresAt,
    CourseInstructor? instructor,
    @JsonKey(name: '_count') CourseCount? count,
    @Default([]) List<Lesson> lessons,
  }) = _CourseDetail;

  factory CourseDetail.fromJson(Map<String, dynamic> json) =>
      _$CourseDetailFromJson(json);
}

// ── Enrollment (GET /api/user/enrollments) ────────────────────────────────────

@freezed
class CourseEnrollment with _$CourseEnrollment {
  const factory CourseEnrollment({
    required String id,
    required String courseId,
    required String memberId,
    required String enrolledAt,
    String? completedAt,
    @Default(0) int progressPercent,
    Course? course,
  }) = _CourseEnrollment;

  factory CourseEnrollment.fromJson(Map<String, dynamic> json) =>
      _$CourseEnrollmentFromJson(json);
}
