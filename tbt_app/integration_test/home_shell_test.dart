import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:patrol/patrol.dart';
import 'package:tbt_app/config/ui_strings.dart';
import 'package:tbt_app/core/constants/routes.dart';
import 'package:tbt_app/shared/providers/site_config_provider.dart';
import 'package:tbt_app/shared/theme/tbt_theme.dart';
import 'package:tbt_app/shared/widgets/bottom_tab_bar.dart';

// ── Fake ──────────────────────────────────────────────────────────────────────

class _FakeUiStringsNotifier extends UiStringsNotifier {
  @override
  Future<UiStrings> build() async => const UiStrings();
}

// ── Widget builder ────────────────────────────────────────────────────────────

/// Minimal authenticated shell: only the bottom tab bar + stub screens.
/// Skips AppNavbar and SubscriptionGate to avoid their provider dependencies.
Widget _buildShell() {
  final router = GoRouter(
    initialLocation: AppRoutes.dashboard,
    routes: [
      ShellRoute(
        builder: (_, __, child) => Scaffold(
          body: child,
          bottomNavigationBar: const AppBottomTabBar(),
        ),
        routes: [
          GoRoute(
            path: AppRoutes.dashboard,
            builder: (_, __) =>
                const Center(child: Text('Dashboard screen')),
          ),
          GoRoute(
            path: AppRoutes.tbt,
            builder: (_, __) =>
                const Center(child: Text('Explore screen')),
          ),
          GoRoute(
            path: AppRoutes.workshops,
            builder: (_, __) =>
                const Center(child: Text('Workshops screen')),
          ),
          GoRoute(
            path: AppRoutes.notifications,
            builder: (_, __) =>
                const Center(child: Text('Alerts screen')),
          ),
          GoRoute(
            path: AppRoutes.profile,
            builder: (_, __) =>
                const Center(child: Text('Profile screen')),
          ),
        ],
      ),
    ],
  );

  return ProviderScope(
    overrides: [
      uiStringsNotifierProvider.overrideWith(() => _FakeUiStringsNotifier()),
    ],
    child: MaterialApp.router(
      theme: ThemeData.dark().copyWith(
        extensions: const [TbtTheme.defaults],
      ),
      routerConfig: router,
    ),
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

void main() {
  group('Home shell — bottom tab navigation', () {
    patrolTest(
      'renders all five tab labels',
      ($) async {
        await $.pumpWidgetAndSettle(_buildShell());

        expect($('Home'), findsAtLeastNWidgets(1));
        expect($('Explore'), findsOneWidget);
        expect($('Workshops'), findsOneWidget);
        expect($('Alerts'), findsOneWidget);
        expect($('Profile'), findsAtLeastNWidgets(1));
      },
    );

    patrolTest(
      'tapping Explore tab navigates to the TBT/Explore screen',
      ($) async {
        await $.pumpWidgetAndSettle(_buildShell());

        expect($('Dashboard screen'), findsOneWidget);

        await $('Explore').tap();

        expect($('Explore screen'), findsOneWidget);
        expect($('Dashboard screen'), findsNothing);
      },
    );

    patrolTest(
      'tapping Workshops tab navigates to the Workshops screen',
      ($) async {
        await $.pumpWidgetAndSettle(_buildShell());

        await $('Workshops').tap();

        expect($('Workshops screen'), findsOneWidget);
      },
    );

    patrolTest(
      'tapping Profile tab navigates to the Profile screen',
      ($) async {
        await $.pumpWidgetAndSettle(_buildShell());

        await $('Profile').tap();

        expect($('Profile screen'), findsOneWidget);
        expect($('Dashboard screen'), findsNothing);
      },
    );

    patrolTest(
      'active tab icon changes when switching tabs',
      ($) async {
        await $.pumpWidgetAndSettle(_buildShell());

        // Dashboard is active initially.
        expect($(find.byIcon(Icons.home)), findsOneWidget);
        expect($(find.byIcon(Icons.home_outlined)), findsNothing);

        // Switch to Explore — home icon becomes outline.
        await $('Explore').tap();

        expect($(find.byIcon(Icons.home_outlined)), findsOneWidget);
        expect($(find.byIcon(Icons.play_circle)), findsOneWidget);
      },
    );
  });
}
