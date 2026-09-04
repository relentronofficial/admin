// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'nav_config.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$NavConfigImpl _$$NavConfigImplFromJson(Map<String, dynamic> json) =>
    _$NavConfigImpl(
      items:
          (json['items'] as List<dynamic>?)
              ?.map((e) => NavItem.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const <NavItem>[],
      rightIcons:
          json['rightIcons'] == null
              ? const RightIcons()
              : RightIcons.fromJson(json['rightIcons'] as Map<String, dynamic>),
      hiddenMenuKeys:
          (json['hiddenMenuKeys'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          const <String>[],
    );

Map<String, dynamic> _$$NavConfigImplToJson(_$NavConfigImpl instance) =>
    <String, dynamic>{
      'items': instance.items,
      'rightIcons': instance.rightIcons,
      'hiddenMenuKeys': instance.hiddenMenuKeys,
    };

_$NavItemImpl _$$NavItemImplFromJson(Map<String, dynamic> json) =>
    _$NavItemImpl(
      id: json['id'] as String,
      label: json['label'] as String,
      href: json['href'] as String,
      order: (json['order'] as num?)?.toInt() ?? 0,
      isVisible: json['isVisible'] as bool? ?? true,
    );

Map<String, dynamic> _$$NavItemImplToJson(_$NavItemImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'label': instance.label,
      'href': instance.href,
      'order': instance.order,
      'isVisible': instance.isVisible,
    };

_$RightIconsImpl _$$RightIconsImplFromJson(Map<String, dynamic> json) =>
    _$RightIconsImpl(
      notifications: json['notifications'] as bool? ?? true,
      messages: json['messages'] as bool? ?? true,
      profile: json['profile'] as bool? ?? true,
    );

Map<String, dynamic> _$$RightIconsImplToJson(_$RightIconsImpl instance) =>
    <String, dynamic>{
      'notifications': instance.notifications,
      'messages': instance.messages,
      'profile': instance.profile,
    };
