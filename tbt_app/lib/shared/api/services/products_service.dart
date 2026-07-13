import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/api.dart';
import '../dio_client.dart';
import '../dio_provider.dart';

class ProductsService {
  const ProductsService(this._dio);
  final Dio _dio;

  Future<Map<String, dynamic>> listProducts() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(kProducts);
      return res.data ?? {};
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<List<dynamic>> getUserProducts() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(kUserProducts);
      return (res.data?['data'] as List<dynamic>?) ?? [];
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<void> submitInquiry(String productId, Map<String, dynamic> data) async {
    try {
      await _dio.post<dynamic>('$kProducts/$productId/inquiry', data: data);
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }
}

final productsServiceProvider = Provider<ProductsService>(
  (ref) => ProductsService(ref.watch(dioProvider)),
);
