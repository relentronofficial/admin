import 'dart:math' as math;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:just_audio/just_audio.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../shared/theme/design_constants.dart';
import '../../../shared/theme/theme_tokens.dart';
import '../data/podcast_player_controller.dart';

/// Full-screen podcast player.
///
/// Sections (top → bottom):
///   * App bar with Bookmark heart toggle
///   * Square cover artwork
///   * Title (19 w800, 2 lines) + speaker/category chips row
///   * 45-bar animated waveform above the scrubber
///   * MM:SS scrubber with elapsed/total labels
///   * Transport row: prev · replay-10 · play/pause 70 · forward-10 · next
///   * Speed cycler chip below transport
class PodcastPlayerScreen extends ConsumerStatefulWidget {
  const PodcastPlayerScreen({super.key});

  @override
  ConsumerState<PodcastPlayerScreen> createState() =>
      _PodcastPlayerScreenState();
}

class _PodcastPlayerScreenState extends ConsumerState<PodcastPlayerScreen> {
  static const _bookmarksKey = 'tbt_podcast_bookmarks';
  Set<String> _bookmarks = <String>{};

  @override
  void initState() {
    super.initState();
    _loadBookmarks();
  }

  Future<void> _loadBookmarks() async {
    final prefs = await SharedPreferences.getInstance();
    final list = prefs.getStringList(_bookmarksKey) ?? const [];
    if (!mounted) return;
    setState(() => _bookmarks = list.toSet());
  }

  Future<void> _toggleBookmark(String episodeId) async {
    final prefs = await SharedPreferences.getInstance();
    final next = Set<String>.of(_bookmarks);
    if (next.contains(episodeId)) {
      next.remove(episodeId);
    } else {
      next.add(episodeId);
    }
    await prefs.setStringList(_bookmarksKey, next.toList());
    if (!mounted) return;
    setState(() => _bookmarks = next);
  }

