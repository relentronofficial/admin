import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
// LiveKit exports its own ConnectionState enum which clashes with Flutter's
// (used by AsyncSnapshot) — hide LiveKit's, matching live_call_screen.dart.
import 'package:livekit_client/livekit_client.dart' hide ConnectionState;
import 'package:permission_handler/permission_handler.dart';

import '../../../core/exceptions/app_exception.dart';
import '../../../shared/theme/tbt_theme.dart';
import '../../live/presentation/sheets/participants_sheet.dart';
import '../providers/onboarding_provider.dart';

/// Virtual Self Onboarding verification call — a new, camera-enabled LiveKit
/// screen (unlike live_call_screen.dart's audio-only member mode, this is a
/// genuine face-to-face Zoom-like experience for both sides). No reusable
/// "LiveCallCore" abstraction exists in this codebase (per repo audit), so
/// this duplicates the proven Room-bootstrap/listener pattern from
/// live_call_screen.dart rather than trying to generalize that screen.
/// ParticipantsSheet is reused as-is (already generic over Room). Chat uses
/// the same `sendText`/text-stream protocol on topic `lk.chat` that backs
/// web's `useChat()` (`@livekit/components-core`'s `setupChat`), so Flutter
/// interoperates with Web/Admin chat without a second protocol. See
/// ONBOARDING_LIVE_MEETING_SPECKIT.md.
enum _Stage { permission, preview, connecting, live, ended, error }

/// Why the call ended, for terminal-screen messaging. `reconnectFailed` and
/// `removed`/`hostEnded` are distinguished so a transient network failure
/// never reads as "Meeting Ended" the way a genuine end does.
enum _EndReason { hostEnded, removed, reconnectFailed, unknown }

const _kChatTopic = 'lk.chat';

class _ChatMessage {
  const _ChatMessage({required this.senderName, required this.text, required this.timestamp, required this.isLocal});
  final String senderName;
  final String text;
  final DateTime timestamp;
  final bool isLocal;
}

class _ParticipantTileData {
  const _ParticipantTileData({
    required this.identity,
    required this.displayName,
    required this.isLocal,
    required this.isHost,
    required this.isMicOn,
    required this.isCameraOn,
    required this.isSpeaking,
    required this.videoTrack,
  });
  final String identity;
  final String displayName;
  final bool isLocal;
  final bool isHost;
  final bool isMicOn;
  final bool isCameraOn;
  final bool isSpeaking;
  final VideoTrack? videoTrack;
}

class OnboardingMeetingScreen extends ConsumerStatefulWidget {
  const OnboardingMeetingScreen({super.key, required this.meetingId});

  final String meetingId;

  @override
  ConsumerState<OnboardingMeetingScreen> createState() => _OnboardingMeetingScreenState();
}

class _OnboardingMeetingScreenState extends ConsumerState<OnboardingMeetingScreen> with WidgetsBindingObserver {
  _Stage _stage = _Stage.permission;
  String _errorMessage = '';
  String _meetingTitle = 'Onboarding Verification Call';
  DateTime? _startedAt;

  LocalVideoTrack? _previewTrack;
  bool _micOn = true;
  bool _cameraOn = true;

  Room? _room;
  EventsListener<RoomEvent>? _listener;
  List<_ParticipantTileData> _tiles = const [];
  List<MediaDevice> _videoDevices = [];
  int _cameraDeviceIndex = 0;

  bool _isReconnecting = false;
  _EndReason _endReason = _EndReason.unknown;
  bool _leavingIntentionally = false;

  bool _cameraPausedByLifecycle = false;

