import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/courses_service.dart';

class FeedbackModal extends ConsumerStatefulWidget {
  const FeedbackModal({
    super.key,
    required this.episodeId,
    required this.questions,
    this.episodeType = 'course',
    required this.onDismiss,
  });

  final String episodeId;
  final String episodeType;
  final List<VideoFeedbackQuestion> questions;
  final VoidCallback onDismiss;

  @override
  ConsumerState<FeedbackModal> createState() => _FeedbackModalState();
}

class _FeedbackModalState extends ConsumerState<FeedbackModal> {
  final Map<String, VideoFeedbackResponse> _answers = {};
  bool _submitting = false;
  bool _submitted = false;

  void _setRating(String questionId, int rating) {
    setState(() {
      _answers[questionId] = VideoFeedbackResponse(
        questionId: questionId,
        ratingValue: rating,
      );
    });
  }

  void _setYesNo(String questionId, bool value) {
    setState(() {
      _answers[questionId] = VideoFeedbackResponse(
        questionId: questionId,
        yesNoValue: value,
      );
    });
  }

  Future<void> _submit() async {
    final responses = _answers.values.toList();
    if (responses.isEmpty) {
      widget.onDismiss();
      return;
    }
    setState(() => _submitting = true);
    try {
      await ref.read(coursesServiceProvider).submitVideoFeedback(
            widget.episodeId,
            responses,
            episodeType: widget.episodeType,
          );
      setState(() { _submitting = false; _submitted = true; });
      await Future.delayed(const Duration(milliseconds: 1200));
      if (mounted) widget.onDismiss();
    } catch (_) {
      setState(() => _submitting = false);
      if (mounted) widget.onDismiss();
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final accent = theme.colorScheme.primary;

    return Dialog(
      backgroundColor: const Color(0xFF1A1A1A),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 40),
      child: _submitted ? _buildSuccess() : _buildContent(theme, accent),
    );
  }

  Widget _buildSuccess() => Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: Colors.green.shade700,
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.thumb_up_rounded, color: Colors.white, size: 26),
            ),
            const SizedBox(height: 16),
            const Text(
              'Thanks for your feedback!',
              style: TextStyle(
                color: Colors.white,
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      );

  Widget _buildContent(ThemeData theme, Color accent) {
    final allAnswered = widget.questions.every((q) => _answers.containsKey(q.id));

    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Text(
                'Quick feedback',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const Spacer(),
              GestureDetector(
                onTap: widget.onDismiss,
                child: const Icon(Icons.close, color: Color(0xFF888888), size: 20),
              ),
            ],
          ),
          const SizedBox(height: 20),

          ...widget.questions.map((q) => _buildQuestion(q, accent)),

          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _submitting ? null : _submit,
              style: ElevatedButton.styleFrom(
                backgroundColor: allAnswered ? accent : const Color(0xFF2A2A2A),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: _submitting
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                    )
                  : Text(
                      allAnswered ? 'Submit' : 'Skip',
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildQuestion(VideoFeedbackQuestion q, Color accent) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            q.questionText,
            style: const TextStyle(color: Color(0xFFAAAAAA), fontSize: 13),
          ),
          const SizedBox(height: 10),
          if (q.questionType == 'rating') _buildRatingInput(q, accent)
          else _buildYesNoInput(q, accent),
        ],
      ),
    );
  }

  Widget _buildRatingInput(VideoFeedbackQuestion q, Color accent) {
    final selected = _answers[q.id]?.ratingValue;
    return Wrap(
      spacing: 6,
      runSpacing: 6,
      children: List.generate(10, (i) {
        final n = i + 1;
        final isSelected = selected == n;
        return GestureDetector(
          onTap: () => _setRating(q.id, n),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: isSelected ? accent : const Color(0xFF2A2A2A),
              borderRadius: BorderRadius.circular(8),
              border: isSelected ? null : Border.all(color: const Color(0xFF333333)),
            ),
            alignment: Alignment.center,
            child: Text(
              '$n',
              style: TextStyle(
                color: isSelected ? Colors.white : const Color(0xFF888888),
                fontWeight: FontWeight.bold,
                fontSize: 13,
              ),
            ),
          ),
        );
      }),
    );
  }

  Widget _buildYesNoInput(VideoFeedbackQuestion q, Color accent) {
    final selected = _answers[q.id]?.yesNoValue;
    return Row(
      children: [
        _yesNoButton('Yes', true, selected == true, accent, () => _setYesNo(q.id, true)),
        const SizedBox(width: 10),
        _yesNoButton('No', false, selected == false, accent, () => _setYesNo(q.id, false)),
      ],
    );
  }

  Widget _yesNoButton(String label, bool value, bool isSelected, Color accent, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 10),
        decoration: BoxDecoration(
          color: isSelected ? accent : const Color(0xFF2A2A2A),
          borderRadius: BorderRadius.circular(12),
          border: isSelected ? null : Border.all(color: const Color(0xFF333333)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              value ? Icons.thumb_up_rounded : Icons.thumb_down_rounded,
              size: 16,
              color: isSelected ? Colors.white : const Color(0xFF888888),
            ),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                color: isSelected ? Colors.white : const Color(0xFF888888),
                fontWeight: FontWeight.bold,
                fontSize: 14,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
