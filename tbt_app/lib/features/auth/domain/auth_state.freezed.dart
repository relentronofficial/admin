// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'auth_state.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

/// @nodoc
mixin _$AuthState {
  AuthStep get step => throw _privateConstructorUsedError;
  Member? get member => throw _privateConstructorUsedError;

  /// Held during session_conflict so the OTP screen can pass it to
  /// completeLogin() when the user confirms they want to continue here.
  String? get pendingToken => throw _privateConstructorUsedError;

  /// Create a copy of AuthState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $AuthStateCopyWith<AuthState> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $AuthStateCopyWith<$Res> {
  factory $AuthStateCopyWith(AuthState value, $Res Function(AuthState) then) =
      _$AuthStateCopyWithImpl<$Res, AuthState>;
  @useResult
  $Res call({AuthStep step, Member? member, String? pendingToken});

  $MemberCopyWith<$Res>? get member;
}

/// @nodoc
class _$AuthStateCopyWithImpl<$Res, $Val extends AuthState>
    implements $AuthStateCopyWith<$Res> {
  _$AuthStateCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of AuthState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? step = null,
    Object? member = freezed,
    Object? pendingToken = freezed,
  }) {
    return _then(
      _value.copyWith(
            step:
                null == step
                    ? _value.step
                    : step // ignore: cast_nullable_to_non_nullable
                        as AuthStep,
            member:
                freezed == member
                    ? _value.member
                    : member // ignore: cast_nullable_to_non_nullable
                        as Member?,
            pendingToken:
                freezed == pendingToken
                    ? _value.pendingToken
                    : pendingToken // ignore: cast_nullable_to_non_nullable
                        as String?,
          )
          as $Val,
    );
  }

  /// Create a copy of AuthState
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $MemberCopyWith<$Res>? get member {
    if (_value.member == null) {
      return null;
    }

    return $MemberCopyWith<$Res>(_value.member!, (value) {
      return _then(_value.copyWith(member: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$AuthStateImplCopyWith<$Res>
    implements $AuthStateCopyWith<$Res> {
  factory _$$AuthStateImplCopyWith(
    _$AuthStateImpl value,
    $Res Function(_$AuthStateImpl) then,
  ) = __$$AuthStateImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({AuthStep step, Member? member, String? pendingToken});

  @override
  $MemberCopyWith<$Res>? get member;
}

/// @nodoc
class __$$AuthStateImplCopyWithImpl<$Res>
    extends _$AuthStateCopyWithImpl<$Res, _$AuthStateImpl>
    implements _$$AuthStateImplCopyWith<$Res> {
  __$$AuthStateImplCopyWithImpl(
    _$AuthStateImpl _value,
    $Res Function(_$AuthStateImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of AuthState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? step = null,
    Object? member = freezed,
    Object? pendingToken = freezed,
  }) {
    return _then(
      _$AuthStateImpl(
        step:
            null == step
                ? _value.step
                : step // ignore: cast_nullable_to_non_nullable
                    as AuthStep,
        member:
            freezed == member
                ? _value.member
                : member // ignore: cast_nullable_to_non_nullable
                    as Member?,
        pendingToken:
            freezed == pendingToken
                ? _value.pendingToken
                : pendingToken // ignore: cast_nullable_to_non_nullable
                    as String?,
      ),
    );
  }
}

/// @nodoc

class _$AuthStateImpl implements _AuthState {
  const _$AuthStateImpl({
    this.step = AuthStep.idle,
    this.member,
    this.pendingToken,
  });

  @override
  @JsonKey()
  final AuthStep step;
  @override
  final Member? member;

  /// Held during session_conflict so the OTP screen can pass it to
  /// completeLogin() when the user confirms they want to continue here.
  @override
  final String? pendingToken;

  @override
  String toString() {
    return 'AuthState(step: $step, member: $member, pendingToken: $pendingToken)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$AuthStateImpl &&
            (identical(other.step, step) || other.step == step) &&
            (identical(other.member, member) || other.member == member) &&
            (identical(other.pendingToken, pendingToken) ||
                other.pendingToken == pendingToken));
  }

  @override
  int get hashCode => Object.hash(runtimeType, step, member, pendingToken);

  /// Create a copy of AuthState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$AuthStateImplCopyWith<_$AuthStateImpl> get copyWith =>
      __$$AuthStateImplCopyWithImpl<_$AuthStateImpl>(this, _$identity);
}

abstract class _AuthState implements AuthState {
  const factory _AuthState({
    final AuthStep step,
    final Member? member,
    final String? pendingToken,
  }) = _$AuthStateImpl;

  @override
  AuthStep get step;
  @override
  Member? get member;

  /// Held during session_conflict so the OTP screen can pass it to
  /// completeLogin() when the user confirms they want to continue here.
  @override
  String? get pendingToken;

  /// Create a copy of AuthState
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$AuthStateImplCopyWith<_$AuthStateImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
