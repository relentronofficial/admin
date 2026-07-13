// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'socket_provider.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$socketNotifierHash() => r'165d9b85f9a66ceb0c6bffe462947c4241376c99';

/// Manages the Socket.IO connection lifecycle tied to the user's auth state.
///
/// State (`bool`) reflects whether the socket is currently connected.
/// The underlying [SocketClient] is accessible via `.notifier.client` for
/// CC-49 event wiring (e.g. room joins, per-provider `on`/`off` calls).
///
/// Copied from [SocketNotifier].
@ProviderFor(SocketNotifier)
final socketNotifierProvider = NotifierProvider<SocketNotifier, bool>.internal(
  SocketNotifier.new,
  name: r'socketNotifierProvider',
  debugGetCreateSourceHash:
      const bool.fromEnvironment('dart.vm.product')
          ? null
          : _$socketNotifierHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

typedef _$SocketNotifier = Notifier<bool>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
