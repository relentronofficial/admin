import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/theme/design_constants.dart';
import '../../../shared/theme/design_tokens.dart';
import '../data/batch_service.dart';
import '../providers/batch_provider.dart';

import '../../../shared/theme/theme_tokens.dart';
import '../../../shared/widgets/app_button.dart';
/// Break request bottom sheet.
///
/// The backend takes `startDay` / `endDay` as integer day numbers (1..totalDays),
/// but asking the member to type "day 42" is far worse UX than a date picker.
/// We surface calendar dates and convert to day numbers on submit, matching the
/// web UI (`app/(platform)/batch-program/page.tsx`).
///
/// `batchStartDate` is the batch's first day. When null (rare — legacy batches
/// with no `startsAt` set), we fall back to typed day numbers so the user can
/// still submit a request.
class BreakRequestSheet extends ConsumerStatefulWidget {
  const BreakRequestSheet({
    super.key,
    required this.totalDays,
    this.batchStartDate,
  });

  final int totalDays;
  final DateTime? batchStartDate;

  @override
  ConsumerState<BreakRequestSheet> createState() => _BreakRequestSheetState();
}

class _BreakRequestSheetState extends ConsumerState<BreakRequestSheet> {
  DateTime? _startDate;
  DateTime? _endDate;
  final _reasonController = TextEditingController();
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _reasonController.dispose();
    super.dispose();
  }

  // ── Date ↔ day-number conversion ─────────────────────────────────────────────
  //
  // Day 1 is `batchStartDate`, day 2 is `batchStartDate + 1 day`, etc. The
  // backend accepts inclusive ranges, so `endDay >= startDay`.

  DateTime get _minDate => widget.batchStartDate!;
  DateTime get _maxDate =>
      widget.batchStartDate!.add(Duration(days: widget.totalDays - 1));

  int _dayFor(DateTime d) {
    final start = widget.batchStartDate!;
    return DateTime(d.year, d.month, d.day)
            .difference(DateTime(start.year, start.month, start.day))
            .inDays +
        1;
  }

  String? get _dayRangeText {
    if (widget.batchStartDate == null ||
        _startDate == null ||
        _endDate == null) {
      return null;
    }
    return 'Days ${_dayFor(_startDate!)}–${_dayFor(_endDate!)} of your batch';
  }

  Future<void> _pickDate({required bool isStart}) async {
    final initial = isStart
        ? (_startDate ?? _minDate)
        : (_endDate ?? _startDate ?? _minDate);
    final firstAllowed = isStart ? _minDate : (_startDate ?? _minDate);
    final picked = await showDatePicker(
      context: context,
      initialDate: initial.isBefore(firstAllowed) ? firstAllowed : initial,
      firstDate: firstAllowed,
      lastDate: _maxDate,
      builder: (context, child) => Theme(
        data: Theme.of(context).copyWith(
          colorScheme: ColorScheme.dark(
            primary: Theme.of(context).colorScheme.primary,
            onPrimary: Colors.white,
            surface: context.tokens.bgSurface,
            onSurface: context.tokens.textPrimary,
          ),
        ),
        child: child ?? const SizedBox.shrink(),
      ),
    );
    if (picked == null) return;
    setState(() {
      if (isStart) {
        _startDate = picked;
        // Mirror the web: if the existing end date is now before the new start,
        // bump it up so the range stays valid without user having to re-pick.
        if (_endDate != null && _endDate!.isBefore(picked)) {
          _endDate = picked;
        }
      } else {
        _endDate = picked;
      }
      _error = null;
    });
  }

  Future<void> _submit() async {
    final start = _startDate;
    final end = _endDate;

    if (widget.batchStartDate == null) {
      setState(() => _error = 'Batch start date is unavailable');
      return;
    }
    if (start == null || end == null) {
      setState(() => _error = 'Please select both dates');
      return;
    }
    final startDay = _dayFor(start);
    final endDay = _dayFor(end);
    if (endDay < startDay) {
      setState(() => _error = 'End date must be on or after start date');
      return;
    }
    if (startDay < 1 || endDay > widget.totalDays) {
      setState(() =>
          _error = 'Days must be within your batch (1–${widget.totalDays})');
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      await ref.read(batchServiceProvider).requestBreak(
            startDay: startDay,
            endDay: endDay,
            reason: _reasonController.text.trim().isEmpty
                ? null
                : _reasonController.text.trim(),
          );
      ref.invalidate(batchProgramProvider);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Break request submitted')),
      );
      Navigator.of(context).pop(true);
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = 'Failed to submit break request';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.viewInsetsOf(context).bottom;
    final canPickDates = widget.batchStartDate != null;

    return Padding(
      padding: EdgeInsets.fromLTRB(16, 20, 16, 20 + bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                'REQUEST BREAK',
                style: TextStyle(
                  fontFamily: 'Rajdhani',
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.5,
                  color: context.tokens.textPrimary,
                ),
              ),
              const Spacer(),
              IconButton(
                icon: Icon(Icons.close, color: context.tokens.textMuted, size: 20),
                onPressed: () => Navigator.of(context).pop(),
              ),
            ],
          ),
          const SizedBox(height: 16),
          if (canPickDates) ...[
            Row(
              children: [
                Expanded(
                  child: _DateField(
                    label: 'START DATE',
                    date: _startDate,
                    onTap: () => _pickDate(isStart: true),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _DateField(
                    label: 'END DATE',
                    date: _endDate,
                    onTap: () => _pickDate(isStart: false),
                  ),
                ),
              ],
            ),
            if (_dayRangeText != null) ...[
              const SizedBox(height: 10),
              Center(
                child: Text(
                  _dayRangeText!,
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.primary,
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ] else
            _NoBatchStartFallback(totalDays: widget.totalDays),
          const SizedBox(height: 14),
          Text(
            'REASON (OPTIONAL)',
            style: TextStyle(
              fontFamily: 'Rajdhani',
              fontSize: 10,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.2,
              color: context.tokens.textMuted,
            ),
          ),
          const SizedBox(height: 6),
          TextField(
            controller: _reasonController,
            maxLines: 3,
            style: TextStyle(color: context.tokens.textPrimary),
            decoration: inputDecorationOf(context, 'Reason for taking a break…'),
          ),
          if (_error != null) ...[
            const SizedBox(height: 10),
            Text(
              _error!,
              style: TextStyle(color: Theme.of(context).colorScheme.primary, fontSize: 12),
            ),
          ],
          const SizedBox(height: AppSpacing.xl),
          AppPrimaryButton(
            label: 'Submit request',
            icon: Icons.send,
            size: AppButtonSize.lg,
            fullWidth: true,
            isLoading: _submitting,
            onPressed: _submitting ||
                    _startDate == null ||
                    _endDate == null ||
                    !canPickDates
                ? null
                : _submit,
          ),
        ],
      ),
    );
  }
}

