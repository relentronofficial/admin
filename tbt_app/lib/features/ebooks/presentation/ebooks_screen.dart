import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/routes.dart';
import '../../../shared/theme/design_constants.dart';
import '../../../shared/theme/theme_tokens.dart';
import '../domain/ebook_models.dart';
import '../providers/ebook_providers.dart';

/// E-books landing screen: banners row, continue-reading, featured
/// grid, category filter, full library.
class EbooksScreen extends ConsumerWidget {
  const EbooksScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = context.tokens;
    return Scaffold(
      backgroundColor: tokens.bgPage,
      appBar: AppBar(
        backgroundColor: tokens.bgSurface,
        elevation: 0,
        title: const Text('E-Books',
            style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w700)),
        actions: [
          IconButton(
            tooltip: 'Bookmarks',
            icon: const Icon(Icons.bookmark_border, color: Colors.white),
            onPressed: () => GoRouter.of(context).push(AppRoutes.ebookBookmarks),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(ebookCategoriesProvider);
          ref.invalidate(featuredBooksProvider);
          ref.invalidate(ebookLibraryProvider);
          ref.invalidate(ebookBannersProvider);
          ref.invalidate(continueReadingProvider);
        },
        child: ListView(
          padding: const EdgeInsets.only(bottom: 100),
          children: const [
            _BannersRow(),
            _ContinueReadingRow(),
            _FeaturedGrid(),
            _CategoryChipsRow(),
            _LibraryGrid(),
          ],
        ),
      ),
    );
  }
}

// ── Banners ────────────────────────────────────────────────────────

class _BannersRow extends ConsumerWidget {
  const _BannersRow();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(ebookBannersProvider);
    return async.when(
      loading: () => const SizedBox.shrink(),
      error: (_, __) => const SizedBox.shrink(),
      data: (list) {
        if (list.isEmpty) return const SizedBox.shrink();
        return Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: SizedBox(
            height: 130,
            child: PageView.builder(
              controller: PageController(viewportFraction: 0.94),
              itemCount: list.length,
              itemBuilder: (ctx, i) => _BannerCard(banner: list[i]),
            ),
          ),
        );
      },
    );
  }
}

