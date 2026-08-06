import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../shared/theme/theme_tokens.dart';
import '../../data/rituals_service.dart';

/// Morning Ritual home-page card — direct port of the co-worker's
/// `_buildMorningRitualCard` (main.dart:3252–3679).
///
/// Behavior:
///   * Shows 5 hardcoded fallback habits when [habitsProvider] returns
///     empty (so the card is never blank).
///   * PageView-based navigation between habits (swipe or Yes/Not-Yet).
///   * Progress row of thin bars (4 px) with red glow on completed steps.
///   * `rawQuestion` renders as RichText with `highlightWord` in coral red.
///   * Completion celebration: green circle check + "Success! You checked
///     off X of Y morning habits." message.
class MorningRitualCard extends ConsumerStatefulWidget {
  const MorningRitualCard({super.key});

  @override
  ConsumerState<MorningRitualCard> createState() => _MorningRitualCardState();
}

class _MorningRitualCardState extends ConsumerState<MorningRitualCard> {
  static const Color _coral = Color(0xFFFF3B30);
  static const Color _coralEnd = Color(0xFFFF5E3A);

  int _currentStep = 0;
  final List<bool?> _answers = List<bool?>.filled(5, null);
  bool _expanded = true;
  final PageController _pageCtrl = PageController();

  @override
  void dispose() {
    _pageCtrl.dispose();
    super.dispose();
  }

  // ── Neumorphism recipe (matches home menu tiles) ────────────────────
  //   Outer card: rich diagonal gradient + deep drop shadow (dark) /
  //   dual highlight+shadow (light).
  //   Inner elements: smaller, scaled-down version of the same recipe
  //   so they read as extruded from the card face, not stuck on top.

