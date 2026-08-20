import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/api.dart';
import '../../../shared/api/dio_client.dart';
import '../../../shared/api/dio_provider.dart';

/// Community feed data — approved posts (`/api/community/feed`) plus
/// the composer's submit + like toggle + comments endpoints.

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
    required this.isLikedByMe,
    required this.isBookmarkedByMe,
    this.isApproved = true,
    required this.createdAt,
    this.memberName,
    this.memberPhoto,
    this.firstLiker,
    this.topComment,
  });

  final String id;
  final String memberId;
  final String content;
  final List<String> mediaUrls;
  final int likesCount;
  final int commentsCount;
  final bool isMentor;
  final bool isPinned;
  final bool isLikedByMe;
  final bool isBookmarkedByMe;
  final bool isApproved;
  final DateTime createdAt;
  final String? memberName;
  final String? memberPhoto;

  /// Attached by the backend feed handler (item #6). Represents the
  /// earliest liker on this post — used to render "Liked by X and N
  /// others" on the engagement summary line. `null` when the post has
  /// zero likes.
  final CommunityMemberRef? firstLiker;

  /// Attached by the backend feed handler (item #11). Top comment on
  /// this post (oldest — matches "encourage early engagement" pattern).
  /// Used to render "Priya: Massive congrats! · View all N comments"
  /// under the action band.
  final CommentPreview? topComment;

  CommunityPost copyWith({
    int? likesCount,
    int? commentsCount,
    bool? isLikedByMe,
    bool? isBookmarkedByMe,
    CommunityMemberRef? firstLiker,
    CommentPreview? topComment,
  }) {
    return CommunityPost(
      id: id,
      memberId: memberId,
      content: content,
      mediaUrls: mediaUrls,
      likesCount: likesCount ?? this.likesCount,
      commentsCount: commentsCount ?? this.commentsCount,
      isMentor: isMentor,
      isPinned: isPinned,
      isLikedByMe: isLikedByMe ?? this.isLikedByMe,
      isBookmarkedByMe: isBookmarkedByMe ?? this.isBookmarkedByMe,
      createdAt: createdAt,
      memberName: memberName,
      memberPhoto: memberPhoto,
      firstLiker: firstLiker ?? this.firstLiker,
      topComment: topComment ?? this.topComment,
    );
  }

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
      isLikedByMe: (j['isLikedByMe'] as bool?) ?? false,
      isBookmarkedByMe: (j['isBookmarkedByMe'] as bool?) ?? false,
      isApproved: (j['isApproved'] as bool?) ?? true,
      createdAt: DateTime.parse(j['createdAt'] as String),
      memberName: (name != null && name.isNotEmpty) ? name : null,
      memberPhoto: m?['profilePhotoUrl'] as String?,
      firstLiker: j['firstLiker'] != null
          ? CommunityMemberRef.fromJson(
              j['firstLiker'] as Map<String, dynamic>,
            )
          : null,
      topComment: j['topComment'] != null
          ? CommentPreview.fromJson(j['topComment'] as Map<String, dynamic>)
          : null,
    );
  }
}

/// Minimal comment preview attached to each post in the feed response
/// (item #11). Full comment list still lives on
/// `GET /api/community/posts/:id/comments`.
class CommentPreview {
  const CommentPreview({
    required this.id,
    required this.content,
    required this.createdAt,
    this.member,
  });
  final String id;
  final String content;
  final DateTime createdAt;
  final CommunityMemberRef? member;

  factory CommentPreview.fromJson(Map<String, dynamic> j) => CommentPreview(
        id: j['id'] as String,
        content: j['content'] as String,
        createdAt: DateTime.parse(j['createdAt'] as String),
        member: j['member'] != null
            ? CommunityMemberRef.fromJson(j['member'] as Map<String, dynamic>)
            : null,
      );
}

/// Lightweight member reference used by [CommunityPost.firstLiker] and
/// the paginated likers list. Never `null` fields except photo — the
/// caller decides how to render fallbacks.
class CommunityMemberRef {
  const CommunityMemberRef({
    required this.id,
    this.firstName,
    this.lastName,
    this.profilePhotoUrl,
  });
  final String id;
  final String? firstName;
  final String? lastName;
  final String? profilePhotoUrl;

  String get displayName {
    final parts = [firstName, lastName]
        .whereType<String>()
        .where((s) => s.isNotEmpty)
        .toList();
    if (parts.isEmpty) return 'Member';
    return parts.join(' ').trim();
  }

