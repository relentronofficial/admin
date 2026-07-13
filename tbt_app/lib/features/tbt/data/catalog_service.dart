import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/api.dart';
import '../../../shared/api/dio_client.dart';
import '../../../shared/api/dio_provider.dart';
import '../../../shared/models/content_section.dart';

// ── Models ────────────────────────────────────────────────────────────────────

class HeroSlide {
  final String id;
  final String title;
  final String? description;
  final String? bgImageUrl;
  final String? bgVideoUrl;
  final bool bgMuteDefault;
  final String ctaLabel;
  final String ctaUrl;
  final String ctaType;
  final String? badgeText;

  const HeroSlide({
    required this.id,
    required this.title,
    this.description,
    this.bgImageUrl,
    this.bgVideoUrl,
    required this.bgMuteDefault,
    required this.ctaLabel,
    required this.ctaUrl,
    required this.ctaType,
    this.badgeText,
  });

  factory HeroSlide.fromJson(Map<String, dynamic> j) => HeroSlide(
        id: j['id'] as String,
        title: j['title'] as String,
        description: j['description'] as String?,
        bgImageUrl: j['bgImageUrl'] as String?,
        bgVideoUrl: j['bgVideoUrl'] as String?,
        bgMuteDefault: j['bgMuteDefault'] as bool? ?? true,
        ctaLabel: j['ctaLabel'] as String? ?? '',
        ctaUrl: j['ctaUrl'] as String? ?? '',
        ctaType: j['ctaType'] as String? ?? 'internal',
        badgeText: j['badgeText'] as String?,
      );
}

class HeroData {
  final List<HeroSlide> slides;
  final int autoPlayIntervalMs;

  const HeroData({required this.slides, required this.autoPlayIntervalMs});

  factory HeroData.fromJson(Map<String, dynamic> j) => HeroData(
        slides: (j['slides'] as List<dynamic>? ?? [])
            .map((e) => HeroSlide.fromJson(e as Map<String, dynamic>))
            .toList(),
        autoPlayIntervalMs: j['autoPlayIntervalMs'] as int? ?? 5000,
      );
}

// ── Service ───────────────────────────────────────────────────────────────────

class CatalogService {
  const CatalogService(this._dio);
  final Dio _dio;

  Future<HeroData> getHeroContent() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(kUserHomeHero);
      final data = res.data?['data'] as Map<String, dynamic>? ?? {};
      return HeroData.fromJson(data);
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<List<ContentSection>> getHomeSections() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(kUserHomeSections);
      final list = res.data?['data']?['sections'] as List<dynamic>? ?? [];
      return list
          .map((e) => ContentSection.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }
}

final catalogServiceProvider = Provider<CatalogService>(
  (ref) => CatalogService(ref.watch(dioProvider)),
);
