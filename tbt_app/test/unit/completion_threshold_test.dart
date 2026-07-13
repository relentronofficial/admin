// Tests the episode completion detection logic used by lesson_player_screen.dart.
//
// Contract: an episode is considered complete when
//   currentTime >= duration * 0.85
//
// The screen tracks this with a `_completionFired` bool reset on every lesson
// load. Once fired, subsequent time-update callbacks must not re-trigger the
// completion POST — preventing double-counting on seek or replay.

import 'package:flutter_test/flutter_test.dart';

// Pure extraction of the completion predicate from lesson_player_screen.dart.
bool _isComplete(double currentTime, double duration) =>
    duration > 0 && currentTime >= duration * 0.85;

void main() {
  group('completion threshold — 85 % of duration', () {
    // ── Boundary values ────────────────────────────────────────────────────
    test('returns true at exactly 85 %', () {
      const duration = 100.0;
      const current = 85.0; // exactly 85 %
      expect(_isComplete(current, duration), isTrue);
    });

    test('returns false just below 85 % (84.9 s of 100 s)', () {
      const duration = 100.0;
      const current = 84.9;
      expect(_isComplete(current, duration), isFalse);
    });

    test('returns true above 85 % (86 s of 100 s)', () {
      const duration = 100.0;
      const current = 86.0;
      expect(_isComplete(current, duration), isTrue);
    });

    test('returns true when at end of video (current == duration)', () {
      const duration = 120.0;
      expect(_isComplete(duration, duration), isTrue);
    });

    test('returns false at start of video', () {
      expect(_isComplete(0.0, 120.0), isFalse);
    });

    test('handles short video (10 s) — 8.5 s triggers completion', () {
      expect(_isComplete(8.5, 10.0), isTrue);
      expect(_isComplete(8.4, 10.0), isFalse);
    });

    test('handles long video (3600 s) — boundary at 3060 s', () {
      expect(_isComplete(3060.0, 3600.0), isTrue);
      expect(_isComplete(3059.9, 3600.0), isFalse);
    });
  });

  group('completion threshold — guard against zero duration', () {
    test('returns false when duration is zero', () {
      expect(_isComplete(0.0, 0.0), isFalse);
    });

    test('returns false when duration is negative', () {
      expect(_isComplete(10.0, -1.0), isFalse);
    });
  });

  group('_completionFired guard — prevents re-trigger after first completion', () {
    // Models the stateful guard in the screen:
    //   - _completionFired is reset to false on lesson load
    //   - set to true the first time _isComplete returns true
    //   - subsequent calls are no-ops
    test('fires exactly once per lesson session', () {
      var fired = false;
      var callCount = 0;

      void handleTimeUpdate(double current, double duration) {
        if (fired) return; // guard mirrors screen behaviour
        if (_isComplete(current, duration)) {
          fired = true;
          callCount++;
        }
      }

      const duration = 100.0;

      handleTimeUpdate(50.0, duration); // below threshold — no fire
      handleTimeUpdate(85.0, duration); // at threshold — fires once
      handleTimeUpdate(90.0, duration); // above threshold — guarded
      handleTimeUpdate(100.0, duration); // at end — guarded

      expect(callCount, 1);
    });

    test('resets on lesson change so next lesson can fire', () {
      var fired = false;
      var callCount = 0;

      void handleTimeUpdate(double current, double duration) {
        if (fired) return;
        if (_isComplete(current, duration)) {
          fired = true;
          callCount++;
        }
      }

      void loadLesson() {
        fired = false; // reset mirrors initState / lesson-change effect
      }

      // First lesson
      handleTimeUpdate(90.0, 100.0);
      expect(callCount, 1);

      // Load next lesson — guard resets
      loadLesson();
      handleTimeUpdate(90.0, 100.0);
      expect(callCount, 2);
    });

    test('does not fire for a lesson that was already done before session load',
        () {
      // lessonAlreadyDone = true is detected at load time.
      // The screen pre-sets _completionFired = true to suppress all future POSTs.
      var fired = true; // pre-set as if lesson was already done

      var callCount = 0;

      void handleTimeUpdate(double current, double duration) {
        if (fired) return;
        if (_isComplete(current, duration)) {
          fired = true;
          callCount++;
        }
      }

      handleTimeUpdate(90.0, 100.0);
      handleTimeUpdate(100.0, 100.0);

      expect(callCount, 0);
    });
  });
}
