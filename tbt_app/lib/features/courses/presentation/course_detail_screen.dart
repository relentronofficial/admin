import 'dart:io';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';
import 'package:shimmer/shimmer.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../shared/models/course.dart';
import '../../../shared/models/lesson.dart';
import '../../../shared/theme/tbt_theme.dart';
import '../data/courses_service.dart';
import '../providers/courses_provider.dart';
import 'widgets/practice_arena_modal.dart';

import '../../../shared/theme/design_tokens.dart';
import '../../../shared/theme/theme_tokens.dart';
import '../../../shared/widgets/app_button.dart';
class CourseDetailScreen extends ConsumerStatefulWidget {
  const CourseDetailScreen({super.key, required this.courseId});

  final String courseId;

  @override
  ConsumerState<CourseDetailScreen> createState() => _CourseDetailScreenState();
}

class _CourseDetailScreenState extends ConsumerState<CourseDetailScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;
  bool _accessRequested = false;
  bool _requesting = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  // Mirrors the web `handleGetAccess` flow:
  //   1. If the course has a pre-configured `paymentLinkUrl` (admin sets this
  //      when using an external checkout like Razorpay/Stripe hosted pages),
  //      open it directly — no server round-trip needed.
  //   2. Otherwise call `requestAccess()`. If the response includes a
  //      `paymentUrl`, open it; otherwise the request has been queued for
  //      admin approval and we surface a success toast.
  // Payment links are always opened in the external browser rather than an
  // in-app WebView — payment gateways (Razorpay/Stripe/etc.) detect and block
  // known WebView user agents for card-entry pages.
  Future<void> _handleGetAccess(CourseDetail course) async {
    if (_requesting) return;

    final linkUrl = course.paymentLinkUrl;
    if (linkUrl != null && linkUrl.isNotEmpty) {
      await _openExternal(linkUrl);
      // Even though we didn't call the API, refresh so `pendingPayment`
      // shows up next time the user opens the screen.
      ref.invalidate(courseDetailProvider(widget.courseId));
      ref.invalidate(coursePendingPaymentProvider(widget.courseId));
      return;
    }

    setState(() => _requesting = true);
    try {
      final res = await ref
          .read(coursesServiceProvider)
          .requestAccess(widget.courseId);
      if (!mounted) return;

      final url = res.paymentUrl;
      if (url != null && url.isNotEmpty) {
        await _openExternal(url);
      } else {
        setState(() => _accessRequested = true);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Access request sent! We\'ll notify you shortly.'),
            backgroundColor: Color(0xFF16a34a),
          ),
        );
      }
      // Refresh so `pendingPayment` state appears in-place.
      ref.invalidate(courseDetailProvider(widget.courseId));
      ref.invalidate(coursePendingPaymentProvider(widget.courseId));
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to request access. Try again.')),
        );
      }
    } finally {
      if (mounted) setState(() => _requesting = false);
    }
  }

  Future<void> _openExternal(String url) async {
    final uri = Uri.tryParse(url);
    if (uri == null) return;
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    final accent = context.tbt.accent;
    final detailAsync = ref.watch(courseDetailProvider(widget.courseId));
    final progressAsync = ref.watch(lessonProgressProvider(widget.courseId));
    final pendingPayment =
        ref.watch(coursePendingPaymentProvider(widget.courseId)).valueOrNull;
    final sections =
        ref.watch(courseSectionsProvider(widget.courseId)).valueOrNull ?? [];

    return Scaffold(
      appBar: AppBar(
        backgroundColor: context.tokens.bgSurface,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: Icon(Icons.arrow_back, color: context.tokens.textPrimary),
          onPressed: () => context.pop(),
        ),
        title: detailAsync.whenOrNull(
          data: (d) => Text(
            d.title,
            style: TextStyle(
              fontFamily: 'Rajdhani',
              fontSize: 18,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.5,
              color: context.tokens.textPrimary,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ),
      body: detailAsync.when(
        loading: () => _buildSkeleton(context),
        error: (e, _) => _buildError(context, 
          () => ref.invalidate(courseDetailProvider(widget.courseId)),
        ),
        data: (course) {
          final completedIds = progressAsync.whenOrNull(
                data: (list) => {
                  for (final p in list)
                    if (p.completed) p.lessonId,
                },
              ) ??
              {};

          final totalLessons = course.lessons.length;
          final completedCount =
              course.lessons.where((l) => completedIds.contains(l.id)).length;

          return Column(
            children: [
              Expanded(
                child: CustomScrollView(
                  slivers: [
                    SliverToBoxAdapter(
                      child: _HeroSection(
                        course: course,
                        pendingPayment: pendingPayment,
                        accent: accent,
                        accessRequested: _accessRequested,
                        requesting: _requesting,
                        onGetAccess: () => _handleGetAccess(course),
                        onOpenPendingPayment: () {
                          final url = pendingPayment?.paymentUrl;
                          if (url != null && url.isNotEmpty) {
                            _openExternal(url);
                          }
                        },
                      ),
                    ),
                    if (totalLessons > 0)
                      SliverToBoxAdapter(
                        child: _ProgressSection(
                          completed: completedCount,
                          total: totalLessons,
                          accent: accent,
                        ),
                      ),
                    if (course.hasAccess)
                      SliverToBoxAdapter(
                        child: _XpAndPracticeRow(
                          courseId: widget.courseId,
                          course: course,
                          accent: accent,
                        ),
                      ),
                    if (course.lessons.isEmpty)
                      SliverFillRemaining(
                        child: Center(
                          child: Text(
                            'No lessons yet',
                            style: TextStyle(color: context.tokens.textMuted),
                          ),
                        ),
                      )
                    else
                      _LessonListSliver(
                        course: course,
                        completedIds: completedIds,
                        courseId: widget.courseId,
                        accent: accent,
                        sections: sections,
                      ),
                    SliverToBoxAdapter(
                      child: _CertificateCta(
                        courseId: widget.courseId,
                        accent: accent,
                      ),
                    ),
                    const SliverToBoxAdapter(child: SizedBox(height: 16)),
                  ],
                ),
              ),
              _BottomTabs(
                courseId: widget.courseId,
                tabController: _tabController,
                accent: accent,
              ),
            ],
          );
        },
      ),
    );
  }
}

// ── Hero section ──────────────────────────────────────────────────────────────

class _HeroSection extends StatelessWidget {
  const _HeroSection({
    required this.course,
    required this.pendingPayment,
    required this.accent,
    required this.accessRequested,
    required this.requesting,
    required this.onGetAccess,
    required this.onOpenPendingPayment,
  });

  final CourseDetail course;
  final CoursePendingPayment? pendingPayment;
  final Color accent;
  final bool accessRequested;
  final bool requesting;
  final VoidCallback onGetAccess;
  final VoidCallback onOpenPendingPayment;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        AspectRatio(
          aspectRatio: 16 / 9,
          child: course.thumbnailUrl != null
              ? CachedNetworkImage(
                  imageUrl: course.thumbnailUrl!,
                  fit: BoxFit.cover,
                  placeholder: (_, __) =>
                      ColoredBox(color: context.tokens.bgInput),
                  errorWidget: (_, __, ___) => const _ThumbnailFallback(),
                )
              : const _ThumbnailFallback(),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                course.title,
                style: TextStyle(
                  color: context.tokens.textPrimary,
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                  height: 1.3,
                ),
              ),
              if (course.instructor != null) ...[
                const SizedBox(height: 6),
                Text(
                  course.instructor!.fullName,
                  style: TextStyle(
                    color: context.tokens.textSecondary,
                    fontSize: 13,
                  ),
                ),
              ],
              if (course.description != null &&
                  course.description!.isNotEmpty) ...[
                const SizedBox(height: 10),
                Text(
                  course.description!,
                  style: TextStyle(
                    color: context.tokens.textSecondary,
                    fontSize: 13,
                    height: 1.5,
                  ),
                ),
              ],
              const SizedBox(height: 16),
              Wrap(
                spacing: 12,
                runSpacing: 6,
                children: [
                  if (course.level != null)
                    _MetaChip(
                      label: course.level!,
                      icon: Icons.signal_cellular_alt,
                    ),
                  if (course.count != null && course.count!.lessons > 0)
                    _MetaChip(
                      label:
                          '${course.count!.lessons} lesson${course.count!.lessons == 1 ? '' : 's'}',
                      icon: Icons.play_lesson_outlined,
                    ),
                  _MetaChip(
                    label: _priceLabel(course.price),
                    icon: Icons.local_offer_outlined,
                    color: course.price == null || course.price == 0
                        ? const Color(0xFF22c55e)
                        : context.tokens.textSecondary,
                  ),
                ],
              ),
              const SizedBox(height: 16),
              if (!course.hasAccess)
                _AccessCta(
                  course: course,
                  pendingPayment: pendingPayment,
                  accent: accent,
                  accessRequested: accessRequested,
                  requesting: requesting,
                  onGetAccess: onGetAccess,
                  onOpenPendingPayment: onOpenPendingPayment,
                )
              else
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  decoration: BoxDecoration(
                    // Green success tint — reads in both themes.
                    color: const Color(0xFF16a34a).withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Center(
                    child: Text(
                      'Enrolled — tap a lesson to begin',
                      style: TextStyle(
                        color: Color(0xFF16a34a),
                        fontWeight: FontWeight.w600,
                        fontSize: 13,
                      ),
                    ),
                  ),
                ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ],
    );
  }

  String _priceLabel(double? price) {
    if (price == null || price == 0) return 'Free';
    if (price == price.truncateToDouble()) return '₹${price.toInt()}';
    return '₹${price.toStringAsFixed(2)}';
  }
}

