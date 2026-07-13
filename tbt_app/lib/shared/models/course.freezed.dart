// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'course.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

CourseInstructor _$CourseInstructorFromJson(Map<String, dynamic> json) {
  return _CourseInstructor.fromJson(json);
}

/// @nodoc
mixin _$CourseInstructor {
  String get id => throw _privateConstructorUsedError;
  String get fullName => throw _privateConstructorUsedError;
  String? get profilePhotoUrl => throw _privateConstructorUsedError;
  String? get designation => throw _privateConstructorUsedError;

  /// Serializes this CourseInstructor to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of CourseInstructor
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $CourseInstructorCopyWith<CourseInstructor> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $CourseInstructorCopyWith<$Res> {
  factory $CourseInstructorCopyWith(
    CourseInstructor value,
    $Res Function(CourseInstructor) then,
  ) = _$CourseInstructorCopyWithImpl<$Res, CourseInstructor>;
  @useResult
  $Res call({
    String id,
    String fullName,
    String? profilePhotoUrl,
    String? designation,
  });
}

/// @nodoc
class _$CourseInstructorCopyWithImpl<$Res, $Val extends CourseInstructor>
    implements $CourseInstructorCopyWith<$Res> {
  _$CourseInstructorCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of CourseInstructor
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? fullName = null,
    Object? profilePhotoUrl = freezed,
    Object? designation = freezed,
  }) {
    return _then(
      _value.copyWith(
            id:
                null == id
                    ? _value.id
                    : id // ignore: cast_nullable_to_non_nullable
                        as String,
            fullName:
                null == fullName
                    ? _value.fullName
                    : fullName // ignore: cast_nullable_to_non_nullable
                        as String,
            profilePhotoUrl:
                freezed == profilePhotoUrl
                    ? _value.profilePhotoUrl
                    : profilePhotoUrl // ignore: cast_nullable_to_non_nullable
                        as String?,
            designation:
                freezed == designation
                    ? _value.designation
                    : designation // ignore: cast_nullable_to_non_nullable
                        as String?,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$CourseInstructorImplCopyWith<$Res>
    implements $CourseInstructorCopyWith<$Res> {
  factory _$$CourseInstructorImplCopyWith(
    _$CourseInstructorImpl value,
    $Res Function(_$CourseInstructorImpl) then,
  ) = __$$CourseInstructorImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    String id,
    String fullName,
    String? profilePhotoUrl,
    String? designation,
  });
}

/// @nodoc
class __$$CourseInstructorImplCopyWithImpl<$Res>
    extends _$CourseInstructorCopyWithImpl<$Res, _$CourseInstructorImpl>
    implements _$$CourseInstructorImplCopyWith<$Res> {
  __$$CourseInstructorImplCopyWithImpl(
    _$CourseInstructorImpl _value,
    $Res Function(_$CourseInstructorImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of CourseInstructor
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? fullName = null,
    Object? profilePhotoUrl = freezed,
    Object? designation = freezed,
  }) {
    return _then(
      _$CourseInstructorImpl(
        id:
            null == id
                ? _value.id
                : id // ignore: cast_nullable_to_non_nullable
                    as String,
        fullName:
            null == fullName
                ? _value.fullName
                : fullName // ignore: cast_nullable_to_non_nullable
                    as String,
        profilePhotoUrl:
            freezed == profilePhotoUrl
                ? _value.profilePhotoUrl
                : profilePhotoUrl // ignore: cast_nullable_to_non_nullable
                    as String?,
        designation:
            freezed == designation
                ? _value.designation
                : designation // ignore: cast_nullable_to_non_nullable
                    as String?,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$CourseInstructorImpl implements _CourseInstructor {
  const _$CourseInstructorImpl({
    required this.id,
    required this.fullName,
    this.profilePhotoUrl,
    this.designation,
  });

  factory _$CourseInstructorImpl.fromJson(Map<String, dynamic> json) =>
      _$$CourseInstructorImplFromJson(json);

  @override
  final String id;
  @override
  final String fullName;
  @override
  final String? profilePhotoUrl;
  @override
  final String? designation;

  @override
  String toString() {
    return 'CourseInstructor(id: $id, fullName: $fullName, profilePhotoUrl: $profilePhotoUrl, designation: $designation)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$CourseInstructorImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.fullName, fullName) ||
                other.fullName == fullName) &&
            (identical(other.profilePhotoUrl, profilePhotoUrl) ||
                other.profilePhotoUrl == profilePhotoUrl) &&
            (identical(other.designation, designation) ||
                other.designation == designation));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, id, fullName, profilePhotoUrl, designation);

  /// Create a copy of CourseInstructor
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$CourseInstructorImplCopyWith<_$CourseInstructorImpl> get copyWith =>
      __$$CourseInstructorImplCopyWithImpl<_$CourseInstructorImpl>(
        this,
        _$identity,
      );

  @override
  Map<String, dynamic> toJson() {
    return _$$CourseInstructorImplToJson(this);
  }
}

abstract class _CourseInstructor implements CourseInstructor {
  const factory _CourseInstructor({
    required final String id,
    required final String fullName,
    final String? profilePhotoUrl,
    final String? designation,
  }) = _$CourseInstructorImpl;

  factory _CourseInstructor.fromJson(Map<String, dynamic> json) =
      _$CourseInstructorImpl.fromJson;

  @override
  String get id;
  @override
  String get fullName;
  @override
  String? get profilePhotoUrl;
  @override
  String? get designation;

  /// Create a copy of CourseInstructor
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$CourseInstructorImplCopyWith<_$CourseInstructorImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

CourseCount _$CourseCountFromJson(Map<String, dynamic> json) {
  return _CourseCount.fromJson(json);
}

/// @nodoc
mixin _$CourseCount {
  int get lessons => throw _privateConstructorUsedError;
  int get enrollments => throw _privateConstructorUsedError;

  /// Serializes this CourseCount to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of CourseCount
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $CourseCountCopyWith<CourseCount> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $CourseCountCopyWith<$Res> {
  factory $CourseCountCopyWith(
    CourseCount value,
    $Res Function(CourseCount) then,
  ) = _$CourseCountCopyWithImpl<$Res, CourseCount>;
  @useResult
  $Res call({int lessons, int enrollments});
}

/// @nodoc
class _$CourseCountCopyWithImpl<$Res, $Val extends CourseCount>
    implements $CourseCountCopyWith<$Res> {
  _$CourseCountCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of CourseCount
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? lessons = null, Object? enrollments = null}) {
    return _then(
      _value.copyWith(
            lessons:
                null == lessons
                    ? _value.lessons
                    : lessons // ignore: cast_nullable_to_non_nullable
                        as int,
            enrollments:
                null == enrollments
                    ? _value.enrollments
                    : enrollments // ignore: cast_nullable_to_non_nullable
                        as int,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$CourseCountImplCopyWith<$Res>
    implements $CourseCountCopyWith<$Res> {
  factory _$$CourseCountImplCopyWith(
    _$CourseCountImpl value,
    $Res Function(_$CourseCountImpl) then,
  ) = __$$CourseCountImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({int lessons, int enrollments});
}

/// @nodoc
class __$$CourseCountImplCopyWithImpl<$Res>
    extends _$CourseCountCopyWithImpl<$Res, _$CourseCountImpl>
    implements _$$CourseCountImplCopyWith<$Res> {
  __$$CourseCountImplCopyWithImpl(
    _$CourseCountImpl _value,
    $Res Function(_$CourseCountImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of CourseCount
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? lessons = null, Object? enrollments = null}) {
    return _then(
      _$CourseCountImpl(
        lessons:
            null == lessons
                ? _value.lessons
                : lessons // ignore: cast_nullable_to_non_nullable
                    as int,
        enrollments:
            null == enrollments
                ? _value.enrollments
                : enrollments // ignore: cast_nullable_to_non_nullable
                    as int,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$CourseCountImpl implements _CourseCount {
  const _$CourseCountImpl({this.lessons = 0, this.enrollments = 0});

  factory _$CourseCountImpl.fromJson(Map<String, dynamic> json) =>
      _$$CourseCountImplFromJson(json);

  @override
  @JsonKey()
  final int lessons;
  @override
  @JsonKey()
  final int enrollments;

  @override
  String toString() {
    return 'CourseCount(lessons: $lessons, enrollments: $enrollments)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$CourseCountImpl &&
            (identical(other.lessons, lessons) || other.lessons == lessons) &&
            (identical(other.enrollments, enrollments) ||
                other.enrollments == enrollments));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, lessons, enrollments);

  /// Create a copy of CourseCount
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$CourseCountImplCopyWith<_$CourseCountImpl> get copyWith =>
      __$$CourseCountImplCopyWithImpl<_$CourseCountImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$CourseCountImplToJson(this);
  }
}

abstract class _CourseCount implements CourseCount {
  const factory _CourseCount({final int lessons, final int enrollments}) =
      _$CourseCountImpl;

  factory _CourseCount.fromJson(Map<String, dynamic> json) =
      _$CourseCountImpl.fromJson;

  @override
  int get lessons;
  @override
  int get enrollments;

  /// Create a copy of CourseCount
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$CourseCountImplCopyWith<_$CourseCountImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

Course _$CourseFromJson(Map<String, dynamic> json) {
  return _Course.fromJson(json);
}

/// @nodoc
mixin _$Course {
  String get id => throw _privateConstructorUsedError;
  String get slug => throw _privateConstructorUsedError;
  String get title => throw _privateConstructorUsedError;
  String? get description => throw _privateConstructorUsedError;
  String? get thumbnailUrl => throw _privateConstructorUsedError;
  String? get level => throw _privateConstructorUsedError;
  double? get durationHours => throw _privateConstructorUsedError;
  String? get durationDisplay => throw _privateConstructorUsedError;
  double? get price => throw _privateConstructorUsedError;
  bool get isPublished => throw _privateConstructorUsedError;
  bool get isFeatured => throw _privateConstructorUsedError;
  int get xpPerEpisode => throw _privateConstructorUsedError;
  bool get hasAccess => throw _privateConstructorUsedError;
  CourseInstructor? get instructor => throw _privateConstructorUsedError;
  @JsonKey(name: '_count')
  CourseCount? get count => throw _privateConstructorUsedError;

  /// Serializes this Course to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of Course
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $CourseCopyWith<Course> get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $CourseCopyWith<$Res> {
  factory $CourseCopyWith(Course value, $Res Function(Course) then) =
      _$CourseCopyWithImpl<$Res, Course>;
  @useResult
  $Res call({
    String id,
    String slug,
    String title,
    String? description,
    String? thumbnailUrl,
    String? level,
    double? durationHours,
    String? durationDisplay,
    double? price,
    bool isPublished,
    bool isFeatured,
    int xpPerEpisode,
    bool hasAccess,
    CourseInstructor? instructor,
    @JsonKey(name: '_count') CourseCount? count,
  });

  $CourseInstructorCopyWith<$Res>? get instructor;
  $CourseCountCopyWith<$Res>? get count;
}

/// @nodoc
class _$CourseCopyWithImpl<$Res, $Val extends Course>
    implements $CourseCopyWith<$Res> {
  _$CourseCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of Course
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? slug = null,
    Object? title = null,
    Object? description = freezed,
    Object? thumbnailUrl = freezed,
    Object? level = freezed,
    Object? durationHours = freezed,
    Object? durationDisplay = freezed,
    Object? price = freezed,
    Object? isPublished = null,
    Object? isFeatured = null,
    Object? xpPerEpisode = null,
    Object? hasAccess = null,
    Object? instructor = freezed,
    Object? count = freezed,
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
            level:
                freezed == level
                    ? _value.level
                    : level // ignore: cast_nullable_to_non_nullable
                        as String?,
            durationHours:
                freezed == durationHours
                    ? _value.durationHours
                    : durationHours // ignore: cast_nullable_to_non_nullable
                        as double?,
            durationDisplay:
                freezed == durationDisplay
                    ? _value.durationDisplay
                    : durationDisplay // ignore: cast_nullable_to_non_nullable
                        as String?,
            price:
                freezed == price
                    ? _value.price
                    : price // ignore: cast_nullable_to_non_nullable
                        as double?,
            isPublished:
                null == isPublished
                    ? _value.isPublished
                    : isPublished // ignore: cast_nullable_to_non_nullable
                        as bool,
            isFeatured:
                null == isFeatured
                    ? _value.isFeatured
                    : isFeatured // ignore: cast_nullable_to_non_nullable
                        as bool,
            xpPerEpisode:
                null == xpPerEpisode
                    ? _value.xpPerEpisode
                    : xpPerEpisode // ignore: cast_nullable_to_non_nullable
                        as int,
            hasAccess:
                null == hasAccess
                    ? _value.hasAccess
                    : hasAccess // ignore: cast_nullable_to_non_nullable
                        as bool,
            instructor:
                freezed == instructor
                    ? _value.instructor
                    : instructor // ignore: cast_nullable_to_non_nullable
                        as CourseInstructor?,
            count:
                freezed == count
                    ? _value.count
                    : count // ignore: cast_nullable_to_non_nullable
                        as CourseCount?,
          )
          as $Val,
    );
  }

  /// Create a copy of Course
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $CourseInstructorCopyWith<$Res>? get instructor {
    if (_value.instructor == null) {
      return null;
    }

    return $CourseInstructorCopyWith<$Res>(_value.instructor!, (value) {
      return _then(_value.copyWith(instructor: value) as $Val);
    });
  }

  /// Create a copy of Course
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $CourseCountCopyWith<$Res>? get count {
    if (_value.count == null) {
      return null;
    }

    return $CourseCountCopyWith<$Res>(_value.count!, (value) {
      return _then(_value.copyWith(count: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$CourseImplCopyWith<$Res> implements $CourseCopyWith<$Res> {
  factory _$$CourseImplCopyWith(
    _$CourseImpl value,
    $Res Function(_$CourseImpl) then,
  ) = __$$CourseImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    String id,
    String slug,
    String title,
    String? description,
    String? thumbnailUrl,
    String? level,
    double? durationHours,
    String? durationDisplay,
    double? price,
    bool isPublished,
    bool isFeatured,
    int xpPerEpisode,
    bool hasAccess,
    CourseInstructor? instructor,
    @JsonKey(name: '_count') CourseCount? count,
  });

  @override
  $CourseInstructorCopyWith<$Res>? get instructor;
  @override
  $CourseCountCopyWith<$Res>? get count;
}

/// @nodoc
class __$$CourseImplCopyWithImpl<$Res>
    extends _$CourseCopyWithImpl<$Res, _$CourseImpl>
    implements _$$CourseImplCopyWith<$Res> {
  __$$CourseImplCopyWithImpl(
    _$CourseImpl _value,
    $Res Function(_$CourseImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of Course
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? slug = null,
    Object? title = null,
    Object? description = freezed,
    Object? thumbnailUrl = freezed,
    Object? level = freezed,
    Object? durationHours = freezed,
    Object? durationDisplay = freezed,
    Object? price = freezed,
    Object? isPublished = null,
    Object? isFeatured = null,
    Object? xpPerEpisode = null,
    Object? hasAccess = null,
    Object? instructor = freezed,
    Object? count = freezed,
  }) {
    return _then(
      _$CourseImpl(
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
        level:
            freezed == level
                ? _value.level
                : level // ignore: cast_nullable_to_non_nullable
                    as String?,
        durationHours:
            freezed == durationHours
                ? _value.durationHours
                : durationHours // ignore: cast_nullable_to_non_nullable
                    as double?,
        durationDisplay:
            freezed == durationDisplay
                ? _value.durationDisplay
                : durationDisplay // ignore: cast_nullable_to_non_nullable
                    as String?,
        price:
            freezed == price
                ? _value.price
                : price // ignore: cast_nullable_to_non_nullable
                    as double?,
        isPublished:
            null == isPublished
                ? _value.isPublished
                : isPublished // ignore: cast_nullable_to_non_nullable
                    as bool,
        isFeatured:
            null == isFeatured
                ? _value.isFeatured
                : isFeatured // ignore: cast_nullable_to_non_nullable
                    as bool,
        xpPerEpisode:
            null == xpPerEpisode
                ? _value.xpPerEpisode
                : xpPerEpisode // ignore: cast_nullable_to_non_nullable
                    as int,
        hasAccess:
            null == hasAccess
                ? _value.hasAccess
                : hasAccess // ignore: cast_nullable_to_non_nullable
                    as bool,
        instructor:
            freezed == instructor
                ? _value.instructor
                : instructor // ignore: cast_nullable_to_non_nullable
                    as CourseInstructor?,
        count:
            freezed == count
                ? _value.count
                : count // ignore: cast_nullable_to_non_nullable
                    as CourseCount?,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$CourseImpl implements _Course {
  const _$CourseImpl({
    required this.id,
    required this.slug,
    required this.title,
    this.description,
    this.thumbnailUrl,
    this.level,
    this.durationHours,
    this.durationDisplay,
    this.price,
    this.isPublished = true,
    this.isFeatured = false,
    this.xpPerEpisode = 10,
    this.hasAccess = false,
    this.instructor,
    @JsonKey(name: '_count') this.count,
  });

  factory _$CourseImpl.fromJson(Map<String, dynamic> json) =>
      _$$CourseImplFromJson(json);

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
  final String? level;
  @override
  final double? durationHours;
  @override
  final String? durationDisplay;
  @override
  final double? price;
  @override
  @JsonKey()
  final bool isPublished;
  @override
  @JsonKey()
  final bool isFeatured;
  @override
  @JsonKey()
  final int xpPerEpisode;
  @override
  @JsonKey()
  final bool hasAccess;
  @override
  final CourseInstructor? instructor;
  @override
  @JsonKey(name: '_count')
  final CourseCount? count;

  @override
  String toString() {
    return 'Course(id: $id, slug: $slug, title: $title, description: $description, thumbnailUrl: $thumbnailUrl, level: $level, durationHours: $durationHours, durationDisplay: $durationDisplay, price: $price, isPublished: $isPublished, isFeatured: $isFeatured, xpPerEpisode: $xpPerEpisode, hasAccess: $hasAccess, instructor: $instructor, count: $count)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$CourseImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.slug, slug) || other.slug == slug) &&
            (identical(other.title, title) || other.title == title) &&
            (identical(other.description, description) ||
                other.description == description) &&
            (identical(other.thumbnailUrl, thumbnailUrl) ||
                other.thumbnailUrl == thumbnailUrl) &&
            (identical(other.level, level) || other.level == level) &&
            (identical(other.durationHours, durationHours) ||
                other.durationHours == durationHours) &&
            (identical(other.durationDisplay, durationDisplay) ||
                other.durationDisplay == durationDisplay) &&
            (identical(other.price, price) || other.price == price) &&
            (identical(other.isPublished, isPublished) ||
                other.isPublished == isPublished) &&
            (identical(other.isFeatured, isFeatured) ||
                other.isFeatured == isFeatured) &&
            (identical(other.xpPerEpisode, xpPerEpisode) ||
                other.xpPerEpisode == xpPerEpisode) &&
            (identical(other.hasAccess, hasAccess) ||
                other.hasAccess == hasAccess) &&
            (identical(other.instructor, instructor) ||
                other.instructor == instructor) &&
            (identical(other.count, count) || other.count == count));
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
    level,
    durationHours,
    durationDisplay,
    price,
    isPublished,
    isFeatured,
    xpPerEpisode,
    hasAccess,
    instructor,
    count,
  );

  /// Create a copy of Course
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$CourseImplCopyWith<_$CourseImpl> get copyWith =>
      __$$CourseImplCopyWithImpl<_$CourseImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$CourseImplToJson(this);
  }
}

abstract class _Course implements Course {
  const factory _Course({
    required final String id,
    required final String slug,
    required final String title,
    final String? description,
    final String? thumbnailUrl,
    final String? level,
    final double? durationHours,
    final String? durationDisplay,
    final double? price,
    final bool isPublished,
    final bool isFeatured,
    final int xpPerEpisode,
    final bool hasAccess,
    final CourseInstructor? instructor,
    @JsonKey(name: '_count') final CourseCount? count,
  }) = _$CourseImpl;

  factory _Course.fromJson(Map<String, dynamic> json) = _$CourseImpl.fromJson;

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
  String? get level;
  @override
  double? get durationHours;
  @override
  String? get durationDisplay;
  @override
  double? get price;
  @override
  bool get isPublished;
  @override
  bool get isFeatured;
  @override
  int get xpPerEpisode;
  @override
  bool get hasAccess;
  @override
  CourseInstructor? get instructor;
  @override
  @JsonKey(name: '_count')
  CourseCount? get count;

  /// Create a copy of Course
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$CourseImplCopyWith<_$CourseImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

CourseDetail _$CourseDetailFromJson(Map<String, dynamic> json) {
  return _CourseDetail.fromJson(json);
}

/// @nodoc
mixin _$CourseDetail {
  String get id => throw _privateConstructorUsedError;
  String get slug => throw _privateConstructorUsedError;
  String get title => throw _privateConstructorUsedError;
  String? get description => throw _privateConstructorUsedError;
  String? get thumbnailUrl => throw _privateConstructorUsedError;
  String? get level => throw _privateConstructorUsedError;
  double? get durationHours => throw _privateConstructorUsedError;
  double? get price => throw _privateConstructorUsedError;
  bool get isPublished => throw _privateConstructorUsedError;
  bool get isFeatured => throw _privateConstructorUsedError;
  int get xpPerEpisode => throw _privateConstructorUsedError;
  int get passingScorePercent => throw _privateConstructorUsedError;
  String? get paymentLinkUrl => throw _privateConstructorUsedError;
  bool get hasAccess => throw _privateConstructorUsedError;
  String? get accessType => throw _privateConstructorUsedError;
  String? get accessExpiresAt => throw _privateConstructorUsedError;
  CourseInstructor? get instructor => throw _privateConstructorUsedError;
  @JsonKey(name: '_count')
  CourseCount? get count => throw _privateConstructorUsedError;
  List<Lesson> get lessons => throw _privateConstructorUsedError;

  /// Serializes this CourseDetail to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of CourseDetail
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $CourseDetailCopyWith<CourseDetail> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $CourseDetailCopyWith<$Res> {
  factory $CourseDetailCopyWith(
    CourseDetail value,
    $Res Function(CourseDetail) then,
  ) = _$CourseDetailCopyWithImpl<$Res, CourseDetail>;
  @useResult
  $Res call({
    String id,
    String slug,
    String title,
    String? description,
    String? thumbnailUrl,
    String? level,
    double? durationHours,
    double? price,
    bool isPublished,
    bool isFeatured,
    int xpPerEpisode,
    int passingScorePercent,
    String? paymentLinkUrl,
    bool hasAccess,
    String? accessType,
    String? accessExpiresAt,
    CourseInstructor? instructor,
    @JsonKey(name: '_count') CourseCount? count,
    List<Lesson> lessons,
  });

  $CourseInstructorCopyWith<$Res>? get instructor;
  $CourseCountCopyWith<$Res>? get count;
}

/// @nodoc
class _$CourseDetailCopyWithImpl<$Res, $Val extends CourseDetail>
    implements $CourseDetailCopyWith<$Res> {
  _$CourseDetailCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of CourseDetail
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? slug = null,
    Object? title = null,
    Object? description = freezed,
    Object? thumbnailUrl = freezed,
    Object? level = freezed,
    Object? durationHours = freezed,
    Object? price = freezed,
    Object? isPublished = null,
    Object? isFeatured = null,
    Object? xpPerEpisode = null,
    Object? passingScorePercent = null,
    Object? paymentLinkUrl = freezed,
    Object? hasAccess = null,
    Object? accessType = freezed,
    Object? accessExpiresAt = freezed,
    Object? instructor = freezed,
    Object? count = freezed,
    Object? lessons = null,
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
            level:
                freezed == level
                    ? _value.level
                    : level // ignore: cast_nullable_to_non_nullable
                        as String?,
            durationHours:
                freezed == durationHours
                    ? _value.durationHours
                    : durationHours // ignore: cast_nullable_to_non_nullable
                        as double?,
            price:
                freezed == price
                    ? _value.price
                    : price // ignore: cast_nullable_to_non_nullable
                        as double?,
            isPublished:
                null == isPublished
                    ? _value.isPublished
                    : isPublished // ignore: cast_nullable_to_non_nullable
                        as bool,
            isFeatured:
                null == isFeatured
                    ? _value.isFeatured
                    : isFeatured // ignore: cast_nullable_to_non_nullable
                        as bool,
            xpPerEpisode:
                null == xpPerEpisode
                    ? _value.xpPerEpisode
                    : xpPerEpisode // ignore: cast_nullable_to_non_nullable
                        as int,
            passingScorePercent:
                null == passingScorePercent
                    ? _value.passingScorePercent
                    : passingScorePercent // ignore: cast_nullable_to_non_nullable
                        as int,
            paymentLinkUrl:
                freezed == paymentLinkUrl
                    ? _value.paymentLinkUrl
                    : paymentLinkUrl // ignore: cast_nullable_to_non_nullable
                        as String?,
            hasAccess:
                null == hasAccess
                    ? _value.hasAccess
                    : hasAccess // ignore: cast_nullable_to_non_nullable
                        as bool,
            accessType:
                freezed == accessType
                    ? _value.accessType
                    : accessType // ignore: cast_nullable_to_non_nullable
                        as String?,
            accessExpiresAt:
                freezed == accessExpiresAt
                    ? _value.accessExpiresAt
                    : accessExpiresAt // ignore: cast_nullable_to_non_nullable
                        as String?,
            instructor:
                freezed == instructor
                    ? _value.instructor
                    : instructor // ignore: cast_nullable_to_non_nullable
                        as CourseInstructor?,
            count:
                freezed == count
                    ? _value.count
                    : count // ignore: cast_nullable_to_non_nullable
                        as CourseCount?,
            lessons:
                null == lessons
                    ? _value.lessons
                    : lessons // ignore: cast_nullable_to_non_nullable
                        as List<Lesson>,
          )
          as $Val,
    );
  }

  /// Create a copy of CourseDetail
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $CourseInstructorCopyWith<$Res>? get instructor {
    if (_value.instructor == null) {
      return null;
    }

    return $CourseInstructorCopyWith<$Res>(_value.instructor!, (value) {
      return _then(_value.copyWith(instructor: value) as $Val);
    });
  }

  /// Create a copy of CourseDetail
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $CourseCountCopyWith<$Res>? get count {
    if (_value.count == null) {
      return null;
    }

    return $CourseCountCopyWith<$Res>(_value.count!, (value) {
      return _then(_value.copyWith(count: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$CourseDetailImplCopyWith<$Res>
    implements $CourseDetailCopyWith<$Res> {
  factory _$$CourseDetailImplCopyWith(
    _$CourseDetailImpl value,
    $Res Function(_$CourseDetailImpl) then,
  ) = __$$CourseDetailImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    String id,
    String slug,
    String title,
    String? description,
    String? thumbnailUrl,
    String? level,
    double? durationHours,
    double? price,
    bool isPublished,
    bool isFeatured,
    int xpPerEpisode,
    int passingScorePercent,
    String? paymentLinkUrl,
    bool hasAccess,
    String? accessType,
    String? accessExpiresAt,
    CourseInstructor? instructor,
    @JsonKey(name: '_count') CourseCount? count,
    List<Lesson> lessons,
  });

  @override
  $CourseInstructorCopyWith<$Res>? get instructor;
  @override
  $CourseCountCopyWith<$Res>? get count;
}

/// @nodoc
class __$$CourseDetailImplCopyWithImpl<$Res>
    extends _$CourseDetailCopyWithImpl<$Res, _$CourseDetailImpl>
    implements _$$CourseDetailImplCopyWith<$Res> {
  __$$CourseDetailImplCopyWithImpl(
    _$CourseDetailImpl _value,
    $Res Function(_$CourseDetailImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of CourseDetail
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? slug = null,
    Object? title = null,
    Object? description = freezed,
    Object? thumbnailUrl = freezed,
    Object? level = freezed,
    Object? durationHours = freezed,
    Object? price = freezed,
    Object? isPublished = null,
    Object? isFeatured = null,
    Object? xpPerEpisode = null,
    Object? passingScorePercent = null,
    Object? paymentLinkUrl = freezed,
    Object? hasAccess = null,
    Object? accessType = freezed,
    Object? accessExpiresAt = freezed,
    Object? instructor = freezed,
    Object? count = freezed,
    Object? lessons = null,
  }) {
    return _then(
      _$CourseDetailImpl(
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
        level:
            freezed == level
                ? _value.level
                : level // ignore: cast_nullable_to_non_nullable
                    as String?,
        durationHours:
            freezed == durationHours
                ? _value.durationHours
                : durationHours // ignore: cast_nullable_to_non_nullable
                    as double?,
        price:
            freezed == price
                ? _value.price
                : price // ignore: cast_nullable_to_non_nullable
                    as double?,
        isPublished:
            null == isPublished
                ? _value.isPublished
                : isPublished // ignore: cast_nullable_to_non_nullable
                    as bool,
        isFeatured:
            null == isFeatured
                ? _value.isFeatured
                : isFeatured // ignore: cast_nullable_to_non_nullable
                    as bool,
        xpPerEpisode:
            null == xpPerEpisode
                ? _value.xpPerEpisode
                : xpPerEpisode // ignore: cast_nullable_to_non_nullable
                    as int,
        passingScorePercent:
            null == passingScorePercent
                ? _value.passingScorePercent
                : passingScorePercent // ignore: cast_nullable_to_non_nullable
                    as int,
        paymentLinkUrl:
            freezed == paymentLinkUrl
                ? _value.paymentLinkUrl
                : paymentLinkUrl // ignore: cast_nullable_to_non_nullable
                    as String?,
        hasAccess:
            null == hasAccess
                ? _value.hasAccess
                : hasAccess // ignore: cast_nullable_to_non_nullable
                    as bool,
        accessType:
            freezed == accessType
                ? _value.accessType
                : accessType // ignore: cast_nullable_to_non_nullable
                    as String?,
        accessExpiresAt:
            freezed == accessExpiresAt
                ? _value.accessExpiresAt
                : accessExpiresAt // ignore: cast_nullable_to_non_nullable
                    as String?,
        instructor:
            freezed == instructor
                ? _value.instructor
                : instructor // ignore: cast_nullable_to_non_nullable
                    as CourseInstructor?,
        count:
            freezed == count
                ? _value.count
                : count // ignore: cast_nullable_to_non_nullable
                    as CourseCount?,
        lessons:
            null == lessons
                ? _value._lessons
                : lessons // ignore: cast_nullable_to_non_nullable
                    as List<Lesson>,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$CourseDetailImpl implements _CourseDetail {
  const _$CourseDetailImpl({
    required this.id,
    required this.slug,
    required this.title,
    this.description,
    this.thumbnailUrl,
    this.level,
    this.durationHours,
    this.price,
    this.isPublished = true,
    this.isFeatured = false,
    this.xpPerEpisode = 10,
    this.passingScorePercent = 70,
    this.paymentLinkUrl,
    this.hasAccess = false,
    this.accessType,
    this.accessExpiresAt,
    this.instructor,
    @JsonKey(name: '_count') this.count,
    final List<Lesson> lessons = const [],
  }) : _lessons = lessons;

  factory _$CourseDetailImpl.fromJson(Map<String, dynamic> json) =>
      _$$CourseDetailImplFromJson(json);

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
  final String? level;
  @override
  final double? durationHours;
  @override
  final double? price;
  @override
  @JsonKey()
  final bool isPublished;
  @override
  @JsonKey()
  final bool isFeatured;
  @override
  @JsonKey()
  final int xpPerEpisode;
  @override
  @JsonKey()
  final int passingScorePercent;
  @override
  final String? paymentLinkUrl;
  @override
  @JsonKey()
  final bool hasAccess;
  @override
  final String? accessType;
  @override
  final String? accessExpiresAt;
  @override
  final CourseInstructor? instructor;
  @override
  @JsonKey(name: '_count')
  final CourseCount? count;
  final List<Lesson> _lessons;
  @override
  @JsonKey()
  List<Lesson> get lessons {
    if (_lessons is EqualUnmodifiableListView) return _lessons;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_lessons);
  }

  @override
  String toString() {
    return 'CourseDetail(id: $id, slug: $slug, title: $title, description: $description, thumbnailUrl: $thumbnailUrl, level: $level, durationHours: $durationHours, price: $price, isPublished: $isPublished, isFeatured: $isFeatured, xpPerEpisode: $xpPerEpisode, passingScorePercent: $passingScorePercent, paymentLinkUrl: $paymentLinkUrl, hasAccess: $hasAccess, accessType: $accessType, accessExpiresAt: $accessExpiresAt, instructor: $instructor, count: $count, lessons: $lessons)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$CourseDetailImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.slug, slug) || other.slug == slug) &&
            (identical(other.title, title) || other.title == title) &&
            (identical(other.description, description) ||
                other.description == description) &&
            (identical(other.thumbnailUrl, thumbnailUrl) ||
                other.thumbnailUrl == thumbnailUrl) &&
            (identical(other.level, level) || other.level == level) &&
            (identical(other.durationHours, durationHours) ||
                other.durationHours == durationHours) &&
            (identical(other.price, price) || other.price == price) &&
            (identical(other.isPublished, isPublished) ||
                other.isPublished == isPublished) &&
            (identical(other.isFeatured, isFeatured) ||
                other.isFeatured == isFeatured) &&
            (identical(other.xpPerEpisode, xpPerEpisode) ||
                other.xpPerEpisode == xpPerEpisode) &&
            (identical(other.passingScorePercent, passingScorePercent) ||
                other.passingScorePercent == passingScorePercent) &&
            (identical(other.paymentLinkUrl, paymentLinkUrl) ||
                other.paymentLinkUrl == paymentLinkUrl) &&
            (identical(other.hasAccess, hasAccess) ||
                other.hasAccess == hasAccess) &&
            (identical(other.accessType, accessType) ||
                other.accessType == accessType) &&
            (identical(other.accessExpiresAt, accessExpiresAt) ||
                other.accessExpiresAt == accessExpiresAt) &&
            (identical(other.instructor, instructor) ||
                other.instructor == instructor) &&
            (identical(other.count, count) || other.count == count) &&
            const DeepCollectionEquality().equals(other._lessons, _lessons));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hashAll([
    runtimeType,
    id,
    slug,
    title,
    description,
    thumbnailUrl,
    level,
    durationHours,
    price,
    isPublished,
    isFeatured,
    xpPerEpisode,
    passingScorePercent,
    paymentLinkUrl,
    hasAccess,
    accessType,
    accessExpiresAt,
    instructor,
    count,
    const DeepCollectionEquality().hash(_lessons),
  ]);

  /// Create a copy of CourseDetail
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$CourseDetailImplCopyWith<_$CourseDetailImpl> get copyWith =>
      __$$CourseDetailImplCopyWithImpl<_$CourseDetailImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$CourseDetailImplToJson(this);
  }
}

abstract class _CourseDetail implements CourseDetail {
  const factory _CourseDetail({
    required final String id,
    required final String slug,
    required final String title,
    final String? description,
    final String? thumbnailUrl,
    final String? level,
    final double? durationHours,
    final double? price,
    final bool isPublished,
    final bool isFeatured,
    final int xpPerEpisode,
    final int passingScorePercent,
    final String? paymentLinkUrl,
    final bool hasAccess,
    final String? accessType,
    final String? accessExpiresAt,
    final CourseInstructor? instructor,
    @JsonKey(name: '_count') final CourseCount? count,
    final List<Lesson> lessons,
  }) = _$CourseDetailImpl;

  factory _CourseDetail.fromJson(Map<String, dynamic> json) =
      _$CourseDetailImpl.fromJson;

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
  String? get level;
  @override
  double? get durationHours;
  @override
  double? get price;
  @override
  bool get isPublished;
  @override
  bool get isFeatured;
  @override
  int get xpPerEpisode;
  @override
  int get passingScorePercent;
  @override
  String? get paymentLinkUrl;
  @override
  bool get hasAccess;
  @override
  String? get accessType;
  @override
  String? get accessExpiresAt;
  @override
  CourseInstructor? get instructor;
  @override
  @JsonKey(name: '_count')
  CourseCount? get count;
  @override
  List<Lesson> get lessons;

  /// Create a copy of CourseDetail
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$CourseDetailImplCopyWith<_$CourseDetailImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

CourseEnrollment _$CourseEnrollmentFromJson(Map<String, dynamic> json) {
  return _CourseEnrollment.fromJson(json);
}

/// @nodoc
mixin _$CourseEnrollment {
  String get id => throw _privateConstructorUsedError;
  String get courseId => throw _privateConstructorUsedError;
  String get memberId => throw _privateConstructorUsedError;
  String get enrolledAt => throw _privateConstructorUsedError;
  String? get completedAt => throw _privateConstructorUsedError;
  int get progressPercent => throw _privateConstructorUsedError;
  Course? get course => throw _privateConstructorUsedError;

  /// Serializes this CourseEnrollment to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of CourseEnrollment
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $CourseEnrollmentCopyWith<CourseEnrollment> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $CourseEnrollmentCopyWith<$Res> {
  factory $CourseEnrollmentCopyWith(
    CourseEnrollment value,
    $Res Function(CourseEnrollment) then,
  ) = _$CourseEnrollmentCopyWithImpl<$Res, CourseEnrollment>;
  @useResult
  $Res call({
    String id,
    String courseId,
    String memberId,
    String enrolledAt,
    String? completedAt,
    int progressPercent,
    Course? course,
  });

  $CourseCopyWith<$Res>? get course;
}

/// @nodoc
class _$CourseEnrollmentCopyWithImpl<$Res, $Val extends CourseEnrollment>
    implements $CourseEnrollmentCopyWith<$Res> {
  _$CourseEnrollmentCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of CourseEnrollment
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? courseId = null,
    Object? memberId = null,
    Object? enrolledAt = null,
    Object? completedAt = freezed,
    Object? progressPercent = null,
    Object? course = freezed,
  }) {
    return _then(
      _value.copyWith(
            id:
                null == id
                    ? _value.id
                    : id // ignore: cast_nullable_to_non_nullable
                        as String,
            courseId:
                null == courseId
                    ? _value.courseId
                    : courseId // ignore: cast_nullable_to_non_nullable
                        as String,
            memberId:
                null == memberId
                    ? _value.memberId
                    : memberId // ignore: cast_nullable_to_non_nullable
                        as String,
            enrolledAt:
                null == enrolledAt
                    ? _value.enrolledAt
                    : enrolledAt // ignore: cast_nullable_to_non_nullable
                        as String,
            completedAt:
                freezed == completedAt
                    ? _value.completedAt
                    : completedAt // ignore: cast_nullable_to_non_nullable
                        as String?,
            progressPercent:
                null == progressPercent
                    ? _value.progressPercent
                    : progressPercent // ignore: cast_nullable_to_non_nullable
                        as int,
            course:
                freezed == course
                    ? _value.course
                    : course // ignore: cast_nullable_to_non_nullable
                        as Course?,
          )
          as $Val,
    );
  }

  /// Create a copy of CourseEnrollment
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $CourseCopyWith<$Res>? get course {
    if (_value.course == null) {
      return null;
    }

    return $CourseCopyWith<$Res>(_value.course!, (value) {
      return _then(_value.copyWith(course: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$CourseEnrollmentImplCopyWith<$Res>
    implements $CourseEnrollmentCopyWith<$Res> {
  factory _$$CourseEnrollmentImplCopyWith(
    _$CourseEnrollmentImpl value,
    $Res Function(_$CourseEnrollmentImpl) then,
  ) = __$$CourseEnrollmentImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    String id,
    String courseId,
    String memberId,
    String enrolledAt,
    String? completedAt,
    int progressPercent,
    Course? course,
  });

  @override
  $CourseCopyWith<$Res>? get course;
}

/// @nodoc
class __$$CourseEnrollmentImplCopyWithImpl<$Res>
    extends _$CourseEnrollmentCopyWithImpl<$Res, _$CourseEnrollmentImpl>
    implements _$$CourseEnrollmentImplCopyWith<$Res> {
  __$$CourseEnrollmentImplCopyWithImpl(
    _$CourseEnrollmentImpl _value,
    $Res Function(_$CourseEnrollmentImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of CourseEnrollment
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? courseId = null,
    Object? memberId = null,
    Object? enrolledAt = null,
    Object? completedAt = freezed,
    Object? progressPercent = null,
    Object? course = freezed,
  }) {
    return _then(
      _$CourseEnrollmentImpl(
        id:
            null == id
                ? _value.id
                : id // ignore: cast_nullable_to_non_nullable
                    as String,
        courseId:
            null == courseId
                ? _value.courseId
                : courseId // ignore: cast_nullable_to_non_nullable
                    as String,
        memberId:
            null == memberId
                ? _value.memberId
                : memberId // ignore: cast_nullable_to_non_nullable
                    as String,
        enrolledAt:
            null == enrolledAt
                ? _value.enrolledAt
                : enrolledAt // ignore: cast_nullable_to_non_nullable
                    as String,
        completedAt:
            freezed == completedAt
                ? _value.completedAt
                : completedAt // ignore: cast_nullable_to_non_nullable
                    as String?,
        progressPercent:
            null == progressPercent
                ? _value.progressPercent
                : progressPercent // ignore: cast_nullable_to_non_nullable
                    as int,
        course:
            freezed == course
                ? _value.course
                : course // ignore: cast_nullable_to_non_nullable
                    as Course?,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$CourseEnrollmentImpl implements _CourseEnrollment {
  const _$CourseEnrollmentImpl({
    required this.id,
    required this.courseId,
    required this.memberId,
    required this.enrolledAt,
    this.completedAt,
    this.progressPercent = 0,
    this.course,
  });

  factory _$CourseEnrollmentImpl.fromJson(Map<String, dynamic> json) =>
      _$$CourseEnrollmentImplFromJson(json);

  @override
  final String id;
  @override
  final String courseId;
  @override
  final String memberId;
  @override
  final String enrolledAt;
  @override
  final String? completedAt;
  @override
  @JsonKey()
  final int progressPercent;
  @override
  final Course? course;

  @override
  String toString() {
    return 'CourseEnrollment(id: $id, courseId: $courseId, memberId: $memberId, enrolledAt: $enrolledAt, completedAt: $completedAt, progressPercent: $progressPercent, course: $course)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$CourseEnrollmentImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.courseId, courseId) ||
                other.courseId == courseId) &&
            (identical(other.memberId, memberId) ||
                other.memberId == memberId) &&
            (identical(other.enrolledAt, enrolledAt) ||
                other.enrolledAt == enrolledAt) &&
            (identical(other.completedAt, completedAt) ||
                other.completedAt == completedAt) &&
            (identical(other.progressPercent, progressPercent) ||
                other.progressPercent == progressPercent) &&
            (identical(other.course, course) || other.course == course));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
    runtimeType,
    id,
    courseId,
    memberId,
    enrolledAt,
    completedAt,
    progressPercent,
    course,
  );

  /// Create a copy of CourseEnrollment
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$CourseEnrollmentImplCopyWith<_$CourseEnrollmentImpl> get copyWith =>
      __$$CourseEnrollmentImplCopyWithImpl<_$CourseEnrollmentImpl>(
        this,
        _$identity,
      );

  @override
  Map<String, dynamic> toJson() {
    return _$$CourseEnrollmentImplToJson(this);
  }
}

abstract class _CourseEnrollment implements CourseEnrollment {
  const factory _CourseEnrollment({
    required final String id,
    required final String courseId,
    required final String memberId,
    required final String enrolledAt,
    final String? completedAt,
    final int progressPercent,
    final Course? course,
  }) = _$CourseEnrollmentImpl;

  factory _CourseEnrollment.fromJson(Map<String, dynamic> json) =
      _$CourseEnrollmentImpl.fromJson;

  @override
  String get id;
  @override
  String get courseId;
  @override
  String get memberId;
  @override
  String get enrolledAt;
  @override
  String? get completedAt;
  @override
  int get progressPercent;
  @override
  Course? get course;

  /// Create a copy of CourseEnrollment
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$CourseEnrollmentImplCopyWith<_$CourseEnrollmentImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
