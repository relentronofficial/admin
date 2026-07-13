// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'site_config.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$SiteConfigImpl _$$SiteConfigImplFromJson(Map<String, dynamic> json) =>
    _$SiteConfigImpl(
      siteName: json['siteName'] as String? ?? 'TBT',
      logoUrl: json['logoUrl'] as String?,
      faviconUrl: json['faviconUrl'] as String?,
      footerText: json['footerText'] as String?,
      theme:
          json['theme'] == null
              ? const SiteTheme()
              : SiteTheme.fromJson(json['theme'] as Map<String, dynamic>),
      splashLogoUrl: json['splashLogoUrl'] as String?,
      splashDurationMs: (json['splashDurationMs'] as num?)?.toInt() ?? 2000,
      loginBgUrl: json['loginBgUrl'] as String?,
      loginBgMobileUrl: json['loginBgMobileUrl'] as String?,
      loginBgImages:
          (json['loginBgImages'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList(),
    );

Map<String, dynamic> _$$SiteConfigImplToJson(_$SiteConfigImpl instance) =>
    <String, dynamic>{
      'siteName': instance.siteName,
      'logoUrl': instance.logoUrl,
      'faviconUrl': instance.faviconUrl,
      'footerText': instance.footerText,
      'theme': instance.theme,
      'splashLogoUrl': instance.splashLogoUrl,
      'splashDurationMs': instance.splashDurationMs,
      'loginBgUrl': instance.loginBgUrl,
      'loginBgMobileUrl': instance.loginBgMobileUrl,
      'loginBgImages': instance.loginBgImages,
    };

_$SiteThemeImpl _$$SiteThemeImplFromJson(Map<String, dynamic> json) =>
    _$SiteThemeImpl(
      accentColor: json['accentColor'] as String? ?? '#dc2626',
      alertColor: json['alertColor'] as String? ?? '#f59e0b',
      successColor: json['successColor'] as String? ?? '#22c55e',
      bgPrimary: json['bgPrimary'] as String? ?? '#0f0f0f',
      bgSurface: json['bgSurface'] as String? ?? '#181818',
    );

Map<String, dynamic> _$$SiteThemeImplToJson(_$SiteThemeImpl instance) =>
    <String, dynamic>{
      'accentColor': instance.accentColor,
      'alertColor': instance.alertColor,
      'successColor': instance.successColor,
      'bgPrimary': instance.bgPrimary,
      'bgSurface': instance.bgSurface,
    };
