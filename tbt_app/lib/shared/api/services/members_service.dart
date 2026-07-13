import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/api.dart';
import '../dio_client.dart';
import '../dio_provider.dart';

class MembersService {
  const MembersService(this._dio);
  final Dio _dio;

  Future<Map<String, dynamic>> getMe() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(kUserMe);
      return res.data ?? {};
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<Map<String, dynamic>> updateProfile(Map<String, dynamic> data) async {
    try {
      final res = await _dio.put<Map<String, dynamic>>(kUserMe, data: data);
      return res.data ?? {};
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<void> updateFcmToken(String token) async {
    try {
      await _dio.post<dynamic>(kUserFcmToken, data: {'token': token});
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<List<MyDevice>> getMyDevices() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>('/api/user/my-devices');
      final list = (res.data?['data'] as List<dynamic>?) ?? [];
      return list.cast<Map<String, dynamic>>().map(MyDevice.fromJson).toList();
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<void> revokeDevice(String deviceId) async {
    try {
      await _dio.delete<dynamic>('/api/user/my-devices/$deviceId');
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }
}

class MyDevice {
  const MyDevice({
    required this.id,
    this.deviceId,
    this.userAgent,
    this.lastSeenAt,
    this.isCurrent = false,
  });

  final String id;
  final String? deviceId;
  final String? userAgent;
  final String? lastSeenAt;
  final bool isCurrent;

  factory MyDevice.fromJson(Map<String, dynamic> json) => MyDevice(
        id: (json['id'] as String?) ?? '',
        deviceId: json['deviceId'] as String?,
        userAgent: json['userAgent'] as String?,
        lastSeenAt: json['lastSeenAt'] as String?,
        isCurrent: json['isCurrent'] as bool? ?? false,
      );
}

final membersServiceProvider = Provider<MembersService>(
  (ref) => MembersService(ref.watch(dioProvider)),
);
