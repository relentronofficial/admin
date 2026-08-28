// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'lesson.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

Lesson _$LessonFromJson(Map<String, dynamic> json) {
  return _Lesson.fromJson(json);
}

/// @nodoc
mixin _$Lesson {
  String get id => throw _privateConstructorUsedError;
  String get title => throw _privateConstructorUsedError;
  LessonType get type => throw _privateConstructorUsedError;
  String? get hlsUrl => throw _privateConstructorUsedError;
  String? get videoUrl => throw _privateConstructorUsedError;
  String get videoType => throw _privateConstructorUsedError;
  int? get durationSeconds => throw _privateConstructorUsedError;
  int? get duration => throw _privateConstructorUsedError; // minutes
  int get order => throw _privateConstructorUsedError;
  bool get hasQuiz => throw _privateConstructorUsedError;
  bool get isCompleted => throw _privateConstructorUsedError;
  int get resumeAtSeconds => throw _privateConstructorUsedError;
  int get actualWatchedSecs => throw _privateConstructorUsedError;
  int get quizUnlockPercent =>
      throw _privateConstructorUsedError; // Server-authoritative sequential-unlock state (2026-07-16).
  // When true, the lesson is locked until the previous lesson meets
  // the course's completion threshold. Default false so pre-fix
  // backends (which don't return this field) don't gate anything.
  bool get locked =>
      throw _privateConstructorUsedError; // Server-computed completion from watched-fraction >= threshold.
  // May diverge from `isCompleted` briefly when a new heartbeat
  // has been posted but the client hasn't refetched; use this for
  // display purposes and `isCompleted` for legacy compatibility.
  bool get completedByThreshold =>
      throw _privateConstructorUsedError; // 0..100, may be null if backend can't compute the exact fraction.
  int? get watchPercent =>
      throw _privateConstructorUsedError; // Section grouping (null = unsectioned)
  String? get sectionId => throw _privateConstructorUsedError;
  String? get sectionTitle => throw _privateConstructorUsedError;
  int? get sectionOrder => throw _privateConstructorUsedError;

  /// Serializes this Lesson to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of Lesson
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $LessonCopyWith<Lesson> get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $LessonCopyWith<$Res> {
  factory $LessonCopyWith(Lesson value, $Res Function(Lesson) then) =
      _$LessonCopyWithImpl<$Res, Lesson>;
  @useResult
  $Res call({
    String id,
    String title,
    LessonType type,
    String? hlsUrl,
    String? videoUrl,
    String videoType,
    int? durationSeconds,
    int? duration,
    int order,
    bool hasQuiz,
    bool isCompleted,
    int resumeAtSeconds,
    int actualWatchedSecs,
    int quizUnlockPercent,
    bool locked,
    bool completedByThreshold,
    int? watchPercent,
    String? sectionId,
    String? sectionTitle,
    int? sectionOrder,
  });
}

/// @nodoc
class _$LessonCopyWithImpl<$Res, $Val extends Lesson>
    implements $LessonCopyWith<$Res> {
  _$LessonCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of Lesson
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? title = null,
    Object? type = null,
    Object? hlsUrl = freezed,
    Object? videoUrl = freezed,
    Object? videoType = null,
    Object? durationSeconds = freezed,
    Object? duration = freezed,
    Object? order = null,
    Object? hasQuiz = null,
    Object? isCompleted = null,
    Object? resumeAtSeconds = null,
    Object? actualWatchedSecs = null,
    Object? quizUnlockPercent = null,
    Object? locked = null,
    Object? completedByThreshold = null,
    Object? watchPercent = freezed,
    Object? sectionId = freezed,
    Object? sectionTitle = freezed,
    Object? sectionOrder = freezed,
  }) {
    return _then(
      _value.copyWith(
            id:
                null == id
                    ? _value.id
                    : id // ignore: cast_nullable_to_non_nullable
                        as String,
            title:
                null == title
                    ? _value.title
                    : title // ignore: cast_nullable_to_non_nullable
                        as String,
            type:
                null == type
                    ? _value.type
                    : type // ignore: cast_nullable_to_non_nullable
                        as LessonType,
            hlsUrl:
                freezed == hlsUrl
                    ? _value.hlsUrl
                    : hlsUrl // ignore: cast_nullable_to_non_nullable
                        as String?,
            videoUrl:
                freezed == videoUrl
                    ? _value.videoUrl
                    : videoUrl // ignore: cast_nullable_to_non_nullable
                        as String?,
            videoType:
                null == videoType
                    ? _value.videoType
                    : videoType // ignore: cast_nullable_to_non_nullable
                        as String,
            durationSeconds:
                freezed == durationSeconds
                    ? _value.durationSeconds
                    : durationSeconds // ignore: cast_nullable_to_non_nullable
                        as int?,
            duration:
                freezed == duration
                    ? _value.duration
                    : duration // ignore: cast_nullable_to_non_nullable
                        as int?,
            order:
                null == order
                    ? _value.order
                    : order // ignore: cast_nullable_to_non_nullable
                        as int,
            hasQuiz:
                null == hasQuiz
                    ? _value.hasQuiz
                    : hasQuiz // ignore: cast_nullable_to_non_nullable
                        as bool,
            isCompleted:
                null == isCompleted
                    ? _value.isCompleted
                    : isCompleted // ignore: cast_nullable_to_non_nullable
                        as bool,
            resumeAtSeconds:
                null == resumeAtSeconds
                    ? _value.resumeAtSeconds
                    : resumeAtSeconds // ignore: cast_nullable_to_non_nullable
                        as int,
            actualWatchedSecs:
                null == actualWatchedSecs
                    ? _value.actualWatchedSecs
                    : actualWatchedSecs // ignore: cast_nullable_to_non_nullable
                        as int,
            quizUnlockPercent:
                null == quizUnlockPercent
                    ? _value.quizUnlockPercent
                    : quizUnlockPercent // ignore: cast_nullable_to_non_nullable
                        as int,
            locked:
                null == locked
                    ? _value.locked
                    : locked // ignore: cast_nullable_to_non_nullable
                        as bool,
            completedByThreshold:
                null == completedByThreshold
                    ? _value.completedByThreshold
                    : completedByThreshold // ignore: cast_nullable_to_non_nullable
                        as bool,
            watchPercent:
                freezed == watchPercent
                    ? _value.watchPercent
                    : watchPercent // ignore: cast_nullable_to_non_nullable
                        as int?,
            sectionId:
                freezed == sectionId
                    ? _value.sectionId
                    : sectionId // ignore: cast_nullable_to_non_nullable
                        as String?,
            sectionTitle:
                freezed == sectionTitle
                    ? _value.sectionTitle
                    : sectionTitle // ignore: cast_nullable_to_non_nullable
                        as String?,
            sectionOrder:
                freezed == sectionOrder
                    ? _value.sectionOrder
                    : sectionOrder // ignore: cast_nullable_to_non_nullable
                        as int?,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$LessonImplCopyWith<$Res> implements $LessonCopyWith<$Res> {
  factory _$$LessonImplCopyWith(
    _$LessonImpl value,
    $Res Function(_$LessonImpl) then,
  ) = __$$LessonImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    String id,
    String title,
    LessonType type,
    String? hlsUrl,
    String? videoUrl,
    String videoType,
    int? durationSeconds,
    int? duration,
    int order,
    bool hasQuiz,
    bool isCompleted,
    int resumeAtSeconds,
    int actualWatchedSecs,
    int quizUnlockPercent,
    bool locked,
    bool completedByThreshold,
    int? watchPercent,
    String? sectionId,
    String? sectionTitle,
    int? sectionOrder,
  });
}

/// @nodoc
class __$$LessonImplCopyWithImpl<$Res>
    extends _$LessonCopyWithImpl<$Res, _$LessonImpl>
    implements _$$LessonImplCopyWith<$Res> {
  __$$LessonImplCopyWithImpl(
    _$LessonImpl _value,
    $Res Function(_$LessonImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of Lesson
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? title = null,
    Object? type = null,
    Object? hlsUrl = freezed,
    Object? videoUrl = freezed,
    Object? videoType = null,
    Object? durationSeconds = freezed,
    Object? duration = freezed,
    Object? order = null,
    Object? hasQuiz = null,
    Object? isCompleted = null,
    Object? resumeAtSeconds = null,
    Object? actualWatchedSecs = null,
    Object? quizUnlockPercent = null,
    Object? locked = null,
    Object? completedByThreshold = null,
    Object? watchPercent = freezed,
    Object? sectionId = freezed,
    Object? sectionTitle = freezed,
    Object? sectionOrder = freezed,
  }) {
    return _then(
      _$LessonImpl(
        id:
            null == id
                ? _value.id
                : id // ignore: cast_nullable_to_non_nullable
                    as String,
        title:
            null == title
                ? _value.title
                : title // ignore: cast_nullable_to_non_nullable
                    as String,
        type:
            null == type
                ? _value.type
                : type // ignore: cast_nullable_to_non_nullable
                    as LessonType,
        hlsUrl:
            freezed == hlsUrl
                ? _value.hlsUrl
                : hlsUrl // ignore: cast_nullable_to_non_nullable
                    as String?,
        videoUrl:
            freezed == videoUrl
                ? _value.videoUrl
                : videoUrl // ignore: cast_nullable_to_non_nullable
                    as String?,
        videoType:
            null == videoType
                ? _value.videoType
                : videoType // ignore: cast_nullable_to_non_nullable
                    as String,
        durationSeconds:
            freezed == durationSeconds
                ? _value.durationSeconds
                : durationSeconds // ignore: cast_nullable_to_non_nullable
                    as int?,
        duration:
            freezed == duration
                ? _value.duration
                : duration // ignore: cast_nullable_to_non_nullable
                    as int?,
        order:
            null == order
                ? _value.order
                : order // ignore: cast_nullable_to_non_nullable
                    as int,
        hasQuiz:
            null == hasQuiz
                ? _value.hasQuiz
                : hasQuiz // ignore: cast_nullable_to_non_nullable
                    as bool,
        isCompleted:
            null == isCompleted
                ? _value.isCompleted
                : isCompleted // ignore: cast_nullable_to_non_nullable
                    as bool,
        resumeAtSeconds:
            null == resumeAtSeconds
                ? _value.resumeAtSeconds
                : resumeAtSeconds // ignore: cast_nullable_to_non_nullable
                    as int,
        actualWatchedSecs:
            null == actualWatchedSecs
                ? _value.actualWatchedSecs
                : actualWatchedSecs // ignore: cast_nullable_to_non_nullable
                    as int,
        quizUnlockPercent:
            null == quizUnlockPercent
                ? _value.quizUnlockPercent
                : quizUnlockPercent // ignore: cast_nullable_to_non_nullable
                    as int,
        locked:
            null == locked
                ? _value.locked
                : locked // ignore: cast_nullable_to_non_nullable
                    as bool,
        completedByThreshold:
            null == completedByThreshold
                ? _value.completedByThreshold
                : completedByThreshold // ignore: cast_nullable_to_non_nullable
                    as bool,
        watchPercent:
            freezed == watchPercent
                ? _value.watchPercent
                : watchPercent // ignore: cast_nullable_to_non_nullable
                    as int?,
        sectionId:
            freezed == sectionId
                ? _value.sectionId
                : sectionId // ignore: cast_nullable_to_non_nullable
                    as String?,
        sectionTitle:
            freezed == sectionTitle
                ? _value.sectionTitle
                : sectionTitle // ignore: cast_nullable_to_non_nullable
                    as String?,
        sectionOrder:
            freezed == sectionOrder
                ? _value.sectionOrder
                : sectionOrder // ignore: cast_nullable_to_non_nullable
                    as int?,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$LessonImpl implements _Lesson {
  const _$LessonImpl({
    required this.id,
    required this.title,
    this.type = LessonType.video,
    this.hlsUrl,
    this.videoUrl,
    this.videoType = 'iframe',
    this.durationSeconds,
    this.duration,
    this.order = 0,
    this.hasQuiz = false,
    this.isCompleted = false,
    this.resumeAtSeconds = 0,
    this.actualWatchedSecs = 0,
    this.quizUnlockPercent = 80,
    this.locked = false,
    this.completedByThreshold = false,
    this.watchPercent,
    this.sectionId,
    this.sectionTitle,
    this.sectionOrder,
  });

  factory _$LessonImpl.fromJson(Map<String, dynamic> json) =>
      _$$LessonImplFromJson(json);

  @override
  final String id;
  @override
  final String title;
  @override
  @JsonKey()
  final LessonType type;
  @override
  final String? hlsUrl;
  @override
  final String? videoUrl;
  @override
  @JsonKey()
  final String videoType;
  @override
  final int? durationSeconds;
  @override
  final int? duration;
  // minutes
  @override
  @JsonKey()
  final int order;
  @override
  @JsonKey()
  final bool hasQuiz;
  @override
  @JsonKey()
  final bool isCompleted;
  @override
  @JsonKey()
  final int resumeAtSeconds;
  @override
  @JsonKey()
  final int actualWatchedSecs;
  @override
  @JsonKey()
  final int quizUnlockPercent;
  // Server-authoritative sequential-unlock state (2026-07-16).
  // When true, the lesson is locked until the previous lesson meets
  // the course's completion threshold. Default false so pre-fix
  // backends (which don't return this field) don't gate anything.
  @override
  @JsonKey()
  final bool locked;
  // Server-computed completion from watched-fraction >= threshold.
  // May diverge from `isCompleted` briefly when a new heartbeat
  // has been posted but the client hasn't refetched; use this for
  // display purposes and `isCompleted` for legacy compatibility.
  @override
  @JsonKey()
  final bool completedByThreshold;
  // 0..100, may be null if backend can't compute the exact fraction.
  @override
  final int? watchPercent;
  // Section grouping (null = unsectioned)
  @override
  final String? sectionId;
  @override
  final String? sectionTitle;
  @override
  final int? sectionOrder;

  @override
  String toString() {
    return 'Lesson(id: $id, title: $title, type: $type, hlsUrl: $hlsUrl, videoUrl: $videoUrl, videoType: $videoType, durationSeconds: $durationSeconds, duration: $duration, order: $order, hasQuiz: $hasQuiz, isCompleted: $isCompleted, resumeAtSeconds: $resumeAtSeconds, actualWatchedSecs: $actualWatchedSecs, quizUnlockPercent: $quizUnlockPercent, locked: $locked, completedByThreshold: $completedByThreshold, watchPercent: $watchPercent, sectionId: $sectionId, sectionTitle: $sectionTitle, sectionOrder: $sectionOrder)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$LessonImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.title, title) || other.title == title) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.hlsUrl, hlsUrl) || other.hlsUrl == hlsUrl) &&
            (identical(other.videoUrl, videoUrl) ||
                other.videoUrl == videoUrl) &&
            (identical(other.videoType, videoType) ||
                other.videoType == videoType) &&
            (identical(other.durationSeconds, durationSeconds) ||
                other.durationSeconds == durationSeconds) &&
            (identical(other.duration, duration) ||
                other.duration == duration) &&
            (identical(other.order, order) || other.order == order) &&
            (identical(other.hasQuiz, hasQuiz) || other.hasQuiz == hasQuiz) &&
            (identical(other.isCompleted, isCompleted) ||
                other.isCompleted == isCompleted) &&
            (identical(other.resumeAtSeconds, resumeAtSeconds) ||
                other.resumeAtSeconds == resumeAtSeconds) &&
            (identical(other.actualWatchedSecs, actualWatchedSecs) ||
                other.actualWatchedSecs == actualWatchedSecs) &&
            (identical(other.quizUnlockPercent, quizUnlockPercent) ||
                other.quizUnlockPercent == quizUnlockPercent) &&
            (identical(other.locked, locked) || other.locked == locked) &&
            (identical(other.completedByThreshold, completedByThreshold) ||
                other.completedByThreshold == completedByThreshold) &&
            (identical(other.watchPercent, watchPercent) ||
                other.watchPercent == watchPercent) &&
            (identical(other.sectionId, sectionId) ||
                other.sectionId == sectionId) &&
            (identical(other.sectionTitle, sectionTitle) ||
                other.sectionTitle == sectionTitle) &&
            (identical(other.sectionOrder, sectionOrder) ||
                other.sectionOrder == sectionOrder));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hashAll([
    runtimeType,
    id,
    title,
    type,
    hlsUrl,
    videoUrl,
    videoType,
    durationSeconds,
    duration,
    order,
    hasQuiz,
    isCompleted,
    resumeAtSeconds,
    actualWatchedSecs,
    quizUnlockPercent,
    locked,
    completedByThreshold,
    watchPercent,
    sectionId,
    sectionTitle,
    sectionOrder,
  ]);

  /// Create a copy of Lesson
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$LessonImplCopyWith<_$LessonImpl> get copyWith =>
      __$$LessonImplCopyWithImpl<_$LessonImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$LessonImplToJson(this);
  }
}

abstract class _Lesson implements Lesson {
  const factory _Lesson({
    required final String id,
    required final String title,
    final LessonType type,
    final String? hlsUrl,
    final String? videoUrl,
    final String videoType,
    final int? durationSeconds,
    final int? duration,
    final int order,
    final bool hasQuiz,
    final bool isCompleted,
    final int resumeAtSeconds,
    final int actualWatchedSecs,
    final int quizUnlockPercent,
    final bool locked,
    final bool completedByThreshold,
    final int? watchPercent,
    final String? sectionId,
    final String? sectionTitle,
    final int? sectionOrder,
  }) = _$LessonImpl;

  factory _Lesson.fromJson(Map<String, dynamic> json) = _$LessonImpl.fromJson;

  @override
  String get id;
  @override
  String get title;
  @override
  LessonType get type;
  @override
  String? get hlsUrl;
  @override
  String? get videoUrl;
  @override
  String get videoType;
  @override
  int? get durationSeconds;
  @override
  int? get duration; // minutes
  @override
  int get order;
  @override
  bool get hasQuiz;
  @override
  bool get isCompleted;
  @override
  int get resumeAtSeconds;
  @override
  int get actualWatchedSecs;
  @override
  int get quizUnlockPercent; // Server-authoritative sequential-unlock state (2026-07-16).
  // When true, the lesson is locked until the previous lesson meets
  // the course's completion threshold. Default false so pre-fix
  // backends (which don't return this field) don't gate anything.
  @override
  bool get locked; // Server-computed completion from watched-fraction >= threshold.
  // May diverge from `isCompleted` briefly when a new heartbeat
  // has been posted but the client hasn't refetched; use this for
  // display purposes and `isCompleted` for legacy compatibility.
  @override
  bool get completedByThreshold; // 0..100, may be null if backend can't compute the exact fraction.
  @override
  int? get watchPercent; // Section grouping (null = unsectioned)
  @override
  String? get sectionId;
  @override
  String? get sectionTitle;
  @override
  int? get sectionOrder;

  /// Create a copy of Lesson
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$LessonImplCopyWith<_$LessonImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

EpisodePlayback _$EpisodePlaybackFromJson(Map<String, dynamic> json) {
  return _EpisodePlayback.fromJson(json);
}

/// @nodoc
mixin _$EpisodePlayback {
  String get id => throw _privateConstructorUsedError;
  String get title => throw _privateConstructorUsedError;
  String? get description => throw _privateConstructorUsedError;
  String? get videoUrl => throw _privateConstructorUsedError;
  String? get hlsUrl => throw _privateConstructorUsedError;
  String get videoType => throw _privateConstructorUsedError;
  int? get durationSeconds => throw _privateConstructorUsedError;
  int get resumeAtSeconds => throw _privateConstructorUsedError;
  bool get isCompleted => throw _privateConstructorUsedError;
  bool get hasQuiz => throw _privateConstructorUsedError;
  @JsonKey(includeIfNull: false)
  Map<String, dynamic>? get quizData => throw _privateConstructorUsedError;
  int get quizUnlockPercent => throw _privateConstructorUsedError;

  /// Serializes this EpisodePlayback to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of EpisodePlayback
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $EpisodePlaybackCopyWith<EpisodePlayback> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $EpisodePlaybackCopyWith<$Res> {
  factory $EpisodePlaybackCopyWith(
    EpisodePlayback value,
    $Res Function(EpisodePlayback) then,
  ) = _$EpisodePlaybackCopyWithImpl<$Res, EpisodePlayback>;
  @useResult
  $Res call({
    String id,
    String title,
    String? description,
    String? videoUrl,
    String? hlsUrl,
    String videoType,
    int? durationSeconds,
    int resumeAtSeconds,
    bool isCompleted,
    bool hasQuiz,
    @JsonKey(includeIfNull: false) Map<String, dynamic>? quizData,
    int quizUnlockPercent,
  });
}

/// @nodoc
class _$EpisodePlaybackCopyWithImpl<$Res, $Val extends EpisodePlayback>
    implements $EpisodePlaybackCopyWith<$Res> {
  _$EpisodePlaybackCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of EpisodePlayback
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? title = null,
    Object? description = freezed,
    Object? videoUrl = freezed,
    Object? hlsUrl = freezed,
    Object? videoType = null,
    Object? durationSeconds = freezed,
    Object? resumeAtSeconds = null,
    Object? isCompleted = null,
    Object? hasQuiz = null,
    Object? quizData = freezed,
    Object? quizUnlockPercent = null,
  }) {
    return _then(
      _value.copyWith(
            id:
                null == id
                    ? _value.id
                    : id // ignore: cast_nullable_to_non_nullable
                        as String,
            title:
                null == title
                    ? _value.title
                    : title // ignore: cast_nullable_to_non_nullable
                        as String,
            description:
                freezed == description
                    ? _value.description
                    : description // ignore: cast_nullable_to_non_nullable
                        as String?,
            videoUrl:
                freezed == videoUrl
                    ? _value.videoUrl
                    : videoUrl // ignore: cast_nullable_to_non_nullable
                        as String?,
            hlsUrl:
                freezed == hlsUrl
                    ? _value.hlsUrl
                    : hlsUrl // ignore: cast_nullable_to_non_nullable
                        as String?,
            videoType:
                null == videoType
                    ? _value.videoType
                    : videoType // ignore: cast_nullable_to_non_nullable
                        as String,
            durationSeconds:
                freezed == durationSeconds
                    ? _value.durationSeconds
                    : durationSeconds // ignore: cast_nullable_to_non_nullable
                        as int?,
            resumeAtSeconds:
                null == resumeAtSeconds
                    ? _value.resumeAtSeconds
                    : resumeAtSeconds // ignore: cast_nullable_to_non_nullable
                        as int,
            isCompleted:
                null == isCompleted
                    ? _value.isCompleted
                    : isCompleted // ignore: cast_nullable_to_non_nullable
                        as bool,
            hasQuiz:
                null == hasQuiz
                    ? _value.hasQuiz
                    : hasQuiz // ignore: cast_nullable_to_non_nullable
                        as bool,
            quizData:
                freezed == quizData
                    ? _value.quizData
                    : quizData // ignore: cast_nullable_to_non_nullable
                        as Map<String, dynamic>?,
            quizUnlockPercent:
                null == quizUnlockPercent
                    ? _value.quizUnlockPercent
                    : quizUnlockPercent // ignore: cast_nullable_to_non_nullable
                        as int,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$EpisodePlaybackImplCopyWith<$Res>
    implements $EpisodePlaybackCopyWith<$Res> {
  factory _$$EpisodePlaybackImplCopyWith(
    _$EpisodePlaybackImpl value,
    $Res Function(_$EpisodePlaybackImpl) then,
  ) = __$$EpisodePlaybackImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    String id,
    String title,
    String? description,
    String? videoUrl,
    String? hlsUrl,
    String videoType,
    int? durationSeconds,
    int resumeAtSeconds,
    bool isCompleted,
    bool hasQuiz,
    @JsonKey(includeIfNull: false) Map<String, dynamic>? quizData,
    int quizUnlockPercent,
  });
}

/// @nodoc
class __$$EpisodePlaybackImplCopyWithImpl<$Res>
    extends _$EpisodePlaybackCopyWithImpl<$Res, _$EpisodePlaybackImpl>
    implements _$$EpisodePlaybackImplCopyWith<$Res> {
  __$$EpisodePlaybackImplCopyWithImpl(
    _$EpisodePlaybackImpl _value,
    $Res Function(_$EpisodePlaybackImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of EpisodePlayback
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? title = null,
    Object? description = freezed,
    Object? videoUrl = freezed,
    Object? hlsUrl = freezed,
    Object? videoType = null,
    Object? durationSeconds = freezed,
    Object? resumeAtSeconds = null,
    Object? isCompleted = null,
    Object? hasQuiz = null,
    Object? quizData = freezed,
    Object? quizUnlockPercent = null,
  }) {
    return _then(
      _$EpisodePlaybackImpl(
        id:
            null == id
                ? _value.id
                : id // ignore: cast_nullable_to_non_nullable
                    as String,
        title:
            null == title
                ? _value.title
                : title // ignore: cast_nullable_to_non_nullable
                    as String,
        description:
            freezed == description
                ? _value.description
                : description // ignore: cast_nullable_to_non_nullable
                    as String?,
        videoUrl:
            freezed == videoUrl
                ? _value.videoUrl
                : videoUrl // ignore: cast_nullable_to_non_nullable
                    as String?,
        hlsUrl:
            freezed == hlsUrl
                ? _value.hlsUrl
                : hlsUrl // ignore: cast_nullable_to_non_nullable
                    as String?,
        videoType:
            null == videoType
                ? _value.videoType
                : videoType // ignore: cast_nullable_to_non_nullable
                    as String,
        durationSeconds:
            freezed == durationSeconds
                ? _value.durationSeconds
                : durationSeconds // ignore: cast_nullable_to_non_nullable
                    as int?,
        resumeAtSeconds:
            null == resumeAtSeconds
                ? _value.resumeAtSeconds
                : resumeAtSeconds // ignore: cast_nullable_to_non_nullable
                    as int,
        isCompleted:
            null == isCompleted
                ? _value.isCompleted
                : isCompleted // ignore: cast_nullable_to_non_nullable
                    as bool,
        hasQuiz:
            null == hasQuiz
                ? _value.hasQuiz
                : hasQuiz // ignore: cast_nullable_to_non_nullable
                    as bool,
        quizData:
            freezed == quizData
                ? _value._quizData
                : quizData // ignore: cast_nullable_to_non_nullable
                    as Map<String, dynamic>?,
        quizUnlockPercent:
            null == quizUnlockPercent
                ? _value.quizUnlockPercent
                : quizUnlockPercent // ignore: cast_nullable_to_non_nullable
                    as int,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$EpisodePlaybackImpl implements _EpisodePlayback {
  const _$EpisodePlaybackImpl({
    required this.id,
    required this.title,
    this.description,
    this.videoUrl,
    this.hlsUrl,
    this.videoType = 'iframe',
    this.durationSeconds,
    this.resumeAtSeconds = 0,
    this.isCompleted = false,
    this.hasQuiz = false,
    @JsonKey(includeIfNull: false) final Map<String, dynamic>? quizData,
    this.quizUnlockPercent = 80,
  }) : _quizData = quizData;

  factory _$EpisodePlaybackImpl.fromJson(Map<String, dynamic> json) =>
      _$$EpisodePlaybackImplFromJson(json);

  @override
  final String id;
  @override
  final String title;
  @override
  final String? description;
  @override
  final String? videoUrl;
  @override
  final String? hlsUrl;
  @override
  @JsonKey()
  final String videoType;
  @override
  final int? durationSeconds;
  @override
  @JsonKey()
  final int resumeAtSeconds;
  @override
  @JsonKey()
  final bool isCompleted;
  @override
  @JsonKey()
  final bool hasQuiz;
  final Map<String, dynamic>? _quizData;
  @override
  @JsonKey(includeIfNull: false)
  Map<String, dynamic>? get quizData {
    final value = _quizData;
    if (value == null) return null;
    if (_quizData is EqualUnmodifiableMapView) return _quizData;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableMapView(value);
  }

  @override
  @JsonKey()
  final int quizUnlockPercent;

  @override
  String toString() {
    return 'EpisodePlayback(id: $id, title: $title, description: $description, videoUrl: $videoUrl, hlsUrl: $hlsUrl, videoType: $videoType, durationSeconds: $durationSeconds, resumeAtSeconds: $resumeAtSeconds, isCompleted: $isCompleted, hasQuiz: $hasQuiz, quizData: $quizData, quizUnlockPercent: $quizUnlockPercent)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$EpisodePlaybackImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.title, title) || other.title == title) &&
            (identical(other.description, description) ||
                other.description == description) &&
            (identical(other.videoUrl, videoUrl) ||
                other.videoUrl == videoUrl) &&
            (identical(other.hlsUrl, hlsUrl) || other.hlsUrl == hlsUrl) &&
            (identical(other.videoType, videoType) ||
                other.videoType == videoType) &&
            (identical(other.durationSeconds, durationSeconds) ||
                other.durationSeconds == durationSeconds) &&
            (identical(other.resumeAtSeconds, resumeAtSeconds) ||
                other.resumeAtSeconds == resumeAtSeconds) &&
            (identical(other.isCompleted, isCompleted) ||
                other.isCompleted == isCompleted) &&
            (identical(other.hasQuiz, hasQuiz) || other.hasQuiz == hasQuiz) &&
            const DeepCollectionEquality().equals(other._quizData, _quizData) &&
            (identical(other.quizUnlockPercent, quizUnlockPercent) ||
                other.quizUnlockPercent == quizUnlockPercent));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
    runtimeType,
    id,
    title,
    description,
    videoUrl,
    hlsUrl,
    videoType,
    durationSeconds,
    resumeAtSeconds,
    isCompleted,
    hasQuiz,
    const DeepCollectionEquality().hash(_quizData),
    quizUnlockPercent,
  );

  /// Create a copy of EpisodePlayback
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$EpisodePlaybackImplCopyWith<_$EpisodePlaybackImpl> get copyWith =>
      __$$EpisodePlaybackImplCopyWithImpl<_$EpisodePlaybackImpl>(
        this,
        _$identity,
      );

  @override
  Map<String, dynamic> toJson() {
    return _$$EpisodePlaybackImplToJson(this);
  }
}

abstract class _EpisodePlayback implements EpisodePlayback {
  const factory _EpisodePlayback({
    required final String id,
    required final String title,
    final String? description,
    final String? videoUrl,
    final String? hlsUrl,
    final String videoType,
    final int? durationSeconds,
    final int resumeAtSeconds,
    final bool isCompleted,
    final bool hasQuiz,
    @JsonKey(includeIfNull: false) final Map<String, dynamic>? quizData,
    final int quizUnlockPercent,
  }) = _$EpisodePlaybackImpl;

  factory _EpisodePlayback.fromJson(Map<String, dynamic> json) =
      _$EpisodePlaybackImpl.fromJson;

  @override
  String get id;
  @override
  String get title;
  @override
  String? get description;
  @override
  String? get videoUrl;
  @override
  String? get hlsUrl;
  @override
  String get videoType;
  @override
  int? get durationSeconds;
  @override
  int get resumeAtSeconds;
  @override
  bool get isCompleted;
  @override
  bool get hasQuiz;
  @override
  @JsonKey(includeIfNull: false)
  Map<String, dynamic>? get quizData;
  @override
  int get quizUnlockPercent;

  /// Create a copy of EpisodePlayback
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$EpisodePlaybackImplCopyWith<_$EpisodePlaybackImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

LessonProgress _$LessonProgressFromJson(Map<String, dynamic> json) {
  return _LessonProgress.fromJson(json);
}

/// @nodoc
mixin _$LessonProgress {
  String get lessonId => throw _privateConstructorUsedError;
  bool get completed => throw _privateConstructorUsedError;
  String? get completedAt => throw _privateConstructorUsedError;

  /// Serializes this LessonProgress to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of LessonProgress
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $LessonProgressCopyWith<LessonProgress> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $LessonProgressCopyWith<$Res> {
  factory $LessonProgressCopyWith(
    LessonProgress value,
    $Res Function(LessonProgress) then,
  ) = _$LessonProgressCopyWithImpl<$Res, LessonProgress>;
  @useResult
  $Res call({String lessonId, bool completed, String? completedAt});
}

/// @nodoc
class _$LessonProgressCopyWithImpl<$Res, $Val extends LessonProgress>
    implements $LessonProgressCopyWith<$Res> {
  _$LessonProgressCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of LessonProgress
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? lessonId = null,
    Object? completed = null,
    Object? completedAt = freezed,
  }) {
    return _then(
      _value.copyWith(
            lessonId:
                null == lessonId
                    ? _value.lessonId
                    : lessonId // ignore: cast_nullable_to_non_nullable
                        as String,
            completed:
                null == completed
                    ? _value.completed
                    : completed // ignore: cast_nullable_to_non_nullable
                        as bool,
            completedAt:
                freezed == completedAt
                    ? _value.completedAt
                    : completedAt // ignore: cast_nullable_to_non_nullable
                        as String?,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$LessonProgressImplCopyWith<$Res>
    implements $LessonProgressCopyWith<$Res> {
  factory _$$LessonProgressImplCopyWith(
    _$LessonProgressImpl value,
    $Res Function(_$LessonProgressImpl) then,
  ) = __$$LessonProgressImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String lessonId, bool completed, String? completedAt});
}

/// @nodoc
class __$$LessonProgressImplCopyWithImpl<$Res>
    extends _$LessonProgressCopyWithImpl<$Res, _$LessonProgressImpl>
    implements _$$LessonProgressImplCopyWith<$Res> {
  __$$LessonProgressImplCopyWithImpl(
    _$LessonProgressImpl _value,
    $Res Function(_$LessonProgressImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of LessonProgress
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? lessonId = null,
    Object? completed = null,
    Object? completedAt = freezed,
  }) {
    return _then(
      _$LessonProgressImpl(
        lessonId:
            null == lessonId
                ? _value.lessonId
                : lessonId // ignore: cast_nullable_to_non_nullable
                    as String,
        completed:
            null == completed
                ? _value.completed
                : completed // ignore: cast_nullable_to_non_nullable
                    as bool,
        completedAt:
            freezed == completedAt
                ? _value.completedAt
                : completedAt // ignore: cast_nullable_to_non_nullable
                    as String?,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$LessonProgressImpl implements _LessonProgress {
  const _$LessonProgressImpl({
    required this.lessonId,
    this.completed = false,
    this.completedAt,
  });

  factory _$LessonProgressImpl.fromJson(Map<String, dynamic> json) =>
      _$$LessonProgressImplFromJson(json);

  @override
  final String lessonId;
  @override
  @JsonKey()
  final bool completed;
  @override
  final String? completedAt;

  @override
  String toString() {
    return 'LessonProgress(lessonId: $lessonId, completed: $completed, completedAt: $completedAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$LessonProgressImpl &&
            (identical(other.lessonId, lessonId) ||
                other.lessonId == lessonId) &&
            (identical(other.completed, completed) ||
                other.completed == completed) &&
            (identical(other.completedAt, completedAt) ||
                other.completedAt == completedAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, lessonId, completed, completedAt);

  /// Create a copy of LessonProgress
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$LessonProgressImplCopyWith<_$LessonProgressImpl> get copyWith =>
      __$$LessonProgressImplCopyWithImpl<_$LessonProgressImpl>(
        this,
        _$identity,
      );

  @override
  Map<String, dynamic> toJson() {
    return _$$LessonProgressImplToJson(this);
  }
}

abstract class _LessonProgress implements LessonProgress {
  const factory _LessonProgress({
    required final String lessonId,
    final bool completed,
    final String? completedAt,
  }) = _$LessonProgressImpl;

  factory _LessonProgress.fromJson(Map<String, dynamic> json) =
      _$LessonProgressImpl.fromJson;

  @override
  String get lessonId;
  @override
  bool get completed;
  @override
  String? get completedAt;

  /// Create a copy of LessonProgress
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$LessonProgressImplCopyWith<_$LessonProgressImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

LeaderboardMember _$LeaderboardMemberFromJson(Map<String, dynamic> json) {
  return _LeaderboardMember.fromJson(json);
}

/// @nodoc
mixin _$LeaderboardMember {
  String get id => throw _privateConstructorUsedError;
  String? get firstName => throw _privateConstructorUsedError;
  String? get lastName => throw _privateConstructorUsedError;
  String? get profilePhotoUrl => throw _privateConstructorUsedError;

  /// Serializes this LeaderboardMember to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of LeaderboardMember
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $LeaderboardMemberCopyWith<LeaderboardMember> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $LeaderboardMemberCopyWith<$Res> {
  factory $LeaderboardMemberCopyWith(
    LeaderboardMember value,
    $Res Function(LeaderboardMember) then,
  ) = _$LeaderboardMemberCopyWithImpl<$Res, LeaderboardMember>;
  @useResult
  $Res call({
    String id,
    String? firstName,
    String? lastName,
    String? profilePhotoUrl,
  });
}

/// @nodoc
class _$LeaderboardMemberCopyWithImpl<$Res, $Val extends LeaderboardMember>
    implements $LeaderboardMemberCopyWith<$Res> {
  _$LeaderboardMemberCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of LeaderboardMember
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? firstName = freezed,
    Object? lastName = freezed,
    Object? profilePhotoUrl = freezed,
  }) {
    return _then(
      _value.copyWith(
            id:
                null == id
                    ? _value.id
                    : id // ignore: cast_nullable_to_non_nullable
                        as String,
            firstName:
                freezed == firstName
                    ? _value.firstName
                    : firstName // ignore: cast_nullable_to_non_nullable
                        as String?,
            lastName:
                freezed == lastName
                    ? _value.lastName
                    : lastName // ignore: cast_nullable_to_non_nullable
                        as String?,
            profilePhotoUrl:
                freezed == profilePhotoUrl
                    ? _value.profilePhotoUrl
                    : profilePhotoUrl // ignore: cast_nullable_to_non_nullable
                        as String?,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$LeaderboardMemberImplCopyWith<$Res>
    implements $LeaderboardMemberCopyWith<$Res> {
  factory _$$LeaderboardMemberImplCopyWith(
    _$LeaderboardMemberImpl value,
    $Res Function(_$LeaderboardMemberImpl) then,
  ) = __$$LeaderboardMemberImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    String id,
    String? firstName,
    String? lastName,
    String? profilePhotoUrl,
  });
}

/// @nodoc
class __$$LeaderboardMemberImplCopyWithImpl<$Res>
    extends _$LeaderboardMemberCopyWithImpl<$Res, _$LeaderboardMemberImpl>
    implements _$$LeaderboardMemberImplCopyWith<$Res> {
  __$$LeaderboardMemberImplCopyWithImpl(
    _$LeaderboardMemberImpl _value,
    $Res Function(_$LeaderboardMemberImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of LeaderboardMember
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? firstName = freezed,
    Object? lastName = freezed,
    Object? profilePhotoUrl = freezed,
  }) {
    return _then(
      _$LeaderboardMemberImpl(
        id:
            null == id
                ? _value.id
                : id // ignore: cast_nullable_to_non_nullable
                    as String,
        firstName:
            freezed == firstName
                ? _value.firstName
                : firstName // ignore: cast_nullable_to_non_nullable
                    as String?,
        lastName:
            freezed == lastName
                ? _value.lastName
                : lastName // ignore: cast_nullable_to_non_nullable
                    as String?,
        profilePhotoUrl:
            freezed == profilePhotoUrl
                ? _value.profilePhotoUrl
                : profilePhotoUrl // ignore: cast_nullable_to_non_nullable
                    as String?,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$LeaderboardMemberImpl implements _LeaderboardMember {
  const _$LeaderboardMemberImpl({
    required this.id,
    this.firstName,
    this.lastName,
    this.profilePhotoUrl,
  });

  factory _$LeaderboardMemberImpl.fromJson(Map<String, dynamic> json) =>
      _$$LeaderboardMemberImplFromJson(json);

  @override
  final String id;
  @override
  final String? firstName;
  @override
  final String? lastName;
  @override
  final String? profilePhotoUrl;

  @override
  String toString() {
    return 'LeaderboardMember(id: $id, firstName: $firstName, lastName: $lastName, profilePhotoUrl: $profilePhotoUrl)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$LeaderboardMemberImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.firstName, firstName) ||
                other.firstName == firstName) &&
            (identical(other.lastName, lastName) ||
                other.lastName == lastName) &&
            (identical(other.profilePhotoUrl, profilePhotoUrl) ||
                other.profilePhotoUrl == profilePhotoUrl));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, id, firstName, lastName, profilePhotoUrl);

  /// Create a copy of LeaderboardMember
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$LeaderboardMemberImplCopyWith<_$LeaderboardMemberImpl> get copyWith =>
      __$$LeaderboardMemberImplCopyWithImpl<_$LeaderboardMemberImpl>(
        this,
        _$identity,
      );

  @override
  Map<String, dynamic> toJson() {
    return _$$LeaderboardMemberImplToJson(this);
  }
}

abstract class _LeaderboardMember implements LeaderboardMember {
  const factory _LeaderboardMember({
    required final String id,
    final String? firstName,
    final String? lastName,
    final String? profilePhotoUrl,
  }) = _$LeaderboardMemberImpl;

  factory _LeaderboardMember.fromJson(Map<String, dynamic> json) =
      _$LeaderboardMemberImpl.fromJson;

  @override
  String get id;
  @override
  String? get firstName;
  @override
  String? get lastName;
  @override
  String? get profilePhotoUrl;

  /// Create a copy of LeaderboardMember
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$LeaderboardMemberImplCopyWith<_$LeaderboardMemberImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

LeaderboardEntry _$LeaderboardEntryFromJson(Map<String, dynamic> json) {
  return _LeaderboardEntry.fromJson(json);
}

/// @nodoc
mixin _$LeaderboardEntry {
  int get rank => throw _privateConstructorUsedError;
  String get memberId => throw _privateConstructorUsedError;
  LeaderboardMember? get member => throw _privateConstructorUsedError;
  int get totalXp => throw _privateConstructorUsedError;
  bool get isMe => throw _privateConstructorUsedError;

  /// Serializes this LeaderboardEntry to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of LeaderboardEntry
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $LeaderboardEntryCopyWith<LeaderboardEntry> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $LeaderboardEntryCopyWith<$Res> {
  factory $LeaderboardEntryCopyWith(
    LeaderboardEntry value,
    $Res Function(LeaderboardEntry) then,
  ) = _$LeaderboardEntryCopyWithImpl<$Res, LeaderboardEntry>;
  @useResult
  $Res call({
    int rank,
    String memberId,
    LeaderboardMember? member,
    int totalXp,
    bool isMe,
  });

  $LeaderboardMemberCopyWith<$Res>? get member;
}

/// @nodoc
class _$LeaderboardEntryCopyWithImpl<$Res, $Val extends LeaderboardEntry>
    implements $LeaderboardEntryCopyWith<$Res> {
  _$LeaderboardEntryCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of LeaderboardEntry
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? rank = null,
    Object? memberId = null,
    Object? member = freezed,
    Object? totalXp = null,
    Object? isMe = null,
  }) {
    return _then(
      _value.copyWith(
            rank:
                null == rank
                    ? _value.rank
                    : rank // ignore: cast_nullable_to_non_nullable
                        as int,
            memberId:
                null == memberId
                    ? _value.memberId
                    : memberId // ignore: cast_nullable_to_non_nullable
                        as String,
            member:
                freezed == member
                    ? _value.member
                    : member // ignore: cast_nullable_to_non_nullable
                        as LeaderboardMember?,
            totalXp:
                null == totalXp
                    ? _value.totalXp
                    : totalXp // ignore: cast_nullable_to_non_nullable
                        as int,
            isMe:
                null == isMe
                    ? _value.isMe
                    : isMe // ignore: cast_nullable_to_non_nullable
                        as bool,
          )
          as $Val,
    );
  }

  /// Create a copy of LeaderboardEntry
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $LeaderboardMemberCopyWith<$Res>? get member {
    if (_value.member == null) {
      return null;
    }

    return $LeaderboardMemberCopyWith<$Res>(_value.member!, (value) {
      return _then(_value.copyWith(member: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$LeaderboardEntryImplCopyWith<$Res>
    implements $LeaderboardEntryCopyWith<$Res> {
  factory _$$LeaderboardEntryImplCopyWith(
    _$LeaderboardEntryImpl value,
    $Res Function(_$LeaderboardEntryImpl) then,
  ) = __$$LeaderboardEntryImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    int rank,
    String memberId,
    LeaderboardMember? member,
    int totalXp,
    bool isMe,
  });

  @override
  $LeaderboardMemberCopyWith<$Res>? get member;
}

/// @nodoc
class __$$LeaderboardEntryImplCopyWithImpl<$Res>
    extends _$LeaderboardEntryCopyWithImpl<$Res, _$LeaderboardEntryImpl>
    implements _$$LeaderboardEntryImplCopyWith<$Res> {
  __$$LeaderboardEntryImplCopyWithImpl(
    _$LeaderboardEntryImpl _value,
    $Res Function(_$LeaderboardEntryImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of LeaderboardEntry
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? rank = null,
    Object? memberId = null,
    Object? member = freezed,
    Object? totalXp = null,
    Object? isMe = null,
  }) {
    return _then(
      _$LeaderboardEntryImpl(
        rank:
            null == rank
                ? _value.rank
                : rank // ignore: cast_nullable_to_non_nullable
                    as int,
        memberId:
            null == memberId
                ? _value.memberId
                : memberId // ignore: cast_nullable_to_non_nullable
                    as String,
        member:
            freezed == member
                ? _value.member
                : member // ignore: cast_nullable_to_non_nullable
                    as LeaderboardMember?,
        totalXp:
            null == totalXp
                ? _value.totalXp
                : totalXp // ignore: cast_nullable_to_non_nullable
                    as int,
        isMe:
            null == isMe
                ? _value.isMe
                : isMe // ignore: cast_nullable_to_non_nullable
                    as bool,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$LeaderboardEntryImpl implements _LeaderboardEntry {
  const _$LeaderboardEntryImpl({
    required this.rank,
    required this.memberId,
    this.member,
    this.totalXp = 0,
    this.isMe = false,
  });

  factory _$LeaderboardEntryImpl.fromJson(Map<String, dynamic> json) =>
      _$$LeaderboardEntryImplFromJson(json);

  @override
  final int rank;
  @override
  final String memberId;
  @override
  final LeaderboardMember? member;
  @override
  @JsonKey()
  final int totalXp;
  @override
  @JsonKey()
  final bool isMe;

  @override
  String toString() {
    return 'LeaderboardEntry(rank: $rank, memberId: $memberId, member: $member, totalXp: $totalXp, isMe: $isMe)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$LeaderboardEntryImpl &&
            (identical(other.rank, rank) || other.rank == rank) &&
            (identical(other.memberId, memberId) ||
                other.memberId == memberId) &&
            (identical(other.member, member) || other.member == member) &&
            (identical(other.totalXp, totalXp) || other.totalXp == totalXp) &&
            (identical(other.isMe, isMe) || other.isMe == isMe));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, rank, memberId, member, totalXp, isMe);

  /// Create a copy of LeaderboardEntry
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$LeaderboardEntryImplCopyWith<_$LeaderboardEntryImpl> get copyWith =>
      __$$LeaderboardEntryImplCopyWithImpl<_$LeaderboardEntryImpl>(
        this,
        _$identity,
      );

  @override
  Map<String, dynamic> toJson() {
    return _$$LeaderboardEntryImplToJson(this);
  }
}

abstract class _LeaderboardEntry implements LeaderboardEntry {
  const factory _LeaderboardEntry({
    required final int rank,
    required final String memberId,
    final LeaderboardMember? member,
    final int totalXp,
    final bool isMe,
  }) = _$LeaderboardEntryImpl;

  factory _LeaderboardEntry.fromJson(Map<String, dynamic> json) =
      _$LeaderboardEntryImpl.fromJson;

  @override
  int get rank;
  @override
  String get memberId;
  @override
  LeaderboardMember? get member;
  @override
  int get totalXp;
  @override
  bool get isMe;

  /// Create a copy of LeaderboardEntry
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$LeaderboardEntryImplCopyWith<_$LeaderboardEntryImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

CourseLeaderboard _$CourseLeaderboardFromJson(Map<String, dynamic> json) {
  return _CourseLeaderboard.fromJson(json);
}

/// @nodoc
mixin _$CourseLeaderboard {
  List<LeaderboardEntry> get leaderboard => throw _privateConstructorUsedError;
  int? get myRank => throw _privateConstructorUsedError;

  /// Serializes this CourseLeaderboard to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of CourseLeaderboard
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $CourseLeaderboardCopyWith<CourseLeaderboard> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $CourseLeaderboardCopyWith<$Res> {
  factory $CourseLeaderboardCopyWith(
    CourseLeaderboard value,
    $Res Function(CourseLeaderboard) then,
  ) = _$CourseLeaderboardCopyWithImpl<$Res, CourseLeaderboard>;
  @useResult
  $Res call({List<LeaderboardEntry> leaderboard, int? myRank});
}

/// @nodoc
class _$CourseLeaderboardCopyWithImpl<$Res, $Val extends CourseLeaderboard>
    implements $CourseLeaderboardCopyWith<$Res> {
  _$CourseLeaderboardCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of CourseLeaderboard
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? leaderboard = null, Object? myRank = freezed}) {
    return _then(
      _value.copyWith(
            leaderboard:
                null == leaderboard
                    ? _value.leaderboard
                    : leaderboard // ignore: cast_nullable_to_non_nullable
                        as List<LeaderboardEntry>,
            myRank:
                freezed == myRank
                    ? _value.myRank
                    : myRank // ignore: cast_nullable_to_non_nullable
                        as int?,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$CourseLeaderboardImplCopyWith<$Res>
    implements $CourseLeaderboardCopyWith<$Res> {
  factory _$$CourseLeaderboardImplCopyWith(
    _$CourseLeaderboardImpl value,
    $Res Function(_$CourseLeaderboardImpl) then,
  ) = __$$CourseLeaderboardImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({List<LeaderboardEntry> leaderboard, int? myRank});
}

/// @nodoc
class __$$CourseLeaderboardImplCopyWithImpl<$Res>
    extends _$CourseLeaderboardCopyWithImpl<$Res, _$CourseLeaderboardImpl>
    implements _$$CourseLeaderboardImplCopyWith<$Res> {
  __$$CourseLeaderboardImplCopyWithImpl(
    _$CourseLeaderboardImpl _value,
    $Res Function(_$CourseLeaderboardImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of CourseLeaderboard
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? leaderboard = null, Object? myRank = freezed}) {
    return _then(
      _$CourseLeaderboardImpl(
        leaderboard:
            null == leaderboard
                ? _value._leaderboard
                : leaderboard // ignore: cast_nullable_to_non_nullable
                    as List<LeaderboardEntry>,
        myRank:
            freezed == myRank
                ? _value.myRank
                : myRank // ignore: cast_nullable_to_non_nullable
                    as int?,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$CourseLeaderboardImpl implements _CourseLeaderboard {
  const _$CourseLeaderboardImpl({
    final List<LeaderboardEntry> leaderboard = const [],
    this.myRank,
  }) : _leaderboard = leaderboard;

  factory _$CourseLeaderboardImpl.fromJson(Map<String, dynamic> json) =>
      _$$CourseLeaderboardImplFromJson(json);

  final List<LeaderboardEntry> _leaderboard;
  @override
  @JsonKey()
  List<LeaderboardEntry> get leaderboard {
    if (_leaderboard is EqualUnmodifiableListView) return _leaderboard;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_leaderboard);
  }

  @override
  final int? myRank;

  @override
  String toString() {
    return 'CourseLeaderboard(leaderboard: $leaderboard, myRank: $myRank)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$CourseLeaderboardImpl &&
            const DeepCollectionEquality().equals(
              other._leaderboard,
              _leaderboard,
            ) &&
            (identical(other.myRank, myRank) || other.myRank == myRank));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
    runtimeType,
    const DeepCollectionEquality().hash(_leaderboard),
    myRank,
  );

  /// Create a copy of CourseLeaderboard
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$CourseLeaderboardImplCopyWith<_$CourseLeaderboardImpl> get copyWith =>
      __$$CourseLeaderboardImplCopyWithImpl<_$CourseLeaderboardImpl>(
        this,
        _$identity,
      );

  @override
  Map<String, dynamic> toJson() {
    return _$$CourseLeaderboardImplToJson(this);
  }
}

abstract class _CourseLeaderboard implements CourseLeaderboard {
  const factory _CourseLeaderboard({
    final List<LeaderboardEntry> leaderboard,
    final int? myRank,
  }) = _$CourseLeaderboardImpl;

  factory _CourseLeaderboard.fromJson(Map<String, dynamic> json) =
      _$CourseLeaderboardImpl.fromJson;

  @override
  List<LeaderboardEntry> get leaderboard;
  @override
  int? get myRank;

  /// Create a copy of CourseLeaderboard
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$CourseLeaderboardImplCopyWith<_$CourseLeaderboardImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

CourseBadgeInfo _$CourseBadgeInfoFromJson(Map<String, dynamic> json) {
  return _CourseBadgeInfo.fromJson(json);
}

/// @nodoc
mixin _$CourseBadgeInfo {
  String get id => throw _privateConstructorUsedError;
  String get name => throw _privateConstructorUsedError;
  String? get description => throw _privateConstructorUsedError;
  String? get imageUrl => throw _privateConstructorUsedError;

  /// Serializes this CourseBadgeInfo to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of CourseBadgeInfo
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $CourseBadgeInfoCopyWith<CourseBadgeInfo> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $CourseBadgeInfoCopyWith<$Res> {
  factory $CourseBadgeInfoCopyWith(
    CourseBadgeInfo value,
    $Res Function(CourseBadgeInfo) then,
  ) = _$CourseBadgeInfoCopyWithImpl<$Res, CourseBadgeInfo>;
  @useResult
  $Res call({String id, String name, String? description, String? imageUrl});
}

/// @nodoc
class _$CourseBadgeInfoCopyWithImpl<$Res, $Val extends CourseBadgeInfo>
    implements $CourseBadgeInfoCopyWith<$Res> {
  _$CourseBadgeInfoCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of CourseBadgeInfo
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? name = null,
    Object? description = freezed,
    Object? imageUrl = freezed,
  }) {
    return _then(
      _value.copyWith(
            id:
                null == id
                    ? _value.id
                    : id // ignore: cast_nullable_to_non_nullable
                        as String,
            name:
                null == name
                    ? _value.name
                    : name // ignore: cast_nullable_to_non_nullable
                        as String,
            description:
                freezed == description
                    ? _value.description
                    : description // ignore: cast_nullable_to_non_nullable
                        as String?,
            imageUrl:
                freezed == imageUrl
                    ? _value.imageUrl
                    : imageUrl // ignore: cast_nullable_to_non_nullable
                        as String?,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$CourseBadgeInfoImplCopyWith<$Res>
    implements $CourseBadgeInfoCopyWith<$Res> {
  factory _$$CourseBadgeInfoImplCopyWith(
    _$CourseBadgeInfoImpl value,
    $Res Function(_$CourseBadgeInfoImpl) then,
  ) = __$$CourseBadgeInfoImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String id, String name, String? description, String? imageUrl});
}

/// @nodoc
class __$$CourseBadgeInfoImplCopyWithImpl<$Res>
    extends _$CourseBadgeInfoCopyWithImpl<$Res, _$CourseBadgeInfoImpl>
    implements _$$CourseBadgeInfoImplCopyWith<$Res> {
  __$$CourseBadgeInfoImplCopyWithImpl(
    _$CourseBadgeInfoImpl _value,
    $Res Function(_$CourseBadgeInfoImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of CourseBadgeInfo
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? name = null,
    Object? description = freezed,
    Object? imageUrl = freezed,
  }) {
    return _then(
      _$CourseBadgeInfoImpl(
        id:
            null == id
                ? _value.id
                : id // ignore: cast_nullable_to_non_nullable
                    as String,
        name:
            null == name
                ? _value.name
                : name // ignore: cast_nullable_to_non_nullable
                    as String,
        description:
            freezed == description
                ? _value.description
                : description // ignore: cast_nullable_to_non_nullable
                    as String?,
        imageUrl:
            freezed == imageUrl
                ? _value.imageUrl
                : imageUrl // ignore: cast_nullable_to_non_nullable
                    as String?,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$CourseBadgeInfoImpl implements _CourseBadgeInfo {
  const _$CourseBadgeInfoImpl({
    required this.id,
    required this.name,
    this.description,
    this.imageUrl,
  });

  factory _$CourseBadgeInfoImpl.fromJson(Map<String, dynamic> json) =>
      _$$CourseBadgeInfoImplFromJson(json);

  @override
  final String id;
  @override
  final String name;
  @override
  final String? description;
  @override
  final String? imageUrl;

  @override
  String toString() {
    return 'CourseBadgeInfo(id: $id, name: $name, description: $description, imageUrl: $imageUrl)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$CourseBadgeInfoImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.name, name) || other.name == name) &&
            (identical(other.description, description) ||
                other.description == description) &&
            (identical(other.imageUrl, imageUrl) ||
                other.imageUrl == imageUrl));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, name, description, imageUrl);

  /// Create a copy of CourseBadgeInfo
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$CourseBadgeInfoImplCopyWith<_$CourseBadgeInfoImpl> get copyWith =>
      __$$CourseBadgeInfoImplCopyWithImpl<_$CourseBadgeInfoImpl>(
        this,
        _$identity,
      );

  @override
  Map<String, dynamic> toJson() {
    return _$$CourseBadgeInfoImplToJson(this);
  }
}

abstract class _CourseBadgeInfo implements CourseBadgeInfo {
  const factory _CourseBadgeInfo({
    required final String id,
    required final String name,
    final String? description,
    final String? imageUrl,
  }) = _$CourseBadgeInfoImpl;

  factory _CourseBadgeInfo.fromJson(Map<String, dynamic> json) =
      _$CourseBadgeInfoImpl.fromJson;

  @override
  String get id;
  @override
  String get name;
  @override
  String? get description;
  @override
  String? get imageUrl;

  /// Create a copy of CourseBadgeInfo
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$CourseBadgeInfoImplCopyWith<_$CourseBadgeInfoImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

EarnedBadge _$EarnedBadgeFromJson(Map<String, dynamic> json) {
  return _EarnedBadge.fromJson(json);
}

/// @nodoc
mixin _$EarnedBadge {
  String get id => throw _privateConstructorUsedError;
  String get earnedAt => throw _privateConstructorUsedError;
  CourseBadgeInfo get badge => throw _privateConstructorUsedError;

  /// Serializes this EarnedBadge to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of EarnedBadge
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $EarnedBadgeCopyWith<EarnedBadge> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $EarnedBadgeCopyWith<$Res> {
  factory $EarnedBadgeCopyWith(
    EarnedBadge value,
    $Res Function(EarnedBadge) then,
  ) = _$EarnedBadgeCopyWithImpl<$Res, EarnedBadge>;
  @useResult
  $Res call({String id, String earnedAt, CourseBadgeInfo badge});

  $CourseBadgeInfoCopyWith<$Res> get badge;
}

/// @nodoc
class _$EarnedBadgeCopyWithImpl<$Res, $Val extends EarnedBadge>
    implements $EarnedBadgeCopyWith<$Res> {
  _$EarnedBadgeCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of EarnedBadge
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? earnedAt = null,
    Object? badge = null,
  }) {
    return _then(
      _value.copyWith(
            id:
                null == id
                    ? _value.id
                    : id // ignore: cast_nullable_to_non_nullable
                        as String,
            earnedAt:
                null == earnedAt
                    ? _value.earnedAt
                    : earnedAt // ignore: cast_nullable_to_non_nullable
                        as String,
            badge:
                null == badge
                    ? _value.badge
                    : badge // ignore: cast_nullable_to_non_nullable
                        as CourseBadgeInfo,
          )
          as $Val,
    );
  }

  /// Create a copy of EarnedBadge
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $CourseBadgeInfoCopyWith<$Res> get badge {
    return $CourseBadgeInfoCopyWith<$Res>(_value.badge, (value) {
      return _then(_value.copyWith(badge: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$EarnedBadgeImplCopyWith<$Res>
    implements $EarnedBadgeCopyWith<$Res> {
  factory _$$EarnedBadgeImplCopyWith(
    _$EarnedBadgeImpl value,
    $Res Function(_$EarnedBadgeImpl) then,
  ) = __$$EarnedBadgeImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String id, String earnedAt, CourseBadgeInfo badge});

  @override
  $CourseBadgeInfoCopyWith<$Res> get badge;
}

/// @nodoc
class __$$EarnedBadgeImplCopyWithImpl<$Res>
    extends _$EarnedBadgeCopyWithImpl<$Res, _$EarnedBadgeImpl>
    implements _$$EarnedBadgeImplCopyWith<$Res> {
  __$$EarnedBadgeImplCopyWithImpl(
    _$EarnedBadgeImpl _value,
    $Res Function(_$EarnedBadgeImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of EarnedBadge
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? earnedAt = null,
    Object? badge = null,
  }) {
    return _then(
      _$EarnedBadgeImpl(
        id:
            null == id
                ? _value.id
                : id // ignore: cast_nullable_to_non_nullable
                    as String,
        earnedAt:
            null == earnedAt
                ? _value.earnedAt
                : earnedAt // ignore: cast_nullable_to_non_nullable
                    as String,
        badge:
            null == badge
                ? _value.badge
                : badge // ignore: cast_nullable_to_non_nullable
                    as CourseBadgeInfo,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$EarnedBadgeImpl implements _EarnedBadge {
  const _$EarnedBadgeImpl({
    required this.id,
    required this.earnedAt,
    required this.badge,
  });

  factory _$EarnedBadgeImpl.fromJson(Map<String, dynamic> json) =>
      _$$EarnedBadgeImplFromJson(json);

  @override
  final String id;
  @override
  final String earnedAt;
  @override
  final CourseBadgeInfo badge;

  @override
  String toString() {
    return 'EarnedBadge(id: $id, earnedAt: $earnedAt, badge: $badge)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$EarnedBadgeImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.earnedAt, earnedAt) ||
                other.earnedAt == earnedAt) &&
            (identical(other.badge, badge) || other.badge == badge));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, earnedAt, badge);

  /// Create a copy of EarnedBadge
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$EarnedBadgeImplCopyWith<_$EarnedBadgeImpl> get copyWith =>
      __$$EarnedBadgeImplCopyWithImpl<_$EarnedBadgeImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$EarnedBadgeImplToJson(this);
  }
}

abstract class _EarnedBadge implements EarnedBadge {
  const factory _EarnedBadge({
    required final String id,
    required final String earnedAt,
    required final CourseBadgeInfo badge,
  }) = _$EarnedBadgeImpl;

  factory _EarnedBadge.fromJson(Map<String, dynamic> json) =
      _$EarnedBadgeImpl.fromJson;

  @override
  String get id;
  @override
  String get earnedAt;
  @override
  CourseBadgeInfo get badge;

  /// Create a copy of EarnedBadge
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$EarnedBadgeImplCopyWith<_$EarnedBadgeImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

CertEligibility _$CertEligibilityFromJson(Map<String, dynamic> json) {
  return _CertEligibility.fromJson(json);
}

/// @nodoc
mixin _$CertEligibility {
  bool get eligible => throw _privateConstructorUsedError;
  int get completionPercentage => throw _privateConstructorUsedError;
  int get remainingLessons => throw _privateConstructorUsedError;
  String get securityStatus => throw _privateConstructorUsedError;

  /// Serializes this CertEligibility to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of CertEligibility
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $CertEligibilityCopyWith<CertEligibility> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $CertEligibilityCopyWith<$Res> {
  factory $CertEligibilityCopyWith(
    CertEligibility value,
    $Res Function(CertEligibility) then,
  ) = _$CertEligibilityCopyWithImpl<$Res, CertEligibility>;
  @useResult
  $Res call({
    bool eligible,
    int completionPercentage,
    int remainingLessons,
    String securityStatus,
  });
}

/// @nodoc
class _$CertEligibilityCopyWithImpl<$Res, $Val extends CertEligibility>
    implements $CertEligibilityCopyWith<$Res> {
  _$CertEligibilityCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of CertEligibility
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? eligible = null,
    Object? completionPercentage = null,
    Object? remainingLessons = null,
    Object? securityStatus = null,
  }) {
    return _then(
      _value.copyWith(
            eligible:
                null == eligible
                    ? _value.eligible
                    : eligible // ignore: cast_nullable_to_non_nullable
                        as bool,
            completionPercentage:
                null == completionPercentage
                    ? _value.completionPercentage
                    : completionPercentage // ignore: cast_nullable_to_non_nullable
                        as int,
            remainingLessons:
                null == remainingLessons
                    ? _value.remainingLessons
                    : remainingLessons // ignore: cast_nullable_to_non_nullable
                        as int,
            securityStatus:
                null == securityStatus
                    ? _value.securityStatus
                    : securityStatus // ignore: cast_nullable_to_non_nullable
                        as String,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$CertEligibilityImplCopyWith<$Res>
    implements $CertEligibilityCopyWith<$Res> {
  factory _$$CertEligibilityImplCopyWith(
    _$CertEligibilityImpl value,
    $Res Function(_$CertEligibilityImpl) then,
  ) = __$$CertEligibilityImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    bool eligible,
    int completionPercentage,
    int remainingLessons,
    String securityStatus,
  });
}

/// @nodoc
class __$$CertEligibilityImplCopyWithImpl<$Res>
    extends _$CertEligibilityCopyWithImpl<$Res, _$CertEligibilityImpl>
    implements _$$CertEligibilityImplCopyWith<$Res> {
  __$$CertEligibilityImplCopyWithImpl(
    _$CertEligibilityImpl _value,
    $Res Function(_$CertEligibilityImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of CertEligibility
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? eligible = null,
    Object? completionPercentage = null,
    Object? remainingLessons = null,
    Object? securityStatus = null,
  }) {
    return _then(
      _$CertEligibilityImpl(
        eligible:
            null == eligible
                ? _value.eligible
                : eligible // ignore: cast_nullable_to_non_nullable
                    as bool,
        completionPercentage:
            null == completionPercentage
                ? _value.completionPercentage
                : completionPercentage // ignore: cast_nullable_to_non_nullable
                    as int,
        remainingLessons:
            null == remainingLessons
                ? _value.remainingLessons
                : remainingLessons // ignore: cast_nullable_to_non_nullable
                    as int,
        securityStatus:
            null == securityStatus
                ? _value.securityStatus
                : securityStatus // ignore: cast_nullable_to_non_nullable
                    as String,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$CertEligibilityImpl implements _CertEligibility {
  const _$CertEligibilityImpl({
    this.eligible = false,
    this.completionPercentage = 0,
    this.remainingLessons = 0,
    this.securityStatus = 'clear',
  });

  factory _$CertEligibilityImpl.fromJson(Map<String, dynamic> json) =>
      _$$CertEligibilityImplFromJson(json);

  @override
  @JsonKey()
  final bool eligible;
  @override
  @JsonKey()
  final int completionPercentage;
  @override
  @JsonKey()
  final int remainingLessons;
  @override
  @JsonKey()
  final String securityStatus;

  @override
  String toString() {
    return 'CertEligibility(eligible: $eligible, completionPercentage: $completionPercentage, remainingLessons: $remainingLessons, securityStatus: $securityStatus)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$CertEligibilityImpl &&
            (identical(other.eligible, eligible) ||
                other.eligible == eligible) &&
            (identical(other.completionPercentage, completionPercentage) ||
                other.completionPercentage == completionPercentage) &&
            (identical(other.remainingLessons, remainingLessons) ||
                other.remainingLessons == remainingLessons) &&
            (identical(other.securityStatus, securityStatus) ||
                other.securityStatus == securityStatus));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
    runtimeType,
    eligible,
    completionPercentage,
    remainingLessons,
    securityStatus,
  );

  /// Create a copy of CertEligibility
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$CertEligibilityImplCopyWith<_$CertEligibilityImpl> get copyWith =>
      __$$CertEligibilityImplCopyWithImpl<_$CertEligibilityImpl>(
        this,
        _$identity,
      );

  @override
  Map<String, dynamic> toJson() {
    return _$$CertEligibilityImplToJson(this);
  }
}

abstract class _CertEligibility implements CertEligibility {
  const factory _CertEligibility({
    final bool eligible,
    final int completionPercentage,
    final int remainingLessons,
    final String securityStatus,
  }) = _$CertEligibilityImpl;

  factory _CertEligibility.fromJson(Map<String, dynamic> json) =
      _$CertEligibilityImpl.fromJson;

  @override
  bool get eligible;
  @override
  int get completionPercentage;
  @override
  int get remainingLessons;
  @override
  String get securityStatus;

  /// Create a copy of CertEligibility
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$CertEligibilityImplCopyWith<_$CertEligibilityImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
