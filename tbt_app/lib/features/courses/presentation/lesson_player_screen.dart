import 'dart:async';
import 'dart:convert';

import 'package:better_player_plus/better_player_plus.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../../../core/constants/storage_keys.dart';
import '../../../shared/media/interruptible_media.dart';
import '../../../shared/media/media_interruption_coordinator.dart';
import '../../../shared/models/lesson.dart';
import '../../../shared/providers/site_config_provider.dart';
import '../../../shared/theme/tbt_theme.dart';
import '../../../shared/theme/theme_tokens.dart';
import '../../../shared/video/tbt_video_player_config.dart';
import 'package:url_launcher/url_launcher.dart';

import '../data/courses_service.dart';
import '../providers/courses_provider.dart';
import 'widgets/feedback_modal.dart';
import 'widgets/quiz_bottom_sheet.dart';
import 'widgets/reflection_modal.dart';
class LessonPlayerScreen extends ConsumerStatefulWidget {
  const LessonPlayerScreen({
    super.key,
    required this.courseId,
    required this.lessonId,
  });

  final String courseId;
  final String lessonId;

  @override
  ConsumerState<LessonPlayerScreen> createState() => _LessonPlayerScreenState();
}

class _LessonPlayerScreenState extends ConsumerState<LessonPlayerScreen> {
  static const _speeds = [0.75, 1.0, 1.25, 1.5, 2.0];

  // Playback data
  EpisodePlayback? _playback;
  bool _loading = true;
  String? _error;

  // Player state
  BetterPlayerController? _playerController;
  WebViewController? _webViewController;
  bool _hlsFailed = false;
  double _speed = 1.0;
  double _duration = 0;
  double _currentTime = 0;

  // Progress + completion (CC-32)
  Timer? _progressTimer;
  bool _completionFired = false;

  // Quiz state (CC-33)
  bool _cueQuizActive = false;
  final Set<String> _firedCueIds = {};
  bool _quizShown = false;
  // Whether the lesson was already completed BEFORE this session opened
  bool _wasAlreadyCompleted = false;

  // Episode resources & tasks
  List<EpisodeResource> _resources = [];
  List<EpisodeTask> _tasks = [];

  // Feedback questions loaded after completion
  List<VideoFeedbackQuestion> _feedbackQuestions = [];
  bool _feedbackShown = false;

  // Ad interruption (TBT_ADS_SPECKIT.md §7)
  VoidCallback? _deregisterFromAds;
  /// Playing state for the WebView fallback only. The Bunny iframe gives us no
  /// synchronous way to ask, so we track it from the events it does send: a
  /// timeupdate means it is running, pause/ended mean it is not. BetterPlayer
  /// answers directly and never consults this.
  bool _webViewPlaying = false;

  @override
  void initState() {
    super.initState();
    _init();

    // Reuses the pause/resume helpers built for cue quizzes, which already
    // handle the HLS-vs-iframe split — so the ad path gets both transports for
    // free (§1.1: generalise this, do not reinvent it).
    _deregisterFromAds = MediaInterruptionCoordinator.instance.register(
      CallbackInterruptibleMedia(
        id: 'course-lesson-player',
        kind: InterruptibleMediaKind.video,
        isPlayingFn: _isMediaPlaying,
        getPositionFn: () => _currentTime,
        pauseFn: _pausePlayer,
        resumeFn: _resumePlayer,
        seekFn: _seekPlayer,
      ),
    );
  }

  @override
  void dispose() {
    _deregisterFromAds?.call();
    _deregisterFromAds = null;
    // Leaving the screen with a quiz open would otherwise strand the
    // suppression forever — the count is process-wide and nothing else clears
    // it, so ads would be dead for the rest of the session.
    if (_cueQuizActive) {
      MediaInterruptionCoordinator.instance.unsuppress('course-cue-quiz');
      _cueQuizActive = false;
    }
    _progressTimer?.cancel();
    final ctrl = _playerController;
    if (ctrl != null) {
      ctrl.removeEventsListener(_onBetterPlayerEvent);
      TbtVideoPlayerConfig.detachOrientationGuard(ctrl);
      ctrl.dispose();
    }
    // Safety net: if the user backed out while still in full-screen
    // (Android back gesture, deep link redirect), restore portrait +
    // system chrome so the next screen isn't stranded in landscape.
    unawaited(TbtVideoPlayerConfig.restoreOrientationAndUi());
    super.dispose();
  }

