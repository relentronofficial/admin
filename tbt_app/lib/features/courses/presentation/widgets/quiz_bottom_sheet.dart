import 'package:flutter/material.dart';

import '../../../../shared/theme/design_constants.dart';

/// Shown at `quizUnlockPercent` of video watched.
/// Not dismissible — user must submit or the video has already ended.
class QuizBottomSheet extends StatefulWidget {
  const QuizBottomSheet({
    super.key,
    required this.questions,
    required this.passingScore,
    required this.onSubmit,
  });

  final List<Map<String, dynamic>> questions;
  /// 0–100 percent required to pass.
  final int passingScore;
  final Future<Map<String, dynamic>> Function(List<Map<String, dynamic>> answers) onSubmit;

  @override
  State<QuizBottomSheet> createState() => _QuizBottomSheetState();
}

class _QuizBottomSheetState extends State<QuizBottomSheet> {
  // questionIndex → selected optionId
  final Map<int, String> _selected = {};
  bool _submitting = false;
  Map<String, dynamic>? _result;

  List<Map<String, dynamic>> get _questions =>
      widget.questions.cast<Map<String, dynamic>>();

  bool get _allAnswered => _selected.length == _questions.length;

  Future<void> _submit() async {
    if (!_allAnswered || _submitting) return;
    setState(() => _submitting = true);
    try {
      final answers = _questions.asMap().entries.map((e) {
        return {'questionId': e.value['id'], 'answerId': _selected[e.key]};
      }).toList();
      final result = await widget.onSubmit(answers);
      if (mounted) setState(() => _result = result);
    } catch (_) {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      child: Container(
        decoration: const BoxDecoration(
          color: kColorBgSurface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
        ),
        child: _result != null ? _buildResult() : _buildQuiz(),
      ),
    );
  }

