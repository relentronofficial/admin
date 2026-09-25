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

class EpisodeTaskSubmission {
  const EpisodeTaskSubmission({
    required this.id,
    required this.status,
    this.feedback,
    this.responseValue,
    this.proofUrl,
    this.proofType,
  });
  final String id;
  final String status; // pending | approved | rejected | resubmission_required
  final String? feedback;
  final String? responseValue;
  final String? proofUrl;
  final String? proofType;

  factory EpisodeTaskSubmission.fromJson(Map<String, dynamic> j) =>
      EpisodeTaskSubmission(
        id: j['id'] as String,
        status: j['status'] as String? ?? 'pending',
        feedback: j['feedback'] as String?,
        responseValue: j['responseValue'] as String?,
        proofUrl: j['proofUrl'] as String?,
        proofType: j['proofType'] as String?,
      );
}

class EpisodeTask {
  const EpisodeTask({
    required this.id,
    required this.title,
    this.description,
    this.deliverables,
    this.estimatedMinutes,
    this.basePoints,
    this.proofType,
    this.completionMode = 'ADMIN_CHECK',
    this.submission,
  });
  final String id;
  final String title;
  final String? description;
  final String? deliverables;
  final int? estimatedMinutes;
  final int? basePoints;
  final String? proofType; // watch | text | link | video | image | file
  final String completionMode; // SELF_ASSESSMENT | ADMIN_CHECK
  final EpisodeTaskSubmission? submission;

