import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../shared/models/course.dart';
import '../../../shared/theme/design_tokens.dart';
import '../providers/courses_provider.dart';

import '../../../shared/theme/theme_tokens.dart';
import '../../../shared/widgets/app_empty_state.dart';
import '../../../shared/widgets/app_error_state.dart';
import '../../../shared/widgets/app_network_image.dart';
import '../../../shared/widgets/app_skeleton.dart';

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
  static const _accent = Color(0xFFD30814);

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
    final coursesAsync = ref.watch(coursesProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bgGradient = LinearGradient(
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
      colors: isDark
          ? const [Color(0xFF0F0F11), Color(0xFF050505)]
          : const [Color(0xFFF5F5F5), Color(0xFFE5E5EA)],
    );
    final textColor = isDark ? Colors.white : Colors.black;

    return Scaffold(
      backgroundColor: Colors.transparent,
      extendBodyBehindAppBar: true,
      body: Container(
        decoration: BoxDecoration(gradient: bgGradient),
        child: SafeArea(
          child: Column(
            children: [
              // Custom header (no AppBar — matches profile)
              Padding(
                padding: const EdgeInsets.symmetric(
                    horizontal: 16, vertical: 12),
                child: Row(
                  children: [
                    Text(
                      'COURSES',
                      style: TextStyle(
                        fontFamily: 'Rajdhani',
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 2,
                        color: textColor,
                      ),
                    ),
                  ],
                ),
              ),

              // Neumorphic search bar (inset — pressed-in surface)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
                child: _neumorphicSearchField(context, isDark),
              ),

              // Filter chips row
              SizedBox(
                height: 44,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  itemCount: _levels.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 10),
                  itemBuilder: (_, i) {
                    final l = _levels[i];
                    final active = _level == l;
                    return _NeumorphicFilterChip(
                      label: l[0].toUpperCase() + l.substring(1),
                      active: active,
                      onTap: () => setState(() => _level = l),
                    );
                  },
                ),
              ),

              const SizedBox(height: 8),

              // Grid
              Expanded(
                child: coursesAsync.when(
                  loading: () => _buildSkeleton(context),
                  error: (e, _) => AppErrorState(
                    error: e,
                    onRetry: () => ref.invalidate(coursesProvider),
                  ),
                  data: (all) {
                    final courses = _filter(all);
                    if (courses.isEmpty) {
                      return _buildEmpty(context, _query.isNotEmpty);
                    }
                    return RefreshIndicator(
                      color: _accent,
                      backgroundColor:
                          isDark ? const Color(0xFF141416) : Colors.white,
                      onRefresh: () async {
                        ref.invalidate(coursesProvider);
                        try {
                          await ref.read(coursesProvider.future);
                        } catch (_) {}
                      },
                      child: GridView.builder(
                        padding: const EdgeInsets.fromLTRB(16, 8, 16, 40),
                        gridDelegate:
                            const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 2,
                          mainAxisSpacing: 18,
                          crossAxisSpacing: 18,
                          childAspectRatio: 0.95,
                        ),
                        itemCount: courses.length,
                        itemBuilder: (context, i) => RepaintBoundary(
                          child: _CourseCard(
                            course: courses[i],
                            isDark: isDark,
                            onTap: () =>
                                context.push('/learning/${courses[i].id}'),
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _neumorphicSearchField(BuildContext context, bool isDark) {
    // Inset (pressed-in) surface so the search box reads as recessed
    // into the card face — a common neumorphic pattern for inputs.
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: isDark
              ? const [Color(0xFF0A0A0F), Color(0xFF15151B)]
              : const [Color(0xFFE0E0E6), Color(0xFFF3F3F6)],
        ),
        borderRadius: BorderRadius.circular(14),
        boxShadow: isDark
            ? const [
                BoxShadow(
                  color: Color(0xFF000000),
                  offset: Offset(3, 3),
                  blurRadius: 6,
                ),
              ]
            : [
                BoxShadow(
                  color: const Color(0xFF8E8EA0).withValues(alpha: 0.30),
                  offset: const Offset(3, 3),
                  blurRadius: 5,
                ),
                BoxShadow(
                  color: Colors.white.withValues(alpha: 0.9),
                  offset: const Offset(-3, -3),
                  blurRadius: 5,
                ),
              ],
      ),
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
          filled: false,
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          border: InputBorder.none,
          enabledBorder: InputBorder.none,
          focusedBorder: InputBorder.none,
        ),
      ),
    );
  }
}

// ── Neumorphic filter chip ────────────────────────────────────────────────────

class _NeumorphicFilterChip extends StatelessWidget {
  const _NeumorphicFilterChip({
    required this.label,
    required this.active,
    required this.onTap,
  });

  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textInactive =
        isDark ? Colors.white.withValues(alpha: 0.7) : Colors.black87;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        curve: Curves.easeOut,
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          gradient: active
              ? const LinearGradient(
                  colors: [Color(0xFFE50914), Color(0xFFB30710)],
                )
              : LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: isDark
                      ? const [Color(0xFF23232B), Color(0xFF0A0A0F)]
                      : const [Color(0xFFFFFFFF), Color(0xFFE6E6EC)],
                ),
          borderRadius: BorderRadius.circular(24),
          boxShadow: active
              ? [
                  BoxShadow(
                    color: const Color(0xFFE50914).withValues(alpha: 0.35),
                    offset: const Offset(0, 4),
                    blurRadius: 10,
                  ),
                ]
              : isDark
                  ? const [
                      BoxShadow(
                        color: Color(0xCC000000),
                        offset: Offset(3, 3),
                        blurRadius: 6,
                      ),
                    ]
                  : [
                      BoxShadow(
                        color:
                            const Color(0xFF8E8EA0).withValues(alpha: 0.35),
                        offset: const Offset(3, 3),
                        blurRadius: 6,
                      ),
                      const BoxShadow(
                        color: Colors.white,
                        offset: Offset(-3, -3),
                        blurRadius: 6,
                      ),
                    ],
        ),
        child: Text(
          label,
          style: TextStyle(
            color: active ? Colors.white : textInactive,
            fontSize: 12,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.4,
          ),
        ),
      ),
    );
  }
}

