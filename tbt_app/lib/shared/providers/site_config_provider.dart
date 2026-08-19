import 'dart:async';

import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../config/nav_config.dart';
import '../../config/site_config.dart';
import '../../config/ui_strings.dart';
import '../api/services/config_service.dart';
import '../cache/response_cache.dart';

part 'site_config_provider.g.dart';

@Riverpod(keepAlive: true)
class SiteConfigNotifier extends _$SiteConfigNotifier {
  static const _cacheKey = 'cfg:site:v1';
  bool _initialLoadDone = false;

  @override
  Future<SiteConfig> build() async {
    if (!_initialLoadDone) {
      _initialLoadDone = true;
      final cached = ResponseCache.readPayload(_cacheKey);
      if (cached != null) {
        Future.microtask(_backgroundRefresh);
        return SiteConfig.fromJson(cached);
      }
    }
    return _fetch();
  }

  Future<SiteConfig> _fetch() async {
    final raw = await ref.read(configServiceProvider).getSiteConfig();
    final data = raw['data'] as Map<String, dynamic>? ?? {};
    unawaited(ResponseCache.write(_cacheKey, data));
    return SiteConfig.fromJson(data);
  }

  Future<void> _backgroundRefresh() async {
    try {
      state = AsyncValue.data(await _fetch());
    } catch (_) {}
  }
}

@Riverpod(keepAlive: true)
class NavConfigNotifier extends _$NavConfigNotifier {
  static const _cacheKey = 'cfg:nav:v1';
  bool _initialLoadDone = false;

  @override
  Future<NavConfig> build() async {
    if (!_initialLoadDone) {
      _initialLoadDone = true;
      final cached = ResponseCache.readPayload(_cacheKey);
      if (cached != null) {
        Future.microtask(_backgroundRefresh);
        return NavConfig.fromJson(cached);
      }
    }
    return _fetch();
  }

  Future<NavConfig> _fetch() async {
    final raw = await ref.read(configServiceProvider).getNavConfig();
    final data = raw['data'] as Map<String, dynamic>? ?? {};
    unawaited(ResponseCache.write(_cacheKey, data));
    return NavConfig.fromJson(data);
  }

  Future<void> _backgroundRefresh() async {
    try {
      state = AsyncValue.data(await _fetch());
    } catch (_) {}
  }
}

@Riverpod(keepAlive: true)
class UiStringsNotifier extends _$UiStringsNotifier {
  static const _cacheKey = 'cfg:ui-strings:v1';
  bool _initialLoadDone = false;

  @override
  Future<UiStrings> build() async {
    if (!_initialLoadDone) {
      _initialLoadDone = true;
      final cached = ResponseCache.readPayload(_cacheKey);
      if (cached != null) {
        Future.microtask(_backgroundRefresh);
        return UiStrings.fromJson(cached);
      }
    }
    return _fetch();
  }

  Future<UiStrings> _fetch() async {
    final raw = await ref.read(configServiceProvider).getUiStrings();
    final data = raw['data'] as Map<String, dynamic>? ?? {};
    unawaited(ResponseCache.write(_cacheKey, data));
    return UiStrings.fromJson(data);
  }

  Future<void> _backgroundRefresh() async {
    try {
      state = AsyncValue.data(await _fetch());
    } catch (_) {}
  }
}