  Widget _buildQuiz() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        _handle(),
        Flexible(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'QUIZ',
                  style: TextStyle(
                    color: kColorAccent,
                    fontFamily: 'Rajdhani',
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.5,
                  ),
                ),
                const SizedBox(height: 16),
                ..._questions.asMap().entries.map((e) =>
                    _buildQuestion(e.key, e.value)),
                const SizedBox(height: 20),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _allAnswered && !_submitting ? _submit : null,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: kColorAccent,
                      disabledBackgroundColor: kColorBgInput,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                    child: _submitting
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              color: Colors.white,
                              strokeWidth: 2,
                            ),
                          )
                        : const Text(
                            'Submit',
                            style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w700,
                              fontSize: 15,
                            ),
                          ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildQuestion(int idx, Map<String, dynamic> q) {
    final options = (q['options'] as List<dynamic>? ?? [])
        .cast<Map<String, dynamic>>();
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '${idx + 1}. ${q['question'] as String? ?? ''}',
            style: const TextStyle(
              color: kColorTextPrimary,
              fontSize: 14,
              fontWeight: FontWeight.w600,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 10),
          ...options.map((opt) {
            final optId = opt['id'] as String? ?? '';
            final optText = opt['text'] as String? ?? '';
            final isSelected = _selected[idx] == optId;
            return Semantics(
              label: optText,
              selected: isSelected,
              button: true,
              child: GestureDetector(
              onTap: () => setState(() => _selected[idx] = optId),
              child: Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.symmetric(
                    horizontal: 14, vertical: 11),
                decoration: BoxDecoration(
                  color: isSelected
                      ? kColorAccent.withValues(alpha: 0.15)
                      : kColorBgInput,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: isSelected ? kColorAccent : kColorBorderCard,
                  ),
                ),
                child: Row(
                  children: [
                    Icon(
                      isSelected
                          ? Icons.radio_button_checked
                          : Icons.radio_button_unchecked,
                      color: isSelected
                          ? kColorAccent
                          : kColorTextMuted,
                      size: 18,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        optText,
                        style: TextStyle(
                          color: isSelected
                              ? kColorTextPrimary
                              : kColorTextSecondary,
                          fontSize: 13,
                          height: 1.4,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _buildResult() {
    final passed = _result?['passed'] as bool? ?? false;
    final score = _result?['score'] as int? ?? 0;
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 16, 24, 40),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          _handle(),
          const SizedBox(height: 16),
          Icon(
            passed ? Icons.check_circle : Icons.cancel,
            color: passed ? Colors.green : Colors.redAccent,
            size: 52,
          ),
          const SizedBox(height: 14),
          Text(
            passed ? 'Great work!' : 'Not quite',
            style: const TextStyle(
              color: kColorTextPrimary,
              fontFamily: 'Rajdhani',
              fontSize: 22,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Score: $score%',
            style: const TextStyle(
              color: kColorTextSecondary,
              fontSize: 14,
            ),
          ),
          if (!passed) ...[
            const SizedBox(height: 6),
            Text(
              'Required: ${widget.passingScore}%',
              style: const TextStyle(
                color: kColorTextMuted,
                fontSize: 13,
              ),
            ),
          ],
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () => Navigator.of(context).pop(),
              style: ElevatedButton.styleFrom(
                backgroundColor: kColorAccent,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              child: const Text(
                'Continue',
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                  fontSize: 15,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _handle() => Center(
        child: Container(
          margin: const EdgeInsets.symmetric(vertical: 10),
          width: 36,
          height: 4,
          decoration: BoxDecoration(
            color: kColorBorderCard,
            borderRadius: BorderRadius.circular(2),
          ),
        ),
      );
}

/// Shown mid-video at cue `atSeconds`.
/// Dismissible — user can skip; on dismiss, video resumes.
class CueQuizBottomSheet extends StatefulWidget {
  const CueQuizBottomSheet({
    super.key,
    required this.questions,
    required this.onDismiss,
  });

  final List<Map<String, dynamic>> questions;
  final VoidCallback onDismiss;

  @override
  State<CueQuizBottomSheet> createState() => _CueQuizBottomSheetState();
}

class _CueQuizBottomSheetState extends State<CueQuizBottomSheet> {
  final Map<int, String> _selected = {};

  List<Map<String, dynamic>> get _questions =>
      widget.questions.cast<Map<String, dynamic>>();

  bool get _allAnswered => _selected.length == _questions.length;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: kColorBgSurface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          _handle(),
          Flexible(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Text(
                        'QUICK CHECK',
                        style: TextStyle(
                          color: kColorAccent,
                          fontFamily: 'Rajdhani',
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 1.5,
                        ),
                      ),
                      const Spacer(),
                      TextButton(
                        onPressed: widget.onDismiss,
                        child: const Text(
                          'Skip',
                          style: TextStyle(
                            color: kColorTextMuted,
                            fontSize: 13,
                          ),
                        ),
                      ),
                    ],
                  ),
                  ..._questions.asMap().entries.map((e) =>
                      _buildQuestion(e.key, e.value)),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: _allAnswered ? widget.onDismiss : null,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: kColorAccent,
                        disabledBackgroundColor: kColorBgInput,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8),
                        ),
                      ),
                      child: const Text(
                        'Done',
                        style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w700,
                          fontSize: 15,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildQuestion(int idx, Map<String, dynamic> q) {
    final options = (q['options'] as List<dynamic>? ?? [])
        .cast<Map<String, dynamic>>();
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            q['question'] as String? ?? '',
            style: const TextStyle(
              color: kColorTextPrimary,
              fontSize: 14,
              fontWeight: FontWeight.w600,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 8),
          ...options.map((opt) {
            final optId = opt['id'] as String? ?? '';
            final optText = opt['text'] as String? ?? '';
            final isSelected = _selected[idx] == optId;
            return Semantics(
              label: optText,
              selected: isSelected,
              button: true,
              child: GestureDetector(
              onTap: () => setState(() => _selected[idx] = optId),
              child: Container(
                margin: const EdgeInsets.only(bottom: 6),
                padding: const EdgeInsets.symmetric(
                    horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                  color: isSelected
                      ? kColorAccent.withValues(alpha: 0.15)
                      : kColorBgInput,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: isSelected ? kColorAccent : kColorBorderCard,
                  ),
                ),
                child: Text(
                  optText,
                  style: TextStyle(
                    color: isSelected
                        ? kColorTextPrimary
                        : kColorTextSecondary,
                    fontSize: 13,
                  ),
                ),
              ),
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _handle() => Center(
        child: Container(
          margin: const EdgeInsets.symmetric(vertical: 10),
          width: 36,
          height: 4,
          decoration: BoxDecoration(
            color: kColorBorderCard,
            borderRadius: BorderRadius.circular(2),
          ),
        ),
      );
}
