import 'package:freezed_annotation/freezed_annotation.dart';

part 'conversation.freezed.dart';
part 'conversation.g.dart';

@freezed
class LastMessage with _$LastMessage {
  const factory LastMessage({
    required String body,
    required String senderType,
    required String createdAt,
  }) = _LastMessage;

  factory LastMessage.fromJson(Map<String, dynamic> json) =>
      _$LastMessageFromJson(json);
}

@freezed
class Conversation with _$Conversation {
  const factory Conversation({
    required String id,
    required String subject,
    required String status,
    @Default(0) int memberUnreadCount,
    String? lastMessageAt,
    LastMessage? lastMessage,
  }) = _Conversation;

  factory Conversation.fromJson(Map<String, dynamic> json) =>
      _$ConversationFromJson(json);
}
