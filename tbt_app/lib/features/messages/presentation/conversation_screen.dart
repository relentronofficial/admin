import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/models/chat_message.dart';
import '../../../shared/providers/me_provider.dart';
import '../../../shared/theme/design_constants.dart';
import '../../../shared/theme/tbt_theme.dart';
import '../data/messages_service.dart';
import '../providers/messages_provider.dart';

class ConversationScreen extends ConsumerStatefulWidget {
  const ConversationScreen({super.key, required this.conversationId});

  final String conversationId;

  @override
  ConsumerState<ConversationScreen> createState() => _ConversationScreenState();
}

class _ConversationScreenState extends ConsumerState<ConversationScreen> {
  final _scrollCtrl = ScrollController();
  final _inputCtrl = TextEditingController();
  var _sending = false;
  var _loadingMore = false;

  @override
  void initState() {
    super.initState();
    _scrollCtrl.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollCtrl.removeListener(_onScroll);
    _scrollCtrl.dispose();
    _inputCtrl.dispose();
    super.dispose();
  }

  // Backwards pagination — when the user scrolls to the TOP of the message
  // list, ask the provider for the next page of older messages.
  Future<void> _onScroll() async {
    if (_loadingMore) return;
    if (!_scrollCtrl.hasClients) return;
    if (_scrollCtrl.position.pixels > 80) return;
    final notifier = ref.read(
        conversationMessagesProvider(widget.conversationId).notifier);
    if (!notifier.hasMore) return;
    setState(() => _loadingMore = true);
    // Remember scroll offset so it survives the list-length change.
    final prevMax = _scrollCtrl.position.maxScrollExtent;
    await notifier.fetchMore();
    if (mounted) setState(() => _loadingMore = false);
    // After older messages are prepended, keep the viewport anchored to the
    // same visible content (offset shifts by the newly-added height).
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scrollCtrl.hasClients) return;
      final newMax = _scrollCtrl.position.maxScrollExtent;
      final delta = newMax - prevMax;
      if (delta > 0) _scrollCtrl.jumpTo(_scrollCtrl.position.pixels + delta);
    });
  }

  void _scrollToBottom({bool animated = false}) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scrollCtrl.hasClients) return;
      final max = _scrollCtrl.position.maxScrollExtent;
      if (animated) {
        _scrollCtrl.animateTo(
          max,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      } else {
        _scrollCtrl.jumpTo(max);
      }
    });
  }

  Future<void> _send() async {
    final body = _inputCtrl.text.trim();
    if (body.isEmpty || _sending) return;

    final me = ref.read(meNotifierProvider).valueOrNull;
    final memberName = me?.name ?? 'You';

    final optimistic = ChatMessage(
      id: 'tmp_${DateTime.now().millisecondsSinceEpoch}',
      senderType: 'member',
      senderId: me?.id ?? '',
      senderName: memberName,
      senderAvatarUrl: null,
      body: body,
      createdAt: DateTime.now().toIso8601String(),
    );

    _inputCtrl.clear();
    setState(() => _sending = true);

    ref
        .read(conversationMessagesProvider(widget.conversationId).notifier)
        .appendSent(optimistic);
    _scrollToBottom(animated: true);

    try {
      await ref
          .read(messagesServiceProvider)
          .sendMessage(widget.conversationId, body);
    } catch (_) {
      // Optimistic message stays visible; a retry isn't critical for MVP.
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final accent = context.tbt.accent;
    final messagesAsync =
        ref.watch(conversationMessagesProvider(widget.conversationId));

    // Scroll to bottom on first load AND when a new message arrives.
    ref.listen(conversationMessagesProvider(widget.conversationId),
        (prev, next) {
      if (prev?.isLoading == true && next.hasValue) {
        _scrollToBottom();
        return;
      }
      final prevLen = prev?.valueOrNull?.length ?? 0;
      final nextLen = next.valueOrNull?.length ?? 0;
      if (nextLen > prevLen) _scrollToBottom(animated: true);
    });

    return Scaffold(
      appBar: AppBar(
        backgroundColor: kColorBgSurface,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new,
              color: kColorTextPrimary, size: 18),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: const Text(
          'CONVERSATION',
          style: TextStyle(
            fontFamily: 'Rajdhani',
            fontSize: 18,
            fontWeight: FontWeight.w700,
            letterSpacing: 2,
            color: kColorTextPrimary,
          ),
        ),
        actions: [
          PopupMenuButton<String>(
            tooltip: 'More',
            icon: const Icon(Icons.more_vert, color: kColorTextSecondary),
            color: kColorBgSurface,
            onSelected: (v) async {
              if (v == 'archive') {
                try {
                  await ref
                      .read(messagesServiceProvider)
                      .archiveConversation(widget.conversationId);
                  ref.invalidate(conversationsProvider);
                  if (context.mounted) Navigator.of(context).pop();
                } catch (_) {
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                          content: Text('Could not archive conversation')),
                    );
                  }
                }
              }
            },
            itemBuilder: (_) => const [
              PopupMenuItem(
                value: 'archive',
                child: Text(
                  'Archive',
                  style: TextStyle(color: kColorTextPrimary, fontSize: 13),
                ),
              ),
            ],
          ),
        ],
      ),
      body: Column(
        children: [
          // Message list
          Expanded(
            child: messagesAsync.when(
              loading: () => const Center(
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
              error: (e, _) => Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.error_outline,
                        color: kColorTextMuted, size: 36),
                    const SizedBox(height: 8),
                    const Text('Failed to load messages',
                        style: TextStyle(color: kColorTextSecondary)),
                    const SizedBox(height: 8),
                    TextButton(
                      onPressed: () => ref.invalidate(
                          conversationMessagesProvider(widget.conversationId)),
                      child: const Text('Retry'),
                    ),
                  ],
                ),
              ),
              data: (messages) {
                if (messages.isEmpty) {
                  return const Center(
                    child: Text(
                      'No messages yet.\nSay hello!',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: kColorTextMuted, fontSize: 14),
                    ),
                  );
                }
                final groups = _groupByDay(messages);
                return ListView.builder(
                  controller: _scrollCtrl,
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 16),
                  itemCount: _flatCount(groups),
                  itemBuilder: (context, index) =>
                      _buildItem(groups, index, accent),
                );
              },
            ),
          ),

          // Typing indicator — appears when the other party is typing.
          Consumer(
            builder: (_, r, __) {
              final typing = r.watch(
                conversationTypingNotifierProvider(widget.conversationId),
              );
              if (!typing) return const SizedBox.shrink();
              return Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 6),
                child: Row(
                  children: [
                    SizedBox(
                      width: 12,
                      height: 12,
                      child: CircularProgressIndicator(
                        strokeWidth: 1.5,
                        color: accent,
                      ),
                    ),
                    const SizedBox(width: 8),
                    const Text(
                      'TBT team is typing…',
                      style: TextStyle(
                        color: kColorTextMuted,
                        fontSize: 12,
                        fontStyle: FontStyle.italic,
                      ),
                    ),
                  ],
                ),
              );
            },
          ),

          // "Reply to reopen" hint — surfaces when the support team has
          // closed this conversation. Sending a reply reopens it server-side.
          Consumer(
            builder: (_, r, __) {
              final convos = r.watch(conversationsProvider).valueOrNull ?? [];
              final closed = convos.any((c) =>
                  c.id == widget.conversationId && c.status == 'closed');
              if (!closed) return const SizedBox.shrink();
              return Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(
                    horizontal: 16, vertical: 8),
                color: kColorBgInput,
                child: const Text(
                  'This conversation is closed — send a reply to reopen it.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: kColorTextMuted,
                    fontSize: 12,
                    fontStyle: FontStyle.italic,
                  ),
                ),
              );
            },
          ),

          // Input bar
          _InputBar(
            controller: _inputCtrl,
            accent: accent,
            sending: _sending,
            onSend: _send,
          ),
        ],
      ),
    );
  }

  // ── Day-grouped list helpers ───────────────────────────────────────────────

  List<({String label, List<ChatMessage> messages})> _groupByDay(
      List<ChatMessage> messages) {
    final groups = <({String label, List<ChatMessage> messages})>[];
    for (final m in messages) {
      final label = _dayLabel(m.createdAt);
      if (groups.isNotEmpty && groups.last.label == label) {
        groups.last.messages.add(m);
      } else {
        groups.add((label: label, messages: [m]));
      }
    }
    return groups;
  }

  String _dayLabel(String iso) {
    final dt = DateTime.tryParse(iso)?.toLocal();
    if (dt == null) return '';
    final now = DateTime.now();
    final diff = now.difference(dt).inDays;
    if (diff == 0) return 'Today';
    if (diff == 1) return 'Yesterday';
    final sameYear = now.year == dt.year;
    final months = [
      '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    return sameYear
        ? '${months[dt.month]} ${dt.day}'
        : '${months[dt.month]} ${dt.day}, ${dt.year}';
  }

  int _flatCount(List<({String label, List<ChatMessage> messages})> groups) =>
      groups.fold(0, (sum, g) => sum + 1 + g.messages.length);

  Widget _buildItem(
    List<({String label, List<ChatMessage> messages})> groups,
    int index,
    Color accent,
  ) {
    var cursor = 0;
    for (final g in groups) {
      if (index == cursor) return _DaySeparator(label: g.label);
      cursor++;
      for (final m in g.messages) {
        if (index == cursor) {
          return _MessageBubble(message: m, accent: accent);
        }
        cursor++;
      }
    }
    return const SizedBox.shrink();
  }
}

