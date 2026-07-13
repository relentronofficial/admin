import 'package:flutter/material.dart';

import '../../../../shared/models/batch.dart';
import '../../../../shared/theme/design_constants.dart';

// Status background colours (from CC-36 spec)
const _kColorNotStarted = Color(0xFF2a2a2a);
const _kColorInProgress = Color(0xFF1d4ed8);
const _kColorSubmitted = Color(0xFFd97706);
const _kColorApproved = Color(0xFF16a34a);
const _kColorRejected = Color(0xFFdc2626);

class BatchCalendar extends StatelessWidget {
  const BatchCalendar({
    super.key,
    required this.program,
    required this.onDayTap,
  });

  final BatchProgram program;
  final ValueChanged<int> onDayTap;

  int get _todayDayNumber {
    final startDate = program.batch.startDate;
    if (startDate == null) return -1;
    try {
      final start = DateTime.parse(startDate);
      final today = DateTime.now();
      final elapsed =
          DateTime(today.year, today.month, today.day)
              .difference(DateTime(start.year, start.month, start.day))
              .inDays;
      return elapsed + 1;
    } catch (_) {
      return -1;
    }
  }

  @override
  Widget build(BuildContext context) {
    final total = program.totalDays;
    final today = _todayDayNumber;
    final dayMap = {for (final d in program.days) d.dayNumber: d};
    final attMap = {
      for (final a in program.attendance) a.dayNumber: a.status,
    };

    // Pad to fill the last row completely
    final cellCount = ((total + 6) ~/ 7) * 7;

    return RepaintBoundary(
      child: GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: 12),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 7,
        crossAxisSpacing: 4,
        mainAxisSpacing: 4,
        childAspectRatio: 1,
      ),
      itemCount: cellCount,
      itemBuilder: (_, i) {
        final dayNum = i + 1;
        if (dayNum > total) return const SizedBox.shrink();
        final day = dayMap[dayNum];
        final status = day?.status ?? BatchDayStatus.notStarted;
        final isToday = dayNum == today;
        return _DayCell(
          dayNumber: dayNum,
          status: status,
          category: day?.category,
          attendance: attMap[dayNum],
          isToday: isToday,
          onTap: () => onDayTap(dayNum),
        );
      },
      ),
    );
  }
}

class _DayCell extends StatelessWidget {
  const _DayCell({
    required this.dayNumber,
    required this.status,
    required this.category,
    required this.attendance,
    required this.isToday,
    required this.onTap,
  });

  final int dayNumber;
  final BatchDayStatus status;
  final String? category;
  final String? attendance; // 'present' | 'absent' | 'break' | null
  final bool isToday;
  final VoidCallback onTap;

  Color? get _attendanceColor {
    switch (attendance) {
      case 'present':
        return const Color(0xFF22c55e);
      case 'absent':
        return const Color(0xFFef4444);
      case 'break':
        return const Color(0xFFf59e0b);
      default:
        return null;
    }
  }

  // Stable-hash a category string to a color. Different admin-defined
  // category names (Foundation / Growth / Marketing / …) get distinct hues.
  Color? get _categoryColor {
    final c = category;
    if (c == null || c.isEmpty) return null;
    // Curated palette — extend as new categories appear.
    const palette = [
      Color(0xFF3b82f6), // blue
      Color(0xFF8b5cf6), // purple
      Color(0xFF06b6d4), // cyan
      Color(0xFFec4899), // pink
      Color(0xFF10b981), // emerald
      Color(0xFFf97316), // orange
      Color(0xFFa855f7), // violet
      Color(0xFF14b8a6), // teal
    ];
    var hash = 0;
    for (final rune in c.runes) {
      hash = (hash * 31 + rune) & 0x7fffffff;
    }
    return palette[hash % palette.length];
  }

  Color get _bgColor {
    switch (status) {
      case BatchDayStatus.notStarted:
        return _kColorNotStarted;
      case BatchDayStatus.inProgress:
        return _kColorInProgress;
      case BatchDayStatus.submitted:
        return _kColorSubmitted;
      case BatchDayStatus.approved:
        return _kColorApproved;
      case BatchDayStatus.rejected:
        return _kColorRejected;
    }
  }

  Color get _textColor {
    if (status == BatchDayStatus.notStarted) return kColorTextMuted;
    return Colors.white;
  }

  @override
  Widget build(BuildContext context) {
    final statusLabel = status.name.replaceAllMapped(
      RegExp(r'[A-Z]'),
      (m) => ' ${m.group(0)!.toLowerCase()}',
    ).trim();
    return Semantics(
      label: 'Day $dayNumber, $statusLabel${isToday ? ', today' : ''}',
      button: true,
      child: GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        decoration: BoxDecoration(
          color: _bgColor,
          borderRadius: BorderRadius.circular(6),
          border: isToday
              ? Border.all(color: Colors.white, width: 1.5)
              : null,
        ),
        child: Stack(
          children: [
            Center(
              child: Text(
                '$dayNumber',
                style: TextStyle(
                  color: _textColor,
                  fontSize: 11,
                  fontWeight: isToday ? FontWeight.w700 : FontWeight.w500,
                ),
              ),
            ),
            // Category strip along the bottom edge — subtle color-coded
            // divider so users can scan the calendar for category grouping
            // (Foundation / Growth / Marketing / …).
            if (_categoryColor != null)
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                child: Container(
                  height: 3,
                  decoration: BoxDecoration(
                    color: _categoryColor,
                    borderRadius: const BorderRadius.only(
                      bottomLeft: Radius.circular(6),
                      bottomRight: Radius.circular(6),
                    ),
                  ),
                ),
              ),
            // Attendance dot in the top-right corner (present/absent/break).
            if (_attendanceColor != null)
              Positioned(
                top: 3,
                right: 3,
                child: Container(
                  width: 6,
                  height: 6,
                  decoration: BoxDecoration(
                    color: _attendanceColor,
                    shape: BoxShape.circle,
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