  factory CommunityMemberRef.fromJson(Map<String, dynamic> j) =>
      CommunityMemberRef(
        id: j['id'] as String,
        firstName: j['firstName'] as String?,
        lastName: j['lastName'] as String?,
        profilePhotoUrl: j['profilePhotoUrl'] as String?,
      );
}

class CommunityComment {
  const CommunityComment({
    required this.id,
    required this.postId,
    required this.memberId,
    required this.content,
    required this.createdAt,
    required this.likesCount,
    required this.isLikedByMe,
    this.parentCommentId,
    this.memberName,
    this.memberPhoto,
  });
  final String id;
  final String postId;
  final String memberId;
  final String content;
  final DateTime createdAt;
  final int likesCount;
  final bool isLikedByMe;

  /// Item #18 — non-null when this is a reply to another top-level
  /// comment on the same post. The client renders replies indented
  /// under the parent (cap at 2 levels, enforced server-side).
  final String? parentCommentId;

  final String? memberName;
  final String? memberPhoto;

  CommunityComment copyWith({
    int? likesCount,
    bool? isLikedByMe,
  }) {
    return CommunityComment(
      id: id,
      postId: postId,
      memberId: memberId,
      content: content,
      createdAt: createdAt,
      likesCount: likesCount ?? this.likesCount,
      isLikedByMe: isLikedByMe ?? this.isLikedByMe,
      parentCommentId: parentCommentId,
      memberName: memberName,
      memberPhoto: memberPhoto,
    );
  }

  factory CommunityComment.fromJson(Map<String, dynamic> j) {
    final m = j['member'] as Map<String, dynamic>?;
    final name = m == null
        ? null
        : [m['firstName'], m['lastName']]
            .whereType<String>()
            .where((s) => s.isNotEmpty)
            .join(' ')
            .trim();
    return CommunityComment(
      id: j['id'] as String,
      postId: j['postId'] as String,
      memberId: j['memberId'] as String,
      content: j['content'] as String,
      createdAt: DateTime.parse(j['createdAt'] as String),
      likesCount: (j['likesCount'] as int?) ?? 0,
      isLikedByMe: (j['isLikedByMe'] as bool?) ?? false,
      parentCommentId: j['parentCommentId'] as String?,
      memberName: (name != null && name.isNotEmpty) ? name : null,
      memberPhoto: m?['profilePhotoUrl'] as String?,
    );
  }
}

/// Aggregate payload for the author-profile bottom sheet (item #20).
class CommunityMemberProfile {
  const CommunityMemberProfile({
    required this.member,
    required this.postsCount,
    required this.followersCount,
    required this.followingCount,
    required this.isFollowing,
    required this.recentPosts,
    this.businessName,
    this.businessType,
    this.city,
    this.state,
  });
  final CommunityMemberRef member;
  final int postsCount;
  final int followersCount;
  final int followingCount;
  final bool isFollowing;
  final List<CommunityRecentPost> recentPosts;
  final String? businessName;
  final String? businessType;
  final String? city;
  final String? state;

  /// Formatted role line — "CEO, Acme Foods" or "Chennai" or empty.
  String get roleLine {
    final parts = <String>[];
    if (businessType != null && businessType!.isNotEmpty) parts.add(businessType!);
    if (businessName != null && businessName!.isNotEmpty) parts.add(businessName!);
    if (parts.isEmpty && city != null && city!.isNotEmpty) return city!;
    return parts.join(' · ');
  }

  factory CommunityMemberProfile.fromJson(Map<String, dynamic> j) {
    final m = j['member'] as Map<String, dynamic>;
    return CommunityMemberProfile(
      member: CommunityMemberRef.fromJson(m),
      postsCount: (j['postsCount'] as int?) ?? 0,
      followersCount: (j['followersCount'] as int?) ?? 0,
      followingCount: (j['followingCount'] as int?) ?? 0,
      isFollowing: (j['isFollowing'] as bool?) ?? false,
      recentPosts: ((j['recentPosts'] as List<dynamic>?) ?? const [])
          .cast<Map<String, dynamic>>()
          .map(CommunityRecentPost.fromJson)
          .toList(),
      businessName: m['businessName'] as String?,
      businessType: m['businessType'] as String?,
      city: m['city'] as String?,
      state: m['state'] as String?,
    );
  }
}

class CommunityRecentPost {
  const CommunityRecentPost({
    required this.id,
    required this.content,
    required this.mediaUrls,
    required this.createdAt,
  });
  final String id;
  final String content;
  final List<String> mediaUrls;
  final DateTime createdAt;

