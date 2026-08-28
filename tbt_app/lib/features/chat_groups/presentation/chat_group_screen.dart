import 'dart:async';
import 'dart:io';
import 'dart:math' as math;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:just_audio/just_audio.dart';
import 'package:path_provider/path_provider.dart';
import 'package:record/record.dart';
import 'package:scrollable_positioned_list/scrollable_positioned_list.dart';
import 'package:flutter_pdfview/flutter_pdfview.dart';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;
import 'package:url_launcher/url_launcher.dart';

import 'package:go_router/go_router.dart';

import '../../../core/constants/routes.dart';
import '../../../core/exceptions/app_exception.dart';
import '../../../features/community/presentation/image_viewer.dart';
import '../../../features/community/presentation/video_viewer.dart';
import '../../../features/support/domain/support_models.dart';
import '../../../shared/providers/me_provider.dart';
import '../../../shared/providers/socket_provider.dart';
import '../../../shared/theme/design_constants.dart';
import '../../../shared/theme/theme_tokens.dart';
import '../data/chat_groups_service.dart';
import '../domain/chat_group_message_rules.dart';
import '../domain/chat_group_models.dart';
import '../providers/chat_group_providers.dart';
import 'chat_group_info_sheet.dart';
import 'chat_group_media_preview.dart';
import 'chat_group_search_sheet.dart';
import 'forward_picker_sheet.dart';
// F-11/F-12: full emoji picker.
// ignore: depend_on_referenced_packages
import 'package:emoji_picker_flutter/emoji_picker_flutter.dart';

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
  // F-17: lock-to-record — true when user swiped up to lock recording.
  bool _recordingLocked = false;

  // Voice preview state (F-02) — path is set after stop; cleared on send/cancel.
  String? _pendingAudioPath;
  bool _pendingAudioSending = false;

  // Multi-select state (F-05). Empty set == not in selection mode.
  final Set<String> _selectedIds = {};
  bool get _inSelectionMode => _selectedIds.isNotEmpty;

  // F-10: amplitude samples captured during recording; passed to preview bar.
  final List<double> _amplitudeSamples = [];
  List<double>? _pendingAudioAmplitudes;

  // F-12: emoji keyboard panel toggle (replaces system keyboard).
  bool _showEmojiKeyboard = false;

  // F-13: index (from bottom of reversed list) where unread messages begin.
  // Set on load, cleared when user scrolls to bottom.
  int? _unreadFromIndex;

  // Message being highlighted on jump-to (fades over ~800ms).
  String? _highlightedMessageId;
  Timer? _highlightTimer;

  // Scroll-to-bottom FAB state.
  bool _showScrollToBottom = false;
  int _unreadWhileScrolled = 0;

  @override
  void initState() {
    super.initState();
    _itemPositionsListener.itemPositions.addListener(_onScrollPositions);
    _composerCtl.addListener(_onComposerChange);
    // F-12: hide emoji keyboard when the hardware keyboard claims focus.
    _composerFocus.addListener(() {
      if (_composerFocus.hasFocus && _showEmojiKeyboard) {
        setState(() => _showEmojiKeyboard = false);
      }
    });
    // F-13: capture unread count before marking as read, then mark tail read.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final groups = ref.read(myChatGroupsProvider).valueOrNull;
      if (groups != null) {
        for (final g in groups) {
          if (g.id == widget.groupId && g.unreadCount > 0) {
            setState(() => _unreadFromIndex = g.unreadCount);
            break;
          }
        }
      }
      _markTailRead();
    });
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
    final msgState = ref
        .read(chatGroupMessagesNotifierProvider(widget.groupId))
        .valueOrNull;
    if (msgState == null || msgState.messages.isEmpty) return;

    var minIndex = 999999;
    var maxIndex = 0;
    for (final p in positions) {
      if (p.index > maxIndex) maxIndex = p.index;
      if (p.index < minIndex) minIndex = p.index;
    }

    // Load more when near the oldest visible message.
    if (maxIndex >= msgState.messages.length - 5) {
      ref
          .read(chatGroupMessagesNotifierProvider(widget.groupId).notifier)
          .loadMore();
    }

    // Show scroll-to-bottom FAB when the newest message (index 0) is not visible.
    final atBottom = minIndex == 0;
    if (!atBottom != _showScrollToBottom) {
      setState(() {
        _showScrollToBottom = !atBottom;
        if (atBottom) {
          _unreadWhileScrolled = 0;
          _unreadFromIndex = null; // F-13: dismiss divider once user scrolls down
        }
      });
    }
  }

  void _scrollToBottom() {
    if (_itemScrollController.isAttached) {
      _itemScrollController.scrollTo(
        index: 0,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOut,
      );
    }
    setState(() {
      _showScrollToBottom = false;
      _unreadWhileScrolled = 0;
    });
    _markTailRead();
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

  // ── F-21: Attach sheet (file + location) ──────────────────────────────────

  void _showAttachSheet(BuildContext context, ThemeTokens tokens) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: tokens.bgSurface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 8),
            Container(
              width: 40, height: 4,
              decoration: BoxDecoration(color: tokens.borderCard, borderRadius: BorderRadius.circular(2)),
            ),
            const SizedBox(height: 8),
            ListTile(
              leading: Container(
                width: 40, height: 40,
                decoration: BoxDecoration(color: const Color(0xFF3B82F6).withValues(alpha: 0.15), shape: BoxShape.circle),
                child: const Icon(Icons.insert_drive_file_rounded, color: Color(0xFF3B82F6), size: 20),
              ),
              title: Text('Document / Media', style: TextStyle(color: tokens.textPrimary, fontSize: 14)),
              onTap: () {
                Navigator.pop(context);
                _pickMedia();
              },
            ),
            ListTile(
              leading: Container(
                width: 40, height: 40,
                decoration: BoxDecoration(color: const Color(0xFF22C55E).withValues(alpha: 0.15), shape: BoxShape.circle),
                child: const Icon(Icons.location_on_rounded, color: Color(0xFF22C55E), size: 20),
              ),
              title: Text('Location', style: TextStyle(color: tokens.textPrimary, fontSize: 14)),
              subtitle: Text('Share your current location', style: TextStyle(color: tokens.textMuted, fontSize: 12)),
              onTap: () {
                Navigator.pop(context);
                _sendLocation();
              },
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
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
      // F-14: show preview screen for images and videos.
      final ext = path.split('.').last.toLowerCase();
      final isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].contains(ext);
      final isVideo = ['mp4', 'mov', 'webm'].contains(ext);
      File uploadFile = file;
      if (isImage || isVideo) {
        if (!mounted) return;
        final result = await Navigator.of(context)
            .push<({String caption, File file})>(MaterialPageRoute(
          fullscreenDialog: true,
          builder: (_) => ChatGroupMediaPreviewScreen(
            file: file,
            mediaType: isImage ? 'image' : 'video',
          ),
        ));
        if (result == null || !mounted) return;
        uploadFile = result.file;
        if (result.caption.isNotEmpty) _composerCtl.text = result.caption;
      }
      setState(() {
        _pendingMediaFile = uploadFile;
        _pendingUploading = true;
        _pendingMediaUrl = null;
        _pendingMediaType = null;
      });
      final uploaded =
          await ref.read(chatGroupsServiceProvider).uploadMedia(uploadFile);
      if (!mounted) return;
      setState(() {
        _pendingUploading = false;
        _pendingMediaUrl = uploaded?.publicUrl;
        _pendingMediaType = uploaded?.mediaType;
      });
    } catch (_) {
      if (mounted) setState(() => _pendingUploading = false);
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

  // ── Camera capture (F-08) ──────────────────────────────────────────────────

  Future<void> _pickFromCamera() async {
    if (_pendingMediaFile != null) return;
    try {
      final xfile = await ImagePicker().pickImage(
        source: ImageSource.camera,
        imageQuality: 85,
      );
      if (xfile == null) return;
      final file = File(xfile.path);
      // F-14: show preview before upload.
      if (!mounted) return;
      final result = await Navigator.of(context)
          .push<({String caption, File file})>(MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) =>
            ChatGroupMediaPreviewScreen(file: file, mediaType: 'image'),
      ));
      if (result == null || !mounted) return;
      setState(() {
        _pendingMediaFile = result.file;
        _pendingUploading = true;
        _pendingMediaUrl = null;
        _pendingMediaType = null;
      });
      final uploaded =
          await ref.read(chatGroupsServiceProvider).uploadMedia(result.file);
      if (!mounted) return;
      setState(() {
        _pendingUploading = false;
        _pendingMediaUrl = uploaded?.publicUrl;
        _pendingMediaType = uploaded?.mediaType;
      });
      if (result.caption.isNotEmpty) _composerCtl.text = result.caption;
    } catch (_) {
      if (mounted) setState(() => _pendingUploading = false);
    }
  }

  // ── F-21: Location sharing ─────────────────────────────────────────────────

  Future<void> _sendLocation() async {
    LocationPermission perm = await Geolocator.checkPermission();
    if (perm == LocationPermission.denied) {
      perm = await Geolocator.requestPermission();
    }
    if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Location permission required')),
        );
      }
      return;
    }
    try {
      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
      );
      final lat = pos.latitude.toStringAsFixed(6);
      final lng = pos.longitude.toStringAsFixed(6);
      final mapsUrl = 'https://maps.google.com/?q=$lat,$lng';
      await ref.read(chatGroupsServiceProvider).sendMessage(
        widget.groupId,
        body: mapsUrl,
        mediaType: 'location',
        mentionedMemberIds: const [],
      );
      // Mark the tail read after sending.
      _markTailRead();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not get location')),
        );
      }
    }
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
        _recordingLocked = false;
      });
      _amplitudeSamples.clear(); // F-10: fresh slate for each recording
      _recordingTicker?.cancel();
      _recordingTicker =
          Timer.periodic(const Duration(milliseconds: 200), (_) async {
        if (!mounted || _recordingStartedAt == null) return;
        setState(() {
          _recordingElapsed =
              DateTime.now().difference(_recordingStartedAt!);
        });
        // F-10: sample amplitude (dBFS −60..0) and normalise to 0..1.
        try {
          final amp = await _recorder.getAmplitude();
          final db = amp.current.clamp(-60.0, 0.0);
          if (mounted) _amplitudeSamples.add(((db + 60) / 60).clamp(0.0, 1.0));
        } catch (_) {}
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
    // F-10: snapshot samples before clearing.
    final amplitudes =
        _amplitudeSamples.isNotEmpty ? List<double>.from(_amplitudeSamples) : null;
    _amplitudeSamples.clear();
    if (!mounted) return;
    setState(() {
      _isRecording = false;
      _recordingStartedAt = null;
      _slideCancelOffset = 0;
      _recordingLocked = false;
    });
    if (cancelled || path == null) {
      if (path != null) {
        try {
          final f = File(path);
          if (await f.exists()) await f.delete();
        } catch (_) {}
      }
      return;
    }
    // Show preview bar instead of sending immediately (F-02).
    setState(() {
      _pendingAudioPath = path;
      _pendingAudioAmplitudes = amplitudes; // F-10
    });
  }

  Future<void> _sendPendingAudio() async {
    final path = _pendingAudioPath;
    if (path == null || _pendingAudioSending) return;
    setState(() => _pendingAudioSending = true);
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
      setState(() {
        _pendingAudioPath = null;
        _pendingAudioSending = false;
        _pendingAudioAmplitudes = null; // F-10
      });
    } catch (_) {
      setState(() => _pendingAudioSending = false);
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

  Future<void> _cancelPendingAudio() async {
    final path = _pendingAudioPath;
    setState(() {
      _pendingAudioPath = null;
      _pendingAudioSending = false;
      _pendingAudioAmplitudes = null; // F-10
    });
    if (path != null) {
      try {
        final f = File(path);
        if (await f.exists()) await f.delete();
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
    } on AppException catch (e) {
      // Surfaces the backend's own message — e.g. the 5-minute edit-window
      // rejection ("Messages can only be edited within 5 minutes.") — so a
      // client whose clock disagrees with the server still sees why the
      // edit failed, instead of a generic "Failed to send."
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message), behavior: SnackBarBehavior.floating),
        );
      }
      if (_editing != null && mounted) {
        setState(() => _editing = null);
        _composerCtl.clear();
      }
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
    final msgState = ref.read(chatGroupMessagesNotifierProvider(widget.groupId)).valueOrNull;
    final msg = msgState?.messages.where((m) => m.id == messageId).firstOrNull;
    final count = await showModalBottomSheet<int>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => ForwardPickerSheet(
        sourceGroupId: widget.groupId,
        messageId: messageId,
        body: msg?.body,
        mediaUrl: msg?.mediaUrl,
        mediaType: msg?.mediaType,
      ),
    );
    if (!mounted || count == null || count <= 0) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Forwarded to $count ${count == 1 ? "recipient" : "recipients"}'),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  void _openMessageInfoSheet(BuildContext context, String messageId) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _MessageInfoSheet(
        groupId: widget.groupId,
        messageId: messageId,
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

    // Mark newest read when tail extends; accumulate unread badge if scrolled up.
    ref.listen<AsyncValue<ChatGroupMessagesState>>(
      chatGroupMessagesNotifierProvider(widget.groupId),
      (prev, next) {
        final prevLen = prev?.valueOrNull?.messages.length ?? 0;
        final nextLen = next.valueOrNull?.messages.length ?? 0;
        if (nextLen > prevLen) {
          if (_showScrollToBottom) {
            setState(() => _unreadWhileScrolled += nextLen - prevLen);
          } else {
            _markTailRead();
          }
        }
      },
    );

    return Scaffold(
      backgroundColor: tokens.bgPage,
      appBar: _inSelectionMode
          ? _buildSelectionBar(context, tokens)
          : _buildHeader(context, tokens, detailAsync, presenceAsync),
      floatingActionButton: (!_inSelectionMode && _showScrollToBottom)
          ? FloatingActionButton.small(
              heroTag: 'scroll-to-bottom',
              backgroundColor: tokens.bgSurface,
              elevation: 4,
              onPressed: _scrollToBottom,
              child: Badge(
                isLabelVisible: _unreadWhileScrolled > 0,
                label: Text('$_unreadWhileScrolled'),
                child: Icon(
                  Icons.keyboard_arrow_down_rounded,
                  color: tokens.textPrimary,
                ),
              ),
            )
          : null,
      floatingActionButtonLocation: FloatingActionButtonLocation.endFloat,
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
          // Disappearing messages banner (F-18).
          if (detailAsync.valueOrNull?.disappearingDurationSeconds != null)
            _DisappearingBanner(
              durationSeconds:
                  detailAsync.valueOrNull!.disappearingDurationSeconds!,
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
                    final isSelected = _selectedIds.contains(msg.id);
                    final bubble = _SwipeToReplyWrapper(
                      disabled: msg.isDeleted || _inSelectionMode,
                      onReply: () {
                        setState(() {
                          _replyingTo = msg;
                          _editing = null;
                        });
                        _composerFocus.requestFocus();
                      },
                      child: _MessageBubble(
                        key: ValueKey('msg-${msg.id}'),
                        message: msg,
                        isMine: isMine,
                        showSender: showSender,
                        otherMemberIds: otherMemberIds,
                        isStarred: isStarred,
                        highlighted: highlighted,
                        isSelected: isSelected,
                        inSelectionMode: _inSelectionMode,
                        onSelect: () => setState(() {
                          if (isSelected) {
                            _selectedIds.remove(msg.id);
                          } else {
                            _selectedIds.add(msg.id);
                          }
                        }),
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
                        onPinToggle: msg.isDeleted
                            ? null
                            : () async {
                                try {
                                  final svc = ref
                                      .read(chatGroupsServiceProvider);
                                  if (msg.isPinned) {
                                    await svc.unpinMessage(
                                        widget.groupId, msg.id);
                                  } else {
                                    await svc.pinMessage(
                                        widget.groupId, msg.id);
                                  }
                                } catch (_) {
                                  if (context.mounted) {
                                    ScaffoldMessenger.of(context)
                                        .showSnackBar(const SnackBar(
                                      content: Text(
                                          'Could not update pin.'),
                                      behavior:
                                          SnackBarBehavior.floating,
                                    ));
                                  }
                                }
                              },
                        onInfo: isMine && !msg.isDeleted
                            ? () => _openMessageInfoSheet(
                                context, msg.id)
                            : null,
                        onRaiseTicket: isMine && !msg.isDeleted && !msg.isSystem
                            ? () => context.push(
                                  AppRoutes.supportContact,
                                  extra: ChatMessageTicketContext(
                                    groupId: widget.groupId,
                                    groupName: detail?.name ?? 'Group',
                                    messageId: msg.id,
                                    messageBody: msg.body,
                                    messageMediaType: msg.mediaType,
                                    senderName: msg.sender?.displayName,
                                  ),
                                )
                            : null,
                      ),
                    );
                    // F-13: insert unread separator below the first read message.
                    if (_unreadFromIndex != null &&
                        i == _unreadFromIndex! &&
                        _unreadFromIndex! < state.messages.length) {
                      return Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          bubble,
                          _UnreadDivider(count: _unreadFromIndex!),
                        ],
                      );
                    }
                    return bubble;
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

  // ── F-05 Selection mode ────────────────────────────────────────────────

  PreferredSizeWidget _buildSelectionBar(BuildContext context, ThemeTokens tokens) {
    final n = _selectedIds.length;
    return AppBar(
      backgroundColor: tokens.bgSurface,
      elevation: 0.5,
      leading: IconButton(
        icon: Icon(Icons.close, color: tokens.textPrimary),
        onPressed: () => setState(() => _selectedIds.clear()),
      ),
      title: Text(
        '$n selected',
        style: TextStyle(color: tokens.textPrimary, fontSize: 16, fontWeight: FontWeight.w600),
      ),
      actions: [
        IconButton(
          icon: Icon(Icons.star_outline, color: tokens.textPrimary),
          tooltip: 'Star',
          onPressed: n == 0 ? null : _bulkStar,
        ),
        IconButton(
          icon: Icon(Icons.forward, color: tokens.textPrimary),
          tooltip: 'Forward',
          onPressed: n == 0 ? null : _bulkForward,
        ),
        IconButton(
          icon: const Icon(Icons.delete_outline, color: Colors.redAccent),
          tooltip: 'Delete',
          onPressed: n == 0 ? null : _bulkDelete,
        ),
      ],
    );
  }

  Future<void> _bulkStar() async {
    final ids = List<String>.from(_selectedIds);
    setState(() => _selectedIds.clear());
    final starredNotifier = ref.read(groupStarredIdsProvider(widget.groupId).notifier);
    await Future.wait(ids.map((id) => starredNotifier.toggle(id, star: true).catchError((_) {})));
  }

  Future<void> _bulkForward() async {
    final ids = List<String>.from(_selectedIds);
    setState(() => _selectedIds.clear());
    await showModalBottomSheet<int>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => ForwardPickerSheet(
        sourceGroupId: widget.groupId,
        messageId: ids.first,
        messageIds: ids,
      ),
    );
  }

  Future<void> _bulkDelete() async {
    final ids = List<String>.from(_selectedIds);
    final me = ref.read(meNotifierProvider).valueOrNull;
    // Determine if all selected are own — if so offer "delete for everyone".
    final msgState = ref.read(chatGroupMessagesNotifierProvider(widget.groupId)).valueOrNull;
    final allMine = msgState != null &&
        ids.every((id) => msgState.messages.any((m) => m.id == id && m.senderMemberId == me?.id));

    final confirmed = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF181818),
        title: Text('Delete ${ids.length} message${ids.length > 1 ? "s" : ""}?',
            style: const TextStyle(color: Color(0xFFf0f0f0), fontSize: 16)),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(null),
            child: const Text('Cancel', style: TextStyle(color: Color(0xFFa0a0a0))),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop('me'),
            child: const Text('Delete for me', style: TextStyle(color: Colors.redAccent)),
          ),
          if (allMine)
            TextButton(
              onPressed: () => Navigator.of(ctx).pop('everyone'),
              child: const Text('Delete for everyone', style: TextStyle(color: Colors.redAccent)),
            ),
        ],
      ),
    );
    if (confirmed == null) return;
    setState(() => _selectedIds.clear());
    final forEveryone = confirmed == 'everyone';
    final svc = ref.read(chatGroupsServiceProvider);
    await Future.wait(
      ids.map((id) => svc.deleteMessage(widget.groupId, id, forEveryone: forEveryone).catchError((_) {})),
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
                label: 'Editing message · 5-min window',
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
            if (_pendingAudioPath != null)
              _VoicePreviewBar(
                path: _pendingAudioPath!,
                sending: _pendingAudioSending,
                amplitudes: _pendingAudioAmplitudes,
                onSend: _sendPendingAudio,
                onCancel: _cancelPendingAudio,
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
                locked: _recordingLocked,
                onStop: _recordingLocked
                    ? () => _stopRecording(cancelled: false)
                    : null,
              )
            else ...[
              Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    IconButton(
                      icon: const Icon(Icons.camera_alt_rounded),
                      color: tokens.textMuted,
                      onPressed:
                          _pendingMediaFile != null ? null : _pickFromCamera,
                    ),
                    IconButton(
                      icon: const Icon(Icons.attach_file_rounded),
                      color: tokens.textMuted,
                      onPressed: _pendingMediaFile != null
                          ? null
                          : () => _showAttachSheet(context, tokens),
                    ),
                    // F-12: emoji keyboard toggle.
                    IconButton(
                      icon: Icon(
                        _showEmojiKeyboard
                            ? Icons.keyboard_rounded
                            : Icons.emoji_emotions_outlined,
                        color: tokens.textMuted,
                      ),
                      onPressed: () {
                        final showing = !_showEmojiKeyboard;
                        setState(() => _showEmojiKeyboard = showing);
                        if (showing) {
                          _composerFocus.unfocus();
                        } else {
                          _composerFocus.requestFocus();
                        }
                      },
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
                      onLock: () => setState(() => _recordingLocked = true),
                    ),
                  ],
                ),
              ),
              // F-12: emoji keyboard panel (replaces system keyboard).
              if (_showEmojiKeyboard)
                SizedBox(
                  height: 280,
                  child: EmojiPicker(
                    textEditingController: _composerCtl,
                    config: const Config(
                      height: 256,
                      checkPlatformCompatibility: true,
                    ),
                  ),
                ),
            ],
          ],
        ),
      ),
    );
  }
}

