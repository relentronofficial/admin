import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/api.dart';
import '../dio_client.dart';
import '../dio_provider.dart';

class NotificationsService {
  const NotificationsService(this._dio);
  final Dio _dio;

  Future<Map<String, dynamic>> list({int page = 1, int limit = 20}) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        kNotifications,
        queryParameters: {'page': page, 'limit': limit},
      );
      return res.data ?? {};
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<void> markRead(String id) async {
    try {
      await _dio.post<dynamic>('$kNotifications/$id/read');
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<void> markAllRead() async {
    try {
      await _dio.post<dynamic>(kNotificationsReadAll);
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }
}

final notificationsServiceProvider = Provider<NotificationsService>(
  (ref) => NotificationsService(ref.watch(dioProvider)),
);
