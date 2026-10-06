import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'site_config_provider.dart';

/// Admin-controlled theme mode (Admin → Navigation → Dark / Light Mode).
///
/// Members cannot override it — the value comes from `themeMode` on
/// `GET /api/pub/config/site`. [SiteConfigNotifier] serves the last cached
/// config instantly on launch and refreshes it in the background, so the
/// admin's choice persists across restarts and re-logins.
///
/// Read by [MaterialApp] to pick between `theme:` / `darkTheme:`.
final themeModeProvider = Provider<ThemeMode>((ref) {
  final mode = ref.watch(siteConfigNotifierProvider).valueOrNull?.themeMode;
  return mode == 'dark' ? ThemeMode.dark : ThemeMode.light;
});
