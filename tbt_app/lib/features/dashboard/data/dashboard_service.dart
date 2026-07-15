import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/api.dart';
import '../../../shared/api/dio_client.dart';
import '../../../shared/api/dio_provider.dart';
import '../../../shared/cache/response_cache.dart';
import '../../../shared/models/watch_history_item.dart';

// Cache keys — kept in one place so we don't drift.
const _kCacheDashboardStats = 'dashboard:stats';
const _kCacheContinueLearning = 'dashboard:continue-learning';

class DashboardService {
  const DashboardService(this._dio);
  final Dio _dio;

  Future<DashboardStats> getDashboardStats() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(kDashboardStats);
      final data = (res.data?['data'] as Map<String, dynamic>?) ?? {};
      // Cache the raw payload so a subsequent cold-start / network dip
      // can render the last-known-good stats instantly.
      unawaited(ResponseCache.write(_kCacheDashboardStats, data));
      return DashboardStats.fromJson(data);
    } on DioException catch (e) {
      final cached = ResponseCache.readPayload(_kCacheDashboardStats);
      if (cached != null) return DashboardStats.fromJson(cached);
      throw mapDioError(e);
    }
  }

  Future<List<WatchHistoryItem>> getContinueLearning() async {
    try {
      final res =
          await _dio.get<Map<String, dynamic>>(kDashboardContinueLearning);
      final list = (res.data?['data'] as List<dynamic>?) ?? [];
      unawaited(
        ResponseCache.write(_kCacheContinueLearning, {'items': list}),
      );
      return list
          .cast<Map<String, dynamic>>()
          .map(WatchHistoryItem.fromJson)
          .toList();
    } on DioException catch (e) {
      final cached = ResponseCache.readPayload(_kCacheContinueLearning);
      final items = cached?['items'];
      if (items is List) {
        return items
            .cast<Map<String, dynamic>>()
            .map(WatchHistoryItem.fromJson)
            .toList();
      }
      throw mapDioError(e);
    }
  }

  Future<List<WatchHistoryItem>> getWatchHistory({
    String filter = 'all',
    int page = 1,
    int limit = 20,
  }) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        kDashboardWatchHistory,
        queryParameters: {'filter': filter, 'page': page, 'limit': limit},
      );
      final list = (res.data?['data'] as List<dynamic>?) ?? [];
      return list
          .cast<Map<String, dynamic>>()
          .map(WatchHistoryItem.fromJson)
          .toList();
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<void> removeFromHistory(String episodeId) async {
    try {
      await _dio.delete<dynamic>('$kDashboardWatchHistory/$episodeId');
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }
}

final dashboardServiceProvider = Provider<DashboardService>(
  (ref) => DashboardService(ref.watch(dioProvider)),
);
