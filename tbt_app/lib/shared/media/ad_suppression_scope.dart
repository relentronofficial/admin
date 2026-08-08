import 'package:flutter/widgets.dart';

import 'media_interruption_coordinator.dart';

/// Suppresses ads for as long as this widget is in the tree — the Flutter
/// counterpart of user-web's `useSuppressAds` (TBT_ADS_SPECKIT.md §7.4).
///
/// Use it for screens and overlays where a fullscreen ad would be destructive
/// rather than merely annoying: live calls, auth flows, an open quiz, or a gate
/// the user is already blocked behind.
///
/// Suppression is ref-counted by the coordinator, so nesting two of these — or
/// combining one with a manual `suppress()` — behaves correctly; the inner
/// scope disposing does not lift the outer one.
class AdSuppressionScope extends StatefulWidget {
  const AdSuppressionScope({
    super.key,
    required this.reason,
    required this.child,
  });

  /// Identifies the suppression in `suppressionReasons`, for debugging "why is
  /// no ad showing?". Not user-visible.
  final String reason;

  final Widget child;

  @override
  State<AdSuppressionScope> createState() => _AdSuppressionScopeState();
}

class _AdSuppressionScopeState extends State<AdSuppressionScope> {
  @override
  void initState() {
    super.initState();
    MediaInterruptionCoordinator.instance.suppress(widget.reason);
  }

  @override
  void didUpdateWidget(AdSuppressionScope oldWidget) {
    super.didUpdateWidget(oldWidget);
    // A changed reason has to move the count, or the old reason stays
    // suppressed forever and the new one never is.
    if (oldWidget.reason != widget.reason) {
      MediaInterruptionCoordinator.instance.unsuppress(oldWidget.reason);
      MediaInterruptionCoordinator.instance.suppress(widget.reason);
    }
  }

  @override
  void dispose() {
    MediaInterruptionCoordinator.instance.unsuppress(widget.reason);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
