import 'package:freezed_annotation/freezed_annotation.dart';

part 'site_config.freezed.dart';
part 'site_config.g.dart';

/// Response shape from `GET /api/pub/config/site → data`.
@freezed
class SiteConfig with _$SiteConfig {
  const factory SiteConfig({
    @Default('TBT') String siteName,
    String? logoUrl,
    String? faviconUrl,
    String? footerText,
    @Default(SiteTheme()) SiteTheme theme,
    String? splashLogoUrl,
    @Default(2000) int splashDurationMs,
    String? loginBgUrl,
    String? loginBgMobileUrl,
    List<String>? loginBgImages,
  }) = _SiteConfig;

  factory SiteConfig.fromJson(Map<String, dynamic> json) =>
      _$SiteConfigFromJson(json);
}

@freezed
class SiteTheme with _$SiteTheme {
  const factory SiteTheme({
    @Default('#dc2626') String accentColor,
    @Default('#f59e0b') String alertColor,
    @Default('#22c55e') String successColor,
    @Default('#0f0f0f') String bgPrimary,
    @Default('#181818') String bgSurface,
  }) = _SiteTheme;

  factory SiteTheme.fromJson(Map<String, dynamic> json) =>
      _$SiteThemeFromJson(json);
}
