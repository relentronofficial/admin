import 'dart:convert';

import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../core/utils/cache_storage.dart';
import '../api/services/auth_service.dart';
import '../models/member.dart';

part 'me_provider.g.dart';

@Riverpod(keepAlive: true)
class MeNotifier extends _$MeNotifier {
  /// Raw JSON payload from the last successful `/api/user/me` fetch —
  /// exposed via [rawMeProvider] so profile screens can read extended
  /// fields (`currentStreak`, `totalPoints`, `businessName`, …) without
  /// re-hitting the endpoint.
  Map<String, dynamic>? _lastRaw;
  Map<String, dynamic>? get lastRaw => _lastRaw;

  // Cold-start optimisation: only the FIRST build() call serves from cache.
  // Subsequent builds triggered by explicit ref.invalidate() (pull-to-refresh,
  // profile updates, post-login) skip the cache and go straight to the network
  // so callers always get fresh data when they explicitly ask for it.
  bool _initialLoadDone = false;

  @override
  Future<Member> build() async {
    if (!_initialLoadDone) {
      _initialLoadDone = true;
      // Try the on-disk cache first so SubscriptionGate passes through
      // immediately — no full-screen spinner while /me loads on cold start.
      final cachedJson = await CacheStorage.readMe();
      if (cachedJson != null) {
        try {
          final raw = jsonDecode(cachedJson) as Map<String, dynamic>;
          _lastRaw = raw;
          // Refresh silently in the background; updates state when it resolves.
          Future.microtask(_backgroundRefresh);
          return Member.fromJson(raw);
        } catch (_) {
          // Corrupt cache entry — fall through to a blocking network fetch.
        }
      }
    }
    // Explicit invalidation OR no cache on first build — block until network.
    return _fetchFromNetwork();
  }

  Future<Member> _fetchFromNetwork() async {
    try {
      final (:member, :raw) =
          await ref.read(authServiceProvider).getMeWithRaw();
      _lastRaw = raw;
      await CacheStorage.writeMe(jsonEncode(raw));
      return member;
    } catch (e, st) {
      // Return stale profile rather than surfacing an error to the UI.
      final cachedJson = await CacheStorage.readMe();
      if (cachedJson != null) {
        try {
          final raw = jsonDecode(cachedJson) as Map<String, dynamic>;
          _lastRaw = raw;
          return Member.fromJson(raw);
        } catch (_) {}
      }
      Error.throwWithStackTrace(e, st);
    }
  }

  /// Fetches a fresh member from the network and updates state silently.
  /// Called from a microtask after a cache-first cold-start build.
  Future<void> _backgroundRefresh() async {
    try {
      final (:member, :raw) =
          await ref.read(authServiceProvider).getMeWithRaw();
      _lastRaw = raw;
      await CacheStorage.writeMe(jsonEncode(raw));
      state = AsyncValue.data(member);
    } catch (_) {
      // Silently keep the cached data; the user's session is unaffected.
    }
  }
}

/// The raw `/api/user/me` payload, sharing the single fetch that
/// [meNotifierProvider] already performs. Watch this from
/// [profileStatsProvider], [fetchRawProfile], and anywhere else that
/// needs the extended fields. Auto-refreshes when the underlying
/// [meNotifierProvider] is invalidated.
final rawMeProvider = FutureProvider<Map<String, dynamic>>((ref) async {
  // Wait for the primary provider to fetch — one network call, one
  // parse. On invalidation, both providers re-run in lockstep.
  await ref.watch(meNotifierProvider.future);
  final raw = ref.read(meNotifierProvider.notifier).lastRaw;
  return raw ?? const <String, dynamic>{};
});
