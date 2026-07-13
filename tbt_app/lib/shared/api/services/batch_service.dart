import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/api.dart';
import '../dio_client.dart';
import '../dio_provider.dart';

class BatchService {
  const BatchService(this._dio);
  final Dio _dio;

  Future<Map<String, dynamic>> getMyBatch() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(kUserBatch);
      return res.data ?? {};
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<Map<String, dynamic>> getDay(int dayNumber) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>('$kUserBatch/$dayNumber');
      return res.data ?? {};
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<Map<String, dynamic>> saveDraft(
    int dayNumber,
    Map<String, dynamic> data,
  ) async {
    try {
      final res = await _dio.put<Map<String, dynamic>>(
        '$kUserBatch/$dayNumber',
        data: data,
      );
      return res.data ?? {};
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<Map<String, dynamic>> submitDay(
    int dayNumber,
    Map<String, dynamic> data,
  ) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '$kUserBatch/$dayNumber/submit',
        data: data,
      );
      return res.data ?? {};
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<void> markAttendance(Map<String, dynamic> data) async {
    try {
      await _dio.post<dynamic>(kUserBatchAttendance, data: data);
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }
}

final batchServiceProvider = Provider<BatchService>(
  (ref) => BatchService(ref.watch(dioProvider)),
);
