import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/providers/socket_provider.dart';
import '../data/chat_groups_service.dart';
import '../domain/chat_group_models.dart';

// ── My groups list ──────────────────────────────────────────────────────────

final myChatGroupsProvider =
    FutureProvider.autoDispose<List<ChatGroup>>((ref) async {
  ref.keepAlive();
  return ref.watch(chatGroupsServiceProvider).listMine();
});

// ── Group detail ────────────────────────────────────────────────────────────

final chatGroupDetailProvider = FutureProvider.autoDispose
    .family<ChatGroupDetail, String>((ref, id) async {
  ref.keepAlive();
  return ref.watch(chatGroupsServiceProvider).getGroup(id);
});

// ── Messages notifier — cursor-paginated + socket-live ─────────────────────

class ChatGroupMessagesState {
  const ChatGroupMessagesState({
    required this.messages,
    required this.hasMore,
    required this.loadingMore,
  });
  final List<ChatGroupMessage> messages;
  final bool hasMore;
  final bool loadingMore;

  static const empty = ChatGroupMessagesState(
    messages: [],
    hasMore: true,
    loadingMore: false,
  );

  ChatGroupMessagesState copyWith({
    List<ChatGroupMessage>? messages,
    bool? hasMore,
    bool? loadingMore,
  }) {
    return ChatGroupMessagesState(
      messages: messages ?? this.messages,
      hasMore: hasMore ?? this.hasMore,
      loadingMore: loadingMore ?? this.loadingMore,
    );
  }
}

