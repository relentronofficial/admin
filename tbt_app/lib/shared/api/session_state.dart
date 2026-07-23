import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Coarse-grained state of the member's session as inferred by the
/// auth pipeline. Distinct from `AuthState` (which is the app's local
/// auth intent) — this is the RUNTIME view of whether the tokens the
/// app holds are actually still valid on the backend.
///
/// The state machine is driven by the `RefreshInterceptor` and the
/// cold-start refresh in `AuthNotifier.build()`. Everything else in
/// the app just observes it:
///
///   * `live`     — happy path. Last refresh succeeded (or we haven't
///                  had to refresh yet).
///   * `offline`  — the last refresh failed transiently (network,
///                  timeout, 5xx). Tokens are still on disk; a later
///                  attempt is expected to recover. Screens should
///                  show a subtle "Reconnecting…" banner instead of
///                  redirecting anywhere.
///   * `revoked`  — the last refresh was explicitly denied by the
///                  backend (401/403 on POST /api/user-auth/refresh).
///                  The refresh token is dead. Tokens must be cleared
///                  and the user must sign in again. The router
///                  redirects to `/login?redirect=<return>` and a
///                  one-shot "session expired" dialog surfaces the
///                  reason so the flip isn't silent.
enum SessionState { live, offline, revoked }

/// Global signal — read anywhere, updated from the auth pipeline.
final sessionStateProvider =
    StateProvider<SessionState>((_) => SessionState.live);
