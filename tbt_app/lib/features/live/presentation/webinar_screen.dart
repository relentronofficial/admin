import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:video_player/video_player.dart';

import '../../../core/constants/api.dart';
import '../../../shared/api/dio_client.dart';
import '../../../shared/api/dio_provider.dart';
import '../../../shared/providers/socket_provider.dart';
import '../../../shared/socket/socket_events.dart';
import '../../../shared/theme/tbt_theme.dart';

import '../../../shared/theme/theme_tokens.dart';
/// Standalone webinar viewer — mirrors the web `/live/[webinarId]` page.
/// Fetches webinar via `GET /api/user/webinars/:id`, then:
/// - if `status == "live"` and `streamUrl` is set: plays the stream.
/// - else if `recordingUrl` is set: plays the recording.
/// - else: shows a countdown + status text.
/// Subscribes to `live:started`, `live:ended`, `live:attendee_count` for
/// real-time transitions.
class WebinarScreen extends ConsumerStatefulWidget {
  const WebinarScreen({super.key, required this.webinarId});

  final String webinarId;

  @override
  ConsumerState<WebinarScreen> createState() => _WebinarScreenState();
}

class _WebinarScreenState extends ConsumerState<WebinarScreen> {
  _WebinarState _state = _WebinarState.loading;
  Map<String, dynamic>? _webinar;
  String? _error;
  int? _attendeeCount;

  // Socket-updated state — takes precedence over the REST snapshot.
  String? _liveStatus;
  String? _liveStreamUrl;
  String? _liveRecordingUrl;

  // Countdown timer + video player controller.
  Timer? _countdownTicker;
  VideoPlayerController? _videoController;
  String? _mountedVideoUrl;

  @override
  void initState() {
    super.initState();
    _fetch();
    _wireSocket();
    _countdownTicker = Timer.periodic(
      const Duration(seconds: 1),
      (_) => mounted ? setState(() {}) : null,
    );
  }

  @override
  void dispose() {
    _countdownTicker?.cancel();
    _videoController?.dispose();
    _unwireSocket();
    super.dispose();
  }

  // ── Fetch + socket wiring ─────────────────────────────────────────────────

  Future<void> _fetch() async {
    try {
      final res = await ref
          .read(dioProvider)
          .get<Map<String, dynamic>>('$kUserWebinars/${widget.webinarId}');
      final data = res.data?['data'] as Map<String, dynamic>?;
      if (data == null) {
        setState(() {
          _error = 'Session not found';
          _state = _WebinarState.error;
        });
        return;
      }
      setState(() {
        _webinar = data;
        _state = _WebinarState.loaded;
      });
      _maybeMountVideo();
    } on DioException catch (e) {
      final msg = mapDioError(e).message;
      setState(() {
        _error = msg;
        _state = _WebinarState.error;
      });
    }
  }

  void _wireSocket() {
    final s = ref.read(socketNotifierProvider.notifier);
    s.emit(kSocketJoinLive, widget.webinarId);
    s.on(kSocketLiveStarted, _onLiveStarted);
    s.on(kSocketLiveEnded, _onLiveEnded);
    s.on(kSocketLiveAttendeeCount, _onAttendeeCount);
  }

  void _unwireSocket() {
    final s = ref.read(socketNotifierProvider.notifier);
    s.emit(kSocketLeaveLive, widget.webinarId);
    s.off(kSocketLiveStarted, _onLiveStarted);
    s.off(kSocketLiveEnded, _onLiveEnded);
    s.off(kSocketLiveAttendeeCount, _onAttendeeCount);
  }

  void _onLiveStarted(dynamic payload) {
    try {
      final m = (payload as Map<dynamic, dynamic>).cast<String, dynamic>();
      if (!mounted) return;
      setState(() {
        _liveStatus = 'live';
        _liveStreamUrl = m['streamUrl'] as String?;
      });
      _maybeMountVideo();
    } catch (_) {}
  }

  void _onLiveEnded(dynamic payload) {
    try {
      final m = (payload as Map<dynamic, dynamic>).cast<String, dynamic>();
      if (!mounted) return;
      setState(() {
        _liveStatus = 'ended';
        _liveRecordingUrl = m['recordingUrl'] as String?;
      });
      _maybeMountVideo();
    } catch (_) {}
  }

  void _onAttendeeCount(dynamic payload) {
    try {
      final m = (payload as Map<dynamic, dynamic>).cast<String, dynamic>();
      if (!mounted) return;
      setState(() => _attendeeCount = (m['count'] as num?)?.toInt());
    } catch (_) {}
  }

  // ── Video controller lifecycle ────────────────────────────────────────────

  String? get _effectiveStatus =>
      _liveStatus ?? (_webinar?['status'] as String?);
  String? get _effectiveStreamUrl =>
      _liveStreamUrl ?? (_webinar?['streamUrl'] as String?);
  String? get _effectiveRecordingUrl =>
      _liveRecordingUrl ?? (_webinar?['recordingUrl'] as String?);

