import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'design_tokens.dart';
import 'tbt_theme.dart';

// ── Light + dark palettes (mirror F:\admin\tbt-user-web\app\globals.css) ──────
//
// The web app has one canonical CSS token set per mode. Mirror the same
// tokens here so both platforms render the same colour hierarchy at every
// surface. Anything that isn't accent/alert/success (which come from the
// tenant SiteConfig API) should be sourced from these palettes.

class _Palette {
  const _Palette._({
    required this.bgPage,
    required this.bgSurface,
    required this.bgInput,
    required this.bgModal,
    required this.bgOverlay,
    required this.borderCard,
    required this.borderInput,
    required this.borderSubtle,
    required this.textPrimary,
    required this.textSecondary,
    required this.textMuted,
    required this.textSubtle,
    required this.iconDefault,
    required this.iconMuted,
    required this.divider,
    required this.disabled,
    required this.chipBg,
    required this.chipFg,
    required this.shadow,
    required this.progressTrack,
    required this.snackBg,
    required this.snackFg,
    required this.systemOverlay,
  });

  final Color bgPage;
  final Color bgSurface;
  final Color bgInput;
  final Color bgModal;
  final Color bgOverlay;
  final Color borderCard;
  final Color borderInput;
  final Color borderSubtle;
  final Color textPrimary;
  final Color textSecondary;
  final Color textMuted;
  final Color textSubtle;
  final Color iconDefault;
  final Color iconMuted;
  final Color divider;
  final Color disabled;
  final Color chipBg;
  final Color chipFg;
  final Color shadow;
  final Color progressTrack;
  final Color snackBg;
  final Color snackFg;
  final SystemUiOverlayStyle systemOverlay;

  static const _Palette dark = _Palette._(
    bgPage: Color(0xFF0f0f0f),
    bgSurface: Color(0xFF181818),
    bgInput: Color(0xFF1a1a1a),
    bgModal: Color(0xFF141414),
    bgOverlay: Color(0xE60f0f0f),
    borderCard: Color(0xFF2a2a2a),
    borderInput: Color(0xFF333333),
    borderSubtle: Color(0x14FFFFFF),
    textPrimary: Color(0xFFf0f0f0),
    textSecondary: Color(0xFFa0a0a0),
    textMuted: Color(0xFF606060),
    textSubtle: Color(0xFF444444),
    iconDefault: Color(0xFFf0f0f0),
    iconMuted: Color(0xFFa0a0a0),
    divider: Color(0xFF2a2a2a),
    disabled: Color(0xFF3a3a3a),
    chipBg: Color(0xFF1f1f1f),
    chipFg: Color(0xFFa0a0a0),
    shadow: Color(0x66000000),
    progressTrack: Color(0xFF2a2a2a),
    snackBg: Color(0xFF181818),
    snackFg: Color(0xFFf0f0f0),
    // Status bar icons on top of dark scaffold — need light content.
    systemOverlay: SystemUiOverlayStyle(
      statusBarColor: Color(0x00000000),
      statusBarIconBrightness: Brightness.light,
      statusBarBrightness: Brightness.dark,
      systemNavigationBarColor: Color(0xFF0f0f0f),
      systemNavigationBarIconBrightness: Brightness.light,
    ),
  );

  static const _Palette light = _Palette._(
    bgPage: Color(0xFFf7f7f8),
    bgSurface: Color(0xFFFFFFFF),
    bgInput: Color(0xFFf1f1f2),
    bgModal: Color(0xFFFFFFFF),
    bgOverlay: Color(0xE6FFFFFF),
    borderCard: Color(0xFFe5e5e5),
    borderInput: Color(0xFFd4d4d8),
    borderSubtle: Color(0x14000000),
    textPrimary: Color(0xFF101010),
    textSecondary: Color(0xFF4a4a4a),
    textMuted: Color(0xFF6b6b6b),
    textSubtle: Color(0xFF9a9a9a),
    iconDefault: Color(0xFF101010),
    iconMuted: Color(0xFF6b6b6b),
    divider: Color(0xFFe5e5e5),
    disabled: Color(0xFFcccccc),
    chipBg: Color(0xFFf1f1f2),
    chipFg: Color(0xFF4a4a4a),
    shadow: Color(0x1F000000),
    progressTrack: Color(0xFFe5e5e5),
    snackBg: Color(0xFF101010),
    snackFg: Color(0xFFFFFFFF),
    // Status bar icons on top of light scaffold — need dark content.
    systemOverlay: SystemUiOverlayStyle(
      statusBarColor: Color(0x00000000),
      statusBarIconBrightness: Brightness.dark,
      statusBarBrightness: Brightness.light,
      systemNavigationBarColor: Color(0xFFf7f7f8),
      systemNavigationBarIconBrightness: Brightness.dark,
    ),
  );
}

