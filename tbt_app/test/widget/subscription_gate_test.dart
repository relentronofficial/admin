import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:tbt_app/config/ui_strings.dart';
import 'package:tbt_app/core/constants/routes.dart';
import 'package:tbt_app/features/auth/domain/auth_state.dart';
import 'package:tbt_app/features/auth/domain/member_status.dart';
import 'package:tbt_app/features/auth/providers/auth_provider.dart';
import 'package:tbt_app/shared/models/member.dart';
import 'package:tbt_app/shared/providers/me_provider.dart';
import 'package:tbt_app/shared/providers/site_config_provider.dart';
import 'package:tbt_app/shared/theme/tbt_theme.dart';
import 'package:tbt_app/shared/widgets/subscription_gate.dart';

// ── Fakes ─────────────────────────────────────────────────────────────────────

class _FakeMeNotifier extends MeNotifier {
  _FakeMeNotifier(this._value);
  final AsyncValue<Member> _value;

  @override
  Future<Member> build() {
    switch (_value) {
      case AsyncLoading():
        return Completer<Member>().future;
      case AsyncError(:final error, :final stackTrace):
        return Future.error(error, stackTrace);
      case AsyncData(:final value):
        return Future.value(value);
      default:
        return Completer<Member>().future;
    }
  }
}

class _FakeAuthNotifier extends AuthNotifier {
  @override
  Future<AuthState> build() async => const AuthState();

  @override
  Future<void> logout() async =>
      state = const AsyncData(AuthState(step: AuthStep.idle));
}

class _FakeUiStringsNotifier extends UiStringsNotifier {
  @override
  Future<UiStrings> build() async => const UiStrings();
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const _activePremiumMember = Member(
  id: '1',
  name: 'Premium User',
  phone: '9999999999',
  status: MemberStatus.active,
  membershipPlan: 'premium',
);

const _pendingMember = Member(
  id: '2',
  name: 'Pending User',
  phone: '8888888888',
  status: MemberStatus.pending,
  membershipPlan: 'free',
);

const _freeMember = Member(
  id: '3',
  name: 'Free User',
  phone: '7777777777',
  status: MemberStatus.active,
  membershipPlan: 'free',
);

// ── Widget builder ────────────────────────────────────────────────────────────

Widget _buildGate({
  required AsyncValue<Member> memberState,
  String location = AppRoutes.dashboard,
}) {
  return ProviderScope(
    overrides: [
      meNotifierProvider.overrideWith(() => _FakeMeNotifier(memberState)),
      uiStringsNotifierProvider.overrideWith(() => _FakeUiStringsNotifier()),
      authNotifierProvider.overrideWith(() => _FakeAuthNotifier()),
    ],
    child: MaterialApp.router(
      routerConfig: GoRouter(
        initialLocation: location,
        routes: [
          GoRoute(
            path: AppRoutes.dashboard,
            builder: (_, __) =>
                const SubscriptionGate(child: Text('child content')),
          ),
          GoRoute(
            path: AppRoutes.products, // '/Products'
            builder: (_, __) =>
                const SubscriptionGate(child: Text('child content')),
          ),
          GoRoute(
            path: AppRoutes.login,
            builder: (_, __) => const Scaffold(),
          ),
        ],
      ),
      theme: ThemeData.dark().copyWith(
        extensions: const [TbtTheme.defaults],
      ),
    ),
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

void main() {
  group('SubscriptionGate', () {
    testWidgets('shows loading spinner while member data is pending',
        (tester) async {
      await tester.pumpWidget(
          _buildGate(memberState: const AsyncLoading()));
      // Single pump — do NOT pumpAndSettle; spinner animates indefinitely.
      await tester.pump();

      expect(find.byType(CircularProgressIndicator), findsAtLeastNWidgets(1));
      expect(find.text('child content'), findsNothing);
    });

    testWidgets('passes child through when member load errors', (tester) async {
      await tester.pumpWidget(_buildGate(
        memberState:
            AsyncError(Exception('offline'), StackTrace.empty),
      ));
      await tester.pumpAndSettle();

      expect(find.text('child content'), findsOneWidget);
    });

    testWidgets('shows pending interceptor when member status is pending',
        (tester) async {
      await tester.pumpWidget(
          _buildGate(memberState: const AsyncData(_pendingMember)));
      await tester.pumpAndSettle();

      // Fallback title when UiStrings has no pendingApprovalTitle
      expect(find.text('Awaiting Approval'), findsOneWidget);
      expect(find.text('child content'), findsNothing);
    });

    testWidgets('shows upgrade interceptor when membershipPlan is free',
        (tester) async {
      await tester.pumpWidget(
          _buildGate(memberState: const AsyncData(_freeMember)));
      await tester.pumpAndSettle();

      // Fallback title when UiStrings has no freeInterceptorTitle
      expect(find.text('Upgrade Your Plan'), findsOneWidget);
      expect(find.text('child content'), findsNothing);
    });

    testWidgets('passes child through for active premium member',
        (tester) async {
      await tester.pumpWidget(
          _buildGate(memberState: const AsyncData(_activePremiumMember)));
      await tester.pumpAndSettle();

      expect(find.text('child content'), findsOneWidget);
      expect(find.text('Awaiting Approval'), findsNothing);
      expect(find.text('Upgrade Your Plan'), findsNothing);
    });

    testWidgets(
        'bypasses gate on exempt route /Products even for pending member',
        (tester) async {
      await tester.pumpWidget(_buildGate(
        memberState: const AsyncData(_pendingMember),
        location: AppRoutes.products,
      ));
      await tester.pumpAndSettle();

      expect(find.text('child content'), findsOneWidget);
      expect(find.text('Awaiting Approval'), findsNothing);
    });
  });
}
