import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../shared/providers/site_config_provider.dart';
import '../data/ad_models.dart';
import '../data/ad_repository.dart';
import '../providers/ad_campaign_provider.dart';
import '../providers/ad_session_provider.dart';
import 'image_ad_view.dart';
import 'video_ad_view.dart';

/// The ad itself — TBT_ADS_SPECKIT.md §10.
///
/// Rendered inside the shell's Stack, never pushed as a route: a push would
/// destroy the current screen's state, which is the one thing the whole feature
/// promises not to do.
class FullscreenAdOverlay extends ConsumerStatefulWidget {
  const FullscreenAdOverlay({
    super.key,
    required this.campaign,
    required this.displayToken,
    required this.onEnd,
  });

  final AdCampaign campaign;
  final String displayToken;
  final void Function(AdEndReason reason) onEnd;

  @override
  ConsumerState<FullscreenAdOverlay> createState() => _FullscreenAdOverlayState();
}

class _FullscreenAdOverlayState extends ConsumerState<FullscreenAdOverlay>
    with WidgetsBindingObserver {
  /// Budget for the media to report itself loaded. Exceeded ⇒ teardown.
  static const _loadTimeout = Duration(seconds: 8);

  final _video = VideoAdController();

  Timer? _clock;
  Timer? _loadTimer;
  Timer? _lifetimeTimer;

  /// Foreground-only elapsed time, accumulated from wall-clock deltas rather
  /// than counted ticks: a janky frame or a throttled timer would otherwise
  /// under-count, and an image ad's skip gate would unlock late on exactly the
  /// slowest devices. Backgrounded time is excluded by moving the mark without
  /// accumulating (§10 — elapsed must not accrue while backgrounded).
  double _elapsed = 0;
  DateTime _mark = DateTime.now();

  double _videoPosition = 0;
  double _videoDuration = 0;

  bool _loaded = false;
  bool _ended = false;
  bool _impressionSent = false;
  bool _videoFellBack = false;
  bool _pausedForLifecycle = false;

  bool get _isVideo => widget.campaign.isVideo;

  /// What is on screen right now. Once the fallback image takes over, every
  /// clock and gate has to follow it — otherwise skip stays pinned to a
  /// playhead that stopped moving and the user waits out the lifetime ceiling.
  bool get _playingVideo => _isVideo && !_videoFellBack;

  double get _gateProgress => _playingVideo ? _videoPosition : _elapsed;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);

    // Exits initiated outside this widget — back button, a campaign paused
    // mid-view, suppression starting — come back through `_end` so they report
    // their outcome with the elapsed time only this widget knows.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) ref.read(adControllerProvider).attachOverlay(_end);
    });

    _clock = Timer.periodic(const Duration(milliseconds: 250), (_) {
      final now = DateTime.now();
      final delta = now.difference(_mark).inMilliseconds / 1000;
      _mark = now;
      if (_pausedForLifecycle || !mounted) return;
      setState(() => _elapsed += delta);
      _checkAutoClose();
      _checkImageDuration();
    });

    _loadTimer = Timer(_loadTimeout, () {
      if (_loaded) return;
      // Distinct from a mid-playback `media_error`: nothing ever rendered. The
      // admin needs the two separated to tell "the creative is broken" from
      // "the CDN was slow for this user" (§11).
      final anonymousId = ref.read(adSessionProvider).valueOrNull?.anonymousId;
      if (anonymousId != null) {
        unawaited(ref.read(adRepositoryProvider).events(
              displayToken: widget.displayToken,
              anonymousId: anonymousId,
              events: [
                {'eventType': 'load_error', 'elapsedSeconds': _elapsed},
              ],
            ));
      }
      _end(AdEndReason.loadTimeout);
    });

    // Absolute ceiling so a stalled-but-"loaded" ad can never trap the user.
    // Generous on purpose — it must never cut a legitimate ad short, so it is
    // duration + 30s with a 60s floor, not a flat number that would kill any
    // video ad longer than it.
    final duration = widget.campaign.durationSeconds ?? 0;
    _lifetimeTimer = Timer(
      Duration(seconds: duration + 30 < 60 ? 60 : duration + 30),
      () => _end(AdEndReason.loadTimeout),
    );
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    // Read the controller before super.dispose() — ref is invalid after unmount.
    try { ref.read(adControllerProvider).detachOverlay(_end); } catch (_) {}
    _clock?.cancel();
    _loadTimer?.cancel();
    _lifetimeTimer?.cancel();
    super.dispose();
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      if (_pausedForLifecycle) {
        _pausedForLifecycle = false;
        _video.resume();
      }
      // An ad that loaded while backgrounded has only now actually been seen.
      _maybeSendImpression();
      return;
    }
    if (state == AppLifecycleState.paused || state == AppLifecycleState.inactive) {
      // Pause only what we are about to resume ourselves; an ad the admin
      // configured as autoplay:false must not start playing on the way back.
      if (!_pausedForLifecycle) {
        _pausedForLifecycle = true;
        _video.pause();
      }
    }
  }

  // ── Teardown — the single exit path ───────────────────────────────────────

  void _end(AdEndReason reason) {
    if (_ended) return;
    _ended = true;

    _clock?.cancel();
    _loadTimer?.cancel();
    _lifetimeTimer?.cancel();
    _video.pause();

    final elapsed = _gateProgress;
    final duration = _playingVideo && _videoDuration > 0
        ? _videoDuration
        : (widget.campaign.durationSeconds ?? 0).toDouble();
    final pct = duration > 0 ? (elapsed / duration * 100).clamp(0, 100).toDouble() : 0.0;

    final anonymousId = ref.read(adSessionProvider).valueOrNull?.anonymousId;
    if (anonymousId != null) {
      final repo = ref.read(adRepositoryProvider);
      // Fire-and-forget: teardown must not wait on the network.
      switch (reason) {
        case AdEndReason.completed:
          unawaited(repo.complete(
            displayToken: widget.displayToken,
            anonymousId: anonymousId,
            elapsedSeconds: elapsed,
            completionPercentage: pct,
          ));
        case AdEndReason.skipped:
          unawaited(repo.skip(
            displayToken: widget.displayToken,
            anonymousId: anonymousId,
            elapsedSeconds: elapsed,
            completionPercentage: pct,
          ));
        case AdEndReason.closed:
        case AdEndReason.loadTimeout:
          unawaited(repo.close(
            displayToken: widget.displayToken,
            anonymousId: anonymousId,
            elapsedSeconds: elapsed,
            completionPercentage: pct,
          ));
        case AdEndReason.mediaError:
          unawaited(repo.events(
            displayToken: widget.displayToken,
            anonymousId: anonymousId,
            events: [
              {'eventType': 'media_error', 'elapsedSeconds': elapsed},
            ],
          ));
          unawaited(repo.close(
            displayToken: widget.displayToken,
            anonymousId: anonymousId,
            elapsedSeconds: elapsed,
            completionPercentage: pct,
          ));
        case AdEndReason.invalidated:
          // Not a user close: the campaign was pulled out from under them.
          // Recorded as an event rather than a `/close` so the campaign's
          // close rate stays a measure of what users actually did.
          unawaited(repo.events(
            displayToken: widget.displayToken,
            anonymousId: anonymousId,
            events: [
              {
                'eventType': 'closed',
                'elapsedSeconds': elapsed,
                'metadata': {'reason': 'invalidated'},
              },
            ],
          ));
        case AdEndReason.cta:
          // The click itself is reported before navigation, in `_onCtaPressed`.
          break;
      }
    }

    widget.onEnd(reason);
  }

  // ── Tracking ──────────────────────────────────────────────────────────────

  void _maybeSendImpression() {
    if (_impressionSent || !_loaded) return;
    // An ad that loaded while the app sat in the background has not been seen;
    // counting it would bill the campaign and spend the user's frequency cap
    // for nothing (§3.2).
    final lifecycle = WidgetsBinding.instance.lifecycleState;
    if (lifecycle != null && lifecycle != AppLifecycleState.resumed) return;

    final anonymousId = ref.read(adSessionProvider).valueOrNull?.anonymousId;
    if (anonymousId == null) return;

    _impressionSent = true;
    unawaited(
      ref
          .read(adRepositoryProvider)
          .impression(
            displayToken: widget.displayToken,
            anonymousId: anonymousId,
          )
          .then((servable) {
        // Paused or archived between selection and render — tear down silently.
        // From the user's side an ad that never appears is the correct outcome,
        // not a failure (§11).
        if (!servable && mounted) _end(AdEndReason.invalidated);
      }),
    );
  }

  void _onLoaded([double durationSeconds = 0]) {
    if (!mounted) return;
    setState(() {
      _loaded = true;
      if (durationSeconds > 0) _videoDuration = durationSeconds;
    });
    _loadTimer?.cancel();
    _maybeSendImpression();
  }

  void _onMediaError() {
    // §11: fall back to the fallback creative when there is one, and only end
    // the ad when there is nothing left to show. The event is emitted either
    // way — the admin needs to see the creative is broken even though the user
    // saw an ad.
    final fallback = widget.campaign.fallbackMediaUrl;
    if (_playingVideo && fallback != null && fallback.isNotEmpty) {
      final anonymousId = ref.read(adSessionProvider).valueOrNull?.anonymousId;
      if (anonymousId != null) {
        unawaited(ref.read(adRepositoryProvider).events(
              displayToken: widget.displayToken,
              anonymousId: anonymousId,
              events: [
                {
                  'eventType': 'media_error',
                  'metadata': {'recovered': 'fallback_image'},
                },
              ],
            ));
      }
      if (!mounted) return;
      setState(() {
        _videoFellBack = true;
        // The fallback has to report itself before the impression counts, just
        // as the video would have.
        _loaded = false;
      });
      return;
    }
    _end(AdEndReason.mediaError);
  }

  // ── Gates ─────────────────────────────────────────────────────────────────

  void _checkAutoClose() {
    final close = widget.campaign.closeConfig;
    final at = close.autoClose ? close.autoCloseSeconds : null;
    if (at != null && _elapsed >= at) _end(AdEndReason.closed);
  }

  void _checkImageDuration() {
    if (_playingVideo) return;
    final duration = widget.campaign.durationSeconds ?? 0;
    if (duration > 0 && !widget.campaign.loop && _elapsed >= duration) {
      _end(AdEndReason.completed);
    }
  }

  double? get _skipUnlockAt {
    final server = widget.campaign.skipAvailableAfterSeconds?.toDouble();
    if (server != null) return server;
    return widget.campaign.skipUnlockSeconds(
      _videoDuration > 0 ? _videoDuration : null,
    );
  }

  bool get _skipReady {
    if (!widget.campaign.skipConfig.enabled) return false;
    final at = _skipUnlockAt;
    return at != null && _gateProgress >= at;
  }

  int? get _skipCountdown {
    final at = _skipUnlockAt;
    if (at == null) return null;
    final remaining = (at - _gateProgress).ceil();
    return remaining > 0 ? remaining : 0;
  }

  // ── CTA ───────────────────────────────────────────────────────────────────

  Future<void> _onCtaPressed() async {
    final cta = widget.campaign.ctaConfig;
    final target = cta.target;
    if (target == null || target.isEmpty) return;

    // Record the click BEFORE navigating — the screen transition would cancel
    // an in-flight request (§10).
    final anonymousId = ref.read(adSessionProvider).valueOrNull?.anonymousId;
    if (anonymousId != null) {
      await ref.read(adRepositoryProvider).click(
            displayToken: widget.displayToken,
            anonymousId: anonymousId,
            elapsedSeconds: _gateProgress,
          );
    }

    // Every failure below leaves the ad on screen on purpose (§11): dropping
    // the user somewhere unexpected, or tearing the overlay down as if the tap
    // worked, both read as "the app is broken". Leaving it up lets them dismiss
    // it deliberately, and the lifetime ceiling still guarantees an exit.
    void failed(String reason) {
      if (anonymousId == null) return;
      unawaited(ref.read(adRepositoryProvider).events(
            displayToken: widget.displayToken,
            anonymousId: anonymousId,
            events: [
              {
                'eventType': 'cta_click_failed',
                'elapsedSeconds': _gateProgress,
                'metadata': {'reason': reason, 'target': target},
              },
            ],
          ));
    }

    if (cta.type == 'external_url') {
      final uri = Uri.tryParse(target);
      // Protocol allowlist, same as the backend's (§13/§14): anything else
      // handed to a launcher is an open door.
      if (uri == null) {
        failed('malformed_url');
        return;
      }
      if (uri.scheme != 'http' && uri.scheme != 'https') {
        failed('blocked_protocol');
        return;
      }
      var launched = false;
      try {
        launched = await launchUrl(uri, mode: LaunchMode.externalApplication);
      } catch (_) {
        // No handler installed, or the platform refused.
        launched = false;
      }
      if (!launched) {
        failed('launch_failed');
        return;
      }
      _end(AdEndReason.cta);
      return;
    }

    // Internal route. Validate BEFORE tearing down — ending the ad and then
    // discovering the target is unusable would drop the user back on the screen
    // they were already on with no explanation.
    if (!target.startsWith('/') || target.startsWith('//')) {
      failed('invalid_internal_route');
      return;
    }
    if (!mounted) return;
    // Capture router before _end() tears down the overlay (context may become stale).
    final router = GoRouter.maybeOf(context);
    _end(AdEndReason.cta);
    router?.go(target);
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final campaign = widget.campaign;
    final strings = ref.watch(uiStringsNotifierProvider).valueOrNull;

    final cta = campaign.ctaConfig;
    final ctaVisible = cta.enabled &&
        (cta.target?.isNotEmpty ?? false) &&
        _elapsed >= (cta.showAfterSeconds ?? 0);

    return Material(
      color: _backgroundColor(campaign.backgroundColor),
      child: Stack(
        fit: StackFit.expand,
        children: [
          if (_playingVideo)
            VideoAdView(
              campaign: campaign,
              controller: _video,
              onLoaded: _onLoaded,
              onPlaybackStarted: _onPlaybackStarted,
              onPositionChanged: (p) {
                if (mounted) setState(() => _videoPosition = p);
              },
              onEnded: () => _end(AdEndReason.completed),
              onError: _onMediaError,
            )
          else
            ImageAdView(
              campaign: campaign,
              forceFallback: _videoFellBack,
              onLoaded: _onLoaded,
              onError: _onMediaError,
            ),

          if (!_loaded)
            Center(
              child: Text(
                strings?.loading ?? 'Loading…',
                style: const TextStyle(color: Colors.white70, fontSize: 14),
              ),
            ),

          // Sponsored badge — the disclosure, not decoration.
          Positioned(
            left: 16,
            top: 16,
            child: _Pill(
              child: Text(
                strings?.adSponsoredLabel ?? 'Sponsored',
                style: const TextStyle(
                  color: Colors.white70,
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.2,
                ),
              ),
            ),
          ),

          Positioned(
            right: 16,
            top: 16,
            child: Row(
              children: [
                if (campaign.skipConfig.enabled)
                  _SkipButton(
                    ready: _skipReady,
                    remaining: _skipCountdown,
                    waitingLabel: strings?.adSkipInLabel ?? 'Skip in',
                    readyLabel: strings?.adSkipLabel ?? 'Skip',
                    onPressed: () => _end(AdEndReason.skipped),
                  ),
                if (campaign.closeConfig.enabled) ...[
                  const SizedBox(width: 8),
                  Semantics(
                    label: strings?.adCloseLabel ?? 'Close',
                    button: true,
                    child: InkWell(
                      onTap: () => _end(AdEndReason.closed),
                      customBorder: const CircleBorder(),
                      child: const _Pill(
                        circular: true,
                        child: Icon(Icons.close, size: 18, color: Colors.white),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),

          if (ctaVisible)
            Positioned(
              left: 0,
              right: 0,
              bottom: 48,
              child: Center(
                child: FilledButton(
                  onPressed: () => unawaited(_onCtaPressed()),
                  style: FilledButton.styleFrom(
                    backgroundColor: Theme.of(context).colorScheme.primary,
                    padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
                    shape: const StadiumBorder(),
                  ),
                  child: Text(
                    cta.text ?? '',
                    style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  void _onPlaybackStarted() {
    final anonymousId = ref.read(adSessionProvider).valueOrNull?.anonymousId;
    if (anonymousId == null) return;
    unawaited(ref.read(adRepositoryProvider).events(
          displayToken: widget.displayToken,
          anonymousId: anonymousId,
          events: [
            {'eventType': 'playback_started'},
          ],
        ));
  }

  Color _backgroundColor(String? hex) {
    if (hex == null || hex.isEmpty) return Colors.black;
    final cleaned = hex.replaceFirst('#', '');
    final value = int.tryParse(cleaned.length == 6 ? 'FF$cleaned' : cleaned, radix: 16);
    return value == null ? Colors.black : Color(value);
  }
}

class _Pill extends StatelessWidget {
  const _Pill({required this.child, this.circular = false});

  final Widget child;
  final bool circular;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: circular
          ? const EdgeInsets.all(8)
          : const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.55),
        borderRadius: BorderRadius.circular(circular ? 999 : 6),
      ),
      child: child,
    );
  }
}

/// Rendered while still locked rather than hidden: a control that appears from
/// nowhere mid-ad is worse than one visibly counting down, and the countdown is
/// what tells the user the ad is finite.
class _SkipButton extends StatelessWidget {
  const _SkipButton({
    required this.ready,
    required this.remaining,
    required this.waitingLabel,
    required this.readyLabel,
    required this.onPressed,
  });

  final bool ready;
  final int? remaining;
  final String waitingLabel;
  final String readyLabel;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final label = ready
        ? readyLabel
        : remaining == null
            ? waitingLabel
            : '$waitingLabel $remaining';

    return TextButton(
      onPressed: ready ? onPressed : null,
      style: TextButton.styleFrom(
        backgroundColor:
            ready ? Colors.white.withValues(alpha: 0.9) : Colors.black.withValues(alpha: 0.5),
        foregroundColor: ready ? Colors.black : Colors.white60,
        disabledForegroundColor: Colors.white60,
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
        shape: const StadiumBorder(),
      ),
      child: Text(label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
    );
  }
}
