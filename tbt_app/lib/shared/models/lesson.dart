import 'package:freezed_annotation/freezed_annotation.dart';

part 'lesson.freezed.dart';
part 'lesson.g.dart';

// Valid values: video | assignment | offer
enum LessonType {
  @JsonValue('video') video,
  @JsonValue('assignment') assignment,
  @JsonValue('offer') offer,
}

@freezed
class Lesson with _$Lesson {
  const factory Lesson({
    required String id,
    required String title,
    @Default(LessonType.video) LessonType type,
    String? hlsUrl,
    String? videoUrl,
    @Default('iframe') String videoType,
    int? durationSeconds,
    int? duration, // minutes
    @Default(0) int order,
    @Default(false) bool hasQuiz,
    @Default(false) bool isCompleted,
    @Default(0) int resumeAtSeconds,
    @Default(0) int actualWatchedSecs,
    @Default(80) int quizUnlockPercent,
    // Server-authoritative sequential-unlock state (2026-07-16).
    // When true, the lesson is locked until the previous lesson meets
    // the course's completion threshold. Default false so pre-fix
    // backends (which don't return this field) don't gate anything.
    @Default(false) bool locked,
    // Server-computed completion from watched-fraction >= threshold.
    // May diverge from `isCompleted` briefly when a new heartbeat
    // has been posted but the client hasn't refetched; use this for
    // display purposes and `isCompleted` for legacy compatibility.
    @Default(false) bool completedByThreshold,
    // 0..100, may be null if backend can't compute the exact fraction.
    int? watchPercent,
  }) = _Lesson;

  factory Lesson.fromJson(Map<String, dynamic> json) =>
      _$LessonFromJson(json);
}

// ── Episode playback (GET /api/user/episodes/:id/playback) ────────────────────

@freezed
class EpisodePlayback with _$EpisodePlayback {
  const factory EpisodePlayback({
    required String id,
    required String title,
    String? description,
    String? videoUrl,
    String? hlsUrl,
    @Default('iframe') String videoType,
    int? durationSeconds,
    @Default(0) int resumeAtSeconds,
    @Default(false) bool isCompleted,
    @Default(false) bool hasQuiz,
    @JsonKey(includeIfNull: false) Map<String, dynamic>? quizData,
    @Default(80) int quizUnlockPercent,
  }) = _EpisodePlayback;

  factory EpisodePlayback.fromJson(Map<String, dynamic> json) =>
      _$EpisodePlaybackFromJson(json);
}

// ── Lesson progress (GET /api/user/enrollments/:courseId/progress) ────────────

@freezed
class LessonProgress with _$LessonProgress {
  const factory LessonProgress({
    required String lessonId,
    @Default(false) bool completed,
    String? completedAt,
  }) = _LessonProgress;

  factory LessonProgress.fromJson(Map<String, dynamic> json) =>
      _$LessonProgressFromJson(json);
}

// ── Leaderboard (GET /api/user/courses/:id/leaderboard) ───────────────────────

@freezed
class LeaderboardMember with _$LeaderboardMember {
  const factory LeaderboardMember({
    required String id,
    String? firstName,
    String? lastName,
    String? profilePhotoUrl,
  }) = _LeaderboardMember;

  factory LeaderboardMember.fromJson(Map<String, dynamic> json) =>
      _$LeaderboardMemberFromJson(json);
}

@freezed
class LeaderboardEntry with _$LeaderboardEntry {
  const factory LeaderboardEntry({
    required int rank,
    required String memberId,
    LeaderboardMember? member,
    @Default(0) int totalXp,
    @Default(false) bool isMe,
  }) = _LeaderboardEntry;

  factory LeaderboardEntry.fromJson(Map<String, dynamic> json) =>
      _$LeaderboardEntryFromJson(json);
}

@freezed
class CourseLeaderboard with _$CourseLeaderboard {
  const factory CourseLeaderboard({
    @Default([]) List<LeaderboardEntry> leaderboard,
    int? myRank,
  }) = _CourseLeaderboard;

  factory CourseLeaderboard.fromJson(Map<String, dynamic> json) =>
      _$CourseLeaderboardFromJson(json);
}

// ── Badges (GET /api/user/badges) ─────────────────────────────────────────────

@freezed
class CourseBadgeInfo with _$CourseBadgeInfo {
  const factory CourseBadgeInfo({
    required String id,
    required String name,
    String? description,
    String? imageUrl,
  }) = _CourseBadgeInfo;

  factory CourseBadgeInfo.fromJson(Map<String, dynamic> json) =>
      _$CourseBadgeInfoFromJson(json);
}

@freezed
class EarnedBadge with _$EarnedBadge {
  const factory EarnedBadge({
    required String id,
    required String earnedAt,
    required CourseBadgeInfo badge,
  }) = _EarnedBadge;

  factory EarnedBadge.fromJson(Map<String, dynamic> json) =>
      _$EarnedBadgeFromJson(json);
}

// ── Certificate eligibility ───────────────────────────────────────────────────

@freezed
class CertEligibility with _$CertEligibility {
  const factory CertEligibility({
    @Default(false) bool eligible,
    @Default(0) int completionPercentage,
    @Default(0) int remainingLessons,
    @Default('clear') String securityStatus,
  }) = _CertEligibility;

  factory CertEligibility.fromJson(Map<String, dynamic> json) =>
      _$CertEligibilityFromJson(json);
}