  @override
  Widget build(BuildContext context) {
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

    final bookmarked = _bookmarks.contains(ep.id);

    return Scaffold(
      backgroundColor: tokens.bgPage,
      appBar: AppBar(
        backgroundColor: tokens.bgSurface,
        elevation: 0,
        foregroundColor: tokens.textPrimary,
        title: Text(
          'Now Playing',
          style: TextStyle(
            color: tokens.textPrimary,
            fontSize: 14,
            fontWeight: FontWeight.w700,
          ),
        ),
        actions: [
          IconButton(
            icon: Icon(
              bookmarked ? Icons.favorite : Icons.favorite_border,
              color: bookmarked ? kColorAccent : tokens.textPrimary,
            ),
            onPressed: () => _toggleBookmark(ep.id),
            tooltip: bookmarked ? 'Remove bookmark' : 'Bookmark',
          ),
        ],
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
          child: Column(
            children: [
              const SizedBox(height: 8),
              Expanded(
                child: LayoutBuilder(builder: (ctx, constraints) {
                  // Cap artwork to the smaller of screen width or 340 dp so
                  // it doesn't dominate the screen on tablets while still
                  // being generous on phones.
                  final artwork =
                      math.min(constraints.maxWidth, 340.0).toDouble();
                  return SingleChildScrollView(
                    physics: const ClampingScrollPhysics(),
                    child: Column(
                      children: [
                        Center(
                          child: SizedBox(
                            width: artwork,
                            height: artwork,
                            child: _Artwork(url: ep.coverImage),
                          ),
                        ),
                        const SizedBox(height: 24),
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
                        const SizedBox(height: 8),
                        _MetaChips(
                          speaker: ep.speaker,
                          category: ep.category?.name,
                        ),
                      ],
                    ),
                  );
                }),
              ),
              const SizedBox(height: 12),
              _Waveform(player: ctl.player),
              const SizedBox(height: 6),
              _ScrubBar(ctl: ctl),
              const SizedBox(height: 8),
              _Transport(ctl: ctl),
              const SizedBox(height: 10),
              _SpeedChip(ctl: ctl),
              const SizedBox(height: 8),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Artwork ────────────────────────────────────────────────────────

class _Artwork extends StatelessWidget {
  const _Artwork({required this.url});
  final String? url;
  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: url != null && url!.isNotEmpty
          ? CachedNetworkImage(
              imageUrl: url!,
              fit: BoxFit.cover,
              placeholder: (_, __) => Container(color: kColorBgSurface),
              errorWidget: (_, __, ___) => Container(
                color: kColorBgSurface,
                child: const Icon(Icons.mic_none,
                    color: Color(0xFF444444), size: 64),
              ),
            )
          : Container(
              color: kColorBgSurface,
              child: const Icon(Icons.mic_none,
                  color: Color(0xFF444444), size: 64),
            ),
    );
  }
}

// ── Meta chips (speaker + category) ────────────────────────────────

class _MetaChips extends StatelessWidget {
  const _MetaChips({this.speaker, this.category});
  final String? speaker;
  final String? category;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    Widget chip(IconData icon, String label, Color tint) => Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          decoration: BoxDecoration(
            color: tint.withValues(alpha: 0.10),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: tint.withValues(alpha: 0.30)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 12, color: tint),
              const SizedBox(width: 5),
              Text(
                label,
                style: TextStyle(
                  color: tokens.textPrimary,
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        );

    return Wrap(
      alignment: WrapAlignment.center,
      spacing: 8,
      runSpacing: 6,
      children: [
        if (speaker != null && speaker!.isNotEmpty)
          chip(Icons.person, speaker!, const Color(0xFF2F80ED)),
        if (category != null && category!.isNotEmpty)
          chip(Icons.category, category!, const Color(0xFFF59E0B)),
      ],
    );
  }
}

// ── Animated 45-bar waveform ───────────────────────────────────────

class _Waveform extends StatefulWidget {
  const _Waveform({required this.player});
  final AudioPlayer player;

  @override
  State<_Waveform> createState() => _WaveformState();
}

class _WaveformState extends State<_Waveform>
    with SingleTickerProviderStateMixin {
  static const int _barCount = 45;
  late final AnimationController _ctrl;
  // Fixed per-bar phase seeds so heights look "spectrum-y" rather than
  // pure sine — a tiny bit of pseudo-randomness makes it feel alive.
  late final List<double> _seeds;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat();
    final rng = math.Random(7);
    _seeds = List.generate(_barCount, (_) => rng.nextDouble() * math.pi * 2);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return SizedBox(
      height: 44,
      child: StreamBuilder<PlayerState>(
        stream: widget.player.playerStateStream,
        builder: (ctx, snap) {
          final playing = snap.data?.playing ?? false;
          return AnimatedBuilder(
            animation: _ctrl,
            builder: (_, __) => CustomPaint(
              painter: _WaveformPainter(
                phase: _ctrl.value * math.pi * 2,
                seeds: _seeds,
                barCount: _barCount,
                playing: playing,
                activeColor: kColorAccent,
                idleColor: tokens.borderCard,
              ),
              size: const Size.fromHeight(44),
            ),
          );
        },
      ),
    );
  }
}

class _WaveformPainter extends CustomPainter {
  _WaveformPainter({
    required this.phase,
    required this.seeds,
    required this.barCount,
    required this.playing,
    required this.activeColor,
    required this.idleColor,
  });
  final double phase;
  final List<double> seeds;
  final int barCount;
  final bool playing;
  final Color activeColor;
  final Color idleColor;

  @override
  void paint(Canvas canvas, Size size) {
    final gap = 2.0;
    final barW = ((size.width - gap * (barCount - 1)) / barCount)
        .clamp(1.5, 6.0);
    final minH = 3.0;
    final maxH = size.height;
    final centerY = size.height / 2;
    final paint = Paint()..style = PaintingStyle.fill;

    for (int i = 0; i < barCount; i++) {
      // Height factor: idle → gentle low envelope; playing → sine wave
      // modulated by the per-bar seed + rolling phase.
      final base = 0.35 + 0.65 * math.sin(seeds[i] * 0.5).abs();
      final live = playing
          ? (0.4 + 0.6 * math.sin(phase + seeds[i]).abs())
          : base * 0.4;
      final h = (minH + (maxH - minH) * live).clamp(minH, maxH);
      final x = i * (barW + gap);
      final rect = RRect.fromRectAndRadius(
        Rect.fromLTWH(x, centerY - h / 2, barW, h),
        const Radius.circular(1.5),
      );
      paint.color = playing ? activeColor : idleColor;
      canvas.drawRRect(rect, paint);
    }
  }

  @override
  bool shouldRepaint(covariant _WaveformPainter old) =>
      old.phase != phase || old.playing != playing;
}

// ── Scrubber ───────────────────────────────────────────────────────

class _ScrubBar extends StatelessWidget {
  const _ScrubBar({required this.ctl});
  final PodcastPlayerController ctl;
  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
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
                  Text(_fmt(pos),
                      style: TextStyle(color: tokens.textMuted, fontSize: 11)),
                  Text(_fmt(total),
                      style: TextStyle(color: tokens.textMuted, fontSize: 11)),
                ],
              ),
            ),
          ],
        );
      },
    );
  }
}

