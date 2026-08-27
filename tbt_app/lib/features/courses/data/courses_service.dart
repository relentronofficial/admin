import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/api.dart';
import '../../../shared/api/dio_client.dart';
import '../../../shared/api/dio_provider.dart';
import '../../../shared/models/course.dart';
import '../../../shared/models/lesson.dart';

class EpisodeResource {
  const EpisodeResource({
    required this.id,
    required this.title,
    this.description,
    this.fileUrl,
    this.fileType,
    this.downloadLabel,
  });
  final String id;
  final String title;
  final String? description;
  final String? fileUrl;
  final String? fileType;
  final String? downloadLabel;

  factory EpisodeResource.fromJson(Map<String, dynamic> j) => EpisodeResource(
        id: j['id'] as String,
        title: j['title'] as String? ?? '',
        description: j['description'] as String?,
        fileUrl: j['fileUrl'] as String?,
        fileType: j['fileType'] as String?,
        downloadLabel: j['downloadLabel'] as String?,
      );
}

class EpisodeTask {
  const EpisodeTask({
    required this.id,
    required this.title,
    this.description,
    this.deliverables,
    this.estimatedMinutes,
  });
  final String id;
  final String title;
  final String? description;
  final String? deliverables;
  final int? estimatedMinutes;

  factory EpisodeTask.fromJson(Map<String, dynamic> j) => EpisodeTask(
        id: j['id'] as String,
        title: j['title'] as String? ?? '',
        description: j['description'] as String?,
        deliverables: j['deliverables'] as String?,
        estimatedMinutes: (j['estimatedMinutes'] as num?)?.toInt(),
      );
}

class CourseAccessRequest {
  const CourseAccessRequest({this.paymentId, this.paymentUrl});
  final String? paymentId;
  final String? paymentUrl;

  factory CourseAccessRequest.fromJson(Map<String, dynamic> json) =>
      CourseAccessRequest(
        paymentId: json['paymentId'] as String?,
        paymentUrl: json['paymentUrl'] as String?,
      );
}

class CourseXp {
  const CourseXp({
    required this.totalXp,
    required this.episodesCompleted,
    required this.currentStreak,
    required this.longestStreak,
  });
  final int totalXp;
  final int episodesCompleted;
  final int currentStreak;
  final int longestStreak;

  factory CourseXp.fromJson(Map<String, dynamic> json) => CourseXp(
        totalXp: (json['totalXp'] as num?)?.toInt() ?? 0,
        episodesCompleted: (json['episodesCompleted'] as num?)?.toInt() ?? 0,
        currentStreak: (json['currentStreak'] as num?)?.toInt() ?? 0,
        longestStreak: (json['longestStreak'] as num?)?.toInt() ?? 0,
      );
}

class CoursesService {
  const CoursesService(this._dio);
  final Dio _dio;

