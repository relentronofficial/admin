import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/api.dart';
import '../../../shared/api/dio_client.dart';
import '../../../shared/api/dio_provider.dart';

// ── Models ────────────────────────────────────────────────────────────────────

class ProductCta {
  final String label;
  final String url;
  final String type;
  final bool openInNewTab;

  const ProductCta({
    required this.label,
    required this.url,
    required this.type,
    required this.openInNewTab,
  });

  factory ProductCta.fromJson(Map<String, dynamic> j) => ProductCta(
        label: j['label'] as String? ?? '',
        url: j['url'] as String? ?? '',
        type: j['type'] as String? ?? 'external',
        openInNewTab: j['openInNewTab'] as bool? ?? true,
      );
}

class Product {
  final String id;
  final String title;
  final String? description;
  final String? thumbnailUrl;
  final double? price;
  final String currency;
  final String? category;
  final String stockStatus;
  final List<ProductCta> ctas;

  const Product({
    required this.id,
    required this.title,
    this.description,
    this.thumbnailUrl,
    this.price,
    required this.currency,
    this.category,
    required this.stockStatus,
    required this.ctas,
  });

  factory Product.fromJson(Map<String, dynamic> j) => Product(
        id: j['id'] as String,
        title: j['title'] as String,
        description: j['description'] as String?,
        thumbnailUrl: j['thumbnailUrl'] as String?,
        price: (j['price'] as num?)?.toDouble(),
        currency: j['currency'] as String? ?? 'INR',
        category: j['category'] as String?,
        stockStatus: j['stockStatus'] as String? ?? 'in_stock',
        ctas: (j['ctas'] as List<dynamic>? ?? [])
            .map((e) => ProductCta.fromJson(e as Map<String, dynamic>))
            .toList(),
      );

  String get formattedPrice {
    if (price == null) return 'Free';
    final sym = currency == 'INR' ? '₹' : '\$';
    return '$sym${price!.toStringAsFixed(price! % 1 == 0 ? 0 : 2)}';
  }
}

class InquiredProduct {
  final String id;
  final String title;
  final String? thumbnailUrl;
  final double? price;
  final String currency;
  final String? category;
  final String inquiryStatus;
  final String inquiredAt;

  const InquiredProduct({
    required this.id,
    required this.title,
    this.thumbnailUrl,
    this.price,
    required this.currency,
    this.category,
    required this.inquiryStatus,
    required this.inquiredAt,
  });

  factory InquiredProduct.fromJson(Map<String, dynamic> j) => InquiredProduct(
        id: j['id'] as String,
        title: j['title'] as String,
        thumbnailUrl: j['thumbnailUrl'] as String?,
        price: (j['price'] as num?)?.toDouble(),
        currency: j['currency'] as String? ?? 'INR',
        category: j['category'] as String?,
        inquiryStatus: j['inquiryStatus'] as String? ?? 'pending',
        inquiredAt: j['inquiredAt'] as String? ?? '',
      );

  String get formattedPrice {
    if (price == null) return 'Free';
    final sym = currency == 'INR' ? '₹' : '\$';
    return '$sym${price!.toStringAsFixed(price! % 1 == 0 ? 0 : 2)}';
  }
}

// ── Service ───────────────────────────────────────────────────────────────────

class ProductsFeatureService {
  const ProductsFeatureService(this._dio);
  final Dio _dio;

  Future<List<Product>> listProducts() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(kUserProducts);
      final list = res.data?['data']?['products'] as List<dynamic>? ?? [];
      return list
          .map((e) => Product.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<List<InquiredProduct>> getMyProducts() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(kUserProductsMy);
      final list = res.data?['data'] as List<dynamic>? ?? [];
      return list
          .map((e) => InquiredProduct.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<void> submitInquiry(String productId, String message) async {
    try {
      await _dio.post<dynamic>(
        '$kUserProducts/$productId/inquire',
        data: {'message': message},
      );
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }
}

final productsFeatureServiceProvider = Provider<ProductsFeatureService>(
  (ref) => ProductsFeatureService(ref.watch(dioProvider)),
);