// ── Access CTA (paywall) ──────────────────────────────────────────────────────
//
// Three visual states, mirroring the web `PaywallView`:
//   1. Pending payment  — amber banner + "Complete Payment" button, no
//      "Get Access" primary. Only when `course.pendingPayment` is set.
//   2. Access requested — disabled "Access Requested" button (submitted flow
//      where no paymentUrl came back, so we're just waiting on admin approval).
//   3. Default          — primary "Get Access" button. If a paymentLinkUrl or
//      pendingPayment.paymentUrl is available, uses an "external link" icon
//      to hint that tapping opens the browser.

class _AccessCta extends StatelessWidget {
  const _AccessCta({
    required this.course,
    required this.pendingPayment,
    required this.accent,
    required this.accessRequested,
    required this.requesting,
    required this.onGetAccess,
    required this.onOpenPendingPayment,
  });

  final CourseDetail course;
  final CoursePendingPayment? pendingPayment;
  final Color accent;
  final bool accessRequested;
  final bool requesting;
  final VoidCallback onGetAccess;
  final VoidCallback onOpenPendingPayment;

  @override
  Widget build(BuildContext context) {
    final pending = pendingPayment;
    final hasExternalLink = course.paymentLinkUrl != null &&
        course.paymentLinkUrl!.isNotEmpty;

    if (pending != null) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Amber "Payment pending" banner — 12% tint so it reads in both themes.
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              color: const Color(0xFFea580c).withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(
                  color: const Color(0xFFea580c).withValues(alpha: 0.3)),
            ),
            child: Row(
              children: [
                const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    valueColor: AlwaysStoppedAnimation<Color>(
                        Color(0xFFea580c)),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Payment pending — awaiting confirmation',
                    style: TextStyle(
                      color: context.tokens.textPrimary,
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ],
            ),
          ),
          if (pending.paymentUrl != null && pending.paymentUrl!.isNotEmpty) ...[
            const SizedBox(height: 10),
            SizedBox(
              height: 44,
              child: OutlinedButton.icon(
                onPressed: onOpenPendingPayment,
                icon: const Icon(Icons.open_in_new, size: 16),
                label: const Text(
                  'Complete Payment',
                  style: TextStyle(
                    fontFamily: 'Rajdhani',
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1,
                  ),
                ),
                style: OutlinedButton.styleFrom(
                  foregroundColor: accent,
                  side: BorderSide(color: accent.withAlpha(102)),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
              ),
            ),
          ],
        ],
      );
    }

    return AppPrimaryButton(
      label: requesting
          ? 'Processing…'
          : (accessRequested ? 'Access requested' : 'Get access'),
      icon: hasExternalLink ? Icons.open_in_new : Icons.lock_outline,
      size: AppButtonSize.md,
      fullWidth: true,
      isLoading: requesting,
      onPressed: accessRequested || requesting ? null : onGetAccess,
    );
  }
}

