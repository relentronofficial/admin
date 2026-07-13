import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/constants/routes.dart';
import '../providers/site_config_provider.dart';
import '../theme/design_constants.dart';
import '../theme/tbt_theme.dart';

/// Persistent bottom tab bar for the authenticated shell.
/// 5 tabs: Dashboard · Explore · Workshops · Notifications · Profile.
class AppBottomTabBar extends ConsumerWidget {
  const AppBottomTabBar({super.key});

  static const _tabs = [
    (path: AppRoutes.dashboard, icon: Icons.home_outlined,
        activeIcon: Icons.home),
    (path: AppRoutes.tbt, icon: Icons.play_circle_outline,
        activeIcon: Icons.play_circle),
    (path: AppRoutes.workshops, icon: Icons.event_outlined,
        activeIcon: Icons.event),
    (path: AppRoutes.notifications, icon: Icons.notifications_outlined,
        activeIcon: Icons.notifications),
    (path: AppRoutes.profile, icon: Icons.person_outline,
        activeIcon: Icons.person),
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final uiStrings = ref.watch(uiStringsNotifierProvider).valueOrNull;
    final accent = context.tbt.accent;

    final labels = [
      uiStrings?.dashboardWelcome != null ? 'Home' : 'Home',
      'Explore',
      'Workshops',
      'Alerts',
      'Profile',
    ];

    final location = GoRouterState.of(context).uri.path;
    final activeIndex =
        _tabs.indexWhere((t) => location.startsWith(t.path));

    return Container(
      decoration: const BoxDecoration(
        color: kColorBgSurface,
        border: Border(top: BorderSide(color: kColorBorderCard)),
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 56,
          child: Row(
            children: List.generate(_tabs.length, (i) {
              final tab = _tabs[i];
              final isActive = i == activeIndex;
              final color = isActive ? accent : kColorTextMuted;

              return Expanded(
                child: Semantics(
                  label: labels[i],
                  selected: isActive,
                  button: true,
                  child: InkWell(
                  onTap: () => context.go(tab.path),
                  splashColor: accent.withAlpha(0x1a),
                  highlightColor: Colors.transparent,
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        isActive ? tab.activeIcon : tab.icon,
                        color: color,
                        size: 22,
                      ),
                      const SizedBox(height: 3),
                      Text(
                        labels[i],
                        style: TextStyle(
                          color: color,
                          fontSize: 10,
                          fontWeight: isActive
                              ? FontWeight.w700
                              : FontWeight.w500,
                          letterSpacing: 0.3,
                        ),
                      ),
                    ],
                  ),
                ),
                ),
              );
            }),
          ),
        ),
      ),
    );
  }
}