// ── Day separator ─────────────────────────────────────────────────────────────

class _DaySeparator extends StatelessWidget {
  const _DaySeparator({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: Row(
          children: [
            const Expanded(child: Divider(color: kColorBorderCard)),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Text(
                label,
                style: const TextStyle(
                  color: kColorTextMuted,
                  fontSize: 11,
                  fontFamily: 'Rajdhani',
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1,
                ),
              ),
            ),
            const Expanded(child: Divider(color: kColorBorderCard)),
          ],
        ),
      );
}

// ── Message bubble ─────────────────────────────────────────────────────────────

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({required this.message, required this.accent});

  final ChatMessage message;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    final isMine = message.senderType == 'member';
    final dt = DateTime.tryParse(message.createdAt)?.toLocal();
    final timeStr = dt != null
        ? '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}'
        : '';

    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        mainAxisAlignment:
            isMine ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          if (!isMine) ...[
            _Avatar(name: message.senderName, avatarUrl: message.senderAvatarUrl),
            const SizedBox(width: 8),
          ],
          Flexible(
            child: Column(
              crossAxisAlignment:
                  isMine ? CrossAxisAlignment.end : CrossAxisAlignment.start,
              children: [
                if (!isMine)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 2, left: 2),
                    child: Text(
                      message.senderName,
                      style: const TextStyle(
                        color: kColorTextMuted,
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                Container(
                  constraints: BoxConstraints(
                    maxWidth: MediaQuery.of(context).size.width * 0.72,
                  ),
                  padding: const EdgeInsets.symmetric(
                      horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(
                    color: isMine ? accent : kColorBgSurface,
                    borderRadius: BorderRadius.only(
                      topLeft: const Radius.circular(16),
                      topRight: const Radius.circular(16),
                      bottomLeft:
                          Radius.circular(isMine ? 16 : 4),
                      bottomRight:
                          Radius.circular(isMine ? 4 : 16),
                    ),
                    border: isMine
                        ? null
                        : Border.all(color: kColorBorderCard),
                  ),
                  child: Text(
                    message.body,
                    style: TextStyle(
                      color: isMine ? Colors.white : kColorTextPrimary,
                      fontSize: 14,
                      height: 1.4,
                    ),
                  ),
                ),
                if (timeStr.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 2, left: 2, right: 2),
                    child: Text(
                      timeStr,
                      style: const TextStyle(
                        color: kColorTextMuted,
                        fontSize: 10,
                      ),
                    ),
                  ),
              ],
            ),
          ),
          if (isMine) const SizedBox(width: 8),
        ],
      ),
    );
  }
}

