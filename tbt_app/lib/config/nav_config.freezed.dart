// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'nav_config.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

NavConfig _$NavConfigFromJson(Map<String, dynamic> json) {
  return _NavConfig.fromJson(json);
}

/// @nodoc
mixin _$NavConfig {
  List<NavItem> get items => throw _privateConstructorUsedError;
  RightIcons get rightIcons => throw _privateConstructorUsedError;

  /// Serializes this NavConfig to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of NavConfig
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $NavConfigCopyWith<NavConfig> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $NavConfigCopyWith<$Res> {
  factory $NavConfigCopyWith(NavConfig value, $Res Function(NavConfig) then) =
      _$NavConfigCopyWithImpl<$Res, NavConfig>;
  @useResult
  $Res call({List<NavItem> items, RightIcons rightIcons});

  $RightIconsCopyWith<$Res> get rightIcons;
}

/// @nodoc
class _$NavConfigCopyWithImpl<$Res, $Val extends NavConfig>
    implements $NavConfigCopyWith<$Res> {
  _$NavConfigCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of NavConfig
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? items = null, Object? rightIcons = null}) {
    return _then(
      _value.copyWith(
            items:
                null == items
                    ? _value.items
                    : items // ignore: cast_nullable_to_non_nullable
                        as List<NavItem>,
            rightIcons:
                null == rightIcons
                    ? _value.rightIcons
                    : rightIcons // ignore: cast_nullable_to_non_nullable
                        as RightIcons,
          )
          as $Val,
    );
  }

  /// Create a copy of NavConfig
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $RightIconsCopyWith<$Res> get rightIcons {
    return $RightIconsCopyWith<$Res>(_value.rightIcons, (value) {
      return _then(_value.copyWith(rightIcons: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$NavConfigImplCopyWith<$Res>
    implements $NavConfigCopyWith<$Res> {
  factory _$$NavConfigImplCopyWith(
    _$NavConfigImpl value,
    $Res Function(_$NavConfigImpl) then,
  ) = __$$NavConfigImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({List<NavItem> items, RightIcons rightIcons});

  @override
  $RightIconsCopyWith<$Res> get rightIcons;
}

/// @nodoc
class __$$NavConfigImplCopyWithImpl<$Res>
    extends _$NavConfigCopyWithImpl<$Res, _$NavConfigImpl>
    implements _$$NavConfigImplCopyWith<$Res> {
  __$$NavConfigImplCopyWithImpl(
    _$NavConfigImpl _value,
    $Res Function(_$NavConfigImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of NavConfig
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? items = null, Object? rightIcons = null}) {
    return _then(
      _$NavConfigImpl(
        items:
            null == items
                ? _value._items
                : items // ignore: cast_nullable_to_non_nullable
                    as List<NavItem>,
        rightIcons:
            null == rightIcons
                ? _value.rightIcons
                : rightIcons // ignore: cast_nullable_to_non_nullable
                    as RightIcons,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$NavConfigImpl implements _NavConfig {
  const _$NavConfigImpl({
    final List<NavItem> items = const <NavItem>[],
    this.rightIcons = const RightIcons(),
  }) : _items = items;

  factory _$NavConfigImpl.fromJson(Map<String, dynamic> json) =>
      _$$NavConfigImplFromJson(json);

  final List<NavItem> _items;
  @override
  @JsonKey()
  List<NavItem> get items {
    if (_items is EqualUnmodifiableListView) return _items;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_items);
  }

  @override
  @JsonKey()
  final RightIcons rightIcons;

  @override
  String toString() {
    return 'NavConfig(items: $items, rightIcons: $rightIcons)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$NavConfigImpl &&
            const DeepCollectionEquality().equals(other._items, _items) &&
            (identical(other.rightIcons, rightIcons) ||
                other.rightIcons == rightIcons));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
    runtimeType,
    const DeepCollectionEquality().hash(_items),
    rightIcons,
  );

  /// Create a copy of NavConfig
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$NavConfigImplCopyWith<_$NavConfigImpl> get copyWith =>
      __$$NavConfigImplCopyWithImpl<_$NavConfigImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$NavConfigImplToJson(this);
  }
}

abstract class _NavConfig implements NavConfig {
  const factory _NavConfig({
    final List<NavItem> items,
    final RightIcons rightIcons,
  }) = _$NavConfigImpl;

  factory _NavConfig.fromJson(Map<String, dynamic> json) =
      _$NavConfigImpl.fromJson;

  @override
  List<NavItem> get items;
  @override
  RightIcons get rightIcons;

  /// Create a copy of NavConfig
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$NavConfigImplCopyWith<_$NavConfigImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

NavItem _$NavItemFromJson(Map<String, dynamic> json) {
  return _NavItem.fromJson(json);
}

/// @nodoc
mixin _$NavItem {
  String get id => throw _privateConstructorUsedError;
  String get label => throw _privateConstructorUsedError;
  String get href => throw _privateConstructorUsedError;
  int get order => throw _privateConstructorUsedError;
  bool get isVisible => throw _privateConstructorUsedError;

  /// Serializes this NavItem to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of NavItem
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $NavItemCopyWith<NavItem> get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $NavItemCopyWith<$Res> {
  factory $NavItemCopyWith(NavItem value, $Res Function(NavItem) then) =
      _$NavItemCopyWithImpl<$Res, NavItem>;
  @useResult
  $Res call({String id, String label, String href, int order, bool isVisible});
}

/// @nodoc
class _$NavItemCopyWithImpl<$Res, $Val extends NavItem>
    implements $NavItemCopyWith<$Res> {
  _$NavItemCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of NavItem
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? label = null,
    Object? href = null,
    Object? order = null,
    Object? isVisible = null,
  }) {
    return _then(
      _value.copyWith(
            id:
                null == id
                    ? _value.id
                    : id // ignore: cast_nullable_to_non_nullable
                        as String,
            label:
                null == label
                    ? _value.label
                    : label // ignore: cast_nullable_to_non_nullable
                        as String,
            href:
                null == href
                    ? _value.href
                    : href // ignore: cast_nullable_to_non_nullable
                        as String,
            order:
                null == order
                    ? _value.order
                    : order // ignore: cast_nullable_to_non_nullable
                        as int,
            isVisible:
                null == isVisible
                    ? _value.isVisible
                    : isVisible // ignore: cast_nullable_to_non_nullable
                        as bool,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$NavItemImplCopyWith<$Res> implements $NavItemCopyWith<$Res> {
  factory _$$NavItemImplCopyWith(
    _$NavItemImpl value,
    $Res Function(_$NavItemImpl) then,
  ) = __$$NavItemImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String id, String label, String href, int order, bool isVisible});
}

/// @nodoc
class __$$NavItemImplCopyWithImpl<$Res>
    extends _$NavItemCopyWithImpl<$Res, _$NavItemImpl>
    implements _$$NavItemImplCopyWith<$Res> {
  __$$NavItemImplCopyWithImpl(
    _$NavItemImpl _value,
    $Res Function(_$NavItemImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of NavItem
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? label = null,
    Object? href = null,
    Object? order = null,
    Object? isVisible = null,
  }) {
    return _then(
      _$NavItemImpl(
        id:
            null == id
                ? _value.id
                : id // ignore: cast_nullable_to_non_nullable
                    as String,
        label:
            null == label
                ? _value.label
                : label // ignore: cast_nullable_to_non_nullable
                    as String,
        href:
            null == href
                ? _value.href
                : href // ignore: cast_nullable_to_non_nullable
                    as String,
        order:
            null == order
                ? _value.order
                : order // ignore: cast_nullable_to_non_nullable
                    as int,
        isVisible:
            null == isVisible
                ? _value.isVisible
                : isVisible // ignore: cast_nullable_to_non_nullable
                    as bool,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$NavItemImpl implements _NavItem {
  const _$NavItemImpl({
    required this.id,
    required this.label,
    required this.href,
    this.order = 0,
    this.isVisible = true,
  });

  factory _$NavItemImpl.fromJson(Map<String, dynamic> json) =>
      _$$NavItemImplFromJson(json);

  @override
  final String id;
  @override
  final String label;
  @override
  final String href;
  @override
  @JsonKey()
  final int order;
  @override
  @JsonKey()
  final bool isVisible;

  @override
  String toString() {
    return 'NavItem(id: $id, label: $label, href: $href, order: $order, isVisible: $isVisible)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$NavItemImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.label, label) || other.label == label) &&
            (identical(other.href, href) || other.href == href) &&
            (identical(other.order, order) || other.order == order) &&
            (identical(other.isVisible, isVisible) ||
                other.isVisible == isVisible));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, id, label, href, order, isVisible);

  /// Create a copy of NavItem
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$NavItemImplCopyWith<_$NavItemImpl> get copyWith =>
      __$$NavItemImplCopyWithImpl<_$NavItemImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$NavItemImplToJson(this);
  }
}

abstract class _NavItem implements NavItem {
  const factory _NavItem({
    required final String id,
    required final String label,
    required final String href,
    final int order,
    final bool isVisible,
  }) = _$NavItemImpl;

  factory _NavItem.fromJson(Map<String, dynamic> json) = _$NavItemImpl.fromJson;

  @override
  String get id;
  @override
  String get label;
  @override
  String get href;
  @override
  int get order;
  @override
  bool get isVisible;

  /// Create a copy of NavItem
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$NavItemImplCopyWith<_$NavItemImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

RightIcons _$RightIconsFromJson(Map<String, dynamic> json) {
  return _RightIcons.fromJson(json);
}

/// @nodoc
mixin _$RightIcons {
  bool get notifications => throw _privateConstructorUsedError;
  bool get messages => throw _privateConstructorUsedError;
  bool get profile => throw _privateConstructorUsedError;

  /// Serializes this RightIcons to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of RightIcons
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $RightIconsCopyWith<RightIcons> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $RightIconsCopyWith<$Res> {
  factory $RightIconsCopyWith(
    RightIcons value,
    $Res Function(RightIcons) then,
  ) = _$RightIconsCopyWithImpl<$Res, RightIcons>;
  @useResult
  $Res call({bool notifications, bool messages, bool profile});
}

/// @nodoc
class _$RightIconsCopyWithImpl<$Res, $Val extends RightIcons>
    implements $RightIconsCopyWith<$Res> {
  _$RightIconsCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of RightIcons
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? notifications = null,
    Object? messages = null,
    Object? profile = null,
  }) {
    return _then(
      _value.copyWith(
            notifications:
                null == notifications
                    ? _value.notifications
                    : notifications // ignore: cast_nullable_to_non_nullable
                        as bool,
            messages:
                null == messages
                    ? _value.messages
                    : messages // ignore: cast_nullable_to_non_nullable
                        as bool,
            profile:
                null == profile
                    ? _value.profile
                    : profile // ignore: cast_nullable_to_non_nullable
                        as bool,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$RightIconsImplCopyWith<$Res>
    implements $RightIconsCopyWith<$Res> {
  factory _$$RightIconsImplCopyWith(
    _$RightIconsImpl value,
    $Res Function(_$RightIconsImpl) then,
  ) = __$$RightIconsImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({bool notifications, bool messages, bool profile});
}

/// @nodoc
class __$$RightIconsImplCopyWithImpl<$Res>
    extends _$RightIconsCopyWithImpl<$Res, _$RightIconsImpl>
    implements _$$RightIconsImplCopyWith<$Res> {
  __$$RightIconsImplCopyWithImpl(
    _$RightIconsImpl _value,
    $Res Function(_$RightIconsImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of RightIcons
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? notifications = null,
    Object? messages = null,
    Object? profile = null,
  }) {
    return _then(
      _$RightIconsImpl(
        notifications:
            null == notifications
                ? _value.notifications
                : notifications // ignore: cast_nullable_to_non_nullable
                    as bool,
        messages:
            null == messages
                ? _value.messages
                : messages // ignore: cast_nullable_to_non_nullable
                    as bool,
        profile:
            null == profile
                ? _value.profile
                : profile // ignore: cast_nullable_to_non_nullable
                    as bool,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$RightIconsImpl implements _RightIcons {
  const _$RightIconsImpl({
    this.notifications = true,
    this.messages = true,
    this.profile = true,
  });

  factory _$RightIconsImpl.fromJson(Map<String, dynamic> json) =>
      _$$RightIconsImplFromJson(json);

  @override
  @JsonKey()
  final bool notifications;
  @override
  @JsonKey()
  final bool messages;
  @override
  @JsonKey()
  final bool profile;

  @override
  String toString() {
    return 'RightIcons(notifications: $notifications, messages: $messages, profile: $profile)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$RightIconsImpl &&
            (identical(other.notifications, notifications) ||
                other.notifications == notifications) &&
            (identical(other.messages, messages) ||
                other.messages == messages) &&
            (identical(other.profile, profile) || other.profile == profile));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, notifications, messages, profile);

  /// Create a copy of RightIcons
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$RightIconsImplCopyWith<_$RightIconsImpl> get copyWith =>
      __$$RightIconsImplCopyWithImpl<_$RightIconsImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$RightIconsImplToJson(this);
  }
}

abstract class _RightIcons implements RightIcons {
  const factory _RightIcons({
    final bool notifications,
    final bool messages,
    final bool profile,
  }) = _$RightIconsImpl;

  factory _RightIcons.fromJson(Map<String, dynamic> json) =
      _$RightIconsImpl.fromJson;

  @override
  bool get notifications;
  @override
  bool get messages;
  @override
  bool get profile;

  /// Create a copy of RightIcons
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$RightIconsImplCopyWith<_$RightIconsImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
