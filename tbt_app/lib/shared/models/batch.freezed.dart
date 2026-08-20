// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'batch.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

BatchTask _$BatchTaskFromJson(Map<String, dynamic> json) {
  return _BatchTask.fromJson(json);
}

/// @nodoc
mixin _$BatchTask {
  String get id => throw _privateConstructorUsedError;
  String get title => throw _privateConstructorUsedError;
  BatchTaskType get type => throw _privateConstructorUsedError;
  bool get isCompleted => throw _privateConstructorUsedError;
  String? get proofUrl => throw _privateConstructorUsedError;
  bool get isRequired => throw _privateConstructorUsedError;

  /// Serializes this BatchTask to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of BatchTask
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $BatchTaskCopyWith<BatchTask> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $BatchTaskCopyWith<$Res> {
  factory $BatchTaskCopyWith(BatchTask value, $Res Function(BatchTask) then) =
      _$BatchTaskCopyWithImpl<$Res, BatchTask>;
  @useResult
  $Res call({
    String id,
    String title,
    BatchTaskType type,
    bool isCompleted,
    String? proofUrl,
    bool isRequired,
  });
}

/// @nodoc
class _$BatchTaskCopyWithImpl<$Res, $Val extends BatchTask>
    implements $BatchTaskCopyWith<$Res> {
  _$BatchTaskCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of BatchTask
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? title = null,
    Object? type = null,
    Object? isCompleted = null,
    Object? proofUrl = freezed,
    Object? isRequired = null,
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
                        as BatchTaskType,
            isCompleted:
                null == isCompleted
                    ? _value.isCompleted
                    : isCompleted // ignore: cast_nullable_to_non_nullable
                        as bool,
            proofUrl:
                freezed == proofUrl
                    ? _value.proofUrl
                    : proofUrl // ignore: cast_nullable_to_non_nullable
                        as String?,
            isRequired:
                null == isRequired
                    ? _value.isRequired
                    : isRequired // ignore: cast_nullable_to_non_nullable
                        as bool,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$BatchTaskImplCopyWith<$Res>
    implements $BatchTaskCopyWith<$Res> {
  factory _$$BatchTaskImplCopyWith(
    _$BatchTaskImpl value,
    $Res Function(_$BatchTaskImpl) then,
  ) = __$$BatchTaskImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    String id,
    String title,
    BatchTaskType type,
    bool isCompleted,
    String? proofUrl,
    bool isRequired,
  });
}