class _MetaChip extends StatelessWidget {
  const _MetaChip({required this.label, required this.icon, this.color});

  final String label;
  final IconData icon;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final c = color ?? context.tokens.textSecondary;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, color: c, size: 13),
        const SizedBox(width: 4),
        Text(
          label,
          style: TextStyle(
              color: c, fontSize: 12, fontWeight: FontWeight.w600),
        ),
      ],
    );
  }
}

class _ThumbnailFallback extends StatelessWidget {
  const _ThumbnailFallback();

  @override
  Widget build(BuildContext context) => ColoredBox(
        color: context.tokens.bgInput,
        child: Center(
          child: Icon(Icons.play_circle_outline,
              color: context.tokens.textMuted, size: 40),
        ),
      );
}

// ── Progress section ──────────────────────────────────────────────────────────

class _ProgressSection extends StatelessWidget {
  const _ProgressSection({
    required this.completed,
    required this.total,
    required this.accent,
  });

  final int completed;
  final int total;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    final pct = total > 0 ? completed / total : 0.0;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'LESSONS',
                style: TextStyle(
                  fontFamily: 'Rajdhani',
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.5,
                  color: context.tokens.textMuted,
                ),
              ),
              Text(
                '$completed / $total',
                style: TextStyle(
                  color: context.tokens.textSecondary,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          ClipRRect(
            borderRadius: BorderRadius.circular(3),
            child: LinearProgressIndicator(
              value: pct,
              minHeight: 4,
              backgroundColor: context.tokens.bgSurface,
              valueColor: AlwaysStoppedAnimation<Color>(accent),
            ),
          ),
          const SizedBox(height: 12),
        ],
      ),
    );
  }
}

