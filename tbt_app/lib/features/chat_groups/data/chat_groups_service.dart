import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/api.dart';
import '../../../shared/api/dio_client.dart';
import '../../../shared/api/dio_provider.dart';
import '../domain/chat_group_models.dart';
// StarredMessage is exported from chat_group_models.dart.

/// Thin HTTP client for /api/chat-groups/* member endpoints.
/// Matches the community/ + support/ pattern — hand-written wrappers,
/// no code-gen.
class ChatGroupsService {
  const ChatGroupsService(this._dio);
  final Dio _dio;

  Future<List<ChatGroup>> listMine() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(kChatGroupsMine);
      final list = (res.data?['data'] as List<dynamic>?) ?? const [];
      return list.cast<Map<String, dynamic>>().map(ChatGroup.fromJson).toList();
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<ChatGroupDetail> getGroup(String id) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>('/api/chat-groups/$id');
      return ChatGroupDetail.fromJson(res.data?['data'] as Map<String, dynamic>);
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  /// Fetches messages older than [before] (or the tail if null). Returned
  /// oldest-first per page so the caller can concatenate naturally.
  Future<List<ChatGroupMessage>> listMessages(
    String id, {
    String? before,
    int limit = 50,
  }) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        '/api/chat-groups/$id/messages',
        queryParameters: {
          'limit': limit,
          if (before != null) 'before': before,
        },
      );
      final list = (res.data?['data'] as List<dynamic>?) ?? const [];
      return list
          .cast<Map<String, dynamic>>()
          .map(ChatGroupMessage.fromJson)
          .toList();
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<ChatGroupMessage> sendMessage(
    String id, {
    String? body,
    String? mediaUrl,
    String? mediaType,
    String? replyToId,
    List<String>? mentionedMemberIds,
  }) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '/api/chat-groups/$id/messages',
        data: {
          if (body != null && body.isNotEmpty) 'body': body,
          if (mediaUrl != null) 'mediaUrl': mediaUrl,
          if (mediaType != null) 'mediaType': mediaType,
          if (replyToId != null) 'replyToId': replyToId,
          if (mentionedMemberIds != null && mentionedMemberIds.isNotEmpty)
            'mentionedMemberIds': mentionedMemberIds,
        },
      );
      return ChatGroupMessage.fromJson(res.data?['data'] as Map<String, dynamic>);
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<ChatGroupMessage> editMessage(String id, String messageId, String body) async {
    try {
      final res = await _dio.put<Map<String, dynamic>>(
        '/api/chat-groups/$id/messages/$messageId',
        data: {'body': body},
      );
      return ChatGroupMessage.fromJson(res.data?['data'] as Map<String, dynamic>);
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<void> deleteMessage(String id, String messageId, {bool forEveryone = false}) async {
    try {
      await _dio.delete<dynamic>(
        '/api/chat-groups/$id/messages/$messageId',
        queryParameters: {'forEveryone': forEveryone.toString()},
      );
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  /// Toggles a reaction on a message. Returns whether it was added
  /// (true) or removed (false) so callers can update UI optimistically.
  Future<bool> toggleReaction(String id, String messageId, String emoji) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '/api/chat-groups/$id/messages/$messageId/react',
        data: {'emoji': emoji},
      );
      final data = (res.data?['data'] as Map<String, dynamic>?) ?? const {};
      return (data['added'] as bool?) ?? false;
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<void> markRead(String id, String messageId) async {
    try {
      await _dio.post<dynamic>(
        '/api/chat-groups/$id/read',
        data: {'messageId': messageId},
      );
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<List<ChatGroupMessage>> search(String id, String query, {int limit = 20}) async {
    if (query.trim().length < 2) return const [];
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        '/api/chat-groups/$id/search',
        queryParameters: {'q': query.trim(), 'limit': limit},
      );
      final list = (res.data?['data'] as List<dynamic>?) ?? const [];
      return list
          .cast<Map<String, dynamic>>()
          .map(ChatGroupMessage.fromJson)
          .toList();
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<List<ChatGroupPresence>> getPresence(String id) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>('/api/chat-groups/$id/presence');
      final list = (res.data?['data'] as List<dynamic>?) ?? const [];
      return list
          .cast<Map<String, dynamic>>()
          .map(ChatGroupPresence.fromJson)
          .toList();
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<void> leave(String id) async {
    try {
      await _dio.post<dynamic>('/api/chat-groups/$id/leave');
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  // ── Forward / star / mute / pin — P0 group-chat parity ────────────────────

  /// Forwards [messageId] into every group in [toGroupIds] that the
  /// caller is a member of. Backend returns 200 with `{ count }`.
  Future<int> forwardMessage(
    String groupId,
    String messageId,
    List<String> toGroupIds,
  ) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '/api/chat-groups/$groupId/messages/$messageId/forward',
        data: {'toGroupIds': toGroupIds},
      );
      final data = (res.data?['data'] as Map<String, dynamic>?) ?? const {};
      return (data['count'] as int?) ?? toGroupIds.length;
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<void> starMessage(String groupId, String messageId) async {
    try {
      await _dio.post<dynamic>(
        '/api/chat-groups/$groupId/messages/$messageId/star',
      );
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<void> unstarMessage(String groupId, String messageId) async {
    try {
      await _dio.delete<dynamic>(
        '/api/chat-groups/$groupId/messages/$messageId/star',
      );
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  /// Returns every starred message across all the caller's groups
  /// (server does the join). Empty list on error.
  Future<List<StarredMessage>> listStarred() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(kChatGroupsStarred);
      final list = (res.data?['data'] as List<dynamic>?) ?? const [];
      return list
          .cast<Map<String, dynamic>>()
          .map(StarredMessage.fromJson)
          .toList();
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  /// [until] = null → unmute. Otherwise an ISO-8601 timestamp for the
  /// end of the mute period ("Always" == a far-future date).
  Future<void> muteGroup(String groupId, {DateTime? until}) async {
    try {
      await _dio.post<dynamic>(
        '/api/chat-groups/$groupId/mute',
        data: {'until': until?.toUtc().toIso8601String()},
      );
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<List<ChatGroupMessage>> listPinned(String groupId) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        '/api/chat-groups/$groupId/pinned',
      );
      final list = (res.data?['data'] as List<dynamic>?) ?? const [];
      return list
          .cast<Map<String, dynamic>>()
          .map(ChatGroupMessage.fromJson)
          .toList();
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  /// Uploads a file via /api/upload/image (Bunny-first, R2 fallback).
  /// Accepts any file type; returns null on failure.
  Future<({String publicUrl, String mediaType})?> uploadMedia(File file) async {
    try {
      final bytes = await file.readAsBytes();
      final ext = file.path.split('.').last.toLowerCase();
      final contentType = _guessContentType(ext);
      final filename = file.path.split(Platform.pathSeparator).last;
      final res = await _dio.post<Map<String, dynamic>>(
        '/api/upload/image',
        queryParameters: {'pathPrefix': 'chat', 'filename': filename},
        data: bytes,
        options: Options(
          contentType: contentType,
          headers: {'Content-Type': contentType},
          validateStatus: (s) => s != null && s >= 200 && s < 300,
        ),
      );
      final data = (res.data?['data'] as Map<String, dynamic>?) ?? const {};
      final url = data['publicUrl'] as String?;
      if (url == null || url.isEmpty) return null;
      String mediaType = 'document';
      if (contentType.startsWith('image/')) {
        mediaType = 'image';
      } else if (contentType.startsWith('video/')) {
        mediaType = 'video';
      } else if (contentType.startsWith('audio/')) {
        mediaType = 'audio';
      }
      return (publicUrl: url, mediaType: mediaType);
    } catch (_) {
      return null;
    }
  }

  static String _guessContentType(String ext) {
    return const {
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'png': 'image/png',
          'gif': 'image/gif',
          'webp': 'image/webp',
          'mp4': 'video/mp4',
          'mov': 'video/quicktime',
          'webm': 'video/webm',
          'mp3': 'audio/mpeg',
          'm4a': 'audio/mp4',
          'wav': 'audio/wav',
          'pdf': 'application/pdf',
          'doc': 'application/msword',
          'docx':
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'xls': 'application/vnd.ms-excel',
          'xlsx':
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'txt': 'text/plain',
        }[ext] ??
        'application/octet-stream';
  }
}

final chatGroupsServiceProvider = Provider<ChatGroupsService>(
  (ref) => ChatGroupsService(ref.watch(dioProvider)),
);