  bool _showChat = false;
  final List<_ChatMessage> _chatMessages = [];
  final TextEditingController _chatController = TextEditingController();
  bool _sendingChat = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _requestPermissions();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _chatController.dispose();
    _previewTrack?.dispose();
    _listener?.dispose();
    _room?.dispose();
    super.dispose();
  }

  // ── App lifecycle (Fix 8) ────────────────────────────────────────────────
  // Never disconnect the call on backgrounding — only pause the camera
  // (matches typical mobile video-conferencing behavior: audio continues,
  // video pauses) and restore it on resume if it was on before.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (_stage != _Stage.live) return;
    final local = _room?.localParticipant;
    if (local == null) return;

    if (state == AppLifecycleState.paused || state == AppLifecycleState.inactive) {
      if (_cameraOn && !_cameraPausedByLifecycle) {
        _cameraPausedByLifecycle = true;
        local.setCameraEnabled(false);
      }
    } else if (state == AppLifecycleState.resumed) {
      if (_cameraPausedByLifecycle) {
        _cameraPausedByLifecycle = false;
        if (_cameraOn) local.setCameraEnabled(true);
      }
    }
  }

  Future<void> _requestPermissions() async {
    final micStatus = await Permission.microphone.request();
    final camStatus = await Permission.camera.request();
    if (!mounted) return;
    if (!micStatus.isGranted || !camStatus.isGranted) {
      setState(() {
        _stage = _Stage.error;
        _errorMessage = 'Camera and microphone access are required to join this meeting.';
      });
      return;
    }
    await _startPreview();
  }

  Future<void> _startPreview() async {
    // Best-effort meeting info (title/host/participant count) for the
    // pre-join screen — reuses the already-loaded onboardingMeetingsProvider
    // rather than a new fetch. See ONBOARDING_LIVE_MEETING_SPECKIT.md
    // (pre-join consistency fix).
    final meetings = ref.read(onboardingMeetingsProvider).valueOrNull;
    final meta = meetings?.where((m) => m.id == widget.meetingId).firstOrNull;
    if (meta != null) _meetingTitle = meta.title;

    try {
      final track = await LocalVideoTrack.createCameraTrack();
      if (!mounted) return;
      setState(() {
        _previewTrack = track;
        _stage = _Stage.preview;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _stage = _Stage.preview); // preview optional — still allow join without it
    }
  }

  Future<void> _join() async {
    setState(() => _stage = _Stage.connecting);

    dynamic creds;
    try {
      creds = await ref.read(onboardingMeetingsRepositoryProvider).join(widget.meetingId);
    } on AppException catch (e) {
      // mapDioError already unwraps the backend's { error: 'msg' } or
      // { error: { code, message } } shape — e.message is specific
      // ("You are not invited to this meeting", "This meeting is not
      // currently joinable", "No internet connection", etc.), not a
      // generic fallback. See ONBOARDING_LIVE_MEETING_SPECKIT.md (Fix 11).
      if (!mounted) return;
      setState(() {
        _stage = _Stage.error;
        _errorMessage = e.message;
      });
      return;
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _stage = _Stage.error;
        _errorMessage = 'Something went wrong requesting access to this meeting. Please try again.';
      });
      return;
    }

    try {
      await _previewTrack?.dispose();
      _previewTrack = null;

      final room = Room(roomOptions: const RoomOptions(adaptiveStream: true));
      final listener = room.createListener();
      _room = room;
      _listener = listener;
      _meetingTitle = creds.title;
      _startedAt = creds.startedAt;

      listener
        ..on<RoomConnectedEvent>((_) => _refreshParticipants())
        ..on<ParticipantConnectedEvent>((_) => _refreshParticipants())
        ..on<ParticipantDisconnectedEvent>((_) => _refreshParticipants())
        ..on<TrackSubscribedEvent>((_) => _refreshParticipants())
        ..on<TrackUnsubscribedEvent>((_) => _refreshParticipants())
        ..on<TrackPublishedEvent>((_) => _refreshParticipants())
        ..on<TrackUnpublishedEvent>((_) => _refreshParticipants())
        ..on<TrackMutedEvent>((_) => _refreshParticipants())
        ..on<TrackUnmutedEvent>((_) => _refreshParticipants())
        ..on<ActiveSpeakersChangedEvent>((_) => _refreshParticipants())
        // Reconnection (Fix 2) — keep the live meeting UI visible and show
        // a "Reconnecting…" indicator instead of jumping to a terminal
        // "ended" state. Only RoomDisconnectedEvent (below) is terminal.
        ..on<RoomReconnectingEvent>((_) {
          if (mounted) setState(() => _isReconnecting = true);
        })
        ..on<RoomReconnectedEvent>((_) {
          if (mounted) setState(() => _isReconnecting = false);
          _refreshParticipants();
        })
        ..on<RoomDisconnectedEvent>((event) {
          if (_leavingIntentionally) return;
          if (!mounted) return;
          setState(() {
            _stage = _Stage.ended;
            _isReconnecting = false;
            _endReason = switch (event.reason) {
              DisconnectReason.roomDeleted || DisconnectReason.serverShutdown => _EndReason.hostEnded,
              DisconnectReason.participantRemoved => _EndReason.removed,
              DisconnectReason.reconnectAttemptsExceeded ||
              DisconnectReason.signalingConnectionFailure ||
              DisconnectReason.joinFailure ||
              DisconnectReason.stateMismatch ||
              DisconnectReason.disconnected =>
                _EndReason.reconnectFailed,
              _ => _EndReason.unknown,
            };
          });
        });

      room.registerTextStreamHandler(_kChatTopic, (reader, participantIdentity) async {
        final text = await reader.readAll();
        if (!mounted) return;
        final sender = room.getParticipantByIdentity(participantIdentity);
        final senderName = (sender?.name.isNotEmpty ?? false) ? sender!.name : participantIdentity;
        setState(() {
          _chatMessages.add(_ChatMessage(
            senderName: senderName,
            text: text,
            timestamp: DateTime.fromMillisecondsSinceEpoch(reader.info?.timestamp ?? DateTime.now().millisecondsSinceEpoch),
            isLocal: false,
          ));
        });
      });

      await room.connect(creds.wsUrl, creds.token);
      await room.localParticipant?.setMicrophoneEnabled(_micOn);
      await room.localParticipant?.setCameraEnabled(_cameraOn);

      _videoDevices = await Hardware.instance.videoInputs().catchError((_) => <MediaDevice>[]);

      if (!mounted) return;
      setState(() => _stage = _Stage.live);
      _refreshParticipants();
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _stage = _Stage.error;
        _errorMessage = "Couldn't connect to the meeting. Please check your network connection and try again.";
      });
    }
  }

  void _refreshParticipants() {
    final room = _room;
    if (room == null) return;

    _ParticipantTileData buildTile(Participant p, {required bool isLocal}) {
      VideoTrack? track;
      for (final pub in p.videoTrackPublications) {
        final t = pub.track;
        if (t is VideoTrack && (isLocal || pub.subscribed)) {
          track = t;
          break;
        }
      }
      final rawName = p.name.isNotEmpty ? p.name : p.identity;
      return _ParticipantTileData(
        identity: p.identity,
        displayName: isLocal ? '$rawName (You)' : rawName,
        isLocal: isLocal,
        isHost: p.identity.startsWith('user_'),
        isMicOn: p.isMicrophoneEnabled(),
        isCameraOn: p.isCameraEnabled(),
        isSpeaking: p.isSpeaking,
        videoTrack: track,
      );
    }

    final tiles = <_ParticipantTileData>[];
    final local = room.localParticipant;
    if (local != null) tiles.add(buildTile(local, isLocal: true));
    for (final p in room.remoteParticipants.values) {
      tiles.add(buildTile(p, isLocal: false));
    }

    if (!mounted) return;
    setState(() => _tiles = tiles);
  }

  Future<void> _toggleMic() async {
    final local = _room?.localParticipant;
    if (local == null) return;
    await local.setMicrophoneEnabled(!_micOn);
    if (mounted) setState(() => _micOn = !_micOn);
    _refreshParticipants();
  }

  Future<void> _toggleCamera() async {
    final local = _room?.localParticipant;
    if (local == null) return;
    await local.setCameraEnabled(!_cameraOn);
    if (mounted) setState(() => _cameraOn = !_cameraOn);
    _refreshParticipants();
  }

  Future<void> _switchCamera() async {
    if (_videoDevices.length < 2) return;
    final local = _room?.localParticipant;
    if (local == null) return;
    _cameraDeviceIndex = (_cameraDeviceIndex + 1) % _videoDevices.length;
    final nextDevice = _videoDevices[_cameraDeviceIndex];
    for (final pub in local.videoTrackPublications) {
      final track = pub.track;
      if (track is LocalVideoTrack) {
        await track.switchCamera(nextDevice.deviceId);
      }
    }
  }

  Future<void> _sendChatMessage() async {
    final text = _chatController.text.trim();
    final local = _room?.localParticipant;
    if (text.isEmpty || local == null || _sendingChat) return;
    setState(() => _sendingChat = true);
    _chatController.clear();
    try {
      await local.sendText(text, options: SendTextOptions(topic: _kChatTopic));
      if (mounted) {
        setState(() {
          _chatMessages.add(_ChatMessage(
            senderName: local.name.isNotEmpty ? local.name : 'You',
            text: text,
            timestamp: DateTime.now(),
            isLocal: true,
          ));
        });
      }
    } catch (_) {
      // Non-fatal — chat delivery failure shouldn't interrupt the call.
    } finally {
      if (mounted) setState(() => _sendingChat = false);
    }
  }

  Future<void> _leave() async {
    _leavingIntentionally = true;
    await ref.read(onboardingMeetingsRepositoryProvider).leave(widget.meetingId).catchError((_) {});
    await _room?.disconnect();
    if (mounted) Navigator.of(context).maybePop();
  }

  @override
  Widget build(BuildContext context) {
    final accent = context.tbt.accent;
    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: switch (_stage) {
          _Stage.permission || _Stage.connecting => Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const CircularProgressIndicator(color: Colors.white),
                  const SizedBox(height: 16),
                  Text(_stage == _Stage.connecting ? 'Connecting…' : 'Requesting camera & microphone…',
                      style: const TextStyle(color: Colors.white70)),
                ],
              ),
            ),
          _Stage.preview => _PreJoinView(
              previewTrack: _previewTrack,
              micOn: _micOn,
              cameraOn: _cameraOn,
              meetingTitle: _meetingTitle,
              onToggleMic: () => setState(() => _micOn = !_micOn),
              onToggleCamera: () => setState(() => _cameraOn = !_cameraOn),
              onJoin: _join,
              accent: accent,
            ),
          _Stage.live => Stack(
              children: [
                _LiveView(
                  room: _room!,
                  title: _meetingTitle,
                  startedAt: _startedAt,
                  tiles: _tiles,
                  micOn: _micOn,
                  cameraOn: _cameraOn,
                  showChat: _showChat,
                  chatMessages: _chatMessages,
                  chatController: _chatController,
                  sendingChat: _sendingChat,
                  onToggleMic: _toggleMic,
                  onToggleCamera: _toggleCamera,
                  onSwitchCamera: _switchCamera,
                  onToggleChat: () => setState(() => _showChat = !_showChat),
                  onSendChat: _sendChatMessage,
                  onLeave: _leave,
                  accent: accent,
                ),
                if (_isReconnecting)
                  Positioned(
                    top: 60,
                    left: 0,
                    right: 0,
                    child: Center(
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                        decoration: BoxDecoration(color: Colors.black87, borderRadius: BorderRadius.circular(20)),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)),
                            SizedBox(width: 10),
                            Text('Reconnecting…', style: TextStyle(color: Colors.white, fontSize: 13)),
                          ],
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          _Stage.ended => Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      switch (_endReason) {
                        _EndReason.removed => 'Removed from Meeting',
                        _EndReason.reconnectFailed => 'Connection Lost',
                        _ => 'Meeting Ended',
                      },
                      style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      switch (_endReason) {
                        _EndReason.removed => 'You were removed from this meeting by the host.',
                        _EndReason.reconnectFailed => "We couldn't reconnect you to the meeting. Please check your network and rejoin.",
                        _ => 'The verification call has ended.',
                      },
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: Colors.white70),
                    ),
                    const SizedBox(height: 24),
                    ElevatedButton(onPressed: () => Navigator.of(context).maybePop(), child: const Text('Close')),
                  ],
                ),
              ),
            ),
          _Stage.error => Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.error_outline, color: Colors.white70, size: 40),
                    const SizedBox(height: 12),
                    Text(_errorMessage, textAlign: TextAlign.center, style: const TextStyle(color: Colors.white70)),
                    const SizedBox(height: 24),
                    ElevatedButton(onPressed: () => Navigator.of(context).maybePop(), child: const Text('Go Back')),
                  ],
                ),
              ),
            ),
        },
      ),
    );
  }
}

