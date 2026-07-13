import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

extension BuildContextExt on BuildContext {
  ThemeData get theme => Theme.of(this);
  TextTheme get textTheme => Theme.of(this).textTheme;
  ColorScheme get colorScheme => Theme.of(this).colorScheme;
  Size get screenSize => MediaQuery.sizeOf(this);
  double get screenWidth => MediaQuery.sizeOf(this).width;
  double get screenHeight => MediaQuery.sizeOf(this).height;
  bool get isDark => Theme.of(this).brightness == Brightness.dark;

  void popScreen<T>([T? result]) => Navigator.of(this).pop(result);
  void goTo(String location) => GoRouter.of(this).go(location);
}
