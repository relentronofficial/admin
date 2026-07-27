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
///   * `revoked`  — reserved. NOT set automatically anymore. Per the
///                  product decision documented on `AuthNotifier.build`,
///                  the session persists until the user MANUALLY logs
///                  out; refresh 401/403 no longer flips this state
///                  because Redis/Upstash blips were causing spurious
///                  mid-session logouts. Left in the enum in case a
///                  future admin-forced session-kill (via socket
///                  event, say) needs to route the user through the
///                  same "session expired" flow. The router still
///                  handles this state defensively if something sets
///                  it, but nothing in the client currently does.
enum SessionState { live, offline, revoked }

/// Global signal — read anywhere, updated from the auth pipeline.
final sessionStateProvider =
    StateProvider<SessionState>((_) => SessionState.live);
