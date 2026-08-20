import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../core/constants/storage_keys.dart';

class TokenStorage {
  static const _store = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  // In-memory cache so repeated reads (e.g. per-request interceptor, socket
  // connect) never hit EncryptedSharedPreferences more than once per session.
  // On Android, each EncryptedSharedPreferences read involves Keystore crypto
  // (~100–300 ms cold, ~10–50 ms warm) — without this cache every API call
  // paid that cost individually, causing visible UI lag.
  static String? _cachedAccessToken;
  static String? _cachedRefreshToken;

  static Future<String?> readAccessToken() async {
    _cachedAccessToken ??= await _store.read(key: kSecureAccessToken);
    return _cachedAccessToken;
  }

  static Future<void> writeAccessToken(String token) async {
    _cachedAccessToken = token;
    await _store.write(key: kSecureAccessToken, value: token);
  }

  static Future<String?> readRefreshToken() async {
    _cachedRefreshToken ??= await _store.read(key: kSecureRefreshToken);
    return _cachedRefreshToken;
  }

  static Future<void> writeRefreshToken(String token) async {
    _cachedRefreshToken = token;
    await _store.write(key: kSecureRefreshToken, value: token);
  }

  static Future<void> clearAll() async {
    _cachedAccessToken = null;
    _cachedRefreshToken = null;
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
