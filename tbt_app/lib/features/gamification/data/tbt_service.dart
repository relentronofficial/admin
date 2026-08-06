import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/api.dart';
import '../../../shared/api/dio_client.dart';
import '../../../shared/api/dio_provider.dart';
import '../domain/tbt_models.dart';

class TbtService {
  const TbtService(this._dio);
  final Dio _dio;

  Future<TbtPath> getPath() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(kTbtPath);
      return TbtPath.fromJson(res.data?['data'] as Map<String, dynamic>);
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<void> completeTask(String taskId) async {
    try {
      await _dio.post<dynamic>('/api/tbt/tasks/$taskId/complete');
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<List<TbtLevel>> listLevels() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(kTbtLevels);
      final list = (res.data?['data'] as List<dynamic>?) ?? const [];
      return list.cast<Map<String, dynamic>>().map(TbtLevel.fromJson).toList();
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  /// Leaderboard rows sorted by total points desc.
  ///
  /// [period]: `'all'` (default), `'week'` (last 7 days), or `'month'`
  /// (last 30 days). The backend filters `tbt_activity_log` by
  /// `activity_date` accordingly.
  Future<List<LeaderboardRow>> leaderboard({
    int limit = 20,
    String period = 'all',
  }) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        kTbtLeaderboard,
        queryParameters: {'limit': limit, 'period': period},
      );
      final list = (res.data?['data'] as List<dynamic>?) ?? const [];
      return list
          .cast<Map<String, dynamic>>()
          .map(LeaderboardRow.fromJson)
          .toList();
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }
}

final tbtServiceProvider = Provider<TbtService>(
  (ref) => TbtService(ref.watch(dioProvider)),
);
