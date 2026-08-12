import 'dart:async';
import 'dart:io' show Platform;

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/api.dart';
import '../../../shared/api/dio_provider.dart';
import 'ad_models.dart';
import 'ad_tracking_queue.dart';

/// HTTP access for the ad system — TBT_ADS_SPECKIT.md §10.
///
/// Two different failure policies live here on purpose:
///
///   * `eligible` returns [AdEligibleResult.none] on any failure. A broken ad
///     system must degrade to an app with no ads, never to a broken app (§11).
///   * every tracking call is fire-and-forget and swallows its own errors.
///     Tracking must never block the UI or gate ad teardown, so a caller that
///     awaits one of these still cannot be hurt by it.
class AdRepository {
  const AdRepository(this._dio);

  final Dio _dio;

  Future<AdEligibleResult> eligible({
    required String sessionId,
    required String anonymousId,
    required String placement,
    required String triggerType,
    String? route,
    String? module,
    String? contentId,
    String? appVersion,
    int? launchCount,
    int? sessionElapsedSeconds,
    Map<String, dynamic>? deviceInfo,
  }) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        kAdsEligible,
        data: {
          'sessionId': sessionId,
          'anonymousId': anonymousId,
          'platform': 'mobile',
          if (_os != null) 'os': _os,
          'placement': placement,
          'triggerType': triggerType,
          if (route != null) 'route': route,
          if (module != null) 'module': module,
          if (contentId != null) 'contentId': contentId,
          if (appVersion != null) 'appVersion': appVersion,
          if (launchCount != null) 'launchCount': launchCount,
          if (sessionElapsedSeconds != null)
            'sessionElapsedSeconds': sessionElapsedSeconds,
          if (deviceInfo != null) 'deviceInfo': deviceInfo,
        },
      );
      final data = res.data?['data'];
      if (data is! Map<String, dynamic>) return AdEligibleResult.none;
      return AdEligibleResult.fromJson(data);
    } catch (_) {
      return AdEligibleResult.none;
    }
  }

  /// Confirms the ad actually rendered. Until this lands the backend treats the
  /// token as a selection, not an impression — and no frequency cap is spent.
  ///
  /// Returns false when the campaign was paused, archived or deleted between
  /// selection and render: the caller must tear the overlay down silently
  /// (§11). A network failure returns true — we cannot know, and pulling an ad
  /// off the screen because a beacon failed would be the worse guess.
  Future<bool> impression({
    required String displayToken,
    required String anonymousId,
  }) async {
    final body = {'displayToken': displayToken, 'anonymousId': anonymousId};
    try {
      final res = await _dio.post<Map<String, dynamic>>(kAdsImpression, data: body);
      unawaited(AdTrackingQueue.flush(_send));
      final data = res.data?['data'];
      if (data is Map && data['showAd'] == false) return false;
      return true;
    } on DioException catch (err) {
      if (err.response == null) unawaited(AdTrackingQueue.enqueue(kAdsImpression, body));
      return true;
    } catch (_) {
      return true;
    }
  }

  Future<void> complete({
    required String displayToken,
    required String anonymousId,
    double? elapsedSeconds,
    double? completionPercentage,
  }) =>
      _fire(kAdsComplete, _lifecycle(
        displayToken, anonymousId, elapsedSeconds, completionPercentage,
      ));

  Future<void> skip({
    required String displayToken,
    required String anonymousId,
    double? elapsedSeconds,
    double? completionPercentage,
  }) =>
      _fire(kAdsSkip, _lifecycle(
        displayToken, anonymousId, elapsedSeconds, completionPercentage,
      ));

  Future<void> close({
    required String displayToken,
    required String anonymousId,
    double? elapsedSeconds,
    double? completionPercentage,
  }) =>
      _fire(kAdsClose, _lifecycle(
        displayToken, anonymousId, elapsedSeconds, completionPercentage,
      ));

  /// Must be awaited before navigating away, or the request is cancelled by the
  /// screen transition (§9 — the same rule applies here).
  Future<void> click({
    required String displayToken,
    required String anonymousId,
    double? elapsedSeconds,
  }) =>
      _fire(kAdsClick, _lifecycle(displayToken, anonymousId, elapsedSeconds, null));

  Future<void> events({
    required String displayToken,
    required String anonymousId,
    required List<Map<String, dynamic>> events,
  }) =>
      _fire(kAdsEvents, {
        'displayToken': displayToken,
        'anonymousId': anonymousId,
        'events': events,
      });

  Map<String, dynamic> _lifecycle(
    String token,
    String anonymousId,
    double? elapsed,
    double? completion,
  ) =>
      {
        'displayToken': token,
        // Guest tokens are bound to the device that was issued them (§6.4); a
        // signed-in member is bound by the JWT instead and the backend ignores
        // this. Sending it always is what makes both paths work.
        'anonymousId': anonymousId,
        if (elapsed != null) 'elapsedSeconds': elapsed,
        if (completion != null) 'completionPercentage': completion,
      };

  /// Send a tracking call, queueing it for retry if the network never answered.
  ///
  /// "Failed" splits in two and the distinction matters (§11):
  ///
  ///   * The server answered and rejected us (expired token, wrong subject,
  ///     rate limit). Retrying changes nothing — drop it.
  ///   * The request never reached the server. That is the flaky-network case
  ///     the spec asks us to queue and flush later; dropping it silently loses
  ///     the completion of every ad watched with bad signal.
  Future<void> _fire(String path, Map<String, dynamic> body) async {
    try {
      await _dio.post<Map<String, dynamic>>(path, data: body);
      // A success is the cheapest signal that the network is back.
      unawaited(AdTrackingQueue.flush(_send));
    } on DioException catch (err) {
      if (err.response == null) {
        // No response at all: connection error, timeout, DNS. Worth retrying.
        unawaited(AdTrackingQueue.enqueue(path, body));
      }
      // A response with any status was answered and is final.
    } catch (_) {
      // Never throw out of a tracking call.
    }
  }

  Future<void> _send(String path, Map<String, dynamic> body) async {
    await _dio.post<Map<String, dynamic>>(path, data: body);
  }

  /// Drain anything a previous session left behind. Called once at startup by
  /// the ad controller.
  Future<void> flushQueued() => AdTrackingQueue.flush(_send);

  /// `android` | `ios` | null. Null rather than a guess when we cannot tell:
  /// the backend treats a missing OS as "no OS constraint to check", whereas a
  /// wrong value would silently exclude the device from OS-targeted campaigns,
  /// and an empty string fails schema validation outright.
  static String? get _os {
    try {
      if (Platform.isAndroid) return 'android';
      if (Platform.isIOS) return 'ios';
    } catch (_) {
      // Host VM during tests — no platform to report.
    }
    return null;
  }
}

final adRepositoryProvider = Provider<AdRepository>(
  (ref) => AdRepository(ref.watch(dioProvider)),
);
