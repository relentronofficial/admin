import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../shared/theme/design_constants.dart';
import '../../data/workshops_service.dart';

/// Renders the completion UI for a single challenge based on its
/// backend-declared `type`. All 5 types funnel to
/// [WorkshopsService.completeChallenge] with a type-appropriate
/// `answersData` payload (or none for `watch`).
///
/// Challenge shapes (raw JSON from `/api/user/workshops/:slug/challenges`):
/// * `watch`     → `quizData` is null; just mark complete
/// * `quiz`      → `{ questions: [{ id, question, options: [{ id, text, correct }] }] }`
/// * `written`   → `{ prompt, placeholder? }`
/// * `matching`  → `{ pairs: [{ id, left, right }] }`
/// * `flashcard` → `{ cards: [{ id, front, back }] }`
class ChallengeCompletionSheet extends ConsumerStatefulWidget {
  const ChallengeCompletionSheet({
    super.key,
    required this.slug,
    required this.challengeId,
    required this.accent,
  });

  final String slug;
  final String challengeId;
  final Color accent;

  @override
  ConsumerState<ChallengeCompletionSheet> createState() =>
      _ChallengeCompletionSheetState();
}

class _ChallengeCompletionSheetState
    extends ConsumerState<ChallengeCompletionSheet> {
  Map<String, dynamic>? _challenge;
  bool _loading = true;
  String? _error;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final all = await ref
          .read(workshopsServiceProvider)
          .getWorkshopChallenges(widget.slug);
      if (!mounted) return;
      final match = all.firstWhere(
        (c) => c['id'] == widget.challengeId,
        orElse: () => <String, dynamic>{},
      );
      if (match.isEmpty) {
        setState(() {
          _error = 'Challenge not found';
          _loading = false;
        });
        return;
      }
      setState(() {
        _challenge = match;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _submit(Map<String, dynamic>? answersData) async {
    if (_submitting) return;
    setState(() => _submitting = true);
    try {
      await ref
          .read(workshopsServiceProvider)
          .completeChallenge(widget.challengeId, answersData: answersData);
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not submit challenge')),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.85,
      maxChildSize: 0.95,
      minChildSize: 0.5,
      builder: (_, scrollController) => Container(
        decoration: const BoxDecoration(
          color: kColorBgSurface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
          border: Border(top: BorderSide(color: kColorBorderCard)),
        ),
        child: Column(
          children: [
            _grabHandle(),
            Expanded(
              child: PrimaryScrollController(
                controller: scrollController,
                child: _body(),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _grabHandle() => Padding(
        padding: const EdgeInsets.only(top: 8, bottom: 4),
        child: Container(
          width: 40,
          height: 4,
          decoration: BoxDecoration(
            color: kColorTextMuted.withValues(alpha: 0.5),
            borderRadius: BorderRadius.circular(2),
          ),
        ),
      );

  Widget _body() {
    if (_loading) {
      return const Center(child: CircularProgressIndicator(strokeWidth: 2));
    }
    if (_error != null || _challenge == null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Text(
            _error ?? 'Could not load challenge',
            style: const TextStyle(color: kColorTextMuted),
            textAlign: TextAlign.center,
          ),
        ),
      );
    }
    final c = _challenge!;
    final type = (c['type'] as String?) ?? 'watch';
    final title = (c['title'] as String?) ?? 'Challenge';
    switch (type) {
      case 'quiz':
        return _QuizBody(
          title: title,
          data: c['quizData'] as Map<String, dynamic>? ?? {},
          accent: widget.accent,
          submitting: _submitting,
          onSubmit: (answers) => _submit({'answers': answers}),
        );
      case 'written':
        return _WrittenBody(
          title: title,
          data: c['quizData'] as Map<String, dynamic>? ?? {},
          accent: widget.accent,
          submitting: _submitting,
          onSubmit: (response) => _submit({'response': response}),
        );
      case 'matching':
        return _MatchingBody(
          title: title,
          data: c['quizData'] as Map<String, dynamic>? ?? {},
          accent: widget.accent,
          submitting: _submitting,
          onSubmit: (pairs) => _submit({'pairs': pairs}),
        );
      case 'flashcard':
        return _FlashcardBody(
          title: title,
          data: c['quizData'] as Map<String, dynamic>? ?? {},
          accent: widget.accent,
          submitting: _submitting,
          onFinish: () => _submit(null),
        );
      case 'watch':
      default:
        return _WatchBody(
          title: title,
          accent: widget.accent,
          submitting: _submitting,
          onComplete: () => _submit(null),
        );
    }
  }
}

// ── Common heading + footer helpers ───────────────────────────────────────────

Widget _headingBar(String label, String title) => Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(
              fontFamily: 'Rajdhani',
              fontSize: 11,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.8,
              color: kColorTextMuted,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            title,
            style: const TextStyle(
              color: kColorTextPrimary,
              fontSize: 18,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );

Widget _submitFooter({
  required Color accent,
  required bool enabled,
  required bool submitting,
  required VoidCallback onPressed,
  String label = 'Submit',
}) =>
    Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
      child: SizedBox(
        width: double.infinity,
        height: 46,
        child: ElevatedButton(
          onPressed: enabled && !submitting ? onPressed : null,
          style: ElevatedButton.styleFrom(
            backgroundColor: accent,
            foregroundColor: Colors.white,
            disabledBackgroundColor: kColorBgInput,
            disabledForegroundColor: kColorTextMuted,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(8),
            ),
          ),
          child: submitting
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(
                      strokeWidth: 2, color: Colors.white),
                )
              : Text(
                  label,
                  style: const TextStyle(
                    fontFamily: 'Rajdhani',
                    fontWeight: FontWeight.w700,
                    fontSize: 15,
                    letterSpacing: 0.5,
                  ),
                ),
        ),
      ),
    );

// ── WATCH ─────────────────────────────────────────────────────────────────────

class _WatchBody extends StatelessWidget {
  const _WatchBody({
    required this.title,
    required this.accent,
    required this.submitting,
    required this.onComplete,
  });
  final String title;
  final Color accent;
  final bool submitting;
  final VoidCallback onComplete;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _headingBar('WATCH CHALLENGE', title),
        Expanded(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.play_circle_outline, color: accent, size: 56),
                  const SizedBox(height: 16),
                  const Text(
                    'Watch the associated video, then mark this challenge complete.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                        color: kColorTextSecondary, fontSize: 14, height: 1.5),
                  ),
                ],
              ),
            ),
          ),
        ),
        _submitFooter(
          accent: accent,
          enabled: true,
          submitting: submitting,
          onPressed: onComplete,
          label: 'Mark Complete',
        ),
      ],
    );
  }
}

