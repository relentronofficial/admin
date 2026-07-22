import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';

import '../../../core/constants/routes.dart';
import '../../../shared/models/batch.dart';
import '../data/batch_service.dart';
import '../providers/batch_provider.dart';
import 'break_request_sheet.dart';
import 'widgets/batch_calendar.dart';

import '../../../shared/theme/design_tokens.dart';
import '../../../shared/theme/theme_tokens.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_loader.dart';
class BatchProgramScreen extends ConsumerWidget {
  const BatchProgramScreen({super.key});

  int _todayDayNumber(BatchProgram program) {
    final startDate = program.batch.startDate;
    if (startDate == null) return 1;
    try {
      final start = DateTime.parse(startDate);
      final today = DateTime.now();
      final elapsed =
          DateTime(today.year, today.month, today.day)
              .difference(DateTime(start.year, start.month, start.day))
              .inDays;
      return (elapsed + 1).clamp(1, program.totalDays);
    } catch (_) {
      return 1;
    }
  }

  void _openBreakSheet(BuildContext context, BatchProgram program) {
    // Convert the `startsAt` ISO string once here; a null result means the
    // sheet will show its "batch has no start date" fallback.
    final startDate = program.batch.startDate == null
        ? null
        : DateTime.tryParse(program.batch.startDate!);
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: context.tokens.bgSurface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.xl)),
      ),
      builder: (_) => BreakRequestSheet(
        totalDays: program.totalDays,
        batchStartDate: startDate,
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Show XP SnackBar when a batch day is approved via socket.
    ref.listen<BatchDayApprovedEvent?>(
      batchDayApprovedNotifierProvider,
      (_, event) {
        if (event == null) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              '+${event.xpAwarded} XP! Day ${event.dayNumber} approved',
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
            backgroundColor: const Color(0xFF16a34a),
            duration: const Duration(seconds: 4),
          ),
        );
      },
    );

    // Show rejection SnackBar when admin rejects a day submission via socket.
    ref.listen<BatchDayRejectedEvent?>(
      batchDayRejectedNotifierProvider,
      (_, event) {
        if (event == null) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Day ${event.dayNumber} needs revision',
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
            backgroundColor: const Color(0xFFdc2626),
            duration: const Duration(seconds: 5),
          ),
        );
      },
    );

    // Show congratulatory SnackBar when the entire program is completed.
    ref.listen<BatchCompletedEvent?>(
      batchCompletedNotifierProvider,
      (_, event) {
        if (event == null) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Congratulations! You completed all ${event.totalDays} days 🏆',
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
            backgroundColor: const Color(0xFF16a34a),
            duration: const Duration(seconds: 6),
          ),
        );
      },
    );

    final programAsync = ref.watch(batchProgramProvider);

    return Scaffold(
      appBar: AppBar(
        backgroundColor: context.tokens.bgSurface,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: Icon(Icons.arrow_back, color: context.tokens.textPrimary),
          onPressed: () => context.pop(),
        ),
        title: Text(
          'BATCH PROGRAM',
          style: TextStyle(
            fontFamily: 'Rajdhani',
            fontSize: 17,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.5,
            color: context.tokens.textPrimary,
          ),
        ),
        actions: [
          if (programAsync.valueOrNull != null)
            IconButton(
              icon: Icon(Icons.beach_access_outlined,
                  color: context.tokens.textPrimary, size: 22),
              tooltip: 'Request Break',
              onPressed: () => _openBreakSheet(context, programAsync.value!),
            ),
        ],
      ),
      body: programAsync.when(
        loading: () =>
            const AppLoader.center(),
        error: (_, __) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.error_outline, color: context.tokens.textMuted, size: 40),
              const SizedBox(height: 12),
              Text(
                'Failed to load program',
                style: TextStyle(color: context.tokens.textSecondary),
              ),
              const SizedBox(height: 12),
              TextButton(
                onPressed: () => ref.invalidate(batchProgramProvider),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
        data: (program) {
          if (program == null) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.calendar_today_outlined,
                      color: context.tokens.textMuted, size: 40),
                  SizedBox(height: 12),
                  Text(
                    'No batch program assigned',
                    style: TextStyle(color: context.tokens.textSecondary, fontSize: 14),
                  ),
                ],
              ),
            );
          }

          final todayDay = _todayDayNumber(program);
          final daysLeft =
              (program.totalDays - todayDay + 1).clamp(0, program.totalDays);
          final approvedCount = program.days
              .where((d) => d.status == BatchDayStatus.approved)
              .length;

          // Compute current attendance streak (consecutive present days ending
          // at today or the latest attended day). Matches the web's 7+ day
          // golden streak indicator.
          final attendanceByDay = <int, String>{
            for (final a in program.attendance) a.dayNumber: a.status,
          };
          int streak = 0;
          for (var d = todayDay; d >= 1; d--) {
            final st = attendanceByDay[d];
            if (st == 'present' || st == 'break') {
              streak += st == 'present' ? 1 : 0;
              if (st != 'present' && st != 'break') break;
            } else if (st == 'absent') {
              break;
            } else {
              // No record → stop counting.
              if (d < todayDay) break;
            }
          }

          return Column(
            children: [
              Expanded(
                child: SingleChildScrollView(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _HeaderCard(
                        batchName:
                            program.batch.programName ?? program.batch.name,
                        todayDay: todayDay,
                        totalDays: program.totalDays,
                        daysLeft: daysLeft,
                        approvedCount: approvedCount,
                        streakDays: streak,
                      ),
                      const SizedBox(height: 4),
                      _Legend(),
                      const SizedBox(height: 12),
                      BatchCalendar(
                        program: program,
                        onDayTap: (day) =>
                            context.push(AppRoutes.batchDayPath(day)),
                      ),
                      if (program.breaks.isNotEmpty) ...[
                        const SizedBox(height: 20),
                        _BreaksList(breaks: program.breaks),
                      ],
                      if (approvedCount >= program.totalDays &&
                          program.totalDays > 0) ...[
                        const SizedBox(height: 20),
                        _BatchCertDownloadButton(),
                      ],
                      const SizedBox(height: 100),
                    ],
                  ),
                ),
              ),
            ],
          );
        },
      ),
      bottomNavigationBar: programAsync.whenOrNull(
        data: (program) {
          if (program == null) return null;
          final todayDay = _todayDayNumber(program);
          return SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.lg,
                AppSpacing.sm,
                AppSpacing.lg,
                AppSpacing.md,
              ),
              child: AppPrimaryButton(
                label: "Today's day — Day $todayDay",
                icon: Icons.today,
                size: AppButtonSize.lg,
                fullWidth: true,
                onPressed: () => context.push(AppRoutes.batchDayPath(todayDay)),
              ),
            ),
          );
        },
      ),
    );
  }
}