// ── Lesson list sliver (flat or section-grouped) ─────────────────────────────

class _LessonListSliver extends StatefulWidget {
  const _LessonListSliver({
    required this.course,
    required this.completedIds,
    required this.courseId,
    required this.accent,
    this.sections = const [],
  });
  final CourseDetail course;
  final Set<String> completedIds;
  final String courseId;
  final Color accent;
  final List<Map<String, dynamic>> sections;

  @override
  State<_LessonListSliver> createState() => _LessonListSliverState();
}

class _LessonListSliverState extends State<_LessonListSliver> {
  final Set<String> _collapsed = {};

  void _toggle(String sectionId) =>
      setState(() => _collapsed.contains(sectionId) ? _collapsed.remove(sectionId) : _collapsed.add(sectionId));

  Widget _lessonRow(BuildContext context, Lesson lesson, int globalIdx, {int? sectionTimerSecs}) {
    final isLocked = lesson.locked;
    final canOpen = widget.course.hasAccess && !isLocked;
    final effectiveTimer = lesson.timerSeconds ?? sectionTimerSecs;
    return _LessonRow(
      lesson: lesson,
      index: globalIdx,
      isCompleted: widget.completedIds.contains(lesson.id) || lesson.completedByThreshold,
      isLocked: isLocked,
      hasAccess: widget.course.hasAccess,
      accent: widget.accent,
      effectiveTimerSeconds: effectiveTimer,
      onTap: canOpen
          ? () => context.push('/learning/${widget.courseId}/${lesson.id}')
          : (isLocked
              ? () => ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Complete the previous lesson to unlock.'), duration: Duration(seconds: 2)),
                  )
              : null),
    );
  }

  @override
  Widget build(BuildContext context) {
    final lessons = widget.course.lessons;
    final sections = widget.sections;

    if (sections.isEmpty) {
      // Flat list — no sections
      return SliverList(
        delegate: SliverChildBuilderDelegate(
          (_, i) => _lessonRow(context, lessons[i], i),
          childCount: lessons.length,
        ),
      );
    }

    // Build section → lessons map
    final sectionMap = <String, List<Lesson>>{};
    final List<Lesson> unsectioned = [];
    for (var i = 0; i < lessons.length; i++) {
      final sid = lessons[i].sectionId;
      if (sid != null) {
        sectionMap.putIfAbsent(sid, () => []).add(lessons[i]);
      } else {
        unsectioned.add(lessons[i]);
      }
    }

    // Build widgets
    final items = <Widget>[];
    for (final sec in sections) {
      final sid = sec['id'] as String;
      final title = sec['title'] as String? ?? 'Section';
      final sectionTimerSecs = sec['timerSeconds'] as int?;
      final sectionLessons = sectionMap[sid] ?? [];
      if (sectionLessons.isEmpty) continue;
      final isCollapsed = _collapsed.contains(sid);
      final completedInSection = sectionLessons.where((l) => widget.completedIds.contains(l.id)).length;

      items.add(
        InkWell(
          onTap: () => _toggle(sid),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            color: Colors.white.withAlpha(5),
            child: Row(
              children: [
                AnimatedRotation(
                  turns: isCollapsed ? -0.25 : 0,
                  duration: const Duration(milliseconds: 200),
                  child: const Icon(Icons.expand_more, size: 16, color: Colors.white54),
                ),
                const SizedBox(width: 8),
                Expanded(child: Text(title, style: const TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 0.5))),
                if (sectionTimerSecs != null) ...[
                  const SizedBox(width: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: widget.accent.withAlpha(30),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.timer_outlined, size: 10, color: widget.accent),
                        const SizedBox(width: 2),
                        Text('${(sectionTimerSecs / 60).round()}m',
                            style: TextStyle(color: widget.accent, fontSize: 10, fontWeight: FontWeight.bold)),
                      ],
                    ),
                  ),
                ],
                const SizedBox(width: 6),
                Text('$completedInSection/${sectionLessons.length}',
                    style: TextStyle(
                      color: completedInSection == sectionLessons.length ? Colors.green : Colors.white38,
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                    )),
              ],
            ),
          ),
        ),
      );

      if (!isCollapsed) {
        for (var i = 0; i < sectionLessons.length; i++) {
          items.add(_lessonRow(context, sectionLessons[i], lessons.indexOf(sectionLessons[i]), sectionTimerSecs: sectionTimerSecs));
        }
      }
    }

    if (unsectioned.isNotEmpty) {
      for (final l in unsectioned) {
        items.add(_lessonRow(context, l, lessons.indexOf(l)));
      }
    }

    return SliverList(
      delegate: SliverChildBuilderDelegate(
        (_, i) => items[i],
        childCount: items.length,
      ),
    );
  }
}

