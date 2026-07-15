// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'workshop.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

Workshop _$WorkshopFromJson(Map<String, dynamic> json) {
  return _Workshop.fromJson(json);
}

/// @nodoc
mixin _$Workshop {
  String get id => throw _privateConstructorUsedError;
  String get slug => throw _privateConstructorUsedError;
  String get title => throw _privateConstructorUsedError;
  String? get description => throw _privateConstructorUsedError;
  String? get thumbnailUrl => throw _privateConstructorUsedError;
  DeliveryMode get deliveryMode => throw _privateConstructorUsedError;
  String? get deliveryModeLabel => throw _privateConstructorUsedError;
  bool get locked => throw _privateConstructorUsedError;
  String? get enrollmentStatus => throw _privateConstructorUsedError;
  int get challengeCount => throw _privateConstructorUsedError;
  List<String>? get batchIds => throw _privateConstructorUsedError;

  /// Serializes this Workshop to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of Workshop
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $WorkshopCopyWith<Workshop> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $WorkshopCopyWith<$Res> {
  factory $WorkshopCopyWith(Workshop value, $Res Function(Workshop) then) =
      _$WorkshopCopyWithImpl<$Res, Workshop>;
  @useResult
  $Res call({
    String id,
    String slug,
    String title,
    String? description,
    String? thumbnailUrl,
    DeliveryMode deliveryMode,
    String? deliveryModeLabel,
    bool locked,
    String? enrollmentStatus,
    int challengeCount,
    List<String>? batchIds,
  });
}

/// @nodoc
class _$WorkshopCopyWithImpl<$Res, $Val extends Workshop>
    implements $WorkshopCopyWith<$Res> {
  _$WorkshopCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of Workshop
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? slug = null,
    Object? title = null,
    Object? description = freezed,
    Object? thumbnailUrl = freezed,
    Object? deliveryMode = null,
    Object? deliveryModeLabel = freezed,
    Object? locked = null,
    Object? enrollmentStatus = freezed,
    Object? challengeCount = null,
    Object? batchIds = freezed,
  }) {
    return _then(
      _value.copyWith(
            id:
                null == id
                    ? _value.id
                    : id // ignore: cast_nullable_to_non_nullable
                        as String,
            slug:
                null == slug
                    ? _value.slug
                    : slug // ignore: cast_nullable_to_non_nullable
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
            thumbnailUrl:
                freezed == thumbnailUrl
                    ? _value.thumbnailUrl
                    : thumbnailUrl // ignore: cast_nullable_to_non_nullable
                        as String?,
            deliveryMode:
                null == deliveryMode
                    ? _value.deliveryMode
                    : deliveryMode // ignore: cast_nullable_to_non_nullable
                        as DeliveryMode,
            deliveryModeLabel:
                freezed == deliveryModeLabel
                    ? _value.deliveryModeLabel
                    : deliveryModeLabel // ignore: cast_nullable_to_non_nullable
                        as String?,
            locked:
                null == locked
                    ? _value.locked
                    : locked // ignore: cast_nullable_to_non_nullable
                        as bool,
            enrollmentStatus:
                freezed == enrollmentStatus
                    ? _value.enrollmentStatus
                    : enrollmentStatus // ignore: cast_nullable_to_non_nullable
                        as String?,
            challengeCount:
                null == challengeCount
                    ? _value.challengeCount
                    : challengeCount // ignore: cast_nullable_to_non_nullable
                        as int,
            batchIds:
                freezed == batchIds
                    ? _value.batchIds
                    : batchIds // ignore: cast_nullable_to_non_nullable
                        as List<String>?,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$WorkshopImplCopyWith<$Res>
    implements $WorkshopCopyWith<$Res> {
  factory _$$WorkshopImplCopyWith(
    _$WorkshopImpl value,
    $Res Function(_$WorkshopImpl) then,
  ) = __$$WorkshopImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    String id,
    String slug,
    String title,
    String? description,
    String? thumbnailUrl,
    DeliveryMode deliveryMode,
    String? deliveryModeLabel,
    bool locked,
    String? enrollmentStatus,
    int challengeCount,
    List<String>? batchIds,
  });
}

/// @nodoc
class __$$WorkshopImplCopyWithImpl<$Res>
    extends _$WorkshopCopyWithImpl<$Res, _$WorkshopImpl>
    implements _$$WorkshopImplCopyWith<$Res> {
  __$$WorkshopImplCopyWithImpl(
    _$WorkshopImpl _value,
    $Res Function(_$WorkshopImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of Workshop
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? slug = null,
    Object? title = null,
    Object? description = freezed,
    Object? thumbnailUrl = freezed,
    Object? deliveryMode = null,
    Object? deliveryModeLabel = freezed,
    Object? locked = null,
    Object? enrollmentStatus = freezed,
    Object? challengeCount = null,
    Object? batchIds = freezed,
  }) {
    return _then(
      _$WorkshopImpl(
        id:
            null == id
                ? _value.id
                : id // ignore: cast_nullable_to_non_nullable
                    as String,
        slug:
            null == slug
                ? _value.slug
                : slug // ignore: cast_nullable_to_non_nullable
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
        thumbnailUrl:
            freezed == thumbnailUrl
                ? _value.thumbnailUrl
                : thumbnailUrl // ignore: cast_nullable_to_non_nullable
                    as String?,
        deliveryMode:
            null == deliveryMode
                ? _value.deliveryMode
                : deliveryMode // ignore: cast_nullable_to_non_nullable
                    as DeliveryMode,
        deliveryModeLabel:
            freezed == deliveryModeLabel
                ? _value.deliveryModeLabel
                : deliveryModeLabel // ignore: cast_nullable_to_non_nullable
                    as String?,
        locked:
            null == locked
                ? _value.locked
                : locked // ignore: cast_nullable_to_non_nullable
                    as bool,
        enrollmentStatus:
            freezed == enrollmentStatus
                ? _value.enrollmentStatus
                : enrollmentStatus // ignore: cast_nullable_to_non_nullable
                    as String?,
        challengeCount:
            null == challengeCount
                ? _value.challengeCount
                : challengeCount // ignore: cast_nullable_to_non_nullable
                    as int,
        batchIds:
            freezed == batchIds
                ? _value._batchIds
                : batchIds // ignore: cast_nullable_to_non_nullable
                    as List<String>?,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$WorkshopImpl implements _Workshop {
  const _$WorkshopImpl({
    required this.id,
    required this.slug,
    required this.title,
    this.description,
    this.thumbnailUrl,
    required this.deliveryMode,
    this.deliveryModeLabel,
    this.locked = false,
    this.enrollmentStatus,
    this.challengeCount = 0,
    final List<String>? batchIds,
  }) : _batchIds = batchIds;

  factory _$WorkshopImpl.fromJson(Map<String, dynamic> json) =>
      _$$WorkshopImplFromJson(json);

  @override
  final String id;
  @override
  final String slug;
  @override
  final String title;
  @override
  final String? description;
  @override
  final String? thumbnailUrl;
  @override
  final DeliveryMode deliveryMode;
  @override
  final String? deliveryModeLabel;
  @override
  @JsonKey()
  final bool locked;
  @override
  final String? enrollmentStatus;
  @override
  @JsonKey()
  final int challengeCount;
  final List<String>? _batchIds;
  @override
  List<String>? get batchIds {
    final value = _batchIds;
    if (value == null) return null;
    if (_batchIds is EqualUnmodifiableListView) return _batchIds;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(value);
  }

  @override
  String toString() {
    return 'Workshop(id: $id, slug: $slug, title: $title, description: $description, thumbnailUrl: $thumbnailUrl, deliveryMode: $deliveryMode, deliveryModeLabel: $deliveryModeLabel, locked: $locked, enrollmentStatus: $enrollmentStatus, challengeCount: $challengeCount, batchIds: $batchIds)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$WorkshopImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.slug, slug) || other.slug == slug) &&
            (identical(other.title, title) || other.title == title) &&
            (identical(other.description, description) ||
                other.description == description) &&
            (identical(other.thumbnailUrl, thumbnailUrl) ||
                other.thumbnailUrl == thumbnailUrl) &&
            (identical(other.deliveryMode, deliveryMode) ||
                other.deliveryMode == deliveryMode) &&
            (identical(other.deliveryModeLabel, deliveryModeLabel) ||
                other.deliveryModeLabel == deliveryModeLabel) &&
            (identical(other.locked, locked) || other.locked == locked) &&
            (identical(other.enrollmentStatus, enrollmentStatus) ||
                other.enrollmentStatus == enrollmentStatus) &&
            (identical(other.challengeCount, challengeCount) ||
                other.challengeCount == challengeCount) &&
            const DeepCollectionEquality().equals(other._batchIds, _batchIds));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
    runtimeType,
    id,
    slug,
    title,
    description,
    thumbnailUrl,
    deliveryMode,
    deliveryModeLabel,
    locked,
    enrollmentStatus,
    challengeCount,
    const DeepCollectionEquality().hash(_batchIds),
  );

  /// Create a copy of Workshop
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$WorkshopImplCopyWith<_$WorkshopImpl> get copyWith =>
      __$$WorkshopImplCopyWithImpl<_$WorkshopImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$WorkshopImplToJson(this);
  }
}

abstract class _Workshop implements Workshop {
  const factory _Workshop({
    required final String id,
    required final String slug,
    required final String title,
    final String? description,
    final String? thumbnailUrl,
    required final DeliveryMode deliveryMode,
    final String? deliveryModeLabel,
    final bool locked,
    final String? enrollmentStatus,
    final int challengeCount,
    final List<String>? batchIds,
  }) = _$WorkshopImpl;

  factory _Workshop.fromJson(Map<String, dynamic> json) =
      _$WorkshopImpl.fromJson;

  @override
  String get id;
  @override
  String get slug;
  @override
  String get title;
  @override
  String? get description;
  @override
  String? get thumbnailUrl;
  @override
  DeliveryMode get deliveryMode;
  @override
  String? get deliveryModeLabel;
  @override
  bool get locked;
  @override
  String? get enrollmentStatus;
  @override
  int get challengeCount;
  @override
  List<String>? get batchIds;

  /// Create a copy of Workshop
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$WorkshopImplCopyWith<_$WorkshopImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

WorkshopProgress _$WorkshopProgressFromJson(Map<String, dynamic> json) {
  return _WorkshopProgress.fromJson(json);
}

/// @nodoc
mixin _$WorkshopProgress {
  String? get label => throw _privateConstructorUsedError;
  int get percentage => throw _privateConstructorUsedError;
  int get completedCount => throw _privateConstructorUsedError;
  int get totalCount => throw _privateConstructorUsedError;

  /// Serializes this WorkshopProgress to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of WorkshopProgress
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $WorkshopProgressCopyWith<WorkshopProgress> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $WorkshopProgressCopyWith<$Res> {
  factory $WorkshopProgressCopyWith(
    WorkshopProgress value,
    $Res Function(WorkshopProgress) then,
  ) = _$WorkshopProgressCopyWithImpl<$Res, WorkshopProgress>;
  @useResult
  $Res call({
    String? label,
    int percentage,
    int completedCount,
    int totalCount,
  });
}

/// @nodoc
class _$WorkshopProgressCopyWithImpl<$Res, $Val extends WorkshopProgress>
    implements $WorkshopProgressCopyWith<$Res> {
  _$WorkshopProgressCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of WorkshopProgress
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? label = freezed,
    Object? percentage = null,
    Object? completedCount = null,
    Object? totalCount = null,
  }) {
    return _then(
      _value.copyWith(
            label:
                freezed == label
                    ? _value.label
                    : label // ignore: cast_nullable_to_non_nullable
                        as String?,
            percentage:
                null == percentage
                    ? _value.percentage
                    : percentage // ignore: cast_nullable_to_non_nullable
                        as int,
            completedCount:
                null == completedCount
                    ? _value.completedCount
                    : completedCount // ignore: cast_nullable_to_non_nullable
                        as int,
            totalCount:
                null == totalCount
                    ? _value.totalCount
                    : totalCount // ignore: cast_nullable_to_non_nullable
                        as int,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$WorkshopProgressImplCopyWith<$Res>
    implements $WorkshopProgressCopyWith<$Res> {
  factory _$$WorkshopProgressImplCopyWith(
    _$WorkshopProgressImpl value,
    $Res Function(_$WorkshopProgressImpl) then,
  ) = __$$WorkshopProgressImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    String? label,
    int percentage,
    int completedCount,
    int totalCount,
  });
}

/// @nodoc
class __$$WorkshopProgressImplCopyWithImpl<$Res>
    extends _$WorkshopProgressCopyWithImpl<$Res, _$WorkshopProgressImpl>
    implements _$$WorkshopProgressImplCopyWith<$Res> {
  __$$WorkshopProgressImplCopyWithImpl(
    _$WorkshopProgressImpl _value,
    $Res Function(_$WorkshopProgressImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of WorkshopProgress
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? label = freezed,
    Object? percentage = null,
    Object? completedCount = null,
    Object? totalCount = null,
  }) {
    return _then(
      _$WorkshopProgressImpl(
        label:
            freezed == label
                ? _value.label
                : label // ignore: cast_nullable_to_non_nullable
                    as String?,
        percentage:
            null == percentage
                ? _value.percentage
                : percentage // ignore: cast_nullable_to_non_nullable
                    as int,
        completedCount:
            null == completedCount
                ? _value.completedCount
                : completedCount // ignore: cast_nullable_to_non_nullable
                    as int,
        totalCount:
            null == totalCount
                ? _value.totalCount
                : totalCount // ignore: cast_nullable_to_non_nullable
                    as int,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$WorkshopProgressImpl implements _WorkshopProgress {
  const _$WorkshopProgressImpl({
    this.label,
    this.percentage = 0,
    this.completedCount = 0,
    this.totalCount = 0,
  });

  factory _$WorkshopProgressImpl.fromJson(Map<String, dynamic> json) =>
      _$$WorkshopProgressImplFromJson(json);

  @override
  final String? label;
  @override
  @JsonKey()
  final int percentage;
  @override
  @JsonKey()
  final int completedCount;
  @override
  @JsonKey()
  final int totalCount;

  @override
  String toString() {
    return 'WorkshopProgress(label: $label, percentage: $percentage, completedCount: $completedCount, totalCount: $totalCount)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$WorkshopProgressImpl &&
            (identical(other.label, label) || other.label == label) &&
            (identical(other.percentage, percentage) ||
                other.percentage == percentage) &&
            (identical(other.completedCount, completedCount) ||
                other.completedCount == completedCount) &&
            (identical(other.totalCount, totalCount) ||
                other.totalCount == totalCount));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, label, percentage, completedCount, totalCount);

  /// Create a copy of WorkshopProgress
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$WorkshopProgressImplCopyWith<_$WorkshopProgressImpl> get copyWith =>
      __$$WorkshopProgressImplCopyWithImpl<_$WorkshopProgressImpl>(
        this,
        _$identity,
      );

  @override
  Map<String, dynamic> toJson() {
    return _$$WorkshopProgressImplToJson(this);
  }
}

abstract class _WorkshopProgress implements WorkshopProgress {
  const factory _WorkshopProgress({
    final String? label,
    final int percentage,
    final int completedCount,
    final int totalCount,
  }) = _$WorkshopProgressImpl;

  factory _WorkshopProgress.fromJson(Map<String, dynamic> json) =
      _$WorkshopProgressImpl.fromJson;

  @override
  String? get label;
  @override
  int get percentage;
  @override
  int get completedCount;
  @override
  int get totalCount;

  /// Create a copy of WorkshopProgress
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$WorkshopProgressImplCopyWith<_$WorkshopProgressImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

FlowEpisode _$FlowEpisodeFromJson(Map<String, dynamic> json) {
  return _FlowEpisode.fromJson(json);
}

/// @nodoc
mixin _$FlowEpisode {
  String get id => throw _privateConstructorUsedError;
  int get order => throw _privateConstructorUsedError;
  String get title => throw _privateConstructorUsedError;
  String get type => throw _privateConstructorUsedError;
  bool get isCompleted => throw _privateConstructorUsedError;
  bool get isLocked => throw _privateConstructorUsedError;
  int? get durationSeconds => throw _privateConstructorUsedError;
  String? get durationLabel => throw _privateConstructorUsedError;

  /// Serializes this FlowEpisode to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of FlowEpisode
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $FlowEpisodeCopyWith<FlowEpisode> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $FlowEpisodeCopyWith<$Res> {
  factory $FlowEpisodeCopyWith(
    FlowEpisode value,
    $Res Function(FlowEpisode) then,
  ) = _$FlowEpisodeCopyWithImpl<$Res, FlowEpisode>;
  @useResult
  $Res call({
    String id,
    int order,
    String title,
    String type,
    bool isCompleted,
    bool isLocked,
    int? durationSeconds,
    String? durationLabel,
  });
}

/// @nodoc
class _$FlowEpisodeCopyWithImpl<$Res, $Val extends FlowEpisode>
    implements $FlowEpisodeCopyWith<$Res> {
  _$FlowEpisodeCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of FlowEpisode
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? order = null,
    Object? title = null,
    Object? type = null,
    Object? isCompleted = null,
    Object? isLocked = null,
    Object? durationSeconds = freezed,
    Object? durationLabel = freezed,
  }) {
    return _then(
      _value.copyWith(
            id:
                null == id
                    ? _value.id
                    : id // ignore: cast_nullable_to_non_nullable
                        as String,
            order:
                null == order
                    ? _value.order
                    : order // ignore: cast_nullable_to_non_nullable
                        as int,
            title:
                null == title
                    ? _value.title
                    : title // ignore: cast_nullable_to_non_nullable
                        as String,
            type:
                null == type
                    ? _value.type
                    : type // ignore: cast_nullable_to_non_nullable
                        as String,
            isCompleted:
                null == isCompleted
                    ? _value.isCompleted
                    : isCompleted // ignore: cast_nullable_to_non_nullable
                        as bool,
            isLocked:
                null == isLocked
                    ? _value.isLocked
                    : isLocked // ignore: cast_nullable_to_non_nullable
                        as bool,
            durationSeconds:
                freezed == durationSeconds
                    ? _value.durationSeconds
                    : durationSeconds // ignore: cast_nullable_to_non_nullable
                        as int?,
            durationLabel:
                freezed == durationLabel
                    ? _value.durationLabel
                    : durationLabel // ignore: cast_nullable_to_non_nullable
                        as String?,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$FlowEpisodeImplCopyWith<$Res>
    implements $FlowEpisodeCopyWith<$Res> {
  factory _$$FlowEpisodeImplCopyWith(
    _$FlowEpisodeImpl value,
    $Res Function(_$FlowEpisodeImpl) then,
  ) = __$$FlowEpisodeImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    String id,
    int order,
    String title,
    String type,
    bool isCompleted,
    bool isLocked,
    int? durationSeconds,
    String? durationLabel,
  });
}

/// @nodoc
class __$$FlowEpisodeImplCopyWithImpl<$Res>
    extends _$FlowEpisodeCopyWithImpl<$Res, _$FlowEpisodeImpl>
    implements _$$FlowEpisodeImplCopyWith<$Res> {
  __$$FlowEpisodeImplCopyWithImpl(
    _$FlowEpisodeImpl _value,
    $Res Function(_$FlowEpisodeImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of FlowEpisode
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? order = null,
    Object? title = null,
    Object? type = null,
    Object? isCompleted = null,
    Object? isLocked = null,
    Object? durationSeconds = freezed,
    Object? durationLabel = freezed,
  }) {
    return _then(
      _$FlowEpisodeImpl(
        id:
            null == id
                ? _value.id
                : id // ignore: cast_nullable_to_non_nullable
                    as String,
        order:
            null == order
                ? _value.order
                : order // ignore: cast_nullable_to_non_nullable
                    as int,
        title:
            null == title
                ? _value.title
                : title // ignore: cast_nullable_to_non_nullable
                    as String,
        type:
            null == type
                ? _value.type
                : type // ignore: cast_nullable_to_non_nullable
                    as String,
        isCompleted:
            null == isCompleted
                ? _value.isCompleted
                : isCompleted // ignore: cast_nullable_to_non_nullable
                    as bool,
        isLocked:
            null == isLocked
                ? _value.isLocked
                : isLocked // ignore: cast_nullable_to_non_nullable
                    as bool,
        durationSeconds:
            freezed == durationSeconds
                ? _value.durationSeconds
                : durationSeconds // ignore: cast_nullable_to_non_nullable
                    as int?,
        durationLabel:
            freezed == durationLabel
                ? _value.durationLabel
                : durationLabel // ignore: cast_nullable_to_non_nullable
                    as String?,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$FlowEpisodeImpl implements _FlowEpisode {
  const _$FlowEpisodeImpl({
    required this.id,
    this.order = 0,
    required this.title,
    this.type = 'video',
    this.isCompleted = false,
    this.isLocked = false,
    this.durationSeconds,
    this.durationLabel,
  });

  factory _$FlowEpisodeImpl.fromJson(Map<String, dynamic> json) =>
      _$$FlowEpisodeImplFromJson(json);

  @override
  final String id;
  @override
  @JsonKey()
  final int order;
  @override
  final String title;
  @override
  @JsonKey()
  final String type;
  @override
  @JsonKey()
  final bool isCompleted;
  @override
  @JsonKey()
  final bool isLocked;
  @override
  final int? durationSeconds;
  @override
  final String? durationLabel;

  @override
  String toString() {
    return 'FlowEpisode(id: $id, order: $order, title: $title, type: $type, isCompleted: $isCompleted, isLocked: $isLocked, durationSeconds: $durationSeconds, durationLabel: $durationLabel)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$FlowEpisodeImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.order, order) || other.order == order) &&
            (identical(other.title, title) || other.title == title) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.isCompleted, isCompleted) ||
                other.isCompleted == isCompleted) &&
            (identical(other.isLocked, isLocked) ||
                other.isLocked == isLocked) &&
            (identical(other.durationSeconds, durationSeconds) ||
                other.durationSeconds == durationSeconds) &&
            (identical(other.durationLabel, durationLabel) ||
                other.durationLabel == durationLabel));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
    runtimeType,
    id,
    order,
    title,
    type,
    isCompleted,
    isLocked,
    durationSeconds,
    durationLabel,
  );

  /// Create a copy of FlowEpisode
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$FlowEpisodeImplCopyWith<_$FlowEpisodeImpl> get copyWith =>
      __$$FlowEpisodeImplCopyWithImpl<_$FlowEpisodeImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$FlowEpisodeImplToJson(this);
  }
}

abstract class _FlowEpisode implements FlowEpisode {
  const factory _FlowEpisode({
    required final String id,
    final int order,
    required final String title,
    final String type,
    final bool isCompleted,
    final bool isLocked,
    final int? durationSeconds,
    final String? durationLabel,
  }) = _$FlowEpisodeImpl;

  factory _FlowEpisode.fromJson(Map<String, dynamic> json) =
      _$FlowEpisodeImpl.fromJson;

  @override
  String get id;
  @override
  int get order;
  @override
  String get title;
  @override
  String get type;
  @override
  bool get isCompleted;
  @override
  bool get isLocked;
  @override
  int? get durationSeconds;
  @override
  String? get durationLabel;

  /// Create a copy of FlowEpisode
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$FlowEpisodeImplCopyWith<_$FlowEpisodeImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

FlowItem _$FlowItemFromJson(Map<String, dynamic> json) {
  return _FlowItem.fromJson(json);
}

/// @nodoc
mixin _$FlowItem {
  String get id => throw _privateConstructorUsedError;
  int get order => throw _privateConstructorUsedError;
  String get type => throw _privateConstructorUsedError; // Shared
  String? get title => throw _privateConstructorUsedError;
  String? get label => throw _privateConstructorUsedError;
  String? get description => throw _privateConstructorUsedError;
  bool get isCompleted =>
      throw _privateConstructorUsedError; // Challenge-specific
  int? get challengeNumber => throw _privateConstructorUsedError;
  String? get numberLabel => throw _privateConstructorUsedError;
  String? get numberColor => throw _privateConstructorUsedError;
  int get progressPercent => throw _privateConstructorUsedError;
  List<FlowEpisode> get episodes =>
      throw _privateConstructorUsedError; // Live-call-specific
  String? get liveCallId => throw _privateConstructorUsedError;
  String? get labelColor => throw _privateConstructorUsedError;
  String? get scheduledAt => throw _privateConstructorUsedError;
  String? get status => throw _privateConstructorUsedError;
  bool get isUnlocked => throw _privateConstructorUsedError;
  bool get recordingAvailable => throw _privateConstructorUsedError;
  String? get recordingLabel => throw _privateConstructorUsedError;
  String? get prerequisiteNote => throw _privateConstructorUsedError;
  String? get externalMeetingUrl => throw _privateConstructorUsedError;
  String? get externalMeetingProvider => throw _privateConstructorUsedError;
  String? get aiSummary => throw _privateConstructorUsedError;

  /// Serializes this FlowItem to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of FlowItem
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $FlowItemCopyWith<FlowItem> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $FlowItemCopyWith<$Res> {
  factory $FlowItemCopyWith(FlowItem value, $Res Function(FlowItem) then) =
      _$FlowItemCopyWithImpl<$Res, FlowItem>;
  @useResult
  $Res call({
    String id,
    int order,
    String type,
    String? title,
    String? label,
    String? description,
    bool isCompleted,
    int? challengeNumber,
    String? numberLabel,
    String? numberColor,
    int progressPercent,
    List<FlowEpisode> episodes,
    String? liveCallId,
    String? labelColor,
    String? scheduledAt,
    String? status,
    bool isUnlocked,
    bool recordingAvailable,
    String? recordingLabel,
    String? prerequisiteNote,
    String? externalMeetingUrl,
    String? externalMeetingProvider,
    String? aiSummary,
  });
}

/// @nodoc
class _$FlowItemCopyWithImpl<$Res, $Val extends FlowItem>
    implements $FlowItemCopyWith<$Res> {
  _$FlowItemCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of FlowItem
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? order = null,
    Object? type = null,
    Object? title = freezed,
    Object? label = freezed,
    Object? description = freezed,
    Object? isCompleted = null,
    Object? challengeNumber = freezed,
    Object? numberLabel = freezed,
    Object? numberColor = freezed,
    Object? progressPercent = null,
    Object? episodes = null,
    Object? liveCallId = freezed,
    Object? labelColor = freezed,
    Object? scheduledAt = freezed,
    Object? status = freezed,
    Object? isUnlocked = null,
    Object? recordingAvailable = null,
    Object? recordingLabel = freezed,
    Object? prerequisiteNote = freezed,
    Object? externalMeetingUrl = freezed,
    Object? externalMeetingProvider = freezed,
    Object? aiSummary = freezed,
  }) {
    return _then(
      _value.copyWith(
            id:
                null == id
                    ? _value.id
                    : id // ignore: cast_nullable_to_non_nullable
                        as String,
            order:
                null == order
                    ? _value.order
                    : order // ignore: cast_nullable_to_non_nullable
                        as int,
            type:
                null == type
                    ? _value.type
                    : type // ignore: cast_nullable_to_non_nullable
                        as String,
            title:
                freezed == title
                    ? _value.title
                    : title // ignore: cast_nullable_to_non_nullable
                        as String?,
            label:
                freezed == label
                    ? _value.label
                    : label // ignore: cast_nullable_to_non_nullable
                        as String?,
            description:
                freezed == description
                    ? _value.description
                    : description // ignore: cast_nullable_to_non_nullable
                        as String?,
            isCompleted:
                null == isCompleted
                    ? _value.isCompleted
                    : isCompleted // ignore: cast_nullable_to_non_nullable
                        as bool,
            challengeNumber:
                freezed == challengeNumber
                    ? _value.challengeNumber
                    : challengeNumber // ignore: cast_nullable_to_non_nullable
                        as int?,
            numberLabel:
                freezed == numberLabel
                    ? _value.numberLabel
                    : numberLabel // ignore: cast_nullable_to_non_nullable
                        as String?,
            numberColor:
                freezed == numberColor
                    ? _value.numberColor
                    : numberColor // ignore: cast_nullable_to_non_nullable
                        as String?,
            progressPercent:
                null == progressPercent
                    ? _value.progressPercent
                    : progressPercent // ignore: cast_nullable_to_non_nullable
                        as int,
            episodes:
                null == episodes
                    ? _value.episodes
                    : episodes // ignore: cast_nullable_to_non_nullable
                        as List<FlowEpisode>,
            liveCallId:
                freezed == liveCallId
                    ? _value.liveCallId
                    : liveCallId // ignore: cast_nullable_to_non_nullable
                        as String?,
            labelColor:
                freezed == labelColor
                    ? _value.labelColor
                    : labelColor // ignore: cast_nullable_to_non_nullable
                        as String?,
            scheduledAt:
                freezed == scheduledAt
                    ? _value.scheduledAt
                    : scheduledAt // ignore: cast_nullable_to_non_nullable
                        as String?,
            status:
                freezed == status
                    ? _value.status
                    : status // ignore: cast_nullable_to_non_nullable
                        as String?,
            isUnlocked:
                null == isUnlocked
                    ? _value.isUnlocked
                    : isUnlocked // ignore: cast_nullable_to_non_nullable
                        as bool,
            recordingAvailable:
                null == recordingAvailable
                    ? _value.recordingAvailable
                    : recordingAvailable // ignore: cast_nullable_to_non_nullable
                        as bool,
            recordingLabel:
                freezed == recordingLabel
                    ? _value.recordingLabel
                    : recordingLabel // ignore: cast_nullable_to_non_nullable
                        as String?,
            prerequisiteNote:
                freezed == prerequisiteNote
                    ? _value.prerequisiteNote
                    : prerequisiteNote // ignore: cast_nullable_to_non_nullable
                        as String?,
            externalMeetingUrl:
                freezed == externalMeetingUrl
                    ? _value.externalMeetingUrl
                    : externalMeetingUrl // ignore: cast_nullable_to_non_nullable
                        as String?,
            externalMeetingProvider:
                freezed == externalMeetingProvider
                    ? _value.externalMeetingProvider
                    : externalMeetingProvider // ignore: cast_nullable_to_non_nullable
                        as String?,
            aiSummary:
                freezed == aiSummary
                    ? _value.aiSummary
                    : aiSummary // ignore: cast_nullable_to_non_nullable
                        as String?,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$FlowItemImplCopyWith<$Res>
    implements $FlowItemCopyWith<$Res> {
  factory _$$FlowItemImplCopyWith(
    _$FlowItemImpl value,
    $Res Function(_$FlowItemImpl) then,
  ) = __$$FlowItemImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    String id,
    int order,
    String type,
    String? title,
    String? label,
    String? description,
    bool isCompleted,
    int? challengeNumber,
    String? numberLabel,
    String? numberColor,
    int progressPercent,
    List<FlowEpisode> episodes,
    String? liveCallId,
    String? labelColor,
    String? scheduledAt,
    String? status,
    bool isUnlocked,
    bool recordingAvailable,
    String? recordingLabel,
    String? prerequisiteNote,
    String? externalMeetingUrl,
    String? externalMeetingProvider,
    String? aiSummary,
  });
}

/// @nodoc
class __$$FlowItemImplCopyWithImpl<$Res>
    extends _$FlowItemCopyWithImpl<$Res, _$FlowItemImpl>
    implements _$$FlowItemImplCopyWith<$Res> {
  __$$FlowItemImplCopyWithImpl(
    _$FlowItemImpl _value,
    $Res Function(_$FlowItemImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of FlowItem
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? order = null,
    Object? type = null,
    Object? title = freezed,
    Object? label = freezed,
    Object? description = freezed,
    Object? isCompleted = null,
    Object? challengeNumber = freezed,
    Object? numberLabel = freezed,
    Object? numberColor = freezed,
    Object? progressPercent = null,
    Object? episodes = null,
    Object? liveCallId = freezed,
    Object? labelColor = freezed,
    Object? scheduledAt = freezed,
    Object? status = freezed,
    Object? isUnlocked = null,
    Object? recordingAvailable = null,
    Object? recordingLabel = freezed,
    Object? prerequisiteNote = freezed,
    Object? externalMeetingUrl = freezed,
    Object? externalMeetingProvider = freezed,
    Object? aiSummary = freezed,
  }) {
    return _then(
      _$FlowItemImpl(
        id:
            null == id
                ? _value.id
                : id // ignore: cast_nullable_to_non_nullable
                    as String,
        order:
            null == order
                ? _value.order
                : order // ignore: cast_nullable_to_non_nullable
                    as int,
        type:
            null == type
                ? _value.type
                : type // ignore: cast_nullable_to_non_nullable
                    as String,
        title:
            freezed == title
                ? _value.title
                : title // ignore: cast_nullable_to_non_nullable
                    as String?,
        label:
            freezed == label
                ? _value.label
                : label // ignore: cast_nullable_to_non_nullable
                    as String?,
        description:
            freezed == description
                ? _value.description
                : description // ignore: cast_nullable_to_non_nullable
                    as String?,
        isCompleted:
            null == isCompleted
                ? _value.isCompleted
                : isCompleted // ignore: cast_nullable_to_non_nullable
                    as bool,
        challengeNumber:
            freezed == challengeNumber
                ? _value.challengeNumber
                : challengeNumber // ignore: cast_nullable_to_non_nullable
                    as int?,
        numberLabel:
            freezed == numberLabel
                ? _value.numberLabel
                : numberLabel // ignore: cast_nullable_to_non_nullable
                    as String?,
        numberColor:
            freezed == numberColor
                ? _value.numberColor
                : numberColor // ignore: cast_nullable_to_non_nullable
                    as String?,
        progressPercent:
            null == progressPercent
                ? _value.progressPercent
                : progressPercent // ignore: cast_nullable_to_non_nullable
                    as int,
        episodes:
            null == episodes
                ? _value._episodes
                : episodes // ignore: cast_nullable_to_non_nullable
                    as List<FlowEpisode>,
        liveCallId:
            freezed == liveCallId
                ? _value.liveCallId
                : liveCallId // ignore: cast_nullable_to_non_nullable
                    as String?,
        labelColor:
            freezed == labelColor
                ? _value.labelColor
                : labelColor // ignore: cast_nullable_to_non_nullable
                    as String?,
        scheduledAt:
            freezed == scheduledAt
                ? _value.scheduledAt
                : scheduledAt // ignore: cast_nullable_to_non_nullable
                    as String?,
        status:
            freezed == status
                ? _value.status
                : status // ignore: cast_nullable_to_non_nullable
                    as String?,
        isUnlocked:
            null == isUnlocked
                ? _value.isUnlocked
                : isUnlocked // ignore: cast_nullable_to_non_nullable
                    as bool,
        recordingAvailable:
            null == recordingAvailable
                ? _value.recordingAvailable
                : recordingAvailable // ignore: cast_nullable_to_non_nullable
                    as bool,
        recordingLabel:
            freezed == recordingLabel
                ? _value.recordingLabel
                : recordingLabel // ignore: cast_nullable_to_non_nullable
                    as String?,
        prerequisiteNote:
            freezed == prerequisiteNote
                ? _value.prerequisiteNote
                : prerequisiteNote // ignore: cast_nullable_to_non_nullable
                    as String?,
        externalMeetingUrl:
            freezed == externalMeetingUrl
                ? _value.externalMeetingUrl
                : externalMeetingUrl // ignore: cast_nullable_to_non_nullable
                    as String?,
        externalMeetingProvider:
            freezed == externalMeetingProvider
                ? _value.externalMeetingProvider
                : externalMeetingProvider // ignore: cast_nullable_to_non_nullable
                    as String?,
        aiSummary:
            freezed == aiSummary
                ? _value.aiSummary
                : aiSummary // ignore: cast_nullable_to_non_nullable
                    as String?,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$FlowItemImpl implements _FlowItem {
  const _$FlowItemImpl({
    required this.id,
    this.order = 0,
    this.type = 'custom',
    this.title,
    this.label,
    this.description,
    this.isCompleted = false,
    this.challengeNumber,
    this.numberLabel,
    this.numberColor,
    this.progressPercent = 0,
    final List<FlowEpisode> episodes = const [],
    this.liveCallId,
    this.labelColor,
    this.scheduledAt,
    this.status,
    this.isUnlocked = false,
    this.recordingAvailable = false,
    this.recordingLabel,
    this.prerequisiteNote,
    this.externalMeetingUrl,
    this.externalMeetingProvider,
    this.aiSummary,
  }) : _episodes = episodes;

  factory _$FlowItemImpl.fromJson(Map<String, dynamic> json) =>
      _$$FlowItemImplFromJson(json);

  @override
  final String id;
  @override
  @JsonKey()
  final int order;
  @override
  @JsonKey()
  final String type;
  // Shared
  @override
  final String? title;
  @override
  final String? label;
  @override
  final String? description;
  @override
  @JsonKey()
  final bool isCompleted;
  // Challenge-specific
  @override
  final int? challengeNumber;
  @override
  final String? numberLabel;
  @override
  final String? numberColor;
  @override
  @JsonKey()
  final int progressPercent;
  final List<FlowEpisode> _episodes;
  @override
  @JsonKey()
  List<FlowEpisode> get episodes {
    if (_episodes is EqualUnmodifiableListView) return _episodes;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_episodes);
  }

  // Live-call-specific
  @override
  final String? liveCallId;
  @override
  final String? labelColor;
  @override
  final String? scheduledAt;
  @override
  final String? status;
  @override
  @JsonKey()
  final bool isUnlocked;
  @override
  @JsonKey()
  final bool recordingAvailable;
  @override
  final String? recordingLabel;
  @override
  final String? prerequisiteNote;
  @override
  final String? externalMeetingUrl;
  @override
  final String? externalMeetingProvider;
  @override
  final String? aiSummary;

  @override
  String toString() {
    return 'FlowItem(id: $id, order: $order, type: $type, title: $title, label: $label, description: $description, isCompleted: $isCompleted, challengeNumber: $challengeNumber, numberLabel: $numberLabel, numberColor: $numberColor, progressPercent: $progressPercent, episodes: $episodes, liveCallId: $liveCallId, labelColor: $labelColor, scheduledAt: $scheduledAt, status: $status, isUnlocked: $isUnlocked, recordingAvailable: $recordingAvailable, recordingLabel: $recordingLabel, prerequisiteNote: $prerequisiteNote, externalMeetingUrl: $externalMeetingUrl, externalMeetingProvider: $externalMeetingProvider, aiSummary: $aiSummary)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$FlowItemImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.order, order) || other.order == order) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.title, title) || other.title == title) &&
            (identical(other.label, label) || other.label == label) &&
            (identical(other.description, description) ||
                other.description == description) &&
            (identical(other.isCompleted, isCompleted) ||
                other.isCompleted == isCompleted) &&
            (identical(other.challengeNumber, challengeNumber) ||
                other.challengeNumber == challengeNumber) &&
            (identical(other.numberLabel, numberLabel) ||
                other.numberLabel == numberLabel) &&
            (identical(other.numberColor, numberColor) ||
                other.numberColor == numberColor) &&
            (identical(other.progressPercent, progressPercent) ||
                other.progressPercent == progressPercent) &&
            const DeepCollectionEquality().equals(other._episodes, _episodes) &&
            (identical(other.liveCallId, liveCallId) ||
                other.liveCallId == liveCallId) &&
            (identical(other.labelColor, labelColor) ||
                other.labelColor == labelColor) &&
            (identical(other.scheduledAt, scheduledAt) ||
                other.scheduledAt == scheduledAt) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.isUnlocked, isUnlocked) ||
                other.isUnlocked == isUnlocked) &&
            (identical(other.recordingAvailable, recordingAvailable) ||
                other.recordingAvailable == recordingAvailable) &&
            (identical(other.recordingLabel, recordingLabel) ||
                other.recordingLabel == recordingLabel) &&
            (identical(other.prerequisiteNote, prerequisiteNote) ||
                other.prerequisiteNote == prerequisiteNote) &&
            (identical(other.externalMeetingUrl, externalMeetingUrl) ||
                other.externalMeetingUrl == externalMeetingUrl) &&
            (identical(
                  other.externalMeetingProvider,
                  externalMeetingProvider,
                ) ||
                other.externalMeetingProvider == externalMeetingProvider) &&
            (identical(other.aiSummary, aiSummary) ||
                other.aiSummary == aiSummary));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hashAll([
    runtimeType,
    id,
    order,
    type,
    title,
    label,
    description,
    isCompleted,
    challengeNumber,
    numberLabel,
    numberColor,
    progressPercent,
    const DeepCollectionEquality().hash(_episodes),
    liveCallId,
    labelColor,
    scheduledAt,
    status,
    isUnlocked,
    recordingAvailable,
    recordingLabel,
    prerequisiteNote,
    externalMeetingUrl,
    externalMeetingProvider,
    aiSummary,
  ]);

  /// Create a copy of FlowItem
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$FlowItemImplCopyWith<_$FlowItemImpl> get copyWith =>
      __$$FlowItemImplCopyWithImpl<_$FlowItemImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$FlowItemImplToJson(this);
  }
}

abstract class _FlowItem implements FlowItem {
  const factory _FlowItem({
    required final String id,
    final int order,
    final String type,
    final String? title,
    final String? label,
    final String? description,
    final bool isCompleted,
    final int? challengeNumber,
    final String? numberLabel,
    final String? numberColor,
    final int progressPercent,
    final List<FlowEpisode> episodes,
    final String? liveCallId,
    final String? labelColor,
    final String? scheduledAt,
    final String? status,
    final bool isUnlocked,
    final bool recordingAvailable,
    final String? recordingLabel,
    final String? prerequisiteNote,
    final String? externalMeetingUrl,
    final String? externalMeetingProvider,
    final String? aiSummary,
  }) = _$FlowItemImpl;

  factory _FlowItem.fromJson(Map<String, dynamic> json) =
      _$FlowItemImpl.fromJson;

  @override
  String get id;
  @override
  int get order;
  @override
  String get type; // Shared
  @override
  String? get title;
  @override
  String? get label;
  @override
  String? get description;
  @override
  bool get isCompleted; // Challenge-specific
  @override
  int? get challengeNumber;
  @override
  String? get numberLabel;
  @override
  String? get numberColor;
  @override
  int get progressPercent;
  @override
  List<FlowEpisode> get episodes; // Live-call-specific
  @override
  String? get liveCallId;
  @override
  String? get labelColor;
  @override
  String? get scheduledAt;
  @override
  String? get status;
  @override
  bool get isUnlocked;
  @override
  bool get recordingAvailable;
  @override
  String? get recordingLabel;
  @override
  String? get prerequisiteNote;
  @override
  String? get externalMeetingUrl;
  @override
  String? get externalMeetingProvider;
  @override
  String? get aiSummary;

  /// Create a copy of FlowItem
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$FlowItemImplCopyWith<_$FlowItemImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

QaAuthor _$QaAuthorFromJson(Map<String, dynamic> json) {
  return _QaAuthor.fromJson(json);
}

/// @nodoc
mixin _$QaAuthor {
  String get name => throw _privateConstructorUsedError;
  String? get avatarUrl => throw _privateConstructorUsedError;

  /// Serializes this QaAuthor to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of QaAuthor
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $QaAuthorCopyWith<QaAuthor> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $QaAuthorCopyWith<$Res> {
  factory $QaAuthorCopyWith(QaAuthor value, $Res Function(QaAuthor) then) =
      _$QaAuthorCopyWithImpl<$Res, QaAuthor>;
  @useResult
  $Res call({String name, String? avatarUrl});
}

/// @nodoc
class _$QaAuthorCopyWithImpl<$Res, $Val extends QaAuthor>
    implements $QaAuthorCopyWith<$Res> {
  _$QaAuthorCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of QaAuthor
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? name = null, Object? avatarUrl = freezed}) {
    return _then(
      _value.copyWith(
            name:
                null == name
                    ? _value.name
                    : name // ignore: cast_nullable_to_non_nullable
                        as String,
            avatarUrl:
                freezed == avatarUrl
                    ? _value.avatarUrl
                    : avatarUrl // ignore: cast_nullable_to_non_nullable
                        as String?,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$QaAuthorImplCopyWith<$Res>
    implements $QaAuthorCopyWith<$Res> {
  factory _$$QaAuthorImplCopyWith(
    _$QaAuthorImpl value,
    $Res Function(_$QaAuthorImpl) then,
  ) = __$$QaAuthorImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String name, String? avatarUrl});
}

/// @nodoc
class __$$QaAuthorImplCopyWithImpl<$Res>
    extends _$QaAuthorCopyWithImpl<$Res, _$QaAuthorImpl>
    implements _$$QaAuthorImplCopyWith<$Res> {
  __$$QaAuthorImplCopyWithImpl(
    _$QaAuthorImpl _value,
    $Res Function(_$QaAuthorImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of QaAuthor
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? name = null, Object? avatarUrl = freezed}) {
    return _then(
      _$QaAuthorImpl(
        name:
            null == name
                ? _value.name
                : name // ignore: cast_nullable_to_non_nullable
                    as String,
        avatarUrl:
            freezed == avatarUrl
                ? _value.avatarUrl
                : avatarUrl // ignore: cast_nullable_to_non_nullable
                    as String?,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$QaAuthorImpl implements _QaAuthor {
  const _$QaAuthorImpl({required this.name, this.avatarUrl});

  factory _$QaAuthorImpl.fromJson(Map<String, dynamic> json) =>
      _$$QaAuthorImplFromJson(json);

  @override
  final String name;
  @override
  final String? avatarUrl;

  @override
  String toString() {
    return 'QaAuthor(name: $name, avatarUrl: $avatarUrl)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$QaAuthorImpl &&
            (identical(other.name, name) || other.name == name) &&
            (identical(other.avatarUrl, avatarUrl) ||
                other.avatarUrl == avatarUrl));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, name, avatarUrl);

  /// Create a copy of QaAuthor
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$QaAuthorImplCopyWith<_$QaAuthorImpl> get copyWith =>
      __$$QaAuthorImplCopyWithImpl<_$QaAuthorImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$QaAuthorImplToJson(this);
  }
}

abstract class _QaAuthor implements QaAuthor {
  const factory _QaAuthor({
    required final String name,
    final String? avatarUrl,
  }) = _$QaAuthorImpl;

  factory _QaAuthor.fromJson(Map<String, dynamic> json) =
      _$QaAuthorImpl.fromJson;

  @override
  String get name;
  @override
  String? get avatarUrl;

  /// Create a copy of QaAuthor
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$QaAuthorImplCopyWith<_$QaAuthorImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

QaReply _$QaReplyFromJson(Map<String, dynamic> json) {
  return _QaReply.fromJson(json);
}

/// @nodoc
mixin _$QaReply {
  String get id => throw _privateConstructorUsedError;
  QaAuthor get author => throw _privateConstructorUsedError;
  String get timeAgo => throw _privateConstructorUsedError;
  String get replyText => throw _privateConstructorUsedError;

  /// Serializes this QaReply to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of QaReply
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $QaReplyCopyWith<QaReply> get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $QaReplyCopyWith<$Res> {
  factory $QaReplyCopyWith(QaReply value, $Res Function(QaReply) then) =
      _$QaReplyCopyWithImpl<$Res, QaReply>;
  @useResult
  $Res call({String id, QaAuthor author, String timeAgo, String replyText});

  $QaAuthorCopyWith<$Res> get author;
}

/// @nodoc
class _$QaReplyCopyWithImpl<$Res, $Val extends QaReply>
    implements $QaReplyCopyWith<$Res> {
  _$QaReplyCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of QaReply
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? author = null,
    Object? timeAgo = null,
    Object? replyText = null,
  }) {
    return _then(
      _value.copyWith(
            id:
                null == id
                    ? _value.id
                    : id // ignore: cast_nullable_to_non_nullable
                        as String,
            author:
                null == author
                    ? _value.author
                    : author // ignore: cast_nullable_to_non_nullable
                        as QaAuthor,
            timeAgo:
                null == timeAgo
                    ? _value.timeAgo
                    : timeAgo // ignore: cast_nullable_to_non_nullable
                        as String,
            replyText:
                null == replyText
                    ? _value.replyText
                    : replyText // ignore: cast_nullable_to_non_nullable
                        as String,
          )
          as $Val,
    );
  }

  /// Create a copy of QaReply
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $QaAuthorCopyWith<$Res> get author {
    return $QaAuthorCopyWith<$Res>(_value.author, (value) {
      return _then(_value.copyWith(author: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$QaReplyImplCopyWith<$Res> implements $QaReplyCopyWith<$Res> {
  factory _$$QaReplyImplCopyWith(
    _$QaReplyImpl value,
    $Res Function(_$QaReplyImpl) then,
  ) = __$$QaReplyImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String id, QaAuthor author, String timeAgo, String replyText});

  @override
  $QaAuthorCopyWith<$Res> get author;
}

/// @nodoc
class __$$QaReplyImplCopyWithImpl<$Res>
    extends _$QaReplyCopyWithImpl<$Res, _$QaReplyImpl>
    implements _$$QaReplyImplCopyWith<$Res> {
  __$$QaReplyImplCopyWithImpl(
    _$QaReplyImpl _value,
    $Res Function(_$QaReplyImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of QaReply
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? author = null,
    Object? timeAgo = null,
    Object? replyText = null,
  }) {
    return _then(
      _$QaReplyImpl(
        id:
            null == id
                ? _value.id
                : id // ignore: cast_nullable_to_non_nullable
                    as String,
        author:
            null == author
                ? _value.author
                : author // ignore: cast_nullable_to_non_nullable
                    as QaAuthor,
        timeAgo:
            null == timeAgo
                ? _value.timeAgo
                : timeAgo // ignore: cast_nullable_to_non_nullable
                    as String,
        replyText:
            null == replyText
                ? _value.replyText
                : replyText // ignore: cast_nullable_to_non_nullable
                    as String,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$QaReplyImpl implements _QaReply {
  const _$QaReplyImpl({
    required this.id,
    required this.author,
    required this.timeAgo,
    required this.replyText,
  });

  factory _$QaReplyImpl.fromJson(Map<String, dynamic> json) =>
      _$$QaReplyImplFromJson(json);

  @override
  final String id;
  @override
  final QaAuthor author;
  @override
  final String timeAgo;
  @override
  final String replyText;

  @override
  String toString() {
    return 'QaReply(id: $id, author: $author, timeAgo: $timeAgo, replyText: $replyText)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$QaReplyImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.author, author) || other.author == author) &&
            (identical(other.timeAgo, timeAgo) || other.timeAgo == timeAgo) &&
            (identical(other.replyText, replyText) ||
                other.replyText == replyText));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, author, timeAgo, replyText);

  /// Create a copy of QaReply
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$QaReplyImplCopyWith<_$QaReplyImpl> get copyWith =>
      __$$QaReplyImplCopyWithImpl<_$QaReplyImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$QaReplyImplToJson(this);
  }
}

abstract class _QaReply implements QaReply {
  const factory _QaReply({
    required final String id,
    required final QaAuthor author,
    required final String timeAgo,
    required final String replyText,
  }) = _$QaReplyImpl;

  factory _QaReply.fromJson(Map<String, dynamic> json) = _$QaReplyImpl.fromJson;

  @override
  String get id;
  @override
  QaAuthor get author;
  @override
  String get timeAgo;
  @override
  String get replyText;

  /// Create a copy of QaReply
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$QaReplyImplCopyWith<_$QaReplyImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

QaPost _$QaPostFromJson(Map<String, dynamic> json) {
  return _QaPost.fromJson(json);
}

/// @nodoc
mixin _$QaPost {
  String get id => throw _privateConstructorUsedError;
  QaAuthor get author => throw _privateConstructorUsedError;
  String get timeAgo => throw _privateConstructorUsedError;
  String get questionText => throw _privateConstructorUsedError;
  String get replyLabel => throw _privateConstructorUsedError;
  List<QaReply> get replies => throw _privateConstructorUsedError;

  /// Serializes this QaPost to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of QaPost
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $QaPostCopyWith<QaPost> get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $QaPostCopyWith<$Res> {
  factory $QaPostCopyWith(QaPost value, $Res Function(QaPost) then) =
      _$QaPostCopyWithImpl<$Res, QaPost>;
  @useResult
  $Res call({
    String id,
    QaAuthor author,
    String timeAgo,
    String questionText,
    String replyLabel,
    List<QaReply> replies,
  });

  $QaAuthorCopyWith<$Res> get author;
}

/// @nodoc
class _$QaPostCopyWithImpl<$Res, $Val extends QaPost>
    implements $QaPostCopyWith<$Res> {
  _$QaPostCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of QaPost
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? author = null,
    Object? timeAgo = null,
    Object? questionText = null,
    Object? replyLabel = null,
    Object? replies = null,
  }) {
    return _then(
      _value.copyWith(
            id:
                null == id
                    ? _value.id
                    : id // ignore: cast_nullable_to_non_nullable
                        as String,
            author:
                null == author
                    ? _value.author
                    : author // ignore: cast_nullable_to_non_nullable
                        as QaAuthor,
            timeAgo:
                null == timeAgo
                    ? _value.timeAgo
                    : timeAgo // ignore: cast_nullable_to_non_nullable
                        as String,
            questionText:
                null == questionText
                    ? _value.questionText
                    : questionText // ignore: cast_nullable_to_non_nullable
                        as String,
            replyLabel:
                null == replyLabel
                    ? _value.replyLabel
                    : replyLabel // ignore: cast_nullable_to_non_nullable
                        as String,
            replies:
                null == replies
                    ? _value.replies
                    : replies // ignore: cast_nullable_to_non_nullable
                        as List<QaReply>,
          )
          as $Val,
    );
  }

  /// Create a copy of QaPost
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $QaAuthorCopyWith<$Res> get author {
    return $QaAuthorCopyWith<$Res>(_value.author, (value) {
      return _then(_value.copyWith(author: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$QaPostImplCopyWith<$Res> implements $QaPostCopyWith<$Res> {
  factory _$$QaPostImplCopyWith(
    _$QaPostImpl value,
    $Res Function(_$QaPostImpl) then,
  ) = __$$QaPostImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    String id,
    QaAuthor author,
    String timeAgo,
    String questionText,
    String replyLabel,
    List<QaReply> replies,
  });

  @override
  $QaAuthorCopyWith<$Res> get author;
}

/// @nodoc
class __$$QaPostImplCopyWithImpl<$Res>
    extends _$QaPostCopyWithImpl<$Res, _$QaPostImpl>
    implements _$$QaPostImplCopyWith<$Res> {
  __$$QaPostImplCopyWithImpl(
    _$QaPostImpl _value,
    $Res Function(_$QaPostImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of QaPost
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? author = null,
    Object? timeAgo = null,
    Object? questionText = null,
    Object? replyLabel = null,
    Object? replies = null,
  }) {
    return _then(
      _$QaPostImpl(
        id:
            null == id
                ? _value.id
                : id // ignore: cast_nullable_to_non_nullable
                    as String,
        author:
            null == author
                ? _value.author
                : author // ignore: cast_nullable_to_non_nullable
                    as QaAuthor,
        timeAgo:
            null == timeAgo
                ? _value.timeAgo
                : timeAgo // ignore: cast_nullable_to_non_nullable
                    as String,
        questionText:
            null == questionText
                ? _value.questionText
                : questionText // ignore: cast_nullable_to_non_nullable
                    as String,
        replyLabel:
            null == replyLabel
                ? _value.replyLabel
                : replyLabel // ignore: cast_nullable_to_non_nullable
                    as String,
        replies:
            null == replies
                ? _value._replies
                : replies // ignore: cast_nullable_to_non_nullable
                    as List<QaReply>,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$QaPostImpl implements _QaPost {
  const _$QaPostImpl({
    required this.id,
    required this.author,
    required this.timeAgo,
    required this.questionText,
    this.replyLabel = 'Reply',
    final List<QaReply> replies = const [],
  }) : _replies = replies;

  factory _$QaPostImpl.fromJson(Map<String, dynamic> json) =>
      _$$QaPostImplFromJson(json);

  @override
  final String id;
  @override
  final QaAuthor author;
  @override
  final String timeAgo;
  @override
  final String questionText;
  @override
  @JsonKey()
  final String replyLabel;
  final List<QaReply> _replies;
  @override
  @JsonKey()
  List<QaReply> get replies {
    if (_replies is EqualUnmodifiableListView) return _replies;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_replies);
  }

  @override
  String toString() {
    return 'QaPost(id: $id, author: $author, timeAgo: $timeAgo, questionText: $questionText, replyLabel: $replyLabel, replies: $replies)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$QaPostImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.author, author) || other.author == author) &&
            (identical(other.timeAgo, timeAgo) || other.timeAgo == timeAgo) &&
            (identical(other.questionText, questionText) ||
                other.questionText == questionText) &&
            (identical(other.replyLabel, replyLabel) ||
                other.replyLabel == replyLabel) &&
            const DeepCollectionEquality().equals(other._replies, _replies));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
    runtimeType,
    id,
    author,
    timeAgo,
    questionText,
    replyLabel,
    const DeepCollectionEquality().hash(_replies),
  );

  /// Create a copy of QaPost
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$QaPostImplCopyWith<_$QaPostImpl> get copyWith =>
      __$$QaPostImplCopyWithImpl<_$QaPostImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$QaPostImplToJson(this);
  }
}

abstract class _QaPost implements QaPost {
  const factory _QaPost({
    required final String id,
    required final QaAuthor author,
    required final String timeAgo,
    required final String questionText,
    final String replyLabel,
    final List<QaReply> replies,
  }) = _$QaPostImpl;

  factory _QaPost.fromJson(Map<String, dynamic> json) = _$QaPostImpl.fromJson;

  @override
  String get id;
  @override
  QaAuthor get author;
  @override
  String get timeAgo;
  @override
  String get questionText;
  @override
  String get replyLabel;
  @override
  List<QaReply> get replies;

  /// Create a copy of QaPost
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$QaPostImplCopyWith<_$QaPostImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

WorkshopQaData _$WorkshopQaDataFromJson(Map<String, dynamic> json) {
  return _WorkshopQaData.fromJson(json);
}

/// @nodoc
mixin _$WorkshopQaData {
  String get heading => throw _privateConstructorUsedError;
  String get promptText => throw _privateConstructorUsedError;
  String get inputPlaceholder => throw _privateConstructorUsedError;
  String get submitLabel => throw _privateConstructorUsedError;
  String get communityHeading => throw _privateConstructorUsedError;
  List<QaPost> get posts => throw _privateConstructorUsedError;

  /// Serializes this WorkshopQaData to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of WorkshopQaData
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $WorkshopQaDataCopyWith<WorkshopQaData> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $WorkshopQaDataCopyWith<$Res> {
  factory $WorkshopQaDataCopyWith(
    WorkshopQaData value,
    $Res Function(WorkshopQaData) then,
  ) = _$WorkshopQaDataCopyWithImpl<$Res, WorkshopQaData>;
  @useResult
  $Res call({
    String heading,
    String promptText,
    String inputPlaceholder,
    String submitLabel,
    String communityHeading,
    List<QaPost> posts,
  });
}

/// @nodoc
class _$WorkshopQaDataCopyWithImpl<$Res, $Val extends WorkshopQaData>
    implements $WorkshopQaDataCopyWith<$Res> {
  _$WorkshopQaDataCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of WorkshopQaData
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? heading = null,
    Object? promptText = null,
    Object? inputPlaceholder = null,
    Object? submitLabel = null,
    Object? communityHeading = null,
    Object? posts = null,
  }) {
    return _then(
      _value.copyWith(
            heading:
                null == heading
                    ? _value.heading
                    : heading // ignore: cast_nullable_to_non_nullable
                        as String,
            promptText:
                null == promptText
                    ? _value.promptText
                    : promptText // ignore: cast_nullable_to_non_nullable
                        as String,
            inputPlaceholder:
                null == inputPlaceholder
                    ? _value.inputPlaceholder
                    : inputPlaceholder // ignore: cast_nullable_to_non_nullable
                        as String,
            submitLabel:
                null == submitLabel
                    ? _value.submitLabel
                    : submitLabel // ignore: cast_nullable_to_non_nullable
                        as String,
            communityHeading:
                null == communityHeading
                    ? _value.communityHeading
                    : communityHeading // ignore: cast_nullable_to_non_nullable
                        as String,
            posts:
                null == posts
                    ? _value.posts
                    : posts // ignore: cast_nullable_to_non_nullable
                        as List<QaPost>,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$WorkshopQaDataImplCopyWith<$Res>
    implements $WorkshopQaDataCopyWith<$Res> {
  factory _$$WorkshopQaDataImplCopyWith(
    _$WorkshopQaDataImpl value,
    $Res Function(_$WorkshopQaDataImpl) then,
  ) = __$$WorkshopQaDataImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    String heading,
    String promptText,
    String inputPlaceholder,
    String submitLabel,
    String communityHeading,
    List<QaPost> posts,
  });
}

/// @nodoc
class __$$WorkshopQaDataImplCopyWithImpl<$Res>
    extends _$WorkshopQaDataCopyWithImpl<$Res, _$WorkshopQaDataImpl>
    implements _$$WorkshopQaDataImplCopyWith<$Res> {
  __$$WorkshopQaDataImplCopyWithImpl(
    _$WorkshopQaDataImpl _value,
    $Res Function(_$WorkshopQaDataImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of WorkshopQaData
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? heading = null,
    Object? promptText = null,
    Object? inputPlaceholder = null,
    Object? submitLabel = null,
    Object? communityHeading = null,
    Object? posts = null,
  }) {
    return _then(
      _$WorkshopQaDataImpl(
        heading:
            null == heading
                ? _value.heading
                : heading // ignore: cast_nullable_to_non_nullable
                    as String,
        promptText:
            null == promptText
                ? _value.promptText
                : promptText // ignore: cast_nullable_to_non_nullable
                    as String,
        inputPlaceholder:
            null == inputPlaceholder
                ? _value.inputPlaceholder
                : inputPlaceholder // ignore: cast_nullable_to_non_nullable
                    as String,
        submitLabel:
            null == submitLabel
                ? _value.submitLabel
                : submitLabel // ignore: cast_nullable_to_non_nullable
                    as String,
        communityHeading:
            null == communityHeading
                ? _value.communityHeading
                : communityHeading // ignore: cast_nullable_to_non_nullable
                    as String,
        posts:
            null == posts
                ? _value._posts
                : posts // ignore: cast_nullable_to_non_nullable
                    as List<QaPost>,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$WorkshopQaDataImpl implements _WorkshopQaData {
  const _$WorkshopQaDataImpl({
    this.heading = 'Do you have any questions?',
    this.promptText = '',
    this.inputPlaceholder = 'Type your question here...',
    this.submitLabel = 'Ask Now',
    this.communityHeading = 'Community Questions',
    final List<QaPost> posts = const [],
  }) : _posts = posts;

  factory _$WorkshopQaDataImpl.fromJson(Map<String, dynamic> json) =>
      _$$WorkshopQaDataImplFromJson(json);

  @override
  @JsonKey()
  final String heading;
  @override
  @JsonKey()
  final String promptText;
  @override
  @JsonKey()
  final String inputPlaceholder;
  @override
  @JsonKey()
  final String submitLabel;
  @override
  @JsonKey()
  final String communityHeading;
  final List<QaPost> _posts;
  @override
  @JsonKey()
  List<QaPost> get posts {
    if (_posts is EqualUnmodifiableListView) return _posts;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_posts);
  }

  @override
  String toString() {
    return 'WorkshopQaData(heading: $heading, promptText: $promptText, inputPlaceholder: $inputPlaceholder, submitLabel: $submitLabel, communityHeading: $communityHeading, posts: $posts)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$WorkshopQaDataImpl &&
            (identical(other.heading, heading) || other.heading == heading) &&
            (identical(other.promptText, promptText) ||
                other.promptText == promptText) &&
            (identical(other.inputPlaceholder, inputPlaceholder) ||
                other.inputPlaceholder == inputPlaceholder) &&
            (identical(other.submitLabel, submitLabel) ||
                other.submitLabel == submitLabel) &&
            (identical(other.communityHeading, communityHeading) ||
                other.communityHeading == communityHeading) &&
            const DeepCollectionEquality().equals(other._posts, _posts));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
    runtimeType,
    heading,
    promptText,
    inputPlaceholder,
    submitLabel,
    communityHeading,
    const DeepCollectionEquality().hash(_posts),
  );

  /// Create a copy of WorkshopQaData
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$WorkshopQaDataImplCopyWith<_$WorkshopQaDataImpl> get copyWith =>
      __$$WorkshopQaDataImplCopyWithImpl<_$WorkshopQaDataImpl>(
        this,
        _$identity,
      );

  @override
  Map<String, dynamic> toJson() {
    return _$$WorkshopQaDataImplToJson(this);
  }
}

abstract class _WorkshopQaData implements WorkshopQaData {
  const factory _WorkshopQaData({
    final String heading,
    final String promptText,
    final String inputPlaceholder,
    final String submitLabel,
    final String communityHeading,
    final List<QaPost> posts,
  }) = _$WorkshopQaDataImpl;

  factory _WorkshopQaData.fromJson(Map<String, dynamic> json) =
      _$WorkshopQaDataImpl.fromJson;

  @override
  String get heading;
  @override
  String get promptText;
  @override
  String get inputPlaceholder;
  @override
  String get submitLabel;
  @override
  String get communityHeading;
  @override
  List<QaPost> get posts;

  /// Create a copy of WorkshopQaData
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$WorkshopQaDataImplCopyWith<_$WorkshopQaDataImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

AssignmentSubmission _$AssignmentSubmissionFromJson(Map<String, dynamic> json) {
  return _AssignmentSubmission.fromJson(json);
}

/// @nodoc
mixin _$AssignmentSubmission {
  bool get isSubmitted => throw _privateConstructorUsedError;
  String? get submittedAt => throw _privateConstructorUsedError;
  String? get answerText => throw _privateConstructorUsedError;
  String? get imageUrl => throw _privateConstructorUsedError;
  String? get fileUrl => throw _privateConstructorUsedError;
  String? get videoId => throw _privateConstructorUsedError;
  String? get videoUrl => throw _privateConstructorUsedError;

  /// Serializes this AssignmentSubmission to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of AssignmentSubmission
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $AssignmentSubmissionCopyWith<AssignmentSubmission> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $AssignmentSubmissionCopyWith<$Res> {
  factory $AssignmentSubmissionCopyWith(
    AssignmentSubmission value,
    $Res Function(AssignmentSubmission) then,
  ) = _$AssignmentSubmissionCopyWithImpl<$Res, AssignmentSubmission>;
  @useResult
  $Res call({
    bool isSubmitted,
    String? submittedAt,
    String? answerText,
    String? imageUrl,
    String? fileUrl,
    String? videoId,
    String? videoUrl,
  });
}

/// @nodoc
class _$AssignmentSubmissionCopyWithImpl<
  $Res,
  $Val extends AssignmentSubmission
>
    implements $AssignmentSubmissionCopyWith<$Res> {
  _$AssignmentSubmissionCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of AssignmentSubmission
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? isSubmitted = null,
    Object? submittedAt = freezed,
    Object? answerText = freezed,
    Object? imageUrl = freezed,
    Object? fileUrl = freezed,
    Object? videoId = freezed,
    Object? videoUrl = freezed,
  }) {
    return _then(
      _value.copyWith(
            isSubmitted:
                null == isSubmitted
                    ? _value.isSubmitted
                    : isSubmitted // ignore: cast_nullable_to_non_nullable
                        as bool,
            submittedAt:
                freezed == submittedAt
                    ? _value.submittedAt
                    : submittedAt // ignore: cast_nullable_to_non_nullable
                        as String?,
            answerText:
                freezed == answerText
                    ? _value.answerText
                    : answerText // ignore: cast_nullable_to_non_nullable
                        as String?,
            imageUrl:
                freezed == imageUrl
                    ? _value.imageUrl
                    : imageUrl // ignore: cast_nullable_to_non_nullable
                        as String?,
            fileUrl:
                freezed == fileUrl
                    ? _value.fileUrl
                    : fileUrl // ignore: cast_nullable_to_non_nullable
                        as String?,
            videoId:
                freezed == videoId
                    ? _value.videoId
                    : videoId // ignore: cast_nullable_to_non_nullable
                        as String?,
            videoUrl:
                freezed == videoUrl
                    ? _value.videoUrl
                    : videoUrl // ignore: cast_nullable_to_non_nullable
                        as String?,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$AssignmentSubmissionImplCopyWith<$Res>
    implements $AssignmentSubmissionCopyWith<$Res> {
  factory _$$AssignmentSubmissionImplCopyWith(
    _$AssignmentSubmissionImpl value,
    $Res Function(_$AssignmentSubmissionImpl) then,
  ) = __$$AssignmentSubmissionImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    bool isSubmitted,
    String? submittedAt,
    String? answerText,
    String? imageUrl,
    String? fileUrl,
    String? videoId,
    String? videoUrl,
  });
}

/// @nodoc
class __$$AssignmentSubmissionImplCopyWithImpl<$Res>
    extends _$AssignmentSubmissionCopyWithImpl<$Res, _$AssignmentSubmissionImpl>
    implements _$$AssignmentSubmissionImplCopyWith<$Res> {
  __$$AssignmentSubmissionImplCopyWithImpl(
    _$AssignmentSubmissionImpl _value,
    $Res Function(_$AssignmentSubmissionImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of AssignmentSubmission
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? isSubmitted = null,
    Object? submittedAt = freezed,
    Object? answerText = freezed,
    Object? imageUrl = freezed,
    Object? fileUrl = freezed,
    Object? videoId = freezed,
    Object? videoUrl = freezed,
  }) {
    return _then(
      _$AssignmentSubmissionImpl(
        isSubmitted:
            null == isSubmitted
                ? _value.isSubmitted
                : isSubmitted // ignore: cast_nullable_to_non_nullable
                    as bool,
        submittedAt:
            freezed == submittedAt
                ? _value.submittedAt
                : submittedAt // ignore: cast_nullable_to_non_nullable
                    as String?,
        answerText:
            freezed == answerText
                ? _value.answerText
                : answerText // ignore: cast_nullable_to_non_nullable
                    as String?,
        imageUrl:
            freezed == imageUrl
                ? _value.imageUrl
                : imageUrl // ignore: cast_nullable_to_non_nullable
                    as String?,
        fileUrl:
            freezed == fileUrl
                ? _value.fileUrl
                : fileUrl // ignore: cast_nullable_to_non_nullable
                    as String?,
        videoId:
            freezed == videoId
                ? _value.videoId
                : videoId // ignore: cast_nullable_to_non_nullable
                    as String?,
        videoUrl:
            freezed == videoUrl
                ? _value.videoUrl
                : videoUrl // ignore: cast_nullable_to_non_nullable
                    as String?,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$AssignmentSubmissionImpl implements _AssignmentSubmission {
  const _$AssignmentSubmissionImpl({
    this.isSubmitted = false,
    this.submittedAt,
    this.answerText,
    this.imageUrl,
    this.fileUrl,
    this.videoId,
    this.videoUrl,
  });

  factory _$AssignmentSubmissionImpl.fromJson(Map<String, dynamic> json) =>
      _$$AssignmentSubmissionImplFromJson(json);

  @override
  @JsonKey()
  final bool isSubmitted;
  @override
  final String? submittedAt;
  @override
  final String? answerText;
  @override
  final String? imageUrl;
  @override
  final String? fileUrl;
  @override
  final String? videoId;
  @override
  final String? videoUrl;

  @override
  String toString() {
    return 'AssignmentSubmission(isSubmitted: $isSubmitted, submittedAt: $submittedAt, answerText: $answerText, imageUrl: $imageUrl, fileUrl: $fileUrl, videoId: $videoId, videoUrl: $videoUrl)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$AssignmentSubmissionImpl &&
            (identical(other.isSubmitted, isSubmitted) ||
                other.isSubmitted == isSubmitted) &&
            (identical(other.submittedAt, submittedAt) ||
                other.submittedAt == submittedAt) &&
            (identical(other.answerText, answerText) ||
                other.answerText == answerText) &&
            (identical(other.imageUrl, imageUrl) ||
                other.imageUrl == imageUrl) &&
            (identical(other.fileUrl, fileUrl) || other.fileUrl == fileUrl) &&
            (identical(other.videoId, videoId) || other.videoId == videoId) &&
            (identical(other.videoUrl, videoUrl) ||
                other.videoUrl == videoUrl));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
    runtimeType,
    isSubmitted,
    submittedAt,
    answerText,
    imageUrl,
    fileUrl,
    videoId,
    videoUrl,
  );

  /// Create a copy of AssignmentSubmission
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$AssignmentSubmissionImplCopyWith<_$AssignmentSubmissionImpl>
  get copyWith =>
      __$$AssignmentSubmissionImplCopyWithImpl<_$AssignmentSubmissionImpl>(
        this,
        _$identity,
      );

  @override
  Map<String, dynamic> toJson() {
    return _$$AssignmentSubmissionImplToJson(this);
  }
}

abstract class _AssignmentSubmission implements AssignmentSubmission {
  const factory _AssignmentSubmission({
    final bool isSubmitted,
    final String? submittedAt,
    final String? answerText,
    final String? imageUrl,
    final String? fileUrl,
    final String? videoId,
    final String? videoUrl,
  }) = _$AssignmentSubmissionImpl;

  factory _AssignmentSubmission.fromJson(Map<String, dynamic> json) =
      _$AssignmentSubmissionImpl.fromJson;

  @override
  bool get isSubmitted;
  @override
  String? get submittedAt;
  @override
  String? get answerText;
  @override
  String? get imageUrl;
  @override
  String? get fileUrl;
  @override
  String? get videoId;
  @override
  String? get videoUrl;

  /// Create a copy of AssignmentSubmission
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$AssignmentSubmissionImplCopyWith<_$AssignmentSubmissionImpl>
  get copyWith => throw _privateConstructorUsedError;
}

WorkshopAssignment _$WorkshopAssignmentFromJson(Map<String, dynamic> json) {
  return _WorkshopAssignment.fromJson(json);
}

/// @nodoc
mixin _$WorkshopAssignment {
  String get id => throw _privateConstructorUsedError;
  String get title => throw _privateConstructorUsedError;
  String get assignmentType => throw _privateConstructorUsedError;
  String? get questionText => throw _privateConstructorUsedError;
  bool get canEdit => throw _privateConstructorUsedError;
  String get ctaLabel => throw _privateConstructorUsedError;
  String get submitLabel => throw _privateConstructorUsedError;
  String get cancelLabel => throw _privateConstructorUsedError;
  AssignmentSubmission? get submission => throw _privateConstructorUsedError;

  /// Serializes this WorkshopAssignment to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of WorkshopAssignment
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $WorkshopAssignmentCopyWith<WorkshopAssignment> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $WorkshopAssignmentCopyWith<$Res> {
  factory $WorkshopAssignmentCopyWith(
    WorkshopAssignment value,
    $Res Function(WorkshopAssignment) then,
  ) = _$WorkshopAssignmentCopyWithImpl<$Res, WorkshopAssignment>;
  @useResult
  $Res call({
    String id,
    String title,
    String assignmentType,
    String? questionText,
    bool canEdit,
    String ctaLabel,
    String submitLabel,
    String cancelLabel,
    AssignmentSubmission? submission,
  });

  $AssignmentSubmissionCopyWith<$Res>? get submission;
}

/// @nodoc
class _$WorkshopAssignmentCopyWithImpl<$Res, $Val extends WorkshopAssignment>
    implements $WorkshopAssignmentCopyWith<$Res> {
  _$WorkshopAssignmentCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of WorkshopAssignment
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? title = null,
    Object? assignmentType = null,
    Object? questionText = freezed,
    Object? canEdit = null,
    Object? ctaLabel = null,
    Object? submitLabel = null,
    Object? cancelLabel = null,
    Object? submission = freezed,
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
            assignmentType:
                null == assignmentType
                    ? _value.assignmentType
                    : assignmentType // ignore: cast_nullable_to_non_nullable
                        as String,
            questionText:
                freezed == questionText
                    ? _value.questionText
                    : questionText // ignore: cast_nullable_to_non_nullable
                        as String?,
            canEdit:
                null == canEdit
                    ? _value.canEdit
                    : canEdit // ignore: cast_nullable_to_non_nullable
                        as bool,
            ctaLabel:
                null == ctaLabel
                    ? _value.ctaLabel
                    : ctaLabel // ignore: cast_nullable_to_non_nullable
                        as String,
            submitLabel:
                null == submitLabel
                    ? _value.submitLabel
                    : submitLabel // ignore: cast_nullable_to_non_nullable
                        as String,
            cancelLabel:
                null == cancelLabel
                    ? _value.cancelLabel
                    : cancelLabel // ignore: cast_nullable_to_non_nullable
                        as String,
            submission:
                freezed == submission
                    ? _value.submission
                    : submission // ignore: cast_nullable_to_non_nullable
                        as AssignmentSubmission?,
          )
          as $Val,
    );
  }

  /// Create a copy of WorkshopAssignment
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $AssignmentSubmissionCopyWith<$Res>? get submission {
    if (_value.submission == null) {
      return null;
    }

    return $AssignmentSubmissionCopyWith<$Res>(_value.submission!, (value) {
      return _then(_value.copyWith(submission: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$WorkshopAssignmentImplCopyWith<$Res>
    implements $WorkshopAssignmentCopyWith<$Res> {
  factory _$$WorkshopAssignmentImplCopyWith(
    _$WorkshopAssignmentImpl value,
    $Res Function(_$WorkshopAssignmentImpl) then,
  ) = __$$WorkshopAssignmentImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    String id,
    String title,
    String assignmentType,
    String? questionText,
    bool canEdit,
    String ctaLabel,
    String submitLabel,
    String cancelLabel,
    AssignmentSubmission? submission,
  });

  @override
  $AssignmentSubmissionCopyWith<$Res>? get submission;
}

/// @nodoc
class __$$WorkshopAssignmentImplCopyWithImpl<$Res>
    extends _$WorkshopAssignmentCopyWithImpl<$Res, _$WorkshopAssignmentImpl>
    implements _$$WorkshopAssignmentImplCopyWith<$Res> {
  __$$WorkshopAssignmentImplCopyWithImpl(
    _$WorkshopAssignmentImpl _value,
    $Res Function(_$WorkshopAssignmentImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of WorkshopAssignment
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? title = null,
    Object? assignmentType = null,
    Object? questionText = freezed,
    Object? canEdit = null,
    Object? ctaLabel = null,
    Object? submitLabel = null,
    Object? cancelLabel = null,
    Object? submission = freezed,
  }) {
    return _then(
      _$WorkshopAssignmentImpl(
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
        assignmentType:
            null == assignmentType
                ? _value.assignmentType
                : assignmentType // ignore: cast_nullable_to_non_nullable
                    as String,
        questionText:
            freezed == questionText
                ? _value.questionText
                : questionText // ignore: cast_nullable_to_non_nullable
                    as String?,
        canEdit:
            null == canEdit
                ? _value.canEdit
                : canEdit // ignore: cast_nullable_to_non_nullable
                    as bool,
        ctaLabel:
            null == ctaLabel
                ? _value.ctaLabel
                : ctaLabel // ignore: cast_nullable_to_non_nullable
                    as String,
        submitLabel:
            null == submitLabel
                ? _value.submitLabel
                : submitLabel // ignore: cast_nullable_to_non_nullable
                    as String,
        cancelLabel:
            null == cancelLabel
                ? _value.cancelLabel
                : cancelLabel // ignore: cast_nullable_to_non_nullable
                    as String,
        submission:
            freezed == submission
                ? _value.submission
                : submission // ignore: cast_nullable_to_non_nullable
                    as AssignmentSubmission?,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$WorkshopAssignmentImpl implements _WorkshopAssignment {
  const _$WorkshopAssignmentImpl({
    required this.id,
    required this.title,
    this.assignmentType = 'qa',
    this.questionText,
    this.canEdit = true,
    this.ctaLabel = 'Answer',
    this.submitLabel = 'Submit',
    this.cancelLabel = 'Cancel',
    this.submission,
  });

  factory _$WorkshopAssignmentImpl.fromJson(Map<String, dynamic> json) =>
      _$$WorkshopAssignmentImplFromJson(json);

  @override
  final String id;
  @override
  final String title;
  @override
  @JsonKey()
  final String assignmentType;
  @override
  final String? questionText;
  @override
  @JsonKey()
  final bool canEdit;
  @override
  @JsonKey()
  final String ctaLabel;
  @override
  @JsonKey()
  final String submitLabel;
  @override
  @JsonKey()
  final String cancelLabel;
  @override
  final AssignmentSubmission? submission;

  @override
  String toString() {
    return 'WorkshopAssignment(id: $id, title: $title, assignmentType: $assignmentType, questionText: $questionText, canEdit: $canEdit, ctaLabel: $ctaLabel, submitLabel: $submitLabel, cancelLabel: $cancelLabel, submission: $submission)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$WorkshopAssignmentImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.title, title) || other.title == title) &&
            (identical(other.assignmentType, assignmentType) ||
                other.assignmentType == assignmentType) &&
            (identical(other.questionText, questionText) ||
                other.questionText == questionText) &&
            (identical(other.canEdit, canEdit) || other.canEdit == canEdit) &&
            (identical(other.ctaLabel, ctaLabel) ||
                other.ctaLabel == ctaLabel) &&
            (identical(other.submitLabel, submitLabel) ||
                other.submitLabel == submitLabel) &&
            (identical(other.cancelLabel, cancelLabel) ||
                other.cancelLabel == cancelLabel) &&
            (identical(other.submission, submission) ||
                other.submission == submission));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
    runtimeType,
    id,
    title,
    assignmentType,
    questionText,
    canEdit,
    ctaLabel,
    submitLabel,
    cancelLabel,
    submission,
  );

  /// Create a copy of WorkshopAssignment
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$WorkshopAssignmentImplCopyWith<_$WorkshopAssignmentImpl> get copyWith =>
      __$$WorkshopAssignmentImplCopyWithImpl<_$WorkshopAssignmentImpl>(
        this,
        _$identity,
      );

  @override
  Map<String, dynamic> toJson() {
    return _$$WorkshopAssignmentImplToJson(this);
  }
}

abstract class _WorkshopAssignment implements WorkshopAssignment {
  const factory _WorkshopAssignment({
    required final String id,
    required final String title,
    final String assignmentType,
    final String? questionText,
    final bool canEdit,
    final String ctaLabel,
    final String submitLabel,
    final String cancelLabel,
    final AssignmentSubmission? submission,
  }) = _$WorkshopAssignmentImpl;

  factory _WorkshopAssignment.fromJson(Map<String, dynamic> json) =
      _$WorkshopAssignmentImpl.fromJson;

  @override
  String get id;
  @override
  String get title;
  @override
  String get assignmentType;
  @override
  String? get questionText;
  @override
  bool get canEdit;
  @override
  String get ctaLabel;
  @override
  String get submitLabel;
  @override
  String get cancelLabel;
  @override
  AssignmentSubmission? get submission;

  /// Create a copy of WorkshopAssignment
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$WorkshopAssignmentImplCopyWith<_$WorkshopAssignmentImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

AssignmentGroup _$AssignmentGroupFromJson(Map<String, dynamic> json) {
  return _AssignmentGroup.fromJson(json);
}

/// @nodoc
mixin _$AssignmentGroup {
  String get challengeLabel => throw _privateConstructorUsedError;
  String get challengeTitle => throw _privateConstructorUsedError;
  List<WorkshopAssignment> get assignments =>
      throw _privateConstructorUsedError;

  /// Serializes this AssignmentGroup to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of AssignmentGroup
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $AssignmentGroupCopyWith<AssignmentGroup> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $AssignmentGroupCopyWith<$Res> {
  factory $AssignmentGroupCopyWith(
    AssignmentGroup value,
    $Res Function(AssignmentGroup) then,
  ) = _$AssignmentGroupCopyWithImpl<$Res, AssignmentGroup>;
  @useResult
  $Res call({
    String challengeLabel,
    String challengeTitle,
    List<WorkshopAssignment> assignments,
  });
}

/// @nodoc
class _$AssignmentGroupCopyWithImpl<$Res, $Val extends AssignmentGroup>
    implements $AssignmentGroupCopyWith<$Res> {
  _$AssignmentGroupCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of AssignmentGroup
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? challengeLabel = null,
    Object? challengeTitle = null,
    Object? assignments = null,
  }) {
    return _then(
      _value.copyWith(
            challengeLabel:
                null == challengeLabel
                    ? _value.challengeLabel
                    : challengeLabel // ignore: cast_nullable_to_non_nullable
                        as String,
            challengeTitle:
                null == challengeTitle
                    ? _value.challengeTitle
                    : challengeTitle // ignore: cast_nullable_to_non_nullable
                        as String,
            assignments:
                null == assignments
                    ? _value.assignments
                    : assignments // ignore: cast_nullable_to_non_nullable
                        as List<WorkshopAssignment>,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$AssignmentGroupImplCopyWith<$Res>
    implements $AssignmentGroupCopyWith<$Res> {
  factory _$$AssignmentGroupImplCopyWith(
    _$AssignmentGroupImpl value,
    $Res Function(_$AssignmentGroupImpl) then,
  ) = __$$AssignmentGroupImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    String challengeLabel,
    String challengeTitle,
    List<WorkshopAssignment> assignments,
  });
}

/// @nodoc
class __$$AssignmentGroupImplCopyWithImpl<$Res>
    extends _$AssignmentGroupCopyWithImpl<$Res, _$AssignmentGroupImpl>
    implements _$$AssignmentGroupImplCopyWith<$Res> {
  __$$AssignmentGroupImplCopyWithImpl(
    _$AssignmentGroupImpl _value,
    $Res Function(_$AssignmentGroupImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of AssignmentGroup
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? challengeLabel = null,
    Object? challengeTitle = null,
    Object? assignments = null,
  }) {
    return _then(
      _$AssignmentGroupImpl(
        challengeLabel:
            null == challengeLabel
                ? _value.challengeLabel
                : challengeLabel // ignore: cast_nullable_to_non_nullable
                    as String,
        challengeTitle:
            null == challengeTitle
                ? _value.challengeTitle
                : challengeTitle // ignore: cast_nullable_to_non_nullable
                    as String,
        assignments:
            null == assignments
                ? _value._assignments
                : assignments // ignore: cast_nullable_to_non_nullable
                    as List<WorkshopAssignment>,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$AssignmentGroupImpl implements _AssignmentGroup {
  const _$AssignmentGroupImpl({
    required this.challengeLabel,
    required this.challengeTitle,
    final List<WorkshopAssignment> assignments = const [],
  }) : _assignments = assignments;

  factory _$AssignmentGroupImpl.fromJson(Map<String, dynamic> json) =>
      _$$AssignmentGroupImplFromJson(json);

  @override
  final String challengeLabel;
  @override
  final String challengeTitle;
  final List<WorkshopAssignment> _assignments;
  @override
  @JsonKey()
  List<WorkshopAssignment> get assignments {
    if (_assignments is EqualUnmodifiableListView) return _assignments;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_assignments);
  }

  @override
  String toString() {
    return 'AssignmentGroup(challengeLabel: $challengeLabel, challengeTitle: $challengeTitle, assignments: $assignments)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$AssignmentGroupImpl &&
            (identical(other.challengeLabel, challengeLabel) ||
                other.challengeLabel == challengeLabel) &&
            (identical(other.challengeTitle, challengeTitle) ||
                other.challengeTitle == challengeTitle) &&
            const DeepCollectionEquality().equals(
              other._assignments,
              _assignments,
            ));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
    runtimeType,
    challengeLabel,
    challengeTitle,
    const DeepCollectionEquality().hash(_assignments),
  );

  /// Create a copy of AssignmentGroup
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$AssignmentGroupImplCopyWith<_$AssignmentGroupImpl> get copyWith =>
      __$$AssignmentGroupImplCopyWithImpl<_$AssignmentGroupImpl>(
        this,
        _$identity,
      );

  @override
  Map<String, dynamic> toJson() {
    return _$$AssignmentGroupImplToJson(this);
  }
}

abstract class _AssignmentGroup implements AssignmentGroup {
  const factory _AssignmentGroup({
    required final String challengeLabel,
    required final String challengeTitle,
    final List<WorkshopAssignment> assignments,
  }) = _$AssignmentGroupImpl;

  factory _AssignmentGroup.fromJson(Map<String, dynamic> json) =
      _$AssignmentGroupImpl.fromJson;

  @override
  String get challengeLabel;
  @override
  String get challengeTitle;
  @override
  List<WorkshopAssignment> get assignments;

  /// Create a copy of AssignmentGroup
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$AssignmentGroupImplCopyWith<_$AssignmentGroupImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

WorkshopDetail _$WorkshopDetailFromJson(Map<String, dynamic> json) {
  return _WorkshopDetail.fromJson(json);
}

/// @nodoc
mixin _$WorkshopDetail {
  String get id => throw _privateConstructorUsedError;
  String get title => throw _privateConstructorUsedError;
  String? get description => throw _privateConstructorUsedError;
  String? get thumbnailUrl => throw _privateConstructorUsedError;
  String? get enrollmentStatus => throw _privateConstructorUsedError;
  String? get backLabel => throw _privateConstructorUsedError;
  String? get backUrl => throw _privateConstructorUsedError;
  String? get workshopFlowLabel => throw _privateConstructorUsedError;
  WorkshopProgress? get learningProgress =>
      throw _privateConstructorUsedError; // Kept as map — fields consumed directly in CC-26+
  @JsonKey(name: 'certificate')
  Map<String, dynamic>? get certificate => throw _privateConstructorUsedError; // Raw pass-through: backend returns `sidebar.tabs: [{ id, label, order }]`
  // (see backend workshop detail handler). Used to override the default
  // tab labels (Q&A, Assignments, etc.) at render time.
  @JsonKey(name: 'sidebar')
  Map<String, dynamic>? get sidebar => throw _privateConstructorUsedError;

  /// Serializes this WorkshopDetail to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of WorkshopDetail
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $WorkshopDetailCopyWith<WorkshopDetail> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $WorkshopDetailCopyWith<$Res> {
  factory $WorkshopDetailCopyWith(
    WorkshopDetail value,
    $Res Function(WorkshopDetail) then,
  ) = _$WorkshopDetailCopyWithImpl<$Res, WorkshopDetail>;
  @useResult
  $Res call({
    String id,
    String title,
    String? description,
    String? thumbnailUrl,
    String? enrollmentStatus,
    String? backLabel,
    String? backUrl,
    String? workshopFlowLabel,
    WorkshopProgress? learningProgress,
    @JsonKey(name: 'certificate') Map<String, dynamic>? certificate,
    @JsonKey(name: 'sidebar') Map<String, dynamic>? sidebar,
  });

  $WorkshopProgressCopyWith<$Res>? get learningProgress;
}

/// @nodoc
class _$WorkshopDetailCopyWithImpl<$Res, $Val extends WorkshopDetail>
    implements $WorkshopDetailCopyWith<$Res> {
  _$WorkshopDetailCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of WorkshopDetail
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? title = null,
    Object? description = freezed,
    Object? thumbnailUrl = freezed,
    Object? enrollmentStatus = freezed,
    Object? backLabel = freezed,
    Object? backUrl = freezed,
    Object? workshopFlowLabel = freezed,
    Object? learningProgress = freezed,
    Object? certificate = freezed,
    Object? sidebar = freezed,
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
            thumbnailUrl:
                freezed == thumbnailUrl
                    ? _value.thumbnailUrl
                    : thumbnailUrl // ignore: cast_nullable_to_non_nullable
                        as String?,
            enrollmentStatus:
                freezed == enrollmentStatus
                    ? _value.enrollmentStatus
                    : enrollmentStatus // ignore: cast_nullable_to_non_nullable
                        as String?,
            backLabel:
                freezed == backLabel
                    ? _value.backLabel
                    : backLabel // ignore: cast_nullable_to_non_nullable
                        as String?,
            backUrl:
                freezed == backUrl
                    ? _value.backUrl
                    : backUrl // ignore: cast_nullable_to_non_nullable
                        as String?,
            workshopFlowLabel:
                freezed == workshopFlowLabel
                    ? _value.workshopFlowLabel
                    : workshopFlowLabel // ignore: cast_nullable_to_non_nullable
                        as String?,
            learningProgress:
                freezed == learningProgress
                    ? _value.learningProgress
                    : learningProgress // ignore: cast_nullable_to_non_nullable
                        as WorkshopProgress?,
            certificate:
                freezed == certificate
                    ? _value.certificate
                    : certificate // ignore: cast_nullable_to_non_nullable
                        as Map<String, dynamic>?,
            sidebar:
                freezed == sidebar
                    ? _value.sidebar
                    : sidebar // ignore: cast_nullable_to_non_nullable
                        as Map<String, dynamic>?,
          )
          as $Val,
    );
  }

  /// Create a copy of WorkshopDetail
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $WorkshopProgressCopyWith<$Res>? get learningProgress {
    if (_value.learningProgress == null) {
      return null;
    }

    return $WorkshopProgressCopyWith<$Res>(_value.learningProgress!, (value) {
      return _then(_value.copyWith(learningProgress: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$WorkshopDetailImplCopyWith<$Res>
    implements $WorkshopDetailCopyWith<$Res> {
  factory _$$WorkshopDetailImplCopyWith(
    _$WorkshopDetailImpl value,
    $Res Function(_$WorkshopDetailImpl) then,
  ) = __$$WorkshopDetailImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    String id,
    String title,
    String? description,
    String? thumbnailUrl,
    String? enrollmentStatus,
    String? backLabel,
    String? backUrl,
    String? workshopFlowLabel,
    WorkshopProgress? learningProgress,
    @JsonKey(name: 'certificate') Map<String, dynamic>? certificate,
    @JsonKey(name: 'sidebar') Map<String, dynamic>? sidebar,
  });

  @override
  $WorkshopProgressCopyWith<$Res>? get learningProgress;
}

/// @nodoc
class __$$WorkshopDetailImplCopyWithImpl<$Res>
    extends _$WorkshopDetailCopyWithImpl<$Res, _$WorkshopDetailImpl>
    implements _$$WorkshopDetailImplCopyWith<$Res> {
  __$$WorkshopDetailImplCopyWithImpl(
    _$WorkshopDetailImpl _value,
    $Res Function(_$WorkshopDetailImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of WorkshopDetail
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? title = null,
    Object? description = freezed,
    Object? thumbnailUrl = freezed,
    Object? enrollmentStatus = freezed,
    Object? backLabel = freezed,
    Object? backUrl = freezed,
    Object? workshopFlowLabel = freezed,
    Object? learningProgress = freezed,
    Object? certificate = freezed,
    Object? sidebar = freezed,
  }) {
    return _then(
      _$WorkshopDetailImpl(
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
        thumbnailUrl:
            freezed == thumbnailUrl
                ? _value.thumbnailUrl
                : thumbnailUrl // ignore: cast_nullable_to_non_nullable
                    as String?,
        enrollmentStatus:
            freezed == enrollmentStatus
                ? _value.enrollmentStatus
                : enrollmentStatus // ignore: cast_nullable_to_non_nullable
                    as String?,
        backLabel:
            freezed == backLabel
                ? _value.backLabel
                : backLabel // ignore: cast_nullable_to_non_nullable
                    as String?,
        backUrl:
            freezed == backUrl
                ? _value.backUrl
                : backUrl // ignore: cast_nullable_to_non_nullable
                    as String?,
        workshopFlowLabel:
            freezed == workshopFlowLabel
                ? _value.workshopFlowLabel
                : workshopFlowLabel // ignore: cast_nullable_to_non_nullable
                    as String?,
        learningProgress:
            freezed == learningProgress
                ? _value.learningProgress
                : learningProgress // ignore: cast_nullable_to_non_nullable
                    as WorkshopProgress?,
        certificate:
            freezed == certificate
                ? _value._certificate
                : certificate // ignore: cast_nullable_to_non_nullable
                    as Map<String, dynamic>?,
        sidebar:
            freezed == sidebar
                ? _value._sidebar
                : sidebar // ignore: cast_nullable_to_non_nullable
                    as Map<String, dynamic>?,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$WorkshopDetailImpl implements _WorkshopDetail {
  const _$WorkshopDetailImpl({
    required this.id,
    required this.title,
    this.description,
    this.thumbnailUrl,
    this.enrollmentStatus,
    this.backLabel,
    this.backUrl,
    this.workshopFlowLabel,
    this.learningProgress,
    @JsonKey(name: 'certificate') final Map<String, dynamic>? certificate,
    @JsonKey(name: 'sidebar') final Map<String, dynamic>? sidebar,
  }) : _certificate = certificate,
       _sidebar = sidebar;

  factory _$WorkshopDetailImpl.fromJson(Map<String, dynamic> json) =>
      _$$WorkshopDetailImplFromJson(json);

  @override
  final String id;
  @override
  final String title;
  @override
  final String? description;
  @override
  final String? thumbnailUrl;
  @override
  final String? enrollmentStatus;
  @override
  final String? backLabel;
  @override
  final String? backUrl;
  @override
  final String? workshopFlowLabel;
  @override
  final WorkshopProgress? learningProgress;
  // Kept as map — fields consumed directly in CC-26+
  final Map<String, dynamic>? _certificate;
  // Kept as map — fields consumed directly in CC-26+
  @override
  @JsonKey(name: 'certificate')
  Map<String, dynamic>? get certificate {
    final value = _certificate;
    if (value == null) return null;
    if (_certificate is EqualUnmodifiableMapView) return _certificate;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableMapView(value);
  }

  // Raw pass-through: backend returns `sidebar.tabs: [{ id, label, order }]`
  // (see backend workshop detail handler). Used to override the default
  // tab labels (Q&A, Assignments, etc.) at render time.
  final Map<String, dynamic>? _sidebar;
  // Raw pass-through: backend returns `sidebar.tabs: [{ id, label, order }]`
  // (see backend workshop detail handler). Used to override the default
  // tab labels (Q&A, Assignments, etc.) at render time.
  @override
  @JsonKey(name: 'sidebar')
  Map<String, dynamic>? get sidebar {
    final value = _sidebar;
    if (value == null) return null;
    if (_sidebar is EqualUnmodifiableMapView) return _sidebar;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableMapView(value);
  }

  @override
  String toString() {
    return 'WorkshopDetail(id: $id, title: $title, description: $description, thumbnailUrl: $thumbnailUrl, enrollmentStatus: $enrollmentStatus, backLabel: $backLabel, backUrl: $backUrl, workshopFlowLabel: $workshopFlowLabel, learningProgress: $learningProgress, certificate: $certificate, sidebar: $sidebar)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$WorkshopDetailImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.title, title) || other.title == title) &&
            (identical(other.description, description) ||
                other.description == description) &&
            (identical(other.thumbnailUrl, thumbnailUrl) ||
                other.thumbnailUrl == thumbnailUrl) &&
            (identical(other.enrollmentStatus, enrollmentStatus) ||
                other.enrollmentStatus == enrollmentStatus) &&
            (identical(other.backLabel, backLabel) ||
                other.backLabel == backLabel) &&
            (identical(other.backUrl, backUrl) || other.backUrl == backUrl) &&
            (identical(other.workshopFlowLabel, workshopFlowLabel) ||
                other.workshopFlowLabel == workshopFlowLabel) &&
            (identical(other.learningProgress, learningProgress) ||
                other.learningProgress == learningProgress) &&
            const DeepCollectionEquality().equals(
              other._certificate,
              _certificate,
            ) &&
            const DeepCollectionEquality().equals(other._sidebar, _sidebar));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
    runtimeType,
    id,
    title,
    description,
    thumbnailUrl,
    enrollmentStatus,
    backLabel,
    backUrl,
    workshopFlowLabel,
    learningProgress,
    const DeepCollectionEquality().hash(_certificate),
    const DeepCollectionEquality().hash(_sidebar),
  );

  /// Create a copy of WorkshopDetail
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$WorkshopDetailImplCopyWith<_$WorkshopDetailImpl> get copyWith =>
      __$$WorkshopDetailImplCopyWithImpl<_$WorkshopDetailImpl>(
        this,
        _$identity,
      );

  @override
  Map<String, dynamic> toJson() {
    return _$$WorkshopDetailImplToJson(this);
  }
}

abstract class _WorkshopDetail implements WorkshopDetail {
  const factory _WorkshopDetail({
    required final String id,
    required final String title,
    final String? description,
    final String? thumbnailUrl,
    final String? enrollmentStatus,
    final String? backLabel,
    final String? backUrl,
    final String? workshopFlowLabel,
    final WorkshopProgress? learningProgress,
    @JsonKey(name: 'certificate') final Map<String, dynamic>? certificate,
    @JsonKey(name: 'sidebar') final Map<String, dynamic>? sidebar,
  }) = _$WorkshopDetailImpl;

  factory _WorkshopDetail.fromJson(Map<String, dynamic> json) =
      _$WorkshopDetailImpl.fromJson;

  @override
  String get id;
  @override
  String get title;
  @override
  String? get description;
  @override
  String? get thumbnailUrl;
  @override
  String? get enrollmentStatus;
  @override
  String? get backLabel;
  @override
  String? get backUrl;
  @override
  String? get workshopFlowLabel;
  @override
  WorkshopProgress? get learningProgress; // Kept as map — fields consumed directly in CC-26+
  @override
  @JsonKey(name: 'certificate')
  Map<String, dynamic>? get certificate; // Raw pass-through: backend returns `sidebar.tabs: [{ id, label, order }]`
  // (see backend workshop detail handler). Used to override the default
  // tab labels (Q&A, Assignments, etc.) at render time.
  @override
  @JsonKey(name: 'sidebar')
  Map<String, dynamic>? get sidebar;

  /// Create a copy of WorkshopDetail
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$WorkshopDetailImplCopyWith<_$WorkshopDetailImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
