import 'package:flutter/material.dart';

import '../data/ad_models.dart';

/// Image creative — TBT_ADS_SPECKIT.md §10.
///
/// The overlay owns the clock; this widget only reports load success/failure
/// and swaps to the fallback creative once before giving up. Auto-close on
/// duration is the overlay's job too, so the same rule applies to a video whose
/// creative failed and left this standing in for it.
class ImageAdView extends StatefulWidget {
  const ImageAdView({
    super.key,
    required this.campaign,
    required this.onLoaded,
    required this.onError,
    this.forceFallback = false,
  });

  final AdCampaign campaign;
  final VoidCallback onLoaded;
  final VoidCallback onError;

  /// Start on the fallback creative — set when a video ad's own media failed
  /// and `mediaUrl` is a video URL that would never decode as an image.
  final bool forceFallback;

  @override
  State<ImageAdView> createState() => _ImageAdViewState();
}

class _ImageAdViewState extends State<ImageAdView> {
  late bool _useFallback = widget.forceFallback;
  bool _reportedLoaded = false;

  BoxFit get _fit => switch (widget.campaign.objectFit) {
        'cover' => BoxFit.cover,
        'fill' => BoxFit.fill,
        _ => BoxFit.contain,
      };

  @override
  Widget build(BuildContext context) {
    final src = _useFallback
        ? widget.campaign.fallbackMediaUrl
        : widget.campaign.mediaUrl;

    if (src == null || src.isEmpty) {
      // Nothing renderable. Report after this frame — calling back during build
      // would tear the overlay down mid-layout.
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) widget.onError();
      });
      return const SizedBox.expand();
    }

    return Image.network(
      src,
      fit: _fit,
      width: double.infinity,
      height: double.infinity,
      gaplessPlayback: true,
      frameBuilder: (context, child, frame, wasSynchronouslyLoaded) {
        final rendered = wasSynchronouslyLoaded || frame != null;
        if (rendered && !_reportedLoaded) {
          _reportedLoaded = true;
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) widget.onLoaded();
          });
        }
        return child;
      },
      errorBuilder: (context, _, __) {
        // One shot at the fallback creative before giving up entirely.
        if (!_useFallback && (widget.campaign.fallbackMediaUrl?.isNotEmpty ?? false)) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) setState(() => _useFallback = true);
          });
          return const SizedBox.expand();
        }
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) widget.onError();
        });
        return const SizedBox.expand();
      },
    );
  }
}
