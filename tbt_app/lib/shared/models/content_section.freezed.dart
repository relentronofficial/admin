// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'content_section.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

/// @nodoc
mixin _$CatalogItem {
  String get id => throw _privateConstructorUsedError;
  String get title => throw _privateConstructorUsedError;
  CatalogItemType get type => throw _privateConstructorUsedError;
  String? get thumbnailUrl => throw _privateConstructorUsedError;
  String? get categoryTag => throw _privateConstructorUsedError;
  bool get isLocked => throw _privateConstructorUsedError;
  String? get lockBadgeText => throw _privateConstructorUsedError;
  String? get playUrl => throw _privateConstructorUsedError;
  String? get courseId => throw _privateConstructorUsedError;
  String? get workshopId => throw _privateConstructorUsedError;
  int? get episodeCount =>
      throw _privateConstructorUsedError; // Raw backend content-type string (series | standalone | podcast | ...).
  // Retained for analytics + backward compatibility with existing JSON.
  String? get contentType => throw _privateConstructorUsedError;

  /// Create a copy of CatalogItem
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $CatalogItemCopyWith<CatalogItem> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $CatalogItemCopyWith<$Res> {
  factory $CatalogItemCopyWith(
    CatalogItem value,
    $Res Function(CatalogItem) then,
  ) = _$CatalogItemCopyWithImpl<$Res, CatalogItem>;
  @useResult
  $Res call({
    String id,
    String title,
    CatalogItemType type,
    String? thumbnailUrl,
    String? categoryTag,
    bool isLocked,
    String? lockBadgeText,
    String? playUrl,
    String? courseId,
    String? workshopId,
    int? episodeCount,
    String? contentType,
  });
}

/// @nodoc
class _$CatalogItemCopyWithImpl<$Res, $Val extends CatalogItem>
    implements $CatalogItemCopyWith<$Res> {
  _$CatalogItemCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of CatalogItem
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? title = null,
    Object? type = null,
    Object? thumbnailUrl = freezed,
    Object? categoryTag = freezed,
    Object? isLocked = null,
    Object? lockBadgeText = freezed,
    Object? playUrl = freezed,
    Object? courseId = freezed,
    Object? workshopId = freezed,
    Object? episodeCount = freezed,
    Object? contentType = freezed,
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
                        as CatalogItemType,
            thumbnailUrl:
                freezed == thumbnailUrl
                    ? _value.thumbnailUrl
                    : thumbnailUrl // ignore: cast_nullable_to_non_nullable
                        as String?,
            categoryTag:
                freezed == categoryTag
                    ? _value.categoryTag
                    : categoryTag // ignore: cast_nullable_to_non_nullable
                        as String?,
            isLocked:
                null == isLocked
                    ? _value.isLocked
                    : isLocked // ignore: cast_nullable_to_non_nullable
                        as bool,
            lockBadgeText:
                freezed == lockBadgeText
                    ? _value.lockBadgeText
                    : lockBadgeText // ignore: cast_nullable_to_non_nullable
                        as String?,
            playUrl:
                freezed == playUrl
                    ? _value.playUrl
                    : playUrl // ignore: cast_nullable_to_non_nullable
                        as String?,
            courseId:
                freezed == courseId
                    ? _value.courseId
                    : courseId // ignore: cast_nullable_to_non_nullable
                        as String?,
            workshopId:
                freezed == workshopId
                    ? _value.workshopId
                    : workshopId // ignore: cast_nullable_to_non_nullable
                        as String?,
            episodeCount:
                freezed == episodeCount
                    ? _value.episodeCount
                    : episodeCount // ignore: cast_nullable_to_non_nullable
                        as int?,
            contentType:
                freezed == contentType
                    ? _value.contentType
                    : contentType // ignore: cast_nullable_to_non_nullable
                        as String?,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$CatalogItemImplCopyWith<$Res>
    implements $CatalogItemCopyWith<$Res> {
  factory _$$CatalogItemImplCopyWith(
    _$CatalogItemImpl value,
    $Res Function(_$CatalogItemImpl) then,
  ) = __$$CatalogItemImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    String id,
    String title,
    CatalogItemType type,
    String? thumbnailUrl,
    String? categoryTag,
    bool isLocked,
    String? lockBadgeText,
    String? playUrl,
    String? courseId,
    String? workshopId,
    int? episodeCount,
    String? contentType,
  });
}

