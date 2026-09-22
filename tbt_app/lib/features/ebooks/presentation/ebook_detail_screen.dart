import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:share_plus/share_plus.dart';

import '../../../core/constants/routes.dart';
import '../../../shared/theme/design_constants.dart';
import '../../../shared/theme/theme_tokens.dart';
import '../data/ebook_service.dart';
import '../domain/ebook_models.dart';
import '../providers/ebook_providers.dart';
import '../../../shared/widgets/app_loader.dart';

/// E-book detail — cover, description, meta, Read + Bookmark actions.
class EbookDetailScreen extends ConsumerWidget {
  const EbookDetailScreen({super.key, required this.bookId});
  final String bookId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = context.tokens;
    final async = ref.watch(ebookDetailProvider(bookId));
    return Scaffold(
      backgroundColor: tokens.bgPage,
      body: async.when(
        loading: () => const AppLoader.center(),
        error: (e, _) => Scaffold(
          appBar: AppBar(backgroundColor: tokens.bgSurface, elevation: 0),
          body: Center(
            child: Text('Could not load book.',
                style: TextStyle(color: tokens.textSecondary)),
          ),
        ),
        data: (book) => CustomScrollView(
          slivers: [
            SliverAppBar(
              backgroundColor: tokens.bgSurface,
              foregroundColor: Colors.white,
              expandedHeight: 260,
              pinned: true,
              actions: [
                IconButton(
                  tooltip: 'Share',
                  icon: const Icon(Icons.share_rounded),
                  onPressed: () async {
                    // Public web preview page at
                    // https://app.tamilbusinesstribe.com/ebook/<slug>.
                    // Recipient sees a card with cover + description
                    // and a CTA to open the book in the app.
                    final url =
                        'https://app.tamilbusinesstribe.com/ebook/${book.slug}';
                    final by = (book.author != null && book.author!.isNotEmpty)
                        ? ' by ${book.author}'
                        : '';
                    await Share.share(
                      'Check out "${book.title}"$by on Tamil Business Tribe — $url',
                      subject: book.title,
                    );
                  },
                ),
              ],
              flexibleSpace: FlexibleSpaceBar(
                background: _HeroCover(coverUrl: book.coverImage),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.all(16),
              sliver: SliverList.list(
                children: [
                  Text(
                    book.title,
                    style: TextStyle(
                      color: tokens.textPrimary,
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      height: 1.25,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 8,
                    runSpacing: 4,
                    children: [
                      if (book.author != null && book.author!.isNotEmpty)
                        _MetaChip(icon: Icons.person_outline, label: book.author!),
                      if (book.totalPages > 0)
                        _MetaChip(icon: Icons.menu_book_outlined, label: '${book.totalPages} pages'),
                      if (book.readingTime != null && book.readingTime!.isNotEmpty)
                        _MetaChip(icon: Icons.schedule_outlined, label: book.readingTime!),
                      if (book.category != null)
                        _MetaChip(icon: Icons.folder_outlined, label: book.category!.name),
                    ],
                  ),
                  if (book.progress != null) ...[
                    const SizedBox(height: 16),
                    _ProgressBar(progress: book.progress!),
                  ],
                  const SizedBox(height: 20),
                  _ActionRow(book: book),
                  if (book.description != null && book.description!.isNotEmpty) ...[
                    const SizedBox(height: 24),
                    Text(
                      'About',
                      style: TextStyle(
                        color: tokens.textSecondary,
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.2,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      book.description!,
                      style: TextStyle(
                        color: tokens.textSecondary,
                        fontSize: 14,
                        height: 1.5,
                      ),
                    ),
                  ],
                  const SizedBox(height: 32),
                  _ReviewsSection(book: book),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _HeroCover extends StatelessWidget {
  const _HeroCover({required this.coverUrl});
  final String? coverUrl;
  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        if (coverUrl != null && coverUrl!.isNotEmpty)
          CachedNetworkImage(imageUrl: coverUrl!, fit: BoxFit.cover)
        else
          Container(color: kColorBgSurface),
        Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                Colors.black.withValues(alpha: 0.15),
                Colors.black.withValues(alpha: 0.85),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _MetaChip extends StatelessWidget {
  const _MetaChip({required this.icon, required this.label});
  final IconData icon;
  final String label;
  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: tokens.bgSurface,
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: tokens.borderCard),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 11, color: tokens.textMuted),
          const SizedBox(width: 4),
          Text(label, style: TextStyle(color: tokens.textSecondary, fontSize: 11)),
        ],
      ),
    );
  }
}

class _ProgressBar extends StatelessWidget {
  const _ProgressBar({required this.progress});
  final EbookProgress progress;
  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final ratio = (progress.progressPercentage / 100).clamp(0, 1).toDouble();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(
              'Reading progress',
              style: TextStyle(color: tokens.textMuted, fontSize: 11),
            ),
            const Spacer(),
            Text(
              '${progress.progressPercentage.toStringAsFixed(0)}%',
              style: TextStyle(color: tokens.textPrimary, fontSize: 11, fontWeight: FontWeight.w700),
            ),
          ],
        ),
        const SizedBox(height: 4),
        ClipRRect(
          borderRadius: BorderRadius.circular(2),
          child: LinearProgressIndicator(
            value: ratio,
            minHeight: 4,
            backgroundColor: tokens.borderCard,
            color: kColorAccent,
          ),
        ),
      ],
    );
  }
}

class _ActionRow extends ConsumerStatefulWidget {
  const _ActionRow({required this.book});
  final Ebook book;
  @override
  ConsumerState<_ActionRow> createState() => _ActionRowState();
}

class _ActionRowState extends ConsumerState<_ActionRow> {
  late bool _bookmarked = widget.book.bookmark != null;
  bool _busy = false;

