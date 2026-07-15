import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shimmer/shimmer.dart';

import '../../../core/constants/routes.dart';
import '../../../shared/models/course.dart';
import '../providers/courses_provider.dart';


import '../../../shared/theme/theme_tokens.dart';
class LearningOverviewScreen extends ConsumerWidget {
  const LearningOverviewScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Show SnackBar when new course access is granted via socket.
    ref.listen<String?>(
      courseAccessEventNotifierProvider,
      (_, courseId) {
        if (courseId == null || courseId.isEmpty) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'New course access granted! Enrollments updated.',
              style: TextStyle(fontWeight: FontWeight.w600),
            ),
            backgroundColor: Color(0xFF1d4ed8),
            duration: Duration(seconds: 4),
          ),
        );
      },
    );

    final enrollmentsAsync = ref.watch(learningCoursesProvider);

    return Scaffold(
      appBar: AppBar(
        backgroundColor: context.tokens.bgSurface,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: Text(
          'MY LEARNING',
          style: TextStyle(
            fontFamily: 'Rajdhani',
            fontSize: 17,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.5,
            color: context.tokens.textPrimary,
          ),
        ),
        actions: [
          TextButton.icon(
            icon: Icon(Icons.military_tech_outlined,
                size: 16, color: Theme.of(context).colorScheme.primary),
            label: Text(
              'Badges',
              style: TextStyle(
                color: Theme.of(context).colorScheme.primary,
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
            onPressed: () => context.push(AppRoutes.learningBadges),
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: enrollmentsAsync.when(
        loading: () => _EnrollmentsShimmer(),
        error: (_, __) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.error_outline,
                  color: context.tokens.textMuted, size: 40),
              const SizedBox(height: 12),
              Text('Failed to load courses',
                  style: TextStyle(color: context.tokens.textSecondary)),
              const SizedBox(height: 12),
              TextButton(
                onPressed: () => ref.invalidate(learningCoursesProvider),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
        data: (enrollments) => _EnrollmentsList(enrollments: enrollments),
      ),
    );
  }
}

// ── Enrollments list ──────────────────────────────────────────────────────────

class _EnrollmentsList extends StatelessWidget {
  const _EnrollmentsList({required this.enrollments});

  final List<CourseEnrollment> enrollments;

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      color: Theme.of(context).colorScheme.primary,
      backgroundColor: context.tokens.bgSurface,
      onRefresh: () async {
        // Force refetch by navigating up to provider — caller can invalidate
      },
      child: Builder(builder: (context) {
        final listItems = <Widget>[
          // ── Browse all courses CTA ─────────────────────────────────────
          Padding(
            padding:
                const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            child: OutlinedButton.icon(
              onPressed: () => context.push(AppRoutes.courses),
              icon: Icon(Icons.explore_outlined,
                  size: 16, color: Theme.of(context).colorScheme.primary),
              label: Text(
                'Browse All Courses',
                style: TextStyle(
                  color: Theme.of(context).colorScheme.primary,
                  fontWeight: FontWeight.w600,
                ),
              ),
              style: OutlinedButton.styleFrom(
                side: BorderSide(color: Theme.of(context).colorScheme.primary, width: 1),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
                padding: const EdgeInsets.symmetric(vertical: 12),
              ),
            ),
          ),

          // ── Section header ────────────────────────────────────────────
          if (enrollments.isNotEmpty)
            Padding(
              padding: EdgeInsets.fromLTRB(16, 12, 16, 6),
              child: Text(
                'ENROLLED COURSES',
                style: TextStyle(
                  fontFamily: 'Rajdhani',
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.5,
                  color: context.tokens.textMuted,
                ),
              ),
            ),

          // ── Enrolled course cards ──────────────────────────────────────
          if (enrollments.isEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 60),
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.school_outlined,
                        color: context.tokens.textMuted, size: 48),
                    const SizedBox(height: 16),
                    Text(
                      'No courses enrolled yet',
                      style: TextStyle(
                        color: context.tokens.textSecondary,
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Browse the catalog to find your first course',
                      style: TextStyle(
                        color: context.tokens.textMuted,
                        fontSize: 13,
                      ),
                    ),
                    const SizedBox(height: 24),
                    ElevatedButton(
                      onPressed: () => context.push(AppRoutes.courses),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Theme.of(context).colorScheme.primary,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8),
                        ),
                      ),
                      child: const Text('Browse Courses'),
                    ),
                  ],
                ),
              ),
            )
          else
            ...enrollments.map(
              (e) => _CourseEnrollmentCard(
                enrollment: e,
                onTap: () =>
                    context.push(AppRoutes.courseDetailPath(e.courseId)),
              ),
            ),
        ];
        return ListView.builder(
          padding: const EdgeInsets.symmetric(vertical: 8),
          itemCount: listItems.length,
          itemBuilder: (_, i) => listItems[i],
        );
      }),
    );
  }
}

