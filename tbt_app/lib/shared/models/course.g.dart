// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'course.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$CourseInstructorImpl _$$CourseInstructorImplFromJson(
  Map<String, dynamic> json,
) => _$CourseInstructorImpl(
  id: json['id'] as String,
  fullName: json['fullName'] as String,
  profilePhotoUrl: json['profilePhotoUrl'] as String?,
  designation: json['designation'] as String?,
);

Map<String, dynamic> _$$CourseInstructorImplToJson(
  _$CourseInstructorImpl instance,
) => <String, dynamic>{
  'id': instance.id,
  'fullName': instance.fullName,
  'profilePhotoUrl': instance.profilePhotoUrl,
  'designation': instance.designation,
};

_$CourseCountImpl _$$CourseCountImplFromJson(Map<String, dynamic> json) =>
    _$CourseCountImpl(
      lessons: (json['lessons'] as num?)?.toInt() ?? 0,
      enrollments: (json['enrollments'] as num?)?.toInt() ?? 0,
    );

Map<String, dynamic> _$$CourseCountImplToJson(_$CourseCountImpl instance) =>
    <String, dynamic>{
      'lessons': instance.lessons,
      'enrollments': instance.enrollments,
    };

_$CourseImpl _$$CourseImplFromJson(Map<String, dynamic> json) => _$CourseImpl(
  id: json['id'] as String,
  slug: json['slug'] as String,
  title: json['title'] as String,
  description: json['description'] as String?,
  thumbnailUrl: json['thumbnailUrl'] as String?,
  level: json['level'] as String?,
  durationHours: (json['durationHours'] as num?)?.toDouble(),
  durationDisplay: json['durationDisplay'] as String?,
  price: (json['price'] as num?)?.toDouble(),
  isPublished: json['isPublished'] as bool? ?? true,
  isFeatured: json['isFeatured'] as bool? ?? false,
  xpPerEpisode: (json['xpPerEpisode'] as num?)?.toInt() ?? 10,
  hasAccess: json['hasAccess'] as bool? ?? false,
  instructor:
      json['instructor'] == null
          ? null
          : CourseInstructor.fromJson(
            json['instructor'] as Map<String, dynamic>,
          ),
  count:
      json['_count'] == null
          ? null
          : CourseCount.fromJson(json['_count'] as Map<String, dynamic>),
);

Map<String, dynamic> _$$CourseImplToJson(_$CourseImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'slug': instance.slug,
      'title': instance.title,
      'description': instance.description,
      'thumbnailUrl': instance.thumbnailUrl,
      'level': instance.level,
      'durationHours': instance.durationHours,
      'durationDisplay': instance.durationDisplay,
      'price': instance.price,
      'isPublished': instance.isPublished,
      'isFeatured': instance.isFeatured,
      'xpPerEpisode': instance.xpPerEpisode,
      'hasAccess': instance.hasAccess,
      'instructor': instance.instructor,
      '_count': instance.count,
    };

_$CourseDetailImpl _$$CourseDetailImplFromJson(Map<String, dynamic> json) =>
    _$CourseDetailImpl(
      id: json['id'] as String,
      slug: json['slug'] as String,
      title: json['title'] as String,
      description: json['description'] as String?,
      thumbnailUrl: json['thumbnailUrl'] as String?,
      level: json['level'] as String?,
      durationHours: (json['durationHours'] as num?)?.toDouble(),
      price: (json['price'] as num?)?.toDouble(),
      isPublished: json['isPublished'] as bool? ?? true,
      isFeatured: json['isFeatured'] as bool? ?? false,
      xpPerEpisode: (json['xpPerEpisode'] as num?)?.toInt() ?? 10,
      passingScorePercent: (json['passingScorePercent'] as num?)?.toInt() ?? 70,
      paymentLinkUrl: json['paymentLinkUrl'] as String?,
      hasAccess: json['hasAccess'] as bool? ?? false,
      accessType: json['accessType'] as String?,
      accessExpiresAt: json['accessExpiresAt'] as String?,
      instructor:
          json['instructor'] == null
              ? null
              : CourseInstructor.fromJson(
                json['instructor'] as Map<String, dynamic>,
              ),
      count:
          json['_count'] == null
              ? null
              : CourseCount.fromJson(json['_count'] as Map<String, dynamic>),
      lessons:
          (json['lessons'] as List<dynamic>?)
              ?.map((e) => Lesson.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
    );

Map<String, dynamic> _$$CourseDetailImplToJson(_$CourseDetailImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'slug': instance.slug,
      'title': instance.title,
      'description': instance.description,
      'thumbnailUrl': instance.thumbnailUrl,
      'level': instance.level,
      'durationHours': instance.durationHours,
      'price': instance.price,
      'isPublished': instance.isPublished,
      'isFeatured': instance.isFeatured,
      'xpPerEpisode': instance.xpPerEpisode,
      'passingScorePercent': instance.passingScorePercent,
      'paymentLinkUrl': instance.paymentLinkUrl,
      'hasAccess': instance.hasAccess,
      'accessType': instance.accessType,
      'accessExpiresAt': instance.accessExpiresAt,
      'instructor': instance.instructor,
      '_count': instance.count,
      'lessons': instance.lessons,
    };

_$CourseEnrollmentImpl _$$CourseEnrollmentImplFromJson(
  Map<String, dynamic> json,
) => _$CourseEnrollmentImpl(
  id: json['id'] as String,
  courseId: json['courseId'] as String,
  memberId: json['memberId'] as String,
  enrolledAt: json['enrolledAt'] as String,
  completedAt: json['completedAt'] as String?,
  progressPercent: (json['progressPercent'] as num?)?.toInt() ?? 0,
  course:
      json['course'] == null
          ? null
          : Course.fromJson(json['course'] as Map<String, dynamic>),
);

Map<String, dynamic> _$$CourseEnrollmentImplToJson(
  _$CourseEnrollmentImpl instance,
) => <String, dynamic>{
  'id': instance.id,
  'courseId': instance.courseId,
  'memberId': instance.memberId,
  'enrolledAt': instance.enrolledAt,
  'completedAt': instance.completedAt,
  'progressPercent': instance.progressPercent,
  'course': instance.course,
};
