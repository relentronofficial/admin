import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/api.dart';
import '../../../shared/api/dio_provider.dart';
import '../../../shared/providers/me_provider.dart';

class ProfileConnection {
  const ProfileConnection({
    required this.id,
    required this.name,
    this.avatarUrl,
    this.role,
    this.businessName,
  });

  final String id;
  final String name;
  final String? avatarUrl;
  final String? role;
  final String? businessName;

  factory ProfileConnection.fromJson(Map<String, dynamic> j) => ProfileConnection(
        id: j['id'] as String,
        name: (j['name'] as String?) ?? '',
        avatarUrl: j['avatarUrl'] as String?,
        role: j['role'] as String?,
        businessName: j['businessName'] as String?,
      );
}

class MyWinPost {
  const MyWinPost({
    required this.id,
    required this.content,
    required this.mediaUrls,
    required this.createdAt,
    required this.likeCount,
    required this.commentCount,
    required this.isApproved,
  });

  final String id;
  final String content;
  final List<String> mediaUrls;
  final DateTime createdAt;
  final int likeCount;
  final int commentCount;
  final bool isApproved;

  factory MyWinPost.fromJson(Map<String, dynamic> j) => MyWinPost(
        id: j['id'] as String,
        content: (j['content'] as String?) ?? '',
        mediaUrls: ((j['mediaUrls'] as List<dynamic>?) ?? const [])
            .whereType<String>()
            .toList(),
        createdAt: DateTime.tryParse((j['createdAt'] as String?) ?? '') ??
            DateTime.now(),
        likeCount: (j['likeCount'] as num?)?.toInt() ?? 0,
        commentCount: (j['commentCount'] as num?)?.toInt() ?? 0,
        isApproved: (j['isApproved'] as bool?) ?? false,
      );
}

class LegalPage {
  const LegalPage({
    required this.slug,
    required this.title,
    required this.bodyMarkdown,
    required this.updatedAt,
  });

  final String slug;
  final String title;
  final String bodyMarkdown;
  final DateTime updatedAt;

  factory LegalPage.fromJson(Map<String, dynamic> j) => LegalPage(
        slug: j['slug'] as String,
        title: (j['title'] as String?) ?? '',
        bodyMarkdown: (j['bodyMarkdown'] as String?) ?? '',
        updatedAt: DateTime.tryParse((j['updatedAt'] as String?) ?? '') ??
            DateTime.now(),
      );
}

/// Fetches the current member's followed connections.
final myConnectionsProvider =
    FutureProvider.autoDispose<List<ProfileConnection>>((ref) async {
  final res = await ref.read(dioProvider).get<Map<String, dynamic>>(
        kUserMyConnections,
      );
  final list = (res.data?['data'] as List<dynamic>? ?? const [])
      .whereType<Map<String, dynamic>>()
      .map(ProfileConnection.fromJson)
      .toList();
  return list;
});

/// Typed snapshot of the three profile stat tiles: Daily Streak /
/// Connections / TBT Points. Mirrors co-worker's TbtPointsService.
/// fetchProfileStats() shape.
class ProfileStats {
  const ProfileStats({
    required this.dailyStreak,
    required this.connections,
    required this.tbtPoints,
  });

  final int dailyStreak;
  final int connections;
  final int tbtPoints;

  static const empty =
      ProfileStats(dailyStreak: 0, connections: 0, tbtPoints: 0);
}

/// Live stats provider — composes the cached [rawMeProvider] (backed
/// by `meNotifierProvider`'s single `/api/user/me` fetch) with
/// [myConnectionsProvider]. No independent HTTP calls; invalidating
/// either upstream provider re-derives this one. Backend recalculates
/// `currentStreak` + `totalPoints` on every `/api/user/me` hit
/// (throttled 60s per member), so pull-to-refresh gets fresh numbers.
final profileStatsProvider =
    FutureProvider.autoDispose<ProfileStats>((ref) async {
  final results = await Future.wait([
    ref.watch(rawMeProvider.future),
    ref.watch(myConnectionsProvider.future),
  ]);
  final me = results[0] as Map<String, dynamic>;
  final conns = results[1] as List<ProfileConnection>;
  return ProfileStats(
    dailyStreak: (me['currentStreak'] as num?)?.toInt() ?? 0,
    connections: conns.length,
    tbtPoints: (me['totalPoints'] as num?)?.toInt() ?? 0,
  );
});

/// Fetches the member's own community posts (for the My Wins tab).
final myPostsProvider =
    FutureProvider.autoDispose<List<MyWinPost>>((ref) async {
  final res = await ref.read(dioProvider).get<Map<String, dynamic>>(
        kUserMyPosts,
      );
  final list = (res.data?['data'] as List<dynamic>? ?? const [])
      .whereType<Map<String, dynamic>>()
      .map(MyWinPost.fromJson)
      .toList();
  return list;
});

/// Fetches a legal page (`terms` or `privacy`) via the public endpoint.
final legalPageProvider =
    FutureProvider.family.autoDispose<LegalPage, String>((ref, slug) async {
  final res = await ref.read(dioProvider).get<Map<String, dynamic>>(
        '$kPubLegal/$slug',
      );
  final data = (res.data?['data'] as Map<String, dynamic>?) ?? const {};
  return LegalPage.fromJson(data);
});
