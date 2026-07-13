import 'package:shared_preferences/shared_preferences.dart';

import '../constants/storage_keys.dart';

/// SharedPreferences wrappers for the three app-level cache keys.
/// Used as last-fetch fallbacks when the device is offline.
class CacheStorage {
  static Future<String?> readMe() async =>
      (await SharedPreferences.getInstance()).getString(kCacheMe);

  static Future<void> writeMe(String json) async =>
      (await SharedPreferences.getInstance()).setString(kCacheMe, json);

  static Future<int> readUnreadNotifCount() async =>
      (await SharedPreferences.getInstance()).getInt(kCacheUnreadNotifCount) ??
      0;

  static Future<void> writeUnreadNotifCount(int count) async =>
      (await SharedPreferences.getInstance())
          .setInt(kCacheUnreadNotifCount, count);

  static Future<int> readUnreadMessageCount() async =>
      (await SharedPreferences.getInstance())
          .getInt(kCacheUnreadMessageCount) ??
      0;

  static Future<void> writeUnreadMessageCount(int count) async =>
      (await SharedPreferences.getInstance())
          .setInt(kCacheUnreadMessageCount, count);
}