  factory CommunityRecentPost.fromJson(Map<String, dynamic> j) =>
      CommunityRecentPost(
        id: j['id'] as String,
        content: j['content'] as String,
        mediaUrls:
            (j['mediaUrls'] as List<dynamic>?)?.cast<String>() ?? const [],
        createdAt: DateTime.parse(j['createdAt'] as String),
      );
}

class CommunityService {
  const CommunityService(this._dio);
  final Dio _dio;

  /// [filter] — one of `all` (default), `mentors`, `mine`, `following`.
  /// Backend contract lives in `memberListFeedHandler`.
  Future<List<CommunityPost>> feed({
    int page = 1,
    int limit = 20,
    String filter = 'all',
  }) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        kCommunityFeed,
        queryParameters: {
          'page': page,
          'limit': limit,
          if (filter != 'all') 'filter': filter,
        },
      );
      final list = (res.data?['data'] as List<dynamic>?) ?? const [];
      return list
          .cast<Map<String, dynamic>>()
          .map(CommunityPost.fromJson)
          .toList();
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

  /// Paginated list of members who liked this post (oldest first —
  /// matches the "first liker" convention on the feed line).
  Future<List<CommunityMemberRef>> listLikers(
    String postId, {
    int page = 1,
    int limit = 50,
  }) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        '/api/community/posts/$postId/likers',
        queryParameters: {'page': page, 'limit': limit},
      );
      final list = (res.data?['data'] as List<dynamic>?) ?? const [];
      return list
          .cast<Map<String, dynamic>>()
          .map(CommunityMemberRef.fromJson)
          .toList();
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  /// Toggle a like on a post. Returns the fresh `{liked, likesCount}`
  /// so the caller can reconcile the optimistic UI state.
  Future<({bool liked, int likesCount})> toggleLike(String postId) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '/api/community/posts/$postId/like',
      );
      final data = (res.data?['data'] as Map<String, dynamic>?) ?? const {};
      return (
        liked: (data['liked'] as bool?) ?? false,
        likesCount: (data['likesCount'] as int?) ?? 0,
      );
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<List<CommunityComment>> listComments(String postId) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        '/api/community/posts/$postId/comments',
      );
      final list = (res.data?['data'] as List<dynamic>?) ?? const [];
      return list
          .cast<Map<String, dynamic>>()
          .map(CommunityComment.fromJson)
          .toList();
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<CommunityComment> addComment({
    required String postId,
    required String content,
    String? parentCommentId,
  }) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '/api/community/posts/$postId/comments',
        data: {
          'content': content,
          if (parentCommentId != null) 'parentCommentId': parentCommentId,
        },
      );
      return CommunityComment.fromJson(
        res.data?['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  /// Toggle a like on a comment (item #19). Same shape as toggleLike.
  Future<({bool liked, int likesCount})> toggleCommentLike(String commentId) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '/api/community/comments/$commentId/like',
      );
      final data = (res.data?['data'] as Map<String, dynamic>?) ?? const {};
      return (
        liked: (data['liked'] as bool?) ?? false,
        likesCount: (data['likesCount'] as int?) ?? 0,
      );
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  /// Author profile aggregate for the profile sheet (item #20).
  Future<CommunityMemberProfile> getMemberProfile(String memberId) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        '/api/community/members/$memberId/profile',
      );
      return CommunityMemberProfile.fromJson(
        res.data?['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  /// Report a post (item #25). `reason` is one of
  /// `spam|harassment|inappropriate|misinformation|other`.
  /// [detail] is a free-form context string (≤500 chars, optional).
  /// Returns `alreadyReported: true` when the caller already flagged
  /// this post with the same reason and it's still pending.
  Future<bool> reportPost({
    required String postId,
    required String reason,
    String? detail,
  }) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '/api/community/posts/$postId/report',
        data: {
          'reason': reason,
          if (detail != null && detail.isNotEmpty) 'detail': detail,
        },
      );
      final data = (res.data?['data'] as Map<String, dynamic>?) ?? const {};
      return (data['alreadyReported'] as bool?) ?? false;
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  /// Member search for @mention autocomplete (item #26).
  Future<List<CommunityMemberRef>> searchMembers(String q, {int limit = 10}) async {
    if (q.trim().isEmpty) return const [];
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        '/api/community/members/search',
        queryParameters: {'q': q, 'limit': limit},
      );
      final list = (res.data?['data'] as List<dynamic>?) ?? const [];
      return list
          .cast<Map<String, dynamic>>()
          .map(CommunityMemberRef.fromJson)
          .toList();
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  /// Toggle follow relationship (item #21). Returns the new `following`
  /// state so the caller can reconcile optimistic UI.
  Future<bool> toggleFollow(String memberId) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '/api/community/members/$memberId/follow',
      );
      final data = (res.data?['data'] as Map<String, dynamic>?) ?? const {};
      return (data['following'] as bool?) ?? false;
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<void> deleteComment({
    required String postId,
    required String commentId,
  }) async {
    try {
      await _dio.delete<dynamic>(
        '/api/community/posts/$postId/comments/$commentId',
      );
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  /// Author-only. Deletes the caller's own post. Server returns 403
  /// (mapped to [ForbiddenException]) if the post belongs to someone
  /// else.
  Future<void> deleteOwnPost(String postId) async {
    try {
      await _dio.delete<dynamic>('/api/community/posts/$postId');
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  /// Toggle a bookmark on a post. Returns the new saved state so the
  /// caller can reconcile optimistic UI.
  Future<bool> toggleBookmark(String postId) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '/api/community/posts/$postId/bookmark',
      );
      final data = (res.data?['data'] as Map<String, dynamic>?) ?? const {};
      return (data['bookmarked'] as bool?) ?? false;
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  /// My saved posts (most recent first). Server returns the same
  /// CommunityPost shape, with `isBookmarkedByMe` always true.
  Future<List<CommunityPost>> listBookmarks({
    int page = 1,
    int limit = 20,
  }) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        '/api/community/bookmarks',
        queryParameters: {'page': page, 'limit': limit},
      );
      final list = (res.data?['data'] as List<dynamic>?) ?? const [];
      return list
          .cast<Map<String, dynamic>>()
          .map(CommunityPost.fromJson)
          .toList();
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }
}