class ChatGroupMessagesNotifier
    extends AutoDisposeFamilyAsyncNotifier<ChatGroupMessagesState, String> {
  static const _limit = 50;

  @override
  Future<ChatGroupMessagesState> build(String groupId) async {
    final socket = ref.read(socketNotifierProvider.notifier);

    // Join the group's Socket.IO room while this notifier is alive.
    socket.emit('join:chat_group', {'groupId': groupId});
    ref.onDispose(() {
      socket.emit('leave:chat_group', {'groupId': groupId});
    });

    void onNew(dynamic raw) {
      try {
        final map = (raw as Map<dynamic, dynamic>).cast<String, dynamic>();
        if (map['groupId'] != groupId) return;
        final msg = ChatGroupMessage.fromJson(map);
        final cur = state.valueOrNull ?? ChatGroupMessagesState.empty;
        if (cur.messages.any((m) => m.id == msg.id)) return;
        state = AsyncData(cur.copyWith(messages: [...cur.messages, msg]));
      } catch (_) {}
    }

    void onEdited(dynamic raw) {
      try {
        final map = (raw as Map<dynamic, dynamic>).cast<String, dynamic>();
        if (map['groupId'] != groupId) return;
        final msg = ChatGroupMessage.fromJson(map);
        final cur = state.valueOrNull;
        if (cur == null) return;
        state = AsyncData(cur.copyWith(
          messages: cur.messages.map((m) => m.id == msg.id ? msg : m).toList(),
        ));
      } catch (_) {}
    }

    void onDeleted(dynamic raw) {
      try {
        final map = (raw as Map<dynamic, dynamic>).cast<String, dynamic>();
        final id = map['messageId'] as String?;
        final forEveryone = (map['forEveryone'] as bool?) ?? false;
        if (id == null) return;
        final cur = state.valueOrNull;
        if (cur == null) return;
        state = AsyncData(cur.copyWith(
          messages: cur.messages
              .map((m) => m.id == id
                  ? m.copyWith(
                      deletedAt: DateTime.now(),
                      deletedForEveryone: forEveryone,
                      body: forEveryone ? null : m.body,
                    )
                  : m)
              .toList(),
        ));
      } catch (_) {}
    }

    void onReaction(dynamic raw) {
      try {
        final map = (raw as Map<dynamic, dynamic>).cast<String, dynamic>();
        final messageId = map['messageId'] as String?;
        final memberId = map['memberId'] as String?;
        final emoji = map['emoji'] as String?;
        final added = (map['added'] as bool?) ?? false;
        if (messageId == null || memberId == null || emoji == null) return;
        final cur = state.valueOrNull;
        if (cur == null) return;
        state = AsyncData(cur.copyWith(
          messages: cur.messages.map((m) {
            if (m.id != messageId) return m;
            final next = added
                ? [...m.reactions, ChatGroupReaction(emoji: emoji, memberId: memberId)]
                : m.reactions
                    .where((r) => !(r.emoji == emoji && r.memberId == memberId))
                    .toList();
            return m.copyWith(reactions: next);
          }).toList(),
        ));
      } catch (_) {}
    }

    void onRead(dynamic raw) {
      try {
        final map = (raw as Map<dynamic, dynamic>).cast<String, dynamic>();
        final memberId = map['memberId'] as String?;
        final ids = (map['messageIds'] as List<dynamic>?)?.whereType<String>().toList() ?? const [];
        if (memberId == null || ids.isEmpty) return;
        final idSet = ids.toSet();
        final cur = state.valueOrNull;
        if (cur == null) return;
        state = AsyncData(cur.copyWith(
          messages: cur.messages.map((m) {
            if (!idSet.contains(m.id)) return m;
            if (m.readByMemberIds.contains(memberId)) return m;
            return m.copyWith(
              readByMemberIds: [...m.readByMemberIds, memberId],
              readByCount: m.readByCount + 1,
            );
          }).toList(),
        ));
      } catch (_) {}
    }

    void onPinned(dynamic raw) {
      try {
        final map = (raw as Map<dynamic, dynamic>).cast<String, dynamic>();
        if (map['groupId'] != groupId) return;
        final messageId = map['messageId'] as String?;
        final pinned = (map['pinned'] as bool?) ?? true;
        if (messageId == null) return;
        // Refresh the pinned strip.
        ref.invalidate(chatGroupPinnedProvider(groupId));
        // Also mark the message inline so the bubble shows the pin icon.
        final cur = state.valueOrNull;
        if (cur == null) return;
        state = AsyncData(cur.copyWith(
          messages: cur.messages
              .map((m) => m.id == messageId
                  ? m.copyWith(
                      pinnedAt: pinned ? DateTime.now() : null,
                      clearPinnedAt: !pinned,
                    )
                  : m)
              .toList(),
        ));
      } catch (_) {}
    }

    socket.on('group:message:new', onNew);
    socket.on('group:message:edited', onEdited);
    socket.on('group:message:deleted', onDeleted);
    socket.on('group:reaction', onReaction);
    socket.on('group:read', onRead);
    socket.on('group:pinned', onPinned);
    ref.onDispose(() {
      socket.off('group:message:new', onNew);
      socket.off('group:message:edited', onEdited);
      socket.off('group:message:deleted', onDeleted);
      socket.off('group:reaction', onReaction);
      socket.off('group:read', onRead);
      socket.off('group:pinned', onPinned);
    });

    final first = await ref
        .read(chatGroupsServiceProvider)
        .listMessages(groupId, limit: _limit);
    return ChatGroupMessagesState(
      messages: first,
      hasMore: first.length >= _limit,
      loadingMore: false,
    );
  }

  Future<void> loadMore() async {
    final cur = state.valueOrNull;
    if (cur == null || !cur.hasMore || cur.loadingMore || cur.messages.isEmpty) return;
    state = AsyncData(cur.copyWith(loadingMore: true));
    try {
      final oldest = cur.messages.first;
      final older = await ref.read(chatGroupsServiceProvider).listMessages(
            arg,
            before: oldest.createdAt.toIso8601String(),
            limit: _limit,
          );
      final ids = cur.messages.map((m) => m.id).toSet();
      final merged = [
        ...older.where((m) => !ids.contains(m.id)),
        ...cur.messages,
      ];
      state = AsyncData(cur.copyWith(
        messages: merged,
        hasMore: older.length >= _limit,
        loadingMore: false,
      ));
    } catch (_) {
      state = AsyncData(cur.copyWith(loadingMore: false));
    }
  }

  void addOptimistic(ChatGroupMessage msg) {
    final cur = state.valueOrNull ?? ChatGroupMessagesState.empty;
    if (cur.messages.any((m) => m.id == msg.id)) return;
    state = AsyncData(cur.copyWith(messages: [...cur.messages, msg]));
  }
}

final chatGroupMessagesNotifierProvider =
    AutoDisposeAsyncNotifierProviderFamily<ChatGroupMessagesNotifier,
        ChatGroupMessagesState, String>(ChatGroupMessagesNotifier.new);

// ── Presence for a group (memberId → online?) ──────────────────────────────

