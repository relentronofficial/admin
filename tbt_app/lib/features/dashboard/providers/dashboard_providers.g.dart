// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_providers.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$dashboardStatsHash() => r'573ed8a4830dfc0f7eefbf1c507011613313c87b';

/// See also [dashboardStats].
@ProviderFor(dashboardStats)
final dashboardStatsProvider =
    AutoDisposeFutureProvider<DashboardStats>.internal(
      dashboardStats,
      name: r'dashboardStatsProvider',
      debugGetCreateSourceHash:
          const bool.fromEnvironment('dart.vm.product')
              ? null
              : _$dashboardStatsHash,
      dependencies: null,
      allTransitiveDependencies: null,
    );

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef DashboardStatsRef = AutoDisposeFutureProviderRef<DashboardStats>;
String _$continueLearningHash() => r'08a923f5bbe3762ebda795c6523f4f1343e54fdd';

/// See also [continueLearning].
@ProviderFor(continueLearning)
final continueLearningProvider =
    AutoDisposeFutureProvider<List<WatchHistoryItem>>.internal(
      continueLearning,
      name: r'continueLearningProvider',
      debugGetCreateSourceHash:
          const bool.fromEnvironment('dart.vm.product')
              ? null
              : _$continueLearningHash,
      dependencies: null,
      allTransitiveDependencies: null,
    );

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef ContinueLearningRef =
    AutoDisposeFutureProviderRef<List<WatchHistoryItem>>;
String _$watchHistoryHash() => r'b589fd425911bc2dee5ad9bcff139a799d6b1852';

/// Copied from Dart SDK
class _SystemHash {
  _SystemHash._();

  static int combine(int hash, int value) {
    // ignore: parameter_assignments
    hash = 0x1fffffff & (hash + value);
    // ignore: parameter_assignments
    hash = 0x1fffffff & (hash + ((0x0007ffff & hash) << 10));
    return hash ^ (hash >> 6);
  }

  static int finish(int hash) {
    // ignore: parameter_assignments
    hash = 0x1fffffff & (hash + ((0x03ffffff & hash) << 3));
    // ignore: parameter_assignments
    hash = hash ^ (hash >> 11);
    return 0x1fffffff & (hash + ((0x00003fff & hash) << 15));
  }
}

/// Family provider — pass `filter`: `'all'`, `'in_progress'`, or `'completed'`.
///
/// Copied from [watchHistory].
@ProviderFor(watchHistory)
const watchHistoryProvider = WatchHistoryFamily();

/// Family provider — pass `filter`: `'all'`, `'in_progress'`, or `'completed'`.
///
/// Copied from [watchHistory].
class WatchHistoryFamily extends Family<AsyncValue<List<WatchHistoryItem>>> {
  /// Family provider — pass `filter`: `'all'`, `'in_progress'`, or `'completed'`.
  ///
  /// Copied from [watchHistory].
  const WatchHistoryFamily();

  /// Family provider — pass `filter`: `'all'`, `'in_progress'`, or `'completed'`.
  ///
  /// Copied from [watchHistory].
  WatchHistoryProvider call(String filter) {
    return WatchHistoryProvider(filter);
  }

  @override
  WatchHistoryProvider getProviderOverride(
    covariant WatchHistoryProvider provider,
  ) {
    return call(provider.filter);
  }

  static const Iterable<ProviderOrFamily>? _dependencies = null;

  @override
  Iterable<ProviderOrFamily>? get dependencies => _dependencies;

  static const Iterable<ProviderOrFamily>? _allTransitiveDependencies = null;

  @override
  Iterable<ProviderOrFamily>? get allTransitiveDependencies =>
      _allTransitiveDependencies;

  @override
  String? get name => r'watchHistoryProvider';
}

/// Family provider — pass `filter`: `'all'`, `'in_progress'`, or `'completed'`.
///
/// Copied from [watchHistory].
class WatchHistoryProvider
    extends AutoDisposeFutureProvider<List<WatchHistoryItem>> {
  /// Family provider — pass `filter`: `'all'`, `'in_progress'`, or `'completed'`.
  ///
  /// Copied from [watchHistory].
  WatchHistoryProvider(String filter)
    : this._internal(
        (ref) => watchHistory(ref as WatchHistoryRef, filter),
        from: watchHistoryProvider,
        name: r'watchHistoryProvider',
        debugGetCreateSourceHash:
            const bool.fromEnvironment('dart.vm.product')
                ? null
                : _$watchHistoryHash,
        dependencies: WatchHistoryFamily._dependencies,
        allTransitiveDependencies:
            WatchHistoryFamily._allTransitiveDependencies,
        filter: filter,
      );

  WatchHistoryProvider._internal(
    super._createNotifier, {
    required super.name,
    required super.dependencies,
    required super.allTransitiveDependencies,
    required super.debugGetCreateSourceHash,
    required super.from,
    required this.filter,
  }) : super.internal();

  final String filter;

  @override
  Override overrideWith(
    FutureOr<List<WatchHistoryItem>> Function(WatchHistoryRef provider) create,
  ) {
    return ProviderOverride(
      origin: this,
      override: WatchHistoryProvider._internal(
        (ref) => create(ref as WatchHistoryRef),
        from: from,
        name: null,
        dependencies: null,
        allTransitiveDependencies: null,
        debugGetCreateSourceHash: null,
        filter: filter,
      ),
    );
  }

  @override
  AutoDisposeFutureProviderElement<List<WatchHistoryItem>> createElement() {
    return _WatchHistoryProviderElement(this);
  }

  @override
  bool operator ==(Object other) {
    return other is WatchHistoryProvider && other.filter == filter;
  }

  @override
  int get hashCode {
    var hash = _SystemHash.combine(0, runtimeType.hashCode);
    hash = _SystemHash.combine(hash, filter.hashCode);

    return _SystemHash.finish(hash);
  }
}

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
mixin WatchHistoryRef on AutoDisposeFutureProviderRef<List<WatchHistoryItem>> {
  /// The parameter `filter` of this provider.
  String get filter;
}

class _WatchHistoryProviderElement
    extends AutoDisposeFutureProviderElement<List<WatchHistoryItem>>
    with WatchHistoryRef {
  _WatchHistoryProviderElement(super.provider);

  @override
  String get filter => (origin as WatchHistoryProvider).filter;
}

// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