class _DateField extends StatelessWidget {
  const _DateField({
    required this.label,
    required this.date,
    required this.onTap,
  });

  final String label;
  final DateTime? date;
  final VoidCallback onTap;

  static const _months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

  String get _display {
    if (date == null) return 'Select date';
    return '${_months[date!.month - 1]} ${date!.day}, ${date!.year}';
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: TextStyle(
            fontFamily: 'Rajdhani',
            fontSize: 10,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.2,
            color: context.tokens.textMuted,
          ),
        ),
        const SizedBox(height: 6),
        InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(AppRadius.md),
          child: Container(
            height: 44,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(
              color: context.tokens.bgInput,
              borderRadius: BorderRadius.circular(AppRadius.md),
              border: Border.all(color: context.tokens.borderCard),
            ),
            child: Row(
              children: [
                Icon(Icons.calendar_today_outlined,
                    color: context.tokens.textMuted, size: 14),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    _display,
                    style: TextStyle(
                      color: date == null ? context.tokens.textMuted : context.tokens.textPrimary,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

// Fallback for the rare case where the batch has no `startsAt` (legacy data).
// Shown only to explain why the pickers aren't available; the submit button
// stays disabled so the user isn't blocked with an unusable form.
class _NoBatchStartFallback extends StatelessWidget {
  const _NoBatchStartFallback({required this.totalDays});
  final int totalDays;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: context.tokens.bgInput,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: context.tokens.borderCard),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Break requests unavailable',
            style: TextStyle(
              color: context.tokens.textPrimary,
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Your batch does not have a start date set. Please contact your '
            'admin to enable break requests (batch has $totalDays days).',
            style: TextStyle(color: context.tokens.textMuted, fontSize: 12),
          ),
        ],
      ),
    );
  }
}
