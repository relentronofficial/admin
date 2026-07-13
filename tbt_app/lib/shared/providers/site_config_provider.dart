import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../config/nav_config.dart';
import '../../config/site_config.dart';
import '../../config/ui_strings.dart';
import '../api/services/config_service.dart';

part 'site_config_provider.g.dart';

@Riverpod(keepAlive: true)
class SiteConfigNotifier extends _$SiteConfigNotifier {
  @override
  Future<SiteConfig> build() async {
    final raw = await ref.read(configServiceProvider).getSiteConfig();
    final data = raw['data'] as Map<String, dynamic>? ?? {};
    return SiteConfig.fromJson(data);
  }
}

@Riverpod(keepAlive: true)
class NavConfigNotifier extends _$NavConfigNotifier {
  @override
  Future<NavConfig> build() async {
    final raw = await ref.read(configServiceProvider).getNavConfig();
    final data = raw['data'] as Map<String, dynamic>? ?? {};
    return NavConfig.fromJson(data);
  }
}

@Riverpod(keepAlive: true)
class UiStringsNotifier extends _$UiStringsNotifier {
  @override
  Future<UiStrings> build() async {
    final raw = await ref.read(configServiceProvider).getUiStrings();
    final data = raw['data'] as Map<String, dynamic>? ?? {};
    return UiStrings.fromJson(data);
  }
}
