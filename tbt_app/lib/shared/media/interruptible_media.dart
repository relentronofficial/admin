/// The media interruption contract — TBT_ADS_SPECKIT.md §7.1.
///
/// Deliberately identical to the user-web `InterruptibleMedia` interface in
/// `lib/ads/mediaRegistry.ts`. The two clients must behave the same way when an
/// ad interrupts playback, and the cheapest way to guarantee that is to keep
/// the contract itself literally the same shape.
///
/// A player implements this; the coordinator calls it. No player ever knows
/// the ad system exists, and no ad code ever reaches into a player.
library;

enum InterruptibleMediaKind { video, audio }

abstract class InterruptibleMedia {
  /// Stable for the lifetime of the player. Re-registering the same id
  /// replaces the previous entry.
  String get id;

  InterruptibleMediaKind get kind;

  /// Whether the player is producing sound *right now*. This is the value the
  /// whole feature turns on: content that was already paused before the ad
  /// must stay paused afterwards (criterion 21), and that decision is made
  /// entirely from this method's answer at interrupt time.
  bool isPlaying();

  /// Current playhead in seconds.
  double getPosition();

  void pause();
  void resume();
  void seek(double seconds);
}

/// Closure-backed implementation, so a screen can register without declaring a
/// class. Mirrors the `useRegisterMedia` hook on web.
class CallbackInterruptibleMedia implements InterruptibleMedia {
  const CallbackInterruptibleMedia({
    required this.id,
    required this.kind,
    required bool Function() isPlayingFn,
    required double Function() getPositionFn,
    required void Function() pauseFn,
    required void Function() resumeFn,
    void Function(double seconds)? seekFn,
  })  : _isPlaying = isPlayingFn,
        _getPosition = getPositionFn,
        _pause = pauseFn,
        _resume = resumeFn,
        _seek = seekFn;

  @override
  final String id;

  @override
  final InterruptibleMediaKind kind;

  final bool Function() _isPlaying;
  final double Function() _getPosition;
  final void Function() _pause;
  final void Function() _resume;
  final void Function(double seconds)? _seek;

  @override
  bool isPlaying() => _isPlaying();

  @override
  double getPosition() => _getPosition();

  @override
  void pause() => _pause();

  @override
  void resume() => _resume();

  @override
  void seek(double seconds) => _seek?.call(seconds);
}
