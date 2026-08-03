import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/ebook_service.dart';
import '../domain/ebook_models.dart';

// ── Categories ────────────────────────────────────────────────────
final ebookCategoriesProvider =
    FutureProvider.autoDispose<List<EbookCategory>>((ref) async {
  ref.keepAlive();
  return ref.watch(ebookServiceProvider).listCategories();
});

// ── Library (filtered by category slug + search) ─────────────────
final selectedEbookCategorySlugProvider = StateProvider<String?>((_) => null);
final ebookSearchProvider = StateProvider<String>((_) => '');

final ebookLibraryProvider = FutureProvider.autoDispose<List<Ebook>>((ref) async {
  final slug = ref.watch(selectedEbookCategorySlugProvider);
  final search = ref.watch(ebookSearchProvider);
  final result = await ref.watch(ebookServiceProvider).library(
        page: 1,
        limit: 50,
        category: slug,
        search: search.isEmpty ? null : search,
      );
  return result.books;
});

// ── Featured books ───────────────────────────────────────────────
final featuredBooksProvider =
    FutureProvider.autoDispose<List<Ebook>>((ref) async {
  ref.keepAlive();
  return ref.watch(ebookServiceProvider).listFeatured();
});

// ── Trending books (top-N by lifetime view count) ────────────────
final trendingBooksProvider =
    FutureProvider.autoDispose<List<Ebook>>((ref) async {
  ref.keepAlive();
  return ref.watch(ebookServiceProvider).listTrending(limit: 10);
});

// ── Highlights ────────────────────────────────────────────────────
// Per-book (keyed by bookId). Invalidate after add/delete.
final bookHighlightsProvider = FutureProvider.autoDispose
    .family<List<EbookHighlight>, String>((ref, bookId) async {
  return ref.watch(ebookServiceProvider).listHighlightsForBook(bookId);
});

// Aggregate across all books — powers the "My Highlights" screen.
final myHighlightsProvider =
    FutureProvider.autoDispose<List<EbookHighlight>>((ref) async {
  return ref.watch(ebookServiceProvider).listAllHighlights();
});

// ── Banners ──────────────────────────────────────────────────────
final ebookBannersProvider =
    FutureProvider.autoDispose<List<EbookBanner>>((ref) async {
  ref.keepAlive();
  return ref.watch(ebookServiceProvider).listBanners();
});

// ── Book detail ──────────────────────────────────────────────────
final ebookDetailProvider =
    FutureProvider.autoDispose.family<Ebook, String>((ref, id) async {
  return ref.watch(ebookServiceProvider).getBook(id);
});

// ── Bookmarks ────────────────────────────────────────────────────
final ebookBookmarksProvider =
    FutureProvider.autoDispose<List<BookmarkedItem>>((ref) async {
  return ref.watch(ebookServiceProvider).listBookmarks();
});

// ── Continue reading ─────────────────────────────────────────────
final continueReadingProvider =
    FutureProvider.autoDispose<List<ContinueReadingItem>>((ref) async {
  return ref.watch(ebookServiceProvider).continueReading();
});

// ── Reading streak ───────────────────────────────────────────────
// Cheap query (one row, indexed on memberId). Invalidate after a
// submit-progress call so the badge reflects the new streak count.
final ebookReadingStreakProvider =
    FutureProvider.autoDispose<EbookReadingStreak>((ref) async {
  return ref.watch(ebookServiceProvider).readingStreak();
});
