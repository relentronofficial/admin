import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:cached_network_image/cached_network_image.dart';

import '../../../core/constants/routes.dart';
import '../../../shared/models/watch_history_item.dart';
import '../providers/history_provider.dart';

import '../../../shared/theme/design_tokens.dart';
import '../../../shared/theme/theme_tokens.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_empty_state.dart';
import '../../../shared/widgets/app_error_state.dart';
import '../../../shared/widgets/app_section_header.dart';
import '../../../shared/widgets/app_skeleton.dart';
// ── Filter tabs ───────────────────────────────────────────────────────────────

const _filters = [
  ('All', 'all'),
  ('In Progress', 'in_progress'),
  ('Completed', 'completed'),
];

class HistoryScreen extends ConsumerStatefulWidget {
  const HistoryScreen({super.key});

  @override
  ConsumerState<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends ConsumerState<HistoryScreen> {
  int _tabIndex = 0;
  final _scrollController = ScrollController();

  String get _filter => _filters[_tabIndex].$2;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 200) {
      ref.read(watchHistoryNotifierProvider(_filter).notifier).loadMore();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: context.tokens.bgSurface,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: Icon(Icons.arrow_back, color: context.tokens.textPrimary),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Text(
          'WATCH HISTORY',
          style: TextStyle(
            fontFamily: 'Rajdhani',
            fontSize: 17,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.5,
            color: context.tokens.textPrimary,
          ),
        ),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(44),
          child: _FilterTabBar(
            selectedIndex: _tabIndex,
            onTap: (i) {
              if (i != _tabIndex) setState(() => _tabIndex = i);
            },
          ),
        ),
      ),
      body: _HistoryBody(
        filter: _filter,
        scrollController: _scrollController,
      ),
    );
  }
}

// ── Filter tab bar ────────────────────────────────────────────────────────────

class _FilterTabBar extends StatelessWidget {
  const _FilterTabBar({required this.selectedIndex, required this.onTap});

  final int selectedIndex;
  final ValueChanged<int> onTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 44,
      color: context.tokens.bgSurface,
      child: Row(
        children: List.generate(_filters.length, (i) {
          final selected = i == selectedIndex;
          return Expanded(
            child: Semantics(
              label: _filters[i].$1,
              selected: selected,
              button: true,
              child: GestureDetector(
              onTap: () => onTap(i),
              behavior: HitTestBehavior.opaque,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  Text(
                    _filters[i].$1,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight:
                          selected ? FontWeight.w700 : FontWeight.w500,
                      color: selected ? Theme.of(context).colorScheme.primary : context.tokens.textMuted,
                    ),
                  ),
                  const SizedBox(height: 8),
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    height: 2,
                    color: selected ? Theme.of(context).colorScheme.primary : Colors.transparent,
                  ),
                ],
              ),
              ),
            ),
          );
        }),
      ),
    );
  }
}

// ── Body ──────────────────────────────────────────────────────────────────────

class _HistoryBody extends ConsumerWidget {
  const _HistoryBody({
    required this.filter,
    required this.scrollController,
  });

  final String filter;
  final ScrollController scrollController;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final historyAsync = ref.watch(watchHistoryNotifierProvider(filter));

    return historyAsync.when(
      loading: () => const _HistoryShimmer(),
      error: (e, _) => AppErrorState(
        error: e,
        fallbackTitle: 'Failed to load history',
        onRetry: () =>
            ref.invalidate(watchHistoryNotifierProvider(filter)),
      ),
      data: (state) {
        if (state.items.isEmpty) {
          return _EmptyState(filter: filter);
        }
        // Group items by parent title, compute per-group progress + next
        // unfinished item, then flatten into cells for a single ListView.
        final groups = <String, List<WatchHistoryItem>>{};
        final order = <String>[];
        for (final it in state.items) {
          final title = it.workshopTitle ?? it.courseTitle ?? '—';
          if (!groups.containsKey(title)) {
            order.add(title);
            groups[title] = [];
          }
          groups[title]!.add(it);
        }
        final cells = <Object>[];
        for (final title in order) {
          final items = groups[title]!;
          final done = items.where((i) => i.progressPercent >= 85).length;
          // Best-effort "next lesson to continue": first item that isn't done.
          final next = items.firstWhere(
            (i) => i.progressPercent < 85,
            orElse: () => items.first,
          );
          cells.add(_HistoryGroup(
            title: title,
            completed: done,
            total: items.length,
            continueTarget: next,
          ));
          cells.addAll(items);
        }
        final loaderExtra = state.hasMore ? 1 : 0;
        return RefreshIndicator(
          color: Theme.of(context).colorScheme.primary,
          backgroundColor: context.tokens.bgSurface,
          onRefresh: () => ref
              .read(watchHistoryNotifierProvider(filter).notifier)
              .refresh(),
          child: ListView.builder(
            controller: scrollController,
            padding: const EdgeInsets.symmetric(vertical: 8),
            itemCount: cells.length + loaderExtra,
            itemBuilder: (_, i) {
              if (i == cells.length) {
                return Padding(
                  padding: EdgeInsets.symmetric(vertical: 16),
                  child: Center(
                    child: SizedBox(
                      width: 24,
                      height: 24,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Theme.of(context).colorScheme.primary,
                      ),
                    ),
                  ),
                );
              }
              final cell = cells[i];
              if (cell is _HistoryGroup) {
                return _HistoryGroupHeader(group: cell);
              }
              final item = cell as WatchHistoryItem;
              final epId = item.episodeId;
              if (epId == null || epId.isEmpty) {
                return _HistoryCard(item: item);
              }
              return Dismissible(
                key: ValueKey('history-${item.type}-$epId'),
                direction: DismissDirection.endToStart,
                background: Container(
                  margin: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.md,
                    vertical: AppSpacing.xs + 1,
                  ),
                  alignment: Alignment.centerRight,
                  padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
                  decoration: BoxDecoration(
                    color: const Color(0xFFdc2626),
                    borderRadius: BorderRadius.circular(AppRadius.md),
                  ),
                  child: const Icon(Icons.delete_outline,
                      color: Colors.white, size: AppIconSize.md),
                ),
                onDismissed: (_) async {
                  try {
                    await ref
                        .read(watchHistoryNotifierProvider(filter).notifier)
                        .remove(epId);
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Removed from history'),
                          duration: Duration(seconds: 2),
                        ),
                      );
                    }
                  } catch (_) {
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Failed to remove — try again'),
                          duration: Duration(seconds: 2),
                        ),
                      );
                    }
                  }
                },
                child: _HistoryCard(item: item),
              );
            },
          ),
        );
      },
    );
  }
}

