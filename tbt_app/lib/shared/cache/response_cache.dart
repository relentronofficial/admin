import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:hive_flutter/hive_flutter.dart';

/// Persistent last-known-good-response cache.
///
/// Every entry is a JSON-serialisable payload keyed by a string
/// identifying the request (e.g. `dashboard:stats`,
/// `courses:list:v1`). Providers that hit high-latency endpoints
/// (dashboard, courses list, workshops list) should:
///
///   1. On build, seed the state from `read(key)` if present so the
///      UI renders cached data on the first frame — no cold-start
///      spinner.
///   2. Kick off the network fetch in the background.
///   3. On success, overwrite the cache via `write(key, payload)`.
///
/// The cache is disk-persisted so it survives app kills but is fine
/// with light disk pressure — Hive rewrites the whole box occasionally.
///
/// **Bounded to a single Hive box** so we don't fragment the store.
/// If you need per-user scoping later (multi-account), key entries
/// with the user id in the string, don't add more boxes.
class ResponseCache {
  ResponseCache._();

  static const _boxName = 'tbt_response_cache';

  /// Max age of a cached entry considered "fresh enough to render
  /// immediately." Older entries are still returned but callers may
  /// choose to show a subtler stale indicator.
  static const staleThreshold = Duration(hours: 24);

  static Box<String>? _box;

  /// Call once at app boot after `Hive.initFlutter()`. Idempotent —
  /// safe to invoke from `main.dart` before `runApp`.
  static Future<void> init() async {
    if (_box != null) return;
    await Hive.initFlutter();
    _box = await Hive.openBox<String>(_boxName);
  }

  /// Read the cached payload for [key], or null if absent / corrupted.
  static Map<String, dynamic>? read(String key) {
    final raw = _box?.get(key);
    if (raw == null || raw.isEmpty) return null;
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! Map) return null;
      return Map<String, dynamic>.from(decoded);
    } catch (e) {
      // Corrupt entry — evict rather than keep tripping over it.
      _box?.delete(key);
      if (kDebugMode) {
        debugPrint('ResponseCache: dropping corrupt entry $key: $e');
      }
      return null;
    }
  }

  /// Whether the cached entry for [key] is within [staleThreshold].
  static bool isFresh(String key) {
    final entry = read(key);
    if (entry == null) return false;
    final savedAtMs = entry['savedAt'] as int?;
    if (savedAtMs == null) return false;
    final age = DateTime.now()
        .difference(DateTime.fromMillisecondsSinceEpoch(savedAtMs));
    return age < staleThreshold;
  }

  /// Persist [payload] for [key]. Fire-and-forget — errors are logged
  /// in debug builds but never rethrown, because a cache-write failure
  /// should never break the user-facing flow.
  static Future<void> write(String key, Map<String, dynamic> payload) async {
    if (_box == null) return;
    try {
      final wrapped = {
        'savedAt': DateTime.now().millisecondsSinceEpoch,
        'payload': payload,
      };
      await _box!.put(key, jsonEncode(wrapped));
    } catch (e) {
      if (kDebugMode) debugPrint('ResponseCache: write failed for $key: $e');
    }
  }

  /// Convenience — returns just the `payload` sub-object of the wrapper
  /// so callers don't have to remember the wrapping format.
  static Map<String, dynamic>? readPayload(String key) {
    final entry = read(key);
    final payload = entry?['payload'];
    if (payload is! Map) return null;
    return Map<String, dynamic>.from(payload);
  }

  /// Drop a single entry. Use for logout so the next user doesn't see
  /// the previous user's cached data.
  static Future<void> evict(String key) async {
    await _box?.delete(key);
  }

  /// Drop everything. Called on sign-out.
  static Future<void> clear() async {
    await _box?.clear();
  }
}
