import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/api.dart';
import '../../../shared/api/dio_provider.dart';

// ── Model ─────────────────────────────────────────────────────────────────────

class CourseWeeklyReport {
  const CourseWeeklyReport({
    required this.courseId,
    required this.weekNumber,
    required this.completionPercent,
    required this.lessonsCompleted,
    required this.totalLessons,
    this.adminRemarks,
    this.reportSentAt,
    this.feedbackText,
    this.feedbackStatus,
  });

  final String courseId;
  final int weekNumber;
  final double completionPercent;
  final int lessonsCompleted;
  final int totalLessons;
  final String? adminRemarks;
  final String? reportSentAt;
  final String? feedbackText;
  final String? feedbackStatus; // 'new' | 'reviewed' | null

  factory CourseWeeklyReport.fromJson(Map<String, dynamic> j) =>
      CourseWeeklyReport(
        courseId: j['courseId'] as String? ?? '',
        weekNumber: (j['weekNumber'] as num?)?.toInt() ?? 0,
        completionPercent:
            (j['completionPercent'] as num?)?.toDouble() ?? 0,
        lessonsCompleted:
            (j['lessonsCompleted'] as num?)?.toInt() ?? 0,
        totalLessons: (j['totalLessons'] as num?)?.toInt() ?? 0,
        adminRemarks: j['adminRemarks'] as String?,
        reportSentAt: j['reportSentAt'] as String?,
        feedbackText: j['feedbackText'] as String?,
        feedbackStatus: j['feedbackStatus'] as String?,
      );
}

// ── Service ───────────────────────────────────────────────────────────────────

class CourseReportsService {
  const CourseReportsService(this._dio);

  final Dio _dio;

  /// GET /api/course-reports/my-report?courseId=xxx
  /// Returns null when the member has no report yet for this course.
  Future<CourseWeeklyReport?> getMyReport(String courseId) async {
    final resp = await _dio.get<Map<String, dynamic>>(
      kCourseMyReport,
      queryParameters: {'courseId': courseId},
    );
    final body = resp.data;
    if (body == null) return null;
    final data = body['data'];
    if (data == null) return null;
    return CourseWeeklyReport.fromJson(data as Map<String, dynamic>);
  }

  /// POST /api/course-reports/feedback
  Future<void> submitFeedback({
    required String courseId,
    required int weekNumber,
    required String feedbackText,
  }) async {
    await _dio.post<void>(
      kCourseSubmitFeedback,
      data: {
        'courseId': courseId,
        'weekNumber': weekNumber,
        'feedbackText': feedbackText,
      },
    );
  }

  /// GET /api/course-reports/feedback/history?courseId=xxx
  Future<List<CourseWeeklyReport>> getFeedbackHistory(
      String courseId) async {
    final resp = await _dio.get<Map<String, dynamic>>(
      kCourseFeedbackHistory,
      queryParameters: {'courseId': courseId},
    );
    final body = resp.data;
    if (body == null) return [];
    final list = body['data'];
    if (list == null || list is! List) return [];
    return list
        .map((e) =>
            CourseWeeklyReport.fromJson(e as Map<String, dynamic>))
        .toList();
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────

final courseReportsServiceProvider = Provider<CourseReportsService>(
  (ref) => CourseReportsService(ref.watch(dioProvider)),
);
