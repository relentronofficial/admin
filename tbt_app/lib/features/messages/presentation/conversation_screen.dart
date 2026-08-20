import 'dart:io';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../features/chat_groups/data/chat_groups_service.dart';
import '../../../features/community/presentation/image_viewer.dart';
import '../../../features/community/presentation/video_viewer.dart';
import '../../../shared/models/chat_message.dart';
import '../../../shared/providers/me_provider.dart';
import '../../../shared/theme/design_constants.dart';
import '../../../shared/theme/tbt_theme.dart';
import '../data/messages_service.dart';
import '../providers/messages_provider.dart';

import '../../../shared/theme/theme_tokens.dart';
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

  // Reply preview state.
  ChatMessage? _replyingTo;

  // Uploaded-but-not-sent media.
  File? _pendingMediaFile;
  bool _pendingUploading = false;
  String? _pendingMediaUrl;
  String? _pendingMediaType;

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

  Future<void> _onScroll() async {
    if (_loadingMore) return;
    if (!_scrollCtrl.hasClients) return;
    if (_scrollCtrl.position.pixels > 80) return;
    final notifier = ref.read(
        conversationMessagesProvider(widget.conversationId).notifier);
    if (!notifier.hasMore) return;
    setState(() => _loadingMore = true);
    final prevMax = _scrollCtrl.position.maxScrollExtent;
    await notifier.fetchMore();
    if (mounted) setState(() => _loadingMore = false);
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

  Future<void> _openAttachSheet() async {
    if (_pendingMediaFile != null) return;
    final choice = await showModalBottomSheet<_AttachChoice>(
      context: context,
      backgroundColor: context.tokens.bgSurface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (bs) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.photo_camera_outlined),
              title: const Text('Camera'),
              onTap: () => Navigator.pop(bs, _AttachChoice.camera),
            ),
            ListTile(
              leading: const Icon(Icons.image_outlined),
              title: const Text('Gallery'),
              onTap: () => Navigator.pop(bs, _AttachChoice.gallery),
            ),
            ListTile(
              leading: const Icon(Icons.insert_drive_file_outlined),
              title: const Text('Document'),
              onTap: () => Navigator.pop(bs, _AttachChoice.document),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
    if (choice == null) return;
    File? file;
    try {
      switch (choice) {
        case _AttachChoice.camera:
          final x = await ImagePicker()
              .pickImage(source: ImageSource.camera, imageQuality: 90);
          if (x != null) file = File(x.path);
          break;
        case _AttachChoice.gallery:
          final x = await ImagePicker()
              .pickImage(source: ImageSource.gallery, imageQuality: 90);
          if (x != null) file = File(x.path);
          break;
        case _AttachChoice.document:
          final res = await FilePicker.platform
              .pickFiles(type: FileType.any, withData: false);
          final path = res?.files.first.path;
          if (path != null) file = File(path);
          break;
      }
    } catch (_) {
      return;
    }
    if (file == null) return;
    setState(() {
      _pendingMediaFile = file;
      _pendingUploading = true;
      _pendingMediaUrl = null;
      _pendingMediaType = null;
    });
    // Reuse the group-chat upload endpoint — same backend surface.
    final uploaded =
        await ref.read(chatGroupsServiceProvider).uploadMedia(file);
    if (!mounted) return;
    setState(() {
      _pendingUploading = false;
      _pendingMediaUrl = uploaded?.publicUrl;
      _pendingMediaType = uploaded?.mediaType;
    });
  }

  void _clearPendingMedia() {
    setState(() {
      _pendingMediaFile = null;
      _pendingMediaUrl = null;
      _pendingMediaType = null;
      _pendingUploading = false;
    });
  }

  Future<void> _send() async {
    final body = _inputCtrl.text.trim();
    final hasMedia = _pendingMediaUrl != null && !_pendingUploading;
    if (body.isEmpty && !hasMedia) return;
    if (_sending) return;

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
      mediaUrl: hasMedia ? _pendingMediaUrl : null,
      mediaType: hasMedia ? _pendingMediaType : null,
      replyToId: _replyingTo?.id,
      replyToBody: _replyingTo?.body,
      replyToSenderName: _replyingTo?.senderName,
    );

    _inputCtrl.clear();
    setState(() {
      _sending = true;
    });

    ref
        .read(conversationMessagesProvider(widget.conversationId).notifier)
        .appendSent(optimistic);
    _scrollToBottom(animated: true);

    final replyToId = _replyingTo?.id;
    final capturedBody = body.isEmpty ? null : body;
    final capturedMediaUrl = hasMedia ? _pendingMediaUrl : null;
    final capturedMediaType = hasMedia ? _pendingMediaType : null;

    setState(() {
      _replyingTo = null;
    });
    _clearPendingMedia();

    try {
      await ref.read(messagesServiceProvider).sendMessage(
            widget.conversationId,
            capturedBody,
            mediaUrl: capturedMediaUrl,
            mediaType: capturedMediaType,
            replyToId: replyToId,
          );
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
        backgroundColor: context.tokens.bgSurface,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: Icon(Icons.arrow_back_ios_new,
              color: context.tokens.textPrimary, size: 18),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Text(
          'CONVERSATION',
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
            itemBuilder: (_) => [
              PopupMenuItem(
                value: 'archive',
                child: Text(
                  'Archive',
                  style: TextStyle(color: context.tokens.textPrimary, fontSize: 13),
                ),
              ),
            ],
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: messagesAsync.when(
              loading: () => const Center(
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
              error: (e, _) => Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.error_outline,
                        color: context.tokens.textMuted, size: 36),
                    const SizedBox(height: 8),
                    Text('Failed to load messages',
                        style: TextStyle(color: context.tokens.textSecondary)),
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
                  return Center(
                    child: Text(
                      'No messages yet.\nSay hello!',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: context.tokens.textMuted, fontSize: 14),
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
                    Text(
                      'TBT team is typing…',
                      style: TextStyle(
                        color: context.tokens.textMuted,
                        fontSize: 12,
                        fontStyle: FontStyle.italic,
                      ),
                    ),
                  ],
                ),
              );
            },
          ),

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
                color: context.tokens.bgInput,
                child: Text(
                  'This conversation is closed — send a reply to reopen it.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: context.tokens.textMuted,
                    fontSize: 12,
                    fontStyle: FontStyle.italic,
                  ),
                ),
              );
            },
          ),

          // Reply banner + pending media
          if (_replyingTo != null)
            _ReplyBanner(
              message: _replyingTo!,
              onClose: () => setState(() => _replyingTo = null),
            ),
          if (_pendingMediaFile != null)
            _PendingMediaStrip(
              file: _pendingMediaFile!,
              uploading: _pendingUploading,
              uploaded: _pendingMediaUrl != null,
              onClose: _clearPendingMedia,
            ),

          _InputBar(
            controller: _inputCtrl,
            accent: accent,
            sending: _sending,
            onSend: _send,
            onAttach: _openAttachSheet,
            attachDisabled: _pendingMediaFile != null,
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
          return _MessageBubble(
            message: m,
            accent: accent,
            onReply: () {
              setState(() => _replyingTo = m);
            },
            onCopy: m.body.isEmpty
                ? null
                : () async {
                    await Clipboard.setData(ClipboardData(text: m.body));
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Copied'),
                          behavior: SnackBarBehavior.floating,
                          duration: Duration(seconds: 1),
                        ),
                      );
                    }
                  },
          );
        }
        cursor++;
      }
    }
    return const SizedBox.shrink();
  }
}

