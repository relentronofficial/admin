import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/api.dart';
import '../../../shared/api/dio_client.dart';
import '../../../shared/api/dio_provider.dart';

/// Community feed data — posts a member has submitted (approved-only
/// list) + a submit endpoint for the composer.

class CommunityPost {
  const CommunityPost({
    required this.id,
    required this.memberId,
    required this.content,
    required this.mediaUrls,
    required this.likesCount,
    required this.commentsCount,
    required this.isMentor,
    required this.isPinned,
    required this.createdAt,
    this.memberName,
    this.memberPhoto,
  });

  final String id;
  final String memberId;
  final String content;
  final List<String> mediaUrls;
  final int likesCount;
  final int commentsCount;
  final bool isMentor;
  final bool isPinned;
  final DateTime createdAt;
  final String? memberName;
  final String? memberPhoto;

  factory CommunityPost.fromJson(Map<String, dynamic> j) {
    final m = j['member'] as Map<String, dynamic>?;
    final name = m == null
        ? null
        : [m['firstName'], m['lastName']]
            .whereType<String>()
            .where((s) => s.isNotEmpty)
            .join(' ')
            .trim();
    return CommunityPost(
      id: j['id'] as String,
      memberId: j['memberId'] as String,
      content: j['content'] as String,
      mediaUrls:
          (j['mediaUrls'] as List<dynamic>?)?.cast<String>() ?? const [],
      likesCount: (j['likesCount'] as int?) ?? 0,
      commentsCount: (j['commentsCount'] as int?) ?? 0,
      isMentor: (j['isMentor'] as bool?) ?? false,
      isPinned: (j['isPinned'] as bool?) ?? false,
      createdAt: DateTime.parse(j['createdAt'] as String),
      memberName: (name != null && name.isNotEmpty) ? name : null,
      memberPhoto: m?['profilePhotoUrl'] as String?,
    );
  }
}

class CommunityService {
  const CommunityService(this._dio);
  final Dio _dio;

  Future<List<CommunityPost>> feed({int page = 1, int limit = 20}) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        kCommunityFeed,
        queryParameters: {'page': page, 'limit': limit},
      );
      final list = (res.data?['data'] as List<dynamic>?) ?? const [];
      return list.cast<Map<String, dynamic>>().map(CommunityPost.fromJson).toList();
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<void> submit({required String content, List<String>? mediaUrls}) async {
    try {
      await _dio.post<dynamic>(kCommunityFeed, data: {
        'content': content,
        if (mediaUrls != null) 'mediaUrls': mediaUrls,
      });
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }
}

final communityServiceProvider = Provider<CommunityService>(
  (ref) => CommunityService(ref.watch(dioProvider)),
);

final communityFeedProvider =
    FutureProvider.autoDispose<List<CommunityPost>>((ref) async {
  ref.keepAlive();
  return ref.watch(communityServiceProvider).feed(limit: 20);
});
