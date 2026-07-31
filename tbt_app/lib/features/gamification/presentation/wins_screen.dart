import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/exceptions/app_exception.dart';
import '../../../shared/theme/design_constants.dart';
import '../../../shared/theme/theme_tokens.dart';
import '../domain/tbt_models.dart';
import '../providers/tbt_providers.dart';
import '../../../shared/widgets/app_loader.dart';

/// WINS — the leaderboard screen. Direct port of the co-worker's
/// `_LeaderboardTab` (main.dart:4514–5037).
///
/// Structure (top → bottom):
///   * Header — trophy icon + "TBT LEADERBOARD" ShaderMask (red → orange
///     gradient) + subtitle. Fades + slides down on entry (500 ms).
///   * Podium — top 3 members arranged [rank 2 left, rank 1 center,
///     rank 3 right]. Rank 1 rises first (elasticOut scale, 600 ms)
///     with a pulsing crown; ranks 2/3 follow after 150 ms.
///   * Full leaderboard list (ranks 4+) — stagger 80 ms per row
///     (fade + slide from right).
///
/// Data source: `tbtLeaderboardProvider` → `/api/tbt/leaderboard`
/// returning top 50 [LeaderboardRow]s ordered by `totalPoints` desc.
class WinsScreen extends ConsumerStatefulWidget {
  const WinsScreen({super.key});

  @override
  ConsumerState<WinsScreen> createState() => _WinsScreenState();
}

