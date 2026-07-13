import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';
import 'package:patrol/patrol.dart';
import 'package:tbt_app/features/batch_program/data/batch_service.dart';
import 'package:tbt_app/features/batch_program/presentation/batch_day_screen.dart';
import 'package:tbt_app/features/batch_program/providers/batch_provider.dart';
import 'package:tbt_app/shared/models/batch.dart';

// ── Mock ──────────────────────────────────────────────────────────────────────

class _MockBatchService extends Mock implements BatchService {}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const _task1 = BatchTask(
  id: 't1',
  title: 'Watch intro video',
  type: BatchTaskType.watch,
);

const _task2 = BatchTask(
  id: 't2',
  title: 'Write reflection',
  type: BatchTaskType.written,
);

const _dayInProgress = BatchDay(
  dayNumber: 1,
  status: BatchDayStatus.inProgress,
  tasks: [_task1, _task2],
);

const _dayApproved = BatchDay(
  dayNumber: 1,
  status: BatchDayStatus.approved,
  tasks: [_task1],
);

const _emptyProgram = BatchProgram(
  batch: BatchInfo(id: 'b1', name: 'Batch 1'),
  totalDays: 90,
);

// ── Widget builder ────────────────────────────────────────────────────────────

Widget _buildBatchDay({
  required BatchDay? day,
  bool loading = false,
  bool error = false,
  _MockBatchService? service,
}) {
  final svc = service ?? _MockBatchService();
  when(() => svc.saveDraft(
        any(),
        completedTaskIds: any(named: 'completedTaskIds'),
        taskSubmissions: any(named: 'taskSubmissions'),
      )).thenAnswer((_) async {});

  return ProviderScope(
    overrides: [
      batchDayProvider(1).overrideWith((_) {
        if (loading) return Completer<BatchDay?>().future;
        if (error) return Future<BatchDay?>.error(Exception('load failed'));
        return Future.value(day);
      }),
      batchProgramProvider.overrideWith((_) => Future.value(_emptyProgram)),
      batchDayApprovedNotifierProvider.overrideWith(
          () => _FakeApprovedNotifier()),
      batchServiceProvider.overrideWithValue(svc),
    ],
    child: MaterialApp.router(
      routerConfig: GoRouter(
        initialLocation: '/batch-program/1',
        routes: [
          GoRoute(
            path: '/batch-program',
            builder: (_, __) => const Scaffold(),
          ),
          GoRoute(
            path: '/batch-program/:day',
            builder: (_, s) => BatchDayScreen(
              day: int.tryParse(s.pathParameters['day'] ?? '') ?? 1,
            ),
          ),
        ],
      ),
    ),
  );
}

class _FakeApprovedNotifier extends BatchDayApprovedNotifier {
  @override
  BatchDayApprovedEvent? build() => null;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

void main() {
  setUpAll(() {
    registerFallbackValue(<String>[]);
    registerFallbackValue(<String, Map<String, String?>>{});
  });

  group('BatchDayScreen flow', () {
    patrolTest(
      'shows loading indicator while day data is loading',
      ($) async {
        // Do NOT use pumpWidgetAndSettle — CircularProgressIndicator animates.
        await $.tester.pumpWidget(_buildBatchDay(day: null, loading: true));
        await $.pump();

        expect(
          $(find.byType(CircularProgressIndicator)),
          findsAtLeastNWidgets(1),
        );
      },
    );

    patrolTest(
      'shows "Day not found" when provider returns null',
      ($) async {
        await $.pumpWidgetAndSettle(_buildBatchDay(day: null));

        expect($('Day not found'), findsOneWidget);
      },
    );

    patrolTest(
      'renders task titles when day data loads successfully',
      ($) async {
        await $.pumpWidgetAndSettle(_buildBatchDay(day: _dayInProgress));

        expect($('Watch intro video'), findsOneWidget);
        expect($('Write reflection'), findsOneWidget);
      },
    );

    patrolTest(
      'shows error message and Retry button when provider errors',
      ($) async {
        await $.pumpWidgetAndSettle(_buildBatchDay(day: null, error: true));

        expect($('Failed to load day'), findsOneWidget);
        expect($('Retry'), findsOneWidget);
      },
    );

    patrolTest(
      'submit button is disabled when no tasks are completed',
      ($) async {
        await $.pumpWidgetAndSettle(_buildBatchDay(day: _dayInProgress));

        final button = $.tester.widget<ElevatedButton>(
          find.widgetWithText(ElevatedButton, 'Submit Day for Review'),
        );
        expect(button.onPressed, isNull);
      },
    );

    patrolTest(
      'submit button enables after checking a task',
      ($) async {
        await $.pumpWidgetAndSettle(_buildBatchDay(day: _dayInProgress));

        // Confirm disabled initially.
        final before = $.tester.widget<ElevatedButton>(
          find.widgetWithText(ElevatedButton, 'Submit Day for Review'),
        );
        expect(before.onPressed, isNull);

        // Tap the first task — single pump to avoid auto-save timer settling.
        await $.tester.tap(find.text('Watch intro video'));
        await $.pump();

        // Submit button should now be enabled.
        final after = $.tester.widget<ElevatedButton>(
          find.widgetWithText(ElevatedButton, 'Submit Day for Review'),
        );
        expect(after.onPressed, isNotNull);
      },
    );

    patrolTest(
      'approved day shows APPROVED status and hides submit button',
      ($) async {
        await $.pumpWidgetAndSettle(_buildBatchDay(day: _dayApproved));

        expect($('APPROVED'), findsOneWidget);
        expect(
          $(find.textContaining('approved by your mentor')),
          findsOneWidget,
        );
        expect($('Submit Day for Review'), findsNothing);
      },
    );
  });
}
