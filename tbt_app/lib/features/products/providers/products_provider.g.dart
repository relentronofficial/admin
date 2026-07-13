// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'products_provider.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$productsHash() => r'420f7a3b905478d202905cf10ec743b720207dc9';

/// See also [products].
@ProviderFor(products)
final productsProvider = AutoDisposeFutureProvider<List<Product>>.internal(
  products,
  name: r'productsProvider',
  debugGetCreateSourceHash:
      const bool.fromEnvironment('dart.vm.product') ? null : _$productsHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef ProductsRef = AutoDisposeFutureProviderRef<List<Product>>;
String _$myProductsHash() => r'da9d5b9a5c898f36461ee198eec47ff24914dbcd';

/// See also [myProducts].
@ProviderFor(myProducts)
final myProductsProvider =
    AutoDisposeFutureProvider<List<InquiredProduct>>.internal(
      myProducts,
      name: r'myProductsProvider',
      debugGetCreateSourceHash:
          const bool.fromEnvironment('dart.vm.product')
              ? null
              : _$myProductsHash,
      dependencies: null,
      allTransitiveDependencies: null,
    );

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef MyProductsRef = AutoDisposeFutureProviderRef<List<InquiredProduct>>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
