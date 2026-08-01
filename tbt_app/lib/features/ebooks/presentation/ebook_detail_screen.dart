import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
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
