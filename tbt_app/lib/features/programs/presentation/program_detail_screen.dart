import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/theme/design_constants.dart';
import '../../../shared/theme/theme_tokens.dart';
import '../../../shared/widgets/app_loader.dart';
import '../data/programs_service.dart';
import '../providers/programs_provider.dart';

class ProgramDetailScreen extends ConsumerStatefulWidget {
  const ProgramDetailScreen({super.key, required this.programId});

  final String programId;

  @override
  ConsumerState<ProgramDetailScreen> createState() =>
      _ProgramDetailScreenState();
}

class _ProgramDetailScreenState extends ConsumerState<ProgramDetailScreen> {
  bool _enrolling = false;

  Future<void> _enroll() async {
    if (_enrolling) return;
    setState(() => _enrolling = true);
    try {
      await ref
          .read(programsFeatureServiceProvider)
          .enrollInProgram(widget.programId);
      if (!mounted) return;
      ref.invalidate(programDetailProvider(widget.programId));
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Successfully enrolled in program!'),
          backgroundColor: Color(0xFF16a34a),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Could not enroll. Please try again.'),
          backgroundColor: Color(0xFFD30814),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } finally {
      if (mounted) setState(() => _enrolling = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(programDetailProvider(widget.programId));

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
          'PROGRAM DETAILS',
          style: TextStyle(
            fontFamily: 'Rajdhani',
            fontSize: 17,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.5,
            color: context.tokens.textPrimary,
          ),
        ),
      ),
      body: async.when(
        loading: () => const AppLoader.center(),
        error: (_, __) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.error_outline, color: context.tokens.textMuted, size: 40),
              const SizedBox(height: 12),
              Text('Failed to load program',
                  style: TextStyle(color: context.tokens.textSecondary)),
              const SizedBox(height: 12),
              TextButton(
                onPressed: () =>
                    ref.invalidate(programDetailProvider(widget.programId)),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
        data: (program) => _ProgramBody(
          program: program,
          enrolling: _enrolling,
          onEnroll: _enroll,
        ),
      ),
    );
  }
}

class _ProgramBody extends StatelessWidget {
  const _ProgramBody({
    required this.program,
    required this.enrolling,
    required this.onEnroll,
  });

  final TbtProgramDetail program;
  final bool enrolling;
  final VoidCallback onEnroll;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Column(
      children: [
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Header
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 52,
                      height: 52,
                      decoration: BoxDecoration(
                        color: kColorAccent.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(Icons.school_outlined,
                          color: kColorAccent, size: 26),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            program.name,
                            style: TextStyle(
                              color: tokens.textPrimary,
                              fontSize: 20,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 4),
                          _StatusBadge(status: program.status),
                        ],
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 20),

                // Stats row
                Row(
                  children: [
                    Expanded(
                      child: _StatCard(
                        icon: Icons.calendar_today_outlined,
                        label: 'Duration',
                        value: '${program.durationDays} days',
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _StatCard(
                        icon: Icons.hourglass_bottom_outlined,
                        label: 'Incubation',
                        value: '${program.incubationDays} days',
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _StatCard(
                        icon: Icons.assignment_outlined,
                        label: 'Tasks',
                        value: '${program.tasks.length}',
                      ),
                    ),
                  ],
                ),

                if (program.description != null &&
                    program.description!.isNotEmpty) ...[
                  const SizedBox(height: 20),
                  _SectionLabel('ABOUT THIS PROGRAM'),
                  const SizedBox(height: 8),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: tokens.bgSurface,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: tokens.borderCard),
                    ),
                    child: Text(
                      program.description!,
                      style: TextStyle(
                        color: tokens.textSecondary,
                        fontSize: 14,
                        height: 1.6,
                      ),
                    ),
                  ),
                ],

                if (program.activeBatches.isNotEmpty) ...[
                  const SizedBox(height: 20),
                  _SectionLabel('ACTIVE BATCHES'),
                  const SizedBox(height: 8),
                  ...program.activeBatches.map(
                    (b) => _BatchTile(name: b['name'] ?? ''),
                  ),
                ],

