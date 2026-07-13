import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:patrol/patrol.dart';
import 'package:tbt_app/core/constants/routes.dart';
import 'package:tbt_app/features/auth/domain/auth_state.dart';
import 'package:tbt_app/features/auth/presentation/login_screen.dart';
import 'package:tbt_app/features/auth/providers/auth_provider.dart';

// ── Fakes ─────────────────────────────────────────────────────────────────────

class _IdleAuthNotifier extends AuthNotifier {
  @override
  Future<AuthState> build() async => const AuthState(step: AuthStep.idle);
}

/// Never resolves — keeps provider in AsyncLoading indefinitely.
class _PermanentLoadingNotifier extends AuthNotifier {
  @override
  Future<AuthState> build() => Completer<AuthState>().future;
}

// ── Widget builder ────────────────────────────────────────────────────────────

Widget _buildLogin({AuthNotifier Function()? notifierFactory}) {
  return ProviderScope(
    overrides: [
      authNotifierProvider.overrideWith(
        notifierFactory ?? _IdleAuthNotifier.new,
      ),
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
            builder: (_, __) =>
                const Scaffold(body: Text('Forgot password')),
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
  group('Auth flow', () {
    patrolTest(
      'shows validation errors when both fields are submitted empty',
      ($) async {
        await $.pumpWidgetAndSettle(_buildLogin());

        await $('SIGN IN').tap();

        expect($('Phone number is required'), findsOneWidget);
        expect($('Password is required'), findsOneWidget);
      },
    );

    patrolTest(
      'shows only password error when phone is filled but password is empty',
      ($) async {
        await $.pumpWidgetAndSettle(_buildLogin());

        await $(find.widgetWithText(TextFormField, 'Enter your phone number'))
            .enterText('9876543210');
        await $('SIGN IN').tap();

        expect($('Phone number is required'), findsNothing);
        expect($('Password is required'), findsOneWidget);
      },
    );

    patrolTest(
      'password visibility toggle swaps icons',
      ($) async {
        await $.pumpWidgetAndSettle(_buildLogin());

        // Initially password is hidden.
        expect($(find.byIcon(Icons.visibility_off_outlined)), findsOneWidget);
        expect($(find.byIcon(Icons.visibility_outlined)), findsNothing);

        await $(find.byIcon(Icons.visibility_off_outlined))
            .tap(settlePolicy: SettlePolicy.noSettle);
        await $.pump();

        // Password is now visible.
        expect($(find.byIcon(Icons.visibility_outlined)), findsOneWidget);
        expect($(find.byIcon(Icons.visibility_off_outlined)), findsNothing);
      },
    );

    patrolTest(
      'SIGN IN button shows spinner when auth provider is loading',
      ($) async {
        // Do NOT use pumpWidgetAndSettle — spinner animates indefinitely.
        await $.tester.pumpWidget(
          _buildLogin(notifierFactory: _PermanentLoadingNotifier.new),
        );
        await $.pump();
        await $.pump();

        expect($(find.byType(CircularProgressIndicator)), findsOneWidget);
        expect($('SIGN IN'), findsNothing);
      },
    );

    patrolTest(
      'tapping Sign Up link navigates to the signup screen',
      ($) async {
        await $.pumpWidgetAndSettle(_buildLogin());

        await $('Sign Up').tap();

        expect($('Sign up'), findsOneWidget);
      },
    );
  });
}
