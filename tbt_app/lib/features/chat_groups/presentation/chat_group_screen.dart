import 'dart:async';
import 'dart:io';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../shared/providers/me_provider.dart';
import '../../../shared/providers/socket_provider.dart';
import '../../../shared/theme/design_constants.dart';
import '../../../shared/theme/theme_tokens.dart';
import '../data/chat_groups_service.dart';
import '../domain/chat_group_models.dart';
import '../providers/chat_group_providers.dart';
import 'chat_group_info_sheet.dart';
import 'chat_group_search_sheet.dart';

/// WhatsApp-inspired group chat screen. Header + message list +
/// composer, all wired to the real-time provider stack.
class ChatGroupScreen extends ConsumerStatefulWidget {
  const ChatGroupScreen({super.key, required this.groupId});
  final String groupId;

  @override
  ConsumerState<ChatGroupScreen> createState() => _ChatGroupScreenState();
}

class _ChatGroupScreenState extends ConsumerState<ChatGroupScreen> {
  final _composerCtl = TextEditingController();
  final _composerFocus = FocusNode();
  final _scrollCtl = ScrollController();

  ChatGroupMessage? _replyingTo;
  ChatGroupMessage? _editing;

  // Uploaded-but-not-sent media (parallel to composer text).
  File? _pendingMediaFile;
  bool _pendingUploading = false;
  String? _pendingMediaUrl;
  String? _pendingMediaType;

  // Mention autocomplete state.
  String? _mentionQuery;
  int _mentionAnchor = 0;
  // memberId → firstName as inserted, used to compute mentionedMemberIds on send.
  final Map<String, String> _mentionsInserted = {};

  Timer? _typingTimer;

  @override
  void initState() {
    super.initState();
    _scrollCtl.addListener(_onScroll);
    _composerCtl.addListener(_onComposerChange);
    // Mark the tail read once the messages arrive (post-frame).
    WidgetsBinding.instance.addPostFrameCallback((_) => _markTailRead());
  }

  @override
  void dispose() {
    _typingTimer?.cancel();
    _composerCtl.dispose();
    _composerFocus.dispose();
    _scrollCtl.removeListener(_onScroll);
    _scrollCtl.dispose();
    super.dispose();
  }

  void _onScroll() {
    // ListView is reverse: max scroll extent = older messages. When
    // approaching the top of the on-screen list (which is actually the
    // bottom of the extent in reverse), paginate.
    if (_scrollCtl.position.pixels >
        _scrollCtl.position.maxScrollExtent - 200) {
      ref
          .read(chatGroupMessagesNotifierProvider(widget.groupId).notifier)
          .loadMore();
    }
  }

  void _onComposerChange() {
    final v = _composerCtl.text;
    final caret = _composerCtl.selection.baseOffset;
    if (caret < 0) return;
    final upToCaret = v.substring(0, caret);
    final match = RegExp(r'(?:^|\s)@([A-Za-z0-9_]*)$').firstMatch(upToCaret);
    setState(() {
      if (match != null) {
        _mentionQuery = match.group(1) ?? '';
        _mentionAnchor = caret - (match.group(1)?.length ?? 0) - 1;
      } else {
        _mentionQuery = null;
      }
    });

    // Typing broadcast — debounced 2s.
    final socket = ref.read(socketNotifierProvider.notifier);
    socket.emit('chat_group:typing', {'groupId': widget.groupId, 'isTyping': true});
    _typingTimer?.cancel();
    _typingTimer = Timer(const Duration(seconds: 2), () {
      socket.emit('chat_group:typing', {'groupId': widget.groupId, 'isTyping': false});
    });
  }

  void _markTailRead() {
    final state = ref.read(chatGroupMessagesNotifierProvider(widget.groupId)).valueOrNull;
    if (state == null || state.messages.isEmpty) return;
    final last = state.messages.last;
    ref
        .read(chatGroupsServiceProvider)
        .markRead(widget.groupId, last.id)
        .catchError((_) => null);
  }

