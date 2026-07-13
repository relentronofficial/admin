import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/constants/api.dart';
import '../../../core/constants/storage_keys.dart';
import '../../../shared/api/dio_provider.dart';

part 'search_provider.g.dart';

// ── Result models ─────────────────────────────────────────────────────────────

class SearchWorkshop {
  final String id;
  final String title;
  final String slug;
  final String? thumbnailUrl;
  final String? description;

  const SearchWorkshop({
    required this.id,
    required this.title,
    required this.slug,
    this.thumbnailUrl,
    this.description,
  });

  factory SearchWorkshop.fromJson(Map<String, dynamic> j) => SearchWorkshop(
        id: j['id'] as String,
        title: j['title'] as String,
        slug: j['slug'] as String,
        thumbnailUrl: j['thumbnailUrl'] as String?,
        description: j['description'] as String?,
      );
}

class SearchCourse {
  final String id;
  final String title;
  final String? thumbnailUrl;
  final String? description;

  const SearchCourse({
    required this.id,
    required this.title,
    this.thumbnailUrl,
    this.description,
  });

  factory SearchCourse.fromJson(Map<String, dynamic> j) => SearchCourse(
        id: j['id'] as String,
        title: j['title'] as String,
        thumbnailUrl: j['thumbnailUrl'] as String?,
        description: j['description'] as String?,
      );
}

class SearchEpisode {
  final String id;
  final String title;
  final String courseId;
  final String? thumbnailUrl;
  final String? courseTitle;

  const SearchEpisode({
    required this.id,
    required this.title,
    required this.courseId,
    this.thumbnailUrl,
    this.courseTitle,
  });

  factory SearchEpisode.fromJson(Map<String, dynamic> j) => SearchEpisode(
        id: j['id'] as String,
        title: j['title'] as String,
        courseId: j['courseId'] as String,
        thumbnailUrl: j['thumbnailUrl'] as String?,
        courseTitle: j['courseTitle'] as String?,
      );
}

class SearchResource {
  final String id;
  final String title;
  final String? fileType;
  final String? description;

  const SearchResource({
    required this.id,
    required this.title,
    this.fileType,
    this.description,
  });

  factory SearchResource.fromJson(Map<String, dynamic> j) => SearchResource(
        id: j['id'] as String,
        title: j['title'] as String,
        fileType: j['fileType'] as String?,
        description: j['description'] as String?,
      );
}

class SearchResults {
  final List<SearchWorkshop> workshops;
  final List<SearchCourse> courses;
  final List<SearchEpisode> episodes;
  final List<SearchResource> resources;

  const SearchResults({
    required this.workshops,
    required this.courses,
    required this.episodes,
    required this.resources,
  });

  bool get isEmpty =>
      workshops.isEmpty && courses.isEmpty && episodes.isEmpty && resources.isEmpty;

  factory SearchResults.fromJson(Map<String, dynamic> j) => SearchResults(
        workshops: (j['workshops'] as List<dynamic>? ?? [])
            .map((e) => SearchWorkshop.fromJson(e as Map<String, dynamic>))
            .toList(),
        courses: (j['courses'] as List<dynamic>? ?? [])
            .map((e) => SearchCourse.fromJson(e as Map<String, dynamic>))
            .toList(),
        episodes: (j['episodes'] as List<dynamic>? ?? [])
            .map((e) => SearchEpisode.fromJson(e as Map<String, dynamic>))
            .toList(),
        resources: (j['resources'] as List<dynamic>? ?? [])
            .map((e) => SearchResource.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

// ── Provider ──────────────────────────────────────────────────────────────────

@riverpod
Future<SearchResults> search(Ref ref, String query) async {
  final res = await ref
      .read(dioProvider)
      .get<Map<String, dynamic>>(kSearch, queryParameters: {'q': query});
  return SearchResults.fromJson(res.data?['data'] as Map<String, dynamic>? ?? {});
}

// ── Recent searches helpers ───────────────────────────────────────────────────

Future<List<String>> loadRecentSearches() async {
  final prefs = await SharedPreferences.getInstance();
  final raw = prefs.getString(kPrefRecentSearches);
  if (raw == null) return [];
  try {
    return (jsonDecode(raw) as List<dynamic>).cast<String>();
  } catch (_) {
    return [];
  }
}

Future<void> saveRecentSearch(String query) async {
  final searches = await loadRecentSearches();
  searches.remove(query);
  searches.insert(0, query);
  final trimmed = searches.take(10).toList();
  final prefs = await SharedPreferences.getInstance();
  await prefs.setString(kPrefRecentSearches, jsonEncode(trimmed));
}

Future<void> removeRecentSearch(String query) async {
  final searches = await loadRecentSearches();
  searches.remove(query);
  final prefs = await SharedPreferences.getInstance();
  await prefs.setString(kPrefRecentSearches, jsonEncode(searches));
}

Future<void> clearRecentSearches() async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.remove(kPrefRecentSearches);
}
