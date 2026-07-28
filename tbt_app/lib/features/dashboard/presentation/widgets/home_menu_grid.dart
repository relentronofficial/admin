import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/constants/routes.dart';

/// Home menu grid — 6 tiles in 2×3 layout matching the co-worker's
/// `_buildMenuGrid` (main.dart:4138–4253).
///
/// Row 1: Community · Courses
/// Row 2: Podcast · Workshop
/// Row 3: E-Book · Task
///
/// Each row enters with a staggered fade + slide-in animation (delays
/// 100/250/400 ms). Each tile is an [AnimatedGlassCard] with a fixed
/// black + crimson theme (independent of the app's dark/light mode) —
/// matches the co-worker's `_cardBackground = #0B0B0D` /
/// `_cardBorderColor = #B22222` styling.
class HomeMenuGrid extends StatelessWidget {
  const HomeMenuGrid({super.key});

  @override
  Widget build(BuildContext context) {
    final items = <_MenuItem>[
      _MenuItem(
        title: 'Community',
        icon: Icons.groups_rounded,
        onTap: () => GoRouter.of(context).push(AppRoutes.community),
      ),
      _MenuItem(
        title: 'Courses',
        icon: Icons.school_rounded,
        onTap: () => GoRouter.of(context).push(AppRoutes.courses),
      ),
      _MenuItem(
        title: 'Podcast',
        icon: Icons.podcasts_rounded,
        onTap: () => GoRouter.of(context).push(AppRoutes.podcasts),
      ),
      _MenuItem(
        title: 'Workshop',
        icon: Icons.co_present_rounded,
        onTap: () => GoRouter.of(context).push(AppRoutes.workshops),
      ),
      _MenuItem(
        title: 'E-Book',
        icon: Icons.menu_book_rounded,
        onTap: () => GoRouter.of(context).push(AppRoutes.ebooks),
      ),
      _MenuItem(
        title: 'Task',
        icon: Icons.task_alt_rounded,
        onTap: () => GoRouter.of(context).push(AppRoutes.batchProgram),
      ),
    ];

    const rowDelays = <Duration>[
      Duration(milliseconds: 100),
      Duration(milliseconds: 250),
      Duration(milliseconds: 400),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: List.generate(3, (rowIdx) {
        final rowItems = items.sublist(rowIdx * 2, rowIdx * 2 + 2);
        return Padding(
          padding: EdgeInsets.only(top: rowIdx == 0 ? 0 : 14),
          child: FadeInSlideTransition(
            delay: rowDelays[rowIdx],
            child: Row(
              children: [
                for (int i = 0; i < rowItems.length; i++) ...[
                  if (i > 0) const SizedBox(width: 14),
                  Expanded(
                    child: AnimatedGlassCard(
                      title: rowItems[i].title,
                      icon: rowItems[i].icon,
                      onTap: rowItems[i].onTap,
                    ),
                  ),
                ],
              ],
            ),
          ),
        );
      }),
    );
  }
}

class _MenuItem {
  const _MenuItem({required this.title, required this.icon, required this.onTap});
  final String title;
  final IconData icon;
  final VoidCallback onTap;
}

// ── AnimatedGlassCard ──────────────────────────────────────────────
// Neumorphic (soft-UI) tile: borderless, surface tone tracks the page
// background, dual shadows (light top-left + dark bottom-right) give
// the extruded feel. Pressed state dims the surface and collapses the
// shadows so the tile reads as pushed in. Crimson icon accent kept.

class AnimatedGlassCard extends StatefulWidget {
  const AnimatedGlassCard({
    super.key,
    required this.title,
    required this.icon,
    required this.onTap,
    this.color = const Color(0xFFE50914),
    this.isFullWidth = false,
  });

  final String title;
  final IconData icon;
  final Color color;
  final bool isFullWidth;
  final VoidCallback onTap;

  @override
  State<AnimatedGlassCard> createState() => _AnimatedGlassCardState();
}

class _AnimatedGlassCardState extends State<AnimatedGlassCard> {
  double _scale = 1.0;
  bool _pressed = false;

  // Light-mode surface (page bg #F7F7F8). Steeper diagonal gradient —
  // near-white top-left, notably darker bottom-right — so the face
  // itself looks strongly lit from the top-left.
  static const List<Color> _lightSurface = [
    Color(0xFFFFFFFF),
    Color(0xFFD4D4DC),
  ];
  static const List<Color> _lightSurfacePressed = [
    Color(0xFFD1D1D6),
    Color(0xFFF4F4F7),
  ];
  static const Color _lightHighlight = Color(0xFFFFFFFF);
  static const Color _lightShadow = Color(0xFF8E8EA0);

