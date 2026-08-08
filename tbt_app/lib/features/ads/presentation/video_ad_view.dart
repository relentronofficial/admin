import 'dart:async';
import 'dart:convert';

import 'package:better_player_plus/better_player_plus.dart';
import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../data/ad_models.dart';

/// Video creative — TBT_ADS_SPECKIT.md §10.
///
/// Two-tier, the same split every other video surface in this app uses
/// (CLAUDE.md pitfall #19): `better_player_plus` when the backend gives us an
/// HLS URL, and the Bunny embed in a WebView otherwise. No second video package
/// is introduced (§10).
///
/// The HLS path is strongly preferred for ads: the embed cannot be asked for a
/// playhead synchronously, so percent-based skip gating degrades there to
/// whatever `timeupdate` last reported.
class VideoAdView extends StatefulWidget {
  const VideoAdView({
    super.key,
    required this.campaign,
    required this.controller,
    required this.onLoaded,
    required this.onPlaybackStarted,
    required this.onPositionChanged,
    required this.onEnded,
    required this.onError,
  });

  final AdCampaign campaign;

  /// Handed in by the overlay so it can pause/resume on app lifecycle changes
  /// without reaching into this widget's state.
  final VideoAdController controller;

  /// Reports the real media duration once known (0 when unknown).
  final void Function(double durationSeconds) onLoaded;
  final VoidCallback onPlaybackStarted;
  final void Function(double positionSeconds) onPositionChanged;
  final VoidCallback onEnded;
  final VoidCallback onError;

  @override
  State<VideoAdView> createState() => _VideoAdViewState();
}

/// Imperative handle the overlay holds. Deliberately tiny: lifecycle pause and
/// resume are the only things the overlay may do to the player.
class VideoAdController {
  void Function()? _pause;
  void Function()? _resume;
  void Function(bool muted)? _setMuted;

  void pause() => _pause?.call();
  void resume() => _resume?.call();
  void setMuted(bool muted) => _setMuted?.call(muted);
}

class _VideoAdViewState extends State<VideoAdView> {
  BetterPlayerController? _player;
  WebViewController? _webView;
  bool _useWebView = false;
  bool _startedReported = false;
  bool _errorReported = false;

  @override
  void initState() {
    super.initState();
    widget.controller._pause = _pause;
    widget.controller._resume = _resume;
    widget.controller._setMuted = _setMuted;

    final campaign = widget.campaign;
    final url = campaign.mediaUrl;
    final isHls = campaign.videoType == 'hls' && url != null && url.isNotEmpty;
    if (isHls) {
      _initPlayer(url);
    } else {
      _useWebView = true;
      _initWebView();
    }
  }

  // ── better_player (HLS) ───────────────────────────────────────────────────

  void _initPlayer(String url) {
    final campaign = widget.campaign;
    final controller = BetterPlayerController(
      BetterPlayerConfiguration(
        autoPlay: campaign.autoplay,
        looping: campaign.loop,
        aspectRatio: 16 / 9,
        fit: switch (campaign.objectFit) {
          'cover' => BoxFit.cover,
          'fill' => BoxFit.fill,
          _ => BoxFit.contain,
        },
        allowedScreenSleep: false,
        // An ad has no scrub bar, no fullscreen button and no overflow menu —
        // the only controls are the overlay's own skip/close/CTA. Leaving the
        // package controls on would hand the user a pause button and a way out
        // that bypasses every gate the admin configured.
        controlsConfiguration: const BetterPlayerControlsConfiguration(
          showControls: false,
        ),
      ),
      betterPlayerDataSource: BetterPlayerDataSource(
        BetterPlayerDataSourceType.network,
        url,
        videoFormat: BetterPlayerVideoFormat.hls,
      ),
    );

    controller.addEventsListener(_onPlayerEvent);
    _player = controller;
  }

  void _onPlayerEvent(BetterPlayerEvent event) {
    if (!mounted) return;
    switch (event.betterPlayerEventType) {
      case BetterPlayerEventType.initialized:
        _setMuted(widget.campaign.muted);
        final d = _player?.videoPlayerController?.value.duration;
        widget.onLoaded(d == null ? 0 : d.inMilliseconds / 1000);

      case BetterPlayerEventType.play:
        if (_startedReported) break;
        _startedReported = true;
        widget.onPlaybackStarted();

      case BetterPlayerEventType.progress:
        final pos = event.parameters?['progress'] as Duration?;
        if (pos != null) widget.onPositionChanged(pos.inMilliseconds / 1000);

      case BetterPlayerEventType.finished:
        // A looping ad never finishes — the overlay closes it on its own clock.
        if (!widget.campaign.loop) widget.onEnded();

      case BetterPlayerEventType.exception:
        _reportError();

      default:
        break;
    }
  }

