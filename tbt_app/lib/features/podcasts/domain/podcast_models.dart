// Plain-data models for the podcasts feature.
//
// Hand-written classes (no Freezed) — matches ai_content/ pattern.
// Every JSON key mirrors the backend Prisma model camelCase output.

class PodcastCategory {
  const PodcastCategory({
    required this.id,
    required this.name,
    required this.slug,
    required this.status,
    required this.sortOrder,
  });

  final String id;
  final String name;
  final String slug;
  final String status;
  final int sortOrder;

  factory PodcastCategory.fromJson(Map<String, dynamic> json) => PodcastCategory(
        id: json['id'] as String,
        name: json['name'] as String,
        slug: json['slug'] as String,
        status: (json['status'] as String?) ?? 'active',
        sortOrder: (json['sortOrder'] as int?) ?? 0,
      );
}

class PodcastSeries {
  const PodcastSeries({
    required this.id,
    required this.title,
    required this.slug,
    required this.status,
    required this.sortOrder,
    this.description,
    this.coverImage,
    this.episodesCount,
  });

  final String id;
  final String title;
  final String slug;
  final String? description;
  final String? coverImage;
  final String status;
  final int sortOrder;
  final int? episodesCount;

  factory PodcastSeries.fromJson(Map<String, dynamic> json) => PodcastSeries(
        id: json['id'] as String,
        title: json['title'] as String,
        slug: json['slug'] as String,
        description: json['description'] as String?,
        coverImage: json['coverImage'] as String?,
        status: (json['status'] as String?) ?? 'active',
        sortOrder: (json['sortOrder'] as int?) ?? 0,
        episodesCount: json['episodesCount'] as int?,
      );
}

class PodcastEpisode {
  const PodcastEpisode({
    required this.id,
    required this.title,
    required this.slug,
    required this.audioUrl,
    required this.durationSeconds,
    required this.tags,
    required this.isFeatured,
    required this.status,
    required this.publishDate,
    this.description,
    this.categoryId,
    this.seriesId,
    this.coverImage,
    this.speaker,
    this.category,
    this.series,
    this.progress,
  });

  final String id;
  final String title;
  final String slug;
  final String? description;
  final String? categoryId;
  final String? seriesId;
  final String? coverImage;
  final String audioUrl;
  final int durationSeconds;
  final String? speaker;
  final List<String> tags;
  final bool isFeatured;
  final String status;
  final DateTime publishDate;
  final PodcastCategoryRef? category;
  final PodcastSeriesRef? series;
  final PodcastProgress? progress;

  factory PodcastEpisode.fromJson(Map<String, dynamic> json) => PodcastEpisode(
        id: json['id'] as String,
        title: json['title'] as String,
        slug: json['slug'] as String,
        description: json['description'] as String?,
        categoryId: json['categoryId'] as String?,
        seriesId: json['seriesId'] as String?,
        coverImage: json['coverImage'] as String?,
        audioUrl: json['audioUrl'] as String,
        durationSeconds: (json['durationSeconds'] as int?) ?? 0,
        speaker: json['speaker'] as String?,
        tags: (json['tags'] as List<dynamic>?)?.cast<String>() ?? const [],
        isFeatured: (json['isFeatured'] as bool?) ?? false,
        status: (json['status'] as String?) ?? 'active',
        publishDate: DateTime.parse(json['publishDate'] as String),
        category: json['category'] != null
            ? PodcastCategoryRef.fromJson(json['category'] as Map<String, dynamic>)
            : null,
        series: json['series'] != null
            ? PodcastSeriesRef.fromJson(json['series'] as Map<String, dynamic>)
            : null,
        progress: json['progress'] != null
            ? PodcastProgress.fromJson(json['progress'] as Map<String, dynamic>)
            : null,
      );
}

class PodcastCategoryRef {
  const PodcastCategoryRef({required this.id, required this.name, required this.slug});
  final String id;
  final String name;
  final String slug;
  factory PodcastCategoryRef.fromJson(Map<String, dynamic> j) => PodcastCategoryRef(
        id: j['id'] as String,
        name: j['name'] as String,
        slug: j['slug'] as String,
      );
}

class PodcastSeriesRef {
  const PodcastSeriesRef({required this.id, required this.title, required this.slug});
  final String id;
  final String title;
  final String slug;
  factory PodcastSeriesRef.fromJson(Map<String, dynamic> j) => PodcastSeriesRef(
        id: j['id'] as String,
        title: j['title'] as String,
        slug: j['slug'] as String,
      );
}

class PodcastProgress {
  const PodcastProgress({
    required this.currentPositionSeconds,
    required this.totalDurationSeconds,
    required this.completed,
    required this.updatedAt,
  });
  final int currentPositionSeconds;
  final int totalDurationSeconds;
  final bool completed;
  final DateTime updatedAt;
  factory PodcastProgress.fromJson(Map<String, dynamic> j) => PodcastProgress(
        currentPositionSeconds: (j['currentPositionSeconds'] as int?) ?? 0,
        totalDurationSeconds: (j['totalDurationSeconds'] as int?) ?? 0,
        completed: (j['completed'] as bool?) ?? false,
        updatedAt: DateTime.parse(j['updatedAt'] as String),
      );
}

/// One entry from GET /continue-listening — a progress row joined to
/// its episode.
class ContinueListeningItem {
  const ContinueListeningItem({
    required this.progress,
    required this.episode,
  });
  final PodcastProgress progress;
  final PodcastEpisode episode;

  factory ContinueListeningItem.fromJson(Map<String, dynamic> j) => ContinueListeningItem(
        progress: PodcastProgress.fromJson(j),
        episode: PodcastEpisode.fromJson(j['episode'] as Map<String, dynamic>),
      );
}