  factory EpisodeTask.fromJson(Map<String, dynamic> j) => EpisodeTask(
        id: j['id'] as String,
        title: j['title'] as String? ?? '',
        description: j['description'] as String?,
        deliverables: j['deliverables'] as String?,
        estimatedMinutes: (j['estimatedMinutes'] as num?)?.toInt(),
        basePoints: (j['basePoints'] as num?)?.toInt(),
        proofType: j['proofType'] as String?,
        completionMode: j['completionMode'] as String? ?? 'ADMIN_CHECK',
        submission: j['submission'] != null
            ? EpisodeTaskSubmission.fromJson(
                j['submission'] as Map<String, dynamic>)
            : null,
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

class RazorpayOrderResult {
  const RazorpayOrderResult({
    required this.orderId,
    required this.amount,
    required this.currency,
    required this.keyId,
    required this.paymentRecordId,
  });
  final String orderId;
  final int amount;
  final String currency;
  final String keyId;
  final String paymentRecordId;

  factory RazorpayOrderResult.fromJson(Map<String, dynamic> json) =>
      RazorpayOrderResult(
        orderId: json['orderId'] as String,
        amount: (json['amount'] as num).toInt(),
        currency: json['currency'] as String? ?? 'INR',
        keyId: json['keyId'] as String,
        paymentRecordId: json['paymentRecordId'] as String,
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
  CoursesService(this._dio);
  final Dio _dio;

  // Raw response cache keyed by courseId. Populated by getCourseDetail() so
  // companion providers (sections, pendingPayment) can extract their fields
  // without issuing a second network request.
  final Map<String, Map<String, dynamic>> _detailCache = {};

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
      _detailCache[courseId] = data;
      return CourseDetail.fromJson(data);
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  // Extracts sections from the cached detail response — no extra network call.
  // Always call after courseDetailProvider has resolved (cache is guaranteed populated).
  List<Map<String, dynamic>> getCourseSectionsFromDetail(String courseId) {
    final data = _detailCache[courseId];
    if (data == null) return [];
    final raw = data['sections'] as List<dynamic>? ?? [];
    return raw.cast<Map<String, dynamic>>();
  }

  // Companion fetch for sections — same build_runner workaround as pending payment.
  Future<List<Map<String, dynamic>>> getCourseSections(String courseId) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>('$kUserCourses/$courseId');
      final data = res.data?['data'] as Map<String, dynamic>? ?? {};
      final raw = data['sections'] as List<dynamic>? ?? [];
      return raw.cast<Map<String, dynamic>>();
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

  /// Aggregate quiz questions from completed lessons only, for the Practice
  /// Arena. Only lessons whose IDs appear in [completedLessonIds] are
  /// included — prevents spoiling content from lessons not yet watched.
  Future<List<Map<String, dynamic>>> getPracticeQuestions(
    String courseId, {
    required Set<String> completedLessonIds,
  }) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        '$kUserCourses/$courseId',
      );
      final data = res.data?['data'] as Map<String, dynamic>? ?? {};
      final lessons = (data['lessons'] as List<dynamic>? ?? [])
          .cast<Map<String, dynamic>>();
      final out = <Map<String, dynamic>>[];
      for (final lesson in lessons) {
        final lessonId = lesson['id'] as String? ?? '';
        if (!completedLessonIds.contains(lessonId)) continue;
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

  Future<void> saveReflection(
      String courseId, String lessonId, String text) async {
    try {
      await _dio.put<void>(
        '$kUserCourses/$courseId/reflections/$lessonId',
        data: {'text': text},
      );
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

  Future<void> submitEpisodeTask(
    String episodeId,
    String taskId, {
    String? responseValue,
    String? proofUrl,
    String? proofType,
  }) async {
    try {
      await _dio.post<Map<String, dynamic>>(
        '$kUserEpisodes/$episodeId/tasks/$taskId/submit',
        data: {
          if (responseValue != null) 'responseValue': responseValue,
          if (proofUrl != null) 'proofUrl': proofUrl,
          if (proofType != null) 'proofType': proofType,
        },
      );
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  /// Uploads a file via the backend server-side upload endpoint (no CORS/R2
  /// presign needed). Returns the public URL of the uploaded file.
  Future<String> uploadEpisodeTaskProof(
    String episodeId,
    String taskId,
    String filename,
    String contentType,
    List<int> bytes,
  ) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '/api/upload/image?pathPrefix=task-proofs%2F$episodeId%2F$taskId&filename=${Uri.encodeComponent(filename)}',
        data: bytes,
        options: Options(headers: {'Content-Type': contentType}),
      );
      final data = res.data ?? {};
      final url = (data['data'] as Map<String, dynamic>?)?['publicUrl'] as String?
          ?? data['publicUrl'] as String?
          ?? '';
      if (url.isEmpty) throw Exception('Upload failed: no public URL returned');
      return url;
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<List<VideoFeedbackQuestion>> getVideoFeedbackQuestions(
    String episodeId, {
    String episodeType = 'course',
  }) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        '/api/video-feedback/episodes/$episodeId/questions',
        queryParameters: {'episodeType': episodeType},
      );
      final list = (res.data?['data'] as List<dynamic>?) ?? [];
      return list
          .cast<Map<String, dynamic>>()
          .map(VideoFeedbackQuestion.fromJson)
          .toList();
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<void> submitVideoFeedback(
    String episodeId,
    List<VideoFeedbackResponse> responses, {
    String episodeType = 'course',
  }) async {
    try {
      await _dio.post<void>(
        '/api/video-feedback/episodes/$episodeId/responses',
        data: {
          'episodeType': episodeType,
          'responses': responses.map((r) => r.toJson()).toList(),
        },
      );
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  // ── Psychometric Assessment ────────────────────────────────────────────────
  Future<List<PsychometricQuestion>> getPsychometricQuestions() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(kUserPsychometricQuestions);
      final list = (res.data?['data'] as List<dynamic>?) ?? [];
      return list.cast<Map<String, dynamic>>().map(PsychometricQuestion.fromJson).toList();
    } on DioException catch (e) { throw mapDioError(e); }
  }

  Future<PsychometricResponse> submitPsychometric(Map<String, String> answers) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        kUserPsychometricSubmit,
        data: {'answers': answers},
      );
      return PsychometricResponse.fromJson(res.data?['data'] as Map<String, dynamic>? ?? {});
    } on DioException catch (e) { throw mapDioError(e); }
  }

  Future<PsychometricResponse?> getMyPsychometricResult() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(kUserPsychometricResult);
      final data = res.data?['data'];
      if (data == null) return null;
      return PsychometricResponse.fromJson(data as Map<String, dynamic>);
    } on DioException catch (e) { throw mapDioError(e); }
  }

  // ── Lesson 1–10 rating ────────────────────────────────────────────────────
  Future<void> saveLessonFeedback(String courseId, String lessonId, int rating, {String? feedbackText}) async {
    try {
      await _dio.put<void>(
        '$kUserCourses/$courseId/lesson-feedback',
        data: {
          'lessonId': lessonId,
          'rating': rating,
          if (feedbackText != null && feedbackText.isNotEmpty) 'feedbackText': feedbackText,
        },
      );
    } on DioException catch (e) { throw mapDioError(e); }
  }

  // ── Course module tabs ────────────────────────────────────────────────────
  Future<List<Map<String, dynamic>>> getCourseModuleTabs() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(kUserCourseModuleTabs);
      final list = (res.data?['data'] as List<dynamic>?) ?? [];
      return list.cast<Map<String, dynamic>>();
    } on DioException catch (e) { throw mapDioError(e); }
  }

  Future<List<Course>> listCoursesByModule(String module, {String? search}) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        kUserCourses,
        queryParameters: {
          'module': module,
          if (search != null && search.isNotEmpty) 'search': search,
        },
      );
      final list = (res.data?['data'] as List<dynamic>?) ?? [];
      return list.cast<Map<String, dynamic>>().map(Course.fromJson).toList();
    } on DioException catch (e) { throw mapDioError(e); }
  }

  Future<RazorpayOrderResult> createRazorpayOrder(String courseId) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '$kUserCourses/$courseId/razorpay/create-order',
      );
      final data = res.data?['data'] as Map<String, dynamic>? ?? {};
      return RazorpayOrderResult.fromJson(data);
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<void> verifyRazorpayPayment({
    required String courseId,
    required String razorpayOrderId,
    required String razorpayPaymentId,
    required String razorpaySignature,
    required String paymentRecordId,
  }) async {
    try {
      await _dio.post<Map<String, dynamic>>(
        '$kUserCourses/$courseId/razorpay/verify',
        data: {
          'razorpayOrderId': razorpayOrderId,
          'razorpayPaymentId': razorpayPaymentId,
          'razorpaySignature': razorpaySignature,
          'paymentRecordId': paymentRecordId,
        },
      );
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }
}

