import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/theme/design_constants.dart';
import '../../../shared/theme/theme_tokens.dart';
import '../data/tbt_service.dart';
import '../domain/tbt_models.dart';
import '../providers/tbt_providers.dart';

/// TBT Points landing:
///   * level badge + total points + progress-to-next-level
///   * daily streak + completed-tasks progress
///   * task path with locked / current / completed cards
///   * leaderboard preview (top 5, "See all" link)
class TbtPointsScreen extends ConsumerWidget {
  const TbtPointsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = context.tokens;
    final async = ref.watch(tbtPathProvider);

    return Scaffold(
      backgroundColor: tokens.bgPage,
      appBar: AppBar(
        backgroundColor: tokens.bgSurface,
        elevation: 0,
        title: const Text('TBT Points',
            style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w700)),
      ),
      body: async.when(
        loading: () =>
            const Center(child: CircularProgressIndicator(color: kColorAccent)),
        error: (e, _) => Center(
          child: Text('Could not load your progress.',
              style: TextStyle(color: tokens.textSecondary)),
        ),
        data: (path) => RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(tbtPathProvider);
            ref.invalidate(tbtLeaderboardProvider);
          },
          child: ListView(
            padding: const EdgeInsets.only(bottom: 100),
            children: [
              _HeroCard(path: path),
              const SizedBox(height: 8),
              _TaskPath(path: path),
              const SizedBox(height: 12),
              const _LeaderboardPreview(),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Hero card: level + points + streak + progress ──────────────────

class _HeroCard extends StatelessWidget {
  const _HeroCard({required this.path});
  final TbtPath path;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final currentLevel = path.currentLevel;
    final nextLevel = path.nextLevel;

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 4),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Colors.amber.withValues(alpha: 0.14),
            kColorAccent.withValues(alpha: 0.10),
            Colors.transparent,
          ],
        ),
        border: Border.all(color: Colors.amber.withValues(alpha: 0.30)),
      ),
      child: Column(
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Level badge
              Container(
                width: 60,
                height: 60,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFFfacc15), Color(0xFFf59e0b)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(30),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.amber.withValues(alpha: 0.35),
                      blurRadius: 20,
                      spreadRadius: -4,
                    ),
                  ],
                ),
                child: Center(
                  child: Text(
                    currentLevel != null ? '${currentLevel.levelNumber}' : '—',
                    style: const TextStyle(
                      fontFamily: 'Rajdhani',
                      color: Colors.white,
                      fontSize: 24,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      currentLevel?.name ?? 'No level yet',
                      style: TextStyle(
                        color: tokens.textPrimary,
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      currentLevel?.description ??
                          'Complete your first task to enter Level 1.',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(color: tokens.textSecondary, fontSize: 12, height: 1.3),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          // Points row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _MetricPill(
                label: 'Total Points',
                value: path.totalPoints.toString(),
                color: const Color(0xFFfacc15),
              ),
              _MetricPill(
                label: 'Daily Streak',
                value: '${path.dailyStreak}d',
                color: const Color(0xFFef4444),
              ),
              _MetricPill(
                label: 'Stars',
                value: '${path.totalStars}/${path.tasks.length}',
                color: const Color(0xFF60a5fa),
              ),
            ],
          ),
          if (nextLevel != null) ...[
            const SizedBox(height: 16),
            Align(
              alignment: Alignment.centerLeft,
              child: Text(
                'Next: ${nextLevel.name} at ${nextLevel.requiredPoints.toString()} pts',
                style: TextStyle(color: tokens.textMuted, fontSize: 11),
              ),
            ),
            const SizedBox(height: 6),
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: path.levelProgress,
                minHeight: 6,
                backgroundColor: tokens.borderCard,
                color: const Color(0xFFfacc15),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _MetricPill extends StatelessWidget {
  const _MetricPill({required this.label, required this.value, required this.color});
  final String label;
  final String value;
  final Color color;
  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          value,
          style: TextStyle(
            fontFamily: 'Rajdhani',
            color: color,
            fontSize: 20,
            fontWeight: FontWeight.w800,
          ),
        ),
        Text(
          label,
          style: TextStyle(color: context.tokens.textMuted, fontSize: 10),
        ),
      ],
    );
  }
}

// ── Task path ──────────────────────────────────────────────────────

class _TaskPath extends ConsumerWidget {
  const _TaskPath({required this.path});
  final TbtPath path;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = context.tokens;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '90-Day Task Path',
            style: TextStyle(
              color: tokens.textSecondary,
              fontSize: 11,
              fontWeight: FontWeight.w800,
              letterSpacing: 1.2,
            ),
          ),
          const SizedBox(height: 10),
          ...path.tasks.map((t) => _TaskCard(task: t)),
        ],
      ),
    );
  }
}

class _TaskCard extends ConsumerStatefulWidget {
  const _TaskCard({required this.task});
  final TbtTask task;

  @override
  ConsumerState<_TaskCard> createState() => _TaskCardState();
}

class _TaskCardState extends ConsumerState<_TaskCard> {
  bool _busy = false;

