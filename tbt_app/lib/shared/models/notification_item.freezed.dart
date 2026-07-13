// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'notification_item.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

NotificationItem _$NotificationItemFromJson(Map<String, dynamic> json) {
  return _NotificationItem.fromJson(json);
}

/// @nodoc
mixin _$NotificationItem {
  String get id => throw _privateConstructorUsedError;
  String get type => throw _privateConstructorUsedError;
  String get title => throw _privateConstructorUsedError;
  String get body => throw _privateConstructorUsedError;
  @JsonKey(name: 'data')
  Map<String, dynamic>? get metadata => throw _privateConstructorUsedError;
  bool get isRead => throw _privateConstructorUsedError;
  String get createdAt => throw _privateConstructorUsedError;
  String? get actionUrl => throw _privateConstructorUsedError;
  String? get iconType => throw _privateConstructorUsedError;
  String? get mediaType => throw _privateConstructorUsedError;
  String? get mediaUrl => throw _privateConstructorUsedError;

  /// Serializes this NotificationItem to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of NotificationItem
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $NotificationItemCopyWith<NotificationItem> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $NotificationItemCopyWith<$Res> {
  factory $NotificationItemCopyWith(
    NotificationItem value,
    $Res Function(NotificationItem) then,
  ) = _$NotificationItemCopyWithImpl<$Res, NotificationItem>;
  @useResult
  $Res call({
    String id,
    String type,
    String title,
    String body,
    @JsonKey(name: 'data') Map<String, dynamic>? metadata,
    bool isRead,
    String createdAt,
    String? actionUrl,
    String? iconType,
    String? mediaType,
    String? mediaUrl,
  });
}

/// @nodoc
class _$NotificationItemCopyWithImpl<$Res, $Val extends NotificationItem>
    implements $NotificationItemCopyWith<$Res> {
  _$NotificationItemCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of NotificationItem
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
    Object? title = null,
    Object? body = null,
    Object? metadata = freezed,
    Object? isRead = null,
    Object? createdAt = null,
    Object? actionUrl = freezed,
    Object? iconType = freezed,
    Object? mediaType = freezed,
    Object? mediaUrl = freezed,
  }) {
    return _then(
      _value.copyWith(
            id:
                null == id
                    ? _value.id
                    : id // ignore: cast_nullable_to_non_nullable
                        as String,
            type:
                null == type
                    ? _value.type
                    : type // ignore: cast_nullable_to_non_nullable
                        as String,
            title:
                null == title
                    ? _value.title
                    : title // ignore: cast_nullable_to_non_nullable
                        as String,
            body:
                null == body
                    ? _value.body
                    : body // ignore: cast_nullable_to_non_nullable
                        as String,
            metadata:
                freezed == metadata
                    ? _value.metadata
                    : metadata // ignore: cast_nullable_to_non_nullable
                        as Map<String, dynamic>?,
            isRead:
                null == isRead
                    ? _value.isRead
                    : isRead // ignore: cast_nullable_to_non_nullable
                        as bool,
            createdAt:
                null == createdAt
                    ? _value.createdAt
                    : createdAt // ignore: cast_nullable_to_non_nullable
                        as String,
            actionUrl:
                freezed == actionUrl
                    ? _value.actionUrl
                    : actionUrl // ignore: cast_nullable_to_non_nullable
                        as String?,
            iconType:
                freezed == iconType
                    ? _value.iconType
                    : iconType // ignore: cast_nullable_to_non_nullable
                        as String?,
            mediaType:
                freezed == mediaType
                    ? _value.mediaType
                    : mediaType // ignore: cast_nullable_to_non_nullable
                        as String?,
            mediaUrl:
                freezed == mediaUrl
                    ? _value.mediaUrl
                    : mediaUrl // ignore: cast_nullable_to_non_nullable
                        as String?,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$NotificationItemImplCopyWith<$Res>
    implements $NotificationItemCopyWith<$Res> {
  factory _$$NotificationItemImplCopyWith(
    _$NotificationItemImpl value,
    $Res Function(_$NotificationItemImpl) then,
  ) = __$$NotificationItemImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    String id,
    String type,
    String title,
    String body,
    @JsonKey(name: 'data') Map<String, dynamic>? metadata,
    bool isRead,
    String createdAt,
    String? actionUrl,
    String? iconType,
    String? mediaType,
    String? mediaUrl,
  });
}

/// @nodoc
class __$$NotificationItemImplCopyWithImpl<$Res>
    extends _$NotificationItemCopyWithImpl<$Res, _$NotificationItemImpl>
    implements _$$NotificationItemImplCopyWith<$Res> {
  __$$NotificationItemImplCopyWithImpl(
    _$NotificationItemImpl _value,
    $Res Function(_$NotificationItemImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of NotificationItem
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
    Object? title = null,
    Object? body = null,
    Object? metadata = freezed,
    Object? isRead = null,
    Object? createdAt = null,
    Object? actionUrl = freezed,
    Object? iconType = freezed,
    Object? mediaType = freezed,
    Object? mediaUrl = freezed,
  }) {
    return _then(
      _$NotificationItemImpl(
        id:
            null == id
                ? _value.id
                : id // ignore: cast_nullable_to_non_nullable
                    as String,
        type:
            null == type
                ? _value.type
                : type // ignore: cast_nullable_to_non_nullable
                    as String,
        title:
            null == title
                ? _value.title
                : title // ignore: cast_nullable_to_non_nullable
                    as String,
        body:
            null == body
                ? _value.body
                : body // ignore: cast_nullable_to_non_nullable
                    as String,
        metadata:
            freezed == metadata
                ? _value._metadata
                : metadata // ignore: cast_nullable_to_non_nullable
                    as Map<String, dynamic>?,
        isRead:
            null == isRead
                ? _value.isRead
                : isRead // ignore: cast_nullable_to_non_nullable
                    as bool,
        createdAt:
            null == createdAt
                ? _value.createdAt
                : createdAt // ignore: cast_nullable_to_non_nullable
                    as String,
        actionUrl:
            freezed == actionUrl
                ? _value.actionUrl
                : actionUrl // ignore: cast_nullable_to_non_nullable
                    as String?,
        iconType:
            freezed == iconType
                ? _value.iconType
                : iconType // ignore: cast_nullable_to_non_nullable
                    as String?,
        mediaType:
            freezed == mediaType
                ? _value.mediaType
                : mediaType // ignore: cast_nullable_to_non_nullable
                    as String?,
        mediaUrl:
            freezed == mediaUrl
                ? _value.mediaUrl
                : mediaUrl // ignore: cast_nullable_to_non_nullable
                    as String?,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$NotificationItemImpl implements _NotificationItem {
  const _$NotificationItemImpl({
    required this.id,
    required this.type,
    required this.title,
    required this.body,
    @JsonKey(name: 'data') final Map<String, dynamic>? metadata,
    this.isRead = false,
    required this.createdAt,
    this.actionUrl,
    this.iconType,
    this.mediaType,
    this.mediaUrl,
  }) : _metadata = metadata;

  factory _$NotificationItemImpl.fromJson(Map<String, dynamic> json) =>
      _$$NotificationItemImplFromJson(json);

  @override
  final String id;
  @override
  final String type;
  @override
  final String title;
  @override
  final String body;
  final Map<String, dynamic>? _metadata;
  @override
  @JsonKey(name: 'data')
  Map<String, dynamic>? get metadata {
    final value = _metadata;
    if (value == null) return null;
    if (_metadata is EqualUnmodifiableMapView) return _metadata;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableMapView(value);
  }

  @override
  @JsonKey()
  final bool isRead;
  @override
  final String createdAt;
  @override
  final String? actionUrl;
  @override
  final String? iconType;
  @override
  final String? mediaType;
  @override
  final String? mediaUrl;

  @override
  String toString() {
    return 'NotificationItem(id: $id, type: $type, title: $title, body: $body, metadata: $metadata, isRead: $isRead, createdAt: $createdAt, actionUrl: $actionUrl, iconType: $iconType, mediaType: $mediaType, mediaUrl: $mediaUrl)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$NotificationItemImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.title, title) || other.title == title) &&
            (identical(other.body, body) || other.body == body) &&
            const DeepCollectionEquality().equals(other._metadata, _metadata) &&
            (identical(other.isRead, isRead) || other.isRead == isRead) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.actionUrl, actionUrl) ||
                other.actionUrl == actionUrl) &&
            (identical(other.iconType, iconType) ||
                other.iconType == iconType) &&
            (identical(other.mediaType, mediaType) ||
                other.mediaType == mediaType) &&
            (identical(other.mediaUrl, mediaUrl) ||
                other.mediaUrl == mediaUrl));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
    runtimeType,
    id,
    type,
    title,
    body,
    const DeepCollectionEquality().hash(_metadata),
    isRead,
    createdAt,
    actionUrl,
    iconType,
    mediaType,
    mediaUrl,
  );

  /// Create a copy of NotificationItem
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$NotificationItemImplCopyWith<_$NotificationItemImpl> get copyWith =>
      __$$NotificationItemImplCopyWithImpl<_$NotificationItemImpl>(
        this,
        _$identity,
      );

  @override
  Map<String, dynamic> toJson() {
    return _$$NotificationItemImplToJson(this);
  }
}

abstract class _NotificationItem implements NotificationItem {
  const factory _NotificationItem({
    required final String id,
    required final String type,
    required final String title,
    required final String body,
    @JsonKey(name: 'data') final Map<String, dynamic>? metadata,
    final bool isRead,
    required final String createdAt,
    final String? actionUrl,
    final String? iconType,
    final String? mediaType,
    final String? mediaUrl,
  }) = _$NotificationItemImpl;

  factory _NotificationItem.fromJson(Map<String, dynamic> json) =
      _$NotificationItemImpl.fromJson;

  @override
  String get id;
  @override
  String get type;
  @override
  String get title;
  @override
  String get body;
  @override
  @JsonKey(name: 'data')
  Map<String, dynamic>? get metadata;
  @override
  bool get isRead;
  @override
  String get createdAt;
  @override
  String? get actionUrl;
  @override
  String? get iconType;
  @override
  String? get mediaType;
  @override
  String? get mediaUrl;

  /// Create a copy of NotificationItem
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$NotificationItemImplCopyWith<_$NotificationItemImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
