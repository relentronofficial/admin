import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../core/utils/cache_storage.dart';
import '../../../shared/models/notification_item.dart';
import '../../../shared/providers/socket_provider.dart';
import '../../../shared/socket/socket_events.dart';
import '../data/notifications_service.dart';

part 'notifications_provider.g.dart';

// ── Unread count (keepAlive — shared with AppNavbar badge) ────────────────────

@Riverpod(keepAlive: true)
class UnreadNotifCountNotifier extends _$UnreadNotifCountNotifier {
  @override
  int build() {
    // Register socket handler before the initial fetch so no events are missed.
    // Broadcast notifications share the same handler — matches web behavior
    // where `notification:broadcast` and `notification` both bump the badge.
    final socket = ref.read(socketNotifierProvider.notifier);
    void handler(dynamic _) => increment();
    socket.on(kSocketNotification, handler);
    socket.on(kSocketNotificationBroadcast, handler);
    ref.onDispose(() {
      socket.off(kSocketNotification, handler);
      socket.off(kSocketNotificationBroadcast, handler);
    });

    _fetchInitial();
    return 0;
  }

  Future<void> _fetchInitial() async {
    try {
      final count =
          await ref.read(notificationsServiceProvider).getUnreadCount();
      state = count;
      await CacheStorage.writeUnreadNotifCount(count);
    } catch (_) {
      final cached = await CacheStorage.readUnreadNotifCount();
      if (cached > 0) state = cached;
    }
  }

  void increment() => state++;
  void decrement() => state = state > 0 ? state - 1 : 0;
  void reset() => state = 0;
}

// ── Paginated notification list ────────────────────────────────────────────────

@riverpod
class NotificationsNotifier extends _$NotificationsNotifier {
  static const _limit = 20;
  var _page = 1;
  var _hasMore = true;

  @override
  Future<List<NotificationItem>> build() async {
    // Prepend incoming notifications in real time while this screen is open.
    final socket = ref.read(socketNotifierProvider.notifier);
    void handler(dynamic data) {
      try {
        final map = (data as Map<dynamic, dynamic>).cast<String, dynamic>();
        final item = NotificationItem.fromJson(map);
        final prev = state.valueOrNull ?? [];
        state = AsyncData([item, ...prev]);
      } catch (_) {
        // Malformed payload — ignore.
      }
    }
    socket.on(kSocketNotification, handler);
    socket.on(kSocketNotificationBroadcast, handler);
    ref.onDispose(() {
      socket.off(kSocketNotification, handler);
      socket.off(kSocketNotificationBroadcast, handler);
    });

    _page = 1;
    _hasMore = true;
    final items = await ref
        .read(notificationsServiceProvider)
        .getNotifications(page: 1, limit: _limit);
    if (items.length < _limit) _hasMore = false;
    return items;
  }

  bool get hasMore => _hasMore;

  Future<void> fetchMore() async {
    if (!_hasMore) return;
    final prev = state.valueOrNull;
    if (prev == null) return;
    try {
      _page++;
      final next = await ref
          .read(notificationsServiceProvider)
          .getNotifications(page: _page, limit: _limit);
      if (next.length < _limit) _hasMore = false;
      state = AsyncData([...prev, ...next]);
    } catch (_) {
      _page--;
    }
  }

  Future<void> markRead(String id) async {
    await ref.read(notificationsServiceProvider).markRead(id);
    final updated = (state.valueOrNull ?? [])
        .map((n) => n.id == id ? n.copyWith(isRead: true) : n)
        .toList();
    state = AsyncData(updated);
    ref.read(unreadNotifCountNotifierProvider.notifier).decrement();
  }

  Future<void> markAllRead() async {
    await ref.read(notificationsServiceProvider).markAllRead();
    final updated = (state.valueOrNull ?? [])
        .map((n) => n.copyWith(isRead: true))
        .toList();
    state = AsyncData(updated);
    ref.read(unreadNotifCountNotifierProvider.notifier).reset();
  }

  Future<void> dismiss(String id) async {
    final prev = state.valueOrNull ?? [];
    final target = prev.firstWhere(
      (n) => n.id == id,
      orElse: () => prev.first,
    );
    // Optimistic remove — restore on failure.
    state = AsyncData(prev.where((n) => n.id != id).toList());
    try {
      await ref.read(notificationsServiceProvider).dismiss(id);
      if (!target.isRead) {
        ref.read(unreadNotifCountNotifierProvider.notifier).decrement();
      }
    } catch (_) {
      state = AsyncData(prev);
    }
  }

  Future<void> clearRead() async {
    final prev = state.valueOrNull ?? [];
    // Remove all read items locally, restore on failure.
    state = AsyncData(prev.where((n) => !n.isRead).toList());
    try {
      await ref.read(notificationsServiceProvider).clearRead();
    } catch (_) {
      state = AsyncData(prev);
    }
  }
}