// ── Lesson row ────────────────────────────────────────────────────────────────

class _LessonRow extends StatelessWidget {
  const _LessonRow({
    required this.lesson,
    required this.index,
    required this.isCompleted,
    required this.hasAccess,
    required this.accent,
    this.isLocked = false,
    this.effectiveTimerSeconds,
    this.onTap,
  });

  final Lesson lesson;
  final int index;
  final bool isCompleted;
  final bool hasAccess;
  final Color accent;
  final bool isLocked;
  final int? effectiveTimerSeconds;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          border: Border(bottom: BorderSide(color: context.tokens.borderCard)),
        ),
        child: Row(
          children: [
            // Leading indicator: lock > completed > numbered dot.
            // Priority matters — a completed lesson that then gets
            // manually locked by an admin (rare) should visibly show
            // the lock, not the checkmark.
            SizedBox(
              width: 32,
              child: isLocked
                  ? Icon(
                      Icons.lock_outline,
                      color: context.tokens.textMuted,
                      size: 20,
                    )
                  : isCompleted
                      ? Icon(Icons.check_circle, color: accent, size: 20)
                      : Container(
                          width: 24,
                          height: 24,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            border:
                                Border.all(color: context.tokens.borderInput),
                          ),
                          child: Center(
                            child: Text(
                              '${index + 1}',
                              style: TextStyle(
                                color: context.tokens.textMuted,
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    lesson.title,
                    style: TextStyle(
                      // Muted colour for locked lessons — matches the
                      // reduced-opacity treatment on the web.
                      color: (hasAccess && !isLocked)
                          ? context.tokens.textPrimary
                          : context.tokens.textMuted,
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (_durationLabel != null) ...[
                    const SizedBox(height: 3),
                    Text(
                      _durationLabel!,
                      style: TextStyle(
                        color: context.tokens.textMuted,
                        fontSize: 11,
                      ),
                    ),
                  ],
                  if (effectiveTimerSeconds != null && effectiveTimerSeconds! > 0) ...[
                    const SizedBox(height: 3),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.timer_outlined, size: 10, color: accent.withAlpha(180)),
                        const SizedBox(width: 2),
                        Text(
                          '${(effectiveTimerSeconds! / 60).round()}m timer',
                          style: TextStyle(color: accent.withAlpha(180), fontSize: 10, fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(width: 8),
            if (!hasAccess)
              Icon(Icons.lock_outline, color: context.tokens.textMuted, size: 16)
            else
              _typeIcon(context, lesson.type),
          ],
        ),
      ),
    );
  }

  String? get _durationLabel {
    if (lesson.durationSeconds != null && lesson.durationSeconds! > 0) {
      final m = lesson.durationSeconds! ~/ 60;
      final s = lesson.durationSeconds! % 60;
      if (m > 0 && s > 0) return '${m}m ${s}s';
      if (m > 0) return '${m}m';
      return '${s}s';
    }
    if (lesson.duration != null && lesson.duration! > 0) {
      return '${lesson.duration}m';
    }
    return null;
  }

  Widget _typeIcon(BuildContext context, LessonType type) {
    switch (type) {
      case LessonType.video:
        return Icon(Icons.play_circle_outline,
            color: context.tokens.textMuted, size: 18);
      case LessonType.assignment:
        return Icon(Icons.assignment_outlined,
            color: context.tokens.textMuted, size: 18);
      case LessonType.offer:
        return Icon(Icons.local_offer_outlined,
            color: context.tokens.textMuted, size: 18);
    }
  }
}

// ── Bottom tabs ───────────────────────────────────────────────────────────────

class _BottomTabs extends StatelessWidget {
  const _BottomTabs({
    required this.courseId,
    required this.tabController,
    required this.accent,
  });

  final String courseId;
  final TabController tabController;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: context.tokens.bgSurface,
        border: Border(top: BorderSide(color: context.tokens.borderCard)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TabBar(
            controller: tabController,
            indicatorColor: accent,
            labelColor: accent,
            unselectedLabelColor: context.tokens.textMuted,
            labelStyle: const TextStyle(
              fontFamily: 'Rajdhani',
              fontWeight: FontWeight.w700,
              fontSize: 13,
              letterSpacing: 1,
            ),
            tabs: const [
              Tab(text: 'LEADERBOARD'),
              Tab(text: 'BADGES'),
            ],
          ),
          SizedBox(
            height: 240,
            child: TabBarView(
              controller: tabController,
              children: [
                _LeaderboardTab(courseId: courseId, accent: accent),
                const _BadgesTab(),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Leaderboard tab ───────────────────────────────────────────────────────────

class _LeaderboardTab extends ConsumerStatefulWidget {
  const _LeaderboardTab({required this.courseId, required this.accent});

  final String courseId;
  final Color accent;

  @override
  ConsumerState<_LeaderboardTab> createState() => _LeaderboardTabState();
}

class _LeaderboardTabState extends ConsumerState<_LeaderboardTab>
    with AutomaticKeepAliveClientMixin {
  @override
  bool get wantKeepAlive => true;

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final courseId = widget.courseId;
    final accent = widget.accent;
    final lbAsync = ref.watch(courseLeaderboardProvider(courseId));
    return lbAsync.when(
      loading: () => const Center(
        child: CircularProgressIndicator(strokeWidth: 2),
      ),
      error: (_, __) => Center(
        child: TextButton(
          onPressed: () => ref.invalidate(courseLeaderboardProvider(courseId)),
          child: const Text('Retry'),
        ),
      ),
      data: (lb) {
        if (lb.leaderboard.isEmpty) {
          return Center(
            child: Text(
              'No entries yet',
              style: TextStyle(color: context.tokens.textMuted, fontSize: 12),
            ),
          );
        }
        return ListView.builder(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          itemCount: lb.leaderboard.length,
          itemBuilder: (_, i) {
            final entry = lb.leaderboard[i];
            final isMe = entry.isMe;
            final nameParts = [
              entry.member?.firstName ?? '',
              entry.member?.lastName ?? '',
            ].where((s) => s.isNotEmpty).toList();
            final name = nameParts.join(' ');
            final initials = nameParts
                .map((s) => s[0])
                .join()
                .toUpperCase();
            return Container(
              margin: const EdgeInsets.only(bottom: 6),
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              decoration: BoxDecoration(
                color: isMe
                    ? accent.withValues(alpha: 0.12)
                    : context.tokens.bgInput,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: isMe
                      ? accent.withValues(alpha: 0.4)
                      : context.tokens.borderCard,
                ),
              ),
              child: Row(
                children: [
                  SizedBox(
                    width: 28,
                    child: Text(
                      '#${entry.rank}',
                      style: TextStyle(
                        color: entry.rank <= 3 ? accent : context.tokens.textMuted,
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  CircleAvatar(
                    radius: 14,
                    backgroundImage: entry.member?.profilePhotoUrl != null
                        ? CachedNetworkImageProvider(
                            entry.member!.profilePhotoUrl!)
                        : null,
                    backgroundColor: context.tokens.bgSurface,
                    child: entry.member?.profilePhotoUrl == null
                        ? Text(
                            initials.isEmpty ? '?' : initials,
                            style: TextStyle(
                              color: context.tokens.textSecondary,
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                            ),
                          )
                        : null,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      name.isEmpty ? 'Member' : name,
                      style: TextStyle(
                        color: isMe ? accent : context.tokens.textPrimary,
                        fontSize: 13,
                        fontWeight:
                            isMe ? FontWeight.w700 : FontWeight.w500,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  Text(
                    '${entry.totalXp} XP',
                    style: TextStyle(
                      color: isMe ? accent : context.tokens.textSecondary,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }
}

// ── Badges tab ────────────────────────────────────────────────────────────────

class _BadgesTab extends ConsumerStatefulWidget {
  const _BadgesTab();

  @override
  ConsumerState<_BadgesTab> createState() => _BadgesTabState();
}

class _BadgesTabState extends ConsumerState<_BadgesTab>
    with AutomaticKeepAliveClientMixin {
  @override
  bool get wantKeepAlive => true;

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final badgesAsync = ref.watch(earnedBadgesProvider);
    return badgesAsync.when(
      loading: () => const Center(
        child: CircularProgressIndicator(strokeWidth: 2),
      ),
      error: (_, __) => Center(
        child: TextButton(
          onPressed: () => ref.invalidate(earnedBadgesProvider),
          child: const Text('Retry'),
        ),
      ),
      data: (badges) {
        if (badges.isEmpty) {
          return Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.military_tech_outlined,
                    color: context.tokens.textMuted, size: 28),
                SizedBox(height: 6),
                Text(
                  'No badges earned yet',
                  style: TextStyle(color: context.tokens.textMuted, fontSize: 12),
                ),
              ],
            ),
          );
        }
        return GridView.builder(
          padding: const EdgeInsets.all(12),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 3,
            crossAxisSpacing: 8,
            mainAxisSpacing: 8,
            childAspectRatio: 0.85,
          ),
          itemCount: badges.length,
          itemBuilder: (_, i) => RepaintBoundary(
            child: _BadgeCard(badge: badges[i]),
          ),
        );
      },
    );
  }
}

class _BadgeCard extends StatelessWidget {
  const _BadgeCard({required this.badge});

  final EarnedBadge badge;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: context.tokens.bgInput,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: context.tokens.borderCard),
      ),
      padding: const EdgeInsets.all(8),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Expanded(
            child: badge.badge.imageUrl != null
                ? CachedNetworkImage(
                    imageUrl: badge.badge.imageUrl!,
                    fit: BoxFit.contain,
                    placeholder: (_, __) => const SizedBox(),
                    errorWidget: (_, __, ___) => Icon(
                      Icons.military_tech,
                      color: context.tokens.textMuted,
                      size: 28,
                    ),
                  )
                : Icon(
                    Icons.military_tech,
                    color: context.tokens.textMuted,
                    size: 28,
                  ),
          ),
          const SizedBox(height: 4),
          Text(
            badge.badge.name,
            style: TextStyle(
              color: context.tokens.textPrimary,
              fontSize: 10,
              fontWeight: FontWeight.w600,
              height: 1.2,
            ),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 2),
          Text(
            _fmtDate(badge.earnedAt),
            style: TextStyle(color: context.tokens.textMuted, fontSize: 9),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }

  String _fmtDate(String iso) {
    try {
      final dt = DateTime.parse(iso).toLocal();
      return '${dt.day}/${dt.month}/${dt.year}';
    } catch (_) {
      return '';
    }
  }
}

// ── Certificate CTA ───────────────────────────────────────────────────────────

class _CertificateCta extends ConsumerStatefulWidget {
  const _CertificateCta({required this.courseId, required this.accent});

  final String courseId;
  final Color accent;

  @override
  ConsumerState<_CertificateCta> createState() => _CertificateCtaState();
}

class _CertificateCtaState extends ConsumerState<_CertificateCta> {
  bool _launching = false;

  Future<void> _download() async {
    if (_launching) return;
    setState(() => _launching = true);
    try {
      // Certificate route requires JWT-cookie auth, so launching an external
      // browser 401s. Stream the PDF through Dio, write it to the app cache
      // dir, then hand off to the OS's default PDF viewer.
      final bytes = await ref
          .read(coursesServiceProvider)
          .downloadCertificate(widget.courseId);
      final dir = await getTemporaryDirectory();
      final file = File('${dir.path}/tbt-certificate-${widget.courseId}.pdf');
      await file.writeAsBytes(bytes, flush: true);
      final result = await OpenFilex.open(file.path, type: 'application/pdf');
      if (result.type != ResultType.done && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(result.message)),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not open certificate')),
        );
      }
    } finally {
      if (mounted) setState(() => _launching = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final eligAsync = ref.watch(certEligibilityProvider(widget.courseId));
    return eligAsync.whenOrNull(
          data: (e) {
            if (!e.eligible) return null;
            return Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.lg,
                AppSpacing.xs,
                AppSpacing.lg,
                AppSpacing.xs,
              ),
              child: AppPrimaryButton(
                label: 'Download certificate',
                icon: Icons.workspace_premium,
                size: AppButtonSize.md,
                fullWidth: true,
                isLoading: _launching,
                onPressed: _launching ? null : _download,
              ),
            );
          },
        ) ??
        const SizedBox.shrink();
  }
}

// ── XP + Practice Arena strip ─────────────────────────────────────────────────

class _XpAndPracticeRow extends ConsumerWidget {
  const _XpAndPracticeRow({
    required this.courseId,
    required this.course,
    required this.accent,
  });

  final String courseId;
  final CourseDetail course;
  final Color accent;

  Future<void> _openPractice(BuildContext context, WidgetRef ref) async {
    try {
      // Derive completed lesson IDs from the already-loaded progress provider
      // so we only surface questions from lessons the member has finished.
      final progress = await ref.read(lessonProgressProvider(courseId).future);
      final completedIds = progress
          .where((p) => p.completed)
          .map((p) => p.lessonId)
          .toSet();

      final questions = await ref
          .read(coursesServiceProvider)
          .getPracticeQuestions(courseId, completedLessonIds: completedIds);
      if (!context.mounted) return;
      if (questions.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('No practice questions yet — complete some lessons first')),
        );
        return;
      }
      await showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        backgroundColor: Colors.transparent,
        builder: (_) => PracticeArenaModal(
          questions: questions,
          accent: accent,
        ),
      );
    } catch (_) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not load practice questions')),
      );
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final xpAsync = ref.watch(courseXpProvider(courseId));
    final xp = xpAsync.whenOrNull(data: (v) => v);
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
      child: Row(
        children: [
          Expanded(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: context.tokens.bgSurface,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: context.tokens.borderCard),
              ),
              child: Row(
                children: [
                  Icon(Icons.bolt, color: accent, size: 18),
                  const SizedBox(width: 6),
                  Text(
                    '${xp?.totalXp ?? 0} XP',
                    style: TextStyle(
                      color: context.tokens.textPrimary,
                      fontFamily: 'Rajdhani',
                      fontWeight: FontWeight.w700,
                      fontSize: 15,
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    '· ${xp?.episodesCompleted ?? 0}/${course.lessons.length} lessons',
                    style: TextStyle(
                      color: context.tokens.textMuted,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(width: 8),
          SizedBox(
            height: 40,
            child: OutlinedButton.icon(
              icon: const Icon(Icons.psychology_alt, size: 16),
              label: const Text(
                'Practice',
                style: TextStyle(
                  fontFamily: 'Rajdhani',
                  fontWeight: FontWeight.w700,
                  fontSize: 13,
                  letterSpacing: 0.5,
                ),
              ),
              style: OutlinedButton.styleFrom(
                foregroundColor: accent,
                side: BorderSide(color: accent),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              onPressed: () => _openPractice(context, ref),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

Widget _buildSkeleton(BuildContext context) => Shimmer.fromColors(
      baseColor: context.tokens.bgSurface,
      highlightColor: context.tokens.bgInput,
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AspectRatio(
              aspectRatio: 16 / 9,
              child: Container(color: context.tokens.bgSurface),
            ),
            const SizedBox(height: 16),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                      height: 22,
                      width: double.infinity,
                      color: context.tokens.bgSurface),
                  const SizedBox(height: 8),
                  Container(height: 14, width: 160, color: context.tokens.bgSurface),
                  const SizedBox(height: 12),
                  Container(
                      height: 14,
                      width: double.infinity,
                      color: context.tokens.bgSurface),
                  const SizedBox(height: 4),
                  Container(height: 14, width: 200, color: context.tokens.bgSurface),
                ],
              ),
            ),
            const SizedBox(height: 20),
            ...List.generate(
              5,
              (_) => Container(
                margin:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                height: 48,
                color: context.tokens.bgSurface,
              ),
            ),
          ],
        ),
      ),
    );

// ── Error state ───────────────────────────────────────────────────────────────

Widget _buildError(BuildContext context, VoidCallback onRetry) => Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.error_outline, color: context.tokens.textMuted, size: 40),
          const SizedBox(height: 12),
          Text('Failed to load course',
              style: TextStyle(color: context.tokens.textSecondary)),
          const SizedBox(height: 12),
          TextButton(onPressed: onRetry, child: const Text('Retry')),
        ],
      ),
    );
