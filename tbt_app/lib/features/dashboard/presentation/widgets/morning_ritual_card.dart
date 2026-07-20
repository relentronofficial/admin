import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../shared/theme/design_constants.dart';
import '../../../../shared/theme/theme_tokens.dart';
import '../../data/rituals_service.dart';

/// Morning Ritual home-page card — ports the co-worker's home widget.
///
/// Shows the current day's habit question with Yes / Not-Yet buttons.
/// After answering, advances to the next habit until all 5 (or however
/// many the admin configured) are done. Answers are client-side only —
/// they reset overnight (or on app restart — MVP behaviour).
class MorningRitualCard extends ConsumerStatefulWidget {
  const MorningRitualCard({super.key});

  @override
  ConsumerState<MorningRitualCard> createState() => _MorningRitualCardState();
}

class _MorningRitualCardState extends ConsumerState<MorningRitualCard> {
  int _currentStep = 0;
  final Map<int, bool> _answers = {}; // 1 = yes, 0 = not-yet
  bool _dismissed = false;

  @override
  Widget build(BuildContext context) {
    if (_dismissed) return const SizedBox.shrink();
    final tokens = context.tokens;
    final habitsAsync = ref.watch(habitsProvider);
    final buttonsAsync = ref.watch(buttonsConfigProvider);

    return habitsAsync.when(
      loading: () => const SizedBox.shrink(),
      error: (_, __) => const SizedBox.shrink(),
      data: (habits) {
        if (habits.isEmpty) return const SizedBox.shrink();
        final total = habits.length;
        final isComplete = _currentStep >= total;
        final currentHabit = isComplete ? null : habits[_currentStep];
        final buttons = buttonsAsync.valueOrNull ??
            const ButtonsConfig(yesLabel: 'Yes', notYetLabel: 'Not Yet');

        return Container(
          margin: const EdgeInsets.fromLTRB(16, 12, 16, 4),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                const Color(0xFFf59e0b).withValues(alpha: 0.15),
                kColorAccent.withValues(alpha: 0.10),
                Colors.transparent,
              ],
            ),
            border: Border.all(
              color: const Color(0xFFf59e0b).withValues(alpha: 0.30),
            ),
          ),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header row: title + step indicator + close
              Row(
                children: [
                  Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFFfacc15), Color(0xFFf59e0b)],
                      ),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Icon(Icons.wb_sunny, color: Colors.white, size: 16),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'MORNING RITUAL',
                          style: TextStyle(
                            fontFamily: 'Rajdhani',
                            color: tokens.textPrimary,
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 2,
                          ),
                        ),
                        Text(
                          isComplete
                              ? 'Complete for today ✓'
                              : 'Step ${_currentStep + 1} of $total',
                          style: TextStyle(color: tokens.textMuted, fontSize: 10),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: Icon(Icons.close, size: 18, color: tokens.textMuted),
                    onPressed: () => setState(() => _dismissed = true),
                    tooltip: 'Hide for now',
                  ),
                ],
              ),
              const SizedBox(height: 14),

              // Progress bar
              ClipRRect(
                borderRadius: BorderRadius.circular(3),
                child: LinearProgressIndicator(
                  value: total == 0 ? 0 : _currentStep / total,
                  minHeight: 4,
                  backgroundColor: tokens.borderCard,
                  color: const Color(0xFFfacc15),
                ),
              ),

              if (isComplete) ...[
                const SizedBox(height: 16),
                _CompleteView(answers: _answers, total: total),
              ] else ...[
                const SizedBox(height: 16),
                _HabitPrompt(habit: currentHabit!),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: _AnswerButton(
                        label: buttons.notYetLabel,
                        primary: false,
                        onTap: () {
                          setState(() {
                            _answers[_currentStep] = false;
                            _currentStep += 1;
                          });
                        },
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _AnswerButton(
                        label: buttons.yesLabel,
                        primary: true,
                        onTap: () {
                          setState(() {
                            _answers[_currentStep] = true;
                            _currentStep += 1;
                          });
                        },
                      ),
                    ),
                  ],
                ),
              ],
            ],
          ),
        );
      },
    );
  }
}

class _HabitPrompt extends StatelessWidget {
  const _HabitPrompt({required this.habit});
  final Habit habit;
  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    // Highlight the highlight_word inside rawQuestion by wrapping it in
    // an accent-colored TextSpan. Case-insensitive first match.
    final q = habit.rawQuestion;
    final hw = habit.highlightWord;
    List<InlineSpan> spans;
    if (hw.isEmpty) {
      spans = [TextSpan(text: q)];
    } else {
      final lower = q.toLowerCase();
      final idx = lower.indexOf(hw.toLowerCase());
      if (idx < 0) {
        spans = [TextSpan(text: q)];
      } else {
        spans = [
          TextSpan(text: q.substring(0, idx)),
          TextSpan(
            text: q.substring(idx, idx + hw.length),
            style: const TextStyle(color: Color(0xFFfacc15), fontWeight: FontWeight.w800),
          ),
          TextSpan(text: q.substring(idx + hw.length)),
        ];
      }
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        RichText(
          text: TextSpan(
            style: TextStyle(
              color: tokens.textPrimary,
              fontSize: 17,
              fontWeight: FontWeight.w700,
              height: 1.3,
            ),
            children: spans,
          ),
        ),
        if (habit.subtitle.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text(
              habit.subtitle,
              style: TextStyle(color: tokens.textSecondary, fontSize: 12, height: 1.4),
            ),
          ),
      ],
    );
  }
}

class _AnswerButton extends StatelessWidget {
  const _AnswerButton({required this.label, required this.primary, required this.onTap});
  final String label;
  final bool primary;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        height: 42,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: primary ? const Color(0xFFfacc15) : tokens.bgSurface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: primary ? const Color(0xFFfacc15) : tokens.borderCard,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: primary ? Colors.black : tokens.textPrimary,
            fontSize: 13,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.3,
          ),
        ),
      ),
    );
  }
}

class _CompleteView extends StatelessWidget {
  const _CompleteView({required this.answers, required this.total});
  final Map<int, bool> answers;
  final int total;
  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final yesCount = answers.values.where((v) => v).length;
    return Row(
      children: [
        const Icon(Icons.check_circle_rounded, color: Color(0xFF4ade80), size: 22),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            '$yesCount of $total done today. Keep it up.',
            style: TextStyle(color: tokens.textPrimary, fontSize: 13, fontWeight: FontWeight.w600),
          ),
        ),
      ],
    );
  }
}