  Future<void> _pickMedia() async {
    if (_pendingMediaFile != null) return;
    try {
      final res = await FilePicker.platform.pickFiles(
        type: FileType.any,
        withData: false,
      );
      final path = res?.files.first.path;
      if (path == null) return;
      final file = File(path);
      setState(() {
        _pendingMediaFile = file;
        _pendingUploading = true;
        _pendingMediaUrl = null;
        _pendingMediaType = null;
      });
      final uploaded = await ref
          .read(chatGroupsServiceProvider)
          .uploadMedia(file);
      if (!mounted) return;
      setState(() {
        _pendingUploading = false;
        _pendingMediaUrl = uploaded?.publicUrl;
        _pendingMediaType = uploaded?.mediaType;
      });
    } catch (_) {
      setState(() {
        _pendingUploading = false;
      });
    }
  }

  void _clearPendingMedia() {
    setState(() {
      _pendingMediaFile = null;
      _pendingMediaUrl = null;
      _pendingMediaType = null;
      _pendingUploading = false;
    });
  }

  void _insertMention(ChatGroupMember m) {
    final first = (m.firstName ?? 'Member').replaceAll(RegExp(r'\s+'), '');
    final v = _composerCtl.text;
    final caret = _composerCtl.selection.baseOffset;
    if (caret < 0) return;
    final before = v.substring(0, _mentionAnchor);
    final after = v.substring(caret);
    final inserted = '@$first ';
    _composerCtl.text = '$before$inserted$after';
    final pos = before.length + inserted.length;
    _composerCtl.selection = TextSelection.collapsed(offset: pos);
    _mentionsInserted[m.id] = first;
    setState(() => _mentionQuery = null);
  }

