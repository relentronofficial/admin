import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/routes.dart';
import '../../../features/chat_groups/domain/chat_group_models.dart';
import '../../../features/chat_groups/providers/chat_group_providers.dart';
import '../../../shared/models/conversation.dart';
import '../../../shared/providers/me_provider.dart';
import '../../../shared/theme/design_constants.dart';
import '../../../shared/theme/tbt_theme.dart';
import '../data/messages_service.dart';
import '../providers/messages_provider.dart';

import '../../../shared/theme/theme_tokens.dart';
// ── Relative time (shared with notifications) ─────────────────────────────────

String _timeAgo(String? iso) {
  if (iso == null) return '';
  final dt = DateTime.tryParse(iso);
  if (dt == null) return '';
  final diff = DateTime.now().difference(dt);
  if (diff.inSeconds < 60) return 'now';
  if (diff.inMinutes < 60) return '${diff.inMinutes}m';
  if (diff.inHours < 24) return '${diff.inHours}h';
  if (diff.inDays < 7) return '${diff.inDays}d';
  return '${(diff.inDays / 7).floor()}w';
}

// ── Screen ────────────────────────────────────────────────────────────────────

class MessagesScreen extends ConsumerWidget {
  const MessagesScreen({super.key});

  Future<void> _openNewConversation(
      BuildContext context, WidgetRef ref, Color accent) async {
    final result = await showModalBottomSheet<({String subject, String body})?>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _NewConversationSheet(accent: accent),
    );
    if (result == null || !context.mounted) return;
    try {
      final id = await ref
          .read(messagesServiceProvider)
          .startConversation(subject: result.subject, body: result.body);
      ref.invalidate(conversationsProvider);
      if (!context.mounted) return;
      if (id.isNotEmpty) {
        context.push(AppRoutes.conversationPath(id));
      }
    } catch (_) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not start conversation')),
      );
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final accent = context.tbt.accent;
    final convoAsync = ref.watch(conversationsProvider);

    return Scaffold(
      floatingActionButton: FloatingActionButton(
        onPressed: () => _openNewConversation(context, ref, accent),
        backgroundColor: accent,
        tooltip: 'New conversation',
        child: const Icon(Icons.edit, color: Colors.white),
      ),
      appBar: AppBar(
        backgroundColor: context.tokens.bgSurface,
        elevation: 0,
        scrolledUnderElevation: 0,
        automaticallyImplyLeading: false,
        title: Text(
          'MESSAGES',
          style: TextStyle(
            fontFamily: 'Rajdhani',
            fontSize: 18,
            fontWeight: FontWeight.w700,
            letterSpacing: 2,
            color: context.tokens.textPrimary,
          ),
        ),
        actions: [
          PopupMenuButton<String>(
            tooltip: 'More',
            icon: Icon(Icons.more_vert, color: context.tokens.textSecondary),
            color: context.tokens.bgSurface,
            onSelected: (v) {
              if (v == 'starred') {
                context.push(AppRoutes.starredMessages);
              }
            },
            itemBuilder: (_) => [
              PopupMenuItem(
                value: 'starred',
                child: Row(
                  children: [
                    const Icon(Icons.star_outline_rounded, size: 18),
                    const SizedBox(width: 10),
                    Text(
                      'Starred messages',
                      style: TextStyle(
                          color: context.tokens.textPrimary, fontSize: 13),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
      body: convoAsync.when(
        loading: () => _buildSkeleton(context),
        error: (e, _) => _buildError(context, () => ref.invalidate(conversationsProvider)),
        data: (conversations) {
          if (conversations.isEmpty) return _buildEmpty(context);
          return RefreshIndicator(
            color: accent,
            backgroundColor: context.tokens.bgSurface,
            onRefresh: () async {
              ref.invalidate(conversationsProvider);
              ref.invalidate(myChatGroupsProvider);
              await ref
                  .read(conversationsProvider.future)
                  .catchError((_) => <Conversation>[]);
            },
            child: CustomScrollView(
              slivers: [
                const SliverToBoxAdapter(child: _GroupChatsSection()),
                SliverList.separated(
                  itemCount: conversations.length,
                  separatorBuilder: (_, __) =>
                      Divider(height: 1, color: context.tokens.borderCard, indent: 68),
                  itemBuilder: (context, i) {
                    final c = conversations[i];
                return Dismissible(
                  key: ValueKey('conv-${c.id}'),
                  direction: DismissDirection.endToStart,
                  background: Container(
                    alignment: Alignment.centerRight,
                    color: context.tokens.borderCard,
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    child: Icon(Icons.archive_outlined,
                        color: context.tokens.textSecondary),
                  ),
                  confirmDismiss: (_) async {
                    try {
                      await ref
                          .read(messagesServiceProvider)
                          .archiveConversation(c.id);
                      return true;
                    } catch (_) {
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                              content: Text('Could not archive')),
                        );
                      }
                      return false;
                    }
                  },
                  onDismissed: (_) {
                    ref.invalidate(conversationsProvider);
                  },
                  child: _ConversationTile(
                    conversation: c,
                    accent: accent,
                    onTap: () =>
                        context.push(AppRoutes.conversationPath(c.id)),
                  ),
                );
              },
            ),
              ],
            ),
          );
        },
      ),
    );
  }
}

// ── Conversation tile ─────────────────────────────────────────────────────────

class _ConversationTile extends StatelessWidget {
  const _ConversationTile({
    required this.conversation,
    required this.accent,
    required this.onTap,
  });

  final Conversation conversation;
  final Color accent;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = conversation;
    final hasUnread = c.memberUnreadCount > 0;
    final initial = c.subject.isNotEmpty ? c.subject[0].toUpperCase() : '?';
    final rawPreview = c.lastMessage?.body ?? '';
    // WhatsApp-style "You: …" prefix when the member sent the last message.
    final youSent = c.lastMessage?.senderType == 'member';
    final preview = youSent && rawPreview.isNotEmpty
        ? 'You: $rawPreview'
        : rawPreview;
    final isClosed = c.status == 'closed';

    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            // Avatar
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: accent.withAlpha(40),
                shape: BoxShape.circle,
              ),
              child: Center(
                child: Text(
                  initial,
                  style: TextStyle(
                    color: accent,
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 12),

            // Content
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          c.subject,
                          style: TextStyle(
                            color: context.tokens.textPrimary,
                            fontSize: 14,
                            fontWeight:
                                hasUnread ? FontWeight.w700 : FontWeight.w500,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      if (c.lastMessageAt != null) ...[
                        const SizedBox(width: 8),
                        Text(
                          _timeAgo(c.lastMessageAt),
                          style: TextStyle(
                            color: hasUnread ? accent : context.tokens.textMuted,
                            fontSize: 11,
                            fontWeight: hasUnread
                                ? FontWeight.w600
                                : FontWeight.normal,
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 3),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          preview,
                          style: TextStyle(
                            color: hasUnread
                                ? context.tokens.textSecondary
                                : context.tokens.textMuted,
                            fontSize: 13,
                            fontWeight: hasUnread
                                ? FontWeight.w500
                                : FontWeight.normal,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: 8),
                      if (isClosed)
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 6, vertical: 1),
                          decoration: BoxDecoration(
                            color: context.tokens.bgInput,
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            'CLOSED',
                            style: TextStyle(
                              color: context.tokens.textMuted,
                              fontSize: 9,
                              fontWeight: FontWeight.w700,
                              fontFamily: 'Rajdhani',
                              letterSpacing: 1,
                            ),
                          ),
                        )
                      else if (hasUnread)
                        Container(
                          constraints: const BoxConstraints(
                              minWidth: 18, minHeight: 18),
                          padding:
                              const EdgeInsets.symmetric(horizontal: 5),
                          decoration: BoxDecoration(
                            color: accent,
                            borderRadius: BorderRadius.circular(9),
                          ),
                          child: Text(
                            c.memberUnreadCount > 99
                                ? '99+'
                                : '${c.memberUnreadCount}',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              height: 1.8,
                            ),
                            textAlign: TextAlign.center,
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

Widget _buildSkeleton(BuildContext context) => ListView.separated(
      padding: const EdgeInsets.symmetric(vertical: 8),
      itemCount: 5,
      separatorBuilder: (_, __) =>
          Divider(height: 1, color: context.tokens.borderCard, indent: 68),
      itemBuilder: (_, __) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: context.tokens.bgInput,
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(height: 13, width: 140, color: context.tokens.bgInput),
                  const SizedBox(height: 6),
                  Container(height: 11, width: 220, color: context.tokens.bgInput),
                ],
              ),
            ),
          ],
        ),
      ),
    );

// ── Error / empty ─────────────────────────────────────────────────────────────

Widget _buildError(BuildContext context, VoidCallback onRetry) => Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.error_outline, color: context.tokens.textMuted, size: 40),
          const SizedBox(height: 12),
          Text('Failed to load messages',
              style: TextStyle(color: context.tokens.textSecondary)),
          const SizedBox(height: 12),
          TextButton(onPressed: onRetry, child: const Text('Retry')),
        ],
      ),
    );