// ── QUIZ ──────────────────────────────────────────────────────────────────────

class _QuizBody extends StatefulWidget {
  const _QuizBody({
    required this.title,
    required this.data,
    required this.accent,
    required this.submitting,
    required this.onSubmit,
  });
  final String title;
  final Map<String, dynamic> data;
  final Color accent;
  final bool submitting;
  final Future<void> Function(List<Map<String, dynamic>> answers) onSubmit;

  @override
  State<_QuizBody> createState() => _QuizBodyState();
}

class _QuizBodyState extends State<_QuizBody> {
  final Map<int, String> _picked = {};

  List<Map<String, dynamic>> get _questions =>
      (widget.data['questions'] as List<dynamic>? ?? [])
          .cast<Map<String, dynamic>>();

  bool get _allAnswered => _picked.length == _questions.length;

  void _handle() {
    final answers = _questions.asMap().entries.map((e) {
      return {'questionId': e.value['id'], 'answerId': _picked[e.key]};
    }).toList();
    widget.onSubmit(answers);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _headingBar('QUIZ CHALLENGE', widget.title),
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            itemCount: _questions.length,
            itemBuilder: (_, qi) {
              final q = _questions[qi];
              final options = (q['options'] as List<dynamic>? ?? [])
                  .cast<Map<String, dynamic>>();
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 8),
                  Text(
                    '${qi + 1}. ${q['question'] ?? ''}',
                    style: const TextStyle(
                      color: kColorTextPrimary,
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      height: 1.4,
                    ),
                  ),
                  const SizedBox(height: 10),
                  ...options.map((o) {
                    final oid = o['id'] as String? ?? '';
                    final txt = o['text'] as String? ?? '';
                    final picked = _picked[qi] == oid;
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: InkWell(
                        borderRadius: BorderRadius.circular(8),
                        onTap: () => setState(() => _picked[qi] = oid),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 10),
                          decoration: BoxDecoration(
                            color: picked
                                ? widget.accent.withValues(alpha: 0.12)
                                : kColorBgInput,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(
                              color: picked
                                  ? widget.accent
                                  : kColorBorderCard,
                              width: 1.4,
                            ),
                          ),
                          child: Row(
                            children: [
                              Icon(
                                picked
                                    ? Icons.radio_button_checked
                                    : Icons.radio_button_unchecked,
                                color: picked
                                    ? widget.accent
                                    : kColorTextMuted,
                                size: 18,
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  txt,
                                  style: TextStyle(
                                    color: picked
                                        ? kColorTextPrimary
                                        : kColorTextSecondary,
                                    fontSize: 13.5,
                                    fontWeight: picked
                                        ? FontWeight.w600
                                        : FontWeight.w400,
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
              );
            },
          ),
        ),
        _submitFooter(
          accent: widget.accent,
          enabled: _allAnswered,
          submitting: widget.submitting,
          onPressed: _handle,
        ),
      ],
    );
  }
}

