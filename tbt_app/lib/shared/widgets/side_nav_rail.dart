import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/constants/routes.dart';
import '../providers/site_config_provider.dart';
import '../theme/tbt_theme.dart';
import '../theme/theme_tokens.dart';

/// Side navigation rail for tablet / iPad layouts.
///
/// Same 5 destinations as [AppBottomTabBar], rendered as a vertical
/// rail on the leading edge of the shell when the app runs on a wider
/// screen (≥600dp shortest side). This is the standard iOS/Material 3
/// tablet pattern — keeps the persistent-nav affordance visible while
/// giving lists more horizontal room to breathe.
///
/// Coupled with [AppBottomTabBar] via `_AppShell` — one is shown, the
/// other is hidden, based on the current width.
class AppSideNavRail extends ConsumerWidget {
  const AppSideNavRail({super.key, this.navigationShell});

  /// Optional stateful shell — when provided, tab taps switch branches
  /// instead of `context.go`, matching [AppBottomTabBar].
  final StatefulNavigationShell? navigationShell;

  static const _tabs = [
    (
      path: AppRoutes.dashboard,
      icon: Icons.home_outlined,
      activeIcon: Icons.home,
      label: 'Home',
    ),
    (
      path: AppRoutes.wins,
      icon: Icons.emoji_events_outlined,
      activeIcon: Icons.emoji_events,
      label: 'Wins',
    ),
    (
      path: AppRoutes.podcasts,
      icon: Icons.mic_none_outlined,
      activeIcon: Icons.mic,
      label: 'Voice of Sakthi',
    ),
    (
      path: AppRoutes.courses,
      icon: Icons.school_outlined,
      activeIcon: Icons.school,
      label: 'Courses',
    ),
    (
      path: AppRoutes.profile,
      icon: Icons.person_outline,
      activeIcon: Icons.person,
      label: 'Profile',
    ),
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Read to keep the widget rebuilding when ui-strings change,
    // matching the bottom-tab-bar contract.
    ref.watch(uiStringsNotifierProvider);
    final accent = context.tbt.accent;
    final activeIndex = navigationShell?.currentIndex ??
        () {
          final location = GoRouterState.of(context).uri.path;
          return _tabs.indexWhere((t) => location.startsWith(t.path));
        }();

    return NavigationRail(
      backgroundColor: context.tokens.bgSurface,
      selectedIndex: activeIndex < 0 ? 0 : activeIndex,
      onDestinationSelected: (i) {
        if (navigationShell != null) {
          navigationShell!.goBranch(
            i,
            initialLocation: i == navigationShell!.currentIndex,
          );
        } else {
          context.go(_tabs[i].path);
        }
      },
      labelType: NavigationRailLabelType.all,
      selectedIconTheme: IconThemeData(color: accent, size: 26),
      unselectedIconTheme:
          IconThemeData(color: context.tokens.textMuted, size: 22),
      selectedLabelTextStyle: TextStyle(
        color: accent,
        fontSize: 11,
        fontWeight: FontWeight.w700,
      ),
      unselectedLabelTextStyle: TextStyle(
        color: context.tokens.textMuted,
        fontSize: 11,
        fontWeight: FontWeight.w500,
      ),
      indicatorColor: accent.withAlpha(0x1a),
      destinations: [
        for (final t in _tabs)
          NavigationRailDestination(
            icon: Icon(t.icon),
            selectedIcon: Icon(t.activeIcon),
            label: Text(t.label),
          ),
      ],
    );
  }
}
