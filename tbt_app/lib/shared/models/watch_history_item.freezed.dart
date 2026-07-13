// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'watch_history_item.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

WatchHistoryItem _$WatchHistoryItemFromJson(Map<String, dynamic> json) {
  return _WatchHistoryItem.fromJson(json);
}

/// @nodoc
mixin _$WatchHistoryItem {
  /// `"workshop"` or `"course"`
  String get type =>
      throw _privateConstructorUsedError; // ── Common ──────────────────────────────────────────────────────────────
  String? get episodeId => throw _privateConstructorUsedError;
  String? get episodeTitle => throw _privateConstructorUsedError;
  String? get thumbnailUrl => throw _privateConstructorUsedError;
  int get progressPercent => throw _privateConstructorUsedError;
  String? get lastWatchedAt => throw _privateConstructorUsedError;
  String? get updatedAt => throw _privateConstructorUsedError;
  int get lastWatchedSecs => throw _privateConstructorUsedError;
  int get actualWatchedSecs => throw _privateConstructorUsedError;
  int get durationSeconds => throw _privateConstructorUsedError;
  bool get isCompleted => throw _privateConstructorUsedError;
  String? get completedAt => throw _privateConstructorUsedError;
  int get episodeOrder => throw _privateConstructorUsedError;
  int get episodeCount => throw _privateConstructorUsedError;
  String? get challengeTitle =>
      throw _privateConstructorUsedError; // ── Workshop-specific ────────────────────────────────────────────────────
  String? get workshopSlug => throw _privateConstructorUsedError;
  String? get workshopTitle =>
      throw _privateConstructorUsedError; // ── Course-specific ──────────────────────────────────────────────────────
  String? get courseId => throw _privateConstructorUsedError;
  String? get courseTitle =>
      throw _privateConstructorUsedError; // ── ContinueLearning extras ──────────────────────────────────────────────
  /// Present on continue-learning items; matches the course/workshop id.
  String? get id => throw _privateConstructorUsedError;
  String? get lessonId => throw _privateConstructorUsedError;

  /// Display title (course/workshop name).
  String? get title => throw _privateConstructorUsedError;
  String? get lastLessonTitle => throw _privateConstructorUsedError;
  int get remainingSecs => throw _privateConstructorUsedError;

  /// Serializes this WatchHistoryItem to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of WatchHistoryItem
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $WatchHistoryItemCopyWith<WatchHistoryItem> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $WatchHistoryItemCopyWith<$Res> {
  factory $WatchHistoryItemCopyWith(
    WatchHistoryItem value,
    $Res Function(WatchHistoryItem) then,
  ) = _$WatchHistoryItemCopyWithImpl<$Res, WatchHistoryItem>;
  @useResult
  $Res call({
    String type,
    String? episodeId,
    String? episodeTitle,
    String? thumbnailUrl,
    int progressPercent,
    String? lastWatchedAt,
    String? updatedAt,
    int lastWatchedSecs,
    int actualWatchedSecs,
    int durationSeconds,
    bool isCompleted,
    String? completedAt,
    int episodeOrder,
    int episodeCount,
    String? challengeTitle,
    String? workshopSlug,
    String? workshopTitle,
    String? courseId,
    String? courseTitle,
    String? id,
    String? lessonId,
    String? title,
    String? lastLessonTitle,
    int remainingSecs,
  });
}

/// @nodoc
class _$WatchHistoryItemCopyWithImpl<$Res, $Val extends WatchHistoryItem>
    implements $WatchHistoryItemCopyWith<$Res> {
  _$WatchHistoryItemCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of WatchHistoryItem
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? type = null,
    Object? episodeId = freezed,
    Object? episodeTitle = freezed,
    Object? thumbnailUrl = freezed,
    Object? progressPercent = null,
    Object? lastWatchedAt = freezed,
    Object? updatedAt = freezed,
    Object? lastWatchedSecs = null,
    Object? actualWatchedSecs = null,
    Object? durationSeconds = null,
    Object? isCompleted = null,
    Object? completedAt = freezed,
    Object? episodeOrder = null,
    Object? episodeCount = null,
    Object? challengeTitle = freezed,
    Object? workshopSlug = freezed,
    Object? workshopTitle = freezed,
    Object? courseId = freezed,
    Object? courseTitle = freezed,
    Object? id = freezed,
    Object? lessonId = freezed,
    Object? title = freezed,
    Object? lastLessonTitle = freezed,
    Object? remainingSecs = null,
  }) {
    return _then(
      _value.copyWith(
            type:
                null == type
                    ? _value.type
                    : type // ignore: cast_nullable_to_non_nullable
                        as String,
            episodeId:
                freezed == episodeId
                    ? _value.episodeId
                    : episodeId // ignore: cast_nullable_to_non_nullable
                        as String?,
            episodeTitle:
                freezed == episodeTitle
                    ? _value.episodeTitle
                    : episodeTitle // ignore: cast_nullable_to_non_nullable
                        as String?,
            thumbnailUrl:
                freezed == thumbnailUrl
                    ? _value.thumbnailUrl
                    : thumbnailUrl // ignore: cast_nullable_to_non_nullable
                        as String?,
            progressPercent:
                null == progressPercent
                    ? _value.progressPercent
                    : progressPercent // ignore: cast_nullable_to_non_nullable
                        as int,
            lastWatchedAt:
                freezed == lastWatchedAt
                    ? _value.lastWatchedAt
                    : lastWatchedAt // ignore: cast_nullable_to_non_nullable
                        as String?,
            updatedAt:
                freezed == updatedAt
                    ? _value.updatedAt
                    : updatedAt // ignore: cast_nullable_to_non_nullable
                        as String?,
            lastWatchedSecs:
                null == lastWatchedSecs
                    ? _value.lastWatchedSecs
                    : lastWatchedSecs // ignore: cast_nullable_to_non_nullable
                        as int,
            actualWatchedSecs:
                null == actualWatchedSecs
                    ? _value.actualWatchedSecs
                    : actualWatchedSecs // ignore: cast_nullable_to_non_nullable
                        as int,
            durationSeconds:
                null == durationSeconds
                    ? _value.durationSeconds
                    : durationSeconds // ignore: cast_nullable_to_non_nullable
                        as int,
            isCompleted:
                null == isCompleted
                    ? _value.isCompleted
                    : isCompleted // ignore: cast_nullable_to_non_nullable
                        as bool,
            completedAt:
                freezed == completedAt
                    ? _value.completedAt
                    : completedAt // ignore: cast_nullable_to_non_nullable
                        as String?,
            episodeOrder:
                null == episodeOrder
                    ? _value.episodeOrder
                    : episodeOrder // ignore: cast_nullable_to_non_nullable
                        as int,
            episodeCount:
                null == episodeCount
                    ? _value.episodeCount
                    : episodeCount // ignore: cast_nullable_to_non_nullable
                        as int,
            challengeTitle:
                freezed == challengeTitle
                    ? _value.challengeTitle
                    : challengeTitle // ignore: cast_nullable_to_non_nullable
                        as String?,
            workshopSlug:
                freezed == workshopSlug
                    ? _value.workshopSlug
                    : workshopSlug // ignore: cast_nullable_to_non_nullable
                        as String?,
            workshopTitle:
                freezed == workshopTitle
                    ? _value.workshopTitle
                    : workshopTitle // ignore: cast_nullable_to_non_nullable
                        as String?,
            courseId:
                freezed == courseId
                    ? _value.courseId
                    : courseId // ignore: cast_nullable_to_non_nullable
                        as String?,
            courseTitle:
                freezed == courseTitle
                    ? _value.courseTitle
                    : courseTitle // ignore: cast_nullable_to_non_nullable
                        as String?,
            id:
                freezed == id
                    ? _value.id
                    : id // ignore: cast_nullable_to_non_nullable
                        as String?,
            lessonId:
                freezed == lessonId
                    ? _value.lessonId
                    : lessonId // ignore: cast_nullable_to_non_nullable
                        as String?,
            title:
                freezed == title
                    ? _value.title
                    : title // ignore: cast_nullable_to_non_nullable
                        as String?,
            lastLessonTitle:
                freezed == lastLessonTitle
                    ? _value.lastLessonTitle
                    : lastLessonTitle // ignore: cast_nullable_to_non_nullable
                        as String?,
            remainingSecs:
                null == remainingSecs
                    ? _value.remainingSecs
                    : remainingSecs // ignore: cast_nullable_to_non_nullable
                        as int,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$WatchHistoryItemImplCopyWith<$Res>
    implements $WatchHistoryItemCopyWith<$Res> {
  factory _$$WatchHistoryItemImplCopyWith(
    _$WatchHistoryItemImpl value,
    $Res Function(_$WatchHistoryItemImpl) then,
  ) = __$$WatchHistoryItemImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    String type,
    String? episodeId,
    String? episodeTitle,
    String? thumbnailUrl,
    int progressPercent,
    String? lastWatchedAt,
    String? updatedAt,
    int lastWatchedSecs,
    int actualWatchedSecs,
    int durationSeconds,
    bool isCompleted,
    String? completedAt,
    int episodeOrder,
    int episodeCount,
    String? challengeTitle,
    String? workshopSlug,
    String? workshopTitle,
    String? courseId,
    String? courseTitle,
    String? id,
    String? lessonId,
    String? title,
    String? lastLessonTitle,
    int remainingSecs,
  });
}

/// @nodoc
class __$$WatchHistoryItemImplCopyWithImpl<$Res>
    extends _$WatchHistoryItemCopyWithImpl<$Res, _$WatchHistoryItemImpl>
    implements _$$WatchHistoryItemImplCopyWith<$Res> {
  __$$WatchHistoryItemImplCopyWithImpl(
    _$WatchHistoryItemImpl _value,
    $Res Function(_$WatchHistoryItemImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of WatchHistoryItem
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? type = null,
    Object? episodeId = freezed,
    Object? episodeTitle = freezed,
    Object? thumbnailUrl = freezed,
    Object? progressPercent = null,
    Object? lastWatchedAt = freezed,
    Object? updatedAt = freezed,
    Object? lastWatchedSecs = null,
    Object? actualWatchedSecs = null,
    Object? durationSeconds = null,
    Object? isCompleted = null,
    Object? completedAt = freezed,
    Object? episodeOrder = null,
    Object? episodeCount = null,
    Object? challengeTitle = freezed,
    Object? workshopSlug = freezed,
    Object? workshopTitle = freezed,
    Object? courseId = freezed,
    Object? courseTitle = freezed,
    Object? id = freezed,
    Object? lessonId = freezed,
    Object? title = freezed,
    Object? lastLessonTitle = freezed,
    Object? remainingSecs = null,
  }) {
    return _then(
      _$WatchHistoryItemImpl(
        type:
            null == type
                ? _value.type
                : type // ignore: cast_nullable_to_non_nullable
                    as String,
        episodeId:
            freezed == episodeId
                ? _value.episodeId
                : episodeId // ignore: cast_nullable_to_non_nullable
                    as String?,
        episodeTitle:
            freezed == episodeTitle
                ? _value.episodeTitle
                : episodeTitle // ignore: cast_nullable_to_non_nullable
                    as String?,
        thumbnailUrl:
            freezed == thumbnailUrl
                ? _value.thumbnailUrl
                : thumbnailUrl // ignore: cast_nullable_to_non_nullable
                    as String?,
        progressPercent:
            null == progressPercent
                ? _value.progressPercent
                : progressPercent // ignore: cast_nullable_to_non_nullable
                    as int,
        lastWatchedAt:
            freezed == lastWatchedAt
                ? _value.lastWatchedAt
                : lastWatchedAt // ignore: cast_nullable_to_non_nullable
                    as String?,
        updatedAt:
            freezed == updatedAt
                ? _value.updatedAt
                : updatedAt // ignore: cast_nullable_to_non_nullable
                    as String?,
        lastWatchedSecs:
            null == lastWatchedSecs
                ? _value.lastWatchedSecs
                : lastWatchedSecs // ignore: cast_nullable_to_non_nullable
                    as int,
        actualWatchedSecs:
            null == actualWatchedSecs
                ? _value.actualWatchedSecs
                : actualWatchedSecs // ignore: cast_nullable_to_non_nullable
                    as int,
        durationSeconds:
            null == durationSeconds
                ? _value.durationSeconds
                : durationSeconds // ignore: cast_nullable_to_non_nullable
                    as int,
        isCompleted:
            null == isCompleted
                ? _value.isCompleted
                : isCompleted // ignore: cast_nullable_to_non_nullable
                    as bool,
        completedAt:
            freezed == completedAt
                ? _value.completedAt
                : completedAt // ignore: cast_nullable_to_non_nullable
                    as String?,
        episodeOrder:
            null == episodeOrder
                ? _value.episodeOrder
                : episodeOrder // ignore: cast_nullable_to_non_nullable
                    as int,
        episodeCount:
            null == episodeCount
                ? _value.episodeCount
                : episodeCount // ignore: cast_nullable_to_non_nullable
                    as int,
        challengeTitle:
            freezed == challengeTitle
                ? _value.challengeTitle
                : challengeTitle // ignore: cast_nullable_to_non_nullable
                    as String?,
        workshopSlug:
            freezed == workshopSlug
                ? _value.workshopSlug
                : workshopSlug // ignore: cast_nullable_to_non_nullable
                    as String?,
        workshopTitle:
            freezed == workshopTitle
                ? _value.workshopTitle
                : workshopTitle // ignore: cast_nullable_to_non_nullable
                    as String?,
        courseId:
            freezed == courseId
                ? _value.courseId
                : courseId // ignore: cast_nullable_to_non_nullable
                    as String?,
        courseTitle:
            freezed == courseTitle
                ? _value.courseTitle
                : courseTitle // ignore: cast_nullable_to_non_nullable
                    as String?,
        id:
            freezed == id
                ? _value.id
                : id // ignore: cast_nullable_to_non_nullable
                    as String?,
        lessonId:
            freezed == lessonId
                ? _value.lessonId
                : lessonId // ignore: cast_nullable_to_non_nullable
                    as String?,
        title:
            freezed == title
                ? _value.title
                : title // ignore: cast_nullable_to_non_nullable
                    as String?,
        lastLessonTitle:
            freezed == lastLessonTitle
                ? _value.lastLessonTitle
                : lastLessonTitle // ignore: cast_nullable_to_non_nullable
                    as String?,
        remainingSecs:
            null == remainingSecs
                ? _value.remainingSecs
                : remainingSecs // ignore: cast_nullable_to_non_nullable
                    as int,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$WatchHistoryItemImpl implements _WatchHistoryItem {
  const _$WatchHistoryItemImpl({
    this.type = 'workshop',
    this.episodeId,
    this.episodeTitle,
    this.thumbnailUrl,
    this.progressPercent = 0,
    this.lastWatchedAt,
    this.updatedAt,
    this.lastWatchedSecs = 0,
    this.actualWatchedSecs = 0,
    this.durationSeconds = 0,
    this.isCompleted = false,
    this.completedAt,
    this.episodeOrder = 0,
    this.episodeCount = 0,
    this.challengeTitle,
    this.workshopSlug,
    this.workshopTitle,
    this.courseId,
    this.courseTitle,
    this.id,
    this.lessonId,
    this.title,
    this.lastLessonTitle,
    this.remainingSecs = 0,
  });

  factory _$WatchHistoryItemImpl.fromJson(Map<String, dynamic> json) =>
      _$$WatchHistoryItemImplFromJson(json);

  /// `"workshop"` or `"course"`
  @override
  @JsonKey()
  final String type;
  // ── Common ──────────────────────────────────────────────────────────────
  @override
  final String? episodeId;
  @override
  final String? episodeTitle;
  @override
  final String? thumbnailUrl;
  @override
  @JsonKey()
  final int progressPercent;
  @override
  final String? lastWatchedAt;
  @override
  final String? updatedAt;
  @override
  @JsonKey()
  final int lastWatchedSecs;
  @override
  @JsonKey()
  final int actualWatchedSecs;
  @override
  @JsonKey()
  final int durationSeconds;
  @override
  @JsonKey()
  final bool isCompleted;
  @override
  final String? completedAt;
  @override
  @JsonKey()
  final int episodeOrder;
  @override
  @JsonKey()
  final int episodeCount;
  @override
  final String? challengeTitle;
  // ── Workshop-specific ────────────────────────────────────────────────────
  @override
  final String? workshopSlug;
  @override
  final String? workshopTitle;
  // ── Course-specific ──────────────────────────────────────────────────────
  @override
  final String? courseId;
  @override
  final String? courseTitle;
  // ── ContinueLearning extras ──────────────────────────────────────────────
  /// Present on continue-learning items; matches the course/workshop id.
  @override
  final String? id;
  @override
  final String? lessonId;

  /// Display title (course/workshop name).
  @override
  final String? title;
  @override
  final String? lastLessonTitle;
  @override
  @JsonKey()
  final int remainingSecs;

  @override
  String toString() {
    return 'WatchHistoryItem(type: $type, episodeId: $episodeId, episodeTitle: $episodeTitle, thumbnailUrl: $thumbnailUrl, progressPercent: $progressPercent, lastWatchedAt: $lastWatchedAt, updatedAt: $updatedAt, lastWatchedSecs: $lastWatchedSecs, actualWatchedSecs: $actualWatchedSecs, durationSeconds: $durationSeconds, isCompleted: $isCompleted, completedAt: $completedAt, episodeOrder: $episodeOrder, episodeCount: $episodeCount, challengeTitle: $challengeTitle, workshopSlug: $workshopSlug, workshopTitle: $workshopTitle, courseId: $courseId, courseTitle: $courseTitle, id: $id, lessonId: $lessonId, title: $title, lastLessonTitle: $lastLessonTitle, remainingSecs: $remainingSecs)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$WatchHistoryItemImpl &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.episodeId, episodeId) ||
                other.episodeId == episodeId) &&
            (identical(other.episodeTitle, episodeTitle) ||
                other.episodeTitle == episodeTitle) &&
            (identical(other.thumbnailUrl, thumbnailUrl) ||
                other.thumbnailUrl == thumbnailUrl) &&
            (identical(other.progressPercent, progressPercent) ||
                other.progressPercent == progressPercent) &&
            (identical(other.lastWatchedAt, lastWatchedAt) ||
                other.lastWatchedAt == lastWatchedAt) &&
            (identical(other.updatedAt, updatedAt) ||
                other.updatedAt == updatedAt) &&
            (identical(other.lastWatchedSecs, lastWatchedSecs) ||
                other.lastWatchedSecs == lastWatchedSecs) &&
            (identical(other.actualWatchedSecs, actualWatchedSecs) ||
                other.actualWatchedSecs == actualWatchedSecs) &&
            (identical(other.durationSeconds, durationSeconds) ||
                other.durationSeconds == durationSeconds) &&
            (identical(other.isCompleted, isCompleted) ||
                other.isCompleted == isCompleted) &&
            (identical(other.completedAt, completedAt) ||
                other.completedAt == completedAt) &&
            (identical(other.episodeOrder, episodeOrder) ||
                other.episodeOrder == episodeOrder) &&
            (identical(other.episodeCount, episodeCount) ||
                other.episodeCount == episodeCount) &&
            (identical(other.challengeTitle, challengeTitle) ||
                other.challengeTitle == challengeTitle) &&
            (identical(other.workshopSlug, workshopSlug) ||
                other.workshopSlug == workshopSlug) &&
            (identical(other.workshopTitle, workshopTitle) ||
                other.workshopTitle == workshopTitle) &&
            (identical(other.courseId, courseId) ||
                other.courseId == courseId) &&
            (identical(other.courseTitle, courseTitle) ||
                other.courseTitle == courseTitle) &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.lessonId, lessonId) ||
                other.lessonId == lessonId) &&
            (identical(other.title, title) || other.title == title) &&
            (identical(other.lastLessonTitle, lastLessonTitle) ||
                other.lastLessonTitle == lastLessonTitle) &&
            (identical(other.remainingSecs, remainingSecs) ||
                other.remainingSecs == remainingSecs));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hashAll([
    runtimeType,
    type,
    episodeId,
    episodeTitle,
    thumbnailUrl,
    progressPercent,
    lastWatchedAt,
    updatedAt,
    lastWatchedSecs,
    actualWatchedSecs,
    durationSeconds,
    isCompleted,
    completedAt,
    episodeOrder,
    episodeCount,
    challengeTitle,
    workshopSlug,
    workshopTitle,
    courseId,
    courseTitle,
    id,
    lessonId,
    title,
    lastLessonTitle,
    remainingSecs,
  ]);

  /// Create a copy of WatchHistoryItem
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$WatchHistoryItemImplCopyWith<_$WatchHistoryItemImpl> get copyWith =>
      __$$WatchHistoryItemImplCopyWithImpl<_$WatchHistoryItemImpl>(
        this,
        _$identity,
      );

  @override
  Map<String, dynamic> toJson() {
    return _$$WatchHistoryItemImplToJson(this);
  }
}

abstract class _WatchHistoryItem implements WatchHistoryItem {
  const factory _WatchHistoryItem({
    final String type,
    final String? episodeId,
    final String? episodeTitle,
    final String? thumbnailUrl,
    final int progressPercent,
    final String? lastWatchedAt,
    final String? updatedAt,
    final int lastWatchedSecs,
    final int actualWatchedSecs,
    final int durationSeconds,
    final bool isCompleted,
    final String? completedAt,
    final int episodeOrder,
    final int episodeCount,
    final String? challengeTitle,
    final String? workshopSlug,
    final String? workshopTitle,
    final String? courseId,
    final String? courseTitle,
    final String? id,
    final String? lessonId,
    final String? title,
    final String? lastLessonTitle,
    final int remainingSecs,
  }) = _$WatchHistoryItemImpl;

  factory _WatchHistoryItem.fromJson(Map<String, dynamic> json) =
      _$WatchHistoryItemImpl.fromJson;

  /// `"workshop"` or `"course"`
  @override
  String get type; // ── Common ──────────────────────────────────────────────────────────────
  @override
  String? get episodeId;
  @override
  String? get episodeTitle;
  @override
  String? get thumbnailUrl;
  @override
  int get progressPercent;
  @override
  String? get lastWatchedAt;
  @override
  String? get updatedAt;
  @override
  int get lastWatchedSecs;
  @override
  int get actualWatchedSecs;
  @override
  int get durationSeconds;
  @override
  bool get isCompleted;
  @override
  String? get completedAt;
  @override
  int get episodeOrder;
  @override
  int get episodeCount;
  @override
  String? get challengeTitle; // ── Workshop-specific ────────────────────────────────────────────────────
  @override
  String? get workshopSlug;
  @override
  String? get workshopTitle; // ── Course-specific ──────────────────────────────────────────────────────
  @override
  String? get courseId;
  @override
  String? get courseTitle; // ── ContinueLearning extras ──────────────────────────────────────────────
  /// Present on continue-learning items; matches the course/workshop id.
  @override
  String? get id;
  @override
  String? get lessonId;

  /// Display title (course/workshop name).
  @override
  String? get title;
  @override
  String? get lastLessonTitle;
  @override
  int get remainingSecs;

  /// Create a copy of WatchHistoryItem
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$WatchHistoryItemImplCopyWith<_$WatchHistoryItemImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

DashboardStats _$DashboardStatsFromJson(Map<String, dynamic> json) {
  return _DashboardStats.fromJson(json);
}

/// @nodoc
mixin _$DashboardStats {
  int get totalCourses => throw _privateConstructorUsedError;
  int get completedCourses => throw _privateConstructorUsedError;
  int get inProgressCourses => throw _privateConstructorUsedError;
  int get totalPoints => throw _privateConstructorUsedError;
  int get currentStreak => throw _privateConstructorUsedError;
  int get upcomingEvents => throw _privateConstructorUsedError;
  int get unreadNotifications => throw _privateConstructorUsedError;

  /// Serializes this DashboardStats to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardStats
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardStatsCopyWith<DashboardStats> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardStatsCopyWith<$Res> {
  factory $DashboardStatsCopyWith(
    DashboardStats value,
    $Res Function(DashboardStats) then,
  ) = _$DashboardStatsCopyWithImpl<$Res, DashboardStats>;
  @useResult
  $Res call({
    int totalCourses,
    int completedCourses,
    int inProgressCourses,
    int totalPoints,
    int currentStreak,
    int upcomingEvents,
    int unreadNotifications,
  });
}

/// @nodoc
class _$DashboardStatsCopyWithImpl<$Res, $Val extends DashboardStats>
    implements $DashboardStatsCopyWith<$Res> {
  _$DashboardStatsCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardStats
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? totalCourses = null,
    Object? completedCourses = null,
    Object? inProgressCourses = null,
    Object? totalPoints = null,
    Object? currentStreak = null,
    Object? upcomingEvents = null,
    Object? unreadNotifications = null,
  }) {
    return _then(
      _value.copyWith(
            totalCourses:
                null == totalCourses
                    ? _value.totalCourses
                    : totalCourses // ignore: cast_nullable_to_non_nullable
                        as int,
            completedCourses:
                null == completedCourses
                    ? _value.completedCourses
                    : completedCourses // ignore: cast_nullable_to_non_nullable
                        as int,
            inProgressCourses:
                null == inProgressCourses
                    ? _value.inProgressCourses
                    : inProgressCourses // ignore: cast_nullable_to_non_nullable
                        as int,
            totalPoints:
                null == totalPoints
                    ? _value.totalPoints
                    : totalPoints // ignore: cast_nullable_to_non_nullable
                        as int,
            currentStreak:
                null == currentStreak
                    ? _value.currentStreak
                    : currentStreak // ignore: cast_nullable_to_non_nullable
                        as int,
            upcomingEvents:
                null == upcomingEvents
                    ? _value.upcomingEvents
                    : upcomingEvents // ignore: cast_nullable_to_non_nullable
                        as int,
            unreadNotifications:
                null == unreadNotifications
                    ? _value.unreadNotifications
                    : unreadNotifications // ignore: cast_nullable_to_non_nullable
                        as int,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$DashboardStatsImplCopyWith<$Res>
    implements $DashboardStatsCopyWith<$Res> {
  factory _$$DashboardStatsImplCopyWith(
    _$DashboardStatsImpl value,
    $Res Function(_$DashboardStatsImpl) then,
  ) = __$$DashboardStatsImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    int totalCourses,
    int completedCourses,
    int inProgressCourses,
    int totalPoints,
    int currentStreak,
    int upcomingEvents,
    int unreadNotifications,
  });
}

/// @nodoc
class __$$DashboardStatsImplCopyWithImpl<$Res>
    extends _$DashboardStatsCopyWithImpl<$Res, _$DashboardStatsImpl>
    implements _$$DashboardStatsImplCopyWith<$Res> {
  __$$DashboardStatsImplCopyWithImpl(
    _$DashboardStatsImpl _value,
    $Res Function(_$DashboardStatsImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of DashboardStats
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? totalCourses = null,
    Object? completedCourses = null,
    Object? inProgressCourses = null,
    Object? totalPoints = null,
    Object? currentStreak = null,
    Object? upcomingEvents = null,
    Object? unreadNotifications = null,
  }) {
    return _then(
      _$DashboardStatsImpl(
        totalCourses:
            null == totalCourses
                ? _value.totalCourses
                : totalCourses // ignore: cast_nullable_to_non_nullable
                    as int,
        completedCourses:
            null == completedCourses
                ? _value.completedCourses
                : completedCourses // ignore: cast_nullable_to_non_nullable
                    as int,
        inProgressCourses:
            null == inProgressCourses
                ? _value.inProgressCourses
                : inProgressCourses // ignore: cast_nullable_to_non_nullable
                    as int,
        totalPoints:
            null == totalPoints
                ? _value.totalPoints
                : totalPoints // ignore: cast_nullable_to_non_nullable
                    as int,
        currentStreak:
            null == currentStreak
                ? _value.currentStreak
                : currentStreak // ignore: cast_nullable_to_non_nullable
                    as int,
        upcomingEvents:
            null == upcomingEvents
                ? _value.upcomingEvents
                : upcomingEvents // ignore: cast_nullable_to_non_nullable
                    as int,
        unreadNotifications:
            null == unreadNotifications
                ? _value.unreadNotifications
                : unreadNotifications // ignore: cast_nullable_to_non_nullable
                    as int,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardStatsImpl implements _DashboardStats {
  const _$DashboardStatsImpl({
    this.totalCourses = 0,
    this.completedCourses = 0,
    this.inProgressCourses = 0,
    this.totalPoints = 0,
    this.currentStreak = 0,
    this.upcomingEvents = 0,
    this.unreadNotifications = 0,
  });

  factory _$DashboardStatsImpl.fromJson(Map<String, dynamic> json) =>
      _$$DashboardStatsImplFromJson(json);

  @override
  @JsonKey()
  final int totalCourses;
  @override
  @JsonKey()
  final int completedCourses;
  @override
  @JsonKey()
  final int inProgressCourses;
  @override
  @JsonKey()
  final int totalPoints;
  @override
  @JsonKey()
  final int currentStreak;
  @override
  @JsonKey()
  final int upcomingEvents;
  @override
  @JsonKey()
  final int unreadNotifications;

  @override
  String toString() {
    return 'DashboardStats(totalCourses: $totalCourses, completedCourses: $completedCourses, inProgressCourses: $inProgressCourses, totalPoints: $totalPoints, currentStreak: $currentStreak, upcomingEvents: $upcomingEvents, unreadNotifications: $unreadNotifications)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardStatsImpl &&
            (identical(other.totalCourses, totalCourses) ||
                other.totalCourses == totalCourses) &&
            (identical(other.completedCourses, completedCourses) ||
                other.completedCourses == completedCourses) &&
            (identical(other.inProgressCourses, inProgressCourses) ||
                other.inProgressCourses == inProgressCourses) &&
            (identical(other.totalPoints, totalPoints) ||
                other.totalPoints == totalPoints) &&
            (identical(other.currentStreak, currentStreak) ||
                other.currentStreak == currentStreak) &&
            (identical(other.upcomingEvents, upcomingEvents) ||
                other.upcomingEvents == upcomingEvents) &&
            (identical(other.unreadNotifications, unreadNotifications) ||
                other.unreadNotifications == unreadNotifications));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
    runtimeType,
    totalCourses,
    completedCourses,
    inProgressCourses,
    totalPoints,
    currentStreak,
    upcomingEvents,
    unreadNotifications,
  );

  /// Create a copy of DashboardStats
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardStatsImplCopyWith<_$DashboardStatsImpl> get copyWith =>
      __$$DashboardStatsImplCopyWithImpl<_$DashboardStatsImpl>(
        this,
        _$identity,
      );

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardStatsImplToJson(this);
  }
}

abstract class _DashboardStats implements DashboardStats {
  const factory _DashboardStats({
    final int totalCourses,
    final int completedCourses,
    final int inProgressCourses,
    final int totalPoints,
    final int currentStreak,
    final int upcomingEvents,
    final int unreadNotifications,
  }) = _$DashboardStatsImpl;

  factory _DashboardStats.fromJson(Map<String, dynamic> json) =
      _$DashboardStatsImpl.fromJson;

  @override
  int get totalCourses;
  @override
  int get completedCourses;
  @override
  int get inProgressCourses;
  @override
  int get totalPoints;
  @override
  int get currentStreak;
  @override
  int get upcomingEvents;
  @override
  int get unreadNotifications;

  /// Create a copy of DashboardStats
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardStatsImplCopyWith<_$DashboardStatsImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
