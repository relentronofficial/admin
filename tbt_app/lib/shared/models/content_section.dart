import 'package:freezed_annotation/freezed_annotation.dart';

part 'content_section.freezed.dart';

// ── CatalogItemType ───────────────────────────────────────────────────────────
//
// Discriminator required by the migration plan (§12 CC-44).
// Every item in a catalog section resolves to exactly one of:
//   • workshop   — routed to /workshops/:slug
//   • course     — routed to /learning/:courseId
//   • resource   — external playUrl or fallback (no dedicated route)

enum CatalogItemType {
  workshop,
  course,
  resource,
}

// ── CatalogItem ───────────────────────────────────────────────────────────────

@Freezed(fromJson: false, toJson: false)
class CatalogItem with _$CatalogItem {
  const factory CatalogItem({
    required String id,
    required String title,
    required CatalogItemType type,
    String? thumbnailUrl,
    String? categoryTag,
    @Default(false) bool isLocked,
    String? lockBadgeText,
    String? playUrl,
    String? courseId,
    String? workshopId,
    int? episodeCount,
    // Raw backend content-type string (series | standalone | podcast | ...).
    // Retained for analytics + backward compatibility with existing JSON.
    String? contentType,
  }) = _CatalogItem;

  static CatalogItem fromJson(Map<String, dynamic> json) {
    // Derive the discriminator from whichever ID the backend populated,
    // then fall back to the string contentType for legacy payloads.
    final workshopId = json['workshopId'] as String?;
    final courseId = json['courseId'] as String?;
    final rawContentType = json['contentType'] as String?;

    final CatalogItemType type;
    if (workshopId != null && workshopId.isNotEmpty) {
      type = CatalogItemType.workshop;
    } else if (courseId != null && courseId.isNotEmpty) {
      type = CatalogItemType.course;
    } else if (rawContentType == 'course') {
      type = CatalogItemType.course;
    } else if (rawContentType == 'workshop' ||
        rawContentType == 'series' ||
        rawContentType == 'standalone' ||
        rawContentType == 'podcast') {
      type = CatalogItemType.workshop;
    } else {
      type = CatalogItemType.resource;
    }

    return CatalogItem(
      id: json['id'] as String,
      title: json['title'] as String,
      type: type,
      thumbnailUrl: json['thumbnailUrl'] as String?,
      categoryTag: json['categoryTag'] as String?,
      isLocked: json['isLocked'] as bool? ?? false,
      lockBadgeText: json['lockBadgeText'] as String?,
      playUrl: json['playUrl'] as String?,
      courseId: courseId,
      workshopId: workshopId,
      episodeCount: json['episodeCount'] as int?,
      contentType: rawContentType,
    );
  }
}

// ── ContentSection ────────────────────────────────────────────────────────────

@Freezed(fromJson: false, toJson: false)
class ContentSection with _$ContentSection {
  const factory ContentSection({
    required String id,
    required String title,
    required List<CatalogItem> items,
    @Default('') String slug,
    @Default(false) bool isLocked,
    String? lockLabel,
  }) = _ContentSection;

  static ContentSection fromJson(Map<String, dynamic> json) => ContentSection(
        id: json['id'] as String,
        title: json['title'] as String,
        slug: json['slug'] as String? ?? '',
        isLocked: json['isLocked'] as bool? ?? false,
        lockLabel: json['lockLabel'] as String?,
        items: (json['items'] as List<dynamic>? ?? [])
            .cast<Map<String, dynamic>>()
            .map(CatalogItem.fromJson)
            .toList(),
      );
}
