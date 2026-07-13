import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/api.dart';
import '../dio_client.dart';
import '../dio_provider.dart';

class EventsService {
  const EventsService(this._dio);
  final Dio _dio;

  Future<Map<String, dynamic>> listEvents() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(kUserEvents);
      return res.data ?? {};
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<Map<String, dynamic>> getEvent(String id) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>('$kUserEvents/$id');
      return res.data ?? {};
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }
}

final eventsServiceProvider = Provider<EventsService>(
  (ref) => EventsService(ref.watch(dioProvider)),
);