/// @nodoc
class __$$CatalogItemImplCopyWithImpl<$Res>
    extends _$CatalogItemCopyWithImpl<$Res, _$CatalogItemImpl>
    implements _$$CatalogItemImplCopyWith<$Res> {
  __$$CatalogItemImplCopyWithImpl(
    _$CatalogItemImpl _value,
    $Res Function(_$CatalogItemImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of CatalogItem
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? title = null,
    Object? type = null,
    Object? thumbnailUrl = freezed,
    Object? categoryTag = freezed,
    Object? isLocked = null,
    Object? lockBadgeText = freezed,
    Object? playUrl = freezed,
    Object? courseId = freezed,
    Object? workshopId = freezed,
    Object? episodeCount = freezed,
    Object? contentType = freezed,
  }) {
    return _then(
      _$CatalogItemImpl(
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
                    as CatalogItemType,
        thumbnailUrl:
            freezed == thumbnailUrl
                ? _value.thumbnailUrl
                : thumbnailUrl // ignore: cast_nullable_to_non_nullable
                    as String?,
        categoryTag:
            freezed == categoryTag
                ? _value.categoryTag
                : categoryTag // ignore: cast_nullable_to_non_nullable
                    as String?,
        isLocked:
            null == isLocked
                ? _value.isLocked
                : isLocked // ignore: cast_nullable_to_non_nullable
                    as bool,
        lockBadgeText:
            freezed == lockBadgeText
                ? _value.lockBadgeText
                : lockBadgeText // ignore: cast_nullable_to_non_nullable
                    as String?,
        playUrl:
            freezed == playUrl
                ? _value.playUrl
                : playUrl // ignore: cast_nullable_to_non_nullable
                    as String?,
        courseId:
            freezed == courseId
                ? _value.courseId
                : courseId // ignore: cast_nullable_to_non_nullable
                    as String?,
        workshopId:
            freezed == workshopId
                ? _value.workshopId
                : workshopId // ignore: cast_nullable_to_non_nullable
                    as String?,
        episodeCount:
            freezed == episodeCount
                ? _value.episodeCount
                : episodeCount // ignore: cast_nullable_to_non_nullable
                    as int?,
        contentType:
            freezed == contentType
                ? _value.contentType
                : contentType // ignore: cast_nullable_to_non_nullable
                    as String?,
      ),
    );
  }
}

/// @nodoc

class _$CatalogItemImpl implements _CatalogItem {
  const _$CatalogItemImpl({
    required this.id,
    required this.title,
    required this.type,
    this.thumbnailUrl,
    this.categoryTag,
    this.isLocked = false,
    this.lockBadgeText,
    this.playUrl,
    this.courseId,
    this.workshopId,
    this.episodeCount,
    this.contentType,
  });

  @override
  final String id;
  @override
  final String title;
  @override
  final CatalogItemType type;
  @override
  final String? thumbnailUrl;
  @override
  final String? categoryTag;
  @override
  @JsonKey()
  final bool isLocked;
  @override
  final String? lockBadgeText;
  @override
  final String? playUrl;
  @override
  final String? courseId;
  @override
  final String? workshopId;
  @override
  final int? episodeCount;
  // Raw backend content-type string (series | standalone | podcast | ...).
  // Retained for analytics + backward compatibility with existing JSON.
  @override
  final String? contentType;

