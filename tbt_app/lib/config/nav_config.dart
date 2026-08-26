import 'package:freezed_annotation/freezed_annotation.dart';

part 'nav_config.freezed.dart';
part 'nav_config.g.dart';

/// Response shape from `GET /api/pub/config/nav → data`.
@freezed
class NavConfig with _$NavConfig {
  const factory NavConfig({
    @Default(<NavItem>[]) List<NavItem> items,
    @Default(RightIcons()) RightIcons rightIcons,
    @Default(<String>[]) List<String> hiddenMenuKeys,
  }) = _NavConfig;

  factory NavConfig.fromJson(Map<String, dynamic> json) =>
      _$NavConfigFromJson(json);
}

@freezed
class NavItem with _$NavItem {
  const factory NavItem({
    required String id,
    required String label,
    required String href,
    @Default(0) int order,
    @Default(true) bool isVisible,
  }) = _NavItem;

  factory NavItem.fromJson(Map<String, dynamic> json) =>
      _$NavItemFromJson(json);
}

@freezed
class RightIcons with _$RightIcons {
  const factory RightIcons({
    @Default(true) bool notifications,
    @Default(true) bool messages,
    @Default(true) bool profile,
  }) = _RightIcons;

  factory RightIcons.fromJson(Map<String, dynamic> json) =>
      _$RightIconsFromJson(json);
}
