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

  @override
  Future<Member> build() async {
    try {
      final (:member, :raw) =
          await ref.read(authServiceProvider).getMeWithRaw();
      _lastRaw = raw;
      // Persist for offline fallback — cache the raw payload so a stale
      // read still has the extended fields, not just the Member subset.
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
