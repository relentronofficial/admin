import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/constants/routes.dart';
import '../providers/site_config_provider.dart';
import '../theme/tbt_theme.dart';
import '../theme/theme_tokens.dart';

/// Persistent bottom tab bar for the authenticated shell.
///
/// Module 9E — reshaped to the co-worker's home-screen nav:
///   HOME · WINS · VOICE OF SAKTHI · COURSES · PROFILE
///
/// The middle slot ("Voice of Sakthi") is a raised avatar circle that
/// sits above the bar line (offset -22 dp), with a red border ring
/// when active and gold otherwise. Tapping it opens /podcasts — same
/// behaviour as the co-worker's app (Voice of Sakthi = podcast entry).
class AppBottomTabBar extends ConsumerWidget {
  const AppBottomTabBar({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // ref.watch keeps this widget in sync with ui-string changes even
    // though we don't inline them here yet.
    ref.watch(uiStringsNotifierProvider);
    final accent = context.tbt.accent;
    final location = GoRouterState.of(context).uri.path;
    final activeIndex = _activeIndexFor(location);

    return Container(
      decoration: BoxDecoration(
        color: context.tokens.bgSurface,
        border: Border(top: BorderSide(color: context.tokens.borderCard)),
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 66,
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              // Standard tab row (5 slots — middle is reserved for the
              // raised Voice of Sakthi rendered on top).
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Expanded(
                    child: _TabItem(
                      label: 'HOME',
                      icon: Icons.home_outlined,
                      activeIcon: Icons.home,
                      active: activeIndex == 0,
                      accent: accent,
                      onTap: () => context.go(AppRoutes.dashboard),
                    ),
                  ),
                  Expanded(
                    child: _TabItem(
                      label: 'WINS',
                      icon: Icons.emoji_events_outlined,
                      activeIcon: Icons.emoji_events,
                      active: activeIndex == 1,
                      accent: accent,
                      onTap: () => context.go(AppRoutes.wins),
                    ),
                  ),
                  // Middle slot reserved for the raised avatar; keep
                  // an Expanded here so the flex math balances.
                  const Expanded(child: SizedBox()),
                  Expanded(
                    child: _TabItem(
                      label: 'COURSES',
                      icon: Icons.school_outlined,
                      activeIcon: Icons.school,
                      active: activeIndex == 3,
                      accent: accent,
                      onTap: () => context.go(AppRoutes.courses),
                    ),
                  ),
                  Expanded(
                    child: _TabItem(
                      label: 'PROFILE',
                      icon: Icons.person_outline,
                      activeIcon: Icons.person,
                      active: activeIndex == 4,
                      accent: accent,
                      onTap: () => context.go(AppRoutes.profile),
                    ),
                  ),
                ],
              ),
              // Raised Voice of Sakthi in the middle
              Positioned(
                top: -22,
                left: 0,
                right: 0,
                child: Center(
                  child: _VoiceOfSakthiTab(
                    active: activeIndex == 2,
                    accent: accent,
                    onTap: () => context.go(AppRoutes.podcasts),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  int _activeIndexFor(String location) {
    if (location.startsWith(AppRoutes.dashboard)) return 0;
    if (location.startsWith(AppRoutes.wins)) return 1;
    if (location.startsWith(AppRoutes.podcasts)) return 2;
    if (location.startsWith(AppRoutes.courses)) return 3;
    if (location.startsWith(AppRoutes.profile)) return 4;
    return -1;
  }
}

// ── Standard tab item ──────────────────────────────────────────────

class _TabItem extends StatelessWidget {
  const _TabItem({
    required this.label,
    required this.icon,
    required this.activeIcon,
    required this.active,
    required this.accent,
    required this.onTap,
  });
  final String label;
  final IconData icon;
  final IconData activeIcon;
  final bool active;
  final Color accent;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = active ? accent : context.tokens.textMuted;
    return Semantics(
      label: label,
      selected: active,
      button: true,
      child: InkWell(
        onTap: onTap,
        splashColor: accent.withValues(alpha: 0.10),
        highlightColor: Colors.transparent,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(active ? activeIcon : icon, color: color, size: 21),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(
                color: color,
                fontSize: 9,
                fontWeight: active ? FontWeight.w800 : FontWeight.w600,
                letterSpacing: 0.4,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Raised Voice of Sakthi tab ──────────────────────────────────────

class _VoiceOfSakthiTab extends StatelessWidget {
  const _VoiceOfSakthiTab({
    required this.active,
    required this.accent,
    required this.onTap,
  });
  final bool active;
  final Color accent;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 54,
            height: 54,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(
                color: active ? accent : const Color(0xFFf59e0b),
                width: 2.5,
              ),
              gradient: const RadialGradient(
                colors: [Color(0xFF3a1a1a), Color(0xFF0f0f0f)],
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.5),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
                if (active)
                  BoxShadow(
                    color: accent.withValues(alpha: 0.4),
                    blurRadius: 16,
                    spreadRadius: -2,
                  ),
              ],
            ),
            child: Center(
              child: Icon(
                Icons.mic,
                color: active ? accent : const Color(0xFFfacc15),
                size: 24,
              ),
            ),
          ),
          const SizedBox(height: 2),
          Text(
            'VOICE OF SAKTHI',
            style: TextStyle(
              fontFamily: 'Rajdhani',
              color: active ? accent : context.tokens.textPrimary,
              fontSize: 8,
              fontWeight: FontWeight.w900,
              letterSpacing: 0.4,
            ),
          ),
        ],
      ),
    );
  }
}
