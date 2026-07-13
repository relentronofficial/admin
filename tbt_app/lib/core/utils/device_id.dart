import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';

import '../constants/storage_keys.dart';

// Module-level cache populated by getOrCreateDeviceId() at app startup.
// AuthInterceptor reads this synchronously on every request.
String? _cachedDeviceId;

/// Synchronous read — null until the first await of [getOrCreateDeviceId].
String? get cachedDeviceId => _cachedDeviceId;

/// Returns the stable device ID, generating and persisting one on first call.
/// Call this once in main() before runApp; subsequent calls return the cached value.
/// Mirrors the `tbt_device_id` localStorage value in the user-web client.
Future<String> getOrCreateDeviceId() async {
  if (_cachedDeviceId != null) return _cachedDeviceId!;
  final prefs = await SharedPreferences.getInstance();
  final existing = prefs.getString(kPrefDeviceId);
  if (existing != null) {
    _cachedDeviceId = existing;
    return existing;
  }
  final id = const Uuid().v4();
  await prefs.setString(kPrefDeviceId, id);
  _cachedDeviceId = id;
  return id;
}
