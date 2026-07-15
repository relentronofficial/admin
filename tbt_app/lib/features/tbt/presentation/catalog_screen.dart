import '../../../shared/widgets/app_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shimmer/shimmer.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/constants/routes.dart';
import '../../../shared/models/content_section.dart';
import '../../../shared/theme/design_constants.dart';
import '../data/catalog_service.dart';
import '../providers/catalog_provider.dart';

import '../../../shared/theme/theme_tokens.dart';
class CatalogScreen extends ConsumerWidget {
  const CatalogScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final heroAsync = ref.watch(heroProvider);
    final sectionsAsync = ref.watch(catalogSectionsProvider);

    return Scaffold(
      appBar: AppBar(
        backgroundColor: context.tokens.bgSurface,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: Text(
          'EXPLORE',
          style: TextStyle(
            fontFamily: 'Rajdhani',
            fontSize: 17,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.5,
            color: context.tokens.textPrimary,
          ),
        ),
        actions: [
          IconButton(
            icon: Icon(Icons.refresh, color: context.tokens.textMuted, size: 20),
            onPressed: () {
              ref.invalidate(heroProvider);
              ref.invalidate(catalogSectionsProvider);
            },
          ),
        ],
      ),
      body: RefreshIndicator(
        color: Theme.of(context).colorScheme.primary,
        backgroundColor: context.tokens.bgSurface,
        onRefresh: () async {
          ref.invalidate(heroProvider);
          ref.invalidate(catalogSectionsProvider);
          await ref.read(catalogSectionsProvider.future);
        },
        child: CustomScrollView(
          slivers: [
            // ── Hero banner ───────────────────────────────────────────────
            SliverToBoxAdapter(
              child: heroAsync.when(
                loading: () => _HeroShimmer(),
                error: (_, __) => const SizedBox.shrink(),
                data: (hero) {
                  if (hero.slides.isEmpty) return const SizedBox.shrink();
                  return _HeroBanner(
                    slide: hero.slides.first,
                    onTap: () => _handleCtaTap(context, hero.slides.first),
                  );
                },
              ),
            ),

            // ── Sections ──────────────────────────────────────────────────
            sectionsAsync.when(
              loading: () => SliverList(
                delegate: SliverChildBuilderDelegate(
                  (_, i) => _SectionShimmer(),
                  childCount: 3,
                ),
              ),
              error: (_, __) => SliverToBoxAdapter(
                child: _ErrorView(onRetry: () {
                  ref.invalidate(catalogSectionsProvider);
                }),
              ),
              data: (sections) {
                if (sections.isEmpty) {
                  return const SliverToBoxAdapter(
                    child: _EmptyView(),
                  );
                }
                return SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (_, i) => _ContentSection(
                      section: sections[i],
                      onItemTap: (item) => _navigateToItem(context, item),
                    ),
                    childCount: sections.length,
                  ),
                );
              },
            ),

            const SliverToBoxAdapter(child: SizedBox(height: 24)),
          ],
        ),
      ),
    );
  }

  void _navigateToItem(BuildContext context, CatalogItem item) {
    if (item.isLocked) return;

    switch (item.type) {
      case CatalogItemType.workshop:
        final id = item.workshopId ?? item.id;
        context.push(AppRoutes.workshopDetailPath(id));
      case CatalogItemType.course:
        final id = item.courseId ?? item.id;
        context.push(AppRoutes.courseDetailPath(id));
      case CatalogItemType.resource:
        final url = item.playUrl;
        if (url != null && url.isNotEmpty) {
          launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
        }
    }
  }

  Future<void> _handleCtaTap(BuildContext context, HeroSlide slide) async {
    final url = slide.ctaUrl;
    if (url.isEmpty) return;

    if (slide.ctaType == 'internal') {
      context.push(url);
    } else {
      final uri = Uri.tryParse(url);
      if (uri != null) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      }
    }
  }
}

// ── Hero banner ───────────────────────────────────────────────────────────────

class _HeroBanner extends StatelessWidget {
  const _HeroBanner({required this.slide, required this.onTap});

  final HeroSlide slide;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: slide.title,
      button: true,
      child: GestureDetector(
      onTap: onTap,
      child: Container(
        height: 200,
        margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: context.tokens.bgSurface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: context.tokens.borderCard),
        ),
        clipBehavior: Clip.antiAlias,
        child: Stack(
          fit: StackFit.expand,
          children: [
            AppNetworkImage(
              url: slide.bgImageUrl,
              width: 800,
              fit: BoxFit.cover,
            ),
            // Gradient overlay
            Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Colors.transparent,
                    Colors.black.withValues(alpha: 0.75),
                  ],
                ),
              ),
            ),
            // Text content
            Positioned(
              left: 16,
              right: 16,
              bottom: 16,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (slide.badgeText != null)
                    Container(
                      margin: const EdgeInsets.only(bottom: 6),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: Theme.of(context).colorScheme.primary,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        slide.badgeText!,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ),
                  Text(
                    slide.title,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      height: 1.2,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (slide.description != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      slide.description!,
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.8),
                        fontSize: 12,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                  const SizedBox(height: 10),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 7),
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.primary,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      slide.ctaLabel,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      ),
    );
  }
}

// ── Content section ───────────────────────────────────────────────────────────