// ── Swipe-to-reply wrapper (F-01) ───────────────────────────────────────────
//
// Wraps a single message row. A rightward swipe beyond [_kThreshold] triggers
// the reply callback and springs back with an elastic animation. Does nothing
// when [disabled] (deleted messages).

class _SwipeToReplyWrapper extends StatefulWidget {
  const _SwipeToReplyWrapper({
    required this.child,
    required this.onReply,
    this.disabled = false,
  });
  final Widget child;
  final VoidCallback onReply;
  final bool disabled;

  @override
  State<_SwipeToReplyWrapper> createState() => _SwipeToReplyWrapperState();
}

class _SwipeToReplyWrapperState extends State<_SwipeToReplyWrapper>
    with SingleTickerProviderStateMixin {
  static const _kThreshold = 56.0;
  static const _kMaxDrag = 72.0;

  double _dx = 0;
  bool _hapticFired = false;
  late final AnimationController _ctrl;
  late Animation<double> _anim;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    )..addListener(() {
        if (mounted) setState(() => _dx = _anim.value);
      });
    _anim = const AlwaysStoppedAnimation(0.0);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  void _onDragUpdate(DragUpdateDetails d) {
    _ctrl.stop();
    final next = (_dx + d.delta.dx).clamp(0.0, _kMaxDrag);
    setState(() => _dx = next);
    if (next >= _kThreshold && !_hapticFired) {
      _hapticFired = true;
      HapticFeedback.mediumImpact();
    }
  }

  void _onDragEnd(DragEndDetails _) {
    if (_dx >= _kThreshold) widget.onReply();
    _hapticFired = false;
    _anim = Tween<double>(begin: _dx, end: 0).animate(
      CurvedAnimation(parent: _ctrl, curve: Curves.elasticOut),
    );
    _ctrl.forward(from: 0);
  }

  @override
  Widget build(BuildContext context) {
    final iconOpacity = (_dx / _kThreshold).clamp(0.0, 1.0);
    return GestureDetector(
      onHorizontalDragUpdate: widget.disabled ? null : _onDragUpdate,
      onHorizontalDragEnd: widget.disabled ? null : _onDragEnd,
      behavior: HitTestBehavior.translucent,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Transform.translate(
            offset: Offset(_dx, 0),
            child: widget.child,
          ),
          if (_dx > 0)
            Positioned(
              left: 4,
              top: 0,
              bottom: 0,
              child: Opacity(
                opacity: iconOpacity,
                child: Align(
                  alignment: Alignment.center,
                  child: Container(
                    width: 30,
                    height: 30,
                    decoration: BoxDecoration(
                      color: kColorAccent.withValues(alpha: 0.15),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.reply_rounded,
                      color: kColorAccent,
                      size: 16,
                    ),
                  ),
                ),
              ),
            ),
        ],
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
    required this.onLock,
  });
  final bool hasTextOrMedia;
  final VoidCallback onSend;
  final Future<void> Function() onMicStart;
  final Future<void> Function({required bool cancel}) onMicStop;
  final void Function(double dx) onSlideUpdate;
  final VoidCallback onCancelRecord;
  /// Called when user swipes up far enough to lock recording.
  final VoidCallback onLock;

  @override
  State<_SendOrMicButton> createState() => _SendOrMicButtonState();
}

