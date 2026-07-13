// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'programs_provider.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$programsHash() => r'3f0c03f684120996726eeaa45a907cad0c07d53f';

/// See also [programs].
@ProviderFor(programs)
final programsProvider = AutoDisposeFutureProvider<List<TbtProgram>>.internal(
  programs,
  name: r'programsProvider',
  debugGetCreateSourceHash:
      const bool.fromEnvironment('dart.vm.product') ? null : _$programsHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef ProgramsRef = AutoDisposeFutureProviderRef<List<TbtProgram>>;
String _$programDetailHash() => r'1580262b3d8ce62c33157ecb8650887808871ae5';

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

/// See also [programDetail].
@ProviderFor(programDetail)
const programDetailProvider = ProgramDetailFamily();

/// See also [programDetail].
class ProgramDetailFamily extends Family<AsyncValue<TbtProgramDetail>> {
  /// See also [programDetail].
  const ProgramDetailFamily();

  /// See also [programDetail].
  ProgramDetailProvider call(String id) {
    return ProgramDetailProvider(id);
  }

  @override
  ProgramDetailProvider getProviderOverride(
    covariant ProgramDetailProvider provider,
  ) {
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
  String? get name => r'programDetailProvider';
}

/// See also [programDetail].
class ProgramDetailProvider
    extends AutoDisposeFutureProvider<TbtProgramDetail> {
  /// See also [programDetail].
  ProgramDetailProvider(String id)
    : this._internal(
        (ref) => programDetail(ref as ProgramDetailRef, id),
        from: programDetailProvider,
        name: r'programDetailProvider',
        debugGetCreateSourceHash:
            const bool.fromEnvironment('dart.vm.product')
                ? null
                : _$programDetailHash,
        dependencies: ProgramDetailFamily._dependencies,
        allTransitiveDependencies:
            ProgramDetailFamily._allTransitiveDependencies,
        id: id,
      );

  ProgramDetailProvider._internal(
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
    FutureOr<TbtProgramDetail> Function(ProgramDetailRef provider) create,
  ) {
    return ProviderOverride(
      origin: this,
      override: ProgramDetailProvider._internal(
        (ref) => create(ref as ProgramDetailRef),
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
  AutoDisposeFutureProviderElement<TbtProgramDetail> createElement() {
    return _ProgramDetailProviderElement(this);
  }

  @override
  bool operator ==(Object other) {
    return other is ProgramDetailProvider && other.id == id;
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
mixin ProgramDetailRef on AutoDisposeFutureProviderRef<TbtProgramDetail> {
  /// The parameter `id` of this provider.
  String get id;
}

class _ProgramDetailProviderElement
    extends AutoDisposeFutureProviderElement<TbtProgramDetail>
    with ProgramDetailRef {
  _ProgramDetailProviderElement(super.provider);

  @override
  String get id => (origin as ProgramDetailProvider).id;
}

// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
