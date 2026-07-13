import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../core/constants/storage_keys.dart';

class TokenStorage {
  static const _store = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  static Future<String?> readAccessToken() =>
      _store.read(key: kSecureAccessToken);

  static Future<void> writeAccessToken(String token) =>
      _store.write(key: kSecureAccessToken, value: token);

  static Future<String?> readRefreshToken() =>
      _store.read(key: kSecureRefreshToken);

  static Future<void> writeRefreshToken(String token) =>
      _store.write(key: kSecureRefreshToken, value: token);

  static Future<void> clearAll() async {
    await _store.delete(key: kSecureAccessToken);
    await _store.delete(key: kSecureRefreshToken);
  }

  /// Extracts the value of [cookieName] from a `set-cookie` header list.
  static String? extractFromSetCookie(List<String>? cookies, String cookieName) {
    if (cookies == null) return null;
    for (final cookie in cookies) {
      // Each Set-Cookie value: "name=value; Path=/; HttpOnly; ..."
      final segments = cookie.split(';');
      if (segments.isEmpty) continue;
      final kv = segments.first.trim().split('=');
      if (kv.length >= 2 && kv[0].trim() == cookieName) {
        return kv.sublist(1).join('=');
      }
    }
    return null;
  }
}
