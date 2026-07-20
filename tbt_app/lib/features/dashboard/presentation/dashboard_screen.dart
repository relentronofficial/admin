import '../../../shared/widgets/app_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shimmer/shimmer.dart';

import '../../../core/constants/routes.dart';
import '../../../shared/models/watch_history_item.dart';
import '../../../shared/providers/me_provider.dart';
import '../../../shared/providers/site_config_provider.dart';
import '../../../shared/theme/design_tokens.dart';
import '../../../shared/theme/tbt_theme.dart';
import '../../../shared/theme/theme_tokens.dart';
import '../../../shared/widgets/app_error_state.dart';
import '../../../shared/widgets/app_section_header.dart';
import '../providers/dashboard_providers.dart';
import 'widgets/achievement_composer.dart';
import 'widgets/home_carousel.dart';
import 'widgets/home_header.dart';
import 'widgets/home_menu_grid.dart';
import 'widgets/morning_ritual_card.dart';
class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final meAsync = ref.watch(meNotifierProvider);
    final uiStrings = ref.watch(uiStringsNotifierProvider).valueOrNull;
    final statsAsync = ref.watch(dashboardStatsProvider);
    final continueAsync = ref.watch(continueLearningProvider);

    final welcomeLabel = uiStrings?.dashboardWelcome ?? 'Welcome back';
    final continueLabel = uiStrings?.continueWatchingLabel ?? 'Continue Watching';
    final recentLabel = uiStrings?.recentlyWatchedLabel ?? 'Recently Watched';

    // Module 9G — pixel-perfect port of co-worker's PostPopupScreen.
    // Reference: co-worker/moble app/lib/main.dart:3008-3135.
    // Section order (matches co-worker line 3095-3123):
    //   Fixed header
    //   Greeting "Hi, [Name]"
    //   AchievementComposer
    //   HomeCarousel (mentor poster card)
    //   MorningRitualCard
    //   HomeMenuGrid (6-tile 2×3)
    // Legacy helper widgets (_WelcomeHeader / _StatsRow / _QuickLinksRow /
    // _RecentlyWatched etc.) are kept in the file below unused; safe to
    // delete on the next cleanup pass. Continue-watching / recently-
    // watched / stats-row are intentionally NOT rendered — they don't
    // appear on the co-worker's home page.
    final name = ((meAsync.valueOrNull as dynamic)?.name as String?) ?? '';
    // Legacy providers/labels intentionally not consumed here — the
    // co-worker's home page doesn't render stats / continue-watching /
    // recently-watched. Kept above so pull-to-refresh still invalidates
    // them (in case the sections re-appear on a later screen).
    // ignore: unused_local_variable
    final _unusedWatches = [
      statsAsync,
      continueAsync,
      welcomeLabel,
      continueLabel,
      recentLabel,
    ];

    return Scaffold(
      body: Column(
        children: [
          // ── Fixed home header (Module 9B — port of co-worker's) ───────
          const HomeHeader(),

          Expanded(
            child: RefreshIndicator(
              color: context.tbt.accent,
              backgroundColor: context.tokens.bgSurface,
              onRefresh: () async {
                ref.invalidate(dashboardStatsProvider);
                ref.invalidate(continueLearningProvider);
              },
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 120),
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 500),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        // ── Greeting: "Hi, [Name]" (co-worker main.dart:3100) ─
                        Text(
                          name.isEmpty ? 'Hi,' : 'Hi, ${_firstName(name)}',
                          style: TextStyle(
                            color: context.tokens.textPrimary,
                            fontSize: 22,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 20),

                        // ── Achievement composer (Module 9C) ────────────
                        const AchievementComposer(),
                        const SizedBox(height: 24),

                        // ── Mentor Poster Card / Home Carousel (Module 8C) ─
                        const HomeCarousel(),
                        const SizedBox(height: 16),

                        // ── Morning Ritual (Module 8B/C) ────────────────
                        const MorningRitualCard(),
                        const SizedBox(height: 24),

                        // ── 2×3 menu grid (Module 9G) ───────────────────
                        // Community · Courses · Podcast · Workshop · E-Book · Task
                        const HomeMenuGrid(),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// Extract the first name from a full name string. Falls back to the
  /// whole string if there's only one word.
  String _firstName(String full) {
    final trimmed = full.trim();
    if (trimmed.isEmpty) return '';
    final space = trimmed.indexOf(' ');
    return space < 0 ? trimmed : trimmed.substring(0, space);
  }
}

// ── Welcome header ─────────────────────────────────────────────────────────────

class _WelcomeHeader extends StatelessWidget {
  const _WelcomeHeader({
    required this.meAsync,
    required this.welcomeLabel,
  });

  final AsyncValue meAsync;
  final String welcomeLabel;

  @override
  Widget build(BuildContext context) {
    final name = (meAsync.valueOrNull as dynamic)?.name as String? ?? '';
    final accent = context.tbt.accent;

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              // Vertical accent bar — subtle nod to the redesigned
              // login glass card; anchors the greeting without
              // dominating the layout.
              Container(
                width: 3,
                height: 40,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [accent, accent.withValues(alpha: 0.2)],
                  ),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      welcomeLabel,
                      style: TextStyle(
                        color: context.tokens.textMuted,
                        fontSize: 12,
                        letterSpacing: 0.6,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 2),
                    if (name.isNotEmpty)
                      Text(
                        name.toUpperCase(),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontFamily: 'Rajdhani',
                          fontSize: 26,
                          fontWeight: FontWeight.w800,
                          color: context.tokens.textPrimary,
                          letterSpacing: 2,
                          height: 1.1,
                        ),
                      )
                    else
                      Container(
                        width: 140,
                        height: 26,
                        decoration: BoxDecoration(
                          color: context.tokens.bgSurface,
                          borderRadius: BorderRadius.circular(4),
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ── Stats row ──────────────────────────────────────────────────────────────────

class _StatsRow extends StatelessWidget {
  const _StatsRow({required this.stats});
  final DashboardStats stats;

  @override
  Widget build(BuildContext context) {
    final accent = context.tbt.accent;
    final success = context.tbt.success;

    // 2×2 grid — matches the four-card dashboard on web.
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: _StatCard(
                  icon: Icons.school_outlined,
                  value: '${stats.totalCourses}',
                  label: 'Enrolled',
                  color: accent,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _StatCard(
                  icon: Icons.verified_outlined,
                  value: '${stats.completedCourses}',
                  label: 'Completed',
                  color: success,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: _StatCard(
                  icon: Icons.local_fire_department,
                  value: '${stats.currentStreak}d',
                  label: 'Streak',
                  color: const Color(0xFFf59e0b),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _StatCard(
                  icon: Icons.event_outlined,
                  value: '${stats.upcomingEvents}',
                  label: 'Upcoming',
                  color: accent,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.icon,
    required this.value,
    required this.label,
    required this.color,
  });

  final IconData icon;
  final String value;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: context.tokens.bgSurface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: context.tokens.borderCard),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 16, color: color),
              const Spacer(),
              Text(
                value,
                style: TextStyle(
                  color: color,
                  fontFamily: 'Rajdhani',
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  height: 1,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            label,
            style: TextStyle(
              color: context.tokens.textMuted,
              fontSize: 11,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.6,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Quick links — grouped into three logical clusters ───────────────────────
//
// Module 7 refresh: the previous flat 3×4 grid of 11 unlabelled tiles
// was becoming a wall of icons. Three grouped sections give members
// a mental map of what the app does without adding scroll length.

class _QuickLinksRow extends StatelessWidget {
  const _QuickLinksRow();

  @override
  Widget build(BuildContext context) {
    final accent = context.tbt.accent;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Your Journey ─────────────────────────────────────────
          const _GroupLabel('YOUR JOURNEY'),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: _QuickTile(
                  icon: Icons.calendar_month_outlined,
                  label: 'Task Path',
                  accent: accent,
                  onTap: () => GoRouter.of(context).push(AppRoutes.batchProgram),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _QuickTile(
                  icon: Icons.emoji_events_outlined,
                  label: 'TBT Points',
                  accent: accent,
                  onTap: () => GoRouter.of(context).push(AppRoutes.tbtPoints),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _QuickTile(
                  icon: Icons.history,
                  label: 'History',
                  accent: accent,
                  onTap: () => GoRouter.of(context).push(AppRoutes.history),
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),

          // ── Learn ────────────────────────────────────────────────
          const _GroupLabel('LEARN'),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: _QuickTile(
                  icon: Icons.school_outlined,
                  label: 'Courses',
                  accent: accent,
                  onTap: () => GoRouter.of(context).push(AppRoutes.courses),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _QuickTile(
                  icon: Icons.headset_mic_outlined,
                  label: 'Podcasts',
                  accent: accent,
                  onTap: () => GoRouter.of(context).push(AppRoutes.podcasts),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _QuickTile(
                  icon: Icons.menu_book_outlined,
                  label: 'E-Books',
                  accent: accent,
                  onTap: () => GoRouter.of(context).push(AppRoutes.ebooks),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: _QuickTile(
                  icon: Icons.folder_open_outlined,
                  label: 'Resources',
                  accent: accent,
                  onTap: () => GoRouter.of(context).push(AppRoutes.resources),
                ),
              ),
              const SizedBox(width: 10),
              const Expanded(child: SizedBox()),
              const SizedBox(width: 10),
              const Expanded(child: SizedBox()),
            ],
          ),
          const SizedBox(height: 18),

          // ── Engage ───────────────────────────────────────────────
          const _GroupLabel('ENGAGE'),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: _QuickTile(
                  icon: Icons.event_outlined,
                  label: 'Events',
                  accent: accent,
                  onTap: () => GoRouter.of(context).push(AppRoutes.events),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _QuickTile(
                  icon: Icons.videocam_outlined,
                  label: 'Webinars',
                  accent: accent,
                  onTap: () => GoRouter.of(context).push(AppRoutes.webinars),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _QuickTile(
                  icon: Icons.auto_awesome,
                  label: 'Buddy AI',
                  accent: accent,
                  onTap: () => GoRouter.of(context).push(AppRoutes.aiContent),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: _QuickTile(
                  icon: Icons.help_outline,
                  label: 'Support',
                  accent: accent,
                  onTap: () => GoRouter.of(context).push(AppRoutes.support),
                ),
              ),
              const SizedBox(width: 10),
              const Expanded(child: SizedBox()),
              const SizedBox(width: 10),
              const Expanded(child: SizedBox()),
            ],
          ),
        ],
      ),
    );
  }
}

// Subtle section label above each cluster.
class _GroupLabel extends StatelessWidget {
  const _GroupLabel(this.text);
  final String text;
  @override
  Widget build(BuildContext context) {
    final accent = context.tbt.accent;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Container(
          width: 3,
          height: 12,
          decoration: BoxDecoration(
            color: accent,
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(width: 8),
        Text(
          text,
          style: TextStyle(
            fontFamily: 'Rajdhani',
            color: context.tokens.textSecondary,
            fontSize: 10,
            fontWeight: FontWeight.w800,
            letterSpacing: 2.2,
          ),
        ),
      ],
    );
  }
}

class _QuickTile extends StatelessWidget {
  const _QuickTile({
    required this.icon,
    required this.label,
    required this.accent,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final Color accent;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: context.tokens.bgSurface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: context.tokens.borderCard),
        ),
        child: Column(
          children: [
            Icon(icon, color: accent, size: 20),
            const SizedBox(height: 6),
            Text(
              label,
              style: TextStyle(
                color: context.tokens.textPrimary,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StatsRowSkeleton extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
        child: Shimmer.fromColors(
          baseColor: context.tokens.bgSurface,
          highlightColor: context.tokens.bgInput,
          child: Row(
            children: List.generate(
              3,
              (_) => Padding(
                padding: const EdgeInsets.only(right: 10),
                child: Container(
                  width: 90,
                  height: 30,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(20),
                  ),
                ),
              ),
            ),
          ),
        ),
      );
}

// ── Section header ─────────────────────────────────────────────────────────────

// ── Recently Watched w/ pill filter ─────────────────────────────────────────

class _RecentlyWatched extends ConsumerStatefulWidget {
  const _RecentlyWatched({required this.sectionLabel});
  final String sectionLabel;

  @override
  ConsumerState<_RecentlyWatched> createState() => _RecentlyWatchedState();
}

class _RecentlyWatchedState extends ConsumerState<_RecentlyWatched> {
  String _filter = 'all'; // 'all' | 'in_progress' | 'completed'

  @override
  Widget build(BuildContext context) {
    final accent = context.tbt.accent;
    final async = ref.watch(watchHistoryProvider(_filter));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        AppSectionHeader(label: widget.sectionLabel),
        const SizedBox(height: AppSpacing.sm),
        SizedBox(
          height: 34,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
            children: [
              _pill('All', 'all', accent),
              const SizedBox(width: AppSpacing.sm),
              _pill('In Progress', 'in_progress', accent),
              const SizedBox(width: AppSpacing.sm),
              _pill('Completed', 'completed', accent),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        async.when(
          loading: () => _HorizontalSkeletonList(),
          error: (e, _) => Padding(
            padding:
                const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
            child: AppErrorState(
              error: e,
              compact: true,
              onRetry: () =>
                  ref.invalidate(watchHistoryProvider(_filter)),
            ),
          ),
          data: (items) => items.isEmpty
              ? _EmptyRow()
              : _HorizontalList(items: items),
        ),
      ],
    );
  }

  Widget _pill(String label, String value, Color accent) {
    final active = _filter == value;
    return InkWell(
      onTap: () => setState(() => _filter = value),
      borderRadius: BorderRadius.circular(999),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: active ? accent.withValues(alpha: 0.15) : context.tokens.bgInput,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: active ? accent : context.tokens.borderCard),
        ),
        child: Center(
          child: Text(
            label,
            style: TextStyle(
              color: active ? accent : context.tokens.textSecondary,
              fontSize: 11,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.5,
            ),
          ),
        ),
      ),
    );
  }
}

// ── Horizontal content list ────────────────────────────────────────────────────

class _HorizontalList extends StatelessWidget {
  const _HorizontalList({required this.items});
  final List<WatchHistoryItem> items;

  @override
  Widget build(BuildContext context) => SizedBox(
        height: 200,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          itemCount: items.length,
          separatorBuilder: (_, __) => const SizedBox(width: 12),
          itemBuilder: (context, i) => _ContentCard(item: items[i]),
        ),
      );
}

// ── Content card ───────────────────────────────────────────────────────────────

class _ContentCard extends StatelessWidget {
  const _ContentCard({required this.item});
  final WatchHistoryItem item;

  String get _displayTitle {
    if (item.type == 'course') {
      return item.courseTitle ?? item.title ?? 'Course';
    }
    return item.workshopTitle ?? item.title ?? 'Workshop';
  }

  String? get _subtitle {
    // Matches web: "Completed: <lesson>" when done, else "Resume: <lesson>".
    // Falls back to the raw title if we somehow have neither prefix source.
    final lesson = item.lastLessonTitle ?? item.episodeTitle;
    if (lesson == null || lesson.isEmpty) return null;
    return item.isCompleted ? 'Completed: $lesson' : 'Resume: $lesson';
  }

  void _onTap(BuildContext context) {
    // Deep-link straight into the player when we know the specific lesson /
    // episode — matches the web `?lesson=<id>` behaviour. Falls back to the
    // parent detail screen when the id isn't in the payload.
    // Use `push` so the back button returns to the dashboard rather than
    // collapsing the stack (see BACK_NAV_SPEC).
    if (item.type == 'course') {
      final courseId = item.courseId ?? item.id ?? '';
      final lessonId = item.lessonId;
      if (courseId.isNotEmpty && lessonId != null && lessonId.isNotEmpty) {
        context.push(AppRoutes.lessonPlayerPath(courseId, lessonId));
      } else if (courseId.isNotEmpty) {
        context.push(AppRoutes.courseDetailPath(courseId));
      }
    } else {
      final slug = item.workshopSlug ?? item.id ?? '';
      final episodeId = item.episodeId;
      if (slug.isNotEmpty && episodeId != null && episodeId.isNotEmpty) {
        context.push(AppRoutes.workshopEpisodePath(slug, episodeId));
      } else if (slug.isNotEmpty) {
        context.push(AppRoutes.workshopDetailPath(slug));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final accent = context.tbt.accent;
    final progress = (item.progressPercent / 100).clamp(0.0, 1.0);
    final isCourse = item.type == 'course';

    return Semantics(
      label: '$_displayTitle, ${isCourse ? 'course' : 'workshop'}, ${item.progressPercent}% complete',
      button: true,
      child: GestureDetector(
      onTap: () => _onTap(context),
      behavior: HitTestBehavior.opaque,
      child: Container(
        width: 172,
        decoration: BoxDecoration(
          color: context.tokens.bgSurface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: context.tokens.borderCard),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Thumbnail ─────────────────────────────────────────────────
            ClipRRect(
              borderRadius:
                  const BorderRadius.vertical(top: Radius.circular(10)),
              child: Stack(
                children: [
                  AppNetworkImage(
                    url: item.thumbnailUrl,
                    width: 172,
                    height: 96,
                    fit: BoxFit.cover,
                    fallbackIcon: isCourse
                        ? Icons.school_outlined
                        : Icons.play_circle_outline,
                  ),
                  // Type chip
                  Positioned(
                    top: 8,
                    left: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: isCourse
                            ? context.tokens.bgSurface.withAlpha(0xe6)
                            : accent.withAlpha(0xe6),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        isCourse ? 'COURSE' : 'WORKSHOP',
                        style: TextStyle(
          fontFamily: 'Rajdhani',
                          fontSize: 9,
                          fontWeight: FontWeight.w700,
                          color: isCourse ? context.tokens.textSecondary : Colors.white,
                          letterSpacing: 1,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // ── Progress bar ──────────────────────────────────────────────
            LinearProgressIndicator(
              value: progress,
              minHeight: 2,
              backgroundColor: context.tokens.borderCard,
              valueColor: AlwaysStoppedAnimation<Color>(accent),
            ),

            // ── Text ──────────────────────────────────────────────────────
            Expanded(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(10, 8, 10, 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _displayTitle,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: context.tokens.textPrimary,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        height: 1.3,
                      ),
                    ),
                    if (_subtitle != null) ...[
                      const SizedBox(height: 3),
                      Text(
                        _subtitle!,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: context.tokens.textMuted,
                          fontSize: 10,
                        ),
                      ),
                    ],
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

// ── Skeleton cards ────────────────────────────────────────────────────────────

class _HorizontalSkeletonList extends StatelessWidget {
  @override
  Widget build(BuildContext context) => SizedBox(
        height: 200,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          itemCount: 4,
          separatorBuilder: (_, __) => const SizedBox(width: 12),
          itemBuilder: (_, __) => Shimmer.fromColors(
            baseColor: context.tokens.bgSurface,
            highlightColor: context.tokens.bgInput,
            child: Container(
              width: 172,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(10),
              ),
            ),
          ),
        ),
      );
}

// ── Empty / error states ──────────────────────────────────────────────────────

class _EmptyRow extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Text(
          'Nothing here yet.',
          style: TextStyle(color: context.tokens.textMuted, fontSize: 13),
        ),
      );
}

