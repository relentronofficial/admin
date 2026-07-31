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
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);

  // Set up local notification channel before anything else uses FCM.
  await initLocalNotifications();

  // Open the shared response cache before any provider tries to read
  // from it. Cheap — opens a single Hive box.
  await ResponseCache.init();

  // Opt into the highest supported display refresh rate on Android.
  // Flutter caps at 60 Hz by default even on 120 Hz hardware — this
  // call picks the mode with the highest refresh rate among modes that
  // match the current resolution. iOS handles this via
  // `CADisableMinimumFrameDurationOnPhone` in Info.plist (already set).
  if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
    try {
      await FlutterDisplayMode.setHighRefreshRate();
    } catch (_) {
      // Not fatal — some emulators / older Android versions don't
      // support the mode API. Fall back to whatever the OS gave us.
    }
  }

  // Terminated state: resolve the tapped notification's route and stash it for
  // the router to consume once the user is authenticated.
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

  await getOrCreateDeviceId();

  final container = ProviderContainer();

  // Prefetch member profile in parallel with the public config fetches
  // when a session token is present — cuts the auth waterfall on cold
  // start (previously every authenticated screen paid the round-trip
  // for /api/user/me on first render). Skipped when there's no token
  // so we don't fire a guaranteed-401 for logged-out users.
  final hasSession = (await TokenStorage.readAccessToken()) != null;

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

  runApp(UncontrolledProviderScope(container: container, child: const TbtApp()));
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