class _PreJoinView extends StatelessWidget {
  const _PreJoinView({
    required this.previewTrack,
    required this.micOn,
    required this.cameraOn,
    required this.meetingTitle,
    required this.onToggleMic,
    required this.onToggleCamera,
    required this.onJoin,
    required this.accent,
  });

  final LocalVideoTrack? previewTrack;
  final bool micOn;
  final bool cameraOn;
  final String meetingTitle;
  final VoidCallback onToggleMic;
  final VoidCallback onToggleCamera;
  final VoidCallback onJoin;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
          child: Text(meetingTitle, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 16), textAlign: TextAlign.center),
        ),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: (cameraOn && previewTrack != null)
                  ? VideoTrackRenderer(previewTrack!)
                  : Container(
                      color: const Color(0xFF1a1a1a),
                      child: const Center(child: Icon(Icons.videocam_off, color: Colors.white38, size: 48)),
                    ),
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.all(20),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _RoundToggle(icon: micOn ? Icons.mic : Icons.mic_off, active: micOn, onTap: onToggleMic),
              const SizedBox(width: 16),
              _RoundToggle(icon: cameraOn ? Icons.videocam : Icons.videocam_off, active: cameraOn, onTap: onToggleCamera),
              const SizedBox(width: 24),
              ElevatedButton(
                onPressed: onJoin,
                style: ElevatedButton.styleFrom(backgroundColor: accent, padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 14)),
                child: const Text('Join Meeting', style: TextStyle(fontWeight: FontWeight.w700)),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _RoundToggle extends StatelessWidget {
  const _RoundToggle({required this.icon, required this.active, required this.onTap});
  final IconData icon;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      customBorder: const CircleBorder(),
      child: CircleAvatar(
        radius: 24,
        backgroundColor: active ? const Color(0xFF2a2a2a) : const Color(0xFF7f1d1d),
        child: Icon(icon, color: Colors.white),
      ),
    );
  }
}

