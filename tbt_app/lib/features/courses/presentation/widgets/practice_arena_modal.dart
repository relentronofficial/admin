import 'dart:math';

import 'package:flutter/material.dart';


import '../../../../shared/theme/theme_tokens.dart';
/// Client-only retrieval-practice mode. Shuffles quiz questions collected
/// across every lesson in the course and lets the user answer them
/// interleaved. No backend call, no XP — pure practice.
///
/// Each question shape (from the backend course detail response):
/// ```
/// { id, question, options: [{ id, text, correct }], _lessonTitle }
/// ```
class PracticeArenaModal extends StatefulWidget {
  const PracticeArenaModal({
    super.key,
    required this.questions,
    required this.accent,
  });

  final List<Map<String, dynamic>> questions;
  final Color accent;

  @override
  State<PracticeArenaModal> createState() => _PracticeArenaModalState();
}

class _PracticeArenaModalState extends State<PracticeArenaModal> {
  late final List<Map<String, dynamic>> _deck;
  int _index = 0;
  String? _pickedOptionId;
  int _correctCount = 0;
  int _answered = 0;

  @override
  void initState() {
    super.initState();
    _deck = [...widget.questions]..shuffle(Random());
  }

  Map<String, dynamic> get _current => _deck[_index];

  List<Map<String, dynamic>> get _options =>
      ((_current['options'] as List<dynamic>? ?? []))
          .cast<Map<String, dynamic>>();

  String get _correctOptionId {
    for (final o in _options) {
      if (o['correct'] == true) return o['id'] as String? ?? '';
    }
    return '';
  }

  void _pick(String optionId) {
    if (_pickedOptionId != null) return;
    setState(() {
      _pickedOptionId = optionId;
      _answered++;
      if (optionId == _correctOptionId) _correctCount++;
    });
  }

  void _next() {
    if (_index + 1 >= _deck.length) {
      Navigator.of(context).pop();
      return;
    }
    setState(() {
      _index++;
      _pickedOptionId = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.85,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      builder: (_, scrollController) => Container(
        decoration: BoxDecoration(
          color: context.tokens.bgSurface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
          border: Border(top: BorderSide(color: context.tokens.borderCard)),
        ),
        child: Column(
          children: [
            _buildGrabHandle(),
            _buildHeader(),
            Expanded(
              child: SingleChildScrollView(
                controller: scrollController,
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                child: _buildQuestion(),
              ),
            ),
            _buildFooter(),
          ],
        ),
      ),
    );
  }

  Widget _buildGrabHandle() => Padding(
        padding: const EdgeInsets.only(top: 8, bottom: 4),
        child: Container(
          width: 40,
          height: 4,
          decoration: BoxDecoration(
            color: context.tokens.textMuted.withValues(alpha: 0.5),
            borderRadius: BorderRadius.circular(2),
          ),
        ),
      );

  Widget _buildHeader() {
    final progress = _deck.isEmpty ? 0.0 : (_index + 1) / _deck.length;
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.psychology_alt, color: widget.accent, size: 18),
              const SizedBox(width: 8),
              Text(
                'PRACTICE ARENA',
                style: TextStyle(
                  fontFamily: 'Rajdhani',
                  color: context.tokens.textPrimary,
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.5,
                ),
              ),
              const Spacer(),
              IconButton(
                iconSize: 20,
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
                icon: Icon(Icons.close, color: context.tokens.textMuted),
                onPressed: () => Navigator.of(context).pop(),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(2),
                  child: LinearProgressIndicator(
                    value: progress,
                    minHeight: 4,
                    backgroundColor: context.tokens.bgInput,
                    valueColor: AlwaysStoppedAnimation(widget.accent),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Text(
                '${_index + 1}/${_deck.length}',
                style: TextStyle(
                  color: context.tokens.textMuted,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildQuestion() {
    final question = _current['question'] as String? ?? '';
    final lessonTitle = _current['_lessonTitle'] as String? ?? '';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (lessonTitle.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Text(
              lessonTitle.toUpperCase(),
              style: TextStyle(
                color: context.tokens.textMuted,
                fontSize: 10,
                fontWeight: FontWeight.w700,
                letterSpacing: 1.2,
              ),
            ),
          ),
        Text(
          question,
          style: TextStyle(
            color: context.tokens.textPrimary,
            fontSize: 17,
            fontWeight: FontWeight.w600,
            height: 1.4,
          ),
        ),
        const SizedBox(height: 20),
        ..._options.map((opt) {
          final optId = opt['id'] as String? ?? '';
          final text = opt['text'] as String? ?? '';
          final picked = _pickedOptionId == optId;
          final isCorrect = optId == _correctOptionId;
          final answered = _pickedOptionId != null;

          Color borderColor = context.tokens.borderCard;
          Color bgColor = context.tokens.bgInput;
          Widget? trailing;
          if (answered) {
            if (isCorrect) {
              borderColor = Colors.green;
              bgColor = Colors.green.withValues(alpha: 0.08);
              trailing = const Icon(Icons.check_circle, color: Colors.green, size: 20);
            } else if (picked) {
              borderColor = Colors.redAccent;
              bgColor = Colors.redAccent.withValues(alpha: 0.08);
              trailing = const Icon(Icons.cancel, color: Colors.redAccent, size: 20);
            }
          } else if (picked) {
            borderColor = widget.accent;
          }

          return Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: InkWell(
              borderRadius: BorderRadius.circular(8),
              onTap: answered ? null : () => _pick(optId),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                decoration: BoxDecoration(
                  color: bgColor,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: borderColor, width: 1.4),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        text,
                        style: TextStyle(
                          color: context.tokens.textPrimary,
                          fontSize: 14,
                          height: 1.4,
                        ),
                      ),
                    ),
                    if (trailing != null) ...[
                      const SizedBox(width: 8),
                      trailing,
                    ],
                  ],
                ),
              ),
            ),
          );
        }),
      ],
    );
  }

  Widget _buildFooter() {
    final answered = _pickedOptionId != null;
    final scoreText = _answered == 0
        ? ''
        : '$_correctCount / $_answered correct';
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
      decoration: BoxDecoration(
        border: Border(top: BorderSide(color: context.tokens.borderCard)),
      ),
      child: Row(
        children: [
          Text(
            scoreText,
            style: TextStyle(
              color: context.tokens.textSecondary,
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
          const Spacer(),
          SizedBox(
            height: 40,
            child: ElevatedButton(
              onPressed: answered ? _next : null,
              style: ElevatedButton.styleFrom(
                backgroundColor: widget.accent,
                foregroundColor: Colors.white,
                disabledBackgroundColor: context.tokens.bgInput,
                disabledForegroundColor: context.tokens.textMuted,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
                padding: const EdgeInsets.symmetric(horizontal: 20),
              ),
              child: Text(
                _index + 1 >= _deck.length ? 'Finish' : 'Next',
                style: const TextStyle(
                  fontFamily: 'Rajdhani',
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.5,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