// ── WRITTEN ───────────────────────────────────────────────────────────────────

class _WrittenBody extends StatefulWidget {
  const _WrittenBody({
    required this.title,
    required this.data,
    required this.accent,
    required this.submitting,
    required this.onSubmit,
  });
  final String title;
  final Map<String, dynamic> data;
  final Color accent;
  final bool submitting;
  final Future<void> Function(String response) onSubmit;

  @override
  State<_WrittenBody> createState() => _WrittenBodyState();
}

class _WrittenBodyState extends State<_WrittenBody> {
  final _ctrl = TextEditingController();

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final prompt = widget.data['prompt'] as String? ?? '';
    final placeholder = widget.data['placeholder'] as String? ?? 'Your answer…';
    return Column(
      children: [
        _headingBar('WRITTEN CHALLENGE', widget.title),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (prompt.isNotEmpty)
                  Text(
                    prompt,
                    style: const TextStyle(
                      color: kColorTextSecondary,
                      fontSize: 14,
                      height: 1.5,
                    ),
                  ),
                const SizedBox(height: 12),
                Expanded(
                  child: TextField(
                    controller: _ctrl,
                    onChanged: (_) => setState(() {}),
                    maxLines: null,
                    expands: true,
                    textAlignVertical: TextAlignVertical.top,
                    style: const TextStyle(
                        color: kColorTextPrimary, fontSize: 14),
                    decoration: InputDecoration(
                      filled: true,
                      fillColor: kColorBgInput,
                      hintText: placeholder,
                      hintStyle: const TextStyle(color: kColorTextMuted),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: const BorderSide(color: kColorBorderCard),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: const BorderSide(color: kColorBorderCard),
                      ),
                      contentPadding: const EdgeInsets.all(12),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        _submitFooter(
          accent: widget.accent,
          enabled: _ctrl.text.trim().isNotEmpty,
          submitting: widget.submitting,
          onPressed: () => widget.onSubmit(_ctrl.text.trim()),
        ),
      ],
    );
  }
}

// ── MATCHING ──────────────────────────────────────────────────────────────────

class _MatchingBody extends StatefulWidget {
  const _MatchingBody({
    required this.title,
    required this.data,
    required this.accent,
    required this.submitting,
    required this.onSubmit,
  });
  final String title;
  final Map<String, dynamic> data;
  final Color accent;
  final bool submitting;
  final Future<void> Function(Map<String, String> pairs) onSubmit;

  @override
  State<_MatchingBody> createState() => _MatchingBodyState();
}

class _MatchingBodyState extends State<_MatchingBody> {
  final Map<String, String> _selected = {}; // leftId → rightId

  List<Map<String, dynamic>> get _pairs =>
      (widget.data['pairs'] as List<dynamic>? ?? [])
          .cast<Map<String, dynamic>>();

  List<Map<String, dynamic>> get _shuffledRights {
    final rs = [..._pairs]..shuffle(Random(42)); // stable shuffle across builds
    return rs;
  }

