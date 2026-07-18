import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:just_audio/just_audio.dart';

import '../../../core/constants/routes.dart';
import '../../../shared/theme/design_constants.dart';
import '../../../shared/theme/theme_tokens.dart';
import '../data/podcast_player_controller.dart';

/// Slim persistent overlay pinned above the bottom nav shell.
///
/// Renders only when `PodcastPlayerController.currentEpisode != null`.
/// Tapping the tile opens the full player. Play/pause is inline. A
/// thin progress bar hugs the top edge for at-a-glance context.
class PodcastMiniPlayer extends ConsumerWidget {
  const PodcastMiniPlayer({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ctl = ref.watch(podcastPlayerControllerProvider);
    final ep = ctl.currentEpisode;
    if (ep == null) return const SizedBox.shrink();

    final tokens = context.tokens;
    return Material(
      color: tokens.bgSurface,
      elevation: 8,
      child: InkWell(
        onTap: () => GoRouter.of(context).push(AppRoutes.podcastPlayer),
        child: Container(
          decoration: BoxDecoration(
            border: Border(
              top: BorderSide(color: tokens.borderCard, width: 1),
            ),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Thin progress bar hugging the top edge.
              StreamBuilder<Duration>(
                stream: ctl.player.positionStream,
                builder: (ctx, snap) {
                  final pos = snap.data ?? Duration.zero;
                  final total = ctl.totalDuration.inSeconds;
                  final ratio = total > 0
                      ? (pos.inSeconds / total).clamp(0.0, 1.0).toDouble()
                      : 0.0;
                  return LinearProgressIndicator(
                    value: ratio,
                    minHeight: 2,
                    backgroundColor: Colors.transparent,
                    color: kColorAccent,
                  );
                },
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                child: Row(
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(6),
                      child: (ep.coverImage != null && ep.coverImage!.isNotEmpty)
                          ? CachedNetworkImage(
                              imageUrl: ep.coverImage!,
                              width: 42,
                              height: 42,
                              fit: BoxFit.cover,
                            )
                          : Container(
                              width: 42,
                              height: 42,
                              color: kColorBgInput,
                              child: const Icon(Icons.mic_none,
                                  color: Color(0xFF666666), size: 18),
                            ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            ep.title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: tokens.textPrimary,
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          Text(
                            ep.speaker ?? ep.category?.name ?? 'Podcast',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(color: tokens.textMuted, fontSize: 10),
                          ),
                        ],
                      ),
                    ),
                    StreamBuilder<PlayerState>(
                      stream: ctl.player.playerStateStream,
                      builder: (ctx, snap) {
                        final state = snap.data;
                        final loading =
                            state?.processingState == ProcessingState.loading ||
                                state?.processingState == ProcessingState.buffering;
                        final playing = state?.playing ?? false;
                        if (loading) {
                          return const Padding(
                            padding: EdgeInsets.all(10),
                            child: SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: kColorAccent,
                              ),
                            ),
                          );
                        }
                        return IconButton(
                          iconSize: 26,
                          icon: Icon(
                            playing ? Icons.pause_circle_filled : Icons.play_circle_fill,
                            color: kColorAccent,
                          ),
                          onPressed: ctl.togglePlay,
                        );
                      },
                    ),
                    IconButton(
                      iconSize: 20,
                      icon: Icon(Icons.close, color: tokens.textSecondary),
                      onPressed: () async {
                        await ctl.stopAndClear();
                      },
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