                if (program.tasks.isNotEmpty) ...[
                  const SizedBox(height: 20),
                  _SectionLabel('CURRICULUM'),
                  const SizedBox(height: 8),
                  _CurriculumList(tasks: program.tasks),
                ],

                const SizedBox(height: 24),
              ],
            ),
          ),
        ),

        // Enrollment CTA — pinned at bottom
        _EnrollmentBar(
          isEnrolled: program.isEnrolled,
          enrolling: enrolling,
          onEnroll: onEnroll,
        ),
      ],
    );
  }
}

// ── Curriculum ─────────────────────────────────────────────────────────────

class _CurriculumList extends StatefulWidget {
  const _CurriculumList({required this.tasks});
  final List<TbtProgramTask> tasks;

  @override
  State<_CurriculumList> createState() => _CurriculumListState();
}

class _CurriculumListState extends State<_CurriculumList> {
  // Build week → tasks map
  Map<int, List<TbtProgramTask>> get _byWeek {
    final map = <int, List<TbtProgramTask>>{};
    for (final t in widget.tasks) {
      (map[t.weekNumber] ??= []).add(t);
    }
    return map;
  }

  late Set<int> _expanded;

  @override
  void initState() {
    super.initState();
    // Expand week 1 by default.
    _expanded = {1};
  }

  @override
  Widget build(BuildContext context) {
    final byWeek = _byWeek;
    final weeks = byWeek.keys.toList()..sort();
    return Column(
      children: weeks.map((week) {
        final tasks = byWeek[week]!;
        final isOpen = _expanded.contains(week);
        return _WeekAccordion(
          week: week,
          tasks: tasks,
          isOpen: isOpen,
          onToggle: () => setState(() {
            if (isOpen) {
              _expanded.remove(week);
            } else {
              _expanded.add(week);
            }
          }),
        );
      }).toList(),
    );
  }
}

class _WeekAccordion extends StatelessWidget {
  const _WeekAccordion({
    required this.week,
    required this.tasks,
    required this.isOpen,
    required this.onToggle,
  });

  final int week;
  final List<TbtProgramTask> tasks;
  final bool isOpen;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final totalMins = tasks.fold(0, (s, t) => s + t.estimatedMinutes);
    final milestones = tasks.where((t) => t.isMilestone).length;
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: tokens.bgSurface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: tokens.borderCard),
      ),
      child: Column(
        children: [
          InkWell(
            onTap: onToggle,
            borderRadius: BorderRadius.circular(10),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              child: Row(
                children: [
                  Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      color: kColorAccent.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Center(
                      child: Text(
                        '$week',
                        style: const TextStyle(
                          color: kColorAccent,
                          fontSize: 13,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Week $week',
                          style: TextStyle(
                            color: tokens.textPrimary,
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '${tasks.length} tasks · ${_fmtMins(totalMins)}'
                          '${milestones > 0 ? ' · $milestones milestone${milestones > 1 ? 's' : ''}' : ''}',
                          style: TextStyle(
                            color: tokens.textMuted,
                            fontSize: 11,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Icon(
                    isOpen ? Icons.expand_less : Icons.expand_more,
                    color: tokens.textMuted,
                    size: 20,
                  ),
                ],
              ),
            ),
          ),
          if (isOpen)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Column(
                children: tasks.map((t) => _TaskRow(task: t)).toList(),
              ),
            ),
        ],
      ),
    );
  }

  String _fmtMins(int mins) {
    if (mins < 60) return '${mins}m';
    final h = mins ~/ 60;
    final m = mins % 60;
    return m > 0 ? '${h}h ${m}m' : '${h}h';
  }
}