// ── Transport (prev · replay10 · play/pause · forward10 · next) ────

class _Transport extends ConsumerWidget {
  const _Transport({required this.ctl});
  final PodcastPlayerController ctl;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = context.tokens;
    final hasPrev = ctl.hasPrevInPlaylist;
    final hasNext = ctl.hasNextInPlaylist;

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
            _CircleIconButton(
              icon: Icons.skip_previous_rounded,
              size: 26,
              onTap: hasPrev ? ctl.playPrevInPlaylist : null,
              color: hasPrev ? tokens.textPrimary : tokens.textMuted,
            ),
            _CircleIconButton(
              icon: Icons.replay_10,
              size: 30,
              onTap: () => ctl.skipBackward(10),
              color: tokens.textPrimary,
            ),
            Container(
              width: 70,
              height: 70,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: kColorAccent,
                boxShadow: [
                  BoxShadow(
                    color: kColorAccent.withValues(alpha: 0.35),
                    blurRadius: 14,
                    offset: const Offset(0, 6),
                  ),
                ],
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
                      iconSize: 36,
                      icon: Icon(
                        playing ? Icons.pause : Icons.play_arrow,
                        color: Colors.white,
                      ),
                      onPressed: ctl.togglePlay,
                    ),
            ),
            _CircleIconButton(
              icon: Icons.forward_10,
              size: 30,
              onTap: () => ctl.skipForward(10),
              color: tokens.textPrimary,
            ),
            _CircleIconButton(
              icon: Icons.skip_next_rounded,
              size: 26,
              onTap: hasNext ? ctl.playNextInPlaylist : null,
              color: hasNext ? tokens.textPrimary : tokens.textMuted,
            ),
          ],
        );
      },
    );
  }
}

class _CircleIconButton extends StatelessWidget {
  const _CircleIconButton({
    required this.icon,
    required this.size,
    required this.color,
    required this.onTap,
  });
  final IconData icon;
  final double size;
  final Color color;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      iconSize: size,
      icon: Icon(icon, color: color),
      onPressed: onTap,
    );
  }
}

// ── Speed chip ─────────────────────────────────────────────────────

class _SpeedChip extends StatelessWidget {
  const _SpeedChip({required this.ctl});
  final PodcastPlayerController ctl;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return AnimatedBuilder(
      animation: ctl,
      builder: (_, __) {
        final s = ctl.speed;
        // Format 1.0 as "1×" (not "1.0×") but keep 1.25 / 1.5 / 0.75 as-is.
        final label = s == s.roundToDouble()
            ? '${s.toInt()}×'
            : '${s.toString()}×';
        return Center(
          child: Material(
            color: Colors.transparent,
            borderRadius: BorderRadius.circular(18),
            child: InkWell(
              borderRadius: BorderRadius.circular(18),
              onTap: ctl.cycleSpeed,
              child: Container(
                height: 32,
                padding: const EdgeInsets.symmetric(horizontal: 14),
                decoration: BoxDecoration(
                  color: tokens.bgInput,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: tokens.borderCard),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.speed, size: 14, color: tokens.textSecondary),
                    const SizedBox(width: 6),
                    Text(
                      label,
                      style: TextStyle(
                        color: tokens.textPrimary,
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
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