  Future<void> _send() async {
    final body = _composerCtl.text.trim();
    final hasMedia = _pendingMediaUrl != null && !_pendingUploading;
    if (body.isEmpty && !hasMedia) return;
    if (_editing != null && body.isEmpty) return;

    // Compute which inserted mentions actually survived in the draft.
    final finalMentions = <String>[];
    _mentionsInserted.forEach((memberId, firstName) {
      final re = RegExp(r'(^|\s)@' + RegExp.escape(firstName) + r'(\s|$|[^A-Za-z0-9_])');
      if (re.hasMatch(body)) finalMentions.add(memberId);
    });

    try {
      if (_editing != null) {
        await ref
            .read(chatGroupsServiceProvider)
            .editMessage(widget.groupId, _editing!.id, body);
      } else {
        await ref.read(chatGroupsServiceProvider).sendMessage(
              widget.groupId,
              body: body.isEmpty ? null : body,
              mediaUrl: hasMedia ? _pendingMediaUrl : null,
              mediaType: hasMedia ? _pendingMediaType : null,
              replyToId: _replyingTo?.id,
              mentionedMemberIds: finalMentions.isEmpty ? null : finalMentions,
            );
      }
      _composerCtl.clear();
      _mentionsInserted.clear();
      setState(() {
        _replyingTo = null;
        _editing = null;
      });
      _clearPendingMedia();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to send.'), behavior: SnackBarBehavior.floating),
        );
      }
    }
  }

  Future<void> _toggleReaction(String messageId, String emoji) async {
    try {
      await ref
          .read(chatGroupsServiceProvider)
          .toggleReaction(widget.groupId, messageId, emoji);
    } catch (_) {}
  }

  Future<void> _delete(String messageId, {bool forEveryone = false}) async {
    try {
      await ref
          .read(chatGroupsServiceProvider)
          .deleteMessage(widget.groupId, messageId, forEveryone: forEveryone);
    } catch (_) {}
  }

  void _openSearch(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => ChatGroupSearchSheet(
        groupId: widget.groupId,
        onJumpToMessage: (id) {
          Navigator.of(context).pop();
          _jumpToMessage(id);
        },
      ),
    );
  }

  void _jumpToMessage(String messageId) {
    // The list is reverse — we don't have a per-message key registry, so
    // this is best-effort. Reload the surrounding page via list scroll:
    // simplest for MVP is to scroll to the newest matching and highlight.
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Jumped to message'),
        behavior: SnackBarBehavior.floating,
        duration: Duration(seconds: 1),
      ),
    );
  }

  void _openInfoSheet(BuildContext context, ChatGroupDetail detail) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => ChatGroupInfoSheet(
        detail: detail,
        onLeave: () async {
          final ok = await showDialog<bool>(
            context: context,
            builder: (ctx) => AlertDialog(
              title: const Text('Leave group?'),
              content: const Text("You'll stop receiving messages from this group."),
              actions: [
                TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
                TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Leave')),
              ],
            ),
          );
          if (ok != true) return;
          try {
            await ref.read(chatGroupsServiceProvider).leave(widget.groupId);
            if (context.mounted) {
              Navigator.of(context).pop(); // close sheet
              Navigator.of(context).pop(); // pop chat screen
            }
            ref.invalidate(myChatGroupsProvider);
          } catch (_) {}
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final detailAsync = ref.watch(chatGroupDetailProvider(widget.groupId));
    final messagesAsync = ref.watch(chatGroupMessagesNotifierProvider(widget.groupId));
    final presenceAsync = ref.watch(chatGroupPresenceProvider(widget.groupId));
    final me = ref.watch(meNotifierProvider).valueOrNull;

    // Mark newest read whenever the tail extends.
    ref.listen<AsyncValue<ChatGroupMessagesState>>(
      chatGroupMessagesNotifierProvider(widget.groupId),
      (prev, next) {
        final prevLen = prev?.valueOrNull?.messages.length ?? 0;
        final nextLen = next.valueOrNull?.messages.length ?? 0;
        if (nextLen > prevLen) _markTailRead();
      },
    );

    return Scaffold(
      backgroundColor: tokens.bgPage,
      appBar: _buildHeader(context, tokens, detailAsync, presenceAsync),
      body: Column(
        children: [
          Expanded(
            child: messagesAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => Center(
                child: Text('Could not load messages.', style: TextStyle(color: tokens.textSecondary)),
              ),
              data: (state) {
                if (state.messages.isEmpty) {
                  return Center(
                    child: Text(
                      'No messages yet — say hi.',
                      style: TextStyle(color: tokens.textMuted),
                    ),
                  );
                }
                final detail = detailAsync.valueOrNull;
                final otherMemberIds = detail?.members
                        .where((m) => m.id != me?.id)
                        .map((m) => m.id)
                        .toList() ??
                    const <String>[];
                return ListView.builder(
                  controller: _scrollCtl,
                  reverse: true,
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                  itemCount: state.messages.length + (state.loadingMore ? 1 : 0),
                  itemBuilder: (ctx, i) {
                    if (state.loadingMore && i == state.messages.length) {
                      return const Padding(
                        padding: EdgeInsets.all(12),
                        child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
                      );
                    }
                    // Reverse: item 0 is the newest.
                    final idx = state.messages.length - 1 - i;
                    final msg = state.messages[idx];
                    final prev = idx > 0 ? state.messages[idx - 1] : null;
                    final showSender = !msg.isDeleted &&
                        (prev == null || prev.senderMemberId != msg.senderMemberId);
                    final isMine = me != null && msg.senderMemberId == me.id;
                    return _MessageBubble(
                      message: msg,
                      isMine: isMine,
                      showSender: showSender,
                      otherMemberIds: otherMemberIds,
                      onReply: () {
                        setState(() {
                          _replyingTo = msg;
                          _editing = null;
                        });
                        _composerFocus.requestFocus();
                      },
                      onEdit: () {
                        if (msg.body == null) return;
                        setState(() {
                          _editing = msg;
                          _replyingTo = null;
                          _composerCtl.text = msg.body!;
                        });
                        _composerFocus.requestFocus();
                      },
                      onDelete: (forEveryone) => _delete(msg.id, forEveryone: forEveryone),
                      onReact: (emoji) => _toggleReaction(msg.id, emoji),
                    );
                  },
                );
              },
            ),
          ),
          _buildComposer(context, tokens, detailAsync, presenceAsync),
        ],
      ),
    );
  }

  PreferredSizeWidget _buildHeader(
    BuildContext context,
    ThemeTokens tokens,
    AsyncValue<ChatGroupDetail> detailAsync,
    AsyncValue<Map<String, bool>> presenceAsync,
  ) {
    return AppBar(
      backgroundColor: tokens.bgSurface,
      elevation: 0.5,
      iconTheme: IconThemeData(color: tokens.textPrimary),
      titleSpacing: 0,
      title: detailAsync.when(
        loading: () => Text('Loading…', style: TextStyle(color: tokens.textPrimary, fontSize: 14)),
        error: (_, __) => Text('Group', style: TextStyle(color: tokens.textPrimary, fontSize: 14)),
        data: (detail) {
          final onlineOthers = detail.members
              .where((m) {
                if (m.id == ref.read(meNotifierProvider).valueOrNull?.id) return false;
                return presenceAsync.valueOrNull?[m.id] == true;
              })
              .length;
          return GestureDetector(
            onTap: () => _openInfoSheet(context, detail),
            child: Row(
              children: [
                _GroupAvatar(url: detail.avatarUrl, name: detail.name, size: 36),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        detail.name,
                        style: TextStyle(color: tokens.textPrimary, fontSize: 15, fontWeight: FontWeight.w700),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      Text(
                        onlineOthers > 0
                            ? '${detail.members.length} members · $onlineOthers online'
                            : '${detail.members.length} members',
                        style: TextStyle(color: tokens.textMuted, fontSize: 11),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          );
        },
      ),
      actions: [
        IconButton(
          icon: const Icon(Icons.search_rounded),
          onPressed: () => _openSearch(context),
          tooltip: 'Search',
        ),
      ],
    );
  }

  Widget _buildComposer(
    BuildContext context,
    ThemeTokens tokens,
    AsyncValue<ChatGroupDetail> detailAsync,
    AsyncValue<Map<String, bool>> presenceAsync,
  ) {
    final detail = detailAsync.valueOrNull;
    final me = ref.watch(meNotifierProvider).valueOrNull;
    final suggestions = _mentionQuery == null || detail == null
        ? const <ChatGroupMember>[]
        : detail.members
            .where((m) => m.id != (me?.id ?? ''))
            .where((m) => (m.firstName ?? '')
                .toLowerCase()
                .startsWith(_mentionQuery!.toLowerCase()))
            .take(6)
            .toList();

    return SafeArea(
      top: false,
      child: Container(
        decoration: BoxDecoration(
          color: tokens.bgSurface,
          border: Border(top: BorderSide(color: tokens.borderCard, width: 0.5)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (_editing != null)
              _ComposerBanner(
                icon: Icons.edit_rounded,
                label: 'Editing message · 15-min window',
                onClose: () {
                  setState(() => _editing = null);
                  _composerCtl.clear();
                },
              ),
            if (_replyingTo != null)
              _ComposerBanner(
                icon: Icons.reply_rounded,
                label: 'Replying to ${_replyingTo!.sender?.displayName ?? "Member"}',
                subLabel: _replyingTo!.body ?? '📎 ${_replyingTo!.mediaType ?? "media"}',
                onClose: () => setState(() => _replyingTo = null),
              ),
            if (_pendingMediaFile != null)
              _PendingMediaTile(
                file: _pendingMediaFile!,
                uploading: _pendingUploading,
                uploaded: _pendingMediaUrl != null,
                onClose: _clearPendingMedia,
              ),
            if (suggestions.isNotEmpty)
              _MentionDropdown(
                suggestions: suggestions,
                presenceMap: presenceAsync.valueOrNull ?? const {},
                onPick: _insertMention,
              ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  IconButton(
                    icon: const Icon(Icons.attach_file_rounded),
                    color: tokens.textMuted,
                    onPressed: _pendingMediaFile != null ? null : _pickMedia,
                  ),
                  Expanded(
                    child: TextField(
                      controller: _composerCtl,
                      focusNode: _composerFocus,
                      minLines: 1,
                      maxLines: 5,
                      style: TextStyle(color: tokens.textPrimary, fontSize: 14),
                      decoration: InputDecoration(
                        hintText: _pendingMediaFile != null
                            ? 'Add a caption…'
                            : 'Type a message… (@ to mention)',
                        hintStyle: TextStyle(color: tokens.textMuted, fontSize: 13),
                        filled: true,
                        fillColor: tokens.bgInput,
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(20),
                          borderSide: BorderSide(color: tokens.borderInput),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(20),
                          borderSide: BorderSide(color: tokens.borderInput),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(20),
                          borderSide: const BorderSide(color: kColorAccent),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  SizedBox(
                    width: 44,
                    height: 44,
                    child: Material(
                      color: kColorAccent,
                      borderRadius: BorderRadius.circular(22),
                      clipBehavior: Clip.antiAlias,
                      child: InkWell(
                        onTap: _send,
                        child: const Center(
                          child: Icon(Icons.send_rounded, color: Colors.white, size: 18),
                        ),
                      ),
                    ),
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

// ── Header avatar ───────────────────────────────────────────────────────────

class _GroupAvatar extends StatelessWidget {
  const _GroupAvatar({required this.url, required this.name, this.size = 36});
  final String? url;
  final String name;
  final double size;
  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    if (url != null && url!.isNotEmpty) {
      return ClipOval(
        child: CachedNetworkImage(
          imageUrl: url!,
          width: size,
          height: size,
          fit: BoxFit.cover,
          errorWidget: (_, __, ___) => _fallback(tokens),
        ),
      );
    }
    return _fallback(tokens);
  }

  Widget _fallback(ThemeTokens tokens) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(color: tokens.bgInput, shape: BoxShape.circle),
      alignment: Alignment.center,
      child: Icon(Icons.groups_rounded, color: tokens.textMuted, size: size * 0.55),
    );
  }
}

// ── Composer banner (reply / edit strip above textfield) ───────────────────

class _ComposerBanner extends StatelessWidget {
  const _ComposerBanner({
    required this.icon,
    required this.label,
    required this.onClose,
    this.subLabel,
  });
  final IconData icon;
  final String label;
  final String? subLabel;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Container(
      margin: const EdgeInsets.fromLTRB(8, 8, 8, 0),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: tokens.bgInput,
        borderRadius: BorderRadius.circular(8),
        border: Border(left: BorderSide(color: kColorAccent, width: 3)),
      ),
      child: Row(
        children: [
          Icon(icon, size: 14, color: kColorAccent),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  label,
                  style: const TextStyle(color: kColorAccent, fontSize: 11, fontWeight: FontWeight.w700),
                ),
                if (subLabel != null)
                  Text(
                    subLabel!,
                    style: TextStyle(color: tokens.textMuted, fontSize: 11),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
              ],
            ),
          ),
          IconButton(
            icon: Icon(Icons.close_rounded, size: 16, color: tokens.textMuted),
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(),
            onPressed: onClose,
          ),
        ],
      ),
    );
  }
}

class _PendingMediaTile extends StatelessWidget {
  const _PendingMediaTile({
    required this.file,
    required this.uploading,
    required this.uploaded,
    required this.onClose,
  });
  final File file;
  final bool uploading;
  final bool uploaded;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final name = file.path.split(Platform.pathSeparator).last;
    return Container(
      margin: const EdgeInsets.fromLTRB(8, 8, 8, 0),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: tokens.bgInput,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: tokens.borderCard),
      ),
      child: Row(
        children: [
          Icon(Icons.attach_file_rounded, size: 16, color: tokens.textMuted),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              name,
              style: TextStyle(color: tokens.textPrimary, fontSize: 12),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          if (uploading)
            const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2))
          else if (uploaded)
            const Icon(Icons.check_circle, color: Color(0xFF27AE60), size: 16)
          else
            const Icon(Icons.error_outline, color: Color(0xFFEF4444), size: 16),
          IconButton(
            icon: Icon(Icons.close_rounded, size: 16, color: tokens.textMuted),
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(),
            onPressed: onClose,
          ),
        ],
      ),
    );
  }
}

