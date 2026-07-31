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
/// Renders only when [PodcastPlayerController.currentEpisode] is non-null.
///
/// Interactions:
///   * Tap the cover / title area → opens the full-screen player.
///   * Swipe up on the tile → opens the full-screen player.
///   * Skip back 10s / play-pause / close X buttons remain inline.
///
/// Layout:
///   * 74 px total height (progress bar 2 + row 72)
///   * Cover 48 × 48 radius 8 (was 42×42 radius 6)
///   * Thin 2 px `#E50914` progress bar hugging the top edge
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
            // Row: swipe-up gesture opens the full player; taps on
            // buttons handled by the button widgets themselves.
            GestureDetector(
              behavior: HitTestBehavior.opaque,
              onVerticalDragEnd: (details) {
                final v = details.primaryVelocity ?? 0;
                if (v < -300) {
                  GoRouter.of(context).push(AppRoutes.podcastPlayer);
                }
              },
              child: SizedBox(
                height: 72,
                child: Padding(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  child: Row(
                    children: [
                      // Cover + title → tap opens full player.
                      Expanded(
                        child: InkWell(
                          borderRadius: BorderRadius.circular(8),
                          onTap: () => GoRouter.of(context)
                              .push(AppRoutes.podcastPlayer),
                          child: Row(
                            children: [
                              ClipRRect(
                                borderRadius: BorderRadius.circular(8),
                                child: (ep.coverImage != null &&
                                        ep.coverImage!.isNotEmpty)
                                    ? CachedNetworkImage(
                                        imageUrl: ep.coverImage!,
                                        width: 48,
                                        height: 48,
                                        fit: BoxFit.cover,
                                        memCacheWidth: (48 *
                                                MediaQuery.devicePixelRatioOf(
                                                    context))
                                            .round(),
                                        memCacheHeight: (48 *
                                                MediaQuery.devicePixelRatioOf(
                                                    context))
                                            .round(),
                                      )
                                    : Container(
                                        width: 48,
                                        height: 48,
                                        color: kColorBgInput,
                                        child: const Icon(Icons.mic_none,
                                            color: Color(0xFF666666),
                                            size: 20),
                                      ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.start,
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Text(
                                      ep.title,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: TextStyle(
                                        color: tokens.textPrimary,
                                        fontSize: 12.5,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      ep.speaker ??
                                          ep.category?.name ??
                                          'Podcast',
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: TextStyle(
                                          color: tokens.textMuted,
                                          fontSize: 10.5),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(width: 4),
                      // Skip back 10s
                      IconButton(
                        iconSize: 22,
                        padding: const EdgeInsets.all(6),
                        constraints:
                            const BoxConstraints(minWidth: 32, minHeight: 32),
                        icon: Icon(Icons.replay_10,
                            color: tokens.textSecondary),
                        onPressed: () => ctl.skipBackward(10),
                        tooltip: 'Back 10s',
                      ),
                      // Play/pause with loading state
                      StreamBuilder<PlayerState>(
                        stream: ctl.player.playerStateStream,
                        builder: (ctx, snap) {
                          final state = snap.data;
                          final loading = state?.processingState ==
                                  ProcessingState.loading ||
                              state?.processingState ==
                                  ProcessingState.buffering;
                          final playing = state?.playing ?? false;
                          if (loading) {
                            return const Padding(
                              padding: EdgeInsets.all(10),
                              child: SizedBox(
                                width: 22,
                                height: 22,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: kColorAccent,
                                ),
                              ),
                            );
                          }
                          return IconButton(
                            iconSize: 30,
                            padding: const EdgeInsets.all(4),
                            constraints: const BoxConstraints(
                                minWidth: 36, minHeight: 36),
                            icon: Icon(
                              playing
                                  ? Icons.pause_circle_filled
                                  : Icons.play_circle_fill,
                              color: kColorAccent,
                            ),
                            onPressed: ctl.togglePlay,
                          );
                        },
                      ),
                      IconButton(
                        iconSize: 18,
                        padding: const EdgeInsets.all(6),
                        constraints:
                            const BoxConstraints(minWidth: 30, minHeight: 30),
                        icon:
                            Icon(Icons.close, color: tokens.textSecondary),
                        onPressed: () async {
                          await ctl.stopAndClear();
                        },
                        tooltip: 'Close',
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
