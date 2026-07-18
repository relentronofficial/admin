import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/routes.dart';
import '../../../shared/theme/design_constants.dart';
import '../../../shared/theme/theme_tokens.dart';
import '../data/podcast_player_controller.dart';
import '../domain/podcast_models.dart';
import '../providers/podcast_providers.dart';

/// Podcasts landing / browse screen. Continue-listening row at top,
/// featured series carousel, category chip filter, episode grid.
class PodcastsScreen extends ConsumerWidget {
  const PodcastsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = context.tokens;
    return Scaffold(
      backgroundColor: tokens.bgPage,
      appBar: AppBar(
        backgroundColor: tokens.bgSurface,
        elevation: 0,
        title: const Text('Podcasts',
            style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w700)),
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(podcastCategoriesProvider);
          ref.invalidate(featuredSeriesProvider);
          ref.invalidate(podcastEpisodesProvider);
          ref.invalidate(continueListeningProvider);
        },
        child: ListView(
          padding: const EdgeInsets.only(bottom: 100),
          children: const [
            _ContinueListeningSection(),
            _FeaturedSeriesSection(),
            _CategoryChipsRow(),
            _EpisodesGrid(),
          ],
        ),
      ),
    );
  }
}

// ── Continue listening ─────────────────────────────────────────────

