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
  const AppSideNavRail({super.key});

  static const _tabs = [
    (
      path: AppRoutes.dashboard,
      icon: Icons.home_outlined,
      activeIcon: Icons.home,
      label: 'Home',
    ),
    (
      path: AppRoutes.tbt,
      icon: Icons.play_circle_outline,
      activeIcon: Icons.play_circle,
      label: 'Explore',
    ),
    (
      path: AppRoutes.workshops,
      icon: Icons.event_outlined,
      activeIcon: Icons.event,
      label: 'Workshops',
    ),
    (
      path: AppRoutes.notifications,
      icon: Icons.notifications_outlined,
      activeIcon: Icons.notifications,
      label: 'Alerts',
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
    final location = GoRouterState.of(context).uri.path;
    final activeIndex = _tabs.indexWhere((t) => location.startsWith(t.path));

    return NavigationRail(
      backgroundColor: context.tokens.bgSurface,
      selectedIndex: activeIndex < 0 ? 0 : activeIndex,
      onDestinationSelected: (i) => context.go(_tabs[i].path),
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
