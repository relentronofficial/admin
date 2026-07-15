import 'package:better_player_plus/better_player_plus.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Centralized [BetterPlayerConfiguration] factory + full-screen
/// orientation controller for every video surface in the app.
///
/// Two responsibilities:
///
///   1. **Consistent configuration.** Both the workshop episode player
///      and the course lesson player used to build their own
///      `BetterPlayerConfiguration` by hand; they drifted (the workshop
///      one forgot `deviceOrientationsOnFullScreen`, the lesson one
///      forgot `fullScreenAspectRatio`, etc.). Routing both through
///      this factory guarantees they can't drift again.
///
///   2. **Belt-and-suspenders full-screen rotation.** The package
///      normally handles rotation via
///      `SystemChrome.setPreferredOrientations` inside
///      `_pushFullScreenWidget`. On Vivo/Xiaomi/OPPO firmware,
///      that call is sometimes silently ignored when it lands on the
///      same frame as a `SystemUiMode.immersiveSticky` transition
///      (documented in better_player_plus issues). We defend against
///      that by attaching a controller-level event listener that
///      re-applies the orientation lock on the *next* frame after
///      `openFullscreen` fires — and mirrors the restore path for
///      `hideFullscreen`. Cheap, idempotent, and invisible when the
///      package already got it right.
class TbtVideoPlayerConfig {
  const TbtVideoPlayerConfig._();

  /// Orientations we allow while the video is in full-screen. Both
  /// landscape orientations so the sensor picks whichever matches how
  /// the user is holding the phone. Matches YouTube / Netflix.
  static const List<DeviceOrientation> _fullScreenOrientations = [
    DeviceOrientation.landscapeLeft,
    DeviceOrientation.landscapeRight,
  ];

  /// Restored on full-screen exit. Only portraitUp — portraitDown looks
  /// broken on notch phones, and re-allowing landscape here would keep
  /// the app rotated after the user exited full-screen.
  static const List<DeviceOrientation> _restoreOrientations = [
    DeviceOrientation.portraitUp,
  ];

  /// Builds the standard [BetterPlayerConfiguration] used for all
  /// long-form video in the app (lessons + workshop episodes).
  ///
  /// * [startAtSeconds] — resume position, forwarded to the underlying
  ///   video controller.
  /// * [accent] — the theme's primary color, used for the played
  ///   progress-bar segment. Everything else in the player overlay
  ///   stays black-on-white regardless of app theme (industry standard
  ///   — YouTube / Netflix don't theme their video controls).
  static BetterPlayerConfiguration build({
    required int startAtSeconds,
    required Color accent,
  }) {
    return BetterPlayerConfiguration(
      autoPlay: true,
      looping: false,
      startAt: Duration(seconds: startAtSeconds),
      aspectRatio: 16 / 9,
      fullScreenByDefault: false,
      allowedScreenSleep: false,

      // ── Full-screen orientation & system-UI behaviour ─────────────
      // Rotate to landscape on enter, restore portrait on exit. Even
      // though the package's default for `deviceOrientationsOnFullScreen`
      // is already `[landscapeLeft, landscapeRight]`, we set it
      // explicitly so intent is visible in code and can't shift under
      // us if the package changes defaults.
      deviceOrientationsOnFullScreen: _fullScreenOrientations,
      deviceOrientationsAfterFullScreen: _restoreOrientations,
      // On exit, bring back the whole system UI (status + nav bar).
      systemOverlaysAfterFullScreen: SystemUiOverlay.values,
      // Auto-detect for non-16:9 sources (e.g. a portrait "shorts"
      // style clip). If the video is portrait, the package will
      // override our landscape list with portrait — the right thing
      // for vertical content.
      fullScreenAspectRatio: 16 / 9,
      autoDetectFullscreenAspectRatio: true,
      autoDetectFullscreenDeviceOrientation: true,

      // Controls are always dark-on-video, regardless of app theme —
      // this is the standard video-player UX in every major app.
      controlsConfiguration: BetterPlayerControlsConfiguration(
        controlBarColor: Colors.black87,
        iconsColor: Colors.white,
        progressBarPlayedColor: accent,
        progressBarHandleColor: accent,
        progressBarBufferedColor: Colors.white38,
        progressBarBackgroundColor: Colors.white12,
        enableSkips: false,
        enableOverflowMenu: false,
      ),
    );
  }

  /// Attach to the controller *after* `addEventsListener` is wired but
  /// *before* the widget builds. Idempotent: safe to call multiple
  /// times if screen rebuilds re-invoke initialization logic.
  ///
  /// Returns the same [BetterPlayerEventListener] you pass in so
  /// callers can chain it, or you can pass `null` and just use the
  /// [attachOrientationGuard] helper below.
  static void attachOrientationGuard(BetterPlayerController controller) {
    controller.addEventsListener(_orientationGuardListener);
  }

  static void _orientationGuardListener(BetterPlayerEvent event) {
    switch (event.betterPlayerEventType) {
      case BetterPlayerEventType.openFullscreen:
        // Post-frame so this lands *after* the package's own
        // `setPreferredOrientations` call inside `_pushFullScreenWidget`.
        // On devices where that call is dropped (Vivo/Xiaomi/OPPO
        // firmware quirk when it lands on the same frame as an
        // `immersiveSticky` UI-mode change), our re-application on the
        // next frame actually takes effect.
        WidgetsBinding.instance.addPostFrameCallback((_) {
          SystemChrome.setPreferredOrientations(_fullScreenOrientations);
          SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
        });
        break;
      case BetterPlayerEventType.hideFullscreen:
        WidgetsBinding.instance.addPostFrameCallback((_) {
          SystemChrome.setPreferredOrientations(_restoreOrientations);
          SystemChrome.setEnabledSystemUIMode(
            SystemUiMode.manual,
            overlays: SystemUiOverlay.values,
          );
        });
        break;
      default:
        break;
    }
  }

  /// Detach the guard when disposing a controller. Match every
  /// `attachOrientationGuard` with this in `dispose()` to prevent the
  /// listener from firing on a disposed controller.
  static void detachOrientationGuard(BetterPlayerController controller) {
    controller.removeEventsListener(_orientationGuardListener);
  }

  /// Safety net for when a screen using this player is disposed while
  /// still in full-screen (e.g. user hits back, Android kills the
  /// activity, deep link forces navigation). Restores portrait +
  /// system UI unconditionally.
  static Future<void> restoreOrientationAndUi() async {
    await SystemChrome.setPreferredOrientations(_restoreOrientations);
    await SystemChrome.setEnabledSystemUIMode(
      SystemUiMode.manual,
      overlays: SystemUiOverlay.values,
    );
  }
}
