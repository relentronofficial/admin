import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/api.dart';
import '../../../shared/api/dio_client.dart';
import '../../../shared/api/dio_provider.dart';
import '../../../shared/models/notification_item.dart';

class NotificationsService {
  const NotificationsService(this._dio);
  final Dio _dio;

  Future<List<NotificationItem>> getNotifications({
    int page = 1,
    int limit = 20,
  }) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        kNotifications,
        queryParameters: {'page': page, 'limit': limit},
      );
      final list = (res.data?['data'] as List<dynamic>?) ?? [];
      return list
          .cast<Map<String, dynamic>>()
          .map(NotificationItem.fromJson)
          .toList();
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<int> getUnreadCount() async {
    try {
      final res = await _dio
          .get<Map<String, dynamic>>(kNotificationsUnreadCount);
      final data = res.data?['data'] as Map<String, dynamic>? ?? {};
      return (data['count'] as num?)?.toInt() ?? 0;
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<void> markRead(String id) async {
    try {
      await _dio.patch<dynamic>('$kNotifications/$id/read');
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<void> markAllRead() async {
    try {
      await _dio.post<dynamic>(kNotificationsReadAll);
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<void> registerFcmToken(String token) async {
    try {
      await _dio.post<dynamic>(
        kUserFcmToken,
        data: {'token': token},
      );
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<void> dismiss(String id) async {
    try {
      await _dio.delete<dynamic>('$kNotifications/$id');
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<void> clearRead() async {
    try {
      await _dio.delete<dynamic>(kNotifications);
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<NotificationPreferences> getPreferences() async {
    try {
      final res = await _dio
          .get<Map<String, dynamic>>('$kNotifications/preferences');
      final data = res.data?['data'] as Map<String, dynamic>? ?? {};
      return NotificationPreferences.fromJson(data);
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<void> updatePreferences(NotificationPreferences prefs) async {
    try {
      await _dio.patch<dynamic>(
        '$kNotifications/preferences',
        data: prefs.toJson(),
      );
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }
}

class NotificationPreferences {
  const NotificationPreferences({
    this.email = true,
    this.push = true,
    this.sms = false,
  });

  final bool email;
  final bool push;
  final bool sms;

  NotificationPreferences copyWith({bool? email, bool? push, bool? sms}) =>
      NotificationPreferences(
        email: email ?? this.email,
        push: push ?? this.push,
        sms: sms ?? this.sms,
      );

  factory NotificationPreferences.fromJson(Map<String, dynamic> json) =>
      NotificationPreferences(
        email: json['email'] as bool? ?? true,
        push: json['push'] as bool? ?? true,
        sms: json['sms'] as bool? ?? false,
      );

  Map<String, dynamic> toJson() => {
        'email': email,
        'push': push,
        'sms': sms,
      };
}

final notificationsServiceProvider = Provider<NotificationsService>(
  (ref) => NotificationsService(ref.watch(dioProvider)),
);