  // ── WebView (Bunny embed fallback) ────────────────────────────────────────

  void _initWebView() {
    final embed = _embedUrl();
    if (embed == null) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _reportError());
      return;
    }
    _webView = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..addJavaScriptChannel('BunnyAdChannel', onMessageReceived: _onBunnyMessage)
      ..loadHtmlString(_wrapperHtml(embed));
  }

  String? _embedUrl() {
    final campaign = widget.campaign;
    final id = campaign.bunnyVideoId;
    final raw = campaign.mediaUrl;
    final base = id != null && id.isNotEmpty
        ? 'https://iframe.mediadelivery.net/embed/$id'
        : (raw != null && raw.contains('mediadelivery.net') ? raw : null);
    if (base == null) return null;
    final sep = base.contains('?') ? '&' : '?';
    return '$base${sep}autoplay=${campaign.autoplay}&muted=${campaign.muted}'
        '&loop=${campaign.loop}&preload=true';
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
<iframe id="p" src="$escaped" allow="accelerometer;gyroscope;autoplay;encrypted-media"></iframe>
<script>
var pf=document.getElementById('p');var sub=false;
function send(m,v){var msg={context:'player.js',method:m};if(v!==undefined)msg.value=v;pf.contentWindow.postMessage(JSON.stringify(msg),'https://iframe.mediadelivery.net')}
window.adSend=send;
window.addEventListener('message',function(e){if(!e.origin||e.origin.indexOf('mediadelivery.net')===-1)return;var raw=typeof e.data==='string'?e.data:JSON.stringify(e.data);try{var d=JSON.parse(raw);if(d&&(d.event||'').toLowerCase()==='ready'&&!sub){sub=true;['timeupdate','ended'].forEach(function(ev){send('addEventListener',ev)});send('getDuration')}}catch(x){}BunnyAdChannel.postMessage(raw)});
</script></body></html>''';
  }

  void _onBunnyMessage(JavaScriptMessage msg) {
    if (!mounted) return;
    try {
      final data = json.decode(msg.message);
      if (data is! Map<String, dynamic>) return;
      final evt = (data['event'] as String? ?? '').toLowerCase();
      final value = data['value'];

      if (evt == 'getduration' && value is num) {
        widget.onLoaded(value.toDouble());
        return;
      }
      if (evt == 'timeupdate') {
        if (!_startedReported) {
          _startedReported = true;
          widget.onPlaybackStarted();
        }
        final seconds = value is Map
            ? (value['seconds'] as num?)?.toDouble()
            : (value as num?)?.toDouble();
        if (seconds != null) widget.onPositionChanged(seconds);
        return;
      }
      if (evt == 'ended' && !widget.campaign.loop) {
        widget.onEnded();
      }
    } catch (_) {
      // A malformed bridge message is not worth ending an ad over.
    }
  }

  // ── Imperative handle ─────────────────────────────────────────────────────

  void _pause() {
    _player?.pause();
    unawaited(_webView?.runJavaScript("adSend('pause')") ?? Future.value());
  }

  void _resume() {
    _player?.play();
    unawaited(_webView?.runJavaScript("adSend('play')") ?? Future.value());
  }

  void _setMuted(bool muted) {
    _player?.setVolume(muted ? 0 : 1);
    unawaited(
      _webView?.runJavaScript("adSend('setMuted', $muted)") ?? Future.value(),
    );
  }

  void _reportError() {
    if (_errorReported) return;
    _errorReported = true;
    widget.onError();
  }

  @override
  void dispose() {
    widget.controller._pause = null;
    widget.controller._resume = null;
    widget.controller._setMuted = null;
    _player?.removeEventsListener(_onPlayerEvent);
    _player?.dispose();
    _player = null;
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_useWebView) {
      final web = _webView;
      if (web == null) return const SizedBox.expand();
      return WebViewWidget(controller: web);
    }
    final player = _player;
    if (player == null) return const SizedBox.expand();
    return BetterPlayer(controller: player);
  }
}
