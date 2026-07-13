import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/api.dart';
import '../dio_client.dart';
import '../dio_provider.dart';

class ResourcesService {
  const ResourcesService(this._dio);
  final Dio _dio;

  Future<Map<String, dynamic>> listResources() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(kResources);
      return res.data ?? {};
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<String> getDownloadUrl(String id) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        '$kResources/$id/download-url',
      );
      return (res.data?['url'] as String?) ?? '';
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }
}

final resourcesServiceProvider = Provider<ResourcesService>(
  (ref) => ResourcesService(ref.watch(dioProvider)),
);