  Future<void> _toggleBookmark() async {
    if (_busy) return;
    setState(() => _busy = true);
    final service = ref.read(ebookServiceProvider);
    try {
      if (_bookmarked) {
        await service.deleteBookmark(widget.book.id);
      } else {
        await service.upsertBookmark(widget.book.id,
            pageNumber: widget.book.progress?.currentPage);
      }
      if (!mounted) return;
      setState(() => _bookmarked = !_bookmarked);
      ref.invalidate(ebookBookmarksProvider);
      ref.invalidate(ebookDetailProvider(widget.book.id));
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Bookmark update failed.'), behavior: SnackBarBehavior.floating),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final hasPdf = widget.book.pdfUrl != null && widget.book.pdfUrl!.isNotEmpty;
    final hasContent = widget.book.contentUrl != null && widget.book.contentUrl!.isNotEmpty;
    return Row(
      children: [
        Expanded(
          child: FilledButton.icon(
            onPressed: (hasPdf || hasContent)
                ? () {
                    if (hasPdf) {
                      GoRouter.of(context).push(AppRoutes.ebookReaderPath(widget.book.id));
                    } else {
                      // External content link — open in-app WebView could be a
                      // future addition; for now nudge users to the browser
                      // via url_launcher would be ideal, but keeping the
                      // dep surface minimal — show a snackbar.
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('External link — coming soon.'),
                          behavior: SnackBarBehavior.floating,
                        ),
                      );
                    }
                  }
                : null,
            style: FilledButton.styleFrom(
              backgroundColor: kColorAccent,
              minimumSize: const Size.fromHeight(46),
            ),
            icon: const Icon(Icons.menu_book, color: Colors.white),
            label: Text(
              widget.book.progress != null && widget.book.progress!.currentPage > 0
                  ? 'CONTINUE READING'
                  : 'START READING',
              style: const TextStyle(fontWeight: FontWeight.w800, letterSpacing: 0.8),
            ),
          ),
        ),
        const SizedBox(width: 10),
        SizedBox(
          height: 46,
          child: OutlinedButton(
            onPressed: _busy ? null : _toggleBookmark,
            style: OutlinedButton.styleFrom(
              side: BorderSide(color: context.tokens.borderCard),
            ),
            child: _busy
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2, color: kColorAccent),
                  )
                : Icon(
                    _bookmarked ? Icons.bookmark : Icons.bookmark_border,
                    color: _bookmarked ? kColorAccent : context.tokens.textSecondary,
                  ),
          ),
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Reviews section
// ─────────────────────────────────────────────────────────────────────────────

class _ReviewsSection extends ConsumerWidget {
  const _ReviewsSection({required this.book});
  final Ebook book;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = context.tokens;
    final reviewsAsync = ref.watch(ebookReviewsProvider(book.id));
    final alreadyReviewed = book.myReview != null;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(
              'Reviews & Ratings',
              style: TextStyle(
                color: tokens.textSecondary,
                fontSize: 11,
                fontWeight: FontWeight.w800,
                letterSpacing: 1.2,
              ),
            ),
            const Spacer(),
            if (book.averageRating > 0) ...[
              Icon(Icons.star_rounded, size: 14, color: const Color(0xFFFBBF24)),
              const SizedBox(width: 3),
              Text(
                book.averageRating.toStringAsFixed(1),
                style: TextStyle(
                  color: tokens.textPrimary,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(width: 4),
              Text(
                '(${book.reviewCount})',
                style: TextStyle(color: tokens.textMuted, fontSize: 12),
              ),
            ],
          ],
        ),
        const SizedBox(height: 12),
        reviewsAsync.when(
          loading: () => const Padding(
            padding: EdgeInsets.symmetric(vertical: 16),
            child: AppLoader.center(),
          ),
          error: (_, __) => Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Text(
              'Could not load reviews.',
              style: TextStyle(color: tokens.textMuted, fontSize: 13),
            ),
          ),
          data: (reviews) => reviews.isEmpty
              ? _EmptyReviews(tokens: tokens)
              : Column(
                  children: [
                    for (final r in reviews) ...[
                      _ReviewCard(review: r),
                      const SizedBox(height: 8),
                    ],
                  ],
                ),
        ),
        const SizedBox(height: 16),
        if (!alreadyReviewed)
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () async {
                await showModalBottomSheet<void>(
                  context: context,
                  isScrollControlled: true,
                  backgroundColor: Colors.transparent,
                  builder: (_) => _WriteReviewSheet(bookId: book.id),
                );
                // Refresh reviews + detail (myReview inline) after sheet closes.
                ref.invalidate(ebookReviewsProvider(book.id));
                ref.invalidate(ebookDetailProvider(book.id));
              },
              style: OutlinedButton.styleFrom(
                side: BorderSide(color: tokens.borderCard),
                minimumSize: const Size.fromHeight(44),
              ),
              icon: Icon(Icons.rate_review_outlined, color: tokens.textSecondary),
              label: Text(
                'Write a Review',
                style: TextStyle(color: tokens.textSecondary),
              ),
            ),
          )
        else if (book.myReview != null)
          _MyReviewBanner(review: book.myReview!, tokens: tokens),
      ],
    );
  }
}