final communityServiceProvider = Provider<CommunityService>(
  (ref) => CommunityService(ref.watch(dioProvider)),
);

/// Which filter tab is active. See `feed()` for valid values.
/// Kept as a top-level StateProvider so the tab bar and the feed
/// provider stay in sync via a single source of truth.
final communityFilterProvider = StateProvider<String>((_) => 'all');

/// Immutable snapshot of the feed's paginated + optimistic state.
/// Owned by [CommunityFeedNotifier]. Kept as a plain class (not
/// freezed) since we're rebuilding on every mutation anyway.
class CommunityFeedState {
  const CommunityFeedState({
    required this.posts,
    required this.page,
    required this.hasMore,
    required this.loadingMore,
  });
  final List<CommunityPost> posts;
  final int page;
  final bool hasMore;
  final bool loadingMore;

  static const empty = CommunityFeedState(
    posts: [],
    page: 0,
    hasMore: true,
    loadingMore: false,
  );

  CommunityFeedState copyWith({
    List<CommunityPost>? posts,
    int? page,
    bool? hasMore,
    bool? loadingMore,
  }) {
    return CommunityFeedState(
      posts: posts ?? this.posts,
      page: page ?? this.page,
      hasMore: hasMore ?? this.hasMore,
      loadingMore: loadingMore ?? this.loadingMore,
    );
  }
}