class _WinsScreenState extends ConsumerState<WinsScreen>
    with TickerProviderStateMixin {
  static const int _kStaggerListItems = 6; // number of list rows we animate

  late final AnimationController _headerCtrl;
  late final Animation<double> _headerFade;
  late final Animation<Offset> _headerSlide;

  // Podium controllers indexed as [left=rank2, center=rank1, right=rank3]
  late final List<AnimationController> _podiumCtrls;
  late final List<Animation<double>> _podiumScales;
  late final List<Animation<double>> _podiumFades;

  late final AnimationController _crownCtrl;
  late final Animation<double> _crownPulse;

  late final List<AnimationController> _listCtrls;
  late final List<Animation<double>> _listFades;
  late final List<Animation<Offset>> _listSlides;

  bool _animationsStarted = false;

  @override
  void initState() {
    super.initState();

    _headerCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );
    _headerFade = CurvedAnimation(parent: _headerCtrl, curve: Curves.easeOut);
    _headerSlide = Tween<Offset>(
      begin: const Offset(0, -0.3),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _headerCtrl, curve: Curves.easeOutCubic));

    _podiumCtrls = List.generate(
      3,
      (_) => AnimationController(
        vsync: this,
        duration: const Duration(milliseconds: 600),
      ),
    );
    _podiumScales = _podiumCtrls
        .map((c) => Tween<double>(begin: 0.0, end: 1.0)
            .animate(CurvedAnimation(parent: c, curve: Curves.elasticOut)))
        .toList();
    _podiumFades = _podiumCtrls
        .map((c) => CurvedAnimation(parent: c, curve: Curves.easeOut))
        .toList();

    _crownCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..repeat(reverse: true);
    _crownPulse = Tween<double>(begin: 1.0, end: 1.25)
        .animate(CurvedAnimation(parent: _crownCtrl, curve: Curves.easeInOut));

    _listCtrls = List.generate(
      _kStaggerListItems,
      (_) => AnimationController(
        vsync: this,
        duration: const Duration(milliseconds: 420),
      ),
    );
    _listFades = _listCtrls
        .map((c) => CurvedAnimation(parent: c, curve: Curves.easeOut))
        .toList();
    _listSlides = _listCtrls
        .map((c) => Tween<Offset>(
              begin: const Offset(0.3, 0),
              end: Offset.zero,
            ).animate(CurvedAnimation(parent: c, curve: Curves.easeOutCubic)))
        .toList();
  }

  void _startAnimationsOnce() {
    if (_animationsStarted) return;
    _animationsStarted = true;
    _runSequence();
  }

  Future<void> _runSequence() async {
    await Future.delayed(const Duration(milliseconds: 100));
    if (!mounted) return;
    _headerCtrl.forward();

    // Podium center (rank 1) rises first, then flanks together
    await Future.delayed(const Duration(milliseconds: 250));
    if (!mounted) return;
    _podiumCtrls[1].forward(); // center = rank 1

    await Future.delayed(const Duration(milliseconds: 150));
    if (!mounted) return;
    _podiumCtrls[0].forward(); // left = rank 2
    _podiumCtrls[2].forward(); // right = rank 3

    // Staggered list items
    await Future.delayed(const Duration(milliseconds: 400));
    for (int i = 0; i < _listCtrls.length; i++) {
      if (!mounted) return;
      _listCtrls[i].forward();
      await Future.delayed(const Duration(milliseconds: 80));
    }
  }

  @override
  void dispose() {
    _headerCtrl.dispose();
    for (final c in _podiumCtrls) {
      c.dispose();
    }
    _crownCtrl.dispose();
    for (final c in _listCtrls) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final async = ref.watch(tbtLeaderboardProvider);

    return Scaffold(
      backgroundColor: tokens.bgPage,
      body: async.when(
        loading: () =>
            const AppLoader.center(),
        error: (err, __) => _ErrorState(
          error: err,
          onRetry: () => ref.invalidate(tbtLeaderboardProvider),
        ),
        data: (rows) {
          // Trigger the animation sequence after the first frame with data.
          WidgetsBinding.instance.addPostFrameCallback((_) {
            _startAnimationsOnce();
          });

          if (rows.isEmpty) {
            return _EmptyState(headerFade: _headerFade, headerSlide: _headerSlide);
          }

          final top3 = rows.take(3).toList();
          final others = rows.skip(3).toList();
          // Podium arrangement: [rank2 left, rank1 center, rank3 right].
          // Handle the case where we have <3 members gracefully.
          List<LeaderboardRow?> podium;
          if (top3.length == 3) {
            podium = [top3[1], top3[0], top3[2]];
          } else if (top3.length == 2) {
            podium = [top3[1], top3[0], null];
          } else if (top3.length == 1) {
            podium = [null, top3[0], null];
          } else {
            podium = [null, null, null];
          }

          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(tbtLeaderboardProvider),
            color: kColorAccent,
            backgroundColor: tokens.bgSurface,
            child: SingleChildScrollView(
              physics: const AlwaysScrollableScrollPhysics(
                parent: BouncingScrollPhysics(),
              ),
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 120),
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 500),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _Header(fade: _headerFade, slide: _headerSlide),
                      const SizedBox(height: 4),
                      FadeTransition(
                        opacity: _headerFade,
                        child: const _PeriodSelector(),
                      ),
                      const SizedBox(height: 16),
                      _Podium(
                        podium: podium,
                        scales: _podiumScales,
                        fades: _podiumFades,
                        crownPulse: _crownPulse,
                      ),
                      const SizedBox(height: 28),
                      if (others.isNotEmpty)
                        _RankList(
                          rows: others,
                          fades: _listFades,
                          slides: _listSlides,
                        ),
                    ],
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

// ── Header ─────────────────────────────────────────────────────────

class _Header extends StatelessWidget {
  const _Header({required this.fade, required this.slide});
  final Animation<double> fade;
  final Animation<Offset> slide;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return FadeTransition(
      opacity: fade,
      child: SlideTransition(
        position: slide,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 16),
          child: Column(
            children: [
              const Icon(
                Icons.emoji_events_rounded,
                color: Color(0xFFFFD700),
                size: 36,
              ),
              const SizedBox(height: 12),
              ShaderMask(
                shaderCallback: (bounds) => const LinearGradient(
                  colors: [Color(0xFFE50914), Color(0xFFFF6B35)],
                ).createShader(bounds),
                child: const Text(
                  'TBT LEADERBOARD',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 24,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 2.5,
                  ),
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Top performers of Tamil Business Tribe',
                textAlign: TextAlign.center,
                style: TextStyle(color: tokens.textSecondary, fontSize: 12.5),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Podium (top 3) ─────────────────────────────────────────────────

class _Podium extends StatelessWidget {
  const _Podium({
    required this.podium,
    required this.scales,
    required this.fades,
    required this.crownPulse,
  });
  final List<LeaderboardRow?> podium; // [rank2, rank1, rank3]
  final List<Animation<double>> scales;
  final List<Animation<double>> fades;
  final Animation<double> crownPulse;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      crossAxisAlignment: CrossAxisAlignment.end,
      children: List.generate(3, (idx) {
        final row = podium[idx];
        // Determine rank from position: 0→rank2, 1→rank1, 2→rank3
        final rank = idx == 0 ? 2 : (idx == 1 ? 1 : 3);
        return Expanded(
          child: FadeTransition(
            opacity: fades[idx],
            child: ScaleTransition(
              scale: scales[idx],
              alignment: Alignment.bottomCenter,
              child: _PodiumColumn(
                row: row,
                rank: rank,
                crownPulse: crownPulse,
              ),
            ),
          ),
        );
      }),
    );
  }
}

class _PodiumColumn extends StatelessWidget {
  const _PodiumColumn({
    required this.row,
    required this.rank,
    required this.crownPulse,
  });
  final LeaderboardRow? row;
  final int rank;
  final Animation<double> crownPulse;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isRank1 = rank == 1;
    final isRank2 = rank == 2;

    final avatarSize = isRank1 ? 72.0 : 56.0;
    final pedestalH = isRank1 ? 90.0 : (isRank2 ? 68.0 : 52.0);
    final podiumColor = isRank1
        ? const Color(0xFFFFD700)
        : (isRank2 ? const Color(0xFFC0C0C0) : const Color(0xFFCD7F32));

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Crown for rank 1 (pulsing); reserved space for ranks 2/3
        if (isRank1)
          ScaleTransition(
            scale: crownPulse,
            child: const Icon(
              Icons.workspace_premium_rounded,
              color: Color(0xFFFFD700),
              size: 26,
            ),
          )
        else
          const SizedBox(height: 26),

        const SizedBox(height: 6),

        // Avatar with glowing border
        Container(
          width: avatarSize + 8,
          height: avatarSize + 8,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: podiumColor, width: 3),
            boxShadow: [
              BoxShadow(
                color: podiumColor.withValues(alpha: 0.4),
                blurRadius: 16,
                spreadRadius: 2,
              ),
            ],
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular((avatarSize / 2) + 4),
            child: _PodiumAvatar(row: row, size: avatarSize),
          ),
        ),

        // Rank badge — overlaid -6 y
        Transform.translate(
          offset: const Offset(0, -6),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: podiumColor,
              borderRadius: BorderRadius.circular(10),
              boxShadow: [
                BoxShadow(
                  color: podiumColor.withValues(alpha: 0.4),
                  blurRadius: 6,
                ),
              ],
            ),
            child: Text(
              '#$rank',
              style: const TextStyle(
                color: Colors.black,
                fontSize: 10,
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
        ),

        // Name + points
        Text(
          row?.memberName ?? '—',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          textAlign: TextAlign.center,
          style: TextStyle(
            color: tokens.textPrimary,
            fontSize: 12,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 3),
        Text(
          '${_formatPoints(row?.totalPoints ?? 0)} PTS',
          style: const TextStyle(
            color: Color(0xFFE50914),
            fontSize: 11,
            fontWeight: FontWeight.w900,
          ),
        ),

        const SizedBox(height: 10),

        // Pedestal block
        Container(
          height: pedestalH,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                podiumColor.withValues(alpha: isDark ? 0.22 : 0.45),
                podiumColor.withValues(alpha: isDark ? 0.06 : 0.15),
              ],
            ),
            borderRadius: const BorderRadius.vertical(top: Radius.circular(10)),
            border: Border.all(
              color: podiumColor.withValues(alpha: isDark ? 0.45 : 0.75),
              width: isDark ? 1.5 : 2,
            ),
          ),
        ),
      ],
    );
  }
}