/// @nodoc
class __$$BatchTaskImplCopyWithImpl<$Res>
    extends _$BatchTaskCopyWithImpl<$Res, _$BatchTaskImpl>
    implements _$$BatchTaskImplCopyWith<$Res> {
  __$$BatchTaskImplCopyWithImpl(
    _$BatchTaskImpl _value,
    $Res Function(_$BatchTaskImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of BatchTask
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? title = null,
    Object? type = null,
    Object? isCompleted = null,
    Object? proofUrl = freezed,
    Object? isRequired = null,
  }) {
    return _then(
      _$BatchTaskImpl(
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
                    as BatchTaskType,
        isCompleted:
            null == isCompleted
                ? _value.isCompleted
                : isCompleted // ignore: cast_nullable_to_non_nullable
                    as bool,
        proofUrl:
            freezed == proofUrl
                ? _value.proofUrl
                : proofUrl // ignore: cast_nullable_to_non_nullable
                    as String?,
        isRequired:
            null == isRequired
                ? _value.isRequired
                : isRequired // ignore: cast_nullable_to_non_nullable
                    as bool,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$BatchTaskImpl implements _BatchTask {
  const _$BatchTaskImpl({
    required this.id,
    required this.title,
    this.type = BatchTaskType.watch,
    this.isCompleted = false,
    this.proofUrl,
    this.isRequired = true,
  });

  factory _$BatchTaskImpl.fromJson(Map<String, dynamic> json) =>
      _$$BatchTaskImplFromJson(json);

  @override
  final String id;
  @override
  final String title;
  @override
  @JsonKey()
  final BatchTaskType type;
  @override
  @JsonKey()
  final bool isCompleted;
  @override
  final String? proofUrl;
  @override
  @JsonKey()
  final bool isRequired;

  @override
  String toString() {
    return 'BatchTask(id: $id, title: $title, type: $type, isCompleted: $isCompleted, proofUrl: $proofUrl, isRequired: $isRequired)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$BatchTaskImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.title, title) || other.title == title) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.isCompleted, isCompleted) ||
                other.isCompleted == isCompleted) &&
            (identical(other.proofUrl, proofUrl) ||
                other.proofUrl == proofUrl) &&
            (identical(other.isRequired, isRequired) ||
                other.isRequired == isRequired));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
    runtimeType,
    id,
    title,
    type,
    isCompleted,
    proofUrl,
    isRequired,
  );

  /// Create a copy of BatchTask
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$BatchTaskImplCopyWith<_$BatchTaskImpl> get copyWith =>
      __$$BatchTaskImplCopyWithImpl<_$BatchTaskImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$BatchTaskImplToJson(this);
  }
}

abstract class _BatchTask implements BatchTask {
  const factory _BatchTask({
    required final String id,
    required final String title,
    final BatchTaskType type,
    final bool isCompleted,
    final String? proofUrl,
    final bool isRequired,
  }) = _$BatchTaskImpl;

  factory _BatchTask.fromJson(Map<String, dynamic> json) =
      _$BatchTaskImpl.fromJson;

  @override
  String get id;
  @override
  String get title;
  @override
  BatchTaskType get type;
  @override
  bool get isCompleted;
  @override
  String? get proofUrl;
  @override
  bool get isRequired;

  /// Create a copy of BatchTask
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$BatchTaskImplCopyWith<_$BatchTaskImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

BatchDay _$BatchDayFromJson(Map<String, dynamic> json) {
  return _BatchDay.fromJson(json);
}

/// @nodoc
mixin _$BatchDay {
  int get dayNumber => throw _privateConstructorUsedError;
  BatchDayStatus get status => throw _privateConstructorUsedError;
  String? get category => throw _privateConstructorUsedError;
  String? get title => throw _privateConstructorUsedError;
  List<BatchTask> get tasks => throw _privateConstructorUsedError;

  /// Serializes this BatchDay to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of BatchDay
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $BatchDayCopyWith<BatchDay> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $BatchDayCopyWith<$Res> {
  factory $BatchDayCopyWith(BatchDay value, $Res Function(BatchDay) then) =
      _$BatchDayCopyWithImpl<$Res, BatchDay>;
  @useResult
  $Res call({
    int dayNumber,
    BatchDayStatus status,
    String? category,
    String? title,
    List<BatchTask> tasks,
  });
}

/// @nodoc
class _$BatchDayCopyWithImpl<$Res, $Val extends BatchDay>
    implements $BatchDayCopyWith<$Res> {
  _$BatchDayCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of BatchDay
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? dayNumber = null,
    Object? status = null,
    Object? category = freezed,
    Object? title = freezed,
    Object? tasks = null,
  }) {
    return _then(
      _value.copyWith(
            dayNumber:
                null == dayNumber
                    ? _value.dayNumber
                    : dayNumber // ignore: cast_nullable_to_non_nullable
                        as int,
            status:
                null == status
                    ? _value.status
                    : status // ignore: cast_nullable_to_non_nullable
                        as BatchDayStatus,
            category:
                freezed == category
                    ? _value.category
                    : category // ignore: cast_nullable_to_non_nullable
                        as String?,
            title:
                freezed == title
                    ? _value.title
                    : title // ignore: cast_nullable_to_non_nullable
                        as String?,
            tasks:
                null == tasks
                    ? _value.tasks
                    : tasks // ignore: cast_nullable_to_non_nullable
                        as List<BatchTask>,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$BatchDayImplCopyWith<$Res>
    implements $BatchDayCopyWith<$Res> {
  factory _$$BatchDayImplCopyWith(
    _$BatchDayImpl value,
    $Res Function(_$BatchDayImpl) then,
  ) = __$$BatchDayImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    int dayNumber,
    BatchDayStatus status,
    String? category,
    String? title,
    List<BatchTask> tasks,
  });
}

/// @nodoc
class __$$BatchDayImplCopyWithImpl<$Res>
    extends _$BatchDayCopyWithImpl<$Res, _$BatchDayImpl>
    implements _$$BatchDayImplCopyWith<$Res> {
  __$$BatchDayImplCopyWithImpl(
    _$BatchDayImpl _value,
    $Res Function(_$BatchDayImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of BatchDay
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? dayNumber = null,
    Object? status = null,
    Object? category = freezed,
    Object? title = freezed,
    Object? tasks = null,
  }) {
    return _then(
      _$BatchDayImpl(
        dayNumber:
            null == dayNumber
                ? _value.dayNumber
                : dayNumber // ignore: cast_nullable_to_non_nullable
                    as int,
        status:
            null == status
                ? _value.status
                : status // ignore: cast_nullable_to_non_nullable
                    as BatchDayStatus,
        category:
            freezed == category
                ? _value.category
                : category // ignore: cast_nullable_to_non_nullable
                    as String?,
        title:
            freezed == title
                ? _value.title
                : title // ignore: cast_nullable_to_non_nullable
                    as String?,
        tasks:
            null == tasks
                ? _value._tasks
                : tasks // ignore: cast_nullable_to_non_nullable
                    as List<BatchTask>,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$BatchDayImpl implements _BatchDay {
  const _$BatchDayImpl({
    required this.dayNumber,
    this.status = BatchDayStatus.notStarted,
    this.category,
    this.title,
    final List<BatchTask> tasks = const [],
  }) : _tasks = tasks;

  factory _$BatchDayImpl.fromJson(Map<String, dynamic> json) =>
      _$$BatchDayImplFromJson(json);

  @override
  final int dayNumber;
  @override
  @JsonKey()
  final BatchDayStatus status;
  @override
  final String? category;
  @override
  final String? title;
  final List<BatchTask> _tasks;
  @override
  @JsonKey()
  List<BatchTask> get tasks {
    if (_tasks is EqualUnmodifiableListView) return _tasks;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_tasks);
  }

  @override
  String toString() {
    return 'BatchDay(dayNumber: $dayNumber, status: $status, category: $category, title: $title, tasks: $tasks)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$BatchDayImpl &&
            (identical(other.dayNumber, dayNumber) ||
                other.dayNumber == dayNumber) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.category, category) ||
                other.category == category) &&
            (identical(other.title, title) || other.title == title) &&
            const DeepCollectionEquality().equals(other._tasks, _tasks));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
    runtimeType,
    dayNumber,
    status,
    category,
    title,
    const DeepCollectionEquality().hash(_tasks),
  );

  /// Create a copy of BatchDay
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$BatchDayImplCopyWith<_$BatchDayImpl> get copyWith =>
      __$$BatchDayImplCopyWithImpl<_$BatchDayImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$BatchDayImplToJson(this);
  }
}

abstract class _BatchDay implements BatchDay {
  const factory _BatchDay({
    required final int dayNumber,
    final BatchDayStatus status,
    final String? category,
    final String? title,
    final List<BatchTask> tasks,
  }) = _$BatchDayImpl;

  factory _BatchDay.fromJson(Map<String, dynamic> json) =
      _$BatchDayImpl.fromJson;

  @override
  int get dayNumber;
  @override
  BatchDayStatus get status;
  @override
  String? get category;
  @override
  String? get title;
  @override
  List<BatchTask> get tasks;

  /// Create a copy of BatchDay
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$BatchDayImplCopyWith<_$BatchDayImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

BatchInfo _$BatchInfoFromJson(Map<String, dynamic> json) {
  return _BatchInfo.fromJson(json);
}

/// @nodoc
mixin _$BatchInfo {
  String get id => throw _privateConstructorUsedError;
  String get name => throw _privateConstructorUsedError;
  String? get startDate => throw _privateConstructorUsedError;
  int get xpPerDay => throw _privateConstructorUsedError;
  String? get programName => throw _privateConstructorUsedError;

  /// Serializes this BatchInfo to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of BatchInfo
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $BatchInfoCopyWith<BatchInfo> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $BatchInfoCopyWith<$Res> {
  factory $BatchInfoCopyWith(BatchInfo value, $Res Function(BatchInfo) then) =
      _$BatchInfoCopyWithImpl<$Res, BatchInfo>;
  @useResult
  $Res call({
    String id,
    String name,
    String? startDate,
    int xpPerDay,
    String? programName,
  });
}

/// @nodoc
class _$BatchInfoCopyWithImpl<$Res, $Val extends BatchInfo>
    implements $BatchInfoCopyWith<$Res> {
  _$BatchInfoCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of BatchInfo
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? name = null,
    Object? startDate = freezed,
    Object? xpPerDay = null,
    Object? programName = freezed,
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
            startDate:
                freezed == startDate
                    ? _value.startDate
                    : startDate // ignore: cast_nullable_to_non_nullable
                        as String?,
            xpPerDay:
                null == xpPerDay
                    ? _value.xpPerDay
                    : xpPerDay // ignore: cast_nullable_to_non_nullable
                        as int,
            programName:
                freezed == programName
                    ? _value.programName
                    : programName // ignore: cast_nullable_to_non_nullable
                        as String?,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$BatchInfoImplCopyWith<$Res>
    implements $BatchInfoCopyWith<$Res> {
  factory _$$BatchInfoImplCopyWith(
    _$BatchInfoImpl value,
    $Res Function(_$BatchInfoImpl) then,
  ) = __$$BatchInfoImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    String id,
    String name,
    String? startDate,
    int xpPerDay,
    String? programName,
  });
}

/// @nodoc
class __$$BatchInfoImplCopyWithImpl<$Res>
    extends _$BatchInfoCopyWithImpl<$Res, _$BatchInfoImpl>
    implements _$$BatchInfoImplCopyWith<$Res> {
  __$$BatchInfoImplCopyWithImpl(
    _$BatchInfoImpl _value,
    $Res Function(_$BatchInfoImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of BatchInfo
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? name = null,
    Object? startDate = freezed,
    Object? xpPerDay = null,
    Object? programName = freezed,
  }) {
    return _then(
      _$BatchInfoImpl(
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
        startDate:
            freezed == startDate
                ? _value.startDate
                : startDate // ignore: cast_nullable_to_non_nullable
                    as String?,
        xpPerDay:
            null == xpPerDay
                ? _value.xpPerDay
                : xpPerDay // ignore: cast_nullable_to_non_nullable
                    as int,
        programName:
            freezed == programName
                ? _value.programName
                : programName // ignore: cast_nullable_to_non_nullable
                    as String?,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$BatchInfoImpl implements _BatchInfo {
  const _$BatchInfoImpl({
    required this.id,
    required this.name,
    this.startDate,
    this.xpPerDay = 50,
    this.programName,
  });

  factory _$BatchInfoImpl.fromJson(Map<String, dynamic> json) =>
      _$$BatchInfoImplFromJson(json);

  @override
  final String id;
  @override
  final String name;
  @override
  final String? startDate;
  @override
  @JsonKey()
  final int xpPerDay;
  @override
  final String? programName;

  @override
  String toString() {
    return 'BatchInfo(id: $id, name: $name, startDate: $startDate, xpPerDay: $xpPerDay, programName: $programName)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$BatchInfoImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.name, name) || other.name == name) &&
            (identical(other.startDate, startDate) ||
                other.startDate == startDate) &&
            (identical(other.xpPerDay, xpPerDay) ||
                other.xpPerDay == xpPerDay) &&
            (identical(other.programName, programName) ||
                other.programName == programName));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, id, name, startDate, xpPerDay, programName);

  /// Create a copy of BatchInfo
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$BatchInfoImplCopyWith<_$BatchInfoImpl> get copyWith =>
      __$$BatchInfoImplCopyWithImpl<_$BatchInfoImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$BatchInfoImplToJson(this);
  }
}

abstract class _BatchInfo implements BatchInfo {
  const factory _BatchInfo({
    required final String id,
    required final String name,
    final String? startDate,
    final int xpPerDay,
    final String? programName,
  }) = _$BatchInfoImpl;

  factory _BatchInfo.fromJson(Map<String, dynamic> json) =
      _$BatchInfoImpl.fromJson;

  @override
  String get id;
  @override
  String get name;
  @override
  String? get startDate;
  @override
  int get xpPerDay;
  @override
  String? get programName;

  /// Create a copy of BatchInfo
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$BatchInfoImplCopyWith<_$BatchInfoImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

BatchAttendance _$BatchAttendanceFromJson(Map<String, dynamic> json) {
  return _BatchAttendance.fromJson(json);
}

/// @nodoc
mixin _$BatchAttendance {
  @JsonKey(name: 'day_number')
  int get dayNumber => throw _privateConstructorUsedError;
  String get status => throw _privateConstructorUsedError;
  String? get notes => throw _privateConstructorUsedError;
  @JsonKey(name: 'marked_at')
  String? get markedAt => throw _privateConstructorUsedError;

  /// Serializes this BatchAttendance to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of BatchAttendance
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $BatchAttendanceCopyWith<BatchAttendance> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $BatchAttendanceCopyWith<$Res> {
  factory $BatchAttendanceCopyWith(
    BatchAttendance value,
    $Res Function(BatchAttendance) then,
  ) = _$BatchAttendanceCopyWithImpl<$Res, BatchAttendance>;
  @useResult
  $Res call({
    @JsonKey(name: 'day_number') int dayNumber,
    String status,
    String? notes,
    @JsonKey(name: 'marked_at') String? markedAt,
  });
}

/// @nodoc
class _$BatchAttendanceCopyWithImpl<$Res, $Val extends BatchAttendance>
    implements $BatchAttendanceCopyWith<$Res> {
  _$BatchAttendanceCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of BatchAttendance
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? dayNumber = null,
    Object? status = null,
    Object? notes = freezed,
    Object? markedAt = freezed,
  }) {
    return _then(
      _value.copyWith(
            dayNumber:
                null == dayNumber
                    ? _value.dayNumber
                    : dayNumber // ignore: cast_nullable_to_non_nullable
                        as int,
            status:
                null == status
                    ? _value.status
                    : status // ignore: cast_nullable_to_non_nullable
                        as String,
            notes:
                freezed == notes
                    ? _value.notes
                    : notes // ignore: cast_nullable_to_non_nullable
                        as String?,
            markedAt:
                freezed == markedAt
                    ? _value.markedAt
                    : markedAt // ignore: cast_nullable_to_non_nullable
                        as String?,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$BatchAttendanceImplCopyWith<$Res>
    implements $BatchAttendanceCopyWith<$Res> {
  factory _$$BatchAttendanceImplCopyWith(
    _$BatchAttendanceImpl value,
    $Res Function(_$BatchAttendanceImpl) then,
  ) = __$$BatchAttendanceImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    @JsonKey(name: 'day_number') int dayNumber,
    String status,
    String? notes,
    @JsonKey(name: 'marked_at') String? markedAt,
  });
}

/// @nodoc
class __$$BatchAttendanceImplCopyWithImpl<$Res>
    extends _$BatchAttendanceCopyWithImpl<$Res, _$BatchAttendanceImpl>
    implements _$$BatchAttendanceImplCopyWith<$Res> {
  __$$BatchAttendanceImplCopyWithImpl(
    _$BatchAttendanceImpl _value,
    $Res Function(_$BatchAttendanceImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of BatchAttendance
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? dayNumber = null,
    Object? status = null,
    Object? notes = freezed,
    Object? markedAt = freezed,
  }) {
    return _then(
      _$BatchAttendanceImpl(
        dayNumber:
            null == dayNumber
                ? _value.dayNumber
                : dayNumber // ignore: cast_nullable_to_non_nullable
                    as int,
        status:
            null == status
                ? _value.status
                : status // ignore: cast_nullable_to_non_nullable
                    as String,
        notes:
            freezed == notes
                ? _value.notes
                : notes // ignore: cast_nullable_to_non_nullable
                    as String?,
        markedAt:
            freezed == markedAt
                ? _value.markedAt
                : markedAt // ignore: cast_nullable_to_non_nullable
                    as String?,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$BatchAttendanceImpl implements _BatchAttendance {
  const _$BatchAttendanceImpl({
    @JsonKey(name: 'day_number') required this.dayNumber,
    this.status = 'present',
    this.notes,
    @JsonKey(name: 'marked_at') this.markedAt,
  });

  factory _$BatchAttendanceImpl.fromJson(Map<String, dynamic> json) =>
      _$$BatchAttendanceImplFromJson(json);

  @override
  @JsonKey(name: 'day_number')
  final int dayNumber;
  @override
  @JsonKey()
  final String status;
  @override
  final String? notes;
  @override
  @JsonKey(name: 'marked_at')
  final String? markedAt;

  @override
  String toString() {
    return 'BatchAttendance(dayNumber: $dayNumber, status: $status, notes: $notes, markedAt: $markedAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$BatchAttendanceImpl &&
            (identical(other.dayNumber, dayNumber) ||
                other.dayNumber == dayNumber) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.notes, notes) || other.notes == notes) &&
            (identical(other.markedAt, markedAt) ||
                other.markedAt == markedAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, dayNumber, status, notes, markedAt);

  /// Create a copy of BatchAttendance
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$BatchAttendanceImplCopyWith<_$BatchAttendanceImpl> get copyWith =>
      __$$BatchAttendanceImplCopyWithImpl<_$BatchAttendanceImpl>(
        this,
        _$identity,
      );

  @override
  Map<String, dynamic> toJson() {
    return _$$BatchAttendanceImplToJson(this);
  }
}

abstract class _BatchAttendance implements BatchAttendance {
  const factory _BatchAttendance({
    @JsonKey(name: 'day_number') required final int dayNumber,
    final String status,
    final String? notes,
    @JsonKey(name: 'marked_at') final String? markedAt,
  }) = _$BatchAttendanceImpl;

  factory _BatchAttendance.fromJson(Map<String, dynamic> json) =
      _$BatchAttendanceImpl.fromJson;

  @override
  @JsonKey(name: 'day_number')
  int get dayNumber;
  @override
  String get status;
  @override
  String? get notes;
  @override
  @JsonKey(name: 'marked_at')
  String? get markedAt;

  /// Create a copy of BatchAttendance
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$BatchAttendanceImplCopyWith<_$BatchAttendanceImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

BatchBreak _$BatchBreakFromJson(Map<String, dynamic> json) {
  return _BatchBreak.fromJson(json);
}

/// @nodoc
mixin _$BatchBreak {
  String get id => throw _privateConstructorUsedError;
  @JsonKey(name: 'start_day')
  int get startDay => throw _privateConstructorUsedError;
  @JsonKey(name: 'end_day')
  int get endDay => throw _privateConstructorUsedError;
  String? get reason => throw _privateConstructorUsedError;
  BatchBreakStatus get status => throw _privateConstructorUsedError;
  @JsonKey(name: 'admin_note')
  String? get adminNote => throw _privateConstructorUsedError;
  @JsonKey(name: 'created_at')
  String? get createdAt => throw _privateConstructorUsedError;

  /// Serializes this BatchBreak to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of BatchBreak
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $BatchBreakCopyWith<BatchBreak> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $BatchBreakCopyWith<$Res> {
  factory $BatchBreakCopyWith(
    BatchBreak value,
    $Res Function(BatchBreak) then,
  ) = _$BatchBreakCopyWithImpl<$Res, BatchBreak>;
  @useResult
  $Res call({
    String id,
    @JsonKey(name: 'start_day') int startDay,
    @JsonKey(name: 'end_day') int endDay,
    String? reason,
    BatchBreakStatus status,
    @JsonKey(name: 'admin_note') String? adminNote,
    @JsonKey(name: 'created_at') String? createdAt,
  });
}

/// @nodoc
class _$BatchBreakCopyWithImpl<$Res, $Val extends BatchBreak>
    implements $BatchBreakCopyWith<$Res> {
  _$BatchBreakCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of BatchBreak
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? startDay = null,
    Object? endDay = null,
    Object? reason = freezed,
    Object? status = null,
    Object? adminNote = freezed,
    Object? createdAt = freezed,
  }) {
    return _then(
      _value.copyWith(
            id:
                null == id
                    ? _value.id
                    : id // ignore: cast_nullable_to_non_nullable
                        as String,
            startDay:
                null == startDay
                    ? _value.startDay
                    : startDay // ignore: cast_nullable_to_non_nullable
                        as int,
            endDay:
                null == endDay
                    ? _value.endDay
                    : endDay // ignore: cast_nullable_to_non_nullable
                        as int,
            reason:
                freezed == reason
                    ? _value.reason
                    : reason // ignore: cast_nullable_to_non_nullable
                        as String?,
            status:
                null == status
                    ? _value.status
                    : status // ignore: cast_nullable_to_non_nullable
                        as BatchBreakStatus,
            adminNote:
                freezed == adminNote
                    ? _value.adminNote
                    : adminNote // ignore: cast_nullable_to_non_nullable
                        as String?,
            createdAt:
                freezed == createdAt
                    ? _value.createdAt
                    : createdAt // ignore: cast_nullable_to_non_nullable
                        as String?,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$BatchBreakImplCopyWith<$Res>
    implements $BatchBreakCopyWith<$Res> {
  factory _$$BatchBreakImplCopyWith(
    _$BatchBreakImpl value,
    $Res Function(_$BatchBreakImpl) then,
  ) = __$$BatchBreakImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    String id,
    @JsonKey(name: 'start_day') int startDay,
    @JsonKey(name: 'end_day') int endDay,
    String? reason,
    BatchBreakStatus status,
    @JsonKey(name: 'admin_note') String? adminNote,
    @JsonKey(name: 'created_at') String? createdAt,
  });
}

/// @nodoc
class __$$BatchBreakImplCopyWithImpl<$Res>
    extends _$BatchBreakCopyWithImpl<$Res, _$BatchBreakImpl>
    implements _$$BatchBreakImplCopyWith<$Res> {
  __$$BatchBreakImplCopyWithImpl(
    _$BatchBreakImpl _value,
    $Res Function(_$BatchBreakImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of BatchBreak
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? startDay = null,
    Object? endDay = null,
    Object? reason = freezed,
    Object? status = null,
    Object? adminNote = freezed,
    Object? createdAt = freezed,
  }) {
    return _then(
      _$BatchBreakImpl(
        id:
            null == id
                ? _value.id
                : id // ignore: cast_nullable_to_non_nullable
                    as String,
        startDay:
            null == startDay
                ? _value.startDay
                : startDay // ignore: cast_nullable_to_non_nullable
                    as int,
        endDay:
            null == endDay
                ? _value.endDay
                : endDay // ignore: cast_nullable_to_non_nullable
                    as int,
        reason:
            freezed == reason
                ? _value.reason
                : reason // ignore: cast_nullable_to_non_nullable
                    as String?,
        status:
            null == status
                ? _value.status
                : status // ignore: cast_nullable_to_non_nullable
                    as BatchBreakStatus,
        adminNote:
            freezed == adminNote
                ? _value.adminNote
                : adminNote // ignore: cast_nullable_to_non_nullable
                    as String?,
        createdAt:
            freezed == createdAt
                ? _value.createdAt
                : createdAt // ignore: cast_nullable_to_non_nullable
                    as String?,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$BatchBreakImpl implements _BatchBreak {
  const _$BatchBreakImpl({
    required this.id,
    @JsonKey(name: 'start_day') required this.startDay,
    @JsonKey(name: 'end_day') required this.endDay,
    this.reason,
    this.status = BatchBreakStatus.pending,
    @JsonKey(name: 'admin_note') this.adminNote,
    @JsonKey(name: 'created_at') this.createdAt,
  });

  factory _$BatchBreakImpl.fromJson(Map<String, dynamic> json) =>
      _$$BatchBreakImplFromJson(json);

  @override
  final String id;
  @override
  @JsonKey(name: 'start_day')
  final int startDay;
  @override
  @JsonKey(name: 'end_day')
  final int endDay;
  @override
  final String? reason;
  @override
  @JsonKey()
  final BatchBreakStatus status;
  @override
  @JsonKey(name: 'admin_note')
  final String? adminNote;
  @override
  @JsonKey(name: 'created_at')
  final String? createdAt;

  @override
  String toString() {
    return 'BatchBreak(id: $id, startDay: $startDay, endDay: $endDay, reason: $reason, status: $status, adminNote: $adminNote, createdAt: $createdAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$BatchBreakImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.startDay, startDay) ||
                other.startDay == startDay) &&
            (identical(other.endDay, endDay) || other.endDay == endDay) &&
            (identical(other.reason, reason) || other.reason == reason) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.adminNote, adminNote) ||
                other.adminNote == adminNote) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
    runtimeType,
    id,
    startDay,
    endDay,
    reason,
    status,
    adminNote,
    createdAt,
  );

  /// Create a copy of BatchBreak
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$BatchBreakImplCopyWith<_$BatchBreakImpl> get copyWith =>
      __$$BatchBreakImplCopyWithImpl<_$BatchBreakImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$BatchBreakImplToJson(this);
  }
}

abstract class _BatchBreak implements BatchBreak {
  const factory _BatchBreak({
    required final String id,
    @JsonKey(name: 'start_day') required final int startDay,
    @JsonKey(name: 'end_day') required final int endDay,
    final String? reason,
    final BatchBreakStatus status,
    @JsonKey(name: 'admin_note') final String? adminNote,
    @JsonKey(name: 'created_at') final String? createdAt,
  }) = _$BatchBreakImpl;

  factory _BatchBreak.fromJson(Map<String, dynamic> json) =
      _$BatchBreakImpl.fromJson;

  @override
  String get id;
  @override
  @JsonKey(name: 'start_day')
  int get startDay;
  @override
  @JsonKey(name: 'end_day')
  int get endDay;
  @override
  String? get reason;
  @override
  BatchBreakStatus get status;
  @override
  @JsonKey(name: 'admin_note')
  String? get adminNote;
  @override
  @JsonKey(name: 'created_at')
  String? get createdAt;

  /// Create a copy of BatchBreak
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$BatchBreakImplCopyWith<_$BatchBreakImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

BatchProgram _$BatchProgramFromJson(Map<String, dynamic> json) {
  return _BatchProgram.fromJson(json);
}

/// @nodoc
mixin _$BatchProgram {
  BatchInfo get batch => throw _privateConstructorUsedError;
  int get totalDays => throw _privateConstructorUsedError;
  List<BatchDay> get days => throw _privateConstructorUsedError;
  List<BatchAttendance> get attendance => throw _privateConstructorUsedError;
  List<BatchBreak> get breaks => throw _privateConstructorUsedError;

  /// Serializes this BatchProgram to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of BatchProgram
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $BatchProgramCopyWith<BatchProgram> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $BatchProgramCopyWith<$Res> {
  factory $BatchProgramCopyWith(
    BatchProgram value,
    $Res Function(BatchProgram) then,
  ) = _$BatchProgramCopyWithImpl<$Res, BatchProgram>;
  @useResult
  $Res call({
    BatchInfo batch,
    int totalDays,
    List<BatchDay> days,
    List<BatchAttendance> attendance,
    List<BatchBreak> breaks,
  });

  $BatchInfoCopyWith<$Res> get batch;
}

/// @nodoc
class _$BatchProgramCopyWithImpl<$Res, $Val extends BatchProgram>
    implements $BatchProgramCopyWith<$Res> {
  _$BatchProgramCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of BatchProgram
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? batch = null,
    Object? totalDays = null,
    Object? days = null,
    Object? attendance = null,
    Object? breaks = null,
  }) {
    return _then(
      _value.copyWith(
            batch:
                null == batch
                    ? _value.batch
                    : batch // ignore: cast_nullable_to_non_nullable
                        as BatchInfo,
            totalDays:
                null == totalDays
                    ? _value.totalDays
                    : totalDays // ignore: cast_nullable_to_non_nullable
                        as int,
            days:
                null == days
                    ? _value.days
                    : days // ignore: cast_nullable_to_non_nullable
                        as List<BatchDay>,
            attendance:
                null == attendance
                    ? _value.attendance
                    : attendance // ignore: cast_nullable_to_non_nullable
                        as List<BatchAttendance>,
            breaks:
                null == breaks
                    ? _value.breaks
                    : breaks // ignore: cast_nullable_to_non_nullable
                        as List<BatchBreak>,
          )
          as $Val,
    );
  }

  /// Create a copy of BatchProgram
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $BatchInfoCopyWith<$Res> get batch {
    return $BatchInfoCopyWith<$Res>(_value.batch, (value) {
      return _then(_value.copyWith(batch: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$BatchProgramImplCopyWith<$Res>
    implements $BatchProgramCopyWith<$Res> {
  factory _$$BatchProgramImplCopyWith(
    _$BatchProgramImpl value,
    $Res Function(_$BatchProgramImpl) then,
  ) = __$$BatchProgramImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    BatchInfo batch,
    int totalDays,
    List<BatchDay> days,
    List<BatchAttendance> attendance,
    List<BatchBreak> breaks,
  });

  @override
  $BatchInfoCopyWith<$Res> get batch;
}

/// @nodoc
class __$$BatchProgramImplCopyWithImpl<$Res>
    extends _$BatchProgramCopyWithImpl<$Res, _$BatchProgramImpl>
    implements _$$BatchProgramImplCopyWith<$Res> {
  __$$BatchProgramImplCopyWithImpl(
    _$BatchProgramImpl _value,
    $Res Function(_$BatchProgramImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of BatchProgram
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? batch = null,
    Object? totalDays = null,
    Object? days = null,
    Object? attendance = null,
    Object? breaks = null,
  }) {
    return _then(
      _$BatchProgramImpl(
        batch:
            null == batch
                ? _value.batch
                : batch // ignore: cast_nullable_to_non_nullable
                    as BatchInfo,
        totalDays:
            null == totalDays
                ? _value.totalDays
                : totalDays // ignore: cast_nullable_to_non_nullable
                    as int,
        days:
            null == days
                ? _value._days
                : days // ignore: cast_nullable_to_non_nullable
                    as List<BatchDay>,
        attendance:
            null == attendance
                ? _value._attendance
                : attendance // ignore: cast_nullable_to_non_nullable
                    as List<BatchAttendance>,
        breaks:
            null == breaks
                ? _value._breaks
                : breaks // ignore: cast_nullable_to_non_nullable
                    as List<BatchBreak>,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$BatchProgramImpl implements _BatchProgram {
  const _$BatchProgramImpl({
    required this.batch,
    required this.totalDays,
    final List<BatchDay> days = const [],
    final List<BatchAttendance> attendance = const [],
    final List<BatchBreak> breaks = const [],
  }) : _days = days,
       _attendance = attendance,
       _breaks = breaks;

  factory _$BatchProgramImpl.fromJson(Map<String, dynamic> json) =>
      _$$BatchProgramImplFromJson(json);

  @override
  final BatchInfo batch;
  @override
  final int totalDays;
  final List<BatchDay> _days;
  @override
  @JsonKey()
  List<BatchDay> get days {
    if (_days is EqualUnmodifiableListView) return _days;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_days);
  }

  final List<BatchAttendance> _attendance;
  @override
  @JsonKey()
  List<BatchAttendance> get attendance {
    if (_attendance is EqualUnmodifiableListView) return _attendance;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_attendance);
  }

  final List<BatchBreak> _breaks;
  @override
  @JsonKey()
  List<BatchBreak> get breaks {
    if (_breaks is EqualUnmodifiableListView) return _breaks;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_breaks);
  }

  @override
  String toString() {
    return 'BatchProgram(batch: $batch, totalDays: $totalDays, days: $days, attendance: $attendance, breaks: $breaks)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$BatchProgramImpl &&
            (identical(other.batch, batch) || other.batch == batch) &&
            (identical(other.totalDays, totalDays) ||
                other.totalDays == totalDays) &&
            const DeepCollectionEquality().equals(other._days, _days) &&
            const DeepCollectionEquality().equals(
              other._attendance,
              _attendance,
            ) &&
            const DeepCollectionEquality().equals(other._breaks, _breaks));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
    runtimeType,
    batch,
    totalDays,
    const DeepCollectionEquality().hash(_days),
    const DeepCollectionEquality().hash(_attendance),
    const DeepCollectionEquality().hash(_breaks),
  );

  /// Create a copy of BatchProgram
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$BatchProgramImplCopyWith<_$BatchProgramImpl> get copyWith =>
      __$$BatchProgramImplCopyWithImpl<_$BatchProgramImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$BatchProgramImplToJson(this);
  }
}

abstract class _BatchProgram implements BatchProgram {
  const factory _BatchProgram({
    required final BatchInfo batch,
    required final int totalDays,
    final List<BatchDay> days,
    final List<BatchAttendance> attendance,
    final List<BatchBreak> breaks,
  }) = _$BatchProgramImpl;

  factory _BatchProgram.fromJson(Map<String, dynamic> json) =
      _$BatchProgramImpl.fromJson;

  @override
  BatchInfo get batch;
  @override
  int get totalDays;
  @override
  List<BatchDay> get days;
  @override
  List<BatchAttendance> get attendance;
  @override
  List<BatchBreak> get breaks;

  /// Create a copy of BatchProgram
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$BatchProgramImplCopyWith<_$BatchProgramImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