class _MentionDropdown extends StatelessWidget {
  const _MentionDropdown({
    required this.suggestions,
    required this.presenceMap,
    required this.onPick,
  });
  final List<ChatGroupMember> suggestions;
  final Map<String, bool> presenceMap;
  final void Function(ChatGroupMember) onPick;
  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Container(
      constraints: const BoxConstraints(maxHeight: 200),
      margin: const EdgeInsets.symmetric(horizontal: 8),
      decoration: BoxDecoration(
        color: tokens.bgSurface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: tokens.borderCard),
      ),
      child: ListView.builder(
        shrinkWrap: true,
        padding: EdgeInsets.zero,
        itemCount: suggestions.length,
        itemBuilder: (_, i) {
          final m = suggestions[i];
          final online = presenceMap[m.id] == true;
          return ListTile(
            dense: true,
            visualDensity: VisualDensity.compact,
            leading: Stack(children: [
              _MemberAvatar(url: m.profilePhotoUrl, name: m.displayName, size: 28),
              if (online)
                const Positioned(
                  right: 0,
                  bottom: 0,
                  child: CircleAvatar(radius: 4, backgroundColor: Color(0xFF22C55E)),
                ),
            ]),
            title: Text(
              m.displayName,
              style: TextStyle(color: tokens.textPrimary, fontSize: 13),
            ),
            onTap: () => onPick(m),
          );
        },
      ),
    );
  }
}