  @override
  String toString() {
    return 'CatalogItem(id: $id, title: $title, type: $type, thumbnailUrl: $thumbnailUrl, categoryTag: $categoryTag, isLocked: $isLocked, lockBadgeText: $lockBadgeText, playUrl: $playUrl, courseId: $courseId, workshopId: $workshopId, episodeCount: $episodeCount, contentType: $contentType)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$CatalogItemImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.title, title) || other.title == title) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.thumbnailUrl, thumbnailUrl) ||
                other.thumbnailUrl == thumbnailUrl) &&
            (identical(other.categoryTag, categoryTag) ||
                other.categoryTag == categoryTag) &&
            (identical(other.isLocked, isLocked) ||
                other.isLocked == isLocked) &&
            (identical(other.lockBadgeText, lockBadgeText) ||
                other.lockBadgeText == lockBadgeText) &&
            (identical(other.playUrl, playUrl) || other.playUrl == playUrl) &&
            (identical(other.courseId, courseId) ||
                other.courseId == courseId) &&
            (identical(other.workshopId, workshopId) ||
                other.workshopId == workshopId) &&
            (identical(other.episodeCount, episodeCount) ||
                other.episodeCount == episodeCount) &&
            (identical(other.contentType, contentType) ||
                other.contentType == contentType));
  }

  @override
  int get hashCode => Object.hash(
    runtimeType,
    id,
    title,
    type,
    thumbnailUrl,
    categoryTag,
    isLocked,
    lockBadgeText,
    playUrl,
    courseId,
    workshopId,
    episodeCount,
    contentType,
  );

  /// Create a copy of CatalogItem
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$CatalogItemImplCopyWith<_$CatalogItemImpl> get copyWith =>
      __$$CatalogItemImplCopyWithImpl<_$CatalogItemImpl>(this, _$identity);
}

abstract class _CatalogItem implements CatalogItem {
  const factory _CatalogItem({
    required final String id,
    required final String title,
    required final CatalogItemType type,
    final String? thumbnailUrl,
    final String? categoryTag,
    final bool isLocked,
    final String? lockBadgeText,
    final String? playUrl,
    final String? courseId,
    final String? workshopId,
    final int? episodeCount,
    final String? contentType,
  }) = _$CatalogItemImpl;

  @override
  String get id;
  @override
  String get title;
  @override
  CatalogItemType get type;
  @override
  String? get thumbnailUrl;
  @override
  String? get categoryTag;
  @override
  bool get isLocked;
  @override
  String? get lockBadgeText;
  @override
  String? get playUrl;
  @override
  String? get courseId;
  @override
  String? get workshopId;
  @override
  int? get episodeCount; // Raw backend content-type string (series | standalone | podcast | ...).
  // Retained for analytics + backward compatibility with existing JSON.
  @override
  String? get contentType;

