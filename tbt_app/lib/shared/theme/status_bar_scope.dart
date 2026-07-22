import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Forces a specific status-bar icon brightness on the wrapped subtree,
/// regardless of the app's active theme.
///
/// The app-wide default is set once in [TbtApp.build] from
/// `systemOverlayFor(themeBrightness)`. That's correct for the vast
/// majority of screens which follow the theme (bgPage / bgSurface
/// tokens). But a handful of screens have a **fixed** dark background
/// no matter which theme is active — full-screen video players, the
/// login screen, the splash video, image/video lightboxes, LiveKit
/// calls. On those screens, if the user has the app in Light theme,
/// the OS status-bar icons render dark on black and disappear.
///
/// Wrap each such screen at its root Scaffold with
/// [StatusBarScope.overDarkBackground] (or `.overLightBackground` for the
/// reverse case) so the platform draws contrasting icons.
class StatusBarScope extends StatelessWidget {
  /// Use on a screen whose background is dark / black regardless of the
  /// app theme (video players, black splash, lightboxes). Produces
  /// white / light status-bar icons.
  const StatusBarScope.overDarkBackground({required this.child, super.key})
      : _style = _light;

  /// Use on a screen whose background is bright / white regardless of the
  /// app theme. Produces dark status-bar icons.
  const StatusBarScope.overLightBackground({required this.child, super.key})
      : _style = _dark;

  final Widget child;
  final SystemUiOverlayStyle _style;

  @override
  Widget build(BuildContext context) => AnnotatedRegion<SystemUiOverlayStyle>(
        value: _style,
        child: child,
      );

  // Light-content icons — white/light glyphs for dark backdrops.
  static const _light = SystemUiOverlayStyle(
    statusBarColor: Color(0x00000000),
    statusBarIconBrightness: Brightness.light,
    statusBarBrightness: Brightness.dark,
    systemNavigationBarColor: Color(0xFF000000),
    systemNavigationBarIconBrightness: Brightness.light,
  );

  // Dark-content icons — black/dark glyphs for light backdrops.
  static const _dark = SystemUiOverlayStyle(
    statusBarColor: Color(0x00000000),
    statusBarIconBrightness: Brightness.dark,
    statusBarBrightness: Brightness.light,
    systemNavigationBarColor: Color(0xFFFFFFFF),
    systemNavigationBarIconBrightness: Brightness.dark,
  );
}