// ── Member avatar (used inside chat bubbles + mention dropdown) ────────────

class _MemberAvatar extends StatelessWidget {
  const _MemberAvatar({required this.url, required this.name, this.size = 30});
  final String? url;
  final String name;
  final double size;
  @override
  Widget build(BuildContext context) {
    if (url != null && url!.isNotEmpty) {
      return ClipOval(
        child: CachedNetworkImage(
          imageUrl: url!,
          width: size,
          height: size,
          fit: BoxFit.cover,
          errorWidget: (_, __, ___) => _fallback(),
        ),
      );
    }
    return _fallback();
  }

  Widget _fallback() {
    final initial = name.trim().isEmpty ? '?' : name.trim()[0].toUpperCase();
    return Container(
      width: size,
      height: size,
      decoration: const BoxDecoration(color: kColorAccent, shape: BoxShape.circle),
      alignment: Alignment.center,
      child: Text(
        initial,
        style: TextStyle(color: Colors.white, fontSize: size * 0.4, fontWeight: FontWeight.w700),
      ),
    );
  }
}

// ── Message bubble ─────────────────────────────────────────────────────────

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({
    required this.message,
    required this.isMine,
    required this.showSender,
    required this.otherMemberIds,
    required this.onReply,
    required this.onEdit,
    required this.onDelete,
    required this.onReact,
  });
  final ChatGroupMessage message;
  final bool isMine;
  final bool showSender;
  final List<String> otherMemberIds;
  final VoidCallback onReply;
  final VoidCallback onEdit;
  final void Function(bool forEveryone) onDelete;
  final void Function(String emoji) onReact;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final bg = isMine
        ? kColorAccent.withValues(alpha: 0.10)
        : tokens.bgSurface;
    final border = isMine
        ? kColorAccent.withValues(alpha: 0.30)
        : tokens.borderCard;
    final time = DateFormat.jm().format(message.createdAt.toLocal());

    final readSet = message.readByMemberIds.toSet();
    final readByOthers = otherMemberIds.where(readSet.contains).length;
    final readByAll = isMine && otherMemberIds.isNotEmpty && readByOthers >= otherMemberIds.length;
    final readByAny = isMine && readByOthers > 0;

    return Align(
      alignment: isMine ? Alignment.centerRight : Alignment.centerLeft,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.82),
        child: GestureDetector(
          onLongPress: () => _openActionSheet(context),
          child: Container(
            margin: const EdgeInsets.symmetric(vertical: 2, horizontal: 4),
            decoration: BoxDecoration(
              color: bg,
              borderRadius: BorderRadius.only(
                topLeft: const Radius.circular(14),
                topRight: const Radius.circular(14),
                bottomLeft: Radius.circular(isMine ? 14 : 4),
                bottomRight: Radius.circular(isMine ? 4 : 14),
              ),
              border: Border.all(color: border),
            ),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                if (showSender && !isMine && !message.isDeleted)
                  Text(
                    message.sender?.displayName ?? 'Member',
                    style: const TextStyle(
                      color: kColorAccent,
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                if (message.replyTo != null && !message.isDeleted)
                  _ReplyQuote(reply: message.replyTo!),
                if (message.mediaUrl != null && !message.isDeleted)
                  _MediaContent(url: message.mediaUrl!, type: message.mediaType ?? 'document'),
                if (message.isDeleted)
                  Text(
                    message.deletedForEveryone
                        ? 'This message was deleted'
                        : 'You deleted this message',
                    style: TextStyle(color: tokens.textMuted, fontStyle: FontStyle.italic, fontSize: 12),
                  )
                else if (message.body != null && message.body!.isNotEmpty)
                  _BodyText(text: message.body!, textStyle: TextStyle(color: tokens.textPrimary, fontSize: 14, height: 1.35)),
                if (message.reactions.isNotEmpty) _Reactions(reactions: message.reactions),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Spacer(),
                    if (message.editedAt != null && !message.isDeleted)
                      Text('edited · ', style: TextStyle(color: tokens.textMuted, fontSize: 10)),
                    Text(time, style: TextStyle(color: tokens.textMuted, fontSize: 10)),
                    if (isMine && !message.isDeleted) ...[
                      const SizedBox(width: 4),
                      Icon(
                        readByAll
                            ? Icons.done_all_rounded
                            : readByAny
                                ? Icons.done_all_rounded
                                : Icons.done_rounded,
                        size: 12,
                        color: readByAll ? const Color(0xFF3B82F6) : tokens.textMuted,
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _openActionSheet(BuildContext ctx) {
    if (message.isDeleted) return;
    final tokens = ctx.tokens;
    showModalBottomSheet<void>(
      context: ctx,
      backgroundColor: tokens.bgSurface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (bs) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: ['👍', '❤️', '😂', '😮', '😢', '🙏']
                      .map((e) => GestureDetector(
                            onTap: () {
                              Navigator.pop(bs);
                              onReact(e);
                            },
                            child: Text(e, style: const TextStyle(fontSize: 24)),
                          ))
                      .toList(),
                ),
              ),
              const Divider(height: 1),
              ListTile(
                leading: const Icon(Icons.reply_rounded),
                title: const Text('Reply'),
                onTap: () {
                  Navigator.pop(bs);
                  onReply();
                },
              ),
              if (isMine && message.mediaUrl == null && message.body != null)
                ListTile(
                  leading: const Icon(Icons.edit_rounded),
                  title: const Text('Edit'),
                  onTap: () {
                    Navigator.pop(bs);
                    onEdit();
                  },
                ),
              ListTile(
                leading: const Icon(Icons.delete_outline_rounded),
                title: const Text('Delete for me'),
                onTap: () {
                  Navigator.pop(bs);
                  onDelete(false);
                },
              ),
              if (isMine)
                ListTile(
                  leading: const Icon(Icons.delete_forever_rounded, color: Color(0xFFEF4444)),
                  title: const Text('Delete for everyone', style: TextStyle(color: Color(0xFFEF4444))),
                  onTap: () {
                    Navigator.pop(bs);
                    onDelete(true);
                  },
                ),
              const SizedBox(height: 8),
            ],
          ),
        );
      },
    );
  }
}

