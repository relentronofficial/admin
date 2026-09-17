import 'dart:math' as math;
import 'package:flutter/material.dart';

/// Full-screen cinematic overlay that fires once on fresh lesson completion.
/// Manages its own [AnimationController]; calls [onDismiss] when the
/// 2.8-second animation finishes so the parent can remove it from the tree.
class MissionCompleteOverlay extends StatefulWidget {
  const MissionCompleteOverlay({
    super.key,
    required this.title,
    required this.xp,
    required this.onDismiss,
  });

  final String title;
  final int xp;
  final VoidCallback onDismiss;

  @override
  State<MissionCompleteOverlay> createState() => _MissionCompleteOverlayState();
}

class _MissionCompleteOverlayState extends State<MissionCompleteOverlay>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;

  // Overall overlay: fades in then out
  late final Animation<double> _fade;

  // Trophy: spring pop + slight rotation unwind
  late final Animation<double> _trophyScale;
  late final Animation<double> _trophyAngle;

  // Text elements: slide up + fade in
  late final Animation<double> _t1Opacity;
  late final Animation<double> _t1Y;
  late final Animation<double> _t2Opacity;
  late final Animation<double> _t2Y;
  late final Animation<double> _badgeOpacity;
  late final Animation<double> _badgeY;

  static const _particleColors = [
    Color(0xFFF59E0B),
    Color(0xFFEF4444),
    Color(0xFF22C55E),
    Color(0xFF3B82F6),
    Color(0xFFA855F7),
    Color(0xFFEC4899),
    Color(0xFF14B8A6),
    Color(0xFFF97316),
  ];

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2800),
    )..addStatusListener((s) {
        if (s == AnimationStatus.completed) widget.onDismiss();
      });

    // Overlay: 0→1 in 8%, hold, then 1→0 in last 20%
    _fade = TweenSequence<double>([
      TweenSequenceItem(tween: Tween(begin: 0.0, end: 1.0), weight: 8),
      TweenSequenceItem(tween: ConstantTween(1.0), weight: 72),
      TweenSequenceItem(tween: Tween(begin: 1.0, end: 0.0), weight: 20),
    ]).animate(_ctrl);

    // Trophy: elastic pop at 5–25%
    _trophyScale = CurvedAnimation(
      parent: _ctrl,
      curve: const Interval(0.05, 0.25, curve: Curves.elasticOut),
    );
    _trophyAngle = Tween<double>(begin: -0.3, end: 0.0).animate(
      CurvedAnimation(
        parent: _ctrl,
        curve: const Interval(0.05, 0.22, curve: Curves.easeOut),
      ),
    );

    // "MISSION COMPLETE" text: 20–32%
    _t1Opacity = CurvedAnimation(
      parent: _ctrl,
      curve: const Interval(0.20, 0.32, curve: Curves.easeOut),
    );
    _t1Y = Tween<double>(begin: 18.0, end: 0.0).animate(
      CurvedAnimation(
        parent: _ctrl,
        curve: const Interval(0.20, 0.32, curve: Curves.easeOut),
      ),
    );

    // Lesson title: 26–38%
    _t2Opacity = CurvedAnimation(
      parent: _ctrl,
      curve: const Interval(0.26, 0.38, curve: Curves.easeOut),
    );
    _t2Y = Tween<double>(begin: 18.0, end: 0.0).animate(
      CurvedAnimation(
        parent: _ctrl,
        curve: const Interval(0.26, 0.38, curve: Curves.easeOut),
      ),
    );

    // XP badge: 31–43%
    _badgeOpacity = CurvedAnimation(
      parent: _ctrl,
      curve: const Interval(0.31, 0.43, curve: Curves.easeOut),
    );
    _badgeY = Tween<double>(begin: 18.0, end: 0.0).animate(
      CurvedAnimation(
        parent: _ctrl,
        curve: const Interval(0.31, 0.43, curve: Curves.easeOut),
      ),
    );

    _ctrl.forward();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  // Each particle has its own progress curve staggered slightly
  Animation<double> _particleAnim(int i) => CurvedAnimation(
        parent: _ctrl,
        curve: Interval(
          0.09 + i * 0.015,
          0.45,
          curve: Curves.easeOut,
        ),
      );

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _ctrl,
      builder: (context, _) {
        return Opacity(
          opacity: _fade.value.clamp(0.0, 1.0),
          child: Container(
            color: Colors.black.withValues(alpha: 0.82),
            child: Stack(
              alignment: Alignment.center,
              children: [
                // ── Radial burst particles ─────────────────────────────────
                for (int i = 0; i < 8; i++) ...[
                  Builder(builder: (_) {
                    final progress = _particleAnim(i).value;
                    final angleRad = i * math.pi / 4; // 45° apart
                    final radius = 90.0 * progress;
                    return Transform.translate(
                      offset: Offset(
                        math.cos(angleRad) * radius,
                        math.sin(angleRad) * radius,
                      ),
                      child: Opacity(
                        opacity: (1.0 - progress).clamp(0.0, 1.0),
                        child: Container(
                          width: 10,
                          height: 10,
                          decoration: BoxDecoration(
                            color: _particleColors[i],
                            shape: BoxShape.circle,
                          ),
                        ),
                      ),
                    );
                  }),
                ],

                // ── Main content column ────────────────────────────────────
                Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Trophy icon with spring pop + rotation
                    Transform.rotate(
                      angle: _trophyAngle.value,
                      child: Transform.scale(
                        scale: _trophyScale.value,
                        child: const Icon(
                          Icons.emoji_events_rounded,
                          size: 80,
                          color: Color(0xFFF59E0B),
                          shadows: [
                            Shadow(
                              color: Color(0xAAF59E0B),
                              blurRadius: 28,
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),

                    // "MISSION COMPLETE"
                    Transform.translate(
                      offset: Offset(0, _t1Y.value),
                      child: Opacity(
                        opacity: _t1Opacity.value.clamp(0.0, 1.0),
                        child: const Text(
                          'MISSION COMPLETE',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 26,
                            fontWeight: FontWeight.w900,
                            fontFamily: 'Rajdhani',
                            letterSpacing: 3,
                            shadows: [
                              Shadow(
                                color: Color(0x99F59E0B),
                                blurRadius: 22,
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),

                    // Lesson title
                    Transform.translate(
                      offset: Offset(0, _t2Y.value),
                      child: Opacity(
                        opacity: _t2Opacity.value.clamp(0.0, 1.0),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 40),
                          child: Text(
                            widget.title,
                            textAlign: TextAlign.center,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.72),
                              fontSize: 13,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                      ),
                    ),

                    // XP badge (hidden when xp == 0)
                    if (widget.xp > 0) ...[
                      const SizedBox(height: 16),
                      Transform.translate(
                        offset: Offset(0, _badgeY.value),
                        child: Opacity(
                          opacity: _badgeOpacity.value.clamp(0.0, 1.0),
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 20,
                              vertical: 8,
                            ),
                            decoration: BoxDecoration(
                              color: const Color(0xFFDC2626).withValues(alpha: 0.85),
                              borderRadius: BorderRadius.circular(100),
                              boxShadow: const [
                                BoxShadow(
                                  color: Color(0x66DC2626),
                                  blurRadius: 20,
                                ),
                              ],
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(
                                  Icons.bolt_rounded,
                                  color: Colors.white,
                                  size: 16,
                                ),
                                const SizedBox(width: 6),
                                Text(
                                  '+${widget.xp} XP earned',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 14,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