class _PodiumAvatar extends StatelessWidget {
  const _PodiumAvatar({required this.row, required this.size});
  final LeaderboardRow? row;
  final double size;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final photo = row?.memberPhoto;
    if (photo == null || photo.isEmpty) {
      return Container(
        color: tokens.bgInput,
        alignment: Alignment.center,
        child: Icon(
          Icons.person,
          color: tokens.textMuted,
          size: size * 0.5,
        ),
      );
    }
    final dpr = MediaQuery.devicePixelRatioOf(context);
    final cachePx = (size * dpr).round().clamp(1, 2000);
    return CachedNetworkImage(
      imageUrl: photo,
      fit: BoxFit.cover,
      memCacheWidth: cachePx,
      memCacheHeight: cachePx,
      placeholder: (_, __) => Container(color: tokens.bgInput),
      errorWidget: (_, __, ___) => Container(
        color: tokens.bgInput,
        alignment: Alignment.center,
        child: Icon(
          Icons.person,
          color: tokens.textMuted,
          size: size * 0.5,
        ),
      ),
    );
  }
}

String _formatPoints(int p) {
  if (p >= 1000) {
    // 1,234 format
    final s = p.toString();
    final buf = StringBuffer();
    for (int i = 0; i < s.length; i++) {
      if (i > 0 && (s.length - i) % 3 == 0) buf.write(',');
      buf.write(s[i]);
    }
    return buf.toString();
  }
  return '$p';
}