class _SendOrMicButtonState extends State<_SendOrMicButton> {
  bool _recording = false;
  double _dx = 0;
  double _dy = 0;
  bool _locked = false;

  @override
  Widget build(BuildContext context) {
    final iconIsSend = widget.hasTextOrMedia;
    // Show a lock icon overlay when user has swiped up enough to nearly lock.
    final nearLock = _dy < -60 && !_locked;
    return GestureDetector(
      onTap: iconIsSend ? widget.onSend : null,
      onLongPressStart: iconIsSend
          ? null
          : (_) async {
              setState(() {
                _recording = true;
                _dx = 0;
                _dy = 0;
                _locked = false;
              });
              await widget.onMicStart();
            },
      onLongPressMoveUpdate: iconIsSend
          ? null
          : (d) {
              final newDx = math.min(0.0, d.offsetFromOrigin.dx);
              final newDy = d.offsetFromOrigin.dy;
              final wasLocked = _locked;
              final nowLocked = newDy < -80;
              setState(() {
                _dx = newDx;
                _dy = newDy;
                if (nowLocked && !wasLocked) _locked = true;
              });
              if (nowLocked && !wasLocked) {
                widget.onLock();
              } else if (!_locked) {
                widget.onSlideUpdate(_dx.abs());
              }
            },
      onLongPressEnd: iconIsSend
          ? null
          : (_) async {
              if (_locked) return; // locked — only the stop tap target can end
              final cancel = _dx.abs() > 100;
              setState(() {
                _recording = false;
                _dx = 0;
                _dy = 0;
              });
              await widget.onMicStop(cancel: cancel);
            },
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Container(
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
                  : (_recording
                      ? (_locked ? Icons.lock_rounded : Icons.mic)
                      : Icons.mic_none_rounded),
              color: Colors.white,
              size: 20,
            ),
          ),
          // Lock indicator bubble — animates up above the button.
          if (_recording && (nearLock || _locked))
            Positioned(
              bottom: 50,
              left: 0,
              right: 0,
              child: Center(
                child: Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: _locked ? const Color(0xFF22C55E) : const Color(0xFF64748B),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    _locked ? Icons.lock_rounded : Icons.lock_open_rounded,
                    color: Colors.white,
                    size: 18,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _RecordingIndicator extends StatelessWidget {
  const _RecordingIndicator({
    required this.elapsed,
    required this.slideOffset,
    required this.cancelled,
    this.locked = false,
    this.onStop,
  });
  final Duration elapsed;
  final double slideOffset;
  final bool cancelled;
  /// True when user has swiped up to lock — shows a tap-to-stop button.
  final bool locked;
  final VoidCallback? onStop;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final total = elapsed.inSeconds;
    final mm = (total ~/ 60).toString().padLeft(2, '0');
    final ss = (total % 60).toString().padLeft(2, '0');
    final cancelHint = slideOffset > 100 || cancelled;

    if (locked) {
      // Locked mode: timer + stop button (no slide hint).
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
            const Spacer(),
            GestureDetector(
              onTap: onStop,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                decoration: BoxDecoration(
                  color: kColorAccent,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.stop_rounded, color: Colors.white, size: 16),
                    SizedBox(width: 4),
                    Text('Send', style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w700)),
                  ],
                ),
              ),
            ),
          ],
        ),
      );
    }

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