class _ContinueListeningSection extends ConsumerWidget {
  const _ContinueListeningSection();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(continueListeningProvider);
    return async.when(
      loading: () => const SizedBox.shrink(),
      error: (_, __) => const SizedBox.shrink(),
      data: (items) {
        if (items.isEmpty) return const SizedBox.shrink();
        return Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const _SectionHeader(label: 'Continue Listening'),
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

class _ContinueTile extends ConsumerWidget {
  const _ContinueTile({required this.item});
  final ContinueListeningItem item;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = context.tokens;
    final progress = item.episode.durationSeconds > 0
        ? (item.progress.currentPositionSeconds / item.episode.durationSeconds).clamp(0, 1).toDouble()
        : 0.0;
    return SizedBox(
      width: 280,
      child: Material(
        color: tokens.bgSurface,
        borderRadius: BorderRadius.circular(10),
        child: InkWell(
          borderRadius: BorderRadius.circular(10),
          onTap: () async {
            await ref
                .read(podcastPlayerControllerProvider)
                .playEpisode(item.episode, resumeAtSeconds: item.progress.currentPositionSeconds);
            if (context.mounted) {
              GoRouter.of(context).push(AppRoutes.podcastPlayer);
            }
          },
          child: Padding(
            padding: const EdgeInsets.all(10),
            child: Row(
              children: [
                _Cover(url: item.episode.coverImage, size: 56, radius: 8),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        item.episode.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: tokens.textPrimary,
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        item.episode.speaker ?? item.episode.category?.name ?? '',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(color: tokens.textMuted, fontSize: 11),
                      ),
                      const SizedBox(height: 8),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(2),
                        child: LinearProgressIndicator(
                          value: progress,
                          minHeight: 3,
                          backgroundColor: tokens.borderCard,
                          color: kColorAccent,
                        ),
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

// ── Featured series ────────────────────────────────────────────────

class _FeaturedSeriesSection extends ConsumerWidget {
  const _FeaturedSeriesSection();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(featuredSeriesProvider);
    return async.when(
      loading: () => const Padding(
        padding: EdgeInsets.symmetric(vertical: 16),
        child: Center(child: CircularProgressIndicator(color: kColorAccent)),
      ),
      error: (_, __) => const SizedBox.shrink(),
      data: (list) {
        if (list.isEmpty) return const SizedBox.shrink();
        return Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const _SectionHeader(label: 'Series'),
              const SizedBox(height: 10),
              SizedBox(
                height: 170,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: list.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 10),
                  itemBuilder: (ctx, i) => _SeriesCard(series: list[i]),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _SeriesCard extends StatelessWidget {
  const _SeriesCard({required this.series});
  final PodcastSeries series;
  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return SizedBox(
      width: 130,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(8),
          onTap: () =>
              GoRouter.of(context).push(AppRoutes.podcastSeriesDetailPath(series.id)),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _Cover(url: series.coverImage, size: 130, radius: 8, fallback: Icons.headset_mic),
              const SizedBox(height: 6),
              Text(
                series.title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: tokens.textPrimary,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
              if (series.episodesCount != null)
                Text(
                  '${series.episodesCount} episodes',
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
    final async = ref.watch(podcastCategoriesProvider);
    final selected = ref.watch(selectedCategorySlugProvider);
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
              const _SectionHeader(label: 'Categories'),
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
                          ref.read(selectedCategorySlugProvider.notifier).state = null,
                    ),
                    ...cats.map(
                      (c) => _CategoryChip(
                        label: c.name,
                        selected: selected == c.slug,
                        onTap: () =>
                            ref.read(selectedCategorySlugProvider.notifier).state = c.slug,
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

// ── Episodes grid ──────────────────────────────────────────────────

class _EpisodesGrid extends ConsumerWidget {
  const _EpisodesGrid();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(podcastEpisodesProvider);
    return async.when(
      loading: () => const Padding(
        padding: EdgeInsets.symmetric(vertical: 32),
        child: Center(child: CircularProgressIndicator(color: kColorAccent)),
      ),
      error: (e, _) => Padding(
        padding: const EdgeInsets.all(24),
        child: Center(
          child: Text('Could not load episodes.',
              style: TextStyle(color: context.tokens.textSecondary)),
        ),
      ),
      data: (episodes) {
        if (episodes.isEmpty) {
          return Padding(
            padding: const EdgeInsets.all(32),
            child: Center(
              child: Text(
                'No episodes yet.',
                style: TextStyle(color: context.tokens.textSecondary),
              ),
            ),
          );
        }
        return Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const _SectionHeader(label: 'Episodes'),
              const SizedBox(height: 10),
              ...episodes.map((ep) => Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: _EpisodeTile(episode: ep),
                  )),
            ],
          ),
        );
      },
    );
  }
}

class _EpisodeTile extends ConsumerWidget {
  const _EpisodeTile({required this.episode});
  final PodcastEpisode episode;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = context.tokens;
    return Material(
      color: tokens.bgSurface,
      borderRadius: BorderRadius.circular(10),
      child: InkWell(
        borderRadius: BorderRadius.circular(10),
        onTap: () async {
          await ref.read(podcastPlayerControllerProvider).playEpisode(episode);
          if (context.mounted) {
            GoRouter.of(context).push(AppRoutes.podcastPlayer);
          }
        },
        child: Padding(
          padding: const EdgeInsets.all(10),
          child: Row(
            children: [
              _Cover(url: episode.coverImage, size: 60, radius: 8),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      episode.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: tokens.textPrimary,
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        height: 1.3,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      _subtitleFor(episode),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(color: tokens.textMuted, fontSize: 11),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 6),
              Container(
                decoration: const BoxDecoration(color: kColorAccent, shape: BoxShape.circle),
                padding: const EdgeInsets.all(10),
                child: const Icon(Icons.play_arrow, color: Colors.white, size: 18),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _subtitleFor(PodcastEpisode e) {
    final parts = <String>[];
    if (e.speaker != null && e.speaker!.isNotEmpty) parts.add(e.speaker!);
    if (e.durationSeconds > 0) parts.add(_formatDuration(e.durationSeconds));
    if (e.category != null) parts.add(e.category!.name);
    return parts.join(' · ');
  }
}

String _formatDuration(int seconds) {
  final m = (seconds / 60).floor();
  if (m < 60) return '$m min';
  final h = (m / 60).floor();
  final rem = m % 60;
  return '${h}h ${rem}m';
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

class _Cover extends StatelessWidget {
  const _Cover({
    required this.url,
    required this.size,
    required this.radius,
    this.fallback = Icons.mic_none,
  });
  final String? url;
  final double size;
  final double radius;
  final IconData fallback;
  @override
  Widget build(BuildContext context) {
    if (url == null || url!.isEmpty) {
      return Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: kColorBgInput,
          borderRadius: BorderRadius.circular(radius),
        ),
        child: Icon(fallback, color: const Color(0xFF444444), size: size / 3),
      );
    }
    return ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: CachedNetworkImage(
        imageUrl: url!,
        width: size,
        height: size,
        fit: BoxFit.cover,
        placeholder: (_, __) => Container(width: size, height: size, color: kColorBgInput),
        errorWidget: (_, __, ___) => Container(
          width: size,
          height: size,
          color: kColorBgInput,
          child: Icon(fallback, color: const Color(0xFF444444), size: size / 3),
        ),
      ),
    );
  }
}