/// Feed notifier — owns:
///   * paginated page fetching (item #28)
///   * optimistic post insertion (item #29)
///   * socket-driven refresh (item #30 — via provider invalidation)
///
/// Constructed per filter (via a family), so switching the tab
/// re-fetches from page 1 automatically.
class CommunityFeedNotifier
    extends AutoDisposeFamilyAsyncNotifier<CommunityFeedState, String> {
  static const int _pageSize = 20;

  @override
  Future<CommunityFeedState> build(String filter) async {
    // Reset to page 1 whenever the filter changes.
    final first = await ref
        .read(communityServiceProvider)
        .feed(page: 1, limit: _pageSize, filter: filter);
    return CommunityFeedState(
      posts: first,
      page: 1,
      hasMore: first.length >= _pageSize,
      loadingMore: false,
    );
  }

  /// Fetches the next page and appends. Guarded so a rapid burst of
  /// scroll events can't fire multiple in-flight requests.
  Future<void> loadMore() async {
    final current = state.valueOrNull;
    if (current == null) return;
    if (!current.hasMore || current.loadingMore) return;

    state = AsyncData(current.copyWith(loadingMore: true));
    try {
      final next = await ref.read(communityServiceProvider).feed(
            page: current.page + 1,
            limit: _pageSize,
            filter: arg,
          );
      // De-dupe against the existing list — the backend can return
      // the same post twice if a new one lands mid-scroll and shifts
      // the page boundary.
      final seen = current.posts.map((p) => p.id).toSet();
      final merged = [
        ...current.posts,
        ...next.where((p) => !seen.contains(p.id)),
      ];
      state = AsyncData(current.copyWith(
        posts: merged,
        page: current.page + 1,
        hasMore: next.length >= _pageSize,
        loadingMore: false,
      ));
    } catch (_) {
      // Keep the existing posts; just drop the loading flag so the
      // user can retry via scroll.
      state = AsyncData(current.copyWith(loadingMore: false));
    }
  }

  /// Item #29: insert an unsubmitted post at the top of the feed with
  /// a "PENDING APPROVAL" pill. Returns a stable temp id the caller
  /// can pass to [rollbackOptimistic] on failure.
  String insertOptimistic({
    required String content,
    required List<String> mediaUrls,
    required String memberId,
    String? memberName,
    String? memberPhoto,
  }) {
    final current = state.valueOrNull ?? CommunityFeedState.empty;
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
      isLikedByMe: false,
      isBookmarkedByMe: false,
      isApproved: false,
      createdAt: DateTime.now(),
      memberName: memberName,
      memberPhoto: memberPhoto,
    );
    state = AsyncData(current.copyWith(posts: [optimistic, ...current.posts]));
    return tempId;
  }

  /// Removes a previously-inserted optimistic post. No-op if the id
  /// isn't in the current state.
  void rollbackOptimistic(String tempId) {
    final current = state.valueOrNull;
    if (current == null) return;
    final next = current.posts.where((p) => p.id != tempId).toList();
    if (next.length == current.posts.length) return;
    state = AsyncData(current.copyWith(posts: next));
  }

  /// Public trigger for socket-driven refreshes. Cheap: re-runs the
  /// notifier's build() → fetches page 1.
  Future<void> refresh() async {
    ref.invalidateSelf();
    await future;
  }
}

/// The feed provider — keyed by filter so switching tabs gets a fresh
/// state without cross-contamination. `.family` param maps 1:1 to the
/// backend `filter=` query string.
final communityFeedNotifierProvider = AutoDisposeAsyncNotifierProviderFamily<
    CommunityFeedNotifier, CommunityFeedState, String>(
  CommunityFeedNotifier.new,
);

/// Thin wrapper — exposes the currently-active filter's feed as a
/// familiar `AsyncValue<List<CommunityPost>>` so old call sites and
/// invalidation snippets don't need to change signature. New code
/// should read `communityFeedNotifierProvider(filter)` directly to
/// access loadMore / hasMore / optimistic APIs.
final communityFeedProvider =
    Provider.autoDispose<AsyncValue<List<CommunityPost>>>((ref) {
  final filter = ref.watch(communityFilterProvider);
  final async = ref.watch(communityFeedNotifierProvider(filter));
  return async.whenData((s) => s.posts);
});

/// Invalidate whichever filter's notifier is currently active. Used by
/// legacy call sites (like/comment/report handlers) that previously did
/// `ref.invalidate(communityFeedProvider)` — the read-only wrapper
/// can't be invalidated directly, so we route through the notifier.
void invalidateCommunityFeed(Ref ref) {
  final filter = ref.read(communityFilterProvider);
  ref.invalidate(communityFeedNotifierProvider(filter));
}
extension CommunityFeedInvalidate on WidgetRef {
  void invalidateCommunityFeed() {
    final filter = read(communityFilterProvider);
    invalidate(communityFeedNotifierProvider(filter));
  }
}

/// Comments for one post, keyed by postId.
final communityCommentsProvider = FutureProvider.autoDispose
    .family<List<CommunityComment>, String>((ref, postId) async {
  return ref.watch(communityServiceProvider).listComments(postId);
});

/// Full likers list for one post, keyed by postId.
final communityLikersProvider = FutureProvider.autoDispose
    .family<List<CommunityMemberRef>, String>((ref, postId) async {
  return ref.watch(communityServiceProvider).listLikers(postId, limit: 100);
});

/// My bookmarked posts, most recent first. Powers the /community/saved
/// screen.
final communityBookmarksProvider =
    FutureProvider.autoDispose<List<CommunityPost>>((ref) async {
  ref.keepAlive();
  return ref.watch(communityServiceProvider).listBookmarks(limit: 50);
});

/// Author-profile aggregate for one member. Keyed by memberId.
final communityMemberProfileProvider = FutureProvider.autoDispose
    .family<CommunityMemberProfile, String>((ref, memberId) async {
  return ref.watch(communityServiceProvider).getMemberProfile(memberId);
});