Widget _buildEmpty(BuildContext context) => Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.mail_outline, color: context.tokens.textMuted, size: 48),
          SizedBox(height: 12),
          Text(
            'No messages yet',
            style: TextStyle(
              color: context.tokens.textSecondary,
              fontSize: 15,
              fontWeight: FontWeight.w500,
            ),
          ),
          SizedBox(height: 6),
          Text(
            'Your conversations will appear here',
            style: TextStyle(color: context.tokens.textMuted, fontSize: 13),
          ),
        ],
      ),
    );

// ── New conversation sheet ────────────────────────────────────────────────────

class _NewConversationSheet extends StatefulWidget {
  const _NewConversationSheet({required this.accent});
  final Color accent;

  @override
  State<_NewConversationSheet> createState() => _NewConversationSheetState();
}

class _NewConversationSheetState extends State<_NewConversationSheet> {
  final _subjectCtrl = TextEditingController();
  final _bodyCtrl = TextEditingController();
  bool _submitting = false;

  @override
  void dispose() {
    _subjectCtrl.dispose();
    _bodyCtrl.dispose();
    super.dispose();
  }

  void _submit() {
    final subject = _subjectCtrl.text.trim();
    final body = _bodyCtrl.text.trim();
    if (subject.isEmpty || body.isEmpty) return;
    setState(() => _submitting = true);
    Navigator.of(context).pop((subject: subject, body: body));
  }

