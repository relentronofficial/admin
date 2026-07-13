import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/api.dart';
import '../../../shared/api/dio_client.dart';
import '../../../shared/api/dio_provider.dart';

// ── Model ─────────────────────────────────────────────────────────────────────

class AppResource {
  final String id;
  final String title;
  final String? description;
  final String? author;
  final String? date;
  final String fileType;
  final int fileCount;
  final bool locked;
  final String? previewUrl;

  const AppResource({
    required this.id,
    required this.title,
    this.description,
    this.author,
    this.date,
    required this.fileType,
    required this.fileCount,
    required this.locked,
    this.previewUrl,
  });

  factory AppResource.fromJson(Map<String, dynamic> j) => AppResource(
        id: j['id'] as String,
        title: j['title'] as String,
        description: j['description'] as String?,
        author: j['author'] as String?,
        date: j['date'] as String?,
        fileType: j['fileType'] as String? ?? 'file',
        fileCount: j['fileCount'] as int? ?? 1,
        locked: j['locked'] as bool? ?? false,
        previewUrl: j['previewUrl'] as String?,
      );
}

// ── Service ───────────────────────────────────────────────────────────────────

class ResourcesFeatureService {
  const ResourcesFeatureService(this._dio);
  final Dio _dio;

  Future<List<AppResource>> listResources({
    String? search,
    int page = 1,
    int limit = 30,
  }) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        kUserResources,
        queryParameters: {
          if (search != null && search.isNotEmpty) 'search': search,
          'page': page,
          'limit': limit,
        },
      );
      final list =
          res.data?['data']?['resources'] as List<dynamic>? ?? [];
      return list
          .map((e) => AppResource.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<String> getDownloadUrl(String resourceId) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        '$kUserResources/$resourceId/download',
      );
      return res.data?['data']?['downloadUrl'] as String? ?? '';
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }
}

final resourcesFeatureServiceProvider = Provider<ResourcesFeatureService>(
  (ref) => ResourcesFeatureService(ref.watch(dioProvider)),
);
