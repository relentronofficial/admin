// Falls back to the legacy dark-only palette when SiteConfig hasn't loaded
// yet; the const references below are intentional.
// ignore_for_file: deprecated_member_use_from_same_package

import 'package:flutter/material.dart';

import '../../config/site_config.dart';
import 'design_constants.dart';

/// Runtime theme extension populated from `SiteConfig.theme`.
@immutable
class TbtTheme extends ThemeExtension<TbtTheme> {
  const TbtTheme({
    required this.accent,
    required this.alert,
    required this.success,
    required this.bgPrimary,
    required this.bgSurface,
  });

  final Color accent;
  final Color alert;
  final Color success;
  final Color bgPrimary;
  final Color bgSurface;

  static const Color kColorLocked = Color(0xFF4a4a4a);

  static Color _hex(String hex) =>
      Color(int.parse('0xFF${hex.replaceAll('#', '')}'));

  factory TbtTheme.fromSiteConfig(SiteTheme theme) => TbtTheme(
        accent: _hex(theme.accentColor),
        alert: _hex(theme.alertColor),
        success: _hex(theme.successColor),
        bgPrimary: _hex(theme.bgPrimary),
        bgSurface: _hex(theme.bgSurface),
      );

  /// Fallback used before SiteConfig loads.
  static const TbtTheme defaults = TbtTheme(
    accent: kColorAccent,
    alert: Color(0xFFf59e0b),
    success: Color(0xFF22c55e),
    bgPrimary: kColorBgPage,
    bgSurface: kColorBgSurface,
  );

  @override
  TbtTheme copyWith({
    Color? accent,
    Color? alert,
    Color? success,
    Color? bgPrimary,
    Color? bgSurface,
  }) =>
      TbtTheme(
        accent: accent ?? this.accent,
        alert: alert ?? this.alert,
        success: success ?? this.success,
        bgPrimary: bgPrimary ?? this.bgPrimary,
        bgSurface: bgSurface ?? this.bgSurface,
      );

  @override
  TbtTheme lerp(TbtTheme? other, double t) {
    if (other == null) return this;
    return TbtTheme(
      accent: Color.lerp(accent, other.accent, t)!,
      alert: Color.lerp(alert, other.alert, t)!,
      success: Color.lerp(success, other.success, t)!,
      bgPrimary: Color.lerp(bgPrimary, other.bgPrimary, t)!,
      bgSurface: Color.lerp(bgSurface, other.bgSurface, t)!,
    );
  }
}

/// Convenience extension to access `TbtTheme` off `BuildContext`.
extension TbtThemeContext on BuildContext {
  TbtTheme get tbt =>
      Theme.of(this).extension<TbtTheme>() ?? TbtTheme.defaults;
}
