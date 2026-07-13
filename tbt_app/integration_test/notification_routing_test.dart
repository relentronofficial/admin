import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:patrol/patrol.dart';
import 'package:tbt_app/core/utils/notification_router.dart';

// ── Minimal router ────────────────────────────────────────────────────────────

/// Mirrors all routes reachable via [resolveNotificationRoute] with stub screens.
GoRouter _buildRouter() => GoRouter(
      initialLocation: '/notifications',
      routes: [
        GoRoute(
          path: '/notifications',
          builder: (_, __) => const Center(child: Text('Notifications screen')),
        ),
        GoRoute(
          path: '/batch-program',
          builder: (_, __) => const Center(child: Text('Batch Program screen')),
          routes: [
            GoRoute(
              path: ':day',
              builder: (_, state) => Center(
                child: Text(
                    'Batch Day ${state.pathParameters['day']} screen'),
              ),
            ),
          ],
        ),
        GoRoute(
          path: '/learning',
          builder: (_, __) => const Center(child: Text('Learning screen')),
          routes: [
            GoRoute(
              path: 'badges',
              builder: (_, __) =>
                  const Center(child: Text('Badges screen')),
            ),
            GoRoute(
              path: ':courseId',
              builder: (_, state) => Center(
                child: Text(
                    'Course ${state.pathParameters['courseId']} screen'),
              ),
            ),
          ],
        ),
        GoRoute(
          path: '/messages',
          builder: (_, __) => const Center(child: Text('Messages screen')),
          routes: [
            GoRoute(
              path: ':conversationId',
              builder: (_, state) => Center(
                child: Text(
                    'Conversation ${state.pathParameters['conversationId']} screen'),
              ),
            ),
          ],
        ),
        GoRoute(
          path: '/live/:workshopSlug/:callId',
          builder: (_, state) => Center(
            child: Text(
                'Live ${state.pathParameters['workshopSlug']}/${state.pathParameters['callId']} screen'),
          ),
        ),
      ],
    );

Widget _buildApp(GoRouter router) =>
    MaterialApp.router(routerConfig: router);

// ── Tests ─────────────────────────────────────────────────────────────────────

void main() {
  group('Notification routing — resolveNotificationRoute integrates with GoRouter', () {
    patrolTest(
      'batch_day_approved with dayNumber routes to batch day screen',
      ($) async {
        final router = _buildRouter();
        await $.pumpWidgetAndSettle(_buildApp(router));

        final route = resolveNotificationRoute(
          type: 'batch_day_approved',
          metadata: {'dayNumber': 3},
        );

        router.go(route);
        await $.tester.pumpAndSettle();

        expect($('Batch Day 3 screen'), findsOneWidget);
      },
    );

    patrolTest(
      'batch_day_approved without dayNumber falls back to batch program list',
      ($) async {
        final router = _buildRouter();
        await $.pumpWidgetAndSettle(_buildApp(router));

        final route = resolveNotificationRoute(
          type: 'batch_day_approved',
          metadata: const {},
        );

        router.go(route);
        await $.tester.pumpAndSettle();

        expect($('Batch Program screen'), findsOneWidget);
      },
    );

    patrolTest(
      'course_access with courseId routes to course detail screen',
      ($) async {
        final router = _buildRouter();
        await $.pumpWidgetAndSettle(_buildApp(router));

        final route = resolveNotificationRoute(
          type: 'course_access',
          metadata: {'courseId': 'c-123'},
        );

        router.go(route);
        await $.tester.pumpAndSettle();

        expect($('Course c-123 screen'), findsOneWidget);
      },
    );

    patrolTest(
      'badge_award always routes to badges screen',
      ($) async {
        final router = _buildRouter();
        await $.pumpWidgetAndSettle(_buildApp(router));

        final route = resolveNotificationRoute(type: 'badge_award');

        router.go(route);
        await $.tester.pumpAndSettle();

        expect($('Badges screen'), findsOneWidget);
      },
    );

    patrolTest(
      'message with conversationId routes to conversation screen',
      ($) async {
        final router = _buildRouter();
        await $.pumpWidgetAndSettle(_buildApp(router));

        final route = resolveNotificationRoute(
          type: 'message',
          metadata: {'conversationId': 'conv-42'},
        );

        router.go(route);
        await $.tester.pumpAndSettle();

        expect($('Conversation conv-42 screen'), findsOneWidget);
      },
    );

    patrolTest(
      'live_call with slug and callId routes to live screen',
      ($) async {
        final router = _buildRouter();
        await $.pumpWidgetAndSettle(_buildApp(router));

        final route = resolveNotificationRoute(
          type: 'live_call',
          metadata: {'workshopSlug': 'biz-growth', 'callId': 'call-7'},
        );

        router.go(route);
        await $.tester.pumpAndSettle();

        expect($('Live biz-growth/call-7 screen'), findsOneWidget);
      },
    );

    patrolTest(
      'announcement always routes to notifications screen',
      ($) async {
        final router = _buildRouter();
        // Start away from /notifications to verify actual navigation.
        router.go('/learning');
        await $.pumpWidgetAndSettle(_buildApp(router));

        final route = resolveNotificationRoute(type: 'announcement');

        router.go(route);
        await $.tester.pumpAndSettle();

        expect($('Notifications screen'), findsOneWidget);
      },
    );

    patrolTest(
      'unknown type falls back to notifications screen',
      ($) async {
        final router = _buildRouter();
        router.go('/learning');
        await $.pumpWidgetAndSettle(_buildApp(router));

        final route =
            resolveNotificationRoute(type: 'completely_unknown_type');

        router.go(route);
        await $.tester.pumpAndSettle();

        expect($('Notifications screen'), findsOneWidget);
      },
    );
  });
}