  String? get _videoUrl {
    final status = _effectiveStatus;
    if (status == 'live') {
      final s = _effectiveStreamUrl;
      if (s != null && s.isNotEmpty && _isPlayable(s)) return s;
    }
    final r = _effectiveRecordingUrl;
    if (r != null && r.isNotEmpty && _isPlayable(r)) return r;
    return null;
  }

  bool _isPlayable(String url) {
    // video_player supports HLS (.m3u8), MP4, and other HTTP video formats
    // via ExoPlayer on Android. External meeting links (Zoom / Meet) are not
    // playable — we surface an "Open in browser" fallback instead.
    final u = url.toLowerCase();
    if (u.endsWith('.m3u8') || u.endsWith('.mp4') || u.endsWith('.mov')) {
      return true;
    }
    if (u.contains('zoom.us') || u.contains('meet.google') || u.contains('teams')) {
      return false;
    }
    return true; // optimistic fallback — try to play
  }

  Future<void> _maybeMountVideo() async {
    final url = _videoUrl;
    if (url == _mountedVideoUrl) return;
    _videoController?.dispose();
    _videoController = null;
    _mountedVideoUrl = null;
    if (url == null) {
      if (mounted) setState(() {});
      return;
    }
    final controller = VideoPlayerController.networkUrl(Uri.parse(url));
    try {
      await controller.initialize();
      await controller.setLooping(false);
      if (_effectiveStatus == 'live') {
        await controller.play();
      }
      if (!mounted) {
        controller.dispose();
        return;
      }
      setState(() {
        _videoController = controller;
        _mountedVideoUrl = url;
      });
    } catch (_) {
      controller.dispose();
      if (mounted) setState(() {});
    }
  }

  // ── Countdown label (updates every second) ────────────────────────────────

  String? _countdownLabel() {
    final iso = _webinar?['scheduledAt'] as String?;
    if (iso == null) return null;
    final target = DateTime.tryParse(iso);
    if (target == null) return null;
    final diff = target.difference(DateTime.now());
    if (diff.isNegative) return null;
    if (diff.inDays > 0) {
      return '${diff.inDays}d ${diff.inHours.remainder(24)}h';
    }
    if (diff.inHours > 0) {
      return '${diff.inHours}h ${diff.inMinutes.remainder(60)}m';
    }
    if (diff.inMinutes > 0) {
      return '${diff.inMinutes}m ${diff.inSeconds.remainder(60)}s';
    }
    return '${diff.inSeconds}s';
  }

