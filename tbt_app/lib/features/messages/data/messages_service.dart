import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/api.dart';
import '../../../shared/api/dio_client.dart';
import '../../../shared/api/dio_provider.dart';
import '../../../shared/models/chat_message.dart';
import '../../../shared/models/conversation.dart';

class MessagesService {
  const MessagesService(this._dio);
  final Dio _dio;

  Future<List<Conversation>> getConversations() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(kConversations);
      final list = (res.data?['data'] as List<dynamic>?) ?? [];
      return list.cast<Map<String, dynamic>>().map(Conversation.fromJson).toList();
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<int> getUnreadCount() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(kConversationsUnreadCount);
      final data = res.data?['data'] as Map<String, dynamic>? ?? {};
      return (data['count'] as num?)?.toInt() ?? 0;
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<List<ChatMessage>> getMessages(
    String conversationId, {
    int page = 1,
    int limit = 50,
  }) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        '$kConversations/$conversationId/messages',
        queryParameters: {'page': page, 'limit': limit},
      );
      final list = (res.data?['data'] as List<dynamic>?) ?? [];
      return list.cast<Map<String, dynamic>>().map(ChatMessage.fromJson).toList();
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  // Backend returns { id } only — caller constructs the optimistic ChatMessage.
  // The backend `sendMessage` handler accepts `{ body?, mediaUrl?, mediaType?,
  // replyToId? }` — either body or mediaUrl is required.
  Future<String> sendMessage(
    String conversationId,
    String? body, {
    String? mediaUrl,
    String? mediaType,
    String? replyToId,
  }) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '$kConversations/$conversationId/messages',
        data: {
          if (body != null && body.isNotEmpty) 'body': body,
          if (mediaUrl != null) 'mediaUrl': mediaUrl,
          if (mediaType != null) 'mediaType': mediaType,
          if (replyToId != null) 'replyToId': replyToId,
        },
      );
      final data = res.data?['data'] as Map<String, dynamic>? ?? {};
      return data['id'] as String? ?? '';
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  /// POST /api/user/conversations — start a new admin support thread.
  /// Returns the new conversation id.
  Future<String> startConversation({
    required String subject,
    required String body,
  }) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        kConversations,
        data: {'subject': subject, 'body': body},
      );
      final data = res.data?['data'] as Map<String, dynamic>? ?? {};
      return data['id'] as String? ?? '';
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<void> archiveConversation(String conversationId) async {
    try {
      await _dio.patch<dynamic>(
        '$kConversations/$conversationId/archive',
      );
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }
}

final messagesServiceProvider = Provider<MessagesService>(
  (ref) => MessagesService(ref.watch(dioProvider)),
);