  /// Create a copy of CatalogItem
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$CatalogItemImplCopyWith<_$CatalogItemImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
mixin _$ContentSection {
  String get id => throw _privateConstructorUsedError;
  String get title => throw _privateConstructorUsedError;
  List<CatalogItem> get items => throw _privateConstructorUsedError;
  String get slug => throw _privateConstructorUsedError;
  bool get isLocked => throw _privateConstructorUsedError;
  String? get lockLabel => throw _privateConstructorUsedError;

  /// Create a copy of ContentSection
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $ContentSectionCopyWith<ContentSection> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ContentSectionCopyWith<$Res> {
  factory $ContentSectionCopyWith(
    ContentSection value,
    $Res Function(ContentSection) then,
  ) = _$ContentSectionCopyWithImpl<$Res, ContentSection>;
  @useResult
  $Res call({
    String id,
    String title,
    List<CatalogItem> items,
    String slug,
    bool isLocked,
    String? lockLabel,
  });
}

/// @nodoc
class _$ContentSectionCopyWithImpl<$Res, $Val extends ContentSection>
    implements $ContentSectionCopyWith<$Res> {
  _$ContentSectionCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of ContentSection
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? title = null,
    Object? items = null,
    Object? slug = null,
    Object? isLocked = null,
    Object? lockLabel = freezed,
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
            items:
                null == items
                    ? _value.items
                    : items // ignore: cast_nullable_to_non_nullable
                        as List<CatalogItem>,
            slug:
                null == slug
                    ? _value.slug
                    : slug // ignore: cast_nullable_to_non_nullable
                        as String,
            isLocked:
                null == isLocked
                    ? _value.isLocked
                    : isLocked // ignore: cast_nullable_to_non_nullable
                        as bool,
            lockLabel:
                freezed == lockLabel
                    ? _value.lockLabel
                    : lockLabel // ignore: cast_nullable_to_non_nullable
                        as String?,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$ContentSectionImplCopyWith<$Res>
    implements $ContentSectionCopyWith<$Res> {
  factory _$$ContentSectionImplCopyWith(
    _$ContentSectionImpl value,
    $Res Function(_$ContentSectionImpl) then,
  ) = __$$ContentSectionImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    String id,
    String title,
    List<CatalogItem> items,
    String slug,
    bool isLocked,
    String? lockLabel,
  });
}

/// @nodoc
class __$$ContentSectionImplCopyWithImpl<$Res>
    extends _$ContentSectionCopyWithImpl<$Res, _$ContentSectionImpl>
    implements _$$ContentSectionImplCopyWith<$Res> {
  __$$ContentSectionImplCopyWithImpl(
    _$ContentSectionImpl _value,
    $Res Function(_$ContentSectionImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of ContentSection
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? title = null,
    Object? items = null,
    Object? slug = null,
    Object? isLocked = null,
    Object? lockLabel = freezed,
  }) {
    return _then(
      _$ContentSectionImpl(
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
        items:
            null == items
                ? _value._items
                : items // ignore: cast_nullable_to_non_nullable
                    as List<CatalogItem>,
        slug:
            null == slug
                ? _value.slug
                : slug // ignore: cast_nullable_to_non_nullable
                    as String,
        isLocked:
            null == isLocked
                ? _value.isLocked
                : isLocked // ignore: cast_nullable_to_non_nullable
                    as bool,
        lockLabel:
            freezed == lockLabel
                ? _value.lockLabel
                : lockLabel // ignore: cast_nullable_to_non_nullable
                    as String?,
      ),
    );
  }
}

/// @nodoc

class _$ContentSectionImpl implements _ContentSection {
  const _$ContentSectionImpl({
    required this.id,
    required this.title,
    required final List<CatalogItem> items,
    this.slug = '',
    this.isLocked = false,
    this.lockLabel,
  }) : _items = items;

  @override
  final String id;
  @override
  final String title;
  final List<CatalogItem> _items;
  @override
  List<CatalogItem> get items {
    if (_items is EqualUnmodifiableListView) return _items;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_items);
  }

  @override
  @JsonKey()
  final String slug;
  @override
  @JsonKey()
  final bool isLocked;
  @override
  final String? lockLabel;

  @override
  String toString() {
    return 'ContentSection(id: $id, title: $title, items: $items, slug: $slug, isLocked: $isLocked, lockLabel: $lockLabel)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ContentSectionImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.title, title) || other.title == title) &&
            const DeepCollectionEquality().equals(other._items, _items) &&
            (identical(other.slug, slug) || other.slug == slug) &&
            (identical(other.isLocked, isLocked) ||
                other.isLocked == isLocked) &&
            (identical(other.lockLabel, lockLabel) ||
                other.lockLabel == lockLabel));
  }

  @override
  int get hashCode => Object.hash(
    runtimeType,
    id,
    title,
    const DeepCollectionEquality().hash(_items),
    slug,
    isLocked,
    lockLabel,
  );

  /// Create a copy of ContentSection
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ContentSectionImplCopyWith<_$ContentSectionImpl> get copyWith =>
      __$$ContentSectionImplCopyWithImpl<_$ContentSectionImpl>(
        this,
        _$identity,
      );
}

abstract class _ContentSection implements ContentSection {
  const factory _ContentSection({
    required final String id,
    required final String title,
    required final List<CatalogItem> items,
    final String slug,
    final bool isLocked,
    final String? lockLabel,
  }) = _$ContentSectionImpl;

  @override
  String get id;
  @override
  String get title;
  @override
  List<CatalogItem> get items;
  @override
  String get slug;
  @override
  bool get isLocked;
  @override
  String? get lockLabel;

  /// Create a copy of ContentSection
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ContentSectionImplCopyWith<_$ContentSectionImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
