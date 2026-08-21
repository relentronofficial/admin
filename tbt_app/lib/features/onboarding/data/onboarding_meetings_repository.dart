import 'package:dio/dio.dart';

import '../../../core/constants/api.dart';
import '../../../shared/api/dio_client.dart';
import '../domain/onboarding_meeting.dart';

/// Mirrors [OnboardingRepository]'s shape — thin Dio wrapper, no extra
/// abstraction. See ONBOARDING_LIVE_MEETING_SPECKIT.md.
class OnboardingMeetingsRepository {
  OnboardingMeetingsRepository(this._dio);
  final Dio _dio;

  Future<List<OnboardingMeeting>> listMine() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(kOnboardingMeetings);
      final data = (res.data?['data'] as List?) ?? [];
      return data.map((m) => OnboardingMeeting.fromJson(m as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<OnboardingMeetingJoinCreds> join(String id) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>('$kOnboardingMeetings/$id/token');
      final data = res.data?['data'] as Map<String, dynamic>? ?? {};
      return OnboardingMeetingJoinCreds.fromJson(data);
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<void> leave(String id) async {
    try {
      await _dio.post<Map<String, dynamic>>('$kOnboardingMeetings/$id/leave');
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }
}
