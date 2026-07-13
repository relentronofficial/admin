// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'chat_message.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$ChatMessageImpl _$$ChatMessageImplFromJson(Map<String, dynamic> json) =>
    _$ChatMessageImpl(
      id: json['id'] as String,
      senderType: json['senderType'] as String,
      senderId: json['senderId'] as String,
      senderName: json['senderName'] as String,
      senderAvatarUrl: json['senderAvatarUrl'] as String?,
      body: json['body'] as String,
      createdAt: json['createdAt'] as String,
    );

Map<String, dynamic> _$$ChatMessageImplToJson(_$ChatMessageImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'senderType': instance.senderType,
      'senderId': instance.senderId,
      'senderName': instance.senderName,
      'senderAvatarUrl': instance.senderAvatarUrl,
      'body': instance.body,
      'createdAt': instance.createdAt,
    };
