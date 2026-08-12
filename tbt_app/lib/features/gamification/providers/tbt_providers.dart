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

/// Selected leaderboard period — `week` | `month` | `all`.
///
/// Referenced by `_PeriodSelector` in `wins_screen.dart`, which was committed
/// without this declaration. Restored here, next to the leaderboard provider it
/// pairs with, rather than in the screen: the screen reads it through
/// `ref.watch`, so it has to outlive the widget.
///
/// This is presentation state only. `TbtService.leaderboard()` takes no period
/// argument, so changing the chip re-fetches the same all-time rows — the
/// selector invalidates `tbtLeaderboardProvider` on tap. Wiring the period
/// through to the API is a backend change and deliberately out of scope here.
/// Defaults to `week`, matching the leftmost chip.
final leaderboardPeriodProvider = StateProvider<String>((ref) => 'week');
