import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/course_reports_service.dart';
import '../providers/courses_provider.dart';

// ── Design tokens (local) ─────────────────────────────────────────────────────

const _kBg = Color(0xFF0F0F0F);
const _kCard = Color(0xFF181818);
const _kBorder = Color(0xFF2A2A2A);
const _kAccent = Color(0xFFDC2626);
const _kTextPrimary = Color(0xFFF0F0F0);
const _kTextSecondary = Color(0xFFA0A0A0);

// ── Screen ────────────────────────────────────────────────────────────────────

class CourseWeeklyReportScreen extends ConsumerStatefulWidget {
  const CourseWeeklyReportScreen({
    super.key,
    required this.courseId,
    required this.courseTitle,
  });

  final String courseId;
  final String courseTitle;

  @override
  ConsumerState<CourseWeeklyReportScreen> createState() =>
      _CourseWeeklyReportScreenState();
}

class _CourseWeeklyReportScreenState
    extends ConsumerState<CourseWeeklyReportScreen> {
  final _feedbackController = TextEditingController();
  bool _submitting = false;
  bool _historyExpanded = false;

  @override
  void dispose() {
    _feedbackController.dispose();
    super.dispose();
  }

  Future<void> _submitFeedback(int weekNumber) async {
    final text = _feedbackController.text.trim();
    if (text.isEmpty) return;
    setState(() => _submitting = true);
    try {
      await ref.read(courseReportsServiceProvider).submitFeedback(
            courseId: widget.courseId,
            weekNumber: weekNumber,
            feedbackText: text,
          );
      if (!mounted) return;
      _feedbackController.clear();
      ref.invalidate(courseWeeklyReportProvider(widget.courseId));
      ref.invalidate(courseFeedbackHistoryProvider(widget.courseId));
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Feedback submitted!'),
          backgroundColor: Color(0xFF16a34a),
        ),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to submit feedback. Try again.')),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final reportAsync =
        ref.watch(courseWeeklyReportProvider(widget.courseId));

    return Scaffold(
      backgroundColor: _kBg,
      appBar: AppBar(
        backgroundColor: _kCard,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: _kTextPrimary),
          onPressed: () => Navigator.of(context).maybePop(),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Weekly Report',
              style: TextStyle(
                fontFamily: 'Rajdhani',
                fontSize: 16,
                fontWeight: FontWeight.w700,
                letterSpacing: 1.5,
                color: _kTextPrimary,
              ),
            ),
            if (widget.courseTitle.isNotEmpty)
              Text(
                widget.courseTitle,
                style: const TextStyle(
                  fontSize: 11,
                  color: _kTextSecondary,
                  fontWeight: FontWeight.w400,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
          ],
        ),
      ),
      body: reportAsync.when(
        loading: () => const Center(
          child: CircularProgressIndicator(
            strokeWidth: 2,
            valueColor: AlwaysStoppedAnimation<Color>(_kAccent),
          ),
        ),
        error: (_, __) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, color: _kTextSecondary, size: 40),
              const SizedBox(height: 12),
              const Text(
                'Could not load weekly report',
                style: TextStyle(color: _kTextSecondary),
              ),
              const SizedBox(height: 12),
              TextButton(
                onPressed: () => ref.invalidate(
                    courseWeeklyReportProvider(widget.courseId)),
                child: const Text(
                  'Retry',
                  style: TextStyle(color: _kAccent),
                ),
              ),
            ],
          ),
        ),
        data: (report) => _buildBody(context, report),
      ),
    );
  }

  Widget _buildBody(BuildContext context, CourseWeeklyReport? report) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Progress card ────────────────────────────────────────────────
          if (report != null) ...[
            _ProgressCard(report: report),
            const SizedBox(height: 16),
          ] else ...[
            _NoReportCard(),
            const SizedBox(height: 16),
          ],

          // ── Admin remarks card ───────────────────────────────────────────
          if (report != null &&
              report.adminRemarks != null &&
              report.adminRemarks!.isNotEmpty) ...[
            _AdminRemarksCard(remarks: report.adminRemarks!),
            const SizedBox(height: 16),
          ],

          // ── Feedback section ─────────────────────────────────────────────
          _FeedbackSection(
            report: report,
            feedbackController: _feedbackController,
            submitting: _submitting,
            onSubmit: report != null
                ? () => _submitFeedback(report.weekNumber)
                : null,
          ),
          const SizedBox(height: 24),

          // ── History section ──────────────────────────────────────────────
          _HistorySection(
            courseId: widget.courseId,
            expanded: _historyExpanded,
            onToggle: () =>
                setState(() => _historyExpanded = !_historyExpanded),
          ),
          const SizedBox(height: 32),
        ],
      ),
    );
  }
}

// ── Progress card ─────────────────────────────────────────────────────────────

class _ProgressCard extends StatelessWidget {
  const _ProgressCard({required this.report});

