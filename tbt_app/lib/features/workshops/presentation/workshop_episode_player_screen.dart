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
import '../data/workshops_service.dart';

import '../../../shared/theme/theme_tokens.dart';
/// Workshop episode player. Mirror of `LessonPlayerScreen` for course lessons
/// but posts progress via `postEpisodeProgress` and marks completion via
/// `completeWorkshopEpisode` (no course enrollment involved).
class WorkshopEpisodePlayerScreen extends ConsumerStatefulWidget {
  const WorkshopEpisodePlayerScreen({
    super.key,
    required this.workshopSlug,
    required this.episodeId,
  });

  final String workshopSlug;
  final String episodeId;

  @override
  ConsumerState<WorkshopEpisodePlayerScreen> createState() =>
      _WorkshopEpisodePlayerScreenState();
}

class _WorkshopEpisodePlayerScreenState
    extends ConsumerState<WorkshopEpisodePlayerScreen> {
  static const _speeds = [0.75, 1.0, 1.25, 1.5, 2.0];

  Map<String, dynamic>? _playback;
  bool _loading = true;
  String? _error;

  BetterPlayerController? _playerController;
  WebViewController? _webViewController;
  bool _hlsFailed = false;
  double _speed = 1.0;
  double _duration = 0;
  double _currentTime = 0;

  Timer? _progressTimer;
  bool _completionFired = false;

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

  Future<void> _init() async {
    final prefs = await SharedPreferences.getInstance();
    _speed = prefs.getDouble(kPrefPlaybackSpeed) ?? 1.0;
    try {
      final playback = await ref
          .read(workshopsServiceProvider)
          .getEpisodePlayback(widget.episodeId);
      if (!mounted) return;
      final alreadyDone = playback['isCompleted'] == true;
      if (alreadyDone) _completionFired = true;
      setState(() {
        _playback = playback;
        _loading = false;
      });
      _startProgressTimer();
      final videoType = playback['videoType'] as String?;
      final hlsUrl = playback['hlsUrl'] as String?;
      if (videoType == 'hls' && hlsUrl != null && hlsUrl.isNotEmpty) {
        _initHlsPlayer(playback, hlsUrl);
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

  void _initHlsPlayer(Map<String, dynamic> playback, String hlsUrl) {
    final resumeAt = (playback['resumeAtSeconds'] as num?)?.toInt() ?? 0;
    final source = BetterPlayerDataSource(
      BetterPlayerDataSourceType.network,
      hlsUrl,
      videoFormat: BetterPlayerVideoFormat.hls,
    );
    final config = BetterPlayerConfiguration(
      autoPlay: true,
      startAt: Duration(seconds: resumeAt),
      aspectRatio: 16 / 9,
      allowedScreenSleep: false,
      deviceOrientationsAfterFullScreen: [DeviceOrientation.portraitUp],
      controlsConfiguration: BetterPlayerControlsConfiguration(
        controlBarColor: Colors.black87,
        iconsColor: Colors.white,
        progressBarPlayedColor: Theme.of(context).colorScheme.primary,
        progressBarHandleColor: Theme.of(context).colorScheme.primary,
        progressBarBufferedColor: Colors.white38,
        progressBarBackgroundColor: Colors.white12,
        enableSkips: false,
        enableOverflowMenu: false,
      ),
    );
    final controller =
        BetterPlayerController(config, betterPlayerDataSource: source);
    controller.addEventsListener(_onBetterPlayerEvent);
    setState(() => _playerController = controller);
  }

  void _initWebView(Map<String, dynamic> playback) {
    final embedUrl = _bunnyEmbedUrl(playback);
    final html = _wrapperHtml(embedUrl);
    final controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..addJavaScriptChannel(
        'BunnyChannel',
        onMessageReceived: _onBunnyMessage,
      )
      ..loadHtmlString(html);
    setState(() => _webViewController = controller);
  }

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

  String _bunnyEmbedUrl(Map<String, dynamic> playback) {
    var url = (playback['videoUrl'] as String?) ?? '';
    url = url.replaceAllMapped(
      RegExp(r'https?://player\.mediadelivery\.net/play/(\d+)/([\w-]+)'),
      (m) => 'https://iframe.mediadelivery.net/embed/${m[1]}/${m[2]}',
    );
    final sep = url.contains('?') ? '&' : '?';
    final t = (playback['resumeAtSeconds'] as num?)?.toInt() ?? 0;
    return '$url${sep}fullscreen=false&autoplay=true&t=$t';
  }

  String _wrapperHtml(String embedUrl) {
    final escaped = embedUrl.replaceAll('"', '&quot;');
    return '''
<!DOCTYPE html>
<html>
<head><meta name="viewport" content="width=device-width, initial-scale=1">
<style>*{margin:0;padding:0;box-sizing:border-box}html,body,iframe{width:100%;height:100%;border:0;background:#000;display:block}</style>
</head>
<body>
<iframe id="player" src="$escaped" allow="accelerometer;gyroscope;autoplay;encrypted-media" allowfullscreen></iframe>
<script>
var pf=document.getElementById('player');var sub=false;
function send(m,v){var msg={context:'player.js',method:m};if(v!==undefined)msg.value=v;pf.contentWindow.postMessage(JSON.stringify(msg),'https://iframe.mediadelivery.net')}
window.addEventListener('message',function(e){if(!e.origin||e.origin.indexOf('mediadelivery.net')===-1)return;var raw=typeof e.data==='string'?e.data:JSON.stringify(e.data);try{var d=JSON.parse(raw);if(d&&(d.event||'').toLowerCase()==='ready'&&!sub){sub=true;['timeupdate','pause','ended'].forEach(function(ev){send('addEventListener',ev)});send('getDuration');send('getCurrentTime');send('isPaused')}}catch(x){}BunnyChannel.postMessage(raw)});
</script></body></html>''';
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

  void _startProgressTimer() {
    _progressTimer?.cancel();
    _progressTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      if (_currentTime <= 0) return;
      ref
          .read(workshopsServiceProvider)
          .postEpisodeProgress(
            widget.episodeId,
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
        .read(workshopsServiceProvider)
        .completeWorkshopEpisode(
          widget.episodeId,
          reportedDuration: _duration.toInt(),
        )
        .catchError((_) {});
    // Also post final progress so watch-history + resume position are correct.
    ref
        .read(workshopsServiceProvider)
        .postEpisodeProgress(
          widget.episodeId,
          watchedSeconds: _currentTime.toInt(),
          isCompleted: true,
        )
        .catchError((_) {});
  }

  void _onPositionChanged(double secs) {
    if (!mounted || _completionFired || _duration <= 0) return;
    if (secs >= _duration * 0.85) _onVideoEnded();
  }

  Future<void> _setSpeed(double speed) async {
    setState(() => _speed = speed);
    _playerController?.setSpeed(speed);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setDouble(kPrefPlaybackSpeed, speed);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(),
            AspectRatio(aspectRatio: 16 / 9, child: _buildPlayer()),
            if (!_loading && _playback != null) _buildControls(),
            if (!_loading && _playback != null) ...[
              Divider(height: 1, thickness: 1, color: context.tokens.borderCard),
              Expanded(child: _buildMetadata()),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    final title = _playback?['title'] as String? ?? 'Episode';
    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 48),
      child: ColoredBox(
        color: Colors.black,
        child: Row(
          children: [
            IconButton(
              icon: Icon(Icons.arrow_back, color: context.tokens.textPrimary),
              onPressed: () => context.pop(),
            ),
            Expanded(
              child: Text(
                title,
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
            const SizedBox(width: 12),
          ],
        ),
      ),
    );
  }

  Widget _buildPlayer() {
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
              const Icon(Icons.error_outline,
                  color: Colors.redAccent, size: 36),
              const SizedBox(height: 10),
              Text('Failed to load video',
                  style:
                      TextStyle(color: context.tokens.textSecondary, fontSize: 14)),
              const SizedBox(height: 12),
              TextButton(
                onPressed: () {
                  setState(() {
                    _loading = true;
                    _error = null;
                  });
                  _init();
                },
                child: Text('Retry',
                    style: TextStyle(color: Theme.of(context).colorScheme.primary)),
              ),
            ],
          ),
        ),
      );
    }
    final p = _playback!;
    final isHls =
        p['videoType'] == 'hls' && (p['hlsUrl'] as String?)?.isNotEmpty == true;
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

  Widget _buildControls() {
    return Container(
      color: context.tokens.bgSurface,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      child: Row(
        children: [
          PopupMenuButton<double>(
            tooltip: 'Playback speed',
            initialValue: _speed,
            onSelected: _setSpeed,
            color: context.tokens.bgSurface,
            child: Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                color: context.tokens.bgInput,
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: context.tokens.borderCard),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.speed,
                      color: context.tokens.textSecondary, size: 14),
                  const SizedBox(width: 4),
                  Text(
                    _speed == 1.0 ? '1×' : '$_speed×',
                    style: TextStyle(
                      color: context.tokens.textPrimary,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
            itemBuilder: (_) => _speeds
                .map((s) => PopupMenuItem<double>(
                      value: s,
                      child: Text(
                        s == 1.0 ? '1×' : '$s×',
                        style: TextStyle(
                          color: s == _speed
                              ? Theme.of(context).colorScheme.primary
                              : context.tokens.textPrimary,
                          fontWeight: s == _speed
                              ? FontWeight.w700
                              : FontWeight.w400,
                          fontSize: 14,
                        ),
                      ),
                    ))
                .toList(),
          ),
          const Spacer(),
          if (_duration > 0)
            Text(
              '${_fmt(_currentTime)} / ${_fmt(_duration)}',
              style:
                  TextStyle(color: context.tokens.textMuted, fontSize: 12),
            ),
        ],
      ),
    );
  }

  String _fmt(double total) {
    final t = total.toInt();
    final m = t ~/ 60;
    final s = (t % 60).toString().padLeft(2, '0');
    if (m > 0) return '${m}m ${s}s';
    return '${s}s';
  }

  Widget _buildMetadata() {
    final title = _playback?['title'] as String? ?? '';
    final description = _playback?['description'] as String?;
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: TextStyle(
              color: context.tokens.textPrimary,
              fontFamily: 'Rajdhani',
              fontSize: 20,
              fontWeight: FontWeight.w700,
              height: 1.3,
            ),
          ),
          if (description != null && description.isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(
              description,
              style: TextStyle(
                color: context.tokens.textSecondary,
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
