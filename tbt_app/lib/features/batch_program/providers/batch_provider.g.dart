// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'batch_provider.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$batchProgramHash() => r'1bf92ba01a31e263a59e37d4139f731ef86a2d19';

/// See also [batchProgram].
@ProviderFor(batchProgram)
final batchProgramProvider = FutureProvider<BatchProgram?>.internal(
  batchProgram,
  name: r'batchProgramProvider',
  debugGetCreateSourceHash:
      const bool.fromEnvironment('dart.vm.product') ? null : _$batchProgramHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef BatchProgramRef = FutureProviderRef<BatchProgram?>;
String _$batchDayHash() => r'f55f09047d1002824cb8079b4f97d9b3acf3dd96';

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

/// See also [batchDay].
@ProviderFor(batchDay)
const batchDayProvider = BatchDayFamily();

/// See also [batchDay].
class BatchDayFamily extends Family<AsyncValue<BatchDay?>> {
  /// See also [batchDay].
  const BatchDayFamily();

  /// See also [batchDay].
  BatchDayProvider call(int dayNumber) {
    return BatchDayProvider(dayNumber);
  }

  @override
  BatchDayProvider getProviderOverride(covariant BatchDayProvider provider) {
    return call(provider.dayNumber);
  }

  static const Iterable<ProviderOrFamily>? _dependencies = null;

  @override
  Iterable<ProviderOrFamily>? get dependencies => _dependencies;

  static const Iterable<ProviderOrFamily>? _allTransitiveDependencies = null;

  @override
  Iterable<ProviderOrFamily>? get allTransitiveDependencies =>
      _allTransitiveDependencies;

  @override
  String? get name => r'batchDayProvider';
}

/// See also [batchDay].
class BatchDayProvider extends AutoDisposeFutureProvider<BatchDay?> {
  /// See also [batchDay].
  BatchDayProvider(int dayNumber)
    : this._internal(
        (ref) => batchDay(ref as BatchDayRef, dayNumber),
        from: batchDayProvider,
        name: r'batchDayProvider',
        debugGetCreateSourceHash:
            const bool.fromEnvironment('dart.vm.product')
                ? null
                : _$batchDayHash,
        dependencies: BatchDayFamily._dependencies,
        allTransitiveDependencies: BatchDayFamily._allTransitiveDependencies,
        dayNumber: dayNumber,
      );

  BatchDayProvider._internal(
    super._createNotifier, {
    required super.name,
    required super.dependencies,
    required super.allTransitiveDependencies,
    required super.debugGetCreateSourceHash,
    required super.from,
    required this.dayNumber,
  }) : super.internal();

  final int dayNumber;

  @override
  Override overrideWith(
    FutureOr<BatchDay?> Function(BatchDayRef provider) create,
  ) {
    return ProviderOverride(
      origin: this,
      override: BatchDayProvider._internal(
        (ref) => create(ref as BatchDayRef),
        from: from,
        name: null,
        dependencies: null,
        allTransitiveDependencies: null,
        debugGetCreateSourceHash: null,
        dayNumber: dayNumber,
      ),
    );
  }

  @override
  AutoDisposeFutureProviderElement<BatchDay?> createElement() {
    return _BatchDayProviderElement(this);
  }

  @override
  bool operator ==(Object other) {
    return other is BatchDayProvider && other.dayNumber == dayNumber;
  }

  @override
  int get hashCode {
    var hash = _SystemHash.combine(0, runtimeType.hashCode);
    hash = _SystemHash.combine(hash, dayNumber.hashCode);

    return _SystemHash.finish(hash);
  }
}

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
mixin BatchDayRef on AutoDisposeFutureProviderRef<BatchDay?> {
  /// The parameter `dayNumber` of this provider.
  int get dayNumber;
}

class _BatchDayProviderElement
    extends AutoDisposeFutureProviderElement<BatchDay?>
    with BatchDayRef {
  _BatchDayProviderElement(super.provider);

  @override
  int get dayNumber => (origin as BatchDayProvider).dayNumber;
}

String _$batchDayApprovedNotifierHash() =>
    r'ff4506eee8b44989c3b7865b4a55d8c209e0ede8';

/// See also [BatchDayApprovedNotifier].
@ProviderFor(BatchDayApprovedNotifier)
final batchDayApprovedNotifierProvider =
    NotifierProvider<BatchDayApprovedNotifier, BatchDayApprovedEvent?>.internal(
      BatchDayApprovedNotifier.new,
      name: r'batchDayApprovedNotifierProvider',
      debugGetCreateSourceHash:
          const bool.fromEnvironment('dart.vm.product')
              ? null
              : _$batchDayApprovedNotifierHash,
      dependencies: null,
      allTransitiveDependencies: null,
    );

typedef _$BatchDayApprovedNotifier = Notifier<BatchDayApprovedEvent?>;
String _$batchDayRejectedNotifierHash() =>
    r'8c4416018b3e6d5db3b20920592ec83c204e22ec';

/// See also [BatchDayRejectedNotifier].
@ProviderFor(BatchDayRejectedNotifier)
final batchDayRejectedNotifierProvider =
    NotifierProvider<BatchDayRejectedNotifier, BatchDayRejectedEvent?>.internal(
      BatchDayRejectedNotifier.new,
      name: r'batchDayRejectedNotifierProvider',
      debugGetCreateSourceHash:
          const bool.fromEnvironment('dart.vm.product')
              ? null
              : _$batchDayRejectedNotifierHash,
      dependencies: null,
      allTransitiveDependencies: null,
    );

typedef _$BatchDayRejectedNotifier = Notifier<BatchDayRejectedEvent?>;
String _$batchCompletedNotifierHash() =>
    r'ec8fd77dbff3964e5b015c2b743508b769cb82f1';

/// See also [BatchCompletedNotifier].
@ProviderFor(BatchCompletedNotifier)
final batchCompletedNotifierProvider =
    NotifierProvider<BatchCompletedNotifier, BatchCompletedEvent?>.internal(
      BatchCompletedNotifier.new,
      name: r'batchCompletedNotifierProvider',
      debugGetCreateSourceHash:
          const bool.fromEnvironment('dart.vm.product')
              ? null
              : _$batchCompletedNotifierHash,
      dependencies: null,
      allTransitiveDependencies: null,
    );

typedef _$BatchCompletedNotifier = Notifier<BatchCompletedEvent?>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
