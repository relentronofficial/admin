import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tbt_app/shared/api/services/config_service.dart';
import 'package:tbt_app/shared/providers/site_config_provider.dart';
import 'package:tbt_app/shared/providers/theme_mode_provider.dart';

/// Stands in for `GET /api/pub/config/site`; `themeMode` mimics the value the
/// admin saved, `fail` mimics being offline.
class _FakeConfigService extends ConfigService {
  _FakeConfigService() : super(Dio());

  String? themeMode = 'light';
  bool fail = false;

  @override
  Future<Map<String, dynamic>> getSiteConfig() async {
    if (fail) throw Exception('offline');
    return {
      'success': true,
      'data': {
        'siteName': 'TBT',
        if (themeMode != null) 'themeMode': themeMode,
      },
    };
  }
}

void main() {
  late _FakeConfigService api;
  late ProviderContainer container;

  setUp(() {
    api = _FakeConfigService();
    container = ProviderContainer(
      overrides: [configServiceProvider.overrideWithValue(api)],
    );
    addTearDown(container.dispose);
  });

  Future<ThemeMode> loadedMode() async {
    await container.read(siteConfigNotifierProvider.future);
    return container.read(themeModeProvider);
  }

  test('follows the admin setting from the site config', () async {
    api.themeMode = 'dark';
    expect(await loadedMode(), ThemeMode.dark);
  });

  test('refresh() picks up an admin change in a running app', () async {
    expect(await loadedMode(), ThemeMode.light);

    api.themeMode = 'dark'; // admin selects Dark and saves
    await container.read(siteConfigNotifierProvider.notifier).refresh();
    expect(container.read(themeModeProvider), ThemeMode.dark);

    api.themeMode = 'light'; // admin switches back
    await container.read(siteConfigNotifierProvider.notifier).refresh();
    expect(container.read(themeModeProvider), ThemeMode.light);
  });

  test('a failed refresh (offline) keeps the last fetched setting', () async {
    api.themeMode = 'dark';
    expect(await loadedMode(), ThemeMode.dark);

    api.fail = true;
    await container.read(siteConfigNotifierProvider.notifier).refresh();
    expect(container.read(themeModeProvider), ThemeMode.dark);
  });

  test('falls back to light only when the config has no themeMode', () async {
    api.themeMode = null;
    expect(await loadedMode(), ThemeMode.light);
  });
}