// ── Public entrypoints ────────────────────────────────────────────────────────

ThemeData buildLightTheme(TbtTheme ext) => _buildTheme(ext, _Palette.light);
ThemeData buildDarkTheme(TbtTheme ext) => _buildTheme(ext, _Palette.dark);

/// System-chrome (status bar / nav bar) style matching the given brightness —
/// used at the root so the OS chrome flips instantly on theme toggle.
SystemUiOverlayStyle systemOverlayFor(Brightness b) =>
    b == Brightness.dark ? _Palette.dark.systemOverlay : _Palette.light.systemOverlay;

// ── Shared builder ────────────────────────────────────────────────────────────

ThemeData _buildTheme(TbtTheme ext, _Palette p) {
  final isDark = p == _Palette.dark;
  final base = isDark ? ThemeData.dark() : ThemeData.light();

  final colorScheme = base.colorScheme.copyWith(
    brightness: isDark ? Brightness.dark : Brightness.light,
    primary: ext.accent,
    onPrimary: Colors.white,
    secondary: ext.alert,
    onSecondary: Colors.white,
    surface: p.bgSurface,
    onSurface: p.textPrimary,
    error: ext.accent,
    onError: Colors.white,
    outline: p.borderCard,
    outlineVariant: p.borderSubtle,
  );

  final textTheme = _buildTextTheme(base.textTheme, p);

  return base.copyWith(
    brightness: isDark ? Brightness.dark : Brightness.light,
    scaffoldBackgroundColor: isDark ? ext.bgPrimary : p.bgPage,
    canvasColor: isDark ? ext.bgPrimary : p.bgPage,
    colorScheme: colorScheme,
    dividerColor: p.divider,
    disabledColor: p.disabled,
    shadowColor: p.shadow,
    cardColor: isDark ? ext.bgSurface : p.bgSurface,
    hintColor: p.textMuted,
    unselectedWidgetColor: p.iconMuted,
    splashColor: ext.accent.withValues(alpha: 0.08),
    highlightColor: ext.accent.withValues(alpha: 0.06),
    textTheme: textTheme,
    primaryTextTheme: textTheme,

    // ── Card ────────────────────────────────────────────────────────────────
    cardTheme: CardThemeData(
      color: isDark ? ext.bgSurface : p.bgSurface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadius.lg),
        side: BorderSide(color: p.borderCard),
      ),
      elevation: 0,
      surfaceTintColor: Colors.transparent,
      margin: EdgeInsets.zero,
    ),

    // ── AppBar ──────────────────────────────────────────────────────────────
    appBarTheme: AppBarTheme(
      backgroundColor: isDark ? ext.bgSurface : p.bgSurface,
      foregroundColor: p.textPrimary,
      elevation: 0,
      scrolledUnderElevation: 0,
      surfaceTintColor: Colors.transparent,
      iconTheme: IconThemeData(color: p.iconDefault),
      actionsIconTheme: IconThemeData(color: p.iconMuted),
      titleTextStyle: TextStyle(
        fontFamily: 'Rajdhani',
        fontSize: 17,
        fontWeight: FontWeight.w700,
        letterSpacing: 1.5,
        color: p.textPrimary,
      ),
      systemOverlayStyle: p.systemOverlay,
    ),

    // ── Bottom nav (NavigationBar) ──────────────────────────────────────────
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: isDark ? ext.bgSurface : p.bgSurface,
      surfaceTintColor: Colors.transparent,
      indicatorColor: ext.accent.withValues(alpha: 0.2),
      iconTheme: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.selected)) {
          return IconThemeData(color: ext.accent);
        }
        return IconThemeData(color: p.iconMuted);
      }),
      labelTextStyle: WidgetStateProperty.resolveWith((states) {
        final color =
            states.contains(WidgetState.selected) ? ext.accent : p.iconMuted;
        return TextStyle(
          fontFamily: 'Rajdhani',
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: color,
        );
      }),
    ),

    bottomNavigationBarTheme: BottomNavigationBarThemeData(
      backgroundColor: isDark ? ext.bgSurface : p.bgSurface,
      selectedItemColor: ext.accent,
      unselectedItemColor: p.iconMuted,
      type: BottomNavigationBarType.fixed,
    ),

    bottomAppBarTheme: BottomAppBarTheme(
      color: isDark ? ext.bgSurface : p.bgSurface,
      elevation: 0,
    ),

    // ── Input ───────────────────────────────────────────────────────────────
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: p.bgInput,
      hintStyle: TextStyle(color: p.textMuted, fontSize: 14),
      labelStyle: TextStyle(color: p.textMuted, fontSize: 12),
      floatingLabelStyle: TextStyle(color: ext.accent, fontSize: 12),
      contentPadding:
          const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadius.md),
        borderSide: BorderSide(color: p.borderCard),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadius.md),
        borderSide: BorderSide(color: p.borderCard),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadius.md),
        borderSide: BorderSide(color: ext.accent),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadius.md),
        borderSide: BorderSide(color: ext.accent),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadius.md),
        borderSide: BorderSide(color: ext.accent),
      ),
    ),

    // ── Buttons ─────────────────────────────────────────────────────────────
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: ext.accent,
        foregroundColor: Colors.white,
        disabledBackgroundColor: ext.accent.withValues(alpha: 0.5),
        disabledForegroundColor: Colors.white.withValues(alpha: 0.75),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.md)),
        elevation: 0,
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(foregroundColor: ext.accent),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: p.textPrimary,
        side: BorderSide(color: p.borderCard),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.md)),
      ),
    ),
    iconButtonTheme: IconButtonThemeData(
      style: IconButton.styleFrom(
        foregroundColor: p.iconMuted,
      ),
    ),

    // ── Divider / Icons / ListTile ──────────────────────────────────────────
    dividerTheme: DividerThemeData(color: p.divider, thickness: 1, space: 1),
    iconTheme: IconThemeData(color: p.iconDefault),
    primaryIconTheme: IconThemeData(color: p.iconDefault),
    listTileTheme: ListTileThemeData(
      iconColor: p.iconMuted,
      textColor: p.textPrimary,
      titleTextStyle: TextStyle(
        color: p.textPrimary,
        fontSize: 14,
        fontWeight: FontWeight.w500,
      ),
      subtitleTextStyle: TextStyle(color: p.textMuted, fontSize: 12),
      selectedColor: ext.accent,
      selectedTileColor: ext.accent.withValues(alpha: 0.08),
    ),

    // ── Chip / Switch / Radio / Checkbox / Progress ─────────────────────────
    chipTheme: ChipThemeData(
      backgroundColor: p.chipBg,
      disabledColor: p.disabled,
      selectedColor: ext.accent.withValues(alpha: 0.15),
      secondarySelectedColor: ext.accent.withValues(alpha: 0.15),
      labelStyle: TextStyle(color: p.chipFg, fontSize: 12),
      secondaryLabelStyle: TextStyle(color: ext.accent, fontSize: 12),
      side: BorderSide(color: p.borderCard),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.sm)),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
    ),
    switchTheme: SwitchThemeData(
      thumbColor: WidgetStateProperty.resolveWith((states) =>
          states.contains(WidgetState.selected) ? Colors.white : p.iconMuted),
      trackColor: WidgetStateProperty.resolveWith((states) =>
          states.contains(WidgetState.selected) ? ext.accent : p.borderCard),
    ),
    checkboxTheme: CheckboxThemeData(
      fillColor: WidgetStateProperty.resolveWith((states) =>
          states.contains(WidgetState.selected)
              ? ext.accent
              : Colors.transparent),
      checkColor: WidgetStatePropertyAll(Colors.white),
      side: BorderSide(color: p.borderCard),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.sm)),
    ),
    radioTheme: RadioThemeData(
      fillColor: WidgetStateProperty.resolveWith((states) =>
          states.contains(WidgetState.selected) ? ext.accent : p.iconMuted),
    ),
    progressIndicatorTheme: ProgressIndicatorThemeData(
      color: ext.accent,
      linearTrackColor: p.progressTrack,
      circularTrackColor: p.progressTrack,
    ),
    sliderTheme: SliderThemeData(
      activeTrackColor: ext.accent,
      inactiveTrackColor: p.progressTrack,
      thumbColor: ext.accent,
      overlayColor: ext.accent.withValues(alpha: 0.15),
    ),

    // ── Dialog / BottomSheet / PopupMenu / Tooltip / Menu / SnackBar ────────
    dialogTheme: DialogThemeData(
      backgroundColor: isDark ? const Color(0xFF141414) : p.bgSurface,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.lg)),
      titleTextStyle: TextStyle(
        color: p.textPrimary,
        fontSize: 16,
        fontWeight: FontWeight.w700,
      ),
      contentTextStyle: TextStyle(
        color: p.textSecondary,
        fontSize: 13,
        height: 1.5,
      ),
    ),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: isDark ? ext.bgSurface : p.bgSurface,
      surfaceTintColor: Colors.transparent,
      modalBackgroundColor: isDark ? ext.bgSurface : p.bgSurface,
      modalBarrierColor: Colors.black.withValues(alpha: 0.5),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
    ),
    popupMenuTheme: PopupMenuThemeData(
      color: isDark ? ext.bgSurface : p.bgSurface,
      surfaceTintColor: Colors.transparent,
      textStyle: TextStyle(color: p.textPrimary, fontSize: 13),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.md)),
      elevation: 6,
    ),
    tooltipTheme: TooltipThemeData(
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFFf0f0f0) : const Color(0xFF101010),
        borderRadius: BorderRadius.circular(AppRadius.sm),
      ),
      textStyle: TextStyle(
        color: isDark ? const Color(0xFF101010) : Colors.white,
        fontSize: 11,
      ),
    ),
    menuTheme: MenuThemeData(
      style: MenuStyle(
        backgroundColor: WidgetStatePropertyAll(
            isDark ? ext.bgSurface : p.bgSurface),
        surfaceTintColor: const WidgetStatePropertyAll(Colors.transparent),
      ),
    ),
    drawerTheme: DrawerThemeData(
      backgroundColor: isDark ? ext.bgSurface : p.bgSurface,
      surfaceTintColor: Colors.transparent,
    ),

    snackBarTheme: SnackBarThemeData(
      backgroundColor: p.snackBg,
      contentTextStyle: TextStyle(color: p.snackFg),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.md)),
    ),

    // ── Tabs / Selection ───────────────────────────────────────────────────
    tabBarTheme: TabBarThemeData(
      labelColor: ext.accent,
      unselectedLabelColor: p.iconMuted,
      indicatorColor: ext.accent,
      dividerColor: p.divider,
      labelStyle: const TextStyle(
        fontFamily: 'Rajdhani',
        fontSize: 13,
        fontWeight: FontWeight.w700,
        letterSpacing: 0.5,
      ),
      unselectedLabelStyle: const TextStyle(
        fontFamily: 'Rajdhani',
        fontSize: 13,
        fontWeight: FontWeight.w600,
      ),
    ),
    textSelectionTheme: TextSelectionThemeData(
      cursorColor: ext.accent,
      selectionColor: ext.accent.withValues(alpha: 0.25),
      selectionHandleColor: ext.accent,
    ),

    // ── ThemeExtensions ─────────────────────────────────────────────────────
    extensions: <ThemeExtension<dynamic>>[ext],
  );
}

