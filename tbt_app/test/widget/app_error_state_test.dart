import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tbt_app/core/exceptions/app_exception.dart';
import 'package:tbt_app/shared/providers/connectivity_provider.dart';
import 'package:tbt_app/shared/widgets/app_error_state.dart';

/// Boilerplate to pump AppErrorState with a controllable connectivity
/// stream so we can assert the auto-retry contract without depending
/// on the platform channel that connectivity_plus normally listens to.
Widget _harness({
  required Object error,
  required VoidCallback? onRetry,
  required bool online,
}) {
  return ProviderScope(
    overrides: [
      connectivityProvider.overrideWith((_) => Stream<bool>.value(online)),
    ],
    child: MaterialApp(
      // Dark theme picks ThemeTokens.dark via the `context.tokens`
      // extension — any real Theme with brightness set works here.
      theme: ThemeData.dark(),
      localizationsDelegates: AppL10n.localizationsDelegates,
      supportedLocales: AppL10n.supportedLocales,
      home: Scaffold(
        body: AppErrorState(error: error, onRetry: onRetry),
      ),
    ),
  );
}

void main() {
  group('AppErrorState auto-retry', () {
    testWidgets('fires onRetry once ~800ms after mount for NetworkException',
        (tester) async {
      var retryCount = 0;
      await tester.pumpWidget(_harness(
        error: NetworkException('down'),
        onRetry: () => retryCount++,
        online: true,
      ));

      expect(retryCount, 0, reason: 'must not fire synchronously');
      await tester.pump(const Duration(milliseconds: 500));
      expect(retryCount, 0, reason: 'must wait the full 800ms');
      await tester.pump(const Duration(milliseconds: 400));
      expect(retryCount, 1, reason: 'fires once at ~800ms');

      // Advance well past the initial delay — retry must still be 1.
      await tester.pump(const Duration(seconds: 2));
      expect(retryCount, 1, reason: 'guarded to a single call per widget');
    });

    testWidgets('fires onRetry for UnauthorizedException too', (tester) async {
      var retryCount = 0;
      await tester.pumpWidget(_harness(
        error: UnauthorizedException('session'),
        onRetry: () => retryCount++,
        online: true,
      ));
      await tester.pump(const Duration(milliseconds: 900));
      expect(retryCount, 1);
    });

    testWidgets('does NOT fire for non-transient errors (ForbiddenException)',
        (tester) async {
      var retryCount = 0;
      await tester.pumpWidget(_harness(
        error: ForbiddenException('nope'),
        onRetry: () => retryCount++,
        online: true,
      ));
      await tester.pump(const Duration(seconds: 2));
      expect(retryCount, 0,
          reason: '403 is a permission decision — retrying would flap');
    });

    testWidgets('does NOT fire when no onRetry is provided', (tester) async {
      await tester.pumpWidget(_harness(
        error: NetworkException('down'),
        onRetry: null,
        online: true,
      ));
      // Pump forward — nothing should crash even without a callback.
      await tester.pump(const Duration(seconds: 2));
      // Reaching this assertion without an exception is the pass condition.
      expect(true, isTrue);
    });

    testWidgets('renders the "Session expired" copy for UnauthorizedException',
        (tester) async {
      await tester.pumpWidget(_harness(
        error: UnauthorizedException('session'),
        onRetry: null,
        online: true,
      ));
      expect(find.text('Session expired'), findsOneWidget);
    });

    testWidgets('renders "Check your connection" for NetworkException',
        (tester) async {
      await tester.pumpWidget(_harness(
        error: NetworkException('down'),
        onRetry: null,
        online: true,
      ));
      expect(find.text('Check your connection'), findsOneWidget);
    });
  });
}