class _HistoryGroup {
  const _HistoryGroup({
    required this.title,
    required this.completed,
    required this.total,
    required this.continueTarget,
  });
  final String title;
  final int completed;
  final int total;
  final WatchHistoryItem continueTarget;
}

class _HistoryGroupHeader extends StatelessWidget {
  const _HistoryGroupHeader({required this.group});
  final _HistoryGroup group;

  void _continue(BuildContext context) {
    final it = group.continueTarget;
    if (it.type == 'course') {
      final courseId = it.courseId ?? it.id ?? '';
      final lessonId = it.lessonId;
      if (courseId.isEmpty) return;
      if (lessonId != null && lessonId.isNotEmpty) {
        context.push(AppRoutes.lessonPlayerPath(courseId, lessonId));
      } else {
        context.push(AppRoutes.courseDetailPath(courseId));
      }
    } else {
      final slug = it.workshopSlug ?? it.id ?? '';
      final epId = it.episodeId;
      if (slug.isEmpty) return;
      if (epId != null && epId.isNotEmpty) {
        context.push(AppRoutes.workshopEpisodePath(slug, epId));
      } else {
        context.push(AppRoutes.workshopDetailPath(slug));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final done = group.completed >= group.total;
    return AppSectionHeader(
      label: group.title,
      subtitle: done
          ? '${group.total} completed'
          : '${group.completed} of ${group.total} completed',
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.md + 2,
        AppSpacing.lg,
        AppSpacing.xs + 2,
      ),
      trailing: TextButton.icon(
        onPressed: () => _continue(context),
        icon: Icon(
          done ? Icons.replay : Icons.play_arrow,
          size: 14,
          color: Theme.of(context).colorScheme.primary,
        ),
        label: Text(
          done ? 'Rewatch' : 'Continue',
          style: TextStyle(
            color: Theme.of(context).colorScheme.primary,
            fontSize: 11,
            fontWeight: FontWeight.w700,
          ),
        ),
        style: TextButton.styleFrom(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm),
          minimumSize: Size.zero,
          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
        ),
      ),
    );
  }
}

// ── History card ──────────────────────────────────────────────────────────────

class _HistoryCard extends StatelessWidget {
  const _HistoryCard({required this.item});

  final WatchHistoryItem item;

  String _relativeTime(String? isoDate) {
    if (isoDate == null) return '';
    try {
      final dt = DateTime.parse(isoDate).toLocal();
      final diff = DateTime.now().difference(dt);
      if (diff.inDays >= 30) {
        final months = diff.inDays ~/ 30;
        return '${months}mo ago';
      }
      if (diff.inDays >= 1) return '${diff.inDays}d ago';
      if (diff.inHours >= 1) return '${diff.inHours}h ago';
      if (diff.inMinutes >= 1) return '${diff.inMinutes}m ago';
      return 'Just now';
    } catch (_) {
      return '';
    }
  }

  void _navigate(BuildContext context) {
    if (item.type == 'course' &&
        item.courseId != null &&
        item.episodeId != null) {
      context.push(AppRoutes.lessonPlayerPath(item.courseId!, item.episodeId!));
    } else if (item.workshopSlug != null) {
      context.push(AppRoutes.workshopDetailPath(item.workshopSlug!));
    }
  }

