// The palette below intentionally references the legacy `kColor*` const
// values so both APIs resolve to the exact same dark-mode hex codes.
// ignore_for_file: deprecated_member_use_from_same_package

import 'package:flutter/material.dart';

import 'design_constants.dart';

/// Theme-aware color tokens. Prefer `context.tokens.bgPage` etc. over the
/// hardcoded `kColorBgPage` constants — the latter always resolves dark and
/// makes the light-mode toggle look half-broken on any surface still using
/// them.
///
/// This is a gradual migration: new code + high-traffic surfaces should use
/// [ThemeTokens]; older screens still referencing the raw `kColor*` constants
/// keep working but ignore the light-mode toggle.
class ThemeTokens {
  const ThemeTokens._({
    required this.bgPage,
    required this.bgSurface,
    required this.bgInput,
    required this.bgModal,
    required this.borderCard,
    required this.borderInput,
    required this.textPrimary,
    required this.textSecondary,
    required this.textMuted,
    required this.textSubtle,
  });

  final Color bgPage;
  final Color bgSurface;
  final Color bgInput;
  final Color bgModal;
  final Color borderCard;
  final Color borderInput;
  final Color textPrimary;
  final Color textSecondary;
  final Color textMuted;
  final Color textSubtle;

  static const ThemeTokens dark = ThemeTokens._(
    bgPage: kColorBgPage,
    bgSurface: kColorBgSurface,
    bgInput: kColorBgInput,
    bgModal: kColorBgModal,
    borderCard: kColorBorderCard,
    borderInput: kColorBorderInput,
    textPrimary: kColorTextPrimary,
    textSecondary: kColorTextSecondary,
    textMuted: kColorTextMuted,
    textSubtle: kColorTextSubtle,
  );

  static const ThemeTokens light = ThemeTokens._(
    bgPage: Color(0xFFf7f7f8),
    bgSurface: Colors.white,
    bgInput: Color(0xFFf1f1f2),
    bgModal: Colors.white,
    borderCard: Color(0xFFe5e5e5),
    borderInput: Color(0xFFd4d4d8),
    textPrimary: Color(0xFF101010),
    textSecondary: Color(0xFF4a4a4a),
    textMuted: Color(0xFF6b6b6b),
    textSubtle: Color(0xFF9a9a9a),
  );
}

extension ThemeTokensContext on BuildContext {
  /// Returns the palette matching the current [Theme.brightness].
  /// Widgets should prefer this over the raw `kColor*` constants so the
  /// dark-mode toggle actually affects them.
  ThemeTokens get tokens =>
      Theme.of(this).brightness == Brightness.dark
          ? ThemeTokens.dark
          : ThemeTokens.light;
}
