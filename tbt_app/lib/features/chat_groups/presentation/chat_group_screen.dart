import 'dart:async';
import 'dart:io';
import 'dart:math' as math;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:just_audio/just_audio.dart';
import 'package:path_provider/path_provider.dart';
import 'package:record/record.dart';
import 'package:scrollable_positioned_list/scrollable_positioned_list.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../features/community/presentation/image_viewer.dart';
import '../../../features/community/presentation/video_viewer.dart';
import '../../../shared/providers/me_provider.dart';
import '../../../shared/providers/socket_provider.dart';
import '../../../shared/theme/design_constants.dart';
import '../../../shared/theme/theme_tokens.dart';
import '../data/chat_groups_service.dart';
import '../domain/chat_group_models.dart';
import '../providers/chat_group_providers.dart';
import 'chat_group_info_sheet.dart';
import 'chat_group_search_sheet.dart';
import 'forward_picker_sheet.dart';

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

  // scrollable_positioned_list — lets us programmatically scroll to a
  // specific index for reply jump-to-parent.
  final ItemScrollController _itemScrollController = ItemScrollController();
  final ItemPositionsListener _itemPositionsListener =
      ItemPositionsListener.create();

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
  final Map<String, String> _mentionsInserted = {};

  Timer? _typingTimer;

  // Voice recorder state.
  final Record _recorder = Record();
  bool _isRecording = false;
  DateTime? _recordingStartedAt;
  Timer? _recordingTicker;
  Duration _recordingElapsed = Duration.zero;
  double _slideCancelOffset = 0; // px slid left; > 100 == cancel
  bool _recordingCancelled = false;

  // Message being highlighted on jump-to (fades over ~800ms).
  String? _highlightedMessageId;
  Timer? _highlightTimer;

  @override
  void initState() {
    super.initState();
    _itemPositionsListener.itemPositions.addListener(_onScrollPositions);
    _composerCtl.addListener(_onComposerChange);
    // Mark the tail read once the messages arrive (post-frame).
    WidgetsBinding.instance.addPostFrameCallback((_) => _markTailRead());
  }

  @override
  void dispose() {
    _typingTimer?.cancel();
    _highlightTimer?.cancel();
    _recordingTicker?.cancel();
    _recorder.dispose();
    _composerCtl.dispose();
    _composerFocus.dispose();
    _itemPositionsListener.itemPositions.removeListener(_onScrollPositions);
    super.dispose();
  }

  // ── Scroll / pagination ────────────────────────────────────────────────

  void _onScrollPositions() {
    final positions = _itemPositionsListener.itemPositions.value;
    if (positions.isEmpty) return;
    final state = ref.read(chatGroupMessagesNotifierProvider(widget.groupId))
        .valueOrNull;
    if (state == null || state.messages.isEmpty) return;
    // With reverse:true, item 0 is the newest. The oldest visible index is
    // the max index in `positions`. If it's close to the total length,
    // request older messages.
    var maxIndex = 0;
    for (final p in positions) {
      if (p.index > maxIndex) maxIndex = p.index;
    }
    if (maxIndex >= state.messages.length - 5) {
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
    final state =
        ref.read(chatGroupMessagesNotifierProvider(widget.groupId)).valueOrNull;
    if (state == null || state.messages.isEmpty) return;
    final last = state.messages.last;
    ref
        .read(chatGroupsServiceProvider)
        .markRead(widget.groupId, last.id)
        .catchError((_) => null);
  }

  // ── Attach flow (image/video/document) ─────────────────────────────────

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
      final uploaded =
          await ref.read(chatGroupsServiceProvider).uploadMedia(file);
      if (!mounted) return;
      setState(() {
        _pendingUploading = false;
        _pendingMediaUrl = uploaded?.publicUrl;
        _pendingMediaType = uploaded?.mediaType;
      });
    } catch (_) {
      setState(() => _pendingUploading = false);
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

  // ── Voice recording flow ───────────────────────────────────────────────

  Future<void> _startRecording() async {
    if (_isRecording) return;
    try {
      if (!await _recorder.hasPermission()) return;
      final dir = await getTemporaryDirectory();
      final path =
          '${dir.path}${Platform.pathSeparator}voice_${DateTime.now().millisecondsSinceEpoch}.m4a';
      await _recorder.start(
        path: path,
        encoder: AudioEncoder.aacLc,
        bitRate: 96000,
      );
      HapticFeedback.mediumImpact();
      setState(() {
        _isRecording = true;
        _recordingStartedAt = DateTime.now();
        _recordingElapsed = Duration.zero;
        _slideCancelOffset = 0;
        _recordingCancelled = false;
      });
      _recordingTicker?.cancel();
      _recordingTicker =
          Timer.periodic(const Duration(milliseconds: 200), (_) {
        if (!mounted || _recordingStartedAt == null) return;
        setState(() {
          _recordingElapsed =
              DateTime.now().difference(_recordingStartedAt!);
        });
      });
    } catch (_) {
      // Silently fail — the composer stays in normal state.
    }
  }

  Future<void> _stopRecording({required bool cancelled}) async {
    if (!_isRecording) return;
    _recordingTicker?.cancel();
    _recordingTicker = null;
    final path = await _recorder.stop();
    if (!mounted) return;
    setState(() {
      _isRecording = false;
      _recordingStartedAt = null;
      _slideCancelOffset = 0;
    });
    if (cancelled || path == null) {
      if (path != null) {
        // Best-effort file cleanup.
        try {
          final f = File(path);
          if (await f.exists()) await f.delete();
        } catch (_) {}
      }
      return;
    }
    // Upload and send.
    final file = File(path);
    try {
      final uploaded =
          await ref.read(chatGroupsServiceProvider).uploadMedia(file);
      if (uploaded == null) throw Exception('upload failed');
      await ref.read(chatGroupsServiceProvider).sendMessage(
            widget.groupId,
            mediaUrl: uploaded.publicUrl,
            mediaType: 'audio',
          );
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Could not send voice note.'),
              behavior: SnackBarBehavior.floating),
        );
      }
    } finally {
      try {
        if (await file.exists()) await file.delete();
      } catch (_) {}
    }
  }

  // ── Mention picker ─────────────────────────────────────────────────────

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

  // ── Send / edit / delete ───────────────────────────────────────────────

  Future<void> _send() async {
    final body = _composerCtl.text.trim();
    final hasMedia = _pendingMediaUrl != null && !_pendingUploading;
    if (body.isEmpty && !hasMedia) return;
    if (_editing != null && body.isEmpty) return;

    final finalMentions = <String>[];
    _mentionsInserted.forEach((memberId, firstName) {
      final re = RegExp(
          r'(^|\s)@' + RegExp.escape(firstName) + r'(\s|$|[^A-Za-z0-9_])');
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
              mentionedMemberIds:
                  finalMentions.isEmpty ? null : finalMentions,
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
          const SnackBar(
              content: Text('Failed to send.'),
              behavior: SnackBarBehavior.floating),
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

  // ── Search / info / forward / jump-to-parent ───────────────────────────

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

  /// Scrolls the list to the message with the given id, briefly
  /// highlighting it. Falls back to paginating older messages if the
  /// parent isn't in the currently-loaded window (up to 6 more pages).
  Future<void> _jumpToMessage(String messageId) async {
    for (var attempt = 0; attempt < 6; attempt++) {
      final state =
          ref.read(chatGroupMessagesNotifierProvider(widget.groupId)).valueOrNull;
      if (state == null) return;
      final foundAt = state.messages.indexWhere((m) => m.id == messageId);
      if (foundAt >= 0) {
        // reverse:true → visible index i corresponds to message at
        // state.messages.length - 1 - i.
        final visibleIndex = state.messages.length - 1 - foundAt;
        if (_itemScrollController.isAttached) {
          _itemScrollController.scrollTo(
            index: visibleIndex,
            duration: const Duration(milliseconds: 400),
            curve: Curves.easeInOut,
            alignment: 0.3,
          );
        }
        setState(() => _highlightedMessageId = messageId);
        _highlightTimer?.cancel();
        _highlightTimer = Timer(const Duration(milliseconds: 900), () {
          if (mounted) setState(() => _highlightedMessageId = null);
        });
        return;
      }
      // Not found yet — try loading older messages.
      if (!state.hasMore) return;
      await ref
          .read(chatGroupMessagesNotifierProvider(widget.groupId).notifier)
          .loadMore();
    }
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
              content: const Text(
                  "You'll stop receiving messages from this group."),
              actions: [
                TextButton(
                    onPressed: () => Navigator.pop(ctx, false),
                    child: const Text('Cancel')),
                TextButton(
                    onPressed: () => Navigator.pop(ctx, true),
                    child: const Text('Leave')),
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

  Future<void> _openForwardSheet(String messageId) async {
    final count = await showModalBottomSheet<int>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => ForwardPickerSheet(
        sourceGroupId: widget.groupId,
        messageId: messageId,
      ),
    );
    if (!mounted || count == null || count <= 0) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Forwarded to $count ${count == 1 ? "group" : "groups"}'),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  // ── Build ──────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final detailAsync = ref.watch(chatGroupDetailProvider(widget.groupId));
    final messagesAsync =
        ref.watch(chatGroupMessagesNotifierProvider(widget.groupId));
    final presenceAsync =
        ref.watch(chatGroupPresenceProvider(widget.groupId));
    final me = ref.watch(meNotifierProvider).valueOrNull;
    final pinnedAsync = ref.watch(chatGroupPinnedProvider(widget.groupId));
    final starredIds =
        ref.watch(groupStarredIdsProvider(widget.groupId)).valueOrNull ??
            const <String>{};

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
          // Pinned strip (only when pinned messages exist).
          pinnedAsync.when(
            data: (pinned) => pinned.isEmpty
                ? const SizedBox.shrink()
                : _PinnedStrip(
                    messages: pinned,
                    onTap: (id) => _jumpToMessage(id),
                  ),
            loading: () => const SizedBox.shrink(),
            error: (_, __) => const SizedBox.shrink(),
          ),
          Expanded(
            child: messagesAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => Center(
                child: Text('Could not load messages.',
                    style: TextStyle(color: tokens.textSecondary)),
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
                final total = state.messages.length +
                    (state.loadingMore ? 1 : 0);
                return ScrollablePositionedList.builder(
                  itemScrollController: _itemScrollController,
                  itemPositionsListener: _itemPositionsListener,
                  reverse: true,
                  padding: const EdgeInsets.symmetric(
                      horizontal: 8, vertical: 8),
                  itemCount: total,
                  itemBuilder: (ctx, i) {
                    if (state.loadingMore && i == state.messages.length) {
                      return const Padding(
                        padding: EdgeInsets.all(12),
                        child: Center(
                            child:
                                CircularProgressIndicator(strokeWidth: 2)),
                      );
                    }
                    final idx = state.messages.length - 1 - i;
                    final msg = state.messages[idx];
                    final prev =
                        idx > 0 ? state.messages[idx - 1] : null;
                    final showSender = !msg.isDeleted &&
                        (prev == null ||
                            prev.senderMemberId != msg.senderMemberId);
                    final isMine =
                        me != null && msg.senderMemberId == me.id;
                    final isStarred = starredIds.contains(msg.id);
                    final highlighted =
                        _highlightedMessageId != null &&
                            _highlightedMessageId == msg.id;
                    return _MessageBubble(
                      key: ValueKey('msg-${msg.id}'),
                      message: msg,
                      isMine: isMine,
                      showSender: showSender,
                      otherMemberIds: otherMemberIds,
                      isStarred: isStarred,
                      highlighted: highlighted,
                      onReplyJump: () => _jumpToMessage(msg.replyToId!),
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
                      onDelete: (forEveryone) =>
                          _delete(msg.id, forEveryone: forEveryone),
                      onReact: (emoji) => _toggleReaction(msg.id, emoji),
                      onCopy: msg.body != null && msg.body!.isNotEmpty
                          ? () async {
                              await Clipboard.setData(
                                  ClipboardData(text: msg.body!));
                              if (context.mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text('Copied'),
                                    behavior: SnackBarBehavior.floating,
                                    duration: Duration(seconds: 1),
                                  ),
                                );
                              }
                            }
                          : null,
                      onForward: () => _openForwardSheet(msg.id),
                      onToggleStar: () async {
                        try {
                          await ref
                              .read(groupStarredIdsProvider(widget.groupId)
                                  .notifier)
                              .toggle(msg.id, star: !isStarred);
                        } catch (_) {}
                      },
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
    final muteState = ref.watch(groupMuteProvider(widget.groupId));
    return AppBar(
      backgroundColor: tokens.bgSurface,
      elevation: 0.5,
      iconTheme: IconThemeData(color: tokens.textPrimary),
      titleSpacing: 0,
      title: detailAsync.when(
        loading: () => Text('Loading…',
            style: TextStyle(color: tokens.textPrimary, fontSize: 14)),
        error: (_, __) => Text('Group',
            style: TextStyle(color: tokens.textPrimary, fontSize: 14)),
        data: (detail) {
          final onlineOthers = detail.members.where((m) {
            if (m.id == ref.read(meNotifierProvider).valueOrNull?.id) {
              return false;
            }
            return presenceAsync.valueOrNull?[m.id] == true;
          }).length;
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
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              detail.name,
                              style: TextStyle(
                                  color: tokens.textPrimary,
                                  fontSize: 15,
                                  fontWeight: FontWeight.w700),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          if (muteState.isMuted) ...[
                            const SizedBox(width: 6),
                            Icon(Icons.notifications_off_outlined,
                                size: 14, color: tokens.textMuted),
                          ],
                        ],
                      ),
                      Text(
                        onlineOthers > 0
                            ? '${detail.members.length} members · $onlineOthers online'
                            : '${detail.members.length} members',
                        style:
                            TextStyle(color: tokens.textMuted, fontSize: 11),
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
        PopupMenuButton<String>(
          tooltip: 'More',
          icon: Icon(Icons.more_vert, color: tokens.textPrimary),
          color: tokens.bgSurface,
          onSelected: (v) async {
            if (v == 'mute') {
              _openMutePicker();
            } else if (v == 'info') {
              final detail = detailAsync.valueOrNull;
              if (detail != null) _openInfoSheet(context, detail);
            }
          },
          itemBuilder: (_) => [
            PopupMenuItem(
              value: 'info',
              child: Row(
                children: [
                  Icon(Icons.info_outline,
                      size: 18, color: tokens.textPrimary),
                  const SizedBox(width: 10),
                  Text('Group info',
                      style:
                          TextStyle(color: tokens.textPrimary, fontSize: 13)),
                ],
              ),
            ),
            PopupMenuItem(
              value: 'mute',
              child: Row(
                children: [
                  Icon(
                    muteState.isMuted
                        ? Icons.notifications_active_outlined
                        : Icons.notifications_off_outlined,
                    size: 18,
                    color: tokens.textPrimary,
                  ),
                  const SizedBox(width: 10),
                  Text(
                    muteState.isMuted ? 'Unmute' : 'Mute notifications',
                    style:
                        TextStyle(color: tokens.textPrimary, fontSize: 13),
                  ),
                ],
              ),
            ),
          ],
        ),
      ],
    );
  }

  Future<void> _openMutePicker() async {
    final tokens = context.tokens;
    final muteNotifier = ref.read(groupMuteProvider(widget.groupId).notifier);
    final current = ref.read(groupMuteProvider(widget.groupId));
    final selection = await showModalBottomSheet<_MuteChoice>(
      context: context,
      backgroundColor: tokens.bgSurface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (bs) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
              child: Text(
                current.isMuted
                    ? 'Muted until ${DateFormat.yMMMd().add_jm().format(current.until!)}'
                    : 'Mute notifications',
                style: TextStyle(
                  color: tokens.textPrimary,
                  fontWeight: FontWeight.w700,
                  fontSize: 14,
                ),
              ),
            ),
            const Divider(height: 1),
            _muteOption(bs, '8 hours', _MuteChoice.eightHours),
            _muteOption(bs, '1 week', _MuteChoice.oneWeek),
            _muteOption(bs, 'Always', _MuteChoice.always),
            if (current.isMuted)
              _muteOption(bs, 'Unmute', _MuteChoice.unmute, danger: true),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
    if (selection == null) return;
    try {
      final until = switch (selection) {
        _MuteChoice.eightHours =>
          DateTime.now().add(const Duration(hours: 8)),
        _MuteChoice.oneWeek => DateTime.now().add(const Duration(days: 7)),
        // "Always" = far-future date the backend will treat as indefinite.
        _MuteChoice.always => DateTime(2099),
        _MuteChoice.unmute => null,
      };
      await muteNotifier.setMuted(until);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(until == null ? 'Unmuted' : 'Muted'),
            behavior: SnackBarBehavior.floating,
            duration: const Duration(seconds: 1),
          ),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Could not update mute preference.'),
              behavior: SnackBarBehavior.floating),
        );
      }
    }
  }

  Widget _muteOption(BuildContext bs, String label, _MuteChoice choice,
      {bool danger = false}) {
    final tokens = context.tokens;
    return ListTile(
      title: Text(
        label,
        style: TextStyle(
          color: danger ? const Color(0xFFEF4444) : tokens.textPrimary,
          fontSize: 14,
        ),
      ),
      onTap: () => Navigator.pop(bs, choice),
    );
  }

  // ── Composer ───────────────────────────────────────────────────────────

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
          border: Border(
              top: BorderSide(color: tokens.borderCard, width: 0.5)),
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
                label:
                    'Replying to ${_replyingTo!.sender?.displayName ?? "Member"}',
                subLabel: _replyingTo!.body ??
                    '📎 ${_replyingTo!.mediaType ?? "media"}',
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
            if (_isRecording)
              _RecordingIndicator(
                elapsed: _recordingElapsed,
                slideOffset: _slideCancelOffset,
                cancelled: _recordingCancelled,
              )
            else
              Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    IconButton(
                      icon: const Icon(Icons.attach_file_rounded),
                      color: tokens.textMuted,
                      onPressed:
                          _pendingMediaFile != null ? null : _pickMedia,
                    ),
                    Expanded(
                      child: TextField(
                        controller: _composerCtl,
                        focusNode: _composerFocus,
                        minLines: 1,
                        maxLines: 5,
                        style: TextStyle(
                            color: tokens.textPrimary, fontSize: 14),
                        decoration: InputDecoration(
                          hintText: _pendingMediaFile != null
                              ? 'Add a caption…'
                              : 'Type a message… (@ to mention)',
                          hintStyle: TextStyle(
                              color: tokens.textMuted, fontSize: 13),
                          filled: true,
                          fillColor: tokens.bgInput,
                          contentPadding: const EdgeInsets.symmetric(
                              horizontal: 14, vertical: 10),
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
                    _SendOrMicButton(
                      hasTextOrMedia: _composerCtl.text.trim().isNotEmpty ||
                          (_pendingMediaUrl != null && !_pendingUploading),
                      onSend: _send,
                      onMicStart: _startRecording,
                      onMicStop: ({required cancel}) =>
                          _stopRecording(cancelled: cancel),
                      onSlideUpdate: (dx) =>
                          setState(() => _slideCancelOffset = dx),
                      onCancelRecord: () {
                        setState(() => _recordingCancelled = true);
                        _stopRecording(cancelled: true);
                      },
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

// ── Composer support widgets ────────────────────────────────────────────────

enum _MuteChoice { eightHours, oneWeek, always, unmute }

class _SendOrMicButton extends StatefulWidget {
  const _SendOrMicButton({
    required this.hasTextOrMedia,
    required this.onSend,
    required this.onMicStart,
    required this.onMicStop,
    required this.onSlideUpdate,
    required this.onCancelRecord,
  });
  final bool hasTextOrMedia;
  final VoidCallback onSend;
  final Future<void> Function() onMicStart;
  final Future<void> Function({required bool cancel}) onMicStop;
  final void Function(double dx) onSlideUpdate;
  final VoidCallback onCancelRecord;

  @override
  State<_SendOrMicButton> createState() => _SendOrMicButtonState();
}

class _SendOrMicButtonState extends State<_SendOrMicButton> {
  bool _recording = false;
  double _dx = 0;

  @override
  Widget build(BuildContext context) {
    final iconIsSend = widget.hasTextOrMedia;
    return GestureDetector(
      onTap: iconIsSend ? widget.onSend : null,
      onLongPressStart: iconIsSend
          ? null
          : (_) async {
              setState(() {
                _recording = true;
                _dx = 0;
              });
              await widget.onMicStart();
            },
      onLongPressMoveUpdate: iconIsSend
          ? null
          : (d) {
              setState(() => _dx = math.min(0, d.offsetFromOrigin.dx));
              widget.onSlideUpdate(_dx.abs());
            },
      onLongPressEnd: iconIsSend
          ? null
          : (_) async {
              final cancel = _dx.abs() > 100;
              setState(() {
                _recording = false;
                _dx = 0;
              });
              await widget.onMicStop(cancel: cancel);
            },
      child: Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          color: _recording ? const Color(0xFFEF4444) : kColorAccent,
          borderRadius: BorderRadius.circular(22),
        ),
        alignment: Alignment.center,
        child: Icon(
          iconIsSend
              ? Icons.send_rounded
              : (_recording ? Icons.mic : Icons.mic_none_rounded),
          color: Colors.white,
          size: 20,
        ),
      ),
    );
  }
}

class _RecordingIndicator extends StatelessWidget {
  const _RecordingIndicator({
    required this.elapsed,
    required this.slideOffset,
    required this.cancelled,
  });
  final Duration elapsed;
  final double slideOffset;
  final bool cancelled;
  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final total = elapsed.inSeconds;
    final mm = (total ~/ 60).toString().padLeft(2, '0');
    final ss = (total % 60).toString().padLeft(2, '0');
    final cancelHint = slideOffset > 100 || cancelled;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          Container(
            width: 10,
            height: 10,
            decoration: const BoxDecoration(
                color: Color(0xFFEF4444), shape: BoxShape.circle),
          ),
          const SizedBox(width: 8),
          Text(
            '$mm:$ss',
            style: TextStyle(
              color: tokens.textPrimary,
              fontFeatures: const [FontFeature.tabularFigures()],
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Text(
              cancelHint
                  ? 'Release to cancel'
                  : '◀  Slide to cancel',
              style: TextStyle(
                color: cancelHint ? const Color(0xFFEF4444) : tokens.textMuted,
                fontSize: 12,
                fontWeight: cancelHint ? FontWeight.w700 : FontWeight.normal,
              ),
              textAlign: TextAlign.center,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Pinned strip ────────────────────────────────────────────────────────────

class _PinnedStrip extends StatelessWidget {
  const _PinnedStrip({required this.messages, required this.onTap});
  final List<ChatGroupMessage> messages;
  final void Function(String messageId) onTap;
  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    // Show the first (most-recently pinned by API convention).
    final first = messages.first;
    final preview = first.deletedForEveryone
        ? 'message deleted'
        : (first.body ??
            (first.mediaType != null ? '📎 ${first.mediaType}' : '…'));
    return Material(
      color: tokens.bgSurface,
      child: InkWell(
        onTap: () => onTap(first.id),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            border: Border(
              left: const BorderSide(color: kColorAccent, width: 3),
              bottom: BorderSide(color: tokens.borderCard, width: 0.5),
            ),
          ),
          child: Row(
            children: [
              Icon(Icons.push_pin_rounded,
                  size: 14, color: kColorAccent),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      messages.length == 1
                          ? 'Pinned message'
                          : 'Pinned · ${messages.length}',
                      style: const TextStyle(
                        color: kColorAccent,
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      preview,
                      style: TextStyle(
                        color: tokens.textPrimary,
                        fontSize: 12,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
            ],
          ),
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
      child: Icon(Icons.groups_rounded,
          color: tokens.textMuted, size: size * 0.55),
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
                Text(label,
                    style: const TextStyle(
                        color: kColorAccent,
                        fontSize: 11,
                        fontWeight: FontWeight.w700)),
                if (subLabel != null)
                  Text(subLabel!,
                      style:
                          TextStyle(color: tokens.textMuted, fontSize: 11),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis),
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
            child: Text(name,
                style:
                    TextStyle(color: tokens.textPrimary, fontSize: 12),
                maxLines: 1,
                overflow: TextOverflow.ellipsis),
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
        style: TextStyle(
            color: Colors.white,
            fontSize: size * 0.4,
            fontWeight: FontWeight.w700),
      ),
    );
  }
}

// ── Deterministic per-sender colour palette ─────────────────────────────────

const List<Color> _kSenderPalette = [
  Color(0xFF4F8EF7), // blue
  Color(0xFF43A047), // green
  Color(0xFFE67E22), // orange
  Color(0xFF9B59B6), // purple
  Color(0xFF16A085), // teal
  Color(0xFFD35400), // burnt orange
  Color(0xFF2C82C9), // sky
  Color(0xFF8E44AD), // deep purple
];

Color _senderColour(String memberId) {
  if (memberId.isEmpty) return kColorAccent;
  var hash = 0;
  for (final c in memberId.codeUnits) {
    hash = (hash * 31 + c) & 0x7fffffff;
  }
  return _kSenderPalette[hash % _kSenderPalette.length];
}

// ── Message bubble ─────────────────────────────────────────────────────────

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({
    super.key,
    required this.message,
    required this.isMine,
    required this.showSender,
    required this.otherMemberIds,
    required this.isStarred,
    required this.highlighted,
    required this.onReplyJump,
    required this.onReply,
    required this.onEdit,
    required this.onDelete,
    required this.onReact,
    required this.onCopy,
    required this.onForward,
    required this.onToggleStar,
  });
  final ChatGroupMessage message;
  final bool isMine;
  final bool showSender;
  final List<String> otherMemberIds;
  final bool isStarred;
  final bool highlighted;
  final VoidCallback onReplyJump;
  final VoidCallback onReply;
  final VoidCallback onEdit;
  final void Function(bool forEveryone) onDelete;
  final void Function(String emoji) onReact;
  final VoidCallback? onCopy;
  final VoidCallback onForward;
  final VoidCallback onToggleStar;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final baseBg = isMine
        ? kColorAccent.withValues(alpha: 0.10)
        : tokens.bgSurface;
    final bg = highlighted
        ? const Color(0xFFF5B301).withValues(alpha: 0.24)
        : baseBg;
    final border = isMine
        ? kColorAccent.withValues(alpha: 0.30)
        : tokens.borderCard;
    final time = DateFormat.jm().format(message.createdAt.toLocal());

    final readSet = message.readByMemberIds.toSet();
    final readByOthers = otherMemberIds.where(readSet.contains).length;
    final readByAll = isMine &&
        otherMemberIds.isNotEmpty &&
        readByOthers >= otherMemberIds.length;
    final readByAny = isMine && readByOthers > 0;

    final senderColour = message.senderMemberId != null
        ? _senderColour(message.senderMemberId!)
        : kColorAccent;

    return Align(
      alignment: isMine ? Alignment.centerRight : Alignment.centerLeft,
      child: ConstrainedBox(
        constraints:
            BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.82),
        child: GestureDetector(
          onLongPress: () => _openActionSheet(context),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 400),
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
            padding:
                const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                if (message.isForwarded && !message.isDeleted)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 2),
                    child: Row(
                      children: [
                        Icon(Icons.forward_rounded,
                            size: 12, color: tokens.textMuted),
                        const SizedBox(width: 4),
                        Text(
                          'Forwarded',
                          style: TextStyle(
                            color: tokens.textMuted,
                            fontSize: 10,
                            fontStyle: FontStyle.italic,
                          ),
                        ),
                      ],
                    ),
                  ),
                if (showSender && !isMine && !message.isDeleted)
                  Text(
                    message.sender?.displayName ?? 'Member',
                    style: TextStyle(
                      color: senderColour,
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                if (message.replyTo != null && !message.isDeleted)
                  GestureDetector(
                    onTap: onReplyJump,
                    child: _ReplyQuote(reply: message.replyTo!),
                  ),
                if (message.mediaUrl != null && !message.isDeleted)
                  _MediaContent(
                    url: message.mediaUrl!,
                    type: message.mediaType ?? 'document',
                  ),
                if (message.isDeleted)
                  Text(
                    message.deletedForEveryone
                        ? 'This message was deleted'
                        : 'You deleted this message',
                    style: TextStyle(
                        color: tokens.textMuted,
                        fontStyle: FontStyle.italic,
                        fontSize: 12),
                  )
                else if (message.body != null && message.body!.isNotEmpty)
                  _BodyText(
                    text: message.body!,
                    textStyle: TextStyle(
                        color: tokens.textPrimary,
                        fontSize: 14,
                        height: 1.35),
                  ),
                if (message.reactions.isNotEmpty)
                  _Reactions(
                    reactions: message.reactions,
                    onTap: () => _showReactionsSheet(context),
                  ),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Spacer(),
                    if (message.isPinned && !message.isDeleted) ...[
                      Icon(Icons.push_pin_rounded,
                          size: 11, color: tokens.textMuted),
                      const SizedBox(width: 3),
                    ],
                    if (isStarred && !message.isDeleted) ...[
                      const Icon(Icons.star_rounded,
                          size: 12, color: Color(0xFFF5B301)),
                      const SizedBox(width: 3),
                    ],
                    if (message.editedAt != null && !message.isDeleted)
                      Text('edited · ',
                          style: TextStyle(
                              color: tokens.textMuted, fontSize: 10)),
                    Text(time,
                        style: TextStyle(
                            color: tokens.textMuted, fontSize: 10)),
                    if (isMine && !message.isDeleted) ...[
                      const SizedBox(width: 4),
                      Icon(
                        readByAny || readByAll
                            ? Icons.done_all_rounded
                            : Icons.done_rounded,
                        size: 12,
                        color: readByAll
                            ? kColorAccent
                            : const Color(0xFF94A3B8),
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

  void _showReactionsSheet(BuildContext ctx) {
    final tokens = ctx.tokens;
    // Group reactions by emoji so we can list who used each.
    final byEmoji = <String, List<ChatGroupReaction>>{};
    for (final r in message.reactions) {
      byEmoji.putIfAbsent(r.emoji, () => []).add(r);
    }
    showModalBottomSheet<void>(
      context: ctx,
      backgroundColor: tokens.bgSurface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 12),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Text(
                  'REACTIONS',
                  style: TextStyle(
                    fontFamily: 'Rajdhani',
                    color: tokens.textMuted,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.4,
                  ),
                ),
              ),
              const SizedBox(height: 10),
              ...byEmoji.entries.expand((entry) {
                return entry.value.map((r) {
                  final photo = r.profilePhotoUrl;
                  final name = r.memberName ?? 'Member';
                  return ListTile(
                    dense: true,
                    leading: SizedBox(
                      width: 40,
                      height: 40,
                      child: Stack(
                        clipBehavior: Clip.none,
                        children: [
                          CircleAvatar(
                            radius: 18,
                            backgroundColor: tokens.bgInput,
                            backgroundImage:
                                photo != null && photo.isNotEmpty
                                    ? NetworkImage(photo)
                                    : null,
                            child: (photo == null || photo.isEmpty)
                                ? Text(
                                    name.isNotEmpty
                                        ? name[0].toUpperCase()
                                        : '?',
                                    style: TextStyle(
                                      color: tokens.textPrimary,
                                      fontSize: 14,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  )
                                : null,
                          ),
                          Positioned(
                            right: -4,
                            bottom: -4,
                            child: Text(entry.key,
                                style: const TextStyle(fontSize: 16)),
                          ),
                        ],
                      ),
                    ),
                    title: Text(
                      name,
                      style: TextStyle(
                        color: tokens.textPrimary,
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  );
                });
              }),
              const SizedBox(height: 6),
            ],
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
                padding:
                    const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: ['👍', '❤️', '😂', '😮', '😢', '🙏']
                      .map((e) => GestureDetector(
                            onTap: () {
                              Navigator.pop(bs);
                              onReact(e);
                            },
                            child: Text(e,
                                style: const TextStyle(fontSize: 24)),
                          ))
                      .toList(),
                ),
              ),
              const Divider(height: 1),
              // Order matches WhatsApp: Reply, React (bar above), Copy,
              // Forward, Star, Info(*omitted*), Edit(own), Delete.
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
              ListTile(
                leading: const Icon(Icons.forward_rounded),
                title: const Text('Forward'),
                onTap: () {
                  Navigator.pop(bs);
                  onForward();
                },
              ),
              ListTile(
                leading: Icon(
                  isStarred
                      ? Icons.star_rounded
                      : Icons.star_outline_rounded,
                  color: isStarred ? const Color(0xFFF5B301) : null,
                ),
                title: Text(isStarred ? 'Unstar' : 'Star'),
                onTap: () {
                  Navigator.pop(bs);
                  onToggleStar();
                },
              ),
              if (isMine &&
                  message.mediaUrl == null &&
                  message.body != null)
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
                  leading: const Icon(Icons.delete_forever_rounded,
                      color: Color(0xFFEF4444)),
                  title: const Text('Delete for everyone',
                      style: TextStyle(color: Color(0xFFEF4444))),
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
            style: const TextStyle(
                color: kColorAccent,
                fontSize: 10,
                fontWeight: FontWeight.w700),
          ),
          Text(
            reply.deletedForEveryone
                ? 'message deleted'
                : reply.body ??
                    (reply.mediaType != null ? '📎 ${reply.mediaType}' : '…'),
            style: TextStyle(color: tokens.textMuted, fontSize: 11),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}

// ── Media content — image (tap → fullscreen), video (tap → player),
//                    audio (in-line playback), document (external open) ────

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
        child: GestureDetector(
          onTap: () =>
              FullscreenImageViewer.open(context, urls: [url], initialIndex: 0),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: CachedNetworkImage(
              imageUrl: url,
              fit: BoxFit.cover,
              width: 240,
              errorWidget: (_, __, ___) =>
                  Icon(Icons.image_not_supported, color: tokens.textMuted),
            ),
          ),
        ),
      );
    }
    if (type == 'audio') {
      return _AudioBubble(url: url);
    }
    // Video / document → tap to open.
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Material(
        color: tokens.bgInput,
        borderRadius: BorderRadius.circular(8),
        child: InkWell(
          borderRadius: BorderRadius.circular(8),
          onTap: () async {
            if (type == 'video') {
              await VideoViewer.open(context, url);
            } else {
              final uri = Uri.tryParse(url);
              if (uri != null) {
                await launchUrl(uri, mode: LaunchMode.externalApplication);
              }
            }
          },
          child: Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: tokens.borderCard),
            ),
            child: Row(
              children: [
                Icon(
                  type == 'video'
                      ? Icons.play_circle_outline_rounded
                      : Icons.insert_drive_file_rounded,
                  color: tokens.textPrimary,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    url.split('/').last,
                    style:
                        TextStyle(color: tokens.textPrimary, fontSize: 12),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                Icon(Icons.open_in_new_rounded,
                    size: 14, color: tokens.textMuted),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Inline voice-note bubble — play/pause + tabular timer + fake waveform.
class _AudioBubble extends StatefulWidget {
  const _AudioBubble({required this.url});
  final String url;
  @override
  State<_AudioBubble> createState() => _AudioBubbleState();
}

class _AudioBubbleState extends State<_AudioBubble> {
  final _player = AudioPlayer();
  StreamSubscription<Duration>? _posSub;
  StreamSubscription<PlayerState>? _stateSub;
  Duration _pos = Duration.zero;
  Duration _dur = Duration.zero;
  bool _playing = false;
  bool _loading = false;
  bool _initialised = false;

  @override
  void dispose() {
    _posSub?.cancel();
    _stateSub?.cancel();
    _player.dispose();
    super.dispose();
  }

  Future<void> _toggle() async {
    if (!_initialised) {
      setState(() => _loading = true);
      try {
        await _player.setUrl(widget.url);
        final d = _player.duration;
        if (d != null) _dur = d;
        _initialised = true;
      } catch (_) {
        setState(() => _loading = false);
        return;
      }
      _posSub = _player.positionStream.listen((p) {
        if (mounted) setState(() => _pos = p);
      });
      _stateSub = _player.playerStateStream.listen((s) {
        if (!mounted) return;
        setState(() {
          _playing = s.playing && s.processingState != ProcessingState.completed;
          _loading = s.processingState == ProcessingState.loading ||
              s.processingState == ProcessingState.buffering;
        });
        if (s.processingState == ProcessingState.completed) {
          _player.seek(Duration.zero);
          _player.pause();
        }
      });
    }
    if (_playing) {
      await _player.pause();
    } else {
      await _player.play();
    }
  }

  String _mmss(Duration d) {
    final m = d.inMinutes.remainder(60).toString().padLeft(2, '0');
    final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final pct = (_dur.inMilliseconds == 0)
        ? 0.0
        : (_pos.inMilliseconds / _dur.inMilliseconds).clamp(0.0, 1.0);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
        decoration: BoxDecoration(
          color: tokens.bgInput,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: tokens.borderCard),
        ),
        child: Row(
          children: [
            InkWell(
              onTap: _toggle,
              customBorder: const CircleBorder(),
              child: Container(
                width: 32,
                height: 32,
                decoration: const BoxDecoration(
                  color: kColorAccent,
                  shape: BoxShape.circle,
                ),
                alignment: Alignment.center,
                child: _loading
                    ? const SizedBox(
                        width: 14,
                        height: 14,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : Icon(
                        _playing
                            ? Icons.pause_rounded
                            : Icons.play_arrow_rounded,
                        color: Colors.white,
                        size: 20,
                      ),
              ),
            ),
            const SizedBox(width: 10),
            SizedBox(
              width: 120,
              height: 26,
              child: _Waveform(progress: pct),
            ),
            const SizedBox(width: 10),
            Text(
              _mmss(_pos == Duration.zero ? _dur : _pos),
              style: TextStyle(
                color: tokens.textMuted,
                fontSize: 10,
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Static waveform placeholder — 24 sine-shaped bars that fill to
/// [progress] (0..1). Actual per-file amplitude analysis is P2.
class _Waveform extends StatelessWidget {
  const _Waveform({required this.progress});
  final double progress;
  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return LayoutBuilder(
      builder: (_, c) {
        const barCount = 24;
        final barSpacing = c.maxWidth / barCount;
        final filledCount = (progress * barCount).round();
        return Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: List.generate(barCount, (i) {
            // sine wave heights 4..22
            final h = 4 + (18 * (0.5 + 0.5 * math.sin(i * 0.6)));
            final on = i < filledCount;
            return Container(
              width: barSpacing - 2,
              height: h,
              decoration: BoxDecoration(
                color: on ? kColorAccent : tokens.textMuted.withValues(alpha: 0.35),
                borderRadius: BorderRadius.circular(1.5),
              ),
              margin: const EdgeInsets.symmetric(horizontal: 1),
            );
          }),
        );
      },
    );
  }
}

class _Reactions extends StatelessWidget {
  const _Reactions({required this.reactions, required this.onTap});
  final List<ChatGroupReaction> reactions;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final grouped = <String, int>{};
    for (final r in reactions) {
      grouped[r.emoji] = (grouped[r.emoji] ?? 0) + 1;
    }
    return Padding(
      padding: const EdgeInsets.only(top: 3),
      child: GestureDetector(
        onTap: onTap,
        onLongPress: onTap,
        child: Wrap(
          spacing: 4,
          children: grouped.entries
              .map(
                (e) => Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                  decoration: BoxDecoration(
                    color: tokens.bgInput,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: tokens.borderCard),
                  ),
                  child: Text('${e.key} ${e.value}',
                      style: const TextStyle(fontSize: 10)),
                ),
              )
              .toList(),
        ),
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
    final parts = text.split(RegExp(r'(@[A-Za-z0-9_]+)'));
    return RichText(
      text: TextSpan(
        style: textStyle,
        children: parts.map((chunk) {
          if (chunk.startsWith('@') && chunk.length > 1) {
            return TextSpan(
              text: chunk,
              style: textStyle.copyWith(
                  color: kColorAccent, fontWeight: FontWeight.w700),
            );
          }
          return TextSpan(text: chunk);
        }).toList(),
      ),
    );
  }
}