class _EmptyReviews extends StatelessWidget {
  const _EmptyReviews({required this.tokens});
  final ThemeTokens tokens;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 20),
      decoration: BoxDecoration(
        color: tokens.bgSurface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: tokens.borderCard),
      ),
      child: Column(
        children: [
          Icon(Icons.rate_review_outlined, size: 32, color: tokens.textMuted),
          const SizedBox(height: 8),
          Text(
            'No reviews yet.',
            style: TextStyle(color: tokens.textSecondary, fontSize: 14, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 4),
          Text(
            'Be the first to share your thoughts.',
            style: TextStyle(color: tokens.textMuted, fontSize: 12),
          ),
        ],
      ),
    );
  }
}

class _ReviewCard extends StatelessWidget {
  const _ReviewCard({required this.review});
  final EbookReview review;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final dateStr = DateFormat('dd MMM yyyy').format(review.updatedAt.toLocal());
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: tokens.bgSurface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: tokens.borderCard),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 16,
                backgroundColor: tokens.borderCard,
                backgroundImage: review.authorPhotoUrl != null && review.authorPhotoUrl!.isNotEmpty
                    ? NetworkImage(review.authorPhotoUrl!)
                    : null,
                child: (review.authorPhotoUrl == null || review.authorPhotoUrl!.isEmpty)
                    ? Text(
                        (review.authorName?.isNotEmpty == true)
                            ? review.authorName![0].toUpperCase()
                            : '?',
                        style: TextStyle(color: tokens.textPrimary, fontSize: 13, fontWeight: FontWeight.w700),
                      )
                    : null,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      review.authorName ?? 'Member',
                      style: TextStyle(
                        color: tokens.textPrimary,
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    Text(
                      dateStr,
                      style: TextStyle(color: tokens.textMuted, fontSize: 11),
                    ),
                  ],
                ),
              ),
              _StarRow(rating: review.rating, size: 14),
            ],
          ),
          if (review.reviewText != null && review.reviewText!.isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(
              review.reviewText!,
              style: TextStyle(color: tokens.textSecondary, fontSize: 13, height: 1.45),
            ),
          ],
        ],
      ),
    );
  }
}