// ── Header card ───────────────────────────────────────────────────────────────

class _HeaderCard extends StatelessWidget {
  const _HeaderCard({
    required this.batchName,
    required this.todayDay,
    required this.totalDays,
    required this.daysLeft,
    required this.approvedCount,
    required this.streakDays,
  });

  final String batchName;
  final int todayDay;
  final int totalDays;
  final int daysLeft;
  final int approvedCount;
  final int streakDays;

  @override
  Widget build(BuildContext context) {
    // 7+ day streak gets a golden badge — mirrors the web glow.
    final bigStreak = streakDays >= 7;
    return Container(
      width: double.infinity,
      color: context.tokens.bgSurface,
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  batchName,
                  style: TextStyle(
                    color: context.tokens.textPrimary,
                    fontFamily: 'Rajdhani',
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1,
                  ),
                ),
              ),
              if (streakDays > 0)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: bigStreak
                        ? const Color(0xFFf59e0b).withValues(alpha: 0.22)
                        : context.tokens.bgInput,
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(
                      color: bigStreak
                          ? const Color(0xFFf59e0b)
                          : context.tokens.borderCard,
                    ),
                    boxShadow: bigStreak
                        ? [
                            BoxShadow(
                              color: const Color(0xFFf59e0b)
                                  .withValues(alpha: 0.3),
                              blurRadius: 10,
                            ),
                          ]
                        : null,
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.local_fire_department,
                          color: bigStreak
                              ? const Color(0xFFf59e0b)
                              : context.tokens.textMuted,
                          size: 14),
                      const SizedBox(width: 4),
                      Text(
                        '${streakDays}d',
                        style: TextStyle(
                          color: bigStreak
                              ? const Color(0xFFf59e0b)
                              : context.tokens.textSecondary,
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              _StatChip(
                label: 'TODAY',
                value: 'Day $todayDay',
                color: Theme.of(context).colorScheme.primary,
              ),
              const SizedBox(width: 10),
              _StatChip(
                label: 'TOTAL',
                value: '$totalDays days',
                color: context.tokens.textMuted,
              ),
              const SizedBox(width: 10),
              _StatChip(
                label: 'APPROVED',
                value: '$approvedCount',
                color: const Color(0xFF16a34a),
              ),
              const SizedBox(width: 10),
              _StatChip(
                label: 'REMAINING',
                value: '$daysLeft',
                color: const Color(0xFF1d4ed8),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _StatChip extends StatelessWidget {
  const _StatChip({
    required this.label,
    required this.value,
    required this.color,
  });

  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: TextStyle(
            fontFamily: 'Rajdhani',
            fontSize: 9,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.2,
            color: context.tokens.textMuted,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          value,
          style: TextStyle(
            color: color,
            fontSize: 14,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
  }
}

// ── Colour legend ─────────────────────────────────────────────────────────────

class _Legend extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      child: Wrap(
        spacing: 12,
        runSpacing: 6,
        children: [
          // "Not started" uses the neutral surface token — same rule as
          // batch_calendar._DayCell — so the swatch matches the calendar
          // cell in both light and dark modes.
          _LegendDot(
              color: context.tokens.borderCard, label: 'Not started'),
          const _LegendDot(color: Color(0xFF1d4ed8), label: 'In progress'),
          const _LegendDot(color: Color(0xFFd97706), label: 'Submitted'),
          const _LegendDot(color: Color(0xFF16a34a), label: 'Approved'),
          const _LegendDot(color: Color(0xFFdc2626), label: 'Rejected'),
        ],
      ),
    );
  }
}

class _LegendDot extends StatelessWidget {
  const _LegendDot({required this.color, required this.label});

  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(width: 4),
        Text(
          label,
          style: TextStyle(color: context.tokens.textMuted, fontSize: 10),
        ),
      ],
    );
  }
}