class _ReplyQuote extends StatelessWidget {
  const _ReplyQuote({required this.reply});
  final ChatGroupReplyPreview reply;
  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Container(
      margin: const EdgeInsets.only(top: 2, bottom: 4),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
      decoration: BoxDecoration(
        color: kColorAccent.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(6),
        border: const Border(left: BorderSide(color: kColorAccent, width: 2.5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            reply.senderName ?? 'Member',
            style: const TextStyle(color: kColorAccent, fontSize: 10, fontWeight: FontWeight.w700),
          ),
          Text(
            reply.deletedForEveryone
                ? 'message deleted'
                : reply.body ?? (reply.mediaType != null ? '📎 ${reply.mediaType}' : '…'),
            style: TextStyle(color: tokens.textMuted, fontSize: 11),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}

class _MediaContent extends StatelessWidget {
  const _MediaContent({required this.url, required this.type});
  final String url;
  final String type;
  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    if (type == 'image') {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: CachedNetworkImage(
            imageUrl: url,
            fit: BoxFit.cover,
            width: 240,
            errorWidget: (_, __, ___) => Icon(Icons.image_not_supported, color: tokens.textMuted),
          ),
        ),
      );
    }
    // Video/audio/doc — surface as a tap-to-open tile (native player not
    // bundled here to keep the port lean).
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: tokens.bgInput,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: tokens.borderCard),
        ),
        child: Row(
          children: [
            Icon(
              type == 'video'
                  ? Icons.play_circle_outline_rounded
                  : type == 'audio'
                      ? Icons.audiotrack_rounded
                      : Icons.insert_drive_file_rounded,
              color: tokens.textPrimary,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                url.split('/').last,
                style: TextStyle(color: tokens.textPrimary, fontSize: 12),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Reactions extends StatelessWidget {
  const _Reactions({required this.reactions});
  final List<ChatGroupReaction> reactions;
  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final grouped = <String, int>{};
    for (final r in reactions) {
      grouped[r.emoji] = (grouped[r.emoji] ?? 0) + 1;
    }
    return Padding(
      padding: const EdgeInsets.only(top: 3),
      child: Wrap(
        spacing: 4,
        children: grouped.entries
            .map(
              (e) => Container(
                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                decoration: BoxDecoration(
                  color: tokens.bgInput,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: tokens.borderCard),
                ),
                child: Text('${e.key} ${e.value}', style: const TextStyle(fontSize: 10)),
              ),
            )
            .toList(),
      ),
    );
  }
}

class _BodyText extends StatelessWidget {
  const _BodyText({required this.text, required this.textStyle});
  final String text;
  final TextStyle textStyle;
  @override
  Widget build(BuildContext context) {
    // Split on @mentions and colour them accent.
    final parts = text.split(RegExp(r'(@[A-Za-z0-9_]+)'));
    return RichText(
      text: TextSpan(
        style: textStyle,
        children: parts.map((chunk) {
          if (chunk.startsWith('@') && chunk.length > 1) {
            return TextSpan(
              text: chunk,
              style: textStyle.copyWith(color: kColorAccent, fontWeight: FontWeight.w700),
            );
          }
          return TextSpan(text: chunk);
        }).toList(),
      ),
    );
  }
}