// ── Course enrollment card ────────────────────────────────────────────────────

class _CourseEnrollmentCard extends StatelessWidget {
  const _CourseEnrollmentCard({
    required this.enrollment,
    required this.onTap,
  });

  final CourseEnrollment enrollment;
  final VoidCallback onTap;

  String _formatProgress(int percent) {
    if (percent >= 100) return 'Completed';
    if (percent == 0) return 'Not started';
    return '$percent% complete';
  }

  @override
  Widget build(BuildContext context) {
    final course = enrollment.course;
    final progress = (enrollment.progressPercent.clamp(0, 100)) / 100.0;
    final isCompleted = enrollment.progressPercent >= 100;

    return Semantics(
      label: '${course?.title ?? 'Untitled Course'}, ${enrollment.progressPercent}% complete',
      button: true,
      child: GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
        decoration: BoxDecoration(
          color: context.tokens.bgSurface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: context.tokens.borderCard),
        ),
        child: Row(
          children: [
            // Thumbnail
            ClipRRect(
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(9),
                bottomLeft: Radius.circular(9),
              ),
              child: SizedBox(
                width: 90,
                height: 80,
                child: course?.thumbnailUrl != null
                    ? CachedNetworkImage(
                        imageUrl: course!.thumbnailUrl!,
                        fit: BoxFit.cover,
                        errorWidget: (_, __, ___) =>
                            const _ThumbnailPlaceholder(),
                      )
                    : const _ThumbnailPlaceholder(),
              ),
            ),

            // Info
            Expanded(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      course?.title ?? 'Untitled Course',
                      style: TextStyle(
                        color: context.tokens.textPrimary,
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        height: 1.3,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
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
                    const SizedBox(height: 5),
                    Row(
                      children: [
                        Text(
                          _formatProgress(enrollment.progressPercent),
                          style: TextStyle(
                            color: context.tokens.textMuted,
                            fontSize: 10,
                          ),
                        ),
                        const Spacer(),
                        if (isCompleted)
                          const Icon(Icons.check_circle,
                              size: 14, color: Color(0xFF16a34a))
                        else
                          Icon(Icons.play_circle_outlined,
                              size: 14, color: Theme.of(context).colorScheme.primary),
                      ],
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

class _ThumbnailPlaceholder extends StatelessWidget {
  const _ThumbnailPlaceholder();

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

// ── Shimmer skeleton ──────────────────────────────────────────────────────────

class _EnrollmentsShimmer extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      padding: const EdgeInsets.symmetric(vertical: 8),
      itemCount: 5,
      itemBuilder: (_, __) => Shimmer.fromColors(
        baseColor: context.tokens.bgSurface,
        highlightColor: context.tokens.bgInput,
        child: Container(
          height: 80,
          margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
          decoration: BoxDecoration(
            color: context.tokens.bgSurface,
            borderRadius: BorderRadius.circular(10),
          ),
        ),
      ),
    );
  }
}