// ── Attach choice enum ────────────────────────────────────────────────────────

enum _AttachChoice { camera, gallery, document }

// ── Day separator ─────────────────────────────────────────────────────────────

class _DaySeparator extends StatelessWidget {
  const _DaySeparator({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: Row(
          children: [
            Expanded(child: Divider(color: context.tokens.borderCard)),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Text(
                label,
                style: TextStyle(
                  color: context.tokens.textMuted,
                  fontSize: 11,
                  fontFamily: 'Rajdhani',
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1,
                ),
              ),
            ),
            Expanded(child: Divider(color: context.tokens.borderCard)),
          ],
        ),
      );
}

// ── Reply banner (composer strip) ─────────────────────────────────────────────

class _ReplyBanner extends StatelessWidget {
  const _ReplyBanner({required this.message, required this.onClose});
  final ChatMessage message;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Container(
      margin: const EdgeInsets.fromLTRB(12, 8, 12, 0),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: tokens.bgInput,
        borderRadius: BorderRadius.circular(8),
        border: Border(left: BorderSide(color: kColorAccent, width: 3)),
      ),
      child: Row(
        children: [
          const Icon(Icons.reply_rounded, size: 14, color: kColorAccent),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'Replying to ${message.senderName}',
                  style: const TextStyle(
                    color: kColorAccent,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                Text(
                  message.body.isNotEmpty
                      ? message.body
                      : '📎 ${message.mediaType ?? "media"}',
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

class _PendingMediaStrip extends StatelessWidget {
  const _PendingMediaStrip({
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
      margin: const EdgeInsets.fromLTRB(12, 8, 12, 0),
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
            const SizedBox(
                width: 14,
                height: 14,
                child: CircularProgressIndicator(strokeWidth: 2))
          else if (uploaded)
            const Icon(Icons.check_circle,
                color: Color(0xFF27AE60), size: 16)
          else
            const Icon(Icons.error_outline,
                color: Color(0xFFEF4444), size: 16),
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

// ── Message bubble ─────────────────────────────────────────────────────────────

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({
    required this.message,
    required this.accent,
    required this.onReply,
    required this.onCopy,
  });

  final ChatMessage message;
  final Color accent;
  final VoidCallback onReply;
  final VoidCallback? onCopy;

  void _openActionSheet(BuildContext ctx) {
    final tokens = ctx.tokens;
    showModalBottomSheet<void>(
      context: ctx,
      backgroundColor: tokens.bgSurface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (bs) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.reply_rounded),
              title: const Text('Reply'),
              onTap: () {
                Navigator.pop(bs);
                onReply();
              },
            ),
            if (onCopy != null)
              ListTile(
                leading: const Icon(Icons.content_copy_rounded),
                title: const Text('Copy'),
                onTap: () {
                  Navigator.pop(bs);
                  onCopy!();
                },
              ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isMine = message.senderType == 'member';
    final dt = DateTime.tryParse(message.createdAt)?.toLocal();
    final timeStr = dt != null
        ? '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}'
        : '';

    return GestureDetector(
      onLongPress: () => _openActionSheet(context),
      child: Padding(
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
                        style: TextStyle(
                          color: context.tokens.textMuted,
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
                        horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: isMine ? accent : context.tokens.bgSurface,
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
                          : Border.all(color: context.tokens.borderCard),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (message.replyToId != null)
                          _MiniReplyQuote(
                            senderName: message.replyToSenderName,
                            body: message.replyToBody,
                            onDark: isMine,
                          ),
                        if (message.hasMedia)
                          _DmMediaContent(
                            url: message.mediaUrl!,
                            type: message.mediaType ?? 'document',
                            onDark: isMine,
                          ),
                        if (message.body.isNotEmpty)
                          Padding(
                            padding: EdgeInsets.only(
                                top: message.hasMedia ? 4 : 0),
                            child: Text(
                              message.body,
                              style: TextStyle(
                                color: isMine
                                    ? Colors.white
                                    : context.tokens.textPrimary,
                                fontSize: 14,
                                height: 1.4,
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                  if (timeStr.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 2, left: 2, right: 2),
                      child: Text(
                        timeStr,
                        style: TextStyle(
                          color: context.tokens.textMuted,
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
      ),
    );
  }
}

class _MiniReplyQuote extends StatelessWidget {
  const _MiniReplyQuote({
    required this.senderName,
    required this.body,
    required this.onDark,
  });
  final String? senderName;
  final String? body;
  final bool onDark;
  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final labelColor = onDark ? Colors.white : kColorAccent;
    final bodyColor = onDark ? Colors.white70 : tokens.textMuted;
    return Container(
      margin: const EdgeInsets.only(bottom: 4),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: (onDark ? Colors.white : kColorAccent).withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(6),
        border: Border(left: BorderSide(color: labelColor, width: 2.5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            senderName ?? 'Message',
            style: TextStyle(
              color: labelColor,
              fontSize: 10,
              fontWeight: FontWeight.w700,
            ),
          ),
          if (body != null && body!.isNotEmpty)
            Text(
              body!,
              style: TextStyle(color: bodyColor, fontSize: 11),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
        ],
      ),
    );
  }
}

class _DmMediaContent extends StatelessWidget {
  const _DmMediaContent({
    required this.url,
    required this.type,
    required this.onDark,
  });
  final String url;
  final String type;
  final bool onDark;
  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    if (type == 'image') {
      return GestureDetector(
        onTap: () =>
            FullscreenImageViewer.open(context, urls: [url], initialIndex: 0),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: CachedNetworkImage(
            imageUrl: url,
            width: 220,
            fit: BoxFit.cover,
            errorWidget: (_, __, ___) => Icon(
              Icons.image_not_supported,
              color: onDark ? Colors.white70 : tokens.textMuted,
            ),
          ),
        ),
      );
    }
    if (type == 'video') {
      return GestureDetector(
        onTap: () => VideoViewer.open(context, url),
        child: Container(
          width: 220,
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: onDark
                ? Colors.white.withValues(alpha: 0.15)
                : tokens.bgInput,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Row(
            children: [
              Icon(
                Icons.play_circle_outline_rounded,
                color: onDark ? Colors.white : tokens.textPrimary,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  url.split('/').last,
                  style: TextStyle(
                    color: onDark ? Colors.white : tokens.textPrimary,
                    fontSize: 12,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        ),
      );
    }
    // Audio + document → tap to open externally.
    return GestureDetector(
      onTap: () async {
        final uri = Uri.tryParse(url);
        if (uri != null) {
          await launchUrl(uri, mode: LaunchMode.externalApplication);
        }
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: onDark
              ? Colors.white.withValues(alpha: 0.15)
              : tokens.bgInput,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              type == 'audio'
                  ? Icons.audiotrack_rounded
                  : Icons.insert_drive_file_rounded,
              color: onDark ? Colors.white : tokens.textPrimary,
              size: 18,
            ),
            const SizedBox(width: 6),
            Flexible(
              child: Text(
                url.split('/').last,
                style: TextStyle(
                  color: onDark ? Colors.white : tokens.textPrimary,
                  fontSize: 12,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            Icon(Icons.open_in_new_rounded,
                size: 14,
                color: onDark ? Colors.white70 : tokens.textMuted),
          ],
        ),
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
      backgroundColor: context.tokens.bgInput,
      child: Text(
        initial,
        style: TextStyle(
          color: context.tokens.textSecondary,
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
    required this.onAttach,
    required this.attachDisabled,
  });

  final TextEditingController controller;
  final Color accent;
  final bool sending;
  final VoidCallback onSend;
  final VoidCallback onAttach;
  final bool attachDisabled;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: context.tokens.bgSurface,
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
            IconButton(
              tooltip: 'Attach',
              icon: Icon(Icons.attach_file_rounded,
                  color: context.tokens.textMuted),
              onPressed: attachDisabled ? null : onAttach,
            ),
            Expanded(
              child: TextField(
                controller: controller,
                style: TextStyle(
                    color: context.tokens.textPrimary, fontSize: 14),
                maxLines: null,
                keyboardType: TextInputType.multiline,
                textCapitalization: TextCapitalization.sentences,
                decoration: InputDecoration(
                  hintText: 'Type a message…',
                  hintStyle:
                      TextStyle(color: context.tokens.textMuted, fontSize: 14),
                  filled: true,
                  fillColor: context.tokens.bgInput,
                  contentPadding: const EdgeInsets.symmetric(
                      horizontal: 14, vertical: 10),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(20),
                    borderSide: BorderSide(color: context.tokens.borderCard),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(20),
                    borderSide: BorderSide(color: context.tokens.borderCard),
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
                    color: sending ? context.tokens.bgInput : accent,
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
