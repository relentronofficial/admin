import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shimmer/shimmer.dart';

import '../../../shared/models/lesson.dart';
import '../../../shared/theme/design_constants.dart';
import '../providers/courses_provider.dart';

class BadgesScreen extends ConsumerWidget {
  const BadgesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final badgesAsync = ref.watch(earnedBadgesProvider);

    return Scaffold(
      appBar: AppBar(
        backgroundColor: kColorBgSurface,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: kColorTextPrimary),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: const Text(
          'MY BADGES',
          style: TextStyle(
            fontFamily: 'Rajdhani',
            fontSize: 17,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.5,
            color: kColorTextPrimary,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: kColorTextMuted, size: 20),
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
              const Icon(Icons.error_outline,
                  color: kColorTextMuted, size: 40),
              const SizedBox(height: 12),
              const Text('Failed to load badges',
                  style: TextStyle(color: kColorTextSecondary)),
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
        color: kColorBgSurface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: kColorBorderCard),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          // Badge image
          Expanded(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
              child: info.imageUrl != null
                  ? CachedNetworkImage(
                      imageUrl: info.imageUrl!,
                      fit: BoxFit.contain,
                      errorWidget: (_, __, ___) =>
                          const _BadgePlaceholder(),
                    )
                  : const _BadgePlaceholder(),
            ),
          ),

          // Badge info
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 14),
            child: Column(
              children: [
                Text(
                  info.name,
                  style: const TextStyle(
                    color: kColorTextPrimary,
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
                    const Icon(Icons.military_tech_outlined,
                        size: 11, color: kColorAccent),
                    const SizedBox(width: 3),
                    Text(
                      _formatDate(badge.earnedAt),
                      style: const TextStyle(
                        color: kColorTextMuted,
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

class _BadgePlaceholder extends StatelessWidget {
  const _BadgePlaceholder();

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: kColorAccent.withValues(alpha: 0.1),
        shape: BoxShape.circle,
      ),
      child: const Center(
        child: Icon(Icons.military_tech_outlined,
            color: kColorAccent, size: 40),
      ),
    );
  }
}

// ── Empty state ───────────────────────────────────────────────────────────────

class _EmptyBadgesView extends StatelessWidget {
  const _EmptyBadgesView();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.military_tech_outlined,
              color: kColorTextMuted, size: 56),
          SizedBox(height: 16),
          Text(
            'No badges earned yet',
            style: TextStyle(
              color: kColorTextSecondary,
              fontSize: 15,
              fontWeight: FontWeight.w600,
            ),
          ),
          SizedBox(height: 8),
          Text(
            'Complete courses to earn your first badge',
            style: TextStyle(
              color: kColorTextMuted,
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
        baseColor: kColorBgSurface,
        highlightColor: kColorBgInput,
        child: Container(
          decoration: BoxDecoration(
            color: kColorBgSurface,
            borderRadius: BorderRadius.circular(10),
          ),
        ),
      ),
    );
  }
}
