import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/api.dart';
import '../dio_client.dart';
import '../dio_provider.dart';

class DashboardService {
  const DashboardService(this._dio);
  final Dio _dio;

  Future<Map<String, dynamic>> getStats() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(kDashboardStats);
      return res.data ?? {};
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<List<dynamic>> getContinueLearning() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(kDashboardContinueLearning);
      return (res.data?['data'] as List<dynamic>?) ?? [];
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<Map<String, dynamic>> getWatchHistory({
    int page = 1,
    int limit = 20,
    String filter = 'all',
  }) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        kDashboardWatchHistory,
        queryParameters: {'page': page, 'limit': limit, 'filter': filter},
      );
      return res.data ?? {};
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }
}

final dashboardServiceProvider = Provider<DashboardService>(
  (ref) => DashboardService(ref.watch(dioProvider)),
);
