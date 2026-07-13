// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'conversation.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

LastMessage _$LastMessageFromJson(Map<String, dynamic> json) {
  return _LastMessage.fromJson(json);
}

/// @nodoc
mixin _$LastMessage {
  String get body => throw _privateConstructorUsedError;
  String get senderType => throw _privateConstructorUsedError;
  String get createdAt => throw _privateConstructorUsedError;

  /// Serializes this LastMessage to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of LastMessage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $LastMessageCopyWith<LastMessage> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $LastMessageCopyWith<$Res> {
  factory $LastMessageCopyWith(
    LastMessage value,
    $Res Function(LastMessage) then,
  ) = _$LastMessageCopyWithImpl<$Res, LastMessage>;
  @useResult
  $Res call({String body, String senderType, String createdAt});
}

/// @nodoc
class _$LastMessageCopyWithImpl<$Res, $Val extends LastMessage>
    implements $LastMessageCopyWith<$Res> {
  _$LastMessageCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of LastMessage
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? body = null,
    Object? senderType = null,
    Object? createdAt = null,
  }) {
    return _then(
      _value.copyWith(
            body:
                null == body
                    ? _value.body
                    : body // ignore: cast_nullable_to_non_nullable
                        as String,
            senderType:
                null == senderType
                    ? _value.senderType
                    : senderType // ignore: cast_nullable_to_non_nullable
                        as String,
            createdAt:
                null == createdAt
                    ? _value.createdAt
                    : createdAt // ignore: cast_nullable_to_non_nullable
                        as String,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$LastMessageImplCopyWith<$Res>
    implements $LastMessageCopyWith<$Res> {
  factory _$$LastMessageImplCopyWith(
    _$LastMessageImpl value,
    $Res Function(_$LastMessageImpl) then,
  ) = __$$LastMessageImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String body, String senderType, String createdAt});
}

/// @nodoc
class __$$LastMessageImplCopyWithImpl<$Res>
    extends _$LastMessageCopyWithImpl<$Res, _$LastMessageImpl>
    implements _$$LastMessageImplCopyWith<$Res> {
  __$$LastMessageImplCopyWithImpl(
    _$LastMessageImpl _value,
    $Res Function(_$LastMessageImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of LastMessage
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? body = null,
    Object? senderType = null,
    Object? createdAt = null,
  }) {
    return _then(
      _$LastMessageImpl(
        body:
            null == body
                ? _value.body
                : body // ignore: cast_nullable_to_non_nullable
                    as String,
        senderType:
            null == senderType
                ? _value.senderType
                : senderType // ignore: cast_nullable_to_non_nullable
                    as String,
        createdAt:
            null == createdAt
                ? _value.createdAt
                : createdAt // ignore: cast_nullable_to_non_nullable
                    as String,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$LastMessageImpl implements _LastMessage {
  const _$LastMessageImpl({
    required this.body,
    required this.senderType,
    required this.createdAt,
  });

  factory _$LastMessageImpl.fromJson(Map<String, dynamic> json) =>
      _$$LastMessageImplFromJson(json);

  @override
  final String body;
  @override
  final String senderType;
  @override
  final String createdAt;

  @override
  String toString() {
    return 'LastMessage(body: $body, senderType: $senderType, createdAt: $createdAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$LastMessageImpl &&
            (identical(other.body, body) || other.body == body) &&
            (identical(other.senderType, senderType) ||
                other.senderType == senderType) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, body, senderType, createdAt);

  /// Create a copy of LastMessage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$LastMessageImplCopyWith<_$LastMessageImpl> get copyWith =>
      __$$LastMessageImplCopyWithImpl<_$LastMessageImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$LastMessageImplToJson(this);
  }
}

abstract class _LastMessage implements LastMessage {
  const factory _LastMessage({
    required final String body,
    required final String senderType,
    required final String createdAt,
  }) = _$LastMessageImpl;

  factory _LastMessage.fromJson(Map<String, dynamic> json) =
      _$LastMessageImpl.fromJson;

  @override
  String get body;
  @override
  String get senderType;
  @override
  String get createdAt;

  /// Create a copy of LastMessage
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$LastMessageImplCopyWith<_$LastMessageImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

Conversation _$ConversationFromJson(Map<String, dynamic> json) {
  return _Conversation.fromJson(json);
}

/// @nodoc
mixin _$Conversation {
  String get id => throw _privateConstructorUsedError;
  String get subject => throw _privateConstructorUsedError;
  String get status => throw _privateConstructorUsedError;
  int get memberUnreadCount => throw _privateConstructorUsedError;
  String? get lastMessageAt => throw _privateConstructorUsedError;
  LastMessage? get lastMessage => throw _privateConstructorUsedError;

  /// Serializes this Conversation to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of Conversation
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $ConversationCopyWith<Conversation> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ConversationCopyWith<$Res> {
  factory $ConversationCopyWith(
    Conversation value,
    $Res Function(Conversation) then,
  ) = _$ConversationCopyWithImpl<$Res, Conversation>;
  @useResult
  $Res call({
    String id,
    String subject,
    String status,
    int memberUnreadCount,
    String? lastMessageAt,
    LastMessage? lastMessage,
  });

  $LastMessageCopyWith<$Res>? get lastMessage;
}

/// @nodoc
class _$ConversationCopyWithImpl<$Res, $Val extends Conversation>
    implements $ConversationCopyWith<$Res> {
  _$ConversationCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of Conversation
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? subject = null,
    Object? status = null,
    Object? memberUnreadCount = null,
    Object? lastMessageAt = freezed,
    Object? lastMessage = freezed,
  }) {
    return _then(
      _value.copyWith(
            id:
                null == id
                    ? _value.id
                    : id // ignore: cast_nullable_to_non_nullable
                        as String,
            subject:
                null == subject
                    ? _value.subject
                    : subject // ignore: cast_nullable_to_non_nullable
                        as String,
            status:
                null == status
                    ? _value.status
                    : status // ignore: cast_nullable_to_non_nullable
                        as String,
            memberUnreadCount:
                null == memberUnreadCount
                    ? _value.memberUnreadCount
                    : memberUnreadCount // ignore: cast_nullable_to_non_nullable
                        as int,
            lastMessageAt:
                freezed == lastMessageAt
                    ? _value.lastMessageAt
                    : lastMessageAt // ignore: cast_nullable_to_non_nullable
                        as String?,
            lastMessage:
                freezed == lastMessage
                    ? _value.lastMessage
                    : lastMessage // ignore: cast_nullable_to_non_nullable
                        as LastMessage?,
          )
          as $Val,
    );
  }

  /// Create a copy of Conversation
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $LastMessageCopyWith<$Res>? get lastMessage {
    if (_value.lastMessage == null) {
      return null;
    }

    return $LastMessageCopyWith<$Res>(_value.lastMessage!, (value) {
      return _then(_value.copyWith(lastMessage: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$ConversationImplCopyWith<$Res>
    implements $ConversationCopyWith<$Res> {
  factory _$$ConversationImplCopyWith(
    _$ConversationImpl value,
    $Res Function(_$ConversationImpl) then,
  ) = __$$ConversationImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    String id,
    String subject,
    String status,
    int memberUnreadCount,
    String? lastMessageAt,
    LastMessage? lastMessage,
  });

  @override
  $LastMessageCopyWith<$Res>? get lastMessage;
}

/// @nodoc
class __$$ConversationImplCopyWithImpl<$Res>
    extends _$ConversationCopyWithImpl<$Res, _$ConversationImpl>
    implements _$$ConversationImplCopyWith<$Res> {
  __$$ConversationImplCopyWithImpl(
    _$ConversationImpl _value,
    $Res Function(_$ConversationImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of Conversation
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? subject = null,
    Object? status = null,
    Object? memberUnreadCount = null,
    Object? lastMessageAt = freezed,
    Object? lastMessage = freezed,
  }) {
    return _then(
      _$ConversationImpl(
        id:
            null == id
                ? _value.id
                : id // ignore: cast_nullable_to_non_nullable
                    as String,
        subject:
            null == subject
                ? _value.subject
                : subject // ignore: cast_nullable_to_non_nullable
                    as String,
        status:
            null == status
                ? _value.status
                : status // ignore: cast_nullable_to_non_nullable
                    as String,
        memberUnreadCount:
            null == memberUnreadCount
                ? _value.memberUnreadCount
                : memberUnreadCount // ignore: cast_nullable_to_non_nullable
                    as int,
        lastMessageAt:
            freezed == lastMessageAt
                ? _value.lastMessageAt
                : lastMessageAt // ignore: cast_nullable_to_non_nullable
                    as String?,
        lastMessage:
            freezed == lastMessage
                ? _value.lastMessage
                : lastMessage // ignore: cast_nullable_to_non_nullable
                    as LastMessage?,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$ConversationImpl implements _Conversation {
  const _$ConversationImpl({
    required this.id,
    required this.subject,
    required this.status,
    this.memberUnreadCount = 0,
    this.lastMessageAt,
    this.lastMessage,
  });

  factory _$ConversationImpl.fromJson(Map<String, dynamic> json) =>
      _$$ConversationImplFromJson(json);

  @override
  final String id;
  @override
  final String subject;
  @override
  final String status;
  @override
  @JsonKey()
  final int memberUnreadCount;
  @override
  final String? lastMessageAt;
  @override
  final LastMessage? lastMessage;

  @override
  String toString() {
    return 'Conversation(id: $id, subject: $subject, status: $status, memberUnreadCount: $memberUnreadCount, lastMessageAt: $lastMessageAt, lastMessage: $lastMessage)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ConversationImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.subject, subject) || other.subject == subject) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.memberUnreadCount, memberUnreadCount) ||
                other.memberUnreadCount == memberUnreadCount) &&
            (identical(other.lastMessageAt, lastMessageAt) ||
                other.lastMessageAt == lastMessageAt) &&
            (identical(other.lastMessage, lastMessage) ||
                other.lastMessage == lastMessage));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
    runtimeType,
    id,
    subject,
    status,
    memberUnreadCount,
    lastMessageAt,
    lastMessage,
  );

  /// Create a copy of Conversation
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ConversationImplCopyWith<_$ConversationImpl> get copyWith =>
      __$$ConversationImplCopyWithImpl<_$ConversationImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$ConversationImplToJson(this);
  }
}

abstract class _Conversation implements Conversation {
  const factory _Conversation({
    required final String id,
    required final String subject,
    required final String status,
    final int memberUnreadCount,
    final String? lastMessageAt,
    final LastMessage? lastMessage,
  }) = _$ConversationImpl;

  factory _Conversation.fromJson(Map<String, dynamic> json) =
      _$ConversationImpl.fromJson;

  @override
  String get id;
  @override
  String get subject;
  @override
  String get status;
  @override
  int get memberUnreadCount;
  @override
  String? get lastMessageAt;
  @override
  LastMessage? get lastMessage;

  /// Create a copy of Conversation
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ConversationImplCopyWith<_$ConversationImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
