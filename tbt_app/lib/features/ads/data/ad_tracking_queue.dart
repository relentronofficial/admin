import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

/// Offline tracking queue — TBT_ADS_SPECKIT.md §11 ("network lost during ad").
///
/// Mirrors `lib/ads/trackingQueue.ts` on user-web, including the 24-hour drop
/// rule. Tracking is fire-and-forget, but that must not mean losing the
/// completion of every ad watched on a train: a call that never reached the
/// server is parked and retried on the next successful call or app launch.
///
/// Entries older than 24 hours are dropped. Impression counts and cap
/// enforcement are settled server-side long before then, so a day-old event is
/// analytics noise — and replaying a week of them on reconnect would just trip
/// the rate limit §5 puts on these routes.
class AdTrackingQueue {
  AdTrackingQueue._();

  static const _kKey = 'tbt_ad_tracking_queue';
  static const _maxAge = Duration(hours: 24);

  /// Bounded so a long offline session cannot grow preferences without limit.
  /// The newest entries win — they describe the session the user actually had.
  static const _maxEntries = 50;

  static bool _flushing = false;

  static Future<List<Map<String, dynamic>>> _read() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_kKey);
      if (raw == null || raw.isEmpty) return [];
      final decoded = json.decode(raw);
      if (decoded is! List) return [];
      return decoded.whereType<Map<String, dynamic>>().toList();
    } catch (_) {
      return [];
    }
  }

  static Future<void> _write(List<Map<String, dynamic>> entries) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      if (entries.isEmpty) {
        await prefs.remove(_kKey);
        return;
      }
      await prefs.setString(_kKey, json.encode(entries));
    } catch (_) {
      // Storage unavailable — tracking degrades, the app does not.
    }
  }

  static List<Map<String, dynamic>> _fresh(
    List<Map<String, dynamic>> entries,
    int nowMs,
  ) {
    return entries.where((e) {
      final at = e['queuedAt'];
      return at is int && nowMs - at < _maxAge.inMilliseconds;
    }).toList();
  }

  static Future<void> enqueue(String path, Map<String, dynamic> body) async {
    final nowMs = DateTime.now().millisecondsSinceEpoch;
    final entries = _fresh(await _read(), nowMs)
      ..add({'path': path, 'body': body, 'queuedAt': nowMs});
    final trimmed = entries.length > _maxEntries
        ? entries.sublist(entries.length - _maxEntries)
        : entries;
    await _write(trimmed);
  }

  /// Drain the queue through [send].
  ///
  /// Stops at the first failure and keeps everything from that point on: if the
  /// network is still down, pushing the rest through just burns the rate limit.
  static Future<void> flush(
    Future<void> Function(String path, Map<String, dynamic> body) send,
  ) async {
    if (_flushing) return;
    _flushing = true;
    try {
      var pending = _fresh(await _read(), DateTime.now().millisecondsSinceEpoch);
      while (pending.isNotEmpty) {
        final head = pending.first;
        final path = head['path'];
        final body = head['body'];
        if (path is! String || body is! Map<String, dynamic>) {
          // Corrupt entry — drop it rather than blocking the queue forever.
          pending = pending.sublist(1);
          await _write(pending);
          continue;
        }
        try {
          await send(path, body);
        } catch (_) {
          await _write(pending);
          return;
        }
        pending = pending.sublist(1);
        await _write(pending);
      }
    } finally {
      _flushing = false;
    }
  }
}
