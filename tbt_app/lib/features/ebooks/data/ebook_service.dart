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

  /// Fetches the approved reviews on a book — the public review list
  /// rendered on the detail screen. Ordered newest first.
  Future<List<EbookReview>> listReviews(String bookId) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        '/api/ebooks/books/$bookId/reviews',
      );
      final list = (res.data?['data'] as List<dynamic>?) ?? const [];
      return list
          .cast<Map<String, dynamic>>()
          .map(EbookReview.fromJson)
          .toList();
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  /// Upserts the caller's own review. Rating in 1..5. Re-submitting
  /// overwrites the previous entry and drops back to `pending` for
  /// admin moderation.
  Future<EbookReviewSummary> submitReview({
    required String bookId,
    required int rating,
    String? reviewText,
  }) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '/api/ebooks/books/$bookId/reviews',
        data: {
          'rating': rating,
          if (reviewText != null && reviewText.trim().isNotEmpty)
            'reviewText': reviewText.trim(),
        },
      );
      final data = (res.data?['data'] as Map<String, dynamic>?) ?? const {};
      return EbookReviewSummary.fromJson(data);
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  /// Current + longest reading streak for the caller. Backend returns
  /// zeros when the streak has lapsed (last read was neither today nor
  /// yesterday), so the client can render "0-day streak" honestly
  /// instead of pretending a broken streak is still alive.
  Future<EbookReadingStreak> readingStreak() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>('/api/ebooks/streak');
      final data = (res.data?['data'] as Map<String, dynamic>?) ?? const {};
      return EbookReadingStreak.fromJson(data);
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }
}

final ebookServiceProvider = Provider<EbookService>(
  (ref) => EbookService(ref.watch(dioProvider)),
);
