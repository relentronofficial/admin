import 'dart:convert';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/utils/notification_router.dart';
import 'notifications_service.dart';

// ── Static singletons shared across all FcmService instances ─────────────────

const _kChannelId = 'tbt_general';
const _kChannelName = 'TBT Notifications';

final _localNotifs = FlutterLocalNotificationsPlugin();

bool _localNotifsInitialized = false;
bool _refreshListenerSet = false;
bool _handlersSet = false;

// ── Local notifications bootstrap (called once from main()) ──────────────────

Future<void> initLocalNotifications() async {
  if (_localNotifsInitialized) return;
  _localNotifsInitialized = true;

  const androidSettings =
      AndroidInitializationSettings('@mipmap/ic_launcher');
  const iosSettings = DarwinInitializationSettings();

  await _localNotifs.initialize(
    const InitializationSettings(android: androidSettings, iOS: iosSettings),
  );

  // Create the Android notification channel (idempotent).
  await _localNotifs
      .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin>()
      ?.createNotificationChannel(
        const AndroidNotificationChannel(
          _kChannelId,
          _kChannelName,
          description: 'General notifications from Tamil Business Tribe',
          importance: Importance.high,
        ),
      );
}

// ── FCM service ───────────────────────────────────────────────────────────────

class FcmService {
  const FcmService(this._notificationsService);

  final NotificationsService _notificationsService;

  // ── Token registration ─────────────────────────────────────────────────────

  Future<void> requestPermission() async {
    await FirebaseMessaging.instance.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );
  }

  Future<void> getAndRegisterToken() async {
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token != null) {
        await _notificationsService
            .registerFcmToken(token)
            .catchError((_) {});
      }
      if (!_refreshListenerSet) {
        _refreshListenerSet = true;
        FirebaseMessaging.instance.onTokenRefresh.listen((newToken) {
          _notificationsService
              .registerFcmToken(newToken)
              .catchError((_) {});
        });
      }
    } catch (_) {
      // Best-effort — FCM failure must not block the login flow.
    }
  }

  // ── Message handlers ───────────────────────────────────────────────────────

  /// Wire up foreground + background-tap handlers. Idempotent — safe to call
  /// multiple times (e.g. on each `TbtApp.build` invocation).
  void initHandlers(GoRouter router) {
    if (_handlersSet) return;
    _handlersSet = true;

    // Foreground — app is open; show a local notification.
    FirebaseMessaging.onMessage.listen(_onForegroundMessage);

    // Background tap — app was alive but in background; user tapped notification.
    FirebaseMessaging.onMessageOpenedApp.listen((msg) => _navigateFromMessage(msg, router));
  }

  static Future<void> _onForegroundMessage(RemoteMessage message) async {
    final notif = message.notification;
    if (notif == null) return;
    await _localNotifs.show(
      notif.hashCode,
      notif.title,
      notif.body,
      const NotificationDetails(
        android: AndroidNotificationDetails(
          _kChannelId,
          _kChannelName,
          icon: '@mipmap/ic_launcher',
          importance: Importance.high,
          priority: Priority.high,
        ),
      ),
    );
  }

  static void _navigateFromMessage(RemoteMessage message, GoRouter router) {
    try {
      final type = message.data['type'] as String?;
      if (type == null || type.isEmpty) return;
      final route = resolveNotificationRoute(
        type: type,
        metadata: _parseMetadata(message.data['metadata']),
      );
      router.go(route);
    } catch (_) {}
  }

  static Map<String, dynamic>? _parseMetadata(dynamic raw) {
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
}

final fcmServiceProvider = Provider<FcmService>(
  (ref) => FcmService(ref.watch(notificationsServiceProvider)),
);
