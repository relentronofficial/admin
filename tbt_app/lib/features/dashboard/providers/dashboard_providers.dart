import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../shared/models/watch_history_item.dart';
import '../data/dashboard_service.dart';

part 'dashboard_providers.g.dart';

@riverpod
Future<DashboardStats> dashboardStats(Ref ref) =>
    ref.watch(dashboardServiceProvider).getDashboardStats();

@riverpod
Future<List<WatchHistoryItem>> continueLearning(Ref ref) =>
    ref.watch(dashboardServiceProvider).getContinueLearning();

/// Family provider — pass `filter`: `'all'`, `'in_progress'`, or `'completed'`.
@riverpod
Future<List<WatchHistoryItem>> watchHistory(Ref ref, String filter) =>
    ref.watch(dashboardServiceProvider).getWatchHistory(filter: filter);