  Future<List<Course>> listCourses({
    int page = 1,
    int limit = 24,
    String? search,
  }) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        kUserCourses,
        queryParameters: {
          'page': page,
          'limit': limit,
          if (search != null && search.isNotEmpty) 'search': search,
        },
      );
      final list = (res.data?['data'] as List<dynamic>?) ?? [];
      return list.cast<Map<String, dynamic>>().map(Course.fromJson).toList();
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<CourseDetail> getCourseDetail(String courseId) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        '$kUserCourses/$courseId',
      );
      final data = res.data?['data'] as Map<String, dynamic>? ?? {};
      return CourseDetail.fromJson(data);
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  // Companion fetch for the pendingPayment sub-object. The backend returns it
  // in the same course-detail payload, but adding a field to the freezed
  // `CourseDetail` class requires build_runner regen — which is currently
  // blocked by an SDK-pin mismatch (see `courseXpProvider` for the same
  // workaround). Once regen is possible, fold this into `getCourseDetail`.
  Future<CoursePendingPayment?> getCoursePendingPayment(String courseId) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        '$kUserCourses/$courseId',
      );
      final data = res.data?['data'] as Map<String, dynamic>? ?? {};
      final raw = data['pendingPayment'] as Map<String, dynamic>?;
      return CoursePendingPayment.fromJson(raw);
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<EpisodePlayback> getPlayback(String courseId, String lessonId) async {
    try {
      // courseId kept for caller context; endpoint only needs lessonId.
      final res = await _dio.get<Map<String, dynamic>>(
        '$kUserEpisodes/$lessonId/playback',
      );
      final data = res.data?['data'] as Map<String, dynamic>? ?? {};
      return EpisodePlayback.fromJson(data);
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<void> postProgress(
    String episodeId, {
    int? watchedSeconds,
    int? deltaSeconds,
    bool? isCompleted,
    int? videoDuration,
  }) async {
    try {
      await _dio.post<Map<String, dynamic>>(
        '$kUserEpisodes/$episodeId/progress',
        data: {
          if (watchedSeconds != null) 'watchedSeconds': watchedSeconds,
          if (deltaSeconds != null) 'deltaSeconds': deltaSeconds,
          if (isCompleted != null) 'isCompleted': isCompleted,
          if (videoDuration != null) 'videoDuration': videoDuration,
        },
      );
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<void> markLessonComplete(
    String courseId,
    String lessonId, {
    int? watchedSeconds,
    bool isCompleted = true,
  }) async {
    try {
      await _dio.post<Map<String, dynamic>>(
        '$kUserEnrollments/$courseId/progress/$lessonId',
        data: {
          if (watchedSeconds != null) 'watchedSeconds': watchedSeconds,
          'isCompleted': isCompleted,
        },
      );
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<List<LessonProgress>> getLessonProgress(String courseId) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        '$kUserEnrollments/$courseId/progress',
      );
      final list = (res.data?['data'] as List<dynamic>?) ?? [];
      return list
          .cast<Map<String, dynamic>>()
          .map(LessonProgress.fromJson)
          .toList();
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<Map<String, dynamic>> submitQuiz(
      String courseId, String episodeId, Map<String, String> answers) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '$kUserCourses/$courseId/episodes/$episodeId/quiz',
        data: {'answers': answers},
      );
      return (res.data?['data'] as Map<String, dynamic>?) ?? {};
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  /// Backend responds `{ paymentId, paymentUrl }`. UI opens `paymentUrl`
  /// in the external browser so the user can complete payment.
  Future<CourseAccessRequest> requestAccess(String courseId) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '$kUserCourses/$courseId/request-access',
      );
      final data = res.data?['data'] as Map<String, dynamic>? ?? {};
      return CourseAccessRequest.fromJson(data);
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<void> enrollCourse(String courseId) async {
    try {
      await _dio.post<Map<String, dynamic>>(
        '$kUserCourses/$courseId/enroll',
      );
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<List<CourseEnrollment>> getEnrollments() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(kUserEnrollments);
      final list = (res.data?['data'] as List<dynamic>?) ?? [];
      return list
          .cast<Map<String, dynamic>>()
          .map(CourseEnrollment.fromJson)
          .toList();
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<CourseLeaderboard> getLeaderboard(String courseId) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        '$kUserCourses/$courseId/leaderboard',
      );
      final data = res.data?['data'] as Map<String, dynamic>? ?? {};
      return CourseLeaderboard.fromJson(data);
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<List<EarnedBadge>> getBadges() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(kUserBadges);
      final list = (res.data?['data'] as List<dynamic>?) ?? [];
      return list
          .cast<Map<String, dynamic>>()
          .map(EarnedBadge.fromJson)
          .toList();
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<CertEligibility> getCertificateEligibility(String courseId) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        '$kUserCourses/$courseId/certificate-eligibility',
      );
      final data = res.data?['data'] as Map<String, dynamic>? ?? {};
      return CertEligibility.fromJson(data);
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  // Returns the URL to open — backend streams a PDF.
  String getCertificateUrl(String courseId) =>
      '$kApiBaseUrl$kUserCourses/$courseId/certificate';

  /// Streams the certificate PDF via Dio (cookies attached) and returns the
  /// raw bytes. Callers write it to a local file then hand off to open_filex.
  /// Necessary because the route requires JWT-cookie auth — an external
  /// browser launch would 401.
  Future<List<int>> downloadCertificate(String courseId) async {
    try {
      final res = await _dio.get<List<int>>(
        '$kUserCourses/$courseId/certificate',
        options: Options(
          responseType: ResponseType.bytes,
          headers: {'Accept': 'application/pdf'},
        ),
      );
      return res.data ?? const [];
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<CourseXp> getCourseXp(String courseId) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        '$kUserCourses/$courseId/xp',
      );
      final data = res.data?['data'] as Map<String, dynamic>? ?? {};
      return CourseXp.fromJson(data);
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  /// Aggregate every quiz question across every lesson in a course, for the
  /// Practice Arena (client-side retrieval practice). Reads raw quizData off
  /// the course detail response — the freezed Lesson model drops it.
  Future<List<Map<String, dynamic>>> getPracticeQuestions(String courseId) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        '$kUserCourses/$courseId',
      );
      final data = res.data?['data'] as Map<String, dynamic>? ?? {};
      final lessons = (data['lessons'] as List<dynamic>? ?? [])
          .cast<Map<String, dynamic>>();
      final out = <Map<String, dynamic>>[];
      for (final lesson in lessons) {
        final quiz = lesson['quizData'];
        if (quiz is Map<String, dynamic>) {
          final qs = quiz['questions'];
          if (qs is List) {
            for (final q in qs) {
              if (q is Map<String, dynamic>) {
                out.add({
                  ...q,
                  '_lessonTitle': lesson['title'] ?? '',
                });
              }
            }
          }
        }
      }
      return out;
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<List<EpisodeResource>> getEpisodeResources(String episodeId) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        '$kUserEpisodes/$episodeId/resources',
      );
      final list = (res.data?['data'] as List<dynamic>?) ?? [];
      return list.cast<Map<String, dynamic>>().map(EpisodeResource.fromJson).toList();
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<List<EpisodeTask>> getEpisodeTasks(String episodeId) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        '$kUserEpisodes/$episodeId/tasks',
      );
      final list = (res.data?['data'] as List<dynamic>?) ?? [];
      return list.cast<Map<String, dynamic>>().map(EpisodeTask.fromJson).toList();
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }
}

final coursesServiceProvider = Provider<CoursesService>(
  (ref) => CoursesService(ref.watch(dioProvider)),
);
