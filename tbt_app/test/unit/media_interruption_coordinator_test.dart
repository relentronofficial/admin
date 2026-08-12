// Media interruption coordinator — TBT_ADS_SPECKIT.md §7, tested per §15.
//
// The three bolded criteria in §15 ("active video pauses", "resumes from saved
// position", "previously-paused media stays paused") are decided entirely by
// this class. §15 notes they cannot be *widget*-tested meaningfully, which is
// true — but the decision itself is pure Dart over a registry of callbacks, and
// that is exactly what is tested here with fake players. An integration test
// with a real `better_player` controller then only has to prove the players
// implement the contract, not that the contract is right.
//
// Criterion 21 (previously-paused media stays paused) is the one a naive
// "resume everything" implementation fails while passing every other test, so
// it gets several cases.

import 'package:flutter_test/flutter_test.dart';
import 'package:tbt_app/shared/media/interruptible_media.dart';
import 'package:tbt_app/shared/media/media_interruption_coordinator.dart';

/// Recording stand-in for a real player.
class FakeMedia implements InterruptibleMedia {
  FakeMedia(
    this.id, {
    this.kind = InterruptibleMediaKind.video,
    bool playing = false,
    double position = 0,
    this.throwOnInspect = false,
    this.throwOnPause = false,
  })  : _playing = playing,
        _position = position;

  @override
  final String id;

  @override
  final InterruptibleMediaKind kind;

  final bool throwOnInspect;
  final bool throwOnPause;

  bool _playing;
  double _position;

  int pauseCalls = 0;
  int resumeCalls = 0;
  final List<double> seeks = [];

  bool get isPlayingNow => _playing;
  double get positionNow => _position;

  @override
  bool isPlaying() {
    if (throwOnInspect) throw StateError('player disposed');
    return _playing;
  }

  @override
  double getPosition() {
    if (throwOnInspect) throw StateError('player disposed');
    return _position;
  }

  @override
  void pause() {
    pauseCalls++;
    if (throwOnPause) throw StateError('pause failed');
    _playing = false;
  }

  @override
  void resume() {
    resumeCalls++;
    _playing = true;
  }

  @override
  void seek(double seconds) {
    seeks.add(seconds);
    _position = seconds;
  }
}