class _TaskRow extends StatelessWidget {
  const _TaskRow({required this.task});
  final TbtProgramTask task;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 4, 14, 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Day badge
          Container(
            width: 36,
            padding: const EdgeInsets.symmetric(vertical: 3),
            decoration: BoxDecoration(
              color: tokens.bgInput,
              borderRadius: BorderRadius.circular(6),
              border: Border.all(color: tokens.borderCard),
            ),
            child: Text(
              'D${task.dayNumber}',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontFamily: 'Rajdhani',
                color: tokens.textMuted,
                fontSize: 10,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.3,
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    if (task.isMilestone) ...[
                      const Icon(Icons.flag, color: Color(0xFFf59e0b), size: 12),
                      const SizedBox(width: 4),
                    ],
                    Expanded(
                      child: Text(
                        task.title,
                        style: TextStyle(
                          color: tokens.textPrimary,
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 2),
                Row(
                  children: [
                    Icon(Icons.schedule, size: 11, color: tokens.textMuted),
                    const SizedBox(width: 3),
                    Text(
                      '${task.estimatedMinutes}m · ${task.basePoints} pts',
                      style: TextStyle(color: tokens.textMuted, fontSize: 11),
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

// ── Enrollment bar ─────────────────────────────────────────────────────────

class _EnrollmentBar extends StatelessWidget {
  const _EnrollmentBar({
    required this.isEnrolled,
    required this.enrolling,
    required this.onEnroll,
  });

  final bool isEnrolled;
  final bool enrolling;
  final VoidCallback onEnroll;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Container(
      padding: EdgeInsets.fromLTRB(
        16,
        12,
        16,
        12 + MediaQuery.paddingOf(context).bottom,
      ),
      decoration: BoxDecoration(
        color: tokens.bgSurface,
        border: Border(top: BorderSide(color: tokens.borderCard)),
      ),
      child: SizedBox(
        width: double.infinity,
        height: 48,
        child: isEnrolled
            ? OutlinedButton.icon(
                onPressed: null,
                icon: const Icon(Icons.check_circle, size: 18, color: Color(0xFF16a34a)),
                label: const Text(
                  'ENROLLED',
                  style: TextStyle(
                    fontFamily: 'Rajdhani',
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.2,
                    color: Color(0xFF16a34a),
                  ),
                ),
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: Color(0xFF16a34a)),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              )
            : FilledButton(
                onPressed: enrolling ? null : onEnroll,
                style: FilledButton.styleFrom(
                  backgroundColor: kColorAccent,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  textStyle: const TextStyle(
                    fontFamily: 'Rajdhani',
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.2,
                  ),
                ),
                child: enrolling
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Text('JOIN PROGRAM'),
              ),
      ),
    );
  }
}

// ── Shared small widgets ───────────────────────────────────────────────────

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Text(
        text,
        style: TextStyle(
          fontFamily: 'Rajdhani',
          fontSize: 11,
          fontWeight: FontWeight.w700,
          letterSpacing: 1.5,
          color: context.tokens.textMuted,
        ),
      );
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.status});
  final String status;

  Color _color(BuildContext context) => switch (status) {
        'active' => const Color(0xFF16a34a),
        'draft' => const Color(0xFFd97706),
        _ => context.tokens.textMuted,
      };

  @override
  Widget build(BuildContext context) {
    final c = _color(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: c.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(5),
      ),
      child: Text(
        status.toUpperCase(),
        style: TextStyle(
          color: c,
          fontSize: 10,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.5,
        ),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: tokens.bgSurface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: tokens.borderCard),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 16, color: kColorAccent),
          const SizedBox(height: 6),
          Text(
            value,
            style: TextStyle(
              color: tokens.textPrimary,
              fontSize: 16,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label.toUpperCase(),
            style: TextStyle(
              fontFamily: 'Rajdhani',
              color: tokens.textMuted,
              fontSize: 9,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.8,
            ),
          ),
        ],
      ),
    );
  }
}

class _BatchTile extends StatelessWidget {
  const _BatchTile({required this.name});
  final String name;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: tokens.bgSurface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: tokens.borderCard),
      ),
      child: Row(
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: const BoxDecoration(
              color: kColorAccent,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              name,
              style: TextStyle(
                color: tokens.textSecondary,
                fontSize: 13,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          const Icon(Icons.check_circle_outline,
              size: 14, color: Color(0xFF16a34a)),
        ],
      ),
    );
  }
}
