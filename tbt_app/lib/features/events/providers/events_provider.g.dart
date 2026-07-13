// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'events_provider.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$eventsHash() => r'370cfd347e4f9694dd74f89f77675f4a26032e51';

/// See also [events].
@ProviderFor(events)
final eventsProvider = AutoDisposeFutureProvider<List<TbtEvent>>.internal(
  events,
  name: r'eventsProvider',
  debugGetCreateSourceHash:
      const bool.fromEnvironment('dart.vm.product') ? null : _$eventsHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef EventsRef = AutoDisposeFutureProviderRef<List<TbtEvent>>;
String _$eventHash() => r'792a7bc69beb1cee629abc30f3b08fdff26d3ddd';

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

/// See also [event].
@ProviderFor(event)
const eventProvider = EventFamily();

/// See also [event].
class EventFamily extends Family<AsyncValue<TbtEvent>> {
  /// See also [event].
  const EventFamily();

  /// See also [event].
  EventProvider call(String id) {
    return EventProvider(id);
  }

  @override
  EventProvider getProviderOverride(covariant EventProvider provider) {
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
  String? get name => r'eventProvider';
}

/// See also [event].
class EventProvider extends AutoDisposeFutureProvider<TbtEvent> {
  /// See also [event].
  EventProvider(String id)
    : this._internal(
        (ref) => event(ref as EventRef, id),
        from: eventProvider,
        name: r'eventProvider',
        debugGetCreateSourceHash:
            const bool.fromEnvironment('dart.vm.product') ? null : _$eventHash,
        dependencies: EventFamily._dependencies,
        allTransitiveDependencies: EventFamily._allTransitiveDependencies,
        id: id,
      );

  EventProvider._internal(
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
  Override overrideWith(FutureOr<TbtEvent> Function(EventRef provider) create) {
    return ProviderOverride(
      origin: this,
      override: EventProvider._internal(
        (ref) => create(ref as EventRef),
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
  AutoDisposeFutureProviderElement<TbtEvent> createElement() {
    return _EventProviderElement(this);
  }

  @override
  bool operator ==(Object other) {
    return other is EventProvider && other.id == id;
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
mixin EventRef on AutoDisposeFutureProviderRef<TbtEvent> {
  /// The parameter `id` of this provider.
  String get id;
}

class _EventProviderElement extends AutoDisposeFutureProviderElement<TbtEvent>
    with EventRef {
  _EventProviderElement(super.provider);

  @override
  String get id => (origin as EventProvider).id;
}

// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