void main() {
  final coordinator = MediaInterruptionCoordinator.instance;

  setUp(coordinator.resetForTest);

  group('interrupt', () {
    test('pauses only what was actually playing', () {
      final playing = FakeMedia('video', playing: true, position: 42);
      final paused = FakeMedia('audio', kind: InterruptibleMediaKind.audio);
      coordinator.register(playing);
      coordinator.register(paused);

      coordinator.interruptAll();

      expect(playing.pauseCalls, 1);
      expect(playing.isPlayingNow, isFalse);
      // Already paused — pausing it again would be pointless work, and pretending
      // we paused it is what leads to resuming it later.
      expect(paused.pauseCalls, 0);
    });

    test('a player that throws on inspection is treated as not playing', () {
      final broken = FakeMedia('broken', playing: true, throwOnInspect: true);
      coordinator.register(broken);

      expect(coordinator.interruptAll, returnsNormally);
      expect(broken.pauseCalls, 0);

      // ...and it is not resumed either, because we never paused it.
      coordinator.restoreAll();
      expect(broken.resumeCalls, 0);
    });

    test('a player that throws on pause does not block the others', () {
      final bad = FakeMedia('bad', playing: true, throwOnPause: true);
      final good = FakeMedia('good', playing: true);
      coordinator.register(bad);
      coordinator.register(good);

      expect(coordinator.interruptAll, returnsNormally);
      expect(good.pauseCalls, 1);
    });

    test('a stale snapshot is restored before a new one is taken', () {
      final media = FakeMedia('v', playing: true, position: 10);
      coordinator.register(media);

      coordinator.interruptAll();
      // A teardown that failed to restore leaves the snapshot outstanding.
      expect(coordinator.hasPendingRestore, isTrue);

      coordinator.interruptAll();
      // The first snapshot was honoured rather than overwritten, so the
      // original position is not lost.
      expect(media.resumeCalls, 1);
      expect(media.seeks, [10]);
    });
  });

  group('restore', () {
    test('resumes what was playing, seeking to the saved position first', () {
      final media = FakeMedia('v', playing: true, position: 37.5);
      coordinator.register(media);

      coordinator.interruptAll();
      coordinator.restoreAll();

      expect(media.seeks, [37.5]);
      expect(media.resumeCalls, 1);
      expect(media.isPlayingNow, isTrue);
    });

    test('does NOT resume media that was already paused (criterion 21)', () {
      final wasPaused = FakeMedia('v', position: 12);
      coordinator.register(wasPaused);

      coordinator.interruptAll();
      coordinator.restoreAll();

      expect(wasPaused.resumeCalls, 0);
      expect(wasPaused.seeks, isEmpty);
      expect(wasPaused.isPlayingNow, isFalse);
    });

    test('resumes only the playing subset when both kinds are registered', () {
      final playingVideo = FakeMedia('video', playing: true, position: 5);
      final pausedAudio = FakeMedia('audio', kind: InterruptibleMediaKind.audio, position: 99);
      coordinator.register(playingVideo);
      coordinator.register(pausedAudio);

      coordinator.interruptAll();
      coordinator.restoreAll();

      expect(playingVideo.resumeCalls, 1);
      expect(pausedAudio.resumeCalls, 0);
    });

    test('skips a player that deregistered while the ad was showing', () {
      final media = FakeMedia('v', playing: true, position: 8);
      final deregister = coordinator.register(media);

      coordinator.interruptAll();
      deregister(); // user navigated away mid-ad

      expect(coordinator.restoreAll, returnsNormally);
      expect(media.resumeCalls, 0);
    });

    test('does not resume a player registered after the interruption', () {
      final early = FakeMedia('early', playing: true);
      coordinator.register(early);
      coordinator.interruptAll();

      final late = FakeMedia('late');
      coordinator.register(late);
      coordinator.restoreAll();

      // We never paused it, so it is not ours to start.
      expect(late.resumeCalls, 0);
      expect(early.resumeCalls, 1);
    });

    test('does not seek when the saved position is zero', () {
      final media = FakeMedia('v', playing: true);
      coordinator.register(media);

      coordinator.interruptAll();
      coordinator.restoreAll();

      expect(media.seeks, isEmpty);
      expect(media.resumeCalls, 1);
    });

    test('is idempotent — a second restore does nothing', () {
      final media = FakeMedia('v', playing: true, position: 3);
      coordinator.register(media);

      coordinator.interruptAll();
      coordinator.restoreAll();
      coordinator.restoreAll();

      expect(media.resumeCalls, 1);
      expect(coordinator.hasPendingRestore, isFalse);
    });

    test('restoring without an interruption is a no-op', () {
      final media = FakeMedia('v', playing: true);
      coordinator.register(media);
      expect(coordinator.restoreAll, returnsNormally);
      expect(media.resumeCalls, 0);
    });
  });

  group('suppression', () {
    test('is ref-counted, so nesting does not lift the outer scope', () {
      coordinator.suppress('gate');
      coordinator.suppress('gate');
      coordinator.unsuppress('gate');
      // A boolean flag would have cleared here — the outer suppression is still
      // in force (a cue quiz inside a course inside a gate).
      expect(coordinator.isSuppressed, isTrue);

      coordinator.unsuppress('gate');
      expect(coordinator.isSuppressed, isFalse);
    });

    test('tracks independent reasons separately', () {
      coordinator.suppress('webinar');
      coordinator.suppress('course-cue-quiz');
      expect(coordinator.suppressionReasons, containsAll(['webinar', 'course-cue-quiz']));

      coordinator.unsuppress('webinar');
      expect(coordinator.isSuppressed, isTrue);
      expect(coordinator.suppressionReasons, ['course-cue-quiz']);
    });

    test('unsuppressing something that was never suppressed is harmless', () {
      expect(() => coordinator.unsuppress('never'), returnsNormally);
      expect(coordinator.isSuppressed, isFalse);
    });

    test('notifies listeners so an ad on screen can tear itself down', () {
      var notifications = 0;
      void listener() => notifications++;
      coordinator.addListener(listener);

      coordinator.suppress('webinar');
      expect(notifications, greaterThan(0));

      coordinator.removeListener(listener);
    });
  });

  group('display lock (criterion 30)', () {
    test('only one holder at a time', () {
      expect(coordinator.acquireAdLock('token-1'), isTrue);
      expect(coordinator.acquireAdLock('token-2'), isFalse);
      expect(coordinator.isAdShowing, isTrue);
    });

    test('only the holder may release it', () {
      coordinator.acquireAdLock('token-1');

      // A late teardown from a previous ad must not unlock the current one.
      coordinator.releaseAdLock('token-stale');
      expect(coordinator.isAdShowing, isTrue);

      coordinator.releaseAdLock('token-1');
      expect(coordinator.isAdShowing, isFalse);
      expect(coordinator.acquireAdLock('token-2'), isTrue);
    });
  });

  group('registration', () {
    test('re-registering the same id replaces the entry', () {
      final first = FakeMedia('player', playing: true);
      final second = FakeMedia('player', playing: true);
      coordinator.register(first);
      coordinator.register(second);

      expect(coordinator.registeredCount, 1);

      coordinator.interruptAll();
      expect(second.pauseCalls, 1);
      expect(first.pauseCalls, 0);
    });

    test('deregistering removes it from the registry', () {
      final deregister = coordinator.register(FakeMedia('v'));
      expect(coordinator.registeredCount, 1);
      deregister();
      expect(coordinator.registeredCount, 0);
    });
  });
}
