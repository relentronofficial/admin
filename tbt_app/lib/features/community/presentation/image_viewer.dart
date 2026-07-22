import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';

import '../../../shared/theme/status_bar_scope.dart';

/// Full-screen image viewer with pinch-zoom + swipe-to-dismiss + share.
///
/// Presented as a `PageRoute` (fullscreen, opaque) so the OS status bar
/// is dimmed to the black backdrop and the underlying feed is hidden
/// while the user reviews media. Multi-image posts get a horizontal
/// `PageView` — each page is an [InteractiveViewer] so pinch-zoom is
/// isolated per image (zoom doesn't leak into the swipe gesture).
///
/// Dismissal:
///   * Tap the ✕ (top-left) → pop
///   * Vertical drag > 100 px in either direction → pop
///   * Android back → pop (default)
///
/// Share:
///   * Tap the share icon (top-right) → `Share.share(url)` with the
///     current image's URL
class FullscreenImageViewer extends StatefulWidget {
  const FullscreenImageViewer({
    super.key,
    required this.urls,
    this.initialIndex = 0,
  });

  final List<String> urls;
  final int initialIndex;

  /// Convenience — opens the viewer as a modal fullscreen route with a
  /// short fade transition (so it feels like a photo lightbox, not a
  /// full navigation).
  static Future<void> open(
    BuildContext context, {
    required List<String> urls,
    int initialIndex = 0,
  }) {
    return Navigator.of(context, rootNavigator: true).push<void>(
      PageRouteBuilder(
        opaque: false,
        barrierColor: Colors.black,
        transitionDuration: const Duration(milliseconds: 220),
        reverseTransitionDuration: const Duration(milliseconds: 180),
        pageBuilder: (_, __, ___) => FullscreenImageViewer(
          urls: urls,
          initialIndex: initialIndex,
        ),
        transitionsBuilder: (_, anim, __, child) =>
            FadeTransition(opacity: anim, child: child),
      ),
    );
  }

  @override
  State<FullscreenImageViewer> createState() => _FullscreenImageViewerState();
}

class _FullscreenImageViewerState extends State<FullscreenImageViewer> {
  late final PageController _pageController;
  late int _index;
  double _verticalDrag = 0;

  @override
  void initState() {
    super.initState();
    _index = widget.initialIndex.clamp(0, widget.urls.length - 1);
    _pageController = PageController(initialPage: _index);
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  void _dismiss() {
    if (Navigator.of(context).canPop()) Navigator.of(context).pop();
  }

  void _shareCurrent() {
    if (widget.urls.isEmpty) return;
    Share.share(widget.urls[_index]);
  }

  @override
  Widget build(BuildContext context) {
    return StatusBarScope.overDarkBackground(
      child: Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          // Vertical-drag dismiss layer wraps the whole page view so it
          // works no matter which image is showing. `onVerticalDragUpdate`
          // accumulates; on end, if > threshold, pop.
          GestureDetector(
            behavior: HitTestBehavior.opaque,
            onVerticalDragUpdate: (d) {
              _verticalDrag += d.delta.dy.abs();
            },
            onVerticalDragEnd: (d) {
              if (_verticalDrag > 100) {
                _dismiss();
              }
              _verticalDrag = 0;
            },
            child: PageView.builder(
              controller: _pageController,
              itemCount: widget.urls.length,
              onPageChanged: (i) => setState(() => _index = i),
              itemBuilder: (_, i) => InteractiveViewer(
                // Slightly beyond the default max to give room for
                // reading small text in shared screenshots.
                minScale: 1.0,
                maxScale: 5.0,
                clipBehavior: Clip.none,
                child: Center(
                  child: CachedNetworkImage(
                    imageUrl: widget.urls[i],
                    fit: BoxFit.contain,
                    placeholder: (_, __) => const Center(
                      child: CircularProgressIndicator(color: Colors.white),
                    ),
                    errorWidget: (_, __, ___) => const Icon(
                      Icons.broken_image,
                      color: Colors.white38,
                      size: 64,
                    ),
                  ),
                ),
              ),
            ),
          ),
          // Top bar — close on left, page indicator centered (when
          // multi-image), share on right.
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: SafeArea(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
                child: Row(
                  children: [
                    _RoundIconButton(
                      icon: Icons.close,
                      onTap: _dismiss,
                    ),
                    const Spacer(),
                    if (widget.urls.length > 1)
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: 0.5),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          '${_index + 1} / ${widget.urls.length}',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    const Spacer(),
                    _RoundIconButton(
                      icon: Icons.ios_share,
                      onTap: _shareCurrent,
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    ),
    );
  }
}

class _RoundIconButton extends StatelessWidget {
  const _RoundIconButton({required this.icon, required this.onTap});
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.black.withValues(alpha: 0.5),
      shape: const CircleBorder(),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: SizedBox(
          width: 40,
          height: 40,
          child: Icon(icon, color: Colors.white, size: 20),
        ),
      ),
    );
  }
}
