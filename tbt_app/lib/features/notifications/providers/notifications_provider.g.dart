// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'notifications_provider.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$unreadNotifCountNotifierHash() =>
    r'ea5ed02cbdcb99133f5bbf7e10230a3af15c70ad';

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
    r'087916570ccd8966a3281c1b6175c81e57866c5a';

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
