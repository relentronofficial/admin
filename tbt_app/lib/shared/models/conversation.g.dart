// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'conversation.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$LastMessageImpl _$$LastMessageImplFromJson(Map<String, dynamic> json) =>
    _$LastMessageImpl(
      body: json['body'] as String,
      senderType: json['senderType'] as String,
      createdAt: json['createdAt'] as String,
    );

Map<String, dynamic> _$$LastMessageImplToJson(_$LastMessageImpl instance) =>
    <String, dynamic>{
      'body': instance.body,
      'senderType': instance.senderType,
      'createdAt': instance.createdAt,
    };

_$ConversationImpl _$$ConversationImplFromJson(Map<String, dynamic> json) =>
    _$ConversationImpl(
      id: json['id'] as String,
      subject: json['subject'] as String,
      status: json['status'] as String,
      memberUnreadCount: (json['memberUnreadCount'] as num?)?.toInt() ?? 0,
      lastMessageAt: json['lastMessageAt'] as String?,
      lastMessage:
          json['lastMessage'] == null
              ? null
              : LastMessage.fromJson(
                json['lastMessage'] as Map<String, dynamic>,
              ),
    );

Map<String, dynamic> _$$ConversationImplToJson(_$ConversationImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'subject': instance.subject,
      'status': instance.status,
      'memberUnreadCount': instance.memberUnreadCount,
      'lastMessageAt': instance.lastMessageAt,
      'lastMessage': instance.lastMessage,
    };
