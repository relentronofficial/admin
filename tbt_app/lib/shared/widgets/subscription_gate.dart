import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/constants/routes.dart';
import '../../features/auth/domain/member_status.dart';
import '../../features/auth/providers/auth_provider.dart';
import '../providers/me_provider.dart';
import '../providers/site_config_provider.dart';
import '../theme/tbt_theme.dart';

import '../../shared/theme/theme_tokens.dart';
/// Routes that bypass the subscription gate entirely.
const _exemptRoutes = {AppRoutes.products, AppRoutes.profile};

bool _isExempt(String location) =>
    _exemptRoutes.any((r) => location.startsWith(r));

/// Wraps platform content and enforces subscription state.
///
/// pending  → [_PendingInterceptor] (sign-out only)
/// free     → [_FreeInterceptor] (upgrade prompt)
/// otherwise → [child] pass-through
class SubscriptionGate extends ConsumerWidget {
  const SubscriptionGate({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final location = GoRouterState.of(context).uri.toString();
    if (_isExempt(location)) return child;

    final meAsync = ref.watch(meNotifierProvider);

    return meAsync.when(
      loading: () => const _GateLoading(),
      error: (_, __) => child,
      data: (me) {
        if (me.status == MemberStatus.pending) {
          return _PendingInterceptor(widgetRef: ref);
        }
        if (me.membershipPlan == 'free') {
          return _FreeInterceptor(widgetRef: ref);
        }
        return child;
      },
    );
  }
}

// ── Shared scaffold ───────────────────────────────────────────────────────────

class _GateLoading extends StatelessWidget {
  const _GateLoading();

  @override
  Widget build(BuildContext context) => Scaffold(
        body: Center(
          child: CircularProgressIndicator(
              color: Theme.of(context).colorScheme.primary),
        ),
      );
}

class _InterceptorScaffold extends StatelessWidget {
  const _InterceptorScaffold({
    required this.title,
    required this.body,
    required this.actions,
  });

  final String title;
  final String body;
  final List<Widget> actions;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                title,
                textAlign: TextAlign.center,
                style: TextStyle(
          fontFamily: 'Rajdhani',
                  fontSize: 24,
                  fontWeight: FontWeight.w700,
                  color: context.tokens.textPrimary,
                  letterSpacing: 1.5,
                ),
              ),
              const SizedBox(height: 16),
              Text(
                body,
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: context.tokens.textSecondary,
                  fontSize: 14,
                  height: 1.5,
                ),
              ),
              const SizedBox(height: 40),
              ...actions,
            ],
          ),
        ),
      ),
    );
  }
}

// ── Pending interceptor ────────────────────────────────────────────────────────

class _PendingInterceptor extends ConsumerWidget {
  const _PendingInterceptor({required this.widgetRef});

  final WidgetRef widgetRef;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final strings = ref.watch(uiStringsNotifierProvider).valueOrNull;
    final title = strings?.pendingApprovalTitle ?? 'Awaiting Approval';
    final body = strings?.pendingApprovalBody ??
        'Your account is under review. You\'ll be notified once approved.';

    return _InterceptorScaffold(
      title: title,
      body: body,
      actions: [
        SizedBox(
          height: 48,
          child: ElevatedButton(
            onPressed: () async {
              await ref.read(authNotifierProvider.notifier).logout();
              if (context.mounted) context.go(AppRoutes.login);
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: context.tokens.bgSurface,
              foregroundColor: context.tokens.textPrimary,
              side: BorderSide(color: context.tokens.borderCard),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
              ),
              elevation: 0,
            ),
            child: Text(
              'SIGN OUT',
              style: TextStyle(
          fontFamily: 'Rajdhani',
                fontSize: 15,
                fontWeight: FontWeight.w700,
                letterSpacing: 2,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

// ── Free interceptor ──────────────────────────────────────────────────────────

class _FreeInterceptor extends ConsumerWidget {
  const _FreeInterceptor({required this.widgetRef});

  final WidgetRef widgetRef;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final strings = ref.watch(uiStringsNotifierProvider).valueOrNull;
    final title = strings?.freeInterceptorTitle ?? 'Upgrade Your Plan';
    final body = strings?.freeInterceptorBody ??
        'Access to this content requires an active membership.';
    final upgradeLabel = strings?.upgradeNowLabel ?? 'Upgrade Now';

    final accent = context.tbt.accent;

    return _InterceptorScaffold(
      title: title,
      body: body,
      actions: [
        SizedBox(
          height: 48,
          child: ElevatedButton(
            onPressed: () => context.go(AppRoutes.products),
            style: ElevatedButton.styleFrom(
              backgroundColor: accent,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
              ),
              elevation: 0,
            ),
            child: Text(
              upgradeLabel.toUpperCase(),
              style: TextStyle(
          fontFamily: 'Rajdhani',
                fontSize: 15,
                fontWeight: FontWeight.w700,
                letterSpacing: 2,
              ),
            ),
          ),
        ),
      ],
    );
  }
}
