// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'workshops_provider.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$workshopsHash() => r'6459feff2036d8c99f7cf609376b5d7aca88d248';

/// See also [workshops].
@ProviderFor(workshops)
final workshopsProvider = AutoDisposeFutureProvider<List<Workshop>>.internal(
  workshops,
  name: r'workshopsProvider',
  debugGetCreateSourceHash:
      const bool.fromEnvironment('dart.vm.product') ? null : _$workshopsHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef WorkshopsRef = AutoDisposeFutureProviderRef<List<Workshop>>;
String _$workshopDetailHash() => r'73c1b7687d7dd9ced3202a0ca3590ba3392f7af9';

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

/// See also [workshopDetail].
@ProviderFor(workshopDetail)
const workshopDetailProvider = WorkshopDetailFamily();

/// See also [workshopDetail].
class WorkshopDetailFamily extends Family<AsyncValue<WorkshopDetail>> {
  /// See also [workshopDetail].
  const WorkshopDetailFamily();

  /// See also [workshopDetail].
  WorkshopDetailProvider call(String slug) {
    return WorkshopDetailProvider(slug);
  }

  @override
  WorkshopDetailProvider getProviderOverride(
    covariant WorkshopDetailProvider provider,
  ) {
    return call(provider.slug);
  }

  static const Iterable<ProviderOrFamily>? _dependencies = null;

  @override
  Iterable<ProviderOrFamily>? get dependencies => _dependencies;

  static const Iterable<ProviderOrFamily>? _allTransitiveDependencies = null;

  @override
  Iterable<ProviderOrFamily>? get allTransitiveDependencies =>
      _allTransitiveDependencies;

  @override
  String? get name => r'workshopDetailProvider';
}

/// See also [workshopDetail].
class WorkshopDetailProvider extends AutoDisposeFutureProvider<WorkshopDetail> {
  /// See also [workshopDetail].
  WorkshopDetailProvider(String slug)
    : this._internal(
        (ref) => workshopDetail(ref as WorkshopDetailRef, slug),
        from: workshopDetailProvider,
        name: r'workshopDetailProvider',
        debugGetCreateSourceHash:
            const bool.fromEnvironment('dart.vm.product')
                ? null
                : _$workshopDetailHash,
        dependencies: WorkshopDetailFamily._dependencies,
        allTransitiveDependencies:
            WorkshopDetailFamily._allTransitiveDependencies,
        slug: slug,
      );

  WorkshopDetailProvider._internal(
    super._createNotifier, {
    required super.name,
    required super.dependencies,
    required super.allTransitiveDependencies,
    required super.debugGetCreateSourceHash,
    required super.from,
    required this.slug,
  }) : super.internal();

  final String slug;

  @override
  Override overrideWith(
    FutureOr<WorkshopDetail> Function(WorkshopDetailRef provider) create,
  ) {
    return ProviderOverride(
      origin: this,
      override: WorkshopDetailProvider._internal(
        (ref) => create(ref as WorkshopDetailRef),
        from: from,
        name: null,
        dependencies: null,
        allTransitiveDependencies: null,
        debugGetCreateSourceHash: null,
        slug: slug,
      ),
    );
  }

  @override
  AutoDisposeFutureProviderElement<WorkshopDetail> createElement() {
    return _WorkshopDetailProviderElement(this);
  }

  @override
  bool operator ==(Object other) {
    return other is WorkshopDetailProvider && other.slug == slug;
  }

  @override
  int get hashCode {
    var hash = _SystemHash.combine(0, runtimeType.hashCode);
    hash = _SystemHash.combine(hash, slug.hashCode);

    return _SystemHash.finish(hash);
  }
}

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
mixin WorkshopDetailRef on AutoDisposeFutureProviderRef<WorkshopDetail> {
  /// The parameter `slug` of this provider.
  String get slug;
}

class _WorkshopDetailProviderElement
    extends AutoDisposeFutureProviderElement<WorkshopDetail>
    with WorkshopDetailRef {
  _WorkshopDetailProviderElement(super.provider);

  @override
  String get slug => (origin as WorkshopDetailProvider).slug;
}

String _$workshopFlowHash() => r'08902988d8d5a75c021197390db0d8f94f72ca1f';

/// See also [workshopFlow].
@ProviderFor(workshopFlow)
const workshopFlowProvider = WorkshopFlowFamily();

/// See also [workshopFlow].
class WorkshopFlowFamily extends Family<AsyncValue<List<FlowItem>>> {
  /// See also [workshopFlow].
  const WorkshopFlowFamily();

  /// See also [workshopFlow].
  WorkshopFlowProvider call(String slug) {
    return WorkshopFlowProvider(slug);
  }

  @override
  WorkshopFlowProvider getProviderOverride(
    covariant WorkshopFlowProvider provider,
  ) {
    return call(provider.slug);
  }

  static const Iterable<ProviderOrFamily>? _dependencies = null;

  @override
  Iterable<ProviderOrFamily>? get dependencies => _dependencies;

  static const Iterable<ProviderOrFamily>? _allTransitiveDependencies = null;

  @override
  Iterable<ProviderOrFamily>? get allTransitiveDependencies =>
      _allTransitiveDependencies;

  @override
  String? get name => r'workshopFlowProvider';
}

/// See also [workshopFlow].
class WorkshopFlowProvider extends AutoDisposeFutureProvider<List<FlowItem>> {
  /// See also [workshopFlow].
  WorkshopFlowProvider(String slug)
    : this._internal(
        (ref) => workshopFlow(ref as WorkshopFlowRef, slug),
        from: workshopFlowProvider,
        name: r'workshopFlowProvider',
        debugGetCreateSourceHash:
            const bool.fromEnvironment('dart.vm.product')
                ? null
                : _$workshopFlowHash,
        dependencies: WorkshopFlowFamily._dependencies,
        allTransitiveDependencies:
            WorkshopFlowFamily._allTransitiveDependencies,
        slug: slug,
      );

  WorkshopFlowProvider._internal(
    super._createNotifier, {
    required super.name,
    required super.dependencies,
    required super.allTransitiveDependencies,
    required super.debugGetCreateSourceHash,
    required super.from,
    required this.slug,
  }) : super.internal();

  final String slug;

  @override
  Override overrideWith(
    FutureOr<List<FlowItem>> Function(WorkshopFlowRef provider) create,
  ) {
    return ProviderOverride(
      origin: this,
      override: WorkshopFlowProvider._internal(
        (ref) => create(ref as WorkshopFlowRef),
        from: from,
        name: null,
        dependencies: null,
        allTransitiveDependencies: null,
        debugGetCreateSourceHash: null,
        slug: slug,
      ),
    );
  }

  @override
  AutoDisposeFutureProviderElement<List<FlowItem>> createElement() {
    return _WorkshopFlowProviderElement(this);
  }

  @override
  bool operator ==(Object other) {
    return other is WorkshopFlowProvider && other.slug == slug;
  }

  @override
  int get hashCode {
    var hash = _SystemHash.combine(0, runtimeType.hashCode);
    hash = _SystemHash.combine(hash, slug.hashCode);

    return _SystemHash.finish(hash);
  }
}

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
mixin WorkshopFlowRef on AutoDisposeFutureProviderRef<List<FlowItem>> {
  /// The parameter `slug` of this provider.
  String get slug;
}

class _WorkshopFlowProviderElement
    extends AutoDisposeFutureProviderElement<List<FlowItem>>
    with WorkshopFlowRef {
  _WorkshopFlowProviderElement(super.provider);

  @override
  String get slug => (origin as WorkshopFlowProvider).slug;
}

String _$workshopQaHash() => r'4587375c7a79565ef9b5883410b89b4bc03cc7a3';

/// See also [workshopQa].
@ProviderFor(workshopQa)
const workshopQaProvider = WorkshopQaFamily();

/// See also [workshopQa].
class WorkshopQaFamily extends Family<AsyncValue<WorkshopQaData>> {
  /// See also [workshopQa].
  const WorkshopQaFamily();

  /// See also [workshopQa].
  WorkshopQaProvider call(String slug) {
    return WorkshopQaProvider(slug);
  }

  @override
  WorkshopQaProvider getProviderOverride(
    covariant WorkshopQaProvider provider,
  ) {
    return call(provider.slug);
  }

  static const Iterable<ProviderOrFamily>? _dependencies = null;

  @override
  Iterable<ProviderOrFamily>? get dependencies => _dependencies;

  static const Iterable<ProviderOrFamily>? _allTransitiveDependencies = null;

  @override
  Iterable<ProviderOrFamily>? get allTransitiveDependencies =>
      _allTransitiveDependencies;

  @override
  String? get name => r'workshopQaProvider';
}

/// See also [workshopQa].
class WorkshopQaProvider extends AutoDisposeFutureProvider<WorkshopQaData> {
  /// See also [workshopQa].
  WorkshopQaProvider(String slug)
    : this._internal(
        (ref) => workshopQa(ref as WorkshopQaRef, slug),
        from: workshopQaProvider,
        name: r'workshopQaProvider',
        debugGetCreateSourceHash:
            const bool.fromEnvironment('dart.vm.product')
                ? null
                : _$workshopQaHash,
        dependencies: WorkshopQaFamily._dependencies,
        allTransitiveDependencies: WorkshopQaFamily._allTransitiveDependencies,
        slug: slug,
      );

  WorkshopQaProvider._internal(
    super._createNotifier, {
    required super.name,
    required super.dependencies,
    required super.allTransitiveDependencies,
    required super.debugGetCreateSourceHash,
    required super.from,
    required this.slug,
  }) : super.internal();

  final String slug;

  @override
  Override overrideWith(
    FutureOr<WorkshopQaData> Function(WorkshopQaRef provider) create,
  ) {
    return ProviderOverride(
      origin: this,
      override: WorkshopQaProvider._internal(
        (ref) => create(ref as WorkshopQaRef),
        from: from,
        name: null,
        dependencies: null,
        allTransitiveDependencies: null,
        debugGetCreateSourceHash: null,
        slug: slug,
      ),
    );
  }

  @override
  AutoDisposeFutureProviderElement<WorkshopQaData> createElement() {
    return _WorkshopQaProviderElement(this);
  }

  @override
  bool operator ==(Object other) {
    return other is WorkshopQaProvider && other.slug == slug;
  }

  @override
  int get hashCode {
    var hash = _SystemHash.combine(0, runtimeType.hashCode);
    hash = _SystemHash.combine(hash, slug.hashCode);

    return _SystemHash.finish(hash);
  }
}

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
mixin WorkshopQaRef on AutoDisposeFutureProviderRef<WorkshopQaData> {
  /// The parameter `slug` of this provider.
  String get slug;
}

class _WorkshopQaProviderElement
    extends AutoDisposeFutureProviderElement<WorkshopQaData>
    with WorkshopQaRef {
  _WorkshopQaProviderElement(super.provider);

  @override
  String get slug => (origin as WorkshopQaProvider).slug;
}

String _$workshopAssignmentsHash() =>
    r'ba0984cc03bfdfcc7d31c34800b425363ea5b0b0';

/// See also [workshopAssignments].
@ProviderFor(workshopAssignments)
const workshopAssignmentsProvider = WorkshopAssignmentsFamily();

/// See also [workshopAssignments].
class WorkshopAssignmentsFamily
    extends Family<AsyncValue<List<AssignmentGroup>>> {
  /// See also [workshopAssignments].
  const WorkshopAssignmentsFamily();

  /// See also [workshopAssignments].
  WorkshopAssignmentsProvider call(String slug) {
    return WorkshopAssignmentsProvider(slug);
  }

  @override
  WorkshopAssignmentsProvider getProviderOverride(
    covariant WorkshopAssignmentsProvider provider,
  ) {
    return call(provider.slug);
  }

  static const Iterable<ProviderOrFamily>? _dependencies = null;

  @override
  Iterable<ProviderOrFamily>? get dependencies => _dependencies;

  static const Iterable<ProviderOrFamily>? _allTransitiveDependencies = null;

  @override
  Iterable<ProviderOrFamily>? get allTransitiveDependencies =>
      _allTransitiveDependencies;

  @override
  String? get name => r'workshopAssignmentsProvider';
}

/// See also [workshopAssignments].
class WorkshopAssignmentsProvider
    extends AutoDisposeFutureProvider<List<AssignmentGroup>> {
  /// See also [workshopAssignments].
  WorkshopAssignmentsProvider(String slug)
    : this._internal(
        (ref) => workshopAssignments(ref as WorkshopAssignmentsRef, slug),
        from: workshopAssignmentsProvider,
        name: r'workshopAssignmentsProvider',
        debugGetCreateSourceHash:
            const bool.fromEnvironment('dart.vm.product')
                ? null
                : _$workshopAssignmentsHash,
        dependencies: WorkshopAssignmentsFamily._dependencies,
        allTransitiveDependencies:
            WorkshopAssignmentsFamily._allTransitiveDependencies,
        slug: slug,
      );

  WorkshopAssignmentsProvider._internal(
    super._createNotifier, {
    required super.name,
    required super.dependencies,
    required super.allTransitiveDependencies,
    required super.debugGetCreateSourceHash,
    required super.from,
    required this.slug,
  }) : super.internal();

  final String slug;

  @override
  Override overrideWith(
    FutureOr<List<AssignmentGroup>> Function(WorkshopAssignmentsRef provider)
    create,
  ) {
    return ProviderOverride(
      origin: this,
      override: WorkshopAssignmentsProvider._internal(
        (ref) => create(ref as WorkshopAssignmentsRef),
        from: from,
        name: null,
        dependencies: null,
        allTransitiveDependencies: null,
        debugGetCreateSourceHash: null,
        slug: slug,
      ),
    );
  }

  @override
  AutoDisposeFutureProviderElement<List<AssignmentGroup>> createElement() {
    return _WorkshopAssignmentsProviderElement(this);
  }

  @override
  bool operator ==(Object other) {
    return other is WorkshopAssignmentsProvider && other.slug == slug;
  }

  @override
  int get hashCode {
    var hash = _SystemHash.combine(0, runtimeType.hashCode);
    hash = _SystemHash.combine(hash, slug.hashCode);

    return _SystemHash.finish(hash);
  }
}

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
mixin WorkshopAssignmentsRef
    on AutoDisposeFutureProviderRef<List<AssignmentGroup>> {
  /// The parameter `slug` of this provider.
  String get slug;
}

class _WorkshopAssignmentsProviderElement
    extends AutoDisposeFutureProviderElement<List<AssignmentGroup>>
    with WorkshopAssignmentsRef {
  _WorkshopAssignmentsProviderElement(super.provider);

  @override
  String get slug => (origin as WorkshopAssignmentsProvider).slug;
}

String _$workshopEventHandlerHash() =>
    r'c46eea24f3f506e4a646fd07ea961c623b033681';

/// Listens for `workshop:enrolled` and `workshop:removed` socket events and
/// invalidates [workshopsProvider] so the list refreshes automatically.
///
/// Copied from [workshopEventHandler].
@ProviderFor(workshopEventHandler)
final workshopEventHandlerProvider = Provider<void>.internal(
  workshopEventHandler,
  name: r'workshopEventHandlerProvider',
  debugGetCreateSourceHash:
      const bool.fromEnvironment('dart.vm.product')
          ? null
          : _$workshopEventHandlerHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef WorkshopEventHandlerRef = ProviderRef<void>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
