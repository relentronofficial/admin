import 'dart:ui';

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
///
/// Tapping a tab switches the active StatefulNavigationShell branch
/// (preserving that branch's own navigator stack) rather than calling
/// `context.go(...)`, which used to wipe the stack and cause the
/// system back button to exit the app.
class AppBottomTabBar extends ConsumerWidget {
  const AppBottomTabBar({super.key, this.navigationShell});

  /// The stateful shell that owns the branch stacks. Optional so the
  /// widget still renders in isolated tests, but in normal app runs
  /// this is provided by `_AppShell`.
  final StatefulNavigationShell? navigationShell;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // ref.watch keeps this widget in sync with ui-string changes even
    // though we don't inline them here yet.
    ref.watch(uiStringsNotifierProvider);
    final accent = context.tbt.accent;
    // Prefer the shell's own currentIndex (survives when the user is on
    // a pushed inner route within a branch). Fall back to path sniffing
    // when the shell isn't wired (tests, previews).
    final activeIndex = navigationShell?.currentIndex ??
        _activeIndexFor(GoRouterState.of(context).uri.path);

    void goBranch(int i, String fallbackPath) {
      if (navigationShell != null) {
        navigationShell!.goBranch(
          i,
          // Reset the branch to its root when re-tapping the active
          // tab — matches the standard iOS/Android "tap tab twice to
          // pop to root" behaviour.
          initialLocation: i == navigationShell!.currentIndex,
        );
      } else {
        context.go(fallbackPath);
      }
    }

    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      color: Colors.transparent,
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 75,
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              // Layer 1 — glassmorphic backdrop with top-radius 24.
              Positioned.fill(
                child: ClipRRect(
                  borderRadius: const BorderRadius.only(
                    topLeft: Radius.circular(24),
                    topRight: Radius.circular(24),
                  ),
                  child: BackdropFilter(
                    filter: ImageFilter.blur(sigmaX: 15, sigmaY: 15),
                    child: Container(
                      decoration: BoxDecoration(
                        color: isDark
                            ? const Color(0xFF151515).withValues(alpha: 0.85)
                            : Colors.white.withValues(alpha: 0.90),
                        borderRadius: const BorderRadius.only(
                          topLeft: Radius.circular(24),
                          topRight: Radius.circular(24),
                        ),
                        border: Border.all(
                          color: context.tokens.borderCard,
                          width: 1,
                        ),
                      ),
                    ),
                  ),
                ),
              ),

              // Layer 2 — tab items row
              Positioned.fill(
                child: Row(
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
                        onTap: () => goBranch(0, AppRoutes.dashboard),
                      ),
                    ),
                    Expanded(
                      child: _TabItem(
                        label: 'WINS',
                        icon: Icons.emoji_events_outlined,
                        activeIcon: Icons.emoji_events,
                        active: activeIndex == 1,
                        accent: accent,
                        onTap: () => goBranch(1, AppRoutes.wins),
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
                        onTap: () => goBranch(3, AppRoutes.courses),
                      ),
                    ),
                    Expanded(
                      child: _TabItem(
                        label: 'PROFILE',
                        icon: Icons.person_outline,
                        activeIcon: Icons.person,
                        active: activeIndex == 4,
                        accent: accent,
                        onTap: () => goBranch(4, AppRoutes.profile),
                      ),
                    ),
                  ],
                ),
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
                    onTap: () => goBranch(2, AppRoutes.podcasts),
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
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final inactiveColor = isDark ? Colors.white38 : Colors.black45;

    // Active tab renders as a pill (52 px tall, radius 12, subtle bg).
    // Inactive tab is plain icon + label. Matches co-worker's
    // `_buildNavItem` selected/unselected branches (main.dart:4335).
    if (active) {
      return Semantics(
        label: label,
        selected: true,
        button: true,
        child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 4),
          height: 52,
          decoration: BoxDecoration(
            color: isDark
                ? Colors.white.withValues(alpha: 0.12)
                : Colors.black.withValues(alpha: 0.06),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isDark
                  ? Colors.white.withValues(alpha: 0.18)
                  : Colors.black.withValues(alpha: 0.12),
              width: 1,
            ),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(activeIcon, color: accent, size: 20),
              const SizedBox(height: 3),
              FittedBox(
                fit: BoxFit.scaleDown,
                child: Text(
                  label,
                  style: TextStyle(
                    color: accent,
                    fontSize: 10,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    }

    return Semantics(
      label: label,
      selected: false,
      button: true,
      child: InkWell(
        onTap: onTap,
        splashColor: accent.withValues(alpha: 0.10),
        highlightColor: Colors.transparent,
        child: SizedBox(
          height: 52,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, color: inactiveColor, size: 22),
              const SizedBox(height: 4),
              FittedBox(
                fit: BoxFit.scaleDown,
                child: Text(
                  label,
                  style: TextStyle(
                    color: inactiveColor,
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
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
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Raised 54x54 avatar circle. Matches co-worker's
          // `_buildVoiceOfSakthiItem` (main.dart:4438) — amber border
          // idle, red when active, image asset of Sakthi.
          Container(
            width: 54,
            height: 54,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(
                color: active ? accent : Colors.amber.shade700,
                width: 2.0,
              ),
              image: const DecorationImage(
                image: AssetImage('assets/images/nav  bar.jpeg'),
                fit: BoxFit.cover,
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.4),
                  blurRadius: 8,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
          ),
          const SizedBox(height: 3),
          FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              'VOICE OF SAKTHI',
              style: TextStyle(
                fontFamily: 'Rajdhani',
                color: active
                    ? accent
                    : (isDark ? Colors.white70 : Colors.black87),
                fontSize: 8.5,
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
