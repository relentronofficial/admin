// ── flutter_secure_storage keys (sensitive — encrypted on device) ───────────────
const String kSecureAccessToken = 'tbt_access_token';
const String kSecureRefreshToken = 'tbt_refresh_token';

// ── SharedPreferences keys (non-sensitive persistence) ──────────────────────────
const String kPrefDeviceId = 'tbt_device_id';
const String kPrefPlaybackSpeed = 'tbt_speed';
const String kPrefReflections = 'tbt_reflections';
const String kPrefRecentSearches = 'tbt_recent_searches';
const String kPrefPendingDeepLink = 'tbt_pending_deep_link';
const String kPrefThemeMode = 'tbt_theme_mode';

// ── Cache keys (last-fetch fallback, stored in SharedPreferences as JSON) ────────
const String kCacheMe = 'cache_me';
const String kCacheUnreadNotifCount = 'cache_unread_notif_count';
const String kCacheUnreadMessageCount = 'cache_unread_message_count';
