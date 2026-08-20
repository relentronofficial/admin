import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../core/utils/cache_storage.dart';
import '../../../shared/models/chat_message.dart';
import '../../../shared/models/conversation.dart';
import '../../../shared/providers/socket_provider.dart';
import '../../../shared/socket/socket_events.dart';
import '../data/messages_service.dart';

part 'messages_provider.g.dart';

// ── Unread count (keepAlive — shared with AppNavbar badge) ────────────────────

@Riverpod(keepAlive: true)
class UnreadMessageCountNotifier extends _$UnreadMessageCountNotifier {
  @override
  int build() {
    final socket = ref.read(socketNotifierProvider.notifier);

    void onNewMessage(dynamic _) => increment();
    void onConvChange(dynamic _) => ref.invalidate(conversationsProvider);

    socket.on(kSocketMessageNew, onNewMessage);
    socket.on(kSocketChatConversationClosed, onConvChange);
    socket.on(kSocketChatConversationReopened, onConvChange);

    ref.onDispose(() {
      socket.off(kSocketMessageNew, onNewMessage);
      socket.off(kSocketChatConversationClosed, onConvChange);
      socket.off(kSocketChatConversationReopened, onConvChange);
    });

    _fetchInitial();
    return 0;
  }

  Future<void> _fetchInitial() async {
    try {
      final count = await ref.read(messagesServiceProvider).getUnreadCount();
      state = count;
      await CacheStorage.writeUnreadMessageCount(count);
    } catch (_) {
      final cached = await CacheStorage.readUnreadMessageCount();
      if (cached > 0) state = cached;
    }
  }

  void increment() => state++;
  void decrement() => state = state > 0 ? state - 1 : 0;
  void reset() => state = 0;
}

// ── Conversation list ─────────────────────────────────────────────────────────

@riverpod
Future<List<Conversation>> conversations(Ref ref) =>
    ref.read(messagesServiceProvider).getConversations();

// ── Paginated messages for a single conversation ──────────────────────────────

@riverpod
class ConversationMessages extends _$ConversationMessages {
  static const _limit = 50;
  var _page = 1;
  var _hasMore = true;

  @override
  Future<List<ChatMessage>> build(String conversationId) async {
    // Join the conversation's Socket.IO room while the screen is open.
    // Backend broadcasts `chat:message` on that room whenever anyone
    // (member or admin) sends into this thread.
    final socket = ref.read(socketNotifierProvider.notifier);
    socket.emit('join:conversation', {'conversationId': conversationId});

    void handler(dynamic data) {
      try {
        final map = (data as Map<dynamic, dynamic>).cast<String, dynamic>();
        if (map['conversationId'] != conversationId) return;
        final msg = ChatMessage.fromJson(map);
        final prev = state.valueOrNull ?? [];
        if (prev.any((m) => m.id == msg.id)) return; // dedupe echo
        state = AsyncData([...prev, msg]);
      } catch (_) {
        // Malformed payload — ignore.
      }
    }
    socket.on(kSocketChatMessage, handler);
    ref.onDispose(() {
      socket.off(kSocketChatMessage, handler);
      socket.emit('leave:conversation', {'conversationId': conversationId});
    });

    _page = 1;
    _hasMore = true;
    final items = await ref
        .read(messagesServiceProvider)
        .getMessages(conversationId, page: 1, limit: _limit);
    if (items.length < _limit) _hasMore = false;
    return items;
  }

  bool get hasMore => _hasMore;

  /// Loads OLDER messages (backwards pagination — user scrolled to top).
  /// Backend page 2 returns the next-older batch; we prepend so ordering is
  /// preserved (oldest first, newest at the bottom of the list).
  Future<void> fetchMore() async {
    if (!_hasMore) return;
    final prev = state.valueOrNull;
    if (prev == null) return;
    try {
      _page++;
      final next = await ref
          .read(messagesServiceProvider)
          .getMessages(conversationId, page: _page, limit: _limit);
      if (next.length < _limit) _hasMore = false;
      // Older messages come from the backend's next page — prepend to the
      // list so the current viewport (scrolled to top) sees them appear
      // above the messages that are already visible.
      state = AsyncData([...next, ...prev]);
    } catch (_) {
      _page--;
    }
  }

  void appendSent(ChatMessage message) {
    final prev = state.valueOrNull ?? [];
    state = AsyncData([...prev, message]);
  }
}

// ── Typing indicator for a single conversation ────────────────────────────────

@riverpod
class ConversationTypingNotifier extends _$ConversationTypingNotifier {
  Timer? _clearTimer;

  @override
  bool build(String conversationId) {
    final socket = ref.read(socketNotifierProvider.notifier);
    void handler(dynamic data) {
      try {
        final map = (data as Map<dynamic, dynamic>).cast<String, dynamic>();
        if (map['conversationId'] != conversationId) return;
        state = true;
        _clearTimer?.cancel();
        _clearTimer =
            Timer(const Duration(milliseconds: 500), () => state = false);
      } catch (_) {
        // Malformed payload — ignore.
      }
    }
    socket.on(kSocketChatTyping, handler);
    ref.onDispose(() {
      _clearTimer?.cancel();
      socket.off(kSocketChatTyping, handler);
    });
    return false;
  }
}
