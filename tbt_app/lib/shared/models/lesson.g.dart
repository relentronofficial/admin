// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'lesson.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$LessonImpl _$$LessonImplFromJson(Map<String, dynamic> json) => _$LessonImpl(
  id: json['id'] as String,
  title: json['title'] as String,
  type:
      $enumDecodeNullable(_$LessonTypeEnumMap, json['type']) ??
      LessonType.video,
  hlsUrl: json['hlsUrl'] as String?,
  videoUrl: json['videoUrl'] as String?,
  videoType: json['videoType'] as String? ?? 'iframe',
  durationSeconds: (json['durationSeconds'] as num?)?.toInt(),
  duration: (json['duration'] as num?)?.toInt(),
  order: (json['order'] as num?)?.toInt() ?? 0,
  hasQuiz: json['hasQuiz'] as bool? ?? false,
  isCompleted: json['isCompleted'] as bool? ?? false,
  resumeAtSeconds: (json['resumeAtSeconds'] as num?)?.toInt() ?? 0,
  actualWatchedSecs: (json['actualWatchedSecs'] as num?)?.toInt() ?? 0,
  quizUnlockPercent: (json['quizUnlockPercent'] as num?)?.toInt() ?? 80,
  locked: json['locked'] as bool? ?? false,
  completedByThreshold: json['completedByThreshold'] as bool? ?? false,
  watchPercent: (json['watchPercent'] as num?)?.toInt(),
  sectionId: json['sectionId'] as String?,
  sectionTitle: json['sectionTitle'] as String?,
  sectionOrder: (json['sectionOrder'] as num?)?.toInt(),
);

Map<String, dynamic> _$$LessonImplToJson(_$LessonImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'title': instance.title,
      'type': _$LessonTypeEnumMap[instance.type]!,
      'hlsUrl': instance.hlsUrl,
      'videoUrl': instance.videoUrl,
      'videoType': instance.videoType,
      'durationSeconds': instance.durationSeconds,
      'duration': instance.duration,
      'order': instance.order,
      'hasQuiz': instance.hasQuiz,
      'isCompleted': instance.isCompleted,
      'resumeAtSeconds': instance.resumeAtSeconds,
      'actualWatchedSecs': instance.actualWatchedSecs,
      'quizUnlockPercent': instance.quizUnlockPercent,
      'locked': instance.locked,
      'completedByThreshold': instance.completedByThreshold,
      'watchPercent': instance.watchPercent,
      'sectionId': instance.sectionId,
      'sectionTitle': instance.sectionTitle,
      'sectionOrder': instance.sectionOrder,
    };

const _$LessonTypeEnumMap = {
  LessonType.video: 'video',
  LessonType.assignment: 'assignment',
  LessonType.offer: 'offer',
};

_$EpisodePlaybackImpl _$$EpisodePlaybackImplFromJson(
  Map<String, dynamic> json,
) => _$EpisodePlaybackImpl(
  id: json['id'] as String,
  title: json['title'] as String,
  description: json['description'] as String?,
  videoUrl: json['videoUrl'] as String?,
  hlsUrl: json['hlsUrl'] as String?,
  videoType: json['videoType'] as String? ?? 'iframe',
  durationSeconds: (json['durationSeconds'] as num?)?.toInt(),
  resumeAtSeconds: (json['resumeAtSeconds'] as num?)?.toInt() ?? 0,
  isCompleted: json['isCompleted'] as bool? ?? false,
  hasQuiz: json['hasQuiz'] as bool? ?? false,
  quizData: json['quizData'] as Map<String, dynamic>?,
  quizUnlockPercent: (json['quizUnlockPercent'] as num?)?.toInt() ?? 80,
);

Map<String, dynamic> _$$EpisodePlaybackImplToJson(
  _$EpisodePlaybackImpl instance,
) => <String, dynamic>{
  'id': instance.id,
  'title': instance.title,
  'description': instance.description,
  'videoUrl': instance.videoUrl,
  'hlsUrl': instance.hlsUrl,
  'videoType': instance.videoType,
  'durationSeconds': instance.durationSeconds,
  'resumeAtSeconds': instance.resumeAtSeconds,
  'isCompleted': instance.isCompleted,
  'hasQuiz': instance.hasQuiz,
  if (instance.quizData case final value?) 'quizData': value,
  'quizUnlockPercent': instance.quizUnlockPercent,
};

