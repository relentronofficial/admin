import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../shared/models/workshop.dart';
import '../../../shared/theme/design_tokens.dart';
import '../../../shared/theme/tbt_theme.dart';
import '../../../shared/theme/theme_tokens.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_empty_state.dart';
import '../../../shared/widgets/app_error_state.dart';
import '../../../shared/widgets/app_skeleton.dart';
import '../providers/workshops_provider.dart';

// ── Delivery mode chip config ─────────────────────────────────────────────────
// Chip pattern: single semantic accent per mode + 12% alpha fill so the same
// chip reads correctly in both light and dark themes. See app-wide chip
// convention documented in workshop_detail_screen.dart.

Color _modeAccent(DeliveryMode mode) => switch (mode) {
      DeliveryMode.online => const Color(0xFF3b82f6),  // blue-500
      DeliveryMode.offline => const Color(0xFFea580c), // orange-600
      DeliveryMode.hybrid => const Color(0xFF7c3aed),  // violet-600
    };

String _modeLabel(DeliveryMode mode, String? label) {
  if (label != null && label.isNotEmpty) return label;
  return switch (mode) {
    DeliveryMode.online => 'Online',
    DeliveryMode.offline => 'In-Person',
    DeliveryMode.hybrid => 'Hybrid',
  };
}

// ── Screen ────────────────────────────────────────────────────────────────────

class WorkshopsScreen extends ConsumerStatefulWidget {
  const WorkshopsScreen({super.key});

  @override
  ConsumerState<WorkshopsScreen> createState() => _WorkshopsScreenState();
}

class _WorkshopsScreenState extends ConsumerState<WorkshopsScreen> {
  final _searchCtrl = TextEditingController();
  Timer? _debounce;
  String _query = '';