  String _formatDate(String? iso) {
    if (iso == null) return '';
    final dt = DateTime.tryParse(iso)?.toLocal();
    if (dt == null) return '';
    const months = [
      '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    final hour = dt.hour == 0 ? 12 : (dt.hour > 12 ? dt.hour - 12 : dt.hour);
    final ampm = dt.hour >= 12 ? 'PM' : 'AM';
    final minute = dt.minute.toString().padLeft(2, '0');
    return '${months[dt.month]} ${dt.day}, ${dt.year} · $hour:$minute $ampm';
  }

  // ── Build ────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: context.tokens.bgSurface,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: Icon(Icons.arrow_back_ios_new,
              color: context.tokens.textPrimary, size: 18),
          onPressed: () => context.pop(),
        ),
        title: Text(
          'LIVE SESSION',
          style: TextStyle(
            fontFamily: 'Rajdhani',
            fontSize: 17,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.5,
            color: context.tokens.textPrimary,
          ),
        ),
      ),
      body: _buildBody(context),
    );
  }

  Widget _buildBody(BuildContext context) {
    switch (_state) {
      case _WebinarState.loading:
        return Center(
          child: CircularProgressIndicator(strokeWidth: 2, color: Theme.of(context).colorScheme.primary),
        );
      case _WebinarState.error:
        return Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.error_outline,
                    color: context.tokens.textMuted, size: 40),
                const SizedBox(height: 12),
                Text(
                  _error ?? 'Failed to load session',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: context.tokens.textSecondary),
                ),
                const SizedBox(height: 12),
                TextButton(
                  onPressed: () {
                    setState(() {
                      _state = _WebinarState.loading;
                      _error = null;
                    });
                    _fetch();
                  },
                  child: const Text('Retry'),
                ),
              ],
            ),
          ),
        );
      case _WebinarState.loaded:
        return _buildLoaded(context);
    }
  }

  Widget _buildLoaded(BuildContext context) {
    final accent = context.tbt.accent;
    final w = _webinar!;
    final title = (w['title'] as String?) ?? 'Live Session';
    final desc = w['description'] as String?;
    final host = w['host'] as Map<String, dynamic>?;
    final hostName = host?['fullName'] as String?;
    final scheduledAt = w['scheduledAt'] as String?;
    final status = _effectiveStatus;
    final isLive = status == 'live';

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Status / attendee / scheduled-at chips.
          Wrap(
            spacing: 8,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              if (isLive)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.redAccent.withValues(alpha: 0.18),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 6,
                        height: 6,
                        decoration: const BoxDecoration(
                          color: Colors.redAccent,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 6),
                      const Text(
                        'LIVE',
                        style: TextStyle(
                          color: Colors.redAccent,
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 1.5,
                        ),
                      ),
                    ],
                  ),
                ),
              if (isLive && _attendeeCount != null)
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.people_outline,
                        color: context.tokens.textMuted, size: 14),
                    const SizedBox(width: 4),
                    Text(
                      '$_attendeeCount',
                      style: TextStyle(
                        color: context.tokens.textMuted,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              if (scheduledAt != null)
                Text(
                  _formatDate(scheduledAt),
                  style: TextStyle(
                    color: context.tokens.textMuted,
                    fontSize: 12,
                  ),
                ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            title,
            style: TextStyle(
              fontFamily: 'Rajdhani',
              fontSize: 22,
              fontWeight: FontWeight.w700,
              color: context.tokens.textPrimary,
              height: 1.3,
            ),
          ),
          if (hostName != null && hostName.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                'Hosted by $hostName',
                style: TextStyle(color: context.tokens.textMuted, fontSize: 13),
              ),
            ),
          const SizedBox(height: 16),
          _buildVideoArea(context, status, accent, scheduledAt),
          if (desc != null && desc.isNotEmpty) ...[
            const SizedBox(height: 16),
            Text(
              desc,
              style: TextStyle(
                color: context.tokens.textSecondary,
                fontSize: 13,
                height: 1.5,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildVideoArea(BuildContext context, String? status, Color accent,
      String? scheduledAt) {
    return AspectRatio(
      aspectRatio: 16 / 9,
      child: Container(
        decoration: BoxDecoration(
          color: Colors.black,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: context.tokens.borderCard),
        ),
        clipBehavior: Clip.hardEdge,
        child: _buildVideoInner(context, status, accent, scheduledAt),
      ),
    );
  }

  Widget _buildVideoInner(BuildContext context, String? status, Color accent,
      String? scheduledAt) {
    final url = _videoUrl;
    final controller = _videoController;
    if (url != null && controller != null && controller.value.isInitialized) {
      return Stack(
        alignment: Alignment.bottomCenter,
        children: [
          Center(
            child: AspectRatio(
              aspectRatio: controller.value.aspectRatio,
              child: VideoPlayer(controller),
            ),
          ),
          VideoProgressIndicator(
            controller,
            allowScrubbing: true,
            colors: VideoProgressColors(
              playedColor: accent,
              bufferedColor: Colors.white24,
              backgroundColor: Colors.white10,
            ),
          ),
          Positioned(
            left: 12,
            bottom: 20,
            child: IconButton(
              icon: Icon(
                controller.value.isPlaying ? Icons.pause : Icons.play_arrow,
                color: Colors.white,
              ),
              onPressed: () {
                setState(() {
                  controller.value.isPlaying
                      ? controller.pause()
                      : controller.play();
                });
              },
            ),
          ),
        ],
      );
    }

    // External meeting link — offer to open externally.
    final external = _effectiveStreamUrl ?? _effectiveRecordingUrl;
    if (external != null &&
        external.isNotEmpty &&
        !_isPlayable(external)) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.open_in_new, color: Colors.white38, size: 40),
            const SizedBox(height: 10),
            const Text(
              'This session opens in an external app',
              style: TextStyle(color: Colors.white70, fontSize: 13),
            ),
            const SizedBox(height: 12),
            ElevatedButton.icon(
              icon: const Icon(Icons.launch, size: 16),
              label: const Text('Open'),
              style: ElevatedButton.styleFrom(
                backgroundColor: accent,
                foregroundColor: Colors.white,
              ),
              onPressed: () => launchUrl(
                Uri.parse(external),
                mode: LaunchMode.externalApplication,
              ),
            ),
          ],
        ),
      );
    }

    // Scheduled: countdown; Ended: recording unavailable; other: waiting.
    final countdown = _countdownLabel();
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.videocam_outlined,
              color: Colors.white38, size: 48),
          const SizedBox(height: 12),
          if (status == 'scheduled' && countdown != null)
            Column(
              children: [
                Text(
                  'Starts in $countdown',
                  style: TextStyle(
                    color: accent,
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  _formatDate(scheduledAt),
                  style: const TextStyle(
                    color: Colors.white54,
                    fontSize: 12,
                  ),
                ),
              ],
            )
          else if (status == 'ended')
            const Text(
              'Recording not available yet',
              style: TextStyle(color: Colors.white54, fontSize: 13),
            )
          else
            const Text(
              'Waiting for the session to start…',
              style: TextStyle(color: Colors.white54, fontSize: 13),
            ),
        ],
      ),
    );
  }
}

enum _WebinarState { loading, loaded, error }