class _DurationTicker extends StatefulWidget {
  const _DurationTicker({required this.startedAt});
  final DateTime? startedAt;

  @override
  State<_DurationTicker> createState() => _DurationTickerState();
}

class _DurationTickerState extends State<_DurationTicker> {
  Timer? _timer;
  final ValueNotifier<int> _tick = ValueNotifier(0);

  @override
  void initState() {
    super.initState();
    if (widget.startedAt != null) {
      _timer = Timer.periodic(const Duration(seconds: 1), (_) => _tick.value++);
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    _tick.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final startedAt = widget.startedAt;
    if (startedAt == null) {
      return const Text('Not started', style: TextStyle(color: Colors.white38, fontSize: 12));
    }
    return ValueListenableBuilder<int>(
      valueListenable: _tick,
      builder: (_, __, ___) {
        final secs = DateTime.now().difference(startedAt).inSeconds.clamp(0, 1 << 30);
        final mm = (secs ~/ 60).toString().padLeft(2, '0');
        final ss = (secs % 60).toString().padLeft(2, '0');
        return Text('$mm:$ss', style: const TextStyle(color: Colors.white70, fontSize: 12, fontFeatures: [FontFeature.tabularFigures()]));
      },
    );
  }
}

class _LiveView extends StatelessWidget {
  const _LiveView({
    required this.room,
    required this.title,
    required this.startedAt,
    required this.tiles,
    required this.micOn,
    required this.cameraOn,
    required this.showChat,
    required this.chatMessages,
    required this.chatController,
    required this.sendingChat,
    required this.onToggleMic,
    required this.onToggleCamera,
    required this.onSwitchCamera,
    required this.onToggleChat,
    required this.onSendChat,
    required this.onLeave,
    required this.accent,
  });

