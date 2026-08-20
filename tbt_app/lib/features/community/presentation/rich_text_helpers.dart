import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';

import '../../../shared/theme/design_constants.dart';

/// Parses `@mentions` and #hashtags out of post / comment text and
/// returns a list of `TextSpan`s ready to drop into a `RichText`.
///
/// Contract:
///   * `@Priya`   → red bold span, tap fires [onMention]("Priya")
///   * `#growth`  → red bold span, tap fires [onHashtag]("growth")
///   * Everything else → plain span using [baseStyle]
///
/// The parser is conservative — it only matches word characters after
/// the sigil, and it stops at whitespace / punctuation. It doesn't try
/// to resolve `@Priya` to a specific member ID (that's item #26 phase 2
/// with the search endpoint); the callback receives the raw name so
/// today we can show a toast, and tomorrow open the profile sheet.
List<InlineSpan> buildMentionSpans(
  String text, {
  required TextStyle baseStyle,
  ValueChanged<String>? onMention,
  ValueChanged<String>? onHashtag,
}) {
  final spans = <InlineSpan>[];
  final pattern = RegExp(r'(@[A-Za-z][A-Za-z0-9_]*|#[A-Za-z][A-Za-z0-9_]*)');
  int cursor = 0;

  for (final match in pattern.allMatches(text)) {
    if (match.start > cursor) {
      spans.add(TextSpan(
        text: text.substring(cursor, match.start),
        style: baseStyle,
      ));
    }
    final token = match.group(0)!;
    final isMention = token.startsWith('@');
    final name = token.substring(1);
    spans.add(TextSpan(
      text: token,
      style: baseStyle.copyWith(
        color: kColorAccent,
        fontWeight: FontWeight.w700,
      ),
      recognizer: TapGestureRecognizer()
        ..onTap = () {
          if (isMention) {
            onMention?.call(name);
          } else {
            onHashtag?.call(name);
          }
        },
    ));
    cursor = match.end;
  }

  if (cursor < text.length) {
    spans.add(TextSpan(
      text: text.substring(cursor),
      style: baseStyle,
    ));
  }

  return spans;
}
