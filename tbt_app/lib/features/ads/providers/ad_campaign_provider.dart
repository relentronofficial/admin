import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/media/media_interruption_coordinator.dart';
import '../../../shared/providers/connectivity_provider.dart';
import '../../../shared/providers/socket_provider.dart';
import '../../../shared/socket/socket_events.dart';
import '../data/ad_models.dart';
import '../data/ad_repository.dart';
import 'ad_session_provider.dart';

/// The campaign currently on screen, with the token every tracking call needs.
class ActiveAd {
  const ActiveAd({required this.campaign, required this.displayToken});

  final AdCampaign campaign;
  final String displayToken;
}

/// Ad orchestration — TBT_ADS_SPECKIT.md §10.
///
/// Owns every rule about whether an ad may appear, so no screen and no trigger
/// has to know them:
///
///   * one ad at a time (display lock, criterion 30)
///   * never while suppressed (live calls, auth flows, an open quiz, a gate)
///   * one `/eligible` request in flight at a time — the POST is not covered by
///     `DedupInterceptor`, which only collapses GETs
///   * media is paused BEFORE the overlay mounts and restored on EVERY exit
///
/// A `ChangeNotifier` rather than a codegen'd `@riverpod` notifier, matching
/// the podcast controller: this is long-lived mutable state with imperative
/// entry points, which is exactly what ChangeNotifier is for, and it keeps the
/// ad system free of a build_runner dependency.
class AdController extends ChangeNotifier {
  AdController(this._ref) {
    _wireSocket();
    _coordinator.addListener(_onCoordinatorChanged);

    // Retry whatever a previous session left queued, and again whenever the
    // device comes back online (§11). Deferred off the constructor so the
    // provider is fully built before anything reads back through `_ref`.
    Future.microtask(() {
      if (_disposed) return;
      unawaited(_ref.read(adRepositoryProvider).flushQueued());
      _ref.listen<AsyncValue<bool>>(connectivityProvider, (previous, next) {
        final wasOnline = previous?.valueOrNull ?? false;
        final isOnline = next.valueOrNull ?? false;
        if (!wasOnline && isOnline) {
          unawaited(_ref.read(adRepositoryProvider).flushQueued());
        }
      });
    });
  }

  final Ref _ref;

  MediaInterruptionCoordinator get _coordinator =>
      MediaInterruptionCoordinator.instance;

  ActiveAd? _active;
  ActiveAd? get active => _active;
  bool get isShowing => _active != null;

  bool _inFlight = false;
  String? _lockToken;
  bool _disposed = false;

  /// Ask the server whether an ad should show now.
  ///
  /// Never throws: an ad-system failure is invisible to the user (§11).
  Future<void> request({
    required String triggerType,
    required String placement,
    String? route,
    String? module,
  }) async {
    if (_disposed) return;
    if (_inFlight || _active != null) return;
    if (_coordinator.isAdShowing || _coordinator.isSuppressed) return;

    _inFlight = true;
    try {
      final session = await _ref.read(adSessionProvider.future);
      // Conditions can change while the session resolves or the request is in
      // flight — re-check before committing to anything.
      if (_disposed || _active != null || _coordinator.isSuppressed) return;

      final result = await _ref.read(adRepositoryProvider).eligible(
            sessionId: session.sessionId,
            anonymousId: session.anonymousId,
            placement: placement,
            triggerType: triggerType,
            route: route,
            module: module,
            launchCount: session.launchCount,
            sessionElapsedSeconds: session.sessionElapsedSeconds,
          );

      if (_disposed) return;
      if (!result.showAd || result.campaign == null || result.displayToken == null) {
        return;
      }
      if (_active != null || _coordinator.isSuppressed) return;

      final token = result.displayToken!;
      if (!_coordinator.acquireAdLock(token)) return;
      _lockToken = token;

      // Pause app media BEFORE the overlay mounts and before the ad's own
      // player is created, so two sources can never produce audio at once
      // (criterion 22). just_audio keeps playing in the background, so this is
      // the only thing that stops a podcast talking over the ad.
      _coordinator.interruptAll();

      _active = ActiveAd(campaign: result.campaign!, displayToken: token);
      notifyListeners();
    } catch (_) {
      // Degrade to "no ad".
    } finally {
      _inFlight = false;
    }
  }

