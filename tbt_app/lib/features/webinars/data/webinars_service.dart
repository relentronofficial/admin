import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/api.dart';
import '../../../core/exceptions/app_exception.dart';
import '../../../shared/api/dio_client.dart';
import '../../../shared/api/dio_provider.dart';

class TbtWebinar {
  final String id;
  final String title;
  final String? description;
  final String? thumbnailUrl;
  final String? scheduledAt;
  final String? startedAt;
  final String? endedAt;
  final String status;
  final int? attendeeCount;
  final String? host;

  const TbtWebinar({
    required this.id,
    required this.title,
    this.description,
    this.thumbnailUrl,
    this.scheduledAt,
    this.startedAt,
    this.endedAt,
    required this.status,
    this.attendeeCount,
    this.host,
  });

  factory TbtWebinar.fromJson(Map<String, dynamic> j) => TbtWebinar(
        id: j['id'] as String,
        title: j['title'] as String? ?? 'Untitled',
        description: j['description'] as String?,
        thumbnailUrl: j['thumbnailUrl'] as String?,
        scheduledAt: j['scheduledAt'] as String?,
        startedAt: j['startedAt'] as String?,
        endedAt: j['endedAt'] as String?,
        status: j['status'] as String? ?? 'scheduled',
        attendeeCount: (j['attendeeCount'] as num?)?.toInt(),
        host: j['host'] as String?,
      );

  DateTime? get parsedScheduledAt {
    try {
      final s = scheduledAt;
      return s == null ? null : DateTime.parse(s).toLocal();
    } catch (_) {
      return null;
    }
  }

  bool get isLive => status == 'live' || (startedAt != null && endedAt == null);
  bool get hasEnded => status == 'ended' || endedAt != null;
  bool get isUpcoming =>
      !isLive && !hasEnded && (parsedScheduledAt?.isAfter(DateTime.now()) ?? false);
}

class WebinarsService {
  const WebinarsService(this._dio);
  final Dio _dio;

  Future<List<TbtWebinar>> listWebinars() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(kUserWebinars);
      final list = res.data?['data'] as List<dynamic>? ?? [];
      return list
          .map((e) => TbtWebinar.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<TbtWebinar> getWebinar(String id) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>('$kUserWebinars/$id');
      final data = res.data?['data'] as Map<String, dynamic>?;
      if (data == null) throw const ServerException('Webinar not found');
      return TbtWebinar.fromJson(data);
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }
}

final webinarsServiceProvider = Provider<WebinarsService>(
  (ref) => WebinarsService(ref.watch(dioProvider)),
);
