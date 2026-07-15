import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shimmer/shimmer.dart';

import '../../../core/constants/routes.dart';
import '../../../shared/models/watch_history_item.dart';
import '../../../shared/providers/me_provider.dart';
import '../../../shared/providers/site_config_provider.dart';
import '../../../shared/theme/tbt_theme.dart';
import '../providers/dashboard_providers.dart';

import '../../../shared/theme/theme_tokens.dart';
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

    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          color: context.tbt.accent,
          backgroundColor: context.tokens.bgSurface,
          onRefresh: () async {
            ref.invalidate(dashboardStatsProvider);
            ref.invalidate(continueLearningProvider);
            ref.invalidate(watchHistoryProvider('all'));
          },
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // ── Welcome ───────────────────────────────────────────────────
                _WelcomeHeader(
                  meAsync: meAsync,
                  welcomeLabel: welcomeLabel,
                ),

                // ── Stats row ─────────────────────────────────────────────────
                statsAsync.when(
                  loading: () => _StatsRowSkeleton(),
                  error: (_, __) => const SizedBox.shrink(),
                  data: (stats) => _StatsRow(stats: stats),
                ),

                const SizedBox(height: 16),

                // ── Quick links ───────────────────────────────────────────────
                // Batch program has no bottom-tab entry, so surface it here
                // (mirrors the web's top-nav "Task" link).
                const _QuickLinksRow(),

                const SizedBox(height: 24),

                // ── Continue Watching ─────────────────────────────────────────
                _SectionHeader(label: continueLabel),
                const SizedBox(height: 12),
                continueAsync.when(
                  loading: () => _HorizontalSkeletonList(),
                  error: (e, _) => _RetryError(
                    onRetry: () => ref.invalidate(continueLearningProvider),
                  ),
                  data: (items) => items.isEmpty
                      ? _EmptyRow()
                      : _HorizontalList(items: items),
                ),

                const SizedBox(height: 28),

                // ── Recently Watched (with All/In Progress/Completed pills) ──
                _RecentlyWatched(sectionLabel: recentLabel),

                const SizedBox(height: 32),
              ],
            ),
          ),
        ),
      ),
    );
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
          Text(
            welcomeLabel,
            style: TextStyle(
              color: context.tokens.textMuted,
              fontSize: 13,
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 4),
          if (name.isNotEmpty)
            Text(
              name.toUpperCase(),
              style: TextStyle(
          fontFamily: 'Rajdhani',
                fontSize: 26,
                fontWeight: FontWeight.w700,
                color: context.tokens.textPrimary,
                letterSpacing: 2,
              ),
            )
          else
            Container(
              width: 140,
              height: 28,
              decoration: BoxDecoration(
                color: context.tokens.bgSurface,
                borderRadius: BorderRadius.circular(4),
              ),
            ),
          const SizedBox(height: 4),
          Container(height: 2, width: 40, color: accent),
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

// ── Quick links (batch program / more) ───────────────────────────────────────

class _QuickLinksRow extends StatelessWidget {
  const _QuickLinksRow();

  @override
  Widget build(BuildContext context) {
    final accent = context.tbt.accent;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: _QuickTile(
                  icon: Icons.calendar_month_outlined,
                  label: 'Task',
                  accent: accent,
                  onTap: () =>
                      GoRouter.of(context).push(AppRoutes.batchProgram),
                ),
              ),
              const SizedBox(width: 10),
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
                  icon: Icons.folder_open_outlined,
                  label: 'Resources',
                  accent: accent,
                  onTap: () => GoRouter.of(context).push(AppRoutes.resources),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
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
                  icon: Icons.history,
                  label: 'History',
                  accent: accent,
                  onTap: () => GoRouter.of(context).push(AppRoutes.history),
                ),
              ),
            ],
          ),
        ],
      ),
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
        _SectionHeader(label: widget.sectionLabel),
        const SizedBox(height: 8),
        SizedBox(
          height: 34,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            children: [
              _pill('All', 'all', accent),
              const SizedBox(width: 8),
              _pill('In Progress', 'in_progress', accent),
              const SizedBox(width: 8),
              _pill('Completed', 'completed', accent),
            ],
          ),
        ),
        const SizedBox(height: 8),
        async.when(
          loading: () => _HorizontalSkeletonList(),
          error: (e, _) => _RetryError(
            onRetry: () => ref.invalidate(watchHistoryProvider(_filter)),
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

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Text(
          label.toUpperCase(),
          style: TextStyle(
          fontFamily: 'Rajdhani',
            fontSize: 13,
            fontWeight: FontWeight.w700,
            color: context.tokens.textMuted,
            letterSpacing: 2,
          ),
        ),
      );
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
                  SizedBox(
                    width: 172,
                    height: 96,
                    child: item.thumbnailUrl != null
                        ? CachedNetworkImage(
                            imageUrl: item.thumbnailUrl!,
                            fit: BoxFit.cover,
                            errorWidget: (_, __, ___) =>
                                _ThumbnailFallback(isCourse: isCourse),
                          )
                        : _ThumbnailFallback(isCourse: isCourse),
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

class _ThumbnailFallback extends StatelessWidget {
  const _ThumbnailFallback({required this.isCourse});
  final bool isCourse;

  @override
  Widget build(BuildContext context) => Container(
        color: context.tokens.bgInput,
        child: Center(
          child: ExcludeSemantics(
            child: Icon(
              isCourse ? Icons.play_circle_outline : Icons.event_outlined,
              color: context.tokens.textSubtle,
              size: 32,
            ),
          ),
        ),
      );
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

class _RetryError extends StatelessWidget {
  const _RetryError({required this.onRetry});
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            Text(
              'Failed to load.',
              style: TextStyle(color: context.tokens.textMuted, fontSize: 13),
            ),
            const SizedBox(width: 12),
            TextButton(
              onPressed: onRetry,
              style: TextButton.styleFrom(
                foregroundColor: context.tbt.accent,
                minimumSize: const Size(48, 48),
              ),
              child: const Text('Retry', style: TextStyle(fontSize: 13)),
            ),
          ],
        ),
      );
}
