import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shimmer/shimmer.dart';

import '../../../shared/models/workshop.dart';
import '../../../shared/theme/tbt_theme.dart';
import '../providers/workshops_provider.dart';

import '../../../shared/theme/theme_tokens.dart';
// ── Delivery mode chip config ─────────────────────────────────────────────────

({Color bg, Color text}) _modeColors(DeliveryMode mode) => switch (mode) {
      DeliveryMode.online => (
          bg: const Color(0xFF1e3a5f),
          text: const Color(0xFF60a5fa)
        ),
      DeliveryMode.offline => (
          bg: const Color(0xFF3d2600),
          text: const Color(0xFFfb923c)
        ),
      DeliveryMode.hybrid => (
          bg: const Color(0xFF2e1a47),
          text: const Color(0xFFa78bfa)
        ),
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
              error: (e, _) =>
                  _buildError(context, () => ref.invalidate(workshopsProvider)),
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
                      onTap: () => context.go(
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
    final modeColors = _modeColors(w.deliveryMode);
    final isEnrolled = w.enrollmentStatus == 'active';
    final isCompleted = w.enrollmentStatus == 'completed';

    return Semantics(
      label: '${w.title}${w.locked ? ', locked' : ''}',
      button: true,
      child: GestureDetector(
      onTap: w.locked ? null : onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        decoration: BoxDecoration(
          color: context.tokens.bgSurface,
          border: Border.all(color: context.tokens.borderCard),
          borderRadius: BorderRadius.circular(12),
        ),
        clipBehavior: Clip.hardEdge,
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
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Mode chip + status badges
                      Row(
                        children: [
                          _Chip(
                            label: _modeLabel(
                                w.deliveryMode, w.deliveryModeLabel),
                            bg: modeColors.bg,
                            fg: modeColors.text,
                          ),
                          if (isEnrolled) ...[
                            const SizedBox(width: 6),
                            _Chip(
                              label: 'Enrolled',
                              bg: const Color(0xFF14532d),
                              fg: const Color(0xFF4ade80),
                            ),
                          ] else if (isCompleted) ...[
                            const SizedBox(width: 6),
                            _Chip(
                              label: 'Completed',
                              bg: const Color(0xFF1e3a5f),
                              fg: const Color(0xFF60a5fa),
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

class _Chip extends StatelessWidget {
  const _Chip({required this.label, required this.bg, required this.fg});
  final String label;
  final Color bg;
  final Color fg;

  @override
  Widget build(BuildContext context) => Container(
        padding:
            const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(4),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: fg,
            fontSize: 10,
            fontWeight: FontWeight.w700,
            fontFamily: 'Rajdhani',
            letterSpacing: 0.5,
          ),
        ),
      );
}

// ── Shimmer skeleton ──────────────────────────────────────────────────────────

Widget _buildSkeleton(BuildContext context) => Shimmer.fromColors(
      baseColor: context.tokens.bgSurface,
      highlightColor: context.tokens.bgInput,
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
        itemCount: 4,
        itemBuilder: (_, __) => Container(
          margin: const EdgeInsets.only(bottom: 12),
          decoration: BoxDecoration(
            color: context.tokens.bgSurface,
            borderRadius: BorderRadius.circular(12),
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
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                        height: 16, width: 80, color: context.tokens.bgInput),
                    const SizedBox(height: 10),
                    Container(
                        height: 14,
                        width: double.infinity,
                        color: context.tokens.bgInput),
                    const SizedBox(height: 6),
                    Container(
                        height: 14, width: 200, color: context.tokens.bgInput),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );

// ── Error / empty states ──────────────────────────────────────────────────────

Widget _buildError(BuildContext context, VoidCallback onRetry) => Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.error_outline, color: context.tokens.textMuted, size: 40),
          const SizedBox(height: 12),
          Text('Failed to load workshops',
              style: TextStyle(color: context.tokens.textSecondary)),
          const SizedBox(height: 12),
          TextButton(onPressed: onRetry, child: const Text('Retry')),
        ],
      ),
    );

Widget _buildEmpty(BuildContext context, bool isSearch) => Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            isSearch ? Icons.search_off : Icons.school_outlined,
            color: context.tokens.textMuted,
            size: 48,
          ),
          const SizedBox(height: 12),
          Text(
            isSearch ? 'No workshops match your search' : 'No workshops yet',
            style: TextStyle(
              color: context.tokens.textSecondary,
              fontSize: 15,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
