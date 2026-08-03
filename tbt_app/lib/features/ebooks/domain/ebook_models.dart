// Plain-data models for the e-books feature. Same pattern as
// podcasts/domain — hand-written classes with `fromJson` factories,
// no Freezed.

class EbookCategory {
  const EbookCategory({
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

  factory EbookCategory.fromJson(Map<String, dynamic> j) => EbookCategory(
        id: j['id'] as String,
        name: j['name'] as String,
        slug: j['slug'] as String,
        status: (j['status'] as String?) ?? 'active',
        sortOrder: (j['sortOrder'] as int?) ?? 0,
      );
}

class EbookBanner {
  const EbookBanner({
    required this.id,
    required this.title,
    this.subtitle,
    this.backgroundImage,
    this.buttonText,
    this.buttonLink,
  });
  final String id;
  final String title;
  final String? subtitle;
  final String? backgroundImage;
  final String? buttonText;
  final String? buttonLink;

  factory EbookBanner.fromJson(Map<String, dynamic> j) => EbookBanner(
        id: j['id'] as String,
        title: j['title'] as String,
        subtitle: j['subtitle'] as String?,
        backgroundImage: j['backgroundImage'] as String?,
        buttonText: j['buttonText'] as String?,
        buttonLink: j['buttonLink'] as String?,
      );
}

class EbookProgress {
  const EbookProgress({
    required this.currentPage,
    required this.totalPages,
    required this.progressPercentage,
    required this.completed,
    required this.updatedAt,
  });
  final int currentPage;
  final int totalPages;
  final double progressPercentage;
  final bool completed;
  final DateTime updatedAt;

  factory EbookProgress.fromJson(Map<String, dynamic> j) => EbookProgress(
        currentPage: (j['currentPage'] as int?) ?? 0,
        totalPages: (j['totalPages'] as int?) ?? 0,
        progressPercentage: _parseDouble(j['progressPercentage']),
        completed: (j['completed'] as bool?) ?? false,
        updatedAt: DateTime.parse(j['updatedAt'] as String),
      );
}

class EbookBookmark {
  const EbookBookmark({
    required this.id,
    required this.bookId,
    this.pageNumber,
    required this.createdAt,
  });
  final String id;
  final String bookId;
  final int? pageNumber;
  final DateTime createdAt;

  factory EbookBookmark.fromJson(Map<String, dynamic> j) => EbookBookmark(
        id: j['id'] as String,
        bookId: j['bookId'] as String,
        pageNumber: j['pageNumber'] as int?,
        createdAt: DateTime.parse(j['createdAt'] as String),
      );
}

class Ebook {
  const Ebook({
    required this.id,
    required this.title,
    required this.slug,
    required this.totalPages,
    required this.isFeatured,
    required this.status,
    required this.publishDate,
    this.description,
    this.author,
    this.categoryId,
    this.coverImage,
    this.pdfUrl,
    this.contentUrl,
    this.readingTime,
    this.category,
    this.progress,
    this.bookmark,
    this.locked = false,
    this.averageRating = 0,
    this.reviewCount = 0,
    this.myReview,
    this.pinnedAt,
    this.pinnedUntil,
    this.series,
    this.seriesNumber,
    this.seriesSiblings = const [],
    this.authorRef,
    this.isbn,
    this.language,
    this.publisher,
  });

  final String id;
  final String title;
  final String slug;
  final String? description;
  final String? author;
  final String? categoryId;
  final String? coverImage;
  final String? pdfUrl;
  final String? contentUrl;
  final int totalPages;
  final String? readingTime;
  final bool isFeatured;
  final String status;
  final DateTime publishDate;
  final EbookCategoryRef? category;
  final EbookProgress? progress;
  final EbookBookmark? bookmark;

  /// True when the backend flagged this book as batch-restricted and
  /// the current member's batch isn't in the allowlist. Members can
  /// still see the card in the library but tapping through gets a 403.
  final bool locked;

  /// Average rating across approved reviews (0..5, one decimal). 0
  /// when the book has zero approved reviews.
  final double averageRating;

  /// Count of approved reviews. Used to render "N reviews" on the
  /// detail screen.
  final int reviewCount;

  /// The caller's own submitted review — any status. Populated only
  /// by the detail endpoint so the star widget can pre-fill.
  final EbookReviewSummary? myReview;

  /// Admin pin timestamp. When non-null the book sorts before others.
  /// The backend already nulls this out when `pinnedUntil` is past,
  /// so a truthy value here is always a live pin.
  final DateTime? pinnedAt;

  /// Optional pin expiry. Only informational on the client — the
  /// backend does the mask-when-past.
  final DateTime? pinnedUntil;

  bool get isPinned => pinnedAt != null;

  /// Parent series when this book is part of a multi-part collection.
  /// Null for standalone books.
  final EbookSeriesRef? series;

  /// 1-indexed position within the series.
  final int? seriesNumber;

  /// Sibling books in the same series, ordered by seriesNumber. Only
  /// populated by the detail endpoint (list endpoints return empty).
  final List<EbookSeriesSibling> seriesSiblings;

  /// Optional managed author profile. Legacy `author` string above
  /// still carries the plain-text credit for un-linked rows.
  final EbookAuthorRef? authorRef;

  /// Publisher metadata. All nullable — the detail screen renders
  /// these fields only when non-null.
  final String? isbn;
  final String? language;
  final EbookPublisherRef? publisher;

  factory Ebook.fromJson(Map<String, dynamic> j) => Ebook(
        id: j['id'] as String,
        title: j['title'] as String,
        slug: j['slug'] as String,
        description: j['description'] as String?,
        author: j['author'] as String?,
        categoryId: j['categoryId'] as String?,
        coverImage: j['coverImage'] as String?,
        pdfUrl: j['pdfUrl'] as String?,
        contentUrl: j['contentUrl'] as String?,
        totalPages: (j['totalPages'] as int?) ?? 0,
        readingTime: j['readingTime'] as String?,
        isFeatured: (j['isFeatured'] as bool?) ?? false,
        status: (j['status'] as String?) ?? 'active',
        publishDate: DateTime.parse(j['publishDate'] as String),
        category: j['category'] != null
            ? EbookCategoryRef.fromJson(j['category'] as Map<String, dynamic>)
            : null,
        progress: j['progress'] != null
            ? EbookProgress.fromJson(j['progress'] as Map<String, dynamic>)
            : null,
        bookmark: j['bookmark'] != null
            ? EbookBookmark.fromJson(j['bookmark'] as Map<String, dynamic>)
            : null,
        locked: (j['locked'] as bool?) ?? false,
        averageRating: _parseDouble(j['averageRating']),
        reviewCount: (j['reviewCount'] as int?) ?? 0,
        myReview: j['myReview'] != null
            ? EbookReviewSummary.fromJson(j['myReview'] as Map<String, dynamic>)
            : null,
        pinnedAt: j['pinnedAt'] != null
            ? DateTime.tryParse(j['pinnedAt'] as String)
            : null,
        pinnedUntil: j['pinnedUntil'] != null
            ? DateTime.tryParse(j['pinnedUntil'] as String)
            : null,
        series: j['series'] != null
            ? EbookSeriesRef.fromJson(j['series'] as Map<String, dynamic>)
            : null,
        seriesNumber: (j['seriesNumber'] as int?),
        seriesSiblings: ((j['seriesSiblings'] as List<dynamic>?) ?? const [])
            .cast<Map<String, dynamic>>()
            .map(EbookSeriesSibling.fromJson)
            .toList(),
        authorRef: j['authorRef'] != null
            ? EbookAuthorRef.fromJson(j['authorRef'] as Map<String, dynamic>)
            : null,
        isbn: j['isbn'] as String?,
        language: j['language'] as String?,
        publisher: j['publisher'] != null
            ? EbookPublisherRef.fromJson(
                j['publisher'] as Map<String, dynamic>,
              )
            : null,
      );
}

/// Compact publisher reference on the book detail endpoint.
class EbookPublisherRef {
  const EbookPublisherRef({
    required this.id,
    required this.name,
    required this.slug,
    this.logoUrl,
  });
  final String id;
  final String name;
  final String slug;
  final String? logoUrl;

  factory EbookPublisherRef.fromJson(Map<String, dynamic> j) =>
      EbookPublisherRef(
        id: j['id'] as String,
        name: j['name'] as String,
        slug: j['slug'] as String,
        logoUrl: j['logoUrl'] as String?,
      );
}

/// Compact author reference on the book detail endpoint. Full profile
/// (with bio + book list) comes from `GET /api/ebooks/authors/:slug`.
class EbookAuthorRef {
  const EbookAuthorRef({
    required this.id,
    required this.name,
    required this.slug,
    this.photoUrl,
  });
  final String id;
  final String name;
  final String slug;
  final String? photoUrl;

  factory EbookAuthorRef.fromJson(Map<String, dynamic> j) => EbookAuthorRef(
        id: j['id'] as String,
        name: j['name'] as String,
        slug: j['slug'] as String,
        photoUrl: j['photoUrl'] as String?,
      );
}

/// Full author profile — `GET /api/ebooks/authors/:slug`. Includes
/// the author metadata plus every book they've written.
class EbookAuthorProfile {
  const EbookAuthorProfile({required this.author, required this.books});
  final EbookAuthorDetails author;
  final List<Ebook> books;

  factory EbookAuthorProfile.fromJson(Map<String, dynamic> j) =>
      EbookAuthorProfile(
        author: EbookAuthorDetails.fromJson(
          (j['author'] as Map<String, dynamic>?) ?? const {},
        ),
        books: ((j['books'] as List<dynamic>?) ?? const [])
            .cast<Map<String, dynamic>>()
            .map(Ebook.fromJson)
            .toList(),
      );
}

class EbookAuthorDetails {
  const EbookAuthorDetails({
    required this.id,
    required this.name,
    required this.slug,
    this.bio,
    this.photoUrl,
  });
  final String id;
  final String name;
  final String slug;
  final String? bio;
  final String? photoUrl;

  factory EbookAuthorDetails.fromJson(Map<String, dynamic> j) =>
      EbookAuthorDetails(
        id: (j['id'] as String?) ?? '',
        name: (j['name'] as String?) ?? '',
        slug: (j['slug'] as String?) ?? '',
        bio: j['bio'] as String?,
        photoUrl: j['photoUrl'] as String?,
      );
}

/// Compact series reference on the book detail endpoint.
class EbookSeriesRef {
  const EbookSeriesRef({
    required this.id,
    required this.title,
    required this.slug,
    this.coverUrl,
  });
  final String id;
  final String title;
  final String slug;
  final String? coverUrl;

  factory EbookSeriesRef.fromJson(Map<String, dynamic> j) => EbookSeriesRef(
        id: j['id'] as String,
        title: j['title'] as String,
        slug: j['slug'] as String,
        coverUrl: j['coverUrl'] as String?,
      );
}

/// Sibling book in the same series — minimal shape for the "Part N of M"
/// strip on the detail screen.
class EbookSeriesSibling {
  const EbookSeriesSibling({
    required this.id,
    required this.title,
    required this.slug,
    this.coverImage,
    this.seriesNumber,
  });
  final String id;
  final String title;
  final String slug;
  final String? coverImage;
  final int? seriesNumber;

  factory EbookSeriesSibling.fromJson(Map<String, dynamic> j) =>
      EbookSeriesSibling(
        id: j['id'] as String,
        title: j['title'] as String,
        slug: j['slug'] as String,
        coverImage: j['coverImage'] as String?,
        seriesNumber: (j['seriesNumber'] as int?),
      );
}

/// Compact "my review" wire format returned inline on the book detail
/// endpoint. Full review list (with member name/avatar) comes from a
/// separate paginated endpoint.
class EbookReviewSummary {
  const EbookReviewSummary({
    required this.rating,
    this.reviewText,
    required this.status,
    required this.updatedAt,
  });
  final int rating;
  final String? reviewText;
  final String status; // pending | approved | rejected
  final DateTime updatedAt;

  factory EbookReviewSummary.fromJson(Map<String, dynamic> j) =>
      EbookReviewSummary(
        rating: (j['rating'] as int?) ?? 0,
        reviewText: j['reviewText'] as String?,
        status: (j['status'] as String?) ?? 'pending',
        updatedAt: DateTime.parse(j['updatedAt'] as String),
      );
}

/// Per-member reading streak snapshot returned by
/// `GET /api/ebooks/streak`. Zero values when the member has no
/// progress history or their streak has lapsed (skipped a day).
class EbookReadingStreak {
  const EbookReadingStreak({
    required this.currentStreak,
    required this.longestStreak,
    this.lastReadAt,
  });
  final int currentStreak;
  final int longestStreak;
  final DateTime? lastReadAt;

  static const empty =
      EbookReadingStreak(currentStreak: 0, longestStreak: 0, lastReadAt: null);

  factory EbookReadingStreak.fromJson(Map<String, dynamic> j) =>
      EbookReadingStreak(
        currentStreak: (j['currentStreak'] as int?) ?? 0,
        longestStreak: (j['longestStreak'] as int?) ?? 0,
        lastReadAt: j['lastReadAt'] != null
            ? DateTime.tryParse(j['lastReadAt'] as String)
            : null,
      );
}

/// A single review with author info — the shape returned by
/// `GET /api/ebooks/books/:id/reviews`.
class EbookReview {
  const EbookReview({
    required this.id,
    required this.memberId,
    required this.bookId,
    required this.rating,
    this.reviewText,
    required this.updatedAt,
    this.authorName,
    this.authorPhotoUrl,
  });

  final String id;
  final String memberId;
  final String bookId;
  final int rating;
  final String? reviewText;
  final DateTime updatedAt;
  final String? authorName;
  final String? authorPhotoUrl;

  factory EbookReview.fromJson(Map<String, dynamic> j) {
    final m = j['member'] as Map<String, dynamic>?;
    final name = m == null
        ? null
        : [m['firstName'], m['lastName']]
            .whereType<String>()
            .where((s) => s.isNotEmpty)
            .join(' ')
            .trim();
    return EbookReview(
      id: j['id'] as String,
      memberId: j['memberId'] as String,
      bookId: j['bookId'] as String,
      rating: (j['rating'] as int?) ?? 0,
      reviewText: j['reviewText'] as String?,
      updatedAt: DateTime.parse(j['updatedAt'] as String),
      authorName: (name != null && name.isNotEmpty) ? name : null,
      authorPhotoUrl: m?['profilePhotoUrl'] as String?,
    );
  }
}

class EbookCategoryRef {
  const EbookCategoryRef({required this.id, required this.name, required this.slug});
  final String id;
  final String name;
  final String slug;
  factory EbookCategoryRef.fromJson(Map<String, dynamic> j) => EbookCategoryRef(
        id: j['id'] as String,
        name: j['name'] as String,
        slug: j['slug'] as String,
      );
}

class ContinueReadingItem {
  const ContinueReadingItem({required this.progress, required this.book});
  final EbookProgress progress;
  final Ebook book;
  factory ContinueReadingItem.fromJson(Map<String, dynamic> j) => ContinueReadingItem(
        progress: EbookProgress.fromJson(j),
        book: Ebook.fromJson(j['book'] as Map<String, dynamic>),
      );
}

class BookmarkedItem {
  const BookmarkedItem({required this.bookmark, required this.book});
  final EbookBookmark bookmark;
  final Ebook book;
  factory BookmarkedItem.fromJson(Map<String, dynamic> j) => BookmarkedItem(
        bookmark: EbookBookmark.fromJson(j),
        book: Ebook.fromJson(j['book'] as Map<String, dynamic>),
      );
}

double _parseDouble(dynamic v) {
  if (v == null) return 0;
  if (v is num) return v.toDouble();
  if (v is String) return double.tryParse(v) ?? 0;
  return 0;
}
