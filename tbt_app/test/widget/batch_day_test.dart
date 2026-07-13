import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';
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
  // Stub save draft so auto-save timer doesn't cause issues
  when(() => svc.saveDraft(
        any(),
        completedTaskIds: any(named: 'completedTaskIds'),
        taskSubmissions: any(named: 'taskSubmissions'),
      )).thenAnswer((_) async {});

  return ProviderScope(
    overrides: [
      batchDayProvider(1).overrideWith((_) {
        if (loading) return Completer<BatchDay?>().future; // never resolves → loading
        if (error) return Future<BatchDay?>.error(Exception('load failed'));
        return Future.value(day);
      }),
      batchProgramProvider.overrideWith((_) => Future.value(_emptyProgram)),
      batchDayApprovedNotifierProvider.overrideWith(() => _FakeApprovedNotifier()),
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
            builder: (ctx, s) => BatchDayScreen(
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
  BatchDayApprovedEvent? build() => null; // no socket setup in tests
}

// ── Tests ─────────────────────────────────────────────────────────────────────

void main() {
  setUpAll(() {
    registerFallbackValue(<String>[]);
    registerFallbackValue(<String, Map<String, String?>>{});
  });

  group('BatchDayScreen', () {
    testWidgets('shows loading indicator while data is loading', (tester) async {
      await tester.pumpWidget(_buildBatchDay(day: null, loading: true));
      await tester.pump(); // single pump — loading indicator animates

      expect(find.byType(CircularProgressIndicator), findsAtLeastNWidgets(1));
    });

    testWidgets('shows "Day not found" when provider returns null',
        (tester) async {
      await tester.pumpWidget(_buildBatchDay(day: null));
      await tester.pumpAndSettle();

      expect(find.text('Day not found'), findsOneWidget);
    });

    testWidgets('renders task titles when data loads', (tester) async {
      await tester.pumpWidget(_buildBatchDay(day: _dayInProgress));
      await tester.pumpAndSettle();

      expect(find.text('Watch intro video'), findsOneWidget);
      expect(find.text('Write reflection'), findsOneWidget);
    });

    testWidgets('shows error retry button when provider errors', (tester) async {
      await tester.pumpWidget(_buildBatchDay(day: null, error: true));
      await tester.pumpAndSettle();

      expect(find.text('Failed to load day'), findsOneWidget);
      expect(find.text('Retry'), findsOneWidget);
    });

    testWidgets('approved day shows read-only banner and hides submit button',
        (tester) async {
      await tester.pumpWidget(_buildBatchDay(day: _dayApproved));
      await tester.pumpAndSettle();

      // Status chip in header
      expect(find.text('APPROVED'), findsOneWidget);
      // Approval banner
      expect(
        find.textContaining('approved by your mentor'),
        findsOneWidget,
      );
      // No submit button — isReadOnly hides bottomNavigationBar
      expect(find.text('Submit Day for Review'), findsNothing);
    });

    testWidgets('submit button is disabled when no tasks are completed',
        (tester) async {
      await tester.pumpWidget(_buildBatchDay(day: _dayInProgress));
      await tester.pumpAndSettle();

      final button = tester.widget<ElevatedButton>(
        find.widgetWithText(ElevatedButton, 'Submit Day for Review'),
      );
      // hasAnyCompleted = false → onPressed is null
      expect(button.onPressed, isNull);
    });

    testWidgets('submit button enables after checking a task', (tester) async {
      await tester.pumpWidget(_buildBatchDay(day: _dayInProgress));
      await tester.pumpAndSettle();

      // Initially disabled
      final before = tester.widget<ElevatedButton>(
        find.widgetWithText(ElevatedButton, 'Submit Day for Review'),
      );
      expect(before.onPressed, isNull);

      // Tap the first task row to toggle it
      await tester.tap(find.text('Watch intro video'));
      await tester.pump();

      // Now enabled
      final after = tester.widget<ElevatedButton>(
        find.widgetWithText(ElevatedButton, 'Submit Day for Review'),
      );
      expect(after.onPressed, isNotNull);
    });
  });
}
