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

  // ── Restored surface ──────────────────────────────────────────────────
  // The three methods below back symbols that existing screens already call
  // (`author_profile_sheet.dart`, `saved_posts_screen.dart`) but that were
  // never committed. Each maps to a route the backend already serves in
  // `modules/community/routes.ts` — nothing here invents an endpoint.

  /// `POST /api/community/members/:id/follow` — toggles the connection and
  /// returns the resulting state. The backend rejects self-follow with 400.
  Future<bool> toggleFollow(String memberId) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '$kCommunityMembers/$memberId/follow',
      );
      final data = res.data?['data'];
      // Tolerate either shape: the handler returns the new state, but a bare
      // success must not throw — the caller re-fetches the profile anyway.
      if (data is Map && data['isFollowing'] is bool) {
        return data['isFollowing'] as bool;
      }
      return true;
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  /// `GET /api/community/members/:id/profile`.
  Future<CommunityMemberProfile> memberProfile(String memberId) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        '$kCommunityMembers/$memberId/profile',
      );
      final data = res.data?['data'];
      if (data is! Map<String, dynamic>) {
        throw StateError('Malformed member profile response');
      }
      return CommunityMemberProfile.fromJson(data);
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  /// `GET /api/community/bookmarks` — the member's saved posts.
  Future<List<CommunityPost>> bookmarks() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(kCommunityBookmarks);
      final list = (res.data?['data'] as List<dynamic>?) ?? const [];
      return list.cast<Map<String, dynamic>>().map(CommunityPost.fromJson).toList();
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  /// `POST /api/community/posts/:id/like` — toggles the like.
  Future<void> toggleLike(String postId) async {
    try {
      await _dio.post<dynamic>('$kCommunityPosts/$postId/like');
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  /// `POST /api/community/posts/:id/bookmark` — toggles the bookmark.
  Future<void> toggleBookmark(String postId) async {
    try {
      await _dio.post<dynamic>('$kCommunityPosts/$postId/bookmark');
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

// ══════════════════════════════════════════════════════════════════════════
// Restored: profile models + feed providers
//
// `author_profile_sheet.dart` and `achievement_composer.dart` were committed
// referencing the symbols below, and both already import THIS file — which is
// how we know the data layer was their intended home. They live here rather
// than in `community_screen.dart` so the data layer never has to import a
// presentation file, and so no pre-existing import had to be edited to make
// the app compile.
// ══════════════════════════════════════════════════════════════════════════

class CommunityMemberSummary {
  const CommunityMemberSummary({
    required this.id,
    required this.displayName,
    this.profilePhotoUrl,
    this.businessName,
    this.businessType,
    this.city,
    this.state,
  });

  final String id;
  final String displayName;
  final String? profilePhotoUrl;
  final String? businessName;
  final String? businessType;
  final String? city;
  final String? state;

  factory CommunityMemberSummary.fromJson(Map<String, dynamic> j) {
    final name = [j['firstName'], j['lastName']]
        .whereType<String>()
        .where((s) => s.trim().isNotEmpty)
        .join(' ')
        .trim();
    return CommunityMemberSummary(
      id: j['id'] as String? ?? '',
      displayName: name.isNotEmpty ? name : 'Member',
      profilePhotoUrl: j['profilePhotoUrl'] as String?,
      businessName: j['businessName'] as String?,
      businessType: j['businessType'] as String?,
      city: j['city'] as String?,
      state: j['state'] as String?,
    );
  }
}

/// One of the three most recent posts shown as a thumbnail strip on a profile.
class CommunityRecentPost {
  const CommunityRecentPost({
    required this.id,
    required this.content,
    required this.mediaUrls,
  });

  final String id;
  final String content;
  final List<String> mediaUrls;

  factory CommunityRecentPost.fromJson(Map<String, dynamic> j) =>
      CommunityRecentPost(
        id: j['id'] as String? ?? '',
        content: j['content'] as String? ?? '',
        mediaUrls:
            (j['mediaUrls'] as List<dynamic>?)?.cast<String>() ?? const [],
      );
}

/// Mirrors `memberGetProfileHandler`:
/// `{ member, postsCount, followersCount, followingCount, isFollowing, recentPosts }`.
class CommunityMemberProfile {
  const CommunityMemberProfile({
    required this.member,
    required this.postsCount,
    required this.followersCount,
    required this.followingCount,
    required this.isFollowing,
    required this.recentPosts,
  });

  final CommunityMemberSummary member;
  final int postsCount;
  final int followersCount;
  final int followingCount;
  final bool isFollowing;
  final List<CommunityRecentPost> recentPosts;

  /// Business + location — the sub-heading under the name. Empty when the
  /// member filled in neither; `author_profile_sheet.dart` checks
  /// `roleLine.isNotEmpty` before rendering it.
  String get roleLine {
    final where = [member.city, member.state]
        .whereType<String>()
        .where((s) => s.trim().isNotEmpty)
        .join(', ');
    final what = [member.businessName, member.businessType]
        .whereType<String>()
        .where((s) => s.trim().isNotEmpty)
        .join(' · ');
    return [what, where].where((s) => s.isNotEmpty).join(' — ');
  }

  factory CommunityMemberProfile.fromJson(Map<String, dynamic> j) {
    final m = j['member'];
    return CommunityMemberProfile(
      member: CommunityMemberSummary.fromJson(
        m is Map<String, dynamic> ? m : const <String, dynamic>{},
      ),
      postsCount: (j['postsCount'] as num?)?.toInt() ?? 0,
      followersCount: (j['followersCount'] as num?)?.toInt() ?? 0,
      followingCount: (j['followingCount'] as num?)?.toInt() ?? 0,
      isFollowing: j['isFollowing'] as bool? ?? false,
      recentPosts: ((j['recentPosts'] as List<dynamic>?) ?? const [])
          .cast<Map<String, dynamic>>()
          .map(CommunityRecentPost.fromJson)
          .toList(),
    );
  }
}

/// Active feed filter. `achievement_composer.dart` reads it to address the
/// right feed notifier when inserting an optimistic row.
final communityFilterProvider = StateProvider<String>((ref) => 'all');

final communityMemberProfileProvider = FutureProvider.autoDispose
    .family<CommunityMemberProfile, String>((ref, memberId) async {
  return ref.watch(communityServiceProvider).memberProfile(memberId);
});

final communityBookmarksProvider =
    FutureProvider.autoDispose<List<CommunityPost>>((ref) async {
  return ref.watch(communityServiceProvider).bookmarks();
});

/// Feed state, keyed by filter.
///
/// A notifier rather than a plain FutureProvider because the composer inserts
/// a post optimistically and rolls it back if the submit fails — that needs a
/// mutable list the UI can see immediately.
class CommunityFeedNotifier
    extends StateNotifier<AsyncValue<List<CommunityPost>>> {
  CommunityFeedNotifier(this._ref) : super(const AsyncValue.loading()) {
    load();
  }

  final Ref _ref;

  Future<void> load() async {
    state = const AsyncValue.loading();
    try {
      final posts = await _ref.read(communityServiceProvider).feed(limit: 20);
      if (mounted) state = AsyncValue.data(posts);
    } catch (err, stack) {
      if (mounted) state = AsyncValue.error(err, stack);
    }
  }

  /// Show the post immediately, before the server confirms it. Returns the
  /// temporary id so the caller can roll it back on failure.
  String insertOptimistic({
    required String content,
    required List<String> mediaUrls,
    required String memberId,
    String? memberName,
    String? memberPhoto,
  }) {
    final tempId = 'optimistic-${DateTime.now().microsecondsSinceEpoch}';
    final optimistic = CommunityPost(
      id: tempId,
      memberId: memberId,
      content: content,
      mediaUrls: mediaUrls,
      likesCount: 0,
      commentsCount: 0,
      isMentor: false,
      isPinned: false,
      createdAt: DateTime.now(),
      memberName: memberName,
      memberPhoto: memberPhoto,
    );
    state = state.whenData((posts) => [optimistic, ...posts]);
    return tempId;
  }

  void rollbackOptimistic(String tempId) {
    state = state.whenData(
      (posts) => posts.where((p) => p.id != tempId).toList(),
    );
  }
}

final communityFeedNotifierProvider = StateNotifierProvider.autoDispose
    .family<CommunityFeedNotifier, AsyncValue<List<CommunityPost>>, String>(
  (ref, filter) => CommunityFeedNotifier(ref),
);

/// Refresh every feed surface after a mutation. Called by the composer and the
/// follow button, neither of which knows which filter is active.
extension CommunityFeedInvalidation on WidgetRef {
  void invalidateCommunityFeed() {
    invalidate(communityFeedNotifierProvider);
    invalidate(communityFeedProvider);
    invalidate(communityBookmarksProvider);
  }
}