  final Room room;
  final String title;
  final DateTime? startedAt;
  final List<_ParticipantTileData> tiles;
  final bool micOn;
  final bool cameraOn;
  final bool showChat;
  final List<_ChatMessage> chatMessages;
  final TextEditingController chatController;
  final bool sendingChat;
  final VoidCallback onToggleMic;
  final VoidCallback onToggleCamera;
  final VoidCallback onSwitchCamera;
  final VoidCallback onToggleChat;
  final VoidCallback onSendChat;
  final VoidCallback onLeave;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    final crossAxisCount = tiles.length <= 1 ? 1 : (tiles.length <= 4 ? 2 : 3);

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: Row(
            children: [
              Expanded(
                child: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis,
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 15)),
              ),
              _DurationTicker(startedAt: startedAt),
              const SizedBox(width: 12),
              const Icon(Icons.people_outline, color: Colors.white70, size: 16),
              const SizedBox(width: 4),
              Text('${tiles.length}', style: const TextStyle(color: Colors.white70, fontSize: 13)),
            ],
          ),
        ),
        Expanded(
          child: Row(
            children: [
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  child: GridView.builder(
                    gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: crossAxisCount,
                      childAspectRatio: 3 / 4,
                      crossAxisSpacing: 6,
                      mainAxisSpacing: 6,
                    ),
                    itemCount: tiles.length,
                    itemBuilder: (_, i) => _VideoTile(data: tiles[i], accent: accent),
                  ),
                ),
              ),
              if (showChat)
                SizedBox(
                  width: 260,
                  child: _ChatPanel(messages: chatMessages, controller: chatController, sending: sendingChat, onSend: onSendChat, onClose: onToggleChat),
                ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _RoundToggle(icon: micOn ? Icons.mic : Icons.mic_off, active: micOn, onTap: onToggleMic),
              const SizedBox(width: 12),
              _RoundToggle(icon: cameraOn ? Icons.videocam : Icons.videocam_off, active: cameraOn, onTap: onToggleCamera),
              const SizedBox(width: 12),
              _RoundToggle(icon: Icons.cameraswitch, active: true, onTap: onSwitchCamera),
              const SizedBox(width: 12),
              _RoundToggle(icon: Icons.chat_bubble_outline, active: !showChat, onTap: onToggleChat),
              const SizedBox(width: 12),
              _RoundToggle(
                icon: Icons.people,
                active: true,
                onTap: () => showModalBottomSheet(
                  context: context,
                  backgroundColor: Colors.transparent,
                  builder: (_) => ParticipantsSheet(room: room, accent: accent),
                ),
              ),
              const SizedBox(width: 12),
              InkWell(
                onTap: onLeave,
                customBorder: const CircleBorder(),
                child: const CircleAvatar(radius: 24, backgroundColor: Colors.red, child: Icon(Icons.call_end, color: Colors.white)),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _ChatPanel extends StatelessWidget {
  const _ChatPanel({required this.messages, required this.controller, required this.sending, required this.onSend, required this.onClose});
  final List<_ChatMessage> messages;
  final TextEditingController controller;
  final bool sending;
  final VoidCallback onSend;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(color: Color(0xFF141414), border: Border(left: BorderSide(color: Color(0xFF2a2a2a)))),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Chat', style: TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.w700)),
                InkWell(onTap: onClose, child: const Icon(Icons.close, color: Colors.white38, size: 16)),
              ],
            ),
          ),
          Expanded(
            child: messages.isEmpty
                ? const Center(child: Padding(padding: EdgeInsets.all(12), child: Text('No messages yet', style: TextStyle(color: Colors.white38, fontSize: 11))))
                : ListView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 10),
                    itemCount: messages.length,
                    itemBuilder: (_, i) {
                      final m = messages[i];
                      return Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(m.isLocal ? 'You' : m.senderName, style: const TextStyle(color: Color(0xFFdc2626), fontSize: 10, fontWeight: FontWeight.w700)),
                            Text(m.text, style: const TextStyle(color: Colors.white70, fontSize: 12)),
                          ],
                        ),
                      );
                    },
                  ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(8, 6, 8, 10),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: controller,
                    style: const TextStyle(color: Colors.white, fontSize: 12),
                    decoration: const InputDecoration(
                      hintText: 'Type a message…',
                      hintStyle: TextStyle(color: Colors.white38, fontSize: 12),
                      isDense: true,
                      contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                      filled: true,
                      fillColor: Color(0xFF1a1a1a),
                      border: OutlineInputBorder(borderRadius: BorderRadius.all(Radius.circular(8)), borderSide: BorderSide.none),
                    ),
                    onSubmitted: (_) => onSend(),
                  ),
                ),
                IconButton(
                  onPressed: sending ? null : onSend,
                  icon: const Icon(Icons.send, size: 18, color: Colors.white70),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _VideoTile extends StatelessWidget {
  const _VideoTile({required this.data, required this.accent});
  final _ParticipantTileData data;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: Container(
        decoration: BoxDecoration(
          border: data.isSpeaking ? Border.all(color: accent, width: 2.5) : null,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Stack(
          fit: StackFit.expand,
          children: [
            Container(color: const Color(0xFF1a1a1a)),
            if (data.videoTrack != null && data.isCameraOn)
              VideoTrackRenderer(data.videoTrack!, mirrorMode: data.isLocal ? VideoViewMirrorMode.mirror : VideoViewMirrorMode.off)
            else
              Center(
                child: CircleAvatar(
                  radius: 28,
                  backgroundColor: const Color(0xFF2a2a2a),
                  child: Text(
                    data.displayName.isNotEmpty ? data.displayName[0].toUpperCase() : '?',
                    style: const TextStyle(color: Colors.white70, fontSize: 20, fontWeight: FontWeight.w700),
                  ),
                ),
              ),
            Positioned(
              left: 8,
              bottom: 8,
              right: 8,
              child: Row(
                children: [
                  Flexible(
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(color: Colors.black54, borderRadius: BorderRadius.circular(6)),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if (data.isHost)
                            const Padding(
                              padding: EdgeInsets.only(right: 4),
                              child: Icon(Icons.shield, size: 10, color: Color(0xFFdc2626)),
                            ),
                          Flexible(
                            child: Text(data.displayName, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white, fontSize: 11)),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 4),
                  Container(
                    padding: const EdgeInsets.all(4),
                    decoration: const BoxDecoration(color: Colors.black54, shape: BoxShape.circle),
                    child: Icon(data.isMicOn ? Icons.mic : Icons.mic_off, size: 11, color: data.isMicOn ? Colors.white70 : Colors.redAccent),
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
