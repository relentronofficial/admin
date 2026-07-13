import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:tbt_app/core/constants/routes.dart';
import 'package:tbt_app/features/auth/domain/auth_state.dart';
import 'package:tbt_app/features/auth/presentation/login_screen.dart';
import 'package:tbt_app/features/auth/providers/auth_provider.dart';

// ── Fakes ─────────────────────────────────────────────────────────────────────

class _IdleAuthNotifier extends AuthNotifier {
  @override
  Future<AuthState> build() async => const AuthState(step: AuthStep.idle);
}

/// Auth notifier whose build() never completes — provider stays in AsyncLoading.
class _PermanentLoadingNotifier extends AuthNotifier {
  @override
  Future<AuthState> build() => Completer<AuthState>().future;
}

// ── Widget builder ────────────────────────────────────────────────────────────

Widget _buildLogin({AuthNotifier Function()? notifierFactory}) {
  return ProviderScope(
    overrides: [
      authNotifierProvider.overrideWith(notifierFactory ?? _IdleAuthNotifier.new),
    ],
    child: MaterialApp.router(
      routerConfig: GoRouter(
        initialLocation: AppRoutes.login,
        routes: [
          GoRoute(
            path: AppRoutes.login,
            builder: (_, __) => const LoginScreen(),
          ),
          GoRoute(
            path: AppRoutes.verify,
            builder: (_, __) => const Scaffold(body: Text('OTP screen')),
          ),
          GoRoute(
            path: AppRoutes.forgotPassword,
            builder: (_, __) => const Scaffold(body: Text('Forgot password')),
          ),
          GoRoute(
            path: AppRoutes.signup,
            builder: (_, __) => const Scaffold(body: Text('Sign up')),
          ),
        ],
      ),
    ),
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

void main() {
  group('LoginScreen', () {
    testWidgets('renders phone field, password field, and SIGN IN button',
        (tester) async {
      await tester.pumpWidget(_buildLogin());
      await tester.pumpAndSettle();

      expect(
        find.widgetWithText(TextFormField, 'Enter your phone number'),
        findsOneWidget,
      );
      expect(
        find.widgetWithText(TextFormField, 'Enter your password'),
        findsOneWidget,
      );
      expect(find.text('SIGN IN'), findsOneWidget);
    });

    testWidgets('shows validation error when phone is empty on submit',
        (tester) async {
      await tester.pumpWidget(_buildLogin());
      await tester.pumpAndSettle();

      // Tap SIGN IN without entering anything
      await tester.tap(find.text('SIGN IN'));
      await tester.pumpAndSettle();

      expect(find.text('Phone number is required'), findsOneWidget);
    });

    testWidgets('shows validation error when password is empty on submit',
        (tester) async {
      await tester.pumpWidget(_buildLogin());
      await tester.pumpAndSettle();

      // Fill phone but leave password empty
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Enter your phone number'),
        '9876543210',
      );
      await tester.tap(find.text('SIGN IN'));
      await tester.pumpAndSettle();

      expect(find.text('Password is required'), findsOneWidget);
    });

    testWidgets('shows spinner in SIGN IN button when auth is loading',
        (tester) async {
      await tester.pumpWidget(_buildLogin(notifierFactory: _PermanentLoadingNotifier.new));
      // pumpAndSettle would hang because CircularProgressIndicator animates;
      // pump once to process the state set in build().
      await tester.pump();
      await tester.pump();

      // Loading state: button shows spinner, not text
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      expect(find.text('SIGN IN'), findsNothing);
    });

    testWidgets('password visibility toggle changes icon', (tester) async {
      await tester.pumpWidget(_buildLogin());
      await tester.pumpAndSettle();

      // Initially shows visibility_off icon (password hidden)
      expect(find.byIcon(Icons.visibility_off_outlined), findsOneWidget);
      expect(find.byIcon(Icons.visibility_outlined), findsNothing);

      // Tap the visibility toggle
      await tester.tap(find.byIcon(Icons.visibility_off_outlined));
      await tester.pump();

      // Now shows visibility icon (password visible)
      expect(find.byIcon(Icons.visibility_outlined), findsOneWidget);
      expect(find.byIcon(Icons.visibility_off_outlined), findsNothing);
    });

    testWidgets('tapping "Sign Up" link navigates to signup route',
        (tester) async {
      await tester.pumpWidget(_buildLogin());
      await tester.pumpAndSettle();

      await tester.tap(find.text('Sign Up'));
      await tester.pumpAndSettle();

      expect(find.text('Sign up'), findsOneWidget);
    });
  });
}