  // ── Initialization ───────────────────────────────────────────────────────────

  Future<void> _init() async {
    final prefs = await SharedPreferences.getInstance();
    _speed = prefs.getDouble(kPrefPlaybackSpeed) ?? 1.0;

    try {
      final playback = await ref
          .read(coursesServiceProvider)
          .getPlayback(widget.courseId, widget.lessonId);
      if (!mounted) return;

      _wasAlreadyCompleted = playback.isCompleted;
      if (playback.isCompleted) _completionFired = true;

      setState(() {
        _playback = playback;
        _loading = false;
      });

      // Fetch resources & tasks in the background — failures are silent
      final svc = ref.read(coursesServiceProvider);
      unawaited(() async {
        try {
          final r = await svc.getEpisodeResources(widget.lessonId);
          if (mounted) setState(() => _resources = r);
        } catch (_) {}
      }());
      unawaited(() async {
        try {
          final t = await svc.getEpisodeTasks(widget.lessonId);
          if (mounted) setState(() => _tasks = t);
        } catch (_) {}
      }());

      _startProgressTimer();

      if (playback.videoType == 'hls' && playback.hlsUrl != null) {
        _initHlsPlayer(playback);
      } else {
        _initWebView(playback);
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  void _initHlsPlayer(EpisodePlayback playback) {
    final dataSource = BetterPlayerDataSource(
      BetterPlayerDataSourceType.network,
      playback.hlsUrl!,
      videoFormat: BetterPlayerVideoFormat.hls,
    );

    final controller = BetterPlayerController(
      TbtVideoPlayerConfig.build(
        startAtSeconds: playback.resumeAtSeconds,
        accent: context.tbt.accent,
      ),
      betterPlayerDataSource: dataSource,
    );
    // Screen-specific progress + completion + quiz event handler.
    controller.addEventsListener(_onBetterPlayerEvent);
    // Package-level orientation lock is unreliable on some Vivo/Xiaomi
    // firmware — this guard re-applies landscape on the next frame
    // after fullscreen opens (and portrait on exit). See factory doc.
    TbtVideoPlayerConfig.attachOrientationGuard(controller);

    setState(() => _playerController = controller);
  }

  void _initWebView(EpisodePlayback playback) {
    final embedUrl = _buildBunnyUrl(playback);
    final html = _buildWrapperHtml(embedUrl);

    final controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..addJavaScriptChannel(
        'BunnyChannel',
        onMessageReceived: _onBunnyMessage,
      )
      ..loadHtmlString(html);

    setState(() => _webViewController = controller);
  }

  // ── BetterPlayer event handler ────────────────────────────────────────────────

  void _onBetterPlayerEvent(BetterPlayerEvent event) {
    switch (event.betterPlayerEventType) {
      case BetterPlayerEventType.initialized:
        _playerController?.setSpeed(_speed);
        final dur = _playerController
            ?.videoPlayerController?.value.duration?.inSeconds
            .toDouble();
        if (dur != null && dur > 0 && mounted) {
          setState(() => _duration = dur);
        }

      case BetterPlayerEventType.progress:
        final pos = event.parameters?['progress'] as Duration?;
        if (pos != null && mounted) {
          final secs = pos.inSeconds.toDouble();
          setState(() => _currentTime = secs);
          _onPositionChanged(secs);
        }

      case BetterPlayerEventType.exception:
        if (!_hlsFailed && mounted) {
          _playerController?.removeEventsListener(_onBetterPlayerEvent);
          _playerController?.dispose();
          setState(() {
            _playerController = null;
            _hlsFailed = true;
          });
          if (_playback != null) _initWebView(_playback!);
        }

      default:
        break;
    }
  }

  // ── WebView / Bunny iframe ────────────────────────────────────────────────────

  String _buildBunnyUrl(EpisodePlayback playback) {
    var url = playback.videoUrl ?? '';
    url = url.replaceAllMapped(
      RegExp(r'https?://player\.mediadelivery\.net/play/(\d+)/([\w-]+)'),
      (m) => 'https://iframe.mediadelivery.net/embed/${m[1]}/${m[2]}',
    );
    final sep = url.contains('?') ? '&' : '?';
    final t = playback.resumeAtSeconds;
    return '$url${sep}fullscreen=false&autoplay=true&t=$t';
  }

  String _buildWrapperHtml(String embedUrl) {
    final escaped = embedUrl.replaceAll('"', '&quot;');
    return '''
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
html, body, iframe { width:100%; height:100%; border:0; background:#000; display:block; }
</style>
</head>
<body>
<iframe id="player" src="$escaped"
  allow="accelerometer; gyroscope; autoplay; encrypted-media"
  allowfullscreen></iframe>
<script>
var playerFrame = document.getElementById('player');
var subscribed = false;

function sendToPlayer(method, value) {
  var msg = { context: 'player.js', method: method };
  if (value !== undefined) msg.value = value;
  playerFrame.contentWindow.postMessage(
    JSON.stringify(msg), 'https://iframe.mediadelivery.net');
}

window.addEventListener('message', function(e) {
  if (!e.origin || e.origin.indexOf('mediadelivery.net') === -1) return;
  var raw = typeof e.data === 'string' ? e.data : JSON.stringify(e.data);
  try {
    var d = JSON.parse(raw);
    if (d && (d.event || '').toLowerCase() === 'ready' && !subscribed) {
      subscribed = true;
      ['timeupdate', 'pause', 'ended'].forEach(function(ev) {
        sendToPlayer('addEventListener', ev);
      });
      sendToPlayer('getDuration');
      sendToPlayer('getCurrentTime');
      sendToPlayer('isPaused');
    }
  } catch(ex) {}
  BunnyChannel.postMessage(raw);
});
</script>
</body>
</html>''';
  }

  void _onBunnyMessage(JavaScriptMessage msg) {
    try {
      final data = json.decode(msg.message) as Map<String, dynamic>?;
      if (data == null) return;

      final evt = (data['event'] as String? ?? '').toLowerCase();
      final value = data['value'];

      if (evt == 'getduration' && value != null) {
        final dur = (value as num).toDouble();
        if (dur > 0 && _duration == 0 && mounted) {
          setState(() => _duration = dur);
        }
        return;
      }

      if (evt == 'timeupdate' && value != null) {
        double? secs;
        if (value is Map) {
          secs = (value['seconds'] as num?)?.toDouble();
          if (_duration == 0) {
            final dur = (value['duration'] as num?)?.toDouble() ?? 0;
            if (dur > 0 && mounted) setState(() => _duration = dur);
          }
        } else {
          secs = (value as num?)?.toDouble();
        }
        // A timeupdate only arrives while the iframe is actually running, so
        // it doubles as the "is playing" signal the embed never exposes
        // directly (§7.1 — isPlaying must be answerable synchronously).
        _webViewPlaying = true;
        if (secs != null && mounted) {
          setState(() => _currentTime = secs!);
          _onPositionChanged(secs);
        }
        return;
      }

      if (evt == 'pause') {
        _webViewPlaying = false;
        return;
      }

      if (evt == 'ended') {
        _webViewPlaying = false;
        _onVideoEnded();
        return;
      }
    } catch (_) {}
  }

  // ── Progress + completion (CC-32) ─────────────────────────────────────────────

  void _startProgressTimer() {
    _progressTimer?.cancel();
    _progressTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      if (_currentTime <= 0) return;
      if (!_isMediaPlaying()) return;
      ref
          .read(coursesServiceProvider)
          .markLessonComplete(
            widget.courseId,
            widget.lessonId,
            watchedSeconds: _currentTime.toInt(),
            isCompleted: false,
          )
          .catchError((_) {});
    });
  }

  void _onVideoEnded() {
    if (_completionFired) return;
    _completionFired = true;
    ref
        .read(coursesServiceProvider)
        .markLessonComplete(
          widget.courseId,
          widget.lessonId,
          watchedSeconds: _currentTime.toInt(),
          isCompleted: true,
        )
        .then((_) {
          // Refresh all providers that depend on lesson progress so that
          // CourseDetailScreen, LearningOverviewScreen, and the certificate
          // eligibility badge are up-to-date when the user navigates back.
          ref.invalidate(lessonProgressProvider(widget.courseId));
          ref.invalidate(courseDetailProvider(widget.courseId));
          ref.invalidate(certEligibilityProvider(widget.courseId));
          ref.invalidate(myEnrollmentsProvider);
          ref.invalidate(learningCoursesProvider);
        })
        .catchError((_) {});
    _maybeShowReflection();
    _maybeShowFeedback();
  }

  Future<void> _maybeShowFeedback() async {
    if (_feedbackShown || _wasAlreadyCompleted) return;
    _feedbackShown = true;
    try {
      final questions = await ref
          .read(coursesServiceProvider)
          .getVideoFeedbackQuestions(widget.lessonId);
      if (questions.isEmpty) return;
      if (!mounted) return;
      setState(() => _feedbackQuestions = questions);
      await Future.delayed(const Duration(milliseconds: 600));
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        barrierDismissible: false,
        builder: (_) => FeedbackModal(
          episodeId: widget.lessonId,
          questions: questions,
          onDismiss: () => Navigator.of(context).pop(),
        ),
      );
    } catch (_) {}
  }