class VideoFeedbackQuestion {
  const VideoFeedbackQuestion({
    required this.id,
    required this.questionText,
    required this.questionType,
  });
  final String id;
  final String questionText;
  final String questionType; // 'rating' or 'yes_no'

  factory VideoFeedbackQuestion.fromJson(Map<String, dynamic> j) =>
      VideoFeedbackQuestion(
        id: j['id'] as String,
        questionText: j['questionText'] as String? ?? '',
        questionType: j['questionType'] as String? ?? 'rating',
      );
}

class VideoFeedbackResponse {
  const VideoFeedbackResponse({
    required this.questionId,
    this.ratingValue,
    this.yesNoValue,
  });
  final String questionId;
  final int? ratingValue;
  final bool? yesNoValue;

  Map<String, dynamic> toJson() => {
        'questionId': questionId,
        if (ratingValue != null) 'ratingValue': ratingValue,
        if (yesNoValue != null) 'yesNoValue': yesNoValue,
      };
}

// ── Psychometric Assessment models ────────────────────────────────────────────

class PsychometricOption {
  const PsychometricOption({required this.id, required this.text, required this.score});
  final String id;
  final String text;
  final int score;
  factory PsychometricOption.fromJson(Map<String, dynamic> j) => PsychometricOption(
    id: j['id'] as String,
    text: j['text'] as String? ?? '',
    score: (j['score'] as num?)?.toInt() ?? 0,
  );
}

class PsychometricQuestion {
  const PsychometricQuestion({required this.id, required this.questionText, required this.category, required this.options});
  final String id;
  final String questionText;
  final String category;
  final List<PsychometricOption> options;
  factory PsychometricQuestion.fromJson(Map<String, dynamic> j) => PsychometricQuestion(
    id: j['id'] as String,
    questionText: j['questionText'] as String? ?? '',
    category: j['category'] as String? ?? '',
    options: ((j['options'] as List<dynamic>?) ?? []).cast<Map<String, dynamic>>().map(PsychometricOption.fromJson).toList(),
  );
}

class PsychometricCategoryResult {
  const PsychometricCategoryResult({required this.name, required this.score, required this.max, required this.percentage, required this.label});
  final String name;
  final int score;
  final int max;
  final int percentage;
  final String label;
  factory PsychometricCategoryResult.fromJson(Map<String, dynamic> j) => PsychometricCategoryResult(
    name: j['name'] as String? ?? '',
    score: (j['score'] as num?)?.toInt() ?? 0,
    max: (j['max'] as num?)?.toInt() ?? 0,
    percentage: (j['percentage'] as num?)?.toInt() ?? 0,
    label: j['label'] as String? ?? '',
  );
}

class PsychometricResults {
  const PsychometricResults({required this.categories, required this.overallPercentage, required this.overallLabel, required this.recommendation});
  final List<PsychometricCategoryResult> categories;
  final int overallPercentage;
  final String overallLabel;
  final String recommendation;
  factory PsychometricResults.fromJson(Map<String, dynamic> j) => PsychometricResults(
    categories: ((j['categories'] as List<dynamic>?) ?? []).cast<Map<String, dynamic>>().map(PsychometricCategoryResult.fromJson).toList(),
    overallPercentage: (j['overallPercentage'] as num?)?.toInt() ?? 0,
    overallLabel: j['overallLabel'] as String? ?? '',
    recommendation: j['recommendation'] as String? ?? '',
  );
}

class PsychometricResponse {
  const PsychometricResponse({required this.id, required this.results, required this.createdAt});
  final String id;
  final PsychometricResults results;
  final String createdAt;
  factory PsychometricResponse.fromJson(Map<String, dynamic> j) => PsychometricResponse(
    id: j['id'] as String? ?? '',
    results: PsychometricResults.fromJson(j['results'] as Map<String, dynamic>? ?? {}),
    createdAt: j['createdAt'] as String? ?? '',
  );
}

final coursesServiceProvider = Provider<CoursesService>(
  (ref) => CoursesService(ref.watch(dioProvider)),
);
