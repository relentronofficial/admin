import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/api.dart';
import '../dio_client.dart';
import '../dio_provider.dart';

class ConfigService {
  const ConfigService(this._dio);
  final Dio _dio;

  Future<Map<String, dynamic>> getSiteConfig() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(kConfigSite);
      return res.data ?? {};
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<Map<String, dynamic>> getNavConfig() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(kConfigNav);
      return res.data ?? {};
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<Map<String, dynamic>> getUiStrings() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(kConfigUiStrings);
      return res.data ?? {};
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }
}

final configServiceProvider = Provider<ConfigService>(
  (ref) => ConfigService(ref.watch(dioProvider)),
);
