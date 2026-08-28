// Pure client-side mirror of the backend's message-action rules
// (backend/src/lib/chatMessageActionRules.ts). This is a UX convenience
// only — it decides whether to *show* the Edit action — the backend is
// the real authority and re-derives everything from its own clock and the
// message's server-recorded `createdAt`, never trusting this client.
//
// No Flutter/Riverpod imports — kept pure so it can be unit-tested with
// plain `flutter_test` package-only assertions.

/// Mirrors EDIT_WINDOW_MS on the backend.
const Duration kEditWindow = Duration(minutes: 5);

/// Whether the Edit action should still be offered for a message created
/// at [createdAt], evaluated against [now] (defaults to the device clock).
bool canEditMessageClientSide(DateTime createdAt, {DateTime? now}) {
  final at = now ?? DateTime.now();
  return at.difference(createdAt) < kEditWindow;
}