  @override
  Widget build(BuildContext context) {
    final displayTitle =
        item.workshopTitle ?? item.courseTitle ?? item.title ?? 'Untitled';
    final episodeTitle = item.episodeTitle ?? item.lastLessonTitle;
    final progress = (item.progressPercent.clamp(0, 100)) / 100.0;
    final isCompleted = item.isCompleted || item.progressPercent >= 100;
    final isWorkshop = item.type == 'workshop';

    return Semantics(
      label: displayTitle,
      button: true,
      child: AppCard(
        margin: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.xs + 1,
        ),
        padding: EdgeInsets.zero,
        onTap: () => _navigate(context),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Thumbnail
            ClipRRect(
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(AppRadius.md - 1),
                bottomLeft: Radius.circular(AppRadius.md - 1),
              ),
              child: SizedBox(
                width: 100,
                height: 90,
                child: item.thumbnailUrl != null
                    ? CachedNetworkImage(
                        imageUrl: item.thumbnailUrl!,
                        fit: BoxFit.cover,
                        errorWidget: (_, __, ___) =>
                            const _ThumbPlaceholder(),
                      )
                    : const _ThumbPlaceholder(),
              ),
            ),

            // Info
            Expanded(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.md,
                  AppSpacing.sm + 2,
                  AppSpacing.md,
                  AppSpacing.sm + 2,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Type chip
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: isWorkshop
                                ? Theme.of(context).colorScheme.primary.withValues(alpha: 0.12)
                                : const Color(0xFF1d4ed8)
                                    .withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            isWorkshop ? 'Workshop' : 'Course',
                            style: TextStyle(
                              fontSize: 9,
                              fontWeight: FontWeight.w700,
                              color: isWorkshop
                                  ? Theme.of(context).colorScheme.primary
                                  : const Color(0xFF60a5fa),
                              letterSpacing: 0.5,
                            ),
                          ),
                        ),
                        const Spacer(),
                        Text(
                          _relativeTime(item.updatedAt ?? item.lastWatchedAt),
                          style: TextStyle(
                            fontSize: 10,
                            color: context.tokens.textMuted,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 5),

                    // Title
                    Text(
                      displayTitle,
                      style: TextStyle(
                        color: context.tokens.textPrimary,
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        height: 1.3,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),

                    // Episode title
                    if (episodeTitle != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        episodeTitle,
                        style: TextStyle(
                          color: context.tokens.textMuted,
                          fontSize: 11,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],

                    const SizedBox(height: 8),

                    // Progress bar
                    ClipRRect(
                      borderRadius: BorderRadius.circular(2),
                      child: LinearProgressIndicator(
                        value: progress,
                        backgroundColor: context.tokens.borderCard,
                        valueColor: AlwaysStoppedAnimation<Color>(
                          isCompleted
                              ? const Color(0xFF16a34a)
                              : Theme.of(context).colorScheme.primary,
                        ),
                        minHeight: 3,
                      ),
                    ),
                    const SizedBox(height: 4),

                    Row(
                      children: [
                        Text(
                          isCompleted
                              ? 'Completed'
                              : '${item.progressPercent}% watched',
                          style: TextStyle(
                            color: context.tokens.textMuted,
                            fontSize: 10,
                          ),
                        ),
                        const Spacer(),
                        if (isCompleted)
                          const Icon(Icons.check_circle,
                              size: 13, color: Color(0xFF16a34a))
                        else
                          Icon(Icons.play_circle_outlined,
                              size: 13, color: Theme.of(context).colorScheme.primary),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ThumbPlaceholder extends StatelessWidget {
  const _ThumbPlaceholder();

  @override
  Widget build(BuildContext context) {
    return Container(
      color: context.tokens.bgInput,
      child: Center(
        child: Icon(Icons.play_lesson_outlined,
            color: context.tokens.textSubtle, size: 24),
      ),
    );
  }
}

// ── Empty state ───────────────────────────────────────────────────────────────

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.filter});

  final String filter;

  @override
  Widget build(BuildContext context) {
    final label = switch (filter) {
      'in_progress' => 'No in-progress content',
      'completed' => 'No completed content yet',
      _ => 'No watch history yet',
    };
    final sub = switch (filter) {
      'in_progress' => 'Start watching a course or workshop',
      'completed' => 'Complete a course or workshop to see it here',
      _ => 'Courses and workshops you watch will appear here',
    };
    return AppEmptyState(
      icon: Icons.history,
      title: label,
      subtitle: sub,
    );
  }
}

// ── Shimmer skeleton ──────────────────────────────────────────────────────────

class _HistoryShimmer extends StatelessWidget {
  const _HistoryShimmer();

  @override
  Widget build(BuildContext context) {
    return AppSkeleton(
      child: ListView.builder(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
        itemCount: 6,
        itemBuilder: (_, __) => Container(
          height: 90,
          margin: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.xs + 1,
          ),
          decoration: BoxDecoration(
            color: context.tokens.bgSurface,
            borderRadius: BorderRadius.circular(AppRadius.md),
          ),
        ),
      ),
    );
  }
}