class _BannerCard extends StatelessWidget {
  const _BannerCard({required this.banner});
  final EbookBanner banner;
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (banner.backgroundImage != null && banner.backgroundImage!.isNotEmpty)
              CachedNetworkImage(imageUrl: banner.backgroundImage!, fit: BoxFit.cover)
            else
              Container(color: kColorBgSurface),
            Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    Colors.black.withValues(alpha: 0.15),
                    Colors.black.withValues(alpha: 0.75),
                  ],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  Text(
                    banner.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  if (banner.subtitle != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(
                        banner.subtitle!,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.85),
                          fontSize: 12,
                          height: 1.3,
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Continue reading ───────────────────────────────────────────────

class _ContinueReadingRow extends ConsumerWidget {
  const _ContinueReadingRow();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(continueReadingProvider);
    return async.when(
      loading: () => const SizedBox.shrink(),
      error: (_, __) => const SizedBox.shrink(),
      data: (items) {
        if (items.isEmpty) return const SizedBox.shrink();
        return Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const _SectionHeader(label: 'Continue Reading'),
              const SizedBox(height: 10),
              SizedBox(
                height: 96,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: items.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 10),
                  itemBuilder: (ctx, i) => _ContinueTile(item: items[i]),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _ContinueTile extends StatelessWidget {
  const _ContinueTile({required this.item});
  final ContinueReadingItem item;
  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final progress = (item.progress.progressPercentage / 100).clamp(0, 1).toDouble();
    return SizedBox(
      width: 280,
      child: Material(
        color: tokens.bgSurface,
        borderRadius: BorderRadius.circular(10),
        child: InkWell(
          borderRadius: BorderRadius.circular(10),
          onTap: () =>
              GoRouter.of(context).push(AppRoutes.ebookDetailPath(item.book.id)),
          child: Padding(
            padding: const EdgeInsets.all(10),
            child: Row(
              children: [
                _BookCover(url: item.book.coverImage, width: 50, height: 68),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        item.book.title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: tokens.textPrimary,
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          height: 1.25,
                        ),
                      ),
                      const SizedBox(height: 6),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(2),
                        child: LinearProgressIndicator(
                          value: progress,
                          minHeight: 3,
                          backgroundColor: tokens.borderCard,
                          color: kColorAccent,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        'Page ${item.progress.currentPage}/${item.progress.totalPages}',
                        style: TextStyle(color: tokens.textMuted, fontSize: 10),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ── Featured grid ──────────────────────────────────────────────────

class _FeaturedGrid extends ConsumerWidget {
  const _FeaturedGrid();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(featuredBooksProvider);
    return async.when(
      loading: () => const SizedBox.shrink(),
      error: (_, __) => const SizedBox.shrink(),
      data: (list) {
        if (list.isEmpty) return const SizedBox.shrink();
        return Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const _SectionHeader(label: 'Featured'),
              const SizedBox(height: 10),
              SizedBox(
                height: 200,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: list.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 10),
                  itemBuilder: (ctx, i) => _BookCard(book: list[i]),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _BookCard extends StatelessWidget {
  const _BookCard({required this.book});
  final Ebook book;
  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return SizedBox(
      width: 120,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(8),
          onTap: () => GoRouter.of(context).push(AppRoutes.ebookDetailPath(book.id)),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _BookCover(url: book.coverImage, width: 120, height: 160),
              const SizedBox(height: 6),
              Text(
                book.title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: tokens.textPrimary,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  height: 1.25,
                ),
              ),
              if (book.author != null && book.author!.isNotEmpty)
                Text(
                  book.author!,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: tokens.textMuted, fontSize: 10),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Categories ─────────────────────────────────────────────────────

class _CategoryChipsRow extends ConsumerWidget {
  const _CategoryChipsRow();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(ebookCategoriesProvider);
    final selected = ref.watch(selectedEbookCategorySlugProvider);
    return async.when(
      loading: () => const SizedBox.shrink(),
      error: (_, __) => const SizedBox.shrink(),
      data: (cats) {
        if (cats.isEmpty) return const SizedBox.shrink();
        return Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const _SectionHeader(label: 'Browse'),
              const SizedBox(height: 8),
              SizedBox(
                height: 34,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  children: [
                    _CategoryChip(
                      label: 'All',
                      selected: selected == null,
                      onTap: () =>
                          ref.read(selectedEbookCategorySlugProvider.notifier).state = null,
                    ),
                    ...cats.map(
                      (c) => _CategoryChip(
                        label: c.name,
                        selected: selected == c.slug,
                        onTap: () =>
                            ref.read(selectedEbookCategorySlugProvider.notifier).state = c.slug,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _CategoryChip extends StatelessWidget {
  const _CategoryChip({required this.label, required this.selected, required this.onTap});
  final String label;
  final bool selected;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 6),
      child: ChoiceChip(
        label: Text(
          label,
          style: TextStyle(
            color: selected ? Colors.white : const Color(0xFFa0a0a0),
            fontSize: 11,
            fontWeight: FontWeight.w700,
          ),
        ),
        selected: selected,
        onSelected: (_) => onTap(),
        backgroundColor: kColorBgSurface,
        selectedColor: kColorAccent,
        side: BorderSide(color: selected ? kColorAccent : kColorBorderCard),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 0),
        materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
      ),
    );
  }
}

// ── Library grid ───────────────────────────────────────────────────

class _LibraryGrid extends ConsumerWidget {
  const _LibraryGrid();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(ebookLibraryProvider);
    return async.when(
      loading: () => const Padding(
        padding: EdgeInsets.symmetric(vertical: 32),
        child: Center(child: CircularProgressIndicator(color: kColorAccent)),
      ),
      error: (e, _) => Padding(
        padding: const EdgeInsets.all(24),
        child: Center(
          child: Text('Could not load books.',
              style: TextStyle(color: context.tokens.textSecondary)),
        ),
      ),
      data: (books) {
        if (books.isEmpty) {
          return Padding(
            padding: const EdgeInsets.all(32),
            child: Center(
              child: Text(
                'No books yet.',
                style: TextStyle(color: context.tokens.textSecondary),
              ),
            ),
          );
        }
        return Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const _SectionHeader(label: 'Library'),
              const SizedBox(height: 10),
              GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 3,
                  mainAxisSpacing: 12,
                  crossAxisSpacing: 10,
                  childAspectRatio: 0.58,
                ),
                itemCount: books.length,
                itemBuilder: (ctx, i) => _BookCard(book: books[i]),
              ),
            ],
          ),
        );
      },
    );
  }
}

// ── Small helpers ──────────────────────────────────────────────────

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.label});
  final String label;
  @override
  Widget build(BuildContext context) {
    return Text(
      label,
      style: TextStyle(
        color: context.tokens.textSecondary,
        fontSize: 11,
        fontWeight: FontWeight.w800,
        letterSpacing: 1.2,
      ),
    );
  }
}

class _BookCover extends StatelessWidget {
  const _BookCover({required this.url, required this.width, required this.height});
  final String? url;
  final double width;
  final double height;
  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(6),
      child: (url == null || url!.isEmpty)
          ? Container(
              width: width,
              height: height,
              color: kColorBgInput,
              child: const Icon(Icons.menu_book, color: Color(0xFF444444), size: 28),
            )
          : CachedNetworkImage(
              imageUrl: url!,
              width: width,
              height: height,
              fit: BoxFit.cover,
              placeholder: (_, __) => Container(width: width, height: height, color: kColorBgInput),
              errorWidget: (_, __, ___) => Container(
                width: width,
                height: height,
                color: kColorBgInput,
                child: const Icon(Icons.menu_book, color: Color(0xFF444444), size: 28),
              ),
            ),
    );
  }
}
