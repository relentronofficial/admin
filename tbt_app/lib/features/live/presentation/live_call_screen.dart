import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
// LiveKit exports its own ConnectionState enum which clashes with Flutter's
// (used by AsyncSnapshot). Hide LiveKit's — we only need the Flutter one.
import 'package:livekit_client/livekit_client.dart' hide ConnectionState;
import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../shared/providers/socket_provider.dart';
import '../../../shared/socket/socket_events.dart';
import '../../../shared/theme/status_bar_scope.dart';
import '../../../shared/theme/tbt_theme.dart';
import '../../workshops/data/workshops_service.dart';

import '../../../shared/theme/theme_tokens.dart';
import 'sheets/chapters_sheet.dart';
import 'sheets/participants_sheet.dart';
import 'sheets/waiting_room_overlay.dart';
import '../../../shared/widgets/app_loader.dart';

enum _CallStatus { loading, connecting, connected, error, permissionDenied }

class LiveCallScreen extends ConsumerStatefulWidget {
  const LiveCallScreen({
    super.key,
    required this.workshopSlug,
    required this.callId,
  });

  final String workshopSlug;
  final String callId;

  @override
  ConsumerState<LiveCallScreen> createState() => _LiveCallScreenState();
}

class _LiveCallScreenState extends ConsumerState<LiveCallScreen> {
  Room? _room;
  EventsListener<RoomEvent>? _listener;
  _CallStatus _status = _CallStatus.loading;
  String _errorMessage = '';
  bool _isMuted = true;
  int _participantCount = 0;
  bool _isRecording = false;
  VideoTrack? _remoteVideoTrack;
  // Admission-gate state: when `live_call:lock` fires the host has
  // put the room into waiting-room mode; block the stream view until
  // `live_call:admitted` clears it.
  bool _isLocked = false;
  // Track which socket handlers we registered so dispose() can clean them
  // up without touching unrelated listeners.
  final List<(String, void Function(dynamic))> _socketHandlers = [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _bootstrap());
  }

  @override
  void dispose() {
    // Detach socket handlers before nulling out anything they may touch.
    final sock = ref.read(socketNotifierProvider.notifier);
    for (final (event, handler) in _socketHandlers) {
      sock.off(event, handler);
    }
    _socketHandlers.clear();
    _listener?.dispose();
    _room?.disconnect();
    super.dispose();
  }

  /// Full call bootstrap:
  ///   1) subscribe to `live_call:lock` / `live_call:admitted` sockets
  ///   2) ensure the user has RSVPed (prompt them if not)
  ///   3) request mic permission + fetch token + connect to LiveKit
  Future<void> _bootstrap() async {
    _subscribeSockets();
    final ok = await _ensureRsvp();
    if (!mounted) return;
    if (!ok) {
      // User declined to RSVP; bail back to the previous screen.
      context.pop();
      return;
    }
    await _init();
  }

  void _subscribeSockets() {
    final sock = ref.read(socketNotifierProvider.notifier);
    void onLock(dynamic data) {
      if (!mounted) return;
      // Backend only broadcasts to the affected call — but be defensive
      // in case rooms are shared across calls.
      final map = data is Map ? data : const {};
      final callId = map['callId'] ?? map['liveCallId'];
      if (callId != null && callId != widget.callId) return;
      setState(() => _isLocked = true);
    }

    void onAdmit(dynamic data) {
      if (!mounted) return;
      final map = data is Map ? data : const {};
      final callId = map['callId'] ?? map['liveCallId'];
      if (callId != null && callId != widget.callId) return;
      setState(() => _isLocked = false);
    }

    sock.on(kSocketLiveCallLock, onLock);
    sock.on(kSocketLiveCallAdmitted, onAdmit);
    _socketHandlers.add((kSocketLiveCallLock, onLock));
    _socketHandlers.add((kSocketLiveCallAdmitted, onAdmit));
  }

  /// Fetches the member's current RSVP for this call. If none exists,
  /// shows a modal asking Yes/Maybe/No. Returns true if the user should
  /// proceed to join (Yes or Maybe), false if they explicitly bailed.
  Future<bool> _ensureRsvp() async {
    try {
      final svc = ref.read(workshopsServiceProvider);
      final current = await svc.getRsvpStatus(widget.callId);
      if (current != null && current.isNotEmpty) return true;
      if (!mounted) return true;
      final picked = await showDialog<String>(
        context: context,
        barrierDismissible: false,
        builder: (ctx) => AlertDialog(
          backgroundColor: context.tokens.bgSurface,
          title: Text(
            "You're joining a live call",
            style: TextStyle(
                color: context.tokens.textPrimary, fontWeight: FontWeight.w700),
          ),
          content: Text(
            'Let the host know if you plan to attend.',
            style: TextStyle(color: context.tokens.textSecondary, fontSize: 13),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop('no'),
              child: Text("Won't attend",
                  style: TextStyle(color: context.tokens.textMuted)),
            ),
            TextButton(
              onPressed: () => Navigator.of(ctx).pop('maybe'),
              child: Text('Maybe',
                  style: TextStyle(color: context.tokens.textSecondary)),
            ),
            TextButton(
              onPressed: () => Navigator.of(ctx).pop('yes'),
              child: Text("I'll attend",
                  style: TextStyle(color: Theme.of(context).colorScheme.primary)),
            ),
          ],
        ),
      );
      if (picked == null) return false;
      // Fire-and-forget — user has already made their decision.
      unawaited(svc.upsertRsvp(widget.callId, picked));
      return picked != 'no';
    } catch (_) {
      // RSVP is best-effort — never block the join on this endpoint.
      return true;
    }
  }

  Future<void> _init() async {
    final micStatus = await Permission.microphone.request();
    if (!mounted) return;

    if (micStatus.isDenied) {
      setState(() => _status = _CallStatus.permissionDenied);
      _showPermissionDialog();
      return;
    }
    if (micStatus.isPermanentlyDenied) {
      setState(() => _status = _CallStatus.permissionDenied);
      await openAppSettings();
      return;
    }

    setState(() => _status = _CallStatus.connecting);

    try {
      final svc = ref.read(workshopsServiceProvider);
      // Backend route is /api/user/workshop/live-calls/:id/token — slug not used.
      final tokenRes = await svc.getLiveCallToken(widget.callId);
      final wsUrl = tokenRes.wsUrl;
      final token = tokenRes.token;

      final room = Room(roomOptions: const RoomOptions(adaptiveStream: true));
      _listener = room.createListener()
        ..on<RoomConnectedEvent>((_) {
          if (!mounted) return;
          setState(() {
            _status = _CallStatus.connected;
            _participantCount = room.remoteParticipants.length + 1;
            _isRecording = room.isRecording;
          });
        })
        ..on<ParticipantConnectedEvent>((_) {
          if (!mounted) return;
          setState(() => _participantCount = room.remoteParticipants.length + 1);
          _refreshRemoteVideo(room);
        })
        ..on<ParticipantDisconnectedEvent>((_) {
          if (!mounted) return;
          setState(() => _participantCount = room.remoteParticipants.length + 1);
          _refreshRemoteVideo(room);
        })
        ..on<TrackPublishedEvent>((_) => _refreshRemoteVideo(room))
        ..on<TrackSubscribedEvent>((_) => _refreshRemoteVideo(room))
        ..on<TrackUnsubscribedEvent>((_) => _refreshRemoteVideo(room))
        ..on<RoomRecordingStatusChanged>((e) {
          if (!mounted) return;
          setState(() => _isRecording = e.activeRecording);
        })
        ..on<RoomDisconnectedEvent>((_) {
          if (mounted) context.pop();
        });

      await room.connect(wsUrl, token);
      await room.localParticipant?.setMicrophoneEnabled(false);

      _room = room;
      _refreshRemoteVideo(room);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _status = _CallStatus.error;
        _errorMessage = e.toString();
      });
    }
  }

  void _refreshRemoteVideo(Room room) {
    if (!mounted) return;
    VideoTrack? found;
    outer:
    for (final p in room.remoteParticipants.values) {
      for (final pub in p.videoTrackPublications) {
        if (pub.subscribed && pub.track != null) {
          found = pub.track;
          break outer;
        }
      }
    }
    setState(() => _remoteVideoTrack = found);
  }

  Future<void> _toggleMic() async {
    final local = _room?.localParticipant;
    if (local == null) return;
    final next = !_isMuted;
    await local.setMicrophoneEnabled(next);
    if (mounted) setState(() => _isMuted = !next);
  }

  Future<void> _leave() async {
    // Feedback flow: only shown if we actually connected.
    final connected = _status == _CallStatus.connected;
    await _room?.disconnect();
    if (!mounted) return;
    if (connected) {
      await _showFeedbackFlow();
    }
    if (mounted) context.pop();
  }

  Future<void> _showFeedbackFlow() async {
    final svc = ref.read(workshopsServiceProvider);
    // Skip if already submitted this session — silent GET; ignore errors.
    try {
      final existing = await svc.getMyLiveCallFeedback(widget.callId);
      if (existing != null && existing['rating'] != null) {
        await _maybeOfferCertificate();
        return;
      }
    } catch (_) {
      // ignore — proceed to offer feedback
    }
    if (!mounted) return;
    final result = await showModalBottomSheet<({int rating, String? comment})?>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _FeedbackSheet(accent: context.tbt.accent),
    );
    if (result != null) {
      try {
        await svc.postLiveCallFeedback(
          widget.callId,
          rating: result.rating,
          comment: result.comment,
        );
      } catch (_) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Could not submit feedback')),
          );
        }
      }
    }
    if (!mounted) return;
    await _maybeOfferCertificate();
  }

  Future<void> _maybeOfferCertificate() async {
    try {
      final res = await ref
          .read(workshopsServiceProvider)
          .getMyLiveCallFeedback(widget.callId);
      // Some backends return certificate info under the feedback endpoint.
      // Simpler: attempt the download; the backend gates eligibility.
      // No-op check — proceed to certificate button dialog.
      if (res == null) return;
    } catch (_) {
      // Feedback endpoint may 404 — carry on, still allow cert attempt below.
    }
    if (!mounted) return;
    final wantCert = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: context.tokens.bgSurface,
        title: Text(
          'Download attendance certificate?',
          style: TextStyle(color: context.tokens.textPrimary, fontSize: 16),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Skip'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: TextButton.styleFrom(foregroundColor: context.tbt.accent),
            child: const Text('Download'),
          ),
        ],
      ),
    );
    if (wantCert != true || !mounted) return;
    try {
      final bytes = await ref
          .read(workshopsServiceProvider)
          .downloadLiveCallCertificate(widget.callId);
      final dir = await getTemporaryDirectory();
      final file =
          File('${dir.path}/tbt-live-cert-${widget.callId}.pdf');
      await file.writeAsBytes(bytes, flush: true);
      final r = await OpenFilex.open(file.path, type: 'application/pdf');
      if (r.type != ResultType.done && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(r.message)),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Certificate not available yet')),
        );
      }
    }
  }

  void _openResources() {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _ResourcesSheet(
        callId: widget.callId,
        accent: context.tbt.accent,
      ),
    );
  }

  void _openQa() {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _LiveQaSheet(
        callId: widget.callId,
        accent: context.tbt.accent,
      ),
    );
  }

  void _openPolls() {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _PollsSheet(
        callId: widget.callId,
        accent: context.tbt.accent,
      ),
    );
  }

  void _openParticipants() {
    final room = _room;
    if (room == null) return;
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => ParticipantsSheet(
        room: room,
        accent: context.tbt.accent,
      ),
    );
  }

  void _openChapters() {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => ChaptersSheet(
        callId: widget.callId,
        accent: context.tbt.accent,
      ),
    );
  }

  void _showPermissionDialog() {
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: context.tokens.bgSurface,
        title: Text(
          'Microphone Required',
          style: TextStyle(
            color: context.tokens.textPrimary,
            fontWeight: FontWeight.w700,
          ),
        ),
        content: Text(
          'Microphone access is needed to participate in the live call. '
          'Please enable it in your device settings.',
          style: TextStyle(color: context.tokens.textSecondary, fontSize: 13),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              openAppSettings();
            },
            child: const Text('Open Settings'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final accent = context.tbt.accent;

    return StatusBarScope.overDarkBackground(
      child: Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: const Color(0xFF111111),
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new,
              color: Colors.white, size: 18),
          onPressed: _leave,
        ),
        title: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'LIVE CALL',
              style: TextStyle(
                fontFamily: 'Rajdhani',
                fontSize: 17,
                fontWeight: FontWeight.w700,
                letterSpacing: 1.5,
                color: Colors.white,
              ),
            ),
            if (_isRecording) ...[
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: Colors.redAccent.withValues(alpha: 0.22),
                  borderRadius: BorderRadius.circular(4),
                  border: Border.all(color: Colors.redAccent),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: const [
                    Icon(Icons.fiber_manual_record,
                        color: Colors.redAccent, size: 8),
                    SizedBox(width: 4),
                    Text(
                      'REC',
                      style: TextStyle(
                        color: Colors.redAccent,
                        fontSize: 9,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Resources',
            icon: const Icon(Icons.folder_open, color: Colors.white70, size: 20),
            onPressed: _openResources,
          ),
          IconButton(
            tooltip: 'Live Q&A',
            icon: const Icon(Icons.question_answer_outlined,
                color: Colors.white70, size: 20),
            onPressed: _openQa,
          ),
          IconButton(
            tooltip: 'Polls',
            icon: const Icon(Icons.poll_outlined,
                color: Colors.white70, size: 20),
            onPressed: _openPolls,
          ),
          IconButton(
            tooltip: 'Chapters',
            icon: const Icon(Icons.bookmark_outline,
                color: Colors.white70, size: 20),
            onPressed: _openChapters,
          ),
          if (_status == _CallStatus.connected)
            IconButton(
              tooltip: 'Participants',
              onPressed: _openParticipants,
              icon: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.people_outline,
                        color: Colors.white70, size: 16),
                    const SizedBox(width: 4),
                    Text(
                      '$_participantCount',
                      style: const TextStyle(
                        color: Colors.white70,
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
      body: Stack(
        children: [
          Positioned.fill(child: _buildBody(accent)),
          if (_status == _CallStatus.connected && !_isLocked)
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: _ControlsBar(
                isMuted: _isMuted,
                onToggleMic: _toggleMic,
                onLeave: _leave,
                accent: accent,
              ),
            ),
          if (_isLocked)
            Positioned.fill(
              child: WaitingRoomOverlay(accent: accent, onLeave: _leave),
            ),
        ],
      ),
    ),
    );
  }

  Widget _buildBody(Color accent) {
    switch (_status) {
      case _CallStatus.loading:
      case _CallStatus.connecting:
        return Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              CircularProgressIndicator(color: accent, strokeWidth: 2),
              const SizedBox(height: 16),
              Text(
                _status == _CallStatus.loading
                    ? 'Checking permissions…'
                    : 'Connecting to call…',
                style: const TextStyle(color: Colors.white70, fontSize: 14),
              ),
            ],
          ),
        );

      case _CallStatus.error:
        return Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.error_outline,
                    color: Colors.redAccent, size: 48),
                const SizedBox(height: 16),
                const Text(
                  'Failed to join the call',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  _errorMessage,
                  style: const TextStyle(color: Colors.white54, fontSize: 12),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 24),
                ElevatedButton(
                  onPressed: () {
                    setState(() {
                      _status = _CallStatus.loading;
                      _errorMessage = '';
                    });
                    _init();
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: accent,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8)),
                  ),
                  child: const Text('Retry'),
                ),
              ],
            ),
          ),
        );

      case _CallStatus.permissionDenied:
        return Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.mic_off, color: Colors.white54, size: 48),
                const SizedBox(height: 16),
                const Text(
                  'Microphone permission required',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                const Text(
                  'Please enable microphone access in your device settings '
                  'to join the live call.',
                  style: TextStyle(color: Colors.white54, fontSize: 13),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 24),
                ElevatedButton(
                  onPressed: openAppSettings,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: accent,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8)),
                  ),
                  child: const Text('Open Settings'),
                ),
              ],
            ),
          ),
        );

      case _CallStatus.connected:
        if (_remoteVideoTrack != null) {
          return RepaintBoundary(
            child: VideoTrackRenderer(_remoteVideoTrack!),
          );
        }
        return const Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.videocam_off_outlined,
                  color: Colors.white38, size: 56),
              SizedBox(height: 16),
              Text(
                'Waiting for host video…',
                style: TextStyle(color: Colors.white54, fontSize: 14),
              ),
            ],
          ),
        );
    }
  }
}