class _MyReviewBanner extends StatelessWidget {
  const _MyReviewBanner({required this.review, required this.tokens});
  final EbookReviewSummary review;
  final ThemeTokens tokens;

  @override
  Widget build(BuildContext context) {
    final statusLabel = switch (review.status) {
      'approved' => 'Approved',
      'rejected' => 'Not published',
      _ => 'Pending review',
    };
    final statusColor = switch (review.status) {
      'approved' => const Color(0xFF22C55E),
      'rejected' => const Color(0xFFEF4444),
      _ => const Color(0xFFFBBF24),
    };
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: tokens.bgSurface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: tokens.borderCard),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              _StarRow(rating: review.rating, size: 14),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  statusLabel,
                  style: TextStyle(color: statusColor, fontSize: 11, fontWeight: FontWeight.w700),
                ),
              ),
            ],
          ),
          if (review.reviewText != null && review.reviewText!.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              review.reviewText!,
              style: TextStyle(color: tokens.textSecondary, fontSize: 13, height: 1.4),
            ),
          ],
          const SizedBox(height: 6),
          Text(
            'Your review',
            style: TextStyle(color: tokens.textMuted, fontSize: 11),
          ),
        ],
      ),
    );
  }
}

class _StarRow extends StatelessWidget {
  const _StarRow({required this.rating, this.size = 16});
  final int rating;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(5, (i) {
        return Icon(
          i < rating ? Icons.star_rounded : Icons.star_border_rounded,
          size: size,
          color: const Color(0xFFFBBF24),
        );
      }),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Write Review bottom sheet
// ─────────────────────────────────────────────────────────────────────────────

class _WriteReviewSheet extends ConsumerStatefulWidget {
  const _WriteReviewSheet({required this.bookId});
  final String bookId;

  @override
  ConsumerState<_WriteReviewSheet> createState() => _WriteReviewSheetState();
}

class _WriteReviewSheetState extends ConsumerState<_WriteReviewSheet> {
  int _rating = 0;
  final _textCtl = TextEditingController();
  bool _saving = false;

  @override
  void dispose() {
    _textCtl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_rating == 0) {
      _snack('Please select a star rating.');
      return;
    }
    setState(() => _saving = true);
    try {
      await ref.read(ebookServiceProvider).submitReview(
            bookId: widget.bookId,
            rating: _rating,
            reviewText: _textCtl.text.trim().isEmpty ? null : _textCtl.text.trim(),
          );
      if (!mounted) return;
      Navigator.of(context).pop();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Review submitted — pending approval.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } catch (_) {
      _snack('Could not submit review. Please try again.');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _snack(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(msg), behavior: SnackBarBehavior.floating),
    );
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        decoration: BoxDecoration(
          color: tokens.bgSurface,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        ),
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: tokens.borderCard,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            Text(
              'Write a Review',
              style: TextStyle(
                color: tokens.textPrimary,
                fontSize: 16,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 16),
            // Star rating selector
            Row(
              children: List.generate(5, (i) {
                final filled = i < _rating;
                return GestureDetector(
                  onTap: () => setState(() => _rating = i + 1),
                  child: Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: Icon(
                      filled ? Icons.star_rounded : Icons.star_border_rounded,
                      size: 36,
                      color: const Color(0xFFFBBF24),
                    ),
                  ),
                );
              }),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _textCtl,
              maxLines: 4,
              minLines: 3,
              style: TextStyle(color: tokens.textPrimary),
              decoration: inputDecorationOf(context, 'Share your thoughts (optional)…'),
            ),
            const SizedBox(height: 20),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                TextButton(
                  onPressed: _saving ? null : () => Navigator.pop(context),
                  child: Text('Cancel', style: TextStyle(color: tokens.textSecondary)),
                ),
                const SizedBox(width: 8),
                FilledButton(
                  onPressed: _saving ? null : _submit,
                  style: FilledButton.styleFrom(backgroundColor: kColorAccent),
                  child: _saving
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Text('Submit', style: TextStyle(fontWeight: FontWeight.w700)),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
