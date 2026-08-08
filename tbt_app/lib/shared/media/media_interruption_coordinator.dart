import 'package:flutter/foundation.dart';

import 'interruptible_media.dart';

/// Media interruption coordinator — TBT_ADS_SPECKIT.md §7.
///
/// Port of user-web's `lib/ads/mediaRegistry.ts`, deliberately line-for-line
/// equivalent in behaviour. If you change a rule here, change it there too —
/// the two clients are specified as one contract, and a divergence shows up as
/// "the video resumes on web but not on Android", which is nearly impossible
/// to spot in review.
///
/// A process-wide singleton rather than a Riverpod-scoped object on purpose:
/// the interruption snapshot has to outlive widget disposal. A user can pop the
/// lesson screen while an ad is on top of it, and the coordinator must still
/// know what it paused.
class MediaInterruptionCoordinator extends ChangeNotifier {
  MediaInterruptionCoordinator._();

  static final MediaInterruptionCoordinator instance =
      MediaInterruptionCoordinator._();

  final Map<String, InterruptibleMedia> _registry = {};

  /// What we paused, and whether it was actually playing when we did.
  List<_MediaSnapshot>? _snapshot;

  /// Ref-COUNTED, not a set of flags. Nested suppressions are real — a cue quiz
  /// inside a course inside a gate all suppress independently, and the inner
  /// unsuppress must not clear the outer one (§7.4).
  final Map<String, int> _suppressions = {};

  /// Only one fullscreen ad may exist at a time (criterion 30).
  String? _adLockHolder;

  // ── Registration ──────────────────────────────────────────────────────────

  /// Register a player, typically from `initState`. Returns the deregister
  /// callback — call it from `dispose()`.
  ///
  /// Registering while an ad is already showing is safe: the player is simply
  /// not in the current snapshot, so it will not be resumed when the ad ends.
  /// That is correct — we never paused it, so it is not ours to start.
  VoidCallback register(InterruptibleMedia media) {
    _registry[media.id] = media;
    return () => unregister(media.id);
  }

  void unregister(String id) {
    _registry.remove(id);
  }

  int get registeredCount => _registry.length;

  // ── Suppression ───────────────────────────────────────────────────────────

  /// Block ads entirely while incompatible UI is up — webinars/LiveKit, auth
  /// flows, an open cue quiz (§7.4). Ads are suppressed, not queued.
  void suppress(String reason) {
    _suppressions[reason] = (_suppressions[reason] ?? 0) + 1;
    notifyListeners();
  }

  void unsuppress(String reason) {
    final count = _suppressions[reason];
    if (count == null) return;
    if (count <= 1) {
      _suppressions.remove(reason);
    } else {
      _suppressions[reason] = count - 1;
    }
    notifyListeners();
  }

  bool get isSuppressed => _suppressions.isNotEmpty;

  List<String> get suppressionReasons => _suppressions.keys.toList();

  // ── Display lock ──────────────────────────────────────────────────────────

  /// Returns false if an ad already holds the lock.
  bool acquireAdLock(String token) {
    if (_adLockHolder != null) return false;
    _adLockHolder = token;
    notifyListeners();
    return true;
  }

  void releaseAdLock(String token) {
    // Only the holder may release, so a late teardown from a previous ad cannot
    // unlock the one currently showing.
    if (_adLockHolder == token) {
      _adLockHolder = null;
      notifyListeners();
    }
  }

  bool get isAdShowing => _adLockHolder != null;

  // ── Interrupt / restore ───────────────────────────────────────────────────

  /// Snapshot every registered player, then pause the ones that are playing.
  ///
  /// Called BEFORE the ad overlay is inserted and before any ad media is
  /// created, so two sources can never produce audio at once (criterion 22).
  /// `just_audio` keeps playing when the app is backgrounded, so this explicit
  /// pause is the only thing that stops podcast audio talking over an ad —
  /// lifecycle callbacks will not do it for us (§7.3).
  void interruptAll() {
    // A teardown that failed to restore would leave a stale snapshot; taking a
    // fresh one on top of it would lose the original positions. Restore first.
    if (_snapshot != null) restoreAll();

    final next = <_MediaSnapshot>[];
    for (final media in _registry.values) {
      var wasPlaying = false;
      var position = 0.0;
      try {
        wasPlaying = media.isPlaying();
        position = media.getPosition();
      } catch (_) {
        // A player that throws on inspection is treated as not playing — never
        // let a broken player block the ad.
      }
      next.add(_MediaSnapshot(media.id, wasPlaying, position));
      if (wasPlaying) {
        try {
          media.pause();
        } catch (_) {
          // Best effort. Worst case is overlapping audio from this one player,
          // which is better than the ad never showing.
        }
      }
    }

    _snapshot = next;
  }

  /// Restore what we paused.
  ///
  /// MUST run on every ad exit path — completed, skipped, closed, media error,
  /// load timeout, campaign invalidation, back button. Funnel teardown through
  /// a single `endAd()`: multiple exit paths is exactly how "the video never
  /// came back" bugs ship (§7.2).
  void restoreAll() {
    final entries = _snapshot;
    if (entries == null) return;
    _snapshot = null;

    for (final entry in entries) {
      // Content that was ALREADY PAUSED before the ad stays paused
      // (criterion 21). A naive "resume everything" passes every other test and
      // fails this one.
      if (!entry.wasPlaying) continue;

      final media = _registry[entry.id];
      // Disposed while the ad was up — nothing to restore.
      if (media == null) continue;

      try {
        // Seek before resume: some players restart from zero on a fresh play().
        if (entry.position > 0) media.seek(entry.position);
        media.resume();
      } catch (_) {
        // Never throw out of a teardown path.
      }
    }
  }

  /// True while an interruption snapshot is outstanding.
  bool get hasPendingRestore => _snapshot != null;

  /// Test/hot-restart escape hatch. Not used in normal app flow.
  @visibleForTesting
  void resetForTest() {
    _registry.clear();
    _suppressions.clear();
    _snapshot = null;
    _adLockHolder = null;
  }
}

class _MediaSnapshot {
  const _MediaSnapshot(this.id, this.wasPlaying, this.position);

  final String id;
  final bool wasPlaying;
  final double position;
}
