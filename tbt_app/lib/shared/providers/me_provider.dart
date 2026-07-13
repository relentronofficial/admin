import 'dart:convert';

import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../core/utils/cache_storage.dart';
import '../api/services/auth_service.dart';
import '../models/member.dart';

part 'me_provider.g.dart';

@Riverpod(keepAlive: true)
class MeNotifier extends _$MeNotifier {
  @override
  Future<Member> build() async {
    try {
      final member = await ref.read(authServiceProvider).getMe();
      // Persist for offline fallback.
      await CacheStorage.writeMe(jsonEncode(member.toJson()));
      return member;
    } catch (e, st) {
      // Return stale profile rather than surfacing an error to the UI.
      final cachedJson = await CacheStorage.readMe();
      if (cachedJson != null) {
        try {
          return Member.fromJson(
              jsonDecode(cachedJson) as Map<String, dynamic>);
        } catch (_) {}
      }
      Error.throwWithStackTrace(e, st);
    }
  }
}
