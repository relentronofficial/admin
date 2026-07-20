import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:video_player/video_player.dart';

import '../../../core/constants/routes.dart';

/// Video splash — plays the TBT logo animation on cold-boot, then
/// hands off to the correct destination based on auth state.
///
/// Ported from the co-worker's TBTVideoSplashScreen. Behaviour matches
/// 1:1:
///   * Plays `assets/videos/tbt_logo_video.mp4` on init
///   * Navigates as soon as the video hits its natural end, OR
///     6 seconds elapse (fallback), OR the video fails to init
///   * Destination = dashboard if session valid, else login
///
/// Sits in front of the go_router redirect logic — the splash renders
/// as the app's initial route, and after the video ends we `go` to
/// whichever route the auth check decides on. From that point the
/// normal auth-gated router redirect logic takes over.
class VideoSplashScreen extends ConsumerStatefulWidget {
  const VideoSplashScreen({super.key});

  @override
  ConsumerState<VideoSplashScreen> createState() => _VideoSplashScreenState();
}

class _VideoSplashScreenState extends ConsumerState<VideoSplashScreen> {
  late final VideoPlayerController _controller;
  bool _navigated = false;
  Timer? _fallbackTimer;
  bool _initFailed = false;

  @override
  void initState() {
    super.initState();
    _controller =
        VideoPlayerController.asset('assets/videos/tbt_logo_video.mp4');
    _controller.initialize().then((_) {
      if (!mounted) return;
      setState(() {});
      _controller.play();
    }).catchError((error) {
      // Surface an initialization failure so we don't just black-screen.
      // The fallback timer will still navigate; this just skips the wait.
      debugPrint('Video splash init failed: $error');
      _initFailed = true;
      _navigateNext();
    });

    _controller.addListener(() {
      if (!mounted) return;
      if (_controller.value.position >= _controller.value.duration) {
        _navigateNext();
      }
    });

    // Hard-cap the splash at 6 seconds — matches the co-worker's
    // TBTVideoSplashScreen fallback so a slow-loading video never
    // strands the user on a black screen.
    _fallbackTimer = Timer(const Duration(seconds: 6), _navigateNext);
  }

  Future<void> _navigateNext() async {
    if (_navigated || !mounted) return;
    _navigated = true;
    _fallbackTimer?.cancel();
    if (!_initFailed) {
      await _controller.pause();
    }

    if (!mounted) return;
    // Send everyone to /dashboard — the router's redirect will bounce
    // unauthenticated users to /login. This keeps splash decoupled from
    // auth details; we don't duplicate session-check logic here.
    context.go(AppRoutes.dashboard);
  }

  @override
  void dispose() {
    _fallbackTimer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: Center(
        child: _initFailed
            ? const _Fallback()
            : _controller.value.isInitialized
                ? AspectRatio(
                    aspectRatio: _controller.value.aspectRatio,
                    child: VideoPlayer(_controller),
                  )
                : const _Fallback(),
      ),
    );
  }
}

class _Fallback extends StatelessWidget {
  const _Fallback();
  @override
  Widget build(BuildContext context) => const CircularProgressIndicator(
        valueColor: AlwaysStoppedAnimation<Color>(Color(0xFFdc2626)),
      );
}
