import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';

import '../../../core/utils/device_id.dart';

/// Session identity for ad frequency capping — TBT_ADS_SPECKIT.md §10.
///
/// Two identifiers that are easy to conflate:
///
///   anonymousId — STABLE across sessions. This is the existing `tbt_device_id`
///                 (`core/utils/device_id.dart`), the same value user-web keeps
///                 in localStorage. Do not mint a second device identifier —
///                 the backend keys guest frequency on it, and a new id every
///                 launch would make every cap unenforceable.
///   sessionId   — NEW per app session. Drives once-per-session rules, so it
///                 must NOT be persisted.
class AdSession {
  AdSession._({
    required this.sessionId,
    required this.anonymousId,
    required this.launchCount,
    required DateTime startedAt,
  }) : _startedAt = startedAt;

  final String sessionId;
  final String anonymousId;

  /// Monotonic count of app launches, for the `afterNLaunches` trigger.
  final int launchCount;

  final DateTime _startedAt;

  int get sessionElapsedSeconds =>
      DateTime.now().difference(_startedAt).inSeconds;

  static const _kLaunchCountKey = 'tbt_ad_launch_count';

  /// Called once per app session. Increments the persisted launch counter.
  ///
  /// Never throws. Storage can be unavailable — a locked keystore on a freshly
  /// booted device, a corrupt preferences file — and an ad session that failed
  /// to resolve would take the whole ad system down with it. §11: fall back to
  /// an in-memory, session-scoped identity; per-user frequency then degrades to
  /// per-session, which is the correct failure direction (the user sees fewer
  /// ads, never more of them than an admin allowed).
  static Future<AdSession> start() async {
    final sessionId = const Uuid().v4();

    String anonymousId;
    try {
      anonymousId = await getOrCreateDeviceId();
    } catch (_) {
      // Session-scoped stand-in. Deliberately the session id, so the backend
      // sees one consistent subject for this run rather than a new identity on
      // every request.
      anonymousId = sessionId;
    }

    var launches = 1;
    try {
      final prefs = await SharedPreferences.getInstance();
      launches = (prefs.getInt(_kLaunchCountKey) ?? 0) + 1;
      await prefs.setInt(_kLaunchCountKey, launches);
    } catch (_) {
      // Degrade to "first launch" — an `afterNLaunches` campaign then simply
      // waits, which is better than firing on every cold start.
    }

    return AdSession._(
      sessionId: sessionId,
      anonymousId: anonymousId,
      launchCount: launches,
      startedAt: DateTime.now(),
    );
  }
}

/// Resolved once and kept for the process lifetime — a rebuild must not mint a
/// new sessionId, or every once-per-session cap would reset with it.
final adSessionProvider = FutureProvider<AdSession>((ref) => AdSession.start());
