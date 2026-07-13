import 'package:freezed_annotation/freezed_annotation.dart';

part 'watch_history_item.freezed.dart';
part 'watch_history_item.g.dart';

/// Unified item returned by both `/api/user/dashboard/watch-history`
/// and `/api/user/dashboard/continue-learning`.
///
/// Discriminated by [type]: `"workshop"` or `"course"`.
@freezed
class WatchHistoryItem with _$WatchHistoryItem {
  const factory WatchHistoryItem({
    /// `"workshop"` or `"course"`
    @Default('workshop') String type,

    // ── Common ──────────────────────────────────────────────────────────────
    String? episodeId,
    String? episodeTitle,
    String? thumbnailUrl,
    @Default(0) int progressPercent,
    String? lastWatchedAt,
    String? updatedAt,
    @Default(0) int lastWatchedSecs,
    @Default(0) int actualWatchedSecs,
    @Default(0) int durationSeconds,
    @Default(false) bool isCompleted,
    String? completedAt,
    @Default(0) int episodeOrder,
    @Default(0) int episodeCount,
    String? challengeTitle,

    // ── Workshop-specific ────────────────────────────────────────────────────
    String? workshopSlug,
    String? workshopTitle,

    // ── Course-specific ──────────────────────────────────────────────────────
    String? courseId,
    String? courseTitle,

    // ── ContinueLearning extras ──────────────────────────────────────────────
    /// Present on continue-learning items; matches the course/workshop id.
    String? id,
    String? lessonId,
    /// Display title (course/workshop name).
    String? title,
    String? lastLessonTitle,
    @Default(0) int remainingSecs,
  }) = _WatchHistoryItem;

  factory WatchHistoryItem.fromJson(Map<String, dynamic> json) =>
      _$WatchHistoryItemFromJson(json);
}

/// Lightweight stat block returned by `/api/user/dashboard/stats`.
@freezed
class DashboardStats with _$DashboardStats {
  const factory DashboardStats({
    @Default(0) int totalCourses,
    @Default(0) int completedCourses,
    @Default(0) int inProgressCourses,
    @Default(0) int totalPoints,
    @Default(0) int currentStreak,
    @Default(0) int upcomingEvents,
    @Default(0) int unreadNotifications,
  }) = _DashboardStats;

  factory DashboardStats.fromJson(Map<String, dynamic> json) =>
      _$DashboardStatsFromJson(json);
}
