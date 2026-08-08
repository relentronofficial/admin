import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../providers/ad_campaign_provider.dart';
import 'fullscreen_ad_overlay.dart';

/// Single mount point for the ad system — TBT_ADS_SPECKIT.md §10.
///
/// Wraps the shell body in a Stack so the overlay covers the bottom nav and the
/// mini-player while every branch keeps its state. Deliberately NOT a route
/// push: pushing would tear down the screen underneath, which is exactly what
/// this feature must never do.
class AdHost extends ConsumerStatefulWidget {
  const AdHost({super.key, required this.child});

  final Widget child;

  @override
  ConsumerState<AdHost> createState() => _AdHostState();
}

class _AdHostState extends ConsumerState<AdHost> with WidgetsBindingObserver {
  /// Lets the first route settle and players register before asking, so the
  /// interruption snapshot is complete when an ad does arrive.
  static const _launchDelay = Duration(milliseconds: 1200);

  /// A redirect chain (`/` → `/dashboard`) should produce one request, not two.
  static const _routeSettle = Duration(milliseconds: 600);

  static const _intervalCheck = Duration(seconds: 30);

  Timer? _launchTimer;
  Timer? _routeTimer;
  Timer? _intervalTimer;

  String? _lastPath;
  bool _launchFired = false;

  /// Routes where a fullscreen ad is never acceptable, independent of any
  /// screen-level suppression (§7.4). Belt and braces: the webinar screen also
  /// suppresses, but a route guard survives that screen failing to mount.
  static const _blockedPrefixes = ['/live', '/login', '/signup', '/verify', '/forgot-password'];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);

    _launchTimer = Timer(_launchDelay, () {
      _launchFired = true;
      _fire('app_launch', placementOverride: 'app_launch');
    });

    _intervalTimer = Timer.periodic(_intervalCheck, (_) {
      // A backgrounded app firing an ad would spend a frequency cap on
      // something nobody saw.
      if (WidgetsBinding.instance.lifecycleState != AppLifecycleState.resumed) {
        return;
      }
      _fire('timed_interval');
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Route entry. `GoRouterState.of` re-subscribes on every navigation, so
    // this is the app's natural route-change hook.
    final path = GoRouterState.of(context).uri.path;
    if (_lastPath == null) {
      _lastPath = path;
      return;
    }
    if (_lastPath == path) return;
    _lastPath = path;

    // Skip until the launch trigger has had its turn — both racing for the
    // same display lock just wastes a request.
    if (!_launchFired) return;

    _routeTimer?.cancel();
    _routeTimer = Timer(_routeSettle, () => _fire('route_enter'));
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _launchTimer?.cancel();
    _routeTimer?.cancel();
    _intervalTimer?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Re-check on foreground: campaigns may have started, ended or been paused
    // while the app was away, and realtime is only an optimisation (§12).
    if (state == AppLifecycleState.resumed && _launchFired) {
      _fire('timed_interval');
    }
  }

  bool _isBlocked(String path) =>
      _blockedPrefixes.any((p) => path == p || path.startsWith('$p/'));

  /// Placement derived from the current route, mirroring `placementForRoute()`
  /// in tbt-user-web. The admin picks from one shared list, so a value only one
  /// client can produce is a campaign that silently never shows on the other.
  ///
  /// KNOWN DIVERGENCE: web also produces `video` (from its standalone
  /// `/watch/[episodeId]` route). This app has no equivalent — its players are
  /// reached at `/learning/...` and `/workshops/.../episode/...`, which map to
  /// `course` and `workshop` here. A campaign targeting `video` alone therefore
  /// serves web only. Whether a mobile player screen should count as `video` or
  /// as its parent section is a product call, not a mapping bug; resolve it
  /// before relying on that placement for a cross-platform campaign.
  String _placementForPath(String path) {
    if (path == '/' || path.startsWith('/dashboard')) return 'home';
    if (path.startsWith('/community')) return 'community';
    if (path.startsWith('/podcasts')) return 'podcast';
    if (path.startsWith('/ebooks')) return 'ebook';
    if (path.startsWith('/courses') || path.startsWith('/learning')) return 'course';
    if (path.startsWith('/workshops')) return 'workshop';
    if (path.startsWith('/profile')) return 'profile';
    return 'global';
  }

  void _fire(String triggerType, {String? placementOverride}) {
    if (!mounted) return;
    final path = _lastPath ?? GoRouterState.of(context).uri.path;
    if (_isBlocked(path)) return;
    unawaited(ref.read(adControllerProvider).request(
          triggerType: triggerType,
          placement: placementOverride ?? _placementForPath(path),
          route: path,
        ));
  }

  @override
  Widget build(BuildContext context) {
    final active = ref.watch(adControllerProvider).active;

    return Stack(
      children: [
        widget.child,
        if (active != null)
          Positioned.fill(
            child: FullscreenAdOverlay(
              // Remount cleanly per campaign — carrying the elapsed clock, skip
              // gate or loaded flag across two different ads would be wrong.
              key: ValueKey(active.displayToken),
              campaign: active.campaign,
              displayToken: active.displayToken,
              onEnd: (reason) => ref.read(adControllerProvider).endAd(reason),
            ),
          ),
      ],
    );
  }
}