  @override
  Widget build(BuildContext context) {
    final inset = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.only(bottom: inset),
      child: Container(
        decoration: BoxDecoration(
          color: context.tokens.bgSurface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
          border: Border(top: BorderSide(color: context.tokens.borderCard)),
        ),
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(bottom: 12),
                decoration: BoxDecoration(
                  color: context.tokens.textMuted.withValues(alpha: 0.5),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            Text(
              'NEW CONVERSATION',
              style: TextStyle(
                fontFamily: 'Rajdhani',
                fontSize: 13,
                fontWeight: FontWeight.w700,
                letterSpacing: 1.8,
                color: context.tokens.textPrimary,
              ),
            ),
            const SizedBox(height: 14),
            TextField(
              controller: _subjectCtrl,
              autofocus: true,
              style: TextStyle(color: context.tokens.textPrimary, fontSize: 14),
              decoration: InputDecoration(
                filled: true,
                fillColor: context.tokens.bgInput,
                hintText: 'Subject',
                hintStyle: TextStyle(color: context.tokens.textMuted),
                border: OutlineInputBorder(
                  borderSide: BorderSide(color: context.tokens.borderCard),
                  borderRadius: BorderRadius.circular(8),
                ),
                enabledBorder: OutlineInputBorder(
                  borderSide: BorderSide(color: context.tokens.borderCard),
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _bodyCtrl,
              maxLines: 5,
              style: TextStyle(color: context.tokens.textPrimary, fontSize: 14),
              decoration: InputDecoration(
                filled: true,
                fillColor: context.tokens.bgInput,
                hintText: 'What can we help with?',
                hintStyle: TextStyle(color: context.tokens.textMuted),
                border: OutlineInputBorder(
                  borderSide: BorderSide(color: context.tokens.borderCard),
                  borderRadius: BorderRadius.circular(8),
                ),
                enabledBorder: OutlineInputBorder(
                  borderSide: BorderSide(color: context.tokens.borderCard),
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.of(context).pop(),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: context.tokens.textSecondary,
                      side: BorderSide(color: context.tokens.borderCard),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                    child: const Text('Cancel'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: ElevatedButton(
                    onPressed: _submitting ? null : _submit,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: widget.accent,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                    child: const Text('Send'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// ── Group chats section (WhatsApp-inspired) ─────────────────────────────────

class _GroupChatsSection extends ConsumerWidget {
  const _GroupChatsSection();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(myChatGroupsProvider);
    final tokens = context.tokens;
    return async.when(
      loading: () => const SizedBox.shrink(),
      error: (_, __) => const SizedBox.shrink(),
      data: (groups) {
        if (groups.isEmpty) return const SizedBox.shrink();
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
              child: Text(
                'GROUP CHATS',
                style: TextStyle(
                  fontFamily: 'Rajdhani',
                  color: tokens.textMuted,
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.2,
                ),
              ),
            ),
            ...groups.map((g) => _GroupChatTile(group: g)),
            Divider(height: 12, color: tokens.borderCard),
          ],
        );
      },
    );
  }
}

class _GroupChatTile extends ConsumerWidget {
  const _GroupChatTile({required this.group});
  final ChatGroup group;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = context.tokens;
    final me = ref.watch(meNotifierProvider).valueOrNull;
    final muteState = ref.watch(groupMuteProvider(group.id));
    // Prefix "You: " if the last-message sender name matches the current
    // member's name (ChatGroupLastMessage doesn't expose sender id).
    String preview;
    if (group.lastMessage == null) {
      preview = 'No messages yet';
    } else {
      final lm = group.lastMessage!;
      final youSent = me != null &&
          lm.senderName != null &&
          lm.senderName!.trim().toLowerCase() == me.name.trim().toLowerCase();
      if (youSent) {
        preview = 'You: ${lm.body}';
      } else if (lm.senderName != null) {
        preview = '${lm.senderName}: ${lm.body}';
      } else {
        preview = lm.body;
      }
    }
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => context.push(AppRoutes.chatGroupPath(group.id)),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: Row(
            children: [
              _GroupThumb(url: group.avatarUrl, name: group.name),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            group.name,
                            style: TextStyle(
                              color: tokens.textPrimary,
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        if (muteState.isMuted) ...[
                          const SizedBox(width: 6),
                          Icon(
                            Icons.notifications_off_outlined,
                            size: 12,
                            color: tokens.textMuted,
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      preview,
                      style: TextStyle(color: tokens.textMuted, fontSize: 12),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              if (group.unreadCount > 0)
                Container(
                  margin: const EdgeInsets.only(left: 8),
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: const BoxDecoration(
                    color: kColorAccent,
                    shape: BoxShape.circle,
                  ),
                  constraints: const BoxConstraints(minWidth: 20, minHeight: 20),
                  alignment: Alignment.center,
                  child: Text(
                    group.unreadCount > 99 ? '99+' : '${group.unreadCount}',
                    style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w700),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _GroupThumb extends StatelessWidget {
  const _GroupThumb({required this.url, required this.name});
  final String? url;
  final String name;
  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    if (url != null && url!.isNotEmpty) {
      return ClipOval(
        child: CachedNetworkImage(
          imageUrl: url!,
          width: 44,
          height: 44,
          fit: BoxFit.cover,
          errorWidget: (_, __, ___) => _fallback(tokens),
        ),
      );
    }
    return _fallback(tokens);
  }

  Widget _fallback(ThemeTokens tokens) {
    return Container(
      width: 44,
      height: 44,
      decoration: BoxDecoration(color: tokens.bgInput, shape: BoxShape.circle),
      alignment: Alignment.center,
      child: Icon(Icons.groups_rounded, color: tokens.textMuted, size: 22),
    );
  }
}
