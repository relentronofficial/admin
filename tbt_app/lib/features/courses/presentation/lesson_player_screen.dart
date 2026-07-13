import 'dart:async';
import 'dart:convert';

import 'package:better_player_plus/better_player_plus.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../../../core/constants/storage_keys.dart';
import '../../../shared/models/lesson.dart';
import '../../../shared/providers/site_config_provider.dart';
import '../../../shared/theme/design_constants.dart';
import '../data/courses_service.dart';
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

  @override
  void initState() {
    super.initState();
    _init();
  }

  @override
  void dispose() {
    _progressTimer?.cancel();
    _playerController?.removeEventsListener(_onBetterPlayerEvent);
    _playerController?.dispose();
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

    final config = BetterPlayerConfiguration(
      autoPlay: true,
      looping: false,
      startAt: Duration(seconds: playback.resumeAtSeconds),
      aspectRatio: 16 / 9,
      fullScreenByDefault: false,
      allowedScreenSleep: false,
      deviceOrientationsAfterFullScreen: [DeviceOrientation.portraitUp],
      controlsConfiguration: const BetterPlayerControlsConfiguration(
        controlBarColor: Colors.black87,
        iconsColor: Colors.white,
        progressBarPlayedColor: kColorAccent,
        progressBarHandleColor: kColorAccent,
        progressBarBufferedColor: Colors.white38,
        progressBarBackgroundColor: Colors.white12,
        enableSkips: false,
        enableOverflowMenu: false,
      ),
    );

    final controller = BetterPlayerController(
      config,
      betterPlayerDataSource: dataSource,
    );
    controller.addEventsListener(_onBetterPlayerEvent);

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
        if (secs != null && mounted) {
          setState(() => _currentTime = secs!);
          _onPositionChanged(secs);
        }
        return;
      }

      if (evt == 'ended') {
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
        .catchError((_) {});
    _maybeShowReflection();
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
      if (secs >= atSecs && secs < atSecs + 2) {
        _firedCueIds.add(cueId);
        _cueQuizActive = true;
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
    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(context),
            _buildPlayerArea(),
            if (!_loading && _playback != null)
              _buildControlsRow(),
            if (!_loading && _playback != null) ...[
              const Divider(height: 1, thickness: 1, color: kColorBorderCard),
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
      color: Colors.black,
      child: Padding(
      padding: const EdgeInsets.only(right: 12),
      child: Row(
        children: [
          IconButton(
            tooltip: 'Back',
            icon: const Icon(Icons.arrow_back, color: kColorTextPrimary),
            onPressed: () => context.pop(),
          ),
          if (_playback != null)
            Expanded(
              child: Text(
                _playback!.title,
                style: const TextStyle(
                  color: kColorTextPrimary,
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
      return const ColoredBox(
        color: Colors.black,
        child: Center(
          child: CircularProgressIndicator(
            color: kColorAccent,
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
              const Text(
                'Failed to load video',
                style: TextStyle(color: kColorTextSecondary, fontSize: 14),
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
                child: const Text(
                  'Retry',
                  style: TextStyle(color: kColorAccent),
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
      return const ColoredBox(
        color: Colors.black,
        child: Center(
          child: CircularProgressIndicator(
            color: kColorAccent,
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
    return const ColoredBox(
      color: Colors.black,
      child: Center(
        child: CircularProgressIndicator(
          color: kColorAccent,
          strokeWidth: 2.5,
        ),
      ),
    );
  }

  Widget _buildControlsRow() {
    return Container(
      color: kColorBgSurface,
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
              style: const TextStyle(color: kColorTextMuted, fontSize: 12),
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
            style: const TextStyle(
              color: kColorTextPrimary,
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
              style: const TextStyle(
                color: kColorTextSecondary,
                fontSize: 14,
                height: 1.55,
              ),
            ),
          ],
        ],
      ),
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
      color: kColorBgSurface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
        side: const BorderSide(color: kColorBorderCard),
      ),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: kColorBgInput,
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: kColorBorderCard),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.speed, color: kColorTextSecondary, size: 14),
            const SizedBox(width: 4),
            Text(
              _label(currentSpeed),
              style: const TextStyle(
                color: kColorTextPrimary,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(width: 2),
            const Icon(
              Icons.arrow_drop_down,
              color: kColorTextMuted,
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
                  color: s == currentSpeed ? kColorAccent : kColorTextPrimary,
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
