import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../data/products_service.dart';

part 'products_provider.g.dart';

@riverpod
Future<List<Product>> products(Ref ref) =>
    ref.watch(productsFeatureServiceProvider).listProducts();

@riverpod
Future<List<InquiredProduct>> myProducts(Ref ref) =>
    ref.watch(productsFeatureServiceProvider).getMyProducts();