  // ── Position change — drives cue quizzes + 85% completion (CC-33) ────────────

  void _onPositionChanged(double secs) {
    if (!mounted) return;
    _checkCompletion(secs);
    if (!_cueQuizActive) _checkCueQuiz(secs);
    if (!_quizShown) _checkEndQuizUnlock(secs);
  }

  void _checkCompletion(double secs) {
    if (_completionFired || _duration <= 0) return;
    if (secs >= _duration * 0.85) {
      _onVideoEnded();
    }
  }

  // ── Cue quizzes ───────────────────────────────────────────────────────────────

  void _checkCueQuiz(double secs) {
    final cues = (_playback?.quizData?['cues'] as List<dynamic>? ?? [])
        .cast<Map<String, dynamic>>();
    if (cues.isEmpty) return;

    final sorted = [...cues]
      ..sort((a, b) => (a['atSeconds'] as int).compareTo(b['atSeconds'] as int));

    for (final cue in sorted) {
      final cueId = cue['id'] as String? ?? '';
      final atSecs = (cue['atSeconds'] as num?)?.toDouble() ?? 0;
      if (_firedCueIds.contains(cueId)) continue;
      if (secs >= atSecs) {
        _firedCueIds.add(cueId);
        _cueQuizActive = true;
        // An open cue quiz is already a modal interruption; stacking a
        // fullscreen ad on top of it is incoherent (§7.4).
        MediaInterruptionCoordinator.instance.suppress('course-cue-quiz');
        _pausePlayer();
        final questions = (cue['questions'] as List<dynamic>? ?? [])
            .cast<Map<String, dynamic>>();
        _showCueQuiz(questions);
        break;
      }
    }
  }

