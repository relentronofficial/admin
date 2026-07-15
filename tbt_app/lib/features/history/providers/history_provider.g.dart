// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'history_provider.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$watchHistoryNotifierHash() =>
    r'8c549cb1aa1e3a193d3c6a4f61cd9142cbccd4ff';

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

abstract class _$WatchHistoryNotifier
    extends BuildlessAutoDisposeAsyncNotifier<WatchHistoryState> {
  late final String filter;

  FutureOr<WatchHistoryState> build(String filter);
}

/// See also [WatchHistoryNotifier].
@ProviderFor(WatchHistoryNotifier)
const watchHistoryNotifierProvider = WatchHistoryNotifierFamily();

/// See also [WatchHistoryNotifier].
class WatchHistoryNotifierFamily extends Family<AsyncValue<WatchHistoryState>> {
  /// See also [WatchHistoryNotifier].
  const WatchHistoryNotifierFamily();

  /// See also [WatchHistoryNotifier].
  WatchHistoryNotifierProvider call(String filter) {
    return WatchHistoryNotifierProvider(filter);
  }

  @override
  WatchHistoryNotifierProvider getProviderOverride(
    covariant WatchHistoryNotifierProvider provider,
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
  String? get name => r'watchHistoryNotifierProvider';
}

/// See also [WatchHistoryNotifier].
class WatchHistoryNotifierProvider
    extends
        AutoDisposeAsyncNotifierProviderImpl<
          WatchHistoryNotifier,
          WatchHistoryState
        > {
  /// See also [WatchHistoryNotifier].
  WatchHistoryNotifierProvider(String filter)
    : this._internal(
        () => WatchHistoryNotifier()..filter = filter,
        from: watchHistoryNotifierProvider,
        name: r'watchHistoryNotifierProvider',
        debugGetCreateSourceHash:
            const bool.fromEnvironment('dart.vm.product')
                ? null
                : _$watchHistoryNotifierHash,
        dependencies: WatchHistoryNotifierFamily._dependencies,
        allTransitiveDependencies:
            WatchHistoryNotifierFamily._allTransitiveDependencies,
        filter: filter,
      );

  WatchHistoryNotifierProvider._internal(
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
  FutureOr<WatchHistoryState> runNotifierBuild(
    covariant WatchHistoryNotifier notifier,
  ) {
    return notifier.build(filter);
  }

  @override
  Override overrideWith(WatchHistoryNotifier Function() create) {
    return ProviderOverride(
      origin: this,
      override: WatchHistoryNotifierProvider._internal(
        () => create()..filter = filter,
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
  AutoDisposeAsyncNotifierProviderElement<
    WatchHistoryNotifier,
    WatchHistoryState
  >
  createElement() {
    return _WatchHistoryNotifierProviderElement(this);
  }

  @override
  bool operator ==(Object other) {
    return other is WatchHistoryNotifierProvider && other.filter == filter;
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
mixin WatchHistoryNotifierRef
    on AutoDisposeAsyncNotifierProviderRef<WatchHistoryState> {
  /// The parameter `filter` of this provider.
  String get filter;
}

class _WatchHistoryNotifierProviderElement
    extends
        AutoDisposeAsyncNotifierProviderElement<
          WatchHistoryNotifier,
          WatchHistoryState
        >
    with WatchHistoryNotifierRef {
  _WatchHistoryNotifierProviderElement(super.provider);

  @override
  String get filter => (origin as WatchHistoryNotifierProvider).filter;
}

// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
