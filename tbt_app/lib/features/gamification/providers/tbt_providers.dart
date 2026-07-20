import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/tbt_service.dart';
import '../domain/tbt_models.dart';

final tbtPathProvider = FutureProvider.autoDispose<TbtPath>((ref) async {
  return ref.watch(tbtServiceProvider).getPath();
});

final tbtLeaderboardProvider =
    FutureProvider.autoDispose<List<LeaderboardRow>>((ref) async {
  return ref.watch(tbtServiceProvider).leaderboard(limit: 50);
});