TextTheme _buildTextTheme(TextTheme base, _Palette p) {
  return base.copyWith(
    displayLarge: TextStyle(
      fontFamily: 'Rajdhani',
      fontSize: 32,
      fontWeight: FontWeight.w700,
      color: p.textPrimary,
      letterSpacing: 2,
    ),
    displayMedium: TextStyle(
      fontFamily: 'Rajdhani',
      fontSize: 28,
      fontWeight: FontWeight.w700,
      color: p.textPrimary,
      letterSpacing: 2,
    ),
    displaySmall: TextStyle(
      fontFamily: 'Rajdhani',
      fontSize: 24,
      fontWeight: FontWeight.w700,
      color: p.textPrimary,
      letterSpacing: 1.5,
    ),
    headlineLarge: TextStyle(
      fontFamily: 'Rajdhani',
      fontSize: 22,
      fontWeight: FontWeight.w700,
      color: p.textPrimary,
      letterSpacing: 1.5,
    ),
    headlineMedium: TextStyle(
      fontFamily: 'Rajdhani',
      fontSize: 20,
      fontWeight: FontWeight.w700,
      color: p.textPrimary,
      letterSpacing: 1,
    ),
    headlineSmall: TextStyle(
      fontFamily: 'Rajdhani',
      fontSize: 18,
      fontWeight: FontWeight.w600,
      color: p.textPrimary,
      letterSpacing: 1,
    ),
    titleLarge: TextStyle(
      fontFamily: 'Rajdhani',
      fontSize: 16,
      fontWeight: FontWeight.w600,
      color: p.textPrimary,
      letterSpacing: 0.5,
    ),
    titleMedium: TextStyle(
      fontSize: 15,
      fontWeight: FontWeight.w600,
      color: p.textPrimary,
    ),
    titleSmall: TextStyle(
      fontSize: 13,
      fontWeight: FontWeight.w600,
      color: p.textSecondary,
    ),
    bodyLarge: TextStyle(fontSize: 16, color: p.textPrimary),
    bodyMedium: TextStyle(fontSize: 14, color: p.textPrimary),
    bodySmall: TextStyle(fontSize: 12, color: p.textSecondary),
    labelLarge: TextStyle(
      fontFamily: 'Rajdhani',
      fontSize: 11,
      fontWeight: FontWeight.w700,
      color: p.textMuted,
      letterSpacing: 1.5,
    ),
    labelMedium: TextStyle(color: p.textMuted, fontSize: 11),
    labelSmall: TextStyle(color: p.textMuted, fontSize: 10),
  );
}
