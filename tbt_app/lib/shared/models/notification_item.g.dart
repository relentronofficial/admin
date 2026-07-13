// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'notification_item.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$NotificationItemImpl _$$NotificationItemImplFromJson(
  Map<String, dynamic> json,
) => _$NotificationItemImpl(
  id: json['id'] as String,
  type: json['type'] as String,
  title: json['title'] as String,
  body: json['body'] as String,
  metadata: json['data'] as Map<String, dynamic>?,
  isRead: json['isRead'] as bool? ?? false,
  createdAt: json['createdAt'] as String,
  actionUrl: json['actionUrl'] as String?,
  iconType: json['iconType'] as String?,
  mediaType: json['mediaType'] as String?,
  mediaUrl: json['mediaUrl'] as String?,
);

Map<String, dynamic> _$$NotificationItemImplToJson(
  _$NotificationItemImpl instance,
) => <String, dynamic>{
  'id': instance.id,
  'type': instance.type,
  'title': instance.title,
  'body': instance.body,
  'data': instance.metadata,
  'isRead': instance.isRead,
  'createdAt': instance.createdAt,
  'actionUrl': instance.actionUrl,
  'iconType': instance.iconType,
  'mediaType': instance.mediaType,
  'mediaUrl': instance.mediaUrl,
};