  void _pausePlayer() {
    _playerController?.pause();
    _webViewPlaying = false;
    _webViewController?.runJavaScript(
      "sendToPlayer('pause')",
    );
  }

  void _resumePlayer() {
    _playerController?.play();
    _webViewController?.runJavaScript(
      "sendToPlayer('play')",
    );
  }

  /// Whichever transport is live right now. Read at ad-interrupt time to decide
  /// whether this lesson gets resumed afterwards — a wrong answer here is
  /// exactly the criterion-21 failure (§7.2).
  bool _isMediaPlaying() {
    final ctrl = _playerController;
    if (ctrl != null) return ctrl.isPlaying() ?? false;
    return _webViewPlaying;
  }

  void _seekPlayer(double seconds) {
    final ctrl = _playerController;
    if (ctrl != null) {
      ctrl.seekTo(Duration(milliseconds: (seconds * 1000).round()));
      return;
    }
    _webViewController?.runJavaScript(
      "sendToPlayer('setCurrentTime', $seconds)",
    );
  }

  void _showCueQuiz(List<Map<String, dynamic>> questions) {
    if (!mounted) return;
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      isDismissible: false,
      backgroundColor: Colors.transparent,
      builder: (_) => CueQuizBottomSheet(
        questions: questions,
        onDismiss: _onCueQuizDismiss,
      ),
    );
  }

  void _onCueQuizDismiss() {
    if (_cueQuizActive) {
      MediaInterruptionCoordinator.instance.unsuppress('course-cue-quiz');
    }
    _cueQuizActive = false;
    if (mounted) Navigator.of(context).pop();
    _resumePlayer();
  }

  // ── End-of-video quiz ─────────────────────────────────────────────────────────

  void _checkEndQuizUnlock(double secs) {
    final p = _playback;
    if (p == null || !p.hasQuiz || _quizShown) return;
    if (_duration <= 0) return;
    final watchedPct = secs / _duration * 100;
    if (watchedPct >= p.quizUnlockPercent) {
      _quizShown = true;
      _pausePlayer();
      _showEndQuiz();
    }
  }

  void _showEndQuiz() {
    if (!mounted) return;
    final p = _playback!;
    final questions = (p.quizData?['questions'] as List<dynamic>? ?? [])
        .cast<Map<String, dynamic>>();

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      isDismissible: false,
      backgroundColor: Colors.transparent,
      builder: (_) => DraggableScrollableSheet(
        initialChildSize: 0.85,
        maxChildSize: 0.95,
        minChildSize: 0.5,
        builder: (_, scrollController) => QuizBottomSheet(
          questions: questions,
          passingScore: 70,
          onSubmit: (answers) => ref
              .read(coursesServiceProvider)
              .submitQuiz(widget.courseId, widget.lessonId, answers),
        ),
      ),
    ).then((_) => _resumePlayer());
  }

  // ── Reflection modal ──────────────────────────────────────────────────────────

  void _maybeShowReflection() {
    final p = _playback;
    if (p == null) return;
    // Only show if lesson has no end-of-video quiz AND wasn't already done
    if (p.hasQuiz || _wasAlreadyCompleted) return;

    Future.delayed(const Duration(milliseconds: 1200), () {
      if (!mounted) return;
      final strings = ref.read(uiStringsNotifierProvider).valueOrNull;
      if (strings == null || !mounted) return;
      showDialog<void>(
        context: context,
        barrierDismissible: false,
        builder: (_) => ReflectionModal(
          lessonTitle: p.title,
          uiStrings: strings,
          onSave: (text) {
            _saveReflection(text);
            if (mounted) Navigator.of(context).pop();
          },
          onSkip: () {
            if (mounted) Navigator.of(context).pop();
          },
        ),
      );
    });
  }

  Future<void> _saveReflection(String text) async {
    // Persist locally first so the save feels instant and works offline.
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(kPrefReflections) ?? '{}';
    final Map<String, dynamic> map;
    try {
      map = json.decode(raw) as Map<String, dynamic>;
    } catch (_) {
      return;
    }
    final key = '${widget.courseId}:${widget.lessonId}';
    map[key] = {
      'text': text,
      'savedAt': DateTime.now().toIso8601String(),
      'lessonTitle': _playback?.title ?? '',
    };
    await prefs.setString(kPrefReflections, json.encode(map));

    // Persist to backend fire-and-forget — local copy already saved above so
    // a network failure does not affect the user-visible outcome.
    ref
        .read(coursesServiceProvider)
        .saveReflection(widget.courseId, widget.lessonId, text)
        .catchError((_) {});
  }

  // ── Speed persistence ─────────────────────────────────────────────────────────

  Future<void> _setSpeed(double speed) async {
    setState(() => _speed = speed);
    _playerController?.setSpeed(speed);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setDouble(kPrefPlaybackSpeed, speed);
  }

  // ── Build ─────────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    // Theme-aware scaffold + header — the area OUTSIDE the video rect
    // flips with the app theme. The video letterboxing inside the
    // `AspectRatio` (see `_buildPlayerContent`) stays black regardless
    // of theme, which is the industry standard (YouTube / Netflix).
    return Scaffold(
      backgroundColor: context.tokens.bgPage,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(context),
            _buildPlayerArea(),
            if (!_loading && _playback != null)
              _buildControlsRow(),
            if (!_loading && _playback != null) ...[
              Divider(height: 1, thickness: 1, color: context.tokens.borderCard),
              Expanded(child: _buildMetadata()),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 48),
      child: ColoredBox(
      color: context.tokens.bgSurface,
      child: Padding(
      padding: const EdgeInsets.only(right: 12),
      child: Row(
        children: [
          IconButton(
            tooltip: 'Back',
            icon: Icon(Icons.arrow_back, color: context.tokens.textPrimary),
            onPressed: () => context.pop(),
          ),
          if (_playback != null)
            Expanded(
              child: Text(
                _playback!.title,
                style: TextStyle(
                  color: context.tokens.textPrimary,
                  fontFamily: 'Rajdhani',
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.5,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
        ],
      ),
      ),
      ),
    );
  }

  Widget _buildPlayerArea() {
    return AspectRatio(
      aspectRatio: 16 / 9,
      child: _buildPlayerContent(),
    );
  }

  Widget _buildPlayerContent() {
    if (_loading) {
      return ColoredBox(
        color: Colors.black,
        child: Center(
          child: CircularProgressIndicator(
            color: Theme.of(context).colorScheme.primary,
            strokeWidth: 2.5,
          ),
        ),
      );
    }

    if (_error != null) {
      return ColoredBox(
        color: Colors.black,
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, color: Colors.redAccent, size: 36),
              const SizedBox(height: 10),
              Text(
                'Failed to load video',
                style: TextStyle(color: context.tokens.textSecondary, fontSize: 14),
              ),
              const SizedBox(height: 12),
              TextButton(
                onPressed: () {
                  setState(() {
                    _loading = true;
                    _error = null;
                  });
                  _init();
                },
                child: Text(
                  'Retry',
                  style: TextStyle(color: Theme.of(context).colorScheme.primary),
                ),
              ),
            ],
          ),
        ),
      );
    }

    final p = _playback!;
    final isHls = p.videoType == 'hls' && p.hlsUrl != null;

    // HLS path
    if (isHls && !_hlsFailed) {
      if (_playerController != null) {
        return RepaintBoundary(
          child: BetterPlayer(controller: _playerController!),
        );
      }
      return ColoredBox(
        color: Colors.black,
        child: Center(
          child: CircularProgressIndicator(
            color: Theme.of(context).colorScheme.primary,
            strokeWidth: 2.5,
          ),
        ),
      );
    }

    // Bunny iframe path
    if (_webViewController != null) {
      return RepaintBoundary(
        child: WebViewWidget(controller: _webViewController!),
      );
    }
    return ColoredBox(
      color: Colors.black,
      child: Center(
        child: CircularProgressIndicator(
          color: Theme.of(context).colorScheme.primary,
          strokeWidth: 2.5,
        ),
      ),
    );
  }

  Widget _buildControlsRow() {
    return Container(
      color: context.tokens.bgSurface,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      child: Row(
        children: [
          _SpeedSelector(
            currentSpeed: _speed,
            speeds: _speeds,
            onChanged: _setSpeed,
          ),
          const Spacer(),
          if (_duration > 0)
            Text(
              '${_fmtSeconds(_currentTime)} / ${_fmtSeconds(_duration)}',
              style: TextStyle(color: context.tokens.textMuted, fontSize: 12),
            ),
        ],
      ),
    );
  }

  String _fmtSeconds(double total) {
    final t = total.toInt();
    final m = t ~/ 60;
    final sStr = (t % 60).toString().padLeft(2, '0');
    if (m > 0) return '${m}m ${sStr}s';
    return '${sStr}s';
  }

  Widget _buildMetadata() {
    final p = _playback!;
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            p.title,
            style: TextStyle(
              color: context.tokens.textPrimary,
              fontFamily: 'Rajdhani',
              fontSize: 20,
              fontWeight: FontWeight.w700,
              height: 1.3,
            ),
          ),
          if (p.description != null && p.description!.isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(
              p.description!,
              style: TextStyle(
                color: context.tokens.textSecondary,
                fontSize: 14,
                height: 1.55,
              ),
            ),
          ],
          if (_resources.isNotEmpty) ...[
            const SizedBox(height: 20),
            _buildResourcesSection(),
          ],
          if (_tasks.isNotEmpty) ...[
            const SizedBox(height: 16),
            _buildTasksSection(),
          ],
        ],
      ),
    );
  }

  Widget _buildResourcesSection() {
    return Container(
      decoration: BoxDecoration(
        color: context.tokens.bgSurface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: context.tokens.borderCard),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
            child: Row(
              children: [
                Icon(Icons.download_rounded, size: 16, color: Theme.of(context).colorScheme.primary),
                const SizedBox(width: 8),
                Text(
                  'Resources (${_resources.length})',
                  style: TextStyle(
                    color: context.tokens.textPrimary,
                    fontFamily: 'Rajdhani',
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.3,
                  ),
                ),
              ],
            ),
          ),
          Divider(height: 1, color: context.tokens.borderCard),
          ..._resources.map((r) => _buildResourceRow(r)),
        ],
      ),
    );
  }

  Widget _buildResourceRow(EpisodeResource r) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
          child: Row(
            children: [
              Icon(Icons.insert_drive_file_outlined, size: 18, color: context.tokens.textSubtle),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      r.title,
                      style: TextStyle(color: context.tokens.textPrimary, fontSize: 13, fontWeight: FontWeight.w600),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (r.description != null && r.description!.isNotEmpty)
                      Text(
                        r.description!,
                        style: TextStyle(color: context.tokens.textSubtle, fontSize: 11, height: 1.4),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                  ],
                ),
              ),
              if (r.fileUrl != null) ...[
                const SizedBox(width: 10),
                GestureDetector(
                  onTap: () async {
                    final uri = Uri.tryParse(r.fileUrl!);
                    if (uri != null) {
                      // Open in browser via url_launcher if available, else no-op
                      // ignore: deprecated_member_use
                      await launchUrl(uri, mode: LaunchMode.externalApplication).catchError((_) => false);
                    }
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.primary,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.download_rounded, size: 12, color: Colors.white),
                        const SizedBox(width: 4),
                        Text(
                          r.downloadLabel ?? 'Download',
                          style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
        if (r != _resources.last)
          Divider(height: 1, indent: 14, endIndent: 14, color: context.tokens.borderCard),
      ],
    );
  }

  Widget _buildTasksSection() {
    return Container(
      decoration: BoxDecoration(
        color: context.tokens.bgSurface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: context.tokens.borderCard),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
            child: Row(
              children: [
                Icon(Icons.checklist_rounded, size: 16, color: Theme.of(context).colorScheme.primary),
                const SizedBox(width: 8),
                Text(
                  'Tasks (${_tasks.length})',
                  style: TextStyle(
                    color: context.tokens.textPrimary,
                    fontFamily: 'Rajdhani',
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.3,
                  ),
                ),
              ],
            ),
          ),
          Divider(height: 1, color: context.tokens.borderCard),
          ..._tasks.asMap().entries.map((e) => _buildTaskRow(e.key, e.value)),
        ],
      ),
    );
  }

  Widget _buildTaskRow(int index, EpisodeTask t) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 24,
                height: 24,
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.primary,
                  shape: BoxShape.circle,
                ),
                alignment: Alignment.center,
                child: Text(
                  '${index + 1}',
                  style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      t.title,
                      style: TextStyle(color: context.tokens.textPrimary, fontSize: 13, fontWeight: FontWeight.w600, height: 1.3),
                    ),
                    if (t.description != null && t.description!.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        t.description!,
                        style: TextStyle(color: context.tokens.textSecondary, fontSize: 12, height: 1.5),
                      ),
                    ],
                    if (t.deliverables != null && t.deliverables!.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        'Deliverable: ${t.deliverables}',
                        style: TextStyle(color: context.tokens.textSubtle, fontSize: 11, height: 1.4),
                      ),
                    ],
                    if (t.estimatedMinutes != null) ...[
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          Icon(Icons.access_time_rounded, size: 11, color: context.tokens.textSubtle),
                          const SizedBox(width: 3),
                          Text(
                            '~${t.estimatedMinutes} min',
                            style: TextStyle(color: context.tokens.textSubtle, fontSize: 11),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
        if (t != _tasks.last)
          Divider(height: 1, indent: 14, endIndent: 14, color: context.tokens.borderCard),
      ],
    );
  }
}