class ChatGroupPresenceNotifier
    extends AutoDisposeFamilyAsyncNotifier<Map<String, bool>, String> {
  @override
  Future<Map<String, bool>> build(String groupId) async {
    final socket = ref.read(socketNotifierProvider.notifier);
    void onUpdate(dynamic raw) {
      try {
        final map = (raw as Map<dynamic, dynamic>).cast<String, dynamic>();
        final memberId = map['memberId'] as String?;
        final online = (map['online'] as bool?) ?? false;
        if (memberId == null) return;
        final cur = state.valueOrNull ?? const {};
        state = AsyncData({...cur, memberId: online});
      } catch (_) {}
    }

    socket.on('presence:update', onUpdate);
    ref.onDispose(() => socket.off('presence:update', onUpdate));

    final list = await ref.read(chatGroupsServiceProvider).getPresence(groupId);
    return {for (final p in list) p.memberId: p.online};
  }
}

final chatGroupPresenceProvider = AutoDisposeAsyncNotifierProviderFamily<
    ChatGroupPresenceNotifier, Map<String, bool>, String>(
  ChatGroupPresenceNotifier.new,
);

// ── Pinned messages for a single group ─────────────────────────────────────

final chatGroupPinnedProvider = FutureProvider.autoDispose
    .family<List<ChatGroupMessage>, String>((ref, groupId) async {
  ref.keepAlive();
  return ref.read(chatGroupsServiceProvider).listPinned(groupId);
});

// ── Starred messages (global — across all groups) ──────────────────────────

final starredMessagesProvider =
    FutureProvider.autoDispose<List<StarredMessage>>((ref) async {
  ref.keepAlive();
  return ref.read(chatGroupsServiceProvider).listStarred();
});

/// Locally-tracked set of starred message ids for the group currently
/// on-screen. Seeded from the global `/starred` fetch, mutated
/// optimistically on Star/Unstar taps.
class GroupStarredIdsNotifier
    extends AutoDisposeFamilyAsyncNotifier<Set<String>, String> {
  @override
  Future<Set<String>> build(String groupId) async {
    ref.keepAlive();
    final all = await ref.read(chatGroupsServiceProvider).listStarred();
    return all
        .where((s) => s.message.groupId == groupId)
        .map((s) => s.message.id)
        .toSet();
  }

  Future<void> toggle(String messageId, {required bool star}) async {
    final cur = state.valueOrNull ?? const <String>{};
    final next = {...cur};
    if (star) {
      next.add(messageId);
    } else {
      next.remove(messageId);
    }
    state = AsyncData(next);
    try {
      if (star) {
        await ref.read(chatGroupsServiceProvider).starMessage(arg, messageId);
      } else {
        await ref.read(chatGroupsServiceProvider).unstarMessage(arg, messageId);
      }
      // Invalidate global list so the "Starred messages" screen refreshes.
      ref.invalidate(starredMessagesProvider);
    } catch (_) {
      // Revert on failure.
      state = AsyncData(cur);
      rethrow;
    }
  }
}

final groupStarredIdsProvider = AutoDisposeAsyncNotifierProviderFamily<
    GroupStarredIdsNotifier, Set<String>, String>(
  GroupStarredIdsNotifier.new,
);

// ── Per-group mute state ────────────────────────────────────────────────────
//
// Locally stored (SharedPreferences would be nicer but the mute state is
// server-authoritative — the client only tracks "am I currently muted?"
// for UI display and reflects it in the messages list. If the app is
// reinstalled the server still respects the mute; the badge just
// disappears until a manual toggle.

class GroupMuteState {
  const GroupMuteState({required this.until});
  final DateTime? until; // null = not muted, DateTime = muted until…
  bool get isMuted =>
      until != null && until!.isAfter(DateTime.now());
}

class GroupMuteNotifier
    extends AutoDisposeFamilyNotifier<GroupMuteState, String> {
  @override
  GroupMuteState build(String groupId) => const GroupMuteState(until: null);

  Future<void> setMuted(DateTime? until) async {
    final prev = state;
    state = GroupMuteState(until: until);
    try {
      await ref.read(chatGroupsServiceProvider).muteGroup(arg, until: until);
    } catch (_) {
      state = prev;
      rethrow;
    }
  }
}

final groupMuteProvider = AutoDisposeNotifierProviderFamily<GroupMuteNotifier,
    GroupMuteState, String>(GroupMuteNotifier.new);
