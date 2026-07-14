import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/api.dart';
import '../../../core/exceptions/app_exception.dart';
import '../../../shared/api/dio_client.dart';
import '../../../shared/api/dio_provider.dart';

// ── Models ────────────────────────────────────────────────────────────────────

class TbtEvent {
  final String id;
  final String title;
  final String? description;
  final String eventType;
  final String eventDate;
  final String? location;
  final bool isOnline;
  final String? registrationUrl;
  final int? maxAttendees;
  final String status;

  const TbtEvent({
    required this.id,
    required this.title,
    this.description,
    required this.eventType,
    required this.eventDate,
    this.location,
    required this.isOnline,
    this.registrationUrl,
    this.maxAttendees,
    required this.status,
  });

  factory TbtEvent.fromJson(Map<String, dynamic> j) => TbtEvent(
        id: j['id'] as String,
        title: j['title'] as String,
        description: j['description'] as String?,
        eventType: j['eventType'] as String? ?? 'general',
        eventDate: j['eventDate'] as String? ?? '',
        location: j['location'] as String?,
        isOnline: j['isOnline'] as bool? ?? false,
        registrationUrl: j['registrationUrl'] as String?,
        maxAttendees: j['maxAttendees'] as int?,
        status: j['status'] as String? ?? 'scheduled',
      );

  DateTime? get parsedDate {
    try { return DateTime.parse(eventDate).toLocal(); } catch (_) { return null; }
  }

  bool get isUpcoming {
    final d = parsedDate;
    return d != null && d.isAfter(DateTime.now());
  }
}

// ── Service ───────────────────────────────────────────────────────────────────

class EventsFeatureService {
  const EventsFeatureService(this._dio);
  final Dio _dio;

  Future<List<TbtEvent>> listEvents() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(kUserEvents);
      final list = res.data?['data'] as List<dynamic>? ?? [];
      return list
          .map((e) => TbtEvent.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<TbtEvent> getEvent(String id) async {
    try {
      final res =
          await _dio.get<Map<String, dynamic>>('$kUserEvents/$id');
      final data = res.data?['data'] as Map<String, dynamic>?;
      if (data == null) throw const ServerException('Event not found');
      return TbtEvent.fromJson(data);
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  /// Registers the current member for the event. Idempotent server-side —
  /// re-registering an already-registered member is a no-op success.
  Future<void> registerForEvent(String id) async {
    try {
      await _dio.post<dynamic>('$kUserEvents/$id/register');
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }
}

final eventsFeatureServiceProvider = Provider<EventsFeatureService>(
  (ref) => EventsFeatureService(ref.watch(dioProvider)),
);
