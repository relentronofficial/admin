import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../shared/models/batch.dart';
import '../providers/batch_provider.dart';
import '../../../shared/theme/theme_tokens.dart';
import '../../../shared/widgets/app_loader.dart';

class BatchAttendanceScreen extends ConsumerWidget {
  const BatchAttendanceScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final programAsync = ref.watch(batchProgramProvider);

    return Scaffold(
      backgroundColor: const Color(0xFF0F0F0F),
      appBar: AppBar(
        backgroundColor: const Color(0xFF181818),
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: Icon(Icons.arrow_back, color: context.tokens.textPrimary),
          onPressed: () => context.pop(),
        ),
        title: Text(
          'ATTENDANCE HISTORY',
          style: TextStyle(
            fontFamily: 'Rajdhani',
            fontSize: 17,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.5,
            color: context.tokens.textPrimary,
          ),
        ),
      ),
      body: programAsync.when(
        loading: () => const AppLoader.center(),
        error: (_, __) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.error_outline,
                  color: context.tokens.textMuted, size: 40),
              const SizedBox(height: 12),
              Text(
                'Failed to load attendance',
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
              child: Text(
                'No batch program assigned',
                style: TextStyle(
                    color: context.tokens.textMuted, fontSize: 14),
              ),
            );
          }

          final records = List<BatchAttendance>.from(program.attendance)
            ..sort((a, b) => b.dayNumber.compareTo(a.dayNumber));

          if (records.isEmpty) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.event_note_outlined,
                      color: context.tokens.textMuted, size: 48),
                  const SizedBox(height: 16),
                  Text(
                    'No attendance records yet',
                    style: TextStyle(
                      color: context.tokens.textSecondary,
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Mark attendance on each day screen.',
                    style: TextStyle(
                        color: context.tokens.textMuted, fontSize: 12),
                  ),
                ],
              ),
            );
          }

          // Compute summary counts.
          final presentCount = records
              .where((r) => r.status == 'present')
              .length;
          final absentCount = records
              .where((r) => r.status == 'absent')
              .length;
          final lateCount = records
              .where((r) => r.status == 'late')
              .length;

          return ListView.builder(
            padding: const EdgeInsets.symmetric(vertical: 12),
            itemCount: records.length + 1, // +1 for summary header
            itemBuilder: (context, index) {
              if (index == 0) {
                return _SummaryBar(
                  presentCount: presentCount,
                  absentCount: absentCount,
                  lateCount: lateCount,
                );
              }
              final record = records[index - 1];
              return _AttendanceTile(record: record);
            },
          );
        },
      ),
    );
  }
}

// ── Summary bar ───────────────────────────────────────────────────────────────

class _SummaryBar extends StatelessWidget {
  const _SummaryBar({
    required this.presentCount,
    required this.absentCount,
    required this.lateCount,
  });

  final int presentCount;
  final int absentCount;
  final int lateCount;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: const Color(0xFF181818),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF2A2A2A)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _SummaryStat(
            label: 'PRESENT',
            count: presentCount,
            color: const Color(0xFF22C55E),
          ),
          _VertDivider(),
          _SummaryStat(
            label: 'ABSENT',
            count: absentCount,
            color: const Color(0xFFDC2626),
          ),
          _VertDivider(),
          _SummaryStat(
            label: 'LATE',
            count: lateCount,
            color: const Color(0xFFF59E0B),
          ),
        ],
      ),
    );
  }
}

class _VertDivider extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      width: 1,
      height: 32,
      color: const Color(0xFF2A2A2A),
    );
  }
}

class _SummaryStat extends StatelessWidget {
  const _SummaryStat({
    required this.label,
    required this.count,
    required this.color,
  });

  final String label;
  final int count;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          '$count',
          style: TextStyle(
            color: color,
            fontSize: 22,
            fontWeight: FontWeight.w700,
            fontFamily: 'Rajdhani',
          ),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: const TextStyle(
            color: Color(0xFF606060),
            fontSize: 9,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.2,
            fontFamily: 'Rajdhani',
          ),
        ),
      ],
    );
  }
}

// ── Attendance tile ───────────────────────────────────────────────────────────

class _AttendanceTile extends StatelessWidget {
  const _AttendanceTile({required this.record});

  final BatchAttendance record;

  Color get _statusColor {
    switch (record.status) {
      case 'present':
        return const Color(0xFF22C55E);
      case 'absent':
        return const Color(0xFFDC2626);
      case 'late':
        return const Color(0xFFF59E0B);
      default:
        return const Color(0xFF606060);
    }
  }

  String get _statusLabel {
    switch (record.status) {
      case 'present':
        return 'Present';
      case 'absent':
        return 'Absent';
      case 'late':
        return 'Late';
      default:
        return record.status[0].toUpperCase() + record.status.substring(1);
    }
  }

  String _formatDate(String? iso) {
    if (iso == null || iso.isEmpty) return '';
    try {
      final dt = DateTime.parse(iso).toLocal();
      return DateFormat('d MMM yyyy, h:mm a').format(dt);
    } catch (_) {
      return '';
    }
  }

  @override
  Widget build(BuildContext context) {
    final formattedDate = _formatDate(record.markedAt);

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF181818),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFF2A2A2A)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Day number badge
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: _statusColor.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(
                  color: _statusColor.withValues(alpha: 0.3)),
            ),
            child: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    '${record.dayNumber}',
                    style: TextStyle(
                      color: _statusColor,
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      fontFamily: 'Rajdhani',
                    ),
                  ),
                  Text(
                    'DAY',
                    style: TextStyle(
                      color: _statusColor.withValues(alpha: 0.7),
                      fontSize: 8,
                      fontWeight: FontWeight.w700,
                      fontFamily: 'Rajdhani',
                      letterSpacing: 0.5,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      'Day ${record.dayNumber}',
                      style: TextStyle(
                        color: context.tokens.textPrimary,
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const Spacer(),
                    // Status badge
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: _statusColor.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        _statusLabel.toUpperCase(),
                        style: TextStyle(
                          color: _statusColor,
                          fontSize: 9,
                          fontWeight: FontWeight.w700,
                          fontFamily: 'Rajdhani',
                          letterSpacing: 0.8,
                        ),
                      ),
                    ),
                  ],
                ),
                if (formattedDate.isNotEmpty) ...[
                  const SizedBox(height: 3),
                  Text(
                    formattedDate,
                    style: TextStyle(
                      color: context.tokens.textMuted,
                      fontSize: 11,
                    ),
                  ),
                ],
                if (record.notes != null &&
                    record.notes!.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 6),
                    decoration: BoxDecoration(
                      color: const Color(0xFF0F0F0F),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(
                          color: const Color(0xFF2A2A2A)),
                    ),
                    child: Text(
                      record.notes!,
                      style: TextStyle(
                        color: context.tokens.textSecondary,
                        fontSize: 11,
                        height: 1.4,
                        fontStyle: FontStyle.italic,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