// ── Disappearing messages banner (F-18) ──────────────────────────────────────

class _DisappearingBanner extends StatelessWidget {
  const _DisappearingBanner({required this.durationSeconds});
  final int durationSeconds;

  String get _label {
    if (durationSeconds < 3600) {
      final m = (durationSeconds / 60).round();
      return 'Messages disappear after $m minute${m == 1 ? "" : "s"}';
    } else if (durationSeconds < 86400) {
      final h = (durationSeconds / 3600).round();
      return 'Messages disappear after $h hour${h == 1 ? "" : "s"}';
    } else {
      final d = (durationSeconds / 86400).round();
      return 'Messages disappear after $d day${d == 1 ? "" : "s"}';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      color: const Color(0xFF1A2A1A),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      child: Row(
        children: [
          const Icon(Icons.timer_outlined, size: 14, color: Color(0xFF4ADE80)),
          const SizedBox(width: 6),
          Text(
            _label,
            style: const TextStyle(
              color: Color(0xFF4ADE80),
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
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
    required this.isSelected,
    required this.inSelectionMode,
    required this.onSelect,
    required this.onReplyJump,
    required this.onReply,
    required this.onEdit,
    required this.onDelete,
    required this.onReact,
    required this.onCopy,
    required this.onForward,
    required this.onToggleStar,
    this.onPinToggle,
    this.onInfo,
    this.onRaiseTicket,
  });
  final ChatGroupMessage message;
  final bool isMine;
  final bool showSender;
  final List<String> otherMemberIds;
  final bool isStarred;
  final bool highlighted;
  final bool isSelected;
  final bool inSelectionMode;
  final VoidCallback onSelect;
  final VoidCallback onReplyJump;
  final VoidCallback onReply;
  final VoidCallback onEdit;
  final void Function(bool forEveryone) onDelete;
  final void Function(String emoji) onReact;
  final VoidCallback? onCopy;
  final VoidCallback onForward;
  final VoidCallback onToggleStar;
  final VoidCallback? onPinToggle;
  final VoidCallback? onInfo;
  /// Null for another member's message — "Raise Ticket" is only offered to
  /// the message owner (backend re-enforces this regardless).
  final VoidCallback? onRaiseTicket;

  /// Client-side mirror of the backend's 5-minute edit window — purely a
  /// UX convenience to hide the action once it's certain to be rejected.
  /// The backend is the real gate (see chatMessageActionRules.ts).
  bool get _withinEditWindow => canEditMessageClientSide(message.createdAt);

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

    final selectionBg = isSelected
        ? kColorAccent.withValues(alpha: 0.10)
        : Colors.transparent;

    return GestureDetector(
      onTap: inSelectionMode ? onSelect : null,
      onLongPress: inSelectionMode ? onSelect : () => _openActionSheet(context),
      child: Container(
        color: selectionBg,
        child: Stack(
          children: [
            Align(
              alignment: isMine ? Alignment.centerRight : Alignment.centerLeft,
              child: ConstrainedBox(
                constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.82),
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
                if (message.linkPreview != null && !message.isDeleted)
                  _LinkPreviewCard(preview: message.linkPreview!),
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
      // Selection checkmark overlay (F-05).
      if (isSelected)
        Positioned(
          top: 6,
          left: 6,
          child: Container(
            width: 22,
            height: 22,
            decoration: const BoxDecoration(
              color: kColorAccent,
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.check_rounded, color: Colors.white, size: 14),
          ),
        ),
    ],
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
                  children: [
                    ...['👍', '❤️', '😂', '😮', '😢', '🙏']
                        .map((e) => GestureDetector(
                              onTap: () {
                                Navigator.pop(bs);
                                onReact(e);
                              },
                              child: Text(e,
                                  style: const TextStyle(fontSize: 24)),
                            )),
                    // F-11: open full emoji picker.
                    GestureDetector(
                      onTap: () {
                        Navigator.pop(bs);
                        _openEmojiReactPicker(ctx);
                      },
                      child: Container(
                        width: 34,
                        height: 34,
                        decoration: BoxDecoration(
                          color: tokens.bgInput,
                          shape: BoxShape.circle,
                          border: Border.all(color: tokens.borderCard),
                        ),
                        alignment: Alignment.center,
                        child: Icon(Icons.add_rounded,
                            size: 18, color: tokens.textMuted),
                      ),
                    ),
                  ],
                ),
              ),
              const Divider(height: 1),
              // Order matches WhatsApp: Reply, React (bar above), Copy,
              // Forward, Star, Info(*omitted*), Edit(own), Delete.
              ListTile(
                leading: const Icon(Icons.check_circle_outline_rounded),
                title: const Text('Select'),
                onTap: () {
                  Navigator.pop(bs);
                  onSelect();
                },
              ),
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
              if (onPinToggle != null)
                ListTile(
                  leading: Icon(message.isPinned
                      ? Icons.push_pin_rounded
                      : Icons.push_pin_outlined),
                  title: Text(message.isPinned ? 'Unpin' : 'Pin'),
                  onTap: () {
                    Navigator.pop(bs);
                    onPinToggle!();
                  },
                ),
              if (onInfo != null)
                ListTile(
                  leading: const Icon(Icons.info_outline_rounded),
                  title: const Text('Info'),
                  onTap: () {
                    Navigator.pop(bs);
                    onInfo!();
                  },
                ),
              if (isMine &&
                  message.mediaUrl == null &&
                  message.body != null &&
                  _withinEditWindow)
                ListTile(
                  leading: const Icon(Icons.edit_rounded),
                  title: const Text('Edit'),
                  onTap: () {
                    Navigator.pop(bs);
                    onEdit();
                  },
                ),
              if (onRaiseTicket != null)
                ListTile(
                  leading: const Icon(Icons.confirmation_num_outlined),
                  title: const Text('Raise Ticket'),
                  onTap: () {
                    Navigator.pop(bs);
                    onRaiseTicket!();
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

  // F-11: full emoji picker for reactions.
  void _openEmojiReactPicker(BuildContext ctx) {
    showModalBottomSheet<void>(
      context: ctx,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (bs) => SafeArea(
        child: SizedBox(
          height: 320,
          child: EmojiPicker(
            onEmojiSelected: (_, emoji) {
              Navigator.of(bs).pop();
              onReact(emoji.emoji);
            },
            config: const Config(
              height: 300,
              checkPlatformCompatibility: true,
            ),
          ),
        ),
      ),
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
    // F-21: Location card.
    if (type == 'location') {
      return _LocationCard(mapsUrl: url);
    }
    // Video / document → tap to open.
    final isVideo = type == 'video';
    final filename = url.split('/').last.split('?').first;
    final ext = filename.contains('.')
        ? filename.split('.').last.toLowerCase()
        : '';
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Material(
        color: tokens.bgInput,
        borderRadius: BorderRadius.circular(8),
        child: InkWell(
          borderRadius: BorderRadius.circular(8),
          onTap: () async {
            if (isVideo) {
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
                isVideo
                    ? Icon(Icons.play_circle_outline_rounded, color: tokens.textPrimary)
                    : (ext == 'pdf' ? _PdfThumbnail(url: url) : _ExtBadge(ext: ext)),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    filename.isEmpty ? url.split('/').last : filename,
                    style: TextStyle(color: tokens.textPrimary, fontSize: 12),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                Icon(Icons.open_in_new_rounded, size: 14, color: tokens.textMuted),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// F-21: Location card — static map image (when API key is set via
/// --dart-define=GOOGLE_MAPS_KEY=xxx) with coordinate fallback.
/// Taps to open in the native Maps app.
class _LocationCard extends StatelessWidget {
  const _LocationCard({required this.mapsUrl});
  final String mapsUrl;

  // Injected at build time: flutter run --dart-define=GOOGLE_MAPS_KEY=xxx
  static const _mapsKey = String.fromEnvironment('GOOGLE_MAPS_KEY');

  String get _coords {
    final q = Uri.tryParse(mapsUrl)?.queryParameters['q'] ?? '';
    return q.isEmpty ? 'Location' : q;
  }

  String? get _staticMapUrl {
    if (_mapsKey.isEmpty) return null;
    final q = Uri.tryParse(mapsUrl)?.queryParameters['q'] ?? '';
    if (q.isEmpty) return null;
    return 'https://maps.googleapis.com/maps/api/staticmap'
        '?center=$q&zoom=14&size=300x150&markers=color:red%7C$q&key=$_mapsKey';
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final staticUrl = _staticMapUrl;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () async {
          final uri = Uri.tryParse(mapsUrl);
          if (uri != null) await launchUrl(uri, mode: LaunchMode.externalApplication);
        },
        child: Container(
          width: 240,
          decoration: BoxDecoration(
            color: const Color(0xFF0D2B1A),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFF22C55E).withValues(alpha: 0.4)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Static map image — shown only when API key is set.
              if (staticUrl != null)
                ClipRRect(
                  borderRadius: const BorderRadius.vertical(top: Radius.circular(11)),
                  child: CachedNetworkImage(
                    imageUrl: staticUrl,
                    height: 110,
                    width: double.infinity,
                    fit: BoxFit.cover,
                    errorWidget: (_, __, ___) => const SizedBox.shrink(),
                  ),
                ),
              // Coordinate row — always shown.
              Padding(
                padding: const EdgeInsets.all(10),
                child: Row(
                  children: [
                    Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        color: const Color(0xFF22C55E).withValues(alpha: 0.15),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.location_on_rounded, color: Color(0xFF22C55E), size: 20),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Location',
                            style: TextStyle(
                              color: tokens.textPrimary,
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            _coords,
                            style: const TextStyle(color: Color(0xFF22C55E), fontSize: 11),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 3),
                          const Text(
                            'Tap to open in Maps',
                            style: TextStyle(color: Color(0xFF94A3B8), fontSize: 10),
                          ),
                        ],
                      ),
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

/// F-19: Lazy PDF page-1 thumbnail. Downloads to temp on first render,
/// then shows via PDFView constrained in a 56×56 box. Falls back to
/// the red PDF badge on error.
class _PdfThumbnail extends StatefulWidget {
  const _PdfThumbnail({required this.url});
  final String url;

  @override
  State<_PdfThumbnail> createState() => _PdfThumbnailState();
}

class _PdfThumbnailState extends State<_PdfThumbnail> {
  static final Map<String, String> _pathCache = {};

  String? _localPath;
  bool _loading = true;
  bool _error = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (_pathCache.containsKey(widget.url)) {
      if (mounted) setState(() { _localPath = _pathCache[widget.url]; _loading = false; });
      return;
    }
    try {
      final dir = await getTemporaryDirectory();
      // Stable filename from URL so repeat opens reuse the same temp file.
      final name = widget.url.split('/').last.split('?').first;
      final path = '${dir.path}${Platform.pathSeparator}pdf_thumb_$name';
      final file = File(path);
      if (!await file.exists()) {
        final res = await http.get(Uri.parse(widget.url));
        if (res.statusCode != 200) throw Exception('HTTP ${res.statusCode}');
        await file.writeAsBytes(res.bodyBytes);
      }
      _pathCache[widget.url] = path;
      if (mounted) setState(() { _localPath = path; _loading = false; });
    } catch (_) {
      if (mounted) setState(() { _loading = false; _error = true; });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const SizedBox(
        width: 56,
        height: 56,
        child: Center(
          child: CircularProgressIndicator(
            strokeWidth: 1.5,
            color: Color(0xFFEF4444),
          ),
        ),
      );
    }
    if (_error || _localPath == null) {
      return const _ExtBadge(ext: 'pdf');
    }
    return SizedBox(
      width: 56,
      height: 56,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(6),
        child: AbsorbPointer(
          child: PDFView(
            filePath: _localPath!,
            enableSwipe: false,
            swipeHorizontal: false,
            pageSnap: false,
            defaultPage: 0,
            fitPolicy: FitPolicy.BOTH,
            preventLinkNavigation: true,
          ),
        ),
      ),
    );
  }
}

/// F-19: Colored extension badge for document attachments.
class _ExtBadge extends StatelessWidget {
  const _ExtBadge({required this.ext});
  final String ext;

  static const _colors = {
    'pdf': Color(0xFFEF4444),
    'doc': Color(0xFF3B82F6),
    'docx': Color(0xFF3B82F6),
    'xls': Color(0xFF22C55E),
    'xlsx': Color(0xFF22C55E),
    'ppt': Color(0xFFF97316),
    'pptx': Color(0xFFF97316),
    'txt': Color(0xFF94A3B8),
    'csv': Color(0xFF22C55E),
    'zip': Color(0xFFA78BFA),
    'rar': Color(0xFFA78BFA),
  };

  @override
  Widget build(BuildContext context) {
    final color = _colors[ext] ?? const Color(0xFF64748B);
    final label = ext.isEmpty ? 'FILE' : ext.toUpperCase();
    return Container(
      width: 36,
      height: 36,
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withValues(alpha: 0.4)),
      ),
      alignment: Alignment.center,
      child: Text(
        label.length > 4 ? label.substring(0, 4) : label,
        style: TextStyle(
          color: color,
          fontSize: 9,
          fontWeight: FontWeight.w800,
          letterSpacing: 0.3,
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
  // F-09: playback speed cycling 1× → 1.5× → 2× → 1×.
  double _speed = 1.0;

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
        await _player.setSpeed(_speed); // F-09
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

  // F-09: cycle playback speed 1× → 1.5× → 2× → 1×.
  void _cycleSpeed() {
    setState(() {
      _speed = _speed == 1.0 ? 1.5 : _speed == 1.5 ? 2.0 : 1.0;
    });
    if (_initialised) _player.setSpeed(_speed);
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
            const SizedBox(width: 8),
            SizedBox(
              width: 100,
              height: 26,
              child: _Waveform(progress: pct),
            ),
            const SizedBox(width: 6),
            // F-09: speed label — tap to cycle.
            GestureDetector(
              onTap: _cycleSpeed,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                decoration: BoxDecoration(
                  color: tokens.bgPage,
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  _speed == 1.0 ? '1×' : _speed == 1.5 ? '1.5×' : '2×',
                  style: const TextStyle(
                    color: kColorAccent,
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 6),
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

/// 24-bar waveform. Uses real [amplitudes] when provided (F-10 recording
/// data), otherwise falls back to a sine-wave placeholder.
class _Waveform extends StatelessWidget {
  const _Waveform({required this.progress, this.amplitudes});
  final double progress;
  final List<double>? amplitudes; // normalised 0..1 per sample
  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return LayoutBuilder(
      builder: (_, c) {
        const barCount = 24;
        final barSpacing = c.maxWidth / barCount;
        final filledCount = (progress * barCount).round();
        final amps = amplitudes;
        return Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: List.generate(barCount, (i) {
            final double h;
            if (amps != null && amps.isNotEmpty) {
              // Downsample real amplitude data to barCount bars.
              final srcIdx =
                  ((i / barCount) * amps.length).floor().clamp(0, amps.length - 1);
              h = 4 + amps[srcIdx] * 18;
            } else {
              // Sine-wave placeholder (sine heights 4..22).
              h = 4 + (18 * (0.5 + 0.5 * math.sin(i * 0.6)));
            }
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

class _BodyText extends StatefulWidget {
  const _BodyText({required this.text, required this.textStyle});
  final String text;
  final TextStyle textStyle;
  @override
  State<_BodyText> createState() => _BodyTextState();
}

class _BodyTextState extends State<_BodyText> {
  final List<TapGestureRecognizer> _recognizers = [];

  @override
  void dispose() {
    for (final r in _recognizers) {
      r.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Dispose previous recognizers before rebuilding.
    for (final r in _recognizers) {
      r.dispose();
    }
    _recognizers.clear();

    final tokenPattern = RegExp(r'(https?://[^\s]+|@[A-Za-z0-9_]+)');
    final chunks = widget.text.split(tokenPattern);
    final matches = tokenPattern.allMatches(widget.text).toList();

    final spans = <InlineSpan>[];
    for (int i = 0; i < chunks.length; i++) {
      if (chunks[i].isNotEmpty) {
        spans.add(TextSpan(text: chunks[i], style: widget.textStyle));
      }
      if (i < matches.length) {
        final token = matches[i].group(0) ?? '';
        if (token.startsWith('@')) {
          spans.add(TextSpan(
            text: token,
            style: widget.textStyle.copyWith(color: kColorAccent, fontWeight: FontWeight.w700),
          ));
        } else {
          final rec = TapGestureRecognizer()
            ..onTap = () async {
              final uri = Uri.tryParse(token);
              if (uri != null) await launchUrl(uri, mode: LaunchMode.externalApplication);
            };
          _recognizers.add(rec);
          spans.add(TextSpan(
            text: token,
            style: widget.textStyle.copyWith(
              color: Colors.blue[300],
              decoration: TextDecoration.underline,
            ),
            recognizer: rec,
          ));
        }
      }
    }

    return RichText(text: TextSpan(style: widget.textStyle, children: spans));
  }
}

// ── Link Preview Card (F-06) ─────────────────────────────────────────────────

class _LinkPreviewCard extends StatelessWidget {
  const _LinkPreviewCard({required this.preview});
  final ChatGroupLinkPreview preview;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final domain = Uri.tryParse(preview.url)?.host ?? preview.url;
    return GestureDetector(
      onTap: () async {
        final uri = Uri.tryParse(preview.url);
        if (uri != null) await launchUrl(uri, mode: LaunchMode.externalApplication);
      },
      child: Container(
        margin: const EdgeInsets.only(top: 6),
        decoration: BoxDecoration(
          color: tokens.bgInput,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: tokens.borderCard),
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            if (preview.imageUrl != null && preview.imageUrl!.isNotEmpty)
              CachedNetworkImage(
                imageUrl: preview.imageUrl!,
                width: double.infinity,
                height: 120,
                fit: BoxFit.cover,
                errorWidget: (_, __, ___) => const SizedBox.shrink(),
              ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (preview.siteName != null)
                    Text(
                      preview.siteName!,
                      style: TextStyle(
                        color: kColorAccent,
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        fontFamily: 'Rajdhani',
                      ),
                    ),
                  if (preview.title != null)
                    Text(
                      preview.title!,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: tokens.textPrimary,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        height: 1.3,
                      ),
                    ),
                  if (preview.description != null)
                    Text(
                      preview.description!,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(color: tokens.textMuted, fontSize: 11),
                    ),
                  const SizedBox(height: 2),
                  Text(
                    domain,
                    style: TextStyle(color: tokens.textMuted, fontSize: 10),
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

// ── Unread message separator (F-13) ──────────────────────────────────────────

class _UnreadDivider extends StatelessWidget {
  const _UnreadDivider({required this.count});
  final int count;
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
      child: Row(
        children: [
          Expanded(
            child: Divider(
              color: kColorAccent.withValues(alpha: 0.4),
              thickness: 0.5,
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10),
            child: Text(
              '$count unread message${count == 1 ? '' : 's'}',
              style: const TextStyle(
                color: kColorAccent,
                fontSize: 11,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          Expanded(
            child: Divider(
              color: kColorAccent.withValues(alpha: 0.4),
              thickness: 0.5,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Voice Note Preview Bar (F-02) ────────────────────────────────────────────
//
// Shown in the composer area after recording stops. Lets the user preview
// the audio before sending (or cancel/discard it).

class _VoicePreviewBar extends StatefulWidget {
  const _VoicePreviewBar({
    required this.path,
    required this.sending,
    required this.onSend,
    required this.onCancel,
    this.amplitudes,
  });
  final String path;
  final bool sending;
  final List<double>? amplitudes; // F-10: real waveform data
  final VoidCallback onSend;
  final VoidCallback onCancel;

  @override
  State<_VoicePreviewBar> createState() => _VoicePreviewBarState();
}

class _VoicePreviewBarState extends State<_VoicePreviewBar> {
  late final AudioPlayer _player;
  bool _playing = false;
  Duration _position = Duration.zero;
  Duration _total = Duration.zero;

  @override
  void initState() {
    super.initState();
    _player = AudioPlayer();
    _init();
  }

  Future<void> _init() async {
    try {
      await _player.setFilePath(widget.path);
      final dur = _player.duration;
      if (dur != null && mounted) setState(() => _total = dur);
      _player.positionStream.listen((pos) {
        if (mounted) setState(() => _position = pos);
      });
      _player.playerStateStream.listen((s) {
        if (!mounted) return;
        setState(() => _playing = s.playing);
        if (s.processingState == ProcessingState.completed) {
          _player.seek(Duration.zero);
          if (mounted) setState(() => _playing = false);
        }
      });
    } catch (_) {}
  }

  @override
  void dispose() {
    _player.dispose();
    super.dispose();
  }

  String _fmt(Duration d) {
    final m = d.inMinutes.remainder(60).toString().padLeft(2, '0');
    final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final progress = _total.inMilliseconds > 0
        ? (_position.inMilliseconds / _total.inMilliseconds).clamp(0.0, 1.0)
        : 0.0;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: tokens.bgInput,
        border: Border(
            top: BorderSide(color: tokens.borderCard, width: 0.5)),
      ),
      child: Row(
        children: [
          IconButton(
            icon: Icon(
              _playing ? Icons.pause_circle_filled_rounded : Icons.play_circle_filled_rounded,
              color: kColorAccent,
              size: 36,
            ),
            onPressed: () {
              if (_playing) {
                _player.pause();
              } else {
                _player.play();
              }
            },
          ),
          Expanded(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // F-10: real waveform when amplitudes are available.
                if (widget.amplitudes != null)
                  SizedBox(
                    height: 24,
                    child: _Waveform(
                      progress: progress,
                      amplitudes: widget.amplitudes,
                    ),
                  ),
                SliderTheme(
                  data: SliderThemeData(
                    trackHeight: 2,
                    thumbShape:
                        const RoundSliderThumbShape(enabledThumbRadius: 6),
                    overlayShape: SliderComponentShape.noOverlay,
                    activeTrackColor: kColorAccent,
                    inactiveTrackColor: tokens.borderCard,
                    thumbColor: kColorAccent,
                  ),
                  child: Slider(
                    value: progress,
                    onChanged: (v) {
                      _player.seek(Duration(
                          milliseconds:
                              (v * _total.inMilliseconds).round()));
                    },
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(_fmt(_position),
                          style: TextStyle(
                              color: tokens.textMuted, fontSize: 10)),
                      Text(_fmt(_total),
                          style: TextStyle(
                              color: tokens.textMuted, fontSize: 10)),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 4),
          IconButton(
            icon: Icon(Icons.close_rounded, color: tokens.textMuted),
            onPressed: widget.sending ? null : widget.onCancel,
            tooltip: 'Discard',
          ),
          widget.sending
              ? const Padding(
                  padding: EdgeInsets.all(12),
                  child:
                      SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)),
                )
              : IconButton(
                  icon: const Icon(Icons.send_rounded, color: kColorAccent),
                  onPressed: widget.onSend,
                  tooltip: 'Send',
                ),
        ],
      ),
    );
  }
}

// ── Message Info Sheet (F-07) ─────────────────────────────────────────────────
//
// Shows who has read the message, with avatar + name + read time.

class _MessageInfoSheet extends ConsumerWidget {
  const _MessageInfoSheet({
    required this.groupId,
    required this.messageId,
  });
  final String groupId;
  final String messageId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = context.tokens;
    return DraggableScrollableSheet(
      initialChildSize: 0.5,
      maxChildSize: 0.9,
      minChildSize: 0.3,
      expand: false,
      builder: (_, scrollCtrl) => Container(
        decoration: BoxDecoration(
          color: tokens.bgSurface,
          borderRadius:
              const BorderRadius.vertical(top: Radius.circular(16)),
        ),
        child: Column(
          children: [
            const SizedBox(height: 6),
            Container(
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: tokens.borderCard,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            Padding(
              padding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Row(
                children: [
                  Text(
                    'Read by',
                    style: TextStyle(
                      color: tokens.textPrimary,
                      fontFamily: 'Rajdhani',
                      fontWeight: FontWeight.w700,
                      fontSize: 15,
                      letterSpacing: 0.5,
                    ),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            Expanded(
              child: FutureBuilder<List<MessageReadInfo>>(
                future: ref
                    .read(chatGroupsServiceProvider)
                    .getMessageInfo(groupId, messageId),
                builder: (ctx, snap) {
                  if (snap.connectionState == ConnectionState.waiting) {
                    return const Center(
                        child: CircularProgressIndicator());
                  }
                  if (snap.hasError || snap.data == null) {
                    return Center(
                      child: Text('Could not load read receipts.',
                          style:
                              TextStyle(color: tokens.textSecondary)),
                    );
                  }
                  final list = snap.data!;
                  if (list.isEmpty) {
                    return Center(
                      child: Text('No one has read this yet.',
                          style: TextStyle(color: tokens.textMuted)),
                    );
                  }
                  return ListView.builder(
                    controller: scrollCtrl,
                    itemCount: list.length,
                    itemBuilder: (_, i) {
                      final r = list[i];
                      final photo = r.profilePhotoUrl;
                      return ListTile(
                        leading: CircleAvatar(
                          radius: 20,
                          backgroundColor: tokens.bgInput,
                          backgroundImage:
                              photo != null && photo.isNotEmpty
                                  ? NetworkImage(photo)
                                  : null,
                          child: (photo == null || photo.isEmpty)
                              ? Text(
                                  r.name.isNotEmpty
                                      ? r.name[0].toUpperCase()
                                      : '?',
                                  style: TextStyle(
                                      color: tokens.textPrimary,
                                      fontWeight: FontWeight.w600),
                                )
                              : null,
                        ),
                        title: Text(r.name,
                            style: TextStyle(
                                color: tokens.textPrimary,
                                fontSize: 14,
                                fontWeight: FontWeight.w600)),
                        subtitle: Text(
                          DateFormat('d MMM, h:mm a')
                              .format(r.readAt.toLocal()),
                          style: TextStyle(
                              color: tokens.textMuted, fontSize: 11),
                        ),
                        trailing: Icon(Icons.done_all_rounded,
                            color: kColorAccent, size: 16),
                      );
                    },
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
