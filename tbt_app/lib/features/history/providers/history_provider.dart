import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../features/dashboard/data/dashboard_service.dart';
import '../../../shared/models/watch_history_item.dart';

part 'history_provider.g.dart';

// ── Paginated watch history state ─────────────────────────────────────────────

class WatchHistoryState {
  final List<WatchHistoryItem> items;
  final int currentPage;
  final bool hasMore;
  final bool isLoadingMore;

  const WatchHistoryState({
    required this.items,
    required this.currentPage,
    required this.hasMore,
    this.isLoadingMore = false,
  });

  WatchHistoryState copyWith({
    List<WatchHistoryItem>? items,
    int? currentPage,
    bool? hasMore,
    bool? isLoadingMore,
  }) =>
      WatchHistoryState(
        items: items ?? this.items,
        currentPage: currentPage ?? this.currentPage,
        hasMore: hasMore ?? this.hasMore,
        isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      );
}

// ── Notifier (family: filter string) ─────────────────────────────────────────

@riverpod
class WatchHistoryNotifier extends _$WatchHistoryNotifier {
  static const _limit = 20;

  @override
  Future<WatchHistoryState> build(String filter) async {
    final items = await _fetchPage(filter, 1);
    return WatchHistoryState(
      items: items,
      currentPage: 1,
      hasMore: items.length >= _limit,
    );
  }

  Future<void> loadMore() async {
    final current = state.valueOrNull;
    if (current == null || !current.hasMore || current.isLoadingMore) return;

    state = AsyncData(current.copyWith(isLoadingMore: true));

    try {
      final nextPage = current.currentPage + 1;
      final newItems = await _fetchPage(filter, nextPage);
      state = AsyncData(current.copyWith(
        items: [...current.items, ...newItems],
        currentPage: nextPage,
        hasMore: newItems.length >= _limit,
        isLoadingMore: false,
      ));
    } catch (_) {
      state = AsyncData(current.copyWith(isLoadingMore: false));
    }
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      final items = await _fetchPage(filter, 1);
      return WatchHistoryState(
        items: items,
        currentPage: 1,
        hasMore: items.length >= _limit,
      );
    });
  }

  Future<List<WatchHistoryItem>> _fetchPage(String filter, int page) =>
      ref.read(dashboardServiceProvider).getWatchHistory(
            filter: filter,
            page: page,
            limit: _limit,
          );
}
