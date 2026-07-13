import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/api.dart';
import '../dio_client.dart';
import '../dio_provider.dart';

class MessagesService {
  const MessagesService(this._dio);
  final Dio _dio;

  Future<Map<String, dynamic>> listConversations({
    int page = 1,
    int limit = 20,
  }) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        kConversations,
        queryParameters: {'page': page, 'limit': limit},
      );
      return res.data ?? {};
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<Map<String, dynamic>> getMessages(
    String conversationId, {
    int page = 1,
    int limit = 30,
  }) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        '$kConversations/$conversationId/messages',
        queryParameters: {'page': page, 'limit': limit},
      );
      return res.data ?? {};
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<Map<String, dynamic>> sendMessage(
    String conversationId,
    String content,
  ) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '$kConversations/$conversationId/messages',
        data: {'content': content},
      );
      return res.data ?? {};
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }
}

final messagesServiceProvider = Provider<MessagesService>(
  (ref) => MessagesService(ref.watch(dioProvider)),
);
