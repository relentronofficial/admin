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

/// Series detail — hero cover, series description, episode list.
class PodcastSeriesScreen extends ConsumerWidget {
  const PodcastSeriesScreen({super.key, required this.seriesId});
  final String seriesId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = context.tokens;
    final async = ref.watch(seriesDetailProvider(seriesId));

    return Scaffold(
      backgroundColor: tokens.bgPage,
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator(color: kColorAccent)),
        error: (e, _) => Center(
          child: Text('Could not load series.', style: TextStyle(color: tokens.textSecondary)),
        ),
        data: (data) => CustomScrollView(
          slivers: [
            SliverAppBar(
              backgroundColor: tokens.bgSurface,
              foregroundColor: Colors.white,
              expandedHeight: 220,
              pinned: true,
              flexibleSpace: FlexibleSpaceBar(
                background: _HeroCover(coverUrl: data.series.coverImage),
                title: Text(
                  data.series.title,
                  style: const TextStyle(
                      color: Colors.white, fontSize: 15, fontWeight: FontWeight.w700),
                ),
                titlePadding: const EdgeInsetsDirectional.only(start: 56, bottom: 12, end: 16),
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (data.series.description != null && data.series.description!.isNotEmpty)
                      Text(
                        data.series.description!,
                        style:
                            TextStyle(color: tokens.textSecondary, fontSize: 13, height: 1.5),
                      ),
                    const SizedBox(height: 16),
                    Text(
                      '${data.episodes.length} EPISODE${data.episodes.length == 1 ? '' : 'S'}',
                      style: TextStyle(
                        color: tokens.textSecondary,
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.2,
                      ),
                    ),
                    const SizedBox(height: 10),
                  ],
                ),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 100),
              sliver: SliverList.separated(
                itemCount: data.episodes.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (ctx, i) =>
                    _SeriesEpisodeTile(episode: data.episodes[i], index: i + 1),
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

class _SeriesEpisodeTile extends ConsumerWidget {
  const _SeriesEpisodeTile({required this.episode, required this.index});
  final PodcastEpisode episode;
  final int index;
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
          if (context.mounted) GoRouter.of(context).push(AppRoutes.podcastPlayer);
        },
        child: Padding(
          padding: const EdgeInsets.all(10),
          child: Row(
            children: [
              SizedBox(
                width: 30,
                child: Text(
                  '$index',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: tokens.textMuted,
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
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
                    if (episode.durationSeconds > 0)
                      Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Text(
                          _formatDuration(episode.durationSeconds),
                          style: TextStyle(color: tokens.textMuted, fontSize: 11),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Container(
                decoration: const BoxDecoration(color: kColorAccent, shape: BoxShape.circle),
                padding: const EdgeInsets.all(8),
                child: const Icon(Icons.play_arrow, color: Colors.white, size: 16),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

String _formatDuration(int seconds) {
  final m = (seconds / 60).floor();
  if (m < 60) return '$m min';
  final h = (m / 60).floor();
  final rem = m % 60;
  return '${h}h ${rem}m';
}
