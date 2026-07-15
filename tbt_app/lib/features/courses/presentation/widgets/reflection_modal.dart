import 'package:flutter/material.dart';

import '../../../../config/ui_strings.dart';

import '../../../../shared/theme/theme_tokens.dart';
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
      backgroundColor: context.tokens.bgSurface,
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
              style: TextStyle(
                color: context.tokens.textPrimary,
                fontFamily: 'Rajdhani',
                fontSize: 18,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 10),
            Text(
              _prompt,
              style: TextStyle(
                color: context.tokens.textSecondary,
                fontSize: 13,
                height: 1.45,
              ),
            ),
            const SizedBox(height: 14),
            TextField(
              controller: _controller,
              maxLines: 4,
              style: TextStyle(color: context.tokens.textPrimary, fontSize: 13),
              decoration: InputDecoration(
                hintText: s.reflectPlaceholder ?? 'Write your reflection…',
                hintStyle: TextStyle(
                  color: context.tokens.textMuted,
                  fontSize: 13,
                ),
                filled: true,
                fillColor: context.tokens.bgInput,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: BorderSide(color: context.tokens.borderCard),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: BorderSide(color: context.tokens.borderCard),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: BorderSide(color: Theme.of(context).colorScheme.primary),
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
                      style: TextStyle(
                        color: context.tokens.textMuted,
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
                      backgroundColor: Theme.of(context).colorScheme.primary,
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