  final CourseWeeklyReport report;

  @override
  Widget build(BuildContext context) {
    final pct = (report.completionPercent / 100).clamp(0.0, 1.0);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _kCard,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _kBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.bar_chart_rounded,
                  color: _kAccent, size: 18),
              const SizedBox(width: 8),
              Text(
                'WEEK ${report.weekNumber} PROGRESS',
                style: const TextStyle(
                  fontFamily: 'Rajdhani',
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.5,
                  color: _kTextSecondary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              SizedBox(
                width: 80,
                height: 80,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    CircularProgressIndicator(
                      value: pct,
                      strokeWidth: 7,
                      backgroundColor: _kBorder,
                      valueColor:
                          const AlwaysStoppedAnimation<Color>(_kAccent),
                    ),
                    Center(
                      child: Text(
                        '${report.completionPercent.toStringAsFixed(0)}%',
                        style: const TextStyle(
                          fontFamily: 'Rajdhani',
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                          color: _kTextPrimary,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 20),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${report.lessonsCompleted} of ${report.totalLessons} lessons complete',
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: _kTextPrimary,
                      ),
                    ),
                    const SizedBox(height: 6),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(3),
                      child: LinearProgressIndicator(
                        value: pct,
                        minHeight: 5,
                        backgroundColor: _kBorder,
                        valueColor: const AlwaysStoppedAnimation<Color>(
                            _kAccent),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ── No report placeholder ─────────────────────────────────────────────────────

class _NoReportCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: _kCard,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _kBorder),
      ),
      child: const Row(
        children: [
          Icon(Icons.pending_outlined, color: _kTextSecondary, size: 28),
          SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'No report yet',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: _kTextPrimary,
                  ),
                ),
                SizedBox(height: 4),
                Text(
                  'Your first weekly report will appear here after your admin sends it.',
                  style: TextStyle(
                    fontSize: 12,
                    color: _kTextSecondary,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Admin remarks card ────────────────────────────────────────────────────────

class _AdminRemarksCard extends StatelessWidget {
  const _AdminRemarksCard({required this.remarks});

  final String remarks;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFEAB308).withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
            color: const Color(0xFFEAB308).withValues(alpha: 0.3)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.comment_outlined,
              color: Color(0xFFEAB308), size: 18),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'ADMIN REMARKS',
                  style: TextStyle(
                    fontFamily: 'Rajdhani',
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.5,
                    color: Color(0xFFEAB308),
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  remarks,
                  style: const TextStyle(
                    fontSize: 13,
                    color: _kTextPrimary,
                    height: 1.5,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Feedback section ──────────────────────────────────────────────────────────

class _FeedbackSection extends StatelessWidget {
  const _FeedbackSection({
    required this.report,
    required this.feedbackController,
    required this.submitting,
    required this.onSubmit,
  });

  final CourseWeeklyReport? report;
  final TextEditingController feedbackController;
  final bool submitting;
  final VoidCallback? onSubmit;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _kCard,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _kBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'YOUR FEEDBACK',
            style: TextStyle(
              fontFamily: 'Rajdhani',
              fontSize: 12,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.5,
              color: _kTextSecondary,
            ),
          ),
          const SizedBox(height: 12),

          // Already submitted this week
          if (report != null &&
              report!.feedbackText != null &&
              report!.feedbackText!.isNotEmpty) ...[
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFF0F0F0F),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: _kBorder),
              ),
              child: Text(
                report!.feedbackText!,
                style: const TextStyle(
                  fontSize: 13,
                  color: _kTextPrimary,
                  height: 1.5,
                ),
              ),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: _statusColor(report!.feedbackStatus)
                        .withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(4),
                    border: Border.all(
                        color: _statusColor(report!.feedbackStatus)
                            .withValues(alpha: 0.4)),
                  ),
                  child: Text(
                    _statusLabel(report!.feedbackStatus),
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: _statusColor(report!.feedbackStatus),
                    ),
                  ),
                ),
              ],
            ),
          ] else if (report != null) ...[
            // Not yet submitted — show text field + button
            TextField(
              controller: feedbackController,
              maxLines: 4,
              style: const TextStyle(
                  fontSize: 13, color: _kTextPrimary),
              decoration: InputDecoration(
                hintText:
                    'Share your thoughts on this week\'s progress…',
                hintStyle: const TextStyle(
                    color: _kTextSecondary, fontSize: 13),
                filled: true,
                fillColor: const Color(0xFF0F0F0F),
                contentPadding: const EdgeInsets.all(12),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: const BorderSide(color: _kBorder),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: const BorderSide(color: _kBorder),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: const BorderSide(color: _kAccent),
                ),
              ),
            ),
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              height: 44,
              child: ElevatedButton(
                onPressed: submitting ? null : onSubmit,
                style: ElevatedButton.styleFrom(
                  backgroundColor: _kAccent,
                  disabledBackgroundColor:
                      _kAccent.withValues(alpha: 0.4),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
                child: submitting
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          valueColor: AlwaysStoppedAnimation<Color>(
                              Colors.white),
                        ),
                      )
                    : const Text(
                        'Submit Feedback',
                        style: TextStyle(
                          fontFamily: 'Rajdhani',
                          fontWeight: FontWeight.w700,
                          fontSize: 14,
                          letterSpacing: 1,
                          color: Colors.white,
                        ),
                      ),
              ),
            ),
          ] else ...[
            const Text(
              'Feedback will be available once your first weekly report is sent.',
              style: TextStyle(
                  fontSize: 13, color: _kTextSecondary, height: 1.4),
            ),
          ],
        ],
      ),
    );
  }

  Color _statusColor(String? status) {
    switch (status) {
      case 'reviewed':
        return const Color(0xFF22c55e);
      case 'new':
        return const Color(0xFF3b82f6);
      default:
        return _kTextSecondary;
    }
  }

  String _statusLabel(String? status) {
    switch (status) {
      case 'reviewed':
        return 'Reviewed';
      case 'new':
        return 'Submitted';
      default:
        return 'Submitted';
    }
  }
}

