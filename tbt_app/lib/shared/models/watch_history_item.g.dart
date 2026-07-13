// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'watch_history_item.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$WatchHistoryItemImpl _$$WatchHistoryItemImplFromJson(
  Map<String, dynamic> json,
) => _$WatchHistoryItemImpl(
  type: json['type'] as String? ?? 'workshop',
  episodeId: json['episodeId'] as String?,
  episodeTitle: json['episodeTitle'] as String?,
  thumbnailUrl: json['thumbnailUrl'] as String?,
  progressPercent: (json['progressPercent'] as num?)?.toInt() ?? 0,
  lastWatchedAt: json['lastWatchedAt'] as String?,
  updatedAt: json['updatedAt'] as String?,
  lastWatchedSecs: (json['lastWatchedSecs'] as num?)?.toInt() ?? 0,
  actualWatchedSecs: (json['actualWatchedSecs'] as num?)?.toInt() ?? 0,
  durationSeconds: (json['durationSeconds'] as num?)?.toInt() ?? 0,
  isCompleted: json['isCompleted'] as bool? ?? false,
  completedAt: json['completedAt'] as String?,
  episodeOrder: (json['episodeOrder'] as num?)?.toInt() ?? 0,
  episodeCount: (json['episodeCount'] as num?)?.toInt() ?? 0,
  challengeTitle: json['challengeTitle'] as String?,
  workshopSlug: json['workshopSlug'] as String?,
  workshopTitle: json['workshopTitle'] as String?,
  courseId: json['courseId'] as String?,
  courseTitle: json['courseTitle'] as String?,
  id: json['id'] as String?,
  lessonId: json['lessonId'] as String?,
  title: json['title'] as String?,
  lastLessonTitle: json['lastLessonTitle'] as String?,
  remainingSecs: (json['remainingSecs'] as num?)?.toInt() ?? 0,
);

Map<String, dynamic> _$$WatchHistoryItemImplToJson(
  _$WatchHistoryItemImpl instance,
) => <String, dynamic>{
  'type': instance.type,
  'episodeId': instance.episodeId,
  'episodeTitle': instance.episodeTitle,
  'thumbnailUrl': instance.thumbnailUrl,
  'progressPercent': instance.progressPercent,
  'lastWatchedAt': instance.lastWatchedAt,
  'updatedAt': instance.updatedAt,
  'lastWatchedSecs': instance.lastWatchedSecs,
  'actualWatchedSecs': instance.actualWatchedSecs,
  'durationSeconds': instance.durationSeconds,
  'isCompleted': instance.isCompleted,
  'completedAt': instance.completedAt,
  'episodeOrder': instance.episodeOrder,
  'episodeCount': instance.episodeCount,
  'challengeTitle': instance.challengeTitle,
  'workshopSlug': instance.workshopSlug,
  'workshopTitle': instance.workshopTitle,
  'courseId': instance.courseId,
  'courseTitle': instance.courseTitle,
  'id': instance.id,
  'lessonId': instance.lessonId,
  'title': instance.title,
  'lastLessonTitle': instance.lastLessonTitle,
  'remainingSecs': instance.remainingSecs,
};

_$DashboardStatsImpl _$$DashboardStatsImplFromJson(Map<String, dynamic> json) =>
    _$DashboardStatsImpl(
      totalCourses: (json['totalCourses'] as num?)?.toInt() ?? 0,
      completedCourses: (json['completedCourses'] as num?)?.toInt() ?? 0,
      inProgressCourses: (json['inProgressCourses'] as num?)?.toInt() ?? 0,
      totalPoints: (json['totalPoints'] as num?)?.toInt() ?? 0,
      currentStreak: (json['currentStreak'] as num?)?.toInt() ?? 0,
      upcomingEvents: (json['upcomingEvents'] as num?)?.toInt() ?? 0,
      unreadNotifications: (json['unreadNotifications'] as num?)?.toInt() ?? 0,
    );

Map<String, dynamic> _$$DashboardStatsImplToJson(
  _$DashboardStatsImpl instance,
) => <String, dynamic>{
  'totalCourses': instance.totalCourses,
  'completedCourses': instance.completedCourses,
  'inProgressCourses': instance.inProgressCourses,
  'totalPoints': instance.totalPoints,
  'currentStreak': instance.currentStreak,
  'upcomingEvents': instance.upcomingEvents,
  'unreadNotifications': instance.unreadNotifications,
};
