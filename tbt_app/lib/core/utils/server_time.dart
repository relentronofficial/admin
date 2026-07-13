// Mirrors getServerNow() / _serverTimeOffset in tbt-user-web/lib/api/client.ts.
// The offset is updated whenever a response carries a Date header; use
// getServerNow() instead of DateTime.now() for countdowns to avoid client
// clock skew.

int _offsetMs = 0;

/// Call this when a backend response includes a `Date` header.
void updateServerTimeOffset(DateTime serverTime) {
  _offsetMs = serverTime.millisecondsSinceEpoch -
      DateTime.now().millisecondsSinceEpoch;
}

/// Server-corrected current time.
DateTime getServerNow() => DateTime.fromMillisecondsSinceEpoch(
      DateTime.now().millisecondsSinceEpoch + _offsetMs,
    );