  // Dark-mode surface (page bg #0F0F0F). Depth is baked INTO the
  // surface via a diagonal gradient (subtle top-left lift → mid →
  // deep shadow corner) — no external gray "highlight" shadow that
  // would read as whitewash on black. A single deep drop shadow does
  // the lift. This is the "obsidian card" pattern premium apps use.
  static const List<Color> _darkSurface = [
    Color(0xFF1B1B22),
    Color(0xFF11111A),
    Color(0xFF06060B),
  ];
  static const List<Color> _darkSurfacePressed = [
    Color(0xFF06060A),
    Color(0xFF10101A),
    Color(0xFF181820),
  ];
  static const List<double> _darkSurfaceStops = [0.0, 0.55, 1.0];
  static const Color _darkShadow = Color(0xFF000000);

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final List<Color> surface = isDark
        ? (_pressed ? _darkSurfacePressed : _darkSurface)
        : (_pressed ? _lightSurfacePressed : _lightSurface);
    final Color highlight = _lightHighlight; // used in light mode only
    final Color shadow = isDark ? _darkShadow : _lightShadow;
    final Color textColor = isDark ? Colors.white : const Color(0xFF0B0B0D);

    return GestureDetector(
      onTapDown: (_) => setState(() { _scale = 0.97; _pressed = true; }),
      onTapUp: (_) {
        setState(() { _scale = 1.0; _pressed = false; });
        widget.onTap();
      },
      onTapCancel: () => setState(() { _scale = 1.0; _pressed = false; }),
      child: AnimatedScale(
        scale: _scale,
        duration: const Duration(milliseconds: 150),
        curve: Curves.easeOutBack,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          curve: Curves.easeOut,
          height: widget.isFullWidth ? 80.0 : 110.0,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: surface,
              stops: isDark ? _darkSurfaceStops : null,
            ),
            borderRadius: BorderRadius.circular(18),
            boxShadow: _pressed
                ? (isDark
                    ? [
                        // Dark pressed — softer, closer shadow only.
                        BoxShadow(
                          color: shadow.withValues(alpha: 0.55),
                          offset: const Offset(3, 4),
                          blurRadius: 8,
                        ),
                      ]
                    : [
                        BoxShadow(
                          color: shadow.withValues(alpha: 0.45),
                          offset: const Offset(3, 3),
                          blurRadius: 5,
                        ),
                        BoxShadow(
                          color: highlight.withValues(alpha: 0.95),
                          offset: const Offset(-3, -3),
                          blurRadius: 5,
                        ),
                      ])
                : (isDark
                    ? [
                        // Deep, diffused single drop shadow — pure
                        // black spilling downward. No light highlight
                        // (which would read as whitewash on obsidian).
                        BoxShadow(
                          color: shadow.withValues(alpha: 0.85),
                          offset: const Offset(0, 16),
                          blurRadius: 36,
                          spreadRadius: 0,
                        ),
                        // Tight contact shadow — grounds the tile.
                        BoxShadow(
                          color: shadow.withValues(alpha: 0.65),
                          offset: const Offset(0, 4),
                          blurRadius: 8,
                        ),
                      ]
                    : [
                        // Light-mode neumorphism (unchanged).
                        BoxShadow(
                          color: shadow.withValues(alpha: 0.75),
                          offset: const Offset(16, 16),
                          blurRadius: 32,
                        ),
                        BoxShadow(
                          color: shadow.withValues(alpha: 0.45),
                          offset: const Offset(4, 4),
                          blurRadius: 6,
                        ),
                        BoxShadow(
                          color: highlight.withValues(alpha: 1.0),
                          offset: const Offset(-14, -14),
                          blurRadius: 30,
                        ),
                        BoxShadow(
                          color: highlight.withValues(alpha: 0.95),
                          offset: const Offset(-3, -3),
                          blurRadius: 5,
                        ),
                      ]),
          ),
          child: widget.isFullWidth
              ? Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(widget.icon, color: widget.color, size: 30),
                    const SizedBox(width: 12),
                    Text(
                      widget.title,
                      style: TextStyle(
                        color: textColor,
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ],
                )
              : Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(widget.icon, color: widget.color, size: 32),
                    const SizedBox(height: 10),
                    Text(
                      widget.title,
                      style: TextStyle(
                        color: textColor,
                        fontSize: 14.5,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ],
                ),
        ),
      ),
    );
  }
}

// ── FadeInSlideTransition ──────────────────────────────────────────
// Port of co-worker's `FadeInSlideTransition` (main.dart:5232). Fades
// opacity 0→1 and slides Offset(0, 0.15) → zero over 600 ms after a
// [delay], curve easeOutCubic.

class FadeInSlideTransition extends StatefulWidget {
  const FadeInSlideTransition({
    super.key,
    required this.child,
    this.delay = Duration.zero,
    this.duration = const Duration(milliseconds: 600),
  });

  final Widget child;
  final Duration delay;
  final Duration duration;

  @override
  State<FadeInSlideTransition> createState() => _FadeInSlideTransitionState();
}

class _FadeInSlideTransitionState extends State<FadeInSlideTransition>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _fade;
  late final Animation<Offset> _slide;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: widget.duration);
    _fade = CurvedAnimation(parent: _ctrl, curve: Curves.easeOutCubic);
    _slide = Tween<Offset>(
      begin: const Offset(0, 0.15),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeOutCubic));

    Future.delayed(widget.delay, () {
      if (mounted) _ctrl.forward();
    });
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _fade,
      child: SlideTransition(position: _slide, child: widget.child),
    );
  }
}
