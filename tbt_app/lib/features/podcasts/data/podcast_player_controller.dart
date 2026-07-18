import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:just_audio/just_audio.dart';

import '../domain/podcast_models.dart';
import 'podcast_service.dart';

/// App-wide audio playback controller for podcast episodes.
///
/// Singleton `ChangeNotifier` so every screen (browse list, series
/// detail, full player, mini-player, dashboard) reflects the exact
/// same play state. Exposes the underlying `just_audio` player so
/// screens can subscribe to fine-grained streams (`positionStream`,
/// `playerStateStream`) for live scrub UI, while the notifier
/// itself fires only on episode swap / play-pause boundaries — no
/// rebuild storm.
///
/// Progress writeback: every 15 s the controller POSTs progress to
/// the backend. Also fires an immediate write on pause and on
/// completion (mark-completed endpoint).
class PodcastPlayerController extends ChangeNotifier {
  PodcastPlayerController(this._service) {
    _player.playerStateStream.listen(_onStateChange);
    _player.positionStream.listen(_onPositionTick);
  }

  final PodcastService _service;
  final AudioPlayer _player = AudioPlayer();

  PodcastEpisode? _current;
  DateTime _lastWriteAt = DateTime.fromMillisecondsSinceEpoch(0);
  bool _completeReported = false;

  AudioPlayer get player => _player;
  PodcastEpisode? get currentEpisode => _current;
  bool get isPlaying => _player.playing;
  bool get hasEpisode => _current != null;

  /// Duration of the current source — falls back to the backend-
  /// reported value while just_audio is still probing.
  Duration get totalDuration {
    final d = _player.duration;
    if (d != null) return d;
    if (_current != null) return Duration(seconds: _current!.durationSeconds);
    return Duration.zero;
  }

  /// Load and play a new episode, seeking to a stored resume point if
  /// the episode has one. Idempotent: calling with the same episode
  /// while already playing just resumes.
  Future<void> playEpisode(PodcastEpisode ep, {int? resumeAtSeconds}) async {
    if (_current?.id == ep.id && _player.playing) return;
    // Flush progress on the outgoing episode before swapping.
    if (_current != null && _current!.id != ep.id) {
      unawaited(_writeProgress(force: true));
    }
    _current = ep;
    _completeReported = false;
    try {
      await _player.setUrl(ep.audioUrl);
      final resume = resumeAtSeconds ?? ep.progress?.currentPositionSeconds ?? 0;
      if (resume > 0 && resume < ep.durationSeconds - 5) {
        await _player.seek(Duration(seconds: resume));
      }
      await _player.play();
    } catch (err) {
      _player.stop();
      rethrow;
    }
    notifyListeners();
  }

  Future<void> togglePlay() async {
    if (_current == null) return;
    if (_player.playing) {
      await _player.pause();
      unawaited(_writeProgress(force: true));
    } else {
      await _player.play();
    }
    notifyListeners();
  }

  Future<void> seek(Duration position) async {
    await _player.seek(position);
    // Fire-and-forget an immediate progress write so continue-listening
    // reflects the seek even before the periodic timer next runs.
    unawaited(_writeProgress(force: true));
  }

  Future<void> skipForward([int seconds = 15]) async {
    final pos = _player.position;
    final target = pos + Duration(seconds: seconds);
    final max = totalDuration;
    await seek(target < max ? target : max);
  }

  Future<void> skipBackward([int seconds = 15]) async {
    final pos = _player.position;
    final target = pos - Duration(seconds: seconds);
    await seek(target > Duration.zero ? target : Duration.zero);
  }

  Future<void> stopAndClear() async {
    unawaited(_writeProgress(force: true));
    await _player.stop();
    _current = null;
    notifyListeners();
  }

  // ── Internal ────────────────────────────────────────────────────

  void _onPositionTick(Duration pos) {
    if (_current == null) return;
    final now = DateTime.now();
    if (now.difference(_lastWriteAt) >= const Duration(seconds: 15)) {
      unawaited(_writeProgress());
    }
  }

  Future<void> _onStateChange(PlayerState state) async {
    if (state.processingState == ProcessingState.completed && !_completeReported) {
      _completeReported = true;
      final ep = _current;
      if (ep != null) {
        try {
          await _service.markCompleted(
            episodeId: ep.id,
            totalDurationSeconds: ep.durationSeconds > 0
                ? ep.durationSeconds
                : totalDuration.inSeconds,
          );
        } catch (_) {
          // Non-fatal — user still got the "played to end" experience.
        }
      }
      notifyListeners();
    }
  }

  Future<void> _writeProgress({bool force = false}) async {
    final ep = _current;
    if (ep == null) return;
    final now = DateTime.now();
    if (!force && now.difference(_lastWriteAt) < const Duration(seconds: 15)) return;
    _lastWriteAt = now;
    final pos = _player.position.inSeconds;
    final dur = totalDuration.inSeconds;
    // Ignore zeroed-out position ticks that fire momentarily during
    // source swap — they'd wipe an accurate previous checkpoint.
    if (pos <= 0 && !force) return;
    try {
      await _service.submitProgress(
        episodeId: ep.id,
        currentPositionSeconds: pos,
        totalDurationSeconds: dur,
        completed: false,
      );
    } catch (_) {
      // Progress writes are best-effort; a lost tick just delays the
      // resume point by up to 15s next time the app opens.
    }
  }

  @override
  Future<void> dispose() async {
    await _writeProgress(force: true);
    await _player.dispose();
    super.dispose();
  }
}

/// App-wide singleton — kept alive so the mini-player stays mounted
/// across screen switches without dropping the audio buffer.
final podcastPlayerControllerProvider = ChangeNotifierProvider<PodcastPlayerController>(
  (ref) => PodcastPlayerController(ref.watch(podcastServiceProvider)),
);