_$LessonProgressImpl _$$LessonProgressImplFromJson(Map<String, dynamic> json) =>
    _$LessonProgressImpl(
      lessonId: json['lessonId'] as String,
      completed: json['completed'] as bool? ?? false,
      completedAt: json['completedAt'] as String?,
    );

Map<String, dynamic> _$$LessonProgressImplToJson(
  _$LessonProgressImpl instance,
) => <String, dynamic>{
  'lessonId': instance.lessonId,
  'completed': instance.completed,
  'completedAt': instance.completedAt,
};

_$LeaderboardMemberImpl _$$LeaderboardMemberImplFromJson(
  Map<String, dynamic> json,
) => _$LeaderboardMemberImpl(
  id: json['id'] as String,
  firstName: json['firstName'] as String?,
  lastName: json['lastName'] as String?,
  profilePhotoUrl: json['profilePhotoUrl'] as String?,
);

Map<String, dynamic> _$$LeaderboardMemberImplToJson(
  _$LeaderboardMemberImpl instance,
) => <String, dynamic>{
  'id': instance.id,
  'firstName': instance.firstName,
  'lastName': instance.lastName,
  'profilePhotoUrl': instance.profilePhotoUrl,
};

_$LeaderboardEntryImpl _$$LeaderboardEntryImplFromJson(
  Map<String, dynamic> json,
) => _$LeaderboardEntryImpl(
  rank: (json['rank'] as num).toInt(),
  memberId: json['memberId'] as String,
  member:
      json['member'] == null
          ? null
          : LeaderboardMember.fromJson(json['member'] as Map<String, dynamic>),
  totalXp: (json['totalXp'] as num?)?.toInt() ?? 0,
  isMe: json['isMe'] as bool? ?? false,
);

Map<String, dynamic> _$$LeaderboardEntryImplToJson(
  _$LeaderboardEntryImpl instance,
) => <String, dynamic>{
  'rank': instance.rank,
  'memberId': instance.memberId,
  'member': instance.member,
  'totalXp': instance.totalXp,
  'isMe': instance.isMe,
};

_$CourseLeaderboardImpl _$$CourseLeaderboardImplFromJson(
  Map<String, dynamic> json,
) => _$CourseLeaderboardImpl(
  leaderboard:
      (json['leaderboard'] as List<dynamic>?)
          ?.map((e) => LeaderboardEntry.fromJson(e as Map<String, dynamic>))
          .toList() ??
      const [],
  myRank: (json['myRank'] as num?)?.toInt(),
);

Map<String, dynamic> _$$CourseLeaderboardImplToJson(
  _$CourseLeaderboardImpl instance,
) => <String, dynamic>{
  'leaderboard': instance.leaderboard,
  'myRank': instance.myRank,
};

_$CourseBadgeInfoImpl _$$CourseBadgeInfoImplFromJson(
  Map<String, dynamic> json,
) => _$CourseBadgeInfoImpl(
  id: json['id'] as String,
  name: json['name'] as String,
  description: json['description'] as String?,
  imageUrl: json['imageUrl'] as String?,
);

Map<String, dynamic> _$$CourseBadgeInfoImplToJson(
  _$CourseBadgeInfoImpl instance,
) => <String, dynamic>{
  'id': instance.id,
  'name': instance.name,
  'description': instance.description,
  'imageUrl': instance.imageUrl,
};

_$EarnedBadgeImpl _$$EarnedBadgeImplFromJson(Map<String, dynamic> json) =>
    _$EarnedBadgeImpl(
      id: json['id'] as String,
      earnedAt: json['earnedAt'] as String,
      badge: CourseBadgeInfo.fromJson(json['badge'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$EarnedBadgeImplToJson(_$EarnedBadgeImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'earnedAt': instance.earnedAt,
      'badge': instance.badge,
    };

_$CertEligibilityImpl _$$CertEligibilityImplFromJson(
  Map<String, dynamic> json,
) => _$CertEligibilityImpl(
  eligible: json['eligible'] as bool? ?? false,
  completionPercentage: (json['completionPercentage'] as num?)?.toInt() ?? 0,
  remainingLessons: (json['remainingLessons'] as num?)?.toInt() ?? 0,
  securityStatus: json['securityStatus'] as String? ?? 'clear',
);

Map<String, dynamic> _$$CertEligibilityImplToJson(
  _$CertEligibilityImpl instance,
) => <String, dynamic>{
  'eligible': instance.eligible,
  'completionPercentage': instance.completionPercentage,
  'remainingLessons': instance.remainingLessons,
  'securityStatus': instance.securityStatus,
};
