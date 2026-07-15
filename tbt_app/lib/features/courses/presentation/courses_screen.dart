import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shimmer/shimmer.dart';

import '../../../shared/models/course.dart';
import '../../../shared/theme/tbt_theme.dart';
import '../providers/courses_provider.dart';

import '../../../shared/theme/theme_tokens.dart';
class CoursesScreen extends ConsumerStatefulWidget {
  const CoursesScreen({super.key});

  @override
  ConsumerState<CoursesScreen> createState() => _CoursesScreenState();
}

class _CoursesScreenState extends ConsumerState<CoursesScreen> {
  final _searchCtrl = TextEditingController();
  Timer? _debounce;
  String _query = '';
  String _level = 'all';

  static const _levels = ['all', 'beginner', 'intermediate', 'advanced'];

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

  List<Course> _filter(List<Course> all) {
    return all.where((c) {
      if (_level != 'all' && (c.level?.toLowerCase() ?? '') != _level) {
        return false;
      }
      if (_query.isEmpty) return true;
      final title = c.title.toLowerCase();
      final desc = c.description?.toLowerCase() ?? '';
      return title.contains(_query) || desc.contains(_query);
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final accent = context.tbt.accent;
    final coursesAsync = ref.watch(coursesProvider);

    return Scaffold(
      appBar: AppBar(
        backgroundColor: context.tokens.bgSurface,
        elevation: 0,
        scrolledUnderElevation: 0,
        automaticallyImplyLeading: false,
        title: Text(
          'COURSES',
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
                hintText: 'Search courses…',
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

          // Level filter chips
          SizedBox(
            height: 40,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              itemCount: _levels.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (_, i) {
                final l = _levels[i];
                final active = _level == l;
                return ChoiceChip(
                  label: Text(
                    l[0].toUpperCase() + l.substring(1),
                    style: TextStyle(
                      color: active ? Colors.white : context.tokens.textSecondary,
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  selected: active,
                  onSelected: (_) => setState(() => _level = l),
                  selectedColor: accent,
                  backgroundColor: context.tokens.bgSurface,
                  side: BorderSide(
                    color: active ? accent : context.tokens.borderCard,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(20),
                  ),
                );
              },
            ),
          ),

          // Grid
          Expanded(
            child: coursesAsync.when(
              loading: () => _buildSkeleton(context),
              error: (e, _) => _buildError(
                  context, () => ref.invalidate(coursesProvider)),
              data: (all) {
                final courses = _filter(all);
                if (courses.isEmpty) {
                  return _buildEmpty(context, _query.isNotEmpty);
                }
                return RefreshIndicator(
                  color: accent,
                  backgroundColor: context.tokens.bgSurface,
                  onRefresh: () async {
                    ref.invalidate(coursesProvider);
                    await ref
                        .read(coursesProvider.future)
                        .catchError((_) => <Course>[]);
                  },
                  child: GridView.builder(
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
                    gridDelegate:
                        const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      mainAxisSpacing: 12,
                      crossAxisSpacing: 12,
                      childAspectRatio: 0.72,
                    ),
                    itemCount: courses.length,
                    itemBuilder: (context, i) => _CourseCard(
                      course: courses[i],
                      accent: accent,
                      onTap: () =>
                          context.push('/learning/${courses[i].id}'),
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

// ── Course card ───────────────────────────────────────────────────────────────

class _CourseCard extends StatelessWidget {
  const _CourseCard({
    required this.course,
    required this.accent,
    required this.onTap,
  });

  final Course course;
  final Color accent;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = course;
    final isLocked = !c.hasAccess;

    return Semantics(
      label: '${c.title}${isLocked ? ', locked' : ''}',
      button: true,
      child: GestureDetector(
      onTap: onTap,
      child: Container(
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
                  child: c.thumbnailUrl != null
                      ? CachedNetworkImage(
                          imageUrl: c.thumbnailUrl!,
                          fit: BoxFit.cover,
                          placeholder: (_, __) =>
                              ColoredBox(color: context.tokens.bgInput),
                          errorWidget: (_, __, ___) =>
                              const _ThumbFallback(),
                        )
                      : const _ThumbFallback(),
                ),

                // Content
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.all(10),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Title
                        Text(
                          c.title,
                          style: TextStyle(
                            color: context.tokens.textPrimary,
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            height: 1.3,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),

                        const Spacer(),

                        // Bottom row: price + status chip
                        Row(
                          children: [
                            // Price
                            Text(
                              _priceLabel(c.price),
                              style: TextStyle(
                                color: c.price != null
                                    ? context.tokens.textPrimary
                                    : const Color(0xFF22c55e),
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            const Spacer(),
                            // Status chip
                            if (c.hasAccess) _accessChip(),
                          ],
                        ),

                        // Lesson count / duration
                        if (c.count != null || c.durationDisplay != null) ...[
                          const SizedBox(height: 4),
                          Text(
                            _metaLine(c),
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

            // Locked overlay
            if (isLocked)
              Positioned.fill(
                child: Container(
                  decoration: BoxDecoration(
                    color: Colors.black.withAlpha(140),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.lock_outline,
                          color: Colors.white70, size: 28),
                      const SizedBox(height: 6),
                      Padding(
                        padding:
                            const EdgeInsets.symmetric(horizontal: 8),
                        child: Text(
                          _priceLabel(c.price) == 'Free'
                              ? 'Request Access'
                              : _priceLabel(c.price),
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                          ),
                          textAlign: TextAlign.center,
                        ),
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

  String _priceLabel(double? price) {
    if (price == null || price == 0) return 'Free';
    if (price == price.truncateToDouble()) {
      return '₹${price.toInt()}';
    }
    return '₹${price.toStringAsFixed(2)}';
  }

  String _metaLine(Course c) {
    final parts = <String>[];
    final lessons = c.count?.lessons ?? 0;
    if (lessons > 0) parts.add('$lessons lesson${lessons > 1 ? 's' : ''}');
    if (c.durationDisplay != null) parts.add(c.durationDisplay!);
    return parts.join(' · ');
  }

  Widget _accessChip() => Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
        decoration: BoxDecoration(
          color: const Color(0xFF14532d),
          borderRadius: BorderRadius.circular(3),
        ),
        child: const Text(
          'Enrolled',
          style: TextStyle(
            color: Color(0xFF4ade80),
            fontSize: 9,
            fontWeight: FontWeight.w700,
            fontFamily: 'Rajdhani',
          ),
        ),
      );
}

// ── Thumbnail fallback ────────────────────────────────────────────────────────

class _ThumbFallback extends StatelessWidget {
  const _ThumbFallback();

  @override
  Widget build(BuildContext context) => ColoredBox(
        color: context.tokens.bgInput,
        child: Center(
          child: Icon(Icons.play_circle_outline,
              color: context.tokens.textMuted, size: 32),
        ),
      );
}

// ── Shimmer skeleton ──────────────────────────────────────────────────────────

Widget _buildSkeleton(BuildContext context) => Shimmer.fromColors(
      baseColor: context.tokens.bgSurface,
      highlightColor: context.tokens.bgInput,
      child: GridView.builder(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          mainAxisSpacing: 12,
          crossAxisSpacing: 12,
          childAspectRatio: 0.72,
        ),
        itemCount: 6,
        itemBuilder: (_, __) => Container(
          decoration: BoxDecoration(
            color: context.tokens.bgSurface,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              AspectRatio(
                aspectRatio: 16 / 9,
                child: Container(color: context.tokens.bgInput),
              ),
              Padding(
                padding: const EdgeInsets.all(10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                        height: 13,
                        width: double.infinity,
                        color: context.tokens.bgInput),
                    const SizedBox(height: 6),
                    Container(
                        height: 13, width: 80, color: context.tokens.bgInput),
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
          Text('Failed to load courses',
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
            isSearch ? 'No courses match your search' : 'No courses yet',
            style: TextStyle(
              color: context.tokens.textSecondary,
              fontSize: 15,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
