import 'package:flutter/material.dart';

/// The TBT wordmark.
///
/// Reconstructed from its call sites — this file was referenced by
/// `home_header.dart` and `tbt_app_drawer.dart` but was never committed, so
/// there is no earlier version in git to recover.
///
/// Two facts pinned the behaviour:
///
///   * `login_screen.dart` documents it as doing a `Theme.of(context)` lookup
///     to choose an asset, and deliberately bypasses it ("Force the dark-theme
///     asset directly … since the login card always sits on a black background
///     regardless of the app's active themeMode"). So the widget is
///     theme-aware, and the login screen is the intentional exception.
///   * `assets/images/` ships exactly one light/dark pair —
///     `tbt_logo.webp` (light mark, for dark surfaces) and `tbt_logo_black.png`
///     (dark mark, for light surfaces).
///
/// The `errorBuilder` fallback mirrors the login screen's: if the asset fails
/// to decode, render the wordmark as text rather than a broken-image box.
class AppLogo extends StatelessWidget {
  const AppLogo({super.key, this.width, this.height, this.fit = BoxFit.contain});

  /// Sized for an app bar / drawer header. Const so the existing
  /// `const AppLogo.appBar()` call site in `tbt_app_drawer.dart` still compiles.
  const AppLogo.appBar({super.key})
      : width = 108,
        height = 32,
        fit = BoxFit.contain;

  final double? width;
  final double? height;
  final BoxFit fit;

  static const _lightSurfaceAsset = 'assets/images/tbt_logo_black.png';
  static const _darkSurfaceAsset = 'assets/images/tbt_logo.webp';

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Image.asset(
      isDark ? _darkSurfaceAsset : _lightSurfaceAsset,
      width: width,
      height: height,
      fit: fit,
      errorBuilder: (context, error, stackTrace) => Text(
        'TBT',
        textAlign: TextAlign.center,
        style: TextStyle(
          color: isDark ? Colors.white : Colors.black,
          fontWeight: FontWeight.w700,
          letterSpacing: 2,
          fontSize: (height ?? 32) * 0.55,
        ),
      ),
    );
  }
}
