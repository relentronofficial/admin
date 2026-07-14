// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'webinars_provider.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$webinarsHash() => r'191c0816e507790be801ea7bb7442c8a4ec630cb';

/// See also [webinars].
@ProviderFor(webinars)
final webinarsProvider = AutoDisposeFutureProvider<List<TbtWebinar>>.internal(
  webinars,
  name: r'webinarsProvider',
  debugGetCreateSourceHash:
      const bool.fromEnvironment('dart.vm.product') ? null : _$webinarsHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef WebinarsRef = AutoDisposeFutureProviderRef<List<TbtWebinar>>;
String _$webinarHash() => r'94490c007e9ea509152bef6f2e66ed432d93bb4c';

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

/// See also [webinar].
@ProviderFor(webinar)
const webinarProvider = WebinarFamily();

/// See also [webinar].
class WebinarFamily extends Family<AsyncValue<TbtWebinar>> {
  /// See also [webinar].
  const WebinarFamily();

  /// See also [webinar].
  WebinarProvider call(String id) {
    return WebinarProvider(id);
  }

  @override
  WebinarProvider getProviderOverride(covariant WebinarProvider provider) {
    return call(provider.id);
  }

  static const Iterable<ProviderOrFamily>? _dependencies = null;

  @override
  Iterable<ProviderOrFamily>? get dependencies => _dependencies;

  static const Iterable<ProviderOrFamily>? _allTransitiveDependencies = null;

  @override
  Iterable<ProviderOrFamily>? get allTransitiveDependencies =>
      _allTransitiveDependencies;

  @override
  String? get name => r'webinarProvider';
}

/// See also [webinar].
class WebinarProvider extends AutoDisposeFutureProvider<TbtWebinar> {
  /// See also [webinar].
  WebinarProvider(String id)
    : this._internal(
        (ref) => webinar(ref as WebinarRef, id),
        from: webinarProvider,
        name: r'webinarProvider',
        debugGetCreateSourceHash:
            const bool.fromEnvironment('dart.vm.product')
                ? null
                : _$webinarHash,
        dependencies: WebinarFamily._dependencies,
        allTransitiveDependencies: WebinarFamily._allTransitiveDependencies,
        id: id,
      );

  WebinarProvider._internal(
    super._createNotifier, {
    required super.name,
    required super.dependencies,
    required super.allTransitiveDependencies,
    required super.debugGetCreateSourceHash,
    required super.from,
    required this.id,
  }) : super.internal();

  final String id;

  @override
  Override overrideWith(
    FutureOr<TbtWebinar> Function(WebinarRef provider) create,
  ) {
    return ProviderOverride(
      origin: this,
      override: WebinarProvider._internal(
        (ref) => create(ref as WebinarRef),
        from: from,
        name: null,
        dependencies: null,
        allTransitiveDependencies: null,
        debugGetCreateSourceHash: null,
        id: id,
      ),
    );
  }

  @override
  AutoDisposeFutureProviderElement<TbtWebinar> createElement() {
    return _WebinarProviderElement(this);
  }

  @override
  bool operator ==(Object other) {
    return other is WebinarProvider && other.id == id;
  }

  @override
  int get hashCode {
    var hash = _SystemHash.combine(0, runtimeType.hashCode);
    hash = _SystemHash.combine(hash, id.hashCode);

    return _SystemHash.finish(hash);
  }
}

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
mixin WebinarRef on AutoDisposeFutureProviderRef<TbtWebinar> {
  /// The parameter `id` of this provider.
  String get id;
}

class _WebinarProviderElement
    extends AutoDisposeFutureProviderElement<TbtWebinar>
    with WebinarRef {
  _WebinarProviderElement(super.provider);

  @override
  String get id => (origin as WebinarProvider).id;
}

// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