// ── Breaks list ───────────────────────────────────────────────────────────────

class _BreaksList extends StatelessWidget {
  const _BreaksList({required this.breaks});

  final List<BatchBreak> breaks;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'BREAK REQUESTS',
            style: TextStyle(
              fontFamily: 'Rajdhani',
              fontSize: 11,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.5,
              color: context.tokens.textMuted,
            ),
          ),
          const SizedBox(height: 8),
          ...breaks.map((b) => _BreakTile(breakItem: b)),
        ],
      ),
    );
  }
}

class _BreakTile extends StatelessWidget {
  const _BreakTile({required this.breakItem});

  final BatchBreak breakItem;

  Color get _statusColor {
    switch (breakItem.status) {
      case BatchBreakStatus.approved:
        return const Color(0xFF16a34a);
      case BatchBreakStatus.rejected:
        return const Color(0xFFdc2626);
      case BatchBreakStatus.pending:
        return const Color(0xFFd97706);
    }
  }

  String get _statusLabel {
    switch (breakItem.status) {
      case BatchBreakStatus.approved:
        return 'Approved';
      case BatchBreakStatus.rejected:
        return 'Rejected';
      case BatchBreakStatus.pending:
        return 'Pending';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: context.tokens.bgSurface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: context.tokens.borderCard),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Day ${breakItem.startDay} – Day ${breakItem.endDay}',
                  style: TextStyle(
                    color: context.tokens.textPrimary,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                if (breakItem.reason != null && breakItem.reason!.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      breakItem.reason!,
                      style: TextStyle(
                          color: context.tokens.textSecondary, fontSize: 11),
                    ),
                  ),
                if (breakItem.adminNote != null &&
                    breakItem.adminNote!.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      'Note: ${breakItem.adminNote}',
                      style: TextStyle(
                          color: _statusColor,
                          fontSize: 11,
                          fontStyle: FontStyle.italic),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: _statusColor.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              _statusLabel,
              style: TextStyle(
                color: _statusColor,
                fontSize: 10,
                fontWeight: FontWeight.w700,
                fontFamily: 'Rajdhani',
                letterSpacing: 0.5,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Batch certificate download button ────────────────────────────────────────

class _BatchCertDownloadButton extends ConsumerStatefulWidget {
  @override
  ConsumerState<_BatchCertDownloadButton> createState() =>
      _BatchCertDownloadButtonState();
}

class _BatchCertDownloadButtonState
    extends ConsumerState<_BatchCertDownloadButton> {
  bool _launching = false;

  Future<void> _download() async {
    if (_launching) return;
    setState(() => _launching = true);
    try {
      final bytes =
          await ref.read(batchServiceProvider).downloadCertificate();
      final dir = await getTemporaryDirectory();
      final file = File('${dir.path}/tbt-batch-certificate.pdf');
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
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
      child: AppPrimaryButton(
        label: 'Download certificate',
        icon: Icons.workspace_premium,
        size: AppButtonSize.md,
        fullWidth: true,
        isLoading: _launching,
        onPressed: _launching ? null : _download,
      ),
    );
  }
}
