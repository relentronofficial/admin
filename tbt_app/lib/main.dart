import 'dart:async';
import 'dart:convert';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_displaymode/flutter_displaymode.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app.dart';
import 'core/constants/storage_keys.dart';
import 'core/utils/device_id.dart';
import 'core/utils/notification_router.dart';
import 'features/notifications/data/fcm_service.dart';
import 'firebase_options.dart';
import 'shared/api/token_storage.dart';
import 'shared/cache/response_cache.dart';
import 'shared/providers/me_provider.dart';
import 'shared/providers/site_config_provider.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Firebase must be initialized before runApp — native plugin channels.
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);

  final container = ProviderContainer();

  // Show UI immediately — the splash video covers background init time.
  runApp(UncontrolledProviderScope(container: container, child: const TbtApp()));

  // Everything below runs concurrently with the splash video (up to 6 s).
  // Order matters only where noted.
  unawaited(_backgroundInit(container));
}

/// Heavy startup work that does not need to block the first frame.
/// Runs concurrently with [VideoSplashScreen].
Future<void> _backgroundInit(ProviderContainer container) async {
  // Local notifications channel must exist before FCM fires any tap callbacks.
  await initLocalNotifications();

  // Hive cache — providers treat a null box as a cache miss so the app
  // stays functional even if this completes after the first provider read.
  await ResponseCache.init();

  // Opt into the highest supported refresh rate on Android.
  if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
    try {
      await FlutterDisplayMode.setHighRefreshRate();
    } catch (_) {}
  }

  // Terminated-state notification deep-link — resolve and stash the target
  // route so TbtApp can consume it once the user is authenticated.
  // getInitialMessage() is a fast local IPC call (no network).
  final initialMessage = await FirebaseMessaging.instance.getInitialMessage();
  if (initialMessage != null) {
    final type = initialMessage.data['type'] as String?;
    if (type != null && type.isNotEmpty) {
      final route = resolveNotificationRoute(
        type: type,
        metadata: _parseMetadata(initialMessage.data['metadata']),
      );
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(kPrefPendingDeepLink, route);
    }
  }

  // Device ID — populates cachedDeviceId used by AuthInterceptor.
  await getOrCreateDeviceId();

  // Prime the token cache once. Every subsequent readAccessToken() call
  // in the interceptor now returns the in-memory value instead of hitting
  // EncryptedSharedPreferences again.
  final hasSession = (await TokenStorage.readAccessToken()) != null;

  // Prefetch public config + member profile in parallel so the dashboard
  // renders from cache when the splash hands off. All errors are swallowed
  // — a failed prefetch is just a cache miss; providers re-fetch normally.
  await Future.wait([
    container
        .read(siteConfigNotifierProvider.future)
        .then((_) {})
        .catchError((_) {}),
    container
        .read(navConfigNotifierProvider.future)
        .then((_) {})
        .catchError((_) {}),
    container
        .read(uiStringsNotifierProvider.future)
        .then((_) {})
        .catchError((_) {}),
    if (hasSession)
      container
          .read(meNotifierProvider.future)
          .then((_) {})
          .catchError((_) {}),
  ]);
}

Map<String, dynamic>? _parseMetadata(dynamic raw) {
  if (raw == null) return null;
  if (raw is Map<String, dynamic>) return raw;
  if (raw is String && raw.isNotEmpty) {
    try {
      return jsonDecode(raw) as Map<String, dynamic>?;
    } catch (_) {
      return null;
    }
  }
  return null;
}
