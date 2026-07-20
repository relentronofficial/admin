import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/api.dart';
import '../../../shared/api/dio_client.dart';
import '../../../shared/api/dio_provider.dart';
import '../domain/ebook_models.dart';

class EbookService {
  const EbookService(this._dio);
  final Dio _dio;

  Future<List<EbookCategory>> listCategories() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(kEbookCategories);
      final list = (res.data?['data'] as List<dynamic>?) ?? const [];
      return list.cast<Map<String, dynamic>>().map(EbookCategory.fromJson).toList();
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<List<Ebook>> listFeatured() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(kEbookFeatured);
      final list = (res.data?['data'] as List<dynamic>?) ?? const [];
      return list.cast<Map<String, dynamic>>().map(Ebook.fromJson).toList();
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<List<EbookBanner>> listBanners() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(kEbookBanners);
      final list = (res.data?['data'] as List<dynamic>?) ?? const [];
      return list.cast<Map<String, dynamic>>().map(EbookBanner.fromJson).toList();
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<({List<Ebook> books, int total, int page})> library({
    int page = 1,
    int limit = 20,
    String? category,
    String? search,
    bool featuredOnly = false,
  }) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        kEbookLibrary,
        queryParameters: {
          'page': page,
          'limit': limit,
          if (category != null && category.isNotEmpty) 'category': category,
          if (search != null && search.isNotEmpty) 'search': search,
          if (featuredOnly) 'featured': 'true',
        },
      );
      final list = (res.data?['data'] as List<dynamic>?) ?? const [];
      final meta = (res.data?['meta'] as Map<String, dynamic>?) ?? const {};
      return (
        books: list.cast<Map<String, dynamic>>().map(Ebook.fromJson).toList(),
        total: (meta['total'] as int?) ?? 0,
        page: (meta['page'] as int?) ?? page,
      );
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<Ebook> getBook(String id) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>('/api/ebooks/books/$id');
      return Ebook.fromJson(res.data?['data'] as Map<String, dynamic>);
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<List<BookmarkedItem>> listBookmarks() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(kEbookBookmarks);
      final list = (res.data?['data'] as List<dynamic>?) ?? const [];
      return list.cast<Map<String, dynamic>>().map(BookmarkedItem.fromJson).toList();
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<EbookBookmark> upsertBookmark(String bookId, {int? pageNumber}) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(kEbookBookmarks, data: {
        'bookId': bookId,
        if (pageNumber != null) 'pageNumber': pageNumber,
      });
      return EbookBookmark.fromJson(res.data?['data'] as Map<String, dynamic>);
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<void> deleteBookmark(String bookId) async {
    try {
      await _dio.delete<dynamic>('$kEbookBookmarks/$bookId');
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<EbookProgress?> getProgress(String bookId) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>('$kEbookProgress/$bookId');
      final data = res.data?['data'];
      if (data == null) return null;
      return EbookProgress.fromJson(data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<void> submitProgress({
    required String bookId,
    required int currentPage,
    required int totalPages,
    bool completed = false,
  }) async {
    try {
      await _dio.post<dynamic>(kEbookProgress, data: {
        'bookId': bookId,
        'currentPage': currentPage,
        'totalPages': totalPages,
        'completed': completed,
      });
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<List<ContinueReadingItem>> continueReading() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(kEbookContinueReading);
      final list = (res.data?['data'] as List<dynamic>?) ?? const [];
      return list.cast<Map<String, dynamic>>().map(ContinueReadingItem.fromJson).toList();
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }
}

final ebookServiceProvider = Provider<EbookService>(
  (ref) => EbookService(ref.watch(dioProvider)),
);