// ── Course card (neumorphic) ─────────────────────────────────────────────────

class _CourseCard extends StatelessWidget {
  const _CourseCard({
    required this.course,
    required this.isDark,
    required this.onTap,
  });

  final Course course;
  final bool isDark;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = course;
    final isLocked = !c.hasAccess;
    final textColor = isDark ? Colors.white : Colors.black;
    final subText = textColor.withValues(alpha: 0.6);

    return Semantics(
      label: '${c.title}${isLocked ? ', locked' : ''}',
      button: true,
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: isDark
                  ? const [
                      Color(0xFF1B1B22),
                      Color(0xFF11111A),
                      Color(0xFF06060B),
                    ]
                  : const [
                      Color(0xFFFFFFFF),
                      Color(0xFFEDEDF0),
                      Color(0xFFD4D4DC),
                    ],
              stops: isDark ? const [0.0, 0.55, 1.0] : null,
            ),
            borderRadius: BorderRadius.circular(18),
            boxShadow: isDark
                ? const [
                    BoxShadow(
                      color: Colors.black,
                      offset: Offset(0, 10),
                      blurRadius: 22,
                    ),
                    BoxShadow(
                      color: Color(0xA6000000),
                      offset: Offset(0, 3),
                      blurRadius: 6,
                    ),
                  ]
                : [
                    BoxShadow(
                      color: const Color(0xFF8E8EA0).withValues(alpha: 0.50),
                      offset: const Offset(9, 9),
                      blurRadius: 20,
                    ),
                    const BoxShadow(
                      color: Colors.white,
                      offset: Offset(-9, -9),
                      blurRadius: 20,
                    ),
                  ],
          ),
          clipBehavior: Clip.antiAlias,
          child: Stack(
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Thumbnail — contain so full artwork is visible with no
                  // crop; letterbox background matches the card gradient.
                  AspectRatio(
                    aspectRatio: 16 / 9,
                    child: Container(
                      color: isDark
                          ? const Color(0xFF06060B)
                          : const Color(0xFFEDEDF0),
                      child: AppNetworkImage(
                        url: c.thumbnailUrl,
                        width: 240,
                        fit: BoxFit.contain,
                        fallbackIcon: Icons.play_circle_outline,
                      ),
                    ),
                  ),

                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(10, 6, 10, 8),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            c.title,
                            style: TextStyle(
                              color: textColor,
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              height: 1.3,
                            ),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const Spacer(),
                          Row(
                            children: [
                              Text(
                                _priceLabel(c.price),
                                style: TextStyle(
                                  color: c.price != null
                                      ? textColor
                                      : const Color(0xFF22c55e),
                                  fontSize: 12,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                              const Spacer(),
                              if (c.hasAccess) _accessChip(isDark),
                            ],
                          ),
                          if (c.count != null ||
                              c.durationDisplay != null) ...[
                            const SizedBox(height: 4),
                            Text(
                              _metaLine(c),
                              style: TextStyle(
                                color: subText,
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
                      borderRadius: BorderRadius.circular(18),
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

  Widget _accessChip(bool isDark) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: isDark
                ? const [Color(0xFF23232B), Color(0xFF0A0A0F)]
                : const [Color(0xFFFFFFFF), Color(0xFFE6E6EC)],
          ),
          borderRadius: BorderRadius.circular(6),
          boxShadow: isDark
              ? const [
                  BoxShadow(
                    color: Color(0xAA000000),
                    offset: Offset(1, 2),
                    blurRadius: 3,
                  ),
                ]
              : [
                  BoxShadow(
                    color: const Color(0xFF22c55e).withValues(alpha: 0.20),
                    blurRadius: 4,
                  ),
                ],
        ),
        child: const Text(
          'Enrolled',
          style: TextStyle(
            color: Color(0xFF22c55e),
            fontSize: 9,
            fontWeight: FontWeight.w800,
            fontFamily: 'Rajdhani',
            letterSpacing: 0.5,
          ),
        ),
      );
}


// ── Shimmer skeleton ──────────────────────────────────────────────────────────

Widget _buildSkeleton(BuildContext context) => AppSkeleton(
      child: GridView.builder(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.lg,
          AppSpacing.xs,
          AppSpacing.lg,
          AppSpacing.xxxl,
        ),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          mainAxisSpacing: 18,
          crossAxisSpacing: 18,
          childAspectRatio: 0.95,
        ),
        itemCount: 6,
        itemBuilder: (_, __) => Container(
          decoration: BoxDecoration(
            color: context.tokens.bgSurface,
            borderRadius: BorderRadius.circular(18),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              AspectRatio(
                aspectRatio: 16 / 9,
                child: Container(color: context.tokens.bgInput),
              ),
              Padding(
                padding: const EdgeInsets.all(AppSpacing.sm + 2),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                        height: 13,
                        width: double.infinity,
                        color: context.tokens.bgInput),
                    const SizedBox(height: AppSpacing.xs + 2),
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

// ── Empty state ───────────────────────────────────────────────────────────────

Widget _buildEmpty(BuildContext context, bool isSearch) => AppEmptyState(
      icon: isSearch ? Icons.search_off : Icons.school_outlined,
      title: isSearch ? 'No courses match your search' : 'No courses yet',
      subtitle: isSearch
          ? 'Try a broader keyword or clear the filter.'
          : 'Newly published courses will appear here.',
    );
