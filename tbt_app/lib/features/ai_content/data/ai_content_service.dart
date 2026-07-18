import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/api.dart';
import '../../../shared/api/dio_client.dart';
import '../../../shared/api/dio_provider.dart';
import '../domain/ai_models.dart';

/// Client for the `/api/ai/*` backend module. Cookie auth is handled
/// by the shared Dio interceptors — no per-call token wiring needed.
///
/// Every mutation returns typed data; every read returns typed lists.
/// Error mapping goes through the shared `mapDioError` so callers see
/// the same [AppException] hierarchy the rest of the app uses. The
/// backend's typed error codes (`daily_limit_reached`, `rate_limited`,
/// `claude_timeout`, etc.) are preserved in the exception message so
/// the chat screen can show a specific, actionable toast.
class AIContentService {
  const AIContentService(this._dio);
  final Dio _dio;

  // ── Generate ────────────────────────────────────────────────────
  Future<AIGenerateResult> generate({
    required String message,
    String? conversationId,
    String? inputType, // 'text' | 'voice' | 'image'
    String? contentType,
    String? tone,
    String? language,
    String? length,
    List<int>? imageBytes,
    String? imageMimeType,
  }) async {
    final body = <String, dynamic>{
      'message': message,
      if (conversationId != null) 'conversationId': conversationId,
      if (inputType != null) 'inputType': inputType,
      if (contentType != null) 'contentType': contentType,
      if (tone != null) 'tone': tone,
      if (language != null) 'language': language,
      if (length != null) 'length': length,
      if (imageBytes != null) 'imageBase64': base64Encode(imageBytes),
      if (imageMimeType != null) 'imageMimeType': imageMimeType,
    };
    try {
      final res = await _dio.post<Map<String, dynamic>>(kAiCreate, data: body);
      final data = (res.data?['data'] as Map<String, dynamic>?) ?? const {};
      return AIGenerateResult.fromJson(data);
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  // ── Conversations ───────────────────────────────────────────────
  Future<List<AIConversation>> listConversations({String? search}) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        kAiConversations,
        queryParameters: search == null || search.isEmpty ? null : {'search': search},
      );
      final list = (res.data?['data'] as List<dynamic>?) ?? const [];
      return list
          .cast<Map<String, dynamic>>()
          .map(AIConversation.fromJson)
          .toList();
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<List<AIMessage>> getMessages(String conversationId) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        '$kAiConversations/$conversationId/messages',
      );
      final list = (res.data?['data'] as List<dynamic>?) ?? const [];
      return list.cast<Map<String, dynamic>>().map(AIMessage.fromJson).toList();
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<void> renameConversation(String id, String title) async {
    try {
      await _dio.patch<dynamic>('$kAiConversations/$id', data: {'title': title});
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<void> deleteConversation(String id) async {
    try {
      await _dio.delete<dynamic>('$kAiConversations/$id');
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  // ── Saved content ───────────────────────────────────────────────
  Future<List<SavedAIContent>> listSaved({String? category, String? search}) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        kAiSaved,
        queryParameters: {
          if (category != null && category.isNotEmpty) 'category': category,
          if (search != null && search.isNotEmpty) 'search': search,
        },
      );
      final list = (res.data?['data'] as List<dynamic>?) ?? const [];
      return list
          .cast<Map<String, dynamic>>()
          .map(SavedAIContent.fromJson)
          .toList();
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<SavedAIContent> saveContent({
    required String title,
    required String content,
    String category = 'other',
    String? conversationId,
  }) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        kAiSaved,
        data: {
          'title': title,
          'content': content,
          'category': category,
          if (conversationId != null) 'conversationId': conversationId,
        },
      );
      final data = (res.data?['data'] as Map<String, dynamic>?) ?? const {};
      return SavedAIContent.fromJson(data);
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<void> updateSaved(
    String id, {
    String? title,
    String? content,
    String? category,
  }) async {
    try {
      await _dio.patch<dynamic>('$kAiSaved/$id', data: {
        if (title != null) 'title': title,
        if (content != null) 'content': content,
        if (category != null) 'category': category,
      });
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<void> deleteSaved(String id) async {
    try {
      await _dio.delete<dynamic>('$kAiSaved/$id');
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }
}

final aiContentServiceProvider = Provider<AIContentService>(
  (ref) => AIContentService(ref.watch(dioProvider)),
);