// ── Speed selector ────────────────────────────────────────────────────────────

class _SpeedSelector extends StatelessWidget {
  const _SpeedSelector({
    required this.currentSpeed,
    required this.speeds,
    required this.onChanged,
  });

  final double currentSpeed;
  final List<double> speeds;
  final ValueChanged<double> onChanged;

  String _label(double s) => s == 1.0 ? '1×' : '$s×';

  @override
  Widget build(BuildContext context) {
    return PopupMenuButton<double>(
      tooltip: 'Playback speed',
      initialValue: currentSpeed,
      onSelected: onChanged,
      color: context.tokens.bgSurface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
        side: BorderSide(color: context.tokens.borderCard),
      ),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: context.tokens.bgInput,
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: context.tokens.borderCard),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.speed, color: context.tokens.textSecondary, size: 14),
            const SizedBox(width: 4),
            Text(
              _label(currentSpeed),
              style: TextStyle(
                color: context.tokens.textPrimary,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(width: 2),
            Icon(
              Icons.arrow_drop_down,
              color: context.tokens.textMuted,
              size: 14,
            ),
          ],
        ),
      ),
      itemBuilder: (_) => speeds
          .map(
            (s) => PopupMenuItem<double>(
              value: s,
              child: Text(
                _label(s),
                style: TextStyle(
                  color: s == currentSpeed ? Theme.of(context).colorScheme.primary : context.tokens.textPrimary,
                  fontWeight:
                      s == currentSpeed ? FontWeight.w700 : FontWeight.w400,
                  fontSize: 14,
                ),
              ),
            ),
          )
          .toList(),
    );
  }
}
