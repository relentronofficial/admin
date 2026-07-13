import 'package:flutter/material.dart';

import 'design_constants.dart';
import 'tbt_theme.dart';

/// Minimal light theme — flips scaffold + surface + text base colors to
/// paper-like tones while keeping the tenant's `accent` unchanged. Many
/// widgets still hardcode `kColor*` dark tokens (see `design_constants.dart`)
/// so they stay dark even in light mode; that surface-by-surface migration
/// is a follow-up. Toggling primarily affects the MaterialApp defaults +
/// AppBar / Scaffold background / TextTheme base color.
ThemeData buildLightTheme(TbtTheme ext) {
  const bgLight = Color(0xFFf7f7f8);
  const surfaceLight = Colors.white;
  const borderLight = Color(0xFFe5e5e5);
  const inputLight = Color(0xFFf1f1f2);
  const textPrimaryLight = Color(0xFF101010);
  const textMutedLight = Color(0xFF6b6b6b);
  final base = ThemeData.light();
  return base.copyWith(
    scaffoldBackgroundColor: bgLight,
    colorScheme: base.colorScheme.copyWith(
      primary: ext.accent,
      secondary: ext.alert,
      surface: surfaceLight,
      error: ext.accent,
    ),
    cardColor: surfaceLight,
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: inputLight,
      hintStyle: const TextStyle(color: textMutedLight, fontSize: 14),
      contentPadding:
          const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: borderLight),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: borderLight),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: BorderSide(color: ext.accent),
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: ext.accent,
        foregroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        elevation: 0,
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(foregroundColor: ext.accent),
    ),
    dividerColor: borderLight,
    appBarTheme: const AppBarTheme(
      backgroundColor: surfaceLight,
      foregroundColor: textPrimaryLight,
      elevation: 0,
      scrolledUnderElevation: 0,
      surfaceTintColor: Colors.transparent,
    ),
    textTheme: base.textTheme.apply(
      bodyColor: textPrimaryLight,
      displayColor: textPrimaryLight,
    ),
    snackBarTheme: const SnackBarThemeData(
      backgroundColor: surfaceLight,
      contentTextStyle: TextStyle(color: textPrimaryLight),
    ),
    extensions: [ext],
  );
}

ThemeData buildDarkTheme(TbtTheme ext) {
  final base = ThemeData.dark();

  return base.copyWith(
    scaffoldBackgroundColor: ext.bgPrimary,
    colorScheme: base.colorScheme.copyWith(
      primary: ext.accent,
      secondary: ext.alert,
      surface: ext.bgSurface,
      error: ext.accent,
    ),
    cardColor: ext.bgSurface,
    cardTheme: CardTheme(
      color: ext.bgSurface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: kColorBorderCard),
      ),
      elevation: 0,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: kColorBgInput,
      hintStyle: const TextStyle(color: kColorTextMuted, fontSize: 14),
      contentPadding:
          const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: kColorBorderCard),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: kColorBorderCard),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: BorderSide(color: ext.accent),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: BorderSide(color: ext.accent),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: BorderSide(color: ext.accent),
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: ext.accent,
        foregroundColor: Colors.white,
        disabledBackgroundColor: ext.accent.withAlpha(0x80),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        elevation: 0,
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(foregroundColor: ext.accent),
    ),
    dividerColor: kColorBorderCard,
    textTheme: _buildTextTheme(base.textTheme),
    appBarTheme: AppBarTheme(
      backgroundColor: ext.bgSurface,
      foregroundColor: kColorTextPrimary,
      elevation: 0,
      scrolledUnderElevation: 0,
      surfaceTintColor: Colors.transparent,
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: ext.bgSurface,
      indicatorColor: ext.accent.withAlpha(0x33),
      iconTheme: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.selected)) {
          return IconThemeData(color: ext.accent);
        }
        return const IconThemeData(color: kColorTextMuted);
      }),
      labelTextStyle: WidgetStateProperty.resolveWith((states) {
        final color = states.contains(WidgetState.selected)
            ? ext.accent
            : kColorTextMuted;
        return TextStyle(
          fontFamily: 'Rajdhani',
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: color,
        );
      }),
    ),
    snackBarTheme: const SnackBarThemeData(
      backgroundColor: kColorBgSurface,
      contentTextStyle: TextStyle(color: kColorTextPrimary),
    ),
    extensions: [ext],
  );
}

TextTheme _buildTextTheme(TextTheme base) {
  return base.copyWith(
    displayLarge: const TextStyle(
      fontFamily: 'Rajdhani',
      fontSize: 32,
      fontWeight: FontWeight.w700,
      color: kColorTextPrimary,
      letterSpacing: 2,
    ),
    displayMedium: const TextStyle(
      fontFamily: 'Rajdhani',
      fontSize: 28,
      fontWeight: FontWeight.w700,
      color: kColorTextPrimary,
      letterSpacing: 2,
    ),
    displaySmall: const TextStyle(
      fontFamily: 'Rajdhani',
      fontSize: 24,
      fontWeight: FontWeight.w700,
      color: kColorTextPrimary,
      letterSpacing: 1.5,
    ),
    headlineLarge: const TextStyle(
      fontFamily: 'Rajdhani',
      fontSize: 22,
      fontWeight: FontWeight.w700,
      color: kColorTextPrimary,
      letterSpacing: 1.5,
    ),
    headlineMedium: const TextStyle(
      fontFamily: 'Rajdhani',
      fontSize: 20,
      fontWeight: FontWeight.w700,
      color: kColorTextPrimary,
      letterSpacing: 1,
    ),
    headlineSmall: const TextStyle(
      fontFamily: 'Rajdhani',
      fontSize: 18,
      fontWeight: FontWeight.w600,
      color: kColorTextPrimary,
      letterSpacing: 1,
    ),
    titleLarge: const TextStyle(
      fontFamily: 'Rajdhani',
      fontSize: 16,
      fontWeight: FontWeight.w600,
      color: kColorTextPrimary,
      letterSpacing: 0.5,
    ),
    bodyLarge: const TextStyle(fontSize: 16, color: kColorTextPrimary),
    bodyMedium: const TextStyle(fontSize: 14, color: kColorTextPrimary),
    bodySmall: const TextStyle(fontSize: 12, color: kColorTextSecondary),
    labelLarge: const TextStyle(
      fontFamily: 'Rajdhani',
      fontSize: 11,
      fontWeight: FontWeight.w700,
      color: kColorTextMuted,
      letterSpacing: 1.5,
    ),
  );
}
