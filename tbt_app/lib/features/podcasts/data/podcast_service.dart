import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/api.dart';
import '../../../shared/api/dio_client.dart';
import '../../../shared/api/dio_provider.dart';
import '../domain/podcast_models.dart';

/// Client for `/api/podcasts/*` (member-facing). Cookie auth is
/// handled by the shared Dio interceptors — no per-call token wiring.
class PodcastService {
  const PodcastService(this._dio);
  final Dio _dio;

  Future<List<PodcastCategory>> listCategories() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(kPodcastCategories);
      final list = (res.data?['data'] as List<dynamic>?) ?? const [];
      return list.cast<Map<String, dynamic>>().map(PodcastCategory.fromJson).toList();
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  /// Paginated + filtered episode list. `category` is the *slug* to
  /// match the backend contract (not id).
  Future<({List<PodcastEpisode> episodes, int total, int page})> listEpisodes({
    int page = 1,
    int limit = 20,
    String? category,
    String? seriesId,
    String? search,
    bool featuredOnly = false,
  }) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        kPodcastEpisodes,
        queryParameters: {
          'page': page,
          'limit': limit,
          if (category != null && category.isNotEmpty) 'category': category,
          if (seriesId != null && seriesId.isNotEmpty) 'seriesId': seriesId,
          if (search != null && search.isNotEmpty) 'search': search,
          if (featuredOnly) 'featured': 'true',
        },
      );
      final list = (res.data?['data'] as List<dynamic>?) ?? const [];
      final meta = (res.data?['meta'] as Map<String, dynamic>?) ?? const {};
      return (
        episodes: list.cast<Map<String, dynamic>>().map(PodcastEpisode.fromJson).toList(),
        total: (meta['total'] as int?) ?? 0,
        page: (meta['page'] as int?) ?? page,
      );
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<PodcastEpisode> getEpisode(String id) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>('$kPodcastEpisodes/$id');
      return PodcastEpisode.fromJson(res.data?['data'] as Map<String, dynamic>);
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<List<PodcastSeries>> listFeaturedSeries() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(kPodcastSeries);
      final list = (res.data?['data'] as List<dynamic>?) ?? const [];
      return list.cast<Map<String, dynamic>>().map(PodcastSeries.fromJson).toList();
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<({PodcastSeries series, List<PodcastEpisode> episodes})> getSeries(String id) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>('$kPodcastSeries/$id');
      final data = (res.data?['data'] as Map<String, dynamic>?) ?? const {};
      final episodes = (data['episodes'] as List<dynamic>?) ?? const [];
      return (
        series: PodcastSeries.fromJson(data),
        episodes: episodes.cast<Map<String, dynamic>>().map(PodcastEpisode.fromJson).toList(),
      );
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<List<ContinueListeningItem>> continueListening() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(kPodcastContinueListening);
      final list = (res.data?['data'] as List<dynamic>?) ?? const [];
      return list.cast<Map<String, dynamic>>().map(ContinueListeningItem.fromJson).toList();
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<void> submitProgress({
    required String episodeId,
    required int currentPositionSeconds,
    required int totalDurationSeconds,
    bool completed = false,
  }) async {
    try {
      await _dio.post<dynamic>(kPodcastProgress, data: {
        'episodeId': episodeId,
        'currentPositionSeconds': currentPositionSeconds,
        'totalDurationSeconds': totalDurationSeconds,
        'completed': completed,
      });
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<void> markCompleted({
    required String episodeId,
    int? totalDurationSeconds,
  }) async {
    try {
      await _dio.post<dynamic>(kPodcastMarkCompleted, data: {
        'episodeId': episodeId,
        if (totalDurationSeconds != null) 'totalDurationSeconds': totalDurationSeconds,
      });
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }
}

final podcastServiceProvider = Provider<PodcastService>(
  (ref) => PodcastService(ref.watch(dioProvider)),
);
