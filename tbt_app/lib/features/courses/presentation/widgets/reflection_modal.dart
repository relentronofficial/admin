import 'package:flutter/material.dart';

import '../../../../config/ui_strings.dart';
import '../../../../shared/theme/design_constants.dart';

class ReflectionModal extends StatefulWidget {
  const ReflectionModal({
    super.key,
    required this.lessonTitle,
    required this.uiStrings,
    required this.onSave,
    required this.onSkip,
  });

  final String lessonTitle;
  final UiStrings uiStrings;
  final void Function(String text) onSave;
  final VoidCallback onSkip;

  @override
  State<ReflectionModal> createState() => _ReflectionModalState();
}

class _ReflectionModalState extends State<ReflectionModal> {
  final _controller = TextEditingController();
  bool _saved = false;

  String get _prompt {
    final prefix = widget.uiStrings.reflectPromptPrefix ?? 'What did you learn from';
    final suffix = widget.uiStrings.reflectPromptSuffix ?? '?';
    return '$prefix "${widget.lessonTitle}"$suffix';
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _save() {
    final text = _controller.text.trim();
    if (text.isEmpty) return;
    setState(() => _saved = true);
    widget.onSave(text);
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.uiStrings;
    return Dialog(
      backgroundColor: kColorBgSurface,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 48),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 24, 20, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              s.reflectTitle ?? 'Your Reflection',
              style: const TextStyle(
                color: kColorTextPrimary,
                fontFamily: 'Rajdhani',
                fontSize: 18,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 10),
            Text(
              _prompt,
              style: const TextStyle(
                color: kColorTextSecondary,
                fontSize: 13,
                height: 1.45,
              ),
            ),
            const SizedBox(height: 14),
            TextField(
              controller: _controller,
              maxLines: 4,
              style: const TextStyle(color: kColorTextPrimary, fontSize: 13),
              decoration: InputDecoration(
                hintText: s.reflectPlaceholder ?? 'Write your reflection…',
                hintStyle: const TextStyle(
                  color: kColorTextMuted,
                  fontSize: 13,
                ),
                filled: true,
                fillColor: kColorBgInput,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: const BorderSide(color: kColorBorderCard),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: const BorderSide(color: kColorBorderCard),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: const BorderSide(color: kColorAccent),
                ),
                contentPadding: const EdgeInsets.symmetric(
                    horizontal: 12, vertical: 10),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: TextButton(
                    onPressed: widget.onSkip,
                    child: Text(
                      s.reflectSkipLabel ?? 'Skip',
                      style: const TextStyle(
                        color: kColorTextMuted,
                        fontSize: 13,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: ElevatedButton(
                    onPressed: _saved ? null : _save,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: kColorAccent,
                      disabledBackgroundColor: Colors.green,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                    child: Text(
                      _saved
                          ? (s.reflectSavedLabel ?? 'Saved ✓')
                          : (s.reflectSaveLabel ?? 'Save'),
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                        fontSize: 14,
                      ),
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
