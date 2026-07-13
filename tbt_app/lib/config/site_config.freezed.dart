// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'site_config.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

SiteConfig _$SiteConfigFromJson(Map<String, dynamic> json) {
  return _SiteConfig.fromJson(json);
}

/// @nodoc
mixin _$SiteConfig {
  String get siteName => throw _privateConstructorUsedError;
  String? get logoUrl => throw _privateConstructorUsedError;
  String? get faviconUrl => throw _privateConstructorUsedError;
  String? get footerText => throw _privateConstructorUsedError;
  SiteTheme get theme => throw _privateConstructorUsedError;
  String? get splashLogoUrl => throw _privateConstructorUsedError;
  int get splashDurationMs => throw _privateConstructorUsedError;
  String? get loginBgUrl => throw _privateConstructorUsedError;
  String? get loginBgMobileUrl => throw _privateConstructorUsedError;
  List<String>? get loginBgImages => throw _privateConstructorUsedError;

  /// Serializes this SiteConfig to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of SiteConfig
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $SiteConfigCopyWith<SiteConfig> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $SiteConfigCopyWith<$Res> {
  factory $SiteConfigCopyWith(
    SiteConfig value,
    $Res Function(SiteConfig) then,
  ) = _$SiteConfigCopyWithImpl<$Res, SiteConfig>;
  @useResult
  $Res call({
    String siteName,
    String? logoUrl,
    String? faviconUrl,
    String? footerText,
    SiteTheme theme,
    String? splashLogoUrl,
    int splashDurationMs,
    String? loginBgUrl,
    String? loginBgMobileUrl,
    List<String>? loginBgImages,
  });

  $SiteThemeCopyWith<$Res> get theme;
}

/// @nodoc
class _$SiteConfigCopyWithImpl<$Res, $Val extends SiteConfig>
    implements $SiteConfigCopyWith<$Res> {
  _$SiteConfigCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of SiteConfig
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? siteName = null,
    Object? logoUrl = freezed,
    Object? faviconUrl = freezed,
    Object? footerText = freezed,
    Object? theme = null,
    Object? splashLogoUrl = freezed,
    Object? splashDurationMs = null,
    Object? loginBgUrl = freezed,
    Object? loginBgMobileUrl = freezed,
    Object? loginBgImages = freezed,
  }) {
    return _then(
      _value.copyWith(
            siteName:
                null == siteName
                    ? _value.siteName
                    : siteName // ignore: cast_nullable_to_non_nullable
                        as String,
            logoUrl:
                freezed == logoUrl
                    ? _value.logoUrl
                    : logoUrl // ignore: cast_nullable_to_non_nullable
                        as String?,
            faviconUrl:
                freezed == faviconUrl
                    ? _value.faviconUrl
                    : faviconUrl // ignore: cast_nullable_to_non_nullable
                        as String?,
            footerText:
                freezed == footerText
                    ? _value.footerText
                    : footerText // ignore: cast_nullable_to_non_nullable
                        as String?,
            theme:
                null == theme
                    ? _value.theme
                    : theme // ignore: cast_nullable_to_non_nullable
                        as SiteTheme,
            splashLogoUrl:
                freezed == splashLogoUrl
                    ? _value.splashLogoUrl
                    : splashLogoUrl // ignore: cast_nullable_to_non_nullable
                        as String?,
            splashDurationMs:
                null == splashDurationMs
                    ? _value.splashDurationMs
                    : splashDurationMs // ignore: cast_nullable_to_non_nullable
                        as int,
            loginBgUrl:
                freezed == loginBgUrl
                    ? _value.loginBgUrl
                    : loginBgUrl // ignore: cast_nullable_to_non_nullable
                        as String?,
            loginBgMobileUrl:
                freezed == loginBgMobileUrl
                    ? _value.loginBgMobileUrl
                    : loginBgMobileUrl // ignore: cast_nullable_to_non_nullable
                        as String?,
            loginBgImages:
                freezed == loginBgImages
                    ? _value.loginBgImages
                    : loginBgImages // ignore: cast_nullable_to_non_nullable
                        as List<String>?,
          )
          as $Val,
    );
  }

  /// Create a copy of SiteConfig
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $SiteThemeCopyWith<$Res> get theme {
    return $SiteThemeCopyWith<$Res>(_value.theme, (value) {
      return _then(_value.copyWith(theme: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$SiteConfigImplCopyWith<$Res>
    implements $SiteConfigCopyWith<$Res> {
  factory _$$SiteConfigImplCopyWith(
    _$SiteConfigImpl value,
    $Res Function(_$SiteConfigImpl) then,
  ) = __$$SiteConfigImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    String siteName,
    String? logoUrl,
    String? faviconUrl,
    String? footerText,
    SiteTheme theme,
    String? splashLogoUrl,
    int splashDurationMs,
    String? loginBgUrl,
    String? loginBgMobileUrl,
    List<String>? loginBgImages,
  });

  @override
  $SiteThemeCopyWith<$Res> get theme;
}

/// @nodoc
class __$$SiteConfigImplCopyWithImpl<$Res>
    extends _$SiteConfigCopyWithImpl<$Res, _$SiteConfigImpl>
    implements _$$SiteConfigImplCopyWith<$Res> {
  __$$SiteConfigImplCopyWithImpl(
    _$SiteConfigImpl _value,
    $Res Function(_$SiteConfigImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of SiteConfig
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? siteName = null,
    Object? logoUrl = freezed,
    Object? faviconUrl = freezed,
    Object? footerText = freezed,
    Object? theme = null,
    Object? splashLogoUrl = freezed,
    Object? splashDurationMs = null,
    Object? loginBgUrl = freezed,
    Object? loginBgMobileUrl = freezed,
    Object? loginBgImages = freezed,
  }) {
    return _then(
      _$SiteConfigImpl(
        siteName:
            null == siteName
                ? _value.siteName
                : siteName // ignore: cast_nullable_to_non_nullable
                    as String,
        logoUrl:
            freezed == logoUrl
                ? _value.logoUrl
                : logoUrl // ignore: cast_nullable_to_non_nullable
                    as String?,
        faviconUrl:
            freezed == faviconUrl
                ? _value.faviconUrl
                : faviconUrl // ignore: cast_nullable_to_non_nullable
                    as String?,
        footerText:
            freezed == footerText
                ? _value.footerText
                : footerText // ignore: cast_nullable_to_non_nullable
                    as String?,
        theme:
            null == theme
                ? _value.theme
                : theme // ignore: cast_nullable_to_non_nullable
                    as SiteTheme,
        splashLogoUrl:
            freezed == splashLogoUrl
                ? _value.splashLogoUrl
                : splashLogoUrl // ignore: cast_nullable_to_non_nullable
                    as String?,
        splashDurationMs:
            null == splashDurationMs
                ? _value.splashDurationMs
                : splashDurationMs // ignore: cast_nullable_to_non_nullable
                    as int,
        loginBgUrl:
            freezed == loginBgUrl
                ? _value.loginBgUrl
                : loginBgUrl // ignore: cast_nullable_to_non_nullable
                    as String?,
        loginBgMobileUrl:
            freezed == loginBgMobileUrl
                ? _value.loginBgMobileUrl
                : loginBgMobileUrl // ignore: cast_nullable_to_non_nullable
                    as String?,
        loginBgImages:
            freezed == loginBgImages
                ? _value._loginBgImages
                : loginBgImages // ignore: cast_nullable_to_non_nullable
                    as List<String>?,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$SiteConfigImpl implements _SiteConfig {
  const _$SiteConfigImpl({
    this.siteName = 'TBT',
    this.logoUrl,
    this.faviconUrl,
    this.footerText,
    this.theme = const SiteTheme(),
    this.splashLogoUrl,
    this.splashDurationMs = 2000,
    this.loginBgUrl,
    this.loginBgMobileUrl,
    final List<String>? loginBgImages,
  }) : _loginBgImages = loginBgImages;

  factory _$SiteConfigImpl.fromJson(Map<String, dynamic> json) =>
      _$$SiteConfigImplFromJson(json);

  @override
  @JsonKey()
  final String siteName;
  @override
  final String? logoUrl;
  @override
  final String? faviconUrl;
  @override
  final String? footerText;
  @override
  @JsonKey()
  final SiteTheme theme;
  @override
  final String? splashLogoUrl;
  @override
  @JsonKey()
  final int splashDurationMs;
  @override
  final String? loginBgUrl;
  @override
  final String? loginBgMobileUrl;
  final List<String>? _loginBgImages;
  @override
  List<String>? get loginBgImages {
    final value = _loginBgImages;
    if (value == null) return null;
    if (_loginBgImages is EqualUnmodifiableListView) return _loginBgImages;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(value);
  }

  @override
  String toString() {
    return 'SiteConfig(siteName: $siteName, logoUrl: $logoUrl, faviconUrl: $faviconUrl, footerText: $footerText, theme: $theme, splashLogoUrl: $splashLogoUrl, splashDurationMs: $splashDurationMs, loginBgUrl: $loginBgUrl, loginBgMobileUrl: $loginBgMobileUrl, loginBgImages: $loginBgImages)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$SiteConfigImpl &&
            (identical(other.siteName, siteName) ||
                other.siteName == siteName) &&
            (identical(other.logoUrl, logoUrl) || other.logoUrl == logoUrl) &&
            (identical(other.faviconUrl, faviconUrl) ||
                other.faviconUrl == faviconUrl) &&
            (identical(other.footerText, footerText) ||
                other.footerText == footerText) &&
            (identical(other.theme, theme) || other.theme == theme) &&
            (identical(other.splashLogoUrl, splashLogoUrl) ||
                other.splashLogoUrl == splashLogoUrl) &&
            (identical(other.splashDurationMs, splashDurationMs) ||
                other.splashDurationMs == splashDurationMs) &&
            (identical(other.loginBgUrl, loginBgUrl) ||
                other.loginBgUrl == loginBgUrl) &&
            (identical(other.loginBgMobileUrl, loginBgMobileUrl) ||
                other.loginBgMobileUrl == loginBgMobileUrl) &&
            const DeepCollectionEquality().equals(
              other._loginBgImages,
              _loginBgImages,
            ));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
    runtimeType,
    siteName,
    logoUrl,
    faviconUrl,
    footerText,
    theme,
    splashLogoUrl,
    splashDurationMs,
    loginBgUrl,
    loginBgMobileUrl,
    const DeepCollectionEquality().hash(_loginBgImages),
  );

  /// Create a copy of SiteConfig
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$SiteConfigImplCopyWith<_$SiteConfigImpl> get copyWith =>
      __$$SiteConfigImplCopyWithImpl<_$SiteConfigImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$SiteConfigImplToJson(this);
  }
}

abstract class _SiteConfig implements SiteConfig {
  const factory _SiteConfig({
    final String siteName,
    final String? logoUrl,
    final String? faviconUrl,
    final String? footerText,
    final SiteTheme theme,
    final String? splashLogoUrl,
    final int splashDurationMs,
    final String? loginBgUrl,
    final String? loginBgMobileUrl,
    final List<String>? loginBgImages,
  }) = _$SiteConfigImpl;

  factory _SiteConfig.fromJson(Map<String, dynamic> json) =
      _$SiteConfigImpl.fromJson;

  @override
  String get siteName;
  @override
  String? get logoUrl;
  @override
  String? get faviconUrl;
  @override
  String? get footerText;
  @override
  SiteTheme get theme;
  @override
  String? get splashLogoUrl;
  @override
  int get splashDurationMs;
  @override
  String? get loginBgUrl;
  @override
  String? get loginBgMobileUrl;
  @override
  List<String>? get loginBgImages;

  /// Create a copy of SiteConfig
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$SiteConfigImplCopyWith<_$SiteConfigImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

SiteTheme _$SiteThemeFromJson(Map<String, dynamic> json) {
  return _SiteTheme.fromJson(json);
}

/// @nodoc
mixin _$SiteTheme {
  String get accentColor => throw _privateConstructorUsedError;
  String get alertColor => throw _privateConstructorUsedError;
  String get successColor => throw _privateConstructorUsedError;
  String get bgPrimary => throw _privateConstructorUsedError;
  String get bgSurface => throw _privateConstructorUsedError;

  /// Serializes this SiteTheme to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of SiteTheme
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $SiteThemeCopyWith<SiteTheme> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $SiteThemeCopyWith<$Res> {
  factory $SiteThemeCopyWith(SiteTheme value, $Res Function(SiteTheme) then) =
      _$SiteThemeCopyWithImpl<$Res, SiteTheme>;
  @useResult
  $Res call({
    String accentColor,
    String alertColor,
    String successColor,
    String bgPrimary,
    String bgSurface,
  });
}

/// @nodoc
class _$SiteThemeCopyWithImpl<$Res, $Val extends SiteTheme>
    implements $SiteThemeCopyWith<$Res> {
  _$SiteThemeCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of SiteTheme
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? accentColor = null,
    Object? alertColor = null,
    Object? successColor = null,
    Object? bgPrimary = null,
    Object? bgSurface = null,
  }) {
    return _then(
      _value.copyWith(
            accentColor:
                null == accentColor
                    ? _value.accentColor
                    : accentColor // ignore: cast_nullable_to_non_nullable
                        as String,
            alertColor:
                null == alertColor
                    ? _value.alertColor
                    : alertColor // ignore: cast_nullable_to_non_nullable
                        as String,
            successColor:
                null == successColor
                    ? _value.successColor
                    : successColor // ignore: cast_nullable_to_non_nullable
                        as String,
            bgPrimary:
                null == bgPrimary
                    ? _value.bgPrimary
                    : bgPrimary // ignore: cast_nullable_to_non_nullable
                        as String,
            bgSurface:
                null == bgSurface
                    ? _value.bgSurface
                    : bgSurface // ignore: cast_nullable_to_non_nullable
                        as String,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$SiteThemeImplCopyWith<$Res>
    implements $SiteThemeCopyWith<$Res> {
  factory _$$SiteThemeImplCopyWith(
    _$SiteThemeImpl value,
    $Res Function(_$SiteThemeImpl) then,
  ) = __$$SiteThemeImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    String accentColor,
    String alertColor,
    String successColor,
    String bgPrimary,
    String bgSurface,
  });
}

/// @nodoc
class __$$SiteThemeImplCopyWithImpl<$Res>
    extends _$SiteThemeCopyWithImpl<$Res, _$SiteThemeImpl>
    implements _$$SiteThemeImplCopyWith<$Res> {
  __$$SiteThemeImplCopyWithImpl(
    _$SiteThemeImpl _value,
    $Res Function(_$SiteThemeImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of SiteTheme
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? accentColor = null,
    Object? alertColor = null,
    Object? successColor = null,
    Object? bgPrimary = null,
    Object? bgSurface = null,
  }) {
    return _then(
      _$SiteThemeImpl(
        accentColor:
            null == accentColor
                ? _value.accentColor
                : accentColor // ignore: cast_nullable_to_non_nullable
                    as String,
        alertColor:
            null == alertColor
                ? _value.alertColor
                : alertColor // ignore: cast_nullable_to_non_nullable
                    as String,
        successColor:
            null == successColor
                ? _value.successColor
                : successColor // ignore: cast_nullable_to_non_nullable
                    as String,
        bgPrimary:
            null == bgPrimary
                ? _value.bgPrimary
                : bgPrimary // ignore: cast_nullable_to_non_nullable
                    as String,
        bgSurface:
            null == bgSurface
                ? _value.bgSurface
                : bgSurface // ignore: cast_nullable_to_non_nullable
                    as String,
      ),
    );
  }
}

/// @nodoc
@JsonSerializable()
class _$SiteThemeImpl implements _SiteTheme {
  const _$SiteThemeImpl({
    this.accentColor = '#dc2626',
    this.alertColor = '#f59e0b',
    this.successColor = '#22c55e',
    this.bgPrimary = '#0f0f0f',
    this.bgSurface = '#181818',
  });

  factory _$SiteThemeImpl.fromJson(Map<String, dynamic> json) =>
      _$$SiteThemeImplFromJson(json);

  @override
  @JsonKey()
  final String accentColor;
  @override
  @JsonKey()
  final String alertColor;
  @override
  @JsonKey()
  final String successColor;
  @override
  @JsonKey()
  final String bgPrimary;
  @override
  @JsonKey()
  final String bgSurface;

  @override
  String toString() {
    return 'SiteTheme(accentColor: $accentColor, alertColor: $alertColor, successColor: $successColor, bgPrimary: $bgPrimary, bgSurface: $bgSurface)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$SiteThemeImpl &&
            (identical(other.accentColor, accentColor) ||
                other.accentColor == accentColor) &&
            (identical(other.alertColor, alertColor) ||
                other.alertColor == alertColor) &&
            (identical(other.successColor, successColor) ||
                other.successColor == successColor) &&
            (identical(other.bgPrimary, bgPrimary) ||
                other.bgPrimary == bgPrimary) &&
            (identical(other.bgSurface, bgSurface) ||
                other.bgSurface == bgSurface));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
    runtimeType,
    accentColor,
    alertColor,
    successColor,
    bgPrimary,
    bgSurface,
  );

  /// Create a copy of SiteTheme
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$SiteThemeImplCopyWith<_$SiteThemeImpl> get copyWith =>
      __$$SiteThemeImplCopyWithImpl<_$SiteThemeImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$SiteThemeImplToJson(this);
  }
}

abstract class _SiteTheme implements SiteTheme {
  const factory _SiteTheme({
    final String accentColor,
    final String alertColor,
    final String successColor,
    final String bgPrimary,
    final String bgSurface,
  }) = _$SiteThemeImpl;

  factory _SiteTheme.fromJson(Map<String, dynamic> json) =
      _$SiteThemeImpl.fromJson;

  @override
  String get accentColor;
  @override
  String get alertColor;
  @override
  String get successColor;
  @override
  String get bgPrimary;
  @override
  String get bgSurface;

  /// Create a copy of SiteTheme
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$SiteThemeImplCopyWith<_$SiteThemeImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