// ── Avatar circle ─────────────────────────────────────────────────────────────

class _Avatar extends StatelessWidget {
  const _Avatar({required this.name, this.avatarUrl});
  final String name;
  final String? avatarUrl;

  @override
  Widget build(BuildContext context) {
    final initial = name.isNotEmpty ? name[0].toUpperCase() : '?';
    if (avatarUrl != null && avatarUrl!.isNotEmpty) {
      return CircleAvatar(
        radius: 14,
        backgroundImage: NetworkImage(avatarUrl!),
        onBackgroundImageError: (_, __) {},
        child: null,
      );
    }
    return CircleAvatar(
      radius: 14,
      backgroundColor: kColorBgInput,
      child: Text(
        initial,
        style: const TextStyle(
          color: kColorTextSecondary,
          fontSize: 12,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

// ── Input bar ─────────────────────────────────────────────────────────────────

class _InputBar extends StatelessWidget {
  const _InputBar({
    required this.controller,
    required this.accent,
    required this.sending,
    required this.onSend,
  });

  final TextEditingController controller;
  final Color accent;
  final bool sending;
  final VoidCallback onSend;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: kColorBgSurface,
      padding: EdgeInsets.fromLTRB(
        12,
        10,
        12,
        10 + MediaQuery.of(context).viewInsets.bottom,
      ),
      child: SafeArea(
        top: false,
        child: Row(
          children: [
            Expanded(
              child: TextField(
                controller: controller,
                style: const TextStyle(
                    color: kColorTextPrimary, fontSize: 14),
                maxLines: null,
                keyboardType: TextInputType.multiline,
                textCapitalization: TextCapitalization.sentences,
                decoration: InputDecoration(
                  hintText: 'Type a message…',
                  hintStyle:
                      const TextStyle(color: kColorTextMuted, fontSize: 14),
                  filled: true,
                  fillColor: kColorBgInput,
                  contentPadding: const EdgeInsets.symmetric(
                      horizontal: 14, vertical: 10),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(20),
                    borderSide: const BorderSide(color: kColorBorderCard),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(20),
                    borderSide: const BorderSide(color: kColorBorderCard),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(20),
                    borderSide: BorderSide(color: accent),
                  ),
                ),
                onSubmitted: (_) => onSend(),
              ),
            ),
            const SizedBox(width: 8),
            Semantics(
              label: 'Send message',
              button: true,
              child: GestureDetector(
                onTap: sending ? null : onSend,
                child: Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: sending ? kColorBgInput : accent,
                    shape: BoxShape.circle,
                  ),
                  child: sending
                      ? const Padding(
                          padding: EdgeInsets.all(12),
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Icon(Icons.send_rounded,
                          color: Colors.white, size: 18),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
