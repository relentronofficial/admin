import '../../../shared/widgets/app_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shimmer/shimmer.dart';

import '../../../shared/models/lesson.dart';
import '../providers/courses_provider.dart';

import '../../../shared/theme/theme_tokens.dart';
class BadgesScreen extends ConsumerWidget {
  const BadgesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final badgesAsync = ref.watch(earnedBadgesProvider);

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
          'MY BADGES',
          style: TextStyle(
            fontFamily: 'Rajdhani',
            fontSize: 17,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.5,
            color: context.tokens.textPrimary,
          ),
        ),
        actions: [
          IconButton(
            icon: Icon(Icons.refresh, color: context.tokens.textMuted, size: 20),
            onPressed: () => ref.invalidate(earnedBadgesProvider),
          ),
        ],
      ),
      body: badgesAsync.when(
        loading: () => _BadgesShimmer(),
        error: (_, __) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.error_outline,
                  color: context.tokens.textMuted, size: 40),
              const SizedBox(height: 12),
              Text('Failed to load badges',
                  style: TextStyle(color: context.tokens.textSecondary)),
              const SizedBox(height: 12),
              TextButton(
                onPressed: () => ref.invalidate(earnedBadgesProvider),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
        data: (badges) {
          if (badges.isEmpty) {
            return const _EmptyBadgesView();
          }
          return GridView.builder(
            padding: const EdgeInsets.all(12),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              crossAxisSpacing: 10,
              mainAxisSpacing: 10,
              childAspectRatio: 0.85,
            ),
            itemCount: badges.length,
            itemBuilder: (_, i) => _BadgeCard(badge: badges[i]),
          );
        },
      ),
    );
  }
}

// ── Badge card ────────────────────────────────────────────────────────────────

class _BadgeCard extends StatelessWidget {
  const _BadgeCard({required this.badge});

  final EarnedBadge badge;

  String _formatDate(String isoDate) {
    try {
      final dt = DateTime.parse(isoDate).toLocal();
      const months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ];
      return '${months[dt.month - 1]} ${dt.day}, ${dt.year}';
    } catch (_) {
      return '';
    }
  }

  @override
  Widget build(BuildContext context) {
    final info = badge.badge;

    return Container(
      decoration: BoxDecoration(
        color: context.tokens.bgSurface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: context.tokens.borderCard),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          // Badge image
          Expanded(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
              child: AppNetworkImage(
                url: info.imageUrl,
                width: 200,
                fit: BoxFit.contain,
                fallbackIcon: Icons.emoji_events_outlined,
              ),
            ),
          ),

          // Badge info
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 14),
            child: Column(
              children: [
                Text(
                  info.name,
                  style: TextStyle(
                    color: context.tokens.textPrimary,
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    height: 1.3,
                  ),
                  textAlign: TextAlign.center,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 4),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.military_tech_outlined,
                        size: 11, color: Theme.of(context).colorScheme.primary),
                    const SizedBox(width: 3),
                    Text(
                      _formatDate(badge.earnedAt),
                      style: TextStyle(
                        color: context.tokens.textMuted,
                        fontSize: 10,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Empty state ───────────────────────────────────────────────────────────────

class _EmptyBadgesView extends StatelessWidget {
  const _EmptyBadgesView();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.military_tech_outlined,
              color: context.tokens.textMuted, size: 56),
          SizedBox(height: 16),
          Text(
            'No badges earned yet',
            style: TextStyle(
              color: context.tokens.textSecondary,
              fontSize: 15,
              fontWeight: FontWeight.w600,
            ),
          ),
          SizedBox(height: 8),
          Text(
            'Complete courses to earn your first badge',
            style: TextStyle(
              color: context.tokens.textMuted,
              fontSize: 13,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Shimmer skeleton ──────────────────────────────────────────────────────────

class _BadgesShimmer extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      padding: const EdgeInsets.all(12),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: 10,
        mainAxisSpacing: 10,
        childAspectRatio: 0.85,
      ),
      itemCount: 6,
      itemBuilder: (_, __) => Shimmer.fromColors(
        baseColor: context.tokens.bgSurface,
        highlightColor: context.tokens.bgInput,
        child: Container(
          decoration: BoxDecoration(
            color: context.tokens.bgSurface,
            borderRadius: BorderRadius.circular(10),
          ),
        ),
      ),
    );
  }
}
