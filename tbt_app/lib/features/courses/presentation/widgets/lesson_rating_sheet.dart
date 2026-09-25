import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/courses_service.dart';
import '../../../../shared/theme/theme_tokens.dart';

/// A bottom-sheet that lets the member rate the current lesson 1–10 with
/// optional free-text feedback. Shown after lesson completion.
class LessonRatingSheet extends ConsumerStatefulWidget {
  const LessonRatingSheet({
    super.key,
    required this.courseId,
    required this.lessonId,
    required this.lessonTitle,
    required this.onDone,
  });

  final String courseId;
  final String lessonId;
  final String lessonTitle;
  final VoidCallback onDone;

  @override
  ConsumerState<LessonRatingSheet> createState() => _LessonRatingSheetState();
}

class _LessonRatingSheetState extends ConsumerState<LessonRatingSheet> {
  static const _accent = Color(0xFFD30814);

  int? _rating;
  final _textCtrl = TextEditingController();
  bool _submitting = false;

  @override
  void dispose() {
    _textCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final rating = _rating;
    if (rating == null) return;
    setState(() => _submitting = true);
    try {
      await ref.read(coursesServiceProvider).saveLessonFeedback(
        widget.courseId,
        widget.lessonId,
        rating,
        feedbackText: _textCtrl.text.trim().isEmpty ? null : _textCtrl.text.trim(),
      );
    } catch (_) {
      // Silent — rating failure should not block the user.
    }
    if (mounted) {
      setState(() => _submitting = false);
      widget.onDone();
      Navigator.of(context).pop();
    }
  }

  void _skip() {
    widget.onDone();
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final tokens = context.tokens;
    final bgColor = isDark ? const Color(0xFF141416) : Colors.white;
    final inset = MediaQuery.of(context).viewInsets.bottom;

    return Padding(
      padding: EdgeInsets.only(bottom: inset),
      child: Container(
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius:
              const BorderRadius.vertical(top: Radius.circular(20)),
          border: Border(
            top: BorderSide(color: tokens.borderCard),
          ),
        ),
        padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Handle
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: tokens.textMuted.withValues(alpha: 0.4),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 20),

            // Title
            Text(
              'How was this lesson?',
              style: TextStyle(
                color: tokens.textPrimary,
                fontFamily: 'Rajdhani',
                fontSize: 20,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.3,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              widget.lessonTitle,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(color: tokens.textSecondary, fontSize: 13),
            ),
            const SizedBox(height: 20),

            // 1–10 rating row
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: List.generate(10, (i) {
                final v = i + 1;
                final selected = _rating == v;
                return GestureDetector(
                  onTap: () => setState(() => _rating = v),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 130),
                    width: 28,
                    height: 28,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: selected
                          ? const LinearGradient(
                              colors: [Color(0xFFE50914), Color(0xFFB30710)],
                            )
                          : null,
                      color: selected
                          ? null
                          : (isDark
                              ? const Color(0xFF2A2A2D)
                              : const Color(0xFFF0F0F0)),
                      border: Border.all(
                        color: selected
                            ? _accent
                            : tokens.borderCard,
                        width: selected ? 1.5 : 1,
                      ),
                      boxShadow: selected
                          ? [
                              BoxShadow(
                                color: _accent.withValues(alpha: 0.35),
                                blurRadius: 6,
                                offset: const Offset(0, 2),
                              ),
                            ]
                          : null,
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      '$v',
                      style: TextStyle(
                        color: selected ? Colors.white : tokens.textSecondary,
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                );
              }),
            ),
            const SizedBox(height: 6),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Not helpful', style: TextStyle(color: tokens.textMuted, fontSize: 10)),
                Text('Very helpful', style: TextStyle(color: tokens.textMuted, fontSize: 10)),
              ],
            ),
            const SizedBox(height: 18),

            // Optional feedback
            TextField(
              controller: _textCtrl,
              style: TextStyle(color: tokens.textPrimary, fontSize: 14),
              maxLines: 3,
              decoration: InputDecoration(
                hintText: 'Share your thoughts (optional)',
                hintStyle: TextStyle(color: tokens.textMuted, fontSize: 13),
                filled: true,
                fillColor: isDark ? const Color(0xFF0F0F11) : const Color(0xFFF5F5F5),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: BorderSide(color: tokens.borderCard),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: BorderSide(color: tokens.borderCard),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: _accent, width: 1.5),
                ),
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              ),
            ),
            const SizedBox(height: 20),

            // Buttons
            Row(
              children: [
                TextButton(
                  onPressed: _submitting ? null : _skip,
                  child: Text(
                    'Skip',
                    style: TextStyle(color: tokens.textMuted, fontSize: 14),
                  ),
                ),
                const Spacer(),
                SizedBox(
                  height: 44,
                  child: ElevatedButton(
                    onPressed: _rating != null && !_submitting ? _submit : null,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: _accent,
                      disabledBackgroundColor:
                          isDark ? const Color(0xFF2A2A2A) : const Color(0xFFE0E0E0),
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                      padding: const EdgeInsets.symmetric(horizontal: 24),
                    ),
                    child: _submitting
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                                strokeWidth: 2, color: Colors.white),
                          )
                        : const Text(
                            'Submit',
                            style: TextStyle(
                                fontSize: 14, fontWeight: FontWeight.w700),
                          ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
