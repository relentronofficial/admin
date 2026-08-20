/// Relative time formatting for feed cards, comments, notifications,
/// activity logs — anywhere the exact timestamp isn't as useful as a
/// glanceable "how long ago".
///
/// Format table (matches speckit item #7):
///
///   * `< 60 s`      → `just now`
///   * `< 60 min`    → `${n}m`      e.g. `12m`
///   * `< 24 h`      → `${n}h`      e.g. `3h`
///   * `<  7 d`      → `${n}d`      e.g. `2d`
///   * `< 52 w`      → `${n}w`      e.g. `4w`
///   * same year     → `MMM d`      e.g. `Jul 20`
///   * older         → `MMM d, yyyy` e.g. `Jul 20, 2025`
///
/// Compact form (no "ago" suffix) is intentional — matches the way X /
/// Threads / Instagram render timestamps in dense feeds. Screen readers
/// still get the readable form via a Semantics wrapper at the call site
/// if desired.

const List<String> _months = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

String timeAgo(DateTime when, {DateTime? now}) {
  final ref = now ?? DateTime.now();
  final diff = ref.difference(when);

  if (diff.isNegative) return 'now'; // clock skew — server ahead
  final seconds = diff.inSeconds;
  if (seconds < 60) return 'just now';

  final minutes = diff.inMinutes;
  if (minutes < 60) return '${minutes}m';

  final hours = diff.inHours;
  if (hours < 24) return '${hours}h';

  final days = diff.inDays;
  if (days < 7) return '${days}d';

  final weeks = (days / 7).floor();
  if (weeks < 52) return '${weeks}w';

  final month = _months[when.month - 1];
  if (when.year == ref.year) return '$month ${when.day}';
  return '$month ${when.day}, ${when.year}';
}

/// Long-form for tooltips / accessibility ("December 3 at 4:15 PM").
/// Not used by the feed line — reserved for the future overflow menu
/// "Copy timestamp" action.
String longTimestamp(DateTime when) {
  final month = _months[when.month - 1];
  final hour24 = when.hour;
  final hour12 = hour24 == 0 ? 12 : (hour24 > 12 ? hour24 - 12 : hour24);
  final ampm = hour24 >= 12 ? 'PM' : 'AM';
  final mm = when.minute.toString().padLeft(2, '0');
  return '$month ${when.day}, ${when.year} at $hour12:$mm $ampm';
}
