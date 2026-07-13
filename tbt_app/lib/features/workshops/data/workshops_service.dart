import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/api.dart';
import '../../../core/exceptions/app_exception.dart';
import '../../../shared/api/dio_client.dart';
import '../../../shared/api/dio_provider.dart';
import '../../../shared/models/workshop.dart';

class WorkshopsService {
  const WorkshopsService(this._dio);
  final Dio _dio;

  Future<List<Workshop>> listWorkshops({
    int? page,
    int? limit,
    String? search,
  }) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        kWorkshops,
        queryParameters: {
          if (page != null) 'page': page,
          if (limit != null) 'limit': limit,
          if (search != null && search.isNotEmpty) 'search': search,
        },
      );
      final list = (res.data?['data'] as List<dynamic>?) ?? [];
      return list.cast<Map<String, dynamic>>().map(Workshop.fromJson).toList();
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<WorkshopDetail> getWorkshopDetail(String slug) async {
    Map<String, dynamic>? data;
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        '$kWorkshops/$slug/detail',
      );
      data = res.data?['data'] as Map<String, dynamic>? ?? {};
    } on DioException catch (e) {
      throw mapDioError(e);
    }
    try {
      return WorkshopDetail.fromJson(data);
    } catch (e) {
      // Freezed throws a raw TypeError when a required field is missing or
      // a nested field has an unexpected type. Rewrap as an AppException so
      // the UI can surface a real message instead of a generic fallback.
      throw ServerException('Workshop detail parse error: $e');
    }
  }

  // Returns updated enrollmentStatus ('pending' | 'active').
  Future<String?> requestAccess(String slug) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '$kWorkshops/$slug/request-access',
      );
      final data = res.data?['data'] as Map<String, dynamic>? ?? {};
      return data['enrollmentStatus'] as String?;
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<List<FlowItem>> getWorkshopFlow(String slug) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        '$kWorkshops/$slug/flow',
      );
      final list =
          (res.data?['data']?['flowItems'] as List<dynamic>?) ?? [];
      return list
          .cast<Map<String, dynamic>>()
          .map(FlowItem.fromJson)
          .toList();
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<WorkshopQaData> getWorkshopQa(String slug,
      {int page = 1, int limit = 20}) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        '$kWorkshops/$slug/qa',
        queryParameters: {'page': page, 'limit': limit},
      );
      final data = res.data?['data'] as Map<String, dynamic>? ?? {};
      return WorkshopQaData.fromJson(data);
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<void> postWorkshopQuestion(String slug, String questionText) async {
    try {
      await _dio.post<Map<String, dynamic>>(
        '$kWorkshops/$slug/qa',
        data: {'questionText': questionText},
      );
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<void> postQaReply(String postId, String replyText) async {
    try {
      await _dio.post<Map<String, dynamic>>(
        '$kUserQa/$postId/reply',
        data: {'replyText': replyText},
      );
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<List<AssignmentGroup>> getWorkshopAssignments(String slug) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        '$kWorkshops/$slug/assignments',
      );
      final list =
          (res.data?['data']?['groups'] as List<dynamic>?) ?? [];
      return list
          .cast<Map<String, dynamic>>()
          .map(AssignmentGroup.fromJson)
          .toList();
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  // Returns { uploadUrl, publicUrl } for generic file uploads (docs, pdfs, videos).
  Future<Map<String, String>> getAssignmentFilePresign(
      String filename, String contentType) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        kUserAssignmentsFilePresign,
        data: {'filename': filename, 'contentType': contentType},
      );
      final data = res.data?['data'] as Map<String, dynamic>? ?? {};
      return {
        'uploadUrl': data['uploadUrl'] as String? ?? '',
        'publicUrl': data['publicUrl'] as String? ?? '',
      };
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  // Returns { uploadUrl, publicUrl } for assignment image uploads
  // (`image_upload` type — routed to a dedicated bucket/path server-side).
  Future<Map<String, String>> getAssignmentImagePresign(
      String filename, String contentType) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        kUserAssignmentsImagePresign,
        data: {'filename': filename, 'contentType': contentType},
      );
      final data = res.data?['data'] as Map<String, dynamic>? ?? {};
      return {
        'uploadUrl': data['uploadUrl'] as String? ?? '',
        'publicUrl': data['publicUrl'] as String? ?? '',
      };
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  // Submit an assignment with any combination of answerText / imageUrl /
  // fileUrl / videoUrl — matches the web `useSubmitAssignment` payload shape.
  Future<void> submitAssignment(
    String assignmentId, {
    String? answerText,
    String? imageUrl,
    String? fileUrl,
    String? videoUrl,
  }) async {
    try {
      await _dio.post<Map<String, dynamic>>(
        '$kUserAssignments/$assignmentId/submit',
        data: {
          if (answerText != null && answerText.isNotEmpty)
            'answerText': answerText,
          if (imageUrl != null && imageUrl.isNotEmpty) 'imageUrl': imageUrl,
          if (fileUrl != null && fileUrl.isNotEmpty) 'fileUrl': fileUrl,
          if (videoUrl != null && videoUrl.isNotEmpty) 'videoUrl': videoUrl,
        },
      );
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  // ── Live call endpoints ─────────────────────────────────────────────────────
  //
  // Backend routes are `/api/user/workshop/live-calls/:id/*` — the previous
  // Flutter path `/api/user/workshops/:slug/live-calls/:callId/*` was 404'ing.
  // All routes take just the liveCallId (no workshop slug).

  static String _liveBase(String callId) =>
      '/api/user/workshop/live-calls/$callId';

  /// Fetches the LiveKit WS URL + participant token for a live call.
  /// `callId` is enough on its own — the slug argument used to be required
  /// by the old (wrong) route but is no longer needed. Kept as an optional
  /// positional param so existing call sites still compile.
  // The optional second arg is a legacy slug — unused now the endpoint no
  // longer takes it, but kept so old call sites still compile.
  // ignore: unused_element
  Future<LiveCallToken> getLiveCallToken(String callId,
      [String? legacySlug]) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '${_liveBase(callId)}/token',
      );
      final data = res.data?['data'] as Map<String, dynamic>? ?? {};
      return LiveCallToken.fromJson(data);
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<LiveCallToken> refreshLiveCallToken(String callId) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '${_liveBase(callId)}/token/refresh',
      );
      final data = res.data?['data'] as Map<String, dynamic>? ?? {};
      return LiveCallToken.fromJson(data);
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<LiveCallStatus> getLiveCallStatus(String callId) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        '${_liveBase(callId)}/status',
      );
      final data = res.data?['data'] as Map<String, dynamic>? ?? {};
      return LiveCallStatus.fromJson(data);
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<String?> getRsvpStatus(String callId) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        '${_liveBase(callId)}/rsvp',
      );
      final data = res.data?['data'] as Map<String, dynamic>? ?? {};
      return data['status'] as String?;
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<void> upsertRsvp(String callId, String status) async {
    try {
      await _dio.post<Map<String, dynamic>>(
        '${_liveBase(callId)}/rsvp',
        data: {'status': status},
      );
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<List<Map<String, dynamic>>> getLiveCallResources(String callId) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        '${_liveBase(callId)}/resources',
      );
      final list = (res.data?['data'] as List<dynamic>?) ?? [];
      return list.cast<Map<String, dynamic>>();
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<List<Map<String, dynamic>>> getLiveCallPolls(String callId) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        '${_liveBase(callId)}/polls',
      );
      final list = (res.data?['data'] as List<dynamic>?) ?? [];
      return list.cast<Map<String, dynamic>>();
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<void> votePoll(String pollId, String optionId) async {
    try {
      await _dio.post<Map<String, dynamic>>(
        '/api/user/workshop/live-calls/polls/$pollId/vote',
        data: {'optionId': optionId},
      );
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<List<Map<String, dynamic>>> getLiveCallQuestions(String callId) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        '${_liveBase(callId)}/questions',
      );
      final list = (res.data?['data'] as List<dynamic>?) ?? [];
      return list.cast<Map<String, dynamic>>();
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<void> postLiveCallQuestion(String callId, String questionText) async {
    try {
      await _dio.post<Map<String, dynamic>>(
        '${_liveBase(callId)}/questions',
        data: {'questionText': questionText},
      );
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<List<Map<String, dynamic>>> getLiveCallChapters(String callId) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        '${_liveBase(callId)}/chapters',
      );
      final list = (res.data?['data'] as List<dynamic>?) ?? [];
      return list.cast<Map<String, dynamic>>();
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<Map<String, dynamic>?> getMyLiveCallFeedback(String callId) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        '${_liveBase(callId)}/feedback',
      );
      return res.data?['data'] as Map<String, dynamic>?;
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<void> postLiveCallFeedback(
    String callId, {
    required int rating,
    String? comment,
  }) async {
    try {
      await _dio.post<Map<String, dynamic>>(
        '${_liveBase(callId)}/feedback',
        data: {
          'rating': rating,
          if (comment != null && comment.isNotEmpty) 'comment': comment,
        },
      );
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  /// Streams the attendance certificate PDF via Dio (cookies attached).
  /// Callers write to a local file then hand off to open_filex.
  Future<List<int>> downloadLiveCallCertificate(String callId) async {
    try {
      final res = await _dio.get<List<int>>(
        '${_liveBase(callId)}/certificate',
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

  // ── Episode playback + progress ─────────────────────────────────────────────
  // Same underlying endpoint as courses — `/api/user/episodes/:id/playback` is
  // context-agnostic. Workshop episodes use it too.
  Future<Map<String, dynamic>> getEpisodePlayback(String episodeId) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        '/api/user/episodes/$episodeId/playback',
      );
      return (res.data?['data'] as Map<String, dynamic>?) ?? {};
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<void> postEpisodeProgress(
    String episodeId, {
    int? watchedSeconds,
    int? deltaSeconds,
    bool? isCompleted,
    int? reportedDuration,
  }) async {
    try {
      await _dio.post<Map<String, dynamic>>(
        '/api/user/episodes/$episodeId/progress',
        data: {
          if (watchedSeconds != null) 'watchedSeconds': watchedSeconds,
          if (deltaSeconds != null) 'deltaSeconds': deltaSeconds,
          if (isCompleted != null) 'isCompleted': isCompleted,
          if (reportedDuration != null) 'reportedDuration': reportedDuration,
        },
      );
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  // ── Challenges + episode completion ─────────────────────────────────────────

  Future<List<Map<String, dynamic>>> getWorkshopChallenges(String slug) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        '$kWorkshops/$slug/challenges',
      );
      final list = (res.data?['data'] as List<dynamic>?) ?? [];
      return list.cast<Map<String, dynamic>>();
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<void> completeChallenge(
    String challengeId, {
    Map<String, dynamic>? answersData,
  }) async {
    try {
      await _dio.post<Map<String, dynamic>>(
        '/api/user/challenges/$challengeId/complete',
        data: {if (answersData != null) 'answersData': answersData},
      );
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<void> completeWorkshopEpisode(
    String episodeId, {
    int? reportedDuration,
  }) async {
    try {
      await _dio.post<Map<String, dynamic>>(
        '/api/user/workshop-episodes/$episodeId/complete',
        data: {
          if (reportedDuration != null) 'reportedDuration': reportedDuration,
        },
      );
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  // ── Workshop certificate ────────────────────────────────────────────────────

  Future<Map<String, dynamic>> getWorkshopCertificateEligibility(
      String slug) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        '$kWorkshops/$slug/certificate',
      );
      return (res.data?['data'] as Map<String, dynamic>?) ?? {};
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<List<int>> downloadWorkshopCertificate(String slug) async {
    try {
      final res = await _dio.get<List<int>>(
        '$kWorkshops/$slug/certificate/download',
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
}

// ── Types ─────────────────────────────────────────────────────────────────────

class LiveCallToken {
  const LiveCallToken({
    required this.wsUrl,
    required this.token,
    this.roomName,
    this.isWebinar = false,
    this.startedAt,
  });

  final String wsUrl;
  final String token;
  final String? roomName;
  final bool isWebinar;
  final String? startedAt;

  factory LiveCallToken.fromJson(Map<String, dynamic> json) => LiveCallToken(
        wsUrl: (json['wsUrl'] as String?) ?? '',
        token: (json['token'] as String?) ?? '',
        roomName: json['roomName'] as String?,
        isWebinar: json['isWebinar'] as bool? ?? false,
        startedAt: json['startedAt'] as String?,
      );
}

class LiveCallStatus {
  const LiveCallStatus({
    required this.isLive,
    required this.participantCount,
    this.startedAt,
    this.endedAt,
  });

  final bool isLive;
  final int participantCount;
  final String? startedAt;
  final String? endedAt;

  factory LiveCallStatus.fromJson(Map<String, dynamic> json) => LiveCallStatus(
        isLive: json['isLive'] as bool? ?? false,
        participantCount: (json['participantCount'] as num?)?.toInt() ?? 0,
        startedAt: json['startedAt'] as String?,
        endedAt: json['endedAt'] as String?,
      );
}

final workshopsServiceProvider = Provider<WorkshopsService>(
  (ref) => WorkshopsService(ref.watch(dioProvider)),
);
