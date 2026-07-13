// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'catalog_provider.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$heroHash() => r'498fc08a96da599299096aa2fcadaf889e611e93';

/// See also [hero].
@ProviderFor(hero)
final heroProvider = AutoDisposeFutureProvider<HeroData>.internal(
  hero,
  name: r'heroProvider',
  debugGetCreateSourceHash:
      const bool.fromEnvironment('dart.vm.product') ? null : _$heroHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef HeroRef = AutoDisposeFutureProviderRef<HeroData>;
String _$catalogSectionsHash() => r'937128b620cdfed5160f727fd871fc321fd920e7';

/// See also [catalogSections].
@ProviderFor(catalogSections)
final catalogSectionsProvider =
    AutoDisposeFutureProvider<List<ContentSection>>.internal(
      catalogSections,
      name: r'catalogSectionsProvider',
      debugGetCreateSourceHash:
          const bool.fromEnvironment('dart.vm.product')
              ? null
              : _$catalogSectionsHash,
      dependencies: null,
      allTransitiveDependencies: null,
    );

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef CatalogSectionsRef = AutoDisposeFutureProviderRef<List<ContentSection>>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