// ── Ranked list (4+) ───────────────────────────────────────────────

class _RankList extends StatelessWidget {
  const _RankList({
    required this.rows,
    required this.fades,
    required this.slides,
  });
  final List<LeaderboardRow> rows;
  final List<Animation<double>> fades;
  final List<Animation<Offset>> slides;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: tokens.bgSurface.withValues(alpha: isDark ? 0.55 : 0.85),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: tokens.borderCard),
      ),
      child: Column(
        children: List.generate(rows.length, (i) {
          final row = rows[i];
          final animIdx = i < fades.length ? i : fades.length - 1;
          return FadeTransition(
            opacity: fades[animIdx],
            child: SlideTransition(
              position: slides[animIdx],
              child: Column(
                children: [
                  _RankListItem(row: row),
                  if (i < rows.length - 1)
                    Divider(color: tokens.borderCard, height: 1),
                ],
              ),
            ),
          );
        }),
      ),
    );
  }
}

class _RankListItem extends StatelessWidget {
  const _RankListItem({required this.row});
  final LeaderboardRow row;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final me = row.isMe;
    final rankColor = me ? const Color(0xFFE50914) : tokens.textSecondary;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        children: [
          SizedBox(
            width: 34,
            child: Text(
              '#${row.rank}',
              style: TextStyle(
                fontFamily: 'Rajdhani',
                color: rankColor,
                fontSize: 14,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(
                color: me ? const Color(0xFFE50914) : tokens.borderCard,
                width: 2,
              ),
              boxShadow: me
                  ? [
                      BoxShadow(
                        color: const Color(0xFFE50914).withValues(alpha: 0.3),
                        blurRadius: 8,
                      ),
                    ]
                  : null,
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(20),
              child: row.memberPhoto != null && row.memberPhoto!.isNotEmpty
                  ? CachedNetworkImage(
                      imageUrl: row.memberPhoto!,
                      fit: BoxFit.cover,
                      memCacheWidth:
                          (40 * MediaQuery.devicePixelRatioOf(context)).round(),
                      memCacheHeight:
                          (40 * MediaQuery.devicePixelRatioOf(context)).round(),
                      placeholder: (_, __) =>
                          Container(color: tokens.bgInput),
                      errorWidget: (_, __, ___) => Container(
                        color: tokens.bgInput,
                        alignment: Alignment.center,
                        child: Icon(Icons.person,
                            color: tokens.textMuted, size: 20),
                      ),
                    )
                  : Container(
                      color: tokens.bgInput,
                      alignment: Alignment.center,
                      child: Icon(Icons.person,
                          color: tokens.textMuted, size: 20),
                    ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  row.memberName ?? 'Member',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: tokens.textPrimary,
                    fontSize: 13.5,
                    fontWeight: me ? FontWeight.bold : FontWeight.w600,
                  ),
                ),
                if (me) ...[
                  const SizedBox(height: 2),
                  const Text(
                    'YOU',
                    style: TextStyle(
                      color: Color(0xFFE50914),
                      fontSize: 10,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 1,
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: me
                  ? const Color(0xFFE50914).withValues(alpha: 0.12)
                  : (isDark
                      ? Colors.white.withValues(alpha: 0.06)
                      : Colors.black.withValues(alpha: 0.04)),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              '${_formatPoints(row.totalPoints)} PTS',
              style: TextStyle(
                color: me ? const Color(0xFFE50914) : tokens.textPrimary,
                fontSize: 12,
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Period selector (All Time / This Week / This Month) ───────────

class _PeriodSelector extends ConsumerWidget {
  const _PeriodSelector();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = context.tokens;
    final active = ref.watch(leaderboardPeriodProvider);

    Widget chip(String value, String label) {
      final isActive = active == value;
      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4),
        child: GestureDetector(
          onTap: () {
            if (isActive) return;
            ref.read(leaderboardPeriodProvider.notifier).state = value;
            ref.invalidate(tbtLeaderboardProvider);
          },
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
            decoration: BoxDecoration(
              color: isActive
                  ? const Color(0xFFE50914).withValues(alpha: 0.12)
                  : tokens.bgSurface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: isActive
                    ? const Color(0xFFE50914)
                    : tokens.borderCard,
                width: isActive ? 1.2 : 1,
              ),
            ),
            child: Text(
              label,
              style: TextStyle(
                color: isActive
                    ? const Color(0xFFE50914)
                    : tokens.textSecondary,
                fontSize: 11,
                fontWeight: isActive ? FontWeight.w800 : FontWeight.w600,
                letterSpacing: 0.4,
              ),
            ),
          ),
        ),
      );
    }

    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        chip('week', 'THIS WEEK'),
        chip('month', 'THIS MONTH'),
        chip('all', 'ALL TIME'),
      ],
    );
  }
}

// ── Error state ────────────────────────────────────────────────────

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.error, required this.onRetry});
  final Object error;
  final VoidCallback onRetry;

  String _friendlyMessage() {
    if (error is UnauthorizedException) {
      return 'Your session expired. Please log in again.';
    }
    if (error is NetworkException) {
      return 'No internet connection. Check your network and try again.';
    }
    if (error is AppException) {
      return (error as AppException).message;
    }
    return error.toString();
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.error_outline, color: tokens.textMuted, size: 44),
            const SizedBox(height: 12),
            Text(
              'Could not load leaderboard',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: tokens.textPrimary,
                fontSize: 15,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              _friendlyMessage(),
              textAlign: TextAlign.center,
              style: TextStyle(color: tokens.textSecondary, fontSize: 12.5),
            ),
            const SizedBox(height: 16),
            OutlinedButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh, size: 18),
              label: const Text('Retry'),
              style: OutlinedButton.styleFrom(
                foregroundColor: kColorAccent,
                side: const BorderSide(color: kColorAccent),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Empty state ────────────────────────────────────────────────────

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.headerFade, required this.headerSlide});
  final Animation<double> headerFade;
  final Animation<Offset> headerSlide;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 120),
      children: [
        _Header(fade: headerFade, slide: headerSlide),
        const SizedBox(height: 40),
        Icon(Icons.emoji_events_outlined, size: 64, color: tokens.textMuted),
        const SizedBox(height: 16),
        Text(
          'No leaderboard entries yet.\nBe the first to earn points!',
          textAlign: TextAlign.center,
          style: TextStyle(
            color: tokens.textSecondary,
            fontSize: 14,
            height: 1.5,
          ),
        ),
      ],
    );
  }
}