class _ContentSection extends StatelessWidget {
  const _ContentSection({
    required this.section,
    required this.onItemTap,
  });

  final ContentSection section;
  final void Function(CatalogItem) onItemTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    section.title.toUpperCase(),
                    style: TextStyle(
                      fontFamily: 'Rajdhani',
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1.5,
                      color: context.tokens.textMuted,
                    ),
                  ),
                ),
                if (section.isLocked)
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: kColorLocked.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.lock_outline,
                            color: context.tokens.textMuted, size: 10),
                        const SizedBox(width: 3),
                        Text(
                          section.lockLabel ?? 'Locked',
                          style: TextStyle(
                            color: context.tokens.textMuted,
                            fontSize: 9,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 0.3,
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          SizedBox(
            height: 160,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              itemCount: section.items.length,
              itemBuilder: (_, i) => RepaintBoundary(
                child: _CatalogCard(
                  item: section.items[i],
                  onTap: () => onItemTap(section.items[i]),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Catalog item card ─────────────────────────────────────────────────────────

class _CatalogCard extends StatelessWidget {
  const _CatalogCard({required this.item, required this.onTap});

  final CatalogItem item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: '${item.title}${item.isLocked ? ', locked' : ''}',
      button: true,
      child: GestureDetector(
      onTap: item.isLocked ? null : onTap,
      child: Container(
        width: 140,
        margin: const EdgeInsets.only(right: 10),
        decoration: BoxDecoration(
          color: context.tokens.bgSurface,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: context.tokens.borderCard),
        ),
        clipBehavior: Clip.antiAlias,
        child: Stack(
          fit: StackFit.expand,
          children: [
            // Thumbnail
            AppNetworkImage(
              url: item.thumbnailUrl,
              width: 400,
              fit: BoxFit.cover,
              fallbackIcon: Icons.play_circle_outline,
            ),

            // Bottom gradient + info
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: Container(
                padding: const EdgeInsets.fromLTRB(8, 20, 8, 8),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.transparent,
                      Colors.black.withValues(alpha: 0.85),
                    ],
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.title,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        height: 1.3,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (item.episodeCount != null) ...[
                      const SizedBox(height: 3),
                      Text(
                        '${item.episodeCount} episodes',
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.6),
                          fontSize: 9,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),

            // Category chip
            if (item.categoryTag != null)
              Positioned(
                top: 6,
                left: 6,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 5, vertical: 2),
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.85),
                    borderRadius: BorderRadius.circular(3),
                  ),
                  child: Text(
                    item.categoryTag!.toUpperCase(),
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 8,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.3,
                    ),
                  ),
                ),
              ),

            // Locked overlay — matches the web tier-locked card overlay.
            if (item.isLocked)
              Container(
                color: Colors.black.withValues(alpha: 0.68),
                padding: const EdgeInsets.symmetric(horizontal: 8),
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.lock_outline,
                          color: Colors.white, size: 22),
                      const SizedBox(height: 6),
                      Text(
                        item.lockBadgeText ??
                            'Upgrade your tier to unlock this content.',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                          height: 1.3,
                        ),
                        textAlign: TextAlign.center,
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
      ),
    );
  }
}

// ── Shimmer skeletons ─────────────────────────────────────────────────────────

class _HeroShimmer extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Shimmer.fromColors(
      baseColor: context.tokens.bgSurface,
      highlightColor: context.tokens.bgInput,
      child: Container(
        height: 200,
        margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: context.tokens.bgSurface,
          borderRadius: BorderRadius.circular(12),
        ),
      ),
    );
  }
}

class _SectionShimmer extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Shimmer.fromColors(
            baseColor: context.tokens.bgSurface,
            highlightColor: context.tokens.bgInput,
            child: Container(
              height: 14,
              width: 120,
              margin: const EdgeInsets.symmetric(horizontal: 16),
              decoration: BoxDecoration(
                color: context.tokens.bgSurface,
                borderRadius: BorderRadius.circular(4),
              ),
            ),
          ),
          const SizedBox(height: 10),
          SizedBox(
            height: 160,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              itemCount: 4,
              itemBuilder: (_, __) => Shimmer.fromColors(
                baseColor: context.tokens.bgSurface,
                highlightColor: context.tokens.bgInput,
                child: Container(
                  width: 140,
                  margin: const EdgeInsets.only(right: 10),
                  decoration: BoxDecoration(
                    color: context.tokens.bgSurface,
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Error + empty states ──────────────────────────────────────────────────────

class _ErrorView extends StatelessWidget {
  const _ErrorView({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.error_outline, color: context.tokens.textMuted, size: 40),
            const SizedBox(height: 12),
            Text(
              'Failed to load content',
              style: TextStyle(color: context.tokens.textSecondary),
            ),
            const SizedBox(height: 12),
            TextButton(onPressed: onRetry, child: const Text('Retry')),
          ],
        ),
      ),
    );
  }
}

class _EmptyView extends StatelessWidget {
  const _EmptyView();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.video_library_outlined,
                color: context.tokens.textMuted, size: 40),
            SizedBox(height: 12),
            Text(
              'No content available',
              style: TextStyle(color: context.tokens.textSecondary, fontSize: 14),
            ),
          ],
        ),
      ),
    );
  }
}