  @override
  void dispose() {
    _debounce?.cancel();
    _searchCtrl.dispose();
    super.dispose();
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () {
      if (mounted) setState(() => _query = value.trim().toLowerCase());
    });
  }

  List<Workshop> _filter(List<Workshop> all) {
    if (_query.isEmpty) return all;
    return all
        .where((w) =>
            w.title.toLowerCase().contains(_query) ||
            (w.description?.toLowerCase().contains(_query) ?? false))
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    final accent = context.tbt.accent;
    final workshopsAsync = ref.watch(workshopsProvider);

    return Scaffold(
      appBar: AppBar(
        backgroundColor: context.tokens.bgSurface,
        elevation: 0,
        scrolledUnderElevation: 0,
        automaticallyImplyLeading: false,
        title: Text(
          'WORKSHOPS',
          style: TextStyle(
            fontFamily: 'Rajdhani',
            fontSize: 18,
            fontWeight: FontWeight.w700,
            letterSpacing: 2,
            color: context.tokens.textPrimary,
          ),
        ),
      ),
      body: Column(
        children: [
          // Search bar
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: TextField(
              controller: _searchCtrl,
              onChanged: _onSearchChanged,
              style: TextStyle(color: context.tokens.textPrimary, fontSize: 14),
              decoration: InputDecoration(
                hintText: 'Search workshops…',
                hintStyle:
                    TextStyle(color: context.tokens.textMuted, fontSize: 14),
                prefixIcon: Icon(Icons.search,
                    color: context.tokens.textMuted, size: 20),
                suffixIcon: _query.isNotEmpty
                    ? IconButton(
                        icon: Icon(Icons.close,
                            color: context.tokens.textMuted, size: 18),
                        onPressed: () {
                          _searchCtrl.clear();
                          setState(() => _query = '');
                        },
                      )
                    : null,
                filled: true,
                fillColor: context.tokens.bgSurface,
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: BorderSide(color: context.tokens.borderCard),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: BorderSide(color: context.tokens.borderCard),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: BorderSide(color: accent),
                ),
              ),
            ),
          ),

          // List
          Expanded(
            child: workshopsAsync.when(
              loading: () => _buildSkeleton(context),
              error: (e, _) => AppErrorState(
                error: e,
                onRetry: () => ref.invalidate(workshopsProvider),
              ),
              data: (all) {
                final workshops = _filter(all);
                if (workshops.isEmpty) {
                  return _buildEmpty(context, _query.isNotEmpty);
                }
                return RefreshIndicator(
                  color: accent,
                  backgroundColor: context.tokens.bgSurface,
                  onRefresh: () async {
                    ref.invalidate(workshopsProvider);
                    await ref
                        .read(workshopsProvider.future)
                        .catchError((_) => <Workshop>[]);
                  },
                  child: ListView.builder(
                    padding:
                        const EdgeInsets.fromLTRB(16, 4, 16, 32),
                    itemCount: workshops.length,
                    itemBuilder: (context, i) => _WorkshopCard(
                      workshop: workshops[i],
                      accent: accent,
                      onTap: () => context.push(
                        '/workshops/${workshops[i].slug}',
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

// ── Workshop card ─────────────────────────────────────────────────────────────

class _WorkshopCard extends StatelessWidget {
  const _WorkshopCard({
    required this.workshop,
    required this.accent,
    required this.onTap,
  });

  final Workshop workshop;
  final Color accent;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final w = workshop;
    final modeAccent = _modeAccent(w.deliveryMode);
    final isEnrolled = w.enrollmentStatus == 'active';
    final isCompleted = w.enrollmentStatus == 'completed';

    return Semantics(
      label: '${w.title}${w.locked ? ', locked' : ''}',
      button: true,
      child: AppCard(
        margin: const EdgeInsets.only(bottom: AppSpacing.md),
        padding: EdgeInsets.zero,
        onTap: w.locked ? null : onTap,
        child: Stack(
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Thumbnail
                AspectRatio(
                  aspectRatio: 16 / 9,
                  child: w.thumbnailUrl != null
                      ? CachedNetworkImage(
                          imageUrl: w.thumbnailUrl!,
                          fit: BoxFit.cover,
                          placeholder: (_, __) => ColoredBox(
                              color: context.tokens.bgInput),
                          errorWidget: (_, __, ___) =>
                              const _ThumbFallback(),
                        )
                      : const _ThumbFallback(),
                ),

                // Content
                Padding(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Mode chip + status badges
                      Row(
                        children: [
                          _Chip(
                            label: _modeLabel(
                                w.deliveryMode, w.deliveryModeLabel),
                            accent: modeAccent,
                          ),
                          if (isEnrolled) ...[
                            const SizedBox(width: AppSpacing.xs),
                            const _Chip(
                              label: 'Enrolled',
                              accent: Color(0xFF16a34a),
                            ),
                          ] else if (isCompleted) ...[
                            const SizedBox(width: AppSpacing.xs),
                            const _Chip(
                              label: 'Completed',
                              accent: Color(0xFF3b82f6),
                            ),
                          ],
                          const Spacer(),
                          if (w.challengeCount > 0)
                            Text(
                              '${w.challengeCount} challenges',
                              style: TextStyle(
                                color: context.tokens.textMuted,
                                fontSize: 11,
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(height: 8),

                      // Title
                      Text(
                        w.title,
                        style: TextStyle(
                          color: context.tokens.textPrimary,
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          height: 1.3,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),

                      // Description
                      if (w.description != null &&
                          w.description!.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text(
                          w.description!,
                          style: TextStyle(
                            color: context.tokens.textMuted,
                            fontSize: 13,
                            height: 1.4,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),

            // Locked overlay
            if (w.locked)
              Positioned.fill(
                child: Container(
                  decoration: BoxDecoration(
                    color: Colors.black.withAlpha(178),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.lock_outline,
                          color: Colors.white70, size: 32),
                      SizedBox(height: 8),
                      Text(
                        'Not available for your batch',
                        style: TextStyle(
                          color: Colors.white70,
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                        ),
                        textAlign: TextAlign.center,
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

// ── Thumbnail fallback ────────────────────────────────────────────────────────

class _ThumbFallback extends StatelessWidget {
  const _ThumbFallback();

  @override
  Widget build(BuildContext context) => ColoredBox(
        color: context.tokens.bgInput,
        child: Center(
          child: Icon(Icons.play_circle_outline,
              color: context.tokens.textMuted, size: 40),
        ),
      );
}

// ── Small chip ────────────────────────────────────────────────────────────────

/// Standard status chip. Renders `accent` as the foreground; background
/// is auto-derived at 12% alpha so the chip reads on both light and
/// dark surfaces (app-wide convention, matches workshop_detail).
class _Chip extends StatelessWidget {
  const _Chip({required this.label, required this.accent});
  final String label;
  final Color accent;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.sm,
          vertical: AppSpacing.xs / 2,
        ),
        decoration: BoxDecoration(
          color: accent.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(AppRadius.sm),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: accent,
            fontSize: 10,
            fontWeight: FontWeight.w700,
            fontFamily: 'Rajdhani',
            letterSpacing: 0.5,
          ),
        ),
      );
}

// ── Shimmer skeleton ──────────────────────────────────────────────────────────

Widget _buildSkeleton(BuildContext context) => AppSkeleton(
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.lg,
          AppSpacing.xs,
          AppSpacing.lg,
          AppSpacing.xxxl,
        ),
        itemCount: 4,
        itemBuilder: (_, __) => Container(
          margin: const EdgeInsets.only(bottom: AppSpacing.md),
          decoration: BoxDecoration(
            color: context.tokens.bgSurface,
            borderRadius: BorderRadius.circular(AppRadius.lg),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Thumbnail placeholder
              AspectRatio(
                aspectRatio: 16 / 9,
                child: Container(color: context.tokens.bgInput),
              ),
              Padding(
                padding: const EdgeInsets.all(AppSpacing.md),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: const [
                    AppSkeletonBlock(width: 80, height: 16),
                    SizedBox(height: AppSpacing.sm),
                    AppSkeletonBlock(width: double.infinity, height: 14),
                    SizedBox(height: AppSpacing.xs),
                    AppSkeletonBlock(width: 200, height: 14),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );

// ── Empty state ───────────────────────────────────────────────────────────────

Widget _buildEmpty(BuildContext context, bool isSearch) => AppEmptyState(
      icon: isSearch ? Icons.search_off : Icons.school_outlined,
      title: isSearch ? 'No workshops match your search' : 'No workshops yet',
      subtitle: isSearch
          ? 'Try a different keyword — the catalog updates as new '
              'workshops are published.'
          : 'New workshops are added regularly. Check back soon.',
    );
