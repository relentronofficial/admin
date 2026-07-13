// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'member.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

Member _$MemberFromJson(Map<String, dynamic> json) {
  return _Member.fromJson(json);
}

/// @nodoc
mixin _$Member {
  String get id => throw _privateConstructorUsedError;
  String get name => throw _privateConstructorUsedError;
  String? get email => throw _privateConstructorUsedError;
  String get phone => throw _privateConstructorUsedError;
  @_MemberStatusConverter()
  MemberStatus get status => throw _privateConstructorUsedError;
  String get membershipPlan => throw _privateConstructorUsedError;
  String? get avatarUrl => throw _privateConstructorUsedError;
  String? get batchId => throw _privateConstructorUsedError;

  /// Serializes this Member to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of Member
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $MemberCopyWith<Member> get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $MemberCopyWith<$Res> {
  factory $MemberCopyWith(Member value, $Res Function(Member) then) =
      _$MemberCopyWithImpl<$Res, Member>;
  @useResult
  $Res call({
    String id,
    String name,
    String? email,
    String phone,
    @_MemberStatusConverter() MemberStatus status,
    String membershipPlan,
    String? avatarUrl,
    String? batchId,
  });
}

/// @nodoc
class _$MemberCopyWithImpl<$Res, $Val extends Member>
    implements $MemberCopyWith<$Res> {
  _$MemberCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of Member
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? name = null,
    Object? email = freezed,
    Object? phone = null,
    Object? status = null,
    Object? membershipPlan = null,
    Object? avatarUrl = freezed,
    Object? batchId = freezed,
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
            email:
                freezed == email
                    ? _value.email
                    : email // ignore: cast_nullable_to_non_nullable
                        as String?,
            phone:
                null == phone
                    ? _value.phone
                    : phone // ignore: cast_nullable_to_non_nullable
                        as String,
            status:
                null == status
                    ? _value.status
                    : status // ignore: cast_nullable_to_non_nullable
                        as MemberStatus,
            membershipPlan:
                null == membershipPlan
                    ? _value.membershipPlan
                    : membershipPlan // ignore: cast_nullable_to_non_nullable
                        as String,
            avatarUrl:
                freezed == avatarUrl
                    ? _value.avatarUrl
                    : avatarUrl // ignore: cast_nullable_to_non_nullable
                        as String?,
            batchId:
                freezed == batchId
                    ? _value.batchId
                    : batchId // ignore: cast_nullable_to_non_nullable
                        as String?,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$MemberImplCopyWith<$Res> implements $MemberCopyWith<$Res> {
  factory _$$MemberImplCopyWith(
    _$MemberImpl value,
    $Res Function(_$MemberImpl) then,
  ) = __$$MemberImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    String id,
    String name,
    String? email,
    String phone,
    @_MemberStatusConverter() MemberStatus status,
    String membershipPlan,
    String? avatarUrl,
    String? batchId,
  });
}

/// @nodoc
class __$$MemberImplCopyWithImpl<$Res>
    extends _$MemberCopyWithImpl<$Res, _$MemberImpl>
    implements _$$MemberImplCopyWith<$Res> {
  __$$MemberImplCopyWithImpl(
    _$MemberImpl _value,
    $Res Function(_$MemberImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of Member
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? name = null,
    Object? email = freezed,
    Object? phone = null,
    Object? status = null,
    Object? membershipPlan = null,
    Object? avatarUrl = freezed,
    Object? batchId = freezed,
  }) {
    return _then(
      _$MemberImpl(
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
        email:
            freezed == email
                ? _value.email
                : email // ignore: cast_nullable_to_non_nullable
                    as String?,
        phone:
            null == phone
                ? _value.phone
                : phone // ignore: cast_nullable_to_non_nullable
                    as String,
        status:
            null == status
                ? _value.status
                : status // ignore: cast_nullable_to_non_nullable
                    as MemberStatus,
        membershipPlan:
            null == membershipPlan
                ? _value.membershipPlan
                : membershipPlan // ignore: cast_nullable_to_non_nullable
                    as String,
        avatarUrl:
            freezed == avatarUrl
                ? _value.avatarUrl
                : avatarUrl // ignore: cast_nullable_to_non_nullable
                    as String?,
        batchId:
            freezed == batchId
                ? _value.batchId
                : batchId // ignore: cast_nullable_to_non_nullable
                    as String?,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$MemberImpl implements _Member {
  const _$MemberImpl({
    required this.id,
    required this.name,
    this.email,
    required this.phone,
    @_MemberStatusConverter() this.status = MemberStatus.active,
    this.membershipPlan = 'free',
    this.avatarUrl,
    this.batchId,
  });

  factory _$MemberImpl.fromJson(Map<String, dynamic> json) =>
      _$$MemberImplFromJson(json);

  @override
  final String id;
  @override
  final String name;
  @override
  final String? email;
  @override
  final String phone;
  @override
  @JsonKey()
  @_MemberStatusConverter()
  final MemberStatus status;
  @override
  @JsonKey()
  final String membershipPlan;
  @override
  final String? avatarUrl;
  @override
  final String? batchId;

  @override
  String toString() {
    return 'Member(id: $id, name: $name, email: $email, phone: $phone, status: $status, membershipPlan: $membershipPlan, avatarUrl: $avatarUrl, batchId: $batchId)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$MemberImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.name, name) || other.name == name) &&
            (identical(other.email, email) || other.email == email) &&
            (identical(other.phone, phone) || other.phone == phone) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.membershipPlan, membershipPlan) ||
                other.membershipPlan == membershipPlan) &&
            (identical(other.avatarUrl, avatarUrl) ||
                other.avatarUrl == avatarUrl) &&
            (identical(other.batchId, batchId) || other.batchId == batchId));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
    runtimeType,
    id,
    name,
    email,
    phone,
    status,
    membershipPlan,
    avatarUrl,
    batchId,
  );

  /// Create a copy of Member
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$MemberImplCopyWith<_$MemberImpl> get copyWith =>
      __$$MemberImplCopyWithImpl<_$MemberImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$MemberImplToJson(this);
  }
}

abstract class _Member implements Member {
  const factory _Member({
    required final String id,
    required final String name,
    final String? email,
    required final String phone,
    @_MemberStatusConverter() final MemberStatus status,
    final String membershipPlan,
    final String? avatarUrl,
    final String? batchId,
  }) = _$MemberImpl;

  factory _Member.fromJson(Map<String, dynamic> json) = _$MemberImpl.fromJson;

  @override
  String get id;
  @override
  String get name;
  @override
  String? get email;
  @override
  String get phone;
  @override
  @_MemberStatusConverter()
  MemberStatus get status;
  @override
  String get membershipPlan;
  @override
  String? get avatarUrl;
  @override
  String? get batchId;

  /// Create a copy of Member
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$MemberImplCopyWith<_$MemberImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
