// Tests for the client-side "should the Edit action still show" mirror of
// the backend's 5-minute edit window. Pure Dart — no Flutter widgets,
// network, or Riverpod needed. The backend re-derives the real answer from
// its own clock (see chatMessageActionRules.test.ts on the backend) — this
// only covers the frontend's UX-convenience gating (test case F).
import 'package:flutter_test/flutter_test.dart';

import 'package:tbt_app/features/chat_groups/domain/chat_group_message_rules.dart';

void main() {
  final now = DateTime.parse('2026-08-28T12:00:00.000Z');

  group('canEditMessageClientSide', () {
    test('true just inside the 5-minute window', () {
      final createdAt = now.subtract(kEditWindow - const Duration(seconds: 1));
      expect(canEditMessageClientSide(createdAt, now: now), isTrue);
    });

    test('false at exactly the 5-minute boundary', () {
      final createdAt = now.subtract(kEditWindow);
      expect(canEditMessageClientSide(createdAt, now: now), isFalse);
    });

    test('false well past the window (test case F)', () {
      final createdAt = now.subtract(const Duration(minutes: 10));
      expect(canEditMessageClientSide(createdAt, now: now), isFalse);
    });

    test('true for a message created this instant', () {
      expect(canEditMessageClientSide(now, now: now), isTrue);
    });
  });
}
