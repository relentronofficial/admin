import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/tbt_service.dart';
import '../domain/tbt_models.dart';

final tbtPathProvider = FutureProvider.autoDispose<TbtPath>((ref) async {
  return ref.watch(tbtServiceProvider).getPath();
});

/// Which time period the WINS screen is displaying: `all`, `week`, `month`.
final leaderboardPeriodProvider = StateProvider<String>((_) => 'all');

/// Leaderboard rows for the currently selected period.
final tbtLeaderboardProvider =
    FutureProvider.autoDispose<List<LeaderboardRow>>((ref) async {
  final period = ref.watch(leaderboardPeriodProvider);
  return ref
      .watch(tbtServiceProvider)
      .leaderboard(limit: 50, period: period);
});
