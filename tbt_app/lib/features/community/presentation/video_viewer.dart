import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';

import '../../../shared/media/interruptible_media.dart';
import '../../../shared/media/media_interruption_coordinator.dart';
import '../../../shared/theme/status_bar_scope.dart';

/// Simple fullscreen video player for community video posts (item #23).
///
/// Uses the built-in `video_player` package (already in pubspec). Not a
/// polished player — just play/pause + a scrub bar + close. Good enough
/// for MVP; if we later want lockscreen controls, background playback,
/// or HLS adaptive streaming we can swap for better_player_plus /
/// just_audio in a follow-up.
class VideoViewer extends StatefulWidget {
  const VideoViewer({super.key, required this.url});
  final String url;

  static Future<void> open(BuildContext context, String url) {
    return Navigator.of(context, rootNavigator: true).push<void>(
      PageRouteBuilder(
        opaque: false,
        barrierColor: Colors.black,
        transitionDuration: const Duration(milliseconds: 220),
        pageBuilder: (_, __, ___) => VideoViewer(url: url),
        transitionsBuilder: (_, anim, __, child) =>
            FadeTransition(opacity: anim, child: child),
      ),
    );
  }

  @override
  State<VideoViewer> createState() => _VideoViewerState();
}

class _VideoViewerState extends State<VideoViewer> {
  late final VideoPlayerController _ctl;
  bool _ready = false;
  VoidCallback? _deregisterFromAds;

  @override
  void initState() {
    super.initState();
    _ctl = VideoPlayerController.networkUrl(Uri.parse(widget.url))
      ..initialize().then((_) {
        if (!mounted) return;
        setState(() => _ready = true);
        _ctl.play();
      })
      ..setLooping(true);

    // Plays with sound, so an ad would talk across it (TBT_ADS_SPECKIT.md §7).
    _deregisterFromAds = MediaInterruptionCoordinator.instance.register(
      CallbackInterruptibleMedia(
        id: 'community-video-viewer',
        kind: InterruptibleMediaKind.video,
        // `value.isPlaying` is false until initialize() completes, which is the
        // right answer during that window — there is nothing to interrupt yet.
        isPlayingFn: () => _ctl.value.isPlaying,
        getPositionFn: () => _ctl.value.position.inMilliseconds / 1000,
        pauseFn: () => _ctl.pause(),
        resumeFn: () => _ctl.play(),
        seekFn: (s) => _ctl.seekTo(Duration(milliseconds: (s * 1000).round())),
      ),
    );
  }

  @override
  void dispose() {
    _deregisterFromAds?.call();
    _deregisterFromAds = null;
    _ctl.dispose();
    super.dispose();
  }

  void _togglePlay() {
    setState(() {
      _ctl.value.isPlaying ? _ctl.pause() : _ctl.play();
    });
  }

  @override
  Widget build(BuildContext context) {
    return StatusBarScope.overDarkBackground(
      child: Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          Center(
            child: _ready
                ? AspectRatio(
                    aspectRatio: _ctl.value.aspectRatio,
                    child: GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTap: _togglePlay,
                      child: Stack(
                        alignment: Alignment.center,
                        children: [
                          VideoPlayer(_ctl),
                          // Show a tap-to-play overlay when paused.
                          ValueListenableBuilder<VideoPlayerValue>(
                            valueListenable: _ctl,
                            builder: (_, v, __) {
                              if (v.isPlaying) return const SizedBox.shrink();
                              return Container(
                                width: 72,
                                height: 72,
                                decoration: BoxDecoration(
                                  color: Colors.black.withValues(alpha: 0.5),
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(
                                  Icons.play_arrow,
                                  color: Colors.white,
                                  size: 44,
                                ),
                              );
                            },
                          ),
                        ],
                      ),
                    ),
                  )
                : const CircularProgressIndicator(color: Colors.white),
          ),
          // Vertical drag dismiss.
          Positioned.fill(
            child: GestureDetector(
              behavior: HitTestBehavior.translucent,
              onVerticalDragEnd: (d) {
                if ((d.primaryVelocity?.abs() ?? 0) > 300) {
                  Navigator.of(context).pop();
                }
              },
            ),
          ),
          // Close button + scrub bar overlays.
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(6),
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: Material(
                    color: Colors.black.withValues(alpha: 0.5),
                    shape: const CircleBorder(),
                    child: InkWell(
                      customBorder: const CircleBorder(),
                      onTap: () => Navigator.of(context).pop(),
                      child: const SizedBox(
                        width: 40,
                        height: 40,
                        child: Icon(Icons.close, color: Colors.white, size: 20),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
          if (_ready)
            Positioned(
              bottom: 24,
              left: 20,
              right: 20,
              child: VideoProgressIndicator(
                _ctl,
                allowScrubbing: true,
                colors: const VideoProgressColors(
                  playedColor: Color(0xFFE50914),
                  bufferedColor: Colors.white24,
                  backgroundColor: Colors.white12,
                ),
              ),
            ),
        ],
      ),
    ),
    );
  }
}

/// URL sniff — treat any `.mp4/.mov/.webm/.m3u8` as video for
/// rendering purposes. Not perfect (a JPG could have a video extension
/// spoofed) but a good-enough client heuristic while the backend
/// doesn't tag media type explicitly.
bool isVideoUrl(String url) {
  final lower = url.toLowerCase();
  return lower.contains('.mp4') ||
      lower.contains('.mov') ||
      lower.contains('.webm') ||
      lower.contains('.m3u8');
}
