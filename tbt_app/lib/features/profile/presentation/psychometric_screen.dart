import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../features/courses/data/courses_service.dart';
import '../../../features/courses/providers/courses_provider.dart';
import '../../../shared/theme/theme_tokens.dart';

// ── Category color palette ────────────────────────────────────────────────────
Color _categoryColor(String name) {
  switch (name.toLowerCase()) {
    case 'vision':
      return const Color(0xFF3B82F6);
    case 'execution':
      return const Color(0xFFF59E0B);
    case 'leadership':
      return const Color(0xFF8B5CF6);
    case 'innovation':
      return const Color(0xFF10B981);
    case 'resilience':
      return const Color(0xFFEF4444);
    default:
      return const Color(0xFFD30814);
  }
}

class PsychometricScreen extends ConsumerStatefulWidget {
  const PsychometricScreen({super.key});

  @override
  ConsumerState<PsychometricScreen> createState() =>
      _PsychometricScreenState();
}

class _PsychometricScreenState extends ConsumerState<PsychometricScreen> {
  static const _accent = Color(0xFFD30814);

  final Map<String, String> _answers = {};
  bool _submitting = false;
  // When true the user is re-taking; ignore the existing result.
  bool _retaking = false;

  Future<void> _submit(List<PsychometricQuestion> questions) async {
    if (_answers.length < questions.length) return;
    setState(() => _submitting = true);
    try {
      await ref.read(coursesServiceProvider).submitPsychometric(_answers);
      ref.invalidate(psychometricResultProvider);
      if (mounted) setState(() { _retaking = false; });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Submission failed — $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final tokens = context.tokens;

    return Scaffold(
      backgroundColor: tokens.bgPage,
      appBar: AppBar(
        backgroundColor: tokens.bgSurface,
        elevation: 0,
        leading: IconButton(
          icon: Icon(Icons.arrow_back, color: tokens.textPrimary),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Text(
          'Business Assessment',
          style: TextStyle(
            color: tokens.textPrimary,
            fontFamily: 'Rajdhani',
            fontSize: 18,
            fontWeight: FontWeight.w700,
            letterSpacing: 1,
          ),
        ),
      ),
      body: _buildBody(isDark, tokens),
    );
  }

  Widget _buildBody(bool isDark, ThemeTokens tokens) {
    final resultAsync = ref.watch(psychometricResultProvider);

    return resultAsync.when(
      loading: () => const Center(
        child: CircularProgressIndicator(color: Color(0xFFD30814)),
      ),
      error: (e, _) => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.error_outline, color: tokens.textMuted, size: 40),
            const SizedBox(height: 12),
            Text('Failed to load', style: TextStyle(color: tokens.textSecondary)),
            const SizedBox(height: 12),
            TextButton(
              onPressed: () => ref.invalidate(psychometricResultProvider),
              child: const Text('Retry', style: TextStyle(color: Color(0xFFD30814))),
            ),
          ],
        ),
      ),
      data: (result) {
        if (result != null && !_retaking) {
          return _buildResults(result, isDark, tokens);
        }
        return _buildQuestionnaire(isDark, tokens);
      },
    );
  }

  // ── Results view ─────────────────────────────────────────────────────────────

  Widget _buildResults(
      PsychometricResponse result, bool isDark, ThemeTokens tokens) {
    final r = result.results;
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 40),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Overall banner
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFFD30814), Color(0xFFFF5E62)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFFD30814).withValues(alpha: 0.35),
                  blurRadius: 16,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: Column(
              children: [
                const Icon(Icons.psychology_alt_rounded,
                    color: Colors.white, size: 40),
                const SizedBox(height: 10),
                Text(
                  r.overallLabel,
                  style: const TextStyle(
                    color: Colors.white,
                    fontFamily: 'Rajdhani',
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '${r.overallPercentage}% overall score',
                  style: const TextStyle(
                    color: Colors.white70,
                    fontSize: 14,
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 24),

          // Category bars
          Text(
            'CATEGORY BREAKDOWN',
            style: TextStyle(
              fontFamily: 'Rajdhani',
              fontSize: 11,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.8,
              color: tokens.textMuted,
            ),
          ),
          const SizedBox(height: 14),

          for (final cat in r.categories) ...[
            _CategoryBar(category: cat, isDark: isDark, tokens: tokens),
            const SizedBox(height: 16),
          ],

          // Recommendation
          if (r.recommendation.isNotEmpty) ...[
            const SizedBox(height: 8),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: isDark
                    ? const Color(0xFF1A1A1C)
                    : const Color(0xFFF5F5F5),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: tokens.borderCard),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.lightbulb_outline_rounded,
                          color: Color(0xFFF59E0B), size: 18),
                      const SizedBox(width: 8),
                      Text(
                        'Recommendation',
                        style: TextStyle(
                          color: tokens.textPrimary,
                          fontFamily: 'Rajdhani',
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.3,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Text(
                    r.recommendation,
                    style: TextStyle(
                      color: tokens.textSecondary,
                      fontSize: 14,
                      height: 1.55,
                    ),
                  ),
                ],
              ),
            ),
          ],

          const SizedBox(height: 28),

          // Retake button
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () {
                setState(() {
                  _answers.clear();
                  _retaking = true;
                });
              },
              style: OutlinedButton.styleFrom(
                foregroundColor: _accent,
                side: const BorderSide(color: Color(0xFFD30814)),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
              icon: const Icon(Icons.refresh_rounded),
              label: const Text(
                'Retake Assessment',
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ── Questionnaire view ────────────────────────────────────────────────────────

  Widget _buildQuestionnaire(bool isDark, ThemeTokens tokens) {
    final questionsAsync = ref.watch(psychometricQuestionsProvider);
    return questionsAsync.when(
      loading: () => const Center(
        child: CircularProgressIndicator(color: Color(0xFFD30814)),
      ),
      error: (e, _) => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.error_outline, color: tokens.textMuted, size: 40),
            const SizedBox(height: 12),
            Text('Failed to load questions',
                style: TextStyle(color: tokens.textSecondary)),
            const SizedBox(height: 12),
            TextButton(
              onPressed: () => ref.invalidate(psychometricQuestionsProvider),
              child: const Text('Retry', style: TextStyle(color: Color(0xFFD30814))),
            ),
          ],
        ),
      ),
      data: (questions) {
        if (questions.isEmpty) {
          return Center(
            child: Text('No questions available.',
                style: TextStyle(color: tokens.textSecondary)),
          );
        }

        final answered = _answers.length;
        final total = questions.length;
        final allAnswered = answered == total;

        return Column(
          children: [
            // Progress bar
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
              child: Row(
                children: [
                  Expanded(
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(
                        value: total > 0 ? answered / total : 0,
                        minHeight: 6,
                        backgroundColor: tokens.borderCard,
                        valueColor: const AlwaysStoppedAnimation(_accent),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Text(
                    '$answered of $total answered',
                    style: TextStyle(
                        color: tokens.textMuted,
                        fontSize: 11,
                        fontWeight: FontWeight.w600),
                  ),
                ],
              ),
            ),

            // Questions list
            Expanded(
              child: ListView.separated(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                itemCount: questions.length,
                separatorBuilder: (_, __) => const SizedBox(height: 14),
                itemBuilder: (ctx, i) => _QuestionCard(
                  question: questions[i],
                  selectedOptionId: _answers[questions[i].id],
                  isDark: isDark,
                  tokens: tokens,
                  onSelect: (optId) {
                    setState(() => _answers[questions[i].id] = optId);
                  },
                ),
              ),
            ),

            // Submit button
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
              child: SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: allAnswered && !_submitting
                      ? () => _submit(questions)
                      : null,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _accent,
                    disabledBackgroundColor:
                        isDark ? const Color(0xFF2A2A2A) : const Color(0xFFE0E0E0),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                  child: _submitting
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                              strokeWidth: 2.5, color: Colors.white),
                        )
                      : Text(
                          allAnswered
                              ? 'Submit Assessment'
                              : 'Answer all questions to submit',
                          style: const TextStyle(
                              fontSize: 15, fontWeight: FontWeight.w700),
                        ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}

// ── Question card ─────────────────────────────────────────────────────────────

class _QuestionCard extends StatelessWidget {
  const _QuestionCard({
    required this.question,
    required this.selectedOptionId,
    required this.isDark,
    required this.tokens,
    required this.onSelect,
  });

  final PsychometricQuestion question;
  final String? selectedOptionId;
  final bool isDark;
  final ThemeTokens tokens;
  final ValueChanged<String> onSelect;

  @override
  Widget build(BuildContext context) {
    final catColor = _categoryColor(question.category);
    return Container(
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF141416) : Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: tokens.borderCard),
        boxShadow: isDark
            ? const [
                BoxShadow(
                    color: Color(0xAA000000),
                    blurRadius: 8,
                    offset: Offset(0, 4))
              ]
            : [
                BoxShadow(
                    color: const Color(0xFF8E8EA0).withValues(alpha: 0.20),
                    blurRadius: 8,
                    offset: const Offset(0, 4))
              ],
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Category label
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: catColor.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              question.category.toUpperCase(),
              style: TextStyle(
                color: catColor,
                fontSize: 10,
                fontWeight: FontWeight.w800,
                letterSpacing: 1,
                fontFamily: 'Rajdhani',
              ),
            ),
          ),
          const SizedBox(height: 10),
          // Question text
          Text(
            question.questionText,
            style: TextStyle(
              color: tokens.textPrimary,
              fontSize: 14,
              fontWeight: FontWeight.w600,
              height: 1.45,
            ),
          ),
          const SizedBox(height: 14),
          // Option buttons
          ...question.options.map(
            (opt) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: _OptionButton(
                option: opt,
                selected: selectedOptionId == opt.id,
                tokens: tokens,
                isDark: isDark,
                onTap: () => onSelect(opt.id),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Option button ─────────────────────────────────────────────────────────────

class _OptionButton extends StatelessWidget {
  const _OptionButton({
    required this.option,
    required this.selected,
    required this.tokens,
    required this.isDark,
    required this.onTap,
  });

  final PsychometricOption option;
  final bool selected;
  final ThemeTokens tokens;
  final bool isDark;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    const accent = Color(0xFFD30814);
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: selected
              ? accent.withValues(alpha: 0.10)
              : (isDark ? const Color(0xFF0F0F11) : const Color(0xFFF7F7F7)),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: selected ? accent : tokens.borderCard,
            width: selected ? 1.5 : 1,
          ),
        ),
        child: Row(
          children: [
            AnimatedContainer(
              duration: const Duration(milliseconds: 150),
              width: 18,
              height: 18,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: selected ? accent : Colors.transparent,
                border: Border.all(
                  color: selected ? accent : tokens.textMuted,
                  width: 1.5,
                ),
              ),
              child: selected
                  ? const Icon(Icons.check, size: 11, color: Colors.white)
                  : null,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                option.text,
                style: TextStyle(
                  color: selected ? accent : tokens.textPrimary,
                  fontSize: 13,
                  fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
                  height: 1.4,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Category bar ──────────────────────────────────────────────────────────────

class _CategoryBar extends StatelessWidget {
  const _CategoryBar({
    required this.category,
    required this.isDark,
    required this.tokens,
  });

  final PsychometricCategoryResult category;
  final bool isDark;
  final ThemeTokens tokens;

  @override
  Widget build(BuildContext context) {
    final color = _categoryColor(category.name);
    final pct = (category.percentage.clamp(0, 100)) / 100.0;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                category.name,
                style: TextStyle(
                  color: tokens.textPrimary,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                category.label,
                style: TextStyle(
                  color: color,
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            const SizedBox(width: 8),
            Text(
              '${category.percentage}%',
              style: TextStyle(
                color: color,
                fontSize: 13,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: pct,
            minHeight: 8,
            backgroundColor: isDark
                ? const Color(0xFF2A2A2A)
                : const Color(0xFFE5E5EA),
            valueColor: AlwaysStoppedAnimation(color),
          ),
        ),
        const SizedBox(height: 3),
        Text(
          '${category.score} / ${category.max} points',
          style: TextStyle(color: tokens.textMuted, fontSize: 10),
        ),
      ],
    );
  }
}