  Future<void> _complete() async {
    if (_busy || widget.task.isLocked || widget.task.isCompleted) return;
    setState(() => _busy = true);
    try {
      await ref.read(tbtServiceProvider).completeTask(widget.task.id);
      ref.invalidate(tbtPathProvider);
      ref.invalidate(tbtLeaderboardProvider);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('+${widget.task.rewardPoints} points earned!'),
          duration: const Duration(seconds: 2),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Could not mark task complete.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final task = widget.task;
    final isCompleted = task.isCompleted;
    final isCurrent = task.status == 'current';
    final isLocked = task.isLocked;

    Color borderColor;
    Color badgeBg;
    Color badgeColor;
    IconData icon;
    if (isCompleted) {
      borderColor = const Color(0xFF4ade80).withValues(alpha: 0.4);
      badgeBg = const Color(0xFF4ade80).withValues(alpha: 0.12);
      badgeColor = const Color(0xFF4ade80);
      icon = Icons.check_circle;
    } else if (isCurrent) {
      borderColor = const Color(0xFFfacc15).withValues(alpha: 0.5);
      badgeBg = const Color(0xFFfacc15).withValues(alpha: 0.12);
      badgeColor = const Color(0xFFfacc15);
      icon = Icons.play_circle_fill;
    } else {
      borderColor = tokens.borderCard;
      badgeBg = tokens.bgInput;
      badgeColor = tokens.textMuted;
      icon = Icons.lock_outline;
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: tokens.bgSurface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: borderColor, width: isCurrent ? 1.5 : 1),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: badgeBg,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: borderColor),
                  ),
                  child: Icon(icon, color: badgeColor, size: 18),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              '${task.taskOrder}. ${task.title}',
                              style: TextStyle(
                                color: isLocked ? tokens.textMuted : tokens.textPrimary,
                                fontSize: 14,
                                fontWeight: FontWeight.w700,
                                height: 1.3,
                              ),
                            ),
                          ),
                          Container(
                            padding:
                                const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: Colors.amber.withValues(alpha: 0.14),
                              borderRadius: BorderRadius.circular(4),
                              border:
                                  Border.all(color: Colors.amber.withValues(alpha: 0.3)),
                            ),
                            child: Text(
                              '+${task.rewardPoints}',
                              style: const TextStyle(
                                color: Color(0xFFfacc15),
                                fontSize: 10,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                        ],
                      ),
                      if (task.description != null && task.description!.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Text(
                            task.description!,
                            style: TextStyle(
                              color: tokens.textSecondary,
                              fontSize: 12,
                              height: 1.4,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ),
            if (task.requiredAction != null && task.requiredAction!.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 10, left: 48),
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  decoration: BoxDecoration(
                    color: tokens.bgInput,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    task.requiredAction!,
                    style: TextStyle(
                      color: tokens.textSecondary,
                      fontSize: 11,
                      height: 1.4,
                    ),
                  ),
                ),
              ),
            if (isCurrent)
              Padding(
                padding: const EdgeInsets.only(top: 12, left: 48),
                child: FilledButton(
                  onPressed: _busy ? null : _complete,
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFFfacc15),
                    foregroundColor: Colors.black,
                    minimumSize: const Size.fromHeight(38),
                  ),
                  child: _busy
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black),
                        )
                      : const Text('MARK AS COMPLETE',
                          style: TextStyle(fontWeight: FontWeight.w800, letterSpacing: 0.6)),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

// ── Leaderboard preview ────────────────────────────────────────────

class _LeaderboardPreview extends ConsumerWidget {
  const _LeaderboardPreview();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = context.tokens;
    final async = ref.watch(tbtLeaderboardProvider);
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Leaderboard',
            style: TextStyle(
              color: tokens.textSecondary,
              fontSize: 11,
              fontWeight: FontWeight.w800,
              letterSpacing: 1.2,
            ),
          ),
          const SizedBox(height: 10),
          async.when(
            loading: () => const Padding(
              padding: EdgeInsets.symmetric(vertical: 20),
              child: Center(child: CircularProgressIndicator(color: kColorAccent)),
            ),
            error: (_, __) => Text(
              'Could not load leaderboard.',
              style: TextStyle(color: tokens.textSecondary, fontSize: 12),
            ),
            data: (rows) {
              if (rows.isEmpty) {
                return Text(
                  'No one on the board yet — be the first!',
                  style: TextStyle(color: tokens.textMuted, fontSize: 12),
                );
              }
              final top = rows.take(10).toList();
              return Container(
                decoration: BoxDecoration(
                  color: tokens.bgSurface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: tokens.borderCard),
                ),
                child: Column(
                  children: [
                    for (var i = 0; i < top.length; i++) ...[
                      _LeaderTile(row: top[i]),
                      if (i < top.length - 1)
                        Divider(height: 1, color: tokens.borderCard),
                    ],
                  ],
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}

class _LeaderTile extends StatelessWidget {
  const _LeaderTile({required this.row});
  final LeaderboardRow row;
  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Container(
      color: row.isMe
          ? const Color(0xFFfacc15).withValues(alpha: 0.08)
          : Colors.transparent,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      child: Row(
        children: [
          SizedBox(
            width: 28,
            child: Text(
              '#${row.rank}',
              style: TextStyle(
                fontFamily: 'Rajdhani',
                color: row.rank <= 3
                    ? const Color(0xFFfacc15)
                    : tokens.textMuted,
                fontSize: 13,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          if (row.memberPhoto != null && row.memberPhoto!.isNotEmpty)
            ClipOval(
              child: CachedNetworkImage(
                imageUrl: row.memberPhoto!,
                width: 26,
                height: 26,
                fit: BoxFit.cover,
                errorWidget: (_, __, ___) => Container(
                  width: 26,
                  height: 26,
                  color: kColorBgInput,
                ),
              ),
            )
          else
            Container(
              width: 26,
              height: 26,
              decoration: BoxDecoration(
                color: kColorBgInput,
                shape: BoxShape.circle,
              ),
              child: Icon(Icons.person, size: 14, color: tokens.textMuted),
            ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              row.memberName ?? 'Member',
              style: TextStyle(
                color: row.isMe ? Colors.white : tokens.textPrimary,
                fontSize: 13,
                fontWeight: row.isMe ? FontWeight.w700 : FontWeight.w500,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          Text(
            '${row.totalPoints} pts',
            style: const TextStyle(
              color: Color(0xFFfacc15),
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}
