import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/api.dart';
import '../dio_client.dart';
import '../dio_provider.dart';

class WorkshopsService {
  const WorkshopsService(this._dio);
  final Dio _dio;

  Future<Map<String, dynamic>> listWorkshops() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(kWorkshops);
      return res.data ?? {};
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<Map<String, dynamic>> getWorkshop(String id) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>('$kWorkshops/$id');
      return res.data ?? {};
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<void> enroll(String id) async {
    try {
      await _dio.post<dynamic>('$kWorkshops/$id$kWorkshopEnroll');
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<List<dynamic>> getFlow(String id) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>('$kWorkshops/$id$kWorkshopFlow');
      return (res.data?['data'] as List<dynamic>?) ?? [];
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<List<dynamic>> getQaQuestions(String id) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>('$kWorkshops/$id$kWorkshopQaQuestions');
      return (res.data?['data'] as List<dynamic>?) ?? [];
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<List<dynamic>> getLiveCalls(String id) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>('$kWorkshops/$id$kWorkshopLiveCalls');
      return (res.data?['data'] as List<dynamic>?) ?? [];
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }
}

final workshopsServiceProvider = Provider<WorkshopsService>(
  (ref) => WorkshopsService(ref.watch(dioProvider)),
);
