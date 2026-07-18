import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:just_audio/just_audio.dart';

import '../../../shared/theme/design_constants.dart';
import '../../../shared/theme/theme_tokens.dart';
import '../data/podcast_player_controller.dart';

/// Full-screen podcast player. Shows cover, title, scrub bar, play/
/// pause + 15s skip, current speaker/category chips. Progress writes
/// happen inside PodcastPlayerController — this screen is pure UI.
class PodcastPlayerScreen extends ConsumerWidget {
  const PodcastPlayerScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = context.tokens;
    final ctl = ref.watch(podcastPlayerControllerProvider);
    final ep = ctl.currentEpisode;

    if (ep == null) {
      return Scaffold(
        backgroundColor: tokens.bgPage,
        appBar: AppBar(backgroundColor: tokens.bgSurface, elevation: 0),
        body: Center(
          child: Text('No episode selected.',
              style: TextStyle(color: tokens.textSecondary)),
        ),
      );
    }

    return Scaffold(
      backgroundColor: tokens.bgPage,
      appBar: AppBar(
        backgroundColor: tokens.bgSurface,
        elevation: 0,
        foregroundColor: Colors.white,
        title: const Text('Now Playing',
            style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w700)),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
          child: Column(
            children: [
              const SizedBox(height: 12),
              _Artwork(url: ep.coverImage),
              const SizedBox(height: 28),
              Text(
                ep.title,
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: tokens.textPrimary,
                  fontSize: 19,
                  fontWeight: FontWeight.w800,
                  height: 1.25,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                [
                  if (ep.speaker != null) ep.speaker!,
                  if (ep.category != null) ep.category!.name,
                ].join(' · '),
                style: TextStyle(color: tokens.textSecondary, fontSize: 13),
              ),
              const SizedBox(height: 24),
              _ScrubBar(ctl: ctl),
              const SizedBox(height: 12),
              _Transport(ctl: ctl),
            ],
          ),
        ),
      ),
    );
  }
}

class _Artwork extends StatelessWidget {
  const _Artwork({required this.url});
  final String? url;
  @override
  Widget build(BuildContext context) {
    return AspectRatio(
      aspectRatio: 1,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: url != null && url!.isNotEmpty
            ? CachedNetworkImage(
                imageUrl: url!,
                fit: BoxFit.cover,
                placeholder: (_, __) => Container(color: kColorBgSurface),
                errorWidget: (_, __, ___) => Container(
                  color: kColorBgSurface,
                  child: const Icon(Icons.mic_none, color: Color(0xFF444444), size: 64),
                ),
              )
            : Container(
                color: kColorBgSurface,
                child: const Icon(Icons.mic_none, color: Color(0xFF444444), size: 64),
              ),
      ),
    );
  }
}

class _ScrubBar extends StatelessWidget {
  const _ScrubBar({required this.ctl});
  final PodcastPlayerController ctl;
  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    // Combine positionStream + duration so the slider updates smoothly.
    return StreamBuilder<Duration>(
      stream: ctl.player.positionStream,
      builder: (ctx, snap) {
        final pos = snap.data ?? Duration.zero;
        final total = ctl.totalDuration;
        final maxSeconds = total.inSeconds.toDouble().clamp(1.0, double.infinity);
        final safePos = pos.inSeconds.toDouble().clamp(0.0, maxSeconds);
        return Column(
          children: [
            SliderTheme(
              data: SliderThemeData(
                trackHeight: 3,
                thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 6),
                overlayShape: const RoundSliderOverlayShape(overlayRadius: 14),
                activeTrackColor: kColorAccent,
                inactiveTrackColor: tokens.borderCard,
                thumbColor: kColorAccent,
                overlayColor: kColorAccent.withValues(alpha: 0.15),
              ),
              child: Slider(
                value: safePos,
                min: 0,
                max: maxSeconds,
                onChanged: (v) => ctl.seek(Duration(seconds: v.round())),
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(_fmt(pos), style: TextStyle(color: tokens.textMuted, fontSize: 11)),
                  Text(_fmt(total), style: TextStyle(color: tokens.textMuted, fontSize: 11)),
                ],
              ),
            ),
          ],
        );
      },
    );
  }
}

class _Transport extends StatelessWidget {
  const _Transport({required this.ctl});
  final PodcastPlayerController ctl;
  @override
  Widget build(BuildContext context) {
    return StreamBuilder<PlayerState>(
      stream: ctl.player.playerStateStream,
      builder: (ctx, snap) {
        final state = snap.data;
        final loading = state?.processingState == ProcessingState.loading ||
            state?.processingState == ProcessingState.buffering;
        final playing = state?.playing ?? false;
        return Row(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: [
            IconButton(
              iconSize: 32,
              icon: const Icon(Icons.replay_10, color: Colors.white),
              onPressed: () => ctl.skipBackward(10),
            ),
            Container(
              width: 70,
              height: 70,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                color: kColorAccent,
              ),
              child: loading
                  ? const Padding(
                      padding: EdgeInsets.all(20),
                      child: CircularProgressIndicator(
                        color: Colors.white,
                        strokeWidth: 2.5,
                      ),
                    )
                  : IconButton(
                      iconSize: 34,
                      icon: Icon(
                        playing ? Icons.pause : Icons.play_arrow,
                        color: Colors.white,
                      ),
                      onPressed: ctl.togglePlay,
                    ),
            ),
            IconButton(
              iconSize: 32,
              icon: const Icon(Icons.forward_10, color: Colors.white),
              onPressed: () => ctl.skipForward(10),
            ),
          ],
        );
      },
    );
  }
}

String _fmt(Duration d) {
  String two(int n) => n.toString().padLeft(2, '0');
  final h = d.inHours;
  final m = d.inMinutes.remainder(60);
  final s = d.inSeconds.remainder(60);
  return h > 0 ? '${two(h)}:${two(m)}:${two(s)}' : '${two(m)}:${two(s)}';
}