  BoxDecoration _outerCardDeco(bool isDark) => BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: isDark
              ? const [
                  Color(0xFF1B1B22),
                  Color(0xFF11111A),
                  Color(0xFF06060B),
                ]
              : const [
                  Color(0xFFFFFFFF),
                  Color(0xFFEDEDF0),
                  Color(0xFFD4D4DC),
                ],
          stops: isDark ? const [0.0, 0.55, 1.0] : null,
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: isDark
            ? const [
                BoxShadow(
                  color: Colors.black,
                  offset: Offset(0, 16),
                  blurRadius: 36,
                ),
                BoxShadow(
                  color: Color(0xA6000000),
                  offset: Offset(0, 4),
                  blurRadius: 8,
                ),
              ]
            : [
                BoxShadow(
                  color: const Color(0xFF8E8EA0).withValues(alpha: 0.55),
                  offset: const Offset(14, 14),
                  blurRadius: 30,
                ),
                BoxShadow(
                  color: const Color(0xFF8E8EA0).withValues(alpha: 0.30),
                  offset: const Offset(4, 4),
                  blurRadius: 6,
                ),
                BoxShadow(
                  color: Colors.white.withValues(alpha: 1.0),
                  offset: const Offset(-12, -12),
                  blurRadius: 28,
                ),
                BoxShadow(
                  color: Colors.white.withValues(alpha: 0.95),
                  offset: const Offset(-3, -3),
                  blurRadius: 5,
                ),
              ],
      );

  // Small pill (header ritual tag, step counter, chevron)
  BoxDecoration _pillDeco(bool isDark, {double radius = 10}) => BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: isDark
              ? const [Color(0xFF23232B), Color(0xFF0A0A0F)]
              : const [Color(0xFFFFFFFF), Color(0xFFE6E6EC)],
        ),
        borderRadius: BorderRadius.circular(radius),
        boxShadow: isDark
            ? const [
                BoxShadow(
                  color: Color(0xCC000000),
                  offset: Offset(2, 3),
                  blurRadius: 6,
                ),
              ]
            : [
                BoxShadow(
                  color: const Color(0xFF8E8EA0).withValues(alpha: 0.35),
                  offset: const Offset(3, 3),
                  blurRadius: 6,
                ),
                BoxShadow(
                  color: Colors.white,
                  offset: const Offset(-3, -3),
                  blurRadius: 6,
                ),
              ],
      );

  // Medium extruded circle (habit icon 60px, completion badge 60px)
  BoxDecoration _extrudedCircleDeco(bool isDark, {Color? tint}) =>
      BoxDecoration(
        shape: BoxShape.circle,
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: isDark
              ? const [Color(0xFF23232B), Color(0xFF0A0A0F)]
              : const [Color(0xFFFFFFFF), Color(0xFFE0E0E8)],
        ),
        boxShadow: isDark
            ? [
                const BoxShadow(
                  color: Colors.black,
                  offset: Offset(5, 6),
                  blurRadius: 14,
                ),
                if (tint != null)
                  BoxShadow(
                    color: tint.withValues(alpha: 0.25),
                    blurRadius: 14,
                    spreadRadius: 1,
                  ),
              ]
            : [
                BoxShadow(
                  color: const Color(0xFF8E8EA0).withValues(alpha: 0.45),
                  offset: const Offset(6, 6),
                  blurRadius: 12,
                ),
                BoxShadow(
                  color: Colors.white,
                  offset: const Offset(-6, -6),
                  blurRadius: 12,
                ),
                if (tint != null)
                  BoxShadow(
                    color: tint.withValues(alpha: 0.18),
                    blurRadius: 14,
                    spreadRadius: 1,
                  ),
              ],
      );

  // Neumorphic "Not Yet" secondary button
  BoxDecoration _secondaryBtnDeco(bool isDark) => BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: isDark
              ? const [Color(0xFF1F1F26), Color(0xFF08080C)]
              : const [Color(0xFFFFFFFF), Color(0xFFE0E0E8)],
        ),
        borderRadius: BorderRadius.circular(16),
        boxShadow: isDark
            ? const [
                BoxShadow(
                  color: Colors.black,
                  offset: Offset(4, 5),
                  blurRadius: 12,
                ),
              ]
            : [
                BoxShadow(
                  color: const Color(0xFF8E8EA0).withValues(alpha: 0.40),
                  offset: const Offset(5, 5),
                  blurRadius: 10,
                ),
                BoxShadow(
                  color: Colors.white,
                  offset: const Offset(-5, -5),
                  blurRadius: 10,
                ),
              ],
      );

  void _handleAnswer(bool answer, int total) {
    setState(() {
      if (_currentStep < _answers.length) {
        _answers[_currentStep] = answer;
      }
      _currentStep += 1;
    });
    if (_currentStep < total && _pageCtrl.hasClients) {
      _pageCtrl.animateToPage(
        _currentStep,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final habitsAsync = ref.watch(habitsProvider);
    final buttonsAsync = ref.watch(buttonsConfigProvider);

    // Resolve habits — fall back to hardcoded defaults when backend is
    // empty or errors, so the card is never blank.
    final habits = habitsAsync.when(
      loading: () => _defaultHabits,
      error: (_, __) => _defaultHabits,
      data: (list) => list.isEmpty ? _defaultHabits : list,
    );
    final total = habits.length;
    final buttons = buttonsAsync.valueOrNull ??
        const ButtonsConfig(yesLabel: 'Yes', notYetLabel: 'Not Yet');
    final isComplete = _currentStep >= total;

    // Ensure answers list matches habit count.
    while (_answers.length < total) {
      _answers.add(null);
    }

    final textColor = tokens.textPrimary;
    // Ignored: borderColor was used by the old bordered look; the
    // neumorphic recipe uses shadow-only depth cues instead.
    // ignore: unused_local_variable
    final _ = tokens.borderCard;

    return Container(
      decoration: _outerCardDeco(isDark),
      padding: const EdgeInsets.all(18),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header row: Ritual tag + step pill + chevron
          Row(
            children: [
              Expanded(
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(7),
                      decoration: _pillDeco(isDark, radius: 10),
                      child: const Icon(
                        Icons.edit_document,
                        color: _coral,
                        size: 16,
                      ),
                    ),
                    const SizedBox(width: 10),
                    const Expanded(
                      child: Text(
                        'MORNING RITUAL',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: _coral,
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              // Step pill / Completed pill — neumorphic
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                decoration: _pillDeco(isDark, radius: 14),
                child: Text(
                  isComplete ? 'Completed' : '${_currentStep + 1} / $total',
                  style: TextStyle(
                    color: isComplete ? Colors.green : _coral,
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              GestureDetector(
                onTap: () => setState(() => _expanded = !_expanded),
                child: Container(
                  width: 32,
                  height: 32,
                  decoration: _pillDeco(isDark, radius: 16),
                  child: Icon(
                    _expanded
                        ? Icons.keyboard_arrow_up_rounded
                        : Icons.keyboard_arrow_down_rounded,
                    color: const Color(0xFF8E8E93),
                    size: 18,
                  ),
                ),
              ),
            ],
          ),

          const SizedBox(height: 16),

          // Progress bars — one per habit, glowing red when active/done.
          Row(
            children: List.generate(total, (index) {
              final active =
                  _currentStep >= total || index <= _currentStep;
              return Expanded(
                child: Container(
                  margin: EdgeInsets.symmetric(
                    horizontal: index == 0 ? 0 : 4,
                  ),
                  height: 4,
                  decoration: BoxDecoration(
                    color: active
                        ? const Color(0xFFE50914)
                        : (isDark
                            ? const Color(0xFF2C2C2E)
                            : const Color(0xFFE5E5EA)),
                    borderRadius: BorderRadius.circular(2),
                    boxShadow: active
                        ? [
                            BoxShadow(
                              color: const Color(0xFFE50914)
                                  .withValues(alpha: 0.4),
                              blurRadius: 8,
                              spreadRadius: 1,
                            ),
                          ]
                        : null,
                  ),
                ),
              );
            }),
          ),

          if (_expanded) ...[
            const SizedBox(height: 24),

            if (!isComplete) ...[
              // Habit prompt PageView (swipeable)
              SizedBox(
                height: 200,
                child: PageView.builder(
                  controller: _pageCtrl,
                  itemCount: total,
                  onPageChanged: (page) =>
                      setState(() => _currentStep = page),
                  itemBuilder: (context, index) {
                    final habit = habits[index];
                    return Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        // Extruded neumorphic icon with coral tint glow
                        Container(
                          width: 68,
                          height: 68,
                          decoration:
                              _extrudedCircleDeco(isDark, tint: _coral),
                          child: Icon(
                            _iconFor(habit.icon),
                            color: _coral,
                            size: 28,
                          ),
                        ),
                        const SizedBox(height: 18),
                        // Question — highlight word in coral
                        RichText(
                          textAlign: TextAlign.center,
                          text: TextSpan(
                            style: TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.bold,
                              color: textColor,
                              height: 1.25,
                            ),
                            children: _questionSpans(
                              habit.rawQuestion,
                              habit.highlightWord,
                            ),
                          ),
                        ),
                        const SizedBox(height: 8),
                        if (habit.subtitle.isNotEmpty)
                          Text(
                            habit.subtitle,
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              color: Color(0xFF8E8E93),
                              fontSize: 14,
                              fontWeight: FontWeight.w400,
                            ),
                          ),
                      ],
                    );
                  },
                ),
              ),

              const SizedBox(height: 24),

              // Not Yet / Yes buttons
              Row(
                children: [
                  Expanded(
                    child: InkWell(
                      onTap: () => _handleAnswer(false, total),
                      borderRadius: BorderRadius.circular(16),
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 15),
                        decoration: _secondaryBtnDeco(isDark),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(
                              Icons.close_rounded,
                              color: Color(0xFF8E8E93),
                              size: 18,
                            ),
                            const SizedBox(width: 8),
                            Text(
                              buttons.notYetLabel,
                              style: const TextStyle(
                                color: Color(0xFF8E8E93),
                                fontSize: 15,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: InkWell(
                      onTap: () => _handleAnswer(true, total),
                      borderRadius: BorderRadius.circular(16),
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [_coral, _coralEnd],
                          ),
                          borderRadius: BorderRadius.circular(16),
                          boxShadow: [
                            BoxShadow(
                              color: _coral.withValues(alpha: 0.3),
                              blurRadius: 10,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(
                              Icons.check_rounded,
                              color: Colors.white,
                              size: 18,
                            ),
                            const SizedBox(width: 8),
                            Text(
                              buttons.yesLabel,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 15,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ] else ...[
              // Completion celebration state
              Column(
                children: [
                  const SizedBox(height: 20),
                  Container(
                    width: 68,
                    height: 68,
                    decoration:
                        _extrudedCircleDeco(isDark, tint: Colors.green),
                    child: const Icon(
                      Icons.check_circle_rounded,
                      color: Colors.green,
                      size: 32,
                    ),
                  ),
                  const SizedBox(height: 18),
                  Text(
                    'Morning Ritual Completed!',
                    style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                      color: textColor,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Success! You checked off ${_answers.where((v) => v == true).length} of $total morning habits.',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: Color(0xFF8E8E93),
                      fontSize: 14,
                    ),
                  ),
                  const SizedBox(height: 10),
                ],
              ),
            ],
          ],
        ],
      ),
    );
  }

  static List<InlineSpan> _questionSpans(String raw, String highlight) {
    if (highlight.isEmpty) return [TextSpan(text: raw)];
    final idx = raw.toLowerCase().indexOf(highlight.toLowerCase());
    if (idx < 0) return [TextSpan(text: raw)];
    return [
      TextSpan(text: raw.substring(0, idx)),
      TextSpan(
        text: raw.substring(idx, idx + highlight.length),
        style: const TextStyle(color: _coral),
      ),
      TextSpan(text: raw.substring(idx + highlight.length)),
    ];
  }

  static IconData _iconFor(String key) {
    switch (key) {
      case 'fa-sun':
        return Icons.wb_sunny_outlined;
      case 'fa-spa':
        return Icons.self_improvement;
      case 'fa-bullseye':
        return Icons.track_changes;
      case 'fa-dumbbell':
        return Icons.fitness_center;
      case 'fa-coffee':
        return Icons.local_cafe;
      default:
        return Icons.wb_sunny_outlined;
    }
  }
}

const List<Habit> _defaultHabits = [
  Habit(
    id: 'default-1',
    icon: 'fa-sun',
    rawQuestion: 'Did you write your morning pages?',
    highlightWord: 'morning pages',
    subtitle: 'Build clarity. Boost focus. Start your day right.',
  ),
  Habit(
    id: 'default-2',
    icon: 'fa-spa',
    rawQuestion: 'Did you meditate for 10 minutes?',
    highlightWord: 'for 10 minutes',
    subtitle: 'Calm your mind. Find presence. Center yourself.',
  ),
  Habit(
    id: 'default-3',
    icon: 'fa-bullseye',
    rawQuestion: 'Did you plan your daily goals?',
    highlightWord: 'daily goals',
    subtitle: 'Prioritize tasks. Direct your energy. Stay productive.',
  ),
  Habit(
    id: 'default-4',
    icon: 'fa-dumbbell',
    rawQuestion: 'Did you exercise or stretch today?',
    highlightWord: 'stretch today',
    subtitle: 'Activate your body. Boost energy. Stay healthy.',
  ),
  Habit(
    id: 'default-5',
    icon: 'fa-coffee',
    rawQuestion: 'Did you eat a healthy breakfast?',
    highlightWord: 'healthy breakfast',
    subtitle: 'Nourish your body. Fuel your mind for the day.',
  ),
];
