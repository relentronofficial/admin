import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:go_router/go_router.dart';

extension BuildContextExt on BuildContext {
  ThemeData get theme => Theme.of(this);
  TextTheme get textTheme => Theme.of(this).textTheme;
  ColorScheme get colorScheme => Theme.of(this).colorScheme;
  Size get screenSize => MediaQuery.sizeOf(this);
  double get screenWidth => MediaQuery.sizeOf(this).width;
  double get screenHeight => MediaQuery.sizeOf(this).height;
  bool get isDark => Theme.of(this).brightness == Brightness.dark;

  /// Convenience accessor for the localized strings. Throws if called
  /// outside a widget tree that has [AppL10n.localizationsDelegates] wired
  /// in its [MaterialApp] — which is every screen in this app.
  AppL10n get l10n => AppL10n.of(this)!;

  void popScreen<T>([T? result]) => Navigator.of(this).pop(result);
  void goTo(String location) => GoRouter.of(this).go(location);
}