// ── History section ───────────────────────────────────────────────────────────

class _HistorySection extends ConsumerWidget {
  const _HistorySection({
    required this.courseId,
    required this.expanded,
    required this.onToggle,
  });

  final String courseId;
  final bool expanded;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        InkWell(
          onTap: onToggle,
          borderRadius: BorderRadius.circular(8),
          child: Container(
            padding: const EdgeInsets.symmetric(
                horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: _kCard,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: _kBorder),
            ),
            child: Row(
              children: [
                const Icon(Icons.history, color: _kTextSecondary,
                    size: 18),
                const SizedBox(width: 10),
                const Expanded(
                  child: Text(
                    'Previous Reports',
                    style: TextStyle(
                      fontFamily: 'Rajdhani',
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 0.5,
                      color: _kTextPrimary,
                    ),
                  ),
                ),
                AnimatedRotation(
                  turns: expanded ? 0.5 : 0,
                  duration: const Duration(milliseconds: 200),
                  child: const Icon(Icons.expand_more,
                      color: _kTextSecondary, size: 20),
                ),
              ],
            ),
          ),
        ),
        if (expanded) ...[
          const SizedBox(height: 8),
          _HistoryList(courseId: courseId),
        ],
      ],
    );
  }
}

class _HistoryList extends ConsumerWidget {
  const _HistoryList({required this.courseId});

  final String courseId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final historyAsync =
        ref.watch(courseFeedbackHistoryProvider(courseId));
    return historyAsync.when(
      loading: () => const Center(
        child: Padding(
          padding: EdgeInsets.symmetric(vertical: 16),
          child: CircularProgressIndicator(
            strokeWidth: 2,
            valueColor:
                AlwaysStoppedAnimation<Color>(_kAccent),
          ),
        ),
      ),
      error: (_, __) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: TextButton(
          onPressed: () =>
              ref.invalidate(courseFeedbackHistoryProvider(courseId)),
          child: const Text(
            'Retry',
            style: TextStyle(color: _kAccent),
          ),
        ),
      ),
      data: (items) {
        if (items.isEmpty) {
          return const Padding(
            padding: EdgeInsets.symmetric(vertical: 16, horizontal: 4),
            child: Text(
              'No previous reports yet.',
              style:
                  TextStyle(fontSize: 13, color: _kTextSecondary),
            ),
          );
        }
        return Column(
          children: items.map((item) => _HistoryItem(item: item)).toList(),
        );
      },
    );
  }
}

class _HistoryItem extends StatelessWidget {
  const _HistoryItem({required this.item});

  final CourseWeeklyReport item;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: _kCard,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: _kBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                'Week ${item.weekNumber}',
                style: const TextStyle(
                  fontFamily: 'Rajdhani',
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.5,
                  color: _kTextPrimary,
                ),
              ),
              const Spacer(),
              Text(
                '${item.completionPercent.toStringAsFixed(0)}% complete',
                style: const TextStyle(
                    fontSize: 11, color: _kTextSecondary),
              ),
            ],
          ),
          if (item.feedbackText != null &&
              item.feedbackText!.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              item.feedbackText!,
              style: const TextStyle(
                  fontSize: 12,
                  color: _kTextSecondary,
                  height: 1.4),
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
            ),
          ],
          if (item.adminRemarks != null &&
              item.adminRemarks!.isNotEmpty) ...[
            const SizedBox(height: 6),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.comment_outlined,
                    color: Color(0xFFEAB308), size: 12),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    item.adminRemarks!,
                    style: const TextStyle(
                        fontSize: 11,
                        color: Color(0xFFEAB308),
                        height: 1.4),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