  @override
  Widget build(BuildContext context) {
    final pairs = _pairs;
    final rights = _shuffledRights;
    return Column(
      children: [
        _headingBar('MATCHING CHALLENGE', widget.title),
        Expanded(
          child: ListView.separated(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
            itemCount: pairs.length,
            separatorBuilder: (_, __) => const SizedBox(height: 10),
            itemBuilder: (_, i) {
              final p = pairs[i];
              final lid = p['id'] as String? ?? '';
              final left = p['left'] as String? ?? '';
              return Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: kColorBgInput,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: kColorBorderCard),
                ),
                child: Row(
                  children: [
                    Expanded(
                      flex: 4,
                      child: Text(
                        left,
                        style: const TextStyle(
                          color: kColorTextPrimary,
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    const Icon(Icons.arrow_forward,
                        color: kColorTextMuted, size: 14),
                    const SizedBox(width: 6),
                    Expanded(
                      flex: 5,
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<String>(
                          value: _selected[lid],
                          isExpanded: true,
                          hint: const Text(
                            'Match…',
                            style: TextStyle(
                                color: kColorTextMuted, fontSize: 12),
                          ),
                          dropdownColor: kColorBgSurface,
                          items: rights
                              .map((r) => DropdownMenuItem<String>(
                                    value: r['id'] as String? ?? '',
                                    child: Text(
                                      (r['right'] as String?) ?? '',
                                      style: const TextStyle(
                                        color: kColorTextPrimary,
                                        fontSize: 13,
                                      ),
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ))
                              .toList(),
                          onChanged: (v) => setState(() {
                            if (v != null) _selected[lid] = v;
                          }),
                        ),
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        ),
        _submitFooter(
          accent: widget.accent,
          enabled: _selected.length == pairs.length,
          submitting: widget.submitting,
          onPressed: () => widget.onSubmit(_selected),
        ),
      ],
    );
  }
}

// ── FLASHCARD ─────────────────────────────────────────────────────────────────

class _FlashcardBody extends StatefulWidget {
  const _FlashcardBody({
    required this.title,
    required this.data,
    required this.accent,
    required this.submitting,
    required this.onFinish,
  });
  final String title;
  final Map<String, dynamic> data;
  final Color accent;
  final bool submitting;
  final VoidCallback onFinish;

  @override
  State<_FlashcardBody> createState() => _FlashcardBodyState();
}

class _FlashcardBodyState extends State<_FlashcardBody> {
  int _index = 0;
  bool _flipped = false;

  List<Map<String, dynamic>> get _cards =>
      (widget.data['cards'] as List<dynamic>? ?? [])
          .cast<Map<String, dynamic>>();

  void _next() {
    if (_index + 1 >= _cards.length) {
      widget.onFinish();
      return;
    }
    setState(() {
      _index++;
      _flipped = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final cards = _cards;
    if (cards.isEmpty) {
      return Column(
        children: [
          _headingBar('FLASHCARD CHALLENGE', widget.title),
          Expanded(
            child: Center(
              child: Text(
                'No cards',
                style:
                    const TextStyle(color: kColorTextMuted, fontSize: 14),
              ),
            ),
          ),
          _submitFooter(
            accent: widget.accent,
            enabled: true,
            submitting: widget.submitting,
            onPressed: widget.onFinish,
            label: 'Mark Complete',
          ),
        ],
      );
    }
    final card = cards[_index];
    final front = card['front'] as String? ?? '';
    final back = card['back'] as String? ?? '';
    return Column(
      children: [
        _headingBar('FLASHCARD CHALLENGE', widget.title),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Row(
            children: [
              Text(
                '${_index + 1} / ${cards.length}',
                style:
                    const TextStyle(color: kColorTextMuted, fontSize: 12),
              ),
              const Spacer(),
              Text(
                _flipped ? 'Answer' : 'Question',
                style: TextStyle(
                  color: widget.accent,
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1,
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: InkWell(
              borderRadius: BorderRadius.circular(12),
              onTap: () => setState(() => _flipped = !_flipped),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: kColorBgInput,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: _flipped ? widget.accent : kColorBorderCard,
                    width: 1.4,
                  ),
                ),
                child: Center(
                  child: Text(
                    _flipped ? back : front,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: kColorTextPrimary,
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                      height: 1.4,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => setState(() => _flipped = !_flipped),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: kColorTextSecondary,
                    side: const BorderSide(color: kColorBorderCard),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                    minimumSize: const Size.fromHeight(42),
                  ),
                  child: Text(_flipped ? 'Show front' : 'Flip'),
                ),
              ),
            ],
          ),
        ),
        _submitFooter(
          accent: widget.accent,
          enabled: true,
          submitting: widget.submitting,
          onPressed: _next,
          label: _index + 1 >= cards.length ? 'Finish' : 'Next',
        ),
      ],
    );
  }
}