  /// The single teardown path. Every exit — completed, skipped, closed, CTA,
  /// media error, timeout, invalidation, back button — funnels through here so
  /// media restoration can never be skipped (§7.2).
  void endAd(AdEndReason reason) {
    final current = _active;
    if (current == null) return;

    _active = null;

    // Restore before releasing the lock, so a trigger firing on the next tick
    // cannot interleave with the restore.
    _coordinator.restoreAll();

    final token = _lockToken;
    if (token != null) {
      _coordinator.releaseAdLock(token);
      _lockToken = null;
    }

    if (!_disposed) notifyListeners();
  }

  /// Registered by the overlay for its lifetime.
  ///
  /// An exit can be initiated from outside the overlay — the back button, a
  /// campaign paused mid-view, suppression starting. Those still have to report
  /// their outcome, and the overlay is the only thing that knows the elapsed
  /// time and completion percentage. Routing them back through it keeps one
  /// exit path instead of two that report differently (§7.2).
  void Function(AdEndReason reason)? _overlayExit;

  void attachOverlay(void Function(AdEndReason reason) exit) =>
      _overlayExit = exit;

  void detachOverlay(void Function(AdEndReason reason) exit) {
    // Compare before clearing: a fast ad-to-ad transition can mount the next
    // overlay before the previous one disposes, and clearing blindly would
    // orphan the new registration.
    if (identical(_overlayExit, exit)) _overlayExit = null;
  }

  void _requestEnd(AdEndReason reason) {
    final exit = _overlayExit;
    if (exit != null) {
      exit(reason);
      return;
    }
    endAd(reason);
  }

  /// Android back / gesture back while an ad is showing (§10).
  ///
  /// Returns true when the press was consumed. Back closes the ad only when the
  /// admin allowed closing; otherwise it is swallowed so back cannot be used to
  /// bypass an unskippable ad. It can never trap the user for long — the §11
  /// lifetime ceiling in the overlay always fires.
  bool handleBackPress() {
    final current = _active;
    if (current == null) return false;
    if (current.campaign.closeConfig.enabled) {
      // Through the overlay, so the close is recorded with its elapsed time —
      // a back-button close that reported nothing would quietly under-count
      // every campaign's close rate.
      _requestEnd(AdEndReason.closed);
    }
    return true;
  }

  // ── Realtime invalidation (§12) ───────────────────────────────────────────

  void _onInvalidated(dynamic payload) {
    final current = _active;
    if (current == null || payload is! Map) return;
    if (payload['campaignId'] != current.campaign.id) return;
    final reason = payload['reason'];
    // Only urgent reasons tear down an ad already on screen; ordinary edits
    // apply to the next eligibility check.
    if (reason == 'paused' || reason == 'archived') {
      _requestEnd(AdEndReason.invalidated);
    }
  }

  void _wireSocket() {
    try {
      _ref.read(socketNotifierProvider.notifier).on(
            kSocketAdCampaignInvalidated,
            _onInvalidated,
          );
    } catch (_) {
      // Socket unavailable (not yet authenticated, offline) — the next
      // eligibility check still picks the change up. Realtime is an
      // optimisation, not a correctness requirement.
    }
  }

  /// Suppression can begin while an ad is up — a live call joined from a
  /// notification, say. Tear down rather than stacking.
  void _onCoordinatorChanged() {
    if (_active != null && _coordinator.isSuppressed) {
      _requestEnd(AdEndReason.invalidated);
    }
  }

  @override
  void dispose() {
    _disposed = true;
    _coordinator.removeListener(_onCoordinatorChanged);
    try {
      _ref
          .read(socketNotifierProvider.notifier)
          .off(kSocketAdCampaignInvalidated, _onInvalidated);
    } catch (_) {
      /* nothing to detach */
    }
    // Never strand paused media because the controller went away.
    _coordinator.restoreAll();
    final token = _lockToken;
    if (token != null) _coordinator.releaseAdLock(token);
    super.dispose();
  }
}

final adControllerProvider = ChangeNotifierProvider<AdController>(
  (ref) => AdController(ref),
);