class _ControlsBar extends StatelessWidget {
  const _ControlsBar({
    required this.isMuted,
    required this.onToggleMic,
    required this.onLeave,
    required this.accent,
  });

  final bool isMuted;
  final VoidCallback onToggleMic;
  final VoidCallback onLeave;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.bottomCenter,
          end: Alignment.topCenter,
          colors: [
            Colors.black.withValues(alpha: 0.85),
            Colors.transparent,
          ],
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          _ControlButton(
            icon: isMuted ? Icons.mic_off : Icons.mic,
            label: isMuted ? 'Unmute' : 'Mute',
            color: isMuted ? Colors.white24 : accent,
            onTap: onToggleMic,
          ),
          const SizedBox(width: 40),
          _ControlButton(
            icon: Icons.call_end,
            label: 'Leave',
            color: const Color(0xFFdc2626),
            onTap: onLeave,
          ),
        ],
      ),
    );
  }
}

class _ControlButton extends StatelessWidget {
  const _ControlButton({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: label,
      button: true,
      child: GestureDetector(
        onTap: onTap,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(color: color, shape: BoxShape.circle),
              child: Icon(icon, color: Colors.white, size: 24),
            ),
            const SizedBox(height: 6),
            Text(
              label,
              style: const TextStyle(color: Colors.white70, fontSize: 11),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Shared sheet chrome ───────────────────────────────────────────────────────

Widget _sheetShell(BuildContext context, {
  required String label,
  required Widget body,
  Widget? footer,
}) {
  return DraggableScrollableSheet(
    initialChildSize: 0.7,
    minChildSize: 0.4,
    maxChildSize: 0.95,
    builder: (_, scrollController) => Container(
      decoration: BoxDecoration(
        color: context.tokens.bgSurface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
        border: Border(top: BorderSide(color: context.tokens.borderCard)),
      ),
      child: Column(
        children: [
          Container(
            width: 40,
            height: 4,
            margin: const EdgeInsets.symmetric(vertical: 8),
            decoration: BoxDecoration(
              color: context.tokens.textMuted.withValues(alpha: 0.5),
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 12),
            child: Row(
              children: [
                Text(
                  label,
                  style: TextStyle(
                    fontFamily: 'Rajdhani',
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.8,
                    color: context.tokens.textPrimary,
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: PrimaryScrollController(
              controller: scrollController,
              child: body,
            ),
          ),
          if (footer != null) footer,
        ],
      ),
    ),
  );
}

// ── Resources sheet ───────────────────────────────────────────────────────────

class _ResourcesSheet extends ConsumerStatefulWidget {
  const _ResourcesSheet({required this.callId, required this.accent});
  final String callId;
  final Color accent;

  @override
  ConsumerState<_ResourcesSheet> createState() => _ResourcesSheetState();
}

class _ResourcesSheetState extends ConsumerState<_ResourcesSheet> {
  List<Map<String, dynamic>>? _items;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final list = await ref
          .read(workshopsServiceProvider)
          .getLiveCallResources(widget.callId);
      if (!mounted) return;
      setState(() {
        _items = list;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return _sheetShell(context, 
      label: 'PRE-SESSION RESOURCES',
      body: _loading
          ? const AppLoader.center()
          : _error != null
              ? Center(
                  child: Text('Could not load resources',
                      style: TextStyle(color: context.tokens.textMuted)),
                )
              : (_items?.isEmpty ?? true)
                  ? Center(
                      child: Text('No resources shared',
                          style: TextStyle(color: context.tokens.textMuted)),
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
                      itemCount: _items!.length,
                      separatorBuilder: (_, __) =>
                          Divider(height: 1, color: context.tokens.borderCard),
                      itemBuilder: (_, i) {
                        final r = _items![i];
                        final title = (r['title'] as String?) ?? 'Resource';
                        final url = (r['url'] as String?) ?? '';
                        return ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: Icon(Icons.description_outlined,
                              color: widget.accent),
                          title: Text(
                            title,
                            style: TextStyle(
                              color: context.tokens.textPrimary,
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          trailing: Icon(Icons.open_in_new,
                              size: 16, color: context.tokens.textMuted),
                          onTap: url.isEmpty
                              ? null
                              : () => launchUrl(Uri.parse(url),
                                  mode: LaunchMode.externalApplication),
                        );
                      },
                    ),
    );
  }
}

// ── Live Q&A sheet ────────────────────────────────────────────────────────────

class _LiveQaSheet extends ConsumerStatefulWidget {
  const _LiveQaSheet({required this.callId, required this.accent});
  final String callId;
  final Color accent;

  @override
  ConsumerState<_LiveQaSheet> createState() => _LiveQaSheetState();
}

class _LiveQaSheetState extends ConsumerState<_LiveQaSheet> {
  List<Map<String, dynamic>>? _items;
  bool _loading = true;
  bool _posting = false;
  Timer? _poller;
  final _ctrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
    _poller = Timer.periodic(const Duration(seconds: 8), (_) => _load());
  }

  @override
  void dispose() {
    _poller?.cancel();
    _ctrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final list = await ref
          .read(workshopsServiceProvider)
          .getLiveCallQuestions(widget.callId);
      if (!mounted) return;
      setState(() {
        _items = list;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  Future<void> _post() async {
    final text = _ctrl.text.trim();
    if (text.isEmpty || _posting) return;
    setState(() => _posting = true);
    try {
      await ref
          .read(workshopsServiceProvider)
          .postLiveCallQuestion(widget.callId, text);
      _ctrl.clear();
      await _load();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not post question')),
        );
      }
    } finally {
      if (mounted) setState(() => _posting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return _sheetShell(context, 
      label: 'LIVE Q&A',
      body: _loading
          ? const AppLoader.center()
          : (_items?.isEmpty ?? true)
              ? Center(
                  child: Text('No questions yet — be first!',
                      style: TextStyle(color: context.tokens.textMuted)),
                )
              : ListView.separated(
                  padding: const EdgeInsets.fromLTRB(20, 4, 20, 12),
                  itemCount: _items!.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (_, i) {
                    final q = _items![i];
                    final author = (q['authorName'] as String?) ?? 'Member';
                    final body = (q['questionText'] as String?) ??
                        (q['body'] as String?) ??
                        '';
                    return Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: context.tokens.bgInput,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            author,
                            style: TextStyle(
                              color: widget.accent,
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0.5,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            body,
                            style: TextStyle(
                              color: context.tokens.textPrimary,
                              fontSize: 14,
                              height: 1.4,
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                ),
      footer: Padding(
        padding: EdgeInsets.fromLTRB(
          16,
          8,
          16,
          MediaQuery.of(context).viewInsets.bottom + 12,
        ),
        child: Row(
          children: [
            Expanded(
              child: TextField(
                controller: _ctrl,
                style: TextStyle(color: context.tokens.textPrimary),
                decoration: InputDecoration(
                  isDense: true,
                  hintText: 'Ask a question…',
                  hintStyle: TextStyle(color: context.tokens.textMuted),
                  filled: true,
                  fillColor: context.tokens.bgInput,
                  border: OutlineInputBorder(
                    borderSide: BorderSide(color: context.tokens.borderCard),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderSide: BorderSide(color: context.tokens.borderCard),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  contentPadding: const EdgeInsets.symmetric(
                      horizontal: 12, vertical: 12),
                ),
                onSubmitted: (_) => _post(),
              ),
            ),
            const SizedBox(width: 8),
            IconButton(
              icon: _posting
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Icon(Icons.send, color: widget.accent),
              onPressed: _posting ? null : _post,
            ),
          ],
        ),
      ),
    );
  }
}

// ── Polls sheet ───────────────────────────────────────────────────────────────

class _PollsSheet extends ConsumerStatefulWidget {
  const _PollsSheet({required this.callId, required this.accent});
  final String callId;
  final Color accent;

  @override
  ConsumerState<_PollsSheet> createState() => _PollsSheetState();
}

class _PollsSheetState extends ConsumerState<_PollsSheet> {
  List<Map<String, dynamic>>? _polls;
  bool _loading = true;
  Timer? _poller;

  @override
  void initState() {
    super.initState();
    _load();
    _poller = Timer.periodic(const Duration(seconds: 8), (_) => _load());
  }

  @override
  void dispose() {
    _poller?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final list = await ref
          .read(workshopsServiceProvider)
          .getLiveCallPolls(widget.callId);
      if (!mounted) return;
      setState(() {
        _polls = list;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  Future<void> _vote(String pollId, String optionId) async {
    try {
      await ref
          .read(workshopsServiceProvider)
          .votePoll(pollId, optionId);
      await _load();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not record vote')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return _sheetShell(context, 
      label: 'LIVE POLLS',
      body: _loading
          ? const AppLoader.center()
          : (_polls?.isEmpty ?? true)
              ? Center(
                  child: Text('No active polls',
                      style: TextStyle(color: context.tokens.textMuted)),
                )
              : ListView.separated(
                  padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
                  itemCount: _polls!.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 16),
                  itemBuilder: (_, i) {
                    final p = _polls![i];
                    final pollId = (p['id'] as String?) ?? '';
                    final question = (p['question'] as String?) ??
                        (p['title'] as String?) ??
                        '';
                    final options = (p['options'] as List<dynamic>? ?? [])
                        .cast<Map<String, dynamic>>();
                    final myVote = p['myVote'] as String?;
                    return Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: context.tokens.bgInput,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: context.tokens.borderCard),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            question,
                            style: TextStyle(
                              color: context.tokens.textPrimary,
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 12),
                          ...options.map((o) {
                            final optId = (o['id'] as String?) ?? '';
                            final label = (o['text'] as String?) ??
                                (o['label'] as String?) ??
                                '';
                            final voted = myVote == optId;
                            return Padding(
                              padding: const EdgeInsets.only(bottom: 8),
                              child: InkWell(
                                borderRadius: BorderRadius.circular(8),
                                onTap: myVote != null
                                    ? null
                                    : () => _vote(pollId, optId),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 12, vertical: 12),
                                  decoration: BoxDecoration(
                                    color: voted
                                        ? widget.accent
                                            .withValues(alpha: 0.15)
                                        : context.tokens.bgSurface,
                                    borderRadius: BorderRadius.circular(8),
                                    border: Border.all(
                                      color: voted
                                          ? widget.accent
                                          : context.tokens.borderCard,
                                    ),
                                  ),
                                  child: Row(
                                    children: [
                                      Expanded(
                                        child: Text(
                                          label,
                                          style: TextStyle(
                                            color: voted
                                                ? widget.accent
                                                : context.tokens.textPrimary,
                                            fontSize: 14,
                                            fontWeight: voted
                                                ? FontWeight.w700
                                                : FontWeight.w400,
                                          ),
                                        ),
                                      ),
                                      if (voted)
                                        Icon(Icons.check,
                                            color: widget.accent, size: 18),
                                    ],
                                  ),
                                ),
                              ),
                            );
                          }),
                        ],
                      ),
                    );
                  },
                ),
    );
  }
}

// ── Feedback sheet ────────────────────────────────────────────────────────────

class _FeedbackSheet extends StatefulWidget {
  const _FeedbackSheet({required this.accent});
  final Color accent;

  @override
  State<_FeedbackSheet> createState() => _FeedbackSheetState();
}

class _FeedbackSheetState extends State<_FeedbackSheet> {
  int _rating = 0;
  final _commentCtrl = TextEditingController();

  @override
  void dispose() {
    _commentCtrl.dispose();
    super.dispose();
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
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'How was the call?',
              style: TextStyle(
                color: context.tokens.textPrimary,
                fontFamily: 'Rajdhani',
                fontSize: 17,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.5,
              ),
            ),
            const SizedBox(height: 14),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                for (var i = 1; i <= 5; i++)
                  IconButton(
                    iconSize: 30,
                    icon: Icon(
                      i <= _rating ? Icons.star : Icons.star_border,
                      color: i <= _rating ? widget.accent : context.tokens.textMuted,
                    ),
                    onPressed: () => setState(() => _rating = i),
                  ),
              ],
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _commentCtrl,
              maxLines: 3,
              style: TextStyle(color: context.tokens.textPrimary),
              decoration: InputDecoration(
                hintText: 'Optional comment…',
                hintStyle: TextStyle(color: context.tokens.textMuted),
                filled: true,
                fillColor: context.tokens.bgInput,
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
            const SizedBox(height: 16),
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
                    child: const Text('Skip'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: ElevatedButton(
                    onPressed: _rating == 0
                        ? null
                        : () => Navigator.of(context).pop((
                            rating: _rating,
                            comment: _commentCtrl.text.trim().isEmpty
                                ? null
                                : _commentCtrl.text.trim()
                          )),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: widget.accent,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                    child: const Text('Submit'),
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
