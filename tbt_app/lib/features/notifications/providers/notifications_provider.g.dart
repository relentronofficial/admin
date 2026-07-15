// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'notifications_provider.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$unreadNotifCountNotifierHash() =>
    r'20fb06597ce501d96fda037d2d9259453202239a';

/// See also [UnreadNotifCountNotifier].
@ProviderFor(UnreadNotifCountNotifier)
final unreadNotifCountNotifierProvider =
    NotifierProvider<UnreadNotifCountNotifier, int>.internal(
      UnreadNotifCountNotifier.new,
      name: r'unreadNotifCountNotifierProvider',
      debugGetCreateSourceHash:
          const bool.fromEnvironment('dart.vm.product')
              ? null
              : _$unreadNotifCountNotifierHash,
      dependencies: null,
      allTransitiveDependencies: null,
    );

typedef _$UnreadNotifCountNotifier = Notifier<int>;
String _$notificationsNotifierHash() =>
    r'47e0565e74f13c45a16b69fc3156bbad8ad777c2';

/// See also [NotificationsNotifier].
@ProviderFor(NotificationsNotifier)
final notificationsNotifierProvider = AutoDisposeAsyncNotifierProvider<
  NotificationsNotifier,
  List<NotificationItem>
>.internal(
  NotificationsNotifier.new,
  name: r'notificationsNotifierProvider',
  debugGetCreateSourceHash:
      const bool.fromEnvironment('dart.vm.product')
          ? null
          : _$notificationsNotifierHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

typedef _$NotificationsNotifier =
    AutoDisposeAsyncNotifier<List<NotificationItem>>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
